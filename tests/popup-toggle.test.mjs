import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { validateMessageSender } from "../extension/shared/message-contracts.js";

const source = readFileSync(new URL("../extension/popup/popup.js", import.meta.url), "utf8").replace(/^import .*;\r?\n/gm, "");
async function setup(enabled) {
  const elements = new Map();
  const calls = [];
  let storageListener;
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { disabled: true, checked: false, textContent: "", listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; } });
    return elements.get(id);
  };
  const runtime = {
    sendMessage: async (message) => { calls.push(message); return message.type === "settings.getSubtitleEnabled" ? { ok: true, enabled } : { ok: true }; },
    openOptionsPage() {}
  };
  const context = {
    document: { documentElement: {}, getElementById: element, querySelectorAll: () => [] },
    chrome: { runtime, i18n: { getMessage: () => "ko" }, storage: { onChanged: { addListener(fn) { storageListener = fn; } } } },
    getSettings: async () => ({ providers: { google: { label: "Google" } }, activeProvider: "google", targetLanguage: "ko", translationStyle: "natural" }),
    getExtensionUiLanguage: () => "ko", getMessage: (key) => key,
    TARGET_LANGUAGES: [{ code: "ko" }], getTargetLanguageLabel: () => "한국어"
  };
  vm.runInNewContext(source, context);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  return { toggle: element("subtitleEnabled"), status: element("statusLine"), runtime, calls, storage: (value) => storageListener({ subtitleEnabled: { newValue: value } }, "local") };
}

test("popup loads the persisted toggle and sends explicit enabled state", async () => {
  const h = await setup(false);
  assert.equal(h.toggle.checked, false);
  assert.equal(h.toggle.disabled, false);
  h.toggle.checked = true;
  await h.toggle.listeners.change();
  assert.equal(h.calls.at(-1).type, "settings.setSubtitleEnabled");
  assert.equal(h.calls.at(-1).enabled, true);
  h.storage(false);
  assert.equal(h.toggle.checked, false);
});

test("popup restores the toggle and displays an error when persistence fails", async () => {
  const h = await setup(true);
  h.runtime.sendMessage = async () => ({ ok: false, error: "storage failed" });
  h.toggle.checked = false;
  await h.toggle.listeners.change();
  assert.equal(h.toggle.checked, true);
  assert.equal(h.toggle.disabled, false);
  assert.equal(h.status.textContent, "popupLoadFailed");
});

test("toggle messages permit the toolbar popup and supported video pages only", () => {
  for (const type of ["settings.getSubtitleEnabled", "settings.setSubtitleEnabled"]) {
    const message = { type, enabled: false };
    assert.equal(validateMessageSender(message, { id: "ast", url: "chrome-extension://ast/popup/popup.html" }, "ast").ok, true);
    assert.equal(validateMessageSender(message, { id: "ast", tab: { id: 1, url: "https://www.youtube.com/watch?v=abc123def45" } }, "ast").ok, true);
    assert.equal(validateMessageSender(message, { id: "ast", tab: { id: 1, url: "https://example.com" } }, "ast").ok, false);
  }
});
