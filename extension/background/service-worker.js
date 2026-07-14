import { getPublicSettings, getSettings, restrictLocalStorageAccess, saveSettings, updateSubtitleStyleSettings } from "../shared/storage.js";
import { TRANSLATION_STYLES } from "../shared/defaults.js";
import { validateBackgroundMessage, validateMessageSender } from "../shared/message-contracts.js";
import { ANTHROPIC_DIRECT_BROWSER_ACCESS_HEADER, buildProviderRequest, extractText, shouldRetryOpenRouterWithoutReasoning } from "../shared/provider-request.js";
import { assertProviderEndpoint } from "../shared/provider-security.js";
import { translateSubtitleDocument } from "../shared/translation.js";
import { fetchYoutubeCaptionTracks, fetchYoutubeTranscript } from "../platforms/youtube-captions.js";
import { fetchUdemyCaptionTracks, fetchUdemyTranscript } from "../platforms/udemy-captions.js";
import { fetchVimeoTranscript } from "../platforms/vimeo-captions.js";

const TEST_SYSTEM_PROMPT = "You are a concise API connection tester. Reply with only the word OK.";
const TEST_INPUT = "Return OK if you can read this message.";
export const PROVIDER_CONNECTION_TEST_MAX_TOKENS = 128;
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
void storageAccessReady.catch((error) => {
  console.error("[AST] Could not restrict extension storage access:", error);
});

async function broadcastPublicSettings() {
  if (!chrome.tabs?.query) return;
  const settings = await getPublicSettings();
  const tabs = await chrome.tabs.query({
    url: [
      "https://www.youtube.com/*",
      "https://*.udemy.com/course/*/learn/*",
      "https://www.nvidia.com/*/training/academy/course-player/*"
    ]
  });
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

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === "local" && changes.llmSettings?.newValue) {
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
  if (!provider) {
    throw new Error("Provider is required.");
  }
  assertProviderEndpoint(provider);

  switch (provider.id) {
    case "openai": {
      const baseUrl = requireProviderValue(provider, "baseUrl", "Base URL");
      const apiKey = requireProviderValue(provider, "apiKey", "API key");
      const body = await fetchJson(joinUrl(baseUrl, "models"), {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      return normalizeModelList(body.data || []);
    }
    case "openrouter": {
      const baseUrl = requireProviderValue(provider, "baseUrl", "Base URL");
      const headers = {};
      if (provider.apiKey?.trim()) {
        headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
      }
      const body = await fetchJson(joinUrl(baseUrl, "models"), { headers });
      return normalizeOpenRouterModelList(body.data || []);
    }
    case "nvidiaNim": {
      const baseUrl = requireProviderValue(provider, "baseUrl", "Base URL");
      const headers = {};
      if (provider.apiKey?.trim()) {
        headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
      }
      const body = await fetchJson(joinUrl(baseUrl, "models"), { headers });
      return normalizeModelList(body.data || []);
    }
    case "local": {
      const baseUrl = requireProviderValue(provider, "baseUrl", "Base URL");
      const headers = {};
      if (provider.apiKey?.trim()) {
        headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
      }
      const body = await fetchJson(joinUrl(baseUrl, "models"), { headers });
      return normalizeModelList(body.data || []);
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
}

async function testActiveProvider(providerId) {
  const settings = await getSettings();
  const provider = settings.providers[providerId || settings.activeProvider];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId || settings.activeProvider}`);
  }

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

  const requestOptions = {
    systemPrompt: TEST_SYSTEM_PROMPT,
    input: TEST_INPUT,
    structuredOutput: false,
    maxTokens: PROVIDER_CONNECTION_TEST_MAX_TOKENS
  };
  let request = buildProviderRequest(provider, requestOptions);
  let response = await fetch(request.url, request.init);
  let responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = responseBody.error?.message || responseBody.message || response.statusText;
    const error = new Error(formatHttpErrorMessage(response.status, detail, response.statusText));
    error.status = response.status;
    if (shouldRetryOpenRouterWithoutReasoning(provider, error)) {
      provider.disableReasoning = false;
      request = buildProviderRequest(provider, requestOptions);
      response = await fetch(request.url, request.init);
      responseBody = await response.json().catch(() => ({}));
    }
  }

  if (!response.ok) {
    const detail = responseBody.error?.message || responseBody.message || response.statusText;
    throw new Error(formatHttpErrorMessage(response.status, detail, response.statusText));
  }

  return {
    providerId: provider.id,
    providerLabel: provider.label,
    text: extractText(provider, responseBody).trim(),
    raw: responseBody
  };
}

async function setActiveProvider(providerId) {
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
}

async function setTranslationStyle(translationStyle) {
  if (!TRANSLATION_STYLES.some((style) => style.id === translationStyle)) {
    throw new Error(`Unsupported translation style: ${translationStyle}`);
  }
  const settings = await getSettings();
  settings.translationStyle = translationStyle;
  await saveSettings(settings);
  return { translationStyle };
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

function dispatchBackgroundMessage(message, sender, sendResponse) {
  if (message?.type === "settings.getPublic") {
    getPublicSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "settings.updateSubtitleStyle") {
    updateSubtitleStyleSettings(message.patch)
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
    testActiveProvider(message.providerId)
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

  if (message?.type === "platform.nvidia.isCoursePlayer") {
    const isNvidiaCoursePlayer = /^https:\/\/www\.nvidia\.com\/[^?#]*\/training\/academy\/course-player\/?(?:[?#]|$)/i
      .test(String(sender.tab?.url || ""));
    sendResponse({ ok: true, isNvidiaCoursePlayer });
    return false;
  }

  if (message?.type === "platform.vimeo.getContext") {
    const tabUrl = String(sender.tab?.url || "");
    const platform = /^https:\/\/www\.nvidia\.com\/[^?#]*\/training\/academy\/course-player\/?(?:[?#]|$)/i.test(tabUrl)
      ? "nvidia"
      : /^https:\/\/(?:www\.)?vimeo\.com\/|^https:\/\/player\.vimeo\.com\//i.test(tabUrl)
        ? "vimeo"
        : null;
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
    translateSubtitleDocument(message.document, {
      providerId: message.providerId,
      forceNoCache: Boolean(message.forceNoCache),
      initialStartTime: message.initialStartTime,
      onProgress: (progress) => {
        if (Number.isInteger(sender.tab?.id) && sender.tab.id >= 0) {
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
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "translation.clearCache") {
    chrome.storage.local.remove("translationCache")
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const validation = validateBackgroundMessage(message);
  if (!validation.handled) return false;
  if (!validation.ok) {
    sendResponse({ ok: false, error: `Invalid message: ${validation.error}` });
    return false;
  }

  const senderValidation = validateMessageSender(message, sender, chrome.runtime.id);
  if (!senderValidation.ok) {
    sendResponse({ ok: false, error: `Invalid sender: ${senderValidation.error}` });
    return false;
  }

  storageAccessReady
    .then(() => dispatchBackgroundMessage(message, sender, sendResponse))
    .catch((error) => sendResponse({
      ok: false,
      error: `Secure storage initialization failed: ${error.message}`
    }));
  return true;
});
