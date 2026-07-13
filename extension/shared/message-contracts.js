import { validateCues } from "./subtitles.js";

const BACKGROUND_MESSAGE_TYPES = new Set([
  "llm.listModels",
  "llm.testActiveProvider",
  "settings.getPublic",
  "settings.updateSubtitleStyle",
  "settings.setActiveProvider",
  "settings.setTranslationStyle",
  "ast.openOptions",
  "captions.youtube.listTracks",
  "captions.youtube.fetchTranscript",
  "captions.udemy.listTracks",
  "captions.udemy.fetchTranscript",
  "captions.vimeo.fetchTranscript",
  "platform.nvidia.isCoursePlayer",
  "platform.vimeo.getContext",
  "translation.translateDocument",
  "translation.clearCache"
]);

const EXTENSION_PAGE_MESSAGE_TYPES = new Set([
  "llm.listModels",
  "llm.testActiveProvider",
  "translation.clearCache"
]);

const CONTENT_SCRIPT_MESSAGE_TYPES = new Set([
  "settings.getPublic",
  "settings.updateSubtitleStyle",
  "settings.setActiveProvider",
  "settings.setTranslationStyle",
  "ast.openOptions",
  "captions.youtube.listTracks",
  "captions.youtube.fetchTranscript",
  "captions.udemy.listTracks",
  "captions.udemy.fetchTranscript",
  "captions.vimeo.fetchTranscript",
  "platform.nvidia.isCoursePlayer",
  "platform.vimeo.getContext",
  "translation.translateDocument"
]);

const SUBTITLE_STYLE_PATCH_LIMITS = Object.freeze({
  positionX: [0, 100],
  positionY: [0, 100],
  width: [160, 1400]
});

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
  if (keys.length === 0 || keys.some((key) => !Object.hasOwn(SUBTITLE_STYLE_PATCH_LIMITS, key))) {
    return "patch contains unsupported subtitle style fields.";
  }
  for (const key of keys) {
    const value = patch[key];
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

function isSupportedContentUrl(value, tabUrl) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return false;
    if (url.hostname === "www.youtube.com" || url.hostname === "udemy.com" || url.hostname.endsWith(".udemy.com")) {
      return true;
    }
    if (isNvidiaAcademyCourseUrl(url.href)) return true;
    if (isVimeoPageUrl(url.href) && isVimeoPageUrl(tabUrl)) return true;
    return url.hostname === "player.vimeo.com"
      && (isNvidiaAcademyCourseUrl(tabUrl) || isVimeoPageUrl(tabUrl));
  } catch {
    return false;
  }
}

export function validateMessageSender(message, sender = {}, extensionId = globalThis.chrome?.runtime?.id) {
  if (!extensionId || sender.id !== extensionId) {
    return { ok: false, error: "Message sender is not this extension." };
  }

  const senderUrl = String(sender.url || sender.tab?.url || "");
  const isExtensionPage = senderUrl.startsWith(`chrome-extension://${extensionId}/`);
  const isContentScript = Number.isInteger(sender.tab?.id)
    && sender.tab.id >= 0
    && isSupportedContentUrl(senderUrl, sender.tab?.url);

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
    case "settings.setActiveProvider":
      if (!isNonEmptyValue(message.providerId)) error = "providerId is required.";
      break;
    case "settings.setTranslationStyle":
      if (!isNonEmptyValue(message.translationStyle)) error = "translationStyle is required.";
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
      if (!error && !isOptionalString(message.requestId)) error = "requestId must be a string.";
      break;
    default:
      break;
  }

  return error
    ? { handled: true, ok: false, error }
    : { handled: true, ok: true };
}
