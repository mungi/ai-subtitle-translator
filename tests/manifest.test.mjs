import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));

test("YouTube caption bridge starts early with domain-scoped scripting access", () => {
  assert.ok(manifest.permissions.includes("scripting"));
  const bridge = manifest.content_scripts.find((item) => item.js.includes("content/youtube-capture-bridge.js"));
  assert.deepEqual(bridge.matches, ["https://www.youtube.com/*"]);
  assert.equal(bridge.run_at, "document_start");
  assert.equal(manifest.minimum_chrome_version, "102");
});

test("manifest asks for all-site access once instead of listing every host", () => {
  assert.deepEqual(manifest.host_permissions, ["<all_urls>"]);
  assert.equal(manifest.optional_host_permissions, undefined);
});

test("content scripts and page resources stay limited to supported video sites", () => {
  const supportedSite = /^https:\/\/(?:[\w*-]+\.)?(?:udemy\.com|youtube\.com|ted\.com|nvidia\.com|vimeo\.com|coursera\.org|linkedin\.com|oreilly\.com|deeplearning\.ai|edx\.org)\//;
  const pagePatterns = [
    ...manifest.content_scripts.flatMap((item) => item.matches),
    ...manifest.web_accessible_resources.flatMap((item) => item.matches)
  ];
  assert.ok(pagePatterns.length > 0);
  for (const pattern of pagePatterns) assert.match(pattern, supportedSite);
});

test("manifest injects into Vimeo pages and players", () => {
  assert.ok(manifest.content_scripts[0].matches.includes("https://vimeo.com/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://www.vimeo.com/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://player.vimeo.com/video/*"));
});

test("manifest injects into TED talk pages", () => {
  assert.ok(manifest.content_scripts[0].matches.includes("https://ted.com/talks/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://www.ted.com/talks/*"));
});

test("phrase segmentation loads before the content script that uses it", () => {
  const main = manifest.content_scripts.find((item) => item.js.includes("content/content-script.js"));
  assert.deepEqual(main.js, ["content/phrase-segmentation.js", "content/subtitle-export.js", "content/content-script.js"]);
});
