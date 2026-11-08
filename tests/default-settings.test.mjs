import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS, PROVIDERS } from "../extension/shared/defaults.js";
import { normalizeSettings } from "../extension/shared/storage.js";

test("subtitle display defaults to dual subtitles and validates saved modes", () => {
  assert.equal(DEFAULT_SETTINGS.subtitleDisplayMode, "dual");
  assert.equal(normalizeSettings().subtitleDisplayMode, "dual");
  assert.equal(normalizeSettings({ subtitleDisplayMode: "invalid" }).subtitleDisplayMode, "dual");
  for (const subtitleDisplayMode of ["dual", "source", "translated"]) {
    assert.equal(normalizeSettings({ subtitleDisplayMode }).subtitleDisplayMode, subtitleDisplayMode);
  }
});

test("subtitle background color defaults to black", () => {
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.backgroundColor, "#000000");
});

test("NVIDIA Academy and Vimeo subtitle support are enabled by default", () => {
  assert.equal(DEFAULT_SETTINGS.platforms.nvidia, true);
  assert.equal(DEFAULT_SETTINGS.platforms.vimeo, true);
  assert.equal(normalizeSettings({ platforms: { nvidia: false } }).platforms.nvidia, false);
  assert.equal(normalizeSettings({ platforms: { vimeo: false } }).platforms.vimeo, false);
});

test("Coursera subtitle support is enabled by default", () => {
  assert.equal(DEFAULT_SETTINGS.platforms.coursera, true);
  assert.equal(normalizeSettings({ platforms: { coursera: false } }).platforms.coursera, false);
});

test("TED subtitle support is enabled by default", () => {
  assert.equal(DEFAULT_SETTINGS.platforms.ted, true);
  assert.equal(normalizeSettings({ platforms: { ted: false } }).platforms.ted, false);
});

test("default translation style and subtitle appearance match the intended initial setup", () => {
  assert.equal(DEFAULT_SETTINGS.translationStyle, "custom");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.fontSize, 30);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.fontPreset, "gowun-batang");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.fontFamily, "'GounBatang', serif");
  assert.match(DEFAULT_SETTINGS.subtitleStyle.webFontCss, /__AST_GOWUN_BATANG_FONT_URL__/);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.width, 1024);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.textColor, "#e2ffad");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.sourceFontSize, 28);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.sourceTextColor, "#f2f2f2");
  // A fresh install gets the source defaults instead of copying the translation style.
  assert.equal(normalizeSettings().subtitleStyle.sourceFontSize, 28);
  assert.equal(normalizeSettings().subtitleStyle.sourceTextColor, "#f2f2f2");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.shadowBlur, 3);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.outlineEnabled, true);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.outlineWidth, 2);
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.pendingBackgroundColor, "#750000");
  assert.equal(DEFAULT_SETTINGS.subtitleStyle.backgroundOpacity, 0.8);
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

test("Korean UI defaults Custom 1 to the star-instructor banmal guidance", () => {
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "ko"
    }
  };

  try {
    const settings = normalizeSettings();
    assert.match(settings.customSystemPrompt, /When the target language is 한국어, use 반말 강의체 by default/);
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

test("former LLM output token defaults are promoted to 16K, and chosen values are kept", () => {
  const settings = normalizeSettings({
    providers: {
      google: { maxTokens: 4096 },
      openai: { maxTokens: 8192 },
      local: { maxTokens: 12000 }
    }
  });

  assert.equal(settings.providers.google.maxTokens, 16384);
  assert.equal(settings.providers.openai.maxTokens, 16384);
  assert.equal(settings.providers.local.maxTokens, 12000);
  for (const id of ["openai", "anthropic", "google", "openrouter", "nvidiaNim", "local"]) {
    assert.equal(normalizeSettings({}).providers[id].maxTokens, 16384, id);
  }
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

test("temporary translation always uses Google Translate, even when DeepL was saved and tested", () => {
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
  assert.equal(testedSettings.fallback.providerId, "googleTranslate");
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
  assert.equal(testedSettings.fallback.providerId, "googleTranslate");
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

test("OpenAI-compatible provider is labeled Custom LLM in settings UI", () => {
  assert.equal(PROVIDERS.local.label, "Custom LLM");
});

test("hosted LLM providers default to the configured recommended models", () => {
  assert.equal(PROVIDERS.google.model, "gemini-3.1-flash-lite");
  assert.equal(PROVIDERS.openai.model, "gpt-6-luna");
  assert.equal(PROVIDERS.anthropic.model, "claude-haiku-5-5");
  assert.equal(PROVIDERS.openrouter.model, "deepseek/deepseek-v4-flash:nitro");
  assert.equal(PROVIDERS.openrouter.nitro, true);
  assert.equal(PROVIDERS.openrouter.disableReasoning, undefined);
  assert.equal(PROVIDERS.nvidiaNim.model, "openai/gpt-oss-120b");
});

test("YouTube-provided subtitles are preferred by default and can be turned off", () => {
  assert.equal(DEFAULT_SETTINGS.preferYoutubeProvidedTranslation, true);
  assert.equal(normalizeSettings().preferYoutubeProvidedTranslation, true);
  assert.equal(normalizeSettings({ preferYoutubeProvidedTranslation: false }).preferYoutubeProvidedTranslation, false);
  assert.equal(normalizeSettings({ preferYoutubeProvidedTranslation: "off" }).preferYoutubeProvidedTranslation, true);
});

test("phrase segmentation, word progress, and the YouTube uploaded-subtitle exception are on by default", () => {
  const settings = normalizeSettings();
  assert.equal(settings.phraseSegmentation, true);
  assert.equal(settings.phraseSegmentationSkipYoutubeManual, true);
  assert.equal(settings.wordProgressHighlight, true);
  const changed = normalizeSettings({ phraseSegmentation: false, phraseSegmentationSkipYoutubeManual: false, wordProgressHighlight: false });
  assert.equal(changed.phraseSegmentation, false);
  assert.equal(changed.phraseSegmentationSkipYoutubeManual, false);
  assert.equal(changed.wordProgressHighlight, false);
});

test("the source subtitle font defaults to Arial whatever the translation font, and can be changed", () => {
  const inherited = normalizeSettings({ subtitleStyle: { fontPreset: "noto-sans-kr", fontFamily: "'Noto Sans KR', sans-serif", webFontCss: "/* kr */" } }).subtitleStyle;
  assert.equal(inherited.fontFamily, "'Noto Sans KR', sans-serif");
  assert.equal(inherited.sourceFontPreset, "system-arial");
  assert.equal(inherited.sourceFontFamily, "Arial, sans-serif");
  assert.equal(inherited.sourceWebFontCss, "");
  assert.equal(normalizeSettings().subtitleStyle.sourceFontPreset, "system-arial");
  assert.equal(normalizeSettings().subtitleStyle.fontPreset, "gowun-batang");
  // Size and color were not saved here, so the source line uses its own defaults.
  assert.equal(inherited.sourceFontSize, 28);
  assert.equal(inherited.sourceTextColor, "#f2f2f2");
  // A style saved before the split keeps both lines the same size and color.
  const saved = normalizeSettings({ subtitleStyle: { fontSize: 30, textColor: "#ffffff" } }).subtitleStyle;
  assert.equal(saved.sourceFontSize, 30);
  assert.equal(saved.sourceTextColor, "#ffffff");
  assert.equal(normalizeSettings().subtitleStyle.textColor, "#e2ffad");
  const sized = normalizeSettings({ subtitleStyle: { fontSize: 30, sourceFontSize: 22, textColor: "#ffffff", sourceTextColor: "#ffd700" } }).subtitleStyle;
  assert.equal(sized.sourceFontSize, 22);
  assert.equal(sized.sourceTextColor, "#ffd700");

  const separate = normalizeSettings({ subtitleStyle: {
    fontPreset: "noto-sans-kr", fontFamily: "'Noto Sans KR', sans-serif",
    sourceFontPreset: "system-arial", sourceFontFamily: "Arial, sans-serif", sourceWebFontCss: ""
  } }).subtitleStyle;
  assert.equal(separate.fontFamily, "'Noto Sans KR', sans-serif");
  assert.equal(separate.sourceFontFamily, "Arial, sans-serif");
});

test("the original line is shown above the translation by default", () => {
  assert.equal(normalizeSettings().subtitleStyle.translationOnTop, false);
  assert.equal(normalizeSettings({ subtitleStyle: { translationOnTop: true } }).subtitleStyle.translationOnTop, true);
});

test("the former 75% subtitle background opacity moves to the 80% default, and other choices stay", () => {
  assert.equal(normalizeSettings({}).subtitleStyle.backgroundOpacity, 0.8);
  assert.equal(normalizeSettings({ subtitleStyle: { backgroundOpacity: 0.75 } }).subtitleStyle.backgroundOpacity, 0.8);
  assert.equal(normalizeSettings({ subtitleStyle: { backgroundOpacity: 0.5 } }).subtitleStyle.backgroundOpacity, 0.5);
  assert.equal(normalizeSettings({ subtitleStyle: { backgroundOpacity: 0 } }).subtitleStyle.backgroundOpacity, 0);
});

test("a 75% opacity chosen after the move to 80% is kept", () => {
  const moved = normalizeSettings({ subtitleStyle: { backgroundOpacity: 0.75 } });
  assert.equal(moved.subtitleStyle.backgroundOpacity, 0.8);
  const chosenLater = normalizeSettings({ ...moved, subtitleStyle: { ...moved.subtitleStyle, backgroundOpacity: 0.75 } });
  assert.equal(chosenLater.subtitleStyle.backgroundOpacity, 0.75);
});

test("the translation line defaults to bold and the original line to regular weight", () => {
  const style = normalizeSettings().subtitleStyle;
  assert.equal(style.fontWeight, 700);
  assert.equal(style.sourceFontWeight, 400);
});
