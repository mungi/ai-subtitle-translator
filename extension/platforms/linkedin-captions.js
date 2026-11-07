import { createSubtitleDocument, parseWebVtt } from "../shared/subtitles.js";

const LINKEDIN_CAPTION_HOST = "dms.licdn.com";
const LINKEDIN_CAPTION_PATH_MARKER = "/video-captions-webvtt/";

export function isLinkedinCaptionUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      && url.hostname === LINKEDIN_CAPTION_HOST
      && url.pathname.startsWith("/playlist/vid/")
      && url.pathname.includes(LINKEDIN_CAPTION_PATH_MARKER);
  } catch {
    return false;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "error",
    headers: { Accept: "text/vtt,text/plain,*/*" }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return text;
}

export async function fetchLinkedinTranscript({ videoId, trackUrl, sourceLanguage }) {
  if (!videoId) throw new Error("LinkedIn Learning videoId is required.");
  if (!isLinkedinCaptionUrl(trackUrl)) throw new Error("LinkedIn Learning caption URL is invalid.");

  const cues = parseWebVtt(await fetchText(trackUrl), { idPrefix: "linkedin" });
  return createSubtitleDocument({
    platform: "linkedin",
    videoId: String(videoId),
    sourceLanguage: String(sourceLanguage || "en"),
    cues
  });
}
