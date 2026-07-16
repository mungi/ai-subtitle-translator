import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PROVIDER_GUIDES } from "../extension/shared/provider-guides.js";

const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));
const optionsHtml = readFileSync(new URL("../extension/options/options.html", import.meta.url), "utf8");
const optionsSource = readFileSync(new URL("../extension/options/options.js", import.meta.url), "utf8");
const popupHtml = readFileSync(new URL("../extension/popup/popup.html", import.meta.url), "utf8");
const popupSource = readFileSync(new URL("../extension/popup/popup.js", import.meta.url), "utf8");
const contentSource = readFileSync(new URL("../extension/content/content-script.js", import.meta.url), "utf8");
const locales = ["en", "ko", "ja"];
const messagesByLocale = Object.fromEntries(locales.map((locale) => [
  locale,
  JSON.parse(readFileSync(new URL(`../extension/_locales/${locale}/messages.json`, import.meta.url), "utf8"))
]));

function dataMessageKeys(html) {
  return [...html.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)].map((match) => match[1]);
}

test("Chrome i18n resources localize manifest metadata and every options or popup data key", () => {
  assert.equal(manifest.default_locale, "en");
  assert.equal(manifest.name, "__MSG_extensionName__");
  assert.equal(manifest.description, "__MSG_extensionDescription__");

  const requiredKeys = new Set([...dataMessageKeys(optionsHtml), ...dataMessageKeys(popupHtml)]);
  for (const locale of locales) {
    const messages = messagesByLocale[locale];
    for (const key of requiredKeys) {
      assert.equal(typeof messages[key]?.message, "string", `${locale} is missing ${key}`);
      assert.notEqual(messages[key].message, "", `${locale} has an empty ${key}`);
    }
  }
});

test("all locales expose the same Chrome message keys and provider guide text", () => {
  const englishKeys = Object.keys(messagesByLocale.en).sort();
  for (const locale of ["ko", "ja"]) {
    assert.deepEqual(Object.keys(messagesByLocale[locale]).sort(), englishKeys, `${locale} keys should match en`);
  }
  for (const guide of Object.values(PROVIDER_GUIDES)) {
    for (const locale of locales) {
      assert.equal(typeof messagesByLocale[locale][guide.messageKey]?.message, "string");
    }
  }

  for (const messages of Object.values(messagesByLocale)) {
    for (const [key, entry] of Object.entries(messages)) {
      for (const [name, placeholder] of Object.entries(entry.placeholders || {})) {
        assert.match(placeholder.content, /^\$\d+$/, `${key}.${name} should use a Chrome positional placeholder`);
        assert.match(entry.message, new RegExp(`\\$${name}\\$`), `${key} should reference ${name}`);
      }
    }
  }
});

test("extension UI obtains localized strings through chrome.i18n instead of JavaScript locale maps", () => {
  assert.match(optionsSource, /import \{ getExtensionUiLanguage, getMessage \} from "\.\.\/shared\/i18n\.js"/);
  assert.match(optionsSource, /getMessage\(key, substitutions\)/);
  assert.doesNotMatch(optionsSource, /const messages =/);
  assert.doesNotMatch(optionsSource, /const styleMessages =/);
  assert.match(popupSource, /getMessage\(key, substitutions\)/);
  assert.match(contentSource, /chrome\?\.i18n\?\.getMessage\?\.\(key, substitutions\)/);
  assert.doesNotMatch(contentSource, /const CONTENT_TEXT =/);
});
