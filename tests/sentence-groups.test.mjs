import test from "node:test";
import assert from "node:assert/strict";
import { buildSentenceGroups, distributeGroupTranslation } from "../extension/shared/sentence-groups.js";
import { translationInternals as internals } from "../extension/shared/translation.js";
import { PROVIDERS } from "../extension/shared/defaults.js";

const cues = (texts) => texts.map((text, i) => ({ id: `yt-${i}`, start: i * 2, end: i * 2 + 3, text }));
const document = (texts) => ({ platform: "youtube", videoId: "test", sourceLanguage: "en", cues: cues(texts) });
const reply = (translations) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translations }) }] } }] }));

test("sentence groups preserve all original cues and separate sentence boundaries", () => {
  const source = cues(["When you build", "a harness.", "Keep it updated."]);
  const groups = buildSentenceGroups(source);
  assert.deepEqual(groups.map((group) => group.members.length), [2, 1]);
  assert.deepEqual(groups.flatMap((group) => group.members), source);
  assert.equal(groups[0].text, "When you build a harness.");
  const long = buildSentenceGroups(cues(Array(30).fill("continuous speech")));
  assert.ok(long.every((group) => group.members.length <= 10));
});

test("group translation is distributed in order without changing IDs or source timing", () => {
  const group = buildSentenceGroups(cues(["When you build", "a harness."]))[0];
  const result = distributeGroupTranslation(group, "하네스를 만들 때에는 문맥을 유지해야 해.");
  assert.deepEqual(result.map((item) => item.id), ["yt-0", "yt-1"]);
  assert.equal(result.map((item) => item.text).join(" "), "하네스를 만들 때에는 문맥을 유지해야 해.");
  assert.deepEqual(distributeGroupTranslation(group, "좋아.").map((item) => item.text), ["좋아.", "좋아."]);
});

test("only a missing sentence group is retried; valid sentences are retained", async () => {
  const original = globalThis.fetch;
  const inputs = [];
  globalThis.fetch = async (_url, init) => {
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    inputs.push(input);
    return reply(inputs.length === 1 ? [{ id: "0", text: "정상 문장." }] : [{ id: "1", text: "복구 문장." }]);
  };
  try {
    const doc = document(["First sentence.", "Second sentence."]);
    const result = await internals.translateSentenceGroups({ ...PROVIDERS.google, apiKey: "test" }, { targetLanguage: "ko" }, doc, []);
    assert.deepEqual(inputs.map((input) => input.cues.map((cue) => cue.id)), [["0", "1"], ["1"]]);
    assert.deepEqual(result.map((item) => item.text), ["정상 문장.", "복구 문장."]);
    const merged = internals.mergeTranslations(doc, result);
    assert.deepEqual(merged.cues.map(({ id, start, end }) => ({ id, start, end })), doc.cues.map(({ id, start, end }) => ({ id, start, end })));
  } finally { globalThis.fetch = original; }
});

test("seeking reorders pending final chunks without restarting completed work", async () => {
  const original = globalThis.fetch;
  const inputs = [];
  globalThis.fetch = async (_url, init) => {
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    inputs.push(input.cues[0].id);
    return reply(input.cues.map(({ id }) => ({ id, text: "번역" })));
  };
  try {
    const doc = document(["A.", "B.", "C.", "D.", "E."]);
    const chunks = doc.cues.map((cue) => ({ ...doc, cues: [cue] }));
    let time;
    const result = await internals.translateLlmChunksWithPriority({ ...PROVIDERS.google, apiKey: "test" },
      { settingsMode: "advanced", llmParallelRequests: 1 }, doc, chunks, () => { time = 6; }, undefined, () => time);
    assert.deepEqual(inputs, ["yt-0", "yt-3", "yt-4", "yt-1", "yt-2"]);
    assert.equal(result.length, 5);
  } finally { globalThis.fetch = original; }
});


test("a persistently invalid sentence falls back without retranslating a valid sentence", async () => {
  const original = globalThis.fetch;
  const machine = [];
  let llmCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("translate.googleapis.com")) {
      const texts = new URLSearchParams(init.body).getAll("q");
      machine.push(...texts);
      return new Response(JSON.stringify(texts.map(() => "복구 번역")));
    }
    llmCalls += 1;
    return reply(llmCalls === 1 ? [{ id: "0", text: "정상 번역" }] : []);
  };
  try {
    const doc = document(["First sentence.", "Second sentence."]);
    const result = await internals.translateSentenceGroups({ ...PROVIDERS.google, apiKey: "test" },
      { targetLanguage: "ko", providers: PROVIDERS }, doc, []);
    assert.equal(llmCalls, 2);
    assert.deepEqual(machine, ["Second sentence."]);
    assert.deepEqual(result.map((item) => item.text), ["정상 번역", "복구 번역"]);
    assert.deepEqual(result.fallbackCueIds, ["yt-1"]);
  } finally { globalThis.fetch = original; }
});
