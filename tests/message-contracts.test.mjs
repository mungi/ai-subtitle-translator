import assert from "node:assert/strict";
import test from "node:test";
import { validateBackgroundMessage } from "../extension/shared/message-contracts.js";

const validDocument = {
  platform: "youtube",
  videoId: "video-1",
  sourceLanguage: "en",
  cues: [{ id: "cue-1", start: 0, end: 1, text: "Hello" }]
};

test("subtitle display messages accept only the three supported modes", () => {
  for (const mode of ["dual", "source", "translated"]) {
    assert.deepEqual(validateBackgroundMessage({ type: "settings.setSubtitleDisplayMode", mode }), { handled: true, ok: true });
  }
  for (const mode of [undefined, "", "other", {}, 1]) {
    assert.equal(validateBackgroundMessage({ type: "settings.setSubtitleDisplayMode", mode }).ok, false);
  }
});

test("YouTube-provided subtitle preference messages accept only booleans", () => {
  for (const enabled of [true, false]) {
    assert.deepEqual(validateBackgroundMessage({ type: "settings.setPreferYoutubeProvidedTranslation", enabled }), { handled: true, ok: true });
  }
  for (const enabled of [undefined, "true", 1, null]) {
    assert.equal(validateBackgroundMessage({ type: "settings.setPreferYoutubeProvidedTranslation", enabled }).ok, false);
  }
});

test("word progress highlight messages accept only booleans", () => {
  for (const enabled of [true, false]) {
    assert.deepEqual(validateBackgroundMessage({ type: "settings.setWordProgressHighlight", enabled }), { handled: true, ok: true });
  }
  for (const enabled of [undefined, "true", 1, null]) {
    assert.equal(validateBackgroundMessage({ type: "settings.setWordProgressHighlight", enabled }).ok, false);
  }
});

test("summary messages need transcript text and optional string fields", () => {
  assert.deepEqual(validateBackgroundMessage({ type: "summary.generate", text: "Hello.", title: "T", requestId: "r1" }), { handled: true, ok: true });
  for (const text of [undefined, "", "  ", 1, "x".repeat(2000001)]) {
    assert.equal(validateBackgroundMessage({ type: "summary.generate", text }).ok, false);
  }
  assert.equal(validateBackgroundMessage({ type: "summary.generate", text: "a", title: 1 }).ok, false);
});

test("background message validation accepts a valid translation request", () => {
  assert.deepEqual(validateBackgroundMessage({
    type: "translation.translateDocument",
    document: validDocument,
    providerId: "openai",
    mode: "final",
    forceNoCache: false,
    initialStartTime: 12.5,
    requestId: "video-1:1:final:1"
  }), { handled: true, ok: true });
});

test("background message validation accepts persisted provider selection", () => {
  assert.deepEqual(validateBackgroundMessage({
    type: "settings.setActiveProvider",
    providerId: "deepl"
  }), { handled: true, ok: true });
  assert.deepEqual(validateBackgroundMessage({
    type: "settings.setTranslationStyle",
    translationStyle: "technical"
  }), { handled: true, ok: true });
});

test("background message validation accepts public settings reads and subtitle style patches", () => {
  assert.deepEqual(validateBackgroundMessage({
    type: "settings.getPublic"
  }), { handled: true, ok: true });

  assert.deepEqual(validateBackgroundMessage({
    type: "settings.updateSubtitleStyle",
    patch: { positionX: 42, positionY: 73, width: 640 }
  }), { handled: true, ok: true });
});

test("background message validation accepts AST menu visibility updates", () => {
  assert.deepEqual(validateBackgroundMessage({
    type: "ast.providerMenu.setOpen",
    open: true
  }), { handled: true, ok: true });
  assert.deepEqual(validateBackgroundMessage({
    type: "ast.providerMenu.setOpen",
    open: false
  }), { handled: true, ok: true });
});

test("background message validation rejects unsupported subtitle style patch fields", () => {
  assert.deepEqual(validateBackgroundMessage({
    type: "settings.updateSubtitleStyle",
    patch: { webFontCss: "@import url(https://example.com/track.css)" }
  }), {
    handled: true,
    ok: false,
    error: "patch contains unsupported subtitle style fields."
  });
});

test("background message validation rejects malformed subtitle cues", () => {
  const result = validateBackgroundMessage({
    type: "translation.translateDocument",
    document: {
      ...validDocument,
      cues: [{ id: "cue-1", start: 2, end: 1, text: "Hello" }]
    }
  });

  assert.equal(result.handled, true);
  assert.equal(result.ok, false);
  assert.match(result.error, /start must be before end/);
});

test("background message validation rejects incomplete platform requests", () => {
  assert.deepEqual(validateBackgroundMessage({
    type: "captions.udemy.fetchTranscript",
    courseId: "course-1",
    hostname: "www.udemy.com"
  }), {
    handled: true,
    ok: false,
    error: "lectureId is required."
  });

  assert.deepEqual(validateBackgroundMessage({
    type: "captions.vimeo.fetchTranscript",
    videoId: "1191467672"
  }), {
    handled: true,
    ok: false,
    error: "trackUrl is required."
  });
  assert.deepEqual(validateBackgroundMessage({
    type: "captions.vimeo.fetchTranscript",
    videoId: "1191467672",
    trackUrl: "https://captions.vimeo.com/captions/test.vtt",
    platform: "other"
  }), {
    handled: true,
    ok: false,
    error: "platform must be nvidia or vimeo."
  });

  assert.deepEqual(validateBackgroundMessage({
    type: "captions.ted.listTracks",
    videoId: "485565"
  }), {
    handled: true,
    ok: false,
    error: "manifestUrl is required."
  });
  assert.deepEqual(validateBackgroundMessage({
    type: "captions.ted.fetchTranscript",
    videoId: "485565"
  }), {
    handled: true,
    ok: false,
    error: "trackUrl is required."
  });
});

test("background message validation leaves unrelated message types unhandled", () => {
  assert.deepEqual(validateBackgroundMessage({ type: "another.extension.message" }), {
    handled: false,
    ok: false,
    error: "Unknown message type."
  });
});


test("large player subtitle widths can be saved without the old 1400px cap", () => {
  assert.deepEqual(validateBackgroundMessage({ type: "settings.updateSubtitleStyle", patch: { width: 3416 } }), { handled: true, ok: true });
  assert.equal(validateBackgroundMessage({ type: "settings.updateSubtitleStyle", patch: { width: Infinity } }).ok, false);
});


test("translation priority updates require a request ID and valid playback time", () => {
  assert.equal(validateBackgroundMessage({ type: "translation.setPriority", requestId: "final-1", currentTime: 30 }).ok, true);
  for (const currentTime of [-1, NaN, Infinity, "30"]) {
    assert.equal(validateBackgroundMessage({ type: "translation.setPriority", requestId: "final-1", currentTime }).ok, false);
  }
  assert.equal(validateBackgroundMessage({ type: "translation.setPriority", currentTime: 30 }).ok, false);
});

test("subtitle style patches accept the translation position only as a boolean", () => {
  assert.equal(validateBackgroundMessage({ type: "settings.updateSubtitleStyle", patch: { translationOnTop: true } }).ok, true);
  assert.equal(validateBackgroundMessage({ type: "settings.updateSubtitleStyle", patch: { translationOnTop: "true" } }).ok, false);
  assert.equal(validateBackgroundMessage({ type: "settings.updateSubtitleStyle", patch: { textColor: "#ffffff" } }).ok, false);
});

test("source caption language messages need a supported platform and a language code", () => {
  assert.equal(validateBackgroundMessage({ type: "settings.setSourceCaptionLanguage", platform: "youtube", languageCode: "ko" }).ok, true);
  assert.equal(validateBackgroundMessage({ type: "settings.setSourceCaptionLanguage", platform: "other", languageCode: "ko" }).ok, false);
  assert.equal(validateBackgroundMessage({ type: "settings.setSourceCaptionLanguage", platform: "youtube", languageCode: "ko;x" }).ok, false);
});
