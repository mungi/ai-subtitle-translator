import assert from "node:assert/strict";
import test from "node:test";
import { getTargetLanguageLabel, TARGET_LANGUAGES } from "../extension/shared/defaults.js";

function language(code) {
  return TARGET_LANGUAGES.find((item) => item.code === code);
}

test("target language labels use each language's native name", () => {
  assert.equal(getTargetLanguageLabel(language("ko")), "한국어");
  assert.equal(getTargetLanguageLabel(language("en")), "English");
  assert.equal(getTargetLanguageLabel(language("ja")), "日本語");
  assert.equal(getTargetLanguageLabel(language("zh-CN")), "简体中文");
  assert.equal(getTargetLanguageLabel(language("zh-TW")), "繁體中文");
  assert.equal(getTargetLanguageLabel(language("es")), "Español");
  assert.equal(getTargetLanguageLabel(language("fr")), "Français");
  assert.equal(getTargetLanguageLabel(language("de")), "Deutsch");
  assert.equal(getTargetLanguageLabel(language("it")), "Italiano");
  assert.equal(getTargetLanguageLabel(language("pt")), "Português");
  assert.equal(getTargetLanguageLabel(language("pt-BR")), "Português (Brasil)");
  assert.equal(getTargetLanguageLabel(language("ru")), "Русский");
  assert.equal(getTargetLanguageLabel(language("ar")), "العربية");
  assert.equal(getTargetLanguageLabel(language("hi")), "हिन्दी");
  assert.equal(getTargetLanguageLabel(language("id")), "Bahasa Indonesia");
  assert.equal(getTargetLanguageLabel(language("vi")), "Tiếng Việt");
  assert.equal(getTargetLanguageLabel(language("th")), "ไทย");
  assert.equal(getTargetLanguageLabel(language("tr")), "Türkçe");
  assert.equal(getTargetLanguageLabel(language("pl")), "Polski");
  assert.equal(getTargetLanguageLabel(language("nl")), "Nederlands");
  assert.equal(getTargetLanguageLabel(language("sv")), "Svenska");
  assert.equal(getTargetLanguageLabel(language("uk")), "Українська");
});
