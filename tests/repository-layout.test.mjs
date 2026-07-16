import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("GitHub Pages deploys only the site subtree", () => {
  const siteIndex = new URL("site/index.html", root);
  const workflow = readFileSync(
    new URL(".github/workflows/deploy-pages.yml", root),
    "utf8"
  );

  assert.doesNotThrow(() => readFileSync(siteIndex, "utf8"));
  assert.match(workflow, /path:\s*site\s*$/m);
});
