import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import { translationInternals as internals } from "../extension/shared/translation.js";

const makeDocument = (count, text = (i) => `fragment ${i}`) => ({
  platform: "youtube", videoId: "alignment-test", sourceLanguage: "en",
  cues: Array.from({ length: count }, (_, i) => ({ id: `yt-${i}`, start: i * 2, end: i * 2 + 3, text: text(i) }))
});

test("alignment requests prefer complete sentences and preserve every original cue", () => {
  const doc = makeDocument(70, (i) => i % 7 === 6 ? "The sentence ends here." : "A sentence fragment");
  const chunks = internals.splitLlmChunksAtSentenceBoundaries([{ ...doc }]);
  assert.deepEqual(chunks.map((chunk) => chunk.cues.length), [35, 35]);
  assert.deepEqual(chunks.flatMap((chunk) => chunk.cues), doc.cues);
  for (const chunk of chunks) assert.match(chunk.cues.at(-1).text, /[.]$/);
});

test("punctuation-free ASR and long cues cannot produce unbounded alignment requests", () => {
  for (const doc of [makeDocument(150), makeDocument(20, () => "x".repeat(700))]) {
    const chunks = internals.splitLlmChunksAtSentenceBoundaries([{ ...doc }]);
    assert.deepEqual(chunks.flatMap((chunk) => chunk.cues), doc.cues);
    for (const chunk of chunks) {
      assert.ok(chunk.cues.length <= 40);
      assert.ok(chunk.cues.reduce((sum, cue) => sum + cue.text.length, 0) <= 3000);
      assert.ok(chunk.cues.at(-1).start - chunk.cues[0].start < 90);
    }
  }
  const oversized = makeDocument(2, () => "x".repeat(4000));
  assert.deepEqual(internals.splitLlmChunksAtSentenceBoundaries([oversized]).map((c) => c.cues.length), [1, 1]);
});

test("HAR regression: a 150-to-56 compressed response is discarded in full, including shifted IDs", async () => {
  const originalFetch = globalThis.fetch;
  const doc = makeDocument(150);
  const inputs = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.contents[0].parts[0].text);
    inputs.push(input);
    const translations = inputs.length === 1
      ? input.cues.slice(0, 56).map((cue) => ({ id: cue.id, text: "WRONG: later speech assigned to an earlier ID" }))
      : input.cues.map((cue) => ({ id: cue.id, text: `correct ${cue.id}` }));
    return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ translations }) }] } }] }));
  };
  try {
    const result = await internals.translateLlmChunkWithRetry(
      { ...PROVIDERS.google, apiKey: "test-key" },
      { targetLanguage: "ko", translationStyle: "natural" }, doc
    );
    assert.deepEqual(inputs.map((input) => input.cues.length), [150, 75, 75]);
    assert.deepEqual(result, doc.cues.map((cue) => ({ id: cue.id, text: `correct ${cue.id}` })));
    assert.equal(inputs[1].contextAfter[0].text, "fragment 75");
    assert.equal(inputs[1].contextAfter[0].id, undefined);
    assert.equal(inputs[2].contextBefore.at(-1).text, "fragment 74");
    const merged = internals.mergeTranslations(doc, result);
    assert.deepEqual(merged.cues.map(({ id, start, end }) => ({ id, start, end })), doc.cues.map(({ id, start, end }) => ({ id, start, end })));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("both sides of a sentence are context only, never additional translation targets", async () => {
  const originalFetch = globalThis.fetch;
  const doc = makeDocument(12);
  const inputs = [];
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.contents[0].parts[0].text);
    inputs.push(input);
    assert.match(body.systemInstruction.parts[0].text, /Never merge, summarize, renumber, or move meaning between cue ids/);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translations: input.cues.map(({ id }) => ({ id, text: `번역 ${id}` })) }) }] } }] }));
  };
  try {
    const progress = [];
    const chunks = [doc.cues.slice(0, 4), doc.cues.slice(4, 8), doc.cues.slice(8)].map((cues, chunkIndex) => ({ ...doc, cues, chunkIndex, chunkCount: 3 }));
    const translations = await internals.translateLlmChunksWithPriority({ ...PROVIDERS.google, apiKey: "test-key" }, { targetLanguage: "ko", translationStyle: "custom", customSystemPrompt: "Be energetic." }, doc, chunks, (event) => progress.push(event));
    const middle = inputs.find((input) => input.cues[0].id === "yt-4");
    assert.deepEqual(middle.contextBefore.map((cue) => cue.text), ["fragment 0", "fragment 1", "fragment 2", "fragment 3"]);
    assert.deepEqual(middle.contextAfter.map((cue) => cue.text), ["fragment 8", "fragment 9", "fragment 10", "fragment 11"]);
    assert.equal(translations.length, 12);
    assert.equal(new Set(progress.flatMap((event) => event.cues.map((cue) => cue.id))).size, 12);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("persistent invalid output has bounded requests and falls back only the failing range", async () => {
  const originalFetch = globalThis.fetch;
  const doc = makeDocument(12);
  const llmRanges = [];
  const machineTexts = [];
  const progress = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("translate.googleapis.com")) {
      const texts = new URLSearchParams(init.body).getAll("q");
      machineTexts.push(...texts);
      return new Response(JSON.stringify(texts.map((text) => `fallback ${text}`)));
    }
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    llmRanges.push(input.cues.map((cue) => cue.id));
    const translations = input.cues[0].id === "yt-0"
      ? input.cues.slice(0, -1).map(({ id }) => ({ id, text: "INVALID partial" }))
      : input.cues.map(({ id }) => ({ id, text: `valid ${id}` }));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translations }) }] } }] }));
  };
  try {
    const chunks = [doc.cues.slice(0, 8), doc.cues.slice(8)].map((cues, chunkIndex) => ({ ...doc, cues, chunkIndex, chunkCount: 2 }));
    const result = await internals.translateLlmChunksWithPriority({ ...PROVIDERS.google, apiKey: "test-key" }, { targetLanguage: "ko", providers: PROVIDERS }, doc, chunks, (event) => progress.push(event));
    assert.deepEqual(llmRanges.map((ids) => ids.length), [8, 4, 4]);
    assert.deepEqual(machineTexts, doc.cues.slice(0, 8).map((cue) => cue.text));
    assert.equal(result.length, 12);
    assert.equal(result[0].text, "fallback fragment 0");
    assert.equal(result[8].text, "valid yt-8");
    assert.equal(result.fallbackReason, "alignment_failed");
    assert.equal(progress[0].fallbackReason, "alignment_failed");
    assert.equal(progress.at(-1).isComplete, true);
  } finally { globalThis.fetch = originalFetch; }
});


test("sentence context stops at a nearby sentence boundary and has a character cap", () => {
  const cues = [{ text: "Earlier." }, { text: "Unfinished" }, { text: "sentence" }, { text: "ends here." }];
  assert.deepEqual(internals.selectSentenceContext(cues, true), cues.slice(1));
  assert.deepEqual(internals.selectSentenceContext([{ text: "The sentence" }, { text: "ends." }, { text: "Not needed" }]), [{ text: "The sentence" }, { text: "ends." }]);
  const long = [{ text: "x".repeat(1000) }, { text: "y".repeat(1000) }];
  for (const before of [true, false]) assert.equal(internals.selectSentenceContext(long, before).reduce((sum, cue) => sum + cue.text.length, 0), 600);
});


test("provider failure replaces only its failed chunk and reports exact fallback IDs", async (t) => {
  const doc = makeDocument(8);
  const machine = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url).includes("translate.googleapis.com")) {
      const texts = new URLSearchParams(init.body).getAll("q"); machine.push(...texts);
      return new Response(JSON.stringify(texts.map((text) => "대체 " + text)));
    }
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    if (input.cues[0].id === "yt-4") return new Response(JSON.stringify({ error: { message: "Request rejected" } }), { status: 400 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translations: input.cues.map(({ id }) => ({ id, text: "완료 " + id })) }) }] } }] }));
  });
  const chunks = [doc.cues.slice(0, 4), doc.cues.slice(4)].map((cues, chunkIndex) => ({ ...doc, cues, chunkIndex, chunkCount: 2 }));
  const result = await internals.translateLlmChunksWithPriority({ ...PROVIDERS.google, apiKey: "test" }, { providers: PROVIDERS, targetLanguage: "ko" }, doc, chunks, () => {});
  assert.deepEqual(machine, doc.cues.slice(4).map((cue) => cue.text));
  assert.deepEqual(result.fallbackCueIds, ["yt-4", "yt-5", "yt-6", "yt-7"]);
  assert.equal(result[0].text, "완료 yt-0");
});
