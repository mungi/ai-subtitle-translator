import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import {
  getOrderedProviderIds,
  getOrderedProviders,
  PROVIDER_DISPLAY_ORDER,
  PROVIDER_TAB_SEPARATOR_AFTER_ID
} from "../extension/shared/provider-order.js";

test("provider display order places default translators before AI providers", () => {
  assert.deepEqual(PROVIDER_DISPLAY_ORDER, [
    "googleTranslate",
    "deepl",
    "google",
    "openai",
    "anthropic",
    "openrouter",
    "nvidiaNim",
    "local"
  ]);
  assert.equal(PROVIDER_TAB_SEPARATOR_AFTER_ID, "deepl");
  assert.deepEqual(getOrderedProviderIds(PROVIDERS), PROVIDER_DISPLAY_ORDER);
  assert.deepEqual(
    getOrderedProviders(PROVIDERS).map((provider) => provider.label),
    [
      "Google Translate",
      "DeepL",
      "Google AI",
      "OpenAI",
      "Anthropic",
      "OpenRouter",
      "NVIDIA NIM",
      "Local LLM"
    ]
  );
});

test("provider display order appends unknown providers without dropping them", () => {
  const providers = {
    openai: PROVIDERS.openai,
    googleTranslate: PROVIDERS.googleTranslate,
    customProvider: {
      id: "customProvider",
      label: "Custom Provider"
    },
    deepl: PROVIDERS.deepl
  };

  assert.deepEqual(getOrderedProviderIds(providers), [
    "googleTranslate",
    "deepl",
    "openai",
    "customProvider"
  ]);
});
