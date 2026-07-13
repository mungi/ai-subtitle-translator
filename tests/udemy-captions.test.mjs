import assert from "node:assert/strict";
import test from "node:test";
import { fetchUdemyTranscript } from "../extension/platforms/udemy-captions.js";

function jsonResponse(body, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
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

test("Udemy transcript falls back to GraphQL lecture captions when REST captions are unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const englishCaptionUrl = "https://vtt-cf.udemycdn.com/72662767/en_US/test.vtt";

  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });

    if (String(url).includes("/api-2.0/users/me/subscribed-courses/6928347/lectures/53542835/")) {
      return jsonResponse({ detail: "Not found" }, {
        ok: false,
        status: 404,
        statusText: "Not Found"
      });
    }

    if (String(url) === "https://skax.udemy.com/api/2024-01/graphql/") {
      const body = JSON.parse(init.body);
      assert.match(body.query, /LectureDetails/);
      assert.deepEqual(body.variables, { id: "53542835" });
      assert.equal(init.method, "POST");
      assert.equal(init.credentials, "include");

      return jsonResponse({
        data: {
          lecture: {
            __typename: "VideoLecture",
            asset: {
              __typename: "AssetVideo",
              id: "72662767",
              captions: [
                {
                  id: "de",
                  url: "https://vtt-cf.udemycdn.com/72662767/de_DE/test.vtt",
                  language: "de-DE",
                  videoLabel: "German [Auto]",
                  source: "AUTO",
                  status: "SUCCESS"
                },
                {
                  id: "en",
                  url: englishCaptionUrl,
                  language: "en-US",
                  videoLabel: "English (US) [Auto]",
                  source: "AUTO",
                  status: "SUCCESS"
                }
              ]
            }
          }
        }
      });
    }

    if (String(url) === englishCaptionUrl) {
      assert.equal(init.credentials, "include");
      return textResponse(`WEBVTT

00:00:01.000 --> 00:00:03.500
Hello from standalone Udemy.
`);
    }

    return textResponse("", {
      ok: false,
      status: 500,
      statusText: "Unexpected URL"
    });
  };

  try {
    const document = await fetchUdemyTranscript({
      courseId: "6928347",
      lectureId: "53542835",
      hostname: "skax.udemy.com"
    });

    assert.equal(document.platform, "udemy");
    assert.equal(document.videoId, "6928347/lectures/53542835");
    assert.equal(document.sourceLanguage, "en-US");
    assert.deepEqual(document.cues, [
      {
        id: "udemy-0",
        start: 1,
        end: 3.5,
        text: "Hello from standalone Udemy."
      }
    ]);
    assert.ok(calls.some((call) => call.url === "https://skax.udemy.com/api/2024-01/graphql/"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
