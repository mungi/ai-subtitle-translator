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
});

test("background message validation leaves unrelated message types unhandled", () => {
  assert.deepEqual(validateBackgroundMessage({ type: "another.extension.message" }), {
    handled: false,
    ok: false,
    error: "Unknown message type."
  });
});
