import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../extension/content/subtitle-export.js", import.meta.url), "utf8");
const context = {};
vm.runInNewContext(source, context);
const api = context.astSubtitleExport;

const translated = [
  { id: "1", start: 0, end: 1.5, text: "안녕하세요.", sourceText: "Hello there." },
  { id: "2", start: 1.5, end: 3.25, text: "오늘은 자막", sourceText: "Today we talk" },
  { id: "3", start: 3.25, end: 4, text: "이야기입니다.", sourceText: "about subtitles." },
  { id: "4", start: 9, end: 3661.5, text: "끝", sourceText: "End" }
];
const untranslated = [{ id: "1", start: 0, end: 2, text: "Only source" }];

test("SRT uses video timing and numbered cues for source and translation", () => {
  assert.equal(
    api.buildSrt(translated, "source"),
    "1\n00:00:00,000 --> 00:00:01,500\nHello there.\n\n2\n00:00:01,500 --> 00:00:03,250\nToday we talk\n\n"
    + "3\n00:00:03,250 --> 00:00:04,000\nabout subtitles.\n\n4\n00:00:09,000 --> 01:01:01,500\nEnd\n"
  );
  assert.match(api.buildSrt(translated, "translation"), /^1\n00:00:00,000 --> 00:00:01,500\n안녕하세요\.\n/);
});

test("TXT has no timing and breaks lines at sentence ends and long pauses", () => {
  assert.equal(api.buildTxt(translated, "source", { language: "en" }), "Hello there.\nToday we talk about subtitles.\nEnd\n");
  assert.equal(api.buildTxt(translated, "translation", { language: "ko" }), "안녕하세요.\n오늘은 자막 이야기입니다.\n끝\n");
  assert.equal(api.buildTxt([
    { start: 0, end: 1, text: "こんにちは" },
    { start: 1, end: 2, text: "世界。" }
  ], "source", { language: "ja" }), "こんにちは世界。\n");
});

test("untranslated cues have a source file but no translation file", () => {
  assert.equal(api.hasTranslation(untranslated), false);
  assert.equal(api.hasTranslation(translated), true);
  assert.equal(api.buildSrt(untranslated, "translation"), "");
  assert.equal(api.buildTxt(untranslated, "translation"), "");
  assert.match(api.buildTxt(untranslated, "source"), /^Only source\n$/);
});

test("file names drop characters Windows rejects", () => {
  assert.equal(api.sanitizeFileName('A/B: "C"?'), "A B C");
  assert.equal(api.sanitizeFileName("..."), "subtitles");
});
