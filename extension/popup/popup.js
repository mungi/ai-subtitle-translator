import { getSettings } from "../shared/storage.js";
import { getExtensionUiLanguage, getMessage } from "../shared/i18n.js";
import { getTargetLanguageLabel, TARGET_LANGUAGES } from "../shared/defaults.js";
import { describeSiteForUrl } from "../shared/platform-urls.js";

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

// Same as the player menu: a custom style shows the name the user gave it, in brackets.
function formatTranslationStyle(style, currentSettings = {}) {
  const customLabel = style === "custom" ? currentSettings.customStyleLabel
    : style === "custom2" ? currentSettings.custom2StyleLabel : "";
  if (typeof customLabel === "string" && customLabel.trim()) return `[${customLabel.trim()}]`;
  return t(STYLE_MESSAGE_KEYS[style] || "styleNatural").split(/\s+-\s+/, 1)[0];
}

let activeTabUrl = "";

async function getActiveTabUrl() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return String(tab?.url || "");
  } catch {
    return "";
  }
}

async function sendSettingsMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Could not save the setting.");
  return response.settings;
}

// The generic player itself is turned on or off in settings; the popup only adds or removes the site.
function renderGenericAndSiteSwitches(currentSettings) {
  const site = describeSiteForUrl(activeTabUrl, currentSettings || {});

  // A supported site: the switch turns that platform on or off.
  const row = document.getElementById("siteToggleRow");
  row.hidden = site.kind !== "dedicated";
  if (site.kind === "dedicated") {
    const siteToggle = document.getElementById("siteEnabled");
    siteToggle.checked = site.active;
    siteToggle.disabled = false;
    document.getElementById("siteToggleNote").textContent = t("popupSiteDedicatedNote", [site.host, site.platform.label]);
  }

  // Any other site: add it to, or remove it from, the generic player list. With the generic
  // player turned off in settings, the row is not shown at all.
  const genericRow = document.getElementById("genericSiteRow");
  genericRow.hidden = site.kind !== "generic" || !site.genericEnabled;
  if (!genericRow.hidden) {
    const button = document.getElementById("genericSiteButton");
    document.getElementById("genericSiteHost").textContent = site.host;
    document.getElementById("genericSiteNote").textContent = t(site.listed ? "popupGenericListed" : "popupGenericNotListed");
    button.textContent = t(site.listed ? "popupGenericRemove" : "popupGenericAdd");
    button.setAttribute("aria-label", t(site.listed ? "popupGenericRemoveLabel" : "popupGenericAddLabel", [site.host]));
    button.classList.toggle("is-remove", site.listed);
    button.disabled = false;
  }
}

function bindSwitch(input, save) {
  input.addEventListener("change", async () => {
    const checked = input.checked;
    input.disabled = true;
    document.getElementById("statusLine").textContent = "";
    try {
      settings = await save(checked) || settings;
    } catch (error) {
      input.checked = !checked;
      document.getElementById("statusLine").textContent = t("popupLoadFailed", [error.message]);
    } finally {
      renderGenericAndSiteSwitches(settings);
    }
  });
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
  activeTabUrl = await getActiveTabUrl();
  renderGenericAndSiteSwitches(settings);
  bindSwitch(document.getElementById("siteEnabled"), (enabled) => {
    const site = describeSiteForUrl(activeTabUrl, settings);
    return sendSettingsMessage({ type: "settings.setPlatformEnabled", platform: site.platform.id, enabled });
  });
  const genericSiteButton = document.getElementById("genericSiteButton");
  genericSiteButton.addEventListener("click", async () => {
    const site = describeSiteForUrl(activeTabUrl, settings);
    if (site.kind !== "generic") return;
    genericSiteButton.disabled = true;
    document.getElementById("statusLine").textContent = "";
    try {
      settings = await sendSettingsMessage({ type: "settings.setGenericSiteAllowed", host: site.host, allowed: !site.listed }) || settings;
    } catch (error) {
      document.getElementById("statusLine").textContent = t("popupLoadFailed", [error.message]);
    } finally {
      renderGenericAndSiteSwitches(settings);
    }
  });
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local" || !changes.llmSettings) return;
    settings = await getSettings();
    renderGenericAndSiteSwitches(settings);
  });
  const provider = settings.providers[settings.activeProvider];

  document.getElementById("providerName").textContent = provider.label;
  document.getElementById("targetLanguage").textContent = formatTargetLanguage(settings.targetLanguage);
  document.getElementById("translationStyle").textContent = formatTranslationStyle(settings.translationStyle, settings);
  document.getElementById("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

init().catch((error) => {
  document.getElementById("statusLine").textContent = t("popupLoadFailed", [error.message]);
});
