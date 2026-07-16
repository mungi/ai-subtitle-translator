import { buildDefaultCustom2StyleSystemPrompt, buildDefaultCustomStyleSystemPrompt, DEFAULT_SETTINGS, extractStyleSystemPrompt, PROVIDERS, WEB_FONT_PRESETS } from "./defaults.js";
import { clearEncryptedProviderSecrets, readEncryptedProviderSecrets, writeEncryptedProviderSecrets } from "./secret-storage.js";

const SETTINGS_KEY = "llmSettings";
const MIN_CHUNK_DURATION_SECONDS = 2 * 60;
const MAX_CHUNK_DURATION_SECONDS = 15 * 60;

function collectProviderSecrets(settings = {}) {
  return Object.fromEntries(Object.entries(settings.providers || {})
    .filter(([, provider]) => typeof provider?.apiKey === "string" && provider.apiKey.length > 0)
    .map(([id, provider]) => [id, provider.apiKey]));
}

function hasProviderSecretFields(settings = {}) {
  return Object.values(settings.providers || {}).some((provider) => Object.hasOwn(provider || {}, "apiKey"));
}

function omitProviderSecrets(settings = {}) {
  return {
    ...settings,
    providers: Object.fromEntries(Object.entries(settings.providers || {}).map(([id, provider]) => {
      const { apiKey: _apiKey, ...publicProvider } = provider || {};
      return [id, publicProvider];
    }))
  };
}

function applyProviderSecrets(settings, secrets = {}) {
  for (const [id, provider] of Object.entries(settings.providers || {})) {
    provider.apiKey = secrets[id] || "";
  }
  return settings;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultSettingsForUiLanguage() {
  const defaults = clone(DEFAULT_SETTINGS);
  const uiLanguage = getBrowserTargetLanguage();
  defaults.customSystemPrompt = buildDefaultCustomStyleSystemPrompt(uiLanguage);
  if (uiLanguage === "ja") {
    const notoSansJp = WEB_FONT_PRESETS.find((preset) => preset.id === "noto-sans-jp");
    defaults.subtitleStyle.fontPreset = notoSansJp.id;
    defaults.subtitleStyle.fontFamily = notoSansJp.fontFamily;
    defaults.subtitleStyle.webFontCss = notoSansJp.css;
  } else if (uiLanguage !== "ko") {
    defaults.subtitleStyle.fontPreset = "system-arial";
    defaults.subtitleStyle.fontFamily = "Arial, sans-serif";
    defaults.subtitleStyle.webFontCss = "";
  }
  return defaults;
}

function mergeProvider(defaultProvider, storedProvider = {}) {
  const provider = {
    ...defaultProvider,
    ...storedProvider,
    id: defaultProvider.id,
    label: defaultProvider.label
  };
  if (Number(storedProvider.maxTokens) === 4096) {
    provider.maxTokens = defaultProvider.maxTokens;
  }
  return provider;
}

function isConfiguredProviderAvailable(provider, providerTestStatus = {}) {
  return provider?.apiStyle === "google-translate"
    || providerTestStatus[provider?.id] === "success";
}

function normalizeChunkDurationSeconds(value, fallback) {
  const seconds = Number(value);
  const resolved = Number.isFinite(seconds) && seconds > 0 ? seconds : fallback;
  return Math.min(MAX_CHUNK_DURATION_SECONDS, Math.max(MIN_CHUNK_DURATION_SECONDS, resolved));
}

export function getBrowserTargetLanguage() {
  const language = globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || "ko";
  const normalized = String(language).trim();
  if (!normalized) return "ko";
  if (/^zh-(cn|hans)$/i.test(normalized)) return "zh-CN";
  if (/^zh-(tw|hk|hant)$/i.test(normalized)) return "zh-TW";
  return normalized.split("-")[0].toLowerCase();
}

export function normalizeSettings(settings = {}) {
  const defaults = getDefaultSettingsForUiLanguage();
  const targetLanguage = settings.targetLanguage || defaults.targetLanguage || getBrowserTargetLanguage();
  const providers = {};

  for (const [id, provider] of Object.entries(PROVIDERS)) {
    providers[id] = mergeProvider(provider, settings.providers?.[id]);
  }

  const providerTestStatus = {};
  for (const id of Object.keys(providers)) {
    if (settings.providerTestStatus?.[id] === "success") {
      providerTestStatus[id] = "success";
    }
  }
  const fallback = {
    ...defaults.fallback,
    ...settings.fallback
  };
  const fallbackProvider = providers[fallback.providerId];
  const fallbackProviderAvailable = fallbackProvider?.apiStyle === "google-translate"
    || fallbackProvider?.apiStyle === "deepl" && providerTestStatus[fallbackProvider.id] === "success";
  if (!fallbackProviderAvailable) {
    fallback.providerId = defaults.fallback.providerId;
  }
  const requestedActiveProvider = providers[settings.activeProvider];
  const activeProvider = isConfiguredProviderAvailable(requestedActiveProvider, providerTestStatus)
    ? requestedActiveProvider.id
    : defaults.activeProvider;

  return {
    ...defaults,
    ...settings,
    platforms: {
      ...defaults.platforms,
      ...settings.platforms
    },
    fallback,
    subtitleStyle: {
      ...defaults.subtitleStyle,
      ...settings.subtitleStyle
    },
    providers,
    providerTestStatus,
    maxChunkDurationSeconds: normalizeChunkDurationSeconds(settings.maxChunkDurationSeconds, defaults.maxChunkDurationSeconds),
    targetLanguage,
    activeProvider,
    customSystemPrompt: extractStyleSystemPrompt(settings.customSystemPrompt || defaults.customSystemPrompt || buildDefaultCustomStyleSystemPrompt(targetLanguage)),
    custom2SystemPrompt: extractStyleSystemPrompt(settings.custom2SystemPrompt || defaults.custom2SystemPrompt || buildDefaultCustom2StyleSystemPrompt())
  };
}

export async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const rawSettings = stored[SETTINGS_KEY] || {};
  const plaintextSecrets = collectProviderSecrets(rawSettings);
  let encryptedSecrets = await readEncryptedProviderSecrets();

  if (Object.keys(plaintextSecrets).length > 0) {
    encryptedSecrets = { ...encryptedSecrets, ...plaintextSecrets };
    await writeEncryptedProviderSecrets(encryptedSecrets);
  }
  if (hasProviderSecretFields(rawSettings)) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: omitProviderSecrets(rawSettings) });
  }

  return applyProviderSecrets(
    normalizeSettings(omitProviderSecrets(rawSettings)),
    encryptedSecrets
  );
}

export async function getPublicSettings() {
  return omitProviderSecrets(await getSettings());
}

export async function restrictLocalStorageAccess(storageArea = chrome.storage.local) {
  await storageArea.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

export async function updateSubtitleStyleSettings(patch) {
  const settings = await getSettings();
  settings.subtitleStyle = {
    ...(settings.subtitleStyle || {}),
    ...patch
  };
  return omitProviderSecrets(await saveSettings(settings));
}

export async function saveSettings(settings) {
  const normalized = normalizeSettings(settings);
  await writeEncryptedProviderSecrets(collectProviderSecrets(normalized));
  await chrome.storage.local.set({ [SETTINGS_KEY]: omitProviderSecrets(normalized) });
  return normalized;
}

export async function resetSettings() {
  const normalized = normalizeSettings();
  await clearEncryptedProviderSecrets();
  await chrome.storage.local.set({ [SETTINGS_KEY]: omitProviderSecrets(normalized) });
  return normalized;
}

export const storageInternals = {
  collectProviderSecrets,
  hasProviderSecretFields,
  omitProviderSecrets,
  applyProviderSecrets
};
