import assert from "node:assert/strict";
import test from "node:test";
import { validateBackgroundMessage } from "../extension/shared/message-contracts.js";

const validDocument = {
  platform: "youtube",
  videoId: "video-1",
  sourceLanguage: "en",
  cues: [{ id: "cue-1", start: 0, end: 1, text: "Hello" }]
};

test("background message validation accepts a valid translation request", () => {
  assert.deepEqual(validateBackgroundMessage({
    type: "translation.translateDocument",
    document: validDocument,
    providerId: "openai",
    mode: "final",
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
});

test("background message validation leaves unrelated message types unhandled", () => {
  assert.deepEqual(validateBackgroundMessage({ type: "another.extension.message" }), {
    handled: false,
    ok: false,
    error: "Unknown message type."
  });
});
