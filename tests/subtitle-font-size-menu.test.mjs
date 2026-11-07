import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { validateBackgroundMessage } from "../extension/shared/message-contracts.js";

const source = readFileSync(new URL("../extension/content/content-script.js", import.meta.url), "utf8");

function loadFontSizeHelpers(style) {
  const pick = (name) => {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf("\n}\n", start) + 3);
  };
  const context = { subtitleState: { subtitleStyle: style }, Math, Number };
  vm.runInNewContext([
    "const SUBTITLE_FONT_SIZE_MIN = 10;",
    "const SUBTITLE_FONT_SIZE_MAX = 64;",
    pick("clampNumber"),
    pick("getSubtitleFontSizes"),
    pick("getSubtitleFontSizePatch"),
    "this.api = { getSubtitleFontSizes, getSubtitleFontSizePatch };"
  ].join("\n"), context);
  return context.api;
}

test("display rows step their own line; dual steps both; sizes stay within 10 to 64", () => {
  const api = loadFontSizeHelpers({ fontSize: 30, sourceFontSize: 28 });
  assert.deepEqual({ ...api.getSubtitleFontSizePatch("source", 1) }, { sourceFontSize: 29 });
  assert.deepEqual({ ...api.getSubtitleFontSizePatch("translated", -1) }, { fontSize: 29 });
  assert.deepEqual({ ...api.getSubtitleFontSizePatch("dual", 1) }, { sourceFontSize: 29, fontSize: 31 });
  const atMax = loadFontSizeHelpers({ fontSize: 64, sourceFontSize: 10 });
  assert.deepEqual({ ...atMax.getSubtitleFontSizePatch("dual", 1) }, { sourceFontSize: 11, fontSize: 64 });
  assert.deepEqual({ ...atMax.getSubtitleFontSizePatch("source", -1) }, { sourceFontSize: 10 });
  // The source size falls back to the translation size when it was never set.
  assert.deepEqual({ ...loadFontSizeHelpers({ fontSize: 26 }).getSubtitleFontSizes() }, { source: 26, translated: 26 });
});

test("the size buttons keep the menu open, do not pick a display mode, and save in one patch", () => {
  assert.match(source, /function renderSubtitleFontSizeControl\(mode\)/);
  assert.match(source, /item\.append\(renderSubtitleFontSizeControl\(mode\)\);/);
  const control = source.slice(source.indexOf("function renderSubtitleFontSizeControl(mode)"), source.indexOf("function changeSubtitleFontSize("));
  assert.match(control, /event\.stopPropagation\(\);\s*event\.preventDefault\(\);\s*keepSubtitleDisplaySubmenuOpen\(button\);/);
  // Rows are divs now: a button cannot hold the size buttons.
  assert.match(source, /const item = document\.createElement\("div"\);\n    item\.className = "ast-provider-menu-item ast-subtitle-display-item";/);
  assert.match(source, /refreshOpenProviderMenu\(\);\n  pendingSubtitleFontSizePatch = /);
  // The dual row shows only the buttons; its two sizes are on the rows below it.
  assert.match(control, /if \(mode !== "dual"\) \{/);
  assert.equal(validateBackgroundMessage({ type: "settings.updateSubtitleStyle", patch: { fontSize: 31, sourceFontSize: 29 } }).ok, true);
  assert.match(validateBackgroundMessage({ type: "settings.updateSubtitleStyle", patch: { fontSize: 80 } }).error, /between 10 and 64/);
  for (const language of ["en", "ko", "ja"]) {
    const messages = JSON.parse(readFileSync(new URL(`../extension/_locales/${language}/messages.json`, import.meta.url), "utf8"));
    for (const key of ["contentFontSize", "contentFontSizeDecrease", "contentFontSizeIncrease"]) assert.ok(messages[key]?.message, `${language}.${key}`);
  }
});

test("edX and generic menus pin small button styles against page button rules", async () => {
  const { readFile } = await import("node:fs/promises");
  const css = await readFile(new URL("../extension/content/content-style.css", import.meta.url), "utf8");
  const scope = ":is(.ast-provider-menu-edx, .ast-provider-menu-generic)";
  assert.ok(css.includes(`${scope} button {\n  box-shadow: none !important;`));
  assert.ok(css.includes(`${scope} .ast-segmented-option:hover,`));
  assert.match(css, /rgba\(255, 255, 255, 0\.14\) !important/);
  assert.ok(css.includes(`${scope} .ast-segmented-option.active,`));
  assert.ok(css.includes(`${scope} .ast-provider-menu-item {\n  background-color: transparent !important;`));
});
