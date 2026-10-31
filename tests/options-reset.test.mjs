import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import * as defaults from "../extension/shared/defaults.js";

const source = readFileSync(new URL("../extension/options/options.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?$/gm, "")
  .replace(/init\(\)\.catch\(.*\);/, "");
const messages = JSON.parse(readFileSync(new URL("../extension/_locales/ko/messages.json", import.meta.url), "utf8"));
const resetCases = [
  ["resetAllSettings", "resetAllConfirm"],
  ["resetGeneralSettingsSection", "resetGeneralConfirm"],
  ["resetProviderSettingsSection", "resetProvidersConfirm"],
  ["resetFallbackSettingsSection", "resetFallbackConfirm"],
  ["resetSubtitleStyleSettingsSection", "resetSubtitleStyleConfirm"]
];

function createHarness(confirmed) {
  const initial = structuredClone(defaults.DEFAULT_SETTINGS);
  initial.activeProvider = "google";
  initial.targetLanguage = "ja";
  initial.settingsMode = "advanced";
  initial.llmParallelRequests = 7;
  initial.customSystemPrompt = "Keep my custom prompt";
  initial.providers.google.apiKey = "saved-api-key";
  initial.providers.google.model = "custom-model";
  initial.providerTestStatus.google = "success";
  initial.fallback.providerId = "deepl";
  initial.subtitleStyle.fontSize = 45;
  const elements = new Map();
  const events = [];
  const context = vm.createContext({
    ...defaults,
    initialSettings: structuredClone(initial),
    getExtensionUiLanguage: () => "ko",
    getBrowserTargetLanguage: () => "ko",
    getMessage: (key) => messages[key]?.message || key,
    normalizeSettings: () => structuredClone(defaults.DEFAULT_SETTINGS),
    confirm: (message) => { events.push(["confirm", message]); return confirmed; },
    flushMock: async () => { events.push(["flush"]); },
    renderMock: () => { events.push(["render"]); },
    saveSettings: async (settings) => { events.push(["save"]); return settings; },
    resetSettings: async () => { events.push(["reset"]); return structuredClone(defaults.DEFAULT_SETTINGS); },
    document: {
      head: { append() {} },
      createElement: () => ({}),
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, {});
        return elements.get(id);
      }
    }
  });
  vm.runInContext(source, context);
  vm.runInContext(`
    settings = initialSettings;
    selectedProviderId = "google";
    pendingSimpleGoogleApiKey = "pending-key";
    flushAutomaticSave = flushMock;
    renderAll = renderMock;
    captureCurrentFormState = () => {};
  `, context);
  return { context, events, initial };
}

for (const [action, messageKey] of resetCases) {
  test(`canceling ${action} preserves settings and pending API keys without saving`, async () => {
    const { context, events, initial } = createHarness(false);
    await vm.runInContext(`${action}()`, context);
    assert.deepEqual(events, [["confirm", messages[messageKey].message]]);
    assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(settings)", context)), initial);
    assert.equal(vm.runInContext("pendingSimpleGoogleApiKey", context), "pending-key");
    assert.equal(vm.runInContext("simpleGoogleTestRunId", context), 0);
  });

  test(`confirming ${action} resets only its intended settings`, async () => {
    const { context, events, initial } = createHarness(true);
    await vm.runInContext(`${action}()`, context);
    assert.deepEqual(events.slice(0, 2), [["confirm", messages[messageKey].message], ["flush"]]);
    assert.equal(events.filter(([event]) => event === "save" || event === "reset").length, 1);
    const expected = structuredClone(initial);
    const baseline = defaults.DEFAULT_SETTINGS;
    if (action === "resetAllSettings") {
      Object.assign(expected, structuredClone(baseline));
    } else if (action === "resetGeneralSettingsSection") {
      for (const key of ["activeProvider", "targetLanguage", "translationStyle", "custom2SystemPrompt", "maxChunkDurationSeconds", "llmParallelRequests", "cacheTranslations"]) {
        expected[key] = baseline[key];
      }
      expected.customSystemPrompt = defaults.buildDefaultCustomStyleSystemPrompt("ko");
    } else if (action === "resetProviderSettingsSection") {
      expected.providers = structuredClone(baseline.providers);
      expected.providerTestStatus = structuredClone(baseline.providerTestStatus);
    } else if (action === "resetFallbackSettingsSection") {
      expected.fallback = structuredClone(baseline.fallback);
    } else {
      expected.subtitleStyle = structuredClone(baseline.subtitleStyle);
    }
    assert.deepEqual(JSON.parse(vm.runInContext("JSON.stringify(settings)", context)), expected);
  });
}
