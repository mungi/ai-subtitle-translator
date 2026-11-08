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

  get textContent() {
    return this.children.length ? this.children.map((child) => child.textContent).join("") : this._textContent || "";
  }

  set textContent(value) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this._textContent = String(value);
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
  let currentVideo = options.videoReady === false ? null : video;
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
  const timeoutCallbacks = [];
  let timeoutSequence = 0;
  const documentRef = {
    readyState: "complete",
    body,
    head,
    createElement: (tagName) => new FakeElement(tagName),
    createTextNode: (text) => Object.assign(new FakeElement("#text"), { textContent: text }),
    getElementById: (id) => findById(body, id) || findById(head, id),
    querySelector: (selector) => {
      if (selector === "#movie_player") return moviePlayer;
      if (selector === "#movie_player .ytp-right-controls") return controls;
      if (selector === "#movie_player video, video") return currentVideo;
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
  const intervalCallbacks = [];
  const storedSettings = {
    // Existing translation-flow tests explicitly exercise translated-only mode.
    subtitleDisplayMode: "translated",
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
        if (message.type === "settings.getSubtitleEnabled") {
          if (options.getSubtitleEnabled) return options.getSubtitleEnabled();
          return { ok: true, enabled: options.subtitlePreference?.enabled !== false };
        }
        if (message.type === "settings.setSubtitleEnabled") {
          if (options.subtitlePreference) options.subtitlePreference.enabled = message.enabled;
          return { ok: true };
        }
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
        if (options.pendingFinalTranslation
          && message.type === "translation.translateDocument" && message.mode === "final") {
          return new Promise(() => {});
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
    setInterval: (callback) => {
      intervalCallbacks.push(callback);
      return intervalCallbacks.length;
    },
    clearInterval: () => {},
    setTimeout: (callback, delay) => {
      const timeout = { id: ++timeoutSequence, callback, delay, cleared: false };
      timeoutCallbacks.push(timeout);
      return timeout.id;
    },
    clearTimeout: (timeoutId) => {
      const timeout = timeoutCallbacks.find((item) => item.id === timeoutId);
      if (timeout) timeout.cleared = true;
    },
    URL,
    URLSearchParams,
    fetch: options.fetch,
    addEventListener: (type, listener) => {
      (windowListeners[type] ||= []).push(listener);
    }
  };
  const windowListeners = {};

  return {
    context,
    windowListeners,
    controls,
    moviePlayer,
    video,
    setVideoReady(ready) {
      currentVideo = ready ? video : null;
    },
    runtimeMessageListeners,
    sentMessages,
    intervalCallbacks,
    timeoutCallbacks,
    runTimeouts() {
      for (const timeout of timeoutCallbacks.splice(0)) {
        if (!timeout.cleared) timeout.callback();
      }
    }
  };
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
    subtitleDisplayMode: "translated",
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
    createTextNode: (text) => Object.assign(new FakeElement("#text"), { textContent: text }),
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
        if (message.type === "settings.getSubtitleEnabled") return { ok: true, enabled: true };
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
  // Loading a video awaits settings and the player track list before captions arrive.
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
  }
}

test("YouTube subtitles start enabled and stay off after a manual toggle", async () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(harness.sentMessages.filter((message) => message.type === "captions.youtube.fetchTranscript").length, 1);

  button.dispatchEvent({ type: "click", stopPropagation() {}, preventDefault() {} });
  await flushPromises();
  const menu = harness.context.document.getElementById("ast-provider-menu");
  menu.children.find((item) => item.className.includes("ast-provider-toggle-item"))
    .dispatchEvent({ type: "click", stopPropagation() {}, preventDefault() {} });
  await flushPromises();
  assert.equal(button.getAttribute("aria-pressed"), "false");

  for (const callback of harness.intervalCallbacks) callback();
  await flushPromises();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(harness.sentMessages.filter((message) => message.type === "captions.youtube.fetchTranscript").length, 1);
});

test("YouTube restores the last toggle state in a new page", async () => {
  const subtitlePreference = {};
  const source = readFileSync("extension/content/content-script.js", "utf8");
  const first = createYoutubeHarness({ subtitlePreference });
  vm.runInNewContext(source, first.context);
  await flushPromises();
  await flushPromises();
  await vm.runInNewContext('toggleSubtitles("youtube")', first.context);
  assert.equal(subtitlePreference.enabled, false);

  const second = createYoutubeHarness({ subtitlePreference });
  vm.runInNewContext(source, second.context);
  await flushPromises();
  await flushPromises();
  assert.equal(second.controls.querySelector("#ast-toolbar-button").getAttribute("aria-pressed"), "false");
  assert.equal(second.sentMessages.some((message) => message.type === "captions.youtube.fetchTranscript"), false);
  await vm.runInNewContext('toggleSubtitles("youtube")', second.context);
  assert.equal(subtitlePreference.enabled, true);

  const third = createYoutubeHarness({ subtitlePreference });
  vm.runInNewContext(source, third.context);
  await flushPromises();
  await flushPromises();
  assert.equal(third.controls.querySelector("#ast-toolbar-button").getAttribute("aria-pressed"), "true");
});

test("YouTube subtitles start when a late video player becomes ready", async () => {
  const harness = createYoutubeHarness({ videoReady: false });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(harness.sentMessages.some((message) => message.type === "captions.youtube.fetchTranscript"), false);

  harness.setVideoReady(true);
  for (const callback of harness.intervalCallbacks) callback();
  await flushPromises();
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(harness.sentMessages.filter((message) => message.type === "captions.youtube.fetchTranscript").length, 1);
});

test("Udemy subtitles start enabled on a ready lecture", async () => {
  const harness = createUdemyHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await flushPromises();

  assert.equal(harness.controls.querySelector("#ast-toolbar-button").getAttribute("aria-pressed"), "true");
  assert.equal(harness.sentMessages.filter((message) => message.type === "captions.udemy.fetchTranscript").length, 1);
});

test("overlapping YouTube cues select the latest started cue at the shared boundary", async () => {
  const harness = createYoutubeHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");
  vm.runInNewContext(source, harness.context);
  await flushPromises();
  const cues = [
    { id: "old", start: 0, end: 8, text: "Previous sentence" },
    { id: "new", start: 3, end: 10, text: "Current sentence" }
  ];
  assert.equal(harness.context.findActiveCue(cues, 2.99).id, "old");
  assert.equal(harness.context.findActiveCue(cues, 3).id, "new");
  assert.equal(harness.context.findActiveCue(cues, 8).id, "new");
  assert.equal(harness.context.findActiveCue(cues, 10), null);
});

test("subtitle display defaults to dual subtitles and switches modes without retranslating", async () => {
  const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: undefined } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  harness.context.applyTranslatedCues(harness.video, [{ id: "yt-0", start: 50, end: 60, text: "안녕하세요" }]);
  assert.equal(overlay.textContent, "Hello world\n안녕하세요");
  assert.equal(harness.video.astSubtitleCues[0].start, 0);
  assert.equal(harness.video.astSubtitleCues[0].end, 5);
  const translationCount = harness.sentMessages.filter((m) => m.type === "translation.translateDocument").length;
  const list = harness.context.document.getElementById("ast-provider-menu").querySelector(".ast-subtitle-display-list");
  assert.ok(list);
  assert.deepEqual(list.children.filter((item) => item.dataset.mode).map((item) => item.dataset.mode), ["dual", "source", "translated"]);
  assert.equal(list.children[0].getAttribute("aria-checked"), "true");
  list.children[2].dispatchEvent({ type: "click", stopPropagation() {} });
  await flushPromises();
  assert.equal(overlay.textContent, "안녕하세요");
  assert.ok(harness.sentMessages.some((m) => m.type === "settings.setSubtitleDisplayMode" && m.mode === "translated"));
  const updatedList = harness.context.document.getElementById("ast-provider-menu").querySelector(".ast-subtitle-display-list");
  assert.equal(updatedList.children[2].getAttribute("aria-checked"), "true");
  assert.equal(updatedList.children[0].getAttribute("aria-checked"), "false");
  harness.context.applyTranslatedCues(harness.video, [{ id: "yt-0", start: 0, end: 5, text: "최종 번역" }]);
  assert.equal(overlay.textContent, "최종 번역");
  await harness.context.selectSubtitleDisplayMode("dual");
  assert.equal(overlay.textContent, "Hello world\n최종 번역");
  await harness.context.selectSubtitleDisplayMode("source");
  assert.equal(overlay.textContent, "Hello world");
  assert.equal(harness.sentMessages.filter((m) => m.type === "translation.translateDocument").length, translationCount);
  harness.video.currentTime = 5;
  harness.video.dispatchEvent({ type: "seeked" });
  assert.equal(overlay.hidden, true);
});

test("dual subtitles keep source visible while translation is pending and react to settings broadcasts", async () => {
  const harness = createUdemyHarness({
    settings: { subtitleDisplayMode: "dual" },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.udemy.fetchTranscript") return { ok: true, document: transcriptDocument };
      if (message.type === "translation.translateDocument") return new Promise(() => {});
      return { ok: true };
    }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "Udemy source subtitle");
  harness.context.applyTranslatedCues(harness.currentVideo, [{ id: "udemy-0", text: "강의 번역" }]);
  assert.equal(overlay.textContent, "Udemy source subtitle\n강의 번역");
  harness.runtimeMessageListeners[0]({ type: "settings.changed", settings: { subtitleDisplayMode: "source" } });
  assert.equal(overlay.textContent, "Udemy source subtitle");
  harness.runtimeMessageListeners[0]({ type: "settings.changed", settings: { subtitleDisplayMode: "translated" } });
  assert.equal(overlay.textContent, "강의 번역");
});

test("Persian dual subtitles isolate source and translation directions even with a leading English term", async () => {
  const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "dual", targetLanguage: "fa" } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  const text = "API نسخهٔ ۲ را بررسی کنید (test).";
  harness.context.applyTranslatedCues(harness.video, [{ id: "yt-0", text }]);
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  const lines = overlay.querySelectorAll(".ast-subtitle-line");
  assert.equal(lines.length, 2);
  assert.equal(lines[0].getAttribute("dir"), "ltr");
  assert.equal(lines[0].getAttribute("lang"), "en");
  assert.equal(lines[1].getAttribute("dir"), "rtl");
  assert.equal(lines[1].getAttribute("lang"), "fa");
  assert.equal(overlay.textContent, `Hello world\n${text}`);
  await harness.context.selectSubtitleDisplayMode("translated");
  assert.equal(overlay.querySelectorAll(".ast-subtitle-line").length, 1);
  assert.equal(overlay.querySelector(".ast-subtitle-line").getAttribute("dir"), "rtl");
  harness.runtimeMessageListeners[0]({ type: "settings.changed", settings: { targetLanguage: "ko" } });
  assert.equal(overlay.querySelector(".ast-subtitle-line").getAttribute("dir"), "ltr");
  assert.match(contentCss, /\.ast-subtitle-line\s*\{[^}]*unicode-bidi: isolate;/);
});

test("Persian Udemy transcript translation has RTL direction and logical start alignment", async () => {
  const harness = createUdemyHarness({
    settings: { targetLanguage: "fa" },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.udemy.fetchTranscript") return { ok: true, document: transcriptDocument };
      if (message.type === "translation.translateDocument") return new Promise(() => {});
      return { ok: true };
    }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  harness.context.applyTranslatedCues(harness.currentVideo, [{ id: "udemy-0", text: "API نسخهٔ ۲ را بررسی کنید." }]);
  const translation = harness.transcriptCueContainers[0].querySelector(".ast-udemy-transcript-translation");
  assert.equal(translation.getAttribute("dir"), "rtl");
  assert.equal(translation.getAttribute("lang"), "fa");
  assert.match(contentCss, /\.ast-udemy-transcript-translation\s*\{[^}]*text-align: start;/);
});

test("video frame rendering advances overlapping subtitles before the next timeupdate", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "dual" },
    transcriptDocument: {
      platform: "youtube", videoId: "abc123def45", sourceLanguage: "en",
      cues: [
        { id: "a", start: 0, end: 8, text: "First" },
        { id: "b", start: 3, end: 10, text: "Second" }
      ]
    }
  });
  let frameCallback;
  harness.video.requestVideoFrameCallback = (callback) => { frameCallback = callback; return 1; };
  harness.video.paused = false;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  harness.context.applyTranslatedCues(harness.video, [{ id: "b", text: "두 번째" }]);
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  frameCallback(100, { mediaTime: 3 });
  assert.equal(overlay.textContent, "Second\n두 번째");
  // An event can temporarily render a time just before the presented frame.
  // The following frame must restore its cue, even if that frame cue is unchanged.
  harness.video.currentTime = 2.99;
  harness.video.dispatchEvent({ type: "timeupdate" });
  frameCallback(110, { mediaTime: 3.03 });
  assert.equal(overlay.textContent, "Second\n두 번째");
  harness.video.currentTime = 1;
  harness.video.dispatchEvent({ type: "seeked" });
  assert.ok(overlay.textContent.startsWith("First"));
});

test("YouTube word highlighting follows video-frame timing, seeks, and stays on the original line", async () => {
  const transcriptDocument = {
    platform: "youtube", videoId: "abc123def45", sourceLanguage: "en",
    cues: [{ id: "yt-0", start: 0, end: 5, text: "First second third", words: [
      { text: "First", start: 0, end: 1 },
      { text: " second", start: 1, end: 2 },
      { text: " third", start: 2, end: 5 }
    ] }]
  };
  const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "dual" }, transcriptDocument });
  let frame;
  harness.video.requestVideoFrameCallback = (callback) => { frame = callback; return 1; };
  harness.video.paused = false;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  harness.context.applyTranslatedCues(harness.video, [{ id: "yt-0", text: "첫째 둘째 셋째" }]);
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  const words = () => overlay.querySelectorAll(".ast-subtitle-word");
  frame(1, { mediaTime: 1.1 });
  assert.deepEqual(words().map((word) => word.dataset.state), ["spoken", "active", "pending"]);
  frame(2, { mediaTime: 2.1 });
  assert.deepEqual(words().map((word) => word.dataset.state), ["spoken", "spoken", "active"]);
  harness.video.currentTime = 0.5;
  harness.video.dispatchEvent({ type: "seeked" });
  assert.deepEqual(words().map((word) => word.dataset.state), ["active", "pending", "pending"]);
  assert.equal(overlay.querySelectorAll(".ast-subtitle-line")[1].querySelectorAll(".ast-subtitle-word").length, 0);
  assert.equal(overlay.textContent, "First second third\n첫째 둘째 셋째");
  await harness.context.selectSubtitleDisplayMode("translated");
  assert.equal(words().length, 0);
  assert.equal(overlay.textContent, "첫째 둘째 셋째");
});

test("untimed YouTube captions decode entities and show estimated speech progress before the next cue", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source", subtitleStyle: { textColor: "#ffe5a3" } },
    transcriptDocument: {
      platform: "youtube", videoId: "abc123def45", sourceLanguage: "en",
      cues: [
        { id: "yt-0", start: 0, end: 8, text: "as they paddled down Utah&amp;#39;s majestic Green River." },
        { id: "yt-1", start: 4, end: 10, text: "Next sentence" }
      ]
    }
  });
  let frame;
  harness.video.requestVideoFrameCallback = (callback) => { frame = callback; return 1; };
  harness.video.paused = false;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  frame(1, { mediaTime: 2 });
  assert.equal(overlay.textContent, "as they paddled down Utah's majestic Green River.");
  const words = overlay.querySelectorAll(".ast-subtitle-word");
  assert.ok(words.length > 1);
  assert.equal(words[0].dataset.state, "spoken");
  assert.equal(words.at(-1).dataset.state, "pending");
  assert.equal(Number(words.at(-1).dataset.end), 4);
  assert.equal(overlay.style.color, "#ffe5a3");
  assert.match(contentCss, /\.ast-subtitle-word\[data-state="pending"\]\s*\{[^}]*color: #A3A3A3;/);
  assert.doesNotMatch(contentCss, /\.ast-subtitle-word\[data-state="active"\]\s*\{[^}]*background:/);
  frame(2, { mediaTime: 3.9 });
  assert.equal(words.at(-1).dataset.state, "active");
  harness.video.currentTime = 0.1;
  harness.video.dispatchEvent({ type: "seeked" });
  assert.equal(overlay.querySelectorAll(".ast-subtitle-word")[0].dataset.state, "active");
});

test("YouTube ads hide AST immediately and resume the current main-video cue afterward", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source" },
    transcriptDocument: {
      platform: "youtube", videoId: "abc123def45", sourceLanguage: "en",
      cues: [
        { id: "yt-0", start: 0, end: 5, text: "Opening sentence" },
        { id: "yt-1", start: 10, end: 20, text: "Current main-video sentence" }
      ]
    }
  });
  let adChanged;
  harness.context.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(target, options) {
      if (target === harness.moviePlayer && options.attributeFilter?.includes("class")) adChanged = this.callback;
    }
    disconnect() {}
  };
  harness.video.currentTime = 12;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "Current main-video sentence");
  assert.equal(overlay.hidden, false);
  assert.equal(typeof adChanged, "function");
  for (const adClass of ["ad-showing", "ad-interrupting"]) {
    harness.moviePlayer.classList.add(adClass);
    harness.video.currentTime = 0;
    adChanged();
    assert.equal(overlay.hidden, true);
    harness.video.dispatchEvent({ type: "timeupdate" });
    assert.equal(overlay.hidden, true);
    harness.context.showOverlayMessage(harness.video, "Loading captions");
    assert.equal(overlay.hidden, true);
    harness.context.clearOverlayStatus(harness.video);
    harness.moviePlayer.classList.remove(adClass);
    harness.video.currentTime = 12;
    adChanged();
    assert.equal(overlay.hidden, false);
    assert.equal(overlay.textContent, "Current main-video sentence");
  }
});

for (const platform of ["youtube", "udemy", "ted", "nvidia", "vimeo"]) {
  test(`${platform} uses the shared dual-subtitle renderer and display submenu`, async () => {
    const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "dual" } });
    harness.context.performance = { getEntriesByType: () => [] };
    const querySelector = harness.context.document.querySelector;
    harness.context.document.querySelector = (selector) => {
      if (selector === "video" || selector === "#video-player-container video#video, video#video") return harness.video;
      return querySelector(selector);
    };
    const source = readFileSync("extension/content/content-script.js", "utf8");
    vm.runInNewContext(source, harness.context);
    await flushPromises();
    vm.runInNewContext(`subtitleState.enabled = true; subtitleState.currentPlatform = ${JSON.stringify(platform)};`, harness.context);
    harness.context.renderOverlay(harness.video, [{ id: "one", start: 0, end: 5, text: "Original" }]);
    harness.context.applyTranslatedCues(harness.video, [{ id: "one", start: 0, end: 5, text: "번역" }]);
    const host = harness.context.findOverlayHost(platform, harness.video);
    assert.equal(host.querySelector("#ast-subtitle-overlay").textContent, "Original\n번역");
    harness.context.ensureProviderMenu(platform);
    harness.context.renderProviderMenu(platform);
    const menu = harness.context.document.getElementById("ast-provider-menu");
    const displayList = menu.querySelector(".ast-subtitle-display-list");
    assert.equal(displayList.children.filter((item) => item.dataset.mode).length, 3);
    assert.equal(displayList.children.at(-1).className, "ast-provider-menu-item ast-translation-position-row");
  });
}

async function clickAstToggle(button) {
  const alreadyEnabled = button.getAttribute("aria-pressed") === "true";
  button.dispatchEvent({
    type: "click",
    button: 0,
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();

  if (alreadyEnabled) {
    await flushPromises();
    await flushPromises();
    return;
  }
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
  context.document.documentElement.innerHTML = `
    <script>
      var ytInitialPlayerResponse = ${JSON.stringify({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en",
                languageCode: "en",
                name: { simpleText: "English" }
              }
            ]
          }
        }
      })};
    </script>
  `;
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
  assert.equal(menu.children.at(-3).children[0].textContent, "AI 자막 번역");
  const statusLine = menu.children.at(-1);
  assert.equal(statusLine.className, "ast-provider-status");
  assert.equal(statusLine.getAttribute("role"), "status");
  // The status line and the toolbar tooltip read from the same wording.
  assert.equal(statusLine.children[1].textContent, button.title);
  assert.deepEqual(
    menu.children.filter((item) => item.dataset.providerId).map((item) => item.dataset.providerId),
    ["googleTranslate", "deepl", "openai"]
  );
  const sourceCaptionSubmenu = menu.children.find((item) => item.className === "ast-source-caption-submenu");
  assert.ok(sourceCaptionSubmenu, "expected the source caption submenu to be rendered");
  const sourceCaptionIndex = menu.children.indexOf(sourceCaptionSubmenu);
  assert.equal(menu.children.at(sourceCaptionIndex - 1).className, "ast-provider-menu-separator");
  const styleSubmenu = menu.children.find((item) => item.className === "ast-translation-style-submenu");
  assert.ok(styleSubmenu, "expected the translation style submenu to be rendered");
  assert.equal(styleSubmenu.children[0].children[0].textContent, "번역 스타일: Custom 1");
  const styleItems = styleSubmenu.children[1].children.filter((item) => item.className.includes("ast-translation-style-item"));
  assert.deepEqual(
    styleItems.map((item) => item.children[0].textContent),
    ["Natural", "Lecture", "Technical", "Custom 1", "Custom 2"]
  );
  // The YouTube preference uses the same on/off switch row as the AI subtitle toggle.
  const youtubeToggleRow = styleSubmenu.children[1].children.at(-1);
  assert.equal(youtubeToggleRow.className, "ast-provider-toggle-item ast-youtube-provided-toggle-item");
  assert.equal(youtubeToggleRow.dataset.enabled, "true");
  const youtubeToggle = youtubeToggleRow.children[0];
  assert.equal(youtubeToggle.children[0].textContent, "YouTube 제공 자막 우선");
  assert.equal(youtubeToggle.children[1].className, "ast-provider-toggle");
  assert.equal(youtubeToggle.getAttribute("role"), "menuitemcheckbox");
  assert.equal(youtubeToggle.getAttribute("aria-checked"), "true");
  sourceCaptionSubmenu.children[0].dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  assert.equal(
    menu.children.find((item) => item.className === "ast-source-caption-submenu"),
    sourceCaptionSubmenu,
    "expected source caption menu clicks not to lock the submenu open"
  );
  assert.equal(sourceCaptionSubmenu.classList.values.has("open"), false);
  styleSubmenu.children[0].dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  assert.equal(
    menu.children.find((item) => item.className === "ast-translation-style-submenu"),
    styleSubmenu,
    "expected translation style menu clicks not to lock the submenu open"
  );
  assert.equal(styleSubmenu.classList.values.has("open"), false);
  assert.equal(menu.children.at(-2).children[0].textContent, "설정 열기");
  assert.equal(sentMessages.some((message) => message.type.includes("fetchTranscript")), true);
  menu.children.at(-2).dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();
  assert.ok(sentMessages.some((message) => message.type === "ast.openOptions"));
});

test("provider menu closes after five seconds unless the user interacts with it", async () => {
  const { context, controls, timeoutCallbacks, runTimeouts } = createYoutubeHarness();
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
  assert.equal(timeoutCallbacks.at(-1)?.delay, 5000);
  runTimeouts();
  assert.equal(menu.hidden, true, "expected an untouched menu to close after five seconds");

  button.dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();
  menu.dispatchEvent({ type: "pointerover" });
  runTimeouts();
  assert.equal(menu.hidden, false, "expected a hovered menu to remain open");
  menu.dispatchEvent({ type: "pointerleave" });
  runTimeouts();
  assert.equal(menu.hidden, true, "expected the timer to restart after the pointer leaves");

  button.dispatchEvent({
    type: "click",
    stopPropagation: () => {},
    preventDefault: () => {}
  });
  await flushPromises();
  menu.dispatchEvent({ type: "click" });
  runTimeouts();
  assert.equal(menu.hidden, false, "expected a clicked menu to remain open");
  menu.dispatchEvent({ type: "pointerleave" });
  runTimeouts();
  assert.equal(menu.hidden, true, "expected a clicked menu to close after the pointer leaves");
});

test("translation progress keeps an open provider submenu mounted", async () => {
  const { context, controls } = createYoutubeHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");
  context.document.documentElement.innerHTML = `
    <script>
      var ytInitialPlayerResponse = ${JSON.stringify({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              {
                baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en",
                languageCode: "en",
                name: { simpleText: "English" }
              }
            ]
          }
        }
      })};
    </script>
  `;

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
  const sourceCaptionSubmenu = menu.children.find((item) => item.className === "ast-source-caption-submenu");
  const translationStyleSubmenu = menu.children.find((item) => item.className === "ast-translation-style-submenu");
  assert.ok(sourceCaptionSubmenu);
  assert.ok(translationStyleSubmenu);

  context.setTranslationPhase("temporary");

  assert.equal(menu.dataset.phase, "temporary");
  assert.ok(menu.children.includes(sourceCaptionSubmenu), "expected the source submenu to stay mounted");
  assert.ok(menu.children.includes(translationStyleSubmenu), "expected the style submenu to stay mounted");
});

test("YouTube provider menu stops quietly after the extension context is invalidated", async () => {
  const { context, controls } = createYoutubeHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  assert.ok(controls.querySelector("#ast-toolbar-button"));
  context.chrome.i18n.getMessage = () => {
    throw new Error("Extension context invalidated");
  };
  delete context.chrome.runtime.id;

  await assert.doesNotReject(() => context.toggleProviderMenu("youtube"));
  assert.equal(
    context.document.getElementById("ast-provider-menu")?.hidden,
    true,
    "expected an invalidated content script not to reopen its provider menu"
  );
});

test("AST source and translation style submenus only open on hover", () => {
  const contentScript = readFileSync("extension/content/content-script.js", "utf8");
  const contentCss = readFileSync("extension/content/content-style.css", "utf8");

  assert.match(contentCss, /\.ast-source-caption-submenu:hover \.ast-source-caption-list,/);
  assert.match(contentCss, /\.ast-translation-style-submenu:hover \.ast-translation-style-list \{/);
  assert.doesNotMatch(contentCss, /ast-source-caption-submenu:focus-within|ast-translation-style-submenu:focus-within/);
  assert.doesNotMatch(contentCss, /ast-source-caption-submenu\.open|ast-translation-style-submenu\.open/);
  assert.doesNotMatch(contentScript, /sourceCaptionMenuExpanded|translationStyleMenuExpanded/);
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

test("AST menu closes when an iframe parent relays an outside interaction", async () => {
  const { context, controls, runtimeMessageListeners, sentMessages } = createYoutubeHarness();
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
  assert.ok(
    sentMessages.some((message) => message.type === "ast.providerMenu.setOpen" && message.open === true),
    "expected an opened AST menu to notify its iframe parent"
  );

  for (const listener of runtimeMessageListeners) {
    listener({ type: "ast.providerMenu.setOpen", open: false });
  }

  assert.equal(menu.hidden, true);
  assert.equal(astButton.getAttribute("aria-expanded"), "false");
});

test("top-level frame relays outside clicks while an iframe AST menu is open", async () => {
  const { context, runtimeMessageListeners, sentMessages } = createYoutubeHarness();
  context.top = context;
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  for (const listener of runtimeMessageListeners) {
    listener({ type: "ast.providerMenu.setOpen", open: true });
  }
  context.document.dispatchCaptureEvent({
    type: "pointerdown",
    target: context.document.body,
    stopPropagation: () => {}
  });
  await flushPromises();

  assert.ok(
    sentMessages.some((message) => message.type === "ast.providerMenu.setOpen" && message.open === false),
    "expected the parent document to close the open iframe menu"
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
  assert.equal(harness.sentMessages.some((message) => message.type.includes("fetchTranscript")), true);
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
  await flushPromises();

  assert.ok(harness.sentMessages.some((message) => message.type === "settings.setActiveProvider"
    && message.providerId === "deepl"));
  const translationMessage = harness.sentMessages.findLast((message) => message.type === "translation.translateDocument");
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

test("switching back to a previously used LLM provider allows its successful translation cache", async () => {
  const harness = createYoutubeHarness({
    settings: {
      activeProvider: "google",
      providerTestStatus: {
        google: "success",
        deepl: "success"
      }
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const menu = harness.context.document.getElementById("ast-provider-menu");
  menu.children.find((item) => item.dataset.providerId === "deepl")
    .dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();

  menu.children.find((item) => item.dataset.providerId === "google")
    .dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();

  const finalRequests = harness.sentMessages.filter((message) => (
    message.type === "translation.translateDocument" && message.mode === "final"
  ));
  assert.deepEqual(
    finalRequests.map(({ providerId, forceNoCache }) => ({ providerId, forceNoCache })),
    [
      { providerId: "google", forceNoCache: false },
      { providerId: "deepl", forceNoCache: false },
      { providerId: "google", forceNoCache: false }
    ]
  );
});

test("changing an LLM translation style allows a successful cache for that style", async () => {
  const harness = createYoutubeHarness({
    settings: {
      activeProvider: "google",
      translationStyle: "natural",
      providerTestStatus: { google: "success" }
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);

  const menu = harness.context.document.getElementById("ast-provider-menu");
  const styleSubmenu = menu.children.find((item) => item.className === "ast-translation-style-submenu");
  styleSubmenu.children[1].children[2]
    .dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();

  const finalRequests = harness.sentMessages.filter((message) => (
    message.type === "translation.translateDocument" && message.mode === "final"
  ));
  assert.equal(finalRequests.length, 2);
  assert.equal(finalRequests[0].forceNoCache, false);
  assert.equal(finalRequests[1].providerId, "google");
  assert.equal(finalRequests[1].forceNoCache, false);
});

test("a cached LLM result replaces temporary subtitles and keeps the completed UI state", async () => {
  let resolveCachedFinal;
  const cachedFinalResponse = new Promise((resolve) => {
    resolveCachedFinal = resolve;
  });
  const pendingTemporaryResponse = new Promise(() => {});
  const harness = createYoutubeHarness({
    settings: {
      activeProvider: "google",
      providerTestStatus: { google: "success" }
    },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.fetchTranscript") {
        return { ok: true, document: transcriptDocument };
      }
      if (message.type === "translation.translateDocument" && message.mode === "temporary") {
        return pendingTemporaryResponse;
      }
      if (message.type === "translation.translateDocument" && message.mode === "final") {
        return cachedFinalResponse;
      }
      return { ok: true };
    }
  });
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);
  const overlay = harness.moviePlayer.querySelector("#ast-subtitle-overlay");
  const temporaryRequest = harness.sentMessages.find((message) => (
    message.type === "translation.translateDocument" && message.mode === "temporary"
  ));
  harness.runtimeMessageListeners[0]({
    type: "translation.progress",
    videoId: "abc123def45",
    mode: "temporary",
    requestId: temporaryRequest.requestId,
    progress: {
      cues: [{ id: "yt-0", start: 0, end: 5, text: "임시 번역" }]
    }
  });
  assert.equal(overlay.textContent, "임시 번역");
  assert.equal(button.classList.values.has("temporary"), true);

  resolveCachedFinal({
    ok: true,
    document: {
      platform: "youtube",
      videoId: "abc123def45",
      sourceLanguage: "en",
      providerId: "google",
      cacheHit: true,
      cues: [{ id: "yt-0", start: 0, end: 5, text: "캐시된 최종 번역" }]
    }
  });
  await flushPromises();

  assert.equal(overlay.textContent, "캐시된 최종 번역");
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(button.classList.values.has("complete"), true);
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");

  harness.runtimeMessageListeners[0]({
    type: "translation.progress",
    videoId: "abc123def45",
    mode: "temporary",
    requestId: temporaryRequest.requestId,
    progress: {
      cues: [{ id: "yt-0", start: 0, end: 5, text: "늦은 임시 번역" }]
    }
  });

  assert.equal(overlay.textContent, "캐시된 최종 번역");
  assert.equal(button.classList.values.has("complete"), true);
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

test("YouTube uses the player's captured caption body when extension requests return empty 200 and 403", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source" },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.fetchTranscript") {
        return { ok: false, error: "Transcript response is empty.; android player fallback failed: HTTP 403; transcript panel fallback failed: HTTP 403" };
      }
      if (message.type === "translation.translateDocument") return { ok: true, document: message.document || transcriptDocument };
      return { ok: true, tracks: [] };
    }
  });
  harness.context.astYoutubeCaptionCapture = {
    get: () => null,
    request: async ({ videoId }) => ({
      videoId, languageCode: "es", isAutoGenerated: true,
      text: JSON.stringify({ events: [{ tStartMs: 1250, dDurationMs: 2500, segs: [
        { utf8: "Hola" }, { utf8: " mundo", tOffsetMs: 1000 }
      ] }] })
    })
  };
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  harness.video.currentTime = 1.5;
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "Hola mundo");
  assert.equal(harness.video.astSubtitleCues[0].start, 1.25);
  assert.equal(harness.video.astSubtitleCues[0].end, 3.75);
  assert.equal(harness.video.astSubtitleCues[0].words[1].start, 2.25);
  assert.equal(harness.sentMessages.some((message) => message.type === "captions.youtube.fetchTranscript"), false);
});

test("YouTube ignores the previous video's embedded caption tracks after SPA navigation", async () => {
  const harness = createYoutubeHarness();
  harness.context.document.documentElement.innerHTML = `var ytInitialPlayerResponse = ${JSON.stringify({
    videoDetails: { videoId: "av5DnWZZHnk" },
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [{
      languageCode: "es", baseUrl: "https://www.youtube.com/api/timedtext?v=av5DnWZZHnk&lang=es"
    }] } }
  })};`;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  assert.equal(harness.context.getYoutubeCaptionTracksFromPage("abc123def45").length, 0);
});

test("a blocked translation request keeps source captions visible and reports the failure", async () => {
  const harness = createYoutubeHarness({
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.fetchTranscript") return { ok: true, document: transcriptDocument };
      if (message.type === "translation.translateDocument") return { ok: false, error: "Network request blocked" };
      return { ok: true };
    }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "Hello world");
  assert.equal(overlay.hidden, false);
  assert.match(harness.context.document.getElementById("ast-toast").textContent, /번역하지 못했습니다[\s\S]*Network request blocked/);
});

test("moving on to a video without captions clears the preparing message and the previous lines for good", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source" },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.fetchTranscript") {
        if (message.videoId === "zyx987wvu65") return { ok: false, error: "No YouTube captions are available for this video." };
        return { ok: true, document: transcriptDocument };
      }
      return { ok: true };
    }
  });
  const { context, moviePlayer, video } = harness;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), context);
  await flushPromises();
  await flushPromises();
  const overlay = moviePlayer.querySelector("#ast-subtitle-overlay");
  assert.equal(overlay.textContent, "Hello world");
  vm.runInNewContext(`subtitleState.youtubeProvidedTranslationLanguage = "ko";
    subtitleState.youtubeProvidedTranslationSource = "auto";`, context);

  // The same <video> plays the next one, as every Short does.
  Object.assign(context.location, { href: "https://www.youtube.com/watch?v=zyx987wvu65", search: "?v=zyx987wvu65" });
  harness.intervalCallbacks.at(-1)();
  await flushPromises();
  await flushPromises();
  assert.equal(vm.runInNewContext("getTranslationStatus().text", context), "이 영상에는 자막이 없습니다");
  assert.equal(overlay.hidden, true);

  // The player keeps playing: its next frames must not bring the message or the old lines back.
  for (const time of [0, 1, 3]) {
    video.currentTime = time;
    video.dispatchEvent({ type: "timeupdate" });
    assert.equal(overlay.hidden, true, `hidden at ${time}s`);
    assert.equal(overlay.textContent, "");
  }
  // Nor does the menu keep naming the previous video's YouTube translation.
  assert.equal(vm.runInNewContext("getDisplayedPhase()", context), "off");
});

test("coming back to a video without captions does not show the lines of the video watched in between", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source" },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.fetchTranscript") {
        if (message.videoId === "zyx987wvu65") return { ok: false, error: "No YouTube captions are available for this video." };
        return { ok: true, document: transcriptDocument };
      }
      return { ok: true };
    }
  });
  const { context, moviePlayer, video, sentMessages } = harness;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), context);
  await flushPromises();
  await flushPromises();
  const overlay = moviePlayer.querySelector("#ast-subtitle-overlay");
  const goTo = async (videoId) => {
    Object.assign(context.location, { href: `https://www.youtube.com/watch?v=${videoId}`, search: `?v=${videoId}` });
    harness.intervalCallbacks.at(-1)();
    await flushPromises();
    await flushPromises();
  };
  const fetches = (videoId) => sentMessages.filter((message) => message.type === "captions.youtube.fetchTranscript"
    && message.videoId === videoId).length;

  await goTo("zyx987wvu65");
  await goTo("abc123def45");
  video.dispatchEvent({ type: "timeupdate" });
  assert.equal(overlay.textContent, "Hello world");

  // Back on the captionless video (the same <video> plays it): not asked for again, and nothing shown.
  await goTo("zyx987wvu65");
  assert.equal(fetches("zyx987wvu65"), 1);
  for (const time of [0, 1, 3]) {
    video.currentTime = time;
    video.dispatchEvent({ type: "timeupdate" });
    assert.equal(overlay.hidden, true, `hidden at ${time}s`);
    assert.equal(overlay.textContent, "");
  }
  assert.equal(vm.runInNewContext("getTranslationStatus().text", context), "이 영상에는 자막이 없습니다");

  // The video with captions loads its lines again when visited once more.
  const before = fetches("abc123def45");
  await goTo("abc123def45");
  assert.equal(fetches("abc123def45"), before + 1);
  video.currentTime = 0;
  video.dispatchEvent({ type: "timeupdate" });
  assert.equal(overlay.textContent, "Hello world");
});

test("videos without captions keep AST on, say so in the status line only, and do not retry", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source" },
    sendMessage(message) {
      if (message.type === "captions.youtube.fetchTranscript") {
        if (message.videoId === "zyx987wvu65") {
          return { ok: true, document: {
            platform: "youtube", videoId: "zyx987wvu65", sourceLanguage: "en",
            cues: [{ id: "yt-0", start: 0, end: 2, text: "Next video" }]
          } };
        }
        return { ok: false, error: "No YouTube captions are available for this video." };
      }
      return { ok: true };
    }
  });
  const { context, controls, moviePlayer, sentMessages } = harness;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);
  await flushPromises();

  const overlay = moviePlayer.querySelector("#ast-subtitle-overlay");
  assert.equal(overlay.hidden, true, "nothing to show over the video");
  assert.equal(moviePlayer.querySelector("#ast-toast"), null, "no popup for a video without captions");
  assert.equal(button.getAttribute("aria-pressed"), "true", "translation stays on");
  assert.equal(button.classList.values.has("active"), false, "the icon shows its idle (white) look, not the active blue");
  assert.equal(button.classList.values.has("loading"), false);
  assert.equal(sentMessages.some((message) => message.type === "settings.setSubtitleEnabled" && message.enabled === false), false,
    "the saved on/off setting is not changed");
  assert.equal(vm.runInNewContext("getTranslationStatus().text", context), "이 영상에는 자막이 없습니다");

  // The periodic page check must not ask again for the same captionless video.
  const fetches = () => sentMessages.filter((message) => message.type === "captions.youtube.fetchTranscript").length;
  const before = fetches();
  for (let i = 0; i < 3; i += 1) {
    harness.intervalCallbacks.at(-1)();
    await flushPromises();
  }
  assert.equal(fetches(), before, "no retry for a video without captions");

  // The next video with captions is translated because AST was never turned off.
  context.location.href = "https://www.youtube.com/watch?v=zyx987wvu65";
  context.location.search = "?v=zyx987wvu65";
  harness.intervalCallbacks.at(-1)();
  await flushPromises();
  await flushPromises();
  assert.equal(overlay.hidden, false);
  assert.equal(overlay.textContent, "Next video");
  assert.equal(button.classList.values.has("active"), true, "the next video with captions shows AST active again");
  assert.notEqual(vm.runInNewContext("getTranslationStatus().text", context), "이 영상에는 자막이 없습니다");
});

test("a caption list that reports no captions ends the load without asking for a transcript", async () => {
  let playerRequests = 0;
  const harness = createYoutubeHarness({
    sendMessage(message) {
      if (message.type === "captions.youtube.listTracks") {
        return { ok: false, error: "No YouTube captions are available for this video." };
      }
      return { ok: true };
    }
  });
  harness.context.astYoutubeCaptionCapture = {
    listTracks: async () => [],
    get: () => null,
    request: async () => { playerRequests += 1; return null; }
  };
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();

  assert.equal(playerRequests, 0, "the player is not asked for a track that does not exist");
  assert.equal(harness.sentMessages.some((message) => message.type === "captions.youtube.fetchTranscript"), false);
  assert.equal(vm.runInNewContext("getTranslationStatus().text", harness.context), "이 영상에는 자막이 없습니다");
  assert.equal(harness.moviePlayer.querySelector("#ast-toast"), null);
});

test("async caption-list unavailable errors also clear the preparing state", async () => {
  const { context, controls, moviePlayer, video } = createYoutubeHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const button = controls.querySelector("#ast-toolbar-button");
  context.showOverlayMessage(video, "번역 자막 준비 중");
  context.setButtonState(true, true);

  const loaded = await context.loadPlatformSubtitleOverlay({
    platform: "ted",
    findVideo: () => video,
    async buildTranscriptRequest() {
      throw new Error("No TED captions are available for this video.");
    }
  });

  assert.equal(loaded, false);
  assert.equal(moviePlayer.querySelector("#ast-subtitle-overlay").hidden, true);
  assert.equal(moviePlayer.querySelector("#ast-toast"), null, "no popup for a video without captions");
  assert.equal(button.classList.values.has("loading"), false);
});

test("TED uses its player session key when applying a cached final translation", async () => {
  const harness = createYoutubeHarness();
  const manifestUrl = "https://hls.ted.com/project_masters/11819/manifest.m3u8";
  harness.context.location.hostname = "www.ted.com";
  harness.context.location.href = "https://www.ted.com/talks/test_talk";
  harness.context.location.pathname = "/talks/test_talk";
  harness.context.location.search = "";
  harness.context.performance = { getEntriesByType: () => [] };

  const nextData = new FakeElement("script");
  nextData.id = "__NEXT_DATA__";
  nextData.textContent = JSON.stringify({
    props: {
      pageProps: {
        videoData: {
          playerData: {
            id: 11819,
            slug: "test_talk",
            nativeLanguage: "en",
            resources: { hls: { stream: manifestUrl } }
          }
        }
      }
    }
  });
  harness.context.document.body.append(nextData);

  const source = readFileSync("extension/content/content-script.js", "utf8");
  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const sessionKey = `11819:${manifestUrl}`;
  assert.equal(harness.context.getCurrentSessionKey("ted"), sessionKey);
  assert.equal(harness.context.isCurrentSession("ted", sessionKey), true);
});

test("TED reads the next autoplay manifest from current-page structured data", async () => {
  const harness = createYoutubeHarness();
  const manifestUrl = "https://hls.ted.com/project_masters/11854/manifest.m3u8?intro_master_id=9294";
  harness.context.location.hostname = "www.ted.com";
  harness.context.location.href = "https://www.ted.com/talks/rob_bredow_the_artist_driven_innovation_behind_the_films_we_love";
  harness.context.location.pathname = "/talks/rob_bredow_the_artist_driven_innovation_behind_the_films_we_love";
  harness.context.location.search = "";
  harness.context.performance = { getEntriesByType: () => [] };

  const structuredData = new FakeElement("script");
  structuredData.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "VideoObject",
      "@id": `${harness.context.location.href}#video`,
      contentUrl: manifestUrl,
      inLanguage: "en"
    }]
  });
  const originalQuerySelectorAll = harness.context.document.querySelectorAll;
  harness.context.document.querySelectorAll = (selector) => selector === 'script[type="application/ld+json"]'
    ? [structuredData]
    : originalQuerySelectorAll(selector);

  const source = readFileSync("extension/content/content-script.js", "utf8");
  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  const playerContext = harness.context.getTedPlayerContext();
  assert.equal(playerContext.videoId, "rob_bredow_the_artist_driven_innovation_behind_the_films_we_love");
  assert.equal(playerContext.manifestUrl, manifestUrl);
  assert.equal(
    playerContext.sessionKey,
    `rob_bredow_the_artist_driven_innovation_behind_the_films_we_love:${manifestUrl}`
  );
});

test("TED autoplay clears the completed state while the next player context is loading", async () => {
  const harness = createYoutubeHarness();
  harness.context.location.hostname = "www.ted.com";
  harness.context.location.href = "https://www.ted.com/talks/next_talk";
  harness.context.location.pathname = "/talks/next_talk";
  harness.context.location.search = "";
  harness.context.performance = { getEntriesByType: () => [] };

  const source = readFileSync("extension/content/content-script.js", "utf8");
  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();
  vm.runInNewContext(`
    subtitleState.enabled = true;
    subtitleState.autoEnablePending = false;
    subtitleState.currentPlatform = "ted";
    subtitleState.currentRouteKey = "previous_talk";
    subtitleState.translationPhase = "complete";
  `, harness.context);

  harness.intervalCallbacks.at(-1)();
  await flushPromises();

  assert.equal(vm.runInNewContext("subtitleState.translationPhase", harness.context), "temporary");
  assert.equal(vm.runInNewContext("subtitleState.pendingRouteKey", harness.context), "next_talk");
});

test("TED waits for native player controls instead of showing a floating toolbar during ads", async () => {
  const harness = createYoutubeHarness();
  harness.context.location.hostname = "www.ted.com";
  harness.context.location.href = "https://www.ted.com/talks/test_talk";
  harness.context.location.pathname = "/talks/test_talk";
  harness.context.location.search = "";
  harness.context.performance = { getEntriesByType: () => [] };

  const source = readFileSync("extension/content/content-script.js", "utf8");
  vm.runInNewContext(source, harness.context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  assert.equal(
    harness.context.document.getElementById("ast-floating-toolbar"),
    null,
    "expected TED ads and player loading states not to show the floating fallback"
  );
  assert.equal(
    harness.context.document.getElementById("ast-toolbar-button"),
    null,
    "expected the AST button to wait until TED's native controls are available"
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

test("machine providers save LLM style choices without retranslating subtitles", async () => {
  const { context, controls, moviePlayer, sentMessages } = createYoutubeHarness();
  const source = readFileSync("extension/content/content-script.js", "utf8");

  vm.runInNewContext(source, context, { filename: "extension/content/content-script.js" });
  await flushPromises();

  await clickAstToggle(controls.querySelector("#ast-toolbar-button"));
  const translationCount = sentMessages
    .filter((message) => message.type === "translation.translateDocument").length;
  const menu = moviePlayer.querySelector("#ast-provider-menu");
  const styleSubmenu = menu.children.find((item) => item.className === "ast-translation-style-submenu");
  const technicalItem = styleSubmenu.children[1].children[2];

  technicalItem.dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();

  assert.ok(sentMessages.some((message) => (
    message.type === "settings.setTranslationStyle" && message.translationStyle === "technical"
  )));
  assert.equal(
    sentMessages.filter((message) => message.type === "translation.translateDocument").length,
    translationCount
  );
  const refreshedStyleSubmenu = menu.children.find((item) => item.className === "ast-translation-style-submenu");
  assert.equal(refreshedStyleSubmenu.children[0].children[0].textContent, "번역 스타일: Technical");
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

  // Subtitles start automatically; the invalidated context then disposes the script.
  await flushPromises();
  assert.ok(harness.sentMessages.some((message) => message.type === "captions.udemy.fetchTranscript"));

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
            captionTracks: [{ languageCode: "en", label: "English" }],
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
  // The fake box starts at a default size larger than the player; lay it out again at its real
  // size, as a page resize would.
  for (const listener of harness.windowListeners.resize || []) listener();

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
  assert.equal(large.overlay.style.maxWidth, "1536px");
  assert.equal(large.overlay.style.padding, "12px 21px");
  // The outline scales to 3px: a 2px stroke plus round shadow rings for the rest, so corners do not spike.
  assert.equal(large.overlay.style.webkitTextStroke, "2px #000000");
  assert.match(large.overlay.style.textShadow, /^1\.50px 0\.00px 0 #000000, /);
  assert.equal(large.overlay.style.paintOrder, "stroke fill");
  assert.equal(small.overlay.style.fontSize, "15px");
  assert.equal(small.overlay.style.maxWidth, "512px");
  assert.equal(small.overlay.style.padding, "4px 7px");
  assert.equal(small.overlay.style.webkitTextStroke, "1px #000000");
  assert.equal(small.overlay.style.paintOrder, "stroke fill");
});

test("a portrait player (a Short) sizes subtitles like the same player turned landscape", async () => {
  const portrait = await loadYoutubeOverlay({ playerRect: { width: 360, height: 640 } });
  // Measured by its narrow width alone this would shrink to the 0.35 floor (about 11px).
  assert.equal(portrait.overlay.style.fontSize, "15px");
  assert.equal(portrait.overlay.style.padding, "4px 7px");
  // The box still fits the narrow player.
  assert.ok(Number.parseFloat(portrait.overlay.style.maxWidth) <= 360);
});

test("thick subtitle outlines are drawn as round shadow rings instead of a wide mitered stroke", async () => {
  const { overlay } = await loadYoutubeOverlay({
    playerRect: { width: 1280, height: 720 },
    settings: { subtitleStyle: { outlineWidth: 16, outlineColor: "#112233", shadowEnabled: true, shadowDistance: 2, shadowBlur: 3, shadowColor: "#000000" } }
  });
  assert.equal(overlay.style.webkitTextStroke, "2px #112233");
  const shadows = overlay.style.textShadow.split(", ");
  assert.equal(shadows[0], "8.00px 0.00px 0 #112233");
  assert.equal(shadows.at(-1), "2px 2px 3px #000000");
  for (const shadow of shadows.slice(0, -1)) {
    const [x, y] = shadow.split(" ").map((value) => Number.parseFloat(value));
    assert.ok(Math.hypot(x, y) <= 8.01, shadow);
  }
  assert.ok(shadows.length < 200, `shadow count ${shadows.length}`);
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

  assert.equal(overlay.style.maxWidth, "250px");
  assert.equal(overlay.style.height, "auto");
  // Up to the player height minus the 12px margins; the position moves in rather than the box shrinking.
  assert.equal(overlay.style.maxHeight, "476px");
  assert.equal(overlay.style.overflowY, "auto");
  assert.equal(overlay.style.overflowX, "hidden");
});

test("final LLM progress switches subtitle background and toolbar icon to complete", async () => {
  const { controls, overlay, runtimeMessageListeners } = await loadYoutubeOverlay({
    settings: { activeProvider: "openai" },
    pendingFinalTranslation: true
  });
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

  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.8)");
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

  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
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
  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.8)");
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
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
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
  const harness = createYoutubeHarness({
    transcriptDocument,
    settings: { activeProvider: "openai" },
    pendingFinalTranslation: true
  });
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
  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.8)");

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
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
  assert.equal(overlay.textContent, "First final subtitle");

  video.currentTime = 6;
  video.dispatchEvent({ type: "timeupdate" });

  assert.equal(button.classList.values.has("current"), false);
  assert.equal(button.classList.values.has("temporary"), true);
  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.8)");
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
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
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
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
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
  const harness = createYoutubeHarness({
    transcriptDocument,
    settings: { activeProvider: "openai" },
    pendingFinalTranslation: true
  });
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
        cues: [{ id: "yt-0", start: 0, end: 5, text: "First final subtitle" }, { id: "yt-1", start: 5, end: 10, text: "Second final subtitle" }]
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

  const priorityMessage = harness.sentMessages.find((message) => message.type === "translation.setPriority");
  assert.equal(priorityMessage.currentTime, 11);
  assert.equal(priorityMessage.requestId, harness.sentMessages.find((message) => message.type === "translation.translateDocument" && message.mode === "final").requestId);

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
  const harness = createYoutubeHarness({
    transcriptDocument,
    settings: { activeProvider: "openai" },
    pendingFinalTranslation: true
  });
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
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
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
  const harness = createYoutubeHarness({
    transcriptDocument,
    settings: { activeProvider: "openai" },
    pendingFinalTranslation: true
  });
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
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");

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
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
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
  assert.equal(currentOverlay.style.background, "rgba(0, 0, 0, 0.8)");
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
  assert.equal(currentOverlay.style.background, "rgba(0, 0, 0, 0.8)");
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
  const harness = createYoutubeHarness({
    transcriptDocument,
    settings: { activeProvider: "openai" },
    pendingFinalTranslation: true
  });
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
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
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

test("late fallback progress cannot overwrite completed LLM subtitles or turn them red", async () => {
  const { context, controls, moviePlayer, overlay, runtimeMessageListeners } = await loadYoutubeOverlay();
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

  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
  assert.equal(button.classList.values.has("temporary"), false);
  assert.equal(button.classList.values.has("complete"), true);
  assert.equal(button.classList.values.has("fallback"), false);
  const toast = context.document.getElementById("ast-toast");
  assert.ok(toast, "expected every fallback to render a toast");
  assert.equal(toast.parentElement, moviePlayer);
  assert.match(toast.textContent, /번역하지 못해/);
  assert.match(toast.textContent, /Google Translate/);
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
  assert.match(toast.textContent, /일일 사용 한도 또는 잔액이 소진/);
  assert.match(toast.textContent, /Google Translate/);
});

test("final rate limit fallback progress shows a toast notification", async () => {
  const { context, moviePlayer, runtimeMessageListeners } = await loadYoutubeOverlay();

  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress",
      videoId: "abc123def45",
      mode: "final",
      progress: {
        fallbackProviderId: "googleTranslate",
        fallbackReason: "rate_limit_exceeded",
        fallbackMessage: "Too many requests. Falling back to Google Translate.",
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
  assert.ok(toast, "expected rate limit fallback toast to be rendered");
  assert.equal(toast.parentElement, moviePlayer);
  assert.equal(toast.classList.values.has("ast-toast-video"), true);
  assert.match(toast.textContent, /일시적인 요청 제한/);
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
  // The set width is wider, but the visible box is 200px for a short line; resizing starts from
  // what the viewer sees so the edge stays under the pointer.
  assert.ok(Number(overlay.dataset.maxWidth) > 200);

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

  // Dragging the right edge 80px out moves the left edge 80px too: the 200px box becomes 360px
  // and keeps its center. Afterwards it fits its text again within that width.
  assert.ok(Math.abs(parseFloat(overlay.style.maxWidth) - 360) <= 1, overlay.style.maxWidth);
  assert.equal(overlay.style.width, "max-content");
  assert.equal(overlay.style.left, "50%");
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

test("subtitle drag reaches the player edge using the box's visible width", async () => {
  const { overlay } = await loadYoutubeOverlay();
  // The set width is wider than the 200px the short line shows; the edge limit follows what is seen.
  assert.ok(Number(overlay.dataset.maxWidth) > 200);

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
    clientX: 1400,
    clientY: 320,
    preventDefault: () => {}
  });

  // Half the visible width (100px) plus the 12px margin on a 1000px player leaves 11.2% per side.
  assert.ok(Math.abs(parseFloat(overlay.style.left) - 88.8) < 0.05, overlay.style.left);
});

test("subtitle drag stops at the top and bottom edges instead of shrinking into a scrollbar", async () => {
  const { overlay } = await loadYoutubeOverlay();
  const fullMaxHeight = overlay.style.maxHeight;

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
    clientX: 420,
    clientY: 5000,
    preventDefault: () => {}
  });
  const bottom = parseFloat(overlay.style.top);
  overlay.dispatchEvent({
    type: "pointermove",
    pointerId: 1,
    clientX: 420,
    clientY: -5000,
    preventDefault: () => {}
  });
  const top = parseFloat(overlay.style.top);

  // The 80px box stays 40px + 12px margin away from each edge, and keeps its full height limit.
  assert.ok(bottom < 100 && top > 0, `${top} ${bottom}`);
  assert.ok(Math.abs((100 - bottom) - top) < 0.05, `${top} ${bottom}`);
  assert.equal(overlay.style.maxHeight, fullMaxHeight);
  // The stored position is the clamped one, so dragging back moves the box at once.
  assert.equal(overlay.style.top, `${top}%`);
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

  const menu = findById(controls.parentElement, "ast-provider-menu");
  menu.children.find((item) => item.className.includes("ast-provider-toggle-item"))
    .dispatchEvent({ type: "click", stopPropagation() {}, preventDefault() {} });
  await flushPromises();

  assert.equal(overlay.dataset.disabled, "true");
  assert.equal(overlay.hidden, true);
});


test("AST translation language selection persists, cancels old work, and restarts machine translation", async () => {
  const { context, controls, moviePlayer, sentMessages } = createYoutubeHarness({
    settings: {
      targetLanguage: "ko",
      targetLanguages: [{ code: "ko", label: "한국어" }, { code: "ja", label: "日本語" }]
    }
  });
  context.document.documentElement.innerHTML = '<script>var ytInitialPlayerResponse = ' + JSON.stringify({
    captions: { playerCaptionsTracklistRenderer: { captionTracks: [{
      baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en",
      languageCode: "en", name: { simpleText: "English" }
    }] } }
  }) + ';</script>';
  const source = readFileSync("extension/content/content-script.js", "utf8");
  vm.runInNewContext(source, context, { filename: "extension/content/content-script.js" });
  await flushPromises();
  await clickAstToggle(controls.querySelector("#ast-toolbar-button"));
  const menu = moviePlayer.querySelector("#ast-provider-menu");
  const languageMenu = menu.children.find((item) => item.className === "ast-target-language-submenu");
  const sourceIndex = menu.children.findIndex((item) => item.className === "ast-source-caption-submenu");
  assert.equal(menu.children[sourceIndex + 1], languageMenu);
  assert.equal(menu.children[sourceIndex + 2].className, "ast-translation-style-submenu");
  assert.equal(languageMenu.children[0].children[0].textContent, "목표 언어: 한국어");
  const count = sentMessages.filter((message) => message.type === "translation.translateDocument").length;
  languageMenu.children[1].children[1].dispatchEvent({ type: "click", stopPropagation: () => {} });
  await flushPromises();
  assert.ok(sentMessages.some((message) => message.type === "settings.setTargetLanguage" && message.targetLanguage === "ja"));
  assert.ok(sentMessages.some((message) => message.type === "translation.cancelRequest"));
  assert.equal(sentMessages.filter((message) => message.type === "translation.translateDocument").length, count + 1);
  assert.equal(vm.runInNewContext("subtitleState.targetLanguage", context), "ja");
  const refreshed = menu.children.find((item) => item.className === "ast-target-language-submenu");
  assert.equal(refreshed.children[1].children[1].getAttribute("aria-checked"), "true");
});


test("AST menu can turn off during caption loading and ignores the late caption response", async () => {
  let resolveCaptions;
  const pendingCaptions = new Promise((resolve) => { resolveCaptions = resolve; });
  const { context, controls, moviePlayer, sentMessages } = createYoutubeHarness({
    sendMessage: async (message) => message.type === "captions.youtube.fetchTranscript" ? pendingCaptions : { ok: true }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), context);
  await flushPromises();
  await clickAstToggle(controls.querySelector("#ast-toolbar-button"));
  assert.equal(vm.runInNewContext("subtitleState.loading", context), true);
  const menu = moviePlayer.querySelector("#ast-provider-menu");
  const toggle = menu.children.find((item) => item.className === "ast-provider-toggle-item").children[0];
  toggle.dispatchEvent({ type: "click", stopPropagation: () => {} });
  assert.equal(vm.runInNewContext("subtitleState.enabled", context), false);
  assert.equal(vm.runInNewContext("subtitleState.loading", context), false);
  const overlay = context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.hidden, true);
  resolveCaptions({ ok: true, document: {
    platform: "youtube", videoId: "abc123def45", sourceLanguage: "en",
    cues: [{ id: "late", start: 0, end: 5, text: "Late caption" }]
  } });
  await flushPromises();
  assert.equal(overlay.hidden, true);
  assert.equal(vm.runInNewContext("subtitleState.translationPhase", context), "off");
  assert.equal(sentMessages.filter((message) => message.type === "translation.translateDocument").length, 0);
});

test("AST menu immediately cancels translation when turned off and resumes on enabling", async () => {
  const { context, controls, moviePlayer, sentMessages } = createYoutubeHarness({
    pendingFinalTranslation: true,
    settings: { activeProvider: "openrouter" }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), context);
  await flushPromises();
  await clickAstToggle(controls.querySelector("#ast-toolbar-button"));
  const activeId = vm.runInNewContext("subtitleState.activeFinalRequestId", context);
  assert.ok(activeId);
  const menu = moviePlayer.querySelector("#ast-provider-menu");
  const clickToggle = () => menu.children.find((item) => item.className === "ast-provider-toggle-item").children[0]
    .dispatchEvent({ type: "click", stopPropagation: () => {} });
  clickToggle();
  assert.equal(vm.runInNewContext("subtitleState.enabled", context), false);
  assert.equal(context.document.getElementById("ast-subtitle-overlay").hidden, true);
  assert.ok(sentMessages.some((message) => message.type === "translation.cancelRequest" && message.requestId === activeId));
  await flushPromises();
  clickToggle();
  await flushPromises();
  assert.equal(vm.runInNewContext("subtitleState.enabled", context), true);
  const newId = vm.runInNewContext("subtitleState.activeFinalRequestId", context);
  assert.ok(newId);
  assert.notEqual(newId, activeId);
});


test("YouTube page panel fallback rejects Korean subtitles for an English source selection", async () => {
  const { context } = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), context);
  await flushPromises();
  vm.runInNewContext(`
    const panelTracks = [{ languageCode: "en", label: "English" }, { languageCode: "ko", label: "한국어" }];
    const koreanPanel = { languageMenu: { sortFilterSubMenuRenderer: { subMenuItems: [{ title: "한국어", selected: true }] } } };
  `, context);
  assert.throws(() => vm.runInNewContext('assertYoutubeTranscriptPanelLanguageOnPage(koreanPanel, "en", panelTracks)', context), /Could not verify/);
  assert.throws(() => vm.runInNewContext('assertYoutubeTranscriptPanelLanguageOnPage({}, "en", panelTracks)', context), /Could not verify/);
});


test("alignment fallback finishes without scheduling repeated full-video translation", async () => {
  const { context, overlay, runtimeMessageListeners } = await loadYoutubeOverlay({ pendingFinalTranslation: true });
  for (const listener of runtimeMessageListeners) {
    listener({
      type: "translation.progress", videoId: "abc123def45", mode: "final",
      progress: {
        fallbackProviderId: "googleTranslate", fallbackReason: "alignment_failed",
        isComplete: true, chunkIndex: 0, chunkCount: 1,
        cues: [{ id: "yt-0", start: 0, end: 5, text: "정렬 실패 구간 대체 번역" }]
      }
    });
  }
  assert.equal(overlay.textContent, "정렬 실패 구간 대체 번역");
  assert.equal(vm.runInNewContext("subtitleState.translationPhase", context), "complete");
  assert.equal(context.document.getElementById("ast-toolbar-button").classList.values.has("fallback"), false);
  assert.match(context.document.getElementById("ast-toolbar-button").title, /翻訳|번역 완료/);
  assert.match(context.document.getElementById("ast-toolbar-button").title, /^번역 완료 · 1줄 Google 번역$/);
  assert.notEqual(overlay.style.background, "rgba(117, 0, 0, 0.8)");
  assert.equal(vm.runInNewContext("subtitleState.fallbackRetryTimeoutId", context), null);
  assert.equal(vm.runInNewContext("subtitleState.fallbackRetryPending", context), false);
});


test("completed document with an alignment fallback uses completion colors and a truthful tooltip", async () => {
  const { context, controls } = createYoutubeHarness({
    sendMessage: async (message, { transcriptDocument }) => {
      if (message.type === "captions.youtube.fetchTranscript") return { ok: true, document: transcriptDocument };
      if (message.type === "translation.translateDocument") return { ok: true, document: {
        ...transcriptDocument, fallbackProviderId: "googleTranslate", fallbackReason: "alignment_failed",
        cues: transcriptDocument.cues.map((cue) => ({ ...cue, text: "완료된 대체 번역" }))
      } };
      return { ok: true };
    }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), context);
  await flushPromises();
  await clickAstToggle(controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  const button = controls.querySelector("#ast-toolbar-button");
  assert.equal(button.classList.values.has("complete"), true);
  assert.equal(button.classList.values.has("fallback"), false);
  assert.match(button.title, /^번역 완료 · \d+줄 Google 번역$/);
  assert.equal(vm.runInNewContext("subtitleState.fallbackRetryTimeoutId", context), null);
  assert.notEqual(context.document.getElementById("ast-subtitle-overlay").style.background, "rgba(117, 0, 0, 0.8)");
  assert.match(context.document.getElementById("ast-toast").textContent, /일부 구간/);
});

test("later LLM progress keeps the completion notice about an earlier fallback range", async () => {
  const harness = createYoutubeHarness({ pendingFinalTranslation: true, transcriptDocument: {
    platform: "youtube", videoId: "abc123def45", sourceLanguage: "en",
    cues: [{ id: "yt-0", start: 0, end: 5, text: "First" }, { id: "yt-1", start: 5, end: 10, text: "Second" }]
  } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  const notify = (progress) => harness.runtimeMessageListeners.forEach((listener) => listener({
    type: "translation.progress", videoId: "abc123def45", mode: "final", progress
  }));
  notify({ fallbackProviderId: "googleTranslate", fallbackReason: "alignment_failed", isComplete: false,
    chunkIndex: 0, chunkCount: 2, cues: [{ id: "yt-0", start: 0, end: 5, text: "대체 번역" }] });
  assert.notEqual(vm.runInNewContext("subtitleState.translationPhase", harness.context), "fallback");
  notify({ isComplete: true, chunkIndex: 1, chunkCount: 2, cues: [{ id: "yt-1", start: 5, end: 10, text: "LLM 번역" }] });
  assert.equal(vm.runInNewContext("subtitleState.translationPhase", harness.context), "complete");
  assert.equal(harness.controls.querySelector("#ast-toolbar-button").title, "번역 완료 · 1줄 Google 번역");
});


test("subtitle resize reaches the player width minus 12px margins and survives style refresh", async () => {
  const { context, overlay, sentMessages } = await loadYoutubeOverlay({ playerRect: { width: 3440, height: 720 } });
  const event = (type, clientX) => ({ type, clientX, clientY: 312, button: 0, pointerId: 1,
    preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} });
  overlay.dispatchEvent(event("pointerdown", 596));
  overlay.dispatchEvent(event("pointermove", 5000));
  overlay.dispatchEvent(event("pointerup", 5000));
  await flushPromises();
  assert.equal(overlay.style.maxWidth, "3416px");
  assert.equal(overlay.style.left, "50%");
  const save = sentMessages.filter((message) => message.type === "settings.updateSubtitleStyle").at(-1);
  assert.equal(save.patch.width, 3416);
  vm.runInNewContext('applyOverlayStyle(document.getElementById("ast-subtitle-overlay"))', context);
  assert.equal(overlay.style.maxWidth, "3416px");
  assert.equal(overlay.style.maxWidth, "3416px");
});

test("saved wide subtitles fit a smaller player while keeping side margins", async () => {
  const { overlay, windowListeners } = await loadYoutubeOverlay({ playerRect: { width: 640, height: 360 },
    settings: { subtitleStyle: { width: 3416, positionX: 80 } } });
  // A long line fills the whole capped width, leaving no room to sit off-center.
  overlay.setRect({ left: 12, top: 240, width: 616, height: 80 });
  for (const listener of windowListeners.resize || []) listener();
  assert.equal(overlay.style.width, "max-content");
  assert.equal(overlay.style.maxWidth, "616px");
  assert.equal(overlay.style.left, "50%");
});


test("retry only targets fallback cues, preserves subtitles on failure, and stops after recovery", async () => {
  let calls = 0;
  const doc = { platform: "youtube", videoId: "abc123def45", sourceLanguage: "en", cues: [
    { id: "yt-0", start: 0, end: 5, text: "First" }, { id: "yt-1", start: 5, end: 10, text: "Second" }
  ] };
  const h = createYoutubeHarness({ transcriptDocument: doc, settings: { activeProvider: "openai" },
    sendMessage: async (message) => {
      if (message.type === "captions.youtube.fetchTranscript") return { ok: true, document: doc };
      if (message.type !== "translation.translateDocument") return { ok: true };
      if (message.mode === "temporary") return { ok: true, document: doc };
      calls += 1;
      if (calls === 1) return { ok: true, document: { ...doc, fallbackProviderId: "googleTranslate", fallbackReason: "rate_limit_exceeded", fallbackCueIds: ["yt-1"],
        cues: doc.cues.map((cue) => ({ ...cue, text: cue.id === "yt-0" ? "완료 LLM 번역" : "기존 대체 번역" })) } };
      assert.equal(message.allowFallback, false);
      assert.deepEqual(Array.from(message.document.cues, (cue) => cue.id), ["yt-1"]);
      if (calls === 2) return { ok: false, error: "429 Too Many Requests" };
      return { ok: true, document: { ...doc, cues: [{ ...doc.cues[1], text: "복구된 LLM 번역" }] } };
    }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  await clickAstToggle(h.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  const fireRetry = async () => {
    const id = vm.runInNewContext("subtitleState.fallbackRetryTimeoutId", h.context);
    const timer = h.timeoutCallbacks.find((timer) => timer.id === id);
    assert.equal(timer.delay, 10000);
    timer.cleared = true;
    timer.callback();
    await flushPromises();
  };
  const before = vm.runInNewContext("JSON.stringify(subtitleState.currentVideo.astSubtitleCues)", h.context);
  await fireRetry();
  assert.equal(vm.runInNewContext("JSON.stringify(subtitleState.currentVideo.astSubtitleCues)", h.context), before);
  assert.equal(h.controls.querySelector("#ast-toolbar-button").classList.values.has("fallback"), false);
  await fireRetry();
  assert.equal(calls, 3);
  assert.equal(vm.runInNewContext("subtitleState.fallbackCueIds.size", h.context), 0);
  assert.equal(vm.runInNewContext("subtitleState.fallbackRetryTimeoutId", h.context), null);
  assert.equal(vm.runInNewContext("subtitleState.currentVideo.astSubtitleCues[0].text", h.context), "완료 LLM 번역");
  assert.equal(vm.runInNewContext("subtitleState.currentVideo.astSubtitleCues[1].text", h.context), "복구된 LLM 번역");
  h.runTimeouts();
  await flushPromises();
  assert.equal(calls, 3);
});


test("persistent retry errors stop after five attempts while keeping the displayed translation", async () => {
  let calls = 0;
  const h = createYoutubeHarness({ settings: { activeProvider: "openai" }, sendMessage: async (message, { transcriptDocument }) => {
    if (message.type === "captions.youtube.fetchTranscript") return { ok: true, document: transcriptDocument };
    if (message.type !== "translation.translateDocument" || message.mode === "temporary") return { ok: true, document: transcriptDocument };
    calls += 1;
    if (calls > 1) return { ok: false, error: "503 unavailable" };
    return { ok: true, document: { ...transcriptDocument, fallbackProviderId: "googleTranslate", fallbackReason: "provider_error", cues: transcriptDocument.cues.map((cue) => ({ ...cue, text: "유지할 번역" })) } };
  } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises(); await clickAstToggle(h.controls.querySelector("#ast-toolbar-button")); await flushPromises();
  for (let index = 0; index < 5; index += 1) {
    const id = vm.runInNewContext("subtitleState.fallbackRetryTimeoutId", h.context);
    const timer = h.timeoutCallbacks.find((item) => item.id === id);
    assert.ok(timer); timer.cleared = true; timer.callback(); await flushPromises();
  }
  assert.equal(calls, 6);
  assert.equal(vm.runInNewContext("subtitleState.fallbackRetryTimeoutId", h.context), null);
  assert.equal(h.context.document.getElementById("ast-subtitle-overlay").textContent, "유지할 번역");
});


test("translation errors separate HTTP status, quota fields, URLs, and retry guidance", async () => {
  const { context } = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), context);
  const result = vm.runInNewContext('formatTranslationError("HTTP 429: Quota exceeded * Quota exceeded for metric: free_tier_requests, limit: 500, model: gemini-3.1-flash-lite, description: Requests per day. See https://example.com/limits. Please retry in 15h35m23.648s.")', context);
  assert.match(result, /HTTP 429\nQuota exceeded/);
  assert.match(result, /\nlimit: 500\nmodel: gemini-3.1-flash-lite/);
  assert.match(result, /\n\nPlease retry/);
  assert.match(result, /\nhttps:\/\/example.com/);
});

test("exhausted daily allowance preserves fallback subtitles without scheduling retries", async () => {
  const h = createYoutubeHarness({ settings: { activeProvider: "openai" }, sendMessage: async (message, { transcriptDocument }) => {
    if (message.type === "captions.youtube.fetchTranscript") return { ok: true, document: transcriptDocument };
    if (message.type !== "translation.translateDocument" || message.mode === "temporary") return { ok: true, document: transcriptDocument };
    return { ok: true, document: { ...transcriptDocument, fallbackProviderId: "googleTranslate", fallbackReason: "quota_exceeded",
      cues: transcriptDocument.cues.map((cue) => ({ ...cue, text: "유지할 대체 번역" })) } };
  } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises(); await clickAstToggle(h.controls.querySelector("#ast-toolbar-button")); await flushPromises();
  assert.equal(vm.runInNewContext("subtitleState.fallbackRetryBlocked", h.context), true);
  assert.equal(vm.runInNewContext("subtitleState.fallbackRetryTimeoutId", h.context), null);
  assert.equal(h.context.document.getElementById("ast-subtitle-overlay").textContent, "유지할 대체 번역");
});

test("fallback retries wait for the server delay and ambiguous restrictions do not claim exhaustion", async () => {
  const h = createYoutubeHarness({ settings: { activeProvider: "openai" }, sendMessage: async (message, { transcriptDocument }) => {
    if (message.type === "captions.youtube.fetchTranscript") return { ok: true, document: transcriptDocument };
    if (message.type !== "translation.translateDocument" || message.mode === "temporary") return { ok: true, document: transcriptDocument };
    return { ok: true, document: { ...transcriptDocument, fallbackProviderId: "googleTranslate", fallbackReason: "request_restricted",
      fallbackRetryAfterMs: 60000, cues: transcriptDocument.cues } };
  } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises(); await clickAstToggle(h.controls.querySelector("#ast-toolbar-button")); await flushPromises();
  const timerId = vm.runInNewContext("subtitleState.fallbackRetryTimeoutId", h.context);
  const timer = h.timeoutCallbacks.find((item) => item.id === timerId);
  assert.ok(timer.delay > 55000 && timer.delay <= 60000);
  assert.equal(vm.runInNewContext("subtitleState.fallbackRetryBlocked", h.context), false);
  assert.match(h.context.document.getElementById("ast-toast").textContent, /소진 여부를 확인할 수 없습니다/);
});


test("toolbar popup toggle updates an open video's subtitles without echoing a settings write", async () => {
  const h = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  await flushPromises();
  const button = h.controls.querySelector("#ast-toolbar-button");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  for (const listener of h.runtimeMessageListeners) listener({ type: "subtitles.setEnabled", enabled: false });
  await flushPromises();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  for (const callback of h.intervalCallbacks) callback();
  await flushPromises();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  for (const listener of h.runtimeMessageListeners) listener({ type: "subtitles.setEnabled", enabled: true });
  await flushPromises();
  await flushPromises();
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(h.sentMessages.some((message) => message.type === "settings.setSubtitleEnabled"), false);
});


test("presented video frame uses its displayed cue for translation background", async () => {
  const transcriptDocument = { platform: "youtube", videoId: "abc123def45", sourceLanguage: "en", cues: [
    { id: "a", start: 0, end: 3, text: "First" },
    { id: "b", start: 3, end: 6, text: "Second" },
    { id: "c", start: 6, end: 9, text: "Third" }
  ] };
  const h = createYoutubeHarness({ transcriptDocument, pendingFinalTranslation: true });
  let frame;
  h.video.requestVideoFrameCallback = (callback) => { frame = callback; return 1; };
  h.video.paused = false;
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  await flushPromises();
  await flushPromises();
  h.context.applyTranslatedCues(h.video, [{ id: "b", text: "번역됨" }]);
  vm.runInNewContext('subtitleState.finalTranslatedCueIds.add("b"); subtitleState.translationPhase = "temporary";', h.context);
  h.video.currentTime = 2.99;
  frame(1, { mediaTime: 3.01 });
  const overlay = h.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "번역됨");
  assert.equal(overlay.style.background, "rgba(0, 0, 0, 0.8)");
  assert.equal(vm.runInNewContext("subtitleState.translationPhase", h.context), "current");
  h.video.currentTime = 5.99;
  frame(2, { mediaTime: 6.01 });
  assert.equal(overlay.textContent, "Third");
  assert.equal(overlay.style.background, "rgba(117, 0, 0, 0.8)");
  assert.equal(vm.runInNewContext("subtitleState.translationPhase", h.context), "temporary");
});


test("an OFF update wins over an earlier in-flight startup preference read", async () => {
  let resolvePreference;
  const h = createYoutubeHarness({ getSubtitleEnabled: () => new Promise((resolve) => { resolvePreference = resolve; }) });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  h.runtimeMessageListeners.forEach((listener) => listener({ type: "subtitles.setEnabled", enabled: false }));
  resolvePreference({ ok: true, enabled: true });
  await flushPromises();
  await flushPromises();
  h.intervalCallbacks.forEach((callback) => callback());
  await flushPromises();
  assert.equal(h.controls.querySelector("#ast-toolbar-button").getAttribute("aria-pressed"), "false");
  assert.equal(h.sentMessages.some((message) => message.type === "translation.translateDocument"), false);
});

test("a failed startup preference read does not start translation", async () => {
  const h = createYoutubeHarness({ getSubtitleEnabled: () => ({ ok: false, error: "storage unavailable" }) });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  await flushPromises();
  h.intervalCallbacks.forEach((callback) => callback());
  await flushPromises();
  assert.equal(h.sentMessages.some((message) => message.type === "translation.translateDocument"), false);
});

test("an OFF update applies even after the platform was disabled in settings", async () => {
  const platforms = { youtube: true, udemy: true };
  const h = createYoutubeHarness({ settings: { platforms } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  await flushPromises();
  const button = h.controls.querySelector("#ast-toolbar-button");
  assert.equal(button.getAttribute("aria-pressed"), "true");

  platforms.youtube = false;
  h.runtimeMessageListeners.forEach((listener) => listener({ type: "subtitles.setEnabled", enabled: false }));
  await flushPromises();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(vm.runInNewContext("subtitleState.enabled", h.context), false);
});

test("translation requests keep one lifecycle connection so a page reload stops them", async () => {
  const h = createYoutubeHarness({ pendingFinalTranslation: true });
  const ports = [];
  h.context.chrome.runtime.connect = ({ name }) => {
    const disconnectListeners = [];
    const port = { name, onDisconnect: { addListener: (listener) => disconnectListeners.push(listener) },
      fireDisconnect: () => disconnectListeners.forEach((listener) => listener()) };
    ports.push(port);
    return port;
  };
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  await flushPromises();
  await flushPromises();
  await flushPromises();
  assert.ok(h.sentMessages.some((message) => message.type === "translation.translateDocument"));
  assert.deepEqual(ports.map((port) => port.name), ["ast.translation.lifecycle"]);

  const document = '{ platform: "youtube", videoId: "abc123def45", sourceLanguage: "en", cues: [{ id: "0", start: 0, end: 1, text: "Hi" }] }';
  void vm.runInNewContext(`translateDocument(${document}, { mode: "temporary", requestId: "again" })`, h.context);
  assert.equal(ports.length, 1);

  // A restarted service worker drops the old connection; the next request opens a new one.
  ports[0].fireDisconnect();
  void vm.runInNewContext(`translateDocument(${document}, { mode: "temporary", requestId: "after-restart" })`, h.context);
  assert.equal(ports.length, 2);
});

test("translation requests are not sent while subtitles are OFF", async () => {
  const h = createYoutubeHarness({ subtitlePreference: { enabled: false } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  await flushPromises();
  assert.equal(vm.runInNewContext("subtitleState.enabled", h.context), false);

  const result = await vm.runInNewContext(
    'translateDocument({ platform: "youtube", videoId: "abc123def45", sourceLanguage: "en", cues: [{ id: "0", start: 0, end: 1, text: "Hi" }] }, { requestId: "late" })',
    h.context
  );
  assert.equal(result, null);
  assert.equal(h.sentMessages.some((message) => message.type === "translation.translateDocument"), false);
});

test("the popup toggle uses the NVIDIA platform resolved for an embedded Vimeo player", async () => {
  const h = createYoutubeHarness({
    subtitlePreference: { enabled: false },
    settings: { platforms: { nvidia: true, vimeo: false } },
    sendMessage: (message) => message.type === "platform.vimeo.getContext"
      ? { ok: true, platform: "nvidia" }
      : { ok: false, error: "not needed" }
  });
  h.context.location = {
    hostname: "player.vimeo.com",
    href: "https://player.vimeo.com/video/123456789",
    pathname: "/video/123456789",
    search: ""
  };
  const querySelector = h.context.document.querySelector;
  h.context.document.querySelector = (selector) => selector === "video" ? h.video : querySelector(selector);
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), h.context);
  await flushPromises();
  await flushPromises();
  assert.equal(vm.runInNewContext("subtitleState.subtitleLoadGeneration", h.context), 0);

  h.runtimeMessageListeners.forEach((listener) => listener({ type: "subtitles.setEnabled", enabled: true }));
  await flushPromises();
  await flushPromises();
  assert.ok(vm.runInNewContext("subtitleState.subtitleLoadGeneration", h.context) > 0, "NVIDIA player did not start");
});

function createHumanCaptionHarness({ settings = {}, targetCaption } = {}) {
  const harness = createYoutubeHarness({
    settings: { targetLanguage: "ko", targetLanguages: [{ code: "ko", label: "한국어" }], ...settings },
    transcriptDocument: {
      platform: "youtube",
      videoId: "abc123def45",
      sourceLanguage: "en",
      cues: [
        { id: "yt-0", start: 0, end: 2, text: "Hello" },
        { id: "yt-1", start: 2, end: 4, text: "world" }
      ]
    }
  });
  const targetRequests = [];
  harness.context.astYoutubeCaptionCapture = {
    get: () => null,
    request: async () => null,
    requestTarget: async (request) => {
      targetRequests.push(request);
      return targetCaption === undefined ? {
        videoId: "abc123def45",
        languageCode: "ko",
        source: "human",
        text: JSON.stringify({ events: [
          { tStartMs: 0, dDurationMs: 1900, segs: [{ utf8: "안녕하세요" }] },
          { tStartMs: 2100, dDurationMs: 1800, segs: [{ utf8: "세상" }] }
        ] })
      } : targetCaption;
    }
  };
  return { harness, targetRequests };
}

test("YouTube human captions in the target language replace translation requests", async () => {
  const { harness, targetRequests } = createHumanCaptionHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  await flushPromises();

  assert.deepEqual(JSON.parse(JSON.stringify(targetRequests)), [{
    videoId: "abc123def45", targetLanguage: "ko", sourceLanguage: "en", sourceIsAutoGenerated: false
  }]);
  assert.deepEqual(harness.video.astSubtitleCues.map((cue) => [cue.id, cue.start, cue.end, cue.text]), [
    ["yt-0", 0, 2, "안녕하세요"],
    ["yt-1", 2, 4, "세상"]
  ]);
  assert.equal(vm.runInNewContext("subtitleState.translationPhase", harness.context), "complete");
  assert.equal(harness.sentMessages.some((message) => message.type === "translation.translateDocument"), false);
  // Using YouTube's own captions is the normal path, so it shows no notice.
  assert.equal(harness.moviePlayer.querySelector("#ast-toast"), null);
  // The switch shows on/off by itself; which captions are in use is told by the status line only.
  vm.runInNewContext('ensureProviderMenu("youtube"); renderProviderMenu("youtube")', harness.context);
  const toggle = harness.context.document.getElementById("ast-provider-menu").querySelector(".ast-youtube-provided-toggle");
  assert.equal(toggle.children[0].textContent, "YouTube 제공 자막 우선");
});

test("captions already in the target language are shown as is instead of being sent to the LLM", async () => {
  const harness = createYoutubeHarness({
    settings: { targetLanguage: "ko", targetLanguages: [{ code: "ko", label: "한국어" }], subtitleDisplayMode: "dual" },
    transcriptDocument: {
      platform: "youtube",
      videoId: "abc123def45",
      sourceLanguage: "ko",
      cues: [
        { id: "yt-0", start: 0, end: 2, text: "안녕하세요" },
        { id: "yt-1", start: 2, end: 4, text: "세상" }
      ]
    }
  });
  const targetRequests = [];
  harness.context.astYoutubeCaptionCapture = {
    get: () => null,
    request: async () => null,
    requestTarget: async (request) => { targetRequests.push(request); return null; }
  };
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  await flushPromises();

  const translateRequests = () => harness.sentMessages.filter((message) => message.type === "translation.translateDocument");
  assert.equal(translateRequests().length, 0, "nothing goes to the LLM while YouTube-provided captions are preferred");
  assert.equal(targetRequests.length, 0, "the source captions already are the target language");
  assert.equal(vm.runInNewContext("getTranslationStatus().text", harness.context), "YouTube 한국어 자막 사용 중");
  assert.equal(vm.runInNewContext("getDisplayedPhase()", harness.context), "youtube-provided");
  // The same sentence is not shown twice in the dual display.
  assert.equal(harness.context.document.getElementById("ast-subtitle-overlay").textContent, "안녕하세요");

  // The retranslate button still asks the LLM.
  await vm.runInNewContext('retranslateCurrentVideo("youtube")', harness.context);
  await flushPromises();
  assert.ok(translateRequests().length > 0);
});

async function renderTranslationStyleLabel(targetCaption) {
  const { harness } = createHumanCaptionHarness({ targetCaption });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  await flushPromises();
  vm.runInNewContext('ensureProviderMenu("youtube"); renderProviderMenu("youtube")', harness.context);
  const menu = harness.context.document.getElementById("ast-provider-menu");
  const label = menu.querySelector(".ast-translation-style-toggle").children[0];
  // The YouTube wording is its own span after the "Translation style: " prefix.
  const provided = [...label.children].find((child) => child.className === "ast-translation-style-provided");
  return {
    label: provided?.textContent ?? label.textContent,
    provided: Boolean(provided),
    phase: vm.runInNewContext("getDisplayedPhase()", harness.context),
    buttonClasses: [...harness.controls.querySelector("#ast-toolbar-button").classList.values].join(" ")
  };
}

test("YouTube human captions show YouTube captions instead of a translation style", async () => {
  // No translation style of ours applies to YouTube's own captions, so the style name must not show.
  const shown = await renderTranslationStyleLabel(undefined);
  assert.equal(shown.provided, true, "the style value is replaced by YouTube wording");
  assert.equal(shown.label, "YouTube 자막");
  assert.equal(shown.phase, "youtube-provided");
  assert.match(shown.buttonClasses, /\byoutube-provided\b/);
});

test("YouTube auto-translation keeps its own translation style wording", async () => {
  const shown = await renderTranslationStyleLabel(autoTranslation(["안녕", "세상"]));
  assert.equal(shown.provided, true);
  assert.equal(shown.label, "YouTube 자동 번역");
  assert.equal(shown.phase, "youtube-provided");
});

test("YouTube falls back to normal translation when no human captions exist", async () => {
  const { harness, targetRequests } = createHumanCaptionHarness({ targetCaption: null });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  await flushPromises();

  assert.equal(targetRequests.length, 1);
  assert.ok(harness.sentMessages.some((message) => message.type === "translation.translateDocument"));
});

test("YouTube-provided subtitles are not requested when the preference is off", async () => {
  const { harness, targetRequests } = createHumanCaptionHarness({ settings: { preferYoutubeProvidedTranslation: false } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();

  assert.equal(targetRequests.length, 0);
  assert.ok(harness.sentMessages.some((message) => message.type === "translation.translateDocument"));
});

test("turning the menu toggle off replaces human captions with our translation", async () => {
  const { harness } = createHumanCaptionHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  await flushPromises();
  assert.equal(harness.sentMessages.some((message) => message.type === "translation.translateDocument"), false);

  await vm.runInNewContext('selectPreferYoutubeProvidedTranslation("youtube", false)', harness.context);
  await flushPromises();
  assert.ok(harness.sentMessages.some((message) => message.type === "settings.setPreferYoutubeProvidedTranslation"
    && message.enabled === false));
  assert.ok(harness.sentMessages.some((message) => message.type === "translation.translateDocument"));
  assert.equal(vm.runInNewContext("subtitleState.youtubeProvidedTranslationLanguage", harness.context), "");
});

test("human caption alignment keeps every source cue and its timing", () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  const source = [
    { id: "a", start: 0, end: 2, text: "one" },
    { id: "b", start: 2, end: 4, text: "two" },
    { id: "c", start: 4, end: 6, text: "three" }
  ];
  harness.context.testSource = source;
  harness.context.testTarget = [
    { start: 0.1, end: 3.9, text: "하나 둘" },
    { start: 4.2, end: 5.8, text: "셋" }
  ];
  const aligned = vm.runInNewContext("alignTargetCuesToSource(testSource, testTarget)", harness.context);
  assert.deepEqual(JSON.parse(JSON.stringify(aligned)), [
    { id: "a", text: "하나" },
    { id: "b", text: "둘" },
    { id: "c", text: "셋" }
  ]);
  harness.context.testTarget = [{ start: 4.2, end: 5.8, text: "셋" }];
  assert.equal(vm.runInNewContext("alignTargetCuesToSource(testSource, testTarget)", harness.context), null);
});

function autoTranslation(lines) {
  return {
    videoId: "abc123def45",
    languageCode: "ko",
    source: "auto",
    text: JSON.stringify({ events: lines.map((text, index) => ({ tStartMs: index * 2000, dDurationMs: 2000, segs: [{ utf8: text }] })) })
  };
}

test("YouTube auto-translation is shown when there are no human captions", async () => {
  const { harness } = createHumanCaptionHarness({ targetCaption: autoTranslation(["안녕", "세상"]) });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  await flushPromises();

  assert.deepEqual(harness.video.astSubtitleCues.map((cue) => cue.text), ["안녕", "세상"]);
  assert.equal(vm.runInNewContext("subtitleState.youtubeProvidedTranslationLanguage", harness.context), "ko");
  assert.equal(harness.sentMessages.some((message) => message.type === "translation.translateDocument"), false);
});

test("YouTube auto-translation that left the text untranslated falls back to our translation", async () => {
  const { harness } = createHumanCaptionHarness({ targetCaption: autoTranslation(["Hello", "world"]) });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  await flushPromises();

  assert.ok(harness.sentMessages.some((message) => message.type === "translation.translateDocument"));
});

test("YouTube auto-translation that runs well past the source span falls back to our translation", async () => {
  // 20 lines of 2s end at 40s while the source ends at 4s: a different cut of the video.
  const { harness } = createHumanCaptionHarness({ targetCaption: autoTranslation(Array.from({ length: 20 }, (_, i) => `줄 ${i}`)) });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  await flushPromises();

  assert.ok(harness.sentMessages.some((message) => message.type === "translation.translateDocument"));
});

const phraseSegmentationSource = readFileSync("extension/content/phrase-segmentation.js", "utf8");
const asrDocument = {
  platform: "youtube",
  videoId: "abc123def45",
  sourceLanguage: "en",
  cues: [
    { id: "yt-0", start: 0, end: 4, text: "so today we are going to", words: ["so", " today", " we", " are", " going", " to"].map((text, index) => ({ text, start: index * 0.35, end: (index + 1) * 0.35 })) },
    { id: "yt-1", start: 2.1, end: 6, text: "talk about the new model", words: ["talk", " about", " the", " new", " model"].map((text, index) => ({ text, start: 2.1 + index * 0.35, end: 2.1 + (index + 1) * 0.35 })) }
  ]
};
const manualDocument = {
  platform: "youtube",
  videoId: "abc123def45",
  sourceLanguage: "en",
  cues: [
    { id: "yt-0", start: 0, end: 2, text: "This caption was split" },
    { id: "yt-1", start: 2, end: 4, text: "in the middle." }
  ]
};

async function startSegmentedYoutube(settings, transcriptDocument = asrDocument) {
  const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "source", ...settings }, transcriptDocument });
  vm.runInNewContext(phraseSegmentationSource, harness.context);
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  return harness;
}

test("auto-generated YouTube captions are regrouped into phrases with their word times", async () => {
  const harness = await startSegmentedYoutube({});
  const cues = harness.video.astSubtitleCues;
  assert.deepEqual([...cues.map((cue) => cue.text)], ["so today we are going to talk about the new model"]);
  assert.deepEqual([...cues[0].words.map((word) => Number(word.start.toFixed(2)))],
    [0, 0.35, 0.7, 1.05, 1.4, 1.75, 2.1, 2.45, 2.8, 3.15, 3.5]);
  // The original lines stay available for checks that compare against YouTube's own lines.
  assert.equal(vm.runInNewContext("subtitleState.currentSourceDocument.cues.length", harness.context), 2);
});

test("phrase segmentation can be turned off in settings", async () => {
  const harness = await startSegmentedYoutube({ phraseSegmentation: false });
  assert.deepEqual([...harness.video.astSubtitleCues.map((cue) => cue.id)], ["yt-0", "yt-1"]);
});

test("YouTube manual captions can be excluded while auto-generated ones are still regrouped", async () => {
  const manual = await startSegmentedYoutube({ phraseSegmentationSkipYoutubeManual: true }, manualDocument);
  assert.deepEqual([...manual.video.astSubtitleCues.map((cue) => cue.text)], ["This caption was split", "in the middle."]);

  // On by default: without the setting, uploaded captions are kept as they are.
  const byDefault = await startSegmentedYoutube({}, manualDocument);
  assert.deepEqual([...byDefault.video.astSubtitleCues.map((cue) => cue.text)], ["This caption was split", "in the middle."]);

  const included = await startSegmentedYoutube({ phraseSegmentationSkipYoutubeManual: false }, manualDocument);
  assert.deepEqual([...included.video.astSubtitleCues.map((cue) => cue.text)], ["This caption was split in the middle."]);

  const automatic = await startSegmentedYoutube({ phraseSegmentationSkipYoutubeManual: true });
  assert.equal(automatic.video.astSubtitleCues.length, 1);
});

test("changing the segmentation setting rebuilds the current video's cues", async () => {
  const harness = await startSegmentedYoutube({});
  assert.equal(harness.video.astSubtitleCues.length, 1);
  harness.runtimeMessageListeners[0]({ type: "settings.changed", settings: { phraseSegmentation: false } });
  await flushPromises();
  assert.deepEqual(harness.video.astSubtitleCues.map((cue) => cue.id), ["yt-0", "yt-1"]);
});

test("word progress highlighting can be turned off so each line appears at once", async () => {
  const highlighted = await startSegmentedYoutube({});
  highlighted.video.currentTime = 1;
  vm.runInNewContext("renderCurrentOverlayCue(subtitleState.currentVideo)", highlighted.context);
  const wordSpans = highlighted.context.document.getElementById("ast-subtitle-overlay").querySelectorAll(".ast-subtitle-word");
  assert.ok(wordSpans.length > 0);

  const plain = await startSegmentedYoutube({ wordProgressHighlight: false });
  plain.video.currentTime = 1;
  vm.runInNewContext("renderCurrentOverlayCue(subtitleState.currentVideo)", plain.context);
  const overlay = plain.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.querySelectorAll(".ast-subtitle-word").length, 0);
  assert.equal(overlay.textContent, "so today we are going to talk about the new model");
});

test("Udemy transcript rows show the segmented translations that start in them", () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  vm.runInNewContext(`
    subtitleState.currentDocument = { cues: [
      { id: "p0", start: 0, end: 4, text: "a b", originId: "u1" },
      { id: "p1", start: 4, end: 6, text: "c", originId: "u1" },
      { id: "p2", start: 6, end: 8, text: "d", originId: "u3" }
    ] };
    subtitleState.udemyTranscriptTranslations = new Map([
      ["p0", { text: "가 나", phase: "final" }],
      ["p1", { text: "다", phase: "temporary" }],
      ["p2", { text: "라", phase: "final" }]
    ]);
  `, harness.context);
  const row = (id) => JSON.parse(JSON.stringify(vm.runInNewContext(`getUdemyTranscriptRowTranslation("${id}")`, harness.context)));
  assert.deepEqual(row("u1"), { text: "가 나 다", phase: "temporary" });
  assert.equal(row("u2"), null);
  assert.deepEqual(row("u3"), { text: "라", phase: "final" });
});

test("source and translated lines use their own size, color and font", async () => {
  const harness = createYoutubeHarness({ settings: {
    subtitleDisplayMode: "dual",
    subtitleStyle: {
      fontFamily: "'Noto Sans KR', sans-serif", fontSize: 30, textColor: "#ffffff",
      sourceFontFamily: "Arial, sans-serif", sourceFontSize: 20, sourceTextColor: "#ffd700"
    }
  } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  harness.video.astSubtitleCues = [{ id: "yt-0", start: 0, end: 5, text: "안녕 세상", sourceText: "Hello world" }];
  vm.runInNewContext("renderCurrentOverlayCue(subtitleState.currentVideo)", harness.context);

  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  const lines = overlay.children.filter((child) => child.className?.includes("ast-subtitle-line"));
  assert.equal(overlay.style.fontFamily, "'Noto Sans KR', sans-serif");
  assert.equal(lines[0].className, "ast-subtitle-line ast-subtitle-source-line");
  assert.equal(lines[0].style.fontFamily, "Arial, sans-serif");
  assert.equal(lines[0].style.color, "#ffd700");
  assert.ok(parseFloat(lines[0].style.fontSize) < parseFloat(overlay.style.fontSize));
  assert.equal(overlay.style.color, "#ffffff");
  assert.equal(lines[1].style.fontFamily || "", "");
  assert.equal(lines[1].style.fontSize || "", "");
});

test("the translation line can be shown above the original", async () => {
  for (const [translationOnTop, expected] of [[false, ["Hello world", "안녕 세상"]], [true, ["안녕 세상", "Hello world"]]]) {
    const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "dual", subtitleStyle: { translationOnTop } } });
    vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
    await flushPromises();
    await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
    await flushPromises();
    harness.video.astSubtitleCues = [{ id: "yt-0", start: 0, end: 5, text: "안녕 세상", sourceText: "Hello world" }];
    vm.runInNewContext("renderCurrentOverlayCue(subtitleState.currentVideo)", harness.context);
    const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
    const lines = overlay.children.filter((child) => child.className?.includes("ast-subtitle-line"));
    assert.deepEqual(lines.map((line) => line.textContent), expected);
  }
});

test("the display submenu switches the translation between top and bottom", async () => {
  const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "dual" } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  harness.video.astSubtitleCues = [{ id: "yt-0", start: 0, end: 5, text: "안녕 세상", sourceText: "Hello world" }];
  harness.context.ensureProviderMenu("youtube");
  harness.context.renderProviderMenu("youtube");

  const options = () => harness.context.document.getElementById("ast-provider-menu")
    .querySelector(".ast-subtitle-display-list").children.at(-1).children[1].children;
  assert.deepEqual(options().map((option) => [option.textContent, option.getAttribute("aria-checked")]),
    [["상단", "false"], ["하단", "true"]]);

  options()[0].dispatchEvent({ type: "click", stopPropagation() {} });
  await flushPromises();
  const lines = harness.context.document.getElementById("ast-subtitle-overlay").children
    .filter((child) => child.className?.includes("ast-subtitle-line"));
  assert.deepEqual(lines.map((line) => line.textContent), ["안녕 세상", "Hello world"]);
  assert.ok(harness.sentMessages.some((message) => message.type === "settings.updateSubtitleStyle"
    && message.patch.translationOnTop === true));
});

test("a new YouTube video picks its source track before taking the player's last caption", async () => {
  const caption = (languageCode, text) => ({
    videoId: "abc123def45", languageCode, isAutoGenerated: false,
    text: JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: text }] }] })
  });
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source" },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.listTracks") {
        return { ok: true, tracks: [
          { languageCode: "ko", label: "한국어", baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=ko" },
          { languageCode: "en", label: "English", baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en" }
        ] };
      }
      if (message.type === "translation.translateDocument") return { ok: true, document: message.document || transcriptDocument };
      return { ok: true };
    }
  });
  // The player last loaded Korean captions (YouTube turned them on for a Korean viewer).
  harness.context.astYoutubeCaptionCapture = {
    get: ({ languageCode }) => (languageCode === "en" ? caption("en", "Hello there") : languageCode ? null : caption("ko", "안녕하세요")),
    request: async ({ languageCode }) => (languageCode === "en" ? caption("en", "Hello there") : caption("ko", "안녕하세요"))
  };
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();

  assert.equal(vm.runInNewContext("subtitleState.currentDocument.sourceLanguage", harness.context), "en");
  assert.equal(harness.context.document.getElementById("ast-subtitle-overlay").textContent, "Hello there");
});

test("dual subtitles always keep both lines, even when the translation matches the original", async () => {
  const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "dual" } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  harness.video.astSubtitleCues = [{ id: "yt-0", start: 0, end: 5, text: "That's quite the list.", sourceText: "That's quite the list." }];
  vm.runInNewContext("renderCurrentOverlayCue(subtitleState.currentVideo)", harness.context);
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "That's quite the list.\nThat's quite the list.");
});

test("the source language picked on an earlier video is used for the next one", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source", sourceCaptionLanguages: { youtube: "ko" } },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "translation.translateDocument") return { ok: true, document: message.document || transcriptDocument };
      return { ok: true };
    }
  });
  const caption = (languageCode, isAutoGenerated, text) => ({
    videoId: "abc123def45", languageCode, isAutoGenerated,
    text: JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: text }] }] })
  });
  harness.context.astYoutubeCaptionCapture = {
    listTracks: async () => [
      { languageCode: "en", kind: "", name: "English", baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en" },
      { languageCode: "ko", kind: "asr", name: "한국어 (자동 생성됨)", baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=ko&kind=asr" }
    ],
    get: () => null,
    request: async ({ languageCode, isAutoGenerated }) => (languageCode === "ko"
      ? caption("ko", isAutoGenerated, "안녕하세요")
      : caption("en", false, "Hello"))
  };
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();

  assert.equal(vm.runInNewContext("subtitleState.currentDocument.sourceLanguage", harness.context), "ko");
  assert.equal(harness.context.document.getElementById("ast-subtitle-overlay").textContent, "안녕하세요");
});

test("choosing a source track remembers its language for later videos", async () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  vm.runInNewContext(`
    subtitleState.enabled = false;
    subtitleState.loading = false;
    setSourceCaptionTracks("youtube", "abc123def45", [
      { id: "en", languageCode: "en", label: "English" },
      { id: "ko", languageCode: "ko", label: "한국어" }
    ]);
  `, harness.context);
  await vm.runInNewContext('selectSourceCaptionTrack("youtube", "ko")', harness.context);
  assert.ok(harness.sentMessages.some((message) => message.type === "settings.setSourceCaptionLanguage"
    && message.platform === "youtube" && message.languageCode === "ko"));
  assert.equal(vm.runInNewContext('selectDefaultSourceCaptionTrack(subtitleState.sourceCaptionTracks, getPreferredSourceLanguage("youtube")).id', harness.context), "ko");
});

test("switching YouTube videos clears the previous video's lines right away", async () => {
  const { overlay, harness } = await (async () => {
    const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "source" } });
    vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
    await flushPromises();
    await flushPromises();
    return { harness, overlay: harness.context.document.getElementById("ast-subtitle-overlay") };
  })();
  assert.equal(overlay.textContent, "Hello world");

  harness.context.location.href = "https://www.youtube.com/watch?v=zyx987wvu65";
  harness.context.location.search = "?v=zyx987wvu65";
  harness.intervalCallbacks.at(-1)();
  assert.notEqual(overlay.textContent, "Hello world");
});

test("an overloaded AI provider is announced once, before any fallback arrives", async () => {
  const { overlay, runtimeMessageListeners, sentMessages, context } = await loadYoutubeOverlay({
    settings: {
      activeProvider: "openrouter",
      providerTestStatus: { openrouter: "success" }
    }
  });
  const finalRequest = sentMessages.find((message) => message.type === "translation.translateDocument"
    && message.mode === "final");
  const originalText = overlay.textContent;
  const notice = () => runtimeMessageListeners[0]({
    type: "translation.progress",
    videoId: "abc123def45",
    mode: "final",
    requestId: finalRequest.requestId,
    progress: { chunkIndex: -1, chunkCount: 1, completedChunkCount: 0, isComplete: false, cues: [], providerNotice: "server_busy" }
  });

  notice();
  const toast = context.document.getElementById("ast-toast");
  assert.match(toast.textContent, /AI 번역 서버가 혼잡해/);
  assert.equal(overlay.textContent, originalText);

  toast.textContent = "";
  notice();
  assert.equal(toast.textContent, "");
});

function stubYoutubePlayerCaptions(harness, request) {
  harness.context.astYoutubeCaptionCapture = {
    listTracks: async () => [
      { languageCode: "en", kind: "asr", name: "English (auto-generated)", baseUrl: "https://www.youtube.com/api/timedtext?v=abc123def45&lang=en&kind=asr" }
    ],
    get: () => null,
    request
  };
}

test("a video that lists caption tracks reports a load failure, not missing captions", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source" },
    sendMessage(message) {
      if (message.type === "captions.youtube.fetchTranscript") {
        return { ok: false, error: "No YouTube captions are available for this video." };
      }
      return { ok: true };
    }
  });
  stubYoutubePlayerCaptions(harness, async () => null);
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  const button = harness.controls.querySelector("#ast-toolbar-button");
  await clickAstToggle(button);
  await flushPromises();

  assert.match(harness.moviePlayer.querySelector("#ast-toast").textContent, /^자막을 불러오지 못했습니다: No YouTube captions/);
});

test("YouTube waits for an ad to end before asking the player for captions", async () => {
  const requests = [];
  const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "source" } });
  stubYoutubePlayerCaptions(harness, async (options) => {
    requests.push(options);
    return { videoId: "abc123def45", languageCode: "en", isAutoGenerated: true,
      text: JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: "After the ad" }] }] }) };
  });
  harness.moviePlayer.classList.add("ad-showing");
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  assert.equal(requests.length, 0);
  assert.ok(!harness.sentMessages.some((message) => message.type === "captions.youtube.fetchTranscript"));

  harness.moviePlayer.classList.remove("ad-showing");
  harness.runTimeouts();
  await flushPromises();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].languageCode, "en");
});

test("retranslating a video that shows YouTube's captions sends it to the selected provider", async () => {
  const { harness, targetRequests } = createHumanCaptionHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  assert.equal(harness.sentMessages.some((message) => message.type === "translation.translateDocument"), false);

  await vm.runInNewContext('retranslateCurrentVideo("youtube")', harness.context);
  await flushPromises();

  assert.equal(targetRequests.length, 1);
  assert.ok(harness.sentMessages.some((message) => message.type === "translation.clearVideoCache"));
  assert.ok(harness.sentMessages.some((message) => message.type === "translation.translateDocument" && message.mode === "final"));
});

test("the menu status line names each translation state in plain words", async () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  const status = (setup) => vm.runInNewContext(`(() => {
    Object.assign(subtitleState, {
      enabled: true, loading: false, translationPhase: "current", activeProviderId: "openai",
      youtubeProvidedTranslationLanguage: "", youtubeProvidedTranslationSource: "",
      providerBusy: false, translationFailed: false, hasAlignmentFallback: false,
      expectedCueIds: new Set(["a", "b", "c", "d"]), finalTranslatedCueIds: new Set(["a"]), fallbackCueIds: new Set(),
      availableProviders: [{ id: "openai", label: "OpenAI", model: "gpt-6-luna" }, { id: "googleTranslate", label: "Google Translate", model: "" }],
      targetLanguage: "ko", targetLanguages: [{ code: "ko", label: "한국어" }]
    }, ${setup});
    return getTranslationStatus();
  })()`, harness.context);

  assert.equal(status("{ loading: true }").text, "자막 불러오는 중…");
  assert.equal(status("{ enabled: false }").text, "자막 꺼짐");
  assert.equal(status("{ translationPhase: 'source' }").text, "원문 자막 표시 중");
  assert.equal(status("{ translationPhase: 'temporary' }").text, "빠른 번역 표시 중 · AI 번역 25%");
  assert.equal(status("{}").text, "AI 번역 중 25%");
  assert.equal(status("{ activeProviderId: 'googleTranslate' }").text, "번역 중 25%");
  assert.equal(status("{ translationPhase: 'complete' }").text, "번역 완료 · gpt-6-luna");
  assert.equal(status("{ translationPhase: 'complete', activeProviderId: 'googleTranslate' }").text, "번역 완료 · Google Translate");
  assert.equal(status("{ translationPhase: 'complete', fallbackCueIds: new Set(['a', 'b']) }").text, "번역 완료 · 2줄 Google 번역");
  assert.equal(status("{ translationPhase: 'fallback' }").text, "Google 번역으로 대체 중");
  assert.equal(status("{ providerBusy: true }").text, "AI 서버 혼잡 · 재시도 중");
  assert.equal(status("{ translationFailed: true }").text, "번역 실패 · 원문 표시 중");
  const human = status("{ translationPhase: 'complete', youtubeProvidedTranslationLanguage: 'ko', youtubeProvidedTranslationSource: 'human' }");
  assert.equal(human.text, "YouTube 한국어 자막 사용 중");
  assert.equal(human.hint, "AI로 번역하려면 '현재 영상 다시 번역'을 누르세요.");
  assert.equal(status("{ translationPhase: 'complete', youtubeProvidedTranslationLanguage: 'ko', youtubeProvidedTranslationSource: 'auto' }").text,
    "YouTube 자동 번역 사용 중");
});

test("turning YouTube captions off while they download keeps them from replacing the translation", async () => {
  const { harness } = createHumanCaptionHarness();
  let deliver;
  const original = harness.context.astYoutubeCaptionCapture.requestTarget;
  harness.context.astYoutubeCaptionCapture.requestTarget = (request) => new Promise((resolve) => { deliver = () => resolve(original(request)); });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  assert.equal(vm.runInNewContext("subtitleState.youtubeProvidedTranslationPending", harness.context), true);

  await vm.runInNewContext('selectPreferYoutubeProvidedTranslation("youtube", false)', harness.context);
  await flushPromises();
  deliver();
  await flushPromises();

  assert.equal(vm.runInNewContext("subtitleState.youtubeProvidedTranslationLanguage", harness.context), "");
  assert.ok(harness.sentMessages.some((message) => message.type === "translation.translateDocument" && message.mode === "final"));
});

test("turning YouTube captions off on the settings page translates the playing video", async () => {
  const { harness } = createHumanCaptionHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  assert.equal(vm.runInNewContext("subtitleState.youtubeProvidedTranslationLanguage", harness.context), "ko");

  harness.runtimeMessageListeners[0]({ type: "settings.changed", settings: { preferYoutubeProvidedTranslation: false } });
  await flushPromises();

  assert.equal(vm.runInNewContext("subtitleState.youtubeProvidedTranslationLanguage", harness.context), "");
  assert.ok(harness.sentMessages.some((message) => message.type === "translation.translateDocument" && message.mode === "final"));
});

test("YouTube's rolling auto-translation lines map to source cues without repeats or stray periods", () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  // Real lines from a YouTube auto-translated track: each stays up ~5s past the next one's start,
  // and they break mid-sentence. Source cues are our phrase-segmented sentences.
  const word = (text, start) => ({ text, start });
  harness.context.testRawSource = [
    { start: 1105.52, end: 1111.2, text: "prepare for Monday. Simple but useful.",
      words: [word("prepare ", 1105.52), word("for ", 1105.9), word("Monday. ", 1106.3), word("Simple ", 1107.1), word("but ", 1107.5), word("useful.", 1107.9)] },
    { start: 1108.799, end: 1113.919, text: ">> I got ready for the week on Sunday",
      words: [word(">> I ", 1108.8), word("got ", 1109.1), word("ready ", 1109.4), word("for ", 1109.7), word("the ", 1109.9), word("week ", 1110.1), word("on ", 1110.4), word("Sunday", 1110.7)] },
    { start: 1111.2, end: 1116.559, text: "evening. Okay. And what about a very",
      words: [word("evening. ", 1111.2), word("Okay. ", 1112.1), word("And ", 1112.8), word("what ", 1113.1), word("about ", 1113.3), word("a ", 1113.6), word("very", 1113.8)] }
  ];
  harness.context.testTarget = [
    { start: 1105.52, end: 1111.2, text: "월요일을 대비하세요. 간단하지만 유용합니다." },
    { start: 1108.799, end: 1113.919, text: "나는 일요일 저녁에 한 주를 시작할 준비를 했다" },
    { start: 1111.2, end: 1116.559, text: ". 좋아요. 그렇다면 아주" }
  ];
  harness.context.testSource = [
    { id: "a", start: 1105.5, end: 1107.1, text: "prepare for Monday." },
    { id: "b", start: 1107.1, end: 1108.8, text: "Simple but useful." },
    { id: "c", start: 1108.8, end: 1112.1, text: ">> I got ready for the week on Sunday evening." },
    { id: "d", start: 1112.1, end: 1112.8, text: "Okay." },
    { id: "e", start: 1112.8, end: 1116.5, text: "And what about a very" }
  ];
  const aligned = JSON.parse(JSON.stringify(vm.runInNewContext("alignTargetCuesToSource(testSource, testTarget, testRawSource)", harness.context)));
  assert.deepEqual(aligned.map((cue) => cue.text), [
    "월요일을 대비하세요.",
    "간단하지만 유용합니다.",
    "나는 일요일 저녁에 한 주를 시작할 준비를 했다.",
    "좋아요.",
    "그렇다면 아주"
  ]);
});

test("a translated sentence shared by two source cues is split between them, not shown twice", () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  harness.context.testSource = [
    { id: "a", start: 0, end: 4, text: "And the most important tip of the day, react to the feeling, not only" },
    { id: "b", start: 4, end: 5, text: "the facts." }
  ];
  harness.context.testTarget = [{ start: 0, end: 5, text: "그리고 오늘 가장 중요한 팁은, 사실뿐 아니라 감정에도 반응하라는 것입니다." }];
  const aligned = JSON.parse(JSON.stringify(vm.runInNewContext("alignTargetCuesToSource(testSource, testTarget)", harness.context)));
  assert.ok(aligned[0].text && aligned[1].text);
  assert.equal(`${aligned[0].text} ${aligned[1].text}`, "그리고 오늘 가장 중요한 팁은, 사실뿐 아니라 감정에도 반응하라는 것입니다.");
});

function mountShortsPlayer(harness) {
  const document = harness.context.document;
  const playerContainer = new FakeElement("div");
  playerContainer.id = "player-container";
  const controls = new FakeElement("ytd-shorts-player-controls");
  const pill = new FakeElement("div");
  pill.id = "right-controls";
  const pillButtons = ["closed-captioning-button-container", "menu-button", "fullscreen-button-shape"].map((id) => {
    const element = new FakeElement("div");
    element.id = id;
    return element;
  });
  pill.append(...pillButtons);
  controls.append(pill);
  const shortsPlayer = new FakeElement("div");
  shortsPlayer.id = "shorts-player";
  const shortsVideo = new FakeElement("video");
  shortsVideo.currentTime = 0;
  shortsPlayer.append(shortsVideo);
  playerContainer.append(controls, shortsPlayer);
  document.body.append(playerContainer);
  const containerQuery = playerContainer.querySelector.bind(playerContainer);
  playerContainer.querySelector = (selector) => selector === "ytd-shorts-player-controls #right-controls"
    ? pill : containerQuery(selector);
  const documentQuery = document.querySelector;
  document.querySelector = (selector) => {
    if (selector === "#shorts-player") return shortsPlayer;
    if (selector === "#shorts-player video") return shortsVideo;
    return documentQuery(selector);
  };
  return { pill, pillButtons, shortsPlayer, shortsVideo };
}

function goToShort(harness, videoId) {
  Object.assign(harness.context.location, {
    href: `https://www.youtube.com/shorts/${videoId}`, pathname: `/shorts/${videoId}`, search: ""
  });
}

test("a Short is its own session, read from its own player", async () => {
  const harness = createYoutubeHarness({ settings: { subtitleDisplayMode: "source" } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await flushPromises();
  const shorts = mountShortsPlayer(harness);

  goToShort(harness, "yDLv-bNfrSI");
  assert.equal(vm.runInNewContext("getYoutubeVideoId()", harness.context), "yDLv-bNfrSI");
  assert.equal(vm.runInNewContext("isYoutubeShortsPage()", harness.context), true);
  assert.equal(vm.runInNewContext("findVideoElement('youtube')", harness.context), shorts.shortsVideo);
  assert.equal(vm.runInNewContext("findOverlayHost('youtube', null)", harness.context), shorts.shortsPlayer);

  harness.intervalCallbacks.at(-1)();
  await flushPromises();
  await flushPromises();
  const fetches = harness.sentMessages.filter((message) => message.type === "captions.youtube.fetchTranscript");
  assert.equal(fetches.at(-1).videoId, "yDLv-bNfrSI");
  assert.ok(shorts.shortsPlayer.querySelector("#ast-subtitle-overlay"));

  // A Shorts channel tab or a malformed path is not a Short.
  Object.assign(harness.context.location, { href: "https://www.youtube.com/@channel/shorts", pathname: "/@channel/shorts", search: "" });
  assert.equal(vm.runInNewContext("isYoutubeShortsPage()", harness.context), false);
  assert.equal(vm.runInNewContext("getYoutubeVideoId()", harness.context), null);
});

test("on a Short the button joins the control pill before the menu button and moves back on a watch page", async () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await flushPromises();
  const shorts = mountShortsPlayer(harness);
  shorts.pill.insertBefore = (node, reference) => {
    node.remove?.();
    node.parentElement = shorts.pill;
    shorts.pill.children.splice(shorts.pill.children.indexOf(reference), 0, node);
  };

  goToShort(harness, "yDLv-bNfrSI");
  assert.equal(vm.runInNewContext("ensureButton('youtube')", harness.context), true);
  assert.deepEqual(shorts.pill.children.map((child) => child.id),
    ["closed-captioning-button-container", "ast-toolbar-button", "menu-button", "fullscreen-button-shape"]);

  // The menu is placed on the page under the button, where the narrow Short cannot clip it.
  harness.context.window ||= { addEventListener() {} };
  const menu = vm.runInNewContext("ensureProviderMenu('youtube')", harness.context);
  assert.equal(menu.parentElement, harness.context.document.body);
  assert.equal(menu.dataset.floating, "true");

  Object.assign(harness.context.location, { href: "https://www.youtube.com/watch?v=abc123def45", pathname: "/watch", search: "?v=abc123def45" });
  assert.equal(vm.runInNewContext("ensureButton('youtube')", harness.context), true);
  const watchControls = harness.context.document.querySelector("#movie_player .ytp-right-controls");
  assert.ok(watchControls.querySelector("#ast-toolbar-button"));
  assert.equal(shorts.pill.querySelector("#ast-toolbar-button"), null);
  const watchMenu = vm.runInNewContext("ensureProviderMenu('youtube')", harness.context);
  assert.equal(watchMenu.parentElement, harness.context.document.querySelector("#movie_player"));
  assert.equal(watchMenu.dataset.floating, undefined);
});

test("going back to a video while another video's captions are still loading reloads it", async () => {
  const harness = createYoutubeHarness({
    settings: { subtitleDisplayMode: "source" },
    sendMessage(message, { transcriptDocument }) {
      if (message.type === "captions.youtube.fetchTranscript") {
        // The second video's captions never arrive, like a Short or a blocked track.
        if (message.videoId === "zyx987wvu65") return new Promise(() => {});
        return { ok: true, document: transcriptDocument };
      }
      if (message.type === "translation.translateDocument") return { ok: true, document: message.document || transcriptDocument };
      return { ok: true };
    }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await flushPromises();
  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  assert.equal(overlay.textContent, "Hello world");

  Object.assign(harness.context.location, { href: "https://www.youtube.com/watch?v=zyx987wvu65", search: "?v=zyx987wvu65" });
  harness.intervalCallbacks.at(-1)();
  await flushPromises();
  assert.equal(vm.runInNewContext("subtitleState.loadingSessionKey", harness.context), "zyx987wvu65");

  Object.assign(harness.context.location, { href: "https://www.youtube.com/watch?v=abc123def45", search: "?v=abc123def45" });
  harness.intervalCallbacks.at(-1)();
  await flushPromises();
  await flushPromises();

  const fetches = harness.sentMessages.filter((message) => message.type === "captions.youtube.fetchTranscript").map((message) => message.videoId);
  assert.deepEqual(fetches.slice(-2), ["zyx987wvu65", "abc123def45"]);
  assert.equal(overlay.textContent, "Hello world");
  assert.equal(vm.runInNewContext("subtitleState.currentSessionKey", harness.context), "abc123def45");
  assert.equal(vm.runInNewContext("subtitleState.loading", harness.context), false);
});

test("each LLM provider in the player menu shows the model it is set to", async () => {
  const harness = createYoutubeHarness({
    settings: {
      activeProvider: "openai",
      providerTestStatus: { openai: "success" },
      providers: { openai: { model: "gpt-6-luna" } }
    }
  });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  // The menu reads providers from settings when it opens; fill them the same way here.
  vm.runInNewContext(`subtitleState.availableProviders = getAvailableProviders({
    activeProvider: "openai",
    providerTestStatus: { openai: "success", openrouter: "success", nvidiaNim: "success" },
    providers: { openai: { model: "gpt-6-luna" }, openrouter: { model: "deepseek/deepseek-v4-flash:nitro" }, nvidiaNim: { model: "openai/gpt-oss-120b" } }
  }); ensureProviderMenu("youtube"); renderProviderMenu("youtube")`, harness.context);
  const menu = harness.context.document.getElementById("ast-provider-menu");
  const item = (id) => menu.children.find((child) => child.dataset?.providerId === id);
  const model = (id) => item(id).children.find((child) => child.className === "ast-provider-model");

  assert.equal(model("openai")?.textContent, "gpt-6-luna");
  assert.equal(model("googleTranslate"), undefined);
  // OpenRouter and NVIDIA NIM drop the model maker prefix; the full id stays in the tooltip.
  assert.equal(model("openrouter").textContent, "deepseek-v4-flash:nitro");
  assert.equal(model("openrouter").title, "deepseek/deepseek-v4-flash:nitro");
  assert.equal(model("nvidiaNim").textContent, "gpt-oss-120b");
});

test("player submenus grow to their longest label instead of cutting it off", () => {
  const css = readFileSync("extension/content/content-style.css", "utf8");
  assert.match(css, /\.ast-translation-style-list \{[\s\S]*?width: max-content;[\s\S]*?min-width: 256px;/);
});

test("source and translated lines use their own font weight", async () => {
  const harness = createYoutubeHarness({ settings: {
    subtitleDisplayMode: "dual",
    subtitleStyle: { fontWeight: 300, sourceFontWeight: 900 }
  } });
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  await flushPromises();
  await clickAstToggle(harness.controls.querySelector("#ast-toolbar-button"));
  await flushPromises();
  harness.video.astSubtitleCues = [{ id: "yt-0", start: 0, end: 5, text: "안녕 세상", sourceText: "Hello world" }];
  vm.runInNewContext("renderCurrentOverlayCue(subtitleState.currentVideo)", harness.context);

  const overlay = harness.context.document.getElementById("ast-subtitle-overlay");
  const source = overlay.children.find((child) => child.className?.includes("ast-subtitle-source-line"));
  assert.equal(overlay.style.fontWeight, "300");
  assert.equal(source.style.fontWeight, "900");
});

test("YouTube's auto-translation is judged by time coverage, so merged lines are still accepted", () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  const cue = (start, end, text) => ({ start, end, text });
  const source = Array.from({ length: 10 }, (_, i) => cue(i * 2, i * 2 + 2, `line ${i}`));
  const check = (target) => {
    harness.context.testSource = source;
    harness.context.testTarget = target;
    return vm.runInNewContext("isUsableYoutubeAutoTranslation(testSource, testTarget)", harness.context);
  };

  // Two source lines translated as one: 10 lines become 5, yet every source line is covered.
  const merged = Array.from({ length: 5 }, (_, i) => cue(i * 4, i * 4 + 4, `번역 ${i}`));
  assert.equal(check(merged), true);
  // A track that stops halfway does not cover enough and ends too early.
  assert.equal(check(merged.slice(0, 3)), false);
  // A different cut starting a minute later fails the span check.
  assert.equal(check(merged.map((item) => ({ ...item, start: item.start + 60, end: item.end + 60 }))), false);
  // Lines that are still in the source language mean the translation did not apply.
  assert.equal(check(source.map((item) => ({ ...item }))), false);
});

test("a short pause between lines keeps the previous line up instead of flashing the box off", () => {
  const harness = createYoutubeHarness();
  vm.runInNewContext(readFileSync("extension/content/content-script.js", "utf8"), harness.context);
  harness.context.testCues = [
    { id: "a", start: 0, end: 2, text: "first" },
    { id: "b", start: 2.6, end: 4, text: "second" },
    { id: "c", start: 7, end: 9, text: "after a long pause" }
  ];
  const at = (time) => vm.runInNewContext(`findActiveCue(testCues, ${time})?.id ?? null`, harness.context);

  assert.equal(at(1), "a");
  // 0.6s gap: the first line stays until the second starts.
  assert.equal(at(2.3), "a");
  assert.equal(at(2.6), "b");
  // 3s pause: the box clears.
  assert.equal(at(5), null);
  assert.equal(at(7.5), "c");
  // Before the first line and after the last one nothing is shown.
  assert.equal(at(9.5), null);
});

test("a click on the subtitle edge without dragging keeps the set width even when the line is short", async () => {
  const { overlay, context } = await loadYoutubeOverlay();
  const setWidth = overlay.style.maxWidth;
  const savedWidth = vm.runInNewContext("subtitleState.subtitleStyle?.width", context);
  const event = (type) => ({ type, button: 0, pointerId: 1, clientX: 596, clientY: 312,
    preventDefault: () => {}, stopPropagation: () => {}, stopImmediatePropagation: () => {} });

  overlay.dispatchEvent(event("pointerdown"));
  overlay.dispatchEvent(event("pointerup"));

  assert.equal(overlay.style.width, "max-content");
  assert.equal(overlay.style.maxWidth, setWidth);
  assert.equal(vm.runInNewContext("subtitleState.subtitleStyle?.width", context), savedWidth);
});
