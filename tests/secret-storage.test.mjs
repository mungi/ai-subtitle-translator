import assert from "node:assert/strict";
import test from "node:test";
import { getPublicSettings, getSettings, saveSettings } from "../extension/shared/storage.js";
import {
  readEncryptedProviderSecrets,
  secretStorageInternals,
  writeEncryptedProviderSecrets
} from "../extension/shared/secret-storage.js";

function createChromeStorage(initial = {}) {
  const data = structuredClone(initial);
  return {
    data,
    chrome: {
      runtime: { id: "secret-storage-test-extension" },
      i18n: { getUILanguage: () => "ko" },
      storage: {
        local: {
          async get(keys) {
            if (keys === undefined || keys === null) return structuredClone(data);
            const requested = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(requested
              .filter((key) => Object.hasOwn(data, key))
              .map((key) => [key, structuredClone(data[key])]));
          },
          async set(values) {
            Object.assign(data, structuredClone(values));
          },
          async remove(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
          }
        }
      }
    }
  };
}

test("provider API keys are stored as AES-GCM ciphertext with distributed key fragments", async () => {
  const previousChrome = globalThis.chrome;
  const harness = createChromeStorage();
  globalThis.chrome = harness.chrome;

  try {
    await writeEncryptedProviderSecrets({
      openai: "sk-openai-plain-secret",
      anthropic: "sk-ant-plain-secret"
    });

    const serialized = JSON.stringify(harness.data);
    assert.doesNotMatch(serialized, /sk-openai-plain-secret|sk-ant-plain-secret/);
    assert.equal(
      secretStorageInternals.KEY_FRAGMENT_STORAGE_KEYS.filter((key) => typeof harness.data[key] === "string").length,
      3
    );
    assert.deepEqual(await readEncryptedProviderSecrets(), {
      openai: "sk-openai-plain-secret",
      anthropic: "sk-ant-plain-secret"
    });
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("saveSettings removes plaintext API keys from llmSettings and restores them on read", async () => {
  const previousChrome = globalThis.chrome;
  const harness = createChromeStorage();
  globalThis.chrome = harness.chrome;

  try {
    await saveSettings({
      activeProvider: "openai",
      providers: {
        openai: { apiKey: "sk-saved-secret", model: "gpt-test" }
      }
    });

    assert.equal(harness.data.llmSettings.providers.openai.apiKey, undefined);
    assert.doesNotMatch(JSON.stringify(harness.data.llmSettings), /sk-saved-secret/);
    const restored = await getSettings();
    assert.equal(restored.providers.openai.apiKey, "sk-saved-secret");
    assert.equal(restored.providers.openai.model, "gpt-test");
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("getPublicSettings never exposes decrypted provider API keys", async () => {
  const previousChrome = globalThis.chrome;
  const harness = createChromeStorage();
  globalThis.chrome = harness.chrome;

  try {
    await saveSettings({
      providers: {
        openai: { apiKey: "sk-public-bridge-secret", model: "gpt-test" }
      }
    });

    const publicSettings = await getPublicSettings();
    assert.equal(publicSettings.providers.openai.apiKey, undefined);
    assert.doesNotMatch(JSON.stringify(publicSettings), /sk-public-bridge-secret/);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("getSettings automatically migrates existing plaintext provider API keys", async () => {
  const previousChrome = globalThis.chrome;
  const harness = createChromeStorage({
    llmSettings: {
      activeProvider: "openrouter",
      providers: {
        openrouter: { apiKey: "sk-or-legacy-secret", model: "legacy-model" }
      }
    }
  });
  globalThis.chrome = harness.chrome;

  try {
    const settings = await getSettings();

    assert.equal(settings.providers.openrouter.apiKey, "sk-or-legacy-secret");
    assert.equal(harness.data.llmSettings.providers.openrouter.apiKey, undefined);
    assert.doesNotMatch(JSON.stringify(harness.data), /sk-or-legacy-secret/);
    assert.equal((await readEncryptedProviderSecrets()).openrouter, "sk-or-legacy-secret");
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("obfuscated key shares round-trip without storing the original share encoding", () => {
  const share = Uint8Array.from({ length: 32 }, (_, index) => index);
  const plainEncoding = Buffer.from(share).toString("base64url");

  for (let index = 0; index < 3; index += 1) {
    const encoded = secretStorageInternals.encodeKeyShare(share, index);
    assert.notEqual(encoded, plainEncoding);
    assert.deepEqual(secretStorageInternals.decodeKeyShare(encoded, index), share);
  }
});

test("concurrent first writes keep the vault and distributed key fragments consistent", async () => {
  const previousChrome = globalThis.chrome;
  const harness = createChromeStorage();
  globalThis.chrome = harness.chrome;

  try {
    await Promise.all([
      writeEncryptedProviderSecrets({ openai: "first-secret" }),
      writeEncryptedProviderSecrets({ openai: "second-secret" })
    ]);

    assert.deepEqual(await readEncryptedProviderSecrets(), { openai: "second-secret" });
  } finally {
    globalThis.chrome = previousChrome;
  }
});
