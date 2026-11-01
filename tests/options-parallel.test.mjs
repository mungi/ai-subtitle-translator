import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as defaults from "../extension/shared/defaults.js";

test("settings tabs persist the execution mode without losing the advanced parallel count", () => {
  const elements = new Map();
  const saves = [];
  const context = vm.createContext({
    ...defaults,
    getExtensionUiLanguage: () => "ko",
    saveMode: (settings) => saves.push(JSON.parse(JSON.stringify(settings))),
    document: {
      head: { append() {} }, createElement: () => ({}),
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, { classList: { toggle() {} }, setAttribute() {} });
        return elements.get(id);
      }
    }
  });
  const source = readFileSync("extension/options/options.js", "utf8")
    .replace(/^import .*;\r?$/gm, "").replace(/init\(\)\.catch\(.*\);/, "");
  vm.runInContext(source, context);
  vm.runInContext(`
    settings = structuredCloneForTest();
    function structuredCloneForTest() { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
    settings.llmParallelRequests = 7;
    scheduleAutomaticSave = () => saveMode(settings);
    setSettingsMode("advanced");
    setSettingsMode("simple");
    setSettingsMode("advanced");
  `, context);
  assert.deepEqual(saves.map((settings) => [settings.settingsMode, settings.llmParallelRequests]), [
    ["advanced", 7], ["simple", 7], ["advanced", 7]
  ]);
  assert.equal(elements.get("advancedSettingsPanel").hidden, false);
  assert.equal(elements.get("simpleSettingsPanel").hidden, true);
  // Rendering a stored selection restores its tab without another write.
  vm.runInContext(`
    renderPlatformSettings = renderGeneralSettings = renderSubtitleStyleSettings =
      renderProviderTabs = renderProviderForm = renderSimpleGoogleSettings = () => {};
    renderAll();
  `, context);
  assert.equal(saves.length, 3);
});

test("the parallel control is only in advanced settings and has localized help", () => {
  const html = readFileSync("extension/options/options.html", "utf8");
  const advanced = html.indexOf('id="advancedSettingsPanel"');
  assert.ok(html.indexOf('id="llmParallelRequests"') > advanced);
  assert.match(html, /id="llmParallelRequests" type="number" min="1" max="8" step="1" value="3"/);
  for (const locale of ["ko", "en", "ja"]) {
    const messages = JSON.parse(readFileSync(`extension/_locales/${locale}/messages.json`, "utf8"));
    assert.ok(messages.llmParallelRequests.message);
    assert.ok(messages.llmParallelRequestsGuide.message);
  }
});
