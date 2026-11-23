import assert from "node:assert/strict";
import test from "node:test";

test("native YouTube capture is registered in MAIN at document_start only once", async () => {
  globalThis.chrome = {
    runtime: { onMessage: { addListener() {} } },
    storage: { local: { setAccessLevel: async () => {} } }
  };
  const { registerYoutubeCaptionCapture } = await import("../extension/background/service-worker.js");
  let registered = [];
  let writes = 0;
  const scripting = {
    getRegisteredContentScripts: async () => registered,
    registerContentScripts: async (scripts) => { registered = scripts; writes += 1; }
  };
  await registerYoutubeCaptionCapture(scripting);
  await registerYoutubeCaptionCapture(scripting);
  assert.equal(writes, 1);
  assert.deepEqual(registered[0].matches, ["https://www.youtube.com/*"]);
  assert.equal(registered[0].world, "MAIN");
  assert.equal(registered[0].runAt, "document_start");
});

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

test("connection test saves the lowest reasoning mode accepted by the selected model", async () => {
  const requestModes = [];
  const originalFetch = globalThis.fetch;
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: {
      local: {
        setAccessLevel: async () => {},
        set: async () => {},
        get: async () => ({
          llmSettings: {
            providers: {
              local: { model: "test-model", baseUrl: "http://localhost:1234/v1", apiKey: "" }
            }
          }
        })
      }
    }
  };
  globalThis.fetch = async (url, init) => {
    // Context size questions that follow the reply check; this server answers none of them.
    if (!String(url).endsWith("/chat/completions")) return { ok: false, status: 404, json: async () => ({}) };
    const mode = JSON.parse(init.body).reasoning_effort;
    requestModes.push(mode);
    return mode === "none"
      ? { ok: true, json: async () => ({ choices: [{ message: { content: "OK" } }] }) }
      : {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({ error: { message: `reasoning_effort ${mode} is not supported` } })
        };
  };

  try {
    const { testActiveProvider } = await import("../extension/background/service-worker.js");
    const result = await testActiveProvider("local");
    assert.deepEqual(requestModes, ["low", "minimal", "none"]);
    assert.equal(result.reasoningProfile.mode, "none");
    assert.equal(result.reasoningProfile.model, "test-model");
    assert.equal(result.text, "OK");
    assert.equal(result.contextProfile, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Custom LLM connection test reads the loaded context size and reports each step", async () => {
  const requests = [];
  const progress = [];
  const originalFetch = globalThis.fetch;
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: {
      local: {
        setAccessLevel: async () => {},
        set: async () => {},
        get: async () => ({
          llmSettings: { providers: { local: { model: "qwen3-8b", baseUrl: "http://localhost:1234/v1", apiKey: "" } } }
        })
      }
    }
  };
  globalThis.fetch = async (url, init = {}) => {
    requests.push(`${init.method || "GET"} ${url}`);
    if (String(url).endsWith("/chat/completions")) {
      return { ok: true, json: async () => ({ choices: [{ message: { content: "OK" } }] }) };
    }
    if (String(url).endsWith("/api/v1/models")) {
      return {
        ok: true,
        json: async () => ({
          models: [{ key: "qwen3-8b", max_context_length: 40960, loaded_instances: [{ config: { context_length: 8192 } }] }]
        })
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  try {
    const { testActiveProvider } = await import("../extension/background/service-worker.js");
    const result = await testActiveProvider("local", { onProgress: (value) => progress.push(value) });
    assert.deepEqual(result.contextProfile, {
      model: "qwen3-8b",
      baseUrl: "http://localhost:1234/v1",
      contextLength: 8192,
      source: "loaded"
    });
    // Reply check, OpenAI-style model list, then LM Studio, which answers; Ollama is not asked.
    assert.deepEqual(requests, [
      "POST http://localhost:1234/v1/chat/completions",
      "GET http://localhost:1234/v1/models",
      "GET http://localhost:1234/api/v1/models"
    ]);
    assert.deepEqual(progress.map(({ step, index, total }) => `${index}/${total} ${step}`), [
      "1/4 reply",
      "2/4 models",
      "3/4 lmStudio"
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AST menu visibility updates are relayed to every frame in the tab", async () => {
  const sentMessages = [];
  globalThis.chrome = {
    runtime: {
      onMessage: {
        addListener: () => {}
      }
    },
    tabs: {
      sendMessage: async (tabId, message) => {
        sentMessages.push({ tabId, message });
      }
    }
  };

  const { relayProviderMenuVisibility } = await import("../extension/background/service-worker.js");
  await relayProviderMenuVisibility(42, true);

  assert.deepEqual(sentMessages, [{
    tabId: 42,
    message: { type: "ast.providerMenu.setOpen", open: true }
  }]);
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

test("provider and translation-style mutations are serialized without losing either selection", async () => {
  let llmSettings = {
    activeProvider: "googleTranslate",
    translationStyle: "custom",
    providerTestStatus: { google: "success" }
  };
  globalThis.chrome = {
    runtime: {
      id: "test-extension",
      onMessage: { addListener: () => {} }
    },
    storage: {
      local: {
        get: async () => ({ llmSettings: structuredClone(llmSettings) }),
        set: async (patch) => {
          if (patch.llmSettings) llmSettings = structuredClone(patch.llmSettings);
        },
        remove: async () => {},
        setAccessLevel: async () => {}
      }
    }
  };

  const {
    setActiveProvider, setTranslationStyle, setTargetLanguage, setSubtitleDisplayMode, setPreferYoutubeProvidedTranslation,
    setWordProgressHighlight
  } = await import("../extension/background/service-worker.js");
  await Promise.all([
    setActiveProvider("google"),
    setTranslationStyle("technical"),
    setTargetLanguage("fa"),
    setSubtitleDisplayMode("dual"),
    setPreferYoutubeProvidedTranslation(false),
    setWordProgressHighlight(false)
  ]);

  assert.equal(llmSettings.activeProvider, "google");
  assert.equal(llmSettings.translationStyle, "technical");
  assert.equal(llmSettings.targetLanguage, "fa");
  await assert.rejects(setTargetLanguage("invalid"), /Unsupported target language/);
  assert.equal(llmSettings.subtitleDisplayMode, "dual");
  await assert.rejects(setSubtitleDisplayMode("invalid"), /Unsupported subtitle display mode/);
  assert.equal(llmSettings.preferYoutubeProvidedTranslation, false);
  await assert.rejects(setPreferYoutubeProvidedTranslation("no"), /enabled must be a boolean/);
  assert.equal(llmSettings.wordProgressHighlight, false);
  await assert.rejects(setWordProgressHighlight("no"), /enabled must be a boolean/);
});

test("a Vimeo player frame is a Vimeo player on any site, except a background embed", async () => {
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: { local: { get: async () => ({}), set: async () => {}, setAccessLevel: async () => {} } }
  };
  const { dispatchBackgroundMessage } = await import("../extension/background/service-worker.js");
  const context = (url, tabUrl) => {
    let response;
    dispatchBackgroundMessage({ type: "platform.vimeo.getContext" }, { url, tab: { id: 3, url: tabUrl } }, (value) => { response = value; });
    return response;
  };
  const conference = "https://sc26.conference-program.com/session/?sess=sess151";
  assert.deepEqual(context("https://player.vimeo.com/video/1145209543?h=abc", conference), { ok: true, platform: "vimeo", embedded: true });
  assert.deepEqual(context("https://vimeo.com/event/6300761/embed/interaction", "https://events.example.com/"), { ok: true, platform: "vimeo", embedded: true });
  // Decorative autoplaying loops are left alone.
  assert.deepEqual(context("https://player.vimeo.com/video/1145209543?background=1&autoplay=1", conference), { ok: true, platform: null });
  // On Vimeo itself and on NVIDIA Academy nothing changes.
  assert.deepEqual(context("https://player.vimeo.com/video/1", "https://vimeo.com/1"), { ok: true, platform: "vimeo", embedded: false });
  assert.deepEqual(context("https://player.vimeo.com/video/1", "https://www.nvidia.com/en-us/training/academy/course-player/"), { ok: true, platform: "nvidia", embedded: false });
  // A frame that is not Vimeo's player stays unsupported.
  assert.deepEqual(context("https://ads.example.com/frame", conference), { ok: true, platform: null });
  const { forgetVimeoEmbedTab } = await import("../extension/background/service-worker.js");
  await forgetVimeoEmbedTab(3);
});

test("a player embedded in a frame too small to be a real player is skipped, and started embeds are remembered per tab", async () => {
  const session = {};
  const sent = [];
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: {
      local: { get: async () => ({}), set: async () => {}, setAccessLevel: async () => {} },
      session: { get: async (key) => ({ [key]: session[key] }), set: async (patch) => Object.assign(session, patch) }
    },
    tabs: {
      query: async ({ url }) => {
        const all = [
          { id: 4, url: "https://sc26.conference-program.com/session/?sess=sess151" },
          { id: 5, url: "https://example.com/other" },
          { id: 6, url: "https://www.youtube.com/watch?v=abc123def45" }
        ];
        return url.some((pattern) => pattern.includes("youtube")) ? all.filter((tab) => tab.id === 6) : all;
      },
      sendMessage: async (tabId, message) => { sent.push([tabId, message.type]); },
      onRemoved: { addListener() {} }
    }
  };
  const { dispatchBackgroundMessage, getVimeoFrameContext, queryAstTabs } = await import("../extension/background/service-worker.js");
  const frame = { url: "https://player.vimeo.com/video/1145209543", tab: { id: 4, url: "https://sc26.conference-program.com/session/?sess=sess151" } };
  assert.deepEqual(getVimeoFrameContext(frame, { width: 200, height: 112 }), { platform: null });
  assert.deepEqual(getVimeoFrameContext(frame, { width: 960, height: 540 }), { platform: "vimeo", embedded: true });

  const ask = (message, sender = {}) => new Promise((resolve) => {
    const result = dispatchBackgroundMessage(message, sender, resolve);
    if (result !== true) return;
  });
  assert.deepEqual(await ask({ type: "popup.getTabContext", tabId: 4, tabUrl: frame.tab.url }), { ok: true, vimeoEmbed: false });
  await ask({ type: "platform.vimeo.getContext", width: 960, height: 540 }, frame);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(await ask({ type: "popup.getTabContext", tabId: 4, tabUrl: frame.tab.url }), { ok: true, vimeoEmbed: true });
  assert.equal(session.vimeoEmbedTabs?.[4], "sc26.conference-program.com", "kept for a restarted worker");
  // Another page later opened in the same tab is not an embed page.
  assert.deepEqual(await ask({ type: "popup.getTabContext", tabId: 4, tabUrl: "https://example.com/" }), { ok: true, vimeoEmbed: false });

  // Settings changes reach the embed page as well as supported sites.
  assert.deepEqual((await queryAstTabs()).map((tab) => tab.id).sort(), [4, 6]);
  const { forgetVimeoEmbedTab } = await import("../extension/background/service-worker.js");
  await forgetVimeoEmbedTab(4);
  assert.deepEqual((await queryAstTabs()).map((tab) => tab.id), [6]);
});

test("a summary uses the style picked in the player menu and remembers it", async () => {
  let llmSettings = {
    activeProvider: "local",
    providerTestStatus: { local: "success" },
    summarySystemPrompt: "My own summary prompt."
  };
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: {
      local: {
        get: async () => ({ llmSettings: structuredClone(llmSettings) }),
        set: async (patch) => {
          if (patch.llmSettings) llmSettings = structuredClone(patch.llmSettings);
        },
        remove: async () => {},
        setAccessLevel: async () => {}
      }
    }
  };
  const { generateSummary, setSummaryStyle } = await import("../extension/background/service-worker.js");
  const { BRIEF_SUMMARY_SYSTEM_PROMPT, DEFAULT_SUMMARY_SYSTEM_PROMPT } = await import("../extension/shared/defaults.js");
  const prompts = [];
  const summarize = async (input) => {
    prompts.push(input.systemPrompt);
    return "# Summary";
  };

  // An edited prompt saved before styles existed is kept as Custom.
  assert.equal(await generateSummary({ text: "Hello." }, {}, summarize), "# Summary");
  assert.equal(prompts.at(-1), "My own summary prompt.");

  await generateSummary({ text: "Hello.", style: "brief" }, {}, summarize);
  assert.equal(prompts.at(-1), BRIEF_SUMMARY_SYSTEM_PROMPT);
  assert.equal(llmSettings.summaryStyle, "brief");
  assert.equal(llmSettings.summarySystemPrompt, "My own summary prompt.", "picking a style keeps the Custom prompt");

  await generateSummary({ text: "Hello." }, {}, summarize);
  assert.equal(prompts.at(-1), BRIEF_SUMMARY_SYSTEM_PROMPT, "the remembered style is used");

  await generateSummary({ text: "Hello.", style: "detailed" }, {}, summarize);
  assert.equal(prompts.at(-1), DEFAULT_SUMMARY_SYSTEM_PROMPT);
  assert.equal(llmSettings.summaryStyle, "detailed");
  await assert.rejects(setSummaryStyle("long"), /Unsupported summary style/);
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

test("Custom LLM model listing uses its OpenAI-compatible models endpoint without requiring an API key", async () => {
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
      label: "Custom LLM",
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

test("provider model errors redact echoed authentication secrets", async () => {
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

  const { listProviderModels } = await import("../extension/background/service-worker.js");
  const apiKey = "sk-secret+/=";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      message: `Invalid key ${apiKey}; request=https://api.example.test/v1?key=${encodeURIComponent(apiKey)}`
    }
  }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });

  try {
    await assert.rejects(
      () => listProviderModels({
        id: "openrouter",
        label: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey
      }),
      (error) => {
        assert.match(error.message, /HTTP 401 Unauthorized - Invalid key \[redacted\]/);
        assert.match(error.message, /key=\[redacted\]/);
        assert.doesNotMatch(error.message, /sk-secret/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const offGateDocument = {
  platform: "youtube",
  videoId: "abc123def45",
  sourceLanguage: "en",
  cues: [{ id: "0", start: 0, end: 1, text: "Hello" }]
};

async function waitUntil(condition) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(condition(), "condition was not reached");
}

test("a translation cancelled while waiting for the OFF check never starts", async () => {
  let releaseGate;
  const settingsReads = [];
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: {
      local: {
        setAccessLevel: async () => {},
        set: async () => {},
        get: async (key) => {
          if (key === "subtitleEnabled") {
            await new Promise((resolve) => { releaseGate = resolve; });
            return { subtitleEnabled: true };
          }
          settingsReads.push(key);
          return {};
        }
      }
    }
  };
  const { dispatchBackgroundMessage } = await import("../extension/background/service-worker.js");
  const sender = { tab: { id: 7 }, frameId: 0 };
  const response = new Promise((resolve) => dispatchBackgroundMessage({
    type: "translation.translateDocument",
    requestId: "seek-1",
    mode: "temporary",
    document: offGateDocument
  }, sender, resolve));
  dispatchBackgroundMessage({ type: "translation.cancelRequest", requestId: "seek-1" }, sender, () => {});

  await waitUntil(() => releaseGate);
  releaseGate();
  const result = await response;
  assert.equal(result.ok, false);
  assert.deepEqual(settingsReads, []);
});

test("a stored OFF change aborts translations already running in the background", async () => {
  let releaseSettings;
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: {
      local: {
        setAccessLevel: async () => {},
        set: async () => {},
        get: async (key) => {
          if (key === "subtitleEnabled") return { subtitleEnabled: true };
          if (key === "llmSettings") await new Promise((resolve) => { releaseSettings = resolve; });
          return {};
        }
      }
    }
  };
  const { dispatchBackgroundMessage, abortTranslationsWhenDisabled } = await import("../extension/background/service-worker.js");
  const response = new Promise((resolve) => dispatchBackgroundMessage({
    type: "translation.translateDocument",
    requestId: "final-1",
    document: offGateDocument
  }, { tab: { id: 8 }, frameId: 0 }, resolve));

  await waitUntil(() => releaseSettings);
  abortTranslationsWhenDisabled({ subtitleEnabled: { oldValue: true, newValue: false } }, "local");
  releaseSettings();
  const result = await response;
  assert.equal(result.ok, false);
});

function createLifecyclePort(sender, name = "ast.translation.lifecycle") {
  const disconnectListeners = [];
  return {
    name,
    sender,
    disconnected: false,
    onDisconnect: { addListener: (listener) => disconnectListeners.push(listener) },
    disconnect() { this.disconnected = true; },
    fireDisconnect: () => disconnectListeners.forEach((listener) => listener())
  };
}

test("closing or reloading a page stops only that page's background translations", async () => {
  const settingsReleases = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError("stub network unavailable"); };
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: {
      local: {
        setAccessLevel: async () => {},
        set: async () => {},
        get: async (key) => {
          if (key === "subtitleEnabled") return { subtitleEnabled: true };
          if (key === "llmSettings") await new Promise((resolve) => settingsReleases.push(resolve));
          return {};
        }
      }
    }
  };
  try {
    const { dispatchBackgroundMessage, handleTranslationLifecyclePort } = await import("../extension/background/service-worker.js");
    const oldPage = { id: "test-extension", tab: { id: 9 }, frameId: 0, documentId: "old-document" };
    const newPage = { id: "test-extension", tab: { id: 9 }, frameId: 0, documentId: "new-document" };
    const oldPort = createLifecyclePort(oldPage);
    handleTranslationLifecyclePort(oldPort);
    handleTranslationLifecyclePort(createLifecyclePort(newPage));
    const translate = (sender, requestId) => new Promise((resolve) => dispatchBackgroundMessage({
      type: "translation.translateDocument",
      requestId,
      document: offGateDocument
    }, sender, resolve));
    const oldResponse = translate(oldPage, "final-1");
    const newResponse = translate(newPage, "final-1");

    await waitUntil(() => settingsReleases.length === 2);
    oldPort.fireDisconnect();
    settingsReleases.forEach((release) => release());
    const [oldResult, newResult] = await Promise.all([oldResponse, newResponse]);
    assert.equal(oldResult.ok, false);
    assert.match(oldResult.error, /abort/i);
    assert.doesNotMatch(String(newResult.error || ""), /abort/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("translation lifecycle ports from other names or senders are rejected", async () => {
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: { local: { setAccessLevel: async () => {} } }
  };
  const { handleTranslationLifecyclePort } = await import("../extension/background/service-worker.js");
  const wrongName = createLifecyclePort({ id: "test-extension", tab: { id: 1 }, frameId: 0 }, "other");
  const otherExtension = createLifecyclePort({ id: "other-extension", tab: { id: 1 }, frameId: 0 });
  const noTab = createLifecyclePort({ id: "test-extension", url: "chrome-extension://test-extension/popup/popup.html" });
  for (const port of [wrongName, otherExtension, noTab]) handleTranslationLifecyclePort(port);
  assert.deepEqual([wrongName, otherExtension, noTab].map((port) => port.disconnected), [true, true, true]);
});

test("the subtitle ON/OFF toggle is sent only to supported video site tabs", async () => {
  const queries = [];
  const delivered = [];
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: { local: { setAccessLevel: async () => {}, set: async () => {}, get: async () => ({}) } },
    tabs: {
      query: async (filter) => { queries.push(filter); return [{ id: 3 }]; },
      sendMessage: async (tabId, message) => { delivered.push({ tabId, message }); }
    }
  };
  const { dispatchBackgroundMessage } = await import("../extension/background/service-worker.js");
  const response = await new Promise((resolve) => dispatchBackgroundMessage(
    { type: "settings.setSubtitleEnabled", enabled: false },
    { id: "test-extension", url: "chrome-extension://test-extension/popup/popup.html" },
    resolve
  ));
  assert.equal(response.ok, true);
  assert.equal(queries.length, 1);
  assert.ok(queries[0].url.includes("https://www.youtube.com/*"));
  assert.ok(queries[0].url.includes("https://*.udemy.com/course/*/learn/*"));
  assert.deepEqual(delivered, [{ tabId: 3, message: { type: "subtitles.setEnabled", enabled: false } }]);
});

test("Custom LLM connection test sends only the chosen reasoning value, in JSON mode, with extra headers", async () => {
  const chatRequests = [];
  const originalFetch = globalThis.fetch;
  globalThis.chrome = {
    runtime: { id: "test-extension", onMessage: { addListener() {} } },
    storage: {
      local: {
        setAccessLevel: async () => {},
        set: async () => {},
        get: async () => ({
          llmSettings: {
            providers: {
              local: {
                model: "qwen3-8b",
                baseUrl: "http://localhost:1234/v1",
                reasoningEffort: "medium",
                jsonMode: "json_object",
                customHeaders: [{ name: "X-Team" }]
              }
            }
          }
        })
      }
    }
  };
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).endsWith("/chat/completions")) return { ok: false, status: 404, json: async () => ({}) };
    chatRequests.push({ headers: init.headers, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ choices: [{ message: { content: "{\"ok\":true}" } }] }) };
  };

  try {
    const { testActiveProvider } = await import("../extension/background/service-worker.js");
    const result = await testActiveProvider("local");
    assert.equal(chatRequests.length, 1);
    assert.equal(chatRequests[0].body.reasoning_effort, "medium");
    assert.deepEqual(chatRequests[0].body.response_format, { type: "json_object" });
    assert.equal(result.reasoningProfile.mode, "medium");
    // The header has a name but its value lives in the vault, which this test leaves empty, so it is not sent.
    assert.equal(Object.hasOwn(chatRequests[0].headers, "X-Team"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
