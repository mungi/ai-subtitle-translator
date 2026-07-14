# LLM 429 Exponential Backoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LLM 번역의 HTTP 429 재시도를 4회 응답 제한으로 줄이고, 재시도 전에 1초·2초·4초 지수 백오프를 적용한다.

**Architecture:** 공통 `createLlmRequestController()`가 429 누적 수, 요청 동시성, 대기 시간을 관리한다. 첫 세 번의 429에는 동시성을 1로 낮춘 뒤 주입 가능한 대기 함수로 지수 백오프하고, 넷째 429에서는 대기 없이 기존 Google Translate 대체 번역 경로로 오류를 전달한다.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js built-in test runner.

## Global Constraints

- LLM 429 외의 오류 처리와 DeepL·Google Translate의 기존 대체 번역 동작은 변경하지 않는다.
- 429 1·2·3회 후 대기 시간은 각각 1000ms·2000ms·4000ms다.
- 4번째 429에서는 추가 LLM 요청을 만들지 않고 기존 Google Translate 대체 경로를 사용한다.
- 429를 한 번이라도 받으면 이후 LLM chunk 요청 동시성은 1로 유지한다.

---

### Task 1: 429 요청 제어기 백오프와 4회 제한

**Files:**
- Modify: `tests/translation-cleanup.test.mjs:540-627,947-1038`
- Modify: `extension/shared/translation.js:24,464-531,579-584`

**Interfaces:**
- Consumes: `createLlmRequestController({ rateLimitFallbackThreshold, waitForRateLimit })`
- Produces: `recordRateLimitError(error): Promise<void>`; 첫 세 429에서 지연을 기다리고 넷째 429에서 오류를 던진다.

- [x] **Step 1: Write the failing test**

`translationInternals.createLlmRequestController()`에 기록용 대기 함수를 주입해 429 세 번의 백오프와 네 번째 429의 종료를 검증한다. 기존 통합 테스트의 이름·요청 목록도 5회에서 4회로 바꾼다.

```js
const delays = [];
const controller = translationInternals.createLlmRequestController({
  waitForRateLimit: async (delayMs) => delays.push(delayMs)
});
const error = Object.assign(new Error("HTTP 429: Rate limit exceeded"), { status: 429 });

await controller.recordRateLimitError(error);
await controller.recordRateLimitError(error);
await controller.recordRateLimitError(error);
await assert.rejects(() => controller.recordRateLimitError(error), /HTTP 429/);

assert.deepEqual(delays, [1000, 2000, 4000]);
assert.equal(controller.concurrentRequestLimit, 1);
assert.equal(controller.rateLimitErrorCount, 4);
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/translation-cleanup.test.mjs`

Expected: the controller does not wait after the first three 429 errors and the existing fallback test still issues five LLM requests.

- [x] **Step 3: Write minimal implementation**

Set the threshold to four, add a 1000ms base-delay constant, and make `recordRateLimitError()` asynchronous. Before retrying failures 1-3, await `waitForRateLimit(1000 * 2 ** (rateLimitErrorCount - 1))`; on failure 4, set the terminal error and throw without waiting. Await that call before recursively retrying the chunk.

```js
await requestController.recordRateLimitError(error);
return translateLlmChunkWithRetry(provider, settings, chunk, contextBefore, requestController);
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/translation-cleanup.test.mjs`

Expected: every translation cleanup test passes; the controller test observes `[1000, 2000, 4000]` and the fallback integration test performs four LLM requests then one Google Translate request.

- [x] **Step 5: Run repository checks and commit**

Run: `npm test && npm run check && git diff --check`

Expected: all tests, syntax checks, manifest validation, and whitespace validation pass.

Commit:

```bash
git add extension/shared/translation.js tests/translation-cleanup.test.mjs docs/superpowers/plans/2026-07-14-llm-rate-limit-backoff.md
git commit -m "Add exponential backoff for LLM rate limits"
```
