import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import { buildProviderRequest, extractText } from "../extension/shared/provider-request.js";

test("NVIDIA NIM uses the OpenAI-compatible chat completions endpoint", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.nvidiaNim,
    apiKey: "nvapi-test-key"
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  assert.equal(request.url, "https://integrate.api.nvidia.com/v1/chat/completions");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer nvapi-test-key");
  assert.equal(request.init.headers["Content-Type"], "application/json");

  const body = JSON.parse(request.init.body);
  assert.equal(body.model, "openai/gpt-oss-120b");
  assert.deepEqual(body.messages, [
    { role: "system", content: "Translate naturally." },
    { role: "user", content: "Hello" }
  ]);
  assert.equal(body.response_format, undefined);
  assert.equal(body.reasoning, undefined);
  assert.equal(body.reasoning_effort, "low");
});

test("NVIDIA NIM extracts text from OpenAI-compatible chat completions response", () => {
  assert.equal(
    extractText(PROVIDERS.nvidiaNim, {
      choices: [{ message: { content: "안녕하세요" } }]
    }),
    "안녕하세요"
  );
});

test("OpenRouter requests strict JSON translations with reasoning disabled by default", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.openrouter,
    apiKey: "or-test-key",
    model: "test/model",
    nitro: false
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(request.init.headers.Authorization, "Bearer or-test-key");

  const body = JSON.parse(request.init.body);
  assert.equal(body.model, "test/model");
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.response_format.json_schema.schema.required.includes("translations"), true);
  assert.equal(body.reasoning.effort, "none");
  assert.equal(body.reasoning_effort, undefined);
  assert.equal(body.include_reasoning, undefined);
  assert.equal(body.verbosity, undefined);
});

test("OpenRouter connection tests can skip translation JSON schema", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.openrouter,
    apiKey: "or-test-key",
    model: "test/model",
    nitro: false
  }, {
    systemPrompt: "Reply OK.",
    input: "OK?",
    structuredOutput: false,
    maxTokens: 32
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.max_tokens, 32);
  assert.equal(body.response_format, undefined);
  assert.equal(body.reasoning.effort, "none");
  assert.equal(body.reasoning_effort, undefined);
});

test("OpenRouter can omit the reasoning option for incompatible models", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.openrouter,
    apiKey: "or-test-key",
    model: "test/model",
    nitro: false,
    disableReasoning: false
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.reasoning, undefined);
  assert.equal(body.response_format.type, "json_schema");
});

test("OpenRouter Nitro follows the provider setting", () => {
  const nitroRequest = buildProviderRequest({
    ...PROVIDERS.openrouter,
    apiKey: "or-test-key",
    model: "deepseek/deepseek-v4-flash",
    nitro: true
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });
  const standardRequest = buildProviderRequest({
    ...PROVIDERS.openrouter,
    apiKey: "or-test-key",
    model: "deepseek/deepseek-v4-flash:nitro",
    nitro: false
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  assert.equal(JSON.parse(nitroRequest.init.body).model, "deepseek/deepseek-v4-flash:nitro");
  assert.equal(JSON.parse(standardRequest.init.body).model, "deepseek/deepseek-v4-flash");
});

test("OpenAI-compatible chat text extraction supports content arrays", () => {
  assert.equal(
    extractText(PROVIDERS.openrouter, {
      choices: [
        {
          message: {
            content: [
              { type: "text", text: "{\"translations\":[" },
              { type: "text", text: "]}" }
            ]
          }
        }
      ]
    }),
    "{\"translations\":[]}"
  );
});

test("OpenAI Responses requests disable reasoning and use low verbosity by default", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.openai,
    apiKey: "openai-test-key",
    model: "gpt-5.5"
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  assert.equal(request.url, "https://api.openai.com/v1/responses");
  const body = JSON.parse(request.init.body);
  assert.equal(body.reasoning.effort, "none");
  assert.equal(body.text.verbosity, "low");
});

test("Anthropic requests use low output effort and omit deprecated temperature", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.anthropic,
    apiKey: "anthropic-test-key",
    model: "claude-sonnet-5"
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.init.headers["anthropic-dangerous-direct-browser-access"], "true");
  const body = JSON.parse(request.init.body);
  assert.equal(body.output_config.effort, "low");
  assert.equal(body.temperature, undefined);
  assert.equal(body.thinking, undefined);
});

test("Anthropic Haiku requests omit unsupported effort options", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.anthropic,
    apiKey: "anthropic-test-key",
    model: "claude-haiku-4.5"
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.output_config, undefined);
  assert.equal(body.temperature, undefined);
  assert.equal(body.thinking, undefined);
});

test("Gemini 3 requests use low thinking level by default", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.google,
    apiKey: "google-test-key",
    model: "gemini-3.1-pro-preview"
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "low");
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, undefined);
});

test("Gemini 3.1 Flash Lite uses the minimum thinking level", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.google,
    apiKey: "google-test-key",
    model: "gemini-3.1-flash-lite"
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "minimal");
});

test("Gemini 2.5 Flash requests disable thinking budget by default", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.google,
    apiKey: "google-test-key",
    model: "gemini-2.5-flash"
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, undefined);
});

test("Gemini 2.5 Pro requests the minimum supported thinking budget by default", () => {
  const request = buildProviderRequest({
    ...PROVIDERS.google,
    apiKey: "google-test-key",
    model: "gemini-2.5-pro"
  }, {
    systemPrompt: "Translate naturally.",
    input: "Hello"
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 128);
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, undefined);
});
