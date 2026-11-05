import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const [siteHtml, siteScript] = await Promise.all([
  readFile(new URL("../site/index.html", import.meta.url), "utf8"),
  readFile(new URL("../site/script.js", import.meta.url), "utf8")
]);

function createSiteContext(savedLanguage, { browserLanguages = ["en-US"], search = "" } = {}) {
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
  const hrefElements = [...siteHtml.matchAll(/data-i18n-href="([^"]+)"/g)].map((match) => ({
    dataset: { i18nHref: match[1] },
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
  const storage = new Map(savedLanguage ? [["ast-site-language-choice", savedLanguage]] : []);
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
      if (selector === "[data-i18n-href]") return hrefElements;
      return [];
    }
  };

  const context = vm.createContext({
    document,
    navigator: { languages: browserLanguages, language: browserLanguages[0] },
    location: { search },
    URLSearchParams,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    }
  });
  vm.runInContext(siteScript, context);
  return { document, languageSelect, meta, storage, i18nElements, hrefElements };
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

test("introduction site exposes the localized LLM selection guide", () => {
  assert.match(siteHtml, /id="llm-selection-guide"/);

  const expectedTitles = {
    ko: "처음 시작하는 LLM 선택 가이드",
    en: "LLM selection guide for first-time users",
    ja: "初めて使う場合の LLM 選択ガイド"
  };

  for (const [language, expectedTitle] of Object.entries(expectedTitles)) {
    const site = createSiteContext(language);
    const title = site.i18nElements.find((element) => element.dataset.i18n === "starterTitle");
    assert.equal(title.textContent, expectedTitle);
  }
});

test("introduction site language selector switches and persists the selected language", () => {
  const site = createSiteContext("ko");
  site.languageSelect.listener({ target: { value: "ja" } });
  assert.equal(site.document.documentElement.lang, "ja");
  assert.equal(site.languageSelect.value, "ja");
  assert.equal(site.storage.get("ast-site-language-choice"), "ja");
  assert.match(site.meta.content, /TED/);
});

test("introduction site follows a Korean or Japanese browser and shows English otherwise", () => {
  const cases = [[["ko-KR", "en"], "ko"], [["ja"], "ja"], [["en-US"], "en"], [["fr-FR", "ko"], "en"], [["zh-CN"], "en"]];
  for (const [browserLanguages, expected] of cases) {
    const site = createSiteContext(null, { browserLanguages });
    assert.equal(site.document.documentElement.lang, expected, browserLanguages.join(","));
    // A detected language is not remembered, so a later browser language change still applies.
    assert.equal(site.storage.has("ast-site-language-choice"), false);
  }
});

test("introduction site honors ?lang and links the privacy policy in the shown language", () => {
  const site = createSiteContext("ko", { browserLanguages: ["ja"], search: "?lang=en" });
  assert.equal(site.document.documentElement.lang, "en");
  assert.deepEqual(site.hrefElements.map((element) => element.href), ["privacy-en.html"]);
  site.languageSelect.listener({ target: { value: "ja" } });
  assert.deepEqual(site.hrefElements.map((element) => element.href), ["privacy-ja.html"]);
});

test("introduction site static HTML defaults to English", () => {
  assert.match(siteHtml, /<html lang="en">/);
  assert.match(siteHtml, /<option value="en">English<\/option>/);
});

test("introduction site demo opens on French to English for English browsers, own language for Korean and Japanese, Spanish otherwise", () => {
  const cases = [[["en-US"], "fr-en"], [["en-GB", "ko"], "fr-en"], [["ko-KR"], "ko"], [["ja"], "ja"], [["fr-FR"], "es"], [["de"], "es"], [["zh-CN", "en"], "es"]];
  for (const [browserLanguages, expected] of cases) {
    const context = vm.createContext({
      document: { documentElement: { lang: "" }, querySelector: (selector) => selector === "#language-select" ? { addEventListener() {} } : selector === 'meta[name="description"]' ? {} : null, querySelectorAll: () => [] },
      navigator: { languages: browserLanguages, language: browserLanguages[0] },
      location: { search: "" },
      URLSearchParams,
      localStorage: { getItem: () => null, setItem() {} }
    });
    vm.runInContext(siteScript, context);
    assert.equal(vm.runInContext("getDefaultDemoPair()", context), expected, browserLanguages.join(","));
  }
});

test("introduction site demo pairs every cue with French, English, Korean, Japanese, and Spanish lines", () => {
  const context = vm.createContext({
    document: { documentElement: { lang: "" }, querySelector: (selector) => selector === "#language-select" ? { addEventListener() {} } : selector === 'meta[name="description"]' ? {} : null, querySelectorAll: () => [] },
    navigator: { languages: ["en"], language: "en" },
    location: { search: "" },
    URLSearchParams,
    localStorage: { getItem: () => null, setItem() {} }
  });
  vm.runInContext(siteScript, context);
  const cues = vm.runInContext("demoCues", context);
  const pairs = vm.runInContext("demoPairs", context);
  for (const pair of Object.values(pairs)) {
    for (const cue of cues) {
      assert.ok(cue[pair.source] && cue[pair.translation], `cue ${cue.no} ${pair.source}->${pair.translation}`);
    }
  }
});
