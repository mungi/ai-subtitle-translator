import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";

const APP_NAME = "AI Subtitle Translator";
const OLD_APP_NAME = "LLM Subtitle Translator";
const PREVIOUS_APP_NAME = ["Context", "Subtitle", "Translator"].join(" ");

const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));
const englishMessages = JSON.parse(readFileSync(new URL("../extension/_locales/en/messages.json", import.meta.url), "utf8"));
const optionsJs = readFileSync(new URL("../extension/options/options.js", import.meta.url), "utf8");
const optionsHtml = readFileSync(new URL("../extension/options/options.html", import.meta.url), "utf8");
const popupJs = readFileSync(new URL("../extension/popup/popup.js", import.meta.url), "utf8");
const popupHtml = readFileSync(new URL("../extension/popup/popup.html", import.meta.url), "utf8");
const popupCss = readFileSync(new URL("../extension/popup/popup.css", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const chromeStoreKo = readFileSync(new URL("../docs/chrome-web-store-ko.md", import.meta.url), "utf8");
const chromeStoreEn = readFileSync(new URL("../docs/chrome-web-store-en.md", import.meta.url), "utf8");

test("extension app name uses AI Subtitle Translator", () => {
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.name, "__MSG_extensionName__");
  assert.equal(englishMessages.extensionName.message, APP_NAME);
  assert.match(englishMessages.extensionDescription.message, /Udemy, YouTube, NVIDIA Academy, and Vimeo subtitles/);
  assert.equal(PROVIDERS.openrouter.appTitle, APP_NAME);
  assert.match(optionsJs, new RegExp(`"appTitle", "fieldXTitle", "${APP_NAME}"`));
  assert.match(optionsHtml, /<title data-i18n="optionsPageTitle"><\/title>/);
  assert.match(optionsHtml, /class="settings-app-icon" src="\.\.\/icons\/icon128\.png"/);
  assert.match(popupHtml, /<title data-i18n="popupTitle"><\/title>/);
  assert.match(popupJs, /function formatTargetLanguage\(code\)/);
  assert.match(popupJs, /function formatTranslationStyle\(style\)/);
  assert.match(popupJs, /return t\(STYLE_MESSAGE_KEYS\[style\] \|\| "styleNatural"\)\.split\(\/\\s\+-\\s\+\/, 1\)\[0\];/);
  assert.match(popupJs, /getTargetLanguageLabel\(language, getExtensionUiLanguage\(\)\)/);
  assert.match(popupJs, /formatTargetLanguage\(settings\.targetLanguage\)/);
  assert.match(popupHtml, /<dd id="translationStyle">-<\/dd>/);
  assert.match(popupHtml, /class="summary-card"/);
  assert.match(popupHtml, /class="brand-mark" src="\.\.\/icons\/icon48\.png"/);
  assert.match(popupCss, /\.summary-card\s*\{/);
  assert.match(popupCss, /\.brand-mark\s*\{/);
  assert.match(readme, new RegExp(`^# ${APP_NAME}\\n`));
  assert.match(chromeStoreKo, new RegExp(`제품명: ${APP_NAME}`));
  assert.match(chromeStoreEn, new RegExp(`Product name: ${APP_NAME}`));
});

test("previous app name is not left in user-facing app metadata", () => {
  assert.notEqual(manifest.name, OLD_APP_NAME);
  assert.notEqual(manifest.name, PREVIOUS_APP_NAME);
  assert.notEqual(PROVIDERS.openrouter.appTitle, OLD_APP_NAME);
  assert.notEqual(PROVIDERS.openrouter.appTitle, PREVIOUS_APP_NAME);
  assert.doesNotMatch(optionsJs, new RegExp(OLD_APP_NAME));
  assert.doesNotMatch(optionsJs, new RegExp(PREVIOUS_APP_NAME));
  assert.doesNotMatch(optionsHtml, new RegExp(OLD_APP_NAME));
  assert.doesNotMatch(popupHtml, new RegExp(OLD_APP_NAME));
  assert.doesNotMatch(readme, new RegExp(OLD_APP_NAME));
  assert.doesNotMatch(readme, new RegExp(PREVIOUS_APP_NAME));
  assert.doesNotMatch(chromeStoreKo, new RegExp(OLD_APP_NAME));
  assert.doesNotMatch(chromeStoreEn, new RegExp(OLD_APP_NAME));
});
