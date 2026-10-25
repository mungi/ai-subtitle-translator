import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import { normalizeSettings } from "../extension/shared/storage.js";
import { translationInternals } from "../extension/shared/translation.js";

const document = {
  platform: "youtube", videoId: "google-batch-test", sourceLanguage: "en",
  cues: [
    { id: "first", start: 0, end: 2, text: "First subtitle" },
    { id: "second", start: 2, end: 5, text: "Second subtitle" }
  ]
};
const settings = { targetLanguage: "ko" };

test("Google Translate uses the native batch endpoint with separate q fields per cue", async () => {
  const originalFetch = globalThis.fetch;
  let progress;
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/translate_a/t");
    assert.equal(parsed.searchParams.get("sl"), "en");
    assert.equal(parsed.searchParams.get("tl"), "ko");
    assert.equal(parsed.searchParams.get("format"), "html");
    assert.equal(init.redirect, "error");
    assert.equal(init.method, "POST");
    assert.deepEqual(new URLSearchParams(init.body).getAll("q"), ["First subtitle", "Second subtitle"]);
    return { ok: true, json: async () => ["첫 번째 번역", "두 번째 번역"] };
  };
  try {
    const result = await translationInternals.translateCuesWithGoogle(document, settings, PROVIDERS.googleTranslate, {
      onProgress: (value) => { progress = value; }
    });
    assert.deepEqual(result, [{ id: "first", text: "첫 번째 번역" }, { id: "second", text: "두 번째 번역" }]);
    assert.deepEqual(progress.cues.map(({ id, start, end }) => ({ id, start, end })), document.cues.map(({ id, start, end }) => ({ id, start, end })));
  } finally { globalThis.fetch = originalFetch; }
});

test("Google Translate never reports invalid, empty, or incomplete responses as successful English subtitles", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const body of [null, {}, ["첫 번째만"], ["", "두 번째"], [[["legacy single response"]]]]) {
      globalThis.fetch = async () => ({ ok: true, json: async () => body });
      await assert.rejects(
        translationInternals.translateCuesWithGoogle(document, settings, PROVIDERS.googleTranslate),
        /Google Translate.*(?:invalid|empty|count)/i
      );
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("Google Translate explains a blocked redirect or network failure and does not retry", async () => {
  const originalFetch = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async () => { count += 1; throw new TypeError("Failed to fetch"); };
  try {
    await assert.rejects(
      translationInternals.translateCuesWithGoogle(document, settings, PROVIDERS.googleTranslate),
      /Google Translate.*(?:network|redirect)/i
    );
    assert.equal(count, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("existing Google Translate settings migrate from the broken single POST endpoint", () => {
  assert.equal(PROVIDERS.googleTranslate.baseUrl, "https://translate.googleapis.com/translate_a/t");
  const migrated = normalizeSettings({ providers: { googleTranslate: { baseUrl: "https://translate.googleapis.com/translate_a/single" } } });
  assert.equal(migrated.providers.googleTranslate.baseUrl, PROVIDERS.googleTranslate.baseUrl);
});

test("Google batch preserves cue boundaries when one translation contains paragraph separators", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ["첫 문단\n\n둘째 문단", "다음 자막"] });
  try {
    const result = await translationInternals.translateCuesWithGoogle(document, settings, PROVIDERS.googleTranslate);
    assert.deepEqual(result, [{ id: "first", text: "첫 문단\n\n둘째 문단" }, { id: "second", text: "다음 자막" }]);
  } finally { globalThis.fetch = originalFetch; }
});

test("Google batch accepts source-language pairs and stops on HTTP 429 without flooding requests", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => [["첫째", "en"], ["둘째", "en"]] });
    const translated = await translationInternals.translateCuesWithGoogle(document, settings, PROVIDERS.googleTranslate);
    assert.deepEqual(translated.map((cue) => cue.text), ["첫째", "둘째"]);
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; return { ok: false, status: 429, statusText: "Too Many Requests" }; };
    await assert.rejects(translationInternals.translateCuesWithGoogle(document, settings, PROVIDERS.googleTranslate), /HTTP 429/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});
