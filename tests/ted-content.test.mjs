import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("TED pages use player data, the native control bar, and TED caption messages", async () => {
  const [contentScript, contentStyle, optionsHtml, optionsJs] = await Promise.all([
    readFile(new URL("../extension/content/content-script.js", import.meta.url), "utf8"),
    readFile(new URL("../extension/content/content-style.css", import.meta.url), "utf8"),
    readFile(new URL("../extension/options/options.html", import.meta.url), "utf8"),
    readFile(new URL("../extension/options/options.js", import.meta.url), "utf8")
  ]);

  assert.match(contentScript, /location\.pathname\.startsWith\("\/talks\/"\)\) return "ted"/);
  assert.match(contentScript, /function getTedPlayerContext\(\)/);
  assert.match(contentScript, /document\.getElementById\("__NEXT_DATA__"\)/);
  assert.match(contentScript, /videoData\?\.playerData/);
  assert.match(contentScript, /playerData\?\.resources\?\.hls\?\.stream/);
  assert.match(contentScript, /let tedPlayerContextCache = null/);
  assert.match(contentScript, /tedPlayerContextCache\.slug !== talkSlug/);
  assert.match(contentScript, /sessionKey: `\$\{String\(videoId\)\}:\$\{String\(manifestUrl\)\}`/);
  assert.match(contentScript, /if \(platform === "ted"\) return getTedPlayerContext\(\)\?\.sessionKey \|\| getTedTalkSlug\(\);/);
  assert.match(contentScript, /#media-fullscreen-button-desktop"\)\?\.closest\("media-control-bar"\)/);
  assert.match(contentScript, /#video-player-container #media-control-bar, #media-control-bar/);
  assert.match(contentScript, /#video-player-container video#video, video#video/);
  assert.match(contentScript, /function mountToolbarButton\(target, button, platform\)/);
  assert.match(contentScript, /target\.querySelector\("#media-fullscreen-button-desktop"\)/);
  assert.match(contentScript, /target\.insertBefore\(control, fullscreenControl\)/);
  assert.match(contentScript, /type: "captions\.ted\.listTracks"/);
  assert.match(contentScript, /type: "captions\.ted\.fetchTranscript"/);
  assert.match(contentScript, /ted: \{\s*platform: "ted"/);
  assert.equal(
    contentScript.match(/const track = requireCaptionTrack\(/g)?.length,
    3,
    "expected TED, NVIDIA, and Vimeo to classify an empty caption-track list as unavailable"
  );
  assert.match(contentStyle, /\.ast-ted-toolbar-button/);
  assert.match(contentStyle, /\.ast-ted-control\s*\{[\s\S]*align-items: center;[\s\S]*height: 40px;/);
  assert.match(contentStyle, /\.ast-ted-toolbar-button\s*\{[\s\S]*width: 40px;[\s\S]*height: 40px;/);
  assert.match(contentStyle, /\.ast-ted-toolbar-button \.ast-toolbar-icon\s*\{[\s\S]*transform: translateY\(2px\);/);
  assert.match(contentStyle, /\.ast-provider-menu-ted/);
  assert.match(contentStyle, /\.ast-provider-menu-ted\s*\{[\s\S]*color: #f7f8fa !important;[\s\S]*-webkit-text-fill-color: #f7f8fa !important;[\s\S]*line-height: 20px !important;/);
  assert.match(optionsHtml, /id="toggleTed"/);
  assert.match(optionsJs, /ted: document\.getElementById\("toggleTed"\)/);
});
