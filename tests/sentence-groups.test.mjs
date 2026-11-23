import test from "node:test";
import assert from "node:assert/strict";
import { buildSentenceGroups, distributeGroupTranslation } from "../extension/shared/sentence-groups.js";
import { translationInternals as internals } from "../extension/shared/translation.js";
import { PROVIDERS } from "../extension/shared/defaults.js";

const cues = (texts) => texts.map((text, i) => ({ id: `yt-${i}`, start: i * 2, end: i * 2 + 3, text }));
const document = (texts) => ({ platform: "youtube", videoId: "test", sourceLanguage: "en", cues: cues(texts) });
const reply = (translations) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ translations }) }] } }] }));

test("sentence groups preserve all original cues and separate sentence boundaries", () => {
  const source = cues(["When you build", "a harness.", "Keep it updated."]);
  const groups = buildSentenceGroups(source);
  assert.deepEqual(groups.map((group) => group.members.length), [2, 1]);
  assert.deepEqual(groups.flatMap((group) => group.members), source);
  assert.equal(groups[0].text, "When you build a harness.");
  const long = buildSentenceGroups(cues(Array(30).fill("continuous speech")));
  assert.ok(long.every((group) => group.members.length <= 10));
});

// The text each cue shows, with a cue that keeps showing the piece before it written as "".
function pieces(result) {
  return result.map((item, index) => (index > 0 && item.text === result[index - 1].text ? "" : item.text));
}

function timedGroup(rows) {
  return buildSentenceGroups(rows.map(([id, start, end, text]) => ({ id, start, end, text })))[0];
}

test("group translation is distributed in order without changing IDs or source timing", () => {
  const group = buildSentenceGroups(cues(["When you build", "a harness."]))[0];
  const result = distributeGroupTranslation(group, "하네스를 만들 때에는 문맥을 유지해야 해.");
  assert.deepEqual(result.map((item) => item.id), ["yt-0", "yt-1"]);
  // Every word appears once, in order; a sentence this short stays whole across both cues.
  assert.equal(pieces(result).filter(Boolean).join(" "), "하네스를 만들 때에는 문맥을 유지해야 해.");
  assert.deepEqual(distributeGroupTranslation(group, "좋아.").map((item) => item.text), ["좋아.", "좋아."]);
});

test("a translation breaks at commas and full stops, and a fragment of a word or two is not shown alone", () => {
  // Source cues and the LLM's sentence from a Vimeo talk (Brain Dump, SC26).
  const bronson = timedGroup([
    ["97", 49.47, 52.29, "Dr. Bronson Messer is a computational astrophysicist,"],
    ["98", 52.29, 54.074, "distinguished staff scientist,"],
    ["99", 54.074, 57.451, "and director of science for the Oak Ridge Leadership Computing Facility"],
    ["100", 58.11, 59.701, "at Oak Ridge National Laboratory."]
  ]);
  const bronsonResult = distributeGroupTranslation(bronson,
    "브론슨 메서 박사는 계산천체물리학자이자 석좌 연구원이며, 오크리지 국립연구소의 오크리지 리더십 컴퓨팅 시설에서 과학 책임자를 맡고 있어.");
  assert.deepEqual(bronsonResult.map((item) => item.id), ["97", "98", "99", "100"]);
  assert.deepEqual(pieces(bronsonResult), [
    "브론슨 메서 박사는 계산천체물리학자이자 석좌 연구원이며,", "",
    "오크리지 국립연구소의 오크리지 리더십 컴퓨팅 시설에서 과학 책임자를 맡고 있어.", ""
  ]);

  const session = timedGroup([
    ["46", 116.22, 117.914, "After today's session,"],
    ["47", 117.914, 124.262, "our own unpaid student volunteer will work after hours to download the agent-generated"],
    ["48", 124.262, 129.303, "transcripts and read them out loud at a series of strategic locations:"],
    ["49", 129.303, 133.5, "inside a robo-taxi, on a street corner with a traffic camera,"],
    ["50", 133.95, 136.38, "and in a kitchen full of smart appliances."]
  ]);
  const sessionPieces = pieces(distributeGroupTranslation(session,
    "오늘 세션이 끝나면, 우리 학생 자원봉사자가 무급으로 시간 외 근무를 하면서 에이전트가 생성한 대본을 내려받아 여러 전략적 장소에서 소리 내 읽을 거야. 로보택시 안, 교통 카메라가 있는 길모퉁이, 스마트 가전으로 가득한 주방 같은 곳에서 말이지."));
  assert.equal(sessionPieces[0], "오늘 세션이 끝나면,");
  assert.ok(sessionPieces.filter(Boolean).every((piece) => /[,.]$|하면서$/.test(piece)), sessionPieces.join(" | "));
  assert.ok(sessionPieces.includes("에이전트가 생성한 대본을 내려받아 여러 전략적 장소에서 소리 내 읽을 거야."), sessionPieces.join(" | "));

  // A lone trailing word joins the text before it instead of flashing by.
  const tail = timedGroup([
    ["193", 976.26, 980.971, "serves as a primary compute substrate for any number of higher precisions,"],
    ["194", 980.971, 986.655, "as long as you accumulate the answer using a higher precision register"],
    ["195", 986.655, 988.121, "or hardware."]
  ]);
  assert.deepEqual(pieces(distributeGroupTranslation(tail,
    "더 높은 정밀도의 레지스터나 하드웨어로 결과를 누적하기만 하면, 다양한 상위 정밀도 연산을 위한 기본 계산 기반이 돼.")), [
    "더 높은 정밀도의 레지스터나 하드웨어로 결과를 누적하기만 하면,", "다양한 상위 정밀도 연산을 위한 기본 계산 기반이 돼.", ""
  ]);
});

test("text without spaces breaks after its own punctuation, and Latin text uses longer pieces", () => {
  const japanese = timedGroup([
    ["0", 0, 3, "If you accumulate the result in higher precision,"],
    ["1", 3, 6, "FP8 serves as the compute substrate."]
  ]);
  assert.deepEqual(pieces(distributeGroupTranslation(japanese, "より高い精度で結果を累積すれば、FP8は計算の基盤になります。")),
    ["より高い精度で結果を累積すれば、", "FP8は計算の基盤になります。"]);

  const english = timedGroup([
    ["0", 0, 2.5, "Nach der heutigen Sitzung"],
    ["1", 2.5, 6, "wird unser Freiwilliger die Abschriften herunterladen."]
  ]);
  assert.deepEqual(pieces(distributeGroupTranslation(english, "After today's session, our volunteer will download the transcripts.")),
    ["After today's session,", "our volunteer will download the transcripts."]);
});

test("only a missing sentence group is retried; valid sentences are retained", async () => {
  const original = globalThis.fetch;
  const inputs = [];
  globalThis.fetch = async (_url, init) => {
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    inputs.push(input);
    return reply(inputs.length === 1 ? [{ id: "0", text: "정상 문장." }] : [{ id: "1", text: "복구 문장." }]);
  };
  try {
    const doc = document(["First sentence.", "Second sentence."]);
    const result = await internals.translateSentenceGroups({ ...PROVIDERS.google, apiKey: "test" }, { targetLanguage: "ko" }, doc, []);
    assert.deepEqual(inputs.map((input) => input.cues.map((cue) => cue.id)), [["0", "1"], ["1"]]);
    assert.deepEqual(result.map((item) => item.text), ["정상 문장.", "복구 문장."]);
    const merged = internals.mergeTranslations(doc, result);
    assert.deepEqual(merged.cues.map(({ id, start, end }) => ({ id, start, end })), doc.cues.map(({ id, start, end }) => ({ id, start, end })));
  } finally { globalThis.fetch = original; }
});

test("seeking reorders pending final chunks without restarting completed work", async () => {
  const original = globalThis.fetch;
  const inputs = [];
  globalThis.fetch = async (_url, init) => {
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    inputs.push(input.cues[0].id);
    return reply(input.cues.map(({ id }) => ({ id, text: "번역" })));
  };
  try {
    const doc = document(["A.", "B.", "C.", "D.", "E."]);
    const chunks = doc.cues.map((cue) => ({ ...doc, cues: [cue] }));
    let time;
    const result = await internals.translateLlmChunksWithPriority({ ...PROVIDERS.google, apiKey: "test" },
      { settingsMode: "advanced", llmParallelRequests: 1 }, doc, chunks, () => { time = 6; }, undefined, () => time);
    assert.deepEqual(inputs, ["yt-0", "yt-3", "yt-4", "yt-1", "yt-2"]);
    assert.equal(result.length, 5);
  } finally { globalThis.fetch = original; }
});


test("a persistently invalid sentence falls back without retranslating a valid sentence", async () => {
  const original = globalThis.fetch;
  const machine = [];
  let llmCalls = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("translate.googleapis.com")) {
      const texts = new URLSearchParams(init.body).getAll("q");
      machine.push(...texts);
      return new Response(JSON.stringify(texts.map(() => "복구 번역")));
    }
    llmCalls += 1;
    return reply(llmCalls === 1 ? [{ id: "0", text: "정상 번역" }] : []);
  };
  try {
    const doc = document(["First sentence.", "Second sentence."]);
    const result = await internals.translateSentenceGroups({ ...PROVIDERS.google, apiKey: "test" },
      { targetLanguage: "ko", providers: PROVIDERS }, doc, []);
    assert.equal(llmCalls, 2);
    assert.deepEqual(machine, ["Second sentence."]);
    assert.deepEqual(result.map((item) => item.text), ["정상 번역", "복구 번역"]);
    assert.deepEqual(result.fallbackCueIds, ["yt-1"]);
  } finally { globalThis.fetch = original; }
});

test("a broken batch reply is retried in halves, not one request per sentence", async () => {
  const original = globalThis.fetch;
  const inputs = [];
  globalThis.fetch = async (_url, init) => {
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    inputs.push(input.cues.map((cue) => cue.id));
    // The first reply is cut off mid-JSON, the way a reasoning model hits its output limit.
    if (inputs.length === 1) {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{\"translations\": [{\"id\": \"0\", \"text\": \"첫 문장.\"}, {\"id\": \"1\"" }] } }] }));
    }
    return reply(input.cues.map(({ id }) => ({ id, text: `번역 ${id}` })));
  };
  try {
    const doc = document(Array.from({ length: 8 }, (_, i) => `Sentence ${i}.`));
    const result = await internals.translateSentenceGroups({ ...PROVIDERS.google, apiKey: "test" }, { targetLanguage: "ko" }, doc, []);
    assert.deepEqual(inputs, [
      ["0", "1", "2", "3", "4", "5", "6", "7"],
      ["1", "2", "3", "4"],
      ["5", "6", "7"]
    ]);
    assert.deepEqual(result.map((item) => item.text), ["첫 문장.", ...[1, 2, 3, 4, 5, 6, 7].map((id) => `번역 ${id}`)]);
  } finally { globalThis.fetch = original; }
});

test("speaker-change markers are not sent to the model", async () => {
  const original = globalThis.fetch;
  let sent;
  globalThis.fetch = async (_url, init) => {
    sent = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    return reply(sent.cues.map(({ id }) => ({ id, text: "번역" })));
  };
  try {
    const doc = document([">> Yes, I'm ready.", "Okay. >> Next one.", ">>"]);
    await internals.translateSentenceGroups({ ...PROVIDERS.google, apiKey: "test" }, { targetLanguage: "ko" }, doc, []);
    const texts = sent.cues.map((cue) => cue.text).join(" | ");
    assert.equal(texts.includes(">>"), false);
    assert.match(texts, /Yes, I'm ready\./);
    assert.match(texts, /Okay\. — Next one\./);
  } finally { globalThis.fetch = original; }
});
