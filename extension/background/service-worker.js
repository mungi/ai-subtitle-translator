import { classifyProviderLimit, providerRetryDelay } from "../shared/provider-limits.js";
import { getPublicSettings, getSettings, restrictLocalStorageAccess, saveSettings, updateSubtitleStyleSettings } from "../shared/storage.js";
import { TARGET_LANGUAGES, TRANSLATION_STYLES } from "../shared/defaults.js";
import { validateBackgroundMessage, validateMessageSender } from "../shared/message-contracts.js";
import { buildGenericProbeMatches, GENERIC_EXCLUDE_MATCHES, getHostname, GENERIC_PLATFORM_ID, isGenericEligibleUrl, isHostListed, normalizeGenericHost, normalizeGenericHosts } from "../shared/platform-urls.js";
import { fetchGenericTranscript, listGenericHlsTracks, parseGenericTranscript } from "../platforms/generic-captions.js";
import { ANTHROPIC_DIRECT_BROWSER_ACCESS_HEADER, buildProviderRequest, createReasoningProfile, extractText, getReasoningProbeModes, isReasoningOptionError } from "../shared/provider-request.js";
import { sanitizeProviderErrorMessage } from "../shared/provider-error-sanitizer.js";
import { assertProviderEndpoint } from "../shared/provider-security.js";
import { translateSubtitleDocument } from "../shared/translation.js";
import { isSummaryProvider, summarizeTranscript } from "../shared/summary.js";
import { CONTEXT_DETECTION_PROVIDER_ID, CONTEXT_DETECTION_STEPS, createContextProfile, detectContextLength } from "../shared/provider-context.js";
import { buildCustomHeaders, CUSTOM_LLM_PROVIDER_ID, normalizeJsonMode } from "../shared/custom-llm-options.js";
import { benchmarkReasoningModes } from "../shared/reasoning-benchmark.js";
import { fetchYoutubeCaptionTracks, fetchYoutubeTranscript } from "../platforms/youtube-captions.js";
import { fetchUdemyCaptionTracks, fetchUdemyTranscript } from "../platforms/udemy-captions.js";
import { fetchVimeoTranscript } from "../platforms/vimeo-captions.js";
import { fetchCourseraTranscript } from "../platforms/coursera-captions.js";
import { fetchLinkedinTranscript } from "../platforms/linkedin-captions.js";
import { fetchOreillyTracks, fetchOreillyTranscript } from "../platforms/oreilly-captions.js";
import { fetchNvidiaOnDemandTracks, fetchNvidiaOnDemandTranscript } from "../platforms/nvidia-ondemand-captions.js";
import { fetchDeeplearningaiTranscript } from "../platforms/deeplearningai-captions.js";
import { buildEdxTranscript } from "../platforms/edx-captions.js";
import { fetchTedCaptionTracks, fetchTedTranscript } from "../platforms/ted-captions.js";

const TEST_SYSTEM_PROMPT = "You are a concise API connection tester. Reply with only the word OK.";
const TEST_INPUT = "Return OK if you can read this message.";
export const PROVIDER_CONNECTION_TEST_MAX_TOKENS = 128;
const activeTranslationRequests = new Map();
const HTTP_STATUS_REASONS = {
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  303: "See Other",
  304: "Not Modified",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Payload Too Large",
  414: "URI Too Long",
  415: "Unsupported Media Type",
  416: "Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a Teapot",
  421: "Misdirected Request",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Too Early",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  451: "Unavailable For Legal Reasons",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  508: "Loop Detected",
  510: "Not Extended",
  511: "Network Authentication Required"
};

const storageAccessReady = restrictLocalStorageAccess();
export async function registerYoutubeCaptionCapture(scripting = chrome.scripting) {
  const id = "ast-youtube-caption-capture";
  const registered = await scripting.getRegisteredContentScripts({ ids: [id] });
  if (registered.length === 0) {
    await scripting.registerContentScripts([{
      id,
      matches: ["https://www.youtube.com/*"],
      js: ["content/youtube-capture-main.js"],
      runAt: "document_start",
      world: "MAIN",
      allFrames: true,
      persistAcrossSessions: true
    }]);
  }
}
if (chrome.scripting) {
  void registerYoutubeCaptionCapture().catch((error) => console.error("[AST] Could not register YouTube caption capture:", error));
}
// ---- Generic video player (technical preview)

export const GENERIC_PROBE_SCRIPT_ID = "ast-generic-probe";
const GENERIC_PROBE_FILE = "content/generic-probe.js";
export const GENERIC_BUNDLE_FILES = [
  "content/phrase-segmentation.js",
  "content/subtitle-export.js",
  "content/generic-player.js",
  "content/content-script.js"
];

// Kept in memory so the synchronous sender check can use it; refreshed from storage on change.
const genericState = { enabled: true, allowedHosts: [] };
const genericAttachedFrames = new Set();

function isGenericSettingOn(settings = {}) {
  return settings.platforms?.[GENERIC_PLATFORM_ID] !== false;
}

function applyGenericSettings(settings = {}) {
  genericState.enabled = isGenericSettingOn(settings);
  genericState.allowedHosts = normalizeGenericHosts(settings.genericAllowedHosts);
}

export function getGenericState() {
  return { ...genericState, allowedHosts: [...genericState.allowedHosts] };
}

// The probe runs only on the sites the user added; cross-origin player frames inside those pages
// receive it from the worker (see generic.prepareFrames).
export function buildGenericProbeRegistration(settings = {}) {
  return {
    id: GENERIC_PROBE_SCRIPT_ID,
    matches: buildGenericProbeMatches(settings.genericAllowedHosts),
    excludeMatches: GENERIC_EXCLUDE_MATCHES,
    js: [GENERIC_PROBE_FILE],
    runAt: "document_idle",
    allFrames: true,
    persistAcrossSessions: true,
    // Players often live in about:blank/srcdoc frames; older Chrome rejects the key, so it is retried without it.
    matchOriginAsFallback: true
  };
}

let genericRegistrationQueue = Promise.resolve();

export function syncGenericProbeRegistration(settings, scripting = chrome.scripting) {
  const run = async () => {
    if (!scripting?.registerContentScripts) return;
    const registered = await scripting.getRegisteredContentScripts({ ids: [GENERIC_PROBE_SCRIPT_ID] });
    if (!isGenericSettingOn(settings || {}) || normalizeGenericHosts(settings?.genericAllowedHosts).length === 0) {
      if (registered.length > 0) await scripting.unregisterContentScripts({ ids: [GENERIC_PROBE_SCRIPT_ID] });
      return;
    }
    const script = buildGenericProbeRegistration(settings);
    const write = (value) => (registered.length > 0
      ? scripting.updateContentScripts([value])
      : scripting.registerContentScripts([value]));
    try {
      await write(script);
    } catch (error) {
      const { matchOriginAsFallback: _unused, ...withoutFallback } = script;
      await write(withoutFallback);
    }
  };
  const result = genericRegistrationQueue.catch(() => {}).then(run);
  genericRegistrationQueue = result.then(() => undefined, () => undefined);
  return result;
}

const genericStateReady = (async () => {
  try {
    await storageAccessReady;
    const settings = await getSettings();
    applyGenericSettings(settings);
    await syncGenericProbeRegistration(settings);
  } catch (error) {
    console.warn("[AST] Could not prepare the generic video player:", error?.message || error);
  }
})();

function isGenericTabAllowed(tabUrl) {
  return genericState.enabled
    && isGenericEligibleUrl(tabUrl)
    && isHostListed(genericState.allowedHosts, tabUrl);
}

async function attachGenericPlayer(sender, scripting = chrome.scripting) {
  const tabId = sender.tab?.id;
  const frameId = Number.isInteger(sender.frameId) ? sender.frameId : 0;
  if (!Number.isInteger(tabId) || tabId < 0) throw new Error("A tab is required.");
  if (!isGenericTabAllowed(sender.tab?.url)) return { attached: false };
  const key = `${tabId}:${frameId}:${sender.documentId || ""}`;
  if (genericAttachedFrames.has(key)) return { attached: true };
  genericAttachedFrames.add(key);
  try {
    const target = { tabId, frameIds: [frameId] };
    await scripting.executeScript({ target, func: () => { globalThis.__astGenericMode = true; } });
    await scripting.insertCSS({ target, files: ["content/content-style.css"] });
    await scripting.executeScript({ target, files: GENERIC_BUNDLE_FILES });
    return { attached: true };
  } catch (error) {
    genericAttachedFrames.delete(key);
    throw error;
  }
}

chrome.tabs?.onRemoved?.addListener((tabId) => {
  for (const key of genericAttachedFrames) {
    if (key.startsWith(`${tabId}:`)) genericAttachedFrames.delete(key);
  }
});

function genericAttachedTabIds() {
  return [...new Set([...genericAttachedFrames].map((key) => Number(key.split(":")[0])))];
}

async function sendToTab(tabId, message) {
  if (!Number.isInteger(tabId) || !chrome.tabs?.sendMessage) return;
  await chrome.tabs.sendMessage(tabId, message).catch(() => {});
}

// The popup's per-site switch and the generic toggle take effect in open tabs right away.
async function injectGenericProbe(tabId, scripting = chrome.scripting) {
  if (!Number.isInteger(tabId) || !scripting?.executeScript) return;
  await scripting.executeScript({ target: { tabId, allFrames: true }, files: [GENERIC_PROBE_FILE] }).catch(() => {});
}

async function activeTabsMatching(predicate) {
  if (!chrome.tabs?.query) return [];
  const tabs = await chrome.tabs.query({ active: true }).catch(() => []);
  return tabs.filter((tab) => Number.isInteger(tab.id) && predicate(String(tab.url || "")));
}

let settingsMutationQueue = Promise.resolve();
void storageAccessReady.catch((error) => {
  console.error("[AST] Could not restrict extension storage access:", error);
});

export function enqueueSettingsMutation(operation) {
  const result = settingsMutationQueue.catch(() => {}).then(operation);
  settingsMutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

const SUPPORTED_VIDEO_TAB_URLS = [
  "https://www.youtube.com/*",
  "https://ted.com/talks/*",
  "https://www.ted.com/talks/*",
  "https://*.udemy.com/course/*/learn/*",
  "https://vimeo.com/*",
  "https://www.vimeo.com/*",
  "https://player.vimeo.com/*",
  "https://www.coursera.org/*",
  "https://www.linkedin.com/learning/*",
  "https://www.oreilly.com/videos/*",
  "https://learn.deeplearning.ai/courses/*",
  "https://courses.edx.org/*",
  "https://learning.edx.org/*",
  // NVIDIA course URLs may omit the slash before the query; tabs without the player ignore the message.
  "https://www.nvidia.com/*"
];

async function queryAstTabs() {
  if (!chrome.tabs?.query) return [];
  const supported = await chrome.tabs.query({ url: SUPPORTED_VIDEO_TAB_URLS }).catch(() => []);
  const listedPatterns = buildGenericProbeMatches(genericState.allowedHosts);
  if (!genericState.enabled || listedPatterns.length === 0) return supported;
  const generic = await chrome.tabs.query({ url: listedPatterns }).catch(() => []);
  const byId = new Map([...supported, ...generic.filter((tab) => isGenericTabAllowed(tab.url))].map((tab) => [tab.id, tab]));
  return [...byId.values()];
}

async function broadcastPublicSettings() {
  if (!chrome.tabs?.query) return;
  const settings = await getPublicSettings();
  const tabs = await queryAstTabs();
  await Promise.all(tabs
    .filter((tab) => Number.isInteger(tab.id))
    .map((tab) => chrome.tabs.sendMessage(tab.id, {
      type: "settings.changed",
      settings
    }).catch(() => {})));
}

export async function relayProviderMenuVisibility(tabId, open) {
  if (!Number.isInteger(tabId) || tabId < 0 || !chrome.tabs?.sendMessage) return;
  await chrome.tabs.sendMessage(tabId, {
    type: "ast.providerMenu.setOpen",
    open: Boolean(open)
  }).catch(() => {});
}

const TRANSLATION_LIFECYCLE_PORT = "ast.translation.lifecycle";

function getSenderDocumentKey(sender) {
  return sender?.documentId || `${sender?.tab?.id ?? "tab"}:${sender?.frameId ?? 0}`;
}

// A content script holds this port open; Chrome closes it when the page reloads,
// navigates away or the tab closes, so that page's remaining LLM work stops.
export function handleTranslationLifecyclePort(port) {
  const sender = port?.sender;
  if (port?.name !== TRANSLATION_LIFECYCLE_PORT || !sender || sender.id !== chrome.runtime.id
    || !Number.isInteger(sender.tab?.id) || sender.tab.id < 0) {
    port?.disconnect?.();
    return;
  }
  const owner = getSenderDocumentKey(sender);
  port.onDisconnect.addListener(() => {
    for (const controller of activeTranslationRequests.values()) {
      if (controller.owner === owner) controller.abort();
    }
  });
}

chrome.runtime?.onConnect?.addListener(handleTranslationLifecyclePort);

// Any writer of the stored OFF state (popup, toolbar, settings import) stops running work.
export function abortTranslationsWhenDisabled(changes, areaName) {
  if (areaName !== "local" || changes.subtitleEnabled?.newValue !== false) return;
  for (const controller of activeTranslationRequests.values()) controller.abort();
}

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  abortTranslationsWhenDisabled(changes, areaName);
  if (areaName === "local" && changes.llmSettings?.newValue) {
    const before = getGenericState();
    applyGenericSettings(changes.llmSettings.newValue);
    if (before.enabled !== genericState.enabled
      || before.allowedHosts.join(",") !== genericState.allowedHosts.join(",")) {
      syncGenericProbeRegistration(changes.llmSettings.newValue).catch((error) => {
        console.warn("[AST] Could not update the generic video player:", error?.message || error);
      });
    }
    broadcastPublicSettings().catch(() => {});
  }
});

function joinUrl(baseUrl, path) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function requireProviderValue(provider, key, label) {
  const value = provider?.[key];
  if (!value || String(value).trim() === "") {
    throw new Error(`${label} is required.`);
  }
  return String(value).trim();
}

export function formatHttpErrorMessage(status, detail, statusText = "") {
  const code = Number(status);
  const reason = String(statusText || HTTP_STATUS_REASONS[code] || "").trim();
  const statusPart = Number.isFinite(code)
    ? `HTTP ${code}${reason ? ` ${reason}` : ""}`
    : "HTTP error";
  const cleanDetail = String(detail || "").trim();

  if (!cleanDetail || cleanDetail.toLowerCase() === reason.toLowerCase()) {
    return statusPart;
  }

  return `${statusPart} - ${cleanDetail}`;
}

function normalizeModelList(items) {
  return items
    .map((item) => {
      const id = item?.id || item?.name?.replace(/^models\//, "");
      if (!id) return null;
      return {
        id,
        label: item.displayName || item.name || id
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function moveFreeSuffixToPrefix(label) {
  const value = String(label || "").trim();
  const match = value.match(/^(.*?)\s*\(free\)$/i);
  if (!match) {
    return value;
  }

  const modelName = match[1].trim();
  return modelName ? `(free) ${modelName}` : "(free)";
}

function isFreeModelLabel(label) {
  return /^\(free\)(?:\s|$)/i.test(String(label || ""));
}

function normalizeOpenRouterModelList(items) {
  return normalizeModelList(items)
    .map((model) => ({
      ...model,
      label: moveFreeSuffixToPrefix(model.label)
    }))
    .sort((a, b) => {
      const freeCompare = Number(!isFreeModelLabel(a.label)) - Number(!isFreeModelLabel(b.label));
      if (freeCompare !== 0) return freeCompare;
      return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
    });
}

async function fetchJson(url, init) {
  const response = await fetch(url, {
    ...init,
    redirect: "error"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.error?.message || body.message || response.statusText;
    throw new Error(formatHttpErrorMessage(response.status, detail, response.statusText));
  }
  return body;
}

export async function listProviderModels(provider) {
  try {
    if (!provider) {
      throw new Error("Provider is required.");
    }
    assertProviderEndpoint(provider);

    switch (provider.id) {
      case "openai": {
        const baseUrl = requireProviderValue(provider, "baseUrl", "Base URL");
        const apiKey = requireProviderValue(provider, "apiKey", "API key");
        const url = joinUrl(baseUrl, "models");
        const body = await fetchJson(url, {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        return normalizeModelList(body.data || []);
      }
      // OpenAI-compatible endpoints where the API key is optional.
      case "openrouter":
      case "nvidiaNim":
      case "local": {
        const baseUrl = requireProviderValue(provider, "baseUrl", "Base URL");
        const headers = {};
        if (provider.apiKey?.trim()) {
          headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
        }
        Object.assign(headers, buildCustomHeaders(provider));
        const body = await fetchJson(joinUrl(baseUrl, "models"), { headers });
        return provider.id === "openrouter"
          ? normalizeOpenRouterModelList(body.data || [])
          : normalizeModelList(body.data || []);
      }
      case "anthropic": {
        const baseUrl = requireProviderValue(provider, "baseUrl", "Base URL");
        const apiKey = requireProviderValue(provider, "apiKey", "API key");
        const body = await fetchJson(joinUrl(baseUrl, "v1/models"), {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": provider.anthropicVersion || "2023-06-01",
            [ANTHROPIC_DIRECT_BROWSER_ACCESS_HEADER]: "true"
          }
        });
        return normalizeModelList(body.data || []);
      }
      case "google": {
        const baseUrl = requireProviderValue(provider, "baseUrl", "Base URL");
        const apiKey = requireProviderValue(provider, "apiKey", "API key");
        const url = `${joinUrl(baseUrl, "models")}?key=${encodeURIComponent(apiKey)}`;
        const body = await fetchJson(url);
        return normalizeModelList((body.models || []).filter((model) => {
          const methods = model.supportedGenerationMethods || [];
          return methods.includes("generateContent");
        }));
      }
      default:
        throw new Error(`${provider.label || provider.id} does not support model listing.`);
    }
  } catch (error) {
    throw new Error(sanitizeProviderErrorMessage(error?.message, provider));
  }
}

export async function testActiveProvider(providerId, { onProgress } = {}) {
  const settings = await getSettings();
  const provider = settings.providers[providerId || settings.activeProvider];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId || settings.activeProvider}`);
  }

  try {
    if (provider.apiStyle === "google-translate" || provider.apiStyle === "deepl") {
      const document = await translateSubtitleDocument({
        platform: "test",
        videoId: "provider-test",
        sourceLanguage: "en",
        cues: [
          {
            id: "test-0",
            start: 0,
            end: 1,
            text: "Hello"
          }
        ]
      }, {
        providerId: provider.id,
        forceNoCache: true,
        allowFallback: false
      });

      return {
        providerId: provider.id,
        providerLabel: provider.label,
        text: document.cues[0]?.text || "",
        raw: document
      };
    }

    if (provider.apiStyle === "anthropic-messages") {
      return await benchmarkReasoningModes(provider, settings.targetLanguage || "ko");
    }

    const requestOptions = {
      systemPrompt: TEST_SYSTEM_PROMPT,
      input: TEST_INPUT,
      // A Custom LLM with JSON mode on is tested in that mode, so a server that refuses it fails here.
      structuredOutput: provider.id === CUSTOM_LLM_PROVIDER_ID && normalizeJsonMode(provider.jsonMode) !== "off",
      maxTokens: PROVIDER_CONNECTION_TEST_MAX_TOKENS
    };
    let responseBody;
    let reasoningMode;
    // Custom LLM: the reply check, then up to three read-only questions about the context size.
    const detectsContext = provider.id === CONTEXT_DETECTION_PROVIDER_ID;
    const totalSteps = detectsContext ? 1 + CONTEXT_DETECTION_STEPS.length : 1;
    if (detectsContext) onProgress?.({ step: "reply", index: 1, total: totalSteps });
    const probeModes = getReasoningProbeModes(provider);
    for (const mode of probeModes) {
      const request = buildProviderRequest(provider, { ...requestOptions, reasoningMode: mode });
      const response = await fetch(request.url, request.init);
      responseBody = await response.json().catch(() => ({}));
      if (response.ok) {
        reasoningMode = mode;
        break;
      }
      const detail = responseBody.error?.message || responseBody.message || response.statusText;
      const error = new Error(formatHttpErrorMessage(response.status, detail, response.statusText));
      error.status = response.status;
      error.details = JSON.stringify(responseBody.error || responseBody);
      if (!isReasoningOptionError(error) || mode === probeModes.at(-1)) throw error;
    }

    const contextProfile = detectsContext
      ? createContextProfile(provider, await detectContextLength(provider, {
        onStep: (step) => onProgress?.({ step, index: 2 + CONTEXT_DETECTION_STEPS.indexOf(step), total: totalSteps })
      }))
      : undefined;

    return {
      providerId: provider.id,
      providerLabel: provider.label,
      text: extractText(provider, responseBody).trim(),
      reasoningProfile: createReasoningProfile(provider, reasoningMode),
      ...(detectsContext ? { contextProfile } : {}),
      raw: responseBody
    };
  } catch (error) {
    throw new Error(sanitizeProviderErrorMessage(error?.message, provider));
  }
}

export function setActiveProvider(providerId) {
  return enqueueSettingsMutation(async () => {
    const settings = await getSettings();
    const provider = settings.providers?.[providerId];
    const available = provider?.apiStyle === "google-translate"
      || settings.providerTestStatus?.[providerId] === "success";
    if (!provider || !available) {
      throw new Error(`Provider is not available: ${providerId}`);
    }
    settings.activeProvider = providerId;
    await saveSettings(settings);
    return { providerId };
  });
}

export function setTargetLanguage(targetLanguage) {
  if (!TARGET_LANGUAGES.some((language) => language.code === targetLanguage)) {
    return Promise.reject(new Error(`Unsupported target language: ${targetLanguage}`));
  }
  return enqueueSettingsMutation(async () => {
    const settings = await getSettings();
    settings.targetLanguage = targetLanguage;
    await saveSettings(settings);
    return { targetLanguage };
  });
}

export function setTranslationStyle(translationStyle) {
  if (!TRANSLATION_STYLES.some((style) => style.id === translationStyle)) {
    return Promise.reject(new Error(`Unsupported translation style: ${translationStyle}`));
  }
  return enqueueSettingsMutation(async () => {
    const settings = await getSettings();
    settings.translationStyle = translationStyle;
    await saveSettings(settings);
    return { translationStyle };
  });
}

export function setPreferYoutubeProvidedTranslation(enabled) {
  if (typeof enabled !== "boolean") {
    return Promise.reject(new Error("enabled must be a boolean."));
  }
  return enqueueSettingsMutation(async () => {
    const settings = await getSettings();
    settings.preferYoutubeProvidedTranslation = enabled;
    await saveSettings(settings);
    return { enabled };
  });
}

export function setWordProgressHighlight(enabled) {
  if (typeof enabled !== "boolean") {
    return Promise.reject(new Error("enabled must be a boolean."));
  }
  return enqueueSettingsMutation(async () => {
    const settings = await getSettings();
    settings.wordProgressHighlight = enabled;
    await saveSettings(settings);
    return { enabled };
  });
}

export function setSourceCaptionLanguage(platform, languageCode) {
  return enqueueSettingsMutation(async () => {
    const settings = await getSettings();
    settings.sourceCaptionLanguages = { ...(settings.sourceCaptionLanguages || {}), [platform]: languageCode };
    await saveSettings(settings);
    return { platform, languageCode };
  });
}

export function setSubtitleDisplayMode(mode) {
  if (!["dual", "source", "translated"].includes(mode)) {
    return Promise.reject(new Error(`Unsupported subtitle display mode: ${mode}`));
  }
  return enqueueSettingsMutation(async () => {
    const settings = await getSettings();
    settings.subtitleDisplayMode = mode;
    await saveSettings(settings);
    return { mode };
  });
}

export function buildYoutubeTranscriptErrorResponse(error) {
  const response = {
    ok: false,
    error: error?.message || String(error || "Unknown error")
  };

  if (error?.retryOnPage?.type === "youtubeTranscriptPanel") {
    response.retryOnPage = error.retryOnPage;
  }

  return response;
}

// Summarizes the transcript the content script sends, in the target language, with the active LLM.
export async function generateSummary(message, sender, summarize = summarizeTranscript) {
  const settings = await getSettings();
  const provider = settings.providers?.[settings.activeProvider];
  if (!isSummaryProvider(provider)) throw new Error("Summaries need an LLM provider.");
  const language = TARGET_LANGUAGES.find((item) => item.code === settings.targetLanguage);
  const tabId = sender?.tab?.id;
  try {
    return await summarize({
      text: message.text,
      title: message.title || "",
      systemPrompt: settings.summarySystemPrompt,
      languageName: language?.labels?.en || settings.targetLanguage || ""
    }, {
      provider,
      onProgress: (progress) => {
        if (!Number.isInteger(tabId) || tabId < 0) return;
        chrome.tabs.sendMessage(tabId, { type: "summary.progress", requestId: message.requestId, progress }).catch(() => {});
      }
    });
  } catch (error) {
    throw new Error(sanitizeProviderErrorMessage(error?.message, provider));
  }
}

export function dispatchBackgroundMessage(message, sender, sendResponse) {
  if (message?.type === "fonts.getBundledGowun") {
    fetch(chrome.runtime.getURL("assets/fonts/gowun-batang-regular.woff"))
      .then((response) => {
        if (!response.ok) throw new Error(`Bundled font load failed: HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((fontData) => {
        const bytes = new Uint8Array(fontData);
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 32768) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
        }
        sendResponse({ ok: true, fontBase64: btoa(binary) });
      })
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.getPublic") {
    getPublicSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.getSubtitleEnabled") {
    enqueueSettingsMutation(async () => {
      const stored = await chrome.storage.local.get("subtitleEnabled");
      return stored.subtitleEnabled !== false;
    }).then((enabled) => sendResponse({ ok: true, enabled }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setSubtitleEnabled") {
    enqueueSettingsMutation(async () => {
      await chrome.storage.local.set({ subtitleEnabled: message.enabled });
      if (!message.enabled) {
        for (const controller of activeTranslationRequests.values()) controller.abort();
      }
      const tabs = await queryAstTabs().catch(() => []);
      await Promise.all(tabs.filter((tab) => Number.isInteger(tab.id)).map((tab) => chrome.tabs.sendMessage(tab.id, {
        type: "subtitles.setEnabled", enabled: message.enabled
      }).catch(() => {})));
    })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.updateSubtitleStyle") {
    enqueueSettingsMutation(() => updateSubtitleStyleSettings(message.patch))
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "llm.listModels") {
    listProviderModels(message.provider)
      .then((models) => sendResponse({ ok: true, models }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "llm.testActiveProvider") {
    testActiveProvider(message.providerId, {
      // The settings page shows each step on the status line under the test button.
      onProgress: (progress) => {
        chrome.runtime.sendMessage?.({ type: "llm.testProgress", providerId: message.providerId, ...progress })?.catch?.(() => {});
      }
    })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setActiveProvider") {
    setActiveProvider(message.providerId)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setTranslationStyle") {
    setTranslationStyle(message.translationStyle)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setTargetLanguage") {
    setTargetLanguage(message.targetLanguage)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setPreferYoutubeProvidedTranslation") {
    setPreferYoutubeProvidedTranslation(message.enabled)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setWordProgressHighlight") {
    setWordProgressHighlight(message.enabled)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setSourceCaptionLanguage") {
    setSourceCaptionLanguage(message.platform, message.languageCode)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setSubtitleDisplayMode") {
    setSubtitleDisplayMode(message.mode)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "ast.openOptions") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "captions.youtube.listTracks") {
    fetchYoutubeCaptionTracks(message.urlOrId)
      .then((tracks) => sendResponse({ ok: true, tracks }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.youtube.fetchTranscript") {
    fetchYoutubeTranscript({
      urlOrId: message.urlOrId,
      videoId: message.videoId,
      languageCode: message.languageCode,
      captionTrackUrl: message.captionTrackUrl,
      captionTracks: message.captionTracks,
      transcriptParams: message.transcriptParams,
      innertubeApiKey: message.innertubeApiKey,
      innertubeContext: message.innertubeContext
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse(buildYoutubeTranscriptErrorResponse(error)));
    return true;
  }

  if (message?.type === "captions.udemy.listTracks") {
    fetchUdemyCaptionTracks({
      courseId: message.courseId,
      lectureId: message.lectureId,
      hostname: message.hostname
    })
      .then((tracks) => sendResponse({ ok: true, tracks }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.udemy.fetchTranscript") {
    fetchUdemyTranscript({
      courseId: message.courseId,
      lectureId: message.lectureId,
      hostname: message.hostname,
      languageCode: message.languageCode,
      localeId: message.localeId,
      trackUrl: message.trackUrl
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.vimeo.fetchTranscript") {
    fetchVimeoTranscript({
      videoId: message.videoId,
      trackUrl: message.trackUrl,
      sourceLanguage: message.sourceLanguage,
      platform: message.platform
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.edx.buildTranscript") {
    try {
      sendResponse({ ok: true, document: buildEdxTranscript(message) });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return false;
  }

  if (message?.type === "captions.deeplearningai.fetchTranscript") {
    fetchDeeplearningaiTranscript({
      lessonId: message.lessonId,
      trackUrl: message.trackUrl,
      sourceLanguage: message.sourceLanguage
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.nvidiaOnDemand.listTracks") {
    fetchNvidiaOnDemandTracks({ sessionId: message.sessionId })
      .then((tracks) => sendResponse({ ok: true, tracks }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.nvidiaOnDemand.fetchTranscript") {
    fetchNvidiaOnDemandTranscript({ sessionId: message.sessionId, sourceLanguage: message.sourceLanguage })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.oreilly.listTracks") {
    fetchOreillyTracks({ clipId: message.clipId })
      .then((tracks) => sendResponse({ ok: true, tracks }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.oreilly.fetchTranscript") {
    fetchOreillyTranscript({ clipId: message.clipId, sourceLanguage: message.sourceLanguage })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.linkedin.fetchTranscript") {
    fetchLinkedinTranscript({
      videoId: message.videoId,
      trackUrl: message.trackUrl,
      sourceLanguage: message.sourceLanguage
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.coursera.fetchTranscript") {
    fetchCourseraTranscript({
      videoId: message.videoId,
      trackUrl: message.trackUrl,
      sourceLanguage: message.sourceLanguage
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.ted.listTracks") {
    fetchTedCaptionTracks({
      videoId: message.videoId,
      manifestUrl: message.manifestUrl
    })
      .then((tracks) => sendResponse({ ok: true, tracks }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.ted.fetchTranscript") {
    fetchTedTranscript({
      videoId: message.videoId,
      trackUrl: message.trackUrl,
      sourceLanguage: message.sourceLanguage
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "platform.nvidia.isCoursePlayer") {
    const isNvidiaCoursePlayer = /^https:\/\/www\.nvidia\.com\/[^?#]*\/training\/academy\/course-player\/?(?:[?#]|$)/i
      .test(String(sender.tab?.url || ""));
    sendResponse({ ok: true, isNvidiaCoursePlayer });
    return false;
  }

  if (message?.type === "generic.attach") {
    attachGenericPlayer(sender)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.generic.fetchTranscript") {
    fetchGenericTranscript({
      sessionKey: message.sessionKey,
      trackUrl: message.trackUrl,
      sourceLanguage: message.sourceLanguage,
      format: message.format
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "captions.generic.parseTranscript") {
    try {
      sendResponse({ ok: true, document: parseGenericTranscript(message) });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return false;
  }

  if (message?.type === "captions.generic.listHlsTracks") {
    listGenericHlsTracks({ urls: message.urls })
      .then((tracks) => sendResponse({ ok: true, tracks }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setPlatformEnabled") {
    setPlatformEnabled(message.platform, message.enabled)
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.setGenericPlayerEnabled") {
    setPlatformEnabled(GENERIC_PLATFORM_ID, message.enabled)
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "generic.prepareFrames") {
    if (Number.isInteger(sender.tab?.id) && isGenericTabAllowed(sender.tab?.url)) {
      injectGenericProbe(sender.tab.id).then(() => sendResponse({ ok: true }), (error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "settings.setGenericSiteAllowed") {
    setGenericSiteAllowed(message.host, message.allowed)
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "platform.vimeo.getContext") {
    const tabUrl = String(sender.tab?.url || "");
    const platform = /^https:\/\/www\.nvidia\.com\/[^?#]*\/training\/academy\/course-player\/?(?:[?#]|$)/i.test(tabUrl)
      ? "nvidia"
      : /^https:\/\/(?:www\.)?vimeo\.com\/|^https:\/\/player\.vimeo\.com\//i.test(tabUrl)
        ? "vimeo"
        // A Vimeo player embedded in another site works there too once the generic player is on.
        : isGenericTabAllowed(tabUrl) ? "vimeo" : null;
    sendResponse({ ok: true, platform });
    return false;
  }

  if (message?.type === "ast.providerMenu.setOpen") {
    relayProviderMenuVisibility(sender.tab?.id, message.open)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "translation.translateDocument") {
    // A reloaded page restarts its request IDs, so the document keeps both pages' requests apart.
    const requestKey = `${getSenderDocumentKey(sender)}:${message.requestId || crypto.randomUUID()}`;
    // Register before the OFF check so a cancel or OFF that arrives while waiting still reaches it.
    const controller = new AbortController();
    controller.owner = getSenderDocumentKey(sender);
    activeTranslationRequests.set(requestKey, controller);
    const release = () => {
      if (activeTranslationRequests.get(requestKey) === controller) activeTranslationRequests.delete(requestKey);
    };
    enqueueSettingsMutation(async () => {
      const stored = await chrome.storage.local.get("subtitleEnabled");
      return stored.subtitleEnabled !== false;
    }).then((enabled) => {
      if (!enabled || controller.signal.aborted) {
        release();
        sendResponse({ ok: false, error: enabled ? "Translation request was cancelled." : "Subtitle translation is disabled." });
        return;
      }
      translateSubtitleDocument(message.document, {
      providerId: message.providerId,
      forceNoCache: Boolean(message.forceNoCache),
      allowFallback: message.allowFallback !== false,
      initialStartTime: message.initialStartTime,
      getPriorityTime: () => controller.priorityTime,
      signal: controller.signal,
      onProgress: (progress) => {
        if (!controller.signal.aborted && Number.isInteger(sender.tab?.id) && sender.tab.id >= 0) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "translation.progress",
            videoId: message.document?.videoId,
            mode: message.mode || "final",
            requestId: message.requestId,
            progress
          }).catch(() => {});
        }
      }
    })
      .then((document) => sendResponse({ ok: true, document }))
      .catch((error) => sendResponse({ ok: false, error: error.message, errorKind: classifyProviderLimit(error), retryAfterMs: providerRetryDelay(error) }))
      .finally(release);
    }).catch((error) => {
      release();
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message?.type === "summary.generate") {
    generateSummary(message, sender)
      .then((summary) => sendResponse({ ok: true, summary }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "translation.setPriority") {
    const requestKey = `${getSenderDocumentKey(sender)}:${message.requestId}`;
    const controller = activeTranslationRequests.get(requestKey);
    if (controller) controller.priorityTime = message.currentTime;
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "translation.cancelRequest") {
    const requestKey = `${getSenderDocumentKey(sender)}:${message.requestId}`;
    activeTranslationRequests.get(requestKey)?.abort();
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "translation.clearCache") {
    chrome.storage.local.remove("translationCache")
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "translation.clearVideoCache") {
    chrome.storage.local.get("translationCache")
      .then(({ translationCache = {} }) => {
        const remaining = Object.fromEntries(Object.entries(translationCache || {}).filter(([, entry]) => (
          entry?.document?.platform !== message.platform
          || String(entry.document.videoId) !== String(message.videoId)
        )));
        return Object.keys(remaining).length > 0
          ? chrome.storage.local.set({ translationCache: remaining })
          : chrome.storage.local.remove("translationCache");
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
}

export async function setPlatformEnabled(platform, enabled) {
  const settings = await enqueueSettingsMutation(async () => {
    const current = await getSettings();
    current.platforms = { ...(current.platforms || {}), [platform]: Boolean(enabled) };
    return saveSettings(current);
  });
  applyGenericSettings(settings);
  if (platform === GENERIC_PLATFORM_ID) {
    await syncGenericProbeRegistration(settings).catch(() => {});
    if (enabled) {
      const tabs = await activeTabsMatching((url) => isGenericTabAllowed(url));
      await Promise.all(tabs.map((tab) => injectGenericProbe(tab.id)));
    } else {
      await Promise.all(genericAttachedTabIds().map((tabId) => sendToTab(tabId, { type: "ast.site.setActive", active: false })));
      genericAttachedFrames.clear();
    }
  }
  return settings;
}

export async function setGenericSiteAllowed(host, allowed) {
  const normalizedHost = normalizeGenericHost(host);
  const excluded = !allowed;
  const settings = await enqueueSettingsMutation(async () => {
    const current = await getSettings();
    const hosts = new Set(normalizeGenericHosts(current.genericAllowedHosts));
    if (allowed) hosts.add(normalizedHost);
    else hosts.delete(normalizedHost);
    current.genericAllowedHosts = [...hosts];
    return saveSettings(current);
  });
  applyGenericSettings(settings);
  await syncGenericProbeRegistration(settings).catch(() => {});
  const tabs = chrome.tabs?.query
    ? (await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }).catch(() => []))
      .filter((tab) => Number.isInteger(tab.id) && getHostname(tab.url) === normalizedHost)
    : [];
  await Promise.all(tabs.map(async (tab) => {
    if (excluded) {
      await sendToTab(tab.id, { type: "ast.site.setActive", active: false });
    } else if (isGenericTabAllowed(tab.url)) {
      await sendToTab(tab.id, { type: "ast.site.setActive", active: true });
      await injectGenericProbe(tab.id);
    }
  }));
  if (excluded) {
    for (const tab of tabs) {
      for (const key of genericAttachedFrames) if (key.startsWith(`${tab.id}:`)) genericAttachedFrames.delete(key);
    }
  }
  return settings;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const validation = validateBackgroundMessage(message);
  if (!validation.handled) return false;
  if (!validation.ok) {
    sendResponse({ ok: false, error: `Invalid message: ${validation.error}` });
    return false;
  }

  const senderValidation = validateMessageSender(message, sender, chrome.runtime.id, { genericState });
  if (!senderValidation.ok) {
    // Right after the worker wakes, the generic state may not be loaded yet; check once more after it is.
    genericStateReady.then(() => {
      const retry = validateMessageSender(message, sender, chrome.runtime.id, { genericState });
      if (!retry.ok) {
        sendResponse({ ok: false, error: `Invalid sender: ${retry.error}` });
        return;
      }
      storageAccessReady
        .then(() => dispatchBackgroundMessage(message, sender, sendResponse))
        .catch((error) => sendResponse({ ok: false, error: `Secure storage initialization failed: ${error.message}` }));
    });
    return true;
  }

  storageAccessReady
    .then(() => dispatchBackgroundMessage(message, sender, sendResponse))
    .catch((error) => sendResponse({
      ok: false,
      error: `Secure storage initialization failed: ${error.message}`
    }));
  return true;
});
