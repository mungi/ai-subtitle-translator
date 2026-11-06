import { buildDefaultCustom2StyleSystemPrompt, buildDefaultCustomStyleSystemPrompt, buildStyleSystemPrompt, DEFAULT_CUSTOM_WEB_FONT_CSS, getDeepLEndpoint, DEFAULT_SETTINGS, extractStyleSystemPrompt, getTargetLanguageLabel, getWebFontPresetLabel, normalizeCustomStyleLabel, normalizeLlmParallelRequests, normalizeSummarySystemPrompt, DEFAULT_SUMMARY_SYSTEM_PROMPT, TARGET_LANGUAGES, TRANSLATION_STYLES, WEB_FONT_PRESETS } from "../shared/defaults.js";
import { getProviderGuide } from "../shared/provider-guides.js";
import { getConfiguredKeyProviders, validateConfiguredProviderKeys } from "../shared/provider-key-validation.js";
import { selectRecommendedModel } from "../shared/model-recommendations.js";
import { getOrderedProviders, PROVIDER_TAB_SEPARATOR_AFTER_ID } from "../shared/provider-order.js";
import { maskSecretValue, resolveSecretFieldValue } from "../shared/secret-fields.js";
import { SIMPLE_GOOGLE_GUIDE_LINKS, stageSimpleGoogleApiKey, captureActiveGoogleBackup, applySimpleGoogleTestResult } from "../shared/simple-google-settings.js";
import { createEncryptedSettingsBackup, decryptSettingsBackup, settingsBackupInternals, validateBackupSeed } from "../shared/settings-backup.js";
import { getExtensionUiLanguage, getMessage } from "../shared/i18n.js";
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
  reasoningSettingDetected: ["mode"],
  providerTestStep: ["current", "total", "step"],
  contextLengthDetected: ["tokens", "source"],
  durationMinutes: ["minutes"],
  localFontsLoaded: ["count"],
  localLlmRequestUrl: ["url"],
  modelExample: ["model"]
};

const customStylePromptConfigs = {
  custom: {
    settingKey: "customSystemPrompt",
    labelSettingKey: "customStyleLabel",
    buildDefaultPrompt: buildDefaultCustomStyleSystemPrompt
  },
  custom2: {
    settingKey: "custom2SystemPrompt",
    labelSettingKey: "custom2StyleLabel",
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

// The player menu saves these on its own (dragging or resizing the subtitle box, the translation
// position, provider, language, style and display choices). This page keeps the copy it loaded, so
// a save here would put the old values back. A value this page did not change is taken from storage.
const PLAYER_OWNED_SETTING_PATHS = [
  ["activeProvider"],
  ["targetLanguage"],
  ["translationStyle"],
  ["subtitleDisplayMode"],
  ["preferYoutubeProvidedTranslation"],
  ["wordProgressHighlight"],
  ["sourceCaptionLanguages"],
  ["subtitleStyle", "positionX"],
  ["subtitleStyle", "positionY"],
  ["subtitleStyle", "width"],
  ["subtitleStyle", "translationOnTop"]
];
let lastSavedPlayerOwnedValues = null;

function readSettingPath(source, path) {
  return path.reduce((value, key) => value?.[key], source);
}

function writeSettingPath(target, path, value) {
  const parent = path.slice(0, -1).reduce((node, key) => {
    if (!node[key] || typeof node[key] !== "object") node[key] = {};
    return node[key];
  }, target);
  parent[path.at(-1)] = value === undefined ? undefined : clone(value);
}

function rememberPlayerOwnedValues(savedSettings) {
  lastSavedPlayerOwnedValues = PLAYER_OWNED_SETTING_PATHS.map((path) => JSON.stringify(readSettingPath(savedSettings, path)));
}

async function adoptPlayerOwnedChanges(next) {
  if (!lastSavedPlayerOwnedValues) return;
  let stored;
  try {
    stored = await getSettings();
  } catch {
    return; // Saving still works; it just cannot keep the player's newer values this time.
  }
  const adoptedKeys = new Set();
  PLAYER_OWNED_SETTING_PATHS.forEach((path, index) => {
    const lastSaved = lastSavedPlayerOwnedValues[index];
    const storedValue = readSettingPath(stored, path);
    if (JSON.stringify(readSettingPath(next, path)) !== lastSaved) return; // changed on this page
    if (JSON.stringify(storedValue) === lastSaved) return; // not changed elsewhere
    writeSettingPath(next, path, storedValue);
    if (next !== settings) writeSettingPath(settings, path, storedValue);
    adoptedKeys.add(path.at(-1));
  });
  // The form must show the adopted values, or the next save would read the old ones back from it.
  // Only those controls are touched, so text being typed elsewhere on the page is left alone.
  if (adoptedKeys.has("activeProvider") && [...activeProviderSelect.options].some((option) => option.value === settings.activeProvider)) {
    activeProviderSelect.value = settings.activeProvider;
  }
  if (adoptedKeys.has("targetLanguage")) renderTargetLanguageSelect();
  if (adoptedKeys.has("translationStyle")) {
    translationStyleSelect.value = settings.translationStyle;
    updateSystemPromptTextarea();
  }
  if (adoptedKeys.has("preferYoutubeProvidedTranslation")) {
    preferYoutubeProvidedTranslationInput.checked = settings.preferYoutubeProvidedTranslation !== false;
  }
  if (adoptedKeys.has("wordProgressHighlight")) wordProgressHighlightInput.checked = settings.wordProgressHighlight !== false;
  if (adoptedKeys.has("translationOnTop")) {
    subtitleStyleInputs.translationOnTop.checked = settings.subtitleStyle?.translationOnTop === true;
    applySubtitlePreview();
  }
}

async function saveOptionsSettings(next) {
  await adoptPlayerOwnedChanges(next);
  const savedSettings = await saveSettings(next);
  rememberPlayerOwnedValues(savedSettings);
  return savedSettings;
}

function getDefaultPreviewText() {
  return t("previewText");
}

const providerFieldDefs = {
  googleTranslate: [
    ["baseUrl", "fieldBaseUrl", "https://translate.googleapis.com/translate_a/t"]
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
    ["maxTokens", "fieldMaxOutputTokens", "16384", "number"]
  ],
  anthropic: [
    ["apiKey", "fieldApiKey", "sk-ant-..."],
    ["model", "fieldModel", "claude-sonnet-4-5", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://api.anthropic.com"],
    ["anthropicVersion", "fieldAnthropicVersion", "2023-06-01"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "16384", "number"]
  ],
  google: [
    ["apiKey", "fieldApiKey", "AIza..."],
    ["model", "fieldModel", "gemini-2.5-flash", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://generativelanguage.googleapis.com/v1beta"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "16384", "number"]
  ],
  openrouter: [
    ["apiKey", "fieldApiKey", "sk-or-..."],
    ["model", "fieldModel", "openai/gpt-5-mini", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://openrouter.ai/api/v1"],
    ["siteUrl", "fieldHttpReferer", "https://example.com"],
    ["appTitle", "fieldXTitle", "AST - AI Subtitle Translator"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "16384", "number"]
  ],
  nvidiaNim: [
    ["apiKey", "fieldApiKey", "nvapi-..."],
    ["model", "fieldModel", "openai/gpt-oss-120b", "model-select"],
    ["baseUrl", "fieldBaseUrl", "https://integrate.api.nvidia.com/v1"],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "16384", "number"]
  ],
  local: [
    ["model", "fieldModel", "google/gemma-4-e4b", "model-select"],
    ["baseUrl", "fieldBaseUrl", "http://localhost:1234/v1"],
    ["apiKey", "fieldApiKeyOptional", ""],
    ["temperature", "fieldTemperature", "0.2", "number"],
    ["maxTokens", "fieldMaxOutputTokens", "16384", "number"]
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
const customStyleLabelInput = document.getElementById("customStyleLabel");
const summarySystemPromptTextarea = document.getElementById("summarySystemPrompt");
const maxChunkDurationMinutesInput = document.getElementById("maxChunkDurationMinutes");
const llmParallelRequestsInput = document.getElementById("llmParallelRequests");
const maxChunkDurationValue = document.getElementById("maxChunkDurationValue");
const cacheTranslationsInput = document.getElementById("cacheTranslations");
const preferYoutubeProvidedTranslationInput = document.getElementById("preferYoutubeProvidedTranslation");
const phraseSegmentationInput = document.getElementById("phraseSegmentation");
const phraseSegmentationSkipYoutubeManualInput = document.getElementById("phraseSegmentationSkipYoutubeManual");
const wordProgressHighlightInput = document.getElementById("wordProgressHighlight");
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
const simpleGoogleApiKeyVisibilityButton = document.getElementById("toggleSimpleGoogleApiKeyVisibility");
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
const extensionVersion = document.getElementById("extensionVersion");
const simpleGoogleTestLockedControls = [
  simpleGoogleApiKeyInput,
  simpleGoogleApiKeyVisibilityButton,
  testSimpleGoogleApiKeyButton,
  document.getElementById("resetSettings"),
  document.getElementById("resetGeneralSettings"),
  document.getElementById("resetProviderSettings"),
  document.getElementById("resetSummarySettings"),
  document.getElementById("resetSubtitleStyleSettings")
];
const platformToggleInputs = {
  udemy: document.getElementById("toggleUdemy"),
  youtube: document.getElementById("toggleYoutube"),
  ted: document.getElementById("toggleTed"),
  nvidia: document.getElementById("toggleNvidia"),
  vimeo: document.getElementById("toggleVimeo")
};
let backupPasswordResolver = null;
let backupPasswordMode = "backup";
const subtitleStylePreview = document.getElementById("subtitleStylePreview");
const subtitleSourcePreview = document.getElementById("subtitleSourcePreview");
const customWebFontField = document.getElementById("customWebFontField");
const sourceCustomWebFontField = document.getElementById("sourceCustomWebFontField");
const sourceCustomWebFontGuide = document.getElementById("sourceCustomWebFontGuide");
const customWebFontGuide = document.getElementById("customWebFontGuide");
const customPreviewFontStyle = document.createElement("style");
customPreviewFontStyle.id = "ast-custom-preview-font";
document.head.append(customPreviewFontStyle);
const subtitleStyleInputs = {
  fontSize: document.getElementById("subtitleFontSize"),
  fontFamily: document.getElementById("subtitleFontFamily"),
  customWebFontCss: document.getElementById("subtitleCustomWebFontCss"),
  localFont: document.getElementById("subtitleLocalFont"),
  sourceLocalFont: document.getElementById("subtitleSourceLocalFont"),
  fontWeight: document.getElementById("subtitleFontWeight"),
  sourceFontWeight: document.getElementById("subtitleSourceFontWeight"),
  sourceFontSize: document.getElementById("subtitleSourceFontSize"),
  sourceFontFamily: document.getElementById("subtitleSourceFontFamily"),
  sourceTextColor: document.getElementById("subtitleSourceTextColor"),
  sourceCustomWebFontCss: document.getElementById("subtitleSourceCustomWebFontCss"),
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
  backgroundOpacity: document.getElementById("subtitleBackgroundOpacity"),
  translationOnTop: document.getElementById("subtitleTranslationOnTop")
};
const subtitleBackgroundOpacityValue = document.getElementById("subtitleBackgroundOpacityValue");

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

function renderExtensionVersion() {
  const version = chrome.runtime.getManifest().version;
  extensionVersion.textContent = `v${version}`;
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
  const settingsMode = isSimple ? "simple" : "advanced";
  if (settings.settingsMode !== settingsMode) {
    settings.settingsMode = settingsMode;
    scheduleAutomaticSave({ immediate: true });
  }
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
    testProvider: async (providerId) => {
      const response = await chrome.runtime.sendMessage({
        type: "llm.testActiveProvider",
        providerId
      });
      applyReasoningProfileFromTestResponse(providerId, response);
      return response;
    },
    onProgress: ({ provider, current, total }) => {
      setBackupStatus(formatMessage("restoreTestingKey", {
        current,
        total,
        provider: provider.label
      }));
    }
  });

  settings.providerTestStatus = result.providerTestStatus;
  settings = await saveOptionsSettings(settings);
  renderGeneralSettings();
  renderProviderTabs();
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
    rememberPlayerOwnedValues(settings);
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
        description: "AST - AI Subtitle Translator settings backup",
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
  settings = await saveOptionsSettings(settings);
  renderGeneralSettings();
  renderProviderTabs();
}

function applyReasoningProfileFromTestResponse(providerId, response) {
  const profile = response?.ok && response.result?.reasoningProfile;
  const provider = settings.providers?.[providerId];
  if (profile && provider) provider.reasoningProfile = profile;
  // Custom LLM only: the context size found by this test, or null when the server did not say.
  if (response?.ok && provider && Object.hasOwn(response.result || {}, "contextProfile")) {
    provider.contextProfile = response.result.contextProfile || null;
  }
}

function getDetectedContextStatus(response) {
  if (!Object.hasOwn(response?.result || {}, "contextProfile")) return "";
  const profile = response.result.contextProfile;
  if (!profile?.contextLength) return t("contextLengthUnknown");
  return formatMessage("contextLengthDetected", {
    tokens: Number(profile.contextLength).toLocaleString(uiLanguage),
    source: t(profile.source === "loaded" ? "contextLengthSourceLoaded" : "contextLengthSourceMax")
  });
}

const PROVIDER_TEST_STEP_MESSAGE_KEYS = {
  reply: "providerTestStepReply",
  models: "providerTestStepModels",
  lmStudio: "providerTestStepLmStudio",
  ollama: "providerTestStepOllama"
};
let providerTestInProgressId = "";

// Progress the background sends while the connection test runs; shown on the status line under the button.
function showProviderTestProgress(message) {
  if (message?.type !== "llm.testProgress" || !providerTestInProgressId || message.providerId !== providerTestInProgressId) return;
  const stepKey = PROVIDER_TEST_STEP_MESSAGE_KEYS[message.step];
  if (!stepKey) return;
  setStatus(formatMessage("providerTestStep", { current: message.index, total: message.total, step: t(stepKey) }));
}

function getDetectedReasoningStatus(response) {
  const mode = response?.result?.reasoningProfile?.mode;
  if (!mode) return "";
  if (mode === "omit") {
    const acceptedOption = response.result.reasoningProfile.measurements
      ?.some((measurement) => measurement.mode !== "omit" && measurement.valid);
    return acceptedOption ? "" : t("reasoningSettingUnsupported");
  }
  return formatMessage("reasoningSettingDetected", {
    mode: mode.startsWith("budget:") ? `thinkingBudget=${mode.slice(7)}` : mode
  });
}

function clearSelectedProviderTestStatus() {
  updateProviderTestStatus(selectedProviderId, "idle");
  renderGeneralSettings();
  renderProviderTabs();
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

function buildPreviewTextShadow(style, outlineShadows = []) {
  const shadows = [...outlineShadows];
  if (style.shadowEnabled) {
    const distance = clampNumber(style.shadowDistance, 0, 12, 2);
    const blur = clampNumber(style.shadowBlur, 0, 20, 3);
    shadows.push(`${distance}px ${distance}px ${blur}px ${style.shadowColor || "#000000"}`);
  }
  return shadows.length ? shadows.join(", ") : "none";
}

// Same rounded outline as the player overlay (content-script.js buildOutlineShadows): a thin stroke
// plus rings of sharp shadows, so thick outlines do not spike at the corners of V, W and N.
const OUTLINE_STROKE_MAX_PX = 2;

function buildPreviewOutlineShadows(width, color, fontSize) {
  const radius = width / 2;
  const inner = Math.min(width, OUTLINE_STROKE_MAX_PX) / 2;
  if (!(radius > inner)) return [];
  const spacing = Math.max(0.75, fontSize * 0.05, radius / 8);
  const shadows = [];
  for (let ring = radius; ring > inner; ring -= spacing) {
    const count = Math.max(8, Math.ceil(2 * Math.PI * ring / spacing));
    for (let index = 0; index < count; index += 1) {
      const angle = 2 * Math.PI * index / count;
      shadows.push(`${(ring * Math.cos(angle)).toFixed(2)}px ${(ring * Math.sin(angle)).toFixed(2)}px 0 ${color}`);
    }
  }
  return shadows;
}

function extractFontFamilyFromCss(css) {
  const match = String(css || "").match(/font-family\s*:\s*([^;]+);/i);
  const fontFamily = match?.[1]?.trim();
  if (!fontFamily) return "Arial, sans-serif";
  if (fontFamily.includes(",")) return fontFamily;
  return `${fontFamily}, Arial, sans-serif`;
}

// The source and translation lines each have a font; the original font fields belong to the translation.
const fontSlots = {
  translation: {
    select: subtitleStyleInputs.fontFamily,
    customCss: subtitleStyleInputs.customWebFontCss,
    customField: customWebFontField,
    guide: customWebFontGuide,
    localSelect: subtitleStyleInputs.localFont,
    localField: document.getElementById("translationLocalFontField"),
    localButton: document.getElementById("translationLoadLocalFonts"),
    localStatus: document.getElementById("translationLocalFontStatus"),
    weightInput: subtitleStyleInputs.fontWeight,
    weightValue: document.getElementById("subtitleFontWeightValue"),
    keys: { fontPreset: "fontPreset", fontFamily: "fontFamily", webFontCss: "webFontCss", customWebFontCss: "customWebFontCss", localFontName: "localFontName" }
  },
  source: {
    select: subtitleStyleInputs.sourceFontFamily,
    customCss: subtitleStyleInputs.sourceCustomWebFontCss,
    customField: sourceCustomWebFontField,
    guide: sourceCustomWebFontGuide,
    localSelect: subtitleStyleInputs.sourceLocalFont,
    localField: document.getElementById("sourceLocalFontField"),
    localButton: document.getElementById("sourceLoadLocalFonts"),
    localStatus: document.getElementById("sourceLocalFontStatus"),
    weightInput: subtitleStyleInputs.sourceFontWeight,
    weightValue: document.getElementById("subtitleSourceFontWeightValue"),
    keys: { fontPreset: "sourceFontPreset", fontFamily: "sourceFontFamily", webFontCss: "sourceWebFontCss", customWebFontCss: "sourceCustomWebFontCss", localFontName: "sourceLocalFontName" }
  }
};

// Fonts installed on this PC are listed through Chrome's Local Font Access API, which asks once
// for permission. Where it is missing or refused, the built-in fonts above stay the choice.
const LOCAL_FONT_PRESET = "local";
const canListLocalFonts = typeof globalThis.queryLocalFonts === "function";
let localFontFamilies = null;

// Every weight from 100 to 900 can be chosen; how a font draws each one is judged in the preview,
// since fonts differ in the weights they have and the browser fills gaps with the nearest one.
const FONT_WEIGHT_NAMES = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };

function updateFontWeightLabels() {
  for (const slot of Object.values(fontSlots)) {
    const weight = Number(slot.weightInput.value) || 700;
    slot.weightValue.textContent = `${weight} ${FONT_WEIGHT_NAMES[weight] || ""}`.trim();
  }
}

// The chosen font goes first; if another PC does not have it, the subtitle falls back to Arial.
function getLocalFontFamily(name) {
  return name ? `"${name.replace(/["\\]/g, "\\$&")}", Arial, sans-serif` : "Arial, sans-serif";
}

function renderLocalFontOptions(slot, selectedName = slot.localSelect.value) {
  const names = localFontFamilies ? [...localFontFamilies] : [];
  if (selectedName && !names.includes(selectedName)) names.unshift(selectedName);
  slot.localSelect.innerHTML = [
    `<option value="">${escapeHtml(t("localFontPlaceholder"))}</option>`,
    ...names.map((name) => `<option value="${escapeHtml(name)}" style="font-family: ${escapeHtml(getLocalFontFamily(name))}">${escapeHtml(name)}</option>`)
  ].join("");
  slot.localSelect.value = selectedName || "";
}

async function loadLocalFonts(slot) {
  try {
    const fonts = await globalThis.queryLocalFonts();
    localFontFamilies = [...new Set(fonts.map((font) => font.family).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, uiLanguage));
    for (const item of Object.values(fontSlots)) {
      renderLocalFontOptions(item);
      item.localStatus.textContent = t("localFontsLoaded", { count: localFontFamilies.length });
      item.localStatus.classList.remove("error");
    }
  } catch (error) {
    console.warn("[AST] Could not list local fonts:", error?.message || error);
    slot.localStatus.textContent = t("localFontsUnavailable");
    slot.localStatus.classList.add("error");
  }
}

function getFontSettingsFromInputs(slot) {
  const presetId = slot.select.value;
  const customWebFontCss = slot.customCss.value.trim() || DEFAULT_CUSTOM_WEB_FONT_CSS;
  const localFontName = slot.localSelect.value;
  if (presetId === "custom") {
    return {
      fontPreset: "custom",
      fontFamily: extractFontFamilyFromCss(customWebFontCss),
      webFontCss: customWebFontCss,
      customWebFontCss,
      localFontName
    };
  }
  if (presetId === LOCAL_FONT_PRESET) {
    return {
      fontPreset: LOCAL_FONT_PRESET,
      fontFamily: getLocalFontFamily(localFontName),
      webFontCss: "",
      customWebFontCss,
      localFontName
    };
  }

  const preset = WEB_FONT_PRESETS.find((item) => item.id === presetId) || WEB_FONT_PRESETS[0];
  return {
    fontPreset: preset.id,
    fontFamily: preset.fontFamily,
    webFontCss: preset.css,
    customWebFontCss,
    localFontName
  };
}

function readFontSlots() {
  const values = {};
  for (const slot of Object.values(fontSlots)) {
    const font = getFontSettingsFromInputs(slot);
    for (const [name, key] of Object.entries(slot.keys)) values[key] = font[name];
  }
  return values;
}

function renderFontPresetOptions(style = settings.subtitleStyle || {}) {
  // A local font saved earlier stays selectable even where the list cannot be loaded.
  const showLocal = canListLocalFonts || Object.values(fontSlots).some((slot) => style[slot.keys.fontPreset] === LOCAL_FONT_PRESET);
  const options = [
    ...WEB_FONT_PRESETS.map((preset) => `<option value="${preset.id}">${escapeHtml(getWebFontPresetLabel(preset, uiLanguage))}</option>`),
    // The two options that open extra fields stand out from the font names in bold.
    ...(showLocal ? [`<option value="${LOCAL_FONT_PRESET}" class="font-option-special">${escapeHtml(t("localFontOption"))}</option>`] : []),
    `<option value="custom" class="font-option-special">${t("customWebFontSettings")}</option>`
  ].join("");
  for (const slot of Object.values(fontSlots)) slot.select.innerHTML = options;
}

function updateCustomWebFontVisibility() {
  for (const slot of Object.values(fontSlots)) {
    const isCustom = slot.select.value === "custom";
    slot.customField.classList.toggle("hidden", !isCustom);
    slot.guide.classList.toggle("hidden", !isCustom);
    slot.localField.classList.toggle("hidden", slot.select.value !== LOCAL_FONT_PRESET);
    slot.localButton.hidden = !canListLocalFonts;
  }
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
    settings[customStyleConfig.labelSettingKey] = normalizeCustomStyleLabel(customStyleLabelInput.value);
  }
  settings.maxChunkDurationSeconds = getChunkDurationMinutes() * 60;
  settings.llmParallelRequests = normalizeLlmParallelRequests(llmParallelRequestsInput.value);
  settings.cacheTranslations = cacheTranslationsInput.checked;
  settings.preferYoutubeProvidedTranslation = preferYoutubeProvidedTranslationInput.checked;
  settings.phraseSegmentation = phraseSegmentationInput.checked;
  settings.phraseSegmentationSkipYoutubeManual = phraseSegmentationSkipYoutubeManualInput.checked;
  settings.wordProgressHighlight = wordProgressHighlightInput.checked;
  settings.summarySystemPrompt = normalizeSummarySystemPrompt(summarySystemPromptTextarea.value);
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
  settings.subtitleStyle = {
    ...(settings.subtitleStyle || {}),
    fontSize: Number(subtitleStyleInputs.fontSize.value || 30),
    sourceFontSize: Number(subtitleStyleInputs.sourceFontSize.value || 28),
    sourceTextColor: subtitleStyleInputs.sourceTextColor.value,
    ...readFontSlots(),
    textColor: subtitleStyleInputs.textColor.value,
    fontWeight: Number(subtitleStyleInputs.fontWeight.value) || 700,
    sourceFontWeight: Number(subtitleStyleInputs.sourceFontWeight.value) || 400,
    shadowEnabled: subtitleStyleInputs.shadowEnabled.checked,
    shadowColor: subtitleStyleInputs.shadowColor.value,
    shadowBlur: Number(subtitleStyleInputs.shadowBlur.value || 0),
    shadowDistance: Number(subtitleStyleInputs.shadowDistance.value || 0),
    outlineEnabled: subtitleStyleInputs.outlineEnabled.checked,
    outlineColor: subtitleStyleInputs.outlineColor.value,
    outlineWidth: Number(subtitleStyleInputs.outlineWidth.value || 0),
    backgroundColor: subtitleStyleInputs.backgroundColor.value,
    pendingBackgroundColor: subtitleStyleInputs.pendingBackgroundColor.value,
    backgroundOpacity: Number(subtitleStyleInputs.backgroundOpacity.value || 0),
    translationOnTop: subtitleStyleInputs.translationOnTop.checked
  };
}

function applySubtitlePreview() {
  updateFontWeightLabels();
  readSubtitleStyleSettings();
  const style = settings.subtitleStyle || {};
  updateCustomWebFontVisibility();
  customPreviewFontStyle.textContent = [...new Set([style.webFontCss, style.sourceWebFontCss].filter(Boolean))].join("\n")
    .replaceAll(
      "__AST_GOWUN_BATANG_FONT_URL__",
      chrome.runtime.getURL("assets/fonts/gowun-batang-regular.woff")
    )
    .replaceAll(
      "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2108@1.1/GowunBatang-Regular.woff",
      chrome.runtime.getURL("assets/fonts/gowun-batang-regular.woff")
    );
  subtitleStylePreview.style.fontSize = `${clampNumber(style.fontSize, 10, 64, 30)}px`;
  subtitleStylePreview.style.fontFamily = style.fontFamily || "Arial, sans-serif";
  subtitleStylePreview.style.color = style.textColor || "#e2ffad";
  subtitleStylePreview.style.fontWeight = String(clampNumber(style.fontWeight, 100, 900, 700));
  const outlineWidth = clampNumber(style.outlineWidth, 0, 16, 2);
  const outlineEnabled = style.outlineEnabled ?? true;
  const outlineColor = style.outlineColor || "#000000";
  subtitleStylePreview.style.textShadow = buildPreviewTextShadow(style, outlineEnabled
    ? buildPreviewOutlineShadows(outlineWidth, outlineColor, clampNumber(style.fontSize, 10, 64, 30))
    : []);
  subtitleStylePreview.style.webkitTextStroke = outlineEnabled
    ? `${Math.min(outlineWidth, OUTLINE_STROKE_MAX_PX)}px ${outlineColor}`
    : "0 transparent";
  subtitleStylePreview.style.paintOrder = "stroke fill";
  // Both lines share one background box, as in the player overlay.
  const backgroundOpacity = clampNumber(style.backgroundOpacity, 0, 1, 0.8);
  subtitleStylePreview.parentElement.style.background = `rgba(${hexToRgb(style.backgroundColor)}, ${backgroundOpacity})`;
  subtitleBackgroundOpacityValue.textContent = `${Math.round(backgroundOpacity * 100)}%`;
  // The source line shares every style except its size, color and font.
  subtitleSourcePreview.style.cssText = subtitleStylePreview.style.cssText;
  subtitleSourcePreview.style.fontFamily = style.sourceFontFamily || style.fontFamily || "Arial, sans-serif";
  subtitleSourcePreview.style.fontSize = `${clampNumber(style.sourceFontSize ?? style.fontSize, 10, 64, 30)}px`;
  subtitleSourcePreview.style.color = style.sourceTextColor || "#f2f2f2";
  subtitleSourcePreview.style.fontWeight = String(clampNumber(style.sourceFontWeight, 100, 900, 400));
  // Grid order moves the source line below the translation without touching the editable element.
  subtitleSourcePreview.style.order = style.translationOnTop ? "1" : "";
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
  llmParallelRequestsInput.value = normalizeLlmParallelRequests(settings.llmParallelRequests);
  cacheTranslationsInput.checked = Boolean(settings.cacheTranslations);
  preferYoutubeProvidedTranslationInput.checked = settings.preferYoutubeProvidedTranslation !== false;
  phraseSegmentationInput.checked = settings.phraseSegmentation !== false;
  phraseSegmentationSkipYoutubeManualInput.checked = settings.phraseSegmentationSkipYoutubeManual === true;
  // The YouTube exception only matters while phrase segmentation is on.
  phraseSegmentationSkipYoutubeManualInput.disabled = !phraseSegmentationInput.checked;
  wordProgressHighlightInput.checked = settings.wordProgressHighlight !== false;
  updateSystemPromptTextarea();
  summarySystemPromptTextarea.value = normalizeSummarySystemPrompt(settings.summarySystemPrompt);
}

function updateSystemPromptTextarea() {
  const selectedStyle = translationStyleSelect.value;
  const customStyleConfig = customStylePromptConfigs[selectedStyle];
  const isCustom = Boolean(customStyleConfig);

  systemPromptTextarea.readOnly = !isCustom;
  systemPromptTextarea.classList.toggle("readonly", !isCustom);
  // The label only belongs to Custom 1/2; for the other styles the box stays visible but off and empty.
  customStyleLabelInput.disabled = !isCustom;
  customStyleLabelInput.value = isCustom ? normalizeCustomStyleLabel(settings[customStyleConfig.labelSettingKey]) : "";

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
      return `<option dir="auto" value="${escapeHtml(language.code)}">${escapeHtml(label)} (${escapeHtml(language.code)})</option>`;
    })
    .join("");
  targetLanguageSelect.value = selectedCode;
}

function renderSubtitleStyleSettings() {
  const style = settings.subtitleStyle || {};
  renderFontPresetOptions();
  subtitleStyleInputs.fontSize.value = style.fontSize ?? 30;
  subtitleStyleInputs.sourceFontSize.value = style.sourceFontSize ?? 28;
  subtitleStyleInputs.sourceTextColor.value = style.sourceTextColor || "#f2f2f2";
  for (const slot of Object.values(fontSlots)) {
    slot.select.value = style[slot.keys.fontPreset] || style.fontPreset || "gangwon-moduche";
    if (!slot.select.value) slot.select.value = "gangwon-moduche";
    slot.customCss.value = style[slot.keys.customWebFontCss] || DEFAULT_CUSTOM_WEB_FONT_CSS;
    renderLocalFontOptions(slot, style[slot.keys.localFontName] || "");
  }
  subtitleStyleInputs.textColor.value = style.textColor || "#e2ffad";
  subtitleStyleInputs.fontWeight.value = style.fontWeight ?? 700;
  subtitleStyleInputs.sourceFontWeight.value = style.sourceFontWeight ?? 400;
  subtitleStyleInputs.shadowEnabled.checked = Boolean(style.shadowEnabled);
  subtitleStyleInputs.shadowColor.value = style.shadowColor || "#000000";
  subtitleStyleInputs.shadowBlur.value = style.shadowBlur ?? 3;
  subtitleStyleInputs.shadowDistance.value = style.shadowDistance ?? 2;
  subtitleStyleInputs.outlineEnabled.checked = style.outlineEnabled ?? true;
  subtitleStyleInputs.outlineColor.value = style.outlineColor || "#000000";
  subtitleStyleInputs.outlineWidth.value = style.outlineWidth ?? 2;
  subtitleStyleInputs.backgroundColor.value = style.backgroundColor || "#000000";
  subtitleStyleInputs.pendingBackgroundColor.value = style.pendingBackgroundColor || "#750000";
  subtitleStyleInputs.backgroundOpacity.value = style.backgroundOpacity ?? 0.8;
  subtitleStyleInputs.translationOnTop.checked = style.translationOnTop === true;
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

  if (provider.apiStyle === "deepl") {
    provider.baseUrl = getDeepLEndpoint(provider.plan);
    const baseUrlInput = providerForm.elements.namedItem("baseUrl");
    if (baseUrlInput) baseUrlInput.value = provider.baseUrl;
  }
}

function renderProviderTabs() {
  providerTabs.innerHTML = "";

  for (const provider of getOrderedProviders(settings.providers)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = provider.label;
    button.classList.toggle("active", provider.id === selectedProviderId);
    // Google Translate needs no key or test, so it is always shown as connected.
    button.classList.toggle("connection-success", isActiveProviderAvailable(provider));
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

function createSecretVisibilityIcon(revealed) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const eye = document.createElementNS("http://www.w3.org/2000/svg", "path");
  eye.setAttribute("d", "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z");
  svg.append(eye);

  const pupil = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  pupil.setAttribute("cx", "12");
  pupil.setAttribute("cy", "12");
  pupil.setAttribute("r", "2.5");
  svg.append(pupil);

  if (revealed) {
    const slash = document.createElementNS("http://www.w3.org/2000/svg", "path");
    slash.setAttribute("d", "M4 4l16 16");
    svg.append(slash);
  }

  return svg;
}

function setSecretVisibility(input, button, revealed) {
  input.type = revealed ? "text" : "password";
  button.setAttribute("aria-pressed", String(revealed));
  const accessibleLabel = t(revealed ? "hideApiKey" : "showApiKey");
  button.setAttribute("aria-label", accessibleLabel);
  button.title = accessibleLabel;
  button.replaceChildren(createSecretVisibilityIcon(revealed));
}

function bindSecretVisibilityButton(input, button) {
  setSecretVisibility(input, button, false);
  button.addEventListener("click", () => {
    const revealed = button.getAttribute("aria-pressed") !== "true";
    setSecretVisibility(input, button, revealed);
    input.focus();
  });
}

function createSecretInputControl(input) {
  const control = document.createElement("div");
  control.className = "secret-input-control";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "secret-visibility-button";
  bindSecretVisibilityButton(input, button);

  control.append(input, button);
  return control;
}

function renderField(provider, [key, labelKey, placeholder, type = "text"]) {
  const isApiKey = key === "apiKey";
  let inputId = "";
  const wrapper = document.createElement(isApiKey ? "div" : "label");
  const labelText = document.createElement(isApiKey ? "label" : "span");
  labelText.textContent = t(labelKey);
  if (isApiKey) {
    inputId = `provider-${provider.id}-api-key`;
    labelText.htmlFor = inputId;
    labelText.className = "field-label";
    wrapper.classList.add("secret-field");
  }
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
  input.type = isApiKey ? "password" : type;
  input.placeholder = localizedPlaceholder;
  input.value = isApiKey ? maskSecretValue(provider[key]) : (provider[key] ?? "");
  if (isApiKey) {
    input.id = inputId;
    input.className = "api-key-input";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
  }
  if (type === "number") {
    input.step = key === "temperature" ? "0.1" : "1";
    input.min = "0";
  }
  // Hosted providers use a fixed endpoint; only a local server can listen on another port.
  if (key === "baseUrl" && provider.id !== "local") {
    if (provider.apiStyle === "deepl") input.value = getDeepLEndpoint(provider.plan);
    input.readOnly = true;
    input.classList.add("readonly");
  }

  if (isApiKey && canFetchModelsForProvider(provider)) {
    const row = document.createElement("div");
    row.className = "api-key-row";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost fetch-models-button";
    button.textContent = t("fetchModels");
    button.addEventListener("click", () => fetchModelsForSelectedProvider(button));

    row.append(createSecretInputControl(input), button);
    wrapper.classList.add("wide");
    wrapper.append(row);
    return wrapper;
  }

  wrapper.append(isApiKey ? createSecretInputControl(input) : input);
  return wrapper;
}

async function fetchModelsForSelectedProvider(button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = t("loadingModels");
  setStatus(t("loadingModels"));

  try {
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
    settings = await saveOptionsSettings(settings);

    if (provider.id === "local") {
      renderGeneralSettings();
      renderProviderTabs();
      renderProviderForm();
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
    providerTestInProgressId = provider.id;
    try {
      testResponse = await chrome.runtime.sendMessage({
        type: "llm.testActiveProvider",
        providerId: provider.id
      });
    } catch (error) {
      testResponse = { ok: false, error: error.message };
    } finally {
      providerTestInProgressId = "";
    }
    applyReasoningProfileFromTestResponse(provider.id, testResponse);
    updateProviderTestStatus(provider.id, testResponse?.ok ? "success" : "idle");
    settings = await saveOptionsSettings(settings);
    renderGeneralSettings();
    renderProviderTabs();
    renderProviderForm();

    if (testResponse?.ok) {
      const status = formatMessage("modelsLoadedAndTested", {
        provider: provider.label,
        model: recommendedModel.label || recommendedModel.id,
        count: provider.models.length
      });
      setStatus([status, getDetectedReasoningStatus(testResponse), getDetectedContextStatus(testResponse)].filter(Boolean).join(" · "), "success");
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
  setSecretVisibility(simpleGoogleApiKeyInput, simpleGoogleApiKeyVisibilityButton, false);
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
      settings = await saveOptionsSettings(settings);
      if (testRunId !== simpleGoogleTestRunId) return;
      pendingSimpleGoogleApiKey = null;
      pendingSimpleGoogleActiveBackup = null;
      renderAll();
      setSimpleSettingsStatus(t("simpleGoogleApiKeyRequired"), "error");
      return;
    }

    settings = await saveOptionsSettings(settings);
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

    applyReasoningProfileFromTestResponse("google", response);
    settings = applySimpleGoogleTestResult(settings, response?.ok, activeGoogleBackup);
    settings = await saveOptionsSettings(settings);
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
      const savedSettings = await saveOptionsSettings(snapshot);
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
  settings = await saveOptionsSettings(settings);
  selectedProviderId = settings.providers[currentProviderTab] ? currentProviderTab : settings.activeProvider;
  renderAll();
  setStatus(t("sectionResetDone"), "success");
}

async function resetAllSettings() {
  if (!globalThis.confirm(t("resetAllConfirm"))) return;
  await flushAutomaticSave();
  clearPendingSimpleGoogleApiKey();
  settings = await resetSettings();
  rememberPlayerOwnedValues(settings);
  selectedProviderId = settings.activeProvider;
  renderAll();
  setStatus(t("resetDone"), "success");
}

async function resetGeneralSettingsSection() {
  if (!globalThis.confirm(t("resetGeneralConfirm"))) return;
  await flushAutomaticSave();
  captureCurrentFormState();
  Object.assign(settings, {
    activeProvider: DEFAULT_SETTINGS.activeProvider,
    targetLanguage: DEFAULT_SETTINGS.targetLanguage,
    translationStyle: DEFAULT_SETTINGS.translationStyle,
    customSystemPrompt: buildDefaultCustomStyleSystemPrompt(getBrowserTargetLanguage()),
    custom2SystemPrompt: DEFAULT_SETTINGS.custom2SystemPrompt,
    customStyleLabel: DEFAULT_SETTINGS.customStyleLabel,
    custom2StyleLabel: DEFAULT_SETTINGS.custom2StyleLabel,
    maxChunkDurationSeconds: DEFAULT_SETTINGS.maxChunkDurationSeconds,
    llmParallelRequests: DEFAULT_SETTINGS.llmParallelRequests,
    cacheTranslations: DEFAULT_SETTINGS.cacheTranslations,
    preferYoutubeProvidedTranslation: DEFAULT_SETTINGS.preferYoutubeProvidedTranslation,
    phraseSegmentation: DEFAULT_SETTINGS.phraseSegmentation,
    phraseSegmentationSkipYoutubeManual: DEFAULT_SETTINGS.phraseSegmentationSkipYoutubeManual,
    wordProgressHighlight: DEFAULT_SETTINGS.wordProgressHighlight
  });
  await persistSectionReset();
}

async function resetProviderSettingsSection() {
  if (!globalThis.confirm(t("resetProvidersConfirm"))) return;
  await flushAutomaticSave();
  clearPendingSimpleGoogleApiKey();
  captureCurrentFormState();
  settings.providers = clone(DEFAULT_SETTINGS.providers);
  settings.providerTestStatus = clone(DEFAULT_SETTINGS.providerTestStatus);
  await persistSectionReset();
}

async function resetSummarySettingsSection() {
  if (!globalThis.confirm(t("resetSummaryConfirm"))) return;
  await flushAutomaticSave();
  captureCurrentFormState();
  settings.summarySystemPrompt = DEFAULT_SUMMARY_SYSTEM_PROMPT;
  await persistSectionReset();
}

async function resetSubtitleStyleSettingsSection() {
  if (!globalThis.confirm(t("resetSubtitleStyleConfirm"))) return;
  await flushAutomaticSave();
  captureCurrentFormState();
  settings.subtitleStyle = clone(normalizeSettings().subtitleStyle);
  subtitleStylePreview.textContent = getDefaultPreviewText();
  subtitleSourcePreview.textContent = t("sourcePreviewText");
  await persistSectionReset();
}

async function testProvider() {
  const providerId = selectedProviderId;
  await flushAutomaticSave();
  setStatus(t("testing"));

  providerTestInProgressId = providerId;
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "llm.testActiveProvider",
      providerId
    });
  } finally {
    providerTestInProgressId = "";
  }
  if (!response?.ok) {
    await persistProviderTestStatus(providerId, "idle");
    setStatus(`${t("testFailed")}: ${response?.error || "Unknown error"}`, "error");
    return;
  }

  const text = response.result.text || "(empty response)";
  applyReasoningProfileFromTestResponse(providerId, response);
  await persistProviderTestStatus(providerId, "success", { activate: true });
  setStatus([
    `${response.result.providerLabel} ${t("response")}: ${text}`,
    getDetectedReasoningStatus(response),
    getDetectedContextStatus(response)
  ].filter(Boolean).join(" · "), "success");
}

function renderAll() {
  renderPlatformSettings();
  renderGeneralSettings();
  renderSubtitleStyleSettings();
  renderProviderTabs();
  renderProviderForm();
  renderSimpleGoogleSettings();
  setSettingsMode(settings.settingsMode);
}

function renderPlatformSettings() {
  for (const [platform, input] of Object.entries(platformToggleInputs)) {
    input.checked = settings.platforms?.[platform] !== false;
  }
}

async function init() {
  applyLocaleText();
  renderExtensionVersion();
  bindSecretVisibilityButton(simpleGoogleApiKeyInput, simpleGoogleApiKeyVisibilityButton);
  subtitleStylePreview.textContent = getDefaultPreviewText();
  subtitleSourcePreview.textContent = t("sourcePreviewText");
  settings = await getSettings();
  rememberPlayerOwnedValues(settings);
  selectedProviderId = settings.activeProvider;
  renderAll();
  chrome.runtime.onMessage?.addListener?.(showProviderTestProgress);

  simpleSettingsTab.addEventListener("click", () => setSettingsMode("simple"));
  advancedSettingsTab.addEventListener("click", () => setSettingsMode("advanced"));
  document.getElementById("openAdvancedSettingsGuide").addEventListener("click", (event) => {
    event.preventDefault();
    setSettingsMode("advanced");
    advancedSettingsTab.focus();
  });
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
  for (const slot of Object.values(fontSlots)) {
    // Chrome asks for the font permission only on a click, so the list loads on request.
    slot.localButton.addEventListener("click", () => loadLocalFonts(slot));
  }
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
  llmParallelRequestsInput.addEventListener("change", () => {
    llmParallelRequestsInput.value = normalizeLlmParallelRequests(llmParallelRequestsInput.value);
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
  preferYoutubeProvidedTranslationInput.addEventListener("change", () => {
    scheduleAutomaticSave({ immediate: true });
  });
  phraseSegmentationInput.addEventListener("change", () => {
    phraseSegmentationSkipYoutubeManualInput.disabled = !phraseSegmentationInput.checked;
    scheduleAutomaticSave({ immediate: true });
  });
  for (const input of [phraseSegmentationSkipYoutubeManualInput, wordProgressHighlightInput]) {
    input.addEventListener("change", () => {
      scheduleAutomaticSave({ immediate: true });
    });
  }
  customStyleLabelInput.addEventListener("input", (event) => {
    if (!event.isComposing) scheduleAutomaticSave();
  });
  customStyleLabelInput.addEventListener("compositionend", () => {
    scheduleAutomaticSave();
  });
  customStyleLabelInput.addEventListener("blur", () => {
    flushAutomaticSave();
  });
  summarySystemPromptTextarea.addEventListener("input", (event) => {
    if (!event.isComposing) scheduleAutomaticSave();
  });
  summarySystemPromptTextarea.addEventListener("compositionend", () => {
    scheduleAutomaticSave();
  });
  summarySystemPromptTextarea.addEventListener("blur", () => {
    flushAutomaticSave();
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
  document.getElementById("resetSettings").addEventListener("click", () => {
    resetAllSettings().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("resetGeneralSettings").addEventListener("click", () => {
    resetGeneralSettingsSection().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("resetProviderSettings").addEventListener("click", () => {
    resetProviderSettingsSection().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("resetSummarySettings").addEventListener("click", () => {
    resetSummarySettingsSection().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("resetSubtitleStyleSettings").addEventListener("click", () => {
    resetSubtitleStyleSettingsSection().catch((error) => setStatus(`${t("saveFailed")}: ${error.message}`, "error"));
  });
  document.getElementById("clearCache").addEventListener("click", async () => {
    if (!globalThis.confirm(t("clearCacheConfirm"))) return;
    const response = await chrome.runtime.sendMessage({ type: "translation.clearCache" });
    if (!response?.ok) {
      setStatus(`${t("cacheClearFailed")}: ${response?.error || "Unknown error"}`, "error");
      return;
    }
    setStatus(t("cacheCleared"), "success");
  });
}

init().catch((error) => setStatus(`${t("loadFailed")}: ${error.message}`, "error"));
