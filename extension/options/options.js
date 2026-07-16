import { buildDefaultCustom2StyleSystemPrompt, buildDefaultCustomStyleSystemPrompt, buildStyleSystemPrompt, DEFAULT_CUSTOM_WEB_FONT_CSS, DEFAULT_SETTINGS, extractStyleSystemPrompt, getTargetLanguageLabel, getWebFontPresetLabel, TARGET_LANGUAGES, TRANSLATION_STYLES, WEB_FONT_PRESETS } from "../shared/defaults.js";
import { getProviderGuide } from "../shared/provider-guides.js";
import { getConfiguredKeyProviders, validateConfiguredProviderKeys } from "../shared/provider-key-validation.js";
import { selectRecommendedModel } from "../shared/model-recommendations.js";
import { getOrderedProviders, PROVIDER_TAB_SEPARATOR_AFTER_ID } from "../shared/provider-order.js";
import { maskSecretValue, resolveSecretFieldValue } from "../shared/secret-fields.js";
import { SIMPLE_GOOGLE_GUIDE_LINKS, stageSimpleGoogleApiKey, captureActiveGoogleBackup, applySimpleGoogleTestResult } from "../shared/simple-google-settings.js";
import { createEncryptedSettingsBackup, decryptSettingsBackup, settingsBackupInternals, validateBackupSeed } from "../shared/settings-backup.js";
import { getExtensionUiLanguage, getMessage } from "../shared/i18n.js";
import { getCustomLlmPermissionOrigin } from "../shared/provider-security.js";
import { getBrowserTargetLanguage, getSettings, normalizeSettings, resetSettings, saveSettings } from "../shared/storage.js";

const uiLanguage = getExtensionUiLanguage();
const STYLE_MESSAGE_KEYS = {
  natural: "styleNatural",
  lecture: "styleLecture",
  technical: "styleTechnical",
  custom: "styleCustom",
  custom2: "styleCustom2"
};
const AUTO_SAVE_DELAY_MS = 800;
const MESSAGE_SUBSTITUTION_NAMES = {
  recommendedModelTesting: ["provider", "model"],
  modelsLoadedAndTested: ["provider", "model", "count"],
  modelsLoadedTestFailed: ["provider", "model", "error"],
  localModelSelected: ["provider", "model", "count"],
  restoreTestingKey: ["current", "total", "provider"],
  restoreKeyTestComplete: ["success", "total", "failed"],
  restoreKeyTestSuccessItem: ["provider"],
  restoreKeyTestFailureItem: ["provider", "error"],
  durationMinutes: ["minutes"],
  localLlmRequestUrl: ["url"],
  modelExample: ["model"]
};

const customStylePromptConfigs = {
  custom: {
    settingKey: "customSystemPrompt",
    buildDefaultPrompt: buildDefaultCustomStyleSystemPrompt
  },
  custom2: {
    settingKey: "custom2SystemPrompt",
    buildDefaultPrompt: buildDefaultCustom2StyleSystemPrompt
  }
};

function t(key, values = {}) {
  const substitutions = MESSAGE_SUBSTITUTION_NAMES[key]?.map((name) => String(values[name] ?? ""));
  return getMessage(key, substitutions);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultPreviewText() {
  return t("previewText");
}

const providerFieldDefs = {
  googleTranslate: [
    ["baseUrl", "fieldBaseUrl", "https://translate.googleapis.com/translate_a/single"]
  ],
  deepl: [
    ["apiKey", "fieldApiKey", "DeepL-Auth-Key"],
    ["plan", "fieldPlan", "", "select"],
    ["baseUrl", "fieldBaseUrl", "https://api-free.deepl.com/v2/translate"]
  ],
  openai: [
    ["apiKey", "fieldApiKey", "sk-..."],
    ["model", "fieldModel", "gpt-5-mini", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://api.openai.com/v1"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "8192", "number"]
  ],
  anthropic: [
    ["apiKey", "fieldApiKey", "sk-ant-..."],
    ["model", "fieldModel", "claude-sonnet-4-5", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://api.anthropic.com"],
    ["anthropicVersion", "fieldAnthropicVersion", "2023-06-01"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "8192", "number"]
  ],
  google: [
    ["apiKey", "fieldApiKey", "AIza..."],
    ["model", "fieldModel", "gemini-2.5-flash", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://generativelanguage.googleapis.com/v1beta"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "8192", "number"]
  ],
  openrouter: [
    ["apiKey", "fieldApiKey", "sk-or-..."],
    ["model", "fieldModel", "openai/gpt-5-mini", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://openrouter.ai/api/v1"],
    ["siteUrl", "fieldHttpReferer", "https://example.com"],
    ["appTitle", "fieldXTitle", "AI Subtitle Translator"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "8192", "number"]
  ],
  nvidiaNim: [
    ["apiKey", "fieldApiKey", "nvapi-..."],
    ["model", "fieldModel", "openai/gpt-oss-120b", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://integrate.api.nvidia.com/v1"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "8192", "number"]
  ],
  local: [
    ["model", "fieldModel", "google/gemma-4-e4b", "model-select"],
    ["baseUrl", "fieldBaseUrl", "http://localhost:1234/v1"],
    ["apiKey", "fieldApiKeyOptional", ""],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "8192", "number"]
  ]
};

const deepLPlanOptions = [
  ["free", "Free"],
  ["pro", "Pro"]
];

let settings;
let selectedProviderId;
let autoSaveTimer = null;
let autoSaveChain = Promise.resolve();
let settingsRevision = 0;
let pendingAutoSave = null;
let pendingSimpleGoogleActiveBackup = null;
let pendingSimpleGoogleApiKey = null;
let simpleGoogleTestRunId = 0;
let simpleGoogleTestInProgress = false;
let backupRestoreOperationDepth = 0;

const activeProviderSelect = document.getElementById("activeProvider");
const targetLanguageSelect = document.getElementById("targetLanguage");
const translationStyleSelect = document.getElementById("translationStyle");
const systemPromptTextarea = document.getElementById("systemPrompt");
const maxChunkDurationMinutesInput = document.getElementById("maxChunkDurationMinutes");
const maxChunkDurationValue = document.getElementById("maxChunkDurationValue");
const cacheTranslationsInput = document.getElementById("cacheTranslations");
const fallbackProviderSelect = document.getElementById("fallbackProvider");
const providerTabs = document.getElementById("providerTabs");
const providerForm = document.getElementById("providerForm");
const testProviderButton = document.getElementById("testProvider");
const statusLine = document.getElementById("statusLine");
const settingsModeTabs = document.getElementById("settingsModeTabs");
const simpleSettingsTab = document.getElementById("simpleSettingsTab");
const advancedSettingsTab = document.getElementById("advancedSettingsTab");
const simpleSettingsPanel = document.getElementById("simpleSettingsPanel");
const advancedSettingsPanel = document.getElementById("advancedSettingsPanel");
const simpleGoogleApiKeyInput = document.getElementById("simpleGoogleApiKey");
const simpleGoogleGuide = document.getElementById("simpleGoogleGuide");
const simpleGoogleGuideLinks = document.getElementById("simpleGoogleGuideLinks");
const testSimpleGoogleApiKeyButton = document.getElementById("testSimpleGoogleApiKey");
const simpleSettingsStatus = document.getElementById("simpleSettingsStatus");
const backupSeedInput = document.getElementById("backupSeed");
const backupSeedConfirmationField = document.getElementById("backupSeedConfirmationField");
const backupSeedConfirmationInput = document.getElementById("backupSeedConfirmation");
const backupPasswordDialog = document.getElementById("backupPasswordDialog");
const backupPasswordForm = document.getElementById("backupPasswordForm");
const backupPasswordDialogTitle = document.getElementById("backupPasswordDialogTitle");
const cancelBackupPasswordButton = document.getElementById("cancelBackupPassword");
const backupSettingsButton = document.getElementById("backupSettings");
const restoreSettingsButton = document.getElementById("restoreSettings");
const restoreSettingsFileInput = document.getElementById("restoreSettingsFile");
const backupStatusLine = document.getElementById("backupStatusLine");
const simpleGoogleTestLockedControls = [
  simpleGoogleApiKeyInput,
  testSimpleGoogleApiKeyButton,
  document.getElementById("resetSettings"),
  document.getElementById("resetGeneralSettings"),
  document.getElementById("resetProviderSettings"),
  document.getElementById("resetFallbackSettings"),
  document.getElementById("resetSubtitleStyleSettings")
];
const platformToggleInputs = {
  udemy: document.getElementById("toggleUdemy"),
  youtube: document.getElementById("toggleYoutube"),
  nvidia: document.getElementById("toggleNvidia"),
  vimeo: document.getElementById("toggleVimeo")
};
let backupPasswordResolver = null;
let backupPasswordMode = "backup";
const subtitleStylePreview = document.getElementById("subtitleStylePreview");
const customWebFontField = document.getElementById("customWebFontField");
const customWebFontGuide = document.getElementById("customWebFontGuide");
const customPreviewFontStyle = document.createElement("style");
customPreviewFontStyle.id = "ast-custom-preview-font";
document.head.append(customPreviewFontStyle);
const subtitleStyleInputs = {
  fontSize: document.getElementById("subtitleFontSize"),
  fontFamily: document.getElementById("subtitleFontFamily"),
  customWebFontCss: document.getElementById("subtitleCustomWebFontCss"),
  textColor: document.getElementById("subtitleTextColor"),
  shadowEnabled: document.getElementById("subtitleShadowEnabled"),
  shadowColor: document.getElementById("subtitleShadowColor"),
  shadowBlur: document.getElementById("subtitleShadowBlur"),
  shadowDistance: document.getElementById("subtitleShadowDistance"),
  outlineEnabled: document.getElementById("subtitleOutlineEnabled"),
  outlineColor: document.getElementById("subtitleOutlineColor"),
  outlineWidth: document.getElementById("subtitleOutlineWidth"),
  backgroundColor: document.getElementById("subtitleBackgroundColor"),
  pendingBackgroundColor: document.getElementById("subtitlePendingBackgroundColor"),
  backgroundOpacity: document.getElementById("subtitleBackgroundOpacity")
};

function applyLocaleText() {
  document.documentElement.lang = chrome.i18n.getMessage("@@ui_locale") || uiLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

function setStatus(message, type = "") {
  statusLine.textContent = message;
  statusLine.className = `status-line ${type}`.trim();
}

function setSimpleSettingsStatus(message, type = "") {
  simpleSettingsStatus.textContent = message;
  simpleSettingsStatus.className = `status-line ${type}`.trim();
}

function setSettingsMode(mode) {
  const isSimple = mode === "simple";
  simpleSettingsPanel.hidden = !isSimple;
  advancedSettingsPanel.hidden = isSimple;
  simpleSettingsTab.setAttribute("aria-selected", String(isSimple));
  advancedSettingsTab.setAttribute("aria-selected", String(!isSimple));
  simpleSettingsTab.tabIndex = isSimple ? 0 : -1;
  advancedSettingsTab.tabIndex = isSimple ? -1 : 0;
  simpleSettingsTab.classList.toggle("active", isSimple);
  advancedSettingsTab.classList.toggle("active", !isSimple);
}

function handleSettingsModeTabsKeydown(event) {
  const tabs = [simpleSettingsTab, advancedSettingsTab];
  const currentIndex = tabs.indexOf(event.target);
  if (currentIndex === -1) return;

  let nextIndex;
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
      nextIndex = (currentIndex + 1) % tabs.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = tabs.length - 1;
      break;
    default:
      return;
  }

  event.preventDefault();
  const nextTab = tabs[nextIndex];
  setSettingsMode(nextTab.dataset.settingsMode);
  nextTab.focus();
}

function setBackupStatus(message, type = "") {
  backupStatusLine.textContent = message;
  backupStatusLine.className = `backup-status-line ${type}`.trim();
}

function getLocalizedBackupError(error) {
  const messageKeys = {
    fileTooLarge: "backupFileTooLarge",
    invalidJson: "backupInvalidJson",
    unsupportedFormat: "backupUnsupportedFormat",
    decryptFailed: "backupDecryptFailed",
    invalidSettings: "backupInvalidSettings"
  };
  return messageKeys[error?.code] ? t(messageKeys[error.code]) : error?.message || "Unknown error";
}

function formatMessage(key, values = {}) {
  return t(key, values);
}

function getValidatedBackupSeed() {
  const seed = backupSeedInput.value;
  const validation = validateBackupSeed(seed);
  const errorMessages = {
    minLength: "backupSeedMinLength",
    letter: "backupSeedLetter",
    number: "backupSeedNumber",
    special: "backupSeedSpecial",
    whitespace: "backupSeedWhitespace"
  };
  const errorMessage = validation.ok ? "" : t(errorMessages[validation.error]);
  backupSeedInput.setCustomValidity(errorMessage);
  if (!validation.ok) {
    backupSeedInput.reportValidity();
    setBackupStatus(errorMessage, "error");
    return null;
  }
  if (backupPasswordMode === "backup" && backupSeedConfirmationInput.value !== seed) {
    const errorMessage = t("backupSeedMismatch");
    backupSeedConfirmationInput.setCustomValidity(errorMessage);
    backupSeedConfirmationInput.reportValidity();
    setBackupStatus(errorMessage, "error");
    return null;
  }
  return seed;
}

function settleBackupPassword(value) {
  const resolve = backupPasswordResolver;
  backupPasswordResolver = null;
  if (backupPasswordDialog.open) backupPasswordDialog.close();
  resolve?.(value);
}

function requestBackupPassword(mode) {
  if (backupPasswordResolver) settleBackupPassword(null);
  backupPasswordMode = mode;
  const requiresConfirmation = mode === "backup";
  backupPasswordDialogTitle.textContent = t(mode === "restore" ? "restorePasswordTitle" : "backupPasswordTitle");
  backupSeedConfirmationField.hidden = !requiresConfirmation;
  backupSeedConfirmationInput.disabled = !requiresConfirmation;
  backupSeedInput.value = "";
  backupSeedInput.setCustomValidity("");
  backupSeedConfirmationInput.value = "";
  backupSeedConfirmationInput.setCustomValidity("");
  return new Promise((resolve) => {
    backupPasswordResolver = resolve;
    backupPasswordDialog.showModal();
    backupSeedInput.focus();
  });
}

function getLocalBackupDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadBackupFile(contents) {
  const date = getLocalBackupDate();
  const url = URL.createObjectURL(new Blob([contents], { type: "application/x-astbackup" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ai-subtitle-translator-settings-${date}.astbackup`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function backupCurrentSettings() {
  beginBackupRestoreOperation();
  try {
    const seed = await requestBackupPassword("backup");
    if (!seed) return;
    setBackupStatus(t("backupCreating"));
    await flushAutomaticSave();
    const backup = await createEncryptedSettingsBackup(settings, seed);
    downloadBackupFile(backup);
    setBackupStatus(t("backupComplete"), "success");
  } catch (error) {
    setBackupStatus(`${t("backupFailed")}: ${getLocalizedBackupError(error)}`, "error");
  } finally {
    endBackupRestoreOperation();
  }
}

async function testRestoredProviderKeys() {
  const providers = getConfiguredKeyProviders(settings);
  if (providers.length === 0) {
    setBackupStatus(t("restoreNoKeysToTest"), "success");
    return;
  }

  const result = await validateConfiguredProviderKeys(settings, {
    testProvider: (providerId) => chrome.runtime.sendMessage({
        type: "llm.testActiveProvider",
        providerId
      }),
    onProgress: ({ provider, current, total }) => {
      setBackupStatus(formatMessage("restoreTestingKey", {
        current,
        total,
        provider: provider.label
      }));
    }
  });

  settings.providerTestStatus = result.providerTestStatus;
  settings = await saveSettings(settings);
  renderGeneralSettings();
  renderProviderTabs();
  renderFallbackProviderSelect();
  const summary = formatMessage("restoreKeyTestComplete", {
    success: result.successCount,
    total: result.total,
    failed: result.failedCount
  });
  const details = result.results.map((providerResult) => formatMessage(
    providerResult.ok ? "restoreKeyTestSuccessItem" : "restoreKeyTestFailureItem",
    {
      provider: providerResult.providerLabel,
      error: providerResult.error || ""
    }
  ));
  setBackupStatus([summary, ...details].join("\n"), result.failedCount > 0 ? "error" : "success");
}

async function restoreSettingsFromFile(file) {
  if (!file) {
    restoreSettingsFileInput.value = "";
    return;
  }
  if (!/\.astbackup$/i.test(file.name)) {
    setBackupStatus(t("backupUnsupportedFormat"), "error");
    restoreSettingsFileInput.value = "";
    return;
  }
  if (file.size > settingsBackupInternals.MAX_BACKUP_FILE_BYTES) {
    setBackupStatus(t("backupFileTooLarge"), "error");
    restoreSettingsFileInput.value = "";
    return;
  }
  beginBackupRestoreOperation();
  try {
    await flushAutomaticSave();
    const seed = await requestBackupPassword("restore");
    if (!seed) return;
    setBackupStatus(t("restoreReading"));
    const restoredSettings = await decryptSettingsBackup(await file.text(), seed);
    if (!globalThis.confirm(t("restoreConfirm"))) return;
    clearPendingSimpleGoogleApiKey();
    settings = await saveSettings(restoredSettings);
    selectedProviderId = settings.activeProvider;
    renderAll();
    setBackupStatus(t("restoreComplete"), "success");
    if (globalThis.confirm(t("restoreTestKeysConfirm"))) {
      await testRestoredProviderKeys();
    }
  } catch (error) {
    setBackupStatus(`${t("restoreFailed")}: ${getLocalizedBackupError(error)}`, "error");
  } finally {
    endBackupRestoreOperation();
    restoreSettingsFileInput.value = "";
  }
}

async function chooseSettingsBackupFile() {
  if (typeof globalThis.showOpenFilePicker !== "function") {
    restoreSettingsFileInput.click();
    return;
  }

  let handles;
  try {
    handles = await globalThis.showOpenFilePicker({
      id: "ast-settings-restore",
      startIn: "downloads",
      multiple: false,
      excludeAcceptAllOption: true,
      types: [{
        description: "AI Subtitle Translator settings backup",
        accept: {
          "application/x-astbackup": [".astbackup"]
        }
      }]
    });
  } catch (error) {
    if (error?.name === "AbortError") return;
    restoreSettingsFileInput.click();
    return;
  }

  try {
    const file = await handles?.[0]?.getFile();
    await restoreSettingsFromFile(file);
  } catch (error) {
    setBackupStatus(`${t("restoreFailed")}: ${getLocalizedBackupError(error)}`, "error");
  }
}

function getProviderTestStatus(providerId) {
  return settings?.providerTestStatus?.[providerId] === "success" ? "success" : "idle";
}

function isActiveProviderAvailable(provider) {
  return provider.apiStyle === "google-translate" || getProviderTestStatus(provider.id) === "success";
}

function isFallbackProviderAvailable(provider) {
  return provider.apiStyle === "google-translate"
    || provider.apiStyle === "deepl" && getProviderTestStatus(provider.id) === "success";
}

function resolveFallbackProviderId(providerId = settings?.fallback?.providerId) {
  const provider = settings?.providers?.[providerId];
  return provider && isFallbackProviderAvailable(provider) ? provider.id : "googleTranslate";
}

function renderFallbackProviderSelect() {
  const fallbackProviderId = resolveFallbackProviderId();
  settings.fallback = {
    ...(settings.fallback || {}),
    providerId: fallbackProviderId
  };
  fallbackProviderSelect.innerHTML = getOrderedProviders(settings.providers)
    .filter(isFallbackProviderAvailable)
    .map((provider) => `<option value="${provider.id}">${provider.label}</option>`)
    .join("");
  fallbackProviderSelect.value = fallbackProviderId;
}

function updateProviderTestStatus(providerId, state = "idle") {
  settings.providerTestStatus = settings.providerTestStatus || {};
  if (state === "success") {
    settings.providerTestStatus[providerId] = "success";
  } else {
    delete settings.providerTestStatus[providerId];
  }
}

async function persistProviderTestStatus(providerId, state = "idle", { activate = false } = {}) {
  updateProviderTestStatus(providerId, state);
  if (activate && state === "success") {
    settings.activeProvider = providerId;
  }
  settings = await saveSettings(settings);
  renderGeneralSettings();
  renderProviderTabs();
  renderFallbackProviderSelect();
}

function clearSelectedProviderTestStatus() {
  updateProviderTestStatus(selectedProviderId, "idle");
  renderGeneralSettings();
  renderProviderTabs();
  renderFallbackProviderSelect();
}

function hexToRgb(hex) {
  const value = String(hex || "#000000").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "0, 0, 0";
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ].join(", ");
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function buildPreviewTextShadow(style) {
  if (style.shadowEnabled) {
    const distance = clampNumber(style.shadowDistance, 0, 12, 2);
    const blur = clampNumber(style.shadowBlur, 0, 20, 3);
    return `${distance}px ${distance}px ${blur}px ${style.shadowColor || "#000000"}`;
  }
  return "none";
}

function extractFontFamilyFromCss(css) {
  const match = String(css || "").match(/font-family\s*:\s*([^;]+);/i);
  const fontFamily = match?.[1]?.trim();
  if (!fontFamily) return "Arial, sans-serif";
  if (fontFamily.includes(",")) return fontFamily;
  return `${fontFamily}, Arial, sans-serif`;
}

function getSelectedFontPreset() {
  return WEB_FONT_PRESETS.find((preset) => preset.id === subtitleStyleInputs.fontFamily.value);
}

function getFontSettingsFromInputs() {
  const presetId = subtitleStyleInputs.fontFamily.value;
  if (presetId === "custom") {
    const customWebFontCss = subtitleStyleInputs.customWebFontCss.value.trim() || DEFAULT_CUSTOM_WEB_FONT_CSS;
    return {
      fontPreset: "custom",
      fontFamily: extractFontFamilyFromCss(customWebFontCss),
      webFontCss: customWebFontCss,
      customWebFontCss
    };
  }

  const preset = getSelectedFontPreset() || WEB_FONT_PRESETS[0];
  return {
    fontPreset: preset.id,
    fontFamily: preset.fontFamily,
    webFontCss: preset.css,
    customWebFontCss: subtitleStyleInputs.customWebFontCss.value.trim() || DEFAULT_CUSTOM_WEB_FONT_CSS
  };
}

function renderFontPresetOptions() {
  subtitleStyleInputs.fontFamily.innerHTML = [
    ...WEB_FONT_PRESETS.map((preset) => `<option value="${preset.id}">${escapeHtml(getWebFontPresetLabel(preset, uiLanguage))}</option>`),
    `<option value="custom">${t("customWebFontSettings")}</option>`
  ].join("");
}

function updateCustomWebFontVisibility() {
  const isCustom = subtitleStyleInputs.fontFamily.value === "custom";
  customWebFontField.classList.toggle("hidden", !isCustom);
  customWebFontGuide.classList.toggle("hidden", !isCustom);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readGeneralSettings() {
  settings.activeProvider = activeProviderSelect.value;
  settings.targetLanguage = targetLanguageSelect.value;
  settings.translationStyle = translationStyleSelect.value;
  const customStyleConfig = customStylePromptConfigs[settings.translationStyle];
  if (customStyleConfig) {
    settings[customStyleConfig.settingKey] = extractStyleSystemPrompt(systemPromptTextarea.value)
      || customStyleConfig.buildDefaultPrompt(settings.targetLanguage || getBrowserTargetLanguage());
  }
  settings.maxChunkDurationSeconds = getChunkDurationMinutes() * 60;
  settings.cacheTranslations = cacheTranslationsInput.checked;
  settings.fallback.providerId = resolveFallbackProviderId(fallbackProviderSelect.value || "googleTranslate");
}

function getChunkDurationMinutes(value = maxChunkDurationMinutesInput.value) {
  const minutes = Number(value);
  return Math.min(15, Math.max(2, Number.isFinite(minutes) ? minutes : DEFAULT_SETTINGS.maxChunkDurationSeconds / 60));
}

function updateChunkDurationValue() {
  const minutes = getChunkDurationMinutes();
  maxChunkDurationMinutesInput.value = minutes;
  maxChunkDurationValue.textContent = t("durationMinutes", { minutes });
}

function readSubtitleStyleSettings() {
  const fontSettings = getFontSettingsFromInputs();
  settings.subtitleStyle = {
    ...(settings.subtitleStyle || {}),
    fontSize: Number(subtitleStyleInputs.fontSize.value || 30),
    fontPreset: fontSettings.fontPreset,
    fontFamily: fontSettings.fontFamily,
    webFontCss: fontSettings.webFontCss,
    customWebFontCss: fontSettings.customWebFontCss,
    textColor: subtitleStyleInputs.textColor.value,
    shadowEnabled: subtitleStyleInputs.shadowEnabled.checked,
    shadowColor: subtitleStyleInputs.shadowColor.value,
    shadowBlur: Number(subtitleStyleInputs.shadowBlur.value || 0),
    shadowDistance: Number(subtitleStyleInputs.shadowDistance.value || 0),
    outlineEnabled: subtitleStyleInputs.outlineEnabled.checked,
    outlineColor: subtitleStyleInputs.outlineColor.value,
    outlineWidth: Number(subtitleStyleInputs.outlineWidth.value || 0),
    backgroundColor: subtitleStyleInputs.backgroundColor.value,
    pendingBackgroundColor: subtitleStyleInputs.pendingBackgroundColor.value,
    backgroundOpacity: Number(subtitleStyleInputs.backgroundOpacity.value || 0)
  };
}

function applySubtitlePreview() {
  readSubtitleStyleSettings();
  const style = settings.subtitleStyle || {};
  updateCustomWebFontVisibility();
  customPreviewFontStyle.textContent = style.webFontCss || "";
  subtitleStylePreview.style.fontSize = `${clampNumber(style.fontSize, 10, 64, 30)}px`;
  subtitleStylePreview.style.fontFamily = style.fontFamily || "Arial, sans-serif";
  subtitleStylePreview.style.color = style.textColor || "#f2f2f2";
  subtitleStylePreview.style.textShadow = buildPreviewTextShadow(style);
  const outlineWidth = clampNumber(style.outlineWidth, 0, 16, 2);
  subtitleStylePreview.style.webkitTextStroke = style.outlineEnabled ?? true
    ? `${outlineWidth}px ${style.outlineColor || "#000000"}`
    : "0 transparent";
  subtitleStylePreview.style.paintOrder = "stroke fill";
  subtitleStylePreview.style.background = `rgba(${hexToRgb(style.backgroundColor)}, ${clampNumber(style.backgroundOpacity, 0, 1, 0.5)})`;
}

function renderGeneralSettings() {
  const activeProviders = getOrderedProviders(settings.providers).filter(isActiveProviderAvailable);
  if (!activeProviders.some((provider) => provider.id === settings.activeProvider)) {
    settings.activeProvider = activeProviders[0]?.id || DEFAULT_SETTINGS.activeProvider;
  }

  activeProviderSelect.disabled = activeProviders.length === 0;
  activeProviderSelect.innerHTML = activeProviders.length > 0
    ? activeProviders.map((provider) => `<option value="${provider.id}">${provider.label}</option>`).join("")
    : `<option value="">${t("providerTestRequired")}</option>`;
  if (activeProviders.length > 0) {
    activeProviderSelect.value = settings.activeProvider;
  }

  translationStyleSelect.innerHTML = TRANSLATION_STYLES
    .map((style) => `<option value="${style.id}">${t(STYLE_MESSAGE_KEYS[style.id])}</option>`)
    .join("");
  translationStyleSelect.value = settings.translationStyle;
  renderTargetLanguageSelect();
  maxChunkDurationMinutesInput.value = getChunkDurationMinutes(settings.maxChunkDurationSeconds / 60);
  updateChunkDurationValue();
  cacheTranslationsInput.checked = Boolean(settings.cacheTranslations);
  updateSystemPromptTextarea();
  renderFallbackProviderSelect();
}

function updateSystemPromptTextarea() {
  const selectedStyle = translationStyleSelect.value;
  const customStyleConfig = customStylePromptConfigs[selectedStyle];
  const isCustom = Boolean(customStyleConfig);

  systemPromptTextarea.readOnly = !isCustom;
  systemPromptTextarea.classList.toggle("readonly", !isCustom);

  if (isCustom) {
    if (!settings[customStyleConfig.settingKey]) {
      settings[customStyleConfig.settingKey] = customStyleConfig.buildDefaultPrompt(settings.targetLanguage || getBrowserTargetLanguage());
    }
    systemPromptTextarea.value = extractStyleSystemPrompt(settings[customStyleConfig.settingKey]);
    return;
  }

  systemPromptTextarea.value = buildStyleSystemPrompt(selectedStyle);
}

function renderTargetLanguageSelect() {
  const selectedCode = settings.targetLanguage || getBrowserTargetLanguage();
  const languageOptions = [...TARGET_LANGUAGES];
  if (!languageOptions.some((language) => language.code === selectedCode)) {
    languageOptions.push({
      code: selectedCode,
      labels: {
        ko: `${t("customLanguage")} (${selectedCode})`,
        en: `${t("customLanguage")} (${selectedCode})`
      }
    });
  }

  targetLanguageSelect.innerHTML = languageOptions
    .map((language) => {
      const label = getTargetLanguageLabel(language, uiLanguage);
      return `<option value="${escapeHtml(language.code)}">${escapeHtml(label)} (${escapeHtml(language.code)})</option>`;
    })
    .join("");
  targetLanguageSelect.value = selectedCode;
}

function renderSubtitleStyleSettings() {
  const style = settings.subtitleStyle || {};
  renderFontPresetOptions();
  subtitleStyleInputs.fontSize.value = style.fontSize ?? 30;
  subtitleStyleInputs.fontFamily.value = style.fontPreset || "gangwon-moduche";
  if (!subtitleStyleInputs.fontFamily.value) {
    subtitleStyleInputs.fontFamily.value = "gangwon-moduche";
  }
  subtitleStyleInputs.customWebFontCss.value = style.customWebFontCss || DEFAULT_CUSTOM_WEB_FONT_CSS;
  subtitleStyleInputs.textColor.value = style.textColor || "#f2f2f2";
  subtitleStyleInputs.shadowEnabled.checked = Boolean(style.shadowEnabled);
  subtitleStyleInputs.shadowColor.value = style.shadowColor || "#000000";
  subtitleStyleInputs.shadowBlur.value = style.shadowBlur ?? 3;
  subtitleStyleInputs.shadowDistance.value = style.shadowDistance ?? 2;
  subtitleStyleInputs.outlineEnabled.checked = style.outlineEnabled ?? true;
  subtitleStyleInputs.outlineColor.value = style.outlineColor || "#000000";
  subtitleStyleInputs.outlineWidth.value = style.outlineWidth ?? 2;
  subtitleStyleInputs.backgroundColor.value = style.backgroundColor || "#000000";
  subtitleStyleInputs.pendingBackgroundColor.value = style.pendingBackgroundColor || "#750000";
  subtitleStyleInputs.backgroundOpacity.value = style.backgroundOpacity ?? 0.5;
  updateCustomWebFontVisibility();
  applySubtitlePreview();
}

function readProviderForm() {
  const provider = settings.providers[selectedProviderId];
  const fields = new FormData(providerForm);

  for (const [key, value] of fields.entries()) {
    if (key === "temperature") {
      provider[key] = Number(value);
    } else if (key === "maxTokens") {
      provider[key] = Number(value);
    } else if (key === "apiKey") {
      provider[key] = resolveSecretFieldValue(value, provider[key]);
    } else {
      provider[key] = String(value).trim();
    }
  }

  if (provider.id === "openrouter") {
    provider.nitro = fields.get("nitro") === "on";
    provider.model = withOpenRouterNitro(provider.model, provider.nitro);
  }
}

function renderProviderTabs() {
  providerTabs.innerHTML = "";

  for (const provider of getOrderedProviders(settings.providers)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = provider.label;
    button.classList.toggle("active", provider.id === selectedProviderId);
    button.classList.toggle("connection-success", getProviderTestStatus(provider.id) === "success");
    button.addEventListener("click", () => {
      scheduleAutomaticSave({ immediate: true });
      selectedProviderId = provider.id;
      renderProviderTabs();
      renderProviderForm();
    });
    providerTabs.append(button);
    if (provider.id === PROVIDER_TAB_SEPARATOR_AFTER_ID) {
      providerTabs.append(renderProviderTabSeparator());
    }
  }
}

function renderProviderTabSeparator() {
  const separator = document.createElement("span");
  separator.className = "provider-tab-separator";
  separator.setAttribute("aria-hidden", "true");
  separator.textContent = "|";
  return separator;
}

function canFetchModelsForProvider(provider) {
  return providerFieldDefs[provider.id]?.some((field) => field[3] === "model-select");
}

function withOpenRouterNitro(model, enabled) {
  const baseModel = String(model || "").trim().replace(/:nitro$/i, "");
  return enabled && baseModel ? `${baseModel}:nitro` : baseModel;
}

function renderOpenRouterNitroField(provider) {
  const wrapper = document.createElement("label");
  wrapper.className = "checkbox-field provider-nitro-field";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = "nitro";
  input.checked = provider.nitro !== false;

  input.addEventListener("change", () => {
    const modelSelect = providerForm.elements.model;
    if (!modelSelect) return;

    const nextModel = withOpenRouterNitro(modelSelect.value, input.checked);
    if (!Array.from(modelSelect.options).some((option) => option.value === nextModel)) {
      const option = document.createElement("option");
      option.value = nextModel;
      option.textContent = nextModel;
      modelSelect.prepend(option);
    }
    modelSelect.value = nextModel;
  });

  const text = document.createElement("span");
  text.textContent = t("openRouterNitro");
  wrapper.append(input, text);
  return wrapper;
}

function renderField(provider, [key, labelKey, placeholder, type = "text"]) {
  const wrapper = document.createElement("label");
  const labelText = document.createElement("span");
  labelText.textContent = t(labelKey);
  wrapper.append(labelText);
  const localizedPlaceholder = key === "model" ? t("modelExample", { model: placeholder }) : placeholder;

  if (type === "model-select") {
    const select = document.createElement("select");
    select.name = key;
    const models = Array.isArray(provider.models) ? provider.models : [];
    const currentModel = provider[key] || "";
    const options = currentModel && !models.some((model) => model.id === currentModel)
      ? [{ id: currentModel, label: currentModel }, ...models]
      : models;
    select.innerHTML = options.length
      ? options.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label || model.id)}</option>`).join("")
      : `<option value="${escapeHtml(currentModel)}">${escapeHtml(currentModel || localizedPlaceholder)}</option>`;
    select.value = currentModel;

    wrapper.append(select);
    return wrapper;
  }

  if (type === "select") {
    const select = document.createElement("select");
    select.name = key;
    const options = deepLPlanOptions;
    for (const [value, text] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    select.value = provider[key];
    wrapper.classList.add("wide");
    wrapper.append(select);
    return wrapper;
  }

  const input = document.createElement("input");
  input.name = key;
  input.type = key === "apiKey" ? "password" : type;
  input.placeholder = localizedPlaceholder;
  input.value = key === "apiKey" ? maskSecretValue(provider[key]) : (provider[key] ?? "");
  if (type === "number") {
    input.step = key === "temperature" ? "0.1" : "1";
    input.min = "0";
  }

  if (key === "apiKey" && canFetchModelsForProvider(provider)) {
    const row = document.createElement("div");
    row.className = "api-key-row";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost fetch-models-button";
    button.textContent = t("fetchModels");
    button.addEventListener("click", () => fetchModelsForSelectedProvider(button));

    row.append(input, button);
    wrapper.classList.add("wide");
    wrapper.append(row);
    return wrapper;
  }

  wrapper.append(input);
  return wrapper;
}

async function fetchModelsForSelectedProvider(button) {
  const permissionRequest = requestCustomLlmEndpointPermission(
    readProviderDraft(settings.providers[selectedProviderId])
  );
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = t("loadingModels");
  setStatus(t("loadingModels"));

  try {
    await permissionRequest;
    await flushAutomaticSave();
    readProviderForm();
    const provider = settings.providers[selectedProviderId];
    const response = await chrome.runtime.sendMessage({
      type: "llm.listModels",
      provider
    });
    if (!response?.ok) {
      throw new Error(response?.error || "Unknown error");
    }

    provider.models = Array.isArray(response.models) ? response.models : [];
    const recommendedModel = selectRecommendedModel(provider.id, provider.models);
    if (!recommendedModel) throw new Error("No usable models were returned.");
    provider.model = provider.id === "openrouter"
      ? withOpenRouterNitro(recommendedModel.id, provider.nitro !== false)
      : recommendedModel.id;
    updateProviderTestStatus(provider.id, "idle");
    settings = await saveSettings(settings);

    if (provider.id === "local") {
      renderGeneralSettings();
      renderProviderTabs();
      renderProviderForm();
      renderFallbackProviderSelect();
      setStatus(formatMessage("localModelSelected", {
        provider: provider.label,
        model: recommendedModel.label || recommendedModel.id,
        count: provider.models.length
      }), "success");
      return;
    }

    setStatus(formatMessage("recommendedModelTesting", {
      provider: provider.label,
      model: recommendedModel.label || recommendedModel.id
    }));

    let testResponse;
    try {
      testResponse = await chrome.runtime.sendMessage({
        type: "llm.testActiveProvider",
        providerId: provider.id
      });
    } catch (error) {
      testResponse = { ok: false, error: error.message };
    }
    updateProviderTestStatus(provider.id, testResponse?.ok ? "success" : "idle");
    settings = await saveSettings(settings);
    renderGeneralSettings();
    renderProviderTabs();
    renderProviderForm();
    renderFallbackProviderSelect();

    if (testResponse?.ok) {
      setStatus(formatMessage("modelsLoadedAndTested", {
        provider: provider.label,
        model: recommendedModel.label || recommendedModel.id,
        count: provider.models.length
      }), "success");
    } else {
      setStatus(formatMessage("modelsLoadedTestFailed", {
        provider: provider.label,
        model: recommendedModel.label || recommendedModel.id,
        error: testResponse?.error || "Unknown error"
      }), "error");
    }
  } catch (error) {
    setStatus(`${t("modelsLoadFailed")}: ${error.message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function renderProviderForm() {
  const provider = settings.providers[selectedProviderId];
  if (provider.id === "openrouter") {
    provider.model = withOpenRouterNitro(provider.model, provider.nitro !== false);
  }
  providerForm.innerHTML = "";

  providerForm.append(renderProviderGuide(provider.id));

  for (const field of providerFieldDefs[provider.id]) {
    providerForm.append(renderField(provider, field));
    if (provider.id === "openrouter" && field[0] === "model") {
      providerForm.append(renderOpenRouterNitroField(provider));
    }
  }

  if (provider.id === "local") {
    providerForm.append(renderLocalLlmCheck(provider));
  }
}

function readProviderDraft(provider) {
  const draft = { ...provider };
  for (const element of providerForm.elements || []) {
    if (element.name) {
      draft[element.name] = element.value;
    }
  }
  return draft;
}

function buildLocalChatCompletionsUrl(baseUrl) {
  const trimmed = String(baseUrl || "http://localhost:1234/v1").trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function buildLocalLlmCheckText(provider) {
  const draft = readProviderDraft(provider);
  const url = buildLocalChatCompletionsUrl(draft.baseUrl);
  const model = String(draft.model || "google/gemma-4-e4b").trim();
  const apiKey = String(draft.apiKey || "").trim();
  const authHeader = apiKey ? ` \\\n  -H "Authorization: Bearer \${API_KEY}"` : "";

  return [
    t("localLlmBaseUrlComment"),
    t("localLlmRequestUrl", { url }),
    `curl ${url} \\`,
    "  -H \"Content-Type: application/json\"" + authHeader + " \\",
    "  -d '{",
    `    "model": "${model}",`,
    "    \"messages\": [",
    "      { \"role\": \"system\", \"content\": \"Reply with only OK.\" },",
    "      { \"role\": \"user\", \"content\": \"Return OK if this Custom LLM endpoint works.\" }",
    "    ]",
    "  }'"
  ].join("\n");
}

function updateLocalLlmCheck() {
  const preview = providerForm.querySelector("[data-local-llm-check]");
  if (!preview || selectedProviderId !== "local") return;
  preview.textContent = buildLocalLlmCheckText(settings.providers.local);
}

function renderLocalLlmCheck(provider) {
  const wrapper = document.createElement("section");
  wrapper.className = "local-llm-check wide";

  const title = document.createElement("h3");
  title.textContent = t("localCheckTitle");

  const preview = document.createElement("pre");
  preview.className = "curl-preview";
  preview.dataset.localLlmCheck = "true";
  preview.textContent = buildLocalLlmCheckText(provider);

  wrapper.append(title, preview);
  return wrapper;
}

function requestCustomLlmEndpointPermission(provider) {
  try {
    const permissionOrigin = getCustomLlmPermissionOrigin(provider);
    if (!permissionOrigin || !chrome.permissions?.request) {
      return Promise.resolve();
    }
    return chrome.permissions.request({ origins: [permissionOrigin] }).then((granted) => {
      if (!granted) {
        throw new Error(t("customLlmPermissionDenied"));
      }
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

function renderProviderGuide(providerId) {
  const guide = getProviderGuide(providerId);
  const note = document.createElement("p");
  note.className = "provider-note";

  const text = document.createElement("span");
  text.textContent = guide.text;
  note.append(text);

  if (guide.links.length > 0) {
    const links = document.createElement("span");
    links.className = "provider-note-links";
    for (const link of guide.links) {
      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = link.label;
      links.append(anchor);
    }
    note.append(links);
  }

  return note;
}

function renderSimpleGoogleSettings() {
  simpleGoogleApiKeyInput.value = pendingSimpleGoogleApiKey ?? maskSecretValue(settings.providers.google.apiKey);
  simpleGoogleGuide.textContent = t("simpleGoogleIntroGuide");
  simpleGoogleGuideLinks.replaceChildren(...SIMPLE_GOOGLE_GUIDE_LINKS.map((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = t(link.labelKey);
    return anchor;
  }));
}

function prepareSimpleGoogleApiKey() {
  pendingSimpleGoogleApiKey = simpleGoogleApiKeyInput.value;
  pendingSimpleGoogleActiveBackup ??= captureActiveGoogleBackup(settings);
  const stagedSettings = stageSimpleGoogleApiKey(settings, pendingSimpleGoogleApiKey);

  setSimpleSettingsStatus(
    stagedSettings.providers.google.apiKey ? t("simpleGoogleApiKeyReady") : t("simpleGoogleApiKeyRequired"),
    stagedSettings.providers.google.apiKey ? "" : "error"
  );
}

function clearPendingSimpleGoogleApiKey() {
  simpleGoogleTestRunId += 1;
  pendingSimpleGoogleApiKey = null;
  pendingSimpleGoogleActiveBackup = null;
  setSimpleSettingsStatus("");
}

function updateBackupRestoreControlState() {
  const disabled = simpleGoogleTestInProgress || backupRestoreOperationDepth > 0;
  backupSettingsButton.disabled = disabled;
  restoreSettingsButton.disabled = disabled;
  restoreSettingsFileInput.disabled = disabled;
}

function beginBackupRestoreOperation() {
  backupRestoreOperationDepth += 1;
  updateBackupRestoreControlState();
}

function endBackupRestoreOperation() {
  backupRestoreOperationDepth = Math.max(0, backupRestoreOperationDepth - 1);
  updateBackupRestoreControlState();
}

function setSimpleGoogleTestControlsDisabled(disabled) {
  simpleGoogleTestInProgress = disabled;
  for (const control of simpleGoogleTestLockedControls) {
    control.disabled = disabled;
  }
  updateBackupRestoreControlState();
}

async function testSimpleGoogleApiKey() {
  const testRunId = ++simpleGoogleTestRunId;
  setSimpleGoogleTestControlsDisabled(true);
  try {
    await flushAutomaticSave();
    if (testRunId !== simpleGoogleTestRunId) return;

    const activeGoogleBackup = pendingSimpleGoogleActiveBackup ?? captureActiveGoogleBackup(settings);
    settings = stageSimpleGoogleApiKey(settings, pendingSimpleGoogleApiKey ?? simpleGoogleApiKeyInput.value);

    if (!settings.providers.google.apiKey) {
      settings = applySimpleGoogleTestResult(settings, false, activeGoogleBackup);
      settings = await saveSettings(settings);
      if (testRunId !== simpleGoogleTestRunId) return;
      pendingSimpleGoogleApiKey = null;
      pendingSimpleGoogleActiveBackup = null;
      renderAll();
      setSimpleSettingsStatus(t("simpleGoogleApiKeyRequired"), "error");
      return;
    }

    settings = await saveSettings(settings);
    if (testRunId !== simpleGoogleTestRunId) return;
    pendingSimpleGoogleApiKey = null;
    renderSimpleGoogleSettings();
    setSimpleSettingsStatus(t("simpleGoogleTesting"));
    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: "llm.testActiveProvider",
        providerId: "google"
      });
    } catch (error) {
      response = { ok: false, error: error.message };
    }
    if (testRunId !== simpleGoogleTestRunId) return;

    settings = applySimpleGoogleTestResult(settings, response?.ok, activeGoogleBackup);
    settings = await saveSettings(settings);
    if (testRunId !== simpleGoogleTestRunId) return;
    pendingSimpleGoogleActiveBackup = null;
    renderAll();
    setSimpleSettingsStatus(
      response?.ok
        ? t("simpleGoogleTestSuccess")
        : `${t("simpleGoogleTestFailed")}: ${response?.error || "Unknown error"}`,
      response?.ok ? "success" : "error"
    );
  } finally {
    setSimpleGoogleTestControlsDisabled(false);
  }
}

function captureCurrentFormState() {
  readGeneralSettings();
  readSubtitleStyleSettings();
  readProviderForm();
}

function stageAutomaticSave() {
  captureCurrentFormState();
  settingsRevision += 1;
  return {
    revision: settingsRevision,
    snapshot: clone(settings)
  };
}

function persistStagedSettings({ revision, snapshot }) {
  autoSaveChain = autoSaveChain.then(async () => {
    try {
      const savedSettings = await saveSettings(snapshot);
      if (revision === settingsRevision) settings = savedSettings;
      setStatus(t("saved"), "success");
    } catch (error) {
      setStatus(`${t("saveFailed")}: ${error.message}`, "error");
    }
  });
  return autoSaveChain;
}

function scheduleAutomaticSave({ immediate = false } = {}) {
  const staged = stageAutomaticSave();
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  pendingAutoSave = staged;
  if (immediate) {
    pendingAutoSave = null;
    return persistStagedSettings(staged);
  }
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    const pending = pendingAutoSave;
    pendingAutoSave = null;
    if (pending) persistStagedSettings(pending);
  }, AUTO_SAVE_DELAY_MS);
  return autoSaveChain;
}

function flushAutomaticSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  const pending = pendingAutoSave;
  pendingAutoSave = null;
  return pending ? persistStagedSettings(pending) : autoSaveChain;
}

async function persistSectionReset() {
  const currentProviderTab = selectedProviderId;
  settings = await saveSettings(settings);
  selectedProviderId = settings.providers[currentProviderTab] ? currentProviderTab : settings.activeProvider;
  renderAll();
  setStatus(t("sectionResetDone"), "success");
}

async function resetGeneralSettingsSection() {
  await flushAutomaticSave();
  captureCurrentFormState();
  Object.assign(settings, {
    activeProvider: DEFAULT_SETTINGS.activeProvider,
    targetLanguage: DEFAULT_SETTINGS.targetLanguage,
    translationStyle: DEFAULT_SETTINGS.translationStyle,
    customSystemPrompt: buildDefaultCustomStyleSystemPrompt(getBrowserTargetLanguage()),
    custom2SystemPrompt: DEFAULT_SETTINGS.custom2SystemPrompt,
    maxChunkDurationSeconds: DEFAULT_SETTINGS.maxChunkDurationSeconds,
    cacheTranslations: DEFAULT_SETTINGS.cacheTranslations
  });
  await persistSectionReset();
}

async function resetProviderSettingsSection() {
  await flushAutomaticSave();
  clearPendingSimpleGoogleApiKey();
  captureCurrentFormState();
  settings.providers = clone(DEFAULT_SETTINGS.providers);
  settings.providerTestStatus = clone(DEFAULT_SETTINGS.providerTestStatus);
  await persistSectionReset();
}

async function resetFallbackSettingsSection() {
  await flushAutomaticSave();
  captureCurrentFormState();
  settings.fallback = clone(DEFAULT_SETTINGS.fallback);
  await persistSectionReset();
}

async function resetSubtitleStyleSettingsSection() {
  await flushAutomaticSave();
  captureCurrentFormState();
  settings.subtitleStyle = clone(normalizeSettings().subtitleStyle);
  subtitleStylePreview.textContent = getDefaultPreviewText();
  await persistSectionReset();
}

async function testProvider() {
  const providerId = selectedProviderId;
  const permissionRequest = requestCustomLlmEndpointPermission(
    readProviderDraft(settings.providers[providerId])
  );
  await permissionRequest;
  await flushAutomaticSave();
  setStatus(t("testing"));

  const response = await chrome.runtime.sendMessage({
    type: "llm.testActiveProvider",
    providerId
  });
  if (!response?.ok) {
    await persistProviderTestStatus(providerId, "idle");
    setStatus(`${t("testFailed")}: ${response?.error || "Unknown error"}`, "error");
    return;
  }

  const text = response.result.text || "(empty response)";
  await persistProviderTestStatus(providerId, "success", { activate: true });
  setStatus(`${response.result.providerLabel} ${t("response")}: ${text}`, "success");
}

function renderAll() {
  renderPlatformSettings();
  renderGeneralSettings();
  renderSubtitleStyleSettings();
  renderProviderTabs();
  renderProviderForm();
  renderSimpleGoogleSettings();
}

function renderPlatformSettings() {
  for (const [platform, input] of Object.entries(platformToggleInputs)) {
    input.checked = settings.platforms?.[platform] !== false;
  }
}

async function init() {
  applyLocaleText();
  subtitleStylePreview.textContent = getDefaultPreviewText();
  settings = await getSettings();
  selectedProviderId = settings.activeProvider;
  renderAll();
  setSettingsMode("simple");

  simpleSettingsTab.addEventListener("click", () => setSettingsMode("simple"));
  advancedSettingsTab.addEventListener("click", () => setSettingsMode("advanced"));
  settingsModeTabs.addEventListener("keydown", handleSettingsModeTabsKeydown);
  simpleGoogleApiKeyInput.addEventListener("change", prepareSimpleGoogleApiKey);
  testSimpleGoogleApiKeyButton.addEventListener("click", () => {
    testSimpleGoogleApiKey().catch((error) => {
      pendingSimpleGoogleApiKey = null;
      pendingSimpleGoogleActiveBackup = null;
      setSimpleSettingsStatus(`${t("simpleGoogleTestFailed")}: ${error.message}`, "error");
    });
  });

  Object.values(subtitleStyleInputs).forEach((input) => {
    input.addEventListener("input", applySubtitlePreview);
    input.addEventListener("change", applySubtitlePreview);
  });
  activeProviderSelect.addEventListener("change", () => {
    scheduleAutomaticSave({ immediate: true });
  });
  targetLanguageSelect.addEventListener("change", () => {
    updateSystemPromptTextarea();
    scheduleAutomaticSave({ immediate: true });
  });
  translationStyleSelect.addEventListener("change", () => {
    updateSystemPromptTextarea();
    scheduleAutomaticSave({ immediate: true });
  });
  maxChunkDurationMinutesInput.addEventListener("input", () => {
    updateChunkDurationValue();
    scheduleAutomaticSave();
  });
  maxChunkDurationMinutesInput.addEventListener("change", () => {
    scheduleAutomaticSave({ immediate: true });
  });
  cacheTranslationsInput.addEventListener("change", () => {
    scheduleAutomaticSave({ immediate: true });
  });
  fallbackProviderSelect.addEventListener("change", () => {
    scheduleAutomaticSave({ immediate: true });
  });
  systemPromptTextarea.addEventListener("input", (event) => {
    if (!event.isComposing) scheduleAutomaticSave();
  });
  systemPromptTextarea.addEventListener("compositionend", () => {
    scheduleAutomaticSave();
  });
  systemPromptTextarea.addEventListener("blur", () => {
    flushAutomaticSave();
  });
  providerForm.addEventListener("input", (event) => {
    clearSelectedProviderTestStatus();
    readProviderForm();
    updateLocalLlmCheck();
    if (!event.isComposing) scheduleAutomaticSave();
  });
  providerForm.addEventListener("change", () => {
    clearSelectedProviderTestStatus();
    readProviderForm();
    updateLocalLlmCheck();
    scheduleAutomaticSave({ immediate: true });
  });
  providerForm.addEventListener("compositionend", () => {
    readProviderForm();
    updateLocalLlmCheck();
    scheduleAutomaticSave();
  });
  providerForm.addEventListener("focusout", () => {
    flushAutomaticSave();
  });
  Object.entries(platformToggleInputs).forEach(([platform, input]) => {
    input.addEventListener("change", () => {
      settings.platforms = {
        ...(settings.platforms || {}),
        [platform]: input.checked
      };
      scheduleAutomaticSave({ immediate: true });
    });
  });
  Object.values(subtitleStyleInputs).forEach((input) => {
    input.addEventListener("input", (event) => {
      if (!event.isComposing) scheduleAutomaticSave();
    });
    input.addEventListener("change", () => scheduleAutomaticSave({ immediate: true }));
    input.addEventListener("compositionend", () => scheduleAutomaticSave());
    input.addEventListener("focusout", () => flushAutomaticSave());
  });
  backupSeedInput.addEventListener("input", () => {
    backupSeedInput.setCustomValidity("");
    backupSeedConfirmationInput.setCustomValidity("");
    if (backupStatusLine.classList.contains("error")) setBackupStatus("");
  });
  backupSeedConfirmationInput.addEventListener("input", () => {
    backupSeedConfirmationInput.setCustomValidity("");
    if (backupStatusLine.classList.contains("error")) setBackupStatus("");
  });
  backupPasswordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const password = getValidatedBackupSeed();
    if (password) settleBackupPassword(password);
  });
  cancelBackupPasswordButton.addEventListener("click", () => settleBackupPassword(null));
  backupPasswordDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    settleBackupPassword(null);
  });
  backupSettingsButton.addEventListener("click", backupCurrentSettings);
  restoreSettingsButton.addEventListener("click", () => {
    chooseSettingsBackupFile().catch((error) => {
      setBackupStatus(`${t("restoreFailed")}: ${getLocalizedBackupError(error)}`, "error");
    });
  });
  restoreSettingsFileInput.addEventListener("change", () => {
    restoreSettingsFromFile(restoreSettingsFileInput.files?.[0]).catch((error) => {
      setBackupStatus(`${t("restoreFailed")}: ${getLocalizedBackupError(error)}`, "error");
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAutomaticSave();
  });

  testProviderButton.addEventListener("click", () => {
    testProvider().catch(async (error) => {
      await persistProviderTestStatus(selectedProviderId, "idle");
      setStatus(`${t("testFailed")}: ${error.message}`, "error");
    });
  });
  document.getElementById("resetSettings").addEventListener("click", async () => {
    clearPendingSimpleGoogleApiKey();
    settings = await resetSettings();
    selectedProviderId = settings.activeProvider;
    renderAll();
    setStatus(t("resetDone"), "success");
  });
  document.getElementById("resetGeneralSettings").addEventListener("click", () => {
    resetGeneralSettingsSection().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("resetProviderSettings").addEventListener("click", () => {
    resetProviderSettingsSection().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("resetFallbackSettings").addEventListener("click", () => {
    resetFallbackSettingsSection().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("resetSubtitleStyleSettings").addEventListener("click", () => {
    resetSubtitleStyleSettingsSection().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("clearCache").addEventListener("click", async () => {
    const response = await chrome.runtime.sendMessage({ type: "translation.clearCache" });
    if (!response?.ok) {
      setStatus(`${t("cacheClearFailed")}: ${response?.error || "Unknown error"}`, "error");
      return;
    }
    setStatus(t("cacheCleared"), "success");
  });
}

init().catch((error) => setStatus(`${t("loadFailed")}: ${error.message}`, "error"));
