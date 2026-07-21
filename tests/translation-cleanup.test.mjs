import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDERS } from "../extension/shared/defaults.js";
import { normalizeSettings } from "../extension/shared/storage.js";
import { translateSubtitleDocument, translationInternals } from "../extension/shared/translation.js";

const sourceDocument = {
  platform: "test",
  videoId: "video-1",
  sourceLanguage: "en",
  cues: [
    {
      id: "cue-1",
      start: 0,
      end: 1.5,
      text: "We will use clear, everyday English."
    }
  ]
};

test("Custom 2 prompt changes use a distinct translation cache key", () => {
  const provider = { id: "test-provider", model: "test-model" };
  const settings = {
    targetLanguage: "ko",
    translationStyle: "custom2",
    custom2SystemPrompt: "Style: Friendly beginner teacher.\nVersion A"
  };

  const firstKey = translationInternals.buildCacheKey(sourceDocument, settings, provider);
  const secondKey = translationInternals.buildCacheKey(sourceDocument, {
    ...settings,
    custom2SystemPrompt: "Style: Friendly beginner teacher.\nVersion B"
  }, provider);

  assert.notEqual(firstKey, secondKey);
});

test("machine translation cache keys do not change with the LLM translation style", () => {
  for (const apiStyle of ["google-translate", "deepl"]) {
    const provider = { id: apiStyle, apiStyle, model: "" };
    const naturalKey = translationInternals.buildCacheKey(sourceDocument, {
      targetLanguage: "ko",
      translationStyle: "natural"
    }, provider);
    const technicalKey = translationInternals.buildCacheKey(sourceDocument, {
      targetLanguage: "ko",
      translationStyle: "technical"
    }, provider);

    assert.equal(naturalKey, technicalKey);
  }
});

test("translation cache v2 rejects incomplete or timing-mismatched cached documents", () => {
  const provider = { id: "google", apiStyle: "google-generate-content", model: "gemini-test" };
  const cacheKey = translationInternals.buildCacheKey(sourceDocument, {
    targetLanguage: "ko",
    translationStyle: "technical"
  }, provider);

  assert.match(cacheKey, /^v2:/);
  assert.equal(translationInternals.getReusableCachedTranslation(sourceDocument, {
    ...sourceDocument,
    providerId: "google",
    cues: []
  }, provider), null);
  assert.equal(translationInternals.getReusableCachedTranslation(sourceDocument, {
    ...sourceDocument,
    providerId: "google",
    cues: [{ ...sourceDocument.cues[0], end: sourceDocument.cues[0].end + 1, text: "캐시 번역" }]
  }, provider), null);
});

test("cached Google Translate fallback does not suppress a later Google AI request", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const rawSettings = {
    activeProvider: "google",
    targetLanguage: "ko",
    translationStyle: "technical",
    cacheTranslations: true,
    providerTestStatus: { google: "success" },
    providers: {
      google: {
        ...PROVIDERS.google,
        apiKey: "google-key"
      }
    }
  };
  const normalizedSettings = normalizeSettings(rawSettings);
  const cacheKey = translationInternals.buildCacheKey(
    sourceDocument,
    normalizedSettings,
    normalizedSettings.providers.google
  );
  const stored = {
    llmSettings: rawSettings,
    translationCache: {
      [cacheKey]: {
        createdAt: new Date().toISOString(),
        document: {
          ...sourceDocument,
          providerId: "google",
          fallbackProviderId: "googleTranslate",
          cues: [{ ...sourceDocument.cues[0], text: "이전 구글 번역" }]
        }
      }
    }
  };
  const requestHosts = [];

  globalThis.chrome = {
    runtime: { id: "test-extension" },
    i18n: { getUILanguage: () => "ko" },
    storage: {
      local: {
        get: async () => stored,
        set: async (patch) => Object.assign(stored, patch),
        remove: async () => {}
      }
    }
  };
  globalThis.fetch = async (url) => {
    requestHosts.push(new URL(String(url)).host);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                translations: [{ id: "cue-1", text: "제미나이 번역" }]
              })
            }]
          }
        }]
      })
    };
  };

  try {
    const translated = await translateSubtitleDocument(sourceDocument, { providerId: "google" });

    assert.deepEqual(requestHosts, ["generativelanguage.googleapis.com"]);
    assert.equal(translated.providerId, "google");
    assert.equal(translated.fallbackProviderId, undefined);
    assert.equal(translated.cacheHit, false);
    assert.equal(translated.cues[0].text, "제미나이 번역");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("a complete Google AI translation cache is returned without another network request", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const rawSettings = {
    activeProvider: "google",
    targetLanguage: "ko",
    translationStyle: "technical",
    cacheTranslations: true,
    providerTestStatus: { google: "success" },
    providers: {
      google: {
        ...PROVIDERS.google,
        apiKey: "google-key"
      }
    }
  };
  const normalizedSettings = normalizeSettings(rawSettings);
  const cacheKey = translationInternals.buildCacheKey(
    sourceDocument,
    normalizedSettings,
    normalizedSettings.providers.google
  );
  const stored = {
    llmSettings: rawSettings,
    translationCache: {
      [cacheKey]: {
        createdAt: new Date().toISOString(),
        document: {
          ...sourceDocument,
          providerId: "google",
          cues: [{ ...sourceDocument.cues[0], text: "캐시된 제미나이 번역" }]
        }
      }
    }
  };
  let fetchCount = 0;

  globalThis.chrome = {
    runtime: { id: "test-extension" },
    i18n: { getUILanguage: () => "ko" },
    storage: {
      local: {
        get: async () => stored,
        set: async (patch) => Object.assign(stored, patch),
        remove: async () => {}
      }
    }
  };
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("A successful cache hit must not issue a network request.");
  };

  try {
    const translated = await translateSubtitleDocument(sourceDocument, { providerId: "google" });

    assert.equal(fetchCount, 0);
    assert.equal(translated.providerId, "google");
    assert.equal(translated.fallbackProviderId, undefined);
    assert.equal(translated.cacheHit, true);
    assert.equal(translated.cues[0].text, "캐시된 제미나이 번역");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("translated cue text decodes HTML entities without replacing decoded characters", () => {
  const cues = translationInternals.createTranslatedCues(sourceDocument, [
    {
      id: "cue-1",
      text: "&gt;&gt; 우리는 명확하고 일상적인 영어를 사용할 것입니다"
    }
  ]);

  assert.equal(cues[0].text, ">> 우리는 명확하고 일상적인 영어를 사용할 것입니다");
});

test("translated cue cleanup keeps ordinary decoded punctuation readable", () => {
  assert.equal(
    translationInternals.sanitizeTranslatedText("Use &quot;clear&quot; English &amp; everyday words"),
    "Use \"clear\" English & everyday words"
  );
  assert.equal(
    translationInternals.sanitizeTranslatedText("&#62;&#62; 숫자 entity도 정리합니다"),
    ">> 숫자 entity도 정리합니다"
  );
});

test("cached translated documents are sanitized before display", () => {
  const document = translationInternals.sanitizeTranslatedDocument({
    ...sourceDocument,
    cues: [
      {
        id: "cue-1",
        start: 0,
        end: 1.5,
        text: "&gt;&gt; 캐시된 번역도 정리합니다"
      }
    ]
  });

  assert.equal(document.cues[0].text, ">> 캐시된 번역도 정리합니다");
});

test("reasoning blocks are stripped before extracting translation JSON", () => {
  assert.equal(
    translationInternals.extractJsonText("<think>{bad reasoning}</think>\n{\"translations\":[]}"),
    "{\"translations\":[]}"
  );
});

test("LLM chunk validation accepts exactly one non-empty translation per cue", () => {
  assert.doesNotThrow(() => translationInternals.validateChunkTranslations(sourceDocument, [
    { id: "cue-1", text: "명확하고 쉬운 영어를 쓸 거야." }
  ]));
});

test("LLM chunk validation rejects missing cue translations before English fallback", () => {
  const chunk = {
    ...sourceDocument,
    cues: [
      ...sourceDocument.cues,
      {
        id: "cue-2",
        start: 1.5,
        end: 3,
        text: "Do not leave this in English."
      }
    ]
  };

  assert.throws(
    () => translationInternals.validateChunkTranslations(chunk, [
      { id: "cue-1", text: "명확하고 쉬운 영어를 쓸 거야." }
    ]),
    /missing 1 cue translation\(s\): cue-2/
  );
});

test("LLM chunk validation rejects unexpected or duplicate cue ids", () => {
  assert.throws(
    () => translationInternals.validateChunkTranslations(sourceDocument, [
      { id: "cue-1", text: "첫 번째 번역" },
      { id: "cue-1", text: "중복 번역" }
    ]),
    /duplicate cue id: cue-1/
  );

  assert.throws(
    () => translationInternals.validateChunkTranslations(sourceDocument, [
      { id: "cue-2", text: "엉뚱한 번역" }
    ]),
    /unexpected cue id: cue-2/
  );
});

test("LLM chunking prioritizes the initial one-minute window before cue count", () => {
  const document = {
    ...sourceDocument,
    platform: "youtube",
    cues: Array.from({ length: 104 }, (_, index) => ({
      id: `yt-${index}`,
      start: index,
      end: index + 0.5,
      text: "short cue"
    }))
  };

  const chunks = translationInternals.splitDocumentIntoChunks(document);

  assert.deepEqual(chunks.map((chunk) => chunk.cues.length), [60, 44]);
  assert.deepEqual(chunks.map((chunk) => chunk.chunkIndex), [0, 1]);
  assert.equal(chunks[0].chunkCount, 2);
});

test("LLM chunking limits normal chunks to seven minutes by default", () => {
  const document = {
    ...sourceDocument,
    cues: Array.from({ length: 13 }, (_, index) => ({
      id: `yt-${index}`,
      start: index * 60,
      end: index * 60 + 10,
      text: "short cue"
    }))
  };

  const chunks = translationInternals.splitDocumentIntoChunks(document, 12000, 250, {
    initialMaxDurationSeconds: 0
  });

  assert.deepEqual(chunks.map((chunk) => chunk.cues.length), [7, 6]);
});

test("LLM chunking still splits long cues by character budget", () => {
  const document = {
    ...sourceDocument,
    cues: [
      { id: "cue-1", start: 0, end: 1, text: "12345" },
      { id: "cue-2", start: 1, end: 2, text: "12345" },
      { id: "cue-3", start: 2, end: 3, text: "12345" }
    ]
  };

  const chunks = translationInternals.splitDocumentIntoChunks(document, 10);

  assert.deepEqual(chunks.map((chunk) => chunk.cues.map((cue) => cue.id)), [
    ["cue-1", "cue-2"],
    ["cue-3"]
  ]);
});

test("LLM chunking prioritizes an initial one-minute chunk before normal chunks", () => {
  const document = {
    ...sourceDocument,
    platform: "youtube",
    cues: Array.from({ length: 30 }, (_, index) => ({
      id: `yt-${index}`,
      start: index * 10,
      end: index * 10 + 5,
      text: "short cue"
    }))
  };

  const chunks = translationInternals.splitDocumentIntoChunks(document, 10000, 10);

  assert.deepEqual(chunks.map((chunk) => chunk.cues.map((cue) => cue.id)), [
    ["yt-0", "yt-1", "yt-2", "yt-3", "yt-4", "yt-5"],
    ["yt-6", "yt-7", "yt-8", "yt-9", "yt-10", "yt-11", "yt-12", "yt-13", "yt-14", "yt-15"],
    ["yt-16", "yt-17", "yt-18", "yt-19", "yt-20", "yt-21", "yt-22", "yt-23", "yt-24", "yt-25"],
    ["yt-26", "yt-27", "yt-28", "yt-29"]
  ]);
  assert.deepEqual(chunks.map((chunk) => chunk.chunkIndex), [0, 1, 2, 3]);
  assert.equal(chunks[0].chunkCount, 4);
});

test("LLM chunking starts at the current playback cue after seeking", () => {
  const document = {
    ...sourceDocument,
    cues: Array.from({ length: 30 }, (_, index) => ({
      id: `yt-${index}`,
      start: index * 10,
      end: index * 10 + 5,
      text: "short cue"
    }))
  };

  const chunks = translationInternals.splitDocumentIntoChunks(document, 10000, 10, {
    initialStartTime: 132
  });

  assert.deepEqual(chunks.map((chunk) => chunk.cues.map((cue) => cue.id)), [
    ["yt-13", "yt-14", "yt-15", "yt-16", "yt-17", "yt-18", "yt-19"],
    ["yt-20", "yt-21", "yt-22", "yt-23", "yt-24", "yt-25", "yt-26", "yt-27", "yt-28", "yt-29"],
    ["yt-0", "yt-1", "yt-2", "yt-3", "yt-4", "yt-5", "yt-6", "yt-7", "yt-8", "yt-9"],
    ["yt-10", "yt-11", "yt-12"]
  ]);
});

test("LLM translation retries incomplete YouTube-style chunks before fallback", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestCueCounts = [];
  const progressCueCounts = [];

  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "ko"
    },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "openrouter",
            targetLanguage: "ko",
            cacheTranslations: false,
            providerTestStatus: { openrouter: "success" },
            providers: {
              openrouter: {
                apiKey: "test-key",
                model: "deepseek/deepseek-v4-flash"
              },
              deepl: {
                apiKey: "deepl-key"
              }
            }
          }
        }),
        set: async () => {}
      }
    }
  };

  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.messages.find((message) => message.role === "user").content);
    requestCueCounts.push(input.cues.length);
    const cuesToTranslate = requestCueCounts.length === 1
      ? input.cues.slice(0, 35)
      : input.cues;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: cuesToTranslate.map((cue) => ({
                  id: cue.id,
                  text: `번역 ${cue.id}`
                }))
              })
            }
          }
        ]
      })
    };
  };

  try {
    const document = {
      ...sourceDocument,
      platform: "youtube",
      cues: Array.from({ length: 50 }, (_, index) => ({
        id: `yt-${index}`,
        start: index,
        end: index + 0.5,
        text: `source ${index}`
      }))
    };

    const translated = await translateSubtitleDocument(document, {
      onProgress: (progress) => progressCueCounts.push(progress.cues.length)
    });

    assert.deepEqual(requestCueCounts, [50, 15]);
    assert.deepEqual(progressCueCounts, [50]);
    assert.equal(translated.providerId, "openrouter");
    assert.equal(translated.fallbackProviderId, undefined);
    assert.equal(translated.cues.length, 50);
    assert.equal(translated.cues[0].text, "번역 yt-0");
    assert.equal(translated.cues[49].text, "번역 yt-49");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("OpenRouter retries once without reasoning when a model rejects the option", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestBodies = [];

  globalThis.chrome = {
    i18n: { getUILanguage: () => "ko" },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "openrouter",
            targetLanguage: "ko",
            cacheTranslations: false,
            providerTestStatus: { openrouter: "success" },
            providers: {
              openrouter: {
                apiKey: "test-key",
                model: "example/incompatible-reasoning-model"
              }
            }
          }
        }),
        set: async () => {}
      }
    }
  };
  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    requestBodies.push(body);
    if (requestBodies.length === 1) {
      return {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: { message: "reasoning effort none is not supported" } })
      };
    }

    const input = JSON.parse(body.messages.find((message) => message.role === "user").content);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              translations: input.cues.map((cue) => ({ id: cue.id, text: "호환 번역" }))
            })
          }
        }]
      })
    };
  };

  try {
    const translated = await translateSubtitleDocument(sourceDocument);
    assert.equal(requestBodies.length, 2);
    assert.equal(requestBodies[0].reasoning.effort, "none");
    assert.equal(requestBodies[1].reasoning, undefined);
    assert.equal(translated.cues[0].text, "호환 번역");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("LLM translation continues from the priority minute through later and earlier chunks", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestedRanges = [];

  globalThis.chrome = {
    i18n: { getUILanguage: () => "ko" },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "openrouter",
            targetLanguage: "ko",
            cacheTranslations: false,
            maxChunkDurationSeconds: 600,
            providerTestStatus: { openrouter: "success" },
            providers: {
              openrouter: { apiKey: "test-key", model: "deepseek/deepseek-v4-flash" }
            }
          }
        }),
        set: async () => {}
      }
    }
  };
  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.messages.find((message) => message.role === "user").content);
    requestedRanges.push([input.cues[0].id, input.cues.at(-1).id]);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              translations: input.cues.map((cue) => ({ id: cue.id, text: `번역 ${cue.id}` }))
            })
          }
        }]
      })
    };
  };

  try {
    const document = {
      ...sourceDocument,
      platform: "youtube",
      cues: Array.from({ length: 150 }, (_, index) => ({
        id: `yt-${index}`,
        start: index * 10,
        end: index * 10 + 5,
        text: "source"
      }))
    };
    const translated = await translateSubtitleDocument(document, { initialStartTime: 200 });

    assert.deepEqual(requestedRanges, [
      ["yt-20", "yt-25"],
      ["yt-26", "yt-85"],
      ["yt-86", "yt-145"],
      ["yt-146", "yt-149"],
      ["yt-0", "yt-19"]
    ]);
    assert.equal(translated.cues.length, 150);
    assert.equal(translated.cues[149].text, "번역 yt-149");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("LLM completes the priority chunk first and keeps two later chunks in parallel", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestStarts = [];
  const progressEvents = [];
  let inFlight = 0;
  let maxInFlight = 0;

  globalThis.chrome = {
    i18n: { getUILanguage: () => "ko" },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "openrouter",
            targetLanguage: "ko",
            cacheTranslations: false,
            maxChunkDurationSeconds: 120,
            providerTestStatus: { openrouter: "success" },
            providers: {
              openrouter: { apiKey: "test-key", model: "deepseek/deepseek-v4-flash" }
            }
          }
        }),
        set: async () => {}
      }
    }
  };
  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.messages.find((message) => message.role === "user").content);
    const cueId = input.cues[0].id;
    requestStarts.push(cueId);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, cueId === "yt-0" ? 5 : 10));
    inFlight -= 1;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              translations: input.cues.map((cue) => ({ id: cue.id, text: `번역 ${cue.id}` }))
            })
          }
        }]
      })
    };
  };

  try {
    const document = {
      ...sourceDocument,
      platform: "youtube",
      cues: Array.from({ length: 6 }, (_, index) => ({
        id: `yt-${index}`,
        start: index * 130,
        end: index * 130 + 5,
        text: "source"
      }))
    };
    const translated = await translateSubtitleDocument(document, {
      onProgress: (progress) => progressEvents.push(progress)
    });

    assert.deepEqual(requestStarts.slice(0, 3), ["yt-0", "yt-1", "yt-2"]);
    assert.equal(maxInFlight, 2);
    assert.equal(progressEvents[0].completedChunkCount, 1);
    assert.equal(progressEvents.at(-1).completedChunkCount, 6);
    assert.equal(progressEvents.at(-1).isComplete, true);
    assert.equal(translated.cues.length, 6);
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("LLM rate limit controller backs off exponentially and stops on the fourth 429", async () => {
  const delays = [];
  const controller = translationInternals.createLlmRequestController({
    waitForRateLimit: async (delayMs) => delays.push(delayMs)
  });
  const error = Object.assign(new Error("HTTP 429: Rate limit exceeded"), { status: 429 });

  await controller.recordRateLimitError(error);
  await controller.recordRateLimitError(error);
  await controller.recordRateLimitError(error);
  assert.deepEqual(delays, [1000, 2000, 4000]);
  await assert.rejects(Promise.resolve(controller.recordRateLimitError(error)), /HTTP 429/);

  assert.equal(controller.concurrentRequestLimit, 1);
  assert.equal(controller.rateLimitErrorCount, 4);
});

test("OpenAI insufficient quota responses are distinguished from generic 429 rate limits", () => {
  assert.equal(translationInternals.isQuotaExceededError({
    status: 429,
    providerErrorType: "insufficient_quota",
    providerErrorCode: "insufficient_quota",
    message: "HTTP 429: billing limit reached"
  }), true);
  assert.equal(translationInternals.isQuotaExceededError({
    status: 429,
    message: "HTTP 429: Rate limit exceeded"
  }), false);
});

test("OpenAI insufficient_quota response skips rate limit retries", async () => {
  const originalFetch = globalThis.fetch;
  const controller = translationInternals.createLlmRequestController({
    waitForRateLimit: async () => assert.fail("quota errors must not enter rate limit backoff")
  });
  let requestCount = 0;

  globalThis.fetch = async () => {
    requestCount += 1;
    return {
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({
        error: {
          message: "You exceeded your current quota, please check your plan and billing details.",
          type: "insufficient_quota",
          param: null,
          code: "insufficient_quota"
        }
      })
    };
  };

  try {
    await assert.rejects(
      translationInternals.translateLlmChunkWithRetry({
        id: "openai",
        apiStyle: "openai-responses",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "openai-key",
        model: "gpt-test"
      }, {
        targetLanguage: "ko",
        translationStyle: "natural"
      }, {
        ...sourceDocument,
        chunkIndex: 0,
        chunkCount: 1
      }, [], controller),
      (error) => error.status === 429
        && error.providerErrorType === "insufficient_quota"
        && error.providerErrorCode === "insufficient_quota"
    );
    assert.equal(requestCount, 1);
    assert.equal(controller.rateLimitErrorCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("LLM serializes later requests after a 429 and retries the affected chunk", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const attemptsByCueId = new Map();
  let inFlight = 0;
  let rateLimitSeen = false;
  let maxInFlightAfterRateLimit = 0;

  globalThis.chrome = {
    i18n: { getUILanguage: () => "ko" },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "openrouter",
            targetLanguage: "ko",
            cacheTranslations: false,
            maxChunkDurationSeconds: 120,
            providerTestStatus: { openrouter: "success" },
            providers: {
              openrouter: { apiKey: "test-key", model: "deepseek/deepseek-v4-flash" }
            }
          }
        }),
        set: async () => {}
      }
    }
  };
  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.messages.find((message) => message.role === "user").content);
    const cueId = input.cues[0].id;
    const attempt = (attemptsByCueId.get(cueId) || 0) + 1;
    attemptsByCueId.set(cueId, attempt);
    inFlight += 1;
    if (rateLimitSeen) {
      maxInFlightAfterRateLimit = Math.max(maxInFlightAfterRateLimit, inFlight);
    }

    await new Promise((resolve) => setTimeout(resolve, cueId === "yt-1" && attempt === 1 ? 2 : 10));
    inFlight -= 1;
    if (cueId === "yt-1" && attempt === 1) {
      rateLimitSeen = true;
      return {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({ error: { message: "Rate limit exceeded" } })
      };
    }

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              translations: input.cues.map((cue) => ({ id: cue.id, text: `번역 ${cue.id}` }))
            })
          }
        }]
      })
    };
  };

  try {
    const document = {
      ...sourceDocument,
      platform: "youtube",
      cues: Array.from({ length: 5 }, (_, index) => ({
        id: `yt-${index}`,
        start: index * 130,
        end: index * 130 + 5,
        text: "source"
      }))
    };
    const translated = await translateSubtitleDocument(document);

    assert.equal(attemptsByCueId.get("yt-1"), 2);
    assert.equal(maxInFlightAfterRateLimit, 1);
    assert.equal(translated.cues[1].text, "번역 yt-1");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("LLM translation retries only empty cue translations", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestCueIds = [];

  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "ko"
    },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "openrouter",
            targetLanguage: "ko",
            cacheTranslations: false,
            providerTestStatus: { openrouter: "success" },
            providers: {
              openrouter: {
                apiKey: "test-key",
                model: "deepseek/deepseek-v4-flash"
              },
              deepl: {
                apiKey: "deepl-key"
              }
            }
          }
        }),
        set: async () => {}
      }
    }
  };

  globalThis.fetch = async (_url, init = {}) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.messages.find((message) => message.role === "user").content);
    requestCueIds.push(input.cues.map((cue) => cue.id));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: input.cues.map((cue, index) => ({
                  id: cue.id,
                  text: requestCueIds.length === 1 && index >= 35 ? "" : `번역 ${cue.id}`
                }))
              })
            }
          }
        ]
      })
    };
  };

  try {
    const document = {
      ...sourceDocument,
      platform: "youtube",
      cues: Array.from({ length: 50 }, (_, index) => ({
        id: `yt-${index}`,
        start: index,
        end: index + 0.5,
        text: `source ${index}`
      }))
    };

    const translated = await translateSubtitleDocument(document);

    assert.deepEqual(requestCueIds.map((ids) => ids.length), [50, 15]);
    assert.deepEqual(requestCueIds[1], Array.from({ length: 15 }, (_, index) => `yt-${index + 35}`));
    assert.equal(translated.cues[34].text, "번역 yt-34");
    assert.equal(translated.cues[35].text, "번역 yt-35");
    assert.equal(translated.cues[49].text, "번역 yt-49");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("DeepL translation splits subtitle cues by text count limit", async () => {
  const originalFetch = globalThis.fetch;
  const requestTextCounts = [];

  globalThis.fetch = async (_url, init = {}) => {
    const body = new URLSearchParams(init.body);
    const texts = body.getAll("text");
    requestTextCounts.push(texts.length);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        translations: texts.map((text) => ({ text: `번역 ${text}` }))
      })
    };
  };

  try {
    const document = {
      ...sourceDocument,
      cues: Array.from({ length: 120 }, (_, index) => ({
        id: `cue-${index}`,
        start: index,
        end: index + 0.5,
        text: `source ${index}`
      }))
    };

    const translations = await translationInternals.translateCuesWithDeepL(document, {
      targetLanguage: "ko"
    }, {
      apiKey: "deepl-key",
      apiStyle: "deepl",
      baseUrl: "https://api-free.deepl.com/v2/translate"
    });

    assert.deepEqual(requestTextCounts, [50, 50, 20]);
    assert.equal(translations.length, 120);
    assert.equal(translations[0].text, "번역 source 0");
    assert.equal(translations[119].text, "번역 source 119");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("DeepL translation keeps each request body under the API size limit", async () => {
  const originalFetch = globalThis.fetch;
  const requestBodyByteLengths = [];
  const encoder = new TextEncoder();

  globalThis.fetch = async (_url, init = {}) => {
    const bodyText = init.body.toString();
    requestBodyByteLengths.push(encoder.encode(bodyText).length);
    const texts = new URLSearchParams(bodyText).getAll("text");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        translations: texts.map((text) => ({ text: `번역 ${text.slice(0, 8)}` }))
      })
    };
  };

  try {
    const longText = "x".repeat(30000);
    const document = {
      ...sourceDocument,
      cues: Array.from({ length: 8 }, (_, index) => ({
        id: `cue-${index}`,
        start: index,
        end: index + 0.5,
        text: `${longText}${index}`
      }))
    };

    const translations = await translationInternals.translateCuesWithDeepL(document, {
      targetLanguage: "ko",
      sourceLanguage: "en"
    }, {
      apiKey: "deepl-key",
      apiStyle: "deepl",
      baseUrl: "https://api-free.deepl.com/v2/translate"
    });

    assert.ok(requestBodyByteLengths.length > 1, "expected long DeepL payloads to be split");
    assert.ok(
      requestBodyByteLengths.every((byteLength) => byteLength <= 128 * 1024),
      `expected all request bodies to stay within 128 KiB, got ${requestBodyByteLengths.join(", ")}`
    );
    assert.equal(translations.length, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google Translate sends subtitle text as a POST form instead of a redirect-prone query URL", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest;

  globalThis.fetch = async (url, init = {}) => {
    capturedRequest = { url: String(url), init };
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [[[`첫 번째 번역\n\n두 번째 번역`]]]
    };
  };

  try {
    const document = {
      ...sourceDocument,
      cues: [
        { id: "cue-1", start: 0, end: 1, text: "First subtitle" },
        { id: "cue-2", start: 1, end: 2, text: "Second subtitle" }
      ]
    };
    const translations = await translationInternals.translateCuesWithGoogle(document, {
      targetLanguage: "ko",
      sourceLanguage: "en"
    }, {
      apiStyle: "google-translate",
      baseUrl: "https://translate.googleapis.com/translate_a/single"
    });

    assert.equal(capturedRequest.url, "https://translate.googleapis.com/translate_a/single");
    assert.equal(capturedRequest.init.method, "POST");
    assert.equal(capturedRequest.init.redirect, "error");
    assert.equal(
      capturedRequest.init.headers["Content-Type"],
      "application/x-www-form-urlencoded;charset=UTF-8"
    );
    const body = new URLSearchParams(capturedRequest.init.body.toString());
    assert.equal(body.get("client"), "gtx");
    assert.equal(body.get("sl"), "en");
    assert.equal(body.get("tl"), "ko");
    assert.equal(body.get("q"), "\n\nFirst subtitle\n\nSecond subtitle");
    assert.deepEqual(translations.map((item) => item.text), ["첫 번째 번역", "두 번째 번역"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("temporary DeepL quota exceeded falls back to Google Translate", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestHosts = [];
  const progressReasons = [];

  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "ko"
    },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "googleTranslate",
            targetLanguage: "ko",
            cacheTranslations: false,
            fallback: {
              providerId: "deepl"
            },
            providers: {
              googleTranslate: {
                id: "googleTranslate",
                apiStyle: "google-translate",
                baseUrl: "https://translate.googleapis.com/translate_a/single"
              },
              deepl: {
                id: "deepl",
                apiStyle: "deepl",
                apiKey: "deepl-key",
                baseUrl: "https://api-free.deepl.com/v2/translate"
              }
            }
          }
        }),
        set: async () => {}
      }
    }
  };

  globalThis.fetch = async (url) => {
    const host = new URL(String(url)).host;
    requestHosts.push(host);
    if (host === "api-free.deepl.com") {
      return {
        ok: false,
        status: 456,
        statusText: "",
        json: async () => ({ message: "Quota exceeded" })
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [[["구글 번역"]]]
    };
  };

  try {
    const translated = await translateSubtitleDocument(sourceDocument, {
      providerId: "deepl",
      onProgress: (progress) => progressReasons.push(progress.fallbackReason)
    });

    assert.deepEqual(requestHosts, ["api-free.deepl.com", "translate.googleapis.com"]);
    assert.equal(translated.providerId, "deepl");
    assert.equal(translated.fallbackProviderId, "googleTranslate");
    assert.equal(translated.fallbackReason, "quota_exceeded");
    assert.equal(translated.cues[0].text, "구글 번역");
    assert.deepEqual(progressReasons, ["quota_exceeded"]);
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("provider connection mode reports DeepL quota errors without Google fallback", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestHosts = [];

  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "ko"
    },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            targetLanguage: "ko",
            cacheTranslations: false,
            providers: {
              googleTranslate: {
                id: "googleTranslate",
                apiStyle: "google-translate",
                baseUrl: "https://translate.googleapis.com/translate_a/single"
              },
              deepl: {
                id: "deepl",
                apiStyle: "deepl",
                apiKey: "deepl-key",
                baseUrl: "https://api-free.deepl.com/v2/translate"
              }
            }
          }
        }),
        set: async () => {}
      }
    }
  };

  globalThis.fetch = async (url) => {
    requestHosts.push(new URL(String(url)).host);
    return {
      ok: false,
      status: 456,
      statusText: "",
      json: async () => ({ message: "Quota exceeded" })
    };
  };

  try {
    await assert.rejects(
      translateSubtitleDocument(sourceDocument, {
        providerId: "deepl",
        forceNoCache: true,
        allowFallback: false
      }),
      /DeepL failed: HTTP 456: Quota exceeded/
    );
    assert.deepEqual(requestHosts, ["api-free.deepl.com"]);
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("LLM rate limit falls back to Google Translate after four 429 responses", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const requestHosts = [];

  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "ko"
    },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "google",
            targetLanguage: "ko",
            cacheTranslations: false,
            providerTestStatus: { google: "success" },
            fallback: {
              providerId: "deepl"
            },
            providers: {
              googleTranslate: {
                id: "googleTranslate",
                apiStyle: "google-translate",
                baseUrl: "https://translate.googleapis.com/translate_a/single"
              },
              deepl: {
                id: "deepl",
                apiStyle: "deepl",
                apiKey: "deepl-key",
                baseUrl: "https://api-free.deepl.com/v2/translate"
              },
              google: {
                id: "google",
                apiStyle: "google-generate-content",
                baseUrl: "https://generativelanguage.googleapis.com/v1beta",
                apiKey: "google-key",
                model: "gemini-flash-lite-latest",
                maxTokens: 4096
              }
            }
          }
        }),
        set: async () => {}
      }
    }
  };

  globalThis.fetch = async (url) => {
    const host = new URL(String(url)).host;
    requestHosts.push(host);
    if (host === "generativelanguage.googleapis.com") {
      return {
        ok: false,
        status: 429,
        statusText: "",
        json: async () => ({
          error: {
            code: 429,
            message: "Rate limit exceeded."
          }
        })
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [[["구글 번역"]]]
    };
  };
  globalThis.setTimeout = (callback) => {
    queueMicrotask(callback);
    return 0;
  };

  try {
    const translated = await translateSubtitleDocument(sourceDocument);

    assert.deepEqual(requestHosts, [
      "generativelanguage.googleapis.com",
      "generativelanguage.googleapis.com",
      "generativelanguage.googleapis.com",
      "generativelanguage.googleapis.com",
      "translate.googleapis.com"
    ]);
    assert.equal(translated.providerId, "google");
    assert.equal(translated.fallbackProviderId, "googleTranslate");
    assert.equal(translated.fallbackReason, "rate_limit_exceeded");
    assert.equal(translated.cues[0].text, "구글 번역");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("LLM failure falls back to Google Translate even when DeepL is selected for temporary translation", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestHosts = [];

  globalThis.chrome = {
    i18n: {
      getUILanguage: () => "ko"
    },
    storage: {
      local: {
        get: async () => ({
          llmSettings: {
            activeProvider: "google",
            targetLanguage: "ko",
            cacheTranslations: false,
            fallback: {
              providerId: "deepl"
            },
            providerTestStatus: {
              deepl: "success",
              google: "success"
            },
            providers: {
              googleTranslate: {
                id: "googleTranslate",
                apiStyle: "google-translate",
                baseUrl: "https://translate.googleapis.com/translate_a/single"
              },
              deepl: {
                id: "deepl",
                apiStyle: "deepl",
                apiKey: "deepl-key",
                baseUrl: "https://api-free.deepl.com/v2/translate"
              },
              google: {
                id: "google",
                apiStyle: "google-generate-content",
                baseUrl: "https://generativelanguage.googleapis.com/v1beta",
                apiKey: "google-key",
                model: "gemini-flash-lite-latest",
                maxTokens: 4096
              }
            }
          }
        }),
        set: async () => {}
      }
    }
  };

  globalThis.fetch = async (url) => {
    const host = new URL(String(url)).host;
    requestHosts.push(host);
    if (host === "generativelanguage.googleapis.com") {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({
          error: {
            message: "temporary upstream failure"
          }
        })
      };
    }
    if (host === "api-free.deepl.com") {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          translations: [{ text: "딥엘 번역" }]
        })
      };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => [[["구글 번역"]]]
    };
  };

  try {
    const translated = await translateSubtitleDocument(sourceDocument);

    assert.deepEqual(requestHosts, ["generativelanguage.googleapis.com", "translate.googleapis.com"]);
    assert.equal(translated.providerId, "google");
    assert.equal(translated.fallbackProviderId, "googleTranslate");
    assert.equal(translated.cues[0].text, "구글 번역");
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});
