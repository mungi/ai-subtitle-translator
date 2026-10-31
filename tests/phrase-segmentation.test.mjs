import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../extension/content/phrase-segmentation.js", import.meta.url), "utf8");

function load() {
  const context = { Intl };
  vm.runInNewContext(source, context);
  return (cues, options) => JSON.parse(JSON.stringify(context.astPhraseSegmentation.segmentCues(cues, options)));
}

// Auto-generated captions: rolling 2-3 second lines whose words carry their own start times.
function asrCue(id, start, words, spacing = 0.35) {
  return {
    id,
    start,
    end: start + 4,
    text: words.join(" "),
    words: words.map((text, index) => ({
      text: index ? ` ${text}` : text,
      start: start + index * spacing,
      end: start + (index + 1) * spacing
    }))
  };
}

const flatWords = (cues) => cues.flatMap((cue) => cue.words.map((word) => ({ text: word.text.trim(), start: word.start })));
const normalize = (text) => text.replace(/\s+/g, " ").trim();

test("auto-generated captions keep every word and its original start time", () => {
  const segment = load();
  const cues = [
    asrCue("yt-0", 0, ["so", "today", "we", "are", "going", "to"]),
    asrCue("yt-1", 2.1, ["talk", "about", "the", "new", "model", "and"]),
    asrCue("yt-2", 4.2, ["how", "it", "works", "in", "practice"]),
    asrCue("yt-3", 8, ["first", "let", "me", "show", "you", "the", "setup"])
  ];
  const result = segment(cues, { language: "en" });

  assert.deepEqual(flatWords(result), flatWords(cues));
  assert.equal(normalize(result.map((cue) => cue.text).join(" ")), normalize(cues.map((cue) => cue.text).join(" ")));
  for (const cue of result) {
    assert.equal(cue.start, cue.words[0].start);
    assert.ok(cue.end > cue.start);
    for (const [index, word] of cue.words.entries()) {
      assert.ok(word.start >= cue.start && word.start < cue.end, `${word.text} is outside its cue`);
      if (index) assert.ok(word.start >= cue.words[index - 1].start);
    }
  }
});

test("phrases follow speech instead of the original line breaks", () => {
  const segment = load();
  const result = segment([
    asrCue("yt-0", 0, ["so", "today", "we", "are", "going", "to"]),
    asrCue("yt-1", 2.1, ["talk", "about", "the", "new", "model", "and"]),
    asrCue("yt-2", 4.2, ["how", "it", "works", "in", "practice"]),
    asrCue("yt-3", 8, ["first", "let", "me", "show", "you", "the", "setup"])
  ], { language: "en" });

  assert.deepEqual(result.map((cue) => cue.text), [
    "so today we are going to talk about the new model",
    "and how it works in practice",
    "first let me show you the setup"
  ]);
  // A phrase ends before the next one starts, and does not hang through the pause before "first".
  assert.ok(result[1].end <= result[2].start);
  assert.ok(result[1].end < 7);
});

test("long speech without punctuation is split within the word limit and never on an article", () => {
  const segment = load();
  const words = "we will look at the data the model and the results we got from the experiment we ran last week with the team".split(" ");
  const result = segment([asrCue("yt-0", 0, words, 0.3)], { language: "en" });

  assert.ok(result.length > 1);
  for (const cue of result) {
    assert.ok(cue.words.length <= 14, cue.text);
    assert.doesNotMatch(cue.text, /\b(?:the|a|an|of|to)$/);
  }
  assert.deepEqual(flatWords(result).map((word) => word.text), words);
});

test("site captions split mid-sentence are joined, with estimated words inside each original line", () => {
  const segment = load();
  const result = segment([
    { id: "c1", start: 0, end: 2, text: "This is a caption that was" },
    { id: "c2", start: 2, end: 4, text: "split across two lines." },
    { id: "c3", start: 4.5, end: 7, text: "Next sentence here." }
  ], { language: "en" });

  assert.deepEqual(result.map((cue) => [cue.text, cue.start, cue.end, cue.originId]), [
    ["This is a caption that was split across two lines.", 0, 4, "c1"],
    ["Next sentence here.", 4.5, 7, "c3"]
  ]);
  const firstWords = result[0].words;
  assert.ok(firstWords.every((word) => word.estimated));
  assert.ok(firstWords.filter((word) => /This|was/.test(word.text)).every((word) => word.start < 2));
  assert.ok(firstWords.filter((word) => /split|lines/.test(word.text)).every((word) => word.start >= 2));
});

test("sentence ends split phrases but abbreviations do not", () => {
  const segment = load();
  const result = segment([
    { id: "c1", start: 0, end: 3, text: "Mr. Smith arrived early. Then the meeting" },
    { id: "c2", start: 3, end: 5, text: "started on time." }
  ], { language: "en" });
  assert.deepEqual(result.map((cue) => cue.text), ["Mr. Smith arrived early.", "Then the meeting started on time."]);
});

test("languages without spaces are measured by characters", () => {
  const segment = load();
  const result = segment([
    { id: "j1", start: 0, end: 2, text: "今日はとても良い天気ですね。" },
    { id: "j2", start: 2, end: 4, text: "散歩に行きましょう。" }
  ], { language: "ja" });
  assert.deepEqual(result.map((cue) => cue.text), ["今日はとても良い天気ですね。", "散歩に行きましょう。"]);
  assert.ok(result.every((cue) => !cue.text.includes(" ")));
});
