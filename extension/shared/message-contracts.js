import { validateCues } from "./subtitles.js";
import { ALL_PLATFORM_IDS, getHostname, isGenericEligibleUrl, isHostListed, normalizeGenericHost } from "./platform-urls.js";

const BACKGROUND_MESSAGE_TYPES = new Set([
  "llm.listModels",
  "llm.testActiveProvider",
  "settings.getPublic",
  "settings.getSubtitleEnabled",
  "settings.setSubtitleEnabled",
  "fonts.getBundledGowun",
  "settings.updateSubtitleStyle",
  "settings.setActiveProvider",
  "settings.setTranslationStyle",
  "settings.setTargetLanguage",
  "settings.setSubtitleDisplayMode",
  "settings.setPreferYoutubeProvidedTranslation",
  "settings.setWordProgressHighlight",
  "settings.setSourceCaptionLanguage",
  "settings.setPlatformEnabled",
  "settings.setGenericPlayerEnabled",
  "settings.setGenericSiteAllowed",
  "ast.openOptions",
  "ast.providerMenu.setOpen",
  "generic.attach",
  "generic.prepareFrames",
  "captions.generic.fetchTranscript",
  "captions.generic.parseTranscript",
  "captions.generic.listHlsTracks",
  "captions.youtube.listTracks",
  "captions.youtube.fetchTranscript",
  "captions.udemy.listTracks",
  "captions.udemy.fetchTranscript",
  "captions.vimeo.fetchTranscript",
  "captions.coursera.fetchTranscript",
  "captions.linkedin.fetchTranscript",
  "captions.oreilly.listTracks",
  "captions.oreilly.fetchTranscript",
  "captions.nvidiaOnDemand.listTracks",
  "captions.nvidiaOnDemand.fetchTranscript",
  "captions.deeplearningai.fetchTranscript",
  "captions.ted.listTracks",
  "captions.ted.fetchTranscript",
  "platform.nvidia.isCoursePlayer",
  "platform.vimeo.getContext",
  "translation.translateDocument",
  "translation.cancelRequest",
  "translation.setPriority",
  "translation.clearCache",
  "translation.clearVideoCache",
  "summary.generate"
]);

const EXTENSION_PAGE_MESSAGE_TYPES = new Set([
  "llm.listModels",
  "llm.testActiveProvider",
  "translation.clearCache",
  "settings.setPlatformEnabled",
  "settings.setGenericPlayerEnabled",
  "settings.setGenericSiteAllowed"
]);

const CONTENT_SCRIPT_MESSAGE_TYPES = new Set([
  "settings.getPublic",
  "generic.attach",
  "generic.prepareFrames",
  "captions.generic.fetchTranscript",
  "captions.generic.parseTranscript",
  "captions.generic.listHlsTracks",
  "fonts.getBundledGowun",
  "settings.updateSubtitleStyle",
  "settings.setActiveProvider",
  "settings.setTranslationStyle",
  "settings.setTargetLanguage",
  "settings.setSubtitleDisplayMode",
  "settings.setPreferYoutubeProvidedTranslation",
  "settings.setWordProgressHighlight",
  "settings.setSourceCaptionLanguage",
  "ast.openOptions",
  "ast.providerMenu.setOpen",
  "captions.youtube.listTracks",
  "captions.youtube.fetchTranscript",
  "captions.udemy.listTracks",
  "captions.udemy.fetchTranscript",
  "captions.vimeo.fetchTranscript",
  "captions.coursera.fetchTranscript",
  "captions.linkedin.fetchTranscript",
  "captions.oreilly.listTracks",
  "captions.oreilly.fetchTranscript",
  "captions.nvidiaOnDemand.listTracks",
  "captions.nvidiaOnDemand.fetchTranscript",
  "captions.deeplearningai.fetchTranscript",
  "captions.ted.listTracks",
  "captions.ted.fetchTranscript",
  "platform.nvidia.isCoursePlayer",
  "platform.vimeo.getContext",
  "translation.translateDocument",
  "translation.cancelRequest",
  "translation.setPriority",
  "translation.clearVideoCache",
  "summary.generate"
]);

const SUMMARY_TEXT_MAX_CHARS = 2000000;
export const GENERIC_TRANSCRIPT_MAX_CHARS = 5000000;
const GENERIC_SESSION_KEY_PATTERN = /^[\w:.-]{1,200}$/;

function isHttpUrl(value, maxLength = 4096) {
  if (typeof value !== "string" || value.length > maxLength) return false;
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

function validateGenericCues(cues) {
  if (!Array.isArray(cues) || cues.length === 0) return "cues must be a non-empty array.";
  if (cues.length > 20000) return "cues exceeds the 20000 cue limit.";
  for (const cue of cues) {
    if (!cue || typeof cue !== "object" || !Number.isFinite(cue.start) || !Number.isFinite(cue.end)
      || typeof cue.text !== "string" || cue.text.length > 5000) {
      return "cues contain an invalid cue.";
    }
  }
  return "";
}

const SUBTITLE_STYLE_PATCH_LIMITS = Object.freeze({
  positionX: [0, 100],
  positionY: [0, 100],
  width: [160, 32768]
});
const SUBTITLE_STYLE_BOOLEAN_PATCH_KEYS = new Set(["translationOnTop"]);

function isNonEmptyValue(value) {
  return (typeof value === "string" || typeof value === "number")
    && String(value).trim().length > 0;
}

function isOptionalString(value) {
  return value === undefined || typeof value === "string";
}

function validateSubtitleStylePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return "patch must be an object.";
  }
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !Object.hasOwn(SUBTITLE_STYLE_PATCH_LIMITS, key)
    && !SUBTITLE_STYLE_BOOLEAN_PATCH_KEYS.has(key))) {
    return "patch contains unsupported subtitle style fields.";
  }
  for (const key of keys) {
    const value = patch[key];
    if (SUBTITLE_STYLE_BOOLEAN_PATCH_KEYS.has(key)) {
      if (typeof value !== "boolean") return `patch.${key} must be a boolean.`;
      continue;
    }
    const [min, max] = SUBTITLE_STYLE_PATCH_LIMITS[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      return `patch.${key} must be between ${min} and ${max}.`;
    }
  }
  return "";
}

function isNvidiaAcademyCourseUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      && url.hostname === "www.nvidia.com"
      && /\/training\/academy\/course-player\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function isVimeoPageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      && ["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isOreillyVideoPageUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "www.oreilly.com" && url.pathname.startsWith("/videos/");
  } catch {
    return false;
  }
}

function isSupportedContentUrl(value, tabUrl) {
  try {
    const url = new URL(String(value || ""));
    // The O'Reilly player is an about:srcdoc frame inside a video page.
    if (["about:srcdoc", "about:blank"].includes(url.href) && isOreillyVideoPageUrl(tabUrl)) return true;
    if (url.protocol !== "https:") return false;
    if (url.hostname === "www.youtube.com" || url.hostname === "udemy.com" || url.hostname.endsWith(".udemy.com")) {
      return true;
    }
    if (["ted.com", "www.ted.com"].includes(url.hostname) && url.pathname.startsWith("/talks/")) return true;
    if (url.hostname === "www.coursera.org" && url.pathname.startsWith("/learn/")) return true;
    if (url.hostname === "www.linkedin.com" && url.pathname.startsWith("/learning/")) return true;
    if (url.hostname === "www.oreilly.com" && url.pathname.startsWith("/videos/")) return true;
    if (url.hostname === "learn.deeplearning.ai" && url.pathname.startsWith("/courses/")) return true;
    if (url.hostname === "www.nvidia.com" && /^\/[a-z]{2}-[a-z]{2}\/on-demand\/session\//i.test(url.pathname)) return true;
    if (isNvidiaAcademyCourseUrl(url.href)) return true;
    if (isVimeoPageUrl(url.href) && isVimeoPageUrl(tabUrl)) return true;
    return url.hostname === "player.vimeo.com"
      && (isNvidiaAcademyCourseUrl(tabUrl) || isVimeoPageUrl(tabUrl));
  } catch {
    return false;
  }
}

// With the generic player on, a frame of a site the user added is a content-script sender: the page
// (the tab) must be http(s), not a dedicated site, and on the user's list; the frame itself may be a
// cross-origin player or an about:blank/srcdoc frame inside it.
export function isGenericContentSender(sender = {}, genericState = {}) {
  if (genericState.enabled !== true) return false;
  if (!Number.isInteger(sender.tab?.id) || sender.tab.id < 0) return false;
  const tabUrl = String(sender.tab?.url || "");
  if (!isGenericEligibleUrl(tabUrl) || !isHostListed(genericState.allowedHosts, tabUrl)) return false;
  const frameUrl = String(sender.url || tabUrl);
  return Boolean(getHostname(frameUrl)) || /^about:(?:blank|srcdoc)$/.test(frameUrl);
}

export function validateMessageSender(message, sender = {}, extensionId = globalThis.chrome?.runtime?.id, { genericState } = {}) {
  if (!extensionId || sender.id !== extensionId) {
    return { ok: false, error: "Message sender is not this extension." };
  }

  const senderUrl = String(sender.url || sender.tab?.url || "");
  const isExtensionPage = senderUrl.startsWith(`chrome-extension://${extensionId}/`);
  const isContentScript = Number.isInteger(sender.tab?.id)
    && sender.tab.id >= 0
    && (isSupportedContentUrl(senderUrl, sender.tab?.url) || isGenericContentSender(sender, genericState));

  if (["settings.getSubtitleEnabled", "settings.setSubtitleEnabled"].includes(message?.type)
    && !isExtensionPage && !isContentScript) {
    return { ok: false, error: "Message requires an extension page or supported content script." };
  }
  if (EXTENSION_PAGE_MESSAGE_TYPES.has(message?.type) && !isExtensionPage) {
    return { ok: false, error: "Message is restricted to extension pages." };
  }
  if (CONTENT_SCRIPT_MESSAGE_TYPES.has(message?.type) && !isContentScript) {
    return { ok: false, error: "Message is restricted to supported content scripts." };
  }
  return { ok: true };
}

function validateSubtitleDocument(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return "document must be an object.";
  }
  if (!isNonEmptyValue(document.platform)) return "document.platform is required.";
  if (!isNonEmptyValue(document.videoId)) return "document.videoId is required.";
  if (!isNonEmptyValue(document.sourceLanguage)) return "document.sourceLanguage is required.";
  if (document.cues?.length > 20000) return "document.cues exceeds the 20000 cue limit.";
  const cueValidation = validateCues(document.cues);
  return cueValidation.ok ? "" : cueValidation.error;
}

export function validateBackgroundMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { handled: false, ok: false, error: "Message must be an object." };
  }
  if (!BACKGROUND_MESSAGE_TYPES.has(message.type)) {
    return { handled: false, ok: false, error: "Unknown message type." };
  }

  let error = "";
  switch (message.type) {
    case "llm.listModels":
      if (!message.provider || typeof message.provider !== "object" || !isNonEmptyValue(message.provider.id)) {
        error = "provider.id is required.";
      }
      break;
    case "llm.testActiveProvider":
      if (!isOptionalString(message.providerId)) error = "providerId must be a string.";
      break;
    case "settings.updateSubtitleStyle":
      error = validateSubtitleStylePatch(message.patch);
      break;
    case "settings.setSubtitleEnabled":
      if (typeof message.enabled !== "boolean") error = "enabled must be a boolean.";
      break;
    case "settings.setActiveProvider":
      if (!isNonEmptyValue(message.providerId)) error = "providerId is required.";
      break;
    case "settings.setTranslationStyle":
      if (!isNonEmptyValue(message.translationStyle)) error = "translationStyle is required.";
      break;
    case "settings.setTargetLanguage":
      if (typeof message.targetLanguage !== "string" || !message.targetLanguage.trim()) error = "targetLanguage is required.";
      break;
    case "settings.setSubtitleDisplayMode":
      if (!["dual", "source", "translated"].includes(message.mode)) error = "Unsupported subtitle display mode.";
      break;
    case "settings.setPlatformEnabled":
      if (!ALL_PLATFORM_IDS.includes(message.platform)) error = "Unsupported platform.";
      else if (typeof message.enabled !== "boolean") error = "enabled must be a boolean.";
      break;
    case "settings.setGenericPlayerEnabled":
      if (typeof message.enabled !== "boolean") error = "enabled must be a boolean.";
      break;
    case "settings.setGenericSiteAllowed":
      if (!normalizeGenericHost(message.host)) error = "host is invalid.";
      else if (typeof message.allowed !== "boolean") error = "allowed must be a boolean.";
      break;
    case "generic.prepareFrames":
      break;
    case "generic.attach":
      break;
    case "captions.generic.fetchTranscript":
      if (!GENERIC_SESSION_KEY_PATTERN.test(String(message.sessionKey || ""))) error = "sessionKey is invalid.";
      else if (!isHttpUrl(message.trackUrl)) error = "trackUrl must be an http(s) URL.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      else if (message.format !== undefined && !["auto", "hls"].includes(message.format)) error = "format must be auto or hls.";
      break;
    case "captions.generic.parseTranscript":
      if (!GENERIC_SESSION_KEY_PATTERN.test(String(message.sessionKey || ""))) error = "sessionKey is invalid.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      else if (message.text !== undefined) {
        if (typeof message.text !== "string" || !message.text.trim()) error = "text must be a non-empty string.";
        else if (message.text.length > GENERIC_TRANSCRIPT_MAX_CHARS) error = "text is too long.";
      } else {
        error = validateGenericCues(message.cues);
      }
      break;
    case "captions.generic.listHlsTracks":
      if (!Array.isArray(message.urls) || message.urls.length === 0 || message.urls.length > 5
        || !message.urls.every((url) => isHttpUrl(url))) {
        error = "urls must list 1 to 5 http(s) URLs.";
      }
      break;
    case "settings.setSourceCaptionLanguage":
      if (!ALL_PLATFORM_IDS.includes(message.platform)) error = "Unsupported platform.";
      else if (!/^[\w-]{1,35}$/.test(String(message.languageCode || ""))) error = "languageCode is invalid.";
      break;
    case "settings.setPreferYoutubeProvidedTranslation":
    case "settings.setWordProgressHighlight":
      if (typeof message.enabled !== "boolean") error = "enabled must be a boolean.";
      break;
    case "ast.providerMenu.setOpen":
      if (typeof message.open !== "boolean") error = "open must be a boolean.";
      break;
    case "captions.youtube.listTracks":
      if (!isNonEmptyValue(message.urlOrId)) error = "urlOrId is required.";
      break;
    case "captions.youtube.fetchTranscript":
      if (!isNonEmptyValue(message.videoId) && !isNonEmptyValue(message.urlOrId)) {
        error = "videoId or urlOrId is required.";
      }
      else if (!isOptionalString(message.captionTrackUrl)) error = "captionTrackUrl must be a string.";
      break;
    case "captions.udemy.listTracks":
    case "captions.udemy.fetchTranscript":
      if (!isNonEmptyValue(message.courseId)) error = "courseId is required.";
      else if (!isNonEmptyValue(message.lectureId)) error = "lectureId is required.";
      else if (!isNonEmptyValue(message.hostname)) error = "hostname is required.";
      else if (!isOptionalString(message.trackUrl)) error = "trackUrl must be a string.";
      break;
    case "captions.vimeo.fetchTranscript":
      if (!isNonEmptyValue(message.videoId)) error = "videoId is required.";
      else if (!isNonEmptyValue(message.trackUrl)) error = "trackUrl is required.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      else if (message.platform !== undefined && !["nvidia", "vimeo"].includes(message.platform)) {
        error = "platform must be nvidia or vimeo.";
      }
      break;
    case "captions.deeplearningai.fetchTranscript":
      if (!isNonEmptyValue(message.lessonId)) error = "lessonId is required.";
      else if (!isNonEmptyValue(message.trackUrl)) error = "trackUrl is required.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      break;
    case "captions.nvidiaOnDemand.listTracks":
    case "captions.nvidiaOnDemand.fetchTranscript":
      if (!/^[\w.-]{1,120}$/.test(String(message.sessionId || ""))) error = "sessionId is invalid.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      break;
    case "captions.oreilly.listTracks":
    case "captions.oreilly.fetchTranscript":
      if (!/^[\w.-]{1,120}$/.test(String(message.clipId || ""))) error = "clipId is invalid.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      break;
    case "captions.linkedin.fetchTranscript":
      if (!isNonEmptyValue(message.videoId)) error = "videoId is required.";
      else if (!isNonEmptyValue(message.trackUrl)) error = "trackUrl is required.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      break;
    case "captions.coursera.fetchTranscript":
      if (!isNonEmptyValue(message.videoId)) error = "videoId is required.";
      else if (!isNonEmptyValue(message.trackUrl)) error = "trackUrl is required.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      break;
    case "captions.ted.listTracks":
      if (!isNonEmptyValue(message.videoId)) error = "videoId is required.";
      else if (!isNonEmptyValue(message.manifestUrl)) error = "manifestUrl is required.";
      break;
    case "captions.ted.fetchTranscript":
      if (!isNonEmptyValue(message.videoId)) error = "videoId is required.";
      else if (!isNonEmptyValue(message.trackUrl)) error = "trackUrl is required.";
      else if (!isOptionalString(message.sourceLanguage)) error = "sourceLanguage must be a string.";
      break;
    case "translation.translateDocument":
      error = validateSubtitleDocument(message.document);
      if (!error && !isOptionalString(message.providerId)) error = "providerId must be a string.";
      if (!error && message.mode !== undefined && !["temporary", "final"].includes(message.mode)) {
        error = "mode must be temporary or final.";
      }
      if (!error && message.initialStartTime !== undefined
        && (!Number.isFinite(message.initialStartTime) || message.initialStartTime < 0)) {
        error = "initialStartTime must be a non-negative finite number.";
      }
      if (!error && message.forceNoCache !== undefined && typeof message.forceNoCache !== "boolean") {
        error = "forceNoCache must be a boolean.";
      }
      if (!error && !isOptionalString(message.requestId)) error = "requestId must be a string.";
      break;
    case "translation.setPriority":
      if (!isNonEmptyValue(message.requestId)) error = "requestId is required.";
      else if (!Number.isFinite(message.currentTime) || message.currentTime < 0) error = "currentTime must be a non-negative finite number.";
      break;
    case "translation.cancelRequest":
      if (!isNonEmptyValue(message.requestId)) error = "requestId is required.";
      break;
    case "translation.clearVideoCache":
      if (!isNonEmptyValue(message.platform)
        || !ALL_PLATFORM_IDS.includes(message.platform)) {
        error = "platform must be a supported video platform.";
      } else if (!isNonEmptyValue(message.videoId)) {
        error = "videoId is required.";
      }
      break;
    case "summary.generate":
      if (typeof message.text !== "string" || !message.text.trim()) error = "text is required.";
      else if (message.text.length > SUMMARY_TEXT_MAX_CHARS) error = "text is too long.";
      else if (!isOptionalString(message.title)) error = "title must be a string.";
      else if (!isOptionalString(message.requestId)) error = "requestId must be a string.";
      break;
    default:
      break;
  }

  return error
    ? { handled: true, ok: false, error }
    : { handled: true, ok: true };
}
