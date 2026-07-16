import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultCustom2StyleSystemPrompt, buildDefaultCustomStyleSystemPrompt, buildPresetSystemPrompt, buildStyleSystemPrompt, buildSystemPromptFromSettings, DEFAULT_SETTINGS, extractStyleSystemPrompt, TRANSLATION_STYLES } from "../extension/shared/defaults.js";

test("preset system prompts include auto-caption correction guidance and target language", () => {
  const prompt = buildPresetSystemPrompt("lecture", "ko");

  assert.match(prompt, /auto-generated from speech/);
  assert.match(prompt, /ASR errors/);
  assert.match(prompt, /Silently correct obvious transcription errors/);
  assert.match(prompt, /idiomatic paraphrase/);
  assert.match(prompt, /Target language: ko\./);
});

test("translation styles expose explicit prompt modes including both custom styles", () => {
  assert.deepEqual(TRANSLATION_STYLES.map((style) => style.id), [
    "natural",
    "lecture",
    "technical",
    "custom",
    "custom2"
  ]);

  assert.match(buildPresetSystemPrompt("natural", "ko"), /Style: Natural\./);
  assert.match(buildPresetSystemPrompt("lecture", "ko"), /Style: Lecture\./);
  assert.match(buildPresetSystemPrompt("technical", "ko"), /Style: Technical\./);
  assert.match(buildPresetSystemPrompt("natural", "ko"), /smooth subtitle rhythm/);
  assert.match(buildPresetSystemPrompt("lecture", "ko"), /step-by-step reasoning/);
  assert.match(buildPresetSystemPrompt("technical", "ko"), /configuration values/);
});

test("custom system prompt overrides preset prompt", () => {
  const customPrompt = "Style: Custom.\nTranslate subtitles in my house style.";
  const prompt = buildSystemPromptFromSettings({
    translationStyle: "custom",
    customSystemPrompt: customPrompt,
    targetLanguage: "ko"
  });

  assert.match(prompt, /auto-generated from speech/);
  assert.match(prompt, /Style: Custom\./);
  assert.match(prompt, /Translate subtitles in my house style\./);
  assert.match(prompt, /Target language: ko\./);
});

test("Custom 2 uses its own friendly beginner teacher prompt", () => {
  const prompt = buildSystemPromptFromSettings({
    translationStyle: "custom2",
    custom2SystemPrompt: buildDefaultCustom2StyleSystemPrompt(),
    targetLanguage: "ko"
  });

  assert.match(prompt, /Style: Friendly beginner teacher\./);
  assert.match(prompt, /patient and friendly teacher/);
  assert.match(prompt, /warm, polite lecture register/);
  assert.match(prompt, /Target language: ko\./);
});

test("Custom 2 falls back to its default prompt when no saved prompt exists yet", () => {
  const prompt = buildSystemPromptFromSettings({
    translationStyle: "custom2",
    targetLanguage: "ko"
  });

  assert.match(prompt, /Style: Friendly beginner teacher\./);
});

test("default custom system prompt is target-language neutral star instructor style", () => {
  assert.equal(DEFAULT_SETTINGS.customSystemPrompt, buildDefaultCustomStyleSystemPrompt());
  assert.match(DEFAULT_SETTINGS.customSystemPrompt, /Style: Star instructor lecture\./);
  assert.match(DEFAULT_SETTINGS.customSystemPrompt, /target language specified by the system prompt/);
  assert.match(DEFAULT_SETTINGS.customSystemPrompt, /informal, direct speech/);
  assert.match(DEFAULT_SETTINGS.customSystemPrompt, /natural informal, direct lecture register/);
  assert.doesNotMatch(DEFAULT_SETTINGS.customSystemPrompt, /When the target language is|한국어|반말|존댓말/);
});

test("default Custom 2 system prompt is the friendly beginner teacher style", () => {
  assert.equal(DEFAULT_SETTINGS.custom2SystemPrompt, buildDefaultCustom2StyleSystemPrompt());
  assert.match(DEFAULT_SETTINGS.custom2SystemPrompt, /Style: Friendly beginner teacher\./);
  assert.match(DEFAULT_SETTINGS.custom2SystemPrompt, /Friendly beginner teacher/);
  assert.match(DEFAULT_SETTINGS.custom2SystemPrompt, /warm, polite lecture register/);
  assert.doesNotMatch(DEFAULT_SETTINGS.custom2SystemPrompt, /When the target language is|한국어|반말|존댓말/);
});

test("style prompt extraction hides shared prompt lines for settings UI", () => {
  assert.equal(extractStyleSystemPrompt(buildPresetSystemPrompt("technical", "ko")), buildStyleSystemPrompt("technical"));
});

test("style prompt extraction updates legacy Custom 1 and Custom 2 headers", () => {
  assert.equal(
    extractStyleSystemPrompt("Style: Custom - Star instructor lecture.\nKeep the lesson clear."),
    "Style: Star instructor lecture.\nKeep the lesson clear."
  );
  assert.equal(
    extractStyleSystemPrompt("Style: Custom - Friendly beginner teacher.\nUse simple words."),
    "Style: Friendly beginner teacher.\nUse simple words."
  );
});
