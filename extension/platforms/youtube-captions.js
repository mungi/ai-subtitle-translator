import { createSubtitleDocument, decodeXmlEntities, normalizeCue, parseWebVtt, validateCues } from "../shared/subtitles.js";

const VIDEO_ID_PATTERN = /(?:v=|\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&/#]|$)/;
const TRANSCRIPT_TEXT_PATTERN = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
const TRANSCRIPT_P_PATTERN = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;
const ATTRIBUTE_PATTERN = /(\w+)="([^"]*)"/g;
const ANDROID_INNERTUBE_CONTEXT = {
  client: {
    clientName: "ANDROID",
    clientVersion: "20.10.38"
  }
};

export function getYoutubeVideoId(urlOrId) {
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) {
    return urlOrId;
  }

  const match = String(urlOrId).match(VIDEO_ID_PATTERN);
  if (!match) {
    throw new Error("Invalid YouTube video id or URL.");
  }

  return match[1];
}

function readTrackName(track) {
  return track.name?.simpleText
    || track.name?.runs?.map((run) => run.text).join("")
    || track.languageCode
    || "Unknown";
}

function parseJsonObjectAfter(text, marker, startIndex = 0) {
  const markerIndex = String(text).indexOf(marker, startIndex);
  if (markerIndex < 0) return null;

  const objectStart = String(text).indexOf("{", markerIndex);
  if (objectStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(objectStart, index + 1));
        } catch (_error) {
          return null;
        }
      }
    }
  }

  return null;
}

function parseYtcfg(html) {
  const merged = {};
  let cursor = 0;

  while (cursor < html.length) {
    const markerIndex = html.indexOf("ytcfg.set(", cursor);
    if (markerIndex < 0) break;
    const parsed = parseJsonObjectAfter(html, "ytcfg.set(", markerIndex);
    if (parsed) {
      Object.assign(merged, parsed);
    }
    cursor = markerIndex + "ytcfg.set(".length;
  }

  return merged;
}

function parseInitialPlayerResponse(html) {
  return parseJsonObjectAfter(html, "ytInitialPlayerResponse");
}

function parseInnertubeApiKey(html, ytcfg = parseYtcfg(html)) {
  if (ytcfg?.INNERTUBE_API_KEY) {
    return ytcfg.INNERTUBE_API_KEY;
  }

  const match = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)
    || html.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);

  if (!match) {
    throw new Error("Could not find YouTube Innertube API key.");
  }

  return match[1];
}

function buildInnertubeContext(ytcfg = {}) {
  if (ytcfg.INNERTUBE_CONTEXT) {
    return ytcfg.INNERTUBE_CONTEXT;
  }

  return {
    client: {
      clientName: "WEB",
      clientVersion: ytcfg.INNERTUBE_CLIENT_VERSION || "2.20260706.00.00"
    }
  };
}

function buildAndroidInnertubeContext() {
  return JSON.parse(JSON.stringify(ANDROID_INNERTUBE_CONTEXT));
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = body.error?.message || body.message || response.statusText;
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  return body;
}

async function fetchText(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return text;
}

export async function fetchYoutubeCaptionTracks(urlOrId) {
  const videoId = getYoutubeVideoId(urlOrId);
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const html = await fetchText(watchUrl, {
    credentials: "include",
    headers: {
      "Accept-Language": "en"
    }
  });
  const initialTracks = normalizeYoutubeCaptionTracks(parseInitialPlayerResponse(html), videoId);
  if (initialTracks.length > 0) {
    return initialTracks;
  }

  const ytcfg = parseYtcfg(html);
  const apiKey = parseInnertubeApiKey(html, ytcfg);
  const playerJson = await fetchYoutubeAndroidPlayer(videoId, apiKey);

  const tracks = normalizeYoutubeCaptionTracks(playerJson, videoId);

  if (tracks.length === 0) {
    throw new Error("No YouTube captions are available for this video.");
  }

  return tracks;
}

async function fetchYoutubeAndroidPlayer(videoId, apiKey, languageCode) {
  return fetchJson(`https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": languageCode || "en"
    },
    body: JSON.stringify({
      context: buildAndroidInnertubeContext(),
      videoId,
      contentCheckOk: true,
      racyCheckOk: true
    })
  });
}

async function fetchYoutubeAndroidCaptionTracks({ videoId, urlOrId, apiKey, languageCode }) {
  let resolvedApiKey = apiKey;
  if (!resolvedApiKey) {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId || getYoutubeVideoId(urlOrId))}`;
    const html = await fetchText(watchUrl, {
      credentials: "include",
      headers: {
        "Accept-Language": languageCode || "en"
      }
    });
    resolvedApiKey = parseInnertubeApiKey(html, parseYtcfg(html));
  }

  const resolvedVideoId = videoId || getYoutubeVideoId(urlOrId);
  const playerJson = await fetchYoutubeAndroidPlayer(resolvedVideoId, resolvedApiKey, languageCode);
  const tracks = normalizeYoutubeCaptionTracks(playerJson, resolvedVideoId);
  if (tracks.length === 0) {
    throw new Error("No YouTube captions are available for this video.");
  }
  return tracks;
}

function normalizeYoutubeCaptionTracks(playerJson, videoId) {
  const renderer = playerJson?.captions?.playerCaptionsTracklistRenderer
    || playerJson?.playerCaptionsTracklistRenderer;
  const tracks = renderer?.captionTracks;

  if (!Array.isArray(tracks)) {
    return [];
  }

  return tracks.map((track) => ({
    videoId,
    languageCode: track.languageCode,
    label: readTrackName(track),
    isAutoGenerated: track.kind === "asr",
    baseUrl: track.baseUrl || track.url
  }));
}

function normalizeProvidedCaptionTracks(tracks, videoId) {
  if (!Array.isArray(tracks)) {
    return [];
  }

  return tracks
    .map((track) => ({
      videoId: track.videoId || videoId,
      languageCode: track.languageCode,
      label: track.label || readTrackName(track),
      isAutoGenerated: Boolean(track.isAutoGenerated || track.kind === "asr"),
      baseUrl: track.baseUrl || track.url
    }))
    .filter((track) => track.baseUrl);
}

function isEnglishTrack(track) {
  const languageCode = String(track.languageCode || "").toLowerCase();
  const label = String(track.label || "").toLowerCase();

  return languageCode === "en"
    || languageCode.startsWith("en-")
    || label.includes("english");
}

function isManualTrack(track) {
  return !track.isAutoGenerated;
}

function matchesLanguage(track, languageCode) {
  return String(track.languageCode || "").toLowerCase() === String(languageCode || "").toLowerCase();
}

function selectCaptionTrack(tracks, languageCode) {
  if (languageCode) {
    const languageTrack = tracks.find((track) => matchesLanguage(track, languageCode) && isManualTrack(track))
      || tracks.find((track) => matchesLanguage(track, languageCode));
    if (languageTrack) return languageTrack;
  }

  if (tracks.length === 1) return tracks[0];
  return tracks.find((track) => isEnglishTrack(track) && isManualTrack(track))
    || tracks.find(isEnglishTrack)
    || tracks[0];
}

function parseAttributes(value) {
  const attributes = {};
  for (const match of value.matchAll(ATTRIBUTE_PATTERN)) {
    attributes[match[1]] = decodeXmlEntities(match[2]);
  }
  return attributes;
}

export function parseYoutubeTranscriptXml(xml) {
  const cues = [];
  let index = 0;

  for (const match of xml.matchAll(TRANSCRIPT_TEXT_PATTERN)) {
    const attributes = parseAttributes(match[1]);
    const start = Number(attributes.start);
    const duration = Number(attributes.dur || 0);
    const text = decodeXmlEntities(match[2]).replace(/\n/g, " ").trim();

    if (!Number.isFinite(start) || !Number.isFinite(duration) || !text) {
      continue;
    }

    cues.push(normalizeCue({
      id: `yt-${index}`,
      start,
      end: start + Math.max(duration, 0.001),
      text
    }));
    index += 1;
  }

  const validation = validateCues(cues);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return cues;
}

export function parseYoutubeTranscriptJson3(jsonText) {
  const body = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
  const cues = [];

  for (const event of body?.events || []) {
    const text = (event.segs || [])
      .map((segment) => segment?.utf8 || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    const startMs = Number(event.tStartMs);
    const durationMs = Number(event.dDurationMs || 0);

    if (!Number.isFinite(startMs) || !Number.isFinite(durationMs) || !text) {
      continue;
    }

    const start = startMs / 1000;
    cues.push(normalizeCue({
      id: `yt-${cues.length}`,
      start,
      end: start + Math.max(durationMs / 1000, 0.001),
      text
    }));
  }

  const validation = validateCues(cues);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return cues;
}

export function parseYoutubeTranscriptSrv3(xml) {
  const cues = [];

  for (const match of xml.matchAll(TRANSCRIPT_P_PATTERN)) {
    const attributes = parseAttributes(match[1]);
    const startMs = Number(attributes.t);
    const durationMs = Number(attributes.d || 0);
    const text = decodeXmlEntities(match[2])
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!Number.isFinite(startMs) || !Number.isFinite(durationMs) || !text) {
      continue;
    }

    const start = startMs / 1000;
    cues.push(normalizeCue({
      id: `yt-${cues.length}`,
      start,
      end: start + Math.max(durationMs / 1000, 0.001),
      text
    }));
  }

  const validation = validateCues(cues);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return cues;
}

function parseYoutubeTranscriptPayload(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("Transcript response is empty.");
  }
  if (trimmed.startsWith("{")) {
    return parseYoutubeTranscriptJson3(trimmed);
  }
  if (trimmed.startsWith("WEBVTT")) {
    return parseWebVtt(trimmed, { idPrefix: "yt" });
  }

  try {
    return parseYoutubeTranscriptXml(trimmed);
  } catch (error) {
    if (trimmed.startsWith("WEBVTT")) {
      return parseWebVtt(trimmed, { idPrefix: "yt" });
    }
    if (trimmed.includes("<p")) {
      return parseYoutubeTranscriptSrv3(trimmed);
    }
    throw error;
  }
}

function readTextValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (value.simpleText) return value.simpleText;
  if (Array.isArray(value.runs)) {
    return value.runs.map((run) => run.text || "").join("");
  }
  if (value.content) return value.content;
  return "";
}

function collectTranscriptCueRenderers(value, output = []) {
  if (!value || typeof value !== "object") return output;

  for (const [key, child] of Object.entries(value)) {
    if (key === "transcriptCueRenderer" && child && typeof child === "object") {
      output.push(child);
      continue;
    }
    collectTranscriptCueRenderers(child, output);
  }

  return output;
}

export function parseYoutubeTranscriptPanelResponse(body) {
  const cues = [];

  for (const renderer of collectTranscriptCueRenderers(body)) {
    const text = readTextValue(renderer.cue || renderer.snippet || renderer.text)
      .replace(/\s+/g, " ")
      .trim();
    const startMs = Number(renderer.startOffsetMs ?? renderer.startMs ?? renderer.startTimeMs);
    const durationMs = Number(renderer.durationMs ?? renderer.duration ?? 0);

    if (!Number.isFinite(startMs) || !Number.isFinite(durationMs) || !text) {
      continue;
    }

    const start = startMs / 1000;
    cues.push(normalizeCue({
      id: `yt-panel-${cues.length}`,
      start,
      end: start + Math.max(durationMs / 1000, 0.001),
      text
    }));
  }

  const validation = validateCues(cues);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  return cues;
}

function decodeTranscriptParams(params) {
  try {
    return decodeURIComponent(params);
  } catch (_error) {
    return params;
  }
}

async function fetchYoutubeTranscriptPanel({ params, apiKey, context, languageCode }) {
  if (!params || !apiKey) {
    throw new Error("YouTube transcript panel data is missing.");
  }

  const client = context?.client || {};
  const headers = {
    "Content-Type": "application/json",
    "Accept-Language": languageCode || client.hl || "en"
  };
  if (client.clientName === "WEB") {
    headers["X-Youtube-Client-Name"] = "1";
  }
  if (client.clientVersion) {
    headers["X-Youtube-Client-Version"] = client.clientVersion;
  }

  const body = await fetchJson(`https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      context: context || buildInnertubeContext(),
      params: decodeTranscriptParams(params)
    })
  });

  return parseYoutubeTranscriptPanelResponse(body);
}

function isTranscriptPanelPageRetryError(error) {
  return /\bHTTP (401|403)\b/.test(String(error?.message || error || ""));
}

function setUrlParam(url, key, value) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch (_error) {
    const separator = String(url).includes("?") ? "&" : "?";
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

function removeUrlParam(url, key) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete(key);
    return parsed.toString();
  } catch (_error) {
    return String(url).replace(new RegExp(`([?&])${key}=[^&]+&?`), "$1").replace(/[?&]$/, "");
  }
}

function getTranscriptUrlCandidates(baseUrl, { preferPlainXml = false } = {}) {
  const urls = [];
  const add = (url) => {
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  };

  if (preferPlainXml) {
    add(removeUrlParam(baseUrl, "fmt"));
  }
  add(String(baseUrl));
  for (const format of ["json3", "srv3", "vtt"]) {
    add(setUrlParam(baseUrl, "fmt", format));
  }

  const withoutFmt = removeUrlParam(baseUrl, "fmt");
  if (withoutFmt !== String(baseUrl)) {
    add(withoutFmt);
  }
  return urls;
}

async function fetchCuesFromYoutubeTrack(track, { preferPlainXml = false } = {}) {
  let lastError = null;
  for (const transcriptUrl of getTranscriptUrlCandidates(track.baseUrl, { preferPlainXml })) {
    try {
      const payload = await fetchText(transcriptUrl, {
        credentials: "include",
        referrer: getYoutubeWatchUrl(track.videoId),
        headers: {
          Accept: "application/json,text/xml,text/plain,*/*",
          "Accept-Language": track.languageCode || "en"
        }
      });
      return parseYoutubeTranscriptPayload(payload);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Could not parse YouTube transcript.");
}

function getYoutubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export async function fetchYoutubeTranscript({
  urlOrId,
  videoId,
  languageCode,
  captionTrackUrl,
  captionTracks,
  transcriptParams,
  innertubeApiKey,
  innertubeContext
} = {}) {
  const resolvedVideoId = videoId || getYoutubeVideoId(urlOrId);
  const pageTracks = normalizeProvidedCaptionTracks(captionTracks, resolvedVideoId);
  const tracks = pageTracks.length > 0 ? pageTracks : await fetchYoutubeCaptionTracks(urlOrId || resolvedVideoId);
  const selectedTrack = (captionTrackUrl && tracks.find((track) => track.baseUrl === captionTrackUrl))
    || selectCaptionTrack(tracks, languageCode);

  if (!selectedTrack) {
    throw new Error(`No YouTube caption track found for language: ${languageCode}`);
  }

  if (!selectedTrack.baseUrl) {
    throw new Error("Selected YouTube caption track is missing baseUrl.");
  }

  let lastError = null;
  let cues = null;
  try {
    cues = await fetchCuesFromYoutubeTrack(selectedTrack);
  } catch (error) {
    lastError = error;
  }

  if (!cues) {
    try {
      const androidTracks = await fetchYoutubeAndroidCaptionTracks({
        videoId: resolvedVideoId,
        urlOrId,
        apiKey: innertubeApiKey,
        languageCode: languageCode || selectedTrack.languageCode
      });
      const androidTrack = selectCaptionTrack(androidTracks, languageCode || selectedTrack.languageCode);
      if (androidTrack?.baseUrl && androidTrack.baseUrl !== selectedTrack.baseUrl) {
        cues = await fetchCuesFromYoutubeTrack(androidTrack, { preferPlainXml: true });
      }
    } catch (error) {
      const prefix = lastError?.message ? `${lastError.message}; ` : "";
      lastError = new Error(`${prefix}android player fallback failed: ${error.message}`);
    }
  }

  if (!cues && transcriptParams && innertubeApiKey) {
    try {
      cues = await fetchYoutubeTranscriptPanel({
        params: transcriptParams,
        apiKey: innertubeApiKey,
        context: innertubeContext,
        languageCode: selectedTrack.languageCode
      });
    } catch (error) {
      const prefix = lastError?.message ? `${lastError.message}; ` : "";
      lastError = new Error(`${prefix}transcript panel fallback failed: ${error.message}`);
      if (isTranscriptPanelPageRetryError(error)) {
        lastError.retryOnPage = {
          type: "youtubeTranscriptPanel",
          videoId: selectedTrack.videoId,
          languageCode: selectedTrack.languageCode,
          params: transcriptParams,
          innertubeApiKey,
          innertubeContext
        };
      }
    }
  }

  if (!cues) {
    throw lastError || new Error("Could not parse YouTube transcript.");
  }

  return createSubtitleDocument({
    platform: "youtube",
    videoId: selectedTrack.videoId,
    sourceLanguage: selectedTrack.languageCode,
    cues
  });
}

export const youtubeCaptionInternals = {
  isEnglishTrack,
  selectCaptionTrack,
  getTranscriptUrlCandidates,
  parseYoutubeTranscriptPayload,
  parseYoutubeTranscriptPanelResponse,
  parseInitialPlayerResponse,
  parseYtcfg
};
