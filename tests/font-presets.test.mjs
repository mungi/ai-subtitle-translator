import assert from "node:assert/strict";
import test from "node:test";
import { getWebFontPresetLabel, WEB_FONT_PRESETS } from "../extension/shared/defaults.js";

function preset(id) {
  return WEB_FONT_PRESETS.find((item) => item.id === id);
}

test("web font preset labels are localized for Korean and non-Korean UI", () => {
  assert.equal(getWebFontPresetLabel(preset("samlip"), "ko"), "산돌 삼립호빵체");
  assert.equal(getWebFontPresetLabel(preset("samlip"), "en"), "SandollSamlipHobbangOutline");
  assert.equal(getWebFontPresetLabel(preset("noto-sans-jp"), "ja"), "Noto Sans JP");
  assert.equal(getWebFontPresetLabel(preset("noto-serif-jp"), "ja"), "Noto Serif JP");
  assert.match(preset("noto-sans-jp").css, /fonts\.googleapis\.com/);
  assert.match(preset("noto-serif-jp").css, /fonts\.googleapis\.com/);
  assert.equal(preset("cookie-run"), undefined);
  assert.equal(getWebFontPresetLabel(preset("binggre"), "ko"), "빙그레체");
  assert.equal(getWebFontPresetLabel(preset("binggre"), "en"), "Binggre");
  assert.equal(getWebFontPresetLabel(preset("paperlogy"), "ko"), "페이퍼로지");
  assert.equal(getWebFontPresetLabel(preset("paperlogy"), "en"), "Paperozi");
  assert.equal(getWebFontPresetLabel(preset("euljiro"), "ko"), "을지로체");
  assert.equal(getWebFontPresetLabel(preset("euljiro"), "en"), "Euljiro");
  assert.equal(getWebFontPresetLabel(preset("gangwon-moduche"), "ko"), "강원교육모두체");
  assert.equal(getWebFontPresetLabel(preset("gangwon-moduche"), "en"), "GangwonEducationModuche");
});

test("GangwonEducationModuche falls back to Arial when the web font fails", () => {
  assert.equal(preset("gangwon-moduche").fontFamily, "'GangwonEducationModuche', Arial, sans-serif");
});
