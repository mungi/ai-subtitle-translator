import assert from "node:assert/strict";
import test from "node:test";
import { classifyProviderLimit, providerRetryDelay } from "../extension/shared/provider-limits.js";
import { translationInternals } from "../extension/shared/translation.js";

test("quota wording alone does not imply exhausted allowance", () => {
  assert.equal(classifyProviderLimit({ status: 429, message: "Quota exceeded" }), "request_restricted");
  assert.equal(classifyProviderLimit({ status: 429, message: "Quota exceeded: tokens per minute" }), "rate_limit_exceeded");
  assert.equal(classifyProviderLimit({ status: 429, message: "Quota exceeded: requests per day limit exceeded" }), "quota_exceeded");
  assert.equal(classifyProviderLimit({ status: 429, message: "Too Many Requests" }), "rate_limit_exceeded");
  assert.equal(classifyProviderLimit({ status: 429, message: "RESOURCE_EXHAUSTED" }), "request_restricted");
  assert.equal(classifyProviderLimit({ status: 503, message: "High demand" }), null);
});

test("structured daily limits and exhausted credit are distinguished from minute quotas", () => {
  const error = (quotaId) => ({ status: 429, message: "Quota exceeded", providerErrorDetails: [{
    violations: [{ quotaId }]
  }] });
  assert.equal(classifyProviderLimit(error("GenerateRequestsPerDayPerProjectPerModel-FreeTier")), "quota_exceeded");
  assert.equal(classifyProviderLimit(error("GenerateTokensPerMinutePerProjectPerModel")), "rate_limit_exceeded");
  assert.equal(classifyProviderLimit({ status: 429, providerErrorCode: "insufficient_quota" }), "quota_exceeded");
  assert.equal(classifyProviderLimit({ status: 400, message: "Your credit balance is too low" }), "quota_exceeded");
  assert.equal(classifyProviderLimit({ status: 456 }), "quota_exceeded");
});

test("rate limit backoff respects the longest server delay", async () => {
  const delays = [];
  const controller = translationInternals.createLlmRequestController({ waitForRateLimit: async (delay) => delays.push(delay) });
  const error = { status: 429, retryAfterMs: 12000, providerErrorDetails: [{ retryDelay: "23.5s" }] };
  assert.equal(providerRetryDelay(error), 23500);
  await controller.recordRateLimitError(error);
  assert.deepEqual(delays, [23500]);
  assert.equal(providerRetryDelay({ providerErrorDetails: [{ retryDelay: "invalid" }] }), undefined);
});

test("provider response details survive parsing and daily exhaustion stops queued requests", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return { ok: false, status: 429, headers: { get: () => "15" }, json: async () => ({ error: {
      message: "Quota exceeded", details: [
        { violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] },
        { retryDelay: "90s" }
      ]
    } }) };
  };
  const controller = translationInternals.createLlmRequestController({ waitForRateLimit: async () => assert.fail("daily quota must not retry") });
  const provider = { id: "google", apiStyle: "google-generate-content", apiKey: "test-key",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-test" };
  const chunk = { sourceLanguage: "en", cues: [{ id: "1", start: 0, end: 1, text: "Hello" }] };
  try {
    await assert.rejects(translationInternals.translateLlmChunkWithRetry(provider, { targetLanguage: "ko" }, chunk, [], controller), (error) => {
      assert.equal(classifyProviderLimit(error), "quota_exceeded");
      assert.equal(providerRetryDelay(error), 90000);
      return true;
    });
    await assert.rejects(controller.run(() => assert.fail("exhausted provider must not receive another request")));
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("confirmed overload is reported as a busy server, not a usage limit", () => {
  assert.equal(classifyProviderLimit({ status: 503, serverBusy: true }), "server_busy");
  assert.equal(classifyProviderLimit({ name: "TypeError", serverBusy: true }), "server_busy");
});
