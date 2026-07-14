import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfiguredKeyProviders,
  validateConfiguredProviderKeys
} from "../extension/shared/provider-key-validation.js";

const settings = {
  providers: {
    googleTranslate: { id: "googleTranslate", label: "Google Translate", apiKey: "" },
    openai: { id: "openai", label: "OpenAI", apiKey: "openai-key" },
    anthropic: { id: "anthropic", label: "Anthropic", apiKey: "anthropic-key" },
    google: { id: "google", label: "Google AI", apiKey: "google-key" },
    local: { id: "local", label: "Custom LLM", apiKey: "" }
  },
  providerTestStatus: {
    googleTranslate: "success",
    openai: "success",
    anthropic: "success",
    google: "success"
  }
};

test("restored key validation selects only providers with configured API keys", () => {
  assert.deepEqual(
    getConfiguredKeyProviders(settings).map((provider) => provider.id),
    ["google", "openai", "anthropic"]
  );
});

test("restored key validation keeps only successful configured providers updated", async () => {
  const progress = [];
  const result = await validateConfiguredProviderKeys(settings, {
    testProvider: async (providerId) => {
      if (providerId === "openai") return { ok: true };
      if (providerId === "anthropic") return { ok: false, error: "invalid key" };
      throw new Error("network failure for google-key");
    },
    onProgress: ({ provider, current, total }) => progress.push([provider.id, current, total])
  });

  assert.deepEqual(progress, [
    ["google", 1, 3],
    ["openai", 2, 3],
    ["anthropic", 3, 3]
  ]);
  assert.deepEqual(result.providerTestStatus, {
    googleTranslate: "success",
    openai: "success"
  });
  assert.equal(result.successCount, 1);
  assert.equal(result.failedCount, 2);
  assert.equal(result.total, 3);
  assert.deepEqual(result.results, [
    {
      providerId: "google",
      providerLabel: "Google AI",
      ok: false,
      error: "network failure for [redacted]"
    },
    {
      providerId: "openai",
      providerLabel: "OpenAI",
      ok: true
    },
    {
      providerId: "anthropic",
      providerLabel: "Anthropic",
      ok: false,
      error: "invalid key"
    }
  ]);
});
