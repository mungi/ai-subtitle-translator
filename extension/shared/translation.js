import { buildProviderRequest, extractText, shouldRetryOpenRouterWithoutReasoning } from "./provider-request.js";
import { assertProviderEndpoint } from "./provider-security.js";
import { getCustomSystemPromptSettingKey, isCustomTranslationStyle, buildSystemPromptFromSettings } from "./defaults.js";
import { getSettings } from "./storage.js";
import { decodeXmlEntities, normalizeCue, validateCues } from "./subtitles.js";

const TRANSLATION_CACHE_KEY = "translationCache";
export const TRANSLATION_CACHE_MAX_ENTRIES = 30;
export const TRANSLATION_CACHE_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_CUE_CHARS_PER_CHUNK = 24000;
const DEFAULT_MAX_CUES_PER_CHUNK = 500;
const DEFAULT_LLM_CHUNK_MAX_DURATION_SECONDS = 420;
const MIN_LLM_RETRY_CUES_PER_CHUNK = 1;
const LLM_PARALLEL_CHUNK_LIMIT = 2;
const GOOGLE_MAX_CHARS_PER_CHUNK = 1500;
const GOOGLE_CUE_DELIMITER = "\n\n";
const GOOGLE_TRANSLATE_PROVIDER_ID = "googleTranslate";
const DEEPL_MAX_TEXTS_PER_REQUEST = 50;
const DEEPL_MAX_REQUEST_BODY_BYTES = 128 * 1024;
const QUOTA_EXCEEDED_FALLBACK_REASON = "quota_exceeded";
const CONTEXT_CUE_COUNT = 8;
const INITIAL_LLM_CHUNK_MAX_DURATION_SECONDS = 60;
const INITIAL_LLM_CHUNK_MAX_CHARS = 1500;
const LLM_RATE_LIMIT_FALLBACK_THRESHOLD = 5;

function buildTranslationInput(document, { contextBefore = [] } = {}) {
  return JSON.stringify({
    platform: document.platform,
    videoId: document.videoId,
    sourceLanguage: document.sourceLanguage,
    contextBefore,
    cues: document.cues.map((cue) => ({
      id: cue.id,
      start: cue.start,
      end: cue.end,
      text: cue.text
    })),
    responseFormat: {
      translations: [
        {
          id: "same cue id",
          text: "translated subtitle text"
        }
      ]
    }
  });
}

function cueTextLength(cue) {
  return String(cue.text ?? "").length;
}

function pushChunk(chunks, document, cues) {
  if (cues.length === 0) return;
  chunks.push({
    ...document,
    videoId: document.videoId,
    chunkIndex: chunks.length,
    chunkCount: 0,
    cues
  });
}

function splitRemainingCuesIntoChunks(document, cues, maxCueChars, cueLimit, maxDurationSeconds, chunks) {
  let currentCues = [];
  let currentSize = 0;
  let chunkStartTime = 0;

  for (const cue of cues) {
    const cueSize = cueTextLength(cue);
    const exceedsCharLimit = currentSize + cueSize > maxCueChars;
    const exceedsCueLimit = currentCues.length >= cueLimit;
    const cueStart = Number(cue.start);
    const exceedsDurationLimit = currentCues.length > 0
      && Number.isFinite(cueStart)
      && cueStart >= chunkStartTime + maxDurationSeconds;
    if (currentCues.length > 0 && (exceedsCharLimit || exceedsCueLimit || exceedsDurationLimit)) {
      pushChunk(chunks, document, currentCues);
      currentCues = [];
      currentSize = 0;
    }

    if (currentCues.length === 0) {
      chunkStartTime = Number.isFinite(cueStart) ? cueStart : 0;
    }
    currentCues.push(cue);
    currentSize += cueSize;
  }

  pushChunk(chunks, document, currentCues);
}

function findCueIndexAtOrAfterTime(cues, currentTime) {
  return cues.findIndex((cue) => currentTime < cue.end || currentTime <= cue.start);
}

function getChunkContextBefore(document, chunk) {
  const firstCueId = chunk.cues[0]?.id;
  const firstCueIndex = document.cues.findIndex((cue) => cue.id === firstCueId);
  if (firstCueIndex <= 0) return [];
  return document.cues.slice(Math.max(0, firstCueIndex - CONTEXT_CUE_COUNT), firstCueIndex).map((cue) => ({
    id: cue.id,
    text: cue.text
  }));
}

function splitDocumentIntoChunks(
  document,
  maxCueChars = DEFAULT_MAX_CUE_CHARS_PER_CHUNK,
  maxCues = DEFAULT_MAX_CUES_PER_CHUNK,
  {
    initialStartTime = 0,
    initialMaxDurationSeconds = INITIAL_LLM_CHUNK_MAX_DURATION_SECONDS,
    initialMaxCueChars = INITIAL_LLM_CHUNK_MAX_CHARS,
    maxDurationSeconds = DEFAULT_LLM_CHUNK_MAX_DURATION_SECONDS
  } = {}
) {
  const chunks = [];
  const cues = Array.isArray(document.cues) ? document.cues : [];
  const cueLimit = Math.max(1, Number(maxCues) || DEFAULT_MAX_CUES_PER_CHUNK);
  const initialDurationLimit = Math.max(0, Number(initialMaxDurationSeconds) || 0);
  const durationLimit = Math.max(1, Number(maxDurationSeconds) || DEFAULT_LLM_CHUNK_MAX_DURATION_SECONDS);
  const initialCharLimit = Math.min(
    Math.max(1, Number(maxCueChars) || DEFAULT_MAX_CUE_CHARS_PER_CHUNK),
    Math.max(1, Number(initialMaxCueChars) || INITIAL_LLM_CHUNK_MAX_CHARS)
  );
  const priorityStartIndex = findCueIndexAtOrAfterTime(cues, Number(initialStartTime) || 0);

  if (priorityStartIndex >= 0 && initialDurationLimit > 0) {
    const firstCue = cues[priorityStartIndex];
    const firstStart = Number(firstCue.start);
    const initialWindowStart = Math.max(Number(initialStartTime) || 0, Number.isFinite(firstStart) ? firstStart : 0);
    const initialEnd = initialWindowStart + initialDurationLimit;
    const initialCues = [];
    let currentSize = 0;
    let cursor = priorityStartIndex;

    for (; cursor < cues.length; cursor += 1) {
      const cue = cues[cursor];
      const cueStart = Number(cue.start);
      const cueSize = cueTextLength(cue);
      const exceedsDurationLimit = initialCues.length > 0 && Number.isFinite(cueStart) && cueStart >= initialEnd;
      const exceedsCharLimit = initialCues.length > 0 && currentSize + cueSize > initialCharLimit;
      if (exceedsDurationLimit || exceedsCharLimit) break;

      initialCues.push(cue);
      currentSize += cueSize;
    }
    pushChunk(chunks, document, initialCues);
    splitRemainingCuesIntoChunks(document, cues.slice(cursor), maxCueChars, cueLimit, durationLimit, chunks);
    splitRemainingCuesIntoChunks(document, cues.slice(0, priorityStartIndex), maxCueChars, cueLimit, durationLimit, chunks);
  } else {
    splitRemainingCuesIntoChunks(document, cues, maxCueChars, cueLimit, durationLimit, chunks);
  }

  return chunks.map((chunk) => ({
    ...chunk,
    chunkCount: chunks.length
  }));
}

function stripReasoningBlocks(value) {
  return String(value ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function extractJsonText(value) {
  const text = stripReasoningBlocks(value);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  return text;
}

function parseTranslationResponse(text) {
  const jsonText = extractJsonText(text);
  let parsed;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const looseTranslations = parseLooseTranslations(jsonText);
    if (looseTranslations.length > 0) {
      return looseTranslations;
    }
    throw error;
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed.translations)) {
    return parsed.translations;
  }
  throw new Error("Translation response must contain a translations array.");
}

function parseLooseTranslations(text) {
  const translations = [];
  const objectPattern = /\{[^{}]*["']id["']\s*:\s*["']([^"']+)["'][^{}]*["']text["']\s*:\s*(["'])([\s\S]*?)\2[^{}]*\}/g;

  for (const match of String(text ?? "").matchAll(objectPattern)) {
    translations.push({
      id: match[1],
      text: match[3]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, "\"")
        .replace(/\\\\/g, "\\")
        .trim()
    });
  }

  return translations;
}

function sanitizeTranslatedText(value) {
  return decodeXmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createTranslatedCues(document, translations) {
  const translationById = new Map(
    translations
      .filter((item) => item?.id && typeof item.text === "string")
      .map((item) => [String(item.id), sanitizeTranslatedText(item.text)])
  );
  return document.cues.map((cue) => normalizeCue({
    ...cue,
    text: translationById.get(cue.id) || cue.text
  }));
}

function analyzeChunkTranslations(chunk, translations) {
  const expectedIds = new Set(chunk.cues.map((cue) => String(cue.id)));
  const translationById = new Map();
  const invalidIds = [];
  const unexpectedIds = [];
  const duplicateIds = [];
  const emptyIds = [];

  for (const item of translations) {
    const id = item?.id == null ? "" : String(item.id);
    if (!id) {
      invalidIds.push(id);
      continue;
    }
    if (!expectedIds.has(id)) {
      unexpectedIds.push(id);
      continue;
    }
    if (translationById.has(id)) {
      duplicateIds.push(id);
      continue;
    }
    if (typeof item.text !== "string" || item.text.trim() === "") {
      emptyIds.push(id);
      continue;
    }
    translationById.set(id, item.text);
  }

  const missingIds = [...expectedIds].filter((id) => !translationById.has(id));
  const ok = invalidIds.length === 0
    && unexpectedIds.length === 0
    && duplicateIds.length === 0
    && emptyIds.length === 0
    && missingIds.length === 0;

  return {
    ok,
    invalidIds,
    unexpectedIds,
    duplicateIds,
    emptyIds,
    missingIds,
    translationById,
    hasOnlyRecoverableMissing: invalidIds.length === 0
      && unexpectedIds.length === 0
      && duplicateIds.length === 0
      && missingIds.length > 0
  };
}

function buildChunkTranslationError(analysis) {
  if (analysis.invalidIds.length > 0) {
    return new Error("Translation response contains an item without a cue id.");
  }
  if (analysis.unexpectedIds.length > 0) {
    return new Error(`Translation response contains an unexpected cue id: ${analysis.unexpectedIds[0]}`);
  }
  if (analysis.duplicateIds.length > 0) {
    return new Error(`Translation response contains a duplicate cue id: ${analysis.duplicateIds[0]}`);
  }
  if (analysis.emptyIds.length > 0) {
    return new Error(`Translation response contains an empty translation for cue id: ${analysis.emptyIds[0]}`);
  }
  if (analysis.missingIds.length > 0) {
    return new Error(`Translation response is missing ${analysis.missingIds.length} cue translation(s): ${analysis.missingIds.slice(0, 5).join(", ")}`);
  }
  return new Error("Translation response is invalid.");
}

function orderChunkTranslations(chunk, translationById) {
  return chunk.cues.map((cue) => ({
    id: cue.id,
    text: translationById.get(String(cue.id))
  }));
}

function validateChunkTranslations(chunk, translations) {
  const analysis = analyzeChunkTranslations(chunk, translations);
  if (!analysis.ok) {
    throw buildChunkTranslationError(analysis);
  }
}

function buildContextBeforeForMissingCues(chunk, contextBefore, missingIds) {
  const firstMissingIndex = chunk.cues.findIndex((cue) => missingIds.has(String(cue.id)));
  if (firstMissingIndex <= 0) return contextBefore;

  return chunk.cues.slice(Math.max(0, firstMissingIndex - CONTEXT_CUE_COUNT), firstMissingIndex).map((cue) => ({
    id: cue.id,
    text: cue.text
  }));
}

function sanitizeTranslatedDocument(document = {}) {
  return {
    ...document,
    cues: Array.isArray(document?.cues)
      ? document.cues.map((cue) => normalizeCue({
        ...cue,
        text: sanitizeTranslatedText(cue.text)
      }))
      : []
  };
}

function mergeTranslations(document, translations) {
  const cues = createTranslatedCues(document, translations);
  const validation = validateCues(cues);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return {
    ...document,
    sourceDocument: document,
    targetLanguage: document.targetLanguage,
    cues
  };
}

function buildCacheKey(document, settings, provider) {
  const cueSignature = document.cues
    .map((cue) => `${cue.id}:${cue.start}:${cue.end}:${cue.text}`)
    .join("|");
  return [
    "v1",
    document.platform,
    document.videoId,
    document.sourceLanguage,
    settings.targetLanguage,
    settings.translationStyle,
    isCustomTranslationStyle(settings.translationStyle)
      ? String(hashString(settings[getCustomSystemPromptSettingKey(settings.translationStyle)] || ""))
      : "",
    provider.id,
    provider.model,
    String(cueSignature.length),
    String(hashString(cueSignature))
  ].join(":");
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function readCachedTranslation(cacheKey) {
  const stored = await chrome.storage.local.get(TRANSLATION_CACHE_KEY);
  return stored[TRANSLATION_CACHE_KEY]?.[cacheKey] || null;
}

function estimateJsonBytes(value) {
  const json = JSON.stringify(value);
  return typeof TextEncoder === "function"
    ? new TextEncoder().encode(json).byteLength
    : json.length * 2;
}

function pruneTranslationCache(cache, {
  maxEntries = TRANSLATION_CACHE_MAX_ENTRIES,
  maxBytes = TRANSLATION_CACHE_MAX_BYTES
} = {}) {
  const entries = Object.entries(cache || {}).sort(([, left], [, right]) => {
    const leftTime = Date.parse(left?.createdAt || "") || 0;
    const rightTime = Date.parse(right?.createdAt || "") || 0;
    return leftTime - rightTime;
  });

  while (entries.length > Math.max(1, maxEntries)) {
    entries.shift();
  }

  let pruned = Object.fromEntries(entries);
  while (entries.length > 1 && estimateJsonBytes(pruned) > maxBytes) {
    entries.shift();
    pruned = Object.fromEntries(entries);
  }
  return pruned;
}

let cacheWriteQueue = Promise.resolve();

async function writeCachedTranslation(cacheKey, document) {
  cacheWriteQueue = cacheWriteQueue.catch(() => {}).then(async () => {
    const stored = await chrome.storage.local.get(TRANSLATION_CACHE_KEY);
    const cache = {
      ...(stored[TRANSLATION_CACHE_KEY] || {}),
      [cacheKey]: {
        createdAt: new Date().toISOString(),
        document
      }
    };
    await chrome.storage.local.set({
      [TRANSLATION_CACHE_KEY]: pruneTranslationCache(cache)
    });
  });
  return cacheWriteQueue;
}

async function fetchProviderJson(provider, payload) {
  const response = await fetch(payload.url, payload.init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = body.error?.message || body.message || response.statusText;
    const error = new Error(`HTTP ${response.status}: ${detail}`);
    error.status = response.status;
    error.providerId = provider.id;
    throw error;
  }

  return extractText(provider, body).trim();
}

function createLlmRequestController({
  maxConcurrentRequests = LLM_PARALLEL_CHUNK_LIMIT,
  rateLimitFallbackThreshold = LLM_RATE_LIMIT_FALLBACK_THRESHOLD
} = {}) {
  let concurrentRequestLimit = Math.max(1, Number(maxConcurrentRequests) || 1);
  let activeRequestCount = 0;
  let rateLimitErrorCount = 0;
  let terminalError = null;
  const waiters = [];

  const rejectWaitingRequests = (error) => {
    while (waiters.length > 0) {
      waiters.shift().reject(error);
    }
  };

  const releaseWaitingRequests = () => {
    if (terminalError) {
      rejectWaitingRequests(terminalError);
      return;
    }

    while (activeRequestCount < concurrentRequestLimit && waiters.length > 0) {
      activeRequestCount += 1;
      waiters.shift().resolve();
    }
  };

  const acquire = async () => {
    if (terminalError) throw terminalError;
    if (activeRequestCount < concurrentRequestLimit) {
      activeRequestCount += 1;
      return;
    }

    await new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    if (terminalError) throw terminalError;
  };

  return {
    async run(request) {
      await acquire();
      try {
        if (terminalError) throw terminalError;
        return await request();
      } finally {
        activeRequestCount = Math.max(0, activeRequestCount - 1);
        releaseWaitingRequests();
      }
    },
    recordRateLimitError(error) {
      concurrentRequestLimit = 1;
      rateLimitErrorCount += 1;

      if (rateLimitErrorCount >= rateLimitFallbackThreshold) {
        terminalError = error;
        rejectWaitingRequests(error);
        throw error;
      }
    },
    get concurrentRequestLimit() {
      return concurrentRequestLimit;
    },
    get rateLimitErrorCount() {
      return rateLimitErrorCount;
    }
  };
}

async function fetchLlmChunkTranslations(provider, settings, chunk, contextBefore = [], requestController) {
  const requestOptions = {
    systemPrompt: buildSystemPromptFromSettings(settings),
    input: buildTranslationInput(chunk, { contextBefore })
  };
  const request = buildProviderRequest(provider, requestOptions);
  const requestJson = (payload) => requestController
    ? requestController.run(() => fetchProviderJson(provider, payload))
    : fetchProviderJson(provider, payload);

  try {
    const text = await requestJson(request);
    return parseTranslationResponse(text);
  } catch (error) {
    if (!shouldRetryOpenRouterWithoutReasoning(provider, error)) throw error;

    provider.disableReasoning = false;
    const compatibleRequest = buildProviderRequest(provider, requestOptions);
    const text = await requestJson(compatibleRequest);
    return parseTranslationResponse(text);
  }
}

async function translateLlmChunkWithRetry(provider, settings, chunk, contextBefore = [], requestController) {
  try {
    const chunkTranslations = await fetchLlmChunkTranslations(provider, settings, chunk, contextBefore, requestController);
    const analysis = analyzeChunkTranslations(chunk, chunkTranslations);
    if (analysis.ok) {
      return orderChunkTranslations(chunk, analysis.translationById);
    }

    if (analysis.hasOnlyRecoverableMissing && analysis.missingIds.length < chunk.cues.length) {
      const missingIds = new Set(analysis.missingIds);
      const missingChunk = {
        ...chunk,
        cues: chunk.cues.filter((cue) => missingIds.has(String(cue.id)))
      };
      const missingContext = buildContextBeforeForMissingCues(chunk, contextBefore, missingIds);
      const missingTranslations = await translateLlmChunkWithRetry(provider, settings, missingChunk, missingContext, requestController);
      const translationById = new Map(analysis.translationById);
      for (const item of missingTranslations) {
        translationById.set(String(item.id), item.text);
      }
      return orderChunkTranslations(chunk, translationById);
    }

    throw buildChunkTranslationError(analysis);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      if (!isRateLimitError(error) || !requestController) throw error;
      requestController.recordRateLimitError(error);
      return translateLlmChunkWithRetry(provider, settings, chunk, contextBefore, requestController);
    }
    if (chunk.cues.length <= MIN_LLM_RETRY_CUES_PER_CHUNK) {
      throw error;
    }

    const midpoint = Math.ceil(chunk.cues.length / 2);
    const leftChunk = {
      ...chunk,
      cues: chunk.cues.slice(0, midpoint)
    };
    const rightChunk = {
      ...chunk,
      cues: chunk.cues.slice(midpoint)
    };
    const rightContext = leftChunk.cues.slice(-CONTEXT_CUE_COUNT).map((cue) => ({
      id: cue.id,
      text: cue.text
    }));

    const leftTranslations = await translateLlmChunkWithRetry(provider, settings, leftChunk, contextBefore, requestController);
    const rightTranslations = await translateLlmChunkWithRetry(provider, settings, rightChunk, rightContext, requestController);
    return [...leftTranslations, ...rightTranslations];
  }
}

async function translateLlmChunksWithPriority(provider, settings, document, chunks, onProgress) {
  const translationsByChunk = new Array(chunks.length);
  const requestController = createLlmRequestController();
  let completedChunkCount = 0;

  const translateChunkAt = async (index) => {
    const chunk = chunks[index];
    const contextBefore = getChunkContextBefore(document, chunk);
    const chunkTranslations = await translateLlmChunkWithRetry(provider, settings, chunk, contextBefore, requestController);
    translationsByChunk[index] = chunkTranslations;
    completedChunkCount += 1;

    if (onProgress) {
      onProgress({
        chunkIndex: index,
        chunkCount: chunks.length,
        completedChunkCount,
        isComplete: completedChunkCount === chunks.length,
        cues: createTranslatedCues(chunk, chunkTranslations)
      });
    }
  };

  if (chunks.length === 0) return [];

  await translateChunkAt(0);
  let nextChunkIndex = 1;
  const worker = async () => {
    while (nextChunkIndex < chunks.length) {
      const index = nextChunkIndex;
      nextChunkIndex += 1;
      await translateChunkAt(index);
    }
  };
  const workerCount = Math.min(LLM_PARALLEL_CHUNK_LIMIT, chunks.length - 1);
  const results = await Promise.allSettled(Array.from({ length: workerCount }, worker));
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;

  return translationsByChunk.flat();
}

function normalizeTargetLanguage(targetLanguage) {
  return String(targetLanguage || "ko").trim();
}

function normalizeSourceLanguage(sourceLanguage) {
  const value = String(sourceLanguage || "auto").split("-")[0].trim();
  return value || "auto";
}

function splitCuesForGoogle(cues, maxChars = GOOGLE_MAX_CHARS_PER_CHUNK) {
  const chunks = [];
  let current = [];
  let currentText = "";

  for (const cue of cues) {
    const cueText = `${GOOGLE_CUE_DELIMITER}${cue.text || ""}`;
    const nextText = currentText ? `${currentText}${cueText}` : cueText;
    if (current.length > 0 && nextText.length > maxChars) {
      chunks.push({ cues: current, text: currentText });
      current = [];
      currentText = "";
    }

    current.push(cue);
    currentText = currentText ? `${currentText}${cueText}` : cueText;
  }

  if (current.length > 0) {
    chunks.push({ cues: current, text: currentText });
  }

  return chunks;
}

function parseGoogleTranslateBody(body) {
  if (body?.translations?.[0]?.text) {
    return String(body.translations[0].text);
  }
  if (Array.isArray(body?.[0])) {
    return body[0].map((part) => part?.[0] || "").join("");
  }
  return "";
}

function splitGoogleCueTranslations(text, expectedCount) {
  const parts = String(text || "")
    .split(GOOGLE_CUE_DELIMITER)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === expectedCount) {
    return parts;
  }

  return Array.from({ length: expectedCount }, (_, index) => parts[index] || "");
}

async function translateGoogleText(text, document, settings, provider) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: normalizeSourceLanguage(document.sourceLanguage || settings.sourceLanguage || "en"),
    tl: normalizeTargetLanguage(settings.targetLanguage),
    dt: "t",
    q: text
  });
  const response = await fetch(`${provider.baseUrl}?${params.toString()}`, {
    redirect: "error"
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Google Translate failed: HTTP ${response.status}: ${response.statusText}`);
  }

  return parseGoogleTranslateBody(body);
}

async function translateCuesWithGoogle(document, settings, provider, { onProgress, chunkCount = 1 } = {}) {
  const translations = [];
  const chunks = splitCuesForGoogle(document.cues);

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const translatedText = await translateGoogleText(chunk.text, document, settings, provider);
    const translatedParts = splitGoogleCueTranslations(translatedText, chunk.cues.length);
    const chunkTranslations = chunk.cues.map((cue, cueIndex) => ({
      id: cue.id,
      text: translatedParts[cueIndex] || cue.text
    }));
    translations.push(...chunkTranslations);

    if (onProgress) {
      onProgress({
        chunkIndex: index,
        chunkCount: chunks.length || chunkCount,
        cues: createTranslatedCues({ ...document, cues: chunk.cues }, chunkTranslations)
      });
    }
  }
  return translations;
}

function getDeepLEndpoint(provider) {
  if (provider.baseUrl) return provider.baseUrl;
  return provider.plan === "pro"
    ? "https://api.deepl.com/v2/translate"
    : "https://api-free.deepl.com/v2/translate";
}

function buildDeepLRequestBody(cues, document, settings) {
  const body = new URLSearchParams();
  for (const cue of cues) {
    body.append("text", cue.text);
  }
  body.set("target_lang", normalizeTargetLanguage(settings.targetLanguage).toUpperCase());
  if (document.sourceLanguage) {
    body.set("source_lang", normalizeSourceLanguage(document.sourceLanguage).toUpperCase());
  }
  return body;
}

function measureRequestBodyBytes(body) {
  return new TextEncoder().encode(body.toString()).length;
}

function splitCuesForDeepL(document, settings, maxTexts = DEEPL_MAX_TEXTS_PER_REQUEST, maxBytes = DEEPL_MAX_REQUEST_BODY_BYTES) {
  const chunks = [];
  let current = [];

  for (const cue of document.cues) {
    const next = [...current, cue];
    const exceedsTextLimit = next.length > maxTexts;
    const exceedsByteLimit = measureRequestBodyBytes(buildDeepLRequestBody(next, document, settings)) > maxBytes;

    if (current.length > 0 && (exceedsTextLimit || exceedsByteLimit)) {
      chunks.push(current);
      current = [];
    }

    const singleCueBody = buildDeepLRequestBody([cue], document, settings);
    if (measureRequestBodyBytes(singleCueBody) > maxBytes) {
      throw new Error(`DeepL request for cue ${cue.id} exceeds the 128 KiB request body limit.`);
    }

    current.push(cue);
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.map((cues, index) => ({
    ...document,
    chunkIndex: index,
    chunkCount: chunks.length,
    cues
  }));
}

async function translateCuesWithDeepL(document, settings, provider, { onProgress } = {}) {
  const apiKey = provider.apiKey?.trim();
  if (!apiKey) {
    throw new Error("DeepL API key is required.");
  }

  const chunks = splitCuesForDeepL(document, settings);
  const translations = [];

  for (const chunk of chunks) {
    const body = buildDeepLRequestBody(chunk.cues, document, settings);
    const response = await fetch(getDeepLEndpoint(provider), {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = responseBody.message || response.statusText;
      const error = new Error(`DeepL failed: HTTP ${response.status}: ${detail}`);
      error.status = response.status;
      error.providerId = provider.id;
      throw error;
    }

    const chunkTranslations = chunk.cues.map((cue, index) => ({
      id: cue.id,
      text: responseBody.translations?.[index]?.text || cue.text
    }));
    translations.push(...chunkTranslations);

    if (onProgress) {
      onProgress({
        chunkIndex: chunk.chunkIndex,
        chunkCount: chunk.chunkCount,
        cues: createTranslatedCues(chunk, chunkTranslations)
      });
    }
  }

  return translations;
}

async function translateWithMachineProvider(document, settings, provider, { onProgress, chunkIndex = 0, chunkCount = 1 } = {}) {
  const translations = provider.apiStyle === "deepl"
    ? await translateCuesWithDeepL(document, settings, provider, { onProgress })
    : await translateCuesWithGoogle(document, settings, provider, { onProgress, chunkCount });

  return translations;
}

function isQuotaExceededError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return error?.status === 429
    || error?.status === 456
    || message.includes("quota exceeded")
    || message.includes("쿼터")
    || message.includes("quota");
}

function isRateLimitError(error) {
  return Number(error?.status) === 429;
}

function buildQuotaFallbackMessage(activeProvider, fallbackProvider) {
  const activeLabel = activeProvider?.label || activeProvider?.id || "번역 provider";
  const fallbackLabel = fallbackProvider?.label || fallbackProvider?.id || "Google Translate";
  return `${activeLabel} 쿼터가 초과되어 ${fallbackLabel}로 대체 번역합니다.`;
}

async function translateWithFallbackProvider(document, settings, activeProvider, originalError, { onProgress } = {}) {
  const quotaExceeded = isQuotaExceededError(originalError);
  const fallbackProviderId = GOOGLE_TRANSLATE_PROVIDER_ID;
  const fallbackProvider = settings.providers?.[fallbackProviderId];
  if (!fallbackProvider || fallbackProvider.id === activeProvider.id) {
    throw originalError;
  }
  const fallbackReason = quotaExceeded ? QUOTA_EXCEEDED_FALLBACK_REASON : undefined;
  const fallbackMessage = quotaExceeded ? buildQuotaFallbackMessage(activeProvider, fallbackProvider) : undefined;

  const translations = await translateWithMachineProvider(document, settings, fallbackProvider, {
    onProgress: onProgress
      ? (progress) => onProgress({
        ...progress,
        fallbackProviderId: fallbackProvider.id,
        ...(fallbackReason ? { fallbackReason, fallbackMessage } : {})
      })
      : undefined
  });
  return {
    ...mergeTranslations(document, translations),
    targetLanguage: settings.targetLanguage,
    providerId: activeProvider.id,
    fallbackProviderId: fallbackProvider.id,
    ...(fallbackReason ? { fallbackReason, fallbackMessage } : {}),
    cacheHit: false
  };
}

export async function translateSubtitleDocument(document, {
  onProgress,
  providerId,
  forceNoCache = false,
  initialStartTime = 0,
  allowFallback = true
} = {}) {
  const settings = await getSettings();
  const provider = settings.providers[providerId || settings.activeProvider];
  assertProviderEndpoint(provider);
  const cacheKey = buildCacheKey(document, settings, provider);

  if (settings.cacheTranslations && !forceNoCache) {
    const cached = await readCachedTranslation(cacheKey);
    if (cached?.document) {
      return {
        ...sanitizeTranslatedDocument(cached.document),
        cacheHit: true
      };
    }
  }

  const configuredChunkSize = DEFAULT_MAX_CUE_CHARS_PER_CHUNK;
  if (provider.apiStyle === "google-translate" || provider.apiStyle === "deepl") {
    try {
      const translations = await translateWithMachineProvider(document, settings, provider, { onProgress });
      const result = {
        ...mergeTranslations(document, translations),
        targetLanguage: settings.targetLanguage,
        providerId: provider.id,
        chunkCount: 1,
        cacheHit: false
      };

      if (settings.cacheTranslations && !forceNoCache) {
        await writeCachedTranslation(cacheKey, result);
      }
      return result;
    } catch (error) {
      if (!allowFallback || !isQuotaExceededError(error)) {
        throw error;
      }
      const fallbackResult = await translateWithFallbackProvider(document, settings, provider, error, { onProgress });
      if (settings.cacheTranslations && !forceNoCache) {
        await writeCachedTranslation(cacheKey, fallbackResult);
      }
      return fallbackResult;
    }
  }

  const effectiveChunkSize = provider.id === "local"
    ? Math.min(configuredChunkSize, DEFAULT_MAX_CUE_CHARS_PER_CHUNK)
    : configuredChunkSize;
  const chunks = splitDocumentIntoChunks(document, effectiveChunkSize, DEFAULT_MAX_CUES_PER_CHUNK, {
    initialStartTime,
    maxDurationSeconds: settings.maxChunkDurationSeconds
  });
  try {
    const translations = await translateLlmChunksWithPriority(provider, settings, document, chunks, onProgress);
    const translatedDocument = mergeTranslations(document, translations);
    const result = {
      ...translatedDocument,
      targetLanguage: settings.targetLanguage,
      providerId: provider.id,
      chunkCount: chunks.length,
      cacheHit: false
    };

    if (settings.cacheTranslations && !forceNoCache) {
      await writeCachedTranslation(cacheKey, result);
    }
    return result;
  } catch (error) {
    if (!allowFallback) throw error;
    const fallbackResult = await translateWithFallbackProvider(document, settings, provider, error, { onProgress });
    if (settings.cacheTranslations && !forceNoCache) {
      await writeCachedTranslation(cacheKey, fallbackResult);
    }
    return fallbackResult;
  }

}

export const translationInternals = {
  buildSystemPrompt: buildSystemPromptFromSettings,
  buildTranslationInput,
  splitDocumentIntoChunks,
  stripReasoningBlocks,
  extractJsonText,
  parseTranslationResponse,
  parseLooseTranslations,
  validateChunkTranslations,
  createLlmRequestController,
  translateLlmChunkWithRetry,
  translateLlmChunksWithPriority,
  parseGoogleTranslateBody,
  splitCuesForGoogle,
  splitGoogleCueTranslations,
  createTranslatedCues,
  sanitizeTranslatedText,
  sanitizeTranslatedDocument,
  mergeTranslations,
  buildCacheKey,
  estimateJsonBytes,
  pruneTranslationCache,
  hashString,
  isQuotaExceededError,
  translateCuesWithGoogle,
  translateCuesWithDeepL,
  translateWithFallbackProvider
};
