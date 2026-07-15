import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const optionsHtml = readFileSync(new URL("../extension/options/options.html", import.meta.url), "utf8");
const optionsCss = readFileSync(new URL("../extension/options/options.css", import.meta.url), "utf8");
const optionsJs = readFileSync(new URL("../extension/options/options.js", import.meta.url), "utf8");
const localeMessages = Object.fromEntries(["en", "ko", "ja"].map((locale) => [
  locale,
  JSON.parse(readFileSync(new URL(`../extension/_locales/${locale}/messages.json`, import.meta.url), "utf8"))
]));

function message(locale, key) {
  return localeMessages[locale][key]?.message;
}

function extractBlock(html, marker) {
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `${marker} should exist`);
  const end = html.indexOf("</div>", start);
  assert.notEqual(end, -1, `${marker} should close`);
  return html.slice(start, end);
}

function extractCssBlock(css, selector) {
  const match = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `${selector} should exist`);
  return match[1];
}

test("top actions only expose reset all when settings save automatically", () => {
  const headerActions = extractBlock(optionsHtml, '<div class="header-actions">');
  assert.doesNotMatch(headerActions, /id="testProvider"/);
  assert.match(headerActions, /<button id="resetSettings" type="button" class="ghost" data-i18n="allReset"><\/button>/);
  assert.doesNotMatch(headerActions, /id="saveSettings"/);
  assert.equal(message("ko", "allReset"), "전체 초기화");
  assert.equal(message("en", "allReset"), "Reset all");
});

test("settings mode tabs default to a focused Google API key simple panel", () => {
  const headerEnd = optionsHtml.indexOf("</header>");
  const tabsIndex = optionsHtml.indexOf('id="settingsModeTabs"');
  const simpleIndex = optionsHtml.indexOf('id="simpleSettingsPanel"');
  const advancedIndex = optionsHtml.indexOf('id="advancedSettingsPanel"');

  assert.ok(tabsIndex > headerEnd);
  assert.ok(simpleIndex > tabsIndex);
  assert.ok(advancedIndex > simpleIndex);
  assert.match(optionsHtml, /id="simpleSettingsTab"[^>]*role="tab"[^>]*aria-selected="true"/);
  assert.match(optionsHtml, /id="advancedSettingsTab"[^>]*role="tab"[^>]*aria-selected="false"/);
  assert.match(optionsHtml, /id="simpleGoogleApiKey" type="password" autocomplete="off"/);
  assert.match(optionsHtml, /id="simpleSettingsStatus"[^>]*role="status"/);
  assert.match(optionsHtml, /id="advancedSettingsPanel"[^>]*hidden/);
  assert.match(optionsCss, /\.settings-mode-tabs\s*\{/);
  assert.match(optionsCss, /\.settings-mode-tabs button\.active\s*\{/);
});

test("simple settings retain the existing Google guide and show the API key guide only there", () => {
  const simpleStart = optionsHtml.indexOf('id="simpleSettingsPanel"');
  const simpleEnd = optionsHtml.indexOf('<div id="advancedSettingsPanel"', simpleStart);
  const simpleHtml = optionsHtml.slice(simpleStart, simpleEnd);
  const advancedStart = optionsHtml.indexOf('id="advancedSettingsPanel"');
  const advancedHtml = optionsHtml.slice(advancedStart);

  assert.match(simpleHtml, /id="simpleGoogleGuide"/);
  assert.match(simpleHtml, /id="simpleGoogleKeyGuide"/);
  assert.match(simpleHtml, /data-i18n="simpleGoogleKeyGuideTitle"/);
  assert.match(simpleHtml, /data-i18n="simpleGoogleKeyGuideStep1"/);
  assert.match(simpleHtml, /data-i18n="simpleGoogleKeyGuideStep2"/);
  assert.match(simpleHtml, /data-i18n="simpleGoogleKeyGuideStep3"/);
  assert.match(simpleHtml, /data-i18n="simpleGoogleKeyGuideStep4"/);
  assert.match(simpleHtml, /data-i18n="simpleGoogleKeyGuideStep5"/);
  assert.match(simpleHtml, /data-i18n="simpleGoogleKeySecurityNotice"/);
  assert.match(simpleHtml, /id="simpleGoogleGuideLinks"/);
  assert.doesNotMatch(simpleHtml, /id="providerTabs"/);
  assert.doesNotMatch(advancedHtml, /simpleGoogleKeyGuide/);
});

test("simple settings use the Google helper, test the key, and retain the current provider on failure", () => {
  assert.match(
    optionsJs,
    /import \{[\s\S]*stageSimpleGoogleApiKey[\s\S]*applySimpleGoogleTestResult[\s\S]*\} from "\.\.\/shared\/simple-google-settings\.js"/
  );
  assert.match(optionsJs, /function setSettingsMode\(mode\)/);
  assert.match(optionsJs, /function renderSimpleGoogleSettings\(\)/);
  assert.match(optionsJs, /async function testSimpleGoogleApiKey\(\)/);
  assert.match(optionsJs, /function handleSettingsModeTabsKeydown\(event\)/);
  assert.match(optionsJs, /case "ArrowRight":/);
  assert.match(optionsJs, /case "ArrowLeft":/);
  assert.match(optionsJs, /case "Home":/);
  assert.match(optionsJs, /case "End":/);
  assert.match(optionsJs, /settingsModeTabs\.addEventListener\("keydown", handleSettingsModeTabsKeydown\);/);
  assert.match(optionsJs, /async function testSimpleGoogleApiKey\(\) \{\s*await flushAutomaticSave\(\);/);
  assert.match(optionsJs, /settings = stageSimpleGoogleApiKey\(settings, simpleGoogleApiKeyInput\.value\);/);
  assert.match(optionsJs, /const activeGoogleBackup = captureActiveGoogleBackup\(settings\);/);
  assert.match(optionsJs, /type: "llm\.testActiveProvider",\s*providerId: "google"/);
  assert.match(optionsJs, /settings = applySimpleGoogleTestResult\(settings, response\?\.ok, activeGoogleBackup\);/);
  assert.match(optionsJs, /simpleGoogleApiKeyInput\.addEventListener\("change"/);
  assert.match(optionsJs, /settings = await getSettings\(\);\s*selectedProviderId = settings\.activeProvider;\s*renderAll\(\);\s*setSettingsMode\("simple"\);/);
  const renderAllBlock = optionsJs.match(/function renderAll\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
  assert.doesNotMatch(renderAllBlock, /setSettingsMode/);
  assert.match(optionsJs, /SIMPLE_GOOGLE_GUIDE_LINKS/);
  assert.match(optionsJs, /simpleGoogleGuide\.textContent = t\("simpleGoogleIntroGuide"\);/);
});

test("simple settings messages are synchronized in Korean, English, and Japanese", () => {
  assert.equal(message("ko", "advancedSettingsTab"), "고급 설정");
  assert.equal(message("en", "advancedSettingsTab"), "Advanced Settings");
  assert.equal(message("ja", "advancedSettingsTab"), "詳細設定");

  for (const locale of ["ko", "en", "ja"]) {
    for (const key of [
      "settingsModeLabel",
      "simpleSettingsTab",
      "simpleSettingsTitle",
      "simpleGoogleApiKey",
      "simpleGoogleIntroGuide",
      "simpleGoogleGetApiKey",
      "simpleGoogleYoutubeGuide",
      "simpleGoogleKeyGuideTitle",
      "simpleGoogleKeyGuideStep1",
      "simpleGoogleKeyGuideStep2",
      "simpleGoogleKeyGuideStep3",
      "simpleGoogleKeyGuideStep4",
      "simpleGoogleKeyGuideStep5",
      "simpleGoogleKeySecurityNotice",
      "simpleGoogleApiKeyRequired",
      "simpleGoogleTesting",
      "simpleGoogleTestSuccess",
      "simpleGoogleTestFailed"
    ]) {
      assert.ok(message(locale, key), `${locale} should define ${key}`);
    }
  }

  assert.equal(
    message("ko", "simpleGoogleKeyGuideStep2"),
    "처음이라면 API Keys 페이지에서 사용할 프로젝트를 생성하세요. 이름은 'Gemini Project'처럼 영어로 입력하세요."
  );
  assert.equal(
    message("ko", "simpleGoogleKeyGuideStep4"),
    "생성한 프로젝트의 결제 등급이 '무료 등급(Free)'인지 꼭 확인하세요."
  );
  assert.equal(
    message("ko", "simpleGoogleIntroGuide"),
    "Google AI로 자막을 번역합니다. 아래 안내대로 API 키를 만든 뒤 입력하면 Gemini 3.1 Flash Lite를 자동으로 설정하고 연결을 확인합니다."
  );
});

test("each settings section has its own reset button on the title row", () => {
  for (const id of [
    "resetGeneralSettings",
    "resetProviderSettings",
    "resetFallbackSettings",
    "resetSubtitleStyleSettings"
  ]) {
    assert.match(
      optionsHtml,
      new RegExp(`<button id="${id}" type="button" class="ghost" data-i18n="reset"></button>`)
    );
  }

  const resetIndex = optionsHtml.indexOf('id="resetProviderSettings"');
  const testIndex = optionsHtml.indexOf('id="testProvider"');
  assert.ok(testIndex > resetIndex, "testProvider should be placed after provider section reset");
  assert.match(
    optionsHtml,
    /id="resetProviderSettings"[\s\S]*<\/button>\s*<button id="testProvider" type="button" class="primary" data-i18n="testProvider">/
  );
  assert.doesNotMatch(optionsHtml, /class="test-provider-actions"/);
  const sectionActions = extractBlock(optionsHtml, '<div class="section-actions">');
  const sectionActionsCss = extractCssBlock(optionsCss, ".section-actions");
  assert.doesNotMatch(sectionActions, /id="statusLine"/);
  assert.match(sectionActionsCss, /display: flex;/);
  assert.doesNotMatch(sectionActionsCss, /status/);
  assert.match(optionsCss, /#testProvider\s*\{[\s\S]*margin-left: 16px;/);
});

test("section reset handlers reset only their own settings group", () => {
  assert.match(optionsJs, /function captureCurrentFormState\(\)/);
  assert.match(optionsJs, /async function resetGeneralSettingsSection\(\)/);
  assert.match(optionsJs, /activeProvider: DEFAULT_SETTINGS\.activeProvider/);
  assert.match(optionsJs, /maxChunkDurationSeconds: DEFAULT_SETTINGS\.maxChunkDurationSeconds/);
  assert.match(optionsJs, /async function resetProviderSettingsSection\(\)/);
  assert.match(optionsJs, /settings\.providers = clone\(DEFAULT_SETTINGS\.providers\);/);
  assert.match(optionsJs, /settings\.providerTestStatus = clone\(DEFAULT_SETTINGS\.providerTestStatus\);/);
  assert.match(optionsJs, /async function resetFallbackSettingsSection\(\)/);
  assert.match(optionsJs, /settings\.fallback = clone\(DEFAULT_SETTINGS\.fallback\);/);
  assert.match(optionsJs, /async function resetSubtitleStyleSettingsSection\(\)/);
  assert.match(optionsJs, /settings\.subtitleStyle = clone\(DEFAULT_SETTINGS\.subtitleStyle\);/);
});

test("cache controls are part of general settings instead of provider actions", () => {
  const generalStart = optionsHtml.indexOf('<section class="settings-section">');
  const providerStart = optionsHtml.indexOf('<h2 data-i18n="providerSettings">');
  const generalHtml = optionsHtml.slice(generalStart, providerStart);
  const sectionActions = extractBlock(optionsHtml, '<div class="section-actions">');

  assert.match(generalHtml, /class="wide cache-action-row"[\s\S]*id="cacheTranslations"[\s\S]*id="clearCache"/);
  assert.doesNotMatch(sectionActions, /id="clearCache"/);
  assert.match(optionsCss, /\.cache-action-row\s*\{[\s\S]*display: flex;/);
});

test("chunk duration uses a two-to-fifteen minute slider with one-minute steps", () => {
  assert.match(optionsHtml, /id="maxChunkDurationMinutes" type="range" min="2" max="15" step="1" value="7"/);
  assert.match(optionsHtml, /id="maxChunkDurationValue" for="maxChunkDurationMinutes">7<\/output>/);
  assert.equal(message("ko", "durationMinutes"), "$minutes$분");
  assert.match(optionsJs, /function getChunkDurationMinutes/);
  assert.match(optionsJs, /maxChunkDurationMinutesInput\.addEventListener\("input", \(\) => \{\s*updateChunkDurationValue\(\);\s*scheduleAutomaticSave\(\);/);
  assert.match(optionsJs, /maxChunkDurationMinutesInput\.addEventListener\("change", \(\) => \{\s*scheduleAutomaticSave\(\{ immediate: true \}\);/);
});

test("provider test result is shown in a separate container below provider settings actions", () => {
  const headerStart = optionsHtml.indexOf("<header");
  const headerEnd = optionsHtml.indexOf("</header>", headerStart);
  const headerHtml = optionsHtml.slice(headerStart, headerEnd);
  assert.doesNotMatch(headerHtml, /id="statusLine"/);

  assert.match(
    optionsHtml,
    /<div class="section-actions">[\s\S]*id="testProvider"[\s\S]*<\/div>\s*<div class="provider-status-row">\s*<p id="statusLine" class="status-line" role="status"><\/p>\s*<\/div>/
  );
  assert.match(optionsCss, /\.provider-status-row\s*\{[\s\S]*justify-content: flex-end;/);
  assert.doesNotMatch(optionsCss, /\.status-line\s*\{[\s\S]*grid-area: status;/);
});

test("provider tab turns light green after a successful provider test", () => {
  assert.doesNotMatch(optionsCss, /button\.primary\.connection-success/);
  assert.match(optionsCss, /\.provider-tabs button\.connection-success/);
  assert.match(optionsJs, /persistProviderTestStatus\(providerId, "success", \{ activate: true \}\)/);
  assert.match(optionsJs, /getProviderTestStatus\(provider\.id\)/);
  assert.match(optionsJs, /providerTestStatus/);
  assert.match(optionsJs, /classList\.toggle\("connection-success"/);
  assert.doesNotMatch(optionsJs, /testProviderButton\.classList\.toggle\("connection-success"/);
});

test("a successful connection test activates the tested provider", () => {
  assert.match(optionsJs, /if \(activate && state === "success"\) \{\s*settings\.activeProvider = providerId;\s*\}/);
  assert.match(optionsJs, /persistProviderTestStatus\(providerId, "success", \{ activate: true \}\)/);
});

test("active provider select only shows providers that pass connection tests", () => {
  assert.match(
    optionsJs,
    /import \{ getOrderedProviders, PROVIDER_TAB_SEPARATOR_AFTER_ID \} from "\.\.\/shared\/provider-order\.js";/
  );
  assert.match(optionsJs, /function isActiveProviderAvailable\(provider\)/);
  assert.match(optionsJs, /provider\.apiStyle === "google-translate" \|\| getProviderTestStatus\(provider\.id\) === "success"/);
  assert.match(optionsJs, /const activeProviders = getOrderedProviders\(settings\.providers\)\.filter\(isActiveProviderAvailable\);/);
  assert.match(optionsJs, /activeProviderSelect\.disabled = activeProviders\.length === 0;/);
  assert.match(optionsJs, /providerTestRequired/);
  assert.match(optionsJs, /fallbackProviderSelect\.innerHTML = getOrderedProviders\(settings\.providers\)/);
  assert.match(optionsJs, /for \(const provider of getOrderedProviders\(settings\.providers\)\)/);
  assert.match(optionsJs, /function renderProviderTabSeparator\(\)/);
  assert.match(optionsJs, /separator\.className = "provider-tab-separator";/);
  assert.match(optionsJs, /separator\.textContent = "\|";/);
  assert.match(optionsJs, /provider\.id === PROVIDER_TAB_SEPARATOR_AFTER_ID/);
  assert.match(optionsCss, /\.provider-tab-separator\s*\{[\s\S]*margin: 0 8px;/);
});

test("active provider guide uses the full row above translation style", () => {
  assert.match(
    optionsHtml,
    /<p class="wide active-provider-guide" data-i18n="activeProviderGuide"><\/p>\s*<label class="wide">\s*<span data-i18n="translationStyle">/
  );
  assert.match(message("ko", "activeProviderGuide"), /Google Translate는 항상 사용할 수 있으며/);
  assert.match(optionsCss, /\.active-provider-guide\s*\{[\s\S]*color: var\(--muted\);/);
});

test("temporary translation section explains first-pass translation and gates DeepL", () => {
  assert.match(optionsHtml, /<h2 data-i18n="fallbackTitle"><\/h2>/);
  assert.match(optionsHtml, /<p class="section-description" data-i18n="fallbackDescription"><\/p>/);
  assert.equal(message("ko", "fallbackTitle"), "임시 번역");
  assert.match(message("ko", "fallbackDescription"), /LLM 번역은 시간이 오래 걸립니다/);
  assert.equal(message("en", "fallbackTitle"), "Temporary Translation");
  assert.match(message("en", "fallbackDescription"), /LLM translation can take time/);
  assert.match(optionsJs, /function isFallbackProviderAvailable\(provider\)/);
  assert.match(optionsJs, /provider\.apiStyle === "deepl" && getProviderTestStatus\(provider\.id\) === "success"/);
  assert.match(optionsJs, /\.filter\(isFallbackProviderAvailable\)/);
  assert.match(optionsCss, /\.section-description\s*\{[\s\S]*color: var\(--muted\);/);
  assert.match(optionsCss, /\.section-description\s*\{[\s\S]*white-space: pre-line;/);
});

test("settings are saved automatically with delayed text input and immediate selections", () => {
  assert.match(optionsJs, /const AUTO_SAVE_DELAY_MS = 800;/);
  assert.match(optionsJs, /function scheduleAutomaticSave\(\{ immediate = false \} = \{\}\)/);
  assert.match(optionsJs, /function flushAutomaticSave\(\)/);
  assert.match(
    optionsJs,
    /activeProviderSelect\.addEventListener\("change", \(\) => \{\s*scheduleAutomaticSave\(\{ immediate: true \}\);/
  );
  assert.match(optionsJs, /systemPromptTextarea\.addEventListener\("input", \(event\) => \{\s*if \(!event\.isComposing\) scheduleAutomaticSave\(\);/);
  assert.match(optionsJs, /systemPromptTextarea\.addEventListener\("blur", \(\) => \{\s*flushAutomaticSave\(\);/);
  assert.doesNotMatch(optionsJs, /function persistActiveProviderChange/);
});

test("system prompt editor is a full-width general setting and custom-only editable", () => {
  assert.match(optionsHtml, /<label class="wide system-prompt-field">\s*<textarea id="systemPrompt"[\s\S]*readonly/);
  assert.doesNotMatch(optionsHtml, /data-i18n="systemPrompt"/);
  assert.match(optionsCss, /\.form-grid \.wide\s*\{[\s\S]*grid-column: 1 \/ -1;/);
  assert.equal(message("ko", "styleCustom"), "Custom 1 - 사용자 번역 스타일 1");
  assert.equal(message("ko", "styleCustom2"), "Custom 2 - 사용자 번역 스타일 2");
  assert.match(optionsJs, /systemPromptTextarea\.readOnly = !isCustom/);
  assert.match(optionsJs, /systemPromptTextarea\.value = buildStyleSystemPrompt\(selectedStyle\)/);
  assert.match(optionsJs, /settings\[customStyleConfig\.settingKey\] = extractStyleSystemPrompt\(systemPromptTextarea\.value\)/);
  assert.doesNotMatch(optionsJs, /buildSystemPromptFromSettings/);
});

test("Custom LLM check and endpoint permission request are rendered only in its provider settings", () => {
  assert.doesNotMatch(optionsHtml, /<h2 data-i18n="localExample">/);
  assert.doesNotMatch(optionsHtml, /Local LLM 예시/);
  assert.equal(message("ko", "localCheckTitle"), "Custom LLM 확인 방법");
  assert.match(optionsJs, /if \(provider\.id === "local"\) \{[\s\S]*renderLocalLlmCheck\(provider\)/);
  assert.match(optionsJs, /function requestCustomLlmEndpointPermission\(provider\)/);
  assert.match(optionsJs, /chrome\.permissions\.request\(\{ origins: \[permissionOrigin\] \}\)/);
  assert.match(optionsJs, /buildLocalChatCompletionsUrl\(draft\.baseUrl\)/);
  assert.match(optionsJs, /draft\.model/);
  assert.match(optionsJs, /draft\.apiKey/);
  assert.match(optionsJs, /updateLocalLlmCheck\(\)/);
  assert.match(optionsCss, /\.local-llm-check h3\s*\{/);
  assert.match(optionsJs, /local: \[[\s\S]*\["model", "fieldModel", "google\/gemma-4-e4b", "model-select"\]/);
});

test("API key fields render masked saved values and preserve untouched secrets", () => {
  assert.match(optionsJs, /import \{ maskSecretValue, resolveSecretFieldValue \} from "\.\.\/shared\/secret-fields\.js";/);
  assert.match(optionsJs, /input\.value = key === "apiKey"\s*\?\s*maskSecretValue\(provider\[key\]\)\s*:\s*\(provider\[key\] \?\? ""\);/);
  assert.match(optionsJs, /if \(key === "apiKey"\) \{\s*provider\[key\] = resolveSecretFieldValue\(value, provider\[key\]\);/);
  assert.doesNotMatch(optionsJs, /input\.value = provider\[key\] \?\? "";/);
});

test("provider API key row is placed before model and keeps fetch models button", () => {
  for (const providerId of ["openai", "anthropic", "google", "openrouter", "nvidiaNim"]) {
    const block = optionsJs.match(new RegExp(`${providerId}: \\[([\\s\\S]*?)\\n  \\]`))?.[1] || "";
    assert.ok(block.indexOf('["apiKey", "fieldApiKey"') < block.indexOf('["model", "fieldModel"'), `${providerId} should render API Key before Model`);
  }

  assert.match(optionsJs, /if \(key === "apiKey" && canFetchModelsForProvider\(provider\)\) \{/);
  assert.match(optionsJs, /row\.className = "api-key-row";/);
  assert.match(optionsJs, /row\.append\(input, button\);/);
  assert.doesNotMatch(optionsJs, /row\.append\(select, button\);/);
  assert.match(optionsCss, /\.api-key-row\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/);
});

test("OpenRouter renders a checked Nitro setting next to its model", () => {
  assert.match(optionsJs, /function renderOpenRouterNitroField\(provider\)/);
  assert.match(optionsJs, /input\.name = "nitro";/);
  assert.match(optionsJs, /input\.checked = provider\.nitro !== false;/);
  assert.equal(message("ko", "openRouterNitro"), "Nitro 사용 (고속 provider 우선)");
  assert.match(optionsJs, /provider\.id === "openrouter" && field\[0\] === "model"/);
});

test("fetching models selects the recommended lightweight model and automatically tests it", () => {
  assert.match(optionsJs, /import \{ selectRecommendedModel \} from "\.\.\/shared\/model-recommendations\.js";/);
  assert.match(optionsJs, /const recommendedModel = selectRecommendedModel\(provider\.id, provider\.models\);/);
  assert.match(optionsJs, /provider\.model = provider\.id === "openrouter"/);
  assert.match(optionsJs, /withOpenRouterNitro\(recommendedModel\.id, provider\.nitro !== false\)/);
  assert.match(optionsJs, /settings = await saveSettings\(settings\);/);
  assert.match(optionsJs, /setStatus\(formatMessage\("recommendedModelTesting"/);
  assert.match(optionsJs, /type: "llm\.testActiveProvider",\s*providerId: provider\.id/);
  assert.match(optionsJs, /updateProviderTestStatus\(provider\.id, testResponse\?\.ok \? "success" : "idle"\);/);
  assert.match(message("ko", "modelsLoadedAndTested"), /\$provider\$: \$model\$ 선택 및 연결 테스트 성공/);
  assert.match(message("en", "modelsLoadedAndTested"), /\$provider\$: Selected \$model\$ and passed the connection test/);
  assert.match(message("ja", "modelsLoadedAndTested"), /\$provider\$: \$model\$ を選択し、接続テストに成功しました/);
  assert.match(optionsJs, /if \(provider\.id === "local"\) \{[\s\S]*localModelSelected[\s\S]*return;/);
  assert.match(message("ko", "localModelSelected"), /\$provider\$: \$model\$ 선택 완료 \(모델 \$count\$개, 연결 테스트는 실행하지 않음\)/);
});

test("subtitle background controls include opacity and temporary fallback color", () => {
  assert.doesNotMatch(optionsHtml, /배경 투명도/);
  assert.match(optionsHtml, /data-i18n="backgroundOpacity"><\/span>/);
  assert.match(optionsHtml, /data-i18n="pendingBackgroundColor"><\/span>/);
  assert.match(optionsHtml, /id="subtitlePendingBackgroundColor" type="color"/);
  assert.equal(message("ko", "pendingBackgroundColor"), "임시 번역 중 배경색");
  assert.match(optionsJs, /pendingBackgroundColor: document\.getElementById\("subtitlePendingBackgroundColor"\)/);
});

test("subtitle style preview gradient runs from dark navy to a near-white bright color", () => {
  const block = extractCssBlock(optionsCss, ".subtitle-preview-frame");

  assert.match(block, /#05004d\s+0%/);
  assert.match(block, /rgba\(255,\s*255,\s*255,\s*0\)\s+100%/);
  assert.match(block, /#f8fafc\s+100%/);
});

test("encrypted settings backup and restore controls are the final settings section", () => {
  const backupSectionIndex = optionsHtml.indexOf('<section class="settings-section backup-restore-section"');
  const lastSectionIndex = optionsHtml.lastIndexOf('<section class="settings-section');
  const backupSectionEnd = optionsHtml.indexOf("</section>", backupSectionIndex);
  const backupSection = optionsHtml.slice(backupSectionIndex, backupSectionEnd);

  assert.equal(backupSectionIndex, lastSectionIndex);
  assert.match(optionsHtml, /data-i18n="backupRestoreTitle"><\/h2>/);
  assert.match(optionsHtml, /data-i18n="backupSeedLabel"><\/span>/);
  assert.doesNotMatch(optionsHtml, />[^<]*Seed[^<]*</);
  assert.doesNotMatch(backupSection, /id="backupSeed"/);
  assert.match(optionsHtml, /id="backupSeed" type="password" minlength="8"/);
  assert.match(optionsHtml, /id="backupSeedConfirmationField" hidden/);
  assert.match(optionsHtml, /id="backupSeedConfirmation" type="password" minlength="8"/);
  assert.match(optionsHtml, /data-i18n-placeholder="backupSeedPlaceholder"/);
  assert.match(optionsHtml, /id="backupSettings"[^>]*><\/button>/);
  assert.match(optionsHtml, /id="restoreSettings"[^>]*><\/button>/);
  assert.match(optionsHtml, /id="restoreSettingsFile"[^>]*type="file" accept="\.astbackup"/);
  assert.doesNotMatch(optionsHtml, /accept="[^"]*(?:\.json|application\/json)/);
  assert.match(optionsHtml, /id="backupStatusLine"[^>]*role="status"/);
  assert.match(optionsHtml, /<dialog id="backupPasswordDialog" class="backup-password-dialog"[^>]*aria-labelledby="backupPasswordDialogTitle"/);
  assert.match(optionsHtml, /<form id="backupPasswordForm" class="backup-password-form">/);
  assert.match(optionsHtml, /id="cancelBackupPassword"[^>]*data-i18n="cancel"/);
  assert.match(optionsHtml, /id="confirmBackupPassword"[^>]*data-i18n="confirm"/);
});

test("supported site toggles are shown in one row below the settings header, not in the popup", () => {
  const popupHtml = readFileSync(new URL("../extension/popup/popup.html", import.meta.url), "utf8");
  const popupJs = readFileSync(new URL("../extension/popup/popup.js", import.meta.url), "utf8");
  const headerEnd = optionsHtml.indexOf("</header>");
  const supportedSitesIndex = optionsHtml.indexOf('class="settings-section supported-sites-section"');
  const generalSettingsIndex = optionsHtml.indexOf('<section class="settings-section">', supportedSitesIndex);

  assert.ok(supportedSitesIndex > headerEnd);
  assert.ok(generalSettingsIndex > supportedSitesIndex);
  assert.match(optionsHtml, /<h2 data-i18n="supportedSites"><\/h2>/);
  assert.match(optionsHtml, /id="toggleUdemy" type="checkbox"/);
  assert.match(optionsHtml, /id="toggleYoutube" type="checkbox"/);
  assert.match(optionsHtml, /id="toggleNvidia" type="checkbox"/);
  assert.match(optionsHtml, /id="toggleVimeo" type="checkbox"/);
  assert.match(optionsCss, /\.supported-sites-toggles\s*\{[\s\S]*display: flex/);
  assert.match(optionsJs, /Object\.entries\(platformToggleInputs\)\.forEach\(\(\[platform, input\]\) => \{/);
  assert.match(optionsJs, /\[platform\]: input\.checked[\s\S]*scheduleAutomaticSave\(\{ immediate: true \}\)/);
  assert.doesNotMatch(popupHtml, /toggle(?:Udemy|Youtube|Nvidia|Vimeo)/);
  assert.doesNotMatch(popupJs, /savePlatformToggle/);
  assert.equal(message("ko", "supportedSites"), "지원 사이트");
});

test("settings backup UI requests a popup password and encrypts backup files", () => {
  assert.match(optionsJs, /import \{ createEncryptedSettingsBackup, decryptSettingsBackup, settingsBackupInternals, validateBackupSeed \}/);
  assert.match(optionsJs, /function getValidatedBackupSeed\(\)/);
  assert.match(optionsJs, /function requestBackupPassword\(mode\)/);
  assert.match(optionsJs, /backupSeedConfirmationField\.hidden = !requiresConfirmation/);
  assert.match(optionsJs, /backupSeedConfirmationInput\.disabled = !requiresConfirmation/);
  assert.match(optionsJs, /backupPasswordMode === "backup" && backupSeedConfirmationInput\.value !== seed/);
  assert.match(optionsJs, /backupPasswordDialog\.showModal\(\)/);
  assert.match(optionsJs, /const seed = await requestBackupPassword\("backup"\)/);
  assert.match(optionsJs, /const seed = await requestBackupPassword\("restore"\)/);
  assert.match(optionsJs, /backupPasswordForm\.addEventListener\("submit"/);
  assert.match(optionsJs, /cancelBackupPasswordButton\.addEventListener\("click"/);
  assert.match(optionsJs, /const validation = validateBackupSeed\(seed\);/);
  assert.match(optionsJs, /await flushAutomaticSave\(\);\s*const backup = await createEncryptedSettingsBackup/);
  assert.match(optionsJs, /createEncryptedSettingsBackup\(settings, seed\)/);
  assert.match(optionsJs, /application\/x-astbackup/);
  assert.match(optionsJs, /function getLocalBackupDate\(date = new Date\(\)\)/);
  assert.match(optionsJs, /date\.getFullYear\(\)/);
  assert.match(optionsJs, /date\.getMonth\(\) \+ 1/);
  assert.match(optionsJs, /date\.getDate\(\)/);
  assert.doesNotMatch(optionsJs, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(optionsJs, /ai-subtitle-translator-settings-\$\{date\}\.astbackup/);
  assert.match(optionsJs, /if \(!\/\\\.astbackup\$\/i\.test\(file\.name\)\)/);
  assert.match(optionsJs, /globalThis\.showOpenFilePicker\(\{/);
  assert.match(optionsJs, /id: "ast-settings-restore"/);
  assert.match(optionsJs, /startIn: "downloads"/);
  assert.match(optionsJs, /excludeAcceptAllOption: true/);
  assert.match(optionsJs, /"application\/x-astbackup": \["\.astbackup"\]/);
  assert.match(optionsJs, /if \(error\?\.name === "AbortError"\) return/);
  assert.match(optionsJs, /typeof globalThis\.showOpenFilePicker !== "function"[\s\S]*restoreSettingsFileInput\.click\(\)/);
  assert.match(optionsJs, /decryptSettingsBackup\(await file\.text\(\), seed\)/);
  assert.match(optionsJs, /settings = await saveSettings\(restoredSettings\);/);
  assert.match(optionsJs, /backupSettingsButton\.addEventListener\("click", backupCurrentSettings\)/);
  assert.match(optionsJs, /restoreSettingsFileInput\.addEventListener\("change"/);
  assert.equal(message("en", "backupRestoreTitle"), "Back Up / Restore Current Settings");
  assert.equal(message("ja", "backupRestoreTitle"), "現在の設定をバックアップ／復元");
  assert.equal(message("ko", "backupSeedLabel"), "백업 비밀번호");
  assert.equal(message("ko", "backupSeedConfirmLabel"), "백업 비밀번호 확인");
  assert.equal(message("en", "backupSeedLabel"), "Backup password");
  assert.equal(message("ja", "backupSeedLabel"), "バックアップパスワード");
  assert.match(optionsCss, /\.backup-restore-grid\s*\{[\s\S]*grid-template-columns:/);
  assert.match(optionsCss, /\.backup-status-line\.error\s*\{[\s\S]*var\(--danger\)/);
  assert.match(optionsCss, /\.backup-password-dialog\s*\{[\s\S]*box-shadow:/);
  assert.match(optionsCss, /\.backup-password-dialog::backdrop\s*\{/);
  assert.match(optionsCss, /#backupSeedConfirmationField\[hidden\]\s*\{[\s\S]*display: none !important/);
});

test("settings restore can validate every configured API key and update provider status", () => {
  assert.match(message("ko", "restoreTestKeysConfirm"), /복원된 설정에 저장된 API Key의 연결 유효성을 지금 확인하시겠습니까/);
  assert.match(message("en", "restoreTestKeysConfirm"), /Test the connection validity of API keys/);
  assert.match(message("ja", "restoreTestKeysConfirm"), /復元した設定の API キー接続を今すぐ確認しますか/);
  assert.match(optionsJs, /import \{ getConfiguredKeyProviders, validateConfiguredProviderKeys \} from "\.\.\/shared\/provider-key-validation\.js";/);
  assert.match(optionsJs, /getConfiguredKeyProviders\(settings\)/);
  assert.match(optionsJs, /async function testRestoredProviderKeys\(\)/);
  assert.match(optionsJs, /validateConfiguredProviderKeys\(settings/);
  assert.match(optionsJs, /type: "llm\.testActiveProvider",\s*providerId/);
  assert.match(optionsJs, /settings\.providerTestStatus = result\.providerTestStatus/);
  assert.match(optionsJs, /settings = await saveSettings\(settings\);/);
  assert.match(optionsJs, /result\.results\.map\(\(providerResult\)/);
  assert.match(optionsJs, /providerResult\.ok \? "restoreKeyTestSuccessItem" : "restoreKeyTestFailureItem"/);
  assert.match(optionsJs, /\[summary, \.\.\.details\]\.join\("\\n"\)/);
  assert.equal(message("ko", "restoreKeyTestSuccessItem"), "✓ $provider$: 성공");
  assert.equal(message("ko", "restoreKeyTestFailureItem"), "✕ $provider$: 실패 - $error$");
  assert.match(optionsCss, /\.backup-status-line\s*\{[\s\S]*white-space: pre-wrap;/);
  assert.match(optionsJs, /if \(globalThis\.confirm\(t\("restoreTestKeysConfirm"\)\)\) \{\s*await testRestoredProviderKeys\(\);/);
});
