import assert from "node:assert/strict";
import test from "node:test";
import {
  fitMaxTokensToContext,
  fitSummaryPartChars,
  getContextLength,
  getServerRootUrl,
  parseLmStudioModelsContext,
  parseOllamaShowContext,
  parseOpenAiModelsContext
} from "../extension/shared/provider-context.js";
import { buildProviderRequest } from "../extension/shared/provider-request.js";

const local = {
  id: "local",
  label: "Custom LLM",
  apiStyle: "openai-chat",
  baseUrl: "http://localhost:1234/v1",
  model: "gemma",
  maxTokens: 16384
};
const withContext = (contextLength, overrides = {}) => ({
  ...local,
  contextProfile: { model: "gemma", baseUrl: "http://localhost:1234/v1", contextLength, source: "loaded" },
  ...overrides
});

test("server responses give the loaded context size or the model maximum", () => {
  assert.deepEqual(parseLmStudioModelsContext({
    models: [
      { key: "other", max_context_length: 4096 },
      { key: "gemma", max_context_length: 131072, loaded_instances: [{ config: { context_length: 8192 } }] }
    ]
  }, "gemma"), { loaded: 8192, max: 131072 });
  assert.deepEqual(parseLmStudioModelsContext({ data: [{ id: "gemma", max_context_length: 32768 }] }, "gemma"), { max: 32768 });
  assert.deepEqual(parseOllamaShowContext({ model_info: { "general.architecture": "llama", "llama.context_length": 8192 } }), { max: 8192 });
  assert.deepEqual(parseOpenAiModelsContext({ data: [{ id: "gemma", max_model_len: 16384 }] }, "gemma"), { loaded: 16384 });
  assert.deepEqual(parseOpenAiModelsContext({ data: [{ id: "gemma", meta: { n_ctx_train: 131072 } }] }, "gemma"), { max: 131072 });
  // A list without the model, or a server that says nothing, gives nothing.
  assert.deepEqual(parseOpenAiModelsContext({ data: [{ id: "a" }, { id: "b", max_model_len: 4096 }] }, "gemma"), {});
  assert.deepEqual(parseOpenAiModelsContext({ object: "list", data: [{ id: "gemma", object: "model" }] }, "gemma"), {});
  assert.deepEqual(parseOllamaShowContext(null), {});
});

test("server root drops the /v1 suffix of the Base URL", () => {
  assert.equal(getServerRootUrl("http://localhost:1234/v1"), "http://localhost:1234");
  assert.equal(getServerRootUrl("http://localhost:11434/v1/"), "http://localhost:11434");
  assert.equal(getServerRootUrl("https://llm.example.com/api"), "https://llm.example.com/api");
});

test("a detected context applies only to the model and server it was found for", () => {
  assert.equal(getContextLength(withContext(8192)), 8192);
  assert.equal(getContextLength(withContext(8192, { model: "other" })), null);
  assert.equal(getContextLength(withContext(8192, { baseUrl: "http://localhost:11434/v1" })), null);
  assert.equal(getContextLength({ ...withContext(8192), id: "openai" }), null);
  assert.equal(getContextLength(local), null);
});

test("requested output tokens shrink to fit a small context and stay as set otherwise", () => {
  const prompt = "x".repeat(3000);
  assert.equal(fitMaxTokensToContext(local, 16384, prompt), 16384);
  assert.equal(fitMaxTokensToContext(withContext(131072), 16384, prompt), 16384);
  assert.equal(fitMaxTokensToContext(withContext(4096), 16384, prompt), 4096 - 2000 - 128);
  // A prompt that nearly fills the context still asks for a small reply instead of none.
  assert.equal(fitMaxTokensToContext(withContext(2048), 16384, "x".repeat(6000)), 256);

  const body = JSON.parse(buildProviderRequest(withContext(4096), { systemPrompt: "s".repeat(600), input: "i".repeat(2400), structuredOutput: false }).init.body);
  assert.equal(body.max_tokens, 4096 - 2000 - 128);
});

test("summary parts shrink to about half of a small context", () => {
  assert.equal(fitSummaryPartChars(local, 20000), 20000);
  assert.equal(fitSummaryPartChars(withContext(131072), 20000), 20000);
  assert.equal(fitSummaryPartChars(withContext(8192), 20000), Math.floor(8192 * 0.45 * 1.5));
  assert.equal(fitSummaryPartChars(withContext(1024), 20000), 1000);
});
