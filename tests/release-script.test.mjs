import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const releaseScript = readFileSync(new URL("../release.sh", import.meta.url), "utf8");
const releaseScriptMode = statSync(new URL("../release.sh", import.meta.url)).mode;

test("release script is directly executable as documented", () => {
  assert.notEqual(releaseScriptMode & 0o111, 0);
});

test("release script publishes the versioned ZIP as a GitHub Release asset", () => {
  assert.match(releaseScript, /tag="\$\(git describe --tags --exact-match HEAD\)"/);
  assert.match(releaseScript, /zip_path="release\/ai-subtitle-translator-\$\{tag\}\.zip"/);
  assert.match(releaseScript, /gh release view "\$tag"/);
  assert.match(releaseScript, /gh release upload "\$tag" "\$zip_path" --clobber/);
  assert.match(releaseScript, /gh release create "\$tag" "\$zip_path" --title "\$tag" --generate-notes/);
});
