import assert from "node:assert/strict";
import test from "node:test";
import { getBrowserTargetLanguage } from "../extension/shared/storage.js";

test("target language follows the browser locale and falls back to English", () => {
  const oldChrome = globalThis.chrome;
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    globalThis.chrome = { i18n: { getUILanguage: () => "ko-KR" } };
    assert.equal(getBrowserTargetLanguage(), "ko");
    globalThis.chrome.i18n.getUILanguage = () => "ja-JP";
    assert.equal(getBrowserTargetLanguage(), "ja");
    globalThis.chrome.i18n.getUILanguage = () => "zh-TW";
    assert.equal(getBrowserTargetLanguage(), "zh-TW");
    globalThis.chrome.i18n.getUILanguage = () => "unsupported-XX";
    assert.equal(getBrowserTargetLanguage(), "en");
    globalThis.chrome.i18n.getUILanguage = () => "";
    Object.defineProperty(globalThis, "navigator", { value: { language: "" }, configurable: true });
    assert.equal(getBrowserTargetLanguage(), "en");
  } finally {
    globalThis.chrome = oldChrome;
    if (oldNavigator) Object.defineProperty(globalThis, "navigator", oldNavigator);
    else delete globalThis.navigator;
  }
});
