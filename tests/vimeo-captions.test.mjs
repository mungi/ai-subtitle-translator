import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  fetchVimeoTranscript,
  isVimeoCaptionUrl,
  normalizeVimeoTextTrack,
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
  assert.match(contentScript, /function selectDefaultSourceCaptionTrack\(tracks\)/);
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
  assert.match(contentScript, /platform !== "udemy" && !isVimeoPlatform\(platform\) && installed/);
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
