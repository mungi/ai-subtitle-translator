import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  buildGenericProbeMatches,
  describeSiteForUrl,
  detectDedicatedPlatform,
  isGenericEligibleUrl,
  normalizeGenericHosts
} from "../extension/shared/platform-urls.js";
import {
  detectCaptionFormat,
  fetchGenericTranscript,
  isAllowedGenericCaptionUrl,
  listGenericHlsTracks,
  mergeSegmentCues,
  parseGenericTranscript,
  parseHlsSubtitleTracks,
  parseTtml
} from "../extension/platforms/generic-captions.js";
import { isGenericContentSender, validateBackgroundMessage, validateMessageSender } from "../extension/shared/message-contracts.js";
import { DEFAULT_SETTINGS } from "../extension/shared/defaults.js";
import { normalizeSettings } from "../extension/shared/storage.js";

const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));

// ---------------------------------------------------------------- platform table

test("the platform table classifies dedicated sites, including the two NVIDIA players on one host", () => {
  assert.equal(detectDedicatedPlatform("https://www.youtube.com/watch?v=x").id, "youtube");
  assert.equal(detectDedicatedPlatform("https://www.nvidia.com/en-us/training/academy/course-player/?x").id, "nvidia");
  assert.equal(detectDedicatedPlatform("https://www.nvidia.com/en-us/on-demand/session/gtc-1/").id, "nvidiaOnDemand");
  assert.equal(detectDedicatedPlatform("https://www.nvidia.com/en-us/ai/"), null);
  assert.equal(detectDedicatedPlatform("https://www.linkedin.com/learning/course/video").id, "linkedin");
  assert.equal(detectDedicatedPlatform("https://www.linkedin.com/feed/"), null);
  assert.equal(detectDedicatedPlatform("https://example.com/video"), null);
  assert.equal(isGenericEligibleUrl("https://example.com/video"), true);
  assert.equal(isGenericEligibleUrl("chrome://extensions"), false);
  assert.equal(isGenericEligibleUrl("https://www.udemy.com/course/x/learn/lecture/1"), false);
});

test("every manifest content-script page is a dedicated site in the shared table", () => {
  const patterns = manifest.content_scripts.flatMap((entry) => entry.matches);
  for (const pattern of patterns) {
    const sample = pattern
      .replace("https://*.", "https://www.")
      .replace(/\/\*\//g, "/en-us/")
      .replace(/\*$/, "sample/path");
    assert.ok(detectDedicatedPlatform(sample), `${pattern} -> ${sample}`);
  }
});

test("site descriptions drive the popup: a switch for supported sites, the list button elsewhere", () => {
  const settings = { platforms: { youtube: false }, genericAllowedHosts: ["listed.example"] };
  const youtube = describeSiteForUrl("https://www.youtube.com/watch?v=1", settings);
  assert.equal(youtube.kind, "dedicated");
  assert.equal(youtube.active, false);
  assert.equal(youtube.platform.label, "YouTube");
  assert.deepEqual(describeSiteForUrl("https://listed.example/a", settings), { kind: "generic", host: "listed.example", genericEnabled: true, listed: true, active: true });
  assert.deepEqual(describeSiteForUrl("https://other.example/a", settings), { kind: "generic", host: "other.example", genericEnabled: true, listed: false, active: false });
  assert.equal(describeSiteForUrl("https://listed.example/a", { ...settings, platforms: { generic: false } }).active, false);
  assert.equal(describeSiteForUrl("chrome://newtab", settings).kind, "unsupported");
});

test("listed hosts are normalized and are the only probe matches", () => {
  assert.deepEqual(normalizeGenericHosts(["Example.COM.", "bad host", "example.com", 3]), ["example.com"]);
  assert.deepEqual(buildGenericProbeMatches(["www.example.com", "video.example.org"]), ["*://www.example.com/*", "*://video.example.org/*"]);
  assert.deepEqual(buildGenericProbeMatches([]), []);
});

test("the generic player is on by default but runs only on listed sites", () => {
  assert.equal(DEFAULT_SETTINGS.platforms.generic, true);
  assert.deepEqual(DEFAULT_SETTINGS.genericAllowedHosts, []);
  assert.equal(normalizeSettings({}).platforms.generic, true);
  assert.equal(normalizeSettings({ platforms: { generic: false } }).platforms.generic, false);
  assert.deepEqual(normalizeSettings({ genericAllowedHosts: ["a.example", "A.example"] }).genericAllowedHosts, ["a.example"]);
});

// ---------------------------------------------------------------- worker caption module

test("generic caption URLs must be public http(s) addresses", () => {
  assert.equal(isAllowedGenericCaptionUrl("https://cdn.example.com/a.vtt"), true);
  assert.equal(isAllowedGenericCaptionUrl("http://cdn.example.com/a.vtt"), true);
  for (const blocked of [
    "file:///c:/a.vtt", "https://localhost/a.vtt", "http://127.0.0.1/a.vtt", "http://10.1.2.3/a.vtt",
    "http://192.168.0.5/a.vtt", "http://172.20.0.1/a.vtt", "http://169.254.169.254/latest", "http://[::1]/a.vtt",
    "http://[fd00::1]/a.vtt", "https://intranet/a.vtt", "https://printer.local/a.vtt", "https://user:pw@cdn.example.com/a.vtt"
  ]) {
    assert.equal(isAllowedGenericCaptionUrl(blocked), false, blocked);
  }
});

test("caption formats are detected and TTML is parsed into repaired cues", () => {
  assert.equal(detectCaptionFormat("WEBVTT\n\n00:00.000 --> 00:01.000\nhi"), "vtt");
  assert.equal(detectCaptionFormat("1\n00:00:01,000 --> 00:00:02,000\nhi"), "srt");
  assert.equal(detectCaptionFormat("#EXTM3U\n#EXT-X-VERSION:3"), "hls");
  assert.equal(detectCaptionFormat('<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml">'), "ttml");
  assert.equal(detectCaptionFormat("<html>nope</html>"), "");

  const cues = parseTtml(`<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml" ttp:tickRate="10000000"><body><div>
    <p begin="00:00:01.000" end="00:00:02.500">Hello<br/>world</p>
    <p begin="30000000t" dur="10000000t">tick &amp; time</p>
    <p begin="5s" end="5s">zero length</p>
  </div></body></tt>`);
  assert.deepEqual(cues.map((cue) => [cue.start, cue.end, cue.text]), [
    [1, 2.5, "Hello world"],
    [3, 4, "tick & time"],
    [5, 5.5, "zero length"]
  ]);
});

test("HLS master playlists list their subtitle renditions (relative URIs, forced tracks skipped)", () => {
  const master = [
    "#EXTM3U",
    '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English (auto-generated)",LANGUAGE="en",URI="subtitle/eng/a.m3u8"',
    '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Forced",LANGUAGE="en",FORCED=YES,URI="subtitle/forced.m3u8"',
    '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="Audio",URI="audio.m3u8"',
    '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Korean",LANGUAGE="ko",URI="http://127.0.0.1/evil.m3u8"',
    "#EXT-X-STREAM-INF:BANDWIDTH=1,SUBTITLES=\"subs\"",
    "video/720.m3u8"
  ].join("\n");
  const tracks = parseHlsSubtitleTracks(master, "https://video.example.com/course/master.m3u8?v=1");
  assert.deepEqual(tracks, [{
    languageCode: "en",
    label: "English (auto-generated)",
    isAutoGenerated: true,
    trackUrl: "https://video.example.com/course/subtitle/eng/a.m3u8",
    format: "hls"
  }]);
});

function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    if (!route) return new Response("missing", { status: 404 });
    const response = new Response(route.body, { status: route.status || 200, headers: route.headers || {} });
    if (route.redirectTo) Object.defineProperty(response, "url", { value: route.redirectTo });
    return response;
  };
  return { fetchImpl, calls };
}

test("a VTT track becomes a generic document; the worker sends no cookies and refuses private redirects", async () => {
  const { fetchImpl, calls } = mockFetch({
    "https://cdn.example.com/en.vtt": { body: "WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nHello <b>there</b>\n" },
    "https://cdn.example.com/redirect.vtt": { body: "WEBVTT\n\n00:00.000 --> 00:01.000\nx\n", redirectTo: "http://10.0.0.1/secret.vtt" },
    "https://cdn.example.com/page.html": { body: "<html></html>" }
  });
  const document = await fetchGenericTranscript({ sessionKey: "generic:a:b", trackUrl: "https://cdn.example.com/en.vtt", sourceLanguage: "en" }, { fetchImpl });
  assert.deepEqual(document, {
    platform: "generic",
    videoId: "generic:a:b",
    sourceLanguage: "en",
    cues: [{ id: "1", start: 1, end: 2, text: "Hello there" }]
  });
  assert.equal(calls[0].init.credentials, "omit");
  await assert.rejects(fetchGenericTranscript({ sessionKey: "k", trackUrl: "https://cdn.example.com/redirect.vtt" }, { fetchImpl }), /disallowed address/);
  await assert.rejects(fetchGenericTranscript({ sessionKey: "k", trackUrl: "https://cdn.example.com/page.html" }, { fetchImpl }), /No captions/);
  await assert.rejects(fetchGenericTranscript({ sessionKey: "k", trackUrl: "http://localhost/a.vtt" }, { fetchImpl }), /not allowed/);
});

test("an HLS subtitle playlist is followed from the master to its segments and merged without duplicates", async () => {
  const { fetchImpl } = mockFetch({
    "https://v.example.com/m/master.m3u8": { body: '#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="s",NAME="English",LANGUAGE="en",URI="subs/en.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv.m3u8\n' },
    "https://v.example.com/m/subs/en.m3u8": { body: "#EXTM3U\n#EXT-X-TARGETDURATION:300\n#EXTINF:300,\nseg1.vtt\n#EXTINF:300,\nseg2.vtt\n#EXT-X-ENDLIST\n" },
    "https://v.example.com/m/subs/seg1.vtt": { body: "WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:127826\n\n00:00:01.000 --> 00:00:03.000\nfirst\n\n00:04:59.000 --> 00:05:01.000\nacross the boundary\n" },
    "https://v.example.com/m/subs/seg2.vtt": { body: "WEBVTT\n\n00:04:59.000 --> 00:05:01.000\nacross the boundary\n\n00:05:02.000 --> 00:05:04.000\nsecond\n" }
  });
  const document = await fetchGenericTranscript({ sessionKey: "k", trackUrl: "https://v.example.com/m/master.m3u8", sourceLanguage: "en", format: "hls" }, { fetchImpl });
  assert.deepEqual(document.cues.map((cue) => [cue.start, cue.text]), [[1, "first"], [299, "across the boundary"], [302, "second"]]);
  const tracks = await listGenericHlsTracks({ urls: ["https://v.example.com/m/master.m3u8"] }, { fetchImpl });
  assert.equal(tracks[0].trackUrl, "https://v.example.com/m/subs/en.m3u8");
  assert.deepEqual(mergeSegmentCues([[{ start: 2, end: 3, text: "b" }], [{ start: 1, end: 2, text: "a" }, { start: 2, end: 3, text: "b" }]]).map((cue) => cue.text), ["a", "b"]);
});

test("cues read from a player's text track are sorted, cleaned, and repaired", () => {
  const document = parseGenericTranscript({
    sessionKey: "generic:x:y",
    sourceLanguage: "",
    cues: [
      { start: 5, end: 5, text: "zero" },
      { start: 1, end: 2, text: "<v Speaker>one</v>" },
      { start: 3, end: 4, text: "   " }
    ]
  });
  assert.equal(document.sourceLanguage, "auto");
  assert.deepEqual(document.cues.map((cue) => [cue.start, cue.end, cue.text]), [[1, 2, "one"], [5, 5.5, "zero"]]);
});

// ---------------------------------------------------------------- messages

test("generic messages are validated and the settings switches are extension-page only", () => {
  assert.equal(validateBackgroundMessage({ type: "captions.generic.fetchTranscript", sessionKey: "generic:a:b", trackUrl: "https://x.example/a.vtt" }).ok, true);
  assert.match(validateBackgroundMessage({ type: "captions.generic.fetchTranscript", sessionKey: "bad key!", trackUrl: "https://x.example/a.vtt" }).error, /sessionKey/);
  assert.match(validateBackgroundMessage({ type: "captions.generic.fetchTranscript", sessionKey: "k", trackUrl: "javascript:alert(1)" }).error, /http/);
  assert.match(validateBackgroundMessage({ type: "captions.generic.parseTranscript", sessionKey: "k", cues: [] }).error, /non-empty/);
  assert.equal(validateBackgroundMessage({ type: "captions.generic.parseTranscript", sessionKey: "k", text: "WEBVTT" }).ok, true);
  assert.match(validateBackgroundMessage({ type: "captions.generic.listHlsTracks", urls: [] }).error, /urls/);
  assert.match(validateBackgroundMessage({ type: "settings.setPlatformEnabled", platform: "nope", enabled: true }).error, /Unsupported/);
  assert.equal(validateBackgroundMessage({ type: "settings.setPlatformEnabled", platform: "generic", enabled: true }).ok, true);
  assert.match(validateBackgroundMessage({ type: "settings.setGenericSiteAllowed", host: "bad host", allowed: true }).error, /host/);
  assert.equal(validateBackgroundMessage({ type: "settings.setGenericSiteAllowed", host: "www.example.com", allowed: true }).ok, true);
  assert.equal(validateMessageSender({ type: "settings.setGenericSiteAllowed" }, { id: "ext", url: "https://site.example/v", tab: { id: 3, url: "https://site.example/v" } }, "ext", { genericState: { enabled: true, allowedHosts: ["site.example"] } }).ok, false);

  const page = { id: "ext", url: "chrome-extension://ext/popup/popup.html" };
  const content = { id: "ext", url: "https://site.example/v", tab: { id: 3, url: "https://site.example/v" } };
  const genericState = { enabled: true, allowedHosts: ["site.example"] };
  assert.equal(validateMessageSender({ type: "settings.setGenericPlayerEnabled" }, page, "ext").ok, true);
  assert.equal(validateMessageSender({ type: "settings.setGenericPlayerEnabled" }, content, "ext", { genericState }).ok, false);
  assert.equal(validateMessageSender({ type: "captions.generic.fetchTranscript" }, content, "ext", { genericState }).ok, true);
  assert.equal(validateMessageSender({ type: "captions.generic.fetchTranscript" }, content, "ext", { genericState: { enabled: false, allowedHosts: ["site.example"] } }).ok, false);
  assert.equal(validateMessageSender({ type: "captions.generic.fetchTranscript" }, content, "ext", { genericState: { enabled: true, allowedHosts: [] } }).ok, false);
});

test("generic senders: any frame of a listed page, never on unlisted or dedicated sites", () => {
  const state = { enabled: true, allowedHosts: ["site.example", "www.udemy.com"] };
  const tab = (url) => ({ id: 1, url });
  assert.equal(isGenericContentSender({ tab: tab("https://site.example/p"), url: "https://player.cdn.example/embed" }, state), true);
  assert.equal(isGenericContentSender({ tab: tab("https://site.example/p"), url: "about:srcdoc" }, state), true);
  assert.equal(isGenericContentSender({ tab: tab("https://unlisted.example/p"), url: "https://unlisted.example/p" }, state), false);
  assert.equal(isGenericContentSender({ tab: tab("https://www.udemy.com/course/x/learn/1"), url: "https://cdn.example/x" }, state), false);
  assert.equal(isGenericContentSender({ tab: tab("chrome://settings"), url: "chrome://settings" }, state), false);
  assert.equal(isGenericContentSender({ url: "https://site.example/p" }, state), false);
});

// ---------------------------------------------------------------- worker registration

test("the probe is registered only for listed sites while the generic player is on, and retried without matchOriginAsFallback", async () => {
  globalThis.chrome = {
    runtime: { onMessage: { addListener() {} } },
    storage: { local: { setAccessLevel: async () => {}, get: async () => ({}) } }
  };
  const { buildGenericProbeRegistration, syncGenericProbeRegistration, GENERIC_PROBE_SCRIPT_ID } = await import("../extension/background/service-worker.js");
  const registration = buildGenericProbeRegistration({ genericAllowedHosts: ["www.example.com"] });
  assert.equal(registration.id, GENERIC_PROBE_SCRIPT_ID);
  assert.deepEqual(registration.matches, ["*://www.example.com/*"]);
  assert.ok(registration.excludeMatches.includes("*://*.youtube.com/*"));
  assert.equal(registration.allFrames, true);
  assert.deepEqual(registration.js, ["content/generic-probe.js"]);

  let registered = [];
  const writes = [];
  const scripting = {
    getRegisteredContentScripts: async () => registered,
    registerContentScripts: async (scripts) => {
      writes.push(["register", scripts[0]]);
      if (scripts[0].matchOriginAsFallback) throw new Error("Unexpected property: 'matchOriginAsFallback'.");
      registered = scripts;
    },
    updateContentScripts: async (scripts) => { writes.push(["update", scripts[0]]); registered = scripts; },
    unregisterContentScripts: async () => { writes.push(["unregister"]); registered = []; }
  };
  await syncGenericProbeRegistration({ platforms: { generic: false }, genericAllowedHosts: ["a.example"] }, scripting);
  await syncGenericProbeRegistration({ platforms: { generic: true }, genericAllowedHosts: [] }, scripting);
  assert.equal(writes.length, 0, "nothing is registered without a listed site");
  await syncGenericProbeRegistration({ platforms: { generic: true }, genericAllowedHosts: ["a.example"] }, scripting);
  assert.deepEqual(writes.map(([kind, script]) => [kind, Boolean(script?.matchOriginAsFallback)]), [["register", true], ["register", false]]);
  await syncGenericProbeRegistration({ platforms: { generic: true }, genericAllowedHosts: ["a.example", "b.example"] }, scripting);
  assert.equal(writes.at(-1)[0], "update");
  assert.deepEqual(writes.at(-1)[1].matches, ["*://a.example/*", "*://b.example/*"]);
  await syncGenericProbeRegistration({ platforms: { generic: true }, genericAllowedHosts: [] }, scripting);
  assert.deepEqual(writes.at(-1), ["unregister"]);
});

// ---------------------------------------------------------------- content-side generic player

function loadGenericPlayer({ resources = [], origin = "https://site.example", runtime } = {}) {
  const source = readFileSync(new URL("../extension/content/generic-player.js", import.meta.url), "utf8");
  const context = {
    URL,
    Map,
    Set,
    Date,
    Promise,
    console,
    setTimeout,
    clearTimeout,
    location: { origin, pathname: "/watch/1" },
    document: { baseURI: `${origin}/watch/1`, querySelectorAll: () => [] },
    performance: { getEntriesByType: () => resources.map((name) => ({ name })) },
    sendRuntimeMessage: runtime || (async () => ({ ok: true, tracks: [] }))
  };
  vm.runInNewContext(`${source}\nthis.api = { hashGenericText, guessGenericLanguageFromUrl, getGenericResourceUrls, listGenericCaptionTracks, getGenericSessionKeyForVideo, isGenericCandidateVideo, getGenericTrackMeta, GENERIC_CAPTION_FILE_PATTERN, GENERIC_CAPTION_FILE_SKIP_PATTERN };`, context);
  return context.api;
}

function fakeVideo({ tracks = [], textTracks = [], width = 640, height = 360, duration = 120, currentSrc = "", loop = false, muted = false, controls = true } = {}) {
  const trackElements = tracks.map((attributes) => ({
    getAttribute: (name) => attributes[name] ?? null,
    track: attributes.textTrack || null
  }));
  return {
    tagName: "VIDEO",
    isConnected: true,
    duration,
    currentSrc,
    loop,
    muted,
    controls,
    textTracks: Object.assign([...textTracks], { length: textTracks.length }),
    getBoundingClientRect: () => ({ width, height }),
    querySelector: (selector) => (selector === "track[src]" ? trackElements[0] || null : null),
    querySelectorAll: (selector) => (selector === "track[src]" ? trackElements : [])
  };
}

test("generic candidates: real videos only, never small or decorative loops", () => {
  const api = loadGenericPlayer();
  assert.equal(api.isGenericCandidateVideo(fakeVideo()), true);
  assert.equal(api.isGenericCandidateVideo(fakeVideo({ width: 200 })), false);
  assert.equal(api.isGenericCandidateVideo(fakeVideo({ loop: true, muted: true, controls: false })), false);
  assert.equal(api.isGenericCandidateVideo(fakeVideo({ duration: 10 })), false);
  assert.equal(api.isGenericCandidateVideo(fakeVideo({ duration: 10, tracks: [{ src: "a.vtt", kind: "subtitles" }] })), true);
});

test("generic tracks come from <track>, then HLS, then text tracks, then loaded caption files", async () => {
  const withTrack = loadGenericPlayer();
  const tracks = await withTrack.listGenericCaptionTracks(fakeVideo({ tracks: [{ src: "/subs/en.vtt", srclang: "en", label: "English", kind: "subtitles" }] }));
  assert.deepEqual(JSON.parse(JSON.stringify(tracks)), [{ id: "track:https://site.example/subs/en.vtt", languageCode: "en", label: "English", isAutoGenerated: false, trackUrl: "https://site.example/subs/en.vtt" }]);
  assert.equal(withTrack.getGenericTrackMeta(tracks[0].id).source, "url");

  const asked = [];
  const withHls = loadGenericPlayer({
    resources: ["https://v.example.com/a/master.m3u8", "https://v.example.com/a/video/720.m3u8"],
    runtime: async (message) => {
      asked.push(message);
      return { ok: true, tracks: [{ languageCode: "en", label: "English", trackUrl: "https://v.example.com/a/subs/en.m3u8" }] };
    }
  });
  const hlsTracks = await withHls.listGenericCaptionTracks(fakeVideo({ currentSrc: "blob:https://site.example/1", textTracks: [{ kind: "subtitles", language: "en", label: "English" }] }));
  assert.deepEqual([...asked[0].urls], ["https://v.example.com/a/master.m3u8"]);
  assert.equal(hlsTracks.length, 1);
  assert.equal(withHls.getGenericTrackMeta(hlsTracks[0].id).format, "hls");

  const textTrackOnly = loadGenericPlayer();
  const inBand = await textTrackOnly.listGenericCaptionTracks(fakeVideo({ textTracks: [{ kind: "metadata" }, { kind: "captions", language: "ja", label: "日本語" }] }));
  assert.equal(inBand.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(textTrackOnly.getGenericTrackMeta(inBand[0].id))), { source: "texttrack", index: 1 });

  const resourceOnly = loadGenericPlayer({
    resources: [
      "https://cdn.example.com/thumbnails/thumb-1.vtt",
      "https://cdn.example.com/chapters/c.vtt",
      "https://cdn.example.com/captions/lesson_en.vtt?sig=1"
    ]
  });
  const files = await resourceOnly.listGenericCaptionTracks(fakeVideo());
  assert.equal(files.length, 1);
  assert.equal(files[0].trackUrl, "https://cdn.example.com/captions/lesson_en.vtt?sig=1");
  assert.equal(files[0].languageCode, "en");
});

test("generic session keys are stable per page and video, and fit the message contract", () => {
  const api = loadGenericPlayer();
  const video = fakeVideo({ tracks: [{ src: "/subs/en.vtt", kind: "subtitles" }] });
  const key = api.getGenericSessionKeyForVideo(video);
  assert.equal(key, api.getGenericSessionKeyForVideo(video));
  assert.match(key, /^generic:[0-9a-z]+:[0-9a-z]+$/);
  assert.notEqual(key, api.getGenericSessionKeyForVideo(fakeVideo({ tracks: [{ src: "/subs/ko.vtt", kind: "subtitles" }] })));
});

// ---------------------------------------------------------------- UI and packaging

test("options, popup, and packaging expose the generic player as a technical preview with a site list", () => {
  const optionsHtml = readFileSync(new URL("../extension/options/options.html", import.meta.url), "utf8");
  const popupHtml = readFileSync(new URL("../extension/popup/popup.html", import.meta.url), "utf8");
  const optionsJs = readFileSync(new URL("../extension/options/options.js", import.meta.url), "utf8");
  assert.match(optionsHtml, /id="toggleGeneric" type="checkbox"/);
  assert.match(optionsHtml, /id="genericAllowedHostList"/);
  assert.match(optionsJs, /generic: document\.getElementById\("toggleGeneric"\)/);
  // The on/off switch for the generic player lives in settings only; the popup adds or removes the site.
  assert.doesNotMatch(popupHtml, /id="genericPlayerEnabled"/);
  assert.match(popupHtml, /data-i18n="popupGenericSiteGuide"/);
  // With the generic player off in settings, the add/remove row is hidden, not just disabled.
  const popupJs = readFileSync(new URL("../extension/popup/popup.js", import.meta.url), "utf8");
  assert.ok(popupJs.includes('genericRow.hidden = site.kind !== "generic" || !site.genericEnabled;'));
  assert.match(popupHtml, /id="siteEnabled" type="checkbox" role="switch"/);
  assert.match(popupHtml, /id="genericSiteButton" type="button"/);
  for (const language of ["en", "ko", "ja"]) {
    const messages = JSON.parse(readFileSync(new URL(`../extension/_locales/${language}/messages.json`, import.meta.url), "utf8"));
    assert.match(messages.genericPlayerToggle.message, /Technical Preview|테크니컬 프리뷰|テクニカルプレビュー/);
  }
  // The full bundle is never in the manifest: the worker injects it into frames that need it.
  const manifestFiles = manifest.content_scripts.flatMap((entry) => entry.js);
  assert.equal(manifestFiles.includes("content/generic-player.js"), false);
  assert.equal(manifestFiles.includes("content/generic-probe.js"), false);
});

test("the generic menu is placed at the page top by script so small players cannot clip it or its submenus", () => {
  const contentScript = readFileSync(new URL("../extension/content/content-script.js", import.meta.url), "utf8");
  const contentCss = readFileSync(new URL("../extension/content/content-style.css", import.meta.url), "utf8");
  assert.match(contentScript, /if \(platform === "generic"\) \{\n    return document\.fullscreenElement \|\| document\.body;/);
  assert.match(contentScript, /function positionGenericProviderMenu\(menu/);
  assert.match(contentScript, /classList\.toggle\("ast-provider-menu-flyout-right"/);
  assert.match(contentCss, /\.ast-provider-menu\.ast-provider-menu-generic \{\s*position: fixed;/);
  assert.match(contentCss, /\.ast-provider-menu-flyout-right \.ast-translation-style-list \{\s*right: auto;\s*left: 100%;/);
  assert.match(contentCss, /\.ast-provider-menu \.ast-provider-toggle \{\s*display: block !important;/);
  // No scrolling box: it would clip the submenus that open beside the menu.
  assert.doesNotMatch(contentCss, /\.ast-provider-menu-generic \{[^}]*overflow-y: auto/);
});

test("the generic toolbar can be dragged over the video without the drop opening the menu", () => {
  const genericPlayer = readFileSync(new URL("../extension/content/generic-player.js", import.meta.url), "utf8");
  const contentCss = readFileSync(new URL("../extension/content/content-style.css", import.meta.url), "utf8");
  assert.match(genericPlayer, /function installGenericToolbarDrag\(toolbar\)/);
  // A fast drag leaves the bar before its first move, so moves are followed on the window.
  assert.match(genericPlayer, /window\.addEventListener\("pointermove", onMove, true\)/);
  assert.match(genericPlayer, /toolbar\.astSuppressNextClick = true;/);
  // Kept as a fraction of the player, so it holds through resizes and fullscreen.
  assert.match(genericPlayer, /x: host\.clientWidth \? left \/ host\.clientWidth : 0/);
  assert.match(contentCss, /\.ast-generic-toolbar \{\s*cursor: grab;/);
});

test("the toolbar icon's AST mark keeps its size and font against page CSS", () => {
  const contentCss = readFileSync(new URL("../extension/content/content-style.css", import.meta.url), "utf8");
  assert.match(contentCss, /\.ast-toolbar-icon \.ast-toolbar-icon-mark \{[^}]*font-size: 400px !important;[^}]*\}/);
  assert.match(contentCss, /\.ast-toolbar-icon \.ast-toolbar-icon-mark \{[^}]*font-family: Arial, Helvetica, sans-serif !important;[^}]*\}/);
});
