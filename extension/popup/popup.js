import { getSettings, saveSettings } from "../shared/storage.js";
import { getExtensionUiLanguage, getMessage } from "../shared/i18n.js";

let settings;

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

async function savePlatformToggle(platform, enabled) {
  settings.platforms[platform] = enabled;
  settings = await saveSettings(settings);
  document.getElementById("statusLine").textContent = t("popupSaved");
}

async function init() {
  applyLocaleText();
  settings = await getSettings();
  const provider = settings.providers[settings.activeProvider];

  document.getElementById("providerName").textContent = provider.label;
  document.getElementById("targetLanguage").textContent = settings.targetLanguage;
  document.getElementById("toggleUdemy").checked = Boolean(settings.platforms.udemy);
  document.getElementById("toggleYoutube").checked = Boolean(settings.platforms.youtube);
  document.getElementById("toggleUdemy").addEventListener("change", (event) => {
    savePlatformToggle("udemy", event.target.checked);
  });
  document.getElementById("toggleYoutube").addEventListener("change", (event) => {
    savePlatformToggle("youtube", event.target.checked);
  });
  document.getElementById("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

init().catch((error) => {
  document.getElementById("statusLine").textContent = t("popupLoadFailed", [error.message]);
});
