import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import { translationInternals } from "../extension/shared/translation.js";

const rateLimited = (message = "HTTP 429: second limit(1), called 1 times per second", extra = {}) =>
  Object.assign(new Error(message), { status: 429, ...extra });

// A fake clock that moves only when the controller waits.
function createClock() {
  const clock = { time: 0, waits: [] };
  clock.now = () => clock.time;
  clock.wait = async (delayMs) => {
    clock.waits.push(delayMs);
    clock.time += delayMs;
  };
  return clock;
}

test("request starts are spaced by the minimum interval, also when they run in parallel", async () => {
  const clock = createClock();
  const controller = translationInternals.createLlmRequestController({
    maxConcurrentRequests: 3,
    minRequestIntervalMs: 1000,
    now: clock.now,
    waitForRateLimit: clock.wait
  });
  const starts = [];
  await Promise.all([1, 2, 3].map(() => controller.run(async () => { starts.push(clock.time); })));
  assert.deepEqual(starts, [0, 1000, 2000]);
});

test("rate limit headers can lengthen the interval but never shorten it below one second", () => {
  const headers = new Headers({
    "x-second-rate-limit": "1",
    "x-minute-rate-limit": "30",
    "x-second-rate-limit-remaining": "0",
    "x-minute-rate-limit-remaining": "29",
    "retry-after": "1",
    "retry-after-ms": "180"
  });
  const parsed = translationInternals.readRateLimitHeaders(headers);
  assert.equal(parsed.retryAfterMs, 180);
  assert.deepEqual(parsed.remaining, { second: 0, minute: 29 });

  const learned = [];
  const controller = translationInternals.createLlmRequestController({
    minRequestIntervalMs: 1000,
    onLimitsLearned: (update) => learned.push(update)
  });
  return controller.run(async (observe) => {
    observe({ secondLimit: 5 });
    assert.equal(controller.requestIntervalMs, 1000);
    observe(parsed);
    assert.equal(controller.requestIntervalMs, 2000);
    assert.deepEqual(learned, [{ requestIntervalMs: 2000 }]);
  });
});

test("a 429 holds back requests that were already queued until the shared cooldown ends", async () => {
  const clock = createClock();
  const controller = translationInternals.createLlmRequestController({
    maxConcurrentRequests: 1,
    minRequestIntervalMs: 0,
    now: clock.now,
    waitForRateLimit: clock.wait
  });
  const starts = [];
  const first = controller.run(async () => {
    starts.push(["first", clock.time]);
    throw rateLimited("HTTP 429: service limit(600) exceeded per minute", { retryAfterMs: 9000 });
  }).catch((error) => error);
  const queued = controller.run(async () => { starts.push(["queued", clock.time]); });
  await first;
  await queued;
  assert.deepEqual(starts, [["first", 0], ["queued", 9000]]);
});

test("a success clears the 429 count so only consecutive limits fall back", async () => {
  const controller = translationInternals.createLlmRequestController({
    minRequestIntervalMs: 0,
    now: () => 0,
    waitForRateLimit: async () => {}
  });
  for (let index = 0; index < 3; index += 1) await controller.recordRateLimitError(rateLimited());
  assert.equal(controller.rateLimitErrorCount, 3);
  await controller.run(async () => "ok");
  assert.equal(controller.rateLimitErrorCount, 0);
  for (let index = 0; index < 3; index += 1) await controller.recordRateLimitError(rateLimited());
  await assert.rejects(Promise.resolve(controller.recordRateLimitError(rateLimited())), /HTTP 429/);
});

test("provider-wide 429s are counted apart and do not lower concurrency", async () => {
  const learned = [];
  const controller = translationInternals.createLlmRequestController({
    maxConcurrentRequests: 3,
    minRequestIntervalMs: 0,
    now: () => 0,
    waitForRateLimit: async () => {},
    onLimitsLearned: (update) => learned.push(update)
  });
  const serviceLimit = () => rateLimited("HTTP 429: service limit(600) exceeded per minute", { inFlightRequests: 3 });
  for (let index = 0; index < 5; index += 1) await controller.recordRateLimitError(serviceLimit());
  assert.equal(controller.serviceLimitErrorCount, 5);
  assert.equal(controller.rateLimitErrorCount, 0);
  assert.equal(controller.concurrentRequestLimit, 3);
  assert.deepEqual(learned, []);
  await assert.rejects(Promise.resolve(controller.recordRateLimitError(serviceLimit())), /service limit/);
});

test("a 429 is provider-wide when every limit reported for the user still has room", () => {
  const { isServiceWideRateLimit } = translationInternals;
  assert.equal(isServiceWideRateLimit({ status: 429, message: "HTTP 429: service limit(600) exceeded per minute" }), true);
  assert.equal(isServiceWideRateLimit({ status: 429, message: "HTTP 429: Too many", rateLimitRemaining: { second: 1, minute: 59, day: 88 } }), true);
  assert.equal(isServiceWideRateLimit({ status: 429, message: "HTTP 429: second limit(1)", rateLimitRemaining: { second: 0, minute: 59 } }), false);
  assert.equal(isServiceWideRateLimit({ status: 429, message: "HTTP 429: Rate limit exceeded" }), false);
});

test("a user rate limit keeps one request fewer than were in flight", async () => {
  const learned = [];
  const controller = translationInternals.createLlmRequestController({
    maxConcurrentRequests: 3,
    minRequestIntervalMs: 0,
    now: () => 0,
    waitForRateLimit: async () => {},
    onLimitsLearned: (update) => learned.push(update)
  });
  await controller.recordRateLimitError(rateLimited(undefined, { inFlightRequests: 3 }));
  assert.equal(controller.concurrentRequestLimit, 2);
  await controller.recordRateLimitError(rateLimited(undefined, { inFlightRequests: 3 }));
  assert.equal(controller.concurrentRequestLimit, 2);
  await controller.recordRateLimitError(rateLimited());
  assert.equal(controller.concurrentRequestLimit, 1);
  assert.deepEqual(learned, [{ concurrency: 2 }, { concurrency: 1 }]);
});

test("the concurrency learned from a 429 carries over to the next job for that provider", async (t) => {
  translationInternals.resetLearnedLlmLimits();
  t.after(() => translationInternals.resetLearnedLlmLimits());
  const provider = { ...PROVIDERS.google, apiKey: "test", model: "rate-limit-memory-test" };
  const settings = { settingsMode: "advanced", llmParallelRequests: 3, targetLanguage: "ko" };
  const document = { platform: "test", videoId: "learned-limit", sourceLanguage: "en",
    cues: Array.from({ length: 7 }, (_, index) => ({ id: String(index), start: index * 5, end: index * 5 + 4, text: "Hello." })) };
  const chunks = () => document.cues.map((cue, chunkIndex) => ({ ...document, cues: [cue], chunkIndex, chunkCount: 7 }));
  let active = 0;
  let maximum = 0;
  let rejectAtThree = true;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const input = JSON.parse(JSON.parse(init.body).contents[0].parts[0].text);
    active += 1;
    maximum = Math.max(maximum, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (rejectAtThree && active === 3) {
        rejectAtThree = false;
        return new Response(JSON.stringify({ error: { message: "Too many concurrent requests" } }), {
          status: 429,
          headers: { "retry-after-ms": "1" }
        });
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        translations: input.cues.map(({ id }) => ({ id, text: `번역 ${id}` }))
      }) }] } }] }));
    } finally {
      active -= 1;
    }
  });

  await translationInternals.translateLlmChunksWithPriority(provider, settings, document, chunks(), () => {});
  assert.equal(maximum, 3);
  assert.equal((await translationInternals.readLearnedLlmLimit(provider, 3))?.concurrency, 2);

  maximum = 0;
  await translationInternals.translateLlmChunksWithPriority(provider, settings, document, chunks(), () => {});
  assert.equal(maximum, 2);

  // A different parallel setting starts over from what the user chose.
  assert.equal(await translationInternals.readLearnedLlmLimit(provider, 4), null);
});
