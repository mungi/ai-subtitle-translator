import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSummarySystemPrompt,
  isRequestTooLargeError,
  isSummaryProvider,
  splitTranscript,
  SUMMARY_PART_MAX_CHARS,
  summarizeTranscript
} from "../extension/shared/summary.js";
import { DEFAULT_SUMMARY_SYSTEM_PROMPT, normalizeSummarySystemPrompt } from "../extension/shared/defaults.js";

const provider = {
  id: "local",
  label: "Local",
  apiStyle: "openai-chat",
  baseUrl: "http://localhost:11434/v1",
  model: "test-model",
  maxTokens: 4096
};

function recordingFetch(replies) {
  const calls = [];
  const fetchText = async (_provider, request) => {
    const body = JSON.parse(request.init.body);
    calls.push({ system: body.messages[0].content, input: body.messages.at(-1).content, maxTokens: body.max_tokens });
    const reply = replies[calls.length - 1];
    if (reply instanceof Error) throw reply;
    return reply ?? `reply ${calls.length}`;
  };
  return { calls, fetchText };
}

test("summary prompt asks for a faithful, lecture-first Markdown summary in the target language", () => {
  const prompt = buildSummarySystemPrompt("Korean");
  assert.match(prompt, /Write in Korean/);
  assert.doesNotMatch(DEFAULT_SUMMARY_SYSTEM_PROMPT, /Write in |Korean|한국어/, "the output language comes only from the target language line");
  // Lectures first, other kinds of video handled only when relevant.
  assert.match(prompt, /lectures and other educational videos first/);
  assert.match(prompt, /- Lectures and educational videos: concepts, definitions/);
  assert.match(prompt, /- Tutorials and procedures: the complete sequence of steps/);
  assert.match(prompt, /- Meetings: decisions, action items/);
  // Complete and faithful, in the video's order, with no interpretation of its own.
  assert.match(prompt, /Never drop essential information/);
  assert.match(prompt, /follow the order in which topics are introduced/);
  assert.match(prompt, /Do not add outside knowledge, opinions, evaluations, recommendations, or unsupported interpretations/);
  assert.match(prompt, /never guess uncertain facts, names, or numbers/);
  assert.match(prompt, /numbers, and units exactly as given/);
  assert.doesNotMatch(DEFAULT_SUMMARY_SYSTEM_PROMPT, /Implications|ordered by importance|\d+-\d+ words/);
  // Title, overview with the points to remember, then topic sections in order.
  assert.match(prompt, /write every heading in the output language/);
  assert.match(prompt, /`# ` followed by a concise title/);
  assert.match(prompt, /overview of 2-3 sentences.*3-5 `-` bullets/s);
  assert.match(prompt, /One `## ` section per topic, in the order of the video/);
  assert.match(prompt, /numbered list/);
  assert.match(prompt, /completeness and clarity come before any word count/);
  assert.match(prompt, /Output only the summary/);
});

test("an edited summary prompt replaces the default and still gets the language line", async () => {
  const { calls, fetchText } = recordingFetch(["# Short"]);
  await summarizeTranscript({ text: "hello", languageName: "Korean", systemPrompt: "Three bullets only." }, { provider, fetchText });
  assert.equal(calls[0].system, "Three bullets only.\nWrite in Korean. Keep technical terms in their original form when that is clearer.");
  assert.equal(buildSummarySystemPrompt("Korean", "   "), `${DEFAULT_SUMMARY_SYSTEM_PROMPT}\nWrite in Korean. Keep technical terms in their original form when that is clearer.`);
});

test("a prompt saved as an earlier built-in default follows the current default; an edited one is kept", () => {
  const previousDefault = [
    "You write reading-friendly summaries of video transcripts.",
    "Source text is a video transcript (subtitles). It may contain speech-recognition errors; read through them using context.",
    "Keep every key point: main ideas, definitions, reasons, examples, numbers, names, warnings, steps, and conclusions. Do not drop important content to make the text shorter.",
    "Use only what the transcript says. Do not add opinions, evaluations, advice, background knowledge, or comments about the video or the speaker.",
    "Keep code, commands, file names, product names, and numbers exactly as given.",
    "Follow the order in which the video presents the content.",
    "Format as Markdown:",
    "- First line: `# ` followed by a short title that names the topic.",
    "- Then a 2-3 sentence overview of the whole video.",
    "- Then one `## ` section per topic, in order. Inside a section, write short paragraphs.",
    "- When the content is a procedure or sequence, use a numbered list (1. 2. 3.). Use `-` bullets for parallel items such as options, features, or cautions. Use `###` only when a section has clearly separate sub-parts.",
    "Output only the summary. No preamble, no closing remarks."
  ].join("\n");
  assert.equal(normalizeSummarySystemPrompt(previousDefault), DEFAULT_SUMMARY_SYSTEM_PROMPT);
  assert.equal(normalizeSummarySystemPrompt(previousDefault.replace(/\n/g, "\r\n")), DEFAULT_SUMMARY_SYSTEM_PROMPT);
  assert.equal(normalizeSummarySystemPrompt(`${previousDefault}\nUse tables.`), `${previousDefault}\nUse tables.`);
  assert.equal(normalizeSummarySystemPrompt(""), DEFAULT_SUMMARY_SYSTEM_PROMPT);
});

test("a hosted model with a large context summarizes a long transcript in one request", async () => {
  const claude = { id: "anthropic", label: "Anthropic", apiStyle: "anthropic-messages", baseUrl: "https://api.anthropic.com", apiKey: "k", model: "claude-haiku-5-5", maxTokens: 16384 };
  const text = Array.from({ length: 2000 }, (_, index) => `Line ${index} of a long lecture transcript.`).join("\n");
  assert.ok(text.length > SUMMARY_PART_MAX_CHARS * 3);
  const calls = [];
  const summary = await summarizeTranscript({ text }, {
    provider: claude,
    fetchText: async (_provider, request) => {
      calls.push(JSON.parse(request.init.body).messages.at(-1).content);
      return "# One";
    }
  });
  assert.equal(summary, "# One");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /Line 1999 of a long lecture transcript\./);
});

test("a request too large for the model or account restarts with smaller parts, without waiting", async () => {
  const text = Array.from({ length: 2000 }, (_, index) => `Line ${index} of a long lecture transcript.`).join("\n");
  const tooLarge = Object.assign(new Error("HTTP 429: This request would exceed the rate limit for your organization of 50,000 input tokens per minute."), { status: 429 });
  const inputs = [];
  const waits = [];
  const summary = await summarizeTranscript({ text }, {
    provider,
    maxPartChars: 120000,
    waitFor: async (ms) => waits.push(ms),
    fetchText: async (_provider, request) => {
      const input = JSON.parse(request.init.body).messages.at(-1).content;
      inputs.push(input.length);
      if (inputs.length === 1) throw tooLarge;
      return /\[Part 1\]/.test(input) ? "# Merged" : "notes";
    }
  });
  assert.equal(summary, "# Merged");
  assert.deepEqual(waits, [], "a too-large request is not retried as it is");
  assert.ok(inputs[0] > text.length - 100, "the first request carried the whole transcript");
  // Half of the transcript per part: two parts and a merge.
  assert.equal(inputs.length, 4);
  assert.ok(inputs[1] <= text.length * 0.525 + 100);

  // At the default part size the same error is retried as before.
  const atDefault = recordingFetch([tooLarge, "# Done"]);
  const retried = [];
  assert.equal(await summarizeTranscript({ text: "hello" }, { provider, fetchText: atDefault.fetchText, waitFor: async (ms) => retried.push(ms) }), "# Done");
  assert.deepEqual(retried, [2000]);
});

test("too-large errors are told apart from ordinary rate limits and bad requests", () => {
  const error = (status, message) => Object.assign(new Error(`HTTP ${status}: ${message}`), { status });
  assert.equal(isRequestTooLargeError(error(413, "Payload Too Large")), true);
  assert.equal(isRequestTooLargeError(error(400, "This model's maximum context length is 128000 tokens.")), true);
  assert.equal(isRequestTooLargeError(error(400, "prompt is too long: 210000 tokens > 200000 maximum")), true);
  assert.equal(isRequestTooLargeError(error(400, "The input token count (1200000) exceeds the maximum number of tokens allowed (1048576).")), true);
  assert.equal(isRequestTooLargeError(error(429, "Request too large for gpt-4.1 on tokens per min (TPM): Limit 30000, Requested 45000.")), true);
  assert.equal(isRequestTooLargeError(error(429, "Rate limit reached for requests per min (RPM)")), false);
  assert.equal(isRequestTooLargeError(error(400, "Invalid model name")), false);
  assert.equal(isRequestTooLargeError(error(503, "context length busy")), false);
});

test("transcript splits on line breaks and cuts only over-long lines", () => {
  assert.deepEqual(splitTranscript("aaa\nbbb\nccc", 7), ["aaa\nbbb", "ccc"]);
  assert.deepEqual(splitTranscript("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assert.deepEqual(splitTranscript("\n\n"), []);
});

test("a short transcript is summarized in one request", async () => {
  const { calls, fetchText } = recordingFetch(["<think>plan</think># Title\n\nOverview"]);
  const progress = [];
  const summary = await summarizeTranscript(
    { text: "Line one.\nLine two.", title: "Intro", languageName: "Korean" },
    { provider, fetchText, onProgress: (value) => progress.push(value) }
  );
  assert.equal(summary, "# Title\n\nOverview");
  assert.equal(calls.length, 1);
  assert.match(calls[0].input, /Video title: Intro/);
  assert.match(calls[0].input, /Line one\.\nLine two\./);
  assert.equal(calls[0].maxTokens, 8192);
  assert.deepEqual(progress, [{ step: 0, total: 1 }, { step: 1, total: 1 }]);
});

test("a long transcript becomes notes per part, then one merged summary", async () => {
  const { calls, fetchText } = recordingFetch(["notes A", "notes B", "notes C", "# Final"]);
  const progress = [];
  const summary = await summarizeTranscript(
    { text: "part one\npart two\npart three", languageName: "Japanese" },
    { provider, fetchText, maxPartChars: 10, onProgress: (value) => progress.push(value) }
  );
  assert.equal(summary, "# Final");
  assert.equal(calls.length, 4);
  assert.match(calls[0].system, /only one part of a long transcript/);
  assert.match(calls[1].input, /Part 2 of 3/);
  assert.match(calls[3].system, /Merge them into one summary/);
  assert.match(calls[3].input, /\[Part 1\]\nnotes A\n\n\[Part 2\]\nnotes B\n\n\[Part 3\]\nnotes C/);
  assert.deepEqual(progress.at(-1), { step: 4, total: 4 });
});

test("transient provider errors are retried, other errors stop the summary", async () => {
  const busy = Object.assign(new Error("HTTP 503: busy"), { status: 503 });
  const retried = recordingFetch([busy, "# Done"]);
  assert.equal(
    await summarizeTranscript({ text: "hello" }, { provider, fetchText: retried.fetchText, waitFor: async () => {} }),
    "# Done"
  );
  assert.equal(retried.calls.length, 2);

  const denied = Object.assign(new Error("HTTP 401: bad key"), { status: 401 });
  const failed = recordingFetch([denied]);
  await assert.rejects(
    summarizeTranscript({ text: "hello" }, { provider, fetchText: failed.fetchText, waitFor: async () => {} }),
    /bad key/
  );
  assert.equal(failed.calls.length, 1);
});

test("machine translation engines cannot summarize", async () => {
  assert.equal(isSummaryProvider({ apiStyle: "google-translate" }), false);
  assert.equal(isSummaryProvider({ apiStyle: "deepl" }), false);
  assert.equal(isSummaryProvider(provider), true);
  await assert.rejects(summarizeTranscript({ text: "hi" }, { provider: { apiStyle: "deepl" } }), /LLM provider/);
});
