import { createSubtitleDocument, decodeXmlEntities, parseWebVtt, validateCues } from "../shared/subtitles.js";

// Caption files for the generic player can be on any site, so the worker fetches them only from
// public http(s) hosts, without cookies, with a size cap, and only keeps text that parses as captions.
export const GENERIC_CAPTION_MAX_BYTES = 5 * 1024 * 1024;
const HLS_MAX_SEGMENTS = 600;
const HLS_SEGMENT_CONCURRENCY = 4;
const HLS_MAX_MASTER_URLS = 5;

function parseUrl(value) {
  try {
    return new URL(String(value || ""));
  } catch {
    return null;
  }
}

function isPrivateIpv4(host) {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateIpv6(host) {
  const value = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!value.includes(":")) return false;
  return value === "::" || value === "::1"
    || /^f[cd][0-9a-f]{2}:/.test(value)
    || /^fe[89ab][0-9a-f]:/.test(value)
    || /^::ffff:/.test(value);
}

export function isAllowedGenericCaptionUrl(value) {
  const url = parseUrl(value);
  if (!url || !/^https?:$/.test(url.protocol) || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")
    || host.endsWith(".internal") || host.endsWith(".home.arpa")) return false;
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) return false;
  // A bare single-label name ("intranet") only resolves inside a private network.
  return host.includes(".") || host.includes(":");
}

async function fetchCaptionText(url, { fetchImpl = fetch } = {}) {
  if (!isAllowedGenericCaptionUrl(url)) throw new Error("Caption URL is not allowed.");
  const response = await fetchImpl(url, {
    credentials: "omit",
    redirect: "follow",
    headers: { Accept: "text/vtt,application/x-subrip,application/ttml+xml,application/vnd.apple.mpegurl,text/plain,*/*" }
  });
  if (response.url && !isAllowedGenericCaptionUrl(response.url)) throw new Error("Caption URL redirected to a disallowed address.");
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > GENERIC_CAPTION_MAX_BYTES) throw new Error("Caption file is too large.");
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText || "request failed"}`);
  if (text.length > GENERIC_CAPTION_MAX_BYTES) throw new Error("Caption file is too large.");
  return { text, url: response.url || url };
}

// ---- TTML / DFXP

function parseTtmlTime(value, { frameRate = 30, tickRate = 10000000 } = {}) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d+):(\d{2}):(\d{2})(?:[.,](\d+))?$/);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4] || 0}`);
  match = text.match(/^(\d+):(\d{2}):(\d{2}):(\d+(?:\.\d+)?)$/);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / frameRate;
  match = text.match(/^(\d+(?:\.\d+)?)(h|m|s|ms|f|t)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  return { h: amount * 3600, m: amount * 60, s: amount, ms: amount / 1000, f: amount / frameRate, t: amount / tickRate }[match[2]];
}

export function parseTtml(xml, { idPrefix = "ttml" } = {}) {
  const source = String(xml || "");
  const frameRate = Number(source.match(/ttp:frameRate="(\d+)"/)?.[1]) || 30;
  const tickRate = Number(source.match(/ttp:tickRate="(\d+)"/)?.[1]) || 10000000;
  const cues = [];
  for (const match of source.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const attributes = match[1];
    const start = parseTtmlTime(attributes.match(/\bbegin="([^"]+)"/)?.[1], { frameRate, tickRate });
    let end = parseTtmlTime(attributes.match(/\bend="([^"]+)"/)?.[1], { frameRate, tickRate });
    const duration = parseTtmlTime(attributes.match(/\bdur="([^"]+)"/)?.[1], { frameRate, tickRate });
    if (end === null && start !== null && duration !== null) end = start + duration;
    const text = decodeXmlEntities(match[2].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
    if (start === null || end === null || !text) continue;
    cues.push({ id: `${idPrefix}-${cues.length}`, start, end, text });
  }
  cues.sort((a, b) => a.start - b.start);
  // Reuse the WebVTT pipeline so zero-length and reversed cues are repaired the same way.
  return parseWebVtt(cuesToVtt(cues), { idPrefix });
}

function formatVttTime(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = value - hours * 3600 - minutes * 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${rest.toFixed(3).padStart(6, "0")}`;
}

function cuesToVtt(cues) {
  const lines = ["WEBVTT", ""];
  cues.forEach((cue, index) => {
    const text = String(cue.text || "").replace(/-->/g, "->").replace(/\r?\n\s*\r?\n/g, "\n").trim();
    if (!text) return;
    lines.push(String(cue.id ?? index), `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}`, text, "");
  });
  return lines.join("\n");
}

// ---- HLS

function parseHlsAttributes(value) {
  const attributes = {};
  for (const match of String(value || "").matchAll(/([A-Z0-9-]+)=("(?:[^"\\]|\\.)*"|[^,]*)/g)) {
    attributes[match[1]] = match[2].startsWith('"') ? match[2].slice(1, -1) : match[2];
  }
  return attributes;
}

export function parseHlsSubtitleTracks(playlist, baseUrl) {
  const tracks = [];
  for (const line of String(playlist || "").split(/\r?\n/)) {
    if (!line.startsWith("#EXT-X-MEDIA:")) continue;
    const attributes = parseHlsAttributes(line.slice("#EXT-X-MEDIA:".length));
    if (attributes.TYPE !== "SUBTITLES" || !attributes.URI || attributes.FORCED === "YES") continue;
    let url;
    try {
      url = new URL(attributes.URI, baseUrl).href;
    } catch {
      continue;
    }
    if (!isAllowedGenericCaptionUrl(url) || tracks.some((track) => track.trackUrl === url)) continue;
    const languageCode = String(attributes.LANGUAGE || "").trim();
    tracks.push({
      languageCode,
      label: attributes.NAME || languageCode || "Subtitles",
      // Some packagers mark machine captions in the name ("English (auto-generated)").
      isAutoGenerated: /auto[- ]?generated|automatic/i.test(attributes.NAME || ""),
      trackUrl: url,
      format: "hls"
    });
  }
  return tracks;
}

export function parseHlsMediaSegments(playlist, baseUrl) {
  const segments = [];
  for (const rawLine of String(playlist || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      const url = new URL(line, baseUrl).href;
      if (isAllowedGenericCaptionUrl(url)) segments.push(url);
    } catch {
      // Skip malformed segment lines.
    }
  }
  return segments;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  }));
  return results;
}

// Segment times are taken as written: VOD packagers (Kaltura, DeepLearning.AI) write media times
// with an X-TIMESTAMP-MAP that matches the video's own start, so no offset is applied.
export function mergeSegmentCues(cueLists) {
  const seen = new Set();
  const merged = [];
  for (const cue of cueLists.flat()) {
    const key = `${cue.start.toFixed(3)}|${cue.end.toFixed(3)}|${cue.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(cue);
  }
  merged.sort((a, b) => a.start - b.start || a.end - b.end);
  return merged.map((cue, index) => ({ ...cue, id: `hls-${index}` }));
}

function parseSegmentSafely(text) {
  try {
    return parseWebVtt(text, { idPrefix: "seg" });
  } catch {
    return [];
  }
}

async function fetchHlsCues(playlistUrl, options) {
  const { text, url } = await fetchCaptionText(playlistUrl, options);
  if (!text.trimStart().startsWith("#EXTM3U")) return parseCaptionText(text);
  const subtitleTracks = parseHlsSubtitleTracks(text, url);
  if (subtitleTracks.length > 0) {
    // A master playlist was given: use its first subtitle rendition.
    return fetchHlsCues(subtitleTracks[0].trackUrl, options);
  }
  const segments = parseHlsMediaSegments(text, url);
  if (segments.length === 0) throw new Error("No captions are available for this video.");
  if (segments.length > HLS_MAX_SEGMENTS) throw new Error("The subtitle playlist has too many segments.");
  const cueLists = await mapWithConcurrency(segments, HLS_SEGMENT_CONCURRENCY, async (segmentUrl) => {
    const segment = await fetchCaptionText(segmentUrl, options);
    return parseSegmentSafely(segment.text);
  });
  const cues = mergeSegmentCues(cueLists);
  if (cues.length === 0) throw new Error("No captions are available for this video.");
  return parseWebVtt(cuesToVtt(cues), { idPrefix: "hls" });
}

// ---- documents

export function detectCaptionFormat(text) {
  const head = String(text || "").replace(/^﻿/, "").trimStart().slice(0, 200);
  if (head.startsWith("#EXTM3U")) return "hls";
  if (head.startsWith("WEBVTT")) return "vtt";
  if (/^<\?xml|^<tt[\s>]|^<tt:tt[\s>]/i.test(head) || /<tt\b[^>]*xmlns/i.test(String(text).slice(0, 2000))) return "ttml";
  if (/^\d+\s*\r?\n\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(head)) return "srt";
  if (/^\d{1,2}:\d{2}(?::\d{2})?[,.]\d{3}\s*-->/.test(head)) return "vtt";
  return "";
}

export function parseCaptionText(text) {
  const format = detectCaptionFormat(text);
  if (format === "ttml") return parseTtml(text, { idPrefix: "generic" });
  if (format === "vtt" || format === "srt") return parseWebVtt(text, { idPrefix: "generic" });
  throw new Error("No captions are available for this video.");
}

function toDocument({ sessionKey, sourceLanguage, cues }) {
  return createSubtitleDocument({
    platform: "generic",
    videoId: String(sessionKey),
    sourceLanguage: String(sourceLanguage || "auto"),
    cues
  });
}

export async function fetchGenericTranscript({ sessionKey, trackUrl, sourceLanguage, format = "auto" }, options = {}) {
  const cues = format === "hls"
    ? await fetchHlsCues(trackUrl, options)
    : await (async () => {
      const { text, url } = await fetchCaptionText(trackUrl, options);
      return detectCaptionFormat(text) === "hls" ? fetchHlsCues(url, options) : parseCaptionText(text);
    })();
  return toDocument({ sessionKey, sourceLanguage, cues });
}

// Text the page fetched itself (same-origin files), or cues read from the player's text tracks.
export function parseGenericTranscript({ sessionKey, sourceLanguage, text, cues }) {
  if (typeof text === "string") return toDocument({ sessionKey, sourceLanguage, cues: parseCaptionText(text) });
  const sorted = [...cues]
    .map((cue) => ({ start: Number(cue.start), end: Number(cue.end), text: String(cue.text || "") }))
    .filter((cue) => cue.text.trim())
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const parsed = parseWebVtt(cuesToVtt(sorted.map((cue, index) => ({ ...cue, id: `track-${index}` }))), { idPrefix: "track" });
  const validation = validateCues(parsed);
  if (!validation.ok) throw new Error(validation.error);
  return toDocument({ sessionKey, sourceLanguage, cues: parsed });
}

export async function listGenericHlsTracks({ urls }, options = {}) {
  for (const candidate of urls.slice(0, HLS_MAX_MASTER_URLS)) {
    if (!isAllowedGenericCaptionUrl(candidate)) continue;
    try {
      const { text, url } = await fetchCaptionText(candidate, options);
      if (!text.trimStart().startsWith("#EXTM3U")) continue;
      const tracks = parseHlsSubtitleTracks(text, url);
      if (tracks.length > 0) return tracks;
    } catch {
      // Try the next candidate playlist.
    }
  }
  return [];
}

export const genericCaptionInternals = { cuesToVtt, parseTtmlTime, fetchCaptionText };
