import assert from "node:assert/strict";
import test from "node:test";

test("provider connection tests reserve output tokens for Gemini thinking models", async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    },
    storage: {
      local: {
        setAccessLevel: async () => {}
      }
    }
  };

  const { PROVIDER_CONNECTION_TEST_MAX_TOKENS } = await import("../extension/background/service-worker.js");
  assert.equal(PROVIDER_CONNECTION_TEST_MAX_TOKENS, 128);
});

test("YouTube transcript errors include page retry metadata when available", async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    }
  };

  const { buildYoutubeTranscriptErrorResponse } = await import("../extension/background/service-worker.js");
  const error = new Error("Transcript response is empty.; transcript panel fallback failed: HTTP 403:");
  error.retryOnPage = {
    type: "youtubeTranscriptPanel",
    videoId: "C_GG5g38vLU",
    languageCode: "en",
    params: "panel%3D%3D",
    innertubeApiKey: "test-key",
    innertubeContext: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20260706.00.00"
      }
    }
  };

  assert.deepEqual(buildYoutubeTranscriptErrorResponse(error), {
    ok: false,
    error: "Transcript response is empty.; transcript panel fallback failed: HTTP 403:",
    retryOnPage: error.retryOnPage
  });
});

test("NVIDIA NIM model listing uses the OpenAI-compatible models endpoint", async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    }
  };

  const { listProviderModels } = await import("../extension/background/service-worker.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://integrate.api.nvidia.com/v1/models");
    assert.equal(init.headers.Authorization, "Bearer nvapi-test-key");
    return new Response(JSON.stringify({
      data: [
        { id: "openai/gpt-oss-120b" },
        { id: "meta/llama-3.3-70b-instruct", displayName: "Llama 3.3 70B" }
      ]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    assert.deepEqual(await listProviderModels({
      id: "nvidiaNim",
      label: "NVIDIA NIM",
      baseUrl: "https://integrate.api.nvidia.com/v1",
      apiKey: "nvapi-test-key"
    }), [
      {
        id: "meta/llama-3.3-70b-instruct",
        label: "Llama 3.3 70B"
      },
      {
        id: "openai/gpt-oss-120b",
        label: "openai/gpt-oss-120b"
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Local LLM model listing uses its OpenAI-compatible models endpoint without requiring an API key", async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    }
  };

  const { listProviderModels } = await import("../extension/background/service-worker.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "http://localhost:1234/v1/models");
    assert.equal(init.headers.Authorization, undefined);
    return new Response(JSON.stringify({
      data: [{ id: "qwen/qwen3-8b" }]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    assert.deepEqual(await listProviderModels({
      id: "local",
      label: "Local LLM",
      baseUrl: "http://localhost:1234/v1",
      apiKey: ""
    }), [{ id: "qwen/qwen3-8b", label: "qwen/qwen3-8b" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenRouter free model labels are prefixed and sorted first", async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    }
  };

  const { listProviderModels } = await import("../extension/background/service-worker.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://openrouter.ai/api/v1/models");
    assert.equal(init.headers.Authorization, "Bearer sk-or-test-key");
    return new Response(JSON.stringify({
      data: [
        { id: "zeta/paid", name: "Zeta Paid" },
        { id: "beta/free", name: "Beta Model (free)" },
        { id: "alpha/paid", name: "Alpha Paid" },
        { id: "alpha/free", name: "Alpha Model (free)" }
      ]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    assert.deepEqual(await listProviderModels({
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-or-test-key"
    }), [
      {
        id: "alpha/free",
        label: "(free) Alpha Model"
      },
      {
        id: "beta/free",
        label: "(free) Beta Model"
      },
      {
        id: "alpha/paid",
        label: "Alpha Paid"
      },
      {
        id: "zeta/paid",
        label: "Zeta Paid"
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Anthropic model listing sets the direct browser access header", async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    }
  };

  const { listProviderModels } = await import("../extension/background/service-worker.js");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.anthropic.com/v1/models");
    assert.equal(init.headers["x-api-key"], "anthropic-test-key");
    assert.equal(init.headers["anthropic-version"], "2023-06-01");
    assert.equal(init.headers["anthropic-dangerous-direct-browser-access"], "true");
    return new Response(JSON.stringify({
      data: [
        { id: "claude-sonnet-5", displayName: "Claude Sonnet 5" }
      ]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    assert.deepEqual(await listProviderModels({
      id: "anthropic",
      label: "Anthropic",
      baseUrl: "https://api.anthropic.com",
      apiKey: "anthropic-test-key",
      anthropicVersion: "2023-06-01"
    }), [
      {
        id: "claude-sonnet-5",
        label: "Claude Sonnet 5"
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider HTTP errors include the status reason phrase", async () => {
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    }
  };

  const { formatHttpErrorMessage, listProviderModels } = await import("../extension/background/service-worker.js");
  assert.equal(
    formatHttpErrorMessage(429, "Provider returned error"),
    "HTTP 429 Too Many Requests - Provider returned error"
  );
  assert.equal(
    formatHttpErrorMessage(401, "Invalid API key"),
    "HTTP 401 Unauthorized - Invalid API key"
  );
  assert.equal(
    formatHttpErrorMessage(599, "Network connect timeout"),
    "HTTP 599 - Network connect timeout"
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: "Provider returned error" }
  }), {
    status: 429,
    headers: { "Content-Type": "application/json" }
  });

  try {
    await assert.rejects(
      () => listProviderModels({
        id: "openrouter",
        label: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "sk-or-test-key"
      }),
      /HTTP 429 Too Many Requests - Provider returned error/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
