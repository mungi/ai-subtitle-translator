import assert from "node:assert/strict";
import test from "node:test";
import { translationInternals } from "../extension/shared/translation.js";

function cacheEntry(createdAt, text = "translated") {
  return {
    createdAt,
    document: {
      platform: "test",
      videoId: createdAt,
      sourceLanguage: "en",
      cues: [{ id: "cue-1", start: 0, end: 1, text }]
    }
  };
}

test("translation cache evicts the oldest entries when the entry limit is exceeded", () => {
  const cache = {
    oldest: cacheEntry("2026-01-01T00:00:00.000Z"),
    middle: cacheEntry("2026-01-02T00:00:00.000Z"),
    newest: cacheEntry("2026-01-03T00:00:00.000Z")
  };

  assert.deepEqual(
    Object.keys(translationInternals.pruneTranslationCache(cache, { maxEntries: 2 })),
    ["middle", "newest"]
  );
});

test("translation cache evicts old entries until it fits the byte budget", () => {
  const cache = {
    oldest: cacheEntry("2026-01-01T00:00:00.000Z", "a".repeat(200)),
    newest: cacheEntry("2026-01-02T00:00:00.000Z", "b".repeat(200))
  };
  const newestOnlyBytes = translationInternals.estimateJsonBytes({ newest: cache.newest });

  assert.deepEqual(
    Object.keys(translationInternals.pruneTranslationCache(cache, {
      maxEntries: 10,
      maxBytes: newestOnlyBytes
    })),
    ["newest"]
  );
});

test("translation cache keeps one newest entry even when it alone exceeds the byte budget", () => {
  const cache = {
    only: cacheEntry("2026-01-01T00:00:00.000Z", "large translation")
  };

  assert.deepEqual(
    Object.keys(translationInternals.pruneTranslationCache(cache, { maxBytes: 1 })),
    ["only"]
  );
});
