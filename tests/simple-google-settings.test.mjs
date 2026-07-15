import assert from "node:assert/strict";
import test from "node:test";
import { maskSecretValue } from "../extension/shared/secret-fields.js";
import {
  SIMPLE_GOOGLE_GUIDE_LINKS,
  SIMPLE_GOOGLE_MODEL,
  applySimpleGoogleTestResult,
  stageSimpleGoogleApiKey
} from "../extension/shared/simple-google-settings.js";

function createSettings() {
  return {
    activeProvider: "openai",
    providers: {
      google: { apiKey: "stored-google-key", model: "older-model" },
      openai: { apiKey: "stored-openai-key" }
    },
    providerTestStatus: { google: "success", openai: "success" }
  };
}

test("staging a Google key preserves an untouched masked key and enforces Flash Lite", () => {
  const next = stageSimpleGoogleApiKey(createSettings(), maskSecretValue("stored-google-key"));

  assert.equal(next.providers.google.apiKey, "stored-google-key");
  assert.equal(next.providers.google.model, "gemini-3.1-flash-lite");
  assert.equal(next.providerTestStatus.google, undefined);
  assert.equal(next.providerTestStatus.openai, "success");
});

test("a successful simple Google test activates Google", () => {
  const next = applySimpleGoogleTestResult(
    stageSimpleGoogleApiKey(createSettings(), "new-google-key"),
    true
  );

  assert.equal(next.providers.google.apiKey, "new-google-key");
  assert.equal(next.activeProvider, "google");
  assert.equal(next.providerTestStatus.google, "success");
});

test("a failed simple Google test preserves the active provider", () => {
  const next = applySimpleGoogleTestResult(
    stageSimpleGoogleApiKey(createSettings(), "new-google-key"),
    false
  );

  assert.equal(next.activeProvider, "openai");
  assert.equal(next.providerTestStatus.google, undefined);
});

test("simple settings expose only the required API key and dummy YouTube links", () => {
  assert.deepEqual(SIMPLE_GOOGLE_GUIDE_LINKS, [
    { label: "Get API Key", url: "https://aistudio.google.com/api-keys" },
    { label: "YouTube 설정 가이드", url: "https://www.youtube.com/watch?v=PLACEHOLDER" }
  ]);
  assert.equal(SIMPLE_GOOGLE_MODEL, "gemini-3.1-flash-lite");
});
