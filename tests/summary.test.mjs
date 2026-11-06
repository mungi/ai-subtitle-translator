import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSummarySystemPrompt,
  isSummaryProvider,
  splitTranscript,
  summarizeTranscript
} from "../extension/shared/summary.js";

const provider = {
  id: "local",
  label: "Local",
  apiStyle: "openai-chat",
  baseUrl: "http://localhost:11434/v1",
  model: "test-model",
  maxTokens: 4096
};

function recordingFetch(replies) {
  const calls = [];
  const fetchText = async (_provider, request) => {
    const body = JSON.parse(request.init.body);
    calls.push({ system: body.messages[0].content, input: body.messages.at(-1).content, maxTokens: body.max_tokens });
    const reply = replies[calls.length - 1];
    if (reply instanceof Error) throw reply;
    return reply ?? `reply ${calls.length}`;
  };
  return { calls, fetchText };
}

test("summary prompt asks for complete, opinion-free, structured Markdown in the target language", () => {
  const prompt = buildSummarySystemPrompt("Korean");
  assert.match(prompt, /Write in Korean/);
  assert.match(prompt, /Keep every key point/);
  assert.match(prompt, /Do not add opinions/);
  assert.match(prompt, /numbered list/);
  assert.match(prompt, /`## `/);
});

test("an edited summary prompt replaces the default and still gets the language line", async () => {
  const { calls, fetchText } = recordingFetch(["# Short"]);
  await summarizeTranscript({ text: "hello", languageName: "Korean", systemPrompt: "Three bullets only." }, { provider, fetchText });
  assert.equal(calls[0].system, "Three bullets only.\nWrite in Korean. Keep technical terms in their original form when that is clearer.");
  assert.match(buildSummarySystemPrompt("Korean", "   "), /Keep every key point/);
});

test("transcript splits on line breaks and cuts only over-long lines", () => {
  assert.deepEqual(splitTranscript("aaa\nbbb\nccc", 7), ["aaa\nbbb", "ccc"]);
  assert.deepEqual(splitTranscript("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assert.deepEqual(splitTranscript("\n\n"), []);
});

test("a short transcript is summarized in one request", async () => {
  const { calls, fetchText } = recordingFetch(["<think>plan</think># Title\n\nOverview"]);
  const progress = [];
  const summary = await summarizeTranscript(
    { text: "Line one.\nLine two.", title: "Intro", languageName: "Korean" },
    { provider, fetchText, onProgress: (value) => progress.push(value) }
  );
  assert.equal(summary, "# Title\n\nOverview");
  assert.equal(calls.length, 1);
  assert.match(calls[0].input, /Video title: Intro/);
  assert.match(calls[0].input, /Line one\.\nLine two\./);
  assert.equal(calls[0].maxTokens, 8192);
  assert.deepEqual(progress, [{ step: 0, total: 1 }, { step: 1, total: 1 }]);
});

test("a long transcript becomes notes per part, then one merged summary", async () => {
  const { calls, fetchText } = recordingFetch(["notes A", "notes B", "notes C", "# Final"]);
  const progress = [];
  const summary = await summarizeTranscript(
    { text: "part one\npart two\npart three", languageName: "Japanese" },
    { provider, fetchText, maxPartChars: 10, onProgress: (value) => progress.push(value) }
  );
  assert.equal(summary, "# Final");
  assert.equal(calls.length, 4);
  assert.match(calls[0].system, /only one part of a long transcript/);
  assert.match(calls[1].input, /Part 2 of 3/);
  assert.match(calls[3].system, /Merge them into one summary/);
  assert.match(calls[3].input, /\[Part 1\]\nnotes A\n\n\[Part 2\]\nnotes B\n\n\[Part 3\]\nnotes C/);
  assert.deepEqual(progress.at(-1), { step: 4, total: 4 });
});

test("transient provider errors are retried, other errors stop the summary", async () => {
  const busy = Object.assign(new Error("HTTP 503: busy"), { status: 503 });
  const retried = recordingFetch([busy, "# Done"]);
  assert.equal(
    await summarizeTranscript({ text: "hello" }, { provider, fetchText: retried.fetchText, waitFor: async () => {} }),
    "# Done"
  );
  assert.equal(retried.calls.length, 2);

  const denied = Object.assign(new Error("HTTP 401: bad key"), { status: 401 });
  const failed = recordingFetch([denied]);
  await assert.rejects(
    summarizeTranscript({ text: "hello" }, { provider, fetchText: failed.fetchText, waitFor: async () => {} }),
    /bad key/
  );
  assert.equal(failed.calls.length, 1);
});

test("machine translation engines cannot summarize", async () => {
  assert.equal(isSummaryProvider({ apiStyle: "google-translate" }), false);
  assert.equal(isSummaryProvider({ apiStyle: "deepl" }), false);
  assert.equal(isSummaryProvider(provider), true);
  await assert.rejects(summarizeTranscript({ text: "hi" }, { provider: { apiStyle: "deepl" } }), /LLM provider/);
});
