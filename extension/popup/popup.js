import { getSettings } from "../shared/storage.js";
import { getExtensionUiLanguage, getMessage } from "../shared/i18n.js";
import { getTargetLanguageLabel, TARGET_LANGUAGES } from "../shared/defaults.js";

let settings;
const STYLE_MESSAGE_KEYS = {
  natural: "styleNatural",
  lecture: "styleLecture",
  technical: "styleTechnical",
  custom: "styleCustom",
  custom2: "styleCustom2"
};

function t(key, substitutions) {
  return getMessage(key, substitutions);
}

function applyLocaleText() {
  document.documentElement.lang = chrome.i18n.getMessage("@@ui_locale") || getExtensionUiLanguage();
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

function formatTargetLanguage(code) {
  const languageCode = String(code || "");
  const language = TARGET_LANGUAGES.find((item) => item.code === languageCode);
  const label = language
    ? getTargetLanguageLabel(language, getExtensionUiLanguage())
    : `${t("customLanguage")} (${languageCode})`;
  return `${label} (${languageCode})`;
}

function formatTranslationStyle(style) {
  return t(STYLE_MESSAGE_KEYS[style] || "styleNatural").split(/\s+-\s+/, 1)[0];
}

async function init() {
  applyLocaleText();
  const toggle = document.getElementById("subtitleEnabled");
  const preference = await chrome.runtime.sendMessage({ type: "settings.getSubtitleEnabled" });
  if (!preference?.ok) throw new Error(preference?.error || "Could not load subtitle state.");
  toggle.checked = preference.enabled;
  toggle.disabled = false;
  toggle.addEventListener("change", async () => {
    const enabled = toggle.checked;
    toggle.disabled = true;
    document.getElementById("statusLine").textContent = "";
    try {
      const response = await chrome.runtime.sendMessage({ type: "settings.setSubtitleEnabled", enabled });
      if (!response?.ok) throw new Error(response?.error || "Could not save subtitle state.");
    } catch (error) {
      toggle.checked = !enabled;
      document.getElementById("statusLine").textContent = t("popupLoadFailed", [error.message]);
    } finally {
      toggle.disabled = false;
    }
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.subtitleEnabled) toggle.checked = changes.subtitleEnabled.newValue !== false;
  });
  settings = await getSettings();
  const provider = settings.providers[settings.activeProvider];

  document.getElementById("providerName").textContent = provider.label;
  document.getElementById("targetLanguage").textContent = formatTargetLanguage(settings.targetLanguage);
  document.getElementById("translationStyle").textContent = formatTranslationStyle(settings.translationStyle);
  document.getElementById("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

init().catch((error) => {
  document.getElementById("statusLine").textContent = t("popupLoadFailed", [error.message]);
});
