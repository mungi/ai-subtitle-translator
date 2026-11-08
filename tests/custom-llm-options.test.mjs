import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomHeaders, isUsableHeaderName, normalizeCustomHeaders } from "../extension/shared/custom-llm-options.js";
import { buildProviderRequest, getReasoningProbeModes } from "../extension/shared/provider-request.js";
import { normalizeSettings } from "../extension/shared/storage.js";

const local = {
  id: "local",
  label: "Custom LLM",
  apiStyle: "openai-chat",
  baseUrl: "http://localhost:1234/v1",
  model: "qwen3-8b",
  maxTokens: 4096
};
const send = (provider, options = {}) => {
  const request = buildProviderRequest(provider, { systemPrompt: "s", input: "i", ...options });
  return { headers: request.init.headers, body: JSON.parse(request.init.body) };
};

test("Custom LLM settings default to auto reasoning, JSON mode off and no extra headers", () => {
  const { local: provider } = normalizeSettings({}).providers;
  assert.equal(provider.reasoningEffort, "auto");
  assert.equal(provider.jsonMode, "off");
  assert.deepEqual(provider.customHeaders, []);
  const fixed = normalizeSettings({ providers: { local: { reasoningEffort: "extreme", jsonMode: "yaml", customHeaders: [1, 2, 3, 4] } } }).providers.local;
  assert.equal(fixed.reasoningEffort, "auto");
  assert.equal(fixed.jsonMode, "off");
  assert.equal(fixed.customHeaders.length, 3);
});

test("a chosen reasoning value is sent and is the only one the connection test tries", () => {
  assert.deepEqual(getReasoningProbeModes(local), ["low", "minimal", "none", "omit"]);
  for (const effort of ["none", "minimal", "low", "medium", "high"]) {
    const provider = { ...local, reasoningEffort: effort };
    assert.deepEqual(getReasoningProbeModes(provider), [effort]);
    assert.equal(send(provider).body.reasoning_effort, effort);
  }
  const omitted = { ...local, reasoningEffort: "omit" };
  assert.deepEqual(getReasoningProbeModes(omitted), ["omit"]);
  assert.equal(Object.hasOwn(send(omitted).body, "reasoning_effort"), false);
  // A choice wins over the value an earlier auto test saved.
  const chosen = { ...local, reasoningEffort: "high", reasoningProfile: { model: "qwen3-8b", apiStyle: "openai-chat", baseUrl: local.baseUrl, mode: "none" } };
  assert.equal(send(chosen).body.reasoning_effort, "high");
  // Other providers keep their own reasoning handling.
  assert.deepEqual(getReasoningProbeModes({ ...local, id: "openai", reasoningEffort: "high" }), ["low", "minimal", "none", "omit"]);
});

test("JSON mode adds response_format to translation requests only", () => {
  assert.equal(Object.hasOwn(send(local).body, "response_format"), false);
  assert.deepEqual(send({ ...local, jsonMode: "json_object" }).body.response_format, { type: "json_object" });
  assert.equal(send({ ...local, jsonMode: "json_schema" }).body.response_format.type, "json_schema");
  assert.equal(send({ ...local, jsonMode: "json_schema" }).body.response_format.json_schema.name, "subtitle_translations");
  // Summaries and plain requests ask for text.
  assert.equal(Object.hasOwn(send({ ...local, jsonMode: "json_schema" }, { structuredOutput: false }).body, "response_format"), false);
});

test("extra headers are added to Custom LLM requests, skipping empty and unusable ones", () => {
  const provider = {
    ...local,
    apiKey: "key",
    customHeaders: [
      { name: "X-Proxy-Token", value: "abc\r\ndef" },
      { name: "Host", value: "evil" },
      { name: "Bad Name", value: "x" }
    ]
  };
  assert.deepEqual(send(provider).headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer key",
    "X-Proxy-Token": "abc def"
  });
  assert.deepEqual(buildCustomHeaders({ ...provider, id: "openai" }), {});
  assert.equal(isUsableHeaderName("Content-Type"), false);
  assert.equal(isUsableHeaderName("Sec-Fetch-Mode"), false);
  assert.equal(isUsableHeaderName("Authorization"), true);
  assert.deepEqual(normalizeCustomHeaders([{ name: " A ", value: " b " }]), [{ name: "A", value: "b" }]);
});
