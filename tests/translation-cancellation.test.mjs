import assert from "node:assert/strict";
import test from "node:test";

test("canceling a translation aborts provider requests without retries or fallback and stays scoped to its frame", { timeout: 5000 }, async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  let listener;
  let providerId;
  const sender = {
    id: "test-extension",
    url: "https://www.youtube.com/watch?v=test-video",
    tab: { id: 1 },
    frameId: 0
  };
  globalThis.chrome = {
    runtime: { id: sender.id, onMessage: { addListener: (handler) => { listener = handler; } } },
    storage: { local: {
      setAccessLevel: async () => {},
      set: async () => {},
      get: async () => ({ llmSettings: {
        activeProvider: providerId,
        targetLanguage: "ko",
        cacheTranslations: false,
        providers: {
          google: { apiKey: "test-google-key", model: "gemini-3.1-flash-lite" },
          deepl: { apiKey: "test-deepl-key" }
        }
      } })
    } }
  };

  try {
    await import("../extension/background/service-worker.js?translation-cancellation-test");
    const dispatch = (message, origin = sender) => new Promise((resolve) => listener(message, origin, resolve));
    for (providerId of ["google", "googleTranslate", "deepl"]) {
      let requestCount = 0;
      let started;
      const requestStarted = new Promise((resolve) => { started = resolve; });
      globalThis.fetch = async (_url, { signal }) => {
        requestCount += 1;
        started(signal);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      };
      const requestId = `test-${providerId}`;
      const translation = dispatch({
        type: "translation.translateDocument", providerId, requestId,
        document: {
          platform: "youtube", videoId: "test-video", sourceLanguage: "en",
          cues: [{ id: "cue-1", start: 0, end: 2, text: "Hello world" }]
        }
      });
      const signal = await requestStarted;
      await dispatch({ type: "translation.cancelRequest", requestId }, { ...sender, frameId: 1 });
      assert.equal(signal.aborted, false, "another frame must not cancel this request");
      await dispatch({ type: "translation.cancelRequest", requestId });
      assert.equal(signal.aborted, true);
      assert.equal((await translation).ok, false);
      assert.equal(requestCount, 1, "cancellation must not retry or start fallback translation");
    }
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});
