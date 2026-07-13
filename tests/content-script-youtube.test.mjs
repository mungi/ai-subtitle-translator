import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const contentCss = readFileSync(new URL("../extension/content/content-style.css", import.meta.url), "utf8");
const koreanMessages = JSON.parse(readFileSync(new URL("../extension/_locales/ko/messages.json", import.meta.url), "utf8"));

function getKoreanMessage(key, substitutions = []) {
  if (key === "@@ui_locale") return "ko";
  const entry = koreanMessages[key];
  if (!entry) return "";
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return entry.message.replace(/\$(\w+)\$/g, (placeholder, name) => {
    const position = Object.keys(entry.placeholders || {}).indexOf(name);
    return position === -1 ? placeholder : String(values[position] ?? "");
  });
}

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  toggle(value, enabled) {
    if (enabled) {
      this.values.add(value);
    } else {
      this.values.delete(value);
    }
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.classList = new FakeClassList();
    this.className = "";
    this.attributes = {};
    this.listeners = {};
    this.parentElement = null;
    this.hidden = false;
    this.textContent = "";
    this.rect = {
      left: 0,
      top: 0,
      right: 1280,
      bottom: 720,
      width: 1280,
      height: 720
    };
  }

  append(...children) {
    for (const child of children) {
      child.remove?.();
      child.parentElement = this;
      this.children.push(child);
    }
  }

  prepend(child) {
    child.remove?.();
    child.parentElement = this;
    this.children.unshift(child);
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  addEventListener(type, listener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners[event.type] || []) {
      listener(event);
    }
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") {
      this.id = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  querySelector(selector) {
    for (const item of selector.split(",").map((part) => part.trim())) {
      if (item !== selector) {
        const match = this.querySelector(item);
        if (match) return match;
      }
    }
    if (selector.startsWith("#")) {
      return findById(this, selector.slice(1));
    }
    const genericMatch = findAllMatching(this, selector)[0];
    if (genericMatch) return genericMatch;
    if (selector === '[data-purpose="progress-display"]') {
      return findByAttribute(this, "data-purpose", "progress-display");
    }
    if (selector === 'button[aria-label="자막"]') {
      return findByTagAndAttribute(this, "BUTTON", "aria-label", "자막");
    }
    if (selector === 'button[aria-label="Captions"]') {
      return findByTagAndAttribute(this, "BUTTON", "aria-label", "Captions");
    }
    if (selector === 'button[aria-label="Subtitles"]') {
      return findByTagAndAttribute(this, "BUTTON", "aria-label", "Subtitles");
    }
    if (selector === 'button[data-panel-menu-trigger="true"]') {
      return findByTagAndAttribute(this, "BUTTON", "data-panel-menu-trigger", "true");
    }
    return null;
  }

  querySelectorAll(selector) {
    return findAllMatching(this, selector);
  }

  matches(selector) {
    return selector.split(",").some((item) => matchesSelector(this, item));
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches?.(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  contains(node) {
    if (this === node) return true;
    return this.children.some((child) => child.contains?.(node));
  }

  getBoundingClientRect() {
    return this.rect;
  }

  setRect(rect) {
    this.rect = {
      ...rect,
      right: rect.right ?? rect.left + rect.width,
      bottom: rect.bottom ?? rect.top + rect.height
    };
  }

  setPointerCapture() {}
  releasePointerCapture() {}
}

function findById(root, id) {
  if (root.id === id) return root;
  for (const child of root.children || []) {
    const match = findById(child, id);
    if (match) return match;
  }
  return null;
}

function findByAttribute(root, name, value) {
  if (root.getAttribute?.(name) === value) return root;
  for (const child of root.children || []) {
    const match = findByAttribute(child, name, value);
    if (match) return match;
  }
  return null;
}

function findByTagAndAttribute(root, tagName, name, value) {
  if (root.tagName === tagName && root.getAttribute?.(name) === value) return root;
  for (const child of root.children || []) {
    const match = findByTagAndAttribute(child, tagName, name, value);
    if (match) return match;
  }
  return null;
}

function findAllByTag(root, tagName, output = []) {
  if (root.tagName === tagName) {
    output.push(root);
  }
  for (const child of root.children || []) {
    findAllByTag(child, tagName, output);
  }
  return output;
}

function matchesSelector(element, selector) {
  const normalizedSelector = selector.trim();
  if (normalizedSelector === "button") return element.tagName === "BUTTON";
  if (normalizedSelector.startsWith("#")) return element.id === normalizedSelector.slice(1);
  if (normalizedSelector.startsWith(".")) {
    return String(element.className || "").split(/\s+/).includes(normalizedSelector.slice(1));
  }
  const dataPurpose = normalizedSelector.match(/^\[data-purpose="([^"]+)"\]$/);
  if (dataPurpose) return element.getAttribute?.("data-purpose") === dataPurpose[1];
  return false;
}

function findAllMatching(root, selector, output = []) {
  const selectors = selector.split(",").map((item) => item.trim());
  if (selectors.some((item) => matchesSelector(root, item))) {
    output.push(root);
  }
  for (const child of root.children || []) {
    findAllMatching(child, selector, output);
  }
  return output;
}

function jsonFetchResponse(body, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

function textFetchResponse(text, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    json: async () => ({}),
    text: async () => text
  };
}

function createYoutubeHarness(options = {}) {
  const moviePlayer = new FakeElement("div");
  moviePlayer.id = "movie_player";
  moviePlayer.setRect({
    left: 0,
    top: 0,
    width: options.playerRect?.width ?? 1000,
    height: options.playerRect?.height ?? 500
  });
  const controls = new FakeElement("div");
  const videoParent = new FakeElement("div");
  const video = new FakeElement("video");
  video.currentTime = 0;
  videoParent.setRect({
    left: 0,
    top: 0,
    width: 1000,
    height: 0
  });
  videoParent.append(video);
  moviePlayer.append(controls, videoParent);

  const body = new FakeElement("body");
  const head = new FakeElement("head");
  const documentListeners = {};
  body.append(moviePlayer);

  const sentMessages = [];
  const documentRef = {
    readyState: "complete",
    body,
    head,
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => findById(body, id) || findById(head, id),
    querySelector: (selector) => {
      if (selector === "#movie_player") return moviePlayer;
      if (selector === "#movie_player .ytp-right-controls") return controls;
      if (selector === "#movie_player video, video") return video;
      return findById(body, selector.replace(/^#/, ""));
    },
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    addEventListener: (type, listener, options) => {
      documentListeners[type] = documentListeners[type] || [];
      documentListeners[type].push({
        listener,
        capture: options === true || Boolean(options?.capture)
      });
    },
    dispatchEvent: (event) => {
      for (const { listener } of documentListeners[event.type] || []) {
        listener(event);
      }
    },
    dispatchCaptureEvent: (event) => {
      for (const { listener, capture } of documentListeners[event.type] || []) {
        if (capture) listener(event);
      }
    },
    documentElement: {
      innerHTML: ""
    }
  };

  const transcriptDocument = options.transcriptDocument || {
    platform: "youtube",
    videoId: "abc123def45",
    sourceLanguage: "en",
    cues: [
      {
        id: "yt-0",
        start: 0,
        end: 5,
        text: "Hello world"
      }
    ]
  };

  const runtimeMessageListeners = [];
  const storedSettings = {
    activeProvider: "googleTranslate",
    platforms: {
      youtube: true,
      udemy: true
    },
    ...(options.settings || {})
  };
  const chromeRef = {
    i18n: {
      getMessage: getKoreanMessage,
      getUILanguage: () => "ko"
    },
    runtime: {
      id: "test-extension",
      onMessage: {
        addListener: (listener) => {
          runtimeMessageListeners.push(listener);
        }
      },
      sendMessage: async (message) => {
        sentMessages.push(message);
        if (message.type === "settings.getPublic") {
          return { ok: true, settings: storedSettings };
        }
        if (message.type === "settings.updateSubtitleStyle") {
          storedSettings.subtitleStyle = {
            ...(storedSettings.subtitleStyle || {}),
            ...message.patch
          };
          return { ok: true, settings: storedSettings };
        }
        if (message.type === "settings.setActiveProvider") {
          storedSettings.activeProvider = message.providerId;
          return { ok: true, result: { providerId: message.providerId } };
        }
        if (options.sendMessage) {
          return options.sendMessage(message, { transcriptDocument });
        }
        if (message.type === "captions.youtube.fetchTranscript") {
          return { ok: true, document: transcriptDocument };
        }
        if (message.type === "translation.translateDocument") {
          return { ok: true, document: transcriptDocument };
        }
        return { ok: true };
      }
    },
    storage: {
      local: {
        get: async () => ({
          llmSettings: storedSettings
        }),
        set: async () => {}
      },
      onChanged: {
        addListener: () => {}
      }
    }
  };

  const context = {
    console,
    chrome: chromeRef,
    document: documentRef,
    location: {
      hostname: "www.youtube.com",
      href: "https://www.youtube.com/watch?v=abc123def45",
      pathname: "/watch",
      search: "?v=abc123def45"
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    getComputedStyle: (element) => ({
      position: "relative",
      backgroundColor: element?.computedBackgroundColor || "transparent"
    }),
    setInterval: () => 0,
    clearInterval: () => {},
    URL,
    URLSearchParams,
    fetch: options.fetch
  };

  return { context, controls, moviePlayer, video, runtimeMessageListeners, sentMessages };
}

function createUdemyHarness(options = {}) {
  const controls = new FakeElement("div");
  controls.setAttribute("data-purpose", "video-controls");
  const headerControls = new FakeElement("div");
  headerControls.setAttribute("data-testid", "header-controls");
  headerControls.setAttribute("id", "header-controls");
  const mediaPlayer = new FakeElement("div");
  mediaPlayer.setAttribute("data-purpose", "media-player-container");
  const udemyControlBar = new FakeElement("div");
  const progressDisplay = new FakeElement("div");
  progressDisplay.setAttribute("data-purpose", "progress-display");
  const playButton = new FakeElement("button");
  playButton.setAttribute("aria-label", "Pause");
  const captionsButton = new FakeElement("button");
  captionsButton.setAttribute("aria-label", "자막");
  captionsButton.setAttribute("data-panel-menu-trigger", "true");
  const settingsButton = new FakeElement("button");
  settingsButton.setAttribute("aria-label", "설정");
  const fullscreenButton = new FakeElement("button");
  fullscreenButton.setAttribute("aria-label", "전체 화면 시작");
  udemyControlBar.append(progressDisplay, playButton, captionsButton, settingsButton, fullscreenButton);
  mediaPlayer.append(udemyControlBar);
  const videoParent = new FakeElement("div");
  const video = new FakeElement("video");
  video.currentTime = 0;
  videoParent.append(video);

  const body = new FakeElement("body");
  const head = new FakeElement("head");
  const transcriptPanel = new FakeElement("div");
  transcriptPanel.setAttribute("data-purpose", "transcript-panel");
  const transcriptCueContainers = [];
  for (const text of options.transcriptRows || ["Udemy source subtitle"]) {
    const container = new FakeElement("div");
    const cue = new FakeElement("p");
    const cueText = new FakeElement("span");
    container.setAttribute("data-purpose", "transcript-cue-container");
    cue.setAttribute("data-purpose", "transcript-cue");
    cueText.setAttribute("data-purpose", "cue-text");
    cueText.textContent = text;
    cue.append(cueText);
    container.append(cue);
    transcriptPanel.append(container);
    transcriptCueContainers.push(container);
  }
  body.append(videoParent, options.useHeaderControlsOnly ? headerControls : controls, transcriptPanel);
  let newMediaPlayerControlsAvailable = Boolean(options.useNewMediaPlayerControls);
  if (options.useNewMediaPlayerControls) {
    body.append(mediaPlayer);
  }
  let currentVideo = video;

  const transcriptDocument = options.transcriptDocument || {
    platform: "udemy",
    videoId: "53273421",
    sourceLanguage: "en",
    cues: [
      {
        id: "udemy-0",
        start: 0,
        end: 5,
        text: "Udemy source subtitle"
      }
    ]
  };

  const runtimeMessageListeners = [];
  const sentMessages = [];
  const intervalCallbacks = [];
  const timeoutCallbacks = [];
  const mutationCallbacks = [];
  const warnings = [];
  const storedSettings = {
    activeProvider: "openrouter",
    platforms: {
      youtube: true,
      udemy: true
    },
    ...(options.settings || {})
  };
  const documentRef = {
    readyState: "complete",
    body,
    head,
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) => findById(body, id) || findById(head, id),
    querySelector: (selector) => {
      if (selector === '[data-purpose="video-controls"]') return options.useHeaderControlsOnly ? null : controls;
      if (selector === '[data-purpose="media-player-container"]') return newMediaPlayerControlsAvailable ? mediaPlayer : null;
      if (selector === '[data-testid="header-controls"]') return headerControls;
      if (selector === "#header-controls") return headerControls;
      if (selector === "video") return currentVideo;
      return body.querySelector(selector);
    },
    querySelectorAll: (selector) => body.querySelectorAll(selector),
    addEventListener: () => {},
    documentElement: {
      innerHTML: options.documentHtml || "\"courseId\":6862281"
    }
  };

  const chromeRef = {
    runtime: {
      id: "test-extension",
      onMessage: {
        addListener: (listener) => {
          runtimeMessageListeners.push(listener);
        }
      },
      sendMessage: async (message) => {
        sentMessages.push(message);
        if (message.type === "settings.getPublic") {
          if (options.storageGetError) {
            throw new Error(options.storageGetError);
          }
          return { ok: true, settings: storedSettings };
        }
        if (message.type === "settings.updateSubtitleStyle") {
          storedSettings.subtitleStyle = {
            ...(storedSettings.subtitleStyle || {}),
            ...message.patch
          };
          return { ok: true, settings: storedSettings };
        }
        if (message.type === "settings.setActiveProvider") {
          storedSettings.activeProvider = message.providerId;
          return { ok: true, result: { providerId: message.providerId } };
        }
        if (options.sendMessage) {
          return options.sendMessage(message, { transcriptDocument });
        }
        if (message.type === "captions.udemy.fetchTranscript") {
          return { ok: true, document: transcriptDocument };
        }
        if (message.type === "translation.translateDocument") {
          return { ok: true, document: transcriptDocument };
        }
        return { ok: true };
      }
    },
    storage: {
      local: {
        get: async () => {
          if (options.storageGetError) {
            throw new Error(options.storageGetError);
          }
          return {
            llmSettings: storedSettings
          };
        },
        set: async () => {}
      },
      onChanged: {
        addListener: () => {}
      }
    }
  };

  const context = {
    console: {
      ...console,
      warn: (...args) => {
        warnings.push(args);
        options.consoleWarn?.(...args);
      }
    },
    chrome: chromeRef,
    document: documentRef,
    location: {
      hostname: options.hostname || "www.udemy.com",
      href: options.href || "https://www.udemy.com/course/test/learn/lecture/53273421",
      pathname: options.pathname || "/course/test/learn/lecture/53273421",
      search: options.search || ""
    },
    MutationObserver: class {
      constructor(callback) {
        mutationCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
    getComputedStyle: (element) => ({
      position: "relative",
      backgroundColor: element?.computedBackgroundColor || "transparent"
    }),
    setInterval: (callback) => {
      intervalCallbacks.push(callback);
      return intervalCallbacks.length;
    },
    clearInterval: () => {},
    setTimeout: (callback) => {
      timeoutCallbacks.push(callback);
      return timeoutCallbacks.length;
    },
    clearTimeout: () => {},
    URL,
    URLSearchParams
  };

  return {
    context,
    controls,
    headerControls,
    mediaPlayer,
    udemyControlBar,
    transcriptPanel,
    transcriptCueContainers,
    runtimeMessageListeners,
    sentMessages,
    intervalCallbacks,
    timeoutCallbacks,
    mutationCallbacks,
    warnings,
    get currentVideo() {
      return currentVideo;
    },
    replaceVideo() {
      const replacementParent = new FakeElement("div");
      const replacement = new FakeElement("video");
      replacement.currentTime = 0;
      replacementParent.append(replacement);
      body.prepend(replacementParent);
      currentVideo = replacement;
      return { replacement, replacementParent };
    },
    enableNewMediaPlayerControls() {
      newMediaPlayerControlsAvailable = true;
      if (!mediaPlayer.parentElement) {
        body.append(mediaPlayer);
      }
      for (const callback of mutationCallbacks) {
        callback();
      }
    },
    runTimeouts() {
      for (const callback of timeoutCallbacks.splice(0)) {
        callback();
      }
    }
  };
}

async function flushPromises() {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

async function clickAstToggle(button) {
  button.dispatchEvent({
    type: "click",
    button: 0,
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();

  let root = button;
  while (root.parentElement) root = root.parentElement;
  const menu = findById(root, "ast-provider-menu");
  assert.ok(menu, "expected the AST provider menu to open");
  const toggleItem = menu.children.find((item) => item.className.includes("ast-provider-toggle-item"));
  assert.ok(toggleItem, "expected the AI subtitle translation toggle above settings");
  toggleItem.dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();
}

test("toolbar button opens a platform-styled provider menu before toggling AST", async () => {
  const { context, controls, moviePlayer, sentMessages } = createYoutubeHarness({
    settings: {
      activeProvider: "openai",
      providerTestStatus: {
        deepl: "success",
        openai: "success"
      }
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  button.dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();

  const menu = context.document.getElementById("ast-provider-menu");
  assert.ok(menu);
  assert.equal(menu.parentElement, moviePlayer);
  assert.equal(menu.hidden, false);
  assert.equal(menu.className, "ast-provider-menu ast-provider-menu-youtube");
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(menu.children.at(-2).children[0].textContent, "AI 자막 번역");
  assert.deepEqual(
    menu.children.filter((item) => item.dataset.providerId).map((item) => item.dataset.providerId),
    ["googleTranslate", "deepl", "openai"]
  );
  assert.equal(menu.children.at(-1).children[0].textContent, "설정 열기");
  assert.equal(sentMessages.some((message) => message.type.includes("fetchTranscript")), false);
  menu.children.at(-1).dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();
  assert.ok(sentMessages.some((message) => message.type === "ast.openOptions"));
});

test("another player toolbar button closes the AST menu during event capture", async () => {
  const { context, controls } = createYoutubeHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const astButton = controls.querySelector("#ast-toolbar-button");
  astButton.dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();

  const menu = context.document.getElementById("ast-provider-menu");
  assert.equal(menu.hidden, false);

  const otherToolbarButton = new FakeElement("button");
  controls.append(otherToolbarButton);
  context.document.dispatchCaptureEvent({
    type: "pointerdown",
    target: otherToolbarButton,
    stopPropagation: () => {}
  });

  assert.equal(menu.hidden, true);
  assert.equal(astButton.getAttribute("aria-expanded"), "false");
  assert.match(
    source,
    /document\.addEventListener\?\.\("pointerdown", closeProviderMenuOnOutsideInteraction, \{ capture: true \}\)/
  );
});

test("Udemy toolbar opens the independently styled AST provider menu", async () => {
  const harness = createUdemyHarness({
    settings: {
      activeProvider: "deepl",
      providerTestStatus: { deepl: "success" }
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  button.dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();

  const menu = harness.context.document.getElementById("ast-provider-menu");
  assert.ok(menu);
  assert.equal(menu.hidden, false);
  assert.equal(menu.className, "ast-provider-menu ast-provider-menu-udemy");
  assert.deepEqual(
    menu.children.filter((item) => item.dataset.providerId).map((item) => item.dataset.providerId),
    ["googleTranslate", "deepl"]
  );
  assert.equal(harness.sentMessages.some((message) => message.type.includes("fetchTranscript")), false);
});

test("Udemy transcript panel inserts each final translation below its matching cue", async () => {
  const transcriptDocument = {
    platform: "udemy",
    videoId: "53273421",
    sourceLanguage: "en",
    cues: [
      { id: "udemy-0", start: 0, end: 5, text: "First source cue" },
      { id: "udemy-1", start: 5, end: 10, text: "Repeated source cue" },
      { id: "udemy-2", start: 10, end: 15, text: "Repeated source cue" }
    ]
  };
  const pendingTranslation = new Promise(() => {});
  const harness = createUdemyHarness({
    transcriptDocument,
    transcriptRows: [" First   source cue ", "Repeated source cue", "Repeated source cue"],
    settings: { activeProvider: "googleTranslate" },
    sendMessage(message) {
      if (message.type === "captions.udemy.fetchTranscript") {
        return { ok: true, document: transcriptDocument };
      }
      if (message.type === "translation.translateDocument") return pendingTranslation;
      return { ok: true };
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));

  const finalRequest = harness.sentMessages.find((message) => message.type === "translation.translateDocument");
  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: transcriptDocument.videoId,
      mode: "final",
      requestId: finalRequest.requestId,
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          { id: "udemy-0", start: 0, end: 5, text: "첫 번째 번역" },
          { id: "udemy-1", start: 5, end: 10, text: "반복 번역 A" },
          { id: "udemy-2", start: 10, end: 15, text: "반복 번역 B" }
        ]
      }
    });
  }

  const translations = harness.transcriptCueContainers.map((container) => (
    container.querySelector(".ast-udemy-transcript-translation")
  ));
  assert.deepEqual(translations.map((element) => element?.textContent), [
    "첫 번째 번역",
    "반복 번역 A",
    "반복 번역 B"
  ]);
  assert.deepEqual(translations.map((element) => element?.dataset.phase), ["final", "final", "final"]);
  assert.equal(
    harness.transcriptCueContainers[0].querySelector('[data-purpose="cue-text"]').textContent,
    " First   source cue ",
    "expected the Udemy source cue to remain unchanged"
  );

  const activeCue = harness.transcriptCueContainers[1].querySelector('[data-purpose="transcript-cue"]');
  activeCue.setAttribute("data-purpose", "transcript-cue-active");
  activeCue.computedBackgroundColor = "rgb(255, 239, 184)";
  harness.mutationCallbacks.at(-1)([{
    target: activeCue,
    addedNodes: [],
    removedNodes: []
  }]);
  await flushPromises();
  assert.equal(translations[1].dataset.active, "true");
  assert.equal(translations[1].style.backgroundColor, "rgb(255, 239, 184)");
  assert.match(contentCss, /\.ast-udemy-transcript-translation\s*\{[\s\S]*color: #111827;/);

  translations[1].remove();
  harness.mutationCallbacks.at(-1)([{
    target: harness.controls,
    addedNodes: [],
    removedNodes: []
  }]);
  await flushPromises();
  assert.equal(
    harness.transcriptCueContainers[1].querySelector(".ast-udemy-transcript-translation"),
    null,
    "expected unrelated player mutations not to repaint every transcript cue"
  );

  for (const callback of harness.mutationCallbacks) callback();
  await flushPromises();
  assert.equal(
    harness.transcriptCueContainers[1].querySelector(".ast-udemy-transcript-translation")?.textContent,
    "반복 번역 A",
    "expected a React-style transcript rerender to restore the AST translation"
  );
});

test("provider menu persists selection, starts at current time, and shows only its pending spinner", async () => {
  let finishTranslation;
  const translationResponse = new Promise((resolve) => {
    finishTranslation = resolve;
  });
  const harness = createYoutubeHarness({
    settings: {
      activeProvider: "googleTranslate",
      providerTestStatus: { deepl: "success" }
    },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.fetchTranscript") {
        return { ok: true, document: transcriptDocument };
      }
      if (message.type === "translation.translateDocument") return translationResponse;
      return { ok: true };
    }
  });
  harness.video.currentTime = 77;
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  button.dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();
  const menu = harness.context.document.getElementById("ast-provider-menu");
  const deepLItem = menu.children.find((item) => item.dataset.providerId === "deepl");
  deepLItem.dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();
  await flushPromises();

  assert.ok(harness.sentMessages.some((message) => message.type === "settings.setActiveProvider"
    && message.providerId === "deepl"));
  const translationMessage = harness.sentMessages.find((message) => message.type === "translation.translateDocument");
  assert.equal(translationMessage.providerId, "deepl");
  assert.equal(translationMessage.mode, "final");
  assert.equal(translationMessage.initialStartTime, 77);
  assert.match(translationMessage.requestId, /:final:/);

  const pendingItems = menu.children.filter((item) => item.classList.values.has("pending"));
  assert.equal(pendingItems.length, 1);
  assert.equal(pendingItems[0].dataset.providerId, "deepl");
  assert.ok(pendingItems[0].children.some((child) => child.className === "ast-provider-spinner"));

  finishTranslation({ ok: true, document: harness.context.document.getElementById("ast-subtitle-overlay")
    ? { platform: "youtube", videoId: "abc123def45", sourceLanguage: "en", cues: [{ id: "yt-0", start: 0, end: 5, text: "완료" }] }
    : null });
  await flushPromises();
  assert.equal(menu.children.some((item) => item.classList.values.has("pending")), false);
});

test("provider menu normalizes an infinite video time before the final translation request", async () => {
  let finishTranslation;
  const translationResponse = new Promise((resolve) => {
    finishTranslation = resolve;
  });
  const harness = createYoutubeHarness({
    settings: {
      activeProvider: "googleTranslate",
      providerTestStatus: { deepl: "success" }
    },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.fetchTranscript") {
        return { ok: true, document: transcriptDocument };
      }
      if (message.type === "translation.translateDocument") return translationResponse;
      return { ok: true };
    }
  });
  harness.video.currentTime = Infinity;
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  button.dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();
  const menu = harness.context.document.getElementById("ast-provider-menu");
  const deepLItem = menu.children.find((item) => item.dataset.providerId === "deepl");
  deepLItem.dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();
  await flushPromises();

  const translationMessage = harness.sentMessages.find((message) => message.type === "translation.translateDocument");
  assert.equal(translationMessage.initialStartTime, 0);

  finishTranslation({ ok: true, document: null });
  await flushPromises();
});

test("YouTube toolbar button fetches transcript through the background worker", async () => {
  const { context, controls, sentMessages } = createYoutubeHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  assert.ok(button, "expected the content script to inject a YouTube toolbar button");

  await clickAstToggle(button);

  assert.ok(
    sentMessages.some((message) => message.type === "captions.youtube.fetchTranscript"),
    "expected button click to request a YouTube transcript"
  );
});

test("YouTube Google provider sends one final translation request without temporary duplicate", async () => {
  const { context, controls, sentMessages } = createYoutubeHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const translationMessages = sentMessages.filter((message) => message.type === "translation.translateDocument");
  assert.deepEqual(translationMessages.map((message) => message.mode), ["final"]);
  assert.equal(translationMessages[0].providerId, "googleTranslate");
});

test("YouTube LLM provider sends temporary Google and final LLM translation requests", async () => {
  const { context, controls, sentMessages } = createYoutubeHarness({
    settings: {
      activeProvider: "openrouter"
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const translationMessages = sentMessages.filter((message) => message.type === "translation.translateDocument");
  assert.deepEqual(translationMessages.map((message) => message.mode), ["temporary", "final"]);
  assert.equal(translationMessages[0].providerId, "googleTranslate");
  assert.equal(translationMessages[1].providerId, "openrouter");
});

test("YouTube temporary translation covers the configured chunk duration", async () => {
  const transcriptDocument = {
    platform: "youtube",
    videoId: "abc123def45",
    sourceLanguage: "en",
    cues: Array.from({ length: 8 }, (_, index) => ({
      id: `yt-${index}`,
      start: index * 30,
      end: index * 30 + 20,
      text: `Cue ${index}`
    }))
  };
  const { context, controls, sentMessages } = createYoutubeHarness({
    transcriptDocument,
    settings: {
      activeProvider: "openrouter"
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const temporaryMessage = sentMessages.find((message) => (
    message.type === "translation.translateDocument" && message.mode === "temporary"
  ));
  assert.deepEqual(
    JSON.parse(JSON.stringify(temporaryMessage.document.cues.map((cue) => cue.id))),
    ["yt-0", "yt-1", "yt-2", "yt-3", "yt-4", "yt-5", "yt-6", "yt-7"]
  );
});

test("Udemy standalone page delays the floating toolbar fallback and reads courseId from Next data", async () => {
  const harness = createUdemyHarness({
    useHeaderControlsOnly: true,
    hostname: "skax.udemy.com",
    href: "https://skax.udemy.com/course/ultimate-aws-certified-generative-ai-developer-professional/learn/lecture/53542835/?udfrontends=true&cteMode=standalone",
    pathname: "/course/ultimate-aws-certified-generative-ai-developer-professional/learn/lecture/53542835/",
    search: "?udfrontends=true&cteMode=standalone",
    documentHtml: "urlAutoEnroll\\\":\\\"https://skax.udemy.com/course/subscribe/?courseId=6928347\\u0026lectureId=53542835\\\""
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  assert.equal(
    harness.context.document.getElementById("ast-floating-toolbar"),
    null,
    "expected the Udemy floating fallback not to appear during initial player loading"
  );
  harness.runTimeouts();
  await flushPromises();

  const floatingToolbar = harness.context.document.getElementById("ast-floating-toolbar");
  assert.ok(floatingToolbar, "expected the content script to inject a floating Udemy toolbar");
  const button = floatingToolbar.querySelector("#ast-toolbar-button");
  assert.ok(button, "expected the floating toolbar to contain the Udemy subtitle button");

  await clickAstToggle(button);

  const transcriptRequest = harness.sentMessages.find((message) => message.type === "captions.udemy.fetchTranscript");
  assert.equal(transcriptRequest?.courseId, "6928347");
  assert.equal(transcriptRequest?.lectureId, "53542835");
  assert.equal(transcriptRequest?.hostname, "skax.udemy.com");
});

test("Udemy standalone media-player page injects the toolbar button into the new control bar", async () => {
  const harness = createUdemyHarness({
    useHeaderControlsOnly: true,
    useNewMediaPlayerControls: true,
    hostname: "skax.udemy.com",
    href: "https://skax.udemy.com/course/ultimate-aws-certified-generative-ai-developer-professional/learn/lecture/53542835/?udfrontends=true&cteMode=standalone",
    pathname: "/course/ultimate-aws-certified-generative-ai-developer-professional/learn/lecture/53542835/",
    search: "?udfrontends=true&cteMode=standalone",
    documentHtml: "urlAutoEnroll\\\":\\\"https://skax.udemy.com/course/subscribe/?courseId=6928347\\u0026lectureId=53542835\\\""
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  assert.equal(
    harness.context.document.getElementById("ast-floating-toolbar"),
    null,
    "expected the new Udemy player controls to avoid the floating fallback"
  );
  harness.runTimeouts();
  await flushPromises();
  assert.equal(
    harness.context.document.getElementById("ast-floating-toolbar"),
    null,
    "expected the delayed fallback not to appear after the new Udemy controls are available"
  );
  const button = harness.udemyControlBar.querySelector("#ast-toolbar-button");
  assert.ok(button, "expected the Udemy subtitle button inside the new media-player controls");

  await clickAstToggle(button);

  const transcriptRequest = harness.sentMessages.find((message) => message.type === "captions.udemy.fetchTranscript");
  assert.equal(transcriptRequest?.courseId, "6928347");
  assert.equal(transcriptRequest?.lectureId, "53542835");
  assert.equal(transcriptRequest?.hostname, "skax.udemy.com");
});

test("Udemy standalone media-player controls move an existing floating button into the new control bar", async () => {
  const harness = createUdemyHarness({
    useHeaderControlsOnly: true,
    hostname: "skax.udemy.com",
    href: "https://skax.udemy.com/course/ultimate-aws-certified-generative-ai-developer-professional/learn/lecture/53542835/?udfrontends=true&cteMode=standalone",
    pathname: "/course/ultimate-aws-certified-generative-ai-developer-professional/learn/lecture/53542835/",
    search: "?udfrontends=true&cteMode=standalone",
    documentHtml: "urlAutoEnroll\\\":\\\"https://skax.udemy.com/course/subscribe/?courseId=6928347\\u0026lectureId=53542835\\\""
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  assert.equal(
    harness.context.document.getElementById("ast-floating-toolbar"),
    null,
    "expected the Udemy floating fallback not to appear before the fallback delay"
  );
  harness.runTimeouts();
  await flushPromises();

  const floatingToolbar = harness.context.document.getElementById("ast-floating-toolbar");
  const floatingButton = floatingToolbar.querySelector("#ast-toolbar-button");
  assert.ok(floatingButton, "expected the Udemy button to start in the fallback toolbar");

  harness.enableNewMediaPlayerControls();
  await flushPromises();

  assert.equal(
    harness.context.document.getElementById("ast-floating-toolbar"),
    null,
    "expected the empty floating toolbar to be removed after the button moves"
  );
  assert.equal(
    harness.udemyControlBar.querySelector("#ast-toolbar-button"),
    floatingButton,
    "expected the existing Udemy button to move into the new media-player controls"
  );
});

test("Udemy standalone toolbar still appears when local settings cannot be read", async () => {
  const harness = createUdemyHarness({
    useHeaderControlsOnly: true,
    hostname: "skax.udemy.com",
    href: "https://skax.udemy.com/course/ultimate-aws-certified-generative-ai-developer-professional/learn/lecture/53542835/?udfrontends=true&cteMode=standalone",
    pathname: "/course/ultimate-aws-certified-generative-ai-developer-professional/learn/lecture/53542835/",
    search: "?udfrontends=true&cteMode=standalone",
    documentHtml: "urlAutoEnroll\\\":\\\"https://skax.udemy.com/course/subscribe/?courseId=6928347\\u0026lectureId=53542835\\\"",
    storageGetError: "storage unavailable"
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  assert.equal(
    harness.context.document.getElementById("ast-floating-toolbar"),
    null,
    "expected storage failures not to show the Udemy fallback toolbar during initial player loading"
  );
  harness.runTimeouts();
  await flushPromises();

  const floatingToolbar = harness.context.document.getElementById("ast-floating-toolbar");
  assert.ok(floatingToolbar, "expected storage failures not to block the Udemy fallback toolbar");
  assert.ok(floatingToolbar.querySelector("#ast-toolbar-button"));
  assert.ok(
    harness.warnings.some((args) => String(args[0]).includes("Failed to read platform settings")),
    "expected a diagnostic warning when platform settings cannot be read"
  );
});

test("Udemy subtitle loading ignores extension context invalidation without a warning", async () => {
  const harness = createUdemyHarness({
    sendMessage: async (message) => {
      if (message.type === "captions.udemy.fetchTranscript") {
        throw new Error("Extension context invalidated");
      }
      return { ok: true };
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  assert.ok(button, "expected the Udemy toolbar button to be available");
  await clickAstToggle(button);

  assert.equal(
    harness.warnings.some((args) => String(args[0]).includes("Failed to load udemy subtitles")),
    false,
    "expected extension invalidation not to be logged as a subtitle load failure"
  );
});

test("YouTube LLM provider uses tested DeepL as the temporary default translation provider", async () => {
  const { context, controls, sentMessages } = createYoutubeHarness({
    settings: {
      activeProvider: "openrouter",
      fallback: {
        providerId: "deepl"
      },
      providerTestStatus: {
        deepl: "success"
      }
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const translationMessages = sentMessages.filter((message) => message.type === "translation.translateDocument");
  assert.deepEqual(translationMessages.map((message) => message.mode), ["temporary", "final"]);
  assert.equal(translationMessages[0].providerId, "deepl");
  assert.equal(translationMessages[1].providerId, "openrouter");
});

test("YouTube saved DeepL active provider is used for final translation", async () => {
  const { context, controls, sentMessages } = createYoutubeHarness({
    settings: {
      activeProvider: "deepl",
      fallback: {
        providerId: "deepl"
      },
      providerTestStatus: {
        deepl: "success"
      }
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const translationMessages = sentMessages.filter((message) => message.type === "translation.translateDocument");
  assert.deepEqual(translationMessages.map((message) => message.mode), ["final"]);
  assert.equal(translationMessages[0].providerId, "deepl");
});

test("YouTube toolbar button is appended as the rightmost control", async () => {
  const { context, controls } = createYoutubeHarness();
  const existingButton = new FakeElement("button");
  existingButton.id = "ytp-existing-control";
  controls.append(existingButton);
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  assert.ok(button, "expected the content script to inject a YouTube toolbar button");
  assert.equal(controls.children.at(-1), button);
});

test("toolbar SVG uses CSS-driven colors for toggle and translation states", () => {
  const source = readFileSync("extension/content/content-script.js", "utf8");

  assert.match(source, /class="ast-toolbar-icon-bg"/);
  assert.match(source, /class="ast-toolbar-icon-outline"/);
  assert.match(source, /class="ast-toolbar-icon-mark"/);
  assert.match(source, />AST<\/text>/);
  assert.doesNotMatch(source, />LST<\/text>/);
  assert.doesNotMatch(source, /ast-toolbar-logo-gradient/);
  assert.doesNotMatch(source, /fill="url\(/);

  assert.match(contentCss, /--ast-toolbar-icon-bg:/);
  assert.match(contentCss, /--ast-toolbar-icon-outline:/);
  assert.match(contentCss, /--ast-toolbar-icon-mark:/);
  assert.match(source, /class="ast-toolbar-icon"[^>]*width="24" height="24"/);
  assert.match(source, /class="ast-toolbar-icon-outline" d="M335 150[^"]*V1076Q835 1094 823 1088[^"]*Z"/);
  assert.match(source, /class="ast-toolbar-icon-bg" d="M330 110[^"]*V1109Q850 1132 818 1119[^"]*Z"/);
  assert.match(source, /class="ast-toolbar-icon-mark"[^>]*font-size="400"/);
  assert.match(contentCss, /\.ast-toolbar-button svg\s*\{[\s\S]*width: 24px;[\s\S]*height: 24px;/);
  assert.match(contentCss, /\.ast-toolbar-icon-outline\s*\{[\s\S]*stroke-width: 64px;/);
  assert.match(contentCss, /\.ast-toolbar-button\.active\s*\{[\s\S]*--ast-toolbar-icon-bg: #0ea5e9;/);
  assert.match(contentCss, /\.ast-toolbar-button\.temporary\s*\{[\s\S]*--ast-toolbar-icon-bg: #facc15;/);
  assert.match(contentCss, /\.ast-toolbar-button\.current\s*\{[\s\S]*--ast-toolbar-icon-bg: #34d399;/);
  assert.match(contentCss, /\.ast-toolbar-button\.complete\s*\{[\s\S]*--ast-toolbar-icon-bg: #8b5cf6;/);
  assert.match(contentCss, /\.ast-toolbar-button\.fallback\s*\{[\s\S]*--ast-toolbar-icon-bg: #fb7185;/);
  assert.match(source, /button\.setAttribute\("aria-haspopup", "menu"\)/);
  assert.match(source, /toggleProviderMenu\(platform\)/);
  assert.match(source, /type: "settings\.setActiveProvider"/);
  assert.match(source, /function normalizeInitialStartTime\(value\)\s*\{\s*return Number\.isFinite\(value\) && value >= 0 \? value : 0;/);
  assert.match(source, /initialStartTime: normalizeInitialStartTime\(resolveRenderVideo\(video\)\?\.currentTime\)/);
  assert.match(source, /message\.requestId && message\.requestId !== subtitleState\.activeFinalRequestId/);
  assert.match(contentCss, /\.ast-provider-menu-udemy\s*\{[\s\S]*background: #1c1d1f;/);
  assert.match(contentCss, /\.ast-provider-menu-youtube\s*\{[\s\S]*border-radius: 12px;[\s\S]*background: rgba\(28, 28, 28, 0\.9\);/);
  assert.match(contentCss, /\.ast-provider-spinner\s*\{[\s\S]*animation: ast-provider-spin 700ms linear infinite;/);
  assert.doesNotMatch(contentCss, /control-bar-dropdown--menu--|video-control-bar-dropdown-module--|ytp-settings-menu/);
  assert.match(contentCss, /\.ast-floating-toolbar\s*\{[\s\S]*position: fixed;/);
  assert.match(contentCss, /\.ast-floating-toolbar\s*\{[\s\S]*z-index: 2147483647;/);
  assert.match(contentCss, /\.ast-toast\s*\{[\s\S]*top: 50%;/);
  assert.match(contentCss, /\.ast-toast\s*\{[\s\S]*transform: translate\(-50%, -50%\);/);
  assert.match(contentCss, /\.ast-toast\.ast-toast-video\s*\{[\s\S]*position: absolute;/);
  assert.doesNotMatch(contentCss, /\.ast-toast\s*\{[\s\S]*bottom: 24px;/);
});

test("YouTube transcript request includes caption tracks from the current page", async () => {
  const { context, controls, sentMessages } = createYoutubeHarness();
  context.document.documentElement.innerHTML = `
    <script>
      var ytInitialPlayerResponse = ${JSON.stringify({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                languageCode: "en",
                kind: "asr",
                name: { simpleText: "English auto" },
                baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en&kind=asr&sig=page"
              }
            ]
          }
        }
      })};
    </script>
  `;
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const message = sentMessages.find((item) => item.type === "captions.youtube.fetchTranscript");
  assert.deepEqual(JSON.parse(JSON.stringify(message.captionTracks)), [
    {
      videoId: "abc123def45",
      languageCode: "en",
      label: "English auto",
      isAutoGenerated: true,
      baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en&kind=asr&sig=page"
    }
  ]);
});

test("YouTube transcript request includes transcript endpoint data from the current page", async () => {
  const { context, controls, sentMessages } = createYoutubeHarness();
  context.document.documentElement.innerHTML = `
    <script>
      ytcfg.set({
        "INNERTUBE_API_KEY": "test-key",
        "INNERTUBE_CONTEXT": {
          "client": {
            "clientName": "WEB",
            "clientVersion": "2.20260706.00.00",
            "visitorData": "visitor"
          }
        }
      });
    </script>
    <script>
      var ytInitialData = ${JSON.stringify({
        engagementPanels: [
          {
            engagementPanelSectionListRenderer: {
              content: {
                continuationItemRenderer: {
                  continuationEndpoint: {
                    getTranscriptEndpoint: {
                      params: "panel%3D%3D"
                    }
                  }
                }
              }
            }
          }
        ]
      })};
    </script>
  `;
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const message = sentMessages.find((item) => item.type === "captions.youtube.fetchTranscript");
  assert.equal(message.transcriptParams, "panel%3D%3D");
  assert.equal(message.innertubeApiKey, "test-key");
  assert.deepEqual(JSON.parse(JSON.stringify(message.innertubeContext)), {
    client: {
      clientName: "WEB",
      clientVersion: "2.20260706.00.00",
      visitorData: "visitor"
    }
  });
});

test("YouTube transcript panel 403 from the background worker is retried on the current page", async () => {
  const fetchCalls = [];
  const { context, controls, sentMessages } = createYoutubeHarness({
    sendMessage: async (message) => {
      if (message.type === "captions.youtube.fetchTranscript") {
        return {
          ok: false,
          error: "Transcript response is empty.; transcript panel fallback failed: HTTP 403:",
          retryOnPage: {
            type: "youtubeTranscriptPanel",
            videoId: "abc123def45",
            languageCode: "en",
            params: "panel%3D%3D",
            innertubeApiKey: "test-key",
            innertubeContext: {
              client: {
                clientName: "WEB",
                clientVersion: "2.20260706.00.00"
              }
            }
          }
        };
      }
      if (message.type === "translation.translateDocument") {
        return { ok: true, document: message.document };
      }
      return { ok: true };
    },
    fetch: async (url, init = {}) => {
      fetchCalls.push({ url: String(url), init });
      return jsonFetchResponse({
        actions: [
          {
            updateEngagementPanelAction: {
              content: {
                transcriptRenderer: {
                  body: {
                    transcriptBodyRenderer: {
                      cueGroups: [
                        {
                          transcriptCueGroupRenderer: {
                            cues: [
                              {
                                transcriptCueRenderer: {
                                  cue: {
                                    runs: [
                                      { text: "Page " },
                                      { text: "panel caption" }
                                    ]
                                  },
                                  startOffsetMs: "0",
                                  durationMs: "5000"
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        ]
      });
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);
  await flushPromises();
  await flushPromises();
  await flushPromises();

  const overlay = context.document.getElementById("ast-subtitle-overlay");
  const translationMessage = sentMessages.find((message) => message.type === "translation.translateDocument");
  assert.equal(fetchCalls.length, 1);
  assert.ok(fetchCalls[0].url.includes("/youtubei/v1/get_transcript"));
  assert.equal(JSON.parse(fetchCalls[0].init.body).params, "panel==");
  assert.equal(overlay.textContent, "Page panel caption");
  assert.equal(translationMessage.document.cues[0].text, "Page panel caption");
});

test("YouTube background network failures are retried with ref-style Android player tracks on the current page", async () => {
  const fetchCalls = [];
  const androidBaseUrl = "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en&kind=asr&fmt=json3&sig=android";
  const androidPlainUrl = "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en&kind=asr&sig=android";
  const { context, controls, sentMessages } = createYoutubeHarness({
    sendMessage: async (message) => {
      if (message.type === "captions.youtube.fetchTranscript") {
        return {
          ok: false,
          error: "Transcript response is empty.; android player fallback failed: HTTP 403: ; transcript panel fallback failed: HTTP 403:",
          retryOnPage: {
            type: "youtubeTranscriptPanel",
            videoId: "abc123def45",
            languageCode: "en",
            params: "panel%3D%3D",
            innertubeApiKey: "test-key",
            innertubeContext: {
              client: {
                clientName: "WEB",
                clientVersion: "2.20260706.00.00"
              }
            }
          }
        };
      }
      if (message.type === "translation.translateDocument") {
        return { ok: true, document: message.document };
      }
      return { ok: true };
    },
    fetch: async (url, init = {}) => {
      fetchCalls.push({ url: String(url), init });

      if (String(url).includes("/youtubei/v1/player")) {
        return jsonFetchResponse({
          captions: {
            playerCaptionsTracklistRenderer: {
              captionTracks: [
                {
                  languageCode: "en",
                  kind: "asr",
                  name: { simpleText: "English auto" },
                  baseUrl: androidBaseUrl
                }
              ]
            }
          }
        });
      }

      if (String(url) === androidPlainUrl) {
        return textFetchResponse(`<transcript><text start="0" dur="5">Page Android caption</text></transcript>`);
      }

      if (String(url).includes("/youtubei/v1/get_transcript")) {
        return textFetchResponse("", {
          ok: false,
          status: 400,
          statusText: "Precondition check failed."
        });
      }

      return textFetchResponse("", {
        ok: false,
        status: 404,
        statusText: "Not Found"
      });
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);
  await flushPromises();
  await flushPromises();
  await flushPromises();

  const overlay = context.document.getElementById("ast-subtitle-overlay");
  const playerCall = fetchCalls.find((call) => call.url.includes("/youtubei/v1/player"));
  const translationMessage = sentMessages.find((message) => message.type === "translation.translateDocument");
  assert.ok(playerCall, "expected current page Android player fallback to be called");
  assert.equal(JSON.parse(playerCall.init.body).context.client.clientName, "ANDROID");
  assert.equal(fetchCalls.some((call) => call.url.includes("/youtubei/v1/get_transcript")), false);
  assert.equal(fetchCalls.find((call) => call.url === androidPlainUrl)?.url, androidPlainUrl);
  assert.ok(translationMessage, "expected recovered transcript to be sent for translation");
  assert.equal(overlay.textContent, "Page Android caption");
  assert.equal(translationMessage.document.cues[0].text, "Page Android caption");
});

async function loadYoutubeOverlay(options = {}) {
  const harness = createYoutubeHarness(options);
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  assert.ok(overlay, "expected subtitle overlay to exist");
  overlay.setRect({
    left: 400,
    top: 300,
    width: 200,
    height: 80
  });

  return { ...harness, overlay };
}

test("YouTube subtitle overlay is mounted on the player instead of the video container", async () => {
  const { moviePlayer, overlay } = await loadYoutubeOverlay();

  assert.equal(overlay.parentElement, moviePlayer);
  assert.equal(overlay.style.top, "78%");
});

test("subtitle visual size scales relative to the current player size", async () => {
  const large = await loadYoutubeOverlay({
    playerRect: {
      width: 1920,
      height: 1080
    }
  });
  const small = await loadYoutubeOverlay({
    playerRect: {
      width: 640,
      height: 360
    }
  });

  assert.equal(large.overlay.style.fontSize, "45px");
  assert.equal(large.overlay.style.width, "1080px");
  assert.equal(large.overlay.style.padding, "12px 21px");
  assert.equal(large.overlay.style.webkitTextStroke, "4.5px #000000");
  assert.equal(small.overlay.style.fontSize, "15px");
  assert.equal(small.overlay.style.width, "360px");
  assert.equal(small.overlay.style.padding, "4px 7px");
  assert.equal(small.overlay.style.webkitTextStroke, "1.5px #000000");
});

test("subtitle overlay keeps user relative width but auto-fits height inside the player on cue updates", async () => {
  const { overlay, runtimeMessageListeners } = await loadYoutubeOverlay({
    settings: {
      subtitleStyle: {
        positionX: 50,
        positionY: 78,
        width: 360,
        fontSize: 24
      }
    }
  });

  overlay.style.height = "120px";

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "A much longer translated subtitle that wraps across multiple lines but should still fit inside the current video player."
          }
        ]
      }
    });
  }

  assert.equal(overlay.style.width, "250px");
  assert.equal(overlay.style.height, "auto");
  assert.equal(overlay.style.maxHeight, "196px");
  assert.equal(overlay.style.overflowY, "auto");
  assert.equal(overlay.style.overflowX, "hidden");
});

test("final LLM progress switches subtitle background and toolbar icon to complete", async () => {
  const { controls, overlay, runtimeMessageListeners } = await loadYoutubeOverlay();
  const button = controls.querySelector("#ast-toolbar-button");

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "temporary",
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "Temporary translated subtitle"
          }
        ]
      }
    });
  }

  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.3)");
  assert.equal(button.classList.values.has("temporary"), true);

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "LLM translated subtitle"
          }
        ]
      }
    });
  }

  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(button.classList.values.has("complete"), true);
  assert.equal(button.classList.values.has("fallback"), false);
  assert.equal(overlay.textContent, "LLM translated subtitle");
});

test("provider changes ignore progress from an older translation request", async () => {
  const { overlay, runtimeMessageListeners, sentMessages } = await loadYoutubeOverlay({
    settings: {
      activeProvider: "openrouter",
      providerTestStatus: { openrouter: "success" }
    }
  });
  const finalRequest = sentMessages.find((message) => message.type === "translation.translateDocument"
    && message.mode === "final");
  assert.ok(finalRequest?.requestId);
  const originalText = overlay.textContent;

  runtimeMessageListeners[0]({
    type: "translation.progress",
    videoId: "abc123def45",
    mode: "final",
    requestId: `${finalRequest.requestId}:stale`,
    progress: {
      chunkIndex: 0,
      chunkCount: 1,
      cues: [{ id: "yt-0", start: 0, end: 5, text: "오래된 번역" }]
    }
  });

  assert.equal(overlay.textContent, originalText);
});

test("YouTube final translation shows pending colors until the final response completes", async () => {
  let resolveFinalTranslation;
  const finalTranslation = new Promise((resolve) => {
    resolveFinalTranslation = resolve;
  });
  const { context, controls } = createYoutubeHarness({
    sendMessage: async (message, { transcriptDocument }) => {
      if (message.type === "captions.youtube.fetchTranscript") {
        return { ok: true, document: transcriptDocument };
      }
      if (message.type === "translation.translateDocument") {
        return finalTranslation;
      }
      return { ok: true };
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);
  await flushPromises();

  const overlay = context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "Hello world");
  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.3)");
  assert.equal(button.classList.values.has("temporary"), true);
  assert.equal(button.classList.values.has("complete"), false);

  resolveFinalTranslation({
    ok: true,
    document: {
      platform: "youtube",
      videoId: "abc123def45",
      sourceLanguage: "en",
      cues: [
        {
          id: "yt-0",
          start: 0,
          end: 5,
          text: "Final translated subtitle"
        }
      ]
    }
  });
  await flushPromises();
  await flushPromises();

  assert.equal(overlay.textContent, "Final translated subtitle");
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(button.classList.values.has("complete"), true);
});

test("current YouTube cue final progress switches from pending to current-ready before full completion", async () => {
  const transcriptDocument = {
    platform: "youtube",
    videoId: "abc123def45",
    sourceLanguage: "en",
    cues: [
      { id: "yt-0", start: 0, end: 5, text: "Hello world" },
      { id: "yt-1", start: 5, end: 10, text: "Second cue" },
      { id: "yt-2", start: 10, end: 15, text: "Third cue" }
    ]
  };
  const harness = createYoutubeHarness({ transcriptDocument });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const video = harness.context.document.querySelector("#movie_player video, video");
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(button.classList.values.has("temporary"), true);
  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.3)");

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 3,
        cues: [
          { id: "yt-0", start: 0, end: 5, text: "First final subtitle" }
        ]
      }
    });
  }

  assert.equal(button.classList.values.has("current"), true);
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(button.classList.values.has("complete"), false);
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
  assert.equal(overlay.textContent, "First final subtitle");

  video.currentTime = 6;
  video.dispatchEvent({ type: "timeupdate" });

  assert.equal(button.classList.values.has("current"), false);
  assert.equal(button.classList.values.has("temporary"), true);
  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.3)");
  assert.equal(overlay.textContent, "Second cue");

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 1,
        chunkCount: 3,
        cues: [
          { id: "yt-1", start: 5, end: 10, text: "Second final subtitle" }
        ]
      }
    });
  }

  assert.equal(button.classList.values.has("current"), true);
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(button.classList.values.has("complete"), false);
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
  assert.equal(overlay.textContent, "Second final subtitle");

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 2,
        chunkCount: 3,
        cues: [
          { id: "yt-2", start: 10, end: 15, text: "Third final subtitle" }
        ]
      }
    });
  }

  assert.equal(button.classList.values.has("current"), false);
  assert.equal(button.classList.values.has("complete"), true);
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
});

test("out-of-order parallel final progress waits for every chunk before completing", async () => {
  const transcriptDocument = {
    platform: "youtube",
    videoId: "abc123def45",
    sourceLanguage: "en",
    cues: [
      { id: "yt-0", start: 0, end: 5, text: "Hello world" },
      { id: "yt-1", start: 5, end: 10, text: "Second cue" },
      { id: "yt-2", start: 10, end: 15, text: "Third cue" }
    ]
  };
  const harness = createYoutubeHarness({ transcriptDocument });
  const source = readFileSync("extension/content/content-script.js", "utf8");
  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 2,
        chunkCount: 3,
        completedChunkCount: 1,
        isComplete: false,
        cues: [{ id: "yt-2", start: 10, end: 15, text: "Third final subtitle" }]
      }
    });
  }

  const button = harness.controls.querySelector("#ast-toolbar-button");
  assert.equal(button.classList.values.has("complete"), false);

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 3,
        completedChunkCount: 3,
        isComplete: true,
        cues: [{ id: "yt-0", start: 0, end: 5, text: "First final subtitle" }]
      }
    });
  }

  assert.equal(button.classList.values.has("complete"), true);
});

test("seeking prioritizes temporary translation at the current YouTube cue", async () => {
  let resolveFinalTranslation;
  const finalTranslation = new Promise((resolve) => {
    resolveFinalTranslation = resolve;
  });
  const transcriptDocument = {
    platform: "youtube",
    videoId: "abc123def45",
    sourceLanguage: "en",
    cues: [
      { id: "yt-0", start: 0, end: 5, text: "Hello world" },
      { id: "yt-1", start: 5, end: 10, text: "Second cue" },
      { id: "yt-2", start: 10, end: 15, text: "Third cue" },
      { id: "yt-3", start: 15, end: 20, text: "Fourth cue" }
    ]
  };
  const harness = createYoutubeHarness({
    transcriptDocument,
    settings: {
      activeProvider: "google"
    },
    sendMessage: async (message) => {
      if (message.type === "captions.youtube.fetchTranscript") {
        return { ok: true, document: transcriptDocument };
      }
      if (message.type === "translation.translateDocument" && message.mode === "final") {
        return finalTranslation;
      }
      if (message.type === "translation.translateDocument") {
        return {
          ok: true,
          document: {
            ...message.document,
            cues: message.document.cues.map((cue) => ({
              ...cue,
              text: `Temporary ${cue.id}`
            }))
          }
        };
      }
      return { ok: true };
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);
  await flushPromises();

  const video = harness.context.document.querySelector("#movie_player video, video");
  video.currentTime = 11;
  video.dispatchEvent({ type: "seeked" });
  await flushPromises();
  await flushPromises();

  const temporaryMessages = harness.sentMessages.filter((message) => (
    message.type === "translation.translateDocument" && message.mode === "temporary"
  ));
  assert.equal(temporaryMessages.length, 2);
  assert.equal(temporaryMessages.at(-1).providerId, "googleTranslate");
  assert.equal(temporaryMessages.at(-1).forceNoCache, true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(temporaryMessages.at(-1).document.cues.map((cue) => cue.id))),
    ["yt-2", "yt-3"]
  );

  resolveFinalTranslation({
    ok: true,
    document: transcriptDocument
  });
});

test("intermediate final LLM progress does not mark YouTube subtitles complete", async () => {
  const transcriptDocument = {
    platform: "youtube",
    videoId: "abc123def45",
    sourceLanguage: "en",
    cues: [
      { id: "yt-0", start: 0, end: 5, text: "Hello world" },
      { id: "yt-1", start: 5, end: 10, text: "Second cue" }
    ]
  };
  const harness = createYoutubeHarness({ transcriptDocument });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 3,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "First LLM chunk subtitle"
          }
        ]
      }
    });
  }

  assert.equal(button.classList.values.has("complete"), false);
  assert.equal(button.classList.values.has("current"), true);
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
  assert.equal(overlay.textContent, "First LLM chunk subtitle");
});

test("final LLM cue coverage marks YouTube subtitles complete even before final response", async () => {
  const transcriptDocument = {
    platform: "youtube",
    videoId: "abc123def45",
    sourceLanguage: "en",
    cues: [
      { id: "yt-0", start: 0, end: 5, text: "Hello world" },
      { id: "yt-1", start: 5, end: 10, text: "Second cue" }
    ]
  };
  const harness = createYoutubeHarness({ transcriptDocument });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 3,
        cues: [
          { id: "yt-0", start: 0, end: 5, text: "First final subtitle" }
        ]
      }
    });
  }

  assert.equal(button.classList.values.has("complete"), false);
  assert.equal(button.classList.values.has("current"), true);
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 1,
        chunkCount: 3,
        cues: [
          { id: "yt-1", start: 5, end: 10, text: "Second final subtitle" }
        ]
      }
    });
  }

  assert.equal(button.classList.values.has("complete"), true);
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
  assert.equal(overlay.textContent, "First final subtitle");
});

test("final LLM progress repaints the current YouTube overlay after DOM replacement", async () => {
  const { context, moviePlayer, runtimeMessageListeners, overlay } = await loadYoutubeOverlay();
  overlay.remove();

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "LLM translated after replacement"
          }
        ]
      }
    });
  }

  const currentOverlay = context.document.getElementById("ast-subtitle-overlay");
  assert.notEqual(currentOverlay, overlay);
  assert.equal(currentOverlay.parentElement, moviePlayer);
  assert.equal(currentOverlay.textContent, "LLM translated after replacement");
  assert.equal(currentOverlay.style.background, "rgba(0, 0, 0, 0.3)");
});

test("final LLM progress repaints the current Udemy video overlay after video replacement", async () => {
  const harness = createUdemyHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  assert.ok(button, "expected the content script to inject a Udemy toolbar button");
  await clickAstToggle(button);

  const { replacement, replacementParent } = harness.replaceVideo();

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "53273421",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "udemy-0",
            start: 0,
            end: 5,
            text: "Udemy LLM translated subtitle"
          }
        ]
      }
    });
  }

  const currentOverlay = replacementParent.querySelector("#ast-subtitle-overlay");
  assert.ok(currentOverlay, "expected the replacement Udemy video parent to receive an overlay");
  assert.equal(replacement.astSubtitleCues[0].text, "Udemy LLM translated subtitle");
  assert.equal(currentOverlay.textContent, "Udemy LLM translated subtitle");
  assert.equal(currentOverlay.style.background, "rgba(0, 0, 0, 0.3)");
});

test("Udemy automatic refresh waits silently while lecture page data is temporarily missing", async () => {
  const harness = createUdemyHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  assert.ok(button, "expected the content script to inject a Udemy toolbar button");
  await clickAstToggle(button);

  harness.context.location.href = "https://www.udemy.com/course/test/learn/lecture/53273935#overview";
  harness.context.location.pathname = "/course/test/learn/lecture/53273935";
  harness.context.document.documentElement.innerHTML = "";

  harness.intervalCallbacks.at(-1)();
  await flushPromises();

  assert.equal(
    harness.sentMessages.filter((message) => message.type === "captions.udemy.fetchTranscript").length,
    1,
    "expected transient Udemy page data loss to avoid a new transcript request"
  );
  assert.ok(
    !harness.warnings.some((args) => String(args[0]).includes("Missing Udemy page data")),
    "expected automatic refresh to avoid noisy missing page data warnings"
  );
  const overlay = harness.currentVideo.parentElement.querySelector("#ast-subtitle-overlay");
  assert.equal(overlay.textContent, "Udemy source subtitle");
});

test("late temporary progress does not overwrite completed YouTube LLM subtitles", async () => {
  const { overlay, runtimeMessageListeners } = await loadYoutubeOverlay();

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "LLM translated subtitle"
          }
        ]
      }
    });
  }

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "temporary",
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "Late temporary subtitle"
          }
        ]
      }
    });
  }

  assert.equal(overlay.textContent, "LLM translated subtitle");
});

test("late temporary progress does not overwrite current-ready YouTube LLM subtitles", async () => {
  const transcriptDocument = {
    platform: "youtube",
    videoId: "abc123def45",
    sourceLanguage: "en",
    cues: [
      { id: "yt-0", start: 0, end: 5, text: "Hello world" },
      { id: "yt-1", start: 5, end: 10, text: "Second cue" }
    ]
  };
  const harness = createYoutubeHarness({ transcriptDocument });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        chunkIndex: 0,
        chunkCount: 3,
        cues: [
          { id: "yt-0", start: 0, end: 5, text: "First final subtitle" }
        ]
      }
    });
  }

  assert.equal(button.classList.values.has("current"), true);
  assert.equal(overlay.textContent, "First final subtitle");

  for (const listener of harness.runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "temporary",
      progress: {
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          { id: "yt-0", start: 0, end: 5, text: "Late temporary subtitle" }
        ]
      }
    });
  }

  assert.equal(button.classList.values.has("current"), true);
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
  assert.equal(overlay.textContent, "First final subtitle");
});

test("late temporary response does not overwrite completed YouTube LLM subtitles", async () => {
  let resolveTemporaryTranslation;
  const temporaryTranslation = new Promise((resolve) => {
    resolveTemporaryTranslation = resolve;
  });
  const { context, controls } = createYoutubeHarness({
    settings: {
      activeProvider: "openrouter"
    },
    sendMessage: async (message, { transcriptDocument }) => {
      if (message.type === "captions.youtube.fetchTranscript") {
        return { ok: true, document: transcriptDocument };
      }
      if (message.type === "translation.translateDocument" && message.mode === "temporary") {
        return temporaryTranslation;
      }
      if (message.type === "translation.translateDocument" && message.mode === "final") {
        return {
          ok: true,
          document: {
            ...transcriptDocument,
            cues: [
              {
                id: "yt-0",
                start: 0,
                end: 5,
                text: "LLM translated subtitle"
              }
            ]
          }
        };
      }
      return { ok: true };
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, {
    filename: "extension/content/content-script.js"
  });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);
  await flushPromises();

  const overlay = context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "LLM translated subtitle");

  resolveTemporaryTranslation({
    ok: true,
    document: {
      platform: "youtube",
      videoId: "abc123def45",
      sourceLanguage: "en",
      cues: [
        {
          id: "yt-0",
          start: 0,
          end: 5,
          text: "Late temporary subtitle"
        }
      ]
    }
  });
  await flushPromises();

  assert.equal(overlay.textContent, "LLM translated subtitle");
});

test("fallback final progress uses completed background and marks toolbar icon as fallback", async () => {
  const { controls, overlay, runtimeMessageListeners } = await loadYoutubeOverlay();
  const button = controls.querySelector("#ast-toolbar-button");

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        fallbackProviderId: "googleTranslate",
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "Fallback translated subtitle"
          }
        ]
      }
    });
  }

  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.3)");
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(button.classList.values.has("complete"), false);
  assert.equal(button.classList.values.has("fallback"), true);
});

test("quota fallback progress shows a toast notification", async () => {
  const { context, moviePlayer, runtimeMessageListeners } = await loadYoutubeOverlay();

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        fallbackProviderId: "googleTranslate",
        fallbackReason: "quota_exceeded",
        fallbackMessage: "API quota exceeded. Falling back to Google Translate.",
        chunkIndex: 0,
        chunkCount: 1,
        cues: [
          {
            id: "yt-0",
            start: 0,
            end: 5,
            text: "Fallback translated subtitle"
          }
        ]
      }
    });
  }

  const toast = context.document.getElementById("ast-toast");
  assert.ok(toast, "expected quota fallback toast to be rendered");
  assert.equal(toast.parentElement, moviePlayer);
  assert.equal(toast.classList.values.has("ast-toast-video"), true);
  assert.match(toast.textContent, /쿼터가 초과/);
  assert.match(toast.textContent, /Google Translate/);
});

test("subtitle overlay clicks are blocked before they reach the player", async () => {
  const { overlay } = await loadYoutubeOverlay();
  let prevented = false;
  let stopped = false;

  overlay.dispatchEvent({
    type: "click",
    button: 0,
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(stopped, true);
});

test("subtitle resize blocks the release click even when the pointer ends outside the overlay", async () => {
  const { context, overlay } = await loadYoutubeOverlay();
  let mouseupPrevented = false;
  let mouseupStopped = false;
  let clickPrevented = false;
  let clickStopped = false;

  overlay.dispatchEvent({
    type: "pointerdown",
    button: 0,
    pointerId: 1,
    clientX: 590,
    clientY: 370,
    stopPropagation: () => {}
  });
  overlay.setRect({
    left: 400,
    top: 300,
    width: 320,
    height: 120
  });

  context.document.dispatchEvent({
    type: "mouseup",
    preventDefault: () => {
      mouseupPrevented = true;
    },
    stopPropagation: () => {
      mouseupStopped = true;
    },
    stopImmediatePropagation: () => {}
  });
  context.document.dispatchEvent({
    type: "click",
    preventDefault: () => {
      clickPrevented = true;
    },
    stopPropagation: () => {
      clickStopped = true;
    },
    stopImmediatePropagation: () => {}
  });

  assert.equal(mouseupPrevented, true);
  assert.equal(mouseupStopped, true);
  assert.equal(clickPrevented, true);
  assert.equal(clickStopped, true);
});

test("subtitle overlay resizes from the full right edge without dragging", async () => {
  const { overlay } = await loadYoutubeOverlay();

  overlay.dispatchEvent({
    type: "pointerdown",
    button: 0,
    pointerId: 1,
    clientX: 596,
    clientY: 312,
    preventDefault: () => {},
    stopPropagation: () => {}
  });
  overlay.dispatchEvent({
    type: "pointermove",
    pointerId: 1,
    clientX: 676,
    clientY: 312,
    preventDefault: () => {},
    stopPropagation: () => {}
  });
  overlay.dispatchEvent({
    type: "pointerup",
    pointerId: 1,
    clientX: 676,
    clientY: 312,
    preventDefault: () => {},
    stopPropagation: () => {},
    stopImmediatePropagation: () => {}
  });

  assert.equal(overlay.style.width, "280px");
  assert.equal(overlay.style.left, "54%");
  assert.equal(overlay.style.top, "78%");
});

test("subtitle drag preserves the grab point instead of moving the center under the pointer", async () => {
  const { overlay } = await loadYoutubeOverlay();

  overlay.dispatchEvent({
    type: "pointerdown",
    button: 0,
    pointerId: 1,
    clientX: 420,
    clientY: 320,
    preventDefault: () => {},
    stopPropagation: () => {}
  });
  overlay.dispatchEvent({
    type: "pointermove",
    pointerId: 1,
    clientX: 520,
    clientY: 360,
    preventDefault: () => {}
  });

  assert.equal(overlay.style.left, "60%");
  assert.equal(overlay.style.top, "76%");
});

test("subtitle drag stops when pointer capture is lost", async () => {
  const { overlay } = await loadYoutubeOverlay();

  overlay.dispatchEvent({
    type: "pointerdown",
    button: 0,
    pointerId: 1,
    clientX: 420,
    clientY: 320,
    preventDefault: () => {},
    stopPropagation: () => {}
  });
  overlay.dispatchEvent({
    type: "lostpointercapture",
    pointerId: 1
  });
  overlay.dispatchEvent({
    type: "pointermove",
    pointerId: 1,
    clientX: 520,
    clientY: 360,
    preventDefault: () => {}
  });

  assert.equal(overlay.style.left, "50%");
  assert.equal(overlay.style.top, "78%");
});

test("YouTube toolbar button hides the player-mounted overlay on second click", async () => {
  const { controls, overlay } = await loadYoutubeOverlay();
  const button = controls.querySelector("#ast-toolbar-button");

  assert.equal(overlay.hidden, false);

  await clickAstToggle(button);

  assert.equal(overlay.dataset.disabled, "true");
  assert.equal(overlay.hidden, true);
});
