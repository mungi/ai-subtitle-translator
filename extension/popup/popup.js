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
  return t(STYLE_MESSAGE_KEYS[style] || "styleNatural");
}

async function init() {
  applyLocaleText();
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
