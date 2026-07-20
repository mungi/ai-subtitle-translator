import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [siteHtml, siteScript] = await Promise.all([
  readFile(new URL("../site/index.html", import.meta.url), "utf8"),
  readFile(new URL("../site/script.js", import.meta.url), "utf8")
]);

function createSiteContext(savedLanguage) {
  const i18nElements = [...siteHtml.matchAll(/data-i18n="([^"]+)"/g)].map((match) => ({
    dataset: { i18n: match[1] },
    textContent: ""
  }));
  const altElements = [...siteHtml.matchAll(/data-i18n-alt="([^"]+)"/g)].map((match) => ({
    dataset: { i18nAlt: match[1] },
    alt: ""
  }));
  const ariaElements = [...siteHtml.matchAll(/data-i18n-aria-label="([^"]+)"/g)].map((match) => ({
    dataset: { i18nAriaLabel: match[1] },
    setAttribute(name, value) {
      this[name] = value;
    }
  }));
  const languageSelect = {
    value: "",
    listener: null,
    addEventListener(type, listener) {
      if (type === "change") this.listener = listener;
    }
  };
  const meta = { content: "" };
  const storage = new Map([["ast-site-language", savedLanguage]]);
  const document = {
    documentElement: { lang: "" },
    title: "",
    querySelector(selector) {
      if (selector === "#language-select") return languageSelect;
      if (selector === 'meta[name="description"]') return meta;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-i18n]") return i18nElements;
      if (selector === "[data-i18n-alt]") return altElements;
      if (selector === "[data-i18n-aria-label]") return ariaElements;
      return [];
    }
  };

  const context = vm.createContext({
    document,
    navigator: { language: "en-US" },
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    }
  });
  vm.runInContext(siteScript, context);
  return { document, languageSelect, meta, storage, i18nElements };
}

test("introduction site renders TED support in Korean, English, and Japanese", () => {
  for (const language of ["ko", "en", "ja"]) {
    const site = createSiteContext(language);
    assert.equal(site.document.documentElement.lang, language);
    assert.equal(site.languageSelect.value, language);
    assert.match(site.meta.content, /TED/);
    const supportCopy = site.i18nElements.find((element) => element.dataset.i18n === "supportCopy");
    assert.match(supportCopy.textContent, /TED/);
    assert.ok(site.i18nElements.every((element) => typeof element.textContent === "string" && element.textContent.length > 0));
  }
});

test("introduction site language selector switches and persists the selected language", () => {
  const site = createSiteContext("ko");
  site.languageSelect.listener({ target: { value: "ja" } });
  assert.equal(site.document.documentElement.lang, "ja");
  assert.equal(site.languageSelect.value, "ja");
  assert.equal(site.storage.get("ast-site-language"), "ja");
  assert.match(site.meta.content, /TED/);
});
