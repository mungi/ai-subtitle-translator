import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const contentSource = readFileSync(new URL("../extension/content/content-script.js", import.meta.url), "utf8")
  .replace("void initializeContentScript();", "");

test("bundled font bytes reach FontFace through background messaging without a page fetch", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const fontBytes = readFileSync(new URL("../extension/assets/fonts/gowun-batang-regular.woff", import.meta.url));
  const fontUrl = "chrome-extension://test-extension/assets/fonts/gowun-batang-regular.woff";
  let listener;
  let fetchCount = 0;
  globalThis.chrome = {
    runtime: {
      id: "test-extension",
      getURL: (path) => `chrome-extension://test-extension/${path}`,
      onMessage: { addListener: (handler) => { listener = handler; } }
    },
    storage: { local: { setAccessLevel: async () => {} } }
  };
  globalThis.fetch = async (url) => {
    assert.equal(url, fontUrl);
    fetchCount += 1;
    return new Response(fontBytes);
  };

  try {
    await import("../extension/background/service-worker.js?bundled-font-test");
    const registeredFonts = [];
    const context = {
      atob,
      document: { fonts: { add: (face) => registeredFonts.push(face) } },
      fetch: () => { throw new Error("Page must not fetch extension font URLs"); },
      chrome: {
        runtime: {
          id: "test-extension",
          onMessage: { addListener() {} },
          sendMessage: (message) => new Promise((resolve) => listener(message, {
            id: "test-extension",
            url: "https://www.youtube.com/watch?v=test",
            tab: { id: 1 }
          }, resolve))
        }
      },
      FontFace: class {
        constructor(family, data) { this.family = family; this.data = data; }
        async load() { return this; }
      }
    };
    vm.runInNewContext(contentSource, context);
    const face = await vm.runInNewContext("loadBundledGowunFont()", context);
    assert.equal(face.family, "GounBatang");
    assert.deepEqual(Buffer.from(face.data), fontBytes);
    assert.equal(registeredFonts[0], face);
    assert.equal(await vm.runInNewContext("loadBundledGowunFont()", context), face);
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.chrome = originalChrome;
    globalThis.fetch = originalFetch;
  }
});

test("a failed bundled font request is reported once and leaves fallback fonts available", async () => {
  const warnings = [];
  const context = {
    console: { warn: (...args) => warnings.push(args) },
    document: {},
    chrome: { runtime: {
      id: "test-extension",
      onMessage: { addListener() {} },
      sendMessage: async () => ({ ok: false, error: "Font unavailable" })
    } }
  };
  vm.runInNewContext(contentSource, context);
  await vm.runInNewContext("loadBundledGowunFont()", context);
  await vm.runInNewContext("loadBundledGowunFont()", context);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0][1].message, /Font unavailable/);
});
