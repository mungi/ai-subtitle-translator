import test from "node:test";
import assert from "node:assert/strict";
import { translateSubtitleDocument } from "../extension/shared/translation.js";

const doc = (texts = ["First sentence.", "Second sentence.", "Third sentence."]) => ({
  platform: "youtube", videoId: "cache-video", sourceLanguage: "en",
  cues: texts.map((text, i) => ({ id: `yt-${i}`, start: i * 130, end: i * 130 + 4, text }))
});
async function withEnvironment(run) {
  const previous = { chrome: globalThis.chrome, fetch: globalThis.fetch };
  const stored = { llmSettings: { activeProvider: "google", targetLanguage: "ko", translationStyle: "technical",
    settingsMode: "advanced", llmParallelRequests: 1, maxChunkDurationSeconds: 90,
    cacheTranslations: true, providerTestStatus: { google: "success" }, providers: { google: { apiKey: "test-key", model: "gemini-test" } } } };
  const requests = [];
  globalThis.chrome = { runtime: { id: "test" }, i18n: { getUILanguage: () => "ko" }, storage: { local: {
    get: async () => structuredClone(stored),
    set: async (patch) => Object.assign(stored, structuredClone(patch))
  } } };
  globalThis.fetch = async (_url, init) => {
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    requests.push(input.cues.map((cue) => cue.text));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      translations: input.cues.map(({ id, text }) => ({ id, text: `번역 ${text}` }))
    }) }] } }] }));
  };
  try { await run({ stored, requests }); }
  finally { globalThis.chrome = previous.chrome; globalThis.fetch = previous.fetch; }
}
function keepSentenceCache(stored) {
  stored.translationCache = Object.fromEntries(Object.entries(stored.translationCache).filter(([key]) => key.startsWith("sentence-v1:")));
}

test("persisted sentences survive reopening with changed IDs, timings and playback position without LLM calls", async () => {
  await withEnvironment(async ({ stored, requests }) => {
    const source = doc();
    await translateSubtitleDocument(source);
    assert.equal(requests.length, 3);
    keepSentenceCache(stored);
    const reopened = { ...source, cues: source.cues.map((cue, i) => ({ ...cue, id: `new-${i}`, start: cue.start + 0.1, end: cue.end + 0.1 })) };
    const progress = [];
    const result = await translateSubtitleDocument(reopened, { initialStartTime: 260, onProgress: (event) => progress.push(event) });
    assert.equal(requests.length, 3);
    assert.equal(result.cacheHit, true);
    assert.equal(result.cachedCueCount, 3);
    assert.equal(result.cacheMissCueCount, 0);
    assert.equal(progress[0].cacheHit, true);
    assert.equal(progress[0].cues.length, 3);
    assert.deepEqual(result.cues.map(({ id, start, end }) => ({ id, start, end })), reopened.cues.map(({ id, start, end }) => ({ id, start, end })));
    assert.ok(result.cues.every((cue) => cue.text.startsWith("번역")));
  });
});

test("navigation cancellation retains completed sentences and only missing sentences are requested on return", async () => {
  await withEnvironment(async ({ stored, requests }) => {
    const controller = new AbortController();
    await assert.rejects(translateSubtitleDocument(doc(), { signal: controller.signal, onProgress: () => controller.abort() }));
    assert.equal(requests.length, 1);
    assert.ok(Object.keys(stored.translationCache).some((key) => key.startsWith("sentence-v1:")));
    await translateSubtitleDocument(doc(), { initialStartTime: 260 });
    assert.equal(requests.length, 3);
    assert.equal(requests.flat().filter((text) => text === "First sentence.").length, 1);
  });
});

test("only changed source sentences miss cache; settings and forced translation remain isolated", async () => {
  await withEnvironment(async ({ stored, requests }) => {
    await translateSubtitleDocument(doc());
    keepSentenceCache(stored);
    await translateSubtitleDocument(doc(["First sentence.", "Changed sentence.", "Third sentence."]));
    assert.equal(requests.length, 4);
    assert.deepEqual(requests.at(-1), ["Changed sentence."]);
    stored.llmSettings.translationStyle = "natural";
    await translateSubtitleDocument(doc());
    assert.equal(requests.length, 7);
    await translateSubtitleDocument(doc(), { forceNoCache: true });
    assert.equal(requests.length, 10);
  });
});

test("fallback translations are not persisted as successful LLM sentences", async () => {
  await withEnvironment(async ({ stored }) => {
    const requests = [];
    globalThis.fetch = async (url, init) => {
      if (String(url).includes("translate.googleapis.com")) {
        const texts = new URLSearchParams(init.body).getAll("q");
        return new Response(JSON.stringify(texts.map(() => "대체 번역")));
      }
      const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
      requests.push(input.cues.map((cue) => cue.text));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        translations: requests.length === 1 ? [{ id: "0", text: "정상 번역" }] : []
      }) }] } }] }));
    };
    const source = doc(["First sentence.", "Second sentence."]);
    source.cues[1].start = 5;
    source.cues[1].end = 8;
    const result = await translateSubtitleDocument(source);
    assert.equal(result.fallbackProviderId, "googleTranslate");
    assert.equal(result.cues[0].text, "정상 번역");
    const entries = Object.values(stored.translationCache);
    assert.equal(entries.length, 1);
    assert.deepEqual(Object.values(entries[0].groups).map((group) => group.source), ["First sentence."]);
  });
});

test("clearing the cache removes sentence reuse as well as complete-document reuse", async () => {
  await withEnvironment(async ({ stored, requests }) => {
    await translateSubtitleDocument(doc());
    delete stored.translationCache;
    await translateSubtitleDocument(doc());
    assert.equal(requests.length, 6);
  });
});
