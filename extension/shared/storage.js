import { buildDefaultCustom2StyleSystemPrompt, buildDefaultCustomStyleSystemPrompt, DEFAULT_SETTINGS, extractStyleSystemPrompt, getTargetLanguageLabel, normalizeCustomStyleLabel, normalizeLlmParallelRequests, normalizeSummarySystemPrompt, PROVIDERS, TARGET_LANGUAGES, WEB_FONT_PRESETS } from "./defaults.js";
import { clearEncryptedProviderSecrets, readEncryptedProviderSecrets, writeEncryptedProviderSecrets } from "./secret-storage.js";
import { normalizeGenericHosts } from "./platform-urls.js";
import { CUSTOM_HEADER_SECRET_SUFFIX, CUSTOM_LLM_PROVIDER_ID, normalizeCustomHeaders, normalizeJsonMode, normalizeReasoningEffort } from "./custom-llm-options.js";

const SETTINGS_KEY = "llmSettings";
const MIN_CHUNK_DURATION_SECONDS = 2 * 60;
const MAX_CHUNK_DURATION_SECONDS = 15 * 60;

// Custom LLM header values can be tokens, so they are kept in the encrypted vault like API keys,
// as one JSON record per provider ("local:headers"); the settings keep only the header names.
function hasHeaderValues(provider) {
  return Array.isArray(provider?.customHeaders)
    && provider.customHeaders.some((header) => typeof header?.value === "string" && header.value.length > 0);
}

function collectProviderSecrets(settings = {}) {
  const secrets = {};
  for (const [id, provider] of Object.entries(settings.providers || {})) {
    if (typeof provider?.apiKey === "string" && provider.apiKey.length > 0) secrets[id] = provider.apiKey;
    if (hasHeaderValues(provider)) {
      secrets[`${id}${CUSTOM_HEADER_SECRET_SUFFIX}`] = JSON.stringify(provider.customHeaders.map((header) => String(header?.value ?? "")));
    }
  }
  return secrets;
}

function hasProviderSecretFields(settings = {}) {
  return Object.values(settings.providers || {}).some((provider) => Object.hasOwn(provider || {}, "apiKey")
    || (Array.isArray(provider?.customHeaders) && provider.customHeaders.some((header) => Object.hasOwn(header || {}, "value"))));
}

function omitProviderSecrets(settings = {}) {
  return {
    ...settings,
    providers: Object.fromEntries(Object.entries(settings.providers || {}).map(([id, provider]) => {
      const { apiKey: _apiKey, ...publicProvider } = provider || {};
      if (Array.isArray(publicProvider.customHeaders)) {
        publicProvider.customHeaders = publicProvider.customHeaders.map((header) => ({ name: String(header?.name ?? "") }));
      }
      return [id, publicProvider];
    }))
  };
}

function applyProviderSecrets(settings, secrets = {}) {
  for (const [id, provider] of Object.entries(settings.providers || {})) {
    provider.apiKey = secrets[id] || "";
    if (Array.isArray(provider.customHeaders)) {
      let values = [];
      try {
        values = JSON.parse(secrets[`${id}${CUSTOM_HEADER_SECRET_SUFFIX}`] || "[]");
      } catch {
        values = [];
      }
      provider.customHeaders = provider.customHeaders.map((header, index) => ({
        name: header.name,
        value: typeof values[index] === "string" ? values[index] : ""
      }));
    }
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
  // Earlier defaults move to the current one; a value the user chose stays as it is.
  if ([4096, 8192].includes(Number(storedProvider.maxTokens))) {
    provider.maxTokens = defaultProvider.maxTokens;
  }
  if (defaultProvider.id === "googleTranslate"
    && storedProvider.baseUrl === "https://translate.googleapis.com/translate_a/single") {
    provider.baseUrl = defaultProvider.baseUrl;
  }
  if (defaultProvider.id === CUSTOM_LLM_PROVIDER_ID) {
    provider.reasoningEffort = normalizeReasoningEffort(provider.reasoningEffort);
    provider.jsonMode = normalizeJsonMode(provider.jsonMode);
    provider.customHeaders = normalizeCustomHeaders(provider.customHeaders);
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
  const language = globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || "en";
  const normalized = String(language).trim();
  if (!normalized) return "en";
  if (/^zh-(cn|hans)$/i.test(normalized)) return "zh-CN";
  if (/^zh-(tw|hk|hant)$/i.test(normalized)) return "zh-TW";
  const code = normalized.split("-")[0].toLowerCase();
  return TARGET_LANGUAGES.some((item) => item.code === code) ? code : "en";
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
  // Settings no longer offer a choice: temporary translation always uses Google Translate.
  const fallback = {
    ...defaults.fallback,
    ...settings.fallback,
    providerId: defaults.fallback.providerId
  };
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
    genericAllowedHosts: normalizeGenericHosts(settings.genericAllowedHosts),
    fallback,
    subtitleStyle: withSourceFont({
      ...defaults.subtitleStyle,
      ...settings.subtitleStyle
    }, settings.subtitleStyle),
    providers,
    providerTestStatus,
    maxChunkDurationSeconds: normalizeChunkDurationSeconds(settings.maxChunkDurationSeconds, defaults.maxChunkDurationSeconds),
    settingsMode: settings.settingsMode === "advanced" ? "advanced" : "simple",
    llmParallelRequests: normalizeLlmParallelRequests(settings.llmParallelRequests),
    targetLanguage,
    subtitleDisplayMode: ["dual", "source", "translated"].includes(settings.subtitleDisplayMode)
      ? settings.subtitleDisplayMode
      : defaults.subtitleDisplayMode,
    activeProvider,
    preferYoutubeProvidedTranslation: settings.preferYoutubeProvidedTranslation !== false,
    phraseSegmentation: settings.phraseSegmentation !== false,
    sourceCaptionLanguages: normalizeSourceCaptionLanguages(settings.sourceCaptionLanguages),
    phraseSegmentationSkipYoutubeManual: settings.phraseSegmentationSkipYoutubeManual === true,
    wordProgressHighlight: settings.wordProgressHighlight !== false,
    customSystemPrompt: extractStyleSystemPrompt(settings.customSystemPrompt || defaults.customSystemPrompt || buildDefaultCustomStyleSystemPrompt(targetLanguage)),
    custom2SystemPrompt: extractStyleSystemPrompt(settings.custom2SystemPrompt || defaults.custom2SystemPrompt || buildDefaultCustom2StyleSystemPrompt()),
    summarySystemPrompt: normalizeSummarySystemPrompt(settings.summarySystemPrompt),
    customStyleLabel: normalizeCustomStyleLabel(settings.customStyleLabel, defaults.customStyleLabel),
    custom2StyleLabel: normalizeCustomStyleLabel(settings.custom2StyleLabel, defaults.custom2StyleLabel)
  };
}

function normalizeSourceCaptionLanguages(value) {
  const languages = {};
  for (const [platform, languageCode] of Object.entries(value && typeof value === "object" ? value : {})) {
    if (/^[a-z]{1,16}$/.test(platform) && /^[\w-]{1,35}$/.test(String(languageCode || ""))) languages[platform] = languageCode;
  }
  return languages;
}

// The source line's font defaults to Arial unless one was saved. Size and color saved before the
// source line had its own keep both lines alike.
function withSourceFont(style, saved = {}) {
  return {
    ...style,
    sourceFontSize: saved?.sourceFontSize ?? saved?.fontSize ?? style.sourceFontSize,
    sourceTextColor: saved?.sourceTextColor || saved?.textColor || style.sourceTextColor,
    // 0.75 was the previous default and moves to the current one once. The marker is saved with the
    // style, so a viewer who later picks 75% on purpose keeps it.
    backgroundOpacity: !saved?.backgroundOpacityDefaultApplied && Number(saved?.backgroundOpacity) === 0.75
      ? DEFAULT_SETTINGS.subtitleStyle.backgroundOpacity
      : style.backgroundOpacity,
    backgroundOpacityDefaultApplied: true
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
  return {
    ...omitProviderSecrets(await getSettings()),
    targetLanguages: TARGET_LANGUAGES.map((language) => ({ code: language.code, label: getTargetLanguageLabel(language) }))
  };
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
