import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  fetchOreillyTracks,
  fetchOreillyTranscript,
  getOreillyVideoClipUrl,
  isOreillyClipId,
  oreillyLinesToCues
} from "../extension/platforms/oreilly-captions.js";
import { validateBackgroundMessage, validateMessageSender } from "../extension/shared/message-contracts.js";

const CLIP = {
  reference_id: "9781807785192-video1_1",
  transcriptions: [
    {
      language: "en",
      transcription: {
        lines: [
          { begin: "00:00:00.009", end: "00:00:00.019", text: "Hi," },
          { begin: "00:00:01.049", end: "00:00:03.910", text: "my name is Mehme Tokaya and welcome to my course," },
          { begin: "00:00:04.130", end: "00:00:04.130", text: "zero length" },
          { begin: "00:00:05.000", end: "00:00:06.000", text: "  " }
        ]
      }
    },
    { language: "ko", transcription: { lines: [{ begin: "00:00:00.100", end: "00:00:01.000", text: "안녕" }] } },
    { language: "fr", transcription: { lines: [] } }
  ]
};

test("O'Reilly clip ids and API URLs are restricted", () => {
  assert.equal(isOreillyClipId("9781807785192-video1_1"), true);
  assert.equal(isOreillyClipId("../evil"), false);
  assert.equal(isOreillyClipId("a/b"), false);
  assert.equal(getOreillyVideoClipUrl("9781807785192-video1_1"), "https://www.oreilly.com/api/v1/videoclips/9781807785192-video1_1/");
  assert.equal(getOreillyVideoClipUrl("a b"), "");
});

test("O'Reilly transcript lines become cues and zero-length lines are repaired", () => {
  const cues = oreillyLinesToCues(CLIP.transcriptions[0].transcription.lines);
  assert.deepEqual(cues.map((cue) => [cue.start, cue.end, cue.text]), [
    [0.009, 0.019, "Hi,"],
    [1.049, 3.91, "my name is Mehme Tokaya and welcome to my course,"],
    [4.13, 4.63, "zero length"]
  ]);
});

test("O'Reilly tracks and transcripts come from the clip API", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://www.oreilly.com/api/v1/videoclips/9781807785192-video1_1/");
    assert.equal(init.redirect, "error");
    return new Response(JSON.stringify(CLIP), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const tracks = await fetchOreillyTracks({ clipId: "9781807785192-video1_1" });
    assert.deepEqual(tracks.map((track) => track.languageCode), ["en", "ko"]);

    const document = await fetchOreillyTranscript({ clipId: "9781807785192-video1_1", sourceLanguage: "ko" });
    assert.equal(document.platform, "oreilly");
    assert.equal(document.sourceLanguage, "ko");
    assert.equal(document.cues[0].text, "안녕");
    assert.equal((await fetchOreillyTranscript({ clipId: "9781807785192-video1_1", sourceLanguage: "zz" })).sourceLanguage, "en");
    await assert.rejects(fetchOreillyTracks({ clipId: "../x" }), /clip id is invalid/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("O'Reilly messages are validated and the player is wired", async () => {
  assert.match(validateBackgroundMessage({ type: "captions.oreilly.listTracks", clipId: "../x" }).error, /clipId is invalid/);
  assert.equal(validateBackgroundMessage({ type: "captions.oreilly.fetchTranscript", clipId: "9781807785192-video1_1", sourceLanguage: "en" }).error, undefined);
  const contentScript = await readFile(new URL("../extension/content/content-script.js", import.meta.url), "utf8");
  assert.match(contentScript, /getOreillyPagePath\(\)\.startsWith\("\/videos\/"\)\) return "oreilly"/);
  assert.match(contentScript, /location\.protocol !== "about:" \|\| window\.parent === window/);
  assert.match(contentScript, /type: "captions\.oreilly\.fetchTranscript"/);
  assert.match(contentScript, /\.playkit-bottom-bar \.playkit-controls-container \.playkit-right-controls/);
  assert.match(contentScript, /player && \(player\.readyState >= 1 \|\| player\.currentSrc\) \? player : null/);
});

test("the O'Reilly player iframe (about:srcdoc) gets the content script and may message the worker", async () => {
  const manifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  const entry = manifest.content_scripts.find((item) => item.matches.includes("https://www.oreilly.com/videos/*"));
  assert.equal(entry.all_frames, true);
  assert.equal(entry.match_about_blank, true);
  assert.ok(entry.js.includes("content/content-script.js"));
  assert.equal(manifest.content_scripts[0].matches.some((pattern) => pattern.includes("oreilly.com")), false);

  const tabUrl = "https://www.oreilly.com/videos/agentic-ai-architectures/9781807785192/9781807785192-video1_1/";
  const message = { type: "captions.oreilly.listTracks", clipId: "9781807785192-video1_1" };
  const frameSender = { id: "extension-id", url: "about:srcdoc", frameId: 3, tab: { id: 5, url: tabUrl } };
  assert.equal(validateMessageSender(message, frameSender, "extension-id").ok, true);
  assert.equal(validateMessageSender(message, { ...frameSender, tab: { id: 5, url: "https://example.com/" } }, "extension-id").ok, false);
  assert.equal(validateMessageSender(message, { ...frameSender, tab: { id: 5, url: "https://www.oreilly.com/library/" } }, "extension-id").ok, false);
});
