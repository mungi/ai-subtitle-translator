import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));

test("manifest grants NVIDIA NIM host permission", () => {
  assert.ok(manifest.host_permissions.includes("https://integrate.api.nvidia.com/*"));
});

test("manifest requests custom HTTPS LLM host access only at runtime", () => {
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*"]);
});

test("manifest grants Vimeo page and player access", () => {
  assert.ok(manifest.host_permissions.includes("https://vimeo.com/*"));
  assert.ok(manifest.host_permissions.includes("https://www.vimeo.com/*"));
  assert.ok(manifest.host_permissions.includes("https://player.vimeo.com/*"));
  assert.ok(manifest.host_permissions.includes("https://captions.cloud.vimeo.com/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://vimeo.com/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://www.vimeo.com/*"));
  assert.ok(manifest.content_scripts[0].matches.includes("https://player.vimeo.com/video/*"));
});
