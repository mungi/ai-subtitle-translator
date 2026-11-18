import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  fetchVimeoLiveSegments,
  fetchVimeoLiveTranscript,
  getVimeoLiveSegmentOffset,
  parseVimeoLiveSegmentPlaylist,
  fetchVimeoTranscript,
  isVimeoCaptionUrl,
  isVimeoLiveSubtitleFileUrl,
  isVimeoLiveSubtitleUrl,
  normalizeVimeoTextTrack,
  parseVimeoLiveSubtitles,
  selectVimeoTextTrack
} from "../extension/platforms/vimeo-captions.js";

test("Vimeo caption tracks prefer human English over automatic English", () => {
  const tracks = [
    normalizeVimeoTextTrack({
      lang: "en-x-autogen",
      kind: "subtitles",
      url: "https://captions.vimeo.com/captions/automatic.vtt"
    }, { videoId: "1191467672" }),
    normalizeVimeoTextTrack({
      lang: "en",
      kind: "subtitles",
      url: "https://captions.vimeo.com/captions/english.vtt"
    }, { videoId: "1191467672" })
  ];

  assert.equal(selectVimeoTextTrack(tracks).languageCode, "en");
  assert.equal(selectVimeoTextTrack(tracks, "en-x-autogen").languageCode, "en-x-autogen");
});

test("Vimeo caption selection keeps a sole track, then prefers English manual and automatic tracks", () => {
  const koreanOnly = normalizeVimeoTextTrack({
    lang: "ko",
    url: "https://captions.vimeo.com/captions/korean.vtt"
  }, { videoId: "1191467672" });
  const englishAutomatic = normalizeVimeoTextTrack({
    lang: "en-x-autogen",
    url: "https://captions.vimeo.com/captions/automatic.vtt"
  }, { videoId: "1191467672" });
  const japaneseManual = normalizeVimeoTextTrack({
    lang: "ja",
    url: "https://captions.vimeo.com/captions/japanese.vtt"
  }, { videoId: "1191467672" });

  assert.equal(selectVimeoTextTrack([koreanOnly]), koreanOnly);
  assert.equal(selectVimeoTextTrack([japaneseManual, englishAutomatic]), englishAutomatic);
  assert.equal(selectVimeoTextTrack([japaneseManual]), japaneseManual);
});

test("Vimeo caption URLs are restricted to the captions host", () => {
  assert.equal(isVimeoCaptionUrl("https://captions.vimeo.com/captions/123.vtt"), true);
  assert.equal(isVimeoCaptionUrl("https://captions.cloud.vimeo.com/captions/123.vtt"), true);
  assert.equal(isVimeoCaptionUrl("https://player.vimeo.com/video/123"), false);
  assert.equal(normalizeVimeoTextTrack({
    lang: "en",
    url: "https://example.com/captions.vtt"
  }, { videoId: "123" }), null);
});

test("Vimeo VTT captions are normalized into the requested subtitle document platform", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://captions.vimeo.com/captions/300610662.vtt");
    assert.equal(init.redirect, "error");
    return new Response(`WEBVTT\n\n1\n00:00:00.000 --> 00:00:01.500\nHello <i>Vimeo</i>.\n`, {
      status: 200,
      headers: { "Content-Type": "text/vtt" }
    });
  };

  try {
    const document = await fetchVimeoTranscript({
      videoId: "1191467672",
      trackUrl: "https://captions.vimeo.com/captions/300610662.vtt",
      sourceLanguage: "en-x-autogen"
    });
    assert.deepEqual(document, {
      platform: "nvidia",
      videoId: "1191467672",
      sourceLanguage: "en-x-autogen",
      cues: [{ id: "1", start: 0, end: 1.5, text: "Hello Vimeo." }]
    });
    const vimeoDocument = await fetchVimeoTranscript({
      videoId: "1191467672",
      trackUrl: "https://captions.vimeo.com/captions/300610662.vtt",
      sourceLanguage: "en",
      platform: "vimeo"
    });
    assert.equal(vimeoDocument.platform, "vimeo");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("NVIDIA Academy and Vimeo use Vimeo's bottom control bar and a visible provider menu", async () => {
  const [contentScript, contentStyle] = await Promise.all([
    readFile(new URL("../extension/content/content-script.js", import.meta.url), "utf8"),
    readFile(new URL("../extension/content/content-style.css", import.meta.url), "utf8")
  ]);

  assert.match(contentScript, /function findVimeoPlayerControls\(\)/);
  assert.match(contentScript, /\.vp-controls \[data-prefs-button\]/);
  assert.match(contentScript, /document\.querySelector\("\.vp-player-ui-overlays"\) \|\| video\?\.parentElement/);
  assert.match(contentScript, /function isVimeoPlatform\(platform\)/);
  assert.match(contentScript, /function shouldAllowFloatingToolbar\(platform\)/);
  assert.match(contentScript, /function renderSourceCaptionMenu\(menu, platform\)/);
  assert.match(contentScript, /function renderTranslationStyleMenu\(menu, platform\)/);
  assert.match(contentScript, /settings\.setTranslationStyle/);
  assert.match(contentScript, /function selectDefaultSourceCaptionTrack\(tracks, preferredLanguage = ""\)/);
  assert.match(contentScript, /function getVimeoPlayerConfigResourceUrl\(videoId\)/);
  assert.match(contentScript, /function getVimeoTextTracksFromDom\(videoId\)/);
  assert.match(contentScript, /document\.querySelectorAll\("video track\[src\]"\)/);
  assert.match(contentScript, /function getVimeoTextTracksResourceUrl\(videoId\)/);
  assert.match(contentScript, /https:\/\/api\.vimeo\.com/);
  assert.match(contentScript, /performance\.getEntriesByType\?\.\("resource"\)/);
  assert.match(contentScript, /await fetch\(configUrl, \{ credentials: "include" \}\)/);
  assert.match(contentScript, /contentSourceCaptions/);
  assert.match(contentScript, /location\.hostname === "player\.vimeo\.com" \|\| Boolean\(document\.querySelector\("video"\)\)/);
  assert.match(contentScript, /host === "vimeo\.com" \|\| host === "www\.vimeo\.com"/);
  assert.match(contentScript, /\(\?:\^\|\\\/\)\(\\d\+\)/);
  assert.match(contentScript, /if \(isVimeoPlatform\(platform\)\) return getVimeoVideoId\(\)/);
  assert.match(contentScript, /platform !== "udemy" && platform !== "ted" && platform !== "coursera" && platform !== "linkedin" && platform !== "oreilly" && platform !== "nvidiaOnDemand" && platform !== "deeplearningai" && platform !== "edx" && !isVimeoPlatform\(platform\) && installed/);
  assert.match(contentScript, /platform\.vimeo\.getContext/);
  assert.match(contentScript, /platform: "vimeo"/);
  assert.match(contentStyle, /\.ast-provider-menu-nvidia/);
  assert.match(contentStyle, /\.ast-provider-menu-vimeo/);
  assert.match(contentScript, /ast-source-caption-submenu/);
  assert.match(contentStyle, /\.ast-source-caption-list/);
  assert.match(contentStyle, /\.ast-translation-style-list/);
  assert.match(contentStyle, /\.ast-source-caption-submenu:hover \.ast-source-caption-list/);
  assert.match(contentStyle, /right: 100%/);
  assert.match(contentStyle, /max-height: min\(320px, calc\(100vh - 24px\)\)/);
  assert.match(contentStyle, /--ast-source-caption-menu-background/);
  assert.match(contentStyle, /\.ast-provider-menu \{[\s\S]*overflow: visible[\s\S]*pointer-events: auto/);
  assert.match(contentStyle, /\.ast-subtitle-overlay \{[\s\S]*z-index: 2147483645/);
  assert.match(contentScript, /menu\.addEventListener\("pointerdown"/);
});

// Shaped like a Vimeo live event's caption file: a STYLE block, then lines on the stream's timeline.
const LIVE_SUBTITLE_URL = "https://live-api.vimeocdn.com/sessions/5342ef22-5972-4868-a536-9cc78b25572d/playlist/subtitle.webvtt?json=1&~exp=1795021200&~id=player&~sig=test";
const LIVE_FILE_URL = "https://live.vimeocdn.com/1795017886-0xabc/5342ef22-5972-4868-a536-9cc78b25572d/subtitle.webvtt";
const LIVE_VTT = [
  "WEBVTT",
  "",
  "STYLE",
  "::cue {",
  "  font-family: monospace;",
  "}",
  "::cue(c.white) {",
  "  color: white;",
  "}",
  "",
  "",
  "00:40:31.504 --> 00:40:34.104",
  "<c.white>going off in some strange and bizarre way.</c>",
  "",
  "",
  "00:40:34.776 --> 00:40:37.556",
  "You know, if you look at all the ennui in science right now,",
  "",
  "",
  "00:40:34.776 --> 00:40:37.556",
  "You know, if you look at all the ennui in science right now,",
  "",
  "",
  "00:40:34.776 --> 00:40:35.000",
  "Same start, other words.",
  ""
].join("\n");

test("Vimeo live caption links are restricted to Vimeo's live caption hosts", () => {
  assert.equal(isVimeoLiveSubtitleUrl(LIVE_SUBTITLE_URL), true);
  assert.equal(isVimeoLiveSubtitleUrl("https://live-api.vimeocdn.com/sessions/abc/playlist/avc/hls.m3u8"), false);
  assert.equal(isVimeoLiveSubtitleUrl("https://example.com/sessions/abc/playlist/subtitle.webvtt"), false);
  assert.equal(isVimeoLiveSubtitleUrl("http://live-api.vimeocdn.com/sessions/abc/playlist/subtitle.webvtt"), false);
  assert.equal(isVimeoLiveSubtitleFileUrl(LIVE_FILE_URL), true);
  assert.equal(isVimeoLiveSubtitleFileUrl("https://live-ak.vimeocdn.com/x/subs/en/subs_810.vtt"), true);
  assert.equal(isVimeoLiveSubtitleFileUrl("https://live.vimeocdn.com.example.com/subtitle.webvtt"), false);
  assert.equal(isVimeoLiveSubtitleFileUrl("https://captions.vimeo.com/captions/1.vtt"), false);
  assert.equal(isVimeoLiveSubtitleFileUrl("https://live.vimeocdn.com/session/video.mp4"), false);
});

test("Vimeo live captions keep ids from start times, drop repeated lines, and allow a file with no lines yet", () => {
  assert.deepEqual(parseVimeoLiveSubtitles(LIVE_VTT), [
    { id: "live-2431504", start: 2431.504, end: 2434.104, text: "going off in some strange and bizarre way." },
    { id: "live-2434776", start: 2434.776, end: 2437.556, text: "You know, if you look at all the ennui in science right now," },
    { id: "live-2434776-1", start: 2434.776, end: 2435, text: "Same start, other words." }
  ]);
  assert.deepEqual(parseVimeoLiveSubtitles("WEBVTT\n\nSTYLE\n::cue {\n  color: white;\n}\n"), []);
  assert.deepEqual(parseVimeoLiveSubtitles(""), []);
});

test("Vimeo live captions are read through the live-api link without cookies, as a live document", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    if (url === LIVE_SUBTITLE_URL) return new Response(JSON.stringify({ url: LIVE_FILE_URL }), { status: 200 });
    if (url === LIVE_FILE_URL) return new Response(LIVE_VTT, { status: 200, headers: { "Content-Type": "text/vtt" } });
    throw new Error(`unexpected ${url}`);
  };
  try {
    const document = await fetchVimeoLiveTranscript({ videoId: "event-6300761", subtitleUrl: LIVE_SUBTITLE_URL, sourceLanguage: "en" });
    assert.equal(document.platform, "vimeo");
    assert.equal(document.videoId, "event-6300761");
    assert.equal(document.sourceLanguage, "en");
    assert.equal(document.live, true);
    assert.equal(document.cues.length, 3);
    assert.deepEqual(requests.map((request) => request.url), [LIVE_SUBTITLE_URL, LIVE_FILE_URL]);
    assert.ok(requests.every((request) => request.init.credentials === "omit" && request.init.cache === "no-store"));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("Vimeo live caption failures keep the HTTP status and reject links to other hosts", async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("expired", { status: 410 });
    await assert.rejects(
      fetchVimeoLiveTranscript({ videoId: "event-1", subtitleUrl: LIVE_SUBTITLE_URL }),
      (error) => error.status === 410 && /HTTP 410/.test(error.message)
    );

    globalThis.fetch = async () => new Response(JSON.stringify({ url: "https://example.com/subtitle.webvtt" }), { status: 200 });
    await assert.rejects(
      fetchVimeoLiveTranscript({ videoId: "event-1", subtitleUrl: LIVE_SUBTITLE_URL }),
      /file URL is invalid/
    );

    let called = false;
    globalThis.fetch = async () => { called = true; return new Response("{}"); };
    await assert.rejects(
      fetchVimeoLiveTranscript({ videoId: "event-1", subtitleUrl: "https://example.com/sessions/a/playlist/subtitle.webvtt" }),
      /live caption URL is invalid/
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

// Shaped like the HLS caption playlist and segments of a Vimeo live event (values from a real event).
const LIVE_HLS_URL = "https://live-api.vimeocdn.com/sessions/5342ef22/playlist/avc/hls.m3u8?cdn=akamai-fmp4&json=1&~sig=hls";
const LIVE_MASTER_URL = "https://live-ak.vimeocdn.com/exp=1~acl=x~hmac=y/5342ef22_fmp4/avc/hls.m3u8";
const LIVE_PLAYLIST_URL = "https://live-ak.vimeocdn.com/exp=1~acl=x~hmac=y/5342ef22_fmp4/subs/en/subs.m3u8";
const LIVE_MASTER = [
  "#EXTM3U",
  '#EXT-X-MEDIA:GROUP-ID="subs",NAME="English (AI-generated)",URI="../subs/en/subs.m3u8",LANGUAGE="en",DEFAULT=YES,TYPE=SUBTITLES',
  '#EXT-X-STREAM-INF:BANDWIDTH=6256000,SUBTITLES="subs"',
  "../avc/1080p/chunklist.m3u8"
].join("\n");
const liveDeltaPlaylist = (first, last) => [
  "#EXTM3U", "#EXT-X-VERSION:9", "#EXT-X-TARGETDURATION:3",
  "#EXT-X-SERVER-CONTROL:HOLD-BACK=12.000000,CAN-SKIP-UNTIL=18.000000",
  "#EXT-X-MEDIA-SEQUENCE:0", `#EXT-X-SKIP:SKIPPED-SEGMENTS=${first}`,
  ...Array.from({ length: last - first + 1 }, (_, index) => [`#EXTINF:3.000`, `subs_${first + index}.vtt`]).flat()
].join("\n");
const liveSegment = (sequence, cue) => `WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:${sequence * 270000},LOCAL:00:00:00.000\n\nSTYLE\n::cue {\n  color: white;\n}\n\n\n${cue}\n`;

test("Vimeo live caption playlists and segments map onto the stream timeline", () => {
  assert.deepEqual(parseVimeoLiveSegmentPlaylist(liveDeltaPlaylist(1967, 1969)), {
    targetDuration: 3,
    ended: false,
    segments: [{ sequence: 1967, uri: "subs_1967.vtt" }, { sequence: 1968, uri: "subs_1968.vtt" }, { sequence: 1969, uri: "subs_1969.vtt" }]
  });
  assert.equal(parseVimeoLiveSegmentPlaylist(`${liveDeltaPlaylist(5, 5)}\n#EXT-X-ENDLIST`).ended, true);
  // subs_1970.vtt of the event: MPEGTS 531900000 is 5910 s, the segment's place in the stream.
  assert.equal(getVimeoLiveSegmentOffset("WEBVTT\nX-TIMESTAMP-MAP=MPEGTS:531900000,LOCAL:00:00:00.000\n"), 5910);
  assert.equal(getVimeoLiveSegmentOffset("WEBVTT\n"), 0);
});

test("Vimeo live caption segments are found from the HLS link and read after the last one read", async () => {
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push(url);
    assert.equal(init.credentials, "omit");
    if (url === LIVE_HLS_URL) return new Response(JSON.stringify({ url: LIVE_MASTER_URL }));
    if (url === LIVE_MASTER_URL) return new Response(LIVE_MASTER);
    if (url === `${LIVE_PLAYLIST_URL}?_HLS_skip=YES`) return new Response(liveDeltaPlaylist(1967, 1972));
    const sequence = Number(String(url).match(/subs_(\d+)\.vtt$/)?.[1]);
    if (sequence === 1970) return new Response(liveSegment(1970, "00:00:01.063 --> 00:00:04.623\nAnd the other thing,"));
    if (sequence) return new Response(liveSegment(sequence, ""));
    throw new Error(`unexpected ${url}`);
  };
  try {
    const first = await fetchVimeoLiveSegments({ hlsUrl: LIVE_HLS_URL, afterSequence: null });
    assert.equal(first.playlistUrl, LIVE_PLAYLIST_URL);
    assert.equal(first.lastSequence, 1972);
    assert.equal(first.gap, false);
    assert.deepEqual(first.cues, [{ id: "live-5911063", start: 5911.063, end: 5914.623, text: "And the other thing," }]);
    // The first read takes the last four segments.
    assert.deepEqual(requests.filter((url) => /subs_\d+\.vtt$/.test(url)).map((url) => url.match(/subs_\d+/)[0]),
      ["subs_1969", "subs_1970", "subs_1971", "subs_1972"]);

    requests.length = 0;
    const next = await fetchVimeoLiveSegments({ hlsUrl: LIVE_HLS_URL, playlistUrl: first.playlistUrl, afterSequence: 1971 });
    assert.deepEqual(requests, [`${LIVE_PLAYLIST_URL}?_HLS_skip=YES`, LIVE_PLAYLIST_URL.replace("subs.m3u8", "subs_1972.vtt")]);
    assert.equal(next.lastSequence, 1972);
    assert.equal(next.gap, false);

    const behind = await fetchVimeoLiveSegments({ hlsUrl: LIVE_HLS_URL, playlistUrl: first.playlistUrl, afterSequence: 1900 });
    assert.equal(behind.gap, true);
    assert.equal(behind.lastSequence, 1972);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("an expired Vimeo live caption playlist link is found again, and a segment that fails is read again later", async () => {
  const previousFetch = globalThis.fetch;
  let expired = true;
  globalThis.fetch = async (url) => {
    if (url === LIVE_HLS_URL) return new Response(JSON.stringify({ url: LIVE_MASTER_URL }));
    if (url === LIVE_MASTER_URL) { expired = false; return new Response(LIVE_MASTER); }
    if (url === `${LIVE_PLAYLIST_URL}?_HLS_skip=YES`) return expired ? new Response("", { status: 403 }) : new Response(liveDeltaPlaylist(1967, 1972));
    if (/subs_1972\.vtt$/.test(url)) return new Response("", { status: 500 });
    return new Response(liveSegment(Number(url.match(/subs_(\d+)/)[1]), ""));
  };
  try {
    const result = await fetchVimeoLiveSegments({ hlsUrl: LIVE_HLS_URL, playlistUrl: LIVE_PLAYLIST_URL, afterSequence: 1970 });
    assert.equal(result.playlistUrl, LIVE_PLAYLIST_URL);
    assert.equal(result.lastSequence, 1971);

    globalThis.fetch = async () => new Response("", { status: 410 });
    await assert.rejects(fetchVimeoLiveSegments({ hlsUrl: LIVE_HLS_URL, afterSequence: null }), (error) => error.status === 410);
    await assert.rejects(fetchVimeoLiveSegments({ hlsUrl: "https://example.com/sessions/a/playlist/avc/hls.m3u8" }), /HLS URL is invalid/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
