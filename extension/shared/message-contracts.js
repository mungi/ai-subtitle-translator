import { validateCues } from "./subtitles.js";

const BACKGROUND_MESSAGE_TYPES = new Set([
  "llm.listModels",
  "llm.testActiveProvider",
  "settings.setActiveProvider",
  "ast.openOptions",
  "captions.youtube.listTracks",
  "captions.youtube.fetchTranscript",
  "captions.udemy.listTracks",
  "captions.udemy.fetchTranscript",
  "translation.translateDocument",
  "translation.clearCache"
]);

function isNonEmptyValue(value) {
  return (typeof value === "string" || typeof value === "number")
    && String(value).trim().length > 0;
}

function isOptionalString(value) {
  return value === undefined || typeof value === "string";
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
    case "settings.setActiveProvider":
      if (!isNonEmptyValue(message.providerId)) error = "providerId is required.";
      break;
    case "captions.youtube.listTracks":
      if (!isNonEmptyValue(message.urlOrId)) error = "urlOrId is required.";
      break;
    case "captions.youtube.fetchTranscript":
      if (!isNonEmptyValue(message.videoId) && !isNonEmptyValue(message.urlOrId)) {
        error = "videoId or urlOrId is required.";
      }
      break;
    case "captions.udemy.listTracks":
    case "captions.udemy.fetchTranscript":
      if (!isNonEmptyValue(message.courseId)) error = "courseId is required.";
      else if (!isNonEmptyValue(message.lectureId)) error = "lectureId is required.";
      else if (!isNonEmptyValue(message.hostname)) error = "hostname is required.";
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
