import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import { normalizeSettings } from "../extension/shared/storage.js";
import { translationInternals } from "../extension/shared/translation.js";

test("parallel settings preserve advanced preferences and bound imported values", () => {
  assert.equal(normalizeSettings().settingsMode, "simple");
  assert.equal(normalizeSettings().llmParallelRequests, 3);
  for (const [value, expected] of [[undefined, 3], ["bad", 3], [0, 1], [100, 8], [3.9, 3]]) {
    assert.equal(normalizeSettings({ settingsMode: "advanced", llmParallelRequests: value }).llmParallelRequests, expected);
  }
  const saved = normalizeSettings({ settingsMode: "simple", llmParallelRequests: 7 });
  assert.equal(saved.llmParallelRequests, 7);
  assert.equal(normalizeSettings({ ...saved, settingsMode: "advanced" }).llmParallelRequests, 7);
});

for (const [mode, configured, expected] of [["simple", 8, 1], ["advanced", undefined, 3], ["advanced", 1, 1], ["advanced", 6, 6]]) {
  test(`${mode} with parallel value ${configured} runs at most ${expected} LLM requests`, async (t) => {
    let active = 0;
    let maximum = 0;
    let starts = 0;
    const document = { platform: "test", videoId: "parallel-test", sourceLanguage: "en",
      cues: Array.from({ length: 10 }, (_, index) => ({ id: String(index), start: index * 5, end: index * 5 + 4, text: "Hello." })) };
    t.mock.method(globalThis, "fetch", async (_url, init) => {
      const body = JSON.parse(init.body);
      const input = JSON.parse(body.contents[0].parts[0].text);
      if (starts === 0) assert.equal(input.cues[0].id, "0");
      starts += 1;
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translations: input.cues.map(({ id }) => ({ id, text: `번역 ${id}` })) }) }] } }] }));
    });
    const chunks = document.cues.map((cue, chunkIndex) => ({ ...document, cues: [cue], chunkIndex, chunkCount: 10 }));
    const result = await translationInternals.translateLlmChunksWithPriority({ ...PROVIDERS.google, apiKey: "test" }, {
      settingsMode: mode, llmParallelRequests: configured, targetLanguage: "ko"
    }, document, chunks, () => {});
    assert.equal(maximum, expected);
    assert.equal(starts, 10);
    assert.deepEqual(result.map((item) => item.id), document.cues.map((cue) => cue.id));
  });
}
