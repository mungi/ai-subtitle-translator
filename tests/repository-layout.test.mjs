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

test("privacy policies direct users to the integrated repository", () => {
  const policyFiles = [
    "PRIVACY.md",
    "PRIVACY_en.md",
    "PRIVACY_ja.md",
    "site/privacy.html",
    "site/privacy-en.html",
    "site/privacy-ja.html",
  ];

  for (const policyFile of policyFiles) {
    const policy = readFileSync(new URL(policyFile, root), "utf8");
    assert.match(
      policy,
      /https:\/\/github\.com\/mungi\/ai-subtitle-translator\/issues/
    );
    assert.doesNotMatch(policy, /github\.com\/mungi\/llm-subtitle-translator/);
  }
});
