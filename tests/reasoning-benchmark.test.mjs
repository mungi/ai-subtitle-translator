import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import { benchmarkReasoningModes } from "../extension/shared/reasoning-benchmark.js";
import { buildProviderRequest } from "../extension/shared/provider-request.js";

const provider = { ...PROVIDERS.anthropic, model: "claude-haiku-5-5", apiKey: "test" };
const reply = (input) => ({ content: [{ type: "text", text: JSON.stringify({ translations: input.cues.map(({ id }) => ({ id, text: "번역" })) }) }], usage: { input_tokens: 100, output_tokens: 50, output_tokens_details: { thinking_tokens: 0 } } });

test("explicit experimental no-thinking mode disables thinking at low effort", () => {
  const body = JSON.parse(buildProviderRequest(provider, { systemPrompt: "test", input: "test", reasoningMode: "none" }).init.body);
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.deepEqual(body.output_config, { effort: "low" });
  const untested = JSON.parse(buildProviderRequest({ ...provider, model: "always-thinking-model" }, { systemPrompt: "test", input: "test" }).init.body);
  assert.equal(untested.thinking, undefined);
});

test("the benchmark selects the fastest valid translation and records actual usage", async (t) => {
  const ticks = [0, 1, 1, 20];
  t.mock.method(performance, "now", () => ticks.shift());
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const input = JSON.parse(JSON.parse(init.body).messages[0].content);
    return new Response(JSON.stringify(reply(input)));
  });
  const result = await benchmarkReasoningModes(provider, "ko");
  assert.equal(result.reasoningProfile.mode, "low");
  assert.deepEqual(result.reasoningProfile.measurements.map((item) => item.elapsedMs), [1, 19]);
  assert.equal(result.reasoningProfile.measurements[0].thinkingTokens, 0);
});

test("unsupported effort mode falls back without treating it as an API failure", async (t) => {
  const ticks = [0, 1, 1, 2];
  t.mock.method(performance, "now", () => ticks.shift());
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const request = JSON.parse(init.body);
    return request.output_config
      ? new Response(JSON.stringify({ error: { message: "output_config effort is not supported" } }), { status: 400 })
      : new Response(JSON.stringify(reply(JSON.parse(request.messages[0].content))));
  });
  const result = await benchmarkReasoningModes(provider, "ko");
  assert.equal(result.reasoningProfile.mode, "omit");
  assert.equal(result.reasoningProfile.measurements[0].unsupported, true);
});

test("a fast but incomplete subtitle response cannot win the benchmark", async (t) => {
  const ticks = [0, 1, 1, 3];
  t.mock.method(performance, "now", () => ticks.shift());
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const request = JSON.parse(init.body);
    const result = reply(JSON.parse(request.messages[0].content));
    if (request.output_config) result.content[0].text = JSON.stringify({ translations: [] });
    return new Response(JSON.stringify(result));
  });
  const result = await benchmarkReasoningModes(provider, "ko");
  assert.equal(result.reasoningProfile.mode, "omit");
  assert.equal(result.reasoningProfile.measurements[0].valid, false);
});

test("authentication errors stop the benchmark without probing more modes", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => { requests += 1; return new Response(JSON.stringify({ error: { message: "Authentication failed" } }), { status: 401 }); });
  await assert.rejects(benchmarkReasoningModes(provider, "ko"), /Authentication failed/);
  assert.equal(requests, 1);
});
