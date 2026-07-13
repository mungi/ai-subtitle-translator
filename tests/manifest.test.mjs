import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));

test("manifest grants NVIDIA NIM host permission", () => {
  assert.ok(manifest.host_permissions.includes("https://integrate.api.nvidia.com/*"));
});
