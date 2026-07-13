import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getProviderGuide } from "../extension/shared/provider-guides.js";

const localeMessages = Object.fromEntries(["en", "ko", "ja"].map((locale) => [
  locale,
  JSON.parse(readFileSync(new URL(`../extension/_locales/${locale}/messages.json`, import.meta.url), "utf8"))
]));

function getGuide(providerId, languageCode) {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    i18n: {
      getMessage: (key) => localeMessages[languageCode]?.[key]?.message || ""
    }
  };
  try {
    return getProviderGuide(providerId);
  } finally {
    globalThis.chrome = originalChrome;
  }
}

function assertGuideLinks(providerId, languageCode, expectedUrls) {
  const guide = getGuide(providerId, languageCode);
  for (const url of expectedUrls) {
    assert.ok(
      guide.links.some((link) => link.url === url),
      `${providerId} guide should include ${url}`
    );
  }
  return guide;
}

function assertGetApiKeyLink(providerId, languageCode, url) {
  const guide = getGuide(providerId, languageCode);
  assert.ok(
    guide.links.some((link) => link.label === "Get API Key" && link.url === url),
    `${providerId} guide should include a Get API Key link to ${url}`
  );
  return guide;
}

test("OpenRouter guide mentions limited free API usage and exposes official links", () => {
  const guide = assertGetApiKeyLink("openrouter", "ko", "https://openrouter.ai/settings/keys");

  assert.match(guide.text, /무료/);
  assert.match(guide.text, /사용량 제한/);
  assert.ok(guide.links.some((link) => link.url === "https://openrouter.ai/pricing"));
  assert.ok(guide.links.some((link) => link.url === "https://openrouter.ai/docs/api/reference/limits"));
});

test("NVIDIA NIM guide mentions limited free API usage and exposes official links", () => {
  const guide = assertGetApiKeyLink("nvidiaNim", "en", "https://build.nvidia.com/settings/api-keys");

  assert.match(guide.text, /free/i);
  assert.match(guide.text, /limit/i);
  assert.ok(guide.links.some((link) => link.url === "https://build.nvidia.com/explore/discover"));
  assert.ok(guide.links.some((link) => link.url === "https://forums.developer.nvidia.com/t/nvidia-nim-faq/300317"));
});

test("NVIDIA NIM guide omits Base URL setup guidance", () => {
  for (const language of ["ko", "en"]) {
    const guide = getGuide("nvidiaNim", language);
    assert.doesNotMatch(guide.text, /Base URL/i);
    assert.doesNotMatch(guide.text, /\/chat\/completions/);
    assert.doesNotMatch(guide.text, /https:\/\/integrate\.api\.nvidia\.com\/v1/);
  }
});

test("DeepL guide exposes official docs, usage limits, and pricing links", () => {
  const guide = assertGuideLinks("deepl", "ko", [
    "https://www.deepl.com/your-account/keys",
    "https://developers.deepl.com/docs/getting-started/quickstart",
    "https://developers.deepl.com/docs/resources/usage-limits",
    "https://www.deepl.com/pro-api"
  ]);

  assert.ok(guide.links.some((link) => link.label === "Get API Key"));
  assert.match(guide.text, /Free\/Pro/);
  assert.match(guide.text, /사용량/);
});

test("OpenAI guide exposes official docs, rate limits, and pricing links", () => {
  const guide = assertGuideLinks("openai", "en", [
    "https://platform.openai.com/api-keys",
    "https://developers.openai.com/api/docs",
    "https://developers.openai.com/api/docs/guides/rate-limits",
    "https://developers.openai.com/api/docs/pricing"
  ]);

  assert.ok(guide.links.some((link) => link.label === "Get API Key"));
  assert.match(guide.text, /account/i);
  assert.match(guide.text, /limit/i);
});

test("Anthropic guide exposes official docs, rate limits, and pricing links", () => {
  const guide = assertGuideLinks("anthropic", "ko", [
    "https://platform.claude.com/settings/keys",
    "https://platform.claude.com/docs/en/get-started",
    "https://platform.claude.com/docs/en/api/rate-limits",
    "https://platform.claude.com/docs/en/about-claude/pricing"
  ]);

  assert.ok(guide.links.some((link) => link.label === "Get API Key"));
  assert.match(guide.text, /사용량/);
  assert.match(guide.text, /요금/);
});

test("Google AI guide exposes API key, official docs, rate limits, and pricing links", () => {
  const guide = assertGuideLinks("google", "en", [
    "https://aistudio.google.com/api-keys",
    "https://ai.google.dev/gemini-api/docs",
    "https://ai.google.dev/gemini-api/docs/rate-limits",
    "https://ai.google.dev/gemini-api/docs/pricing"
  ]);

  assert.ok(guide.links.some((link) => link.label === "Get API Key"));
  assert.match(guide.text, /Google AI Studio/i);
  assert.match(guide.text, /rate limits/i);
  assert.match(guide.text, /pricing/i);
});
