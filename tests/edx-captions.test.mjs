import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildEdxTranscript, edxSjsonToCues } from "../extension/platforms/edx-captions.js";
import { validateBackgroundMessage, validateMessageSender } from "../extension/shared/message-contracts.js";
import { describeSiteForUrl, detectDedicatedPlatform, isGenericEligibleUrl } from "../extension/shared/platform-urls.js";

// Shape of courses.edx.org .../handler/transcript/translation/en (milliseconds).
const SJSON = {
  start: [0, 2952, 18210, 21390, 21390],
  end: [2952, 18210, 21390, 22470, 21390],
  text: ["[MUSIC PLAYING]", "", "DAVID MALAN: This is CS50's introduction to cybersecurity.", "Second line.", "Zero length."]
};

test("edX SJSON transcripts become cues: milliseconds to seconds, empty lines dropped, zero-length repaired", () => {
  const cues = edxSjsonToCues(SJSON);
  assert.deepEqual(cues.map((cue) => [cue.start, cue.end, cue.text]), [
    [0, 2.952, "[MUSIC PLAYING]"],
    [18.21, 21.39, "DAVID MALAN: This is CS50's introduction to cybersecurity."],
    [21.39, 21.39, "Zero length."],
    [21.39, 22.47, "Second line."]
  ]);
  const document = buildEdxTranscript({ videoId: "bce506e85d9c4fc191fea766cee5da40", sourceLanguage: "en", sjson: SJSON });
  assert.equal(document.platform, "edx");
  assert.equal(document.videoId, "bce506e85d9c4fc191fea766cee5da40");
  assert.ok(document.cues.every((cue) => cue.end > cue.start));
  assert.throws(() => buildEdxTranscript({ videoId: "x", sjson: { start: [], end: [], text: [] } }), /No edX captions/);
});

test("edX messages, frame senders, and the site table", () => {
  const message = { type: "captions.edx.buildTranscript", videoId: "bce506e85d9c4fc191fea766cee5da40", sourceLanguage: "en", sjson: SJSON };
  assert.equal(validateBackgroundMessage(message).ok, true);
  assert.match(validateBackgroundMessage({ ...message, sjson: { start: ["x"], end: [1], text: ["a"] } }).error, /sjson/);
  assert.match(validateBackgroundMessage({ ...message, videoId: "../x" }).error, /videoId/);

  // The video block runs in a courses.edx.org frame of a learning.edx.org page.
  const frame = {
    id: "ext",
    url: "https://courses.edx.org/xblock/block-v1:HarvardX+CS50CS+Cybersecurity+type@vertical+block@a7d8?view=student_view",
    tab: { id: 4, url: "https://learning.edx.org/course/course-v1:HarvardX+CS50CS+Cybersecurity/block-v1:x" }
  };
  assert.equal(validateMessageSender(message, frame, "ext").ok, true);
  assert.equal(validateMessageSender(message, { ...frame, url: "https://courses.edx.org/dashboard" }, "ext").ok, false);

  assert.equal(detectDedicatedPlatform("https://learning.edx.org/course/x").id, "edx");
  assert.equal(isGenericEligibleUrl("https://www.edx.org/learn/ai"), false);
  assert.equal(describeSiteForUrl("https://www.edx.org/", {}).kind, "dedicated");
});

test("edX is wired into the manifest, settings, and the content script", () => {
  const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  const contentScript = readFileSync(new URL("../extension/content/content-script.js", import.meta.url), "utf8");
  const optionsHtml = readFileSync(new URL("../extension/options/options.html", import.meta.url), "utf8");
  assert.ok(manifest.content_scripts[0].matches.includes("https://courses.edx.org/xblock/*"));
  assert.equal(manifest.content_scripts[0].all_frames, true);
  assert.match(contentScript, /if \(host === "courses\.edx\.org"\) return "edx";/);
  assert.match(contentScript, /type: "captions\.edx\.buildTranscript"/);
  assert.match(contentScript, /credentials: "same-origin",\s*headers: \{ Accept: "application\/json", "X-Requested-With": "XMLHttpRequest" \}/);
  assert.match(optionsHtml, /id="toggleEdx" type="checkbox"/);
});

test("menu buttons on edX and generic sites ignore the page's own button styles", () => {
  const css = readFileSync(new URL("../extension/content/content-style.css", import.meta.url), "utf8");
  assert.match(css, /\.ast-provider-menu-edx button,\s*\.ast-provider-menu-generic button \{[^}]*font-family: inherit !important;[^}]*text-shadow: none !important;/);
  assert.match(css, /\.ast-provider-menu-edx button\.ast-provider-menu-item,[\s\S]*?\{[^}]*border: 0 !important;[^}]*font-weight: 500 !important;/);
});

test("the edX toolbar button joins edX's control bar look, and menu lists use a thin dark scrollbar", () => {
  const contentScript = readFileSync(new URL("../extension/content/content-script.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../extension/content/content-style.css", import.meta.url), "utf8");
  assert.match(contentScript, /if \(platform === "edx"\) \{\n[^\n]*\n    button\.classList\.add\("control", "ast-edx-toolbar-button"\);/);
  assert.match(css, /\.ast-toolbar-button\.ast-edx-toolbar-button \{[^}]*border-left: 1px dotted #4f595d !important;/);
  assert.match(css, /\.ast-provider-menu \* \{\s*scrollbar-width: thin;\s*scrollbar-color: rgba\(255, 255, 255, 0\.35\) transparent;/);
});

test("edX player hosts are anchored by a class that steps aside in fullscreen", async () => {
  const { readFile } = await import("node:fs/promises");
  const [script, css] = await Promise.all([
    readFile(new URL("../extension/content/content-script.js", import.meta.url), "utf8"),
    readFile(new URL("../extension/content/content-style.css", import.meta.url), "utf8")
  ]);
  assert.match(script, /if \(platform === "edx"\) \{\s*host\.classList\.add\("ast-edx-position-host"\);\s*return;/);
  assert.doesNotMatch(script, /parent\.style\.position = "relative"/);
  assert.match(css, /\.video:not\(\.video-fullscreen\) \.ast-edx-position-host \{\s*position: relative;/);
});

test("subtitle size and position follow the overlay's containing block, not just its parent", async () => {
  const { readFile } = await import("node:fs/promises");
  const script = await readFile(new URL("../extension/content/content-script.js", import.meta.url), "utf8");
  assert.match(script, /function getOverlayFrame\(overlay\) \{[\s\S]*?style\.position !== "static"[\s\S]*?return parent;\s*\}/);
  assert.doesNotMatch(script, /overlay\?\.offsetParent/);
  assert.doesNotMatch(script, /overlay\??\.parentElement\?\.getBoundingClientRect\(\)/);
});
