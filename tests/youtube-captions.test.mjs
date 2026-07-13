import assert from "node:assert/strict";
import test from "node:test";
import { fetchYoutubeTranscript, youtubeCaptionInternals } from "../extension/platforms/youtube-captions.js";

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function textResponse(text, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    json: async () => ({}),
    text: async () => text
  };
}

test("fetchYoutubeTranscript keeps the signed caption URL intact and sends credentials", async () => {
  const originalFetch = globalThis.fetch;
  const captionUrl = "https://www.youtube.com/api/timedtext?v=dtAJ2dOd3ko&lang=en&fmt=json3&sig=signed";
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (String(url).startsWith("https://www.youtube.com/watch")) {
      return textResponse('"INNERTUBE_API_KEY":"test-key"');
    }

    if (String(url).startsWith("https://www.youtube.com/youtubei/v1/player")) {
      return jsonResponse({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                languageCode: "en",
                name: { simpleText: "English" },
                baseUrl: captionUrl
              }
            ]
          }
        }
      });
    }

    if (String(url) === captionUrl) {
      return textResponse(JSON.stringify({
        events: [
          {
            tStartMs: 1250,
            dDurationMs: 2500,
            segs: [
              { utf8: "Hello " },
              { utf8: "world" }
            ]
          }
        ]
      }));
    }

    return textResponse("", {
      ok: false,
      status: 403,
      statusText: "Forbidden"
    });
  };

  try {
    const document = await fetchYoutubeTranscript({
      urlOrId: "https://www.youtube.com/watch?v=dtAJ2dOd3ko"
    });

    assert.equal(document.videoId, "dtAJ2dOd3ko");
    assert.equal(document.sourceLanguage, "en");
    assert.deepEqual(document.cues, [
      {
        id: "yt-0",
        start: 1.25,
        end: 3.75,
        text: "Hello world"
      }
    ]);
    assert.equal(calls.at(-1).url, captionUrl);
    assert.equal(calls.at(-1).init.credentials, "include");
    assert.equal(calls.at(-1).init.referrer, "https://www.youtube.com/watch?v=dtAJ2dOd3ko");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchYoutubeTranscript uses caption tracks embedded in the watch page before player API fallback", async () => {
  const originalFetch = globalThis.fetch;
  const watchCaptionUrl = "https://www.youtube.com/api/timedtext?v=C_GG5g38vLU&lang=en&fmt=json3&sig=watch-page";
  const androidCaptionUrl = "https://www.youtube.com/api/timedtext?v=C_GG5g38vLU&lang=en&fmt=json3&sig=android";
  const calls = [];
  const initialPlayerResponse = {
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            languageCode: "en",
            name: { simpleText: "English" },
            baseUrl: watchCaptionUrl
          }
        ]
      }
    }
  };

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (String(url).startsWith("https://www.youtube.com/watch")) {
      return textResponse(`
        <script>var ytInitialPlayerResponse = ${JSON.stringify(initialPlayerResponse)};</script>
        <script>ytcfg.set({"INNERTUBE_API_KEY":"test-key"});</script>
      `);
    }

    if (String(url).startsWith("https://www.youtube.com/youtubei/v1/player")) {
      return jsonResponse({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                languageCode: "en",
                name: { simpleText: "English Android" },
                baseUrl: androidCaptionUrl
              }
            ]
          }
        }
      });
    }

    if (String(url) === watchCaptionUrl) {
      return textResponse(JSON.stringify({
        events: [
          {
            tStartMs: 0,
            dDurationMs: 1000,
            segs: [{ utf8: "Watch page caption" }]
          }
        ]
      }));
    }

    return textResponse("", {
      ok: false,
      status: 403,
      statusText: "Forbidden"
    });
  };

  try {
    const document = await fetchYoutubeTranscript({
      urlOrId: "https://www.youtube.com/watch?v=C_GG5g38vLU&t=345s"
    });

    assert.equal(document.cues[0].text, "Watch page caption");
    assert.ok(!calls.some((call) => call.url.includes("/youtubei/v1/player")), "expected no player API fallback when watch page tracks exist");
    assert.equal(calls.at(-1).url, watchCaptionUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchYoutubeTranscript uses caption tracks supplied by the current page", async () => {
  const originalFetch = globalThis.fetch;
  const captionUrl = "https://www.youtube.com/api/timedtext?v=QGaPF8NsOE4&lang=en&fmt=json3&sig=page";
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (String(url) === captionUrl) {
      return textResponse(JSON.stringify({
        events: [
          {
            tStartMs: 1000,
            dDurationMs: 1500,
            segs: [{ utf8: "Current page caption" }]
          }
        ]
      }));
    }

    return textResponse("", {
      ok: false,
      status: 403,
      statusText: "Forbidden"
    });
  };

  try {
    const document = await fetchYoutubeTranscript({
      urlOrId: "https://www.youtube.com/watch?v=QGaPF8NsOE4",
      videoId: "QGaPF8NsOE4",
      captionTracks: [
        {
          videoId: "QGaPF8NsOE4",
          languageCode: "en",
          label: "English",
          isAutoGenerated: true,
          baseUrl: captionUrl
        }
      ]
    });

    assert.equal(document.cues[0].text, "Current page caption");
    assert.ok(!calls.some((call) => call.url.startsWith("https://www.youtube.com/watch")), "expected no watch page fetch when page tracks are supplied");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchYoutubeTranscript retries explicit json3 format when the default timedtext payload is empty", async () => {
  const originalFetch = globalThis.fetch;
  const baseUrl = "https://www.youtube.com/api/timedtext?v=_mRLeAhtsQU&lang=en&kind=asr&sig=page";
  const json3Url = `${baseUrl}&fmt=json3`;
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (String(url) === baseUrl) {
      return textResponse("");
    }

    if (String(url) === json3Url) {
      return textResponse(JSON.stringify({
        events: [
          {
            tStartMs: 683000,
            dDurationMs: 2200,
            segs: [{ utf8: "Explicit format caption" }]
          }
        ]
      }));
    }

    return textResponse("", {
      ok: false,
      status: 403,
      statusText: "Forbidden"
    });
  };

  try {
    const document = await fetchYoutubeTranscript({
      urlOrId: "https://www.youtube.com/watch?v=_mRLeAhtsQU&t=683s",
      videoId: "_mRLeAhtsQU",
      captionTracks: [
        {
          videoId: "_mRLeAhtsQU",
          languageCode: "en",
          label: "English auto",
          isAutoGenerated: true,
          baseUrl
        }
      ]
    });

    assert.equal(document.cues[0].text, "Explicit format caption");
    assert.deepEqual(calls.map((call) => call.url), [baseUrl, json3Url]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchYoutubeTranscript falls back to the YouTube transcript panel endpoint when timedtext payloads are empty", async () => {
  const originalFetch = globalThis.fetch;
  const baseUrl = "https://www.youtube.com/api/timedtext?v=_mRLeAhtsQU&lang=en&kind=asr&sig=page";
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (String(url).startsWith(baseUrl)) {
      return textResponse("");
    }

    if (String(url).startsWith("https://www.youtube.com/youtubei/v1/get_transcript")) {
      return jsonResponse({
        actions: [
          {
            updateEngagementPanelAction: {
              content: {
                transcriptRenderer: {
                  body: {
                    transcriptBodyRenderer: {
                      cueGroups: [
                        {
                          transcriptCueGroupRenderer: {
                            cues: [
                              {
                                transcriptCueRenderer: {
                                  cue: {
                                    runs: [
                                      { text: "Panel " },
                                      { text: "caption" }
                                    ]
                                  },
                                  startOffsetMs: "683000",
                                  durationMs: "2200"
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        ]
      });
    }

    return textResponse("", {
      ok: false,
      status: 403,
      statusText: "Forbidden"
    });
  };

  try {
    const document = await fetchYoutubeTranscript({
      urlOrId: "https://www.youtube.com/watch?v=_mRLeAhtsQU&t=683s",
      videoId: "_mRLeAhtsQU",
      captionTracks: [
        {
          videoId: "_mRLeAhtsQU",
          languageCode: "en",
          label: "English auto",
          isAutoGenerated: true,
          baseUrl
        }
      ],
      transcriptParams: "panel%3D%3D",
      innertubeApiKey: "test-key",
      innertubeContext: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20260706.00.00"
        }
      }
    });

    assert.equal(document.cues[0].text, "Panel caption");
    assert.equal(document.cues[0].start, 683);
    assert.equal(document.cues[0].end, 685.2);
    const transcriptCall = calls.find((call) => call.url.includes("/youtubei/v1/get_transcript"));
    assert.ok(transcriptCall, "expected get_transcript fallback to be called");
    assert.equal(JSON.parse(transcriptCall.init.body).params, "panel==");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchYoutubeTranscript marks transcript panel 403 errors as retryable on the YouTube page", async () => {
  const originalFetch = globalThis.fetch;
  const baseUrl = "https://www.youtube.com/api/timedtext?v=C_GG5g38vLU&lang=en&kind=asr&sig=page";

  globalThis.fetch = async (url) => {
    if (String(url).startsWith(baseUrl)) {
      return textResponse("");
    }

    if (String(url).startsWith("https://www.youtube.com/youtubei/v1/get_transcript")) {
      return textResponse("", {
        ok: false,
        status: 403,
        statusText: "Forbidden"
      });
    }

    return textResponse("", {
      ok: false,
      status: 404,
      statusText: "Not Found"
    });
  };

  try {
    await assert.rejects(
      () => fetchYoutubeTranscript({
        urlOrId: "https://www.youtube.com/watch?v=C_GG5g38vLU&t=405s",
        videoId: "C_GG5g38vLU",
        captionTracks: [
          {
            videoId: "C_GG5g38vLU",
            languageCode: "en",
            label: "English auto",
            isAutoGenerated: true,
            baseUrl
          }
        ],
        transcriptParams: "panel%3D%3D",
        innertubeApiKey: "test-key",
        innertubeContext: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20260706.00.00"
          }
        }
      }),
      (error) => {
        assert.equal(error.retryOnPage?.type, "youtubeTranscriptPanel");
        assert.equal(error.retryOnPage?.videoId, "C_GG5g38vLU");
        assert.equal(error.retryOnPage?.languageCode, "en");
        assert.equal(error.retryOnPage?.params, "panel%3D%3D");
        assert.equal(error.retryOnPage?.innertubeApiKey, "test-key");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchYoutubeTranscript falls back to ref-style Android player tracks before transcript panel fallback", async () => {
  const originalFetch = globalThis.fetch;
  const pageBaseUrl = "https://www.youtube.com/api/timedtext?v=C_GG5g38vLU&lang=en&kind=asr&sig=page";
  const androidBaseUrl = "https://www.youtube.com/api/timedtext?v=C_GG5g38vLU&lang=en&kind=asr&fmt=json3&sig=android";
  const androidPlainUrl = "https://www.youtube.com/api/timedtext?v=C_GG5g38vLU&lang=en&kind=asr&sig=android";
  const calls = [];

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (String(url).startsWith(pageBaseUrl)) {
      return textResponse("");
    }

    if (String(url).startsWith("https://www.youtube.com/youtubei/v1/player")) {
      return jsonResponse({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                languageCode: "en",
                kind: "asr",
                name: { simpleText: "English auto" },
                baseUrl: androidBaseUrl
              }
            ]
          }
        }
      });
    }

    if (String(url) === androidPlainUrl) {
      return textResponse(`<transcript><text start="405" dur="2.5">Android caption</text></transcript>`);
    }

    if (String(url).startsWith("https://www.youtube.com/youtubei/v1/get_transcript")) {
      return textResponse("", {
        ok: false,
        status: 400,
        statusText: "Precondition check failed."
      });
    }

    return textResponse("", {
      ok: false,
      status: 404,
      statusText: "Not Found"
    });
  };

  try {
    const document = await fetchYoutubeTranscript({
      urlOrId: "https://www.youtube.com/watch?v=C_GG5g38vLU&t=405s",
      videoId: "C_GG5g38vLU",
      captionTracks: [
        {
          videoId: "C_GG5g38vLU",
          languageCode: "en",
          label: "English auto",
          isAutoGenerated: true,
          baseUrl: pageBaseUrl
        }
      ],
      transcriptParams: "panel%3D%3D",
      innertubeApiKey: "test-key",
      innertubeContext: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20260706.00.00"
        }
      }
    });

    const playerCall = calls.find((call) => call.url.includes("/youtubei/v1/player"));
    assert.ok(playerCall, "expected Android player fallback to be called");
    assert.equal(JSON.parse(playerCall.init.body).context.client.clientName, "ANDROID");
    assert.equal(calls.some((call) => call.url.includes("/youtubei/v1/get_transcript")), false);
    assert.equal(calls.find((call) => call.url === androidPlainUrl)?.url, androidPlainUrl);
    assert.equal(document.cues[0].text, "Android caption");
    assert.equal(document.cues[0].start, 405);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("selectCaptionTrack prefers a manual caption over an auto-generated caption for the requested language", () => {
  const tracks = [
    {
      languageCode: "ko",
      label: "Korean auto",
      isAutoGenerated: true
    },
    {
      languageCode: "ko",
      label: "Korean manual",
      isAutoGenerated: false
    },
    {
      languageCode: "en",
      label: "English manual",
      isAutoGenerated: false
    }
  ];

  assert.equal(youtubeCaptionInternals.selectCaptionTrack(tracks, "ko"), tracks[1]);
});

test("selectCaptionTrack prefers an English manual caption before English auto-generated captions", () => {
  const tracks = [
    {
      languageCode: "en",
      label: "English auto",
      isAutoGenerated: true
    },
    {
      languageCode: "en",
      label: "English manual",
      isAutoGenerated: false
    },
    {
      languageCode: "ja",
      label: "Japanese manual",
      isAutoGenerated: false
    }
  ];

  assert.equal(youtubeCaptionInternals.selectCaptionTrack(tracks), tracks[1]);
});

test("selectCaptionTrack keeps a sole caption, then prefers English manual and automatic captions", () => {
  const koreanOnly = [{ languageCode: "ko", isAutoGenerated: false }];
  const englishAutomatic = { languageCode: "en", isAutoGenerated: true };
  const japaneseManual = { languageCode: "ja", isAutoGenerated: false };

  assert.equal(youtubeCaptionInternals.selectCaptionTrack(koreanOnly), koreanOnly[0]);
  assert.equal(youtubeCaptionInternals.selectCaptionTrack([japaneseManual, englishAutomatic]), englishAutomatic);
  assert.equal(youtubeCaptionInternals.selectCaptionTrack([japaneseManual]), japaneseManual);
  assert.equal(youtubeCaptionInternals.selectCaptionTrack([japaneseManual, koreanOnly[0]], "en"), japaneseManual);
});

test("fetchYoutubeTranscript uses the selected language when a page caption URL is stale", async () => {
  const originalFetch = globalThis.fetch;
  const currentCaptionUrl = "https://www.youtube.com/api/timedtext?v=QGaPF8NsOE4&lang=en&fmt=json3&sig=current";

  globalThis.fetch = async (url) => {
    if (String(url) === currentCaptionUrl) {
      return textResponse(JSON.stringify({
        events: [{ tStartMs: 1000, dDurationMs: 1500, segs: [{ utf8: "Current English caption" }] }]
      }));
    }
    return textResponse("", { ok: false, status: 403, statusText: "Forbidden" });
  };

  try {
    const document = await fetchYoutubeTranscript({
      urlOrId: "https://www.youtube.com/watch?v=QGaPF8NsOE4",
      videoId: "QGaPF8NsOE4",
      languageCode: "en",
      captionTrackUrl: "https://www.youtube.com/api/timedtext?v=QGaPF8NsOE4&lang=en&sig=expired",
      captionTracks: [{
        videoId: "QGaPF8NsOE4",
        languageCode: "en",
        label: "English",
        baseUrl: currentCaptionUrl
      }]
    });

    assert.equal(document.sourceLanguage, "en");
    assert.equal(document.cues[0].text, "Current English caption");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parseYoutubeTranscriptPayload parses WebVTT caption payloads", () => {
  const cues = youtubeCaptionInternals.parseYoutubeTranscriptPayload(`WEBVTT

00:00:01.000 --> 00:00:03.500
Hello from VTT

00:00:04.000 --> 00:00:05.000
Second cue
`);

  assert.deepEqual(cues, [
    {
      id: "yt-0",
      start: 1,
      end: 3.5,
      text: "Hello from VTT"
    },
    {
      id: "yt-1",
      start: 4,
      end: 5,
      text: "Second cue"
    }
  ]);
});
