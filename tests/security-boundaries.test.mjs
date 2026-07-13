import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import { buildProviderRequest } from "../extension/shared/provider-request.js";
import { restrictLocalStorageAccess } from "../extension/shared/storage.js";
import { translationInternals } from "../extension/shared/translation.js";
import * as messageContracts from "../extension/shared/message-contracts.js";

test("content scripts cannot access chrome.storage.local directly", async () => {
  const contentScript = await readFile(new URL("../extension/content/content-script.js", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../extension/background/service-worker.js", import.meta.url), "utf8");
  const storageModule = await readFile(new URL("../extension/shared/storage.js", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));

  assert.doesNotMatch(contentScript, /chrome\.storage\.(?:local|onChanged)/);
  assert.match(storageModule, /setAccessLevel\(\{\s*accessLevel:\s*"TRUSTED_CONTEXTS"\s*\}\)/);
  assert.equal(manifest.minimum_chrome_version, "102");
  assert.ok(manifest.host_permissions.includes("https://localhost/*"));
  assert.ok(manifest.host_permissions.includes("https://127.0.0.1/*"));
  assert.doesNotMatch(serviceWorker, /restrictLocalStorageAccess\(\)\.catch\(\(\) => \{\}\)/);
});

test("trusted storage access is applied through the Chrome StorageArea API", async () => {
  const calls = [];
  await restrictLocalStorageAccess({
    async setAccessLevel(options) {
      calls.push(options);
    }
  });

  assert.deepEqual(calls, [{ accessLevel: "TRUSTED_CONTEXTS" }]);
});

test("background messages fail closed when trusted storage initialization fails", async () => {
  const previousChrome = globalThis.chrome;
  const previousConsoleError = console.error;
  let messageListener;
  const loggedErrors = [];
  globalThis.chrome = {
    runtime: {
      id: "extension-id",
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        }
      },
      openOptionsPage() {}
    },
    storage: {
      local: {
        async setAccessLevel() {
          throw new Error("access level unavailable");
        }
      },
      onChanged: { addListener() {} }
    },
    tabs: {}
  };
  console.error = (...args) => loggedErrors.push(args);

  try {
    await import(`../extension/background/service-worker.js?storage-failure=${Date.now()}`);
    const response = await new Promise((resolve) => {
      const keepChannelOpen = messageListener({ type: "settings.getPublic" }, {
        id: "extension-id",
        url: "https://www.youtube.com/watch?v=test",
        tab: { id: 1, url: "https://www.youtube.com/watch?v=test" }
      }, resolve);
      assert.equal(keepChannelOpen, true);
    });

    assert.deepEqual(response, {
      ok: false,
      error: "Secure storage initialization failed: access level unavailable"
    });
    assert.equal(loggedErrors.length, 1);
  } finally {
    globalThis.chrome = previousChrome;
    console.error = previousConsoleError;
  }
});

test("background message sender validation separates extension pages and content scripts", () => {
  assert.equal(typeof messageContracts.validateMessageSender, "function");

  const extensionSender = {
    id: "extension-id",
    url: "chrome-extension://extension-id/options/options.html"
  };
  const youtubeSender = {
    id: "extension-id",
    url: "https://www.youtube.com/watch?v=test",
    tab: { id: 1, url: "https://www.youtube.com/watch?v=test" }
  };

  assert.deepEqual(messageContracts.validateMessageSender(
    { type: "llm.listModels" }, extensionSender, "extension-id"
  ), { ok: true });
  assert.deepEqual(messageContracts.validateMessageSender(
    { type: "llm.listModels" }, youtubeSender, "extension-id"
  ), { ok: false, error: "Message is restricted to extension pages." });
  assert.deepEqual(messageContracts.validateMessageSender(
    { type: "translation.translateDocument" }, youtubeSender, "extension-id"
  ), { ok: true });
  assert.deepEqual(messageContracts.validateMessageSender(
    { type: "translation.translateDocument" }, {
      ...youtubeSender,
      tab: { ...youtubeSender.tab, id: 0 }
    }, "extension-id"
  ), { ok: true });
  assert.deepEqual(messageContracts.validateMessageSender(
    { type: "translation.translateDocument" }, extensionSender, "extension-id"
  ), { ok: false, error: "Message is restricted to supported content scripts." });
});

test("hosted provider requests reject non-provider origins", () => {
  assert.throws(() => buildProviderRequest({
    id: "openai",
    apiStyle: "openai-responses",
    baseUrl: "https://www.youtube.com/api/v1",
    apiKey: "sk-test-key",
    model: "gpt-test"
  }, {
    systemPrompt: "Translate",
    input: "Hello"
  }), /OpenAI Base URL must use https:\/\/api\.openai\.com/);
});

test("LLM provider requests reject cross-origin redirects", () => {
  for (const providerId of ["openai", "anthropic", "google", "openrouter", "nvidiaNim", "local"]) {
    const request = buildProviderRequest({
      ...PROVIDERS[providerId],
      apiKey: providerId === "local" ? "" : "fake-test-key"
    }, {
      systemPrompt: "Translate",
      input: "Hello"
    });
    assert.equal(request.init.redirect, "error", providerId);
  }
});

test("Local LLM requests allow loopback origins and reject remote origins", () => {
  assert.doesNotThrow(() => buildProviderRequest({
    id: "local",
    apiStyle: "openai-chat",
    baseUrl: "http://127.0.0.1:1234/v1",
    apiKey: "",
    model: "local-model"
  }, {
    systemPrompt: "Translate",
    input: "Hello"
  }));

  assert.throws(() => buildProviderRequest({
    id: "local",
    apiStyle: "openai-chat",
    baseUrl: "https://example.com/v1",
    apiKey: "",
    model: "local-model"
  }, {
    systemPrompt: "Translate",
    input: "Hello"
  }), /Local LLM Base URL must use localhost or 127\.0\.0\.1/);
});

test("machine translation requests reject cross-origin redirects", async () => {
  const previousFetch = globalThis.fetch;
  const redirects = [];
  globalThis.fetch = async (url, init = {}) => {
    redirects.push(init.redirect);
    if (String(url).includes("deepl.com")) {
      return new Response(JSON.stringify({ translations: [{ text: "안녕하세요" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify([[['안녕하세요']]]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  const document = {
    platform: "test",
    videoId: "security-test",
    sourceLanguage: "en",
    cues: [{ id: "cue-0", start: 0, end: 1, text: "Hello" }]
  };
  const settings = { sourceLanguage: "en", targetLanguage: "ko" };

  try {
    await translationInternals.translateCuesWithGoogle(document, settings, PROVIDERS.googleTranslate);
    await translationInternals.translateCuesWithDeepL(document, settings, {
      ...PROVIDERS.deepl,
      apiKey: "fake-test-key"
    });
    assert.deepEqual(redirects, ["error", "error"]);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("model discovery rejects non-provider origins before fetch", async () => {
  const previousChrome = globalThis.chrome;
  const previousFetch = globalThis.fetch;
  const accessLevelCalls = [];
  const fetchCalls = [];
  globalThis.chrome = {
    runtime: {
      id: "extension-id",
      onMessage: { addListener() {} },
      openOptionsPage() {}
    },
    storage: {
      local: {
        async setAccessLevel(options) {
          accessLevelCalls.push(options);
        }
      },
      onChanged: { addListener() {} }
    },
    tabs: {}
  };
  globalThis.fetch = async (url, init = {}) => {
    fetchCalls.push({ url: String(url), init });
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    const serviceWorker = await import(`../extension/background/service-worker.js?security=${Date.now()}`);
    await assert.rejects(() => serviceWorker.listProviderModels({
      id: "openai",
      baseUrl: "https://example.com/v1",
      apiKey: "fake-test-key"
    }), /OpenAI Base URL must use https:\/\/api\.openai\.com/);
    assert.equal(fetchCalls.length, 0);
    await serviceWorker.listProviderModels({
      id: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "fake-test-key"
    });
    assert.equal(fetchCalls[0].init.redirect, "error");
    assert.deepEqual(accessLevelCalls, [{ accessLevel: "TRUSTED_CONTEXTS" }]);
  } finally {
    globalThis.chrome = previousChrome;
    globalThis.fetch = previousFetch;
  }
});

test("privacy policies exist in Korean, English, and Japanese and are linked", async () => {
  const files = ["PRIVACY.md", "PRIVACY_en.md", "PRIVACY_ja.md"];
  for (const file of files) {
    const policy = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(policy, /Google|Google API/);
    assert.match(policy, /OpenAI/);
    assert.match(policy, /API key/i);
  }

  for (const file of ["README.md", "README_en.md", "README_ja.md"]) {
    const readme = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(readme, /PRIVACY\.md/);
    assert.match(readme, /PRIVACY_en\.md/);
    assert.match(readme, /PRIVACY_ja\.md/);
  }
});
