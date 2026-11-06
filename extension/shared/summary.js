// Summarizes a whole video transcript with the active LLM provider. Long transcripts are split
// into parts, each part becomes ordered notes, and the notes are merged into one summary.
import { buildProviderRequest, extractText } from "./provider-request.js";
import { assertProviderEndpoint } from "./provider-security.js";
import { normalizeSummarySystemPrompt } from "./defaults.js";

export const SUMMARY_PART_MAX_CHARS = 20000;
const SUMMARY_NOTES_MAX_TOKENS = 4096;
const SUMMARY_FINAL_MAX_TOKENS = 8192;
const SUMMARY_RETRY_MAX_ATTEMPTS = 4;
const SUMMARY_RETRY_BASE_DELAY_MS = 2000;
const SUMMARY_RETRY_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504, 529]);

function languageInstruction(languageName) {
  return `Write in ${languageName || "the transcript's language"}. Keep technical terms in their original form when that is clearer.`;
}

export function buildSummarySystemPrompt(languageName, basePrompt) {
  return [normalizeSummarySystemPrompt(basePrompt), languageInstruction(languageName)].join("\n");
}

export function buildNotesSystemPrompt(languageName, basePrompt) {
  return [
    normalizeSummarySystemPrompt(basePrompt),
    "This request covers only one part of a long transcript. Instead of the final summary format, write detailed notes for this part: one `## ` heading per topic, with bullets, or a numbered list for steps. Be complete rather than short; the notes of all parts are merged into one summary later.",
    "Output only the notes.",
    languageInstruction(languageName)
  ].join("\n");
}

export function buildMergeSystemPrompt(languageName, basePrompt) {
  return [
    normalizeSummarySystemPrompt(basePrompt),
    "The input is ordered notes taken from consecutive parts of one video. Merge them into one summary: join topics that continue across parts and remove repeats, but keep every distinct point.",
    languageInstruction(languageName)
  ].join("\n");
}

// Splits on line breaks so a sentence is not cut; a single over-long line is cut by length.
export function splitTranscript(text, maxChars = SUMMARY_PART_MAX_CHARS) {
  const parts = [];
  let current = "";
  for (const rawLine of String(text ?? "").split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const pieces = [];
    for (let index = 0; index < line.length; index += maxChars) pieces.push(line.slice(index, index + maxChars));
    for (const piece of pieces) {
      if (current && current.length + piece.length + 1 > maxChars) {
        parts.push(current);
        current = "";
      }
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function stripReasoning(text) {
  return String(text ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason || new Error("Summary was cancelled.");
}

function wait(delayMs, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener?.("abort", () => {
      clearTimeout(timer);
      reject(signal.reason || new Error("Summary was cancelled."));
    }, { once: true });
  });
}

async function fetchProviderText(provider, request, signal) {
  const response = await fetch(request.url, { ...request.init, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.error?.message || body.message || response.statusText;
    const error = new Error(`HTTP ${response.status}: ${detail}`);
    error.status = response.status;
    throw error;
  }
  return extractText(provider, body);
}

async function requestSummaryText(provider, { systemPrompt, input, maxTokens }, { fetchText = fetchProviderText, signal, waitFor = wait } = {}) {
  // A provider set to a smaller output limit keeps its own limit only when it is larger.
  const tokens = Math.max(Number(provider.maxTokens) || 0, maxTokens);
  for (let attempt = 1; ; attempt += 1) {
    throwIfAborted(signal);
    try {
      const request = buildProviderRequest(provider, { systemPrompt, input, structuredOutput: false, maxTokens: tokens });
      const text = stripReasoning(await fetchText(provider, request, signal));
      if (!text) throw new Error("The model returned an empty summary.");
      return text;
    } catch (error) {
      throwIfAborted(signal);
      const status = Number(error?.status);
      const retryable = SUMMARY_RETRY_STATUS_CODES.has(status) || (!Number.isFinite(status) && error?.name === "TypeError");
      if (!retryable || attempt >= SUMMARY_RETRY_MAX_ATTEMPTS) throw error;
      await waitFor(SUMMARY_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)), signal);
    }
  }
}

export function isSummaryProvider(provider) {
  return Boolean(provider) && !["google-translate", "deepl"].includes(provider.apiStyle);
}

// onProgress receives { step, total }: total is the number of model calls the summary needs.
export async function summarizeTranscript({ text, title = "", languageName = "", systemPrompt }, {
  provider,
  onProgress,
  signal,
  maxPartChars = SUMMARY_PART_MAX_CHARS,
  ...requestOptions
} = {}) {
  if (!isSummaryProvider(provider)) throw new Error("Summaries need an LLM provider.");
  assertProviderEndpoint(provider);
  const parts = splitTranscript(text, maxPartChars);
  if (parts.length === 0) throw new Error("There is no transcript to summarize.");
  const titleLine = title ? `Video title: ${title}\n\n` : "";
  const options = { ...requestOptions, signal };

  if (parts.length === 1) {
    onProgress?.({ step: 0, total: 1 });
    const summary = await requestSummaryText(provider, {
      systemPrompt: buildSummarySystemPrompt(languageName, systemPrompt),
      input: `${titleLine}Transcript:\n${parts[0]}`,
      maxTokens: SUMMARY_FINAL_MAX_TOKENS
    }, options);
    onProgress?.({ step: 1, total: 1 });
    return summary;
  }

  let notes = [];
  let total = parts.length + 1;
  for (const [index, part] of parts.entries()) {
    onProgress?.({ step: index, total });
    notes.push(await requestSummaryText(provider, {
      systemPrompt: buildNotesSystemPrompt(languageName, systemPrompt),
      input: `${titleLine}Part ${index + 1} of ${parts.length}. Transcript:\n${part}`,
      maxTokens: SUMMARY_NOTES_MAX_TOKENS
    }, options));
  }

  // Notes of a very long video can exceed one request; merge them in groups until they fit.
  let step = parts.length;
  while (notes.join("\n\n").length > maxPartChars && notes.length > 1) {
    const groups = splitTranscript(notes.map((note) => note.replace(/\n+/g, "\n")).join("\n"), maxPartChars);
    if (groups.length >= notes.length) break;
    total += groups.length;
    const merged = [];
    for (const group of groups) {
      onProgress?.({ step, total });
      merged.push(await requestSummaryText(provider, {
        systemPrompt: buildNotesSystemPrompt(languageName, systemPrompt),
        input: `${titleLine}Ordered notes to condense without losing points:\n${group}`,
        maxTokens: SUMMARY_NOTES_MAX_TOKENS
      }, options));
      step += 1;
    }
    notes = merged;
  }

  onProgress?.({ step, total });
  const summary = await requestSummaryText(provider, {
    systemPrompt: buildMergeSystemPrompt(languageName, systemPrompt),
    input: `${titleLine}${notes.map((note, index) => `[Part ${index + 1}]\n${note}`).join("\n\n")}`,
    maxTokens: SUMMARY_FINAL_MAX_TOKENS
  }, options);
  onProgress?.({ step: total, total });
  return summary;
}
