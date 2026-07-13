import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, PROVIDERS } from "../extension/shared/defaults.js";
import { normalizeSettings } from "../extension/shared/storage.js";

test("subtitle background color defaults to black", () => {
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.backgroundColor, "#000000");
});

test("default translation style and subtitle appearance match the intended initial setup", () => {
  assert.equal(DEFAULT_SETTINGS.translationStyle, "custom");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.fontSize, 30);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.fontPreset, "gangwon-moduche");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.fontFamily, "'GangwonEducationModuche', Arial, sans-serif");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.outlineEnabled, true);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.outlineWidth, 3);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.pendingBackgroundColor, "#750000");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.backgroundOpacity, 0.3);
});

test("Japanese UI defaults subtitle font to Noto Sans JP", () => {
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "ja"
    }
  };

  try {
    const settings = normalizeSettings();
    assert.equal(settings.subtitleStyle.fontPreset, "noto-sans-jp");
    assert.equal(settings.subtitleStyle.fontFamily, "'Noto Sans JP', sans-serif");
    assert.match(settings.subtitleStyle.webFontCss, /Noto\+Sans\+JP/);
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("non-Korean and non-Japanese UI defaults subtitle font to Arial", () => {
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "en"
    }
  };

  try {
    const settings = normalizeSettings();
    assert.equal(settings.subtitleStyle.fontPreset, "system-arial");
    assert.equal(settings.subtitleStyle.fontFamily, "Arial, sans-serif");
    assert.equal(settings.subtitleStyle.webFontCss, "");
  } finally {
    globalThis.chrome = previousChrome;
  }
});

test("provider connection test status defaults to empty saved state", () => {
  assert.deepEqual(DEFAULT_SETTINGS.providerTestStatus, {});
});

test("LLM chunk defaults target roughly seven-minute requests", () => {
  assert.equal(DEFAULT_SETTINGS.maxChunkDurationSeconds, 420);
});

test("LLM chunk duration is kept between two and fifteen minutes", () => {
  assert.equal(normalizeSettings({ maxChunkDurationSeconds: 60 }).maxChunkDurationSeconds, 120);
  assert.equal(normalizeSettings({ maxChunkDurationSeconds: 1200 }).maxChunkDurationSeconds, 900);
});

test("the former LLM output token default is promoted for pre-release settings", () => {
  const settings = normalizeSettings({
    providers: {
      google: { maxTokens: 4096 }
    }
  });

  assert.equal(settings.providers.google.maxTokens, 8192);
});

test("provider connection test status keeps only successful known providers", () => {
  const settings = normalizeSettings({
    providerTestStatus: {
      openai: "success",
      deepl: "failed",
      unknownProvider: "success"
    }
  });

  assert.deepEqual(settings.providerTestStatus, {
    openai: "success"
  });
});

test("DeepL temporary translation provider is kept only after a successful DeepL connection test", () => {
  const untestedSettings = normalizeSettings({
    fallback: {
      providerId: "deepl"
    }
  });
  const testedSettings = normalizeSettings({
    fallback: {
      providerId: "deepl"
    },
    providerTestStatus: {
      deepl: "success"
    }
  });

  assert.equal(untestedSettings.fallback.providerId, "googleTranslate");
  assert.equal(testedSettings.fallback.providerId, "deepl");
});

test("DeepL is kept as the active final provider after a successful connection test", () => {
  const untestedSettings = normalizeSettings({
    activeProvider: "deepl"
  });
  const testedSettings = normalizeSettings({
    activeProvider: "deepl",
    fallback: {
      providerId: "deepl"
    },
    providerTestStatus: {
      deepl: "success"
    }
  });

  assert.equal(untestedSettings.activeProvider, "googleTranslate");
  assert.equal(testedSettings.activeProvider, "deepl");
  assert.equal(testedSettings.fallback.providerId, "deepl");
});

test("NVIDIA NIM is available as an OpenAI-compatible provider", () => {
  assert.equal(PROVIDERS.nvidiaNim.label, "NVIDIA NIM");
  assert.equal(PROVIDERS.nvidiaNim.apiStyle, "openai-chat");
  assert.equal(PROVIDERS.nvidiaNim.baseUrl, "https://integrate.api.nvidia.com/v1");
  assert.equal(PROVIDERS.nvidiaNim.model, "openai/gpt-oss-120b");
});

test("Google provider is labeled Google AI in settings UI", () => {
  assert.equal(PROVIDERS.google.label, "Google AI");
});

test("hosted LLM providers default to the configured recommended models", () => {
  assert.equal(PROVIDERS.google.model, "gemini-3.1-flash-lite");
  assert.equal(PROVIDERS.openai.model, "gpt-5.6-luna");
  assert.equal(PROVIDERS.anthropic.model, "claude-haiku-4-5-20251001");
  assert.equal(PROVIDERS.openrouter.model, "deepseek/deepseek-v4-flash:nitro");
  assert.equal(PROVIDERS.openrouter.nitro, true);
  assert.equal(PROVIDERS.openrouter.disableReasoning, true);
  assert.equal(PROVIDERS.nvidiaNim.model, "openai/gpt-oss-120b");
});
