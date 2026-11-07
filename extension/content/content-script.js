const BUTTON_ID = "ast-toolbar-button";
const TED_CONTROL_ID = "ast-ted-control";
const FLOATING_TOOLBAR_ID = "ast-floating-toolbar";
const PROVIDER_MENU_ID = "ast-provider-menu";
const OVERLAY_ID = "ast-subtitle-overlay";
const TOAST_ID = "ast-toast";
const UDEMY_TRANSCRIPT_PANEL_SELECTOR = '[data-purpose="transcript-panel"]';
const UDEMY_TRANSCRIPT_CUE_SELECTOR = '[data-purpose="transcript-cue"], [data-purpose="transcript-cue-active"]';
const UDEMY_TRANSCRIPT_CUE_TEXT_SELECTOR = '[data-purpose="cue-text"]';
const UDEMY_TRANSCRIPT_TRANSLATION_CLASS = "ast-udemy-transcript-translation";
const WEB_FONT_STYLE_ID = "ast-web-font-style";
let bundledGowunFontPromise = null;
const OVERLAY_VERTICAL_MARGIN_PX = 12;
const OVERLAY_MIN_HEIGHT_PX = 42;
const OVERLAY_RESIZE_HIT_WIDTH_PX = 18;
const OVERLAY_HORIZONTAL_MARGIN_PX = 12;
const OVERLAY_MAX_STYLE_WIDTH = 32768;
const OVERLAY_REFERENCE_WIDTH_PX = 1280;
const OVERLAY_REFERENCE_HEIGHT_PX = 720;
const UDEMY_FLOATING_TOOLBAR_DELAY_MS = 2500;
const PROVIDER_MENU_AUTO_CLOSE_DELAY_MS = 5000;
const DEFAULT_TEMPORARY_PRIORITY_WINDOW_SECONDS = 420;
const MIN_TEMPORARY_PRIORITY_WINDOW_SECONDS = 120;
const MAX_TEMPORARY_PRIORITY_WINDOW_SECONDS = 900;
const PROVIDER_MENU_ORDER = [
  ["googleTranslate", "Google Translate", "google-translate"],
  ["deepl", "DeepL", "deepl"],
  ["google", "Google AI", "google-generate-content"],
  ["openai", "OpenAI", "openai-responses"],
  ["anthropic", "Anthropic", "anthropic-messages"],
  ["openrouter", "OpenRouter", "openai-chat"],
  ["nvidiaNim", "NVIDIA NIM", "openai-chat"],
  ["local", "Custom LLM", "openai-chat"]
];
const TRANSLATION_STYLE_MESSAGE_KEYS = {
  natural: "styleNatural",
  lecture: "styleLecture",
  technical: "styleTechnical",
  custom: "styleCustom",
  custom2: "styleCustom2"
};
const SUBTITLE_DISPLAY_MESSAGE_KEYS = {
  dual: "contentDualSubtitles",
  source: "contentMainSubtitles",
  translated: "contentTranslatedSubtitles"
};
const YOUTUBE_TRANSCRIPT_TEXT_PATTERN = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
const YOUTUBE_XML_ATTRIBUTE_PATTERN = /(\w+)="([^"]*)"/g;
const YOUTUBE_ENTITY_MAP = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&laquo;": "«",
  "&raquo;": "»"
};
const subtitleState = {
  enabled: false,
  autoEnablePending: false,
  loading: false,
  loadingSessionKey: "",
  subtitleLoadGeneration: 0,
  currentLectureId: "",
  currentSessionKey: "",
  currentPlatform: "",
  currentVideoId: "",
  currentRouteKey: "",
  pendingRouteKey: "",
  currentVideo: null,
  currentDocument: null,
  activeProviderId: "",
  translationStyle: "",
  preferYoutubeProvidedTranslation: true,
  youtubeProvidedTranslationLanguage: "",
  youtubeProvidedTranslationSource: "",
  // { platform, sessionKey } of the video found to have no captions; it is not asked for again.
  captionsUnavailable: null,
  providerBusy: false,
  translationFailed: false,
  youtubeProvidedTranslationPending: false,
  phraseSegmentation: true,
  phraseSegmentationSkipYoutubeManual: true,
  wordProgressHighlight: true,
  currentSourceDocument: null,
  sourceCaptionLanguages: null,
  defaultProviderId: "",
  sourceCaptionTracks: [],
  sourceCaptionSessionKey: "",
  selectedSourceCaptionTrackId: "",
  temporaryPriorityWindowSeconds: DEFAULT_TEMPORARY_PRIORITY_WINDOW_SECONDS,
  availableProviders: [],
  translationGeneration: 0,
  translationRequestSequence: 0,
  translationStyleSelectionGeneration: 0,
  targetLanguageSelectionGeneration: 0,
  targetLanguages: [],
  fallbackRetryTimeoutId: null,
  fallbackRetryPending: false,
  retranslatingCurrentVideo: false,
  activeFinalRequestId: "",
  activeTemporaryRequestId: "",
  pendingProviderId: "",
  translationPhase: "off",
  hasAlignmentFallback: false,
  fallbackCueIds: new Set(),
  fallbackRetryAttempts: 0,
  fallbackRetryBlocked: false,
  fallbackRetryNotBefore: 0,
  expectedCueIds: new Set(),
  finalTranslatedCueIds: new Set(),
  lastTemporaryPriorityKey: "",
  lastFallbackToastKey: "",
  serverBusyNoticeShown: false,
  toastTimeoutId: null,
  subtitleStyle: null,
  subtitleDisplayMode: "dual",
  targetLanguage: "",
  udemyTranscriptTranslations: new Map(),
  udemyTranscriptObserver: null,
  udemyTranscriptRefreshQueued: false,
  // The running summary: { requestId, step, total }, or null.
  summaryJob: null,
  summaryNotice: null,
  disposed: false
};
let crossFrameProviderMenuOpen = false;
let providerMenuAutoCloseTimeoutId = null;
let translationLifecyclePort = null;
let tedPlayerContextCache = null;
const CAPTION_SVG = `
<svg class="ast-toolbar-icon" viewBox="0 0 1240 1240" width="24" height="24" aria-hidden="true" focusable="false">
  <path class="ast-toolbar-icon-bg" d="M330 110H910Q1100 110 1100 327V797Q1100 969 910 969H850V1109Q850 1132 818 1119L680 969H330Q140 969 140 797V327Q140 110 330 110Z"/>
  <path class="ast-toolbar-icon-outline" d="M335 150H905Q1060 150 1060 331V801Q1060 936 905 936H835V1076Q835 1094 823 1088L665 936H335Q180 936 180 801V331Q180 150 335 150Z"/>
  <text class="ast-toolbar-icon-mark" x="620" y="715" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="400" letter-spacing="-8">AST</text>
</svg>`.trim();

function detectPlatform() {
  // Set by the worker before it loads AST into a frame for the generic video player.
  if (globalThis.__astGenericMode === true) return "generic";
  const host = location.hostname;
  if (host.includes("youtube.com")) return "youtube";
  if (host.includes("udemy.com")) return "udemy";
  if ((host === "ted.com" || host === "www.ted.com") && location.pathname.startsWith("/talks/")) return "ted";
  if (host === "www.coursera.org" || host === "coursera.org") return "coursera";
  if (host === "www.linkedin.com" && location.pathname.startsWith("/learning/")) return "linkedin";
  if (host === "www.nvidia.com" && getNvidiaOnDemandSessionId()) return "nvidiaOnDemand";
  if (host === "learn.deeplearning.ai") return "deeplearningai";
  // edX plays a unit's videos inside a courses.edx.org frame of learning.edx.org.
  if (host === "courses.edx.org") return "edx";
  // The O'Reilly player lives in a same-origin srcdoc iframe, so only that frame runs the platform.
  if (getOreillyPagePath().startsWith("/videos/")) return "oreilly";
  if (host === "player.vimeo.com") return "vimeo";
  if ((host === "vimeo.com" || host === "www.vimeo.com") && getVimeoVideoId()) return "vimeo";
  return null;
}

function isVimeoPlatform(platform) {
  return platform === "nvidia" || platform === "vimeo";
}

function contentText(key, substitutions) {
  try {
    return chrome?.i18n?.getMessage?.(key, substitutions) || key;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      disposeContentScript();
      return key;
    }
    throw error;
  }
}

function getAvailableProviders(settings = {}) {
  return PROVIDER_MENU_ORDER.map(([id, defaultLabel, apiStyle]) => ({
    id,
    label: settings.providers?.[id]?.label || defaultLabel,
    apiStyle: settings.providers?.[id]?.apiStyle || apiStyle,
    model: settings.providers?.[id]?.model || ""
  })).filter((provider) => provider.apiStyle === "google-translate"
    || settings.providerTestStatus?.[provider.id] === "success"
    || settings.activeProvider === provider.id);
}

function isMachineTranslationProvider(providerId) {
  return providerId === "googleTranslate" || providerId === "deepl";
}

function disposeContentScript() {
  clearProviderMenuAutoCloseTimer();
  clearFallbackProviderRetry();
  removeUdemyTranscriptObserver();
  removeUdemyTranscriptTranslationElements();
  subtitleState.disposed = true;
  subtitleState.enabled = false;
  subtitleState.loading = false;
}

function isExtensionContextInvalidated(error) {
  return String(error?.message || error || "").includes("Extension context invalidated");
}

async function sendRuntimeMessage(message) {
  if (subtitleState.disposed || !chrome?.runtime?.id) {
    disposeContentScript();
    return { ok: false, error: "Extension context invalidated" };
  }

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      disposeContentScript();
      return { ok: false, error: "Extension context invalidated" };
    }
    throw error;
  }
}

// The background aborts this page's translations when Chrome closes the port on
// reload, navigation or tab close. Reconnect after a service worker restart.
function ensureTranslationLifecyclePort() {
  if (translationLifecyclePort || subtitleState.disposed || !chrome?.runtime?.connect) return;
  try {
    const port = chrome.runtime.connect({ name: "ast.translation.lifecycle" });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (translationLifecyclePort === port) translationLifecyclePort = null;
    });
    translationLifecyclePort = port;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) disposeContentScript();
  }
}

async function getPublicSettings() {
  const response = await sendRuntimeMessage({ type: "settings.getPublic" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load extension settings.");
  }
  return response.settings || {};
}

function findToolbarTarget(platform, { allowFloatingToolbar = true } = {}) {
  if (platform === "edx") {
    return findVideoElement("edx")?.closest(".video")?.querySelector(".video-controls .secondary-controls")
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (platform === "generic") {
    return typeof getGenericToolbarTarget === "function" ? getGenericToolbarTarget() : null;
  }

  if (platform === "deeplearningai") {
    return document.querySelector(DLAI_PLAY_BUTTON_SELECTOR)?.closest(".vds-controls-group")
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (platform === "nvidiaOnDemand") {
    return document.querySelector(PLAYKIT_CONTROLS_SELECTOR)
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (platform === "oreilly") {
    return document.querySelector(PLAYKIT_CONTROLS_SELECTOR)
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (platform === "linkedin") {
    return document.querySelector(LINKEDIN_CONTROLS_SELECTOR)
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (platform === "coursera") {
    return document.querySelector(COURSERA_CONTROLS_SELECTOR)
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (platform === "udemy") {
    return document.querySelector('[data-purpose="video-controls"]')
      || findUdemyPlayerControls()
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (platform === "youtube") {
    return document.querySelector("#movie_player .ytp-right-controls");
  }

  if (platform === "ted") {
    return document.querySelector("#media-fullscreen-button-desktop")?.closest("media-control-bar")
      || document.querySelector("#video-player-container #media-control-bar, #media-control-bar")
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (isVimeoPlatform(platform)) {
    return findVimeoPlayerControls()
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  return null;
}

function findVimeoPlayerControls() {
  const preferencesButton = document.querySelector('.vp-controls [data-prefs-button]');
  if (preferencesButton?.parentElement?.parentElement) {
    return preferencesButton.parentElement.parentElement;
  }
  return document.querySelector('.vp-controls [data-control-bar="true"]')
    || document.querySelector(".vp-controls");
}

function findUdemyPlayerControls() {
  const mediaPlayer = document.querySelector('[data-purpose="media-player-container"]');
  if (!mediaPlayer) return null;

  const captionsButton = mediaPlayer.querySelector([
    'button[aria-label="자막"]',
    'button[aria-label="Captions"]',
    'button[aria-label="Subtitles"]',
    'button[data-panel-menu-trigger="true"]'
  ].join(", "));
  if (!captionsButton) return null;

  let node = captionsButton.parentElement;
  while (node && node !== mediaPlayer) {
    if (node.querySelector?.('[data-purpose="progress-display"]') && node.querySelectorAll?.("button").length >= 3) {
      return node;
    }
    node = node.parentElement;
  }

  return captionsButton.parentElement || mediaPlayer;
}

function ensureFloatingToolbar() {
  if (!document.body) return null;
  let toolbar = document.getElementById(FLOATING_TOOLBAR_ID);
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = FLOATING_TOOLBAR_ID;
    toolbar.className = "ast-floating-toolbar";
    document.body.append(toolbar);
  }
  return toolbar;
}

function clearElement(element) {
  for (const child of [...(element.children || [])]) child.remove();
  element.textContent = "";
}

function getProviderMenuHost(platform) {
  if (platform === "edx") {
    // The whole video block (player and controls), so a short player does not clip the menu.
    const video = findVideoElement("edx");
    return video?.closest(".video") || findOverlayHost(platform, video);
  }
  // On unknown sites the player can be small and clips or restyles anything inside it, so the
  // generic menu lives at the top of the page (or in the fullscreen element) and is placed by script.
  if (platform === "generic") {
    return document.fullscreenElement || document.body;
  }
  if (platform === "youtube") {
    return document.querySelector("#movie_player");
  }
  if (platform === "ted") {
    return document.querySelector("#video-player-container")
      || findOverlayHost(platform, findVideoElement(platform));
  }
  if (isVimeoPlatform(platform)) {
    return document.querySelector(".vp-player-ui-overlays")
      || document.querySelector(".vp-player")
      || findOverlayHost(platform, findVideoElement(platform));
  }
  return document.querySelector('[data-purpose="media-player-container"]')
    || findOverlayHost(platform, findVideoElement(platform));
}

function setProviderMenuVisibility(open) {
  crossFrameProviderMenuOpen = Boolean(open);
  return sendRuntimeMessage({ type: "ast.providerMenu.setOpen", open: crossFrameProviderMenuOpen });
}

function clearProviderMenuAutoCloseTimer() {
  if (providerMenuAutoCloseTimeoutId === null) return;
  clearTimeout(providerMenuAutoCloseTimeoutId);
  providerMenuAutoCloseTimeoutId = null;
}

function scheduleProviderMenuAutoClose() {
  clearProviderMenuAutoCloseTimer();
  providerMenuAutoCloseTimeoutId = setTimeout(() => {
    providerMenuAutoCloseTimeoutId = null;
    closeProviderMenu();
  }, PROVIDER_MENU_AUTO_CLOSE_DELAY_MS);
}

function closeProviderMenu({ notify = true } = {}) {
  clearProviderMenuAutoCloseTimer();
  const menu = document.getElementById(PROVIDER_MENU_ID);
  const wasOpen = Boolean(menu && !menu.hidden);
  if (menu) menu.hidden = true;
  const button = document.getElementById(BUTTON_ID);
  button?.setAttribute("aria-expanded", "false");
  if (notify && wasOpen) void setProviderMenuVisibility(false);
}

function createProviderMenuButton(className, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  const labelElement = document.createElement("span");
  labelElement.className = "ast-provider-menu-label";
  labelElement.textContent = label;
  button.append(labelElement);
  return button;
}

function getSourceCaptionTrackLabel(track) {
  return track?.label || "";
}

function getTranslationStyleLabel(styleId) {
  // A Custom style with a user label shows only that label, in brackets to set it apart from the presets.
  const customLabel = subtitleState.customStyleLabels?.[styleId];
  if (customLabel) return `[${customLabel}]`;
  return contentText(TRANSLATION_STYLE_MESSAGE_KEYS[styleId] || "styleNatural").split(/\s+-\s+/, 1)[0];
}

function applyCustomStyleLabels(settings = {}) {
  subtitleState.customStyleLabels = {
    custom: typeof settings.customStyleLabel === "string" ? settings.customStyleLabel : "",
    custom2: typeof settings.custom2StyleLabel === "string" ? settings.custom2StyleLabel : ""
  };
}

function renderSourceCaptionMenu(menu, platform) {
  const tracks = subtitleState.sourceCaptionTracks;
  const sessionKey = platformHandlers[platform]?.getSessionKey();
  const selectedTrack = getSelectedSourceCaptionTrack(platform, sessionKey);
  if (!selectedTrack) return;

  const separator = document.createElement("div");
  separator.className = "ast-provider-menu-separator";
  separator.setAttribute("role", "separator");
  menu.append(separator);

  const submenu = document.createElement("div");
  submenu.className = "ast-source-caption-submenu";

  const toggle = createProviderMenuButton(
    "ast-provider-menu-item ast-source-caption-toggle",
    `${contentText("contentSourceCaptions")}: ${getSourceCaptionTrackLabel(selectedTrack)}`
  );
  toggle.setAttribute("role", "menuitem");
  submenu.append(toggle);

  const list = document.createElement("div");
  list.className = "ast-source-caption-list";
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", contentText("contentSourceCaptions"));
  for (const track of tracks) {
    const item = createProviderMenuButton("ast-provider-menu-item ast-source-caption-item", getSourceCaptionTrackLabel(track));
    const isSelected = track.id === selectedTrack.id;
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(isSelected));
    if (isSelected) item.classList.add("active");
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      selectSourceCaptionTrack(platform, track.id).catch((error) => {
        showToast(contentText("contentCaptionsLoadFailed", [error.message]));
      });
    });
    list.append(item);
  }
  submenu.append(list);
  menu.append(submenu);
}

function renderTargetLanguageMenu(menu, platform) {
  const selectedLanguage = subtitleState.targetLanguage;
  const submenu = document.createElement("div");
  submenu.className = "ast-target-language-submenu";

  const toggle = createProviderMenuButton(
    "ast-provider-menu-item ast-target-language-toggle",
    `${contentText("targetLanguage")}: ${subtitleState.targetLanguages.find((language) => language.code === selectedLanguage)?.label || selectedLanguage}`
  );
  toggle.setAttribute("role", "menuitem");
  toggle.setAttribute("aria-haspopup", "menu");
  submenu.append(toggle);

  const list = document.createElement("div");
  list.className = "ast-target-language-list";
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", contentText("targetLanguage"));
  for (const language of subtitleState.targetLanguages) {
    const languageCode = language.code;
    const item = createProviderMenuButton("ast-provider-menu-item ast-target-language-item", language.label);
    const isSelected = languageCode === selectedLanguage;
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(isSelected));
    if (isSelected) item.classList.add("active");
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      selectTargetLanguage(platform, languageCode).catch((error) => {
        showToast(contentText("contentProviderFailed", [error.message]));
      });
    });
    list.append(item);
  }
  submenu.append(list);
  menu.append(submenu);
}

// "Translation style: <style>". While YouTube's own captions are shown as is, none of our styles
// applies, so the value names them (human captions or auto-translation) in that state's color.
function fillTranslationStyleToggleLabel(label) {
  if (!label) return;
  const prefix = `${contentText("translationStyle")}: `;
  if (getDisplayedPhase() !== "youtube-provided") {
    label.textContent = `${prefix}${getTranslationStyleLabel(subtitleState.translationStyle || "custom")}`;
    return;
  }
  const provided = document.createElement("span");
  provided.className = "ast-translation-style-provided";
  provided.textContent = contentText(subtitleState.youtubeProvidedTranslationSource === "auto"
    ? "contentStyleYoutubeProvided" : "contentStyleYoutubeHuman");
  label.textContent = prefix;
  label.append(provided);
}

function renderTranslationStyleMenu(menu, platform) {
  const selectedStyle = subtitleState.translationStyle || "custom";
  const submenu = document.createElement("div");
  submenu.className = "ast-translation-style-submenu";

  const toggle = createProviderMenuButton("ast-provider-menu-item ast-translation-style-toggle", "");
  fillTranslationStyleToggleLabel(toggle.querySelector(".ast-provider-menu-label"));
  toggle.setAttribute("role", "menuitem");
  toggle.setAttribute("aria-haspopup", "menu");
  submenu.append(toggle);

  const list = document.createElement("div");
  list.className = "ast-translation-style-list";
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", contentText("translationStyle"));
  for (const styleId of Object.keys(TRANSLATION_STYLE_MESSAGE_KEYS)) {
    const item = createProviderMenuButton("ast-provider-menu-item ast-translation-style-item", getTranslationStyleLabel(styleId));
    const isSelected = styleId === selectedStyle;
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(isSelected));
    if (isSelected) item.classList.add("active");
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      selectTranslationStyle(platform, styleId).catch((error) => {
        showToast(contentText("contentProviderFailed", [error.message]));
      });
    });
    list.append(item);
  }
  if (platform === "youtube") {
    const separator = document.createElement("div");
    separator.className = "ast-provider-menu-separator";
    separator.setAttribute("role", "separator");
    const enabled = subtitleState.preferYoutubeProvidedTranslation;
    // Same switch as the "AI subtitle translation" row so the on/off state is obvious.
    const item = createProviderMenuButton(
      "ast-provider-menu-item ast-provider-toggle-control ast-youtube-provided-toggle",
      contentText("preferYoutubeProvidedTranslation")
    );
    item.setAttribute("role", "menuitemcheckbox");
    item.setAttribute("aria-checked", String(enabled));
    const toggle = document.createElement("span");
    toggle.className = "ast-provider-toggle";
    toggle.setAttribute("aria-hidden", "true");
    item.append(toggle);
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      selectPreferYoutubeProvidedTranslation(platform, !enabled).catch((error) => {
        showToast(contentText("contentProviderFailed", [error.message]));
      });
    });
    const row = document.createElement("div");
    row.className = "ast-provider-toggle-item ast-youtube-provided-toggle-item";
    row.dataset.enabled = String(enabled);
    row.append(item);
    list.append(separator, row);
  }
  submenu.append(list);
  menu.append(submenu);
}

function renderSubtitleDisplayMenu(menu) {
  const submenu = document.createElement("div");
  submenu.className = "ast-subtitle-display-submenu";
  if (reopenSubtitleDisplaySubmenu) submenu.classList.add("ast-submenu-open");
  submenu.addEventListener("mouseleave", () => submenu.classList.remove("ast-submenu-open"));
  const selectedMode = subtitleState.subtitleDisplayMode;
  const toggle = createProviderMenuButton(
    "ast-provider-menu-item ast-subtitle-display-toggle",
    `${contentText("contentSubtitleDisplay")}: ${contentText(SUBTITLE_DISPLAY_MESSAGE_KEYS[selectedMode])}`
  );
  toggle.setAttribute("role", "menuitem");
  toggle.setAttribute("aria-haspopup", "menu");
  submenu.append(toggle);

  const list = document.createElement("div");
  list.className = "ast-subtitle-display-list";
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", contentText("contentSubtitleDisplay"));
  const showWordHighlight = detectPlatform() === "youtube";
  for (const [mode, messageKey] of Object.entries(SUBTITLE_DISPLAY_MESSAGE_KEYS)) {
    const withWordHighlight = mode === "source" && showWordHighlight;
    // Each row holds the font size buttons (and the source row the word-highlight switch), so it is
    // a div: a button cannot contain buttons.
    const item = document.createElement("div");
    item.className = "ast-provider-menu-item ast-subtitle-display-item";
    const label = document.createElement("span");
    label.className = "ast-provider-menu-label";
    label.textContent = contentText(messageKey);
    item.append(label);
    item.dataset.mode = mode;
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(mode === selectedMode));
    if (mode === selectedMode) item.classList.add("active");
    const select = () => selectSubtitleDisplayMode(mode).catch((error) => showToast(error.message));
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      keepSubtitleDisplaySubmenuOpen(item, false);
      select();
    });
    item.tabIndex = 0;
    item.addEventListener("keydown", (event) => {
      if (event.target !== item || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      event.stopPropagation();
      keepSubtitleDisplaySubmenuOpen(item, false);
      select();
    });
    if (withWordHighlight) item.append(renderWordHighlightToggle());
    item.append(renderSubtitleFontSizeControl(mode));
    list.append(item);
  }
  list.append(...renderTranslationPositionControl());
  submenu.append(list);
  menu.append(submenu);
}

// "Download subtitles" submenu: original or translation, as SRT (timed) or TXT (plain text).
function getDownloadCues() {
  const video = resolveRenderVideo(subtitleState.currentVideo);
  return Array.isArray(video?.astSubtitleCues) ? video.astSubtitleCues : [];
}

function renderSubtitleDownloadMenu(menu) {
  const exporter = globalThis.astSubtitleExport;
  if (!exporter) return;
  const submenu = document.createElement("div");
  submenu.className = "ast-subtitle-download-submenu";
  const toggle = createProviderMenuButton("ast-provider-menu-item ast-subtitle-download-toggle", contentText("contentDownloadSubtitles"));
  toggle.setAttribute("role", "menuitem");
  toggle.setAttribute("aria-haspopup", "menu");
  submenu.append(toggle);

  const cues = getDownloadCues();
  const list = document.createElement("div");
  list.className = "ast-subtitle-download-list";
  list.setAttribute("role", "group");
  list.setAttribute("aria-label", contentText("contentDownloadSubtitles"));
  const rows = [
    ["source", "contentDownloadSource", cues.length > 0],
    ["translation", "contentDownloadTranslation", exporter.hasTranslation(cues)]
  ];
  for (const [kind, messageKey, available] of rows) {
    const row = document.createElement("div");
    row.className = "ast-provider-menu-item ast-translation-position-row ast-subtitle-download-row";
    row.dataset.kind = kind;
    const label = document.createElement("span");
    label.className = "ast-provider-menu-label";
    label.textContent = contentText(messageKey);
    if (!available && kind === "translation") label.title = contentText("contentDownloadNoTranslation");
    const group = document.createElement("div");
    group.className = "ast-segmented-control";
    group.setAttribute("role", "group");
    for (const format of ["srt", "txt"]) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "ast-segmented-option";
      option.textContent = format.toUpperCase();
      option.dataset.kind = kind;
      option.dataset.format = format;
      option.setAttribute("role", "menuitem");
      option.disabled = !available;
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        try {
          downloadSubtitleFile(kind, format);
        } catch (error) {
          showToast(error.message, subtitleState.currentVideo, true);
        }
      });
      group.append(option);
    }
    row.append(label, group);
    list.append(row);
  }
  list.append(renderSummaryDownloadRow(cues.length > 0));
  submenu.append(list);
  menu.append(submenu);
}

// "Summary" row: one button that asks the active LLM for a summary and saves it as Markdown.
function renderSummaryDownloadRow(hasCues) {
  const row = document.createElement("div");
  row.className = "ast-provider-menu-item ast-translation-position-row ast-subtitle-download-row";
  row.dataset.kind = "summary";
  const label = document.createElement("span");
  label.className = "ast-provider-menu-label";
  label.textContent = contentText("contentDownloadSummary");
  const group = document.createElement("div");
  group.className = "ast-segmented-control";
  group.setAttribute("role", "group");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ast-segmented-option ast-summary-download";
  button.dataset.kind = "summary";
  button.setAttribute("role", "menuitem");
  const job = subtitleState.summaryJob;
  const hasLlm = Boolean(subtitleState.activeProviderId) && !isMachineTranslationProvider(subtitleState.activeProviderId);
  // Progress shows on the status line at the bottom of the menu.
  button.textContent = contentText("contentDownloadSummaryAction");
  button.disabled = Boolean(job) || !hasLlm || !hasCues;
  if (!hasLlm) label.title = contentText("contentDownloadSummaryNeedsLlm");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    downloadSummaryFile().catch((error) => setSummaryNotice({ text: contentText("contentSummaryFailed", [error.message]), failed: true }));
  });
  group.append(button);
  row.append(label, group);
  return row;
}

function summaryProgressText(job) {
  return contentText("contentSummaryProgress", [String(Math.min(job.step + 1, job.total)), String(job.total)]);
}

function updateSummaryProgress(requestId, progress) {
  const job = subtitleState.summaryJob;
  if (!job || job.requestId !== requestId) return;
  if (!Number.isFinite(progress?.step) || !Number.isFinite(progress?.total) || progress.total < 1) return;
  job.step = progress.step;
  job.total = progress.total;
  refreshOpenProviderMenu();
}

const SUMMARY_SAVED_NOTICE_MS = 8000;
let summaryNoticeTimeoutId = null;

// The last summary result on the status line; a failure stays until the next summary starts.
function setSummaryNotice(notice, durationMs = 0) {
  clearTimeout(summaryNoticeTimeoutId);
  summaryNoticeTimeoutId = null;
  subtitleState.summaryNotice = notice;
  if (notice && durationMs > 0) {
    summaryNoticeTimeoutId = setTimeout(() => {
      summaryNoticeTimeoutId = null;
      subtitleState.summaryNotice = null;
      updateProviderMenuStatus();
    }, durationMs);
  }
  updateProviderMenuStatus();
}

function getDownloadTitle() {
  return globalThis.astSubtitleExport.sanitizeFileName((document.title || "").replace(/\s*[-–|]\s*YouTube\s*$/i, ""));
}

async function downloadSummaryFile() {
  if (subtitleState.summaryJob) return;
  const exporter = globalThis.astSubtitleExport;
  const sourceLanguage = subtitleState.currentSourceDocument?.sourceLanguage || subtitleState.currentDocument?.sourceLanguage || "";
  const text = exporter.buildTxt(getDownloadCues(), "source", { language: sourceLanguage });
  if (!text) throw new Error(contentText("contentDownloadEmpty"));
  const requestId = `summary-${Date.now()}`;
  subtitleState.summaryJob = { requestId, step: 0, total: 1 };
  setSummaryNotice(null);
  refreshOpenProviderMenu();
  try {
    const title = getDownloadTitle();
    const response = await sendRuntimeMessage({ type: "summary.generate", text, title, requestId });
    if (!response?.ok) throw new Error(response?.error || "Summary failed.");
    const language = subtitleState.targetLanguage || "";
    saveTextFile(`${title}.summary${language ? `.${language}` : ""}.md`, `${response.summary.trim()}\n`, "text/markdown;charset=utf-8");
    setSummaryNotice({ text: contentText("contentSummarySaved") }, SUMMARY_SAVED_NOTICE_MS);
  } catch (error) {
    // Shown on the menu status line, not as a popup over the video.
    setSummaryNotice({ text: contentText("contentSummaryFailed", [error.message]), failed: true });
  } finally {
    subtitleState.summaryJob = null;
    refreshOpenProviderMenu();
  }
}

function saveTextFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function downloadSubtitleFile(kind, format) {
  const exporter = globalThis.astSubtitleExport;
  const cues = getDownloadCues();
  const language = kind === "source"
    ? (subtitleState.currentSourceDocument?.sourceLanguage || subtitleState.currentDocument?.sourceLanguage || "")
    : (subtitleState.targetLanguage || "");
  const content = format === "srt"
    ? exporter.buildSrt(cues, kind)
    : exporter.buildTxt(cues, kind, { language });
  if (!content) throw new Error(contentText("contentDownloadEmpty"));
  const suffix = language ? `.${language}` : `.${kind}`;
  saveTextFile(
    `${getDownloadTitle()}${suffix}.${format}`,
    content,
    format === "srt" ? "application/x-subrip;charset=utf-8" : "text/plain;charset=utf-8"
  );
}

// Switch at the right of the "Source subtitles" row: colors the spoken words of the source line as it plays.
function renderWordHighlightToggle() {
  const on = subtitleState.wordProgressHighlight !== false;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ast-word-highlight-toggle";
  if (on) button.classList.add("active");
  button.textContent = contentText("contentWordHighlight");
  button.setAttribute("role", "menuitemcheckbox");
  button.setAttribute("aria-checked", String(on));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    keepSubtitleDisplaySubmenuOpen(button);
    selectWordProgressHighlight(!on).catch((error) => showToast(error.message));
  });
  return button;
}

async function selectWordProgressHighlight(enabled) {
  const response = await sendRuntimeMessage({ type: "settings.setWordProgressHighlight", enabled });
  if (!response?.ok) throw new Error(response?.error || "Could not save word highlight.");
  subtitleState.wordProgressHighlight = enabled;
  if (subtitleState.currentVideo) renderCurrentOverlayCue(subtitleState.currentVideo);
  refreshOpenProviderMenu();
}

// Font size, right on each display row: "Source" and "Translated" change their own line, and
// "Dual" moves both by the same step. The overlay updates at once; the save waits for a pause.
const SUBTITLE_FONT_SIZE_MIN = 10;
const SUBTITLE_FONT_SIZE_MAX = 64;
const SUBTITLE_FONT_SIZE_SAVE_DELAY_MS = 400;
let subtitleFontSizeSaveTimer = null;
let pendingSubtitleFontSizePatch = null;

function getSubtitleFontSizes(style = subtitleState.subtitleStyle || {}) {
  return {
    source: clampNumber(style.sourceFontSize ?? style.fontSize, SUBTITLE_FONT_SIZE_MIN, SUBTITLE_FONT_SIZE_MAX, 30),
    translated: clampNumber(style.fontSize, SUBTITLE_FONT_SIZE_MIN, SUBTITLE_FONT_SIZE_MAX, 30)
  };
}

function getSubtitleFontSizePatch(mode, delta, sizes = getSubtitleFontSizes()) {
  const step = (value) => clampNumber(Math.round(value + delta), SUBTITLE_FONT_SIZE_MIN, SUBTITLE_FONT_SIZE_MAX, value);
  const patch = {};
  if (mode === "source" || mode === "dual") patch.sourceFontSize = step(sizes.source);
  if (mode === "translated" || mode === "dual") patch.fontSize = step(sizes.translated);
  return patch;
}

function renderSubtitleFontSizeControl(mode) {
  const sizes = getSubtitleFontSizes();
  const control = document.createElement("span");
  control.className = "ast-font-size-control";
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", contentText("contentFontSize"));
  // The dual row moves both lines; their sizes show on the two rows below it.
  if (mode !== "dual") {
    const value = document.createElement("span");
    value.className = "ast-font-size-value";
    value.textContent = String(mode === "source" ? sizes.source : sizes.translated);
    control.append(value);
  }
  for (const [delta, text, messageKey] of [[-1, "\u2212", "contentFontSizeDecrease"], [1, "+", "contentFontSizeIncrease"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ast-font-size-button";
    button.textContent = text;
    button.setAttribute("aria-label", contentText(messageKey));
    button.title = contentText(messageKey);
    const patch = getSubtitleFontSizePatch(mode, delta, sizes);
    button.disabled = (patch.sourceFontSize ?? sizes.source) === sizes.source
      && (patch.fontSize ?? sizes.translated) === sizes.translated;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      keepSubtitleDisplaySubmenuOpen(button);
      changeSubtitleFontSize(mode, delta);
    });
    button.addEventListener("keydown", (event) => event.stopPropagation());
    control.append(button);
  }
  return control;
}

function changeSubtitleFontSize(mode, delta) {
  const patch = getSubtitleFontSizePatch(mode, delta);
  if (Object.keys(patch).length === 0) return;
  subtitleState.subtitleStyle = { ...(subtitleState.subtitleStyle || {}), ...patch };
  refreshActiveOverlayStyle();
  if (subtitleState.currentVideo) renderCurrentOverlayCue(subtitleState.currentVideo);
  refreshOpenProviderMenu();
  pendingSubtitleFontSizePatch = { ...(pendingSubtitleFontSizePatch || {}), ...patch };
  clearTimeout(subtitleFontSizeSaveTimer);
  subtitleFontSizeSaveTimer = setTimeout(() => {
    const toSave = pendingSubtitleFontSizePatch;
    pendingSubtitleFontSizePatch = null;
    // Saved without taking the reply back, so clicks made while it is on its way are not undone.
    sendRuntimeMessage({ type: "settings.updateSubtitleStyle", patch: toSave })
      .then((response) => {
        if (!response?.ok) console.warn("[AST] Failed to save subtitle font size:", response?.error || "Unknown error");
      })
      .catch((error) => console.warn("[AST] Failed to save subtitle font size:", error.message));
  }, SUBTITLE_FONT_SIZE_SAVE_DELAY_MS);
}

// "Translation position: top | bottom" at the bottom of the display submenu; it orders the dual lines.
function renderTranslationPositionControl() {
  const separator = document.createElement("div");
  separator.className = "ast-provider-menu-separator";
  separator.setAttribute("role", "separator");
  const row = document.createElement("div");
  row.className = "ast-provider-menu-item ast-translation-position-row";
  const label = document.createElement("span");
  label.className = "ast-provider-menu-label";
  label.textContent = contentText("contentTranslationPosition");
  const group = document.createElement("div");
  group.className = "ast-segmented-control";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", contentText("contentTranslationPosition"));
  const onTop = subtitleState.subtitleStyle?.translationOnTop === true;
  for (const [value, messageKey] of [[true, "contentTranslationPositionTop"], [false, "contentTranslationPositionBottom"]]) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "ast-segmented-option";
    option.textContent = contentText(messageKey);
    option.dataset.onTop = String(value);
    option.setAttribute("role", "menuitemradio");
    option.setAttribute("aria-checked", String(value === onTop));
    if (value === onTop) option.classList.add("active");
    option.addEventListener("click", (event) => {
      event.stopPropagation();
      keepSubtitleDisplaySubmenuOpen(option);
      selectTranslationPosition(value).catch((error) => showToast(error.message));
    });
    group.append(option);
  }
  row.append(label, group);
  return [separator, row];
}

async function selectTranslationPosition(onTop) {
  if ((subtitleState.subtitleStyle?.translationOnTop === true) === onTop) return;
  subtitleState.subtitleStyle = { ...(subtitleState.subtitleStyle || {}), translationOnTop: onTop };
  if (subtitleState.currentVideo) renderCurrentOverlayCue(subtitleState.currentVideo);
  refreshOpenProviderMenu();
  await saveSubtitleStyle({ translationOnTop: onTop });
}

async function selectSubtitleDisplayMode(mode) {
  const response = await sendRuntimeMessage({ type: "settings.setSubtitleDisplayMode", mode });
  if (!response?.ok) throw new Error(response?.error || "Could not save subtitle display mode.");
  subtitleState.subtitleDisplayMode = mode;
  if (subtitleState.currentVideo) renderCurrentOverlayCue(subtitleState.currentVideo);
  refreshOpenProviderMenu();
}

function renderProviderMenu(platform = detectPlatform()) {
  const menu = document.getElementById(PROVIDER_MENU_ID);
  if (!menu) return;
  clearElement(menu);
  menu.dataset.phase = getDisplayedPhase();

  const toggleButton = createProviderMenuButton(
    "ast-provider-menu-item ast-provider-toggle-control",
    contentText("contentToggleSubtitles")
  );
  toggleButton.setAttribute("role", "menuitemcheckbox");
  toggleButton.setAttribute("aria-checked", String(subtitleState.enabled));
  const toggle = document.createElement("span");
  toggle.className = "ast-provider-toggle";
  toggle.setAttribute("aria-hidden", "true");
  toggleButton.append(toggle);
  const toggleTranslation = (event) => {
    event.stopPropagation();
    Promise.resolve(toggleSubtitles(platform))
      .catch((error) => showToast(error.message))
      .finally(() => renderProviderMenu(platform));
  };
  toggleButton.addEventListener("click", toggleTranslation);

  const toggleRow = document.createElement("div");
  toggleRow.className = "ast-provider-toggle-item";
  toggleRow.dataset.enabled = String(subtitleState.enabled);
  toggleRow.append(toggleButton);
  toggleRow.addEventListener("click", (event) => {
    if (!event.target) toggleTranslation(event);
  });

  const retranslateButton = document.createElement("button");
  retranslateButton.type = "button";
  retranslateButton.className = "ast-provider-retranslate";
  retranslateButton.title = contentText("contentRetranslateCurrentVideo");
  retranslateButton.setAttribute("aria-label", contentText("contentRetranslateCurrentVideo"));
  const retranslateIcon = document.createElement("span");
  retranslateIcon.className = "ast-provider-retranslate-icon";
  retranslateIcon.setAttribute("aria-hidden", "true");
  retranslateIcon.textContent = "↻";
  retranslateButton.append(retranslateIcon);
  const currentHandler = platformHandlers[platform];
  const hasCurrentDocument = Boolean(subtitleState.currentDocument
    && subtitleState.currentPlatform === platform
    && subtitleState.currentSessionKey
    && currentHandler?.getSessionKey() === subtitleState.currentSessionKey);
  retranslateButton.disabled = !hasCurrentDocument || subtitleState.loading || subtitleState.retranslatingCurrentVideo;
  retranslateButton.addEventListener("click", (event) => {
    event.stopPropagation();
    retranslateCurrentVideo(platform).catch((error) => showToast(error.message));
  });
  toggleRow.append(retranslateButton);

  for (const provider of subtitleState.availableProviders) {
    const isActive = provider.id === subtitleState.activeProviderId;
    const item = createProviderMenuButton("ast-provider-menu-item ast-provider-item", provider.label);
    item.dataset.providerId = provider.id;
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(isActive));
    if (isActive) item.classList.add("active");

    // Spins while switching to this provider, or while it writes a summary.
    if (provider.id === subtitleState.pendingProviderId || (isActive && subtitleState.summaryJob)) {
      const spinner = document.createElement("span");
      spinner.className = "ast-provider-spinner";
      spinner.setAttribute("aria-hidden", "true");
      item.prepend(spinner);
      item.classList.add("pending");
    }

    // Machine translation has no model to choose; LLM providers show the one they are set to.
    if (provider.model && !isMachineTranslationProvider(provider.id)) {
      const model = document.createElement("span");
      model.className = "ast-provider-model";
      // OpenRouter and NVIDIA NIM ids carry the model maker ("openai/gpt-oss-120b"); the name alone fits better.
      model.textContent = ["openrouter", "nvidiaNim"].includes(provider.id)
        ? provider.model.replace(/^[^/]+\//, "")
        : provider.model;
      model.title = provider.model;
      item.append(model);
    }

    const indicator = document.createElement("span");
    indicator.className = "ast-provider-selection-indicator";
    indicator.setAttribute("aria-hidden", "true");
    item.append(indicator);
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      selectMenuProvider(platform, provider.id).catch((error) => {
        showToast(contentText("contentProviderFailed", [error.message]));
      });
    });
    menu.append(item);
  }

  renderSourceCaptionMenu(menu, platform);
  renderTargetLanguageMenu(menu, platform);
  renderTranslationStyleMenu(menu, platform);
  renderSubtitleDisplayMenu(menu);
  renderSubtitleDownloadMenu(menu);

  const lastSeparator = document.createElement("div");
  lastSeparator.className = "ast-provider-menu-separator";
  lastSeparator.setAttribute("role", "separator");
  menu.append(lastSeparator);
  menu.append(toggleRow);

  const settingsButton = createProviderMenuButton(
    "ast-provider-menu-item ast-provider-settings-item",
    contentText("contentOpenSettings")
  );
  settingsButton.setAttribute("role", "menuitem");
  settingsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeProviderMenu();
    sendRuntimeMessage({ type: "ast.openOptions" });
  });
  menu.append(settingsButton);

  // Read-only status; it never takes focus or clicks, so it stays out of the menu's keyboard order.
  const statusLine = document.createElement("div");
  statusLine.className = "ast-provider-status";
  statusLine.setAttribute("role", "status");
  const statusDot = document.createElement("span");
  statusDot.className = "ast-provider-status-dot";
  statusDot.setAttribute("aria-hidden", "true");
  const statusText = document.createElement("span");
  statusText.className = "ast-provider-status-text";
  statusLine.append(statusDot, statusText);
  menu.append(statusLine);
  updateProviderMenuStatus();
}

async function retranslateCurrentVideo(platform) {
  if (subtitleState.retranslatingCurrentVideo || !subtitleState.currentDocument
    || subtitleState.currentPlatform !== platform
    || !subtitleState.currentSessionKey
    || getCurrentSessionKey(platform) !== subtitleState.currentSessionKey) return;

  subtitleState.retranslatingCurrentVideo = true;
  renderProviderMenu(platform);
  try {
    const response = await sendRuntimeMessage({
      type: "translation.clearVideoCache",
      platform,
      videoId: subtitleState.currentVideoId
    });
    if (!response?.ok) throw new Error(response?.error || "Could not clear this video's translation cache.");

    const configuredProviders = await getTranslationProviderIds();
    const providerId = subtitleState.activeProviderId || configuredProviders.activeProviderId || "googleTranslate";
    const defaultProviderId = subtitleState.defaultProviderId || configuredProviders.defaultProviderId;
    subtitleState.enabled = true;
    setOverlayVisible(subtitleState.currentVideo, true);
    setButtonState(true, false);
    startProviderTranslation(
      subtitleState.currentDocument,
      platform,
      subtitleState.currentSessionKey,
      subtitleState.currentVideo,
      providerId,
      defaultProviderId,
      // Asking to retranslate means the selected provider's translation, not YouTube's captions again.
      { skipTemporaryTranslation: true, skipYoutubeProvidedTranslation: true }
    );
  } finally {
    subtitleState.retranslatingCurrentVideo = false;
    renderProviderMenu(platform);
  }
}

// Anchors the overlay, menu, and toast. edX switches its player to position: fixed (and the inner
// wrappers to static) for fullscreen, so an inline position there would pin the player at its
// normal size; a class that steps aside in fullscreen is used instead.
function makePositionedHost(host, platform = subtitleState.currentPlatform || detectPlatform()) {
  if (!host) return;
  if (platform === "edx") {
    host.classList.add("ast-edx-position-host");
    return;
  }
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
}

function ensureProviderMenu(platform) {
  const host = getProviderMenuHost(platform);
  if (!host) return null;
  if (platform !== "generic") makePositionedHost(host, platform);
  let menu = document.getElementById(PROVIDER_MENU_ID);
  if (!menu) {
    menu = document.createElement("div");
    menu.id = PROVIDER_MENU_ID;
    menu.className = `ast-provider-menu ast-provider-menu-${platform}`;
    menu.dataset.platform = platform;
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", contentText("contentMenuTitle"));
    menu.hidden = true;
    menu.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    menu.addEventListener("mousedown", (event) => {
      event.stopPropagation();
    });
    const cancelAutoClose = () => clearProviderMenuAutoCloseTimer();
    menu.addEventListener("pointerover", cancelAutoClose);
    menu.addEventListener("pointerleave", scheduleProviderMenuAutoClose);
    menu.addEventListener("pointerdown", cancelAutoClose, { capture: true });
    menu.addEventListener("click", cancelAutoClose, { capture: true });
    menu.addEventListener("focusin", cancelAutoClose);
    menu.addEventListener("focusout", (event) => {
      if (!menu.contains(event.relatedTarget)) scheduleProviderMenuAutoClose();
    });
  } else {
    menu.className = `ast-provider-menu ast-provider-menu-${platform}`;
    menu.dataset.platform = platform;
  }
  if (menu.parentElement !== host) host.append(menu);
  if (platform === "generic") watchGenericProviderMenuPosition(menu);
  return menu;
}

const GENERIC_MENU_MARGIN_PX = 8;
// Room a submenu needs on the left (the display list with its font size buttons is the widest).
const GENERIC_SUBMENU_ROOM_PX = 420;

// Places the generic menu under its button, right-aligned to it, kept inside the viewport.
// If there is no room below, it opens above the button instead.
function positionGenericProviderMenu(menu = document.getElementById(PROVIDER_MENU_ID)) {
  if (!menu || menu.hidden || menu.dataset.platform !== "generic") return;
  const button = document.getElementById(BUTTON_ID);
  const anchor = button?.getBoundingClientRect();
  if (!anchor || (anchor.width === 0 && anchor.height === 0)) return;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const height = menu.offsetHeight;
  const width = menu.offsetWidth;
  const below = anchor.bottom + 6;
  const above = anchor.top - 6 - height;
  const top = below + height <= viewportHeight - GENERIC_MENU_MARGIN_PX || above < GENERIC_MENU_MARGIN_PX
    ? Math.min(below, Math.max(GENERIC_MENU_MARGIN_PX, viewportHeight - GENERIC_MENU_MARGIN_PX - height))
    : above;
  const right = Math.min(
    Math.max(GENERIC_MENU_MARGIN_PX, viewportWidth - anchor.right),
    Math.max(GENERIC_MENU_MARGIN_PX, viewportWidth - GENERIC_MENU_MARGIN_PX - width)
  );
  menu.style.top = `${Math.round(top)}px`;
  menu.style.right = `${Math.round(right)}px`;
  // Submenus open to the left; near the left edge they open to the right instead.
  const left = viewportWidth - right - width;
  menu.classList.toggle("ast-provider-menu-flyout-right", left < GENERIC_SUBMENU_ROOM_PX && viewportWidth - (left + width) > left);
}

function watchGenericProviderMenuPosition(menu) {
  if (menu.astGenericPositionWatched) return;
  menu.astGenericPositionWatched = true;
  const reposition = () => positionGenericProviderMenu(menu);
  // Re-renders change the menu's size; scrolling and resizing move the button.
  if (typeof ResizeObserver === "function") new ResizeObserver(reposition).observe(menu);
  window.addEventListener("resize", reposition, { passive: true });
  window.addEventListener("scroll", reposition, { passive: true, capture: true });
  document.addEventListener("fullscreenchange", () => {
    const host = getProviderMenuHost("generic");
    if (host && menu.parentElement !== host) host.append(menu);
    reposition();
  });
}

async function refreshAvailableProviders() {
  const settings = await getPublicSettings();
  subtitleState.availableProviders = getAvailableProviders(settings);
  const activeProviderAvailable = subtitleState.availableProviders
    .some((provider) => provider.id === settings.activeProvider);
  subtitleState.activeProviderId = activeProviderAvailable ? settings.activeProvider : "googleTranslate";
  subtitleState.translationStyle = settings.translationStyle || "custom";
  applyCustomStyleLabels(settings);
  subtitleState.preferYoutubeProvidedTranslation = settings.preferYoutubeProvidedTranslation !== false;
  applyCaptionDisplaySettings(settings);
  subtitleState.targetLanguages = settings.targetLanguages || subtitleState.targetLanguages;
  subtitleState.targetLanguage = settings.targetLanguage || "";
  subtitleState.subtitleDisplayMode = Object.hasOwn(SUBTITLE_DISPLAY_MESSAGE_KEYS, settings.subtitleDisplayMode)
    ? settings.subtitleDisplayMode : "dual";
  subtitleState.defaultProviderId = resolveDefaultTranslationProviderId(settings);
  subtitleState.temporaryPriorityWindowSeconds = resolveTemporaryPriorityWindowSeconds(settings);
  return settings;
}

async function refreshSourceCaptionTracks(platform) {
  const handler = platformHandlers[platform];
  const sessionKey = handler?.getSessionKey();
  if (!handler || !sessionKey || !handler.listCaptionTracks) return null;
  await ensureSourceCaptionLanguages();
  if (subtitleState.sourceCaptionSessionKey === `${platform}:${sessionKey}` && subtitleState.sourceCaptionTracks.length > 0) {
    return getSelectedSourceCaptionTrack(platform, sessionKey);
  }
  const tracks = await handler.listCaptionTracks();
  return setSourceCaptionTracks(platform, sessionKey, tracks);
}

async function toggleProviderMenu(platform) {
  const menu = ensureProviderMenu(platform);
  if (!menu || subtitleState.disposed) return;
  if (!menu.hidden) {
    closeProviderMenu();
    return;
  }

  if (subtitleState.availableProviders.length === 0) {
    subtitleState.availableProviders = getAvailableProviders();
    subtitleState.activeProviderId ||= "googleTranslate";
    subtitleState.defaultProviderId ||= "googleTranslate";
  }
  renderProviderMenu(platform);
  menu.hidden = false;
  if (platform === "generic") positionGenericProviderMenu(menu);
  document.getElementById(BUTTON_ID)?.setAttribute("aria-expanded", "true");
  void setProviderMenuVisibility(true);
  scheduleProviderMenuAutoClose();

  try {
    await Promise.all([refreshAvailableProviders(), refreshSourceCaptionTracks(platform)]);
  } catch (error) {
    console.warn("[AST] Failed to load provider menu:", error.message);
    subtitleState.availableProviders = getAvailableProviders();
    subtitleState.activeProviderId ||= "googleTranslate";
    subtitleState.defaultProviderId ||= "googleTranslate";
  }
  if (menu.hidden || menu.dataset.platform !== platform) return;
  renderProviderMenu(platform);
}

async function selectSourceCaptionTrack(platform, trackId) {
  const handler = platformHandlers[platform];
  const sessionKey = handler?.getSessionKey();
  const track = subtitleState.sourceCaptionTracks.find((item) => item.id === trackId);
  if (!handler || !sessionKey || !track || subtitleState.loading) return;
  if (track.id === subtitleState.selectedSourceCaptionTrackId) {
    renderProviderMenu(platform);
    return;
  }

  subtitleState.selectedSourceCaptionTrackId = track.id;
  if (track.languageCode) {
    subtitleState.sourceCaptionLanguages = { ...(subtitleState.sourceCaptionLanguages || {}), [platform]: track.languageCode };
    sendRuntimeMessage({ type: "settings.setSourceCaptionLanguage", platform, languageCode: track.languageCode }).catch(() => {});
  }
  if (!subtitleState.enabled) {
    renderProviderMenu(platform);
    return;
  }

  subtitleState.loading = true;
  setButtonState(true, true);
  showOverlayMessage(handler.findVideo(), handler.loadingMessage);
  try {
    await loadPlatformSubtitleOverlay(handler);
  } finally {
    subtitleState.loading = false;
    setButtonState(subtitleState.enabled, false);
    refreshOpenProviderMenu();
  }
}

// Redrawing replaces the display submenu, which only stays open while hovered, so a click inside it
// would close it. The switches in it (word highlight, translation position) mark it open so the new
// one is re-opened; picking a display mode leaves it unmarked and closes it.
let reopenSubtitleDisplaySubmenu = false;

function keepSubtitleDisplaySubmenuOpen(element, open = true) {
  element.closest(".ast-subtitle-display-submenu")?.classList.toggle("ast-submenu-open", open);
}

function refreshOpenProviderMenu() {
  const menu = document.getElementById(PROVIDER_MENU_ID);
  if (!menu || menu.hidden) return;
  reopenSubtitleDisplaySubmenu = Boolean(menu.querySelector(".ast-subtitle-display-submenu.ast-submenu-open"));
  try {
    renderProviderMenu(menu.dataset.platform || detectPlatform());
  } finally {
    reopenSubtitleDisplaySubmenu = false;
  }
}

function updateOpenProviderMenuPhase() {
  const menu = document.getElementById(PROVIDER_MENU_ID);
  if (menu && !menu.hidden) {
    menu.dataset.phase = getDisplayedPhase();
    fillTranslationStyleToggleLabel(menu.querySelector(".ast-translation-style-toggle .ast-provider-menu-label"));
  }
  updateProviderMenuStatus();
}

function findVideoElement(platform) {
  if (platform === "edx") {
    // A unit can hold several video blocks; the one played last, else the first with media.
    const videos = [...document.querySelectorAll(EDX_VIDEO_SELECTOR)]
      .filter((video) => video.readyState >= 1 || video.currentSrc);
    return videos.find((video) => !video.paused) || videos[0] || null;
  }

  if (platform === "generic") {
    return typeof findGenericVideo === "function" ? findGenericVideo() : null;
  }

  if (platform === "deeplearningai") {
    // The server-rendered page has a bare <video> that the Vidstack player replaces on load; wait
    // until the player's own video has media so the overlay and time listeners stay attached.
    const player = document.querySelector(DLAI_VIDEO_SELECTOR);
    return player && (player.readyState >= 1 || player.currentSrc) ? player : null;
  }

  if (platform === "nvidiaOnDemand") {
    // The page has other decorative <video> elements; use the Kaltura player's once it has media.
    const player = document.querySelector(PLAYKIT_VIDEO_SELECTOR);
    return player && (player.readyState >= 1 || player.currentSrc) ? player : null;
  }

  if (platform === "oreilly") {
    // The Kaltura player mounts after the page; wait until its own video has media.
    const player = document.querySelector(PLAYKIT_VIDEO_SELECTOR);
    return player && (player.readyState >= 1 || player.currentSrc) ? player : null;
  }

  if (platform === "linkedin") {
    // On a fresh page load the player mounts and swaps its <video> within the first moments, so
    // an early element would lose the overlay and its time listeners. Wait until it has media.
    const player = document.querySelector(LINKEDIN_VIDEO_SELECTOR);
    return player && (player.readyState >= 1 || player.currentSrc) ? player : null;
  }

  if (platform === "coursera") {
    return document.querySelector(COURSERA_VIDEO_SELECTOR) || document.querySelector("video");
  }

  if (platform === "udemy") {
    return document.querySelector("video");
  }

  if (platform === "youtube") {
    return document.querySelector("#movie_player video, video");
  }

  if (platform === "ted") {
    return document.querySelector("#video-player-container video#video, video#video");
  }

  if (isVimeoPlatform(platform)) {
    return document.querySelector("video");
  }

  return null;
}

function findOverlayHost(platform, video) {
  if (platform === "edx") {
    return video?.closest(".video-player") || video?.parentElement || null;
  }

  if (platform === "generic") {
    return video?.parentElement || null;
  }

  if (platform === "deeplearningai") {
    return video?.closest("media-player") || video?.closest(".lesson-video-player") || video?.parentElement || null;
  }

  if (platform === "nvidiaOnDemand") {
    return video?.closest(".playkit-player") || video?.parentElement || null;
  }

  if (platform === "oreilly") {
    return video?.closest(".playkit-player") || video?.parentElement || null;
  }

  if (platform === "linkedin") {
    return video?.closest(".video-js") || video?.parentElement || null;
  }

  if (platform === "coursera") {
    return document.querySelector(COURSERA_PLAYER_HOST_SELECTOR) || video?.parentElement || null;
  }

  if (platform === "youtube") {
    return document.querySelector("#movie_player") || video?.parentElement || null;
  }

  if (platform === "ted") {
    return document.querySelector("#video-player-container") || video?.parentElement || null;
  }

  if (isVimeoPlatform(platform)) {
    return document.querySelector(".vp-player-ui-overlays") || video?.parentElement || null;
  }

  return video?.parentElement || null;
}

function findOverlay(video, platform = subtitleState.currentPlatform || detectPlatform()) {
  return findOverlayHost(platform, video)?.querySelector(`#${OVERLAY_ID}`) || null;
}

function isYoutubeAdPlaying() {
  if ((subtitleState.currentPlatform || detectPlatform()) !== "youtube") return false;
  const player = document.querySelector("#movie_player");
  return Boolean(player?.classList.contains("ad-showing") || player?.classList.contains("ad-interrupting"));
}

const YOUTUBE_AD_WAIT_MS = 500;
const YOUTUBE_AD_WAIT_LIMIT_MS = 120_000;

async function waitForYoutubeAdToEnd(videoId) {
  const deadline = Date.now() + YOUTUBE_AD_WAIT_LIMIT_MS;
  while (isYoutubeAdPlaying() && getYoutubeVideoId() === videoId && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, YOUTUBE_AD_WAIT_MS));
  }
}

function getUdemyLectureId() {
  const match = location.pathname.match(/\/lectures?\/(\d+)/);
  return match?.[1] || null;
}

function getYoutubeVideoId() {
  try {
    const url = new URL(location.href);
    const watchVideoId = url.searchParams.get("v");
    if (/^[a-zA-Z0-9_-]{11}$/.test(watchVideoId || "")) {
      return watchVideoId;
    }
  } catch (_error) {
    // Fall through to pathname parsing.
  }

  // Shorts play in their own player without the caption controls this extension drives, so a
  // Shorts page is not a session: the watch video's subtitles stay as they were for the way back.
  const pathMatch = location.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
  return pathMatch?.[1] || null;
}

function getVimeoVideoId() {
  const match = location.pathname.match(/(?:^|\/)(\d+)(?:\/[a-zA-Z0-9_-]+)?\/?$/);
  return match?.[1] || null;
}

// Player markup (video.js lecture player, and the newer playerContainer player).
const COURSERA_VIDEO_SELECTOR = ".vjs-tech, [data-testid=playerContainer] video";
const COURSERA_CONTROLS_SELECTOR = ".vjs-control-bar, [data-testid=playerContainer] .icon-container";
const COURSERA_PLAYER_HOST_SELECTOR = "[data-e2e='vlp-video-player'], [data-testid=playerContainer]";

// O'Reilly video pages play Kaltura (playkit) videos; transcripts come from its clip API.
const PLAYKIT_VIDEO_SELECTOR = ".playkit-player video";
const PLAYKIT_CONTROLS_SELECTOR = ".playkit-bottom-bar .playkit-controls-container .playkit-right-controls";

// edX video blocks keep their settings in data-metadata (transcript languages and handler URL).
const EDX_VIDEO_SELECTOR = ".video[data-metadata] video";

function getEdxVideoContext(video = findVideoElement("edx")) {
  const block = video?.closest(".video[data-metadata]");
  if (!block) return null;
  if (!block.astEdxMetadata) {
    try {
      block.astEdxMetadata = JSON.parse(block.getAttribute("data-metadata") || "{}");
    } catch {
      block.astEdxMetadata = {};
    }
  }
  const metadata = block.astEdxMetadata;
  const videoId = String(block.id || "").replace(/^video_/, "").replace(/[^\w.-]/g, "").slice(0, 120);
  const translationUrl = typeof metadata.transcriptTranslationUrl === "string" ? metadata.transcriptTranslationUrl : "";
  if (!videoId || !translationUrl.includes("__lang__")) return null;
  return {
    videoId,
    languages: metadata.transcriptLanguages && typeof metadata.transcriptLanguages === "object" ? metadata.transcriptLanguages : {},
    originalLanguage: String(metadata.transcriptLanguage || ""),
    translationUrl
  };
}

function getEdxTranscriptUrl(context, languageCode) {
  try {
    const url = new URL(context.translationUrl.replace("__lang__", encodeURIComponent(languageCode)), location.origin);
    return url.origin === location.origin ? url.href : "";
  } catch {
    return "";
  }
}

// The transcript handler needs the learner's edX session, so it is fetched here, same-origin.
async function fetchEdxTranscriptDocument(request) {
  const url = request.edx?.transcriptUrl;
  if (!url) return null;
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" }
  });
  if (response.status === 404) {
    const error = new Error("No edX captions are available for this video.");
    error.code = "CAPTIONS_UNAVAILABLE";
    throw error;
  }
  if (!response.ok) throw new Error(`edX transcript request failed (${response.status}).`);
  const sjson = await response.json();
  const built = await sendRuntimeMessage({ ...request.message, sjson });
  if (!built?.ok) throw new Error(built?.error || "Could not read edX captions.");
  return built.document;
}

// DeepLearning.AI lessons play in a Vidstack player; the lesson page embeds its video in __NEXT_DATA__.
const DLAI_VIDEO_SELECTOR = ".lesson-video-player video";
const DLAI_PLAY_BUTTON_SELECTOR = ".lesson-video-player .vds-play-button";

// https://learn.deeplearning.ai/courses/<course>/lesson/<lesson-id>/<lesson-name>
function getDeeplearningaiLessonContext() {
  const match = location.pathname.match(/^\/courses\/([^/]+)\/lesson\/([\w-]+)\/[^/]+\/?$/);
  return match ? { courseSlug: decodeURIComponent(match[1]), lessonId: match[2] } : null;
}

function normalizeDeeplearningaiCaptionUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const valid = url.protocol === "https:"
      // Older lessons serve captions from a CloudFront distribution.
      && (url.hostname === "video.deeplearning.ai" || url.hostname.endsWith(".cloudfront.net"))
      && url.pathname.includes("/subtitle/")
      && url.pathname.endsWith(".vtt");
    return valid ? url.href : "";
  } catch {
    return "";
  }
}

// The page's __NEXT_DATA__ carries the lesson video: { tracks: [{ kind, label, src, srcLang }], subtitle: "{...}" }.
function parseDeeplearningaiTracksFromHtml(html) {
  const match = String(html).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return [];
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const videoId = data?.props?.pageProps?.videoId;
  const videos = [];
  (function collect(node) {
    if (!node || typeof node !== "object") return;
    if (node.video && typeof node.video === "object" && (node.video.tracks || node.video.subtitle)) videos.push(node.video);
    for (const child of Object.values(node)) collect(child);
  })(data?.props?.pageProps);
  const video = videos.find((item) => videoId !== undefined && String(item.videoId) === String(videoId)) || videos[0];
  if (!video) return [];

  const candidates = [];
  for (const track of Array.isArray(video.tracks) ? video.tracks : []) {
    if (["subtitles", "captions"].includes(track?.kind || "subtitles")) {
      candidates.push({ languageCode: track.srcLang, label: track.label, src: track.src });
    }
  }
  if (candidates.length === 0 && typeof video.subtitle === "string") {
    try {
      for (const [languageCode, entry] of Object.entries(JSON.parse(video.subtitle))) {
        candidates.push({ languageCode, label: entry?.NAME, src: entry?.URI });
      }
    } catch {
      // Ignore malformed subtitle maps.
    }
  }

  const seen = new Set();
  return candidates
    .map((candidate) => {
      const trackUrl = normalizeDeeplearningaiCaptionUrl(candidate.src);
      const languageCode = String(candidate.languageCode || "");
      if (!trackUrl || !languageCode || seen.has(trackUrl)) return null;
      seen.add(trackUrl);
      return { languageCode, label: String(candidate.label || languageCode), isAutoGenerated: false, trackUrl };
    })
    .filter(Boolean);
}

const deeplearningaiTrackCache = new Map();

async function getDeeplearningaiTextTracks(context) {
  if (!context) return [];
  const key = `${context.courseSlug}/${context.lessonId}`;
  if (deeplearningaiTrackCache.has(key)) return deeplearningaiTrackCache.get(key);
  // The site is a single-page app, so the page's own data can be stale; the lesson URL's
  // server-rendered HTML always carries that lesson's video.
  const response = await fetch(location.pathname, { credentials: "same-origin", headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`DeepLearning.AI request failed (${response.status}).`);
  const tracks = parseDeeplearningaiTracksFromHtml(await response.text());
  if (tracks.length > 0) deeplearningaiTrackCache.set(key, tracks);
  return tracks;
}

// https://www.nvidia.com/en-us/on-demand/session/<session-id>/
function getNvidiaOnDemandSessionId() {
  const match = location.pathname.match(/^\/[a-z]{2}-[a-z]{2}\/on-demand\/session\/([\w.-]+)\/?$/i);
  return match ? match[1] : "";
}

// The player iframe is about:srcdoc with the page's origin (sandbox allow-same-origin), so the
// parent page's path is readable and is the only place the clip id appears.
function getOreillyPagePath() {
  try {
    if (location.protocol !== "about:" || window.parent === window) return "";
    return window.parent.location.hostname === "www.oreilly.com" ? window.parent.location.pathname : "";
  } catch {
    return "";
  }
}

// https://www.oreilly.com/videos/<title-slug>/<work-id>/<clip-id>/
function getOreillyClipContext() {
  const match = getOreillyPagePath().match(/^\/videos\/[^/]+\/[^/]+\/([\w.-]+)\/?$/);
  return match ? { clipId: match[1] } : null;
}

// LinkedIn Learning uses a video.js player.
const LINKEDIN_VIDEO_SELECTOR = ".video-js video.vjs-tech, video.vjs-tech";
const LINKEDIN_CONTROLS_SELECTOR = ".video-js .vjs-control-bar";

// https://www.linkedin.com/learning/<course-slug>/<video-slug>
function getLinkedinVideoContext() {
  const match = location.pathname.match(/^\/learning\/([^/]+)\/([^/?#]+)/);
  return match ? { courseSlug: decodeURIComponent(match[1]), videoSlug: decodeURIComponent(match[2]) } : null;
}

function normalizeLinkedinCaptionUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const valid = url.protocol === "https:"
      && url.hostname === "dms.licdn.com"
      && url.pathname.startsWith("/playlist/vid/")
      && url.pathname.includes("/video-captions-webvtt/");
    return valid ? url.href : "";
  } catch {
    return "";
  }
}

function decodeLinkedinHtmlEntities(text) {
  return String(text).replace(/&quot;/g, '"').replace(/&#61;/g, "=").replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// The lecture page embeds the video's Voyager data as HTML-escaped JSON; its
// `transcripts` array lists a caption file per language. Returns the array text.
function extractLinkedinTranscriptsJson(text) {
  const marker = '"transcripts":[';
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const arrayStart = start + marker.length - 1;
  let depth = 0;
  let inString = false;
  for (let index = arrayStart; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === "\\") index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) return text.slice(arrayStart, index + 1);
    }
  }
  return "";
}

function parseLinkedinTranscriptTracks(html) {
  const json = extractLinkedinTranscriptsJson(decodeLinkedinHtmlEntities(html));
  if (!json) return [];
  let transcripts;
  try {
    transcripts = JSON.parse(json);
  } catch {
    return [];
  }
  const seen = new Set();
  return transcripts
    .map((transcript) => {
      const trackUrl = normalizeLinkedinCaptionUrl(transcript?.captionFile);
      const language = String(transcript?.locale?.language || "");
      if (!trackUrl || !language || seen.has(trackUrl)) return null;
      seen.add(trackUrl);
      const country = String(transcript?.locale?.country || "");
      // Only the original language is human-made; the other languages are machine translations.
      return {
        languageCode: language,
        label: country ? `${language}-${country}` : language,
        isAutoGenerated: transcript.isAutogenerated === true,
        trackUrl
      };
    })
    .filter(Boolean);
}

const linkedinTrackCache = new Map();

async function getLinkedinTextTracks(context) {
  if (!context) return [];
  const key = `${context.courseSlug}/${context.videoSlug}`;
  if (linkedinTrackCache.has(key)) return linkedinTrackCache.get(key);
  // The page is a single-page app, so the page's own data can be stale; the lecture URL's
  // server-rendered HTML always carries that video's caption files.
  const response = await fetch(location.pathname, { credentials: "same-origin", headers: { Accept: "text/html" } });
  if (!response.ok) throw new Error(`LinkedIn Learning request failed (${response.status}).`);
  const tracks = parseLinkedinTranscriptTracks(await response.text());
  if (tracks.length > 0) linkedinTrackCache.set(key, tracks);
  return tracks;
}

// https://www.coursera.org/learn/<course-slug>/lecture/<item-id>/<title>
function getCourseraLectureContext() {
  const match = location.pathname.match(/^\/learn\/([^/]+)\/lecture\/([^/?#]+)/);
  return match ? { courseSlug: decodeURIComponent(match[1]), itemId: decodeURIComponent(match[2]) } : null;
}

const courseraCourseIdCache = new Map();

function normalizeCourseraCaptionUrl(value) {
  try {
    const url = new URL(String(value || ""), location.origin);
    const valid = url.protocol === "https:"
      && (url.hostname === "www.coursera.org" || url.hostname === "coursera.org")
      && url.pathname.startsWith("/api/subtitleAssetProxy.v1/")
      && url.searchParams.get("fileExtension") === "vtt";
    return valid ? url.href : "";
  } catch {
    return "";
  }
}

function getCourseraTracksFromVideoData(videoData) {
  const vtt = videoData?.subtitlesVtt;
  if (!vtt || typeof vtt !== "object") return [];
  return Object.entries(vtt)
    .map(([languageCode, path]) => {
      const trackUrl = normalizeCourseraCaptionUrl(path);
      if (!trackUrl) return null;
      // Most Coursera languages are machine translations of the original; the original is the source.
      const isMachineTranslated = (videoData.subtitlesAssetTags?.[languageCode] || [])
        .some((tag) => tag?.name === "machineTranslation" && String(tag.value) === "true");
      return { languageCode, label: languageCode, isAutoGenerated: isMachineTranslated, trackUrl };
    })
    .filter(Boolean);
}

async function fetchCourseraJson(path) {
  const response = await fetch(path, { credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Coursera request failed (${response.status}).`);
  return response.json();
}

async function getCourseraCourseId(courseSlug) {
  if (courseraCourseIdCache.has(courseSlug)) return courseraCourseIdCache.get(courseSlug);
  const data = await fetchCourseraJson(`/api/onDemandCourses.v1?q=slug&slug=${encodeURIComponent(courseSlug)}`);
  const courseId = data?.elements?.[0]?.id || "";
  if (courseId) courseraCourseIdCache.set(courseSlug, courseId);
  return courseId;
}

function getCourseraTracksFromDom() {
  return [...document.querySelectorAll("video track[src]")]
    .filter((track) => ["subtitles", "captions", ""].includes(track.getAttribute("kind") || ""))
    .map((track) => {
      const trackUrl = normalizeCourseraCaptionUrl(track.getAttribute("src"));
      const languageCode = track.getAttribute("srclang") || "";
      return trackUrl && languageCode
        ? { languageCode, label: track.getAttribute("label") || languageCode, isAutoGenerated: false, trackUrl }
        : null;
    })
    .filter(Boolean);
}

async function getCourseraTextTracks(context) {
  if (!context) return [];
  try {
    const courseId = await getCourseraCourseId(context.courseSlug);
    if (courseId) {
      const fields = "onDemandVideos.v1(subtitles,subtitlesVtt,subtitlesAssetTags)";
      const data = await fetchCourseraJson(
        `/api/onDemandLectureVideos.v1/${encodeURIComponent(courseId)}~${encodeURIComponent(context.itemId)}?includes=video&fields=${encodeURIComponent(fields)}`
      );
      const tracks = getCourseraTracksFromVideoData(data?.linked?.["onDemandVideos.v1"]?.[0]);
      if (tracks.length > 0) return tracks;
    }
  } catch (error) {
    console.warn("[AST] Failed to read Coursera caption tracks from the API:", error.message);
  }
  return getCourseraTracksFromDom();
}

function getTedTalkSlug() {
  const match = location.pathname.match(/^\/talks\/([^/?#]+)/);
  return match?.[1] || null;
}

function parseTedPlayerData(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getTedManifestResourceUrl() {
  const resources = performance.getEntriesByType?.("resource") || [];
  for (let index = resources.length - 1; index >= 0; index -= 1) {
    try {
      const url = new URL(resources[index]?.name || "");
      if (url.protocol === "https:"
        && url.hostname === "hls.ted.com"
        && /^\/project_masters\/[^/]+\/manifest\.m3u8$/.test(url.pathname)) {
        return url.href;
      }
    } catch {
      // Ignore resource entries that are not valid URLs.
    }
  }
  return null;
}

function getTedStructuredVideoData(talkSlug) {
  const expectedTalkPath = talkSlug ? `/talks/${talkSlug}` : "";
  const scripts = document.querySelectorAll?.('script[type="application/ld+json"]') || [];
  for (const script of scripts) {
    let data;
    try {
      data = JSON.parse(script.textContent || "");
    } catch {
      continue;
    }
    const nodes = Array.isArray(data?.["@graph"]) ? data["@graph"] : [data];
    for (const node of nodes) {
      const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
      if (!types.includes("VideoObject")) continue;
      const pageReferences = [node?.url, node?.["@id"], node?.embedUrl]
        .map((value) => String(value || ""));
      if (expectedTalkPath && !pageReferences.some((value) => value.includes(expectedTalkPath))) continue;
      try {
        const manifestUrl = new URL(String(node?.contentUrl || ""));
        if (manifestUrl.protocol !== "https:"
          || manifestUrl.hostname !== "hls.ted.com"
          || !/^\/project_masters\/[^/]+\/manifest\.m3u8$/.test(manifestUrl.pathname)) {
          continue;
        }
        return {
          manifestUrl: manifestUrl.href,
          sourceLanguage: String(node?.inLanguage || "en")
        };
      } catch {
        // Ignore structured data without a valid TED HLS URL.
      }
    }
  }
  return null;
}

function getTedPlayerContext() {
  const talkSlug = getTedTalkSlug();
  if (talkSlug && tedPlayerContextCache?.slug === talkSlug) {
    return tedPlayerContextCache;
  }
  let videoData = null;
  try {
    const nextDataText = document.getElementById("__NEXT_DATA__")?.textContent;
    videoData = nextDataText ? JSON.parse(nextDataText)?.props?.pageProps?.videoData : null;
  } catch {
    videoData = null;
  }

  const playerData = parseTedPlayerData(videoData?.playerData)
    || parseTedPlayerData(videoData?.acmePlayerData);
  const playerMatchesPage = !playerData?.slug || !talkSlug || playerData.slug === talkSlug;
  const structuredVideoData = getTedStructuredVideoData(talkSlug);
  const embeddedManifestUrl = (playerMatchesPage && (playerData?.resources?.hls?.stream || videoData?.hlsUrl))
    || structuredVideoData?.manifestUrl;
  const resourceManifestUrl = embeddedManifestUrl ? null : getTedManifestResourceUrl();
  if (!embeddedManifestUrl
    && talkSlug
    && tedPlayerContextCache?.slug
    && tedPlayerContextCache.slug !== talkSlug
    && resourceManifestUrl === tedPlayerContextCache.manifestUrl) {
    return null;
  }
  const manifestUrl = embeddedManifestUrl || resourceManifestUrl;
  const videoId = (playerMatchesPage && (playerData?.id || videoData?.id)) || talkSlug;

  if (!videoId || !manifestUrl) return null;
  const context = {
    videoId: String(videoId),
    manifestUrl: String(manifestUrl),
    sourceLanguage: String((playerMatchesPage && playerData?.nativeLanguage) || structuredVideoData?.sourceLanguage || "en"),
    slug: talkSlug || String(playerData?.slug || ""),
    sessionKey: `${String(videoId)}:${String(manifestUrl)}`
  };
  tedPlayerContextCache = context;
  return context;
}

function parseJsonObjectAfter(text, marker, startIndex = 0) {
  const source = String(text || "");
  const markerIndex = source.indexOf(marker, startIndex);
  if (markerIndex < 0) return null;

  const objectStart = source.indexOf("{", markerIndex);
  if (objectStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(objectStart, index + 1));
        } catch (_error) {
          return null;
        }
      }
    }
  }

  return null;
}

function readYoutubeTrackName(track) {
  return track?.name?.simpleText
    || track?.name?.runs?.map((run) => run.text).join("")
    || track?.languageCode
    || "Unknown";
}

function getYoutubeCaptionTracksFromPage(videoId) {
  const playerResponse = parseJsonObjectAfter(document.documentElement?.innerHTML, "ytInitialPlayerResponse");
  if (playerResponse?.videoDetails?.videoId && playerResponse.videoDetails.videoId !== videoId) return [];
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!Array.isArray(tracks)) return [];

  return tracks
    .map((track) => ({
      videoId,
      languageCode: track.languageCode,
      label: readYoutubeTrackName(track),
      isAutoGenerated: track.kind === "asr",
      baseUrl: track.baseUrl || track.url
    }))
    .filter((track) => track.baseUrl);
}

function parseYoutubeConfigFromPage() {
  const source = String(document.documentElement?.innerHTML || "");
  const merged = {};
  let cursor = 0;

  while (cursor < source.length) {
    const markerIndex = source.indexOf("ytcfg.set(", cursor);
    if (markerIndex < 0) break;

    const parsed = parseJsonObjectAfter(source, "ytcfg.set(", markerIndex);
    if (parsed) {
      Object.assign(merged, parsed);
    }
    cursor = markerIndex + "ytcfg.set(".length;
  }

  return merged;
}

function parseVimeoPlayerConfigFromPage() {
  const source = String(document.documentElement?.innerHTML || "");
  return parseJsonObjectAfter(source, "window.playerConfig = ")
    || parseJsonObjectAfter(source, "window.playerConfig=");
}

function normalizeVimeoTextTrackFromPage(track, videoId) {
  if (!track?.url || !videoId) return null;

  let trackUrl;
  try {
    trackUrl = new URL(track.url, location.href);
  } catch {
    return null;
  }
  if (trackUrl.protocol !== "https:" || !["captions.vimeo.com", "captions.cloud.vimeo.com"].includes(trackUrl.hostname)) return null;

  const sourceLanguage = String(track.lang || track.language || "").trim();
  return {
    videoId: String(videoId),
    sourceLanguage: sourceLanguage || "en",
    label: String(track.label || track.name || sourceLanguage || "Unknown"),
    isAutoGenerated: /(?:^|[-_])autogen(?:$|[-_])/i.test(sourceLanguage)
      || /auto(?:matic)?/i.test(String(track.kind || track.type || "")),
    trackUrl: trackUrl.href
  };
}

function getVimeoTextTracksFromPage(videoId) {
  return getVimeoTextTracksFromConfig(parseVimeoPlayerConfigFromPage(), videoId);
}

function getVimeoTextTracksFromDom(videoId) {
  return [...document.querySelectorAll("video track[src]")]
    .map((track) => normalizeVimeoTextTrackFromPage({
      url: track.getAttribute("src"),
      lang: track.getAttribute("srclang"),
      label: track.getAttribute("label"),
      kind: track.getAttribute("kind")
    }, videoId))
    .filter(Boolean);
}

function getVimeoTextTracksFromConfig(config, videoId) {
  const rawTracks = config?.request?.text_tracks;
  if (!Array.isArray(rawTracks)) return [];

  return rawTracks
    .map((track) => normalizeVimeoTextTrackFromPage(track, videoId))
    .filter(Boolean);
}

function getVimeoPlayerConfigResourceUrl(videoId) {
  const expectedPath = `/video/${encodeURIComponent(String(videoId))}/config`;
  const resources = performance.getEntriesByType?.("resource") || [];
  for (let index = resources.length - 1; index >= 0; index -= 1) {
    try {
      const url = new URL(resources[index]?.name || "");
      if (url.origin === "https://player.vimeo.com" && url.pathname === expectedPath) return url.href;
    } catch {
      // Ignore resource entries that are not valid URLs.
    }
  }
  return null;
}

function getVimeoTextTracksResourceUrl(videoId) {
  const expectedPath = new RegExp(`^/videos/${String(videoId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?::[^/]+)?/texttracks$`);
  const resources = performance.getEntriesByType?.("resource") || [];
  for (let index = resources.length - 1; index >= 0; index -= 1) {
    try {
      const url = new URL(resources[index]?.name || "");
      if (url.origin === "https://api.vimeo.com" && expectedPath.test(url.pathname)) return url.href;
    } catch {
      // Ignore resource entries that are not valid URLs.
    }
  }
  return null;
}

function getVimeoTextTracksFromApiResponse(response, videoId) {
  const rawTracks = Array.isArray(response?.data) ? response.data : [];
  return rawTracks
    .map((track) => normalizeVimeoTextTrackFromPage({
      url: track.link,
      lang: track.language,
      label: track.display_language || track.name || track.language,
      kind: track.type
    }, videoId))
    .filter(Boolean);
}

async function getVimeoTextTracks(videoId) {
  const domTracks = getVimeoTextTracksFromDom(videoId);
  if (domTracks.length > 0) return domTracks;

  const pageTracks = getVimeoTextTracksFromPage(videoId);
  if (pageTracks.length > 0) return pageTracks;

  const configUrl = getVimeoPlayerConfigResourceUrl(videoId);
  if (configUrl) {
    try {
      const response = await fetch(configUrl, { credentials: "include" });
      if (!response.ok) throw new Error(`Vimeo player config request failed (${response.status}).`);
      const configTracks = getVimeoTextTracksFromConfig(await response.json(), videoId);
      if (configTracks.length > 0) return configTracks;
    } catch (error) {
      console.warn("[AST] Failed to read Vimeo caption tracks from player config:", error.message);
    }
  }

  const textTracksUrl = getVimeoTextTracksResourceUrl(videoId);
  if (!textTracksUrl) return [];
  try {
    const response = await fetch(textTracksUrl, { credentials: "include" });
    if (!response.ok) throw new Error(`Vimeo text tracks request failed (${response.status}).`);
    return getVimeoTextTracksFromApiResponse(await response.json(), videoId);
  } catch (error) {
    console.warn("[AST] Failed to read Vimeo caption tracks from text tracks API:", error.message);
    return [];
  }
}

function isEnglishSourceCaptionTrack(track) {
  const language = String(track?.languageCode || track?.localeId || track?.sourceLanguage || "").toLowerCase();
  const label = String(track?.label || "").toLowerCase();
  return language === "en" || language.startsWith("en-") || language.startsWith("en_") || label.includes("english");
}

function selectDefaultSourceCaptionTrack(tracks, preferredLanguage = "") {
  const usableTracks = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
  if (usableTracks.length === 1) return usableTracks[0];
  // The language picked on an earlier video wins; a human track beats an auto-generated one.
  const preferred = String(preferredLanguage || "").toLowerCase();
  if (preferred) {
    const languageOf = (track) => String(track.languageCode || "").toLowerCase();
    const exact = usableTracks.filter((track) => languageOf(track) === preferred);
    const sameBase = usableTracks.filter((track) => languageOf(track).split(/[-_]/)[0] === preferred.split(/[-_]/)[0]);
    for (const candidates of [exact, sameBase]) {
      const match = candidates.find((track) => !track.isAutoGenerated) || candidates[0];
      if (match) return match;
    }
  }
  return usableTracks.find((track) => isEnglishSourceCaptionTrack(track) && !track.isAutoGenerated)
    || usableTracks.find(isEnglishSourceCaptionTrack)
    || usableTracks[0]
    || null;
}

function setSourceCaptionTracks(platform, sessionKey, tracks) {
  const normalizedTracks = Array.isArray(tracks) ? tracks.filter((track) => track?.id) : [];
  const isNewSession = subtitleState.sourceCaptionSessionKey !== `${platform}:${sessionKey}`;
  subtitleState.sourceCaptionTracks = normalizedTracks;
  subtitleState.sourceCaptionSessionKey = `${platform}:${sessionKey}`;
  if (isNewSession || !normalizedTracks.some((track) => track.id === subtitleState.selectedSourceCaptionTrackId)) {
    subtitleState.selectedSourceCaptionTrackId = selectDefaultSourceCaptionTrack(normalizedTracks, getPreferredSourceLanguage(platform))?.id || "";
  }
  return getSelectedSourceCaptionTrack(platform, sessionKey);
}

function getSelectedSourceCaptionTrack(platform, sessionKey) {
  if (subtitleState.sourceCaptionSessionKey !== `${platform}:${sessionKey}`) return null;
  return subtitleState.sourceCaptionTracks
    .find((track) => track.id === subtitleState.selectedSourceCaptionTrackId)
    || selectDefaultSourceCaptionTrack(subtitleState.sourceCaptionTracks, getPreferredSourceLanguage(platform));
}

function getPreferredSourceLanguage(platform) {
  return subtitleState.sourceCaptionLanguages?.[platform] || "";
}

async function ensureSourceCaptionLanguages() {
  if (subtitleState.sourceCaptionLanguages) return;
  const settings = await getPublicSettings().catch(() => null);
  subtitleState.sourceCaptionLanguages = settings?.sourceCaptionLanguages || {};
}

function createSourceCaptionTrack(track, { id, languageCode, localeId, trackUrl, captionTrackUrl } = {}) {
  const resolvedId = id || track?.id || track?.url || track?.baseUrl || track?.trackUrl;
  if (!resolvedId) return null;
  return {
    id: resolvedId,
    label: String(track?.label || track?.name || languageCode || localeId || track?.sourceLanguage || "Unknown"),
    languageCode: languageCode || track?.languageCode || track?.sourceLanguage || "",
    localeId: localeId || track?.localeId || "",
    isAutoGenerated: Boolean(track?.isAutoGenerated),
    trackUrl: trackUrl || track?.url || track?.trackUrl || "",
    captionTrackUrl: captionTrackUrl || track?.baseUrl || ""
  };
}

function findYoutubeTranscriptParams(value) {
  if (!value || typeof value !== "object") return null;
  if (value.getTranscriptEndpoint?.params) {
    return value.getTranscriptEndpoint.params;
  }

  for (const child of Object.values(value)) {
    const found = findYoutubeTranscriptParams(child);
    if (found) return found;
  }

  return null;
}

function getYoutubeTranscriptPanelDataFromPage(videoId) {
  // The embedded page data describes the video the tab first opened; after in-page navigation it
  // would ask YouTube for that video's transcript instead of the current one.
  const playerResponse = parseJsonObjectAfter(document.documentElement?.innerHTML, "ytInitialPlayerResponse");
  if (videoId && playerResponse?.videoDetails?.videoId && playerResponse.videoDetails.videoId !== videoId) {
    return { transcriptParams: null, innertubeApiKey: null, innertubeContext: null };
  }
  const pageData = parseJsonObjectAfter(document.documentElement?.innerHTML, "ytInitialData");
  const ytcfg = parseYoutubeConfigFromPage();

  return {
    transcriptParams: findYoutubeTranscriptParams(pageData),
    innertubeApiKey: ytcfg.INNERTUBE_API_KEY || null,
    innertubeContext: ytcfg.INNERTUBE_CONTEXT || null
  };
}

function decodeYoutubeXmlEntities(value) {
  let text = String(value ?? "");
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (entity, name) => {
      if (!name.startsWith("#")) return YOUTUBE_ENTITY_MAP[entity.toLowerCase()] || entity;
      const hex = /^#x/i.test(name);
      const codePoint = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint) : entity;
    });
    if (decoded === text) break;
    text = decoded;
  }
  return text;
}

function parseYoutubeAttributes(value) {
  const attributes = {};
  for (const match of String(value || "").matchAll(YOUTUBE_XML_ATTRIBUTE_PATTERN)) {
    attributes[match[1]] = decodeYoutubeXmlEntities(match[2]);
  }
  return attributes;
}

function parseYoutubeTranscriptXmlOnPage(xml) {
  const cues = [];

  for (const match of String(xml || "").matchAll(YOUTUBE_TRANSCRIPT_TEXT_PATTERN)) {
    const attributes = parseYoutubeAttributes(match[1]);
    const start = Number(attributes.start);
    const duration = Number(attributes.dur || 0);
    const text = decodeYoutubeXmlEntities(match[2])
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!Number.isFinite(start) || !Number.isFinite(duration) || !text) {
      continue;
    }

    cues.push(normalizeYoutubePageCue({
      id: `yt-${cues.length}`,
      start,
      end: start + Math.max(duration, 0.001),
      text
    }));
  }

  return validateYoutubePageCues(cues);
}

function getYoutubeWordTimingsOnPage(event, cueEnd) {
  if (!event.segs?.some((segment) => segment.tOffsetMs !== undefined)) return undefined;
  const words = [];
  let offset = 0;
  for (const segment of event.segs) {
    const text = String(segment.utf8 || "").replace(/\s+/g, " ");
    if (!text.trim()) {
      if (words.length) words.at(-1).text += text;
      continue;
    }
    if (segment.tOffsetMs !== undefined) offset = Number(segment.tOffsetMs);
    const start = (Number(event.tStartMs) + offset) / 1000;
    if (!Number.isFinite(offset) || offset < 0 || start >= cueEnd
      || (words.length && start < words.at(-1).start)) return undefined;
    if (words.at(-1)?.start === start) words.at(-1).text += text;
    else words.push({ text, start });
  }
  if (!words.length) return undefined;
  words[0].text = words[0].text.trimStart();
  words.at(-1).text = words.at(-1).text.trimEnd();
  return words.map((word, index) => ({ ...word, end: words[index + 1]?.start ?? cueEnd }));
}

function parseYoutubeTranscriptJson3OnPage(jsonText) {
  const body = typeof jsonText === "string" ? JSON.parse(jsonText) : jsonText;
  const cues = [];

  for (const event of body?.events || []) {
    const text = (event.segs || [])
      .map((segment) => segment?.utf8 || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    const startMs = Number(event.tStartMs);
    const durationMs = Number(event.dDurationMs || 0);

    if (!Number.isFinite(startMs) || !Number.isFinite(durationMs) || !text) {
      continue;
    }

    const start = startMs / 1000;
    const end = (startMs + Math.max(durationMs, 1)) / 1000;
    cues.push(normalizeYoutubePageCue({
      id: `yt-${cues.length}`,
      start,
      end,
      text,
      words: getYoutubeWordTimingsOnPage(event, end)
    }));
  }

  return validateYoutubePageCues(cues);
}

function parseYoutubeTranscriptPayloadOnPage(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("Transcript response is empty.");
  }
  if (trimmed.startsWith("{")) {
    return parseYoutubeTranscriptJson3OnPage(trimmed);
  }
  return parseYoutubeTranscriptXmlOnPage(trimmed);
}

function getYoutubePlayerTranscriptDocument(request, waitForPlayer = false) {
  const capture = globalThis.astYoutubeCaptionCapture;
  if (!capture) return null;
  const selectedTrack = getSelectedSourceCaptionTrack("youtube", request.message.videoId);
  const options = {
    videoId: request.message.videoId,
    languageCode: request.message.languageCode,
    isAutoGenerated: selectedTrack?.isAutoGenerated
  };
  const parseCaption = (caption) => {
    if (!caption || getYoutubeVideoId() !== caption.videoId
      || (options.languageCode && caption.languageCode !== options.languageCode)
      || (options.isAutoGenerated !== undefined && caption.isAutoGenerated !== options.isAutoGenerated)) return null;
    try {
      return {
        platform: "youtube",
        videoId: caption.videoId,
        sourceLanguage: caption.languageCode,
        cues: parseYoutubeTranscriptPayloadOnPage(caption.text)
      };
    } catch {
      return null;
    }
  };
  const captured = capture.get(options);
  if (captured) return parseCaption(captured);
  if (waitForPlayer) {
    return capture.request(options).then(parseCaption);
  }
  return null;
}

function decodeYoutubeTranscriptParams(params) {
  try {
    return decodeURIComponent(params);
  } catch (_error) {
    return params;
  }
}

function readYoutubeTextValue(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  if (value.simpleText) return value.simpleText;
  if (Array.isArray(value.runs)) {
    return value.runs.map((run) => run.text || "").join("");
  }
  if (value.content) return value.content;
  return "";
}

function collectYoutubeTranscriptCueRenderers(value, output = []) {
  if (!value || typeof value !== "object") return output;

  for (const [key, child] of Object.entries(value)) {
    if (key === "transcriptCueRenderer" && child && typeof child === "object") {
      output.push(child);
      continue;
    }
    collectYoutubeTranscriptCueRenderers(child, output);
  }

  return output;
}

function normalizeYoutubePageCue({ id, start, end, text, words }) {
  return {
    id: String(id),
    start: Number(start),
    end: Number(end),
    text: decodeYoutubeXmlEntities(text).replace(/\s+/g, " ").trim(),
    ...(words?.length ? { words: words.map((word) => ({ ...word, text: decodeYoutubeXmlEntities(word.text) })) } : {})
  };
}

function validateYoutubePageCues(cues) {
  if (!Array.isArray(cues)) {
    throw new Error("Cues must be an array.");
  }
  if (cues.length === 0) {
    throw new Error("Cues must not be empty.");
  }

  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index];
    if (!cue.id) {
      throw new Error(`Cue ${index} is missing id.`);
    }
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end)) {
      throw new Error(`Cue ${cue.id} has invalid time values.`);
    }
    if (cue.start >= cue.end) {
      throw new Error(`Cue ${cue.id} start must be before end.`);
    }
    if (index > 0 && cue.start < cues[index - 1].start) {
      throw new Error(`Cue ${cue.id} is out of order.`);
    }
  }

  return cues;
}

function parseYoutubeTranscriptPanelResponseOnPage(body) {
  const cues = [];

  for (const renderer of collectYoutubeTranscriptCueRenderers(body)) {
    const text = readYoutubeTextValue(renderer.cue || renderer.snippet || renderer.text)
      .replace(/\s+/g, " ")
      .trim();
    const startMs = Number(renderer.startOffsetMs ?? renderer.startMs ?? renderer.startTimeMs);
    const durationMs = Number(renderer.durationMs ?? renderer.duration ?? 0);

    if (!Number.isFinite(startMs) || !Number.isFinite(durationMs) || !text) {
      continue;
    }

    const start = startMs / 1000;
    cues.push(normalizeYoutubePageCue({
      id: `yt-panel-${cues.length}`,
      start,
      end: start + Math.max(durationMs / 1000, 0.001),
      text
    }));
  }

  return validateYoutubePageCues(cues);
}

function buildYoutubePageTranscriptRetry(response, requestMessage) {
  if (response?.retryOnPage?.type === "youtubeTranscriptPanel") {
    return { ...response.retryOnPage, captionTracks: response.retryOnPage.captionTracks || requestMessage?.captionTracks };
  }

  const error = String(response?.error || "");
  if (!error.includes("transcript panel fallback failed") || !requestMessage?.transcriptParams || !requestMessage?.innertubeApiKey) {
    return null;
  }

  return {
    type: "youtubeTranscriptPanel",
    videoId: requestMessage.videoId,
    languageCode: requestMessage.languageCode,
    captionTracks: requestMessage.captionTracks,
    params: requestMessage.transcriptParams,
    innertubeApiKey: requestMessage.innertubeApiKey,
    innertubeContext: requestMessage.innertubeContext
  };
}

function assertYoutubeTranscriptPanelLanguageOnPage(body, languageCode, tracks = []) {
  if (!languageCode) return;
  const languages = new Set(tracks.map((track) => track.languageCode));
  function findLanguageMenu(value) {
    if (!value || typeof value !== "object") return null;
    if (value.sortFilterSubMenuRenderer?.subMenuItems) return value.sortFilterSubMenuRenderer.subMenuItems;
    for (const child of Object.values(value)) {
      const found = findLanguageMenu(child);
      if (found) return found;
    }
    return null;
  }
  const selected = findLanguageMenu(body)?.find((item) => item.selected);
  const title = selected && readYoutubeTextValue(selected.title);
  const actualLanguage = selected?.languageCode
    || tracks.find((track) => track.label === title)?.languageCode;
  if (actualLanguage ? actualLanguage !== languageCode : languages.size !== 1 || !languages.has(languageCode)) {
    throw new Error(`Could not verify transcript panel language: ${languageCode}`);
  }
}

async function fetchYoutubeTranscriptPanelDocumentOnPage(retry) {
  const params = retry?.params;
  const apiKey = retry?.innertubeApiKey;
  if (!params || !apiKey) {
    throw new Error("YouTube transcript panel data is missing.");
  }

  const context = retry.innertubeContext || {
    client: {
      clientName: "WEB",
      clientVersion: "2.20260706.00.00"
    }
  };
  const client = context?.client || {};
  const headers = {
    "Content-Type": "application/json",
    "Accept-Language": retry.languageCode || client.hl || "en",
    "X-Origin": "https://www.youtube.com"
  };
  if (client.clientName === "WEB") {
    headers["X-Youtube-Client-Name"] = "1";
  }
  if (client.clientVersion) {
    headers["X-Youtube-Client-Version"] = client.clientVersion;
  }
  if (client.visitorData) {
    headers["X-Goog-Visitor-Id"] = client.visitorData;
  }

  const response = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({
      context,
      params: decodeYoutubeTranscriptParams(params)
    })
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = body.error?.message || body.message || response.statusText;
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  assertYoutubeTranscriptPanelLanguageOnPage(body, retry.languageCode, retry.captionTracks || subtitleState.sourceCaptionTracks);
  return {
    platform: "youtube",
    videoId: retry.videoId || getYoutubeVideoId(),
    sourceLanguage: retry.languageCode || client.hl || "en",
    cues: parseYoutubeTranscriptPanelResponseOnPage(body)
  };
}

function getCurrentSessionKey(platform) {
  if (platform === "generic") return typeof getGenericCurrentSessionKey === "function" ? getGenericCurrentSessionKey() : null;
  if (platform === "youtube") return getYoutubeVideoId();
  if (platform === "udemy") return getUdemyLectureId();
  if (platform === "ted") return getTedPlayerContext()?.sessionKey || getTedTalkSlug();
  if (platform === "coursera") return getCourseraLectureContext()?.itemId || null;
  if (platform === "linkedin") return getLinkedinVideoContext()?.videoSlug || null;
  if (platform === "oreilly") return getOreillyClipContext()?.clipId || null;
  if (platform === "nvidiaOnDemand") return getNvidiaOnDemandSessionId() || null;
  if (platform === "deeplearningai") return getDeeplearningaiLessonContext()?.lessonId || null;
  if (platform === "edx") return getEdxVideoContext()?.videoId || null;
  if (isVimeoPlatform(platform)) return getVimeoVideoId();
  return null;
}

function isCurrentSession(platform, sessionKey) {
  return detectPlatform() === platform && getCurrentSessionKey(platform) === sessionKey;
}

function getUdemyCourseId() {
  const appLoader = document.querySelector(".ud-app-loader");
  const moduleArgs = appLoader?.getAttribute("data-module-args");
  if (moduleArgs) {
    try {
      const parsed = JSON.parse(moduleArgs);
      const courseId = parsed.courseId || parsed.course_id;
      if (courseId) return String(courseId);
    } catch (_error) {
      // Fall through to alternate Udemy Business page markers.
    }
  }

  const elementWithCourseId = document.querySelector("[data-course-id], [data-course_id], [course_id]");
  const attributeCourseId = elementWithCourseId?.getAttribute("data-course-id")
    || elementWithCourseId?.getAttribute("data-course_id")
    || elementWithCourseId?.getAttribute("course_id");
  if (attributeCourseId && /^\d+$/.test(attributeCourseId)) {
    return attributeCourseId;
  }

  const metaCourseId = document.querySelector('meta[property="udemy_com:course_id"], meta[name="udemy_com:course_id"], meta[name="course_id"]')?.content;
  if (metaCourseId && /^\d+$/.test(metaCourseId)) {
    return metaCourseId;
  }

  const html = document.documentElement.innerHTML;
  const match = html.match(/["']courseId["']\s*:\s*["']?(\d+)/)
    || html.match(/["']course_id["']\s*:\s*["']?(\d+)/)
    || html.match(/\bcourseId\s*=\s*(\d+)/)
    || html.match(/\bcourse_id\s*=\s*["'](\d+)/)
    || html.match(/\bdata-course-id\s*=\s*["'](\d+)/);
  return match?.[1] || null;
}

// A short pause between two lines would hide the box for a moment and flash the video behind it,
// so a line stays up until the next one when the next starts within this many seconds.
const SUBTITLE_GAP_BRIDGE_SECONDS = 1;

function findActiveCue(cues, currentTime) {
  if (!Array.isArray(cues)) return null;
  // YouTube rolling captions can overlap: prefer the most recently started cue.
  for (let index = cues.length - 1; index >= 0; index -= 1) {
    const cue = cues[index];
    if (currentTime >= cue.start && currentTime < cue.end) return cue;
  }
  // In a gap: keep the line that just ended if the next one follows closely. A longer pause
  // (a scene change, silence) still clears the box.
  let previous = null;
  let next = null;
  for (const cue of cues) {
    if (cue.end <= currentTime && (!previous || cue.end > previous.end)) previous = cue;
    if (cue.start > currentTime && (!next || cue.start < next.start)) next = cue;
  }
  if (previous && next && next.start - previous.end <= SUBTITLE_GAP_BRIDGE_SECONDS) return previous;
  return null;
}

function hexToRgb(hex) {
  const value = String(hex || "#000000").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "0, 0, 0";
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16)
  ].join(", ");
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function formatPx(value) {
  return `${Math.round(value * 100) / 100}px`;
}

// The box the overlay is laid out in: its containing block (the nearest positioned ancestor), which
// is not always its parent. In edX fullscreen the player wrapper turns static and collapses while
// the fixed, full-screen video block holds both the video and the overlay. Read from computed
// styles rather than offsetParent, which is null while the overlay is hidden between cues.
function getOverlayFrame(overlay) {
  const parent = overlay?.parentElement;
  if (!parent || typeof getComputedStyle !== "function") return parent || null;
  for (let element = parent; element && element !== document.documentElement; element = element.parentElement) {
    const style = getComputedStyle(element);
    if (style.position !== "static" || (style.transform && style.transform !== "none")) return element;
  }
  return parent;
}

function getOverlayFrameRect(overlay) {
  return getOverlayFrame(overlay)?.getBoundingClientRect?.();
}

function getOverlayScale(overlay) {
  const parentRect = getOverlayFrameRect(overlay);
  if (!parentRect?.width || !parentRect?.height) return 1;

  const widthScale = parentRect.width / OVERLAY_REFERENCE_WIDTH_PX;
  const heightScale = parentRect.height / OVERLAY_REFERENCE_HEIGHT_PX;
  return clampNumber(Math.min(widthScale, heightScale), 0.35, 3, 1);
}

function scalePx(value, scale, min = 0) {
  return Math.max(min, value * scale);
}

function getOverlayMaxWidth(overlay) {
  const parentWidth = getOverlayFrameRect(overlay)?.width;
  return parentWidth ? Math.max(1, parentWidth - OVERLAY_HORIZONTAL_MARGIN_PX * 2)
    : OVERLAY_MAX_STYLE_WIDTH * getOverlayScale(overlay);
}

function buildTextShadow(style, scale = 1, outlineShadows = []) {
  const shadows = [...outlineShadows];
  if (style.shadowEnabled) {
    const distance = scalePx(clampNumber(style.shadowDistance, 0, 12, 2), scale);
    const blur = scalePx(clampNumber(style.shadowBlur, 0, 20, 3), scale);
    shadows.push(`${formatPx(distance)} ${formatPx(distance)} ${formatPx(blur)} ${style.shadowColor || "#000000"}`);
  }
  return shadows.length ? shadows.join(", ") : "none";
}

// A thick -webkit-text-stroke draws mitered corners, so V, W and N grow long spikes, and Chrome
// ignores stroke-linejoin on HTML text. The stroke stays thin; the rest of the outline is rings of
// sharp text-shadows, which round every corner. Ring spacing follows the font size, so the shadow
// count stays about the same at any player size.
const OUTLINE_STROKE_MAX_PX = 2;

function getOutlineStrokeWidth(width) {
  return Math.min(width, OUTLINE_STROKE_MAX_PX);
}

function buildOutlineShadows(width, color, fontSize) {
  const radius = width / 2;
  const inner = getOutlineStrokeWidth(width) / 2;
  if (!(radius > inner)) return [];
  const spacing = Math.max(0.75, fontSize * 0.05, radius / 8);
  const shadows = [];
  for (let ring = radius; ring > inner; ring -= spacing) {
    const count = Math.max(8, Math.ceil(2 * Math.PI * ring / spacing));
    for (let index = 0; index < count; index += 1) {
      const angle = 2 * Math.PI * index / count;
      shadows.push(`${(ring * Math.cos(angle)).toFixed(2)}px ${(ring * Math.sin(angle)).toFixed(2)}px 0 ${color}`);
    }
  }
  return shadows;
}

function getOverlayBackgroundColor(style) {
  if (["temporary", "fallback"].includes(subtitleState.translationPhase)) {
    return style.pendingBackgroundColor || "#750000";
  }
  return style.backgroundColor || "#000000";
}

function loadBundledGowunFont() {
  if (!bundledGowunFontPromise) {
    bundledGowunFontPromise = sendRuntimeMessage({ type: "fonts.getBundledGowun" })
      .then((response) => {
        if (!response?.ok) throw new Error(response?.error || "Bundled subtitle font is unavailable.");
        return Uint8Array.from(atob(response.fontBase64), (character) => character.charCodeAt(0));
      })
      .then((fontData) => new FontFace("GounBatang", fontData).load())
      .then((fontFace) => {
        document.fonts.add(fontFace);
        return fontFace;
      })
      .catch((error) => console.warn("AST: failed to load bundled subtitle font", error));
  }
  return bundledGowunFontPromise;
}

function applyWebFontCss(css) {
  let styleElement = document.getElementById(WEB_FONT_STYLE_ID);
  if (!css) {
    styleElement?.remove();
    return;
  }
  css = String(css || "");
  const usesBundledGowunFont = css.includes("__AST_GOWUN_BATANG_FONT_URL__") || css.includes(
    "https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2108@1.1/GowunBatang-Regular.woff"
  );
  if (usesBundledGowunFont) {
    css = css.replace(/@font-face\s*\{[^}]*?(?:__AST_GOWUN_BATANG_FONT_URL__|https:\/\/cdn\.jsdelivr\.net\/gh\/projectnoonnu\/noonfonts_2108@1\.1\/GowunBatang-Regular\.woff)[^}]*\}/g, "");
    loadBundledGowunFont();
  }
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = WEB_FONT_STYLE_ID;
    document.head.append(styleElement);
  }
  if (styleElement.textContent !== css) {
    styleElement.textContent = css;
  }
}

// The box may be as tall as the player minus its margins wherever it sits; its position is pulled
// in instead (see positionOverlay), so moving it toward an edge never squeezes it into a scrollbar.
// Only text taller than the whole player scrolls.
function calculateOverlayMaxHeight(overlay) {
  const parentRect = getOverlayFrameRect(overlay);
  if (!parentRect?.height) {
    return null;
  }
  return Math.max(OVERLAY_MIN_HEIGHT_PX, Math.floor(parentRect.height - OVERLAY_VERTICAL_MARGIN_PX * 2));
}

function fitOverlayHeightToViewport(overlay) {
  overlay.style.height = "auto";
  overlay.style.overflowX = "hidden";
  overlay.style.overflowY = "auto";

  const maxHeight = calculateOverlayMaxHeight(overlay);
  if (maxHeight === null) {
    overlay.style.maxHeight = "";
    return;
  }

  overlay.style.maxHeight = `${maxHeight}px`;
}

// The overlay carries the translation line's size, color and font; source lines override them.
function applySourceLineStyle(line, overlay) {
  const style = subtitleState.subtitleStyle || {};
  const fontSize = clampNumber(style.sourceFontSize ?? style.fontSize, 10, 64, 30);
  line.style.fontSize = formatPx(scalePx(fontSize, getOverlayScale(overlay), 8));
  line.style.color = style.sourceTextColor || "#f2f2f2";
  line.style.fontFamily = style.sourceFontFamily || style.fontFamily || "Arial, sans-serif";
  line.style.fontWeight = String(clampNumber(style.sourceFontWeight, 100, 900, 400));
}

function applyOverlayStyle(overlay) {
  if (!overlay) return;
  const style = subtitleState.subtitleStyle || {};
  const x = clampNumber(style.positionX, 0, 100, 50);
  const y = clampNumber(style.positionY, 0, 100, 78);
  const width = clampNumber(style.width, 160, OVERLAY_MAX_STYLE_WIDTH, 1024);
  const backgroundOpacity = clampNumber(style.backgroundOpacity, 0, 1, 0.8);
  const backgroundColor = getOverlayBackgroundColor(style);
  const scale = getOverlayScale(overlay);
  const maxWidth = getOverlayMaxWidth(overlay);
  const displayWidth = Math.min(scalePx(width, scale, 80), maxWidth);
  const fontSize = scalePx(clampNumber(style.fontSize, 10, 64, 30), scale, 8);
  const outlineWidth = scalePx(clampNumber(style.outlineWidth, 0, 16, 2), scale);
  const outlineEnabled = style.outlineEnabled ?? true;
  applyWebFontCss([...new Set([style.webFontCss, style.sourceWebFontCss].filter(Boolean))].join("\n"));

  overlay.style.top = `${y}%`;
  overlay.style.bottom = "auto";
  overlay.style.transform = "translate(-50%, -50%)";
  // The width the viewer set is the most the box takes; a short line shrinks it to the text plus
  // its padding, so a few words do not cover a wide strip of the video. While the viewer drags the
  // edge, the resize handler owns the width. max-content rather than fit-content: the box is
  // absolutely positioned at left: X%, so fit-content would also cap it at the space between that
  // point and the player's right edge and wrap long lines well before the set width.
  overlay.dataset.maxWidth = String(Math.round(displayWidth));
  if (!overlay.classList.contains("resizing")) {
    overlay.style.width = "max-content";
    overlay.style.maxWidth = formatPx(displayWidth);
  }
  overlay.style.minWidth = formatPx(Math.min(scalePx(160, scale, 56), maxWidth));
  overlay.style.minHeight = formatPx(scalePx(OVERLAY_MIN_HEIGHT_PX, scale, 20));
  overlay.style.padding = `${formatPx(scalePx(8, scale, 3))} ${formatPx(scalePx(14, scale, 5))}`;
  overlay.style.fontSize = formatPx(fontSize);
  overlay.style.fontFamily = style.fontFamily || "Arial, sans-serif";
  overlay.style.fontWeight = String(clampNumber(style.fontWeight, 100, 900, 700));
  overlay.style.color = style.textColor || "#e2ffad";
  const outlineColor = style.outlineColor || "#000000";
  overlay.style.textShadow = buildTextShadow(style, scale, outlineEnabled ? buildOutlineShadows(outlineWidth, outlineColor, fontSize) : []);
  overlay.style.webkitTextStroke = outlineEnabled
    ? `${formatPx(getOutlineStrokeWidth(outlineWidth))} ${outlineColor}`
    : "0 transparent";
  overlay.style.paintOrder = "stroke fill";
  overlay.style.background = `rgba(${hexToRgb(backgroundColor)}, ${backgroundOpacity})`;
  for (const line of overlay.querySelectorAll?.(".ast-subtitle-source-line") || []) applySourceLineStyle(line, overlay);
  fitOverlayHeightToViewport(overlay);
  positionOverlay(overlay, x, y, displayWidth);
}

// The center positions (in %) that keep the box inside the player, from the size it actually
// shows: a short line can move right up to an edge, and a tall one stops before leaving the player.
function clampOverlayPosition(overlay, x, y, fallbackWidth = 0) {
  const parentRect = getOverlayFrameRect(overlay);
  const rect = overlay.getBoundingClientRect?.();
  const visibleWidth = rect?.width || fallbackWidth;
  const visibleHeight = rect?.height || 0;
  const minX = parentRect?.width ? Math.min(50, (visibleWidth / 2 + OVERLAY_HORIZONTAL_MARGIN_PX) / parentRect.width * 100) : 0;
  const minY = parentRect?.height ? Math.min(50, (visibleHeight / 2 + OVERLAY_VERTICAL_MARGIN_PX) / parentRect.height * 100) : 0;
  return {
    x: clampNumber(x, minX, 100 - minX, 50),
    y: clampNumber(y, minY, 100 - minY, 78)
  };
}

function positionOverlay(overlay, x, y, fallbackWidth) {
  const position = clampOverlayPosition(overlay, x, y, fallbackWidth);
  overlay.style.left = `${position.x}%`;
  overlay.style.top = `${position.y}%`;
}

async function saveSubtitleStyle(stylePatch) {
  try {
    const response = await sendRuntimeMessage({
      type: "settings.updateSubtitleStyle",
      patch: stylePatch
    });
    if (!response?.ok) throw new Error(response?.error || "Could not save subtitle style.");
    subtitleState.subtitleStyle = response.settings?.subtitleStyle || subtitleState.subtitleStyle;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      disposeContentScript();
      return;
    }
    console.warn("[AST] Failed to save subtitle style:", error.message);
  }
}

function installOverlayDrag(overlay) {
  if (overlay.dataset.dragInstalled === "true") return;
  overlay.dataset.dragInstalled = "true";
  const RESIZE_CLICK_SUPPRESSION_MS = 700;
  let dragging = false;
  let parentRect = null;
  let resizing = false;
  let resizeMoved = false;
  let resizeStartX = 0;
  let resizeStartLeft = 0;
  let resizeStartWidth = 0;
  let resizeStartStyleWidth = 0;
  let resizeStartPositionX = 50;
  let resizeCurrentPositionX = 50;
  let resizeCurrentWidth = 0;
  let resizeMaxWidth = OVERLAY_MAX_STYLE_WIDTH;
  let resizeParentRect = null;
  let suppressDocumentClickUntil = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let activePointerId = null;
  let didDrag = false;

  const isResizeHandleTarget = (event) => {
    const rect = overlay.getBoundingClientRect();
    return event.clientX >= rect.right - OVERLAY_RESIZE_HIT_WIDTH_PX
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom;
  };

  const calculateResizeMaxWidth = () => {
    return getOverlayMaxWidth(overlay);
  };

  const applyResizeWidth = (width) => {
    const scale = getOverlayScale(overlay);
    const minWidth = Math.min(scalePx(160, scale, 56), resizeMaxWidth);
    resizeCurrentWidth = clampNumber(width, minWidth, resizeMaxWidth, resizeStartWidth || scalePx(1024, scale, 358));
    overlay.style.width = formatPx(resizeCurrentWidth);
    overlay.style.maxWidth = formatPx(resizeCurrentWidth);
    if (resizeParentRect?.width) {
      // The box keeps its center, so both edges move with the drag; near a player edge it stops at
      // the margin and grows toward the other side instead.
      const startCenter = resizeStartLeft - resizeParentRect.left + resizeStartWidth / 2;
      const left = clampNumber(startCenter - resizeCurrentWidth / 2,
        OVERLAY_HORIZONTAL_MARGIN_PX,
        resizeParentRect.width - resizeCurrentWidth - OVERLAY_HORIZONTAL_MARGIN_PX,
        OVERLAY_HORIZONTAL_MARGIN_PX);
      const centerX = left + resizeCurrentWidth / 2;
      resizeCurrentPositionX = clampNumber((centerX / resizeParentRect.width) * 100, 0, 100, resizeStartPositionX);
      overlay.style.left = `${resizeCurrentPositionX}%`;
    }
  };

  const markOverlayPointerSequence = () => {
    suppressDocumentClickUntil = Date.now() + RESIZE_CLICK_SUPPRESSION_MS;
  };

  const shouldSuppressDocumentEvent = () => Date.now() <= suppressDocumentClickUntil;

  const consumeOverlayEvent = (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
  };

  const saveResizedWidth = () => {
    const measuredWidth = Math.round(overlay.getBoundingClientRect().width);
    const scale = getOverlayScale(overlay);
    // A click on the edge without dragging keeps the set width; the box may only look narrower
    // because its text is short.
    if (!resizeMoved) return;
    const actualWidth = resizeCurrentWidth || measuredWidth;
    const nextWidth = clampNumber(Math.round(actualWidth / scale), 160, OVERLAY_MAX_STYLE_WIDTH, 1024);
    const positionXChanged = Math.abs(resizeCurrentPositionX - resizeStartPositionX) >= 0.1;
    const widthChanged = Math.abs(nextWidth - resizeStartStyleWidth) >= 2;
    if (!widthChanged && !positionXChanged) return;

    const stylePatch = {
      width: nextWidth,
      positionX: resizeCurrentPositionX
    };
    subtitleState.subtitleStyle = {
      ...(subtitleState.subtitleStyle || {}),
      ...stylePatch
    };
    saveSubtitleStyle(stylePatch);
  };

  const finishResize = (event) => {
    if (!resizing) return false;
    if (event?.pointerId !== undefined && activePointerId !== null && event.pointerId !== activePointerId) {
      return false;
    }
    resizing = false;
    overlay.classList.remove("resizing");
    if (event?.pointerId !== undefined && event.type !== "lostpointercapture") {
      overlay.releasePointerCapture(event.pointerId);
    }
    saveResizedWidth();
    markOverlayPointerSequence();
    activePointerId = null;
    resizeMoved = false;
    resizeParentRect = null;
    // Back to fitting the text, within the width just set.
    applyOverlayStyle(overlay);
    return true;
  };

  const blockOverlayClick = (event) => {
    consumeOverlayEvent(event);
  };

  const blockDocumentResizeExitEvent = (event) => {
    if (finishResize(event)) {
      consumeOverlayEvent(event);
      return;
    }

    if (shouldSuppressDocumentEvent()) {
      consumeOverlayEvent(event);
      if (event.type === "click" || event.type === "dblclick") {
        suppressDocumentClickUntil = 0;
      }
    }
  };

  overlay.addEventListener("click", blockOverlayClick, { capture: true });
  overlay.addEventListener("dblclick", blockOverlayClick, { capture: true });
  for (const eventType of ["pointerup", "pointercancel", "mouseup", "touchend", "touchcancel", "click", "dblclick"]) {
    document.addEventListener(eventType, blockDocumentResizeExitEvent, { capture: true });
  }

  overlay.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (isResizeHandleTarget(event)) {
      const resizeRect = overlay.getBoundingClientRect();
      resizeParentRect = getOverlayFrameRect(overlay);
      resizing = true;
      resizeMoved = false;
      resizeStartX = event.clientX;
      // Resizing starts from the box as it looks now, so the edge stays under the pointer.
      resizeStartWidth = Math.round(resizeRect.width);
      resizeStartLeft = resizeRect.left;
      resizeStartStyleWidth = Math.round(resizeStartWidth / getOverlayScale(overlay));
      resizeStartPositionX = clampNumber(subtitleState.subtitleStyle?.positionX, 0, 100, 50);
      if (resizeParentRect?.width) {
        resizeStartPositionX = clampNumber(((resizeRect.left + resizeRect.width / 2 - resizeParentRect.left) / resizeParentRect.width) * 100, 0, 100, resizeStartPositionX);
      }
      resizeCurrentPositionX = resizeStartPositionX;
      resizeCurrentWidth = resizeStartWidth;
      resizeMaxWidth = calculateResizeMaxWidth();
      activePointerId = event.pointerId;
      overlay.setPointerCapture(event.pointerId);
      overlay.classList.add("resizing");
      markOverlayPointerSequence();
      consumeOverlayEvent(event);
      return;
    }
    dragging = true;
    parentRect = getOverlayFrameRect(overlay);
    const overlayRect = overlay.getBoundingClientRect();
    dragOffsetX = event.clientX - (overlayRect.left + overlayRect.width / 2);
    dragOffsetY = event.clientY - (overlayRect.top + overlayRect.height / 2);
    activePointerId = event.pointerId;
    didDrag = false;
    overlay.setPointerCapture(event.pointerId);
    overlay.classList.add("dragging");
    event.preventDefault();
    event.stopPropagation();
  });

  overlay.addEventListener("pointermove", (event) => {
    if (resizing && event.pointerId === activePointerId) {
      resizeMoved = true;
      // The right edge follows the pointer and the left edge mirrors it.
      applyResizeWidth(resizeStartWidth + (event.clientX - resizeStartX) * 2);
      consumeOverlayEvent(event);
      return;
    }

    if (!dragging || event.pointerId !== activePointerId || !parentRect?.width || !parentRect?.height) return;
    const centerX = event.clientX - parentRect.left - dragOffsetX;
    const centerY = event.clientY - parentRect.top - dragOffsetY;
    // Store the position the box can actually take, so dragging past an edge and back responds at
    // once instead of first working off the overshoot.
    const { x: positionX, y: positionY } = clampOverlayPosition(overlay,
      (centerX / parentRect.width) * 100,
      (centerY / parentRect.height) * 100,
      Number(overlay.dataset.maxWidth) || 0);
    subtitleState.subtitleStyle = {
      ...(subtitleState.subtitleStyle || {}),
      positionX,
      positionY
    };
    didDrag = true;
    applyOverlayStyle(overlay);
    event.preventDefault?.();
    event.stopPropagation?.();
  });

  const stopDrag = (event) => {
    if (!dragging || event.pointerId !== activePointerId) return;
    dragging = false;
    parentRect = null;
    activePointerId = null;
    overlay.classList.remove("dragging");
    if (event.type === "pointerup") {
      overlay.releasePointerCapture(event.pointerId);
    }
    if (didDrag) {
      saveSubtitleStyle({
        positionX: subtitleState.subtitleStyle?.positionX,
        positionY: subtitleState.subtitleStyle?.positionY
      });
    }
    didDrag = false;
    event.preventDefault?.();
    event.stopPropagation?.();
  };

  overlay.addEventListener("pointerup", (event) => {
    if (finishResize(event)) {
      consumeOverlayEvent(event);
      return;
    }
    stopDrag(event);
  });

  overlay.addEventListener("pointercancel", (event) => {
    if (finishResize(event)) {
      consumeOverlayEvent(event);
      return;
    }
    stopDrag(event);
  });
  overlay.addEventListener("lostpointercapture", (event) => {
    if (finishResize(event)) return;
    stopDrag(event);
  });
}

function ensureOverlay(video, platform = subtitleState.currentPlatform || detectPlatform()) {
  const parent = findOverlayHost(platform, video);
  if (!parent) return null;

  makePositionedHost(parent, platform);

  let overlay = parent.querySelector(`#${OVERLAY_ID}`);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "ast-subtitle-overlay";
    parent.append(overlay);
  }
  applyOverlayStyle(overlay);
  installOverlayDrag(overlay);
  if (platform === "youtube" && !parent.astSubtitleAdObserver) {
    let wasAd = isYoutubeAdPlaying();
    const observer = new MutationObserver(() => {
      if (subtitleState.disposed) { observer.disconnect(); return; }
      const isAd = isYoutubeAdPlaying();
      if (wasAd === isAd) return;
      wasAd = isAd;
      renderCurrentOverlayCue(subtitleState.currentVideo || video);
    });
    observer.observe(parent, { attributes: true, attributeFilter: ["class"] });
    parent.astSubtitleAdObserver = observer;
  }
  return overlay;
}

// The phase that picks the state color. Using YouTube's own captions as is, human or
// auto-translated, gets its own color instead of "complete", since no translation of ours is involved.
function getDisplayedPhase(enabled = subtitleState.enabled, loading = subtitleState.loading) {
  if (enabled && !loading && subtitleState.youtubeProvidedTranslationLanguage) return "youtube-provided";
  return subtitleState.translationPhase;
}

function setButtonState(enabled, loading = false) {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;

  const phase = getDisplayedPhase(enabled, loading);
  // AST stays on for a video without captions, but nothing is translated, so the icon looks idle.
  const unavailable = subtitleState.captionsUnavailable;
  const idle = !loading && Boolean(unavailable)
    && isMarkedCaptionsUnavailable(unavailable.platform, getCurrentSessionKey(unavailable.platform));
  button.classList.toggle("active", enabled && !idle);
  button.classList.toggle("loading", loading);
  button.classList.toggle("temporary", phase === "temporary");
  button.classList.toggle("current", phase === "current");
  button.classList.toggle("complete", phase === "complete");
  button.classList.toggle("fallback", phase === "fallback");
  button.classList.toggle("youtube-provided", phase === "youtube-provided");
  button.setAttribute("aria-pressed", String(enabled));
  button.title = getTranslationStatus(enabled, loading).text;
  updateOpenProviderMenuPhase();
  updateProviderMenuStatus(enabled, loading);
}

// One wording for the toolbar tooltip and the status line at the bottom of the player menu.
function getTranslationStatus(enabled = subtitleState.enabled, loading = subtitleState.loading) {
  const status = (key, substitutions) => ({ text: contentText(key, substitutions) });
  // A summary the user started is the newest news, so it takes the line while it runs.
  if (subtitleState.summaryJob) return { text: summaryProgressText(subtitleState.summaryJob) };
  if (subtitleState.summaryNotice) return { text: subtitleState.summaryNotice.text };
  if (loading) return status("contentStatusLoading");
  if (!enabled) return status("contentStatusOff");
  const unavailable = subtitleState.captionsUnavailable;
  if (unavailable && isMarkedCaptionsUnavailable(unavailable.platform, getCurrentSessionKey(unavailable.platform))) {
    return status("contentStatusNoCaptions");
  }
  if (subtitleState.youtubeProvidedTranslationLanguage) {
    const language = subtitleState.targetLanguages.find((item) => item.code === subtitleState.targetLanguage)?.label
      || subtitleState.youtubeProvidedTranslationLanguage;
    return {
      ...(subtitleState.youtubeProvidedTranslationSource === "auto"
        ? status("contentStatusYoutubeAuto")
        : status("contentStatusYoutubeHuman", [language])),
      hint: contentText("contentStatusYoutubeHint")
    };
  }
  if (subtitleState.translationFailed) return status("contentStatusFailed");
  const phase = subtitleState.translationPhase;
  if (subtitleState.providerBusy && phase !== "complete" && phase !== "fallback") return status("contentStatusServerBusy");

  const expected = subtitleState.expectedCueIds.size;
  // Progress counts subtitle lines, so it moves evenly instead of jumping a chunk at a time.
  const percent = expected ? Math.min(99, Math.floor(subtitleState.finalTranslatedCueIds.size * 100 / expected)) : null;
  const isMachine = isMachineTranslationProvider(subtitleState.activeProviderId);
  if (phase === "source") return status("contentStatusSource");
  if (phase === "temporary") {
    return percent === null ? status("contentStatusTemporary") : status("contentStatusTemporaryProgress", [String(percent)]);
  }
  if (phase === "current") {
    if (percent === null) return status(isMachine ? "contentStatusMachineTranslating" : "contentStatusAiTranslating");
    return status(isMachine ? "contentStatusMachineProgress" : "contentStatusAiProgress", [String(percent)]);
  }
  if (phase === "fallback") return status("contentStatusFallback");
  if (phase === "complete") {
    const fallbackLines = subtitleState.fallbackCueIds.size;
    if (fallbackLines) return status("contentStatusCompleteWithFallbackLines", [String(fallbackLines)]);
    if (subtitleState.hasAlignmentFallback) return status("contentStatusCompleteWithFallback");
    const provider = subtitleState.availableProviders.find((item) => item.id === subtitleState.activeProviderId);
    const name = isMachine ? provider?.label : provider?.model || provider?.label;
    return name ? status("contentStatusCompleteWith", [name]) : status("contentStatusComplete");
  }
  return status("contentStatusEnabled");
}

function updateProviderMenuStatus(enabled = subtitleState.enabled, loading = subtitleState.loading) {
  const line = document.getElementById(PROVIDER_MENU_ID)?.querySelector(".ast-provider-status");
  if (!line) return;
  const status = getTranslationStatus(enabled, loading);
  line.dataset.phase = subtitleState.summaryJob ? "summary"
    : subtitleState.summaryNotice ? (subtitleState.summaryNotice.failed ? "summary-failed" : "summary-done")
      : loading ? "loading" : enabled ? getDisplayedPhase(enabled, loading) : "off";
  line.querySelector(".ast-provider-status-text").textContent = status.text;
  line.title = status.hint ? `${status.text}\n${status.hint}` : status.text;
}

function setTranslationPhase(phase) {
  subtitleState.translationPhase = phase;
  applyOverlayStyle(findOverlay(resolveRenderVideo(subtitleState.currentVideo)));
  setButtonState(subtitleState.enabled, subtitleState.loading);
}

function setOverlayVisible(video, visible) {
  const overlay = findOverlay(video);
  if (!overlay) return;

  overlay.dataset.disabled = visible ? "false" : "true";
  if (!visible) {
    overlay.hidden = true;
  }
}

function showOverlayMessage(video, message, type = "info") {
  if (!video) return;
  const overlay = ensureOverlay(video);
  if (!overlay) return;

  overlay.dataset.disabled = "false";
  overlay.dataset.status = type;
  overlay.textContent = message;
  overlay.hidden = isYoutubeAdPlaying();
}

function findToastHost(video = subtitleState.currentVideo) {
  const targetVideo = resolveRenderVideo(video);
  const platform = subtitleState.currentPlatform || detectPlatform();
  if (!platform || !targetVideo) return null;

  return findOverlayHost(platform, targetVideo);
}

function formatTranslationError(error) {
  return String(error || "Unknown error")
    .replace(/(HTTP \d{3}):\s*/g, "$1\n")
    .replace(/\s*\*\s*(?=Quota exceeded)/g, "\n\n")
    .replace(/\s+(?=For more information|To monitor|Please retry|See https?:\/\/)/g, "\n\n")
    .replace(/,\s*(?=limit:|model:|description:)/g, "\n")
    .replace(/\s+(https?:\/\/\S+)/g, "\n$1")
    .trim();
}

function showToast(message, video = subtitleState.currentVideo, error = false) {
  if (!document.body) return;
  let toast = document.getElementById(TOAST_ID);
  const toastHost = findToastHost(video);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "ast-toast";
    toast.addEventListener("click", (event) => event.stopPropagation());
  }
  toast.classList.toggle("ast-toast-error", error);
  toast.classList.toggle("ast-toast-video", Boolean(toastHost));
  if (toastHost) {
    makePositionedHost(toastHost);
    toastHost.append(toast);
  } else {
    document.body.append(toast);
  }

  toast.textContent = message;
  toast.hidden = false;
  if (subtitleState.toastTimeoutId && typeof clearTimeout === "function") {
    clearTimeout(subtitleState.toastTimeoutId);
  }
  if (typeof setTimeout === "function") {
    subtitleState.toastTimeoutId = setTimeout(() => {
      toast.hidden = true;
    }, 6000);
  }
}

function isCaptionsUnavailableError(value) {
  const errorCode = String(value?.errorCode || value?.code || "");
  if (errorCode === "CAPTIONS_UNAVAILABLE") return true;

  const message = String(value?.error || value?.message || value || "").trim();
  return /^No (?:usable )?(?:(?:YouTube|Udemy|TED|Vimeo|Coursera|LinkedIn Learning|O'Reilly|NVIDIA On-Demand|DeepLearning.AI|edX) )?captions?(?: tracks?)?.*\b(?:available|found)\b/i
    .test(message);
}

function requireCaptionTrack(track) {
  if (track) return track;
  const error = new Error("No captions are available for this video.");
  error.code = "CAPTIONS_UNAVAILABLE";
  throw error;
}

// A video without captions is not an error: AST stays on so the next video is translated, nothing
// pops up, and only the status line says so. The video is remembered so it is not asked for again.
function markCaptionsUnavailable(video, platform, sessionKey) {
  subtitleState.loading = false;
  subtitleState.captionsUnavailable = sessionKey ? { platform, sessionKey } : null;
  invalidateTranslationRequests();
  setTranslationPhase("off");
  // Only hidden, not marked disabled: AST is still on and the next video's lines must show.
  const overlay = findOverlay(video);
  if (overlay) overlay.hidden = true;
  removeUdemyTranscriptTranslationElements();
}

function isMarkedCaptionsUnavailable(platform, sessionKey) {
  const marked = subtitleState.captionsUnavailable;
  return Boolean(marked && sessionKey && marked.platform === platform && marked.sessionKey === sessionKey);
}

function showFallbackToast(detail = {}) {
  const messageKey = detail.fallbackReason === "alignment_failed"
    ? "contentPartialFallback"
    : detail.fallbackReason === "quota_exceeded"
    ? "contentQuotaFallback"
    : detail.fallbackReason === "request_restricted"
      ? "contentRequestRestrictedFallback"
    : detail.fallbackReason === "rate_limit_exceeded"
      ? "contentRateLimitFallback"
    : detail.fallbackReason === "server_busy"
      ? "contentServerBusyFallback"
      : detail.fallbackProviderId
        ? "contentFallback"
        : "";
  if (!messageKey) return;
  const key = `${subtitleState.currentVideoId}:${detail.fallbackProviderId || "googleTranslate"}:${detail.fallbackReason || "fallback"}`;
  if (subtitleState.lastFallbackToastKey === key) return;
  subtitleState.lastFallbackToastKey = key;
  showToast(contentText(messageKey), subtitleState.currentVideo);
}

// Shown once per video at the first overload reply, while retries continue in the background.
function showServerBusyNotice() {
  if (subtitleState.serverBusyNoticeShown || subtitleState.lastFallbackToastKey.endsWith(":server_busy")) return;
  subtitleState.serverBusyNoticeShown = true;
  showToast(contentText("contentServerBusyRetrying"), subtitleState.currentVideo);
}

function clearOverlayStatus(video) {
  const overlay = findOverlay(resolveRenderVideo(video));
  if (!overlay) return;

  delete overlay.dataset.status;
}

function refreshActiveOverlayStyle() {
  applyOverlayStyle(findOverlay(resolveRenderVideo(subtitleState.currentVideo)));
}

function isFinalTranslatedCue(cue) {
  return cue?.id !== undefined
    && cue?.id !== null
    && subtitleState.finalTranslatedCueIds.has(String(cue.id));
}

function hasUnfinalizedCue(cues = []) {
  return Array.isArray(cues) && cues.some((cue) => !isFinalTranslatedCue(cue));
}

function normalizeUdemyTranscriptText(text) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

function getUdemyTranscriptCueIdsByText(document) {
  const cueIdsByText = new Map();
  for (const cue of document?.cues || []) {
    const normalizedText = normalizeUdemyTranscriptText(cue?.text);
    if (!normalizedText || cue?.id === undefined || cue?.id === null) continue;
    const cueIds = cueIdsByText.get(normalizedText) || [];
    cueIds.push(String(cue.id));
    cueIdsByText.set(normalizedText, cueIds);
  }
  return cueIdsByText;
}

// Transcript rows are the site's own lines; a segmented cue appears under the row its first word came from.
function getUdemyTranscriptRowTranslation(rowCueId) {
  const translations = subtitleState.udemyTranscriptTranslations;
  const cues = subtitleState.currentDocument?.cues || [];
  if (!cues.some((cue) => cue.originId !== undefined)) return translations.get(rowCueId);
  const parts = cues.filter((cue) => String(cue.originId) === rowCueId)
    .map((cue) => translations.get(String(cue.id))).filter((translation) => translation?.text);
  if (!parts.length) return null;
  return {
    text: parts.map((part) => part.text).join(" "),
    phase: parts.every((part) => part.phase === "final") ? "final" : "temporary"
  };
}

function removeUdemyTranscriptTranslationElements() {
  for (const element of document.querySelectorAll?.(`.${UDEMY_TRANSCRIPT_TRANSLATION_CLASS}`) || []) {
    element.remove();
  }
}

function removeUdemyTranscriptObserver() {
  subtitleState.udemyTranscriptObserver?.disconnect();
  subtitleState.udemyTranscriptObserver = null;
  subtitleState.udemyTranscriptRefreshQueued = false;
}

function resetUdemyTranscriptTranslations() {
  subtitleState.udemyTranscriptTranslations = new Map();
  removeUdemyTranscriptTranslationElements();
}

function isUdemyTranscriptCueActive(cueElement, cueTextElement) {
  return cueElement?.getAttribute("data-purpose") === "transcript-cue-active"
    || cueTextElement?.classList?.contains?.("transcript--highlight-cue");
}

function getUdemyTranscriptCueBackgroundColor(cueElement, cueTextElement) {
  for (const element of [cueTextElement, cueElement]) {
    if (!element) continue;
    const backgroundColor = getComputedStyle(element).backgroundColor;
    if (backgroundColor && backgroundColor !== "transparent" && backgroundColor !== "rgba(0, 0, 0, 0)") {
      return backgroundColor;
    }
  }
  return "";
}

function applyUdemyTranscriptCueHighlight(translationElement, cueElement, cueTextElement) {
  const active = isUdemyTranscriptCueActive(cueElement, cueTextElement);
  translationElement.dataset.active = String(active);
  const backgroundColor = active ? getUdemyTranscriptCueBackgroundColor(cueElement, cueTextElement) : "";
  if (backgroundColor) {
    translationElement.style.backgroundColor = backgroundColor;
  } else if (typeof translationElement.style.removeProperty === "function") {
    translationElement.style.removeProperty("background-color");
  } else {
    delete translationElement.style.backgroundColor;
  }
}

function renderUdemyTranscriptTranslations() {
  if (!subtitleState.enabled || subtitleState.currentPlatform !== "udemy") return;
  const documentCues = subtitleState.currentDocument?.cues;
  if (!Array.isArray(documentCues) || documentCues.length === 0) return;

  const panel = document.querySelector(UDEMY_TRANSCRIPT_PANEL_SELECTOR);
  if (!panel) return;

  const cueIdsByText = getUdemyTranscriptCueIdsByText(subtitleState.currentSourceDocument || subtitleState.currentDocument);
  const nextCueIndexByText = new Map();
  const activeCueIds = new Set();
  for (const cueElement of panel.querySelectorAll(UDEMY_TRANSCRIPT_CUE_SELECTOR)) {
    const cueTextElement = cueElement.querySelector(UDEMY_TRANSCRIPT_CUE_TEXT_SELECTOR);
    const normalizedText = normalizeUdemyTranscriptText(cueTextElement?.textContent);
    const cueIds = cueIdsByText.get(normalizedText);
    if (!cueIds?.length) continue;

    const nextCueIndex = nextCueIndexByText.get(normalizedText) || 0;
    const cueId = cueIds[nextCueIndex];
    nextCueIndexByText.set(normalizedText, nextCueIndex + 1);
    if (!cueId) continue;

    activeCueIds.add(cueId);
    const container = cueElement.parentElement;
    if (!container) continue;

    const translation = getUdemyTranscriptRowTranslation(cueId);
    const existing = container.querySelector(`.${UDEMY_TRANSCRIPT_TRANSLATION_CLASS}`);
    if (!translation?.text) {
      existing?.remove();
      continue;
    }

    const translationElement = existing || document.createElement("div");
    if (!existing) {
      translationElement.className = UDEMY_TRANSCRIPT_TRANSLATION_CLASS;
      container.append(translationElement);
    }
    if (translationElement.dataset.cueId !== cueId) {
      translationElement.dataset.cueId = cueId;
    }
    if (translationElement.dataset.phase !== translation.phase) {
      translationElement.dataset.phase = translation.phase;
    }
    if (translationElement.textContent !== translation.text) {
      translationElement.textContent = translation.text;
    }
    setSubtitleTextDirection(translationElement, subtitleState.targetLanguage);
    applyUdemyTranscriptCueHighlight(translationElement, cueElement, cueTextElement);
  }

  for (const element of panel.querySelectorAll(`.${UDEMY_TRANSCRIPT_TRANSLATION_CLASS}`)) {
    if (!activeCueIds.has(element.dataset.cueId || "")) {
      element.remove();
    }
  }
}

function scheduleUdemyTranscriptRefresh() {
  if (subtitleState.udemyTranscriptRefreshQueued || subtitleState.disposed) return;
  subtitleState.udemyTranscriptRefreshQueued = true;
  Promise.resolve().then(() => {
    subtitleState.udemyTranscriptRefreshQueued = false;
    renderUdemyTranscriptTranslations();
  });
}

function elementTouchesUdemyTranscript(element) {
  return Boolean(
    element?.matches?.(UDEMY_TRANSCRIPT_PANEL_SELECTOR)
    || element?.closest?.(UDEMY_TRANSCRIPT_PANEL_SELECTOR)
    || element?.parentElement?.closest?.(UDEMY_TRANSCRIPT_PANEL_SELECTOR)
    || element?.querySelector?.(UDEMY_TRANSCRIPT_PANEL_SELECTOR)
  );
}

function mutationsTouchUdemyTranscript(mutations) {
  if (!Array.isArray(mutations) || mutations.length === 0) return true;
  return mutations.some((mutation) => (
    elementTouchesUdemyTranscript(mutation.target)
    || [...(mutation.addedNodes || [])].some(elementTouchesUdemyTranscript)
    || [...(mutation.removedNodes || [])].some(elementTouchesUdemyTranscript)
  ));
}

function ensureUdemyTranscriptObserver() {
  if (subtitleState.currentPlatform !== "udemy" || subtitleState.udemyTranscriptObserver || !document.body) return;
  if (typeof MutationObserver !== "function") return;

  const observer = new MutationObserver((mutations) => {
    if (!subtitleState.enabled || subtitleState.currentPlatform !== "udemy") return;
    if (!mutationsTouchUdemyTranscript(mutations)) return;
    scheduleUdemyTranscriptRefresh();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-purpose"]
  });
  subtitleState.udemyTranscriptObserver = observer;
}

function applyUdemyTranscriptTranslations(translatedCues, { preserveFinalCues = false, phase } = {}) {
  if (subtitleState.currentPlatform !== "udemy" || !Array.isArray(translatedCues)) return;
  for (const cue of translatedCues) {
    if (cue?.id === undefined || cue?.id === null || !cue?.text) continue;
    if (preserveFinalCues && isFinalTranslatedCue(cue)) continue;
    subtitleState.udemyTranscriptTranslations.set(String(cue.id), {
      text: cue.text,
      phase: phase || (isFinalTranslatedCue(cue) ? "final" : "temporary")
    });
  }
  ensureUdemyTranscriptObserver();
  renderUdemyTranscriptTranslations();
}

function applyTranslatedCues(video, translatedCues, { preserveFinalCues = false } = {}) {
  const targetVideo = resolveRenderVideo(video);
  if (!targetVideo?.astSubtitleCues || !Array.isArray(translatedCues)) return;

  const applicableCues = translatedCues
    .filter((cue) => !preserveFinalCues || !isFinalTranslatedCue(cue));
  const translatedById = new Map(applicableCues.map((cue) => [cue.id, cue]));
  if (translatedById.size === 0) return;
  targetVideo.astSubtitleCues = targetVideo.astSubtitleCues.map((cue) => {
    const translated = translatedById.get(cue.id);
    if (!translated) return cue;
    // Keep source timing and text together; only replace the matching cue's text.
    return { ...cue, sourceText: cue.sourceText ?? cue.text, text: translated.text };
  });
  applyUdemyTranscriptTranslations(applicableCues, { preserveFinalCues });
  clearOverlayStatus(targetVideo);
  renderOverlay(targetVideo, targetVideo.astSubtitleCues);
}

function trackFinalTranslatedCues(cues = []) {
  for (const cue of cues) {
    if (cue?.id !== undefined && cue?.id !== null) {
      subtitleState.finalTranslatedCueIds.add(String(cue.id));
    }
  }
}

function hasCompleteFinalTranslation() {
  if (subtitleState.expectedCueIds.size === 0) return false;
  for (const id of subtitleState.expectedCueIds) {
    if (!subtitleState.finalTranslatedCueIds.has(id)) {
      return false;
    }
  }
  return true;
}

function getCurrentCueId(video = subtitleState.currentVideo) {
  const targetVideo = resolveRenderVideo(video);
  if (!targetVideo) return "";
  const activeCue = findActiveCue(targetVideo.astSubtitleCues, targetVideo.currentTime);
  return activeCue?.id === undefined || activeCue?.id === null ? "" : String(activeCue.id);
}

function hasCurrentFinalTranslation(video = subtitleState.currentVideo) {
  const currentCueId = getCurrentCueId(video);
  return currentCueId ? subtitleState.finalTranslatedCueIds.has(currentCueId) : false;
}

function refreshCurrentCueTranslationPhase(video = subtitleState.currentVideo, displayedCue = undefined) {
  if (!["temporary", "current"].includes(subtitleState.translationPhase)) return;
  if (hasCompleteFinalTranslation()) {
    setTranslationPhase("complete");
    return;
  }
  if (displayedCue === null) return;
  const isFinal = displayedCue === undefined
    ? hasCurrentFinalTranslation(video)
    : subtitleState.finalTranslatedCueIds.has(String(displayedCue.id));
  setTranslationPhase(isFinal ? "current" : "temporary");
}

function findCueIndexAtOrAfterTime(cues, currentTime) {
  return cues.findIndex((cue) => currentTime < cue.end || currentTime <= cue.start);
}

function buildTemporaryPriorityDocument(
  document,
  currentTime,
  maxDurationSeconds = subtitleState.temporaryPriorityWindowSeconds
) {
  const cues = Array.isArray(document?.cues) ? document.cues : [];
  const activeIndex = findCueIndexAtOrAfterTime(cues, currentTime);
  if (activeIndex < 0) return null;

  const firstCue = cues[activeIndex];
  const windowStart = Math.max(Number(currentTime) || 0, Number(firstCue.start) || 0);
  const windowEnd = windowStart + maxDurationSeconds;
  const priorityCues = [];
  for (let index = activeIndex; index < cues.length; index += 1) {
    const cue = cues[index];
    if (priorityCues.length > 0 && Number(cue.start) >= windowEnd) break;
    priorityCues.push(cue);
  }
  if (!hasUnfinalizedCue(priorityCues)) return null;

  return {
    ...document,
    cues: priorityCues
  };
}

function invalidateTranslationRequests() {
  clearFallbackProviderRetry();
  for (const requestId of [subtitleState.activeFinalRequestId, subtitleState.activeTemporaryRequestId]) {
    if (requestId) sendRuntimeMessage({ type: "translation.cancelRequest", requestId }).catch(() => {});
  }
  subtitleState.translationGeneration += 1;
  subtitleState.activeFinalRequestId = "";
  subtitleState.activeTemporaryRequestId = "";
  subtitleState.pendingProviderId = "";
  refreshOpenProviderMenu();
}

function createTranslationRequestId(mode) {
  subtitleState.translationRequestSequence += 1;
  return [
    subtitleState.currentSessionKey || "session",
    subtitleState.translationGeneration,
    mode,
    subtitleState.translationRequestSequence
  ].join(":");
}

function clearFallbackProviderRetry() {
  if (subtitleState.fallbackRetryTimeoutId !== null) {
    clearTimeout(subtitleState.fallbackRetryTimeoutId);
    subtitleState.fallbackRetryTimeoutId = null;
  }
  subtitleState.fallbackRetryPending = false;
}

function updateFallbackRetryPolicy(reason, retryAfterMs, blocked = false) {
  if (blocked || reason === "quota_exceeded") {
    subtitleState.fallbackRetryBlocked = true;
    clearFallbackProviderRetry();
  }
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    subtitleState.fallbackRetryNotBefore = Math.max(subtitleState.fallbackRetryNotBefore, Date.now() + retryAfterMs);
  }
}

function scheduleFallbackProviderRetry(platform, sessionKey, video, providerId) {
  if (subtitleState.fallbackRetryBlocked || !subtitleState.fallbackCueIds.size || subtitleState.fallbackRetryAttempts >= 5
    || subtitleState.fallbackRetryTimeoutId !== null || !providerId || providerId === "googleTranslate") return;
  const generation = subtitleState.translationGeneration;
  subtitleState.fallbackRetryTimeoutId = setTimeout(() => {
    subtitleState.fallbackRetryTimeoutId = null;
    if (!subtitleState.enabled || generation !== subtitleState.translationGeneration
      || subtitleState.activeProviderId !== providerId || !isCurrentSession(platform, sessionKey)
      || !subtitleState.currentDocument || !subtitleState.fallbackCueIds.size) return;
    if (subtitleState.pendingProviderId) return;
    const cues = subtitleState.currentDocument.cues.filter((cue) => subtitleState.fallbackCueIds.has(String(cue.id)));
    if (!cues.length) return;
    subtitleState.fallbackRetryAttempts += 1;
    startFinalTranslation({ ...subtitleState.currentDocument, cues }, platform, sessionKey, resolveRenderVideo(video), providerId, true);
  }, Math.max(10_000, subtitleState.fallbackRetryNotBefore - Date.now()));
}

function applyFinalTranslationResult(video, cues = [], detail = {}) {
  if (cues.length) subtitleState.providerBusy = false;
  updateFallbackRetryPolicy(detail.fallbackReason, detail.fallbackRetryAfterMs, detail.fallbackRetryBlocked);
  const fallbackIds = new Set(detail.fallbackCueIds || (detail.fallbackProviderId ? cues.map((cue) => String(cue.id)) : []));
  const applicable = cues.filter((cue) => !fallbackIds.has(String(cue.id))
    || !isFinalTranslatedCue(cue) || subtitleState.fallbackCueIds.has(String(cue.id)));
  for (const cue of applicable) {
    const id = String(cue.id);
    if (fallbackIds.has(id)) subtitleState.fallbackCueIds.add(id);
    else subtitleState.fallbackCueIds.delete(id);
  }
  trackFinalTranslatedCues(applicable);
  applyTranslatedCues(video, applicable);
  subtitleState.hasAlignmentFallback = subtitleState.fallbackCueIds.size > 0;
  if (!subtitleState.fallbackCueIds.size) clearFallbackProviderRetry();
}

function requestTemporaryTranslationAtCurrentCue(video = subtitleState.currentVideo) {
  if (isYoutubeAdPlaying()) return false;
  if (!subtitleState.enabled || ["complete", "fallback"].includes(subtitleState.translationPhase)) return false;
  if (subtitleState.youtubeProvidedTranslationPending) return false;
  if (!subtitleState.currentDocument || !subtitleState.defaultProviderId) return false;
  if (subtitleState.activeProviderId === subtitleState.defaultProviderId) return false;

  const targetVideo = resolveRenderVideo(video);
  if (!targetVideo) return false;

  const priorityDocument = buildTemporaryPriorityDocument(subtitleState.currentDocument, targetVideo.currentTime);
  const activeCueId = priorityDocument?.cues?.[0]?.id;
  if (activeCueId === undefined || activeCueId === null) return false;

  const requestKey = `${subtitleState.currentSessionKey}:${subtitleState.defaultProviderId}:${activeCueId}`;
  if (subtitleState.lastTemporaryPriorityKey === requestKey) return false;
  subtitleState.lastTemporaryPriorityKey = requestKey;

  const previousRequestId = subtitleState.activeTemporaryRequestId;
  if (previousRequestId) sendRuntimeMessage({ type: "translation.cancelRequest", requestId: previousRequestId }).catch(() => {});
  const requestId = createTranslationRequestId("temporary-priority");
  subtitleState.activeTemporaryRequestId = requestId;
  translateDocument(priorityDocument, {
    providerId: subtitleState.defaultProviderId,
    mode: "temporary",
    forceNoCache: true,
    requestId
  }).then((translatedDocument) => {
    if (requestId !== subtitleState.activeTemporaryRequestId) return;
    if (!subtitleState.enabled || ["complete", "fallback"].includes(subtitleState.translationPhase)) return;
    if (!translatedDocument?.cues?.length) return;
    showFallbackToast(translatedDocument);
    setTranslationPhase("temporary");
    applyTranslatedCues(targetVideo, translatedDocument.cues, { preserveFinalCues: true });
    refreshCurrentCueTranslationPhase(targetVideo);
  }).catch((error) => {
    if (requestId === subtitleState.activeTemporaryRequestId && subtitleState.enabled) {
      console.warn("[AST] Temporary subtitle translation failed:", error.message);
    }
  });

  return true;
}

function createButton(platform) {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.title = contentText("contentStatusOff");
  button.setAttribute("aria-label", contentText("contentMenuTitle"));
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  button.dataset.platform = platform;
  button.classList.add("ast-toolbar-button");
  if (platform === "youtube") {
    button.classList.add("ytp-button");
  }
  if (isVimeoPlatform(platform)) {
    button.classList.add("ast-vimeo-toolbar-button");
  }
  if (platform === "ted") {
    button.classList.add("ast-ted-toolbar-button");
  }
  if (platform === "edx") {
    // edX's own control class gives the button the look of its neighbours in the control bar.
    button.classList.add("control", "ast-edx-toolbar-button");
  }
  button.innerHTML = CAPTION_SVG;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    toggleProviderMenu(platform);
  });
  return button;
}

function getDirectToolbarChild(target, descendant) {
  let node = descendant;
  while (node?.parentElement && node.parentElement !== target) {
    node = node.parentElement;
  }
  return node?.parentElement === target ? node : null;
}

function mountToolbarButton(target, button, platform) {
  if (platform !== "ted") {
    target.append(button);
    return;
  }

  let control = document.getElementById(TED_CONTROL_ID);
  if (!control || control.parentElement !== target) {
    control = document.createElement("div");
    control.id = TED_CONTROL_ID;
    control.className = "ast-ted-control";
  }
  control.append(button);

  const fullscreenButton = target.querySelector("#media-fullscreen-button-desktop");
  const fullscreenControl = getDirectToolbarChild(target, fullscreenButton);
  if (fullscreenControl && fullscreenControl !== control && target.insertBefore) {
    target.insertBefore(control, fullscreenControl);
  } else {
    target.append(control);
  }
}

function ensureButton(platform, options = {}) {
  if (subtitleState.siteInactive) return false;
  if (platform === "deeplearningai" && !getDeeplearningaiLessonContext()) {
    document.getElementById(FLOATING_TOOLBAR_ID)?.remove();
    return false;
  }
  if (platform === "nvidiaOnDemand" && !getNvidiaOnDemandSessionId()) {
    document.getElementById(FLOATING_TOOLBAR_ID)?.remove();
    return false;
  }
  if (platform === "oreilly" && !getOreillyClipContext()) {
    document.getElementById(FLOATING_TOOLBAR_ID)?.remove();
    return false;
  }
  if (platform === "linkedin" && !getLinkedinVideoContext()) {
    document.getElementById(FLOATING_TOOLBAR_ID)?.remove();
    return false;
  }
  if (platform === "coursera" && !getCourseraLectureContext()) {
    // Course pages are a single-page app: leaving the lecture must not leave the button behind.
    document.getElementById(FLOATING_TOOLBAR_ID)?.remove();
    return false;
  }
  const target = findToolbarTarget(platform, options);
  if (!target) return false;

  const existing = target.querySelector(`#${BUTTON_ID}`);
  if (existing) return true;
  const existingAnywhere = document.getElementById(BUTTON_ID);
  if (existingAnywhere) {
    mountToolbarButton(target, existingAnywhere, platform);
    const floatingToolbar = document.getElementById(FLOATING_TOOLBAR_ID);
    if (floatingToolbar && floatingToolbar !== target && floatingToolbar.children.length === 0) {
      floatingToolbar.remove();
    }
    return true;
  }

  const button = createButton(platform);
  mountToolbarButton(target, button, platform);
  return true;
}

function shouldAllowFloatingToolbar(platform) {
  if (platform === "generic") return false;
  if (platform === "coursera") return Boolean(getCourseraLectureContext() && document.querySelector("video"));
  if (platform === "linkedin") return Boolean(getLinkedinVideoContext() && document.querySelector("video"));
  if (platform === "oreilly") return Boolean(getOreillyClipContext() && document.querySelector("video"));
  if (platform === "nvidiaOnDemand") return Boolean(getNvidiaOnDemandSessionId() && document.querySelector(PLAYKIT_VIDEO_SELECTOR));
  if (platform === "deeplearningai") return Boolean(getDeeplearningaiLessonContext() && document.querySelector(DLAI_VIDEO_SELECTOR));
  if (platform === "edx") return Boolean(findVideoElement("edx"));
  if (platform === "udemy" || platform === "ted") return false;
  if (!isVimeoPlatform(platform)) return true;
  return location.hostname === "player.vimeo.com" || Boolean(document.querySelector("video"));
}

function watch(platform) {
  const allowFloatingToolbar = shouldAllowFloatingToolbar(platform);
  const installed = ensureButton(platform, { allowFloatingToolbar });
  if (platform !== "udemy" && platform !== "ted" && platform !== "coursera" && platform !== "linkedin" && platform !== "oreilly" && platform !== "nvidiaOnDemand" && platform !== "deeplearningai" && platform !== "edx" && !isVimeoPlatform(platform) && installed) return;

  const observer = new MutationObserver(() => {
    ensureButton(platform, { allowFloatingToolbar: shouldAllowFloatingToolbar(platform) });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (platform === "udemy") {
    setTimeout(() => {
      ensureButton(platform, { allowFloatingToolbar: true });
    }, UDEMY_FLOATING_TOOLBAR_DELAY_MS);
  }
}

function resolveRenderVideo(video) {
  const platform = subtitleState.currentPlatform || detectPlatform();
  const latestVideo = platform ? findVideoElement(platform) : null;
  const targetVideo = latestVideo || video || null;

  if (targetVideo && targetVideo !== video && video?.astSubtitleCues && !targetVideo.astSubtitleCues) {
    targetVideo.astSubtitleCues = video.astSubtitleCues;
  }
  if (targetVideo) {
    subtitleState.currentVideo = targetVideo;
  }
  return targetVideo;
}

function normalizeInitialStartTime(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function setSubtitleTextDirection(element, language) {
  const languageCode = String(language || "").replace(/_/g, "-");
  const baseLanguage = languageCode.split("-")[0].toLowerCase();
  const direction = !baseLanguage || ["auto", "und"].includes(baseLanguage)
    ? "auto" : ["ar", "fa"].includes(baseLanguage) ? "rtl" : "ltr";
  if (element.getAttribute("dir") !== direction) element.setAttribute("dir", direction);
  if (element.getAttribute("lang") !== languageCode) element.setAttribute("lang", languageCode);
}

function getSubtitleProgressWords(cue, text, cues) {
  if (!subtitleState.wordProgressHighlight) return null;
  // Segmentation estimates word times on every platform; only YouTube showed estimated progress before.
  if (cue?.words?.some((word) => word.estimated) && subtitleState.currentPlatform !== "youtube") return null;
  if (cue?.words?.length) {
    return cue.words.map((word) => ({ ...word, text: decodeYoutubeXmlEntities(word.text) }));
  }
  if (!cue || subtitleState.currentPlatform !== "youtube") return null;
  const tokens = text.match(/\s*\S+/gu) || [];
  const nextStart = cues?.find((item) => item.start > cue.start)?.start;
  const end = Math.min(cue.end, nextStart ?? cue.end);
  const totalWeight = tokens.reduce((sum, token) => sum + token.trim().length, 0);
  if (!totalWeight || end <= cue.start) return null;
  let weight = 0;
  // Manual captions may have no word offsets. Estimate progress within the cue's
  // visible interval without changing the source cue or inventing speech timestamps.
  return tokens.map((token) => {
    const start = cue.start + (end - cue.start) * weight / totalWeight;
    weight += token.trim().length;
    return { text: token, start, end: cue.start + (end - cue.start) * weight / totalWeight };
  });
}

function updateSubtitleWordProgress(overlay, currentTime) {
  if (!overlay) return;
  for (const word of overlay.querySelectorAll(".ast-subtitle-word")) {
    const state = currentTime >= Number(word.dataset.end) ? "spoken"
      : currentTime >= Number(word.dataset.start) ? "active" : "pending";
    if (word.dataset.state !== state) word.dataset.state = state;
  }
}

function renderCurrentOverlayCue(video, frameTime) {
  const targetVideo = resolveRenderVideo(video);
  if (!targetVideo) return;
  const overlay = ensureOverlay(targetVideo);
  if (!overlay) return;
  if (isYoutubeAdPlaying()) {
    overlay.hidden = true;
    targetVideo.astSubtitleRenderedCue = null;
    return;
  }
  if (overlay.dataset.status) {
    overlay.hidden = !subtitleState.enabled || overlay.dataset.disabled === "true";
    return;
  }
  const currentTime = targetVideo === video && Number.isFinite(frameTime) ? frameTime : targetVideo.currentTime;
  const activeCue = findActiveCue(targetVideo.astSubtitleCues, currentTime);
  targetVideo.astSubtitleRenderedCue = activeCue;
  const sourceText = decodeYoutubeXmlEntities(activeCue?.sourceText ?? activeCue?.text ?? "");
  const translatedText = activeCue?.sourceText !== undefined ? decodeYoutubeXmlEntities(activeCue.text) : "";
  const mode = subtitleState.subtitleDisplayMode;
  const sourceLanguage = subtitleState.currentDocument?.sourceLanguage;
  const progressWords = getSubtitleProgressWords(activeCue, sourceText, targetVideo.astSubtitleCues);
  const sourceLine = [sourceText, sourceLanguage, progressWords, true];
  const translatedLine = [translatedText, subtitleState.targetLanguage, null, false];
  const lines = mode === "dual" && translatedText
    ? (subtitleState.subtitleStyle?.translationOnTop ? [translatedLine, sourceLine] : [sourceLine, translatedLine])
    : mode === "translated" && translatedText ? [translatedLine] : [sourceLine];
  clearElement(overlay);
  for (const [index, [text, language, words, isSource]] of lines.entries()) {
    if (!text) continue;
    if (index > 0) overlay.append(document.createTextNode("\n"));
    const line = document.createElement("div");
    line.className = isSource ? "ast-subtitle-line ast-subtitle-source-line" : "ast-subtitle-line";
    if (isSource) applySourceLineStyle(line, overlay);
    setSubtitleTextDirection(line, language);
    if (words?.length) {
      for (const word of words) {
        const span = document.createElement("span");
        span.className = "ast-subtitle-word";
        span.textContent = word.text;
        span.dataset.start = String(word.start);
        span.dataset.end = String(word.end);
        line.append(span);
      }
    } else {
      line.textContent = text;
    }
    overlay.append(line);
  }
  updateSubtitleWordProgress(overlay, currentTime);
  overlay.hidden = !subtitleState.enabled || overlay.dataset.disabled === "true" || !activeCue;
  // A longer line may widen or heighten a box that sat near an edge; pull it back inside the player.
  if (!overlay.hidden && !overlay.classList.contains("resizing")) {
    positionOverlay(overlay,
      clampNumber(subtitleState.subtitleStyle?.positionX, 0, 100, 50),
      clampNumber(subtitleState.subtitleStyle?.positionY, 0, 100, 78),
      Number(overlay.dataset.maxWidth) || 0);
  }
  refreshCurrentCueTranslationPhase(targetVideo, activeCue);
}

function scheduleSubtitleVideoFrame(video) {
  if (!video?.requestVideoFrameCallback || video.astSubtitleFrameRequest !== undefined
    || video.paused || !subtitleState.enabled || subtitleState.disposed) return;
  video.astSubtitleFrameRequest = video.requestVideoFrameCallback((_now, metadata) => {
    video.astSubtitleFrameRequest = undefined;
    if (video !== subtitleState.currentVideo || !subtitleState.enabled || subtitleState.disposed) return;
    const cue = findActiveCue(video.astSubtitleCues, metadata.mediaTime);
    if (isYoutubeAdPlaying()) {
      const overlay = findOverlay(video);
      if (overlay) overlay.hidden = true;
      video.astSubtitleRenderedCue = null;
    } else if (video.astSubtitleRenderedCue !== cue) {
      renderCurrentOverlayCue(video, metadata.mediaTime);
    } else {
      updateSubtitleWordProgress(findOverlay(video), metadata.mediaTime);
    }
    scheduleSubtitleVideoFrame(video);
  });
}

function renderOverlay(video, cues) {
  const targetVideo = resolveRenderVideo(video);
  if (!targetVideo) return;
  targetVideo.astSubtitleCues = cues;
  if (!ensureOverlay(targetVideo)) return;
  scheduleSubtitleVideoFrame(targetVideo);

  if (targetVideo.astSubtitleRendererInstalled) {
    renderCurrentOverlayCue(targetVideo);
    return;
  }

  targetVideo.astSubtitleRendererInstalled = true;
  targetVideo.addEventListener("timeupdate", () => renderCurrentOverlayCue(targetVideo));
  targetVideo.addEventListener("seeked", () => {
    renderCurrentOverlayCue(targetVideo);
    requestTemporaryTranslationAtCurrentCue(targetVideo);
    if (subtitleState.enabled && subtitleState.activeFinalRequestId) {
      void sendRuntimeMessage({ type: "translation.setPriority", requestId: subtitleState.activeFinalRequestId,
        currentTime: normalizeInitialStartTime(targetVideo.currentTime) });
    }
  });
  targetVideo.addEventListener("play", () => {
    renderCurrentOverlayCue(targetVideo);
    scheduleSubtitleVideoFrame(targetVideo);
  });
  targetVideo.addEventListener("pause", () => renderCurrentOverlayCue(targetVideo));
  renderCurrentOverlayCue(targetVideo);
}

async function translateDocument(document, {
  providerId,
  mode = "final",
  forceNoCache = false,
  allowFallback = true,
  initialStartTime,
  requestId
} = {}) {
  if (!subtitleState.enabled) return null;
  ensureTranslationLifecyclePort();
  const response = await sendRuntimeMessage({
    type: "translation.translateDocument",
    document,
    providerId,
    mode,
    forceNoCache,
    allowFallback,
    initialStartTime,
    requestId
  });

  if (!response?.ok) {
    if (isExtensionContextInvalidated(response?.error)) {
      disposeContentScript();
      return null;
    }
    const activeRequestId = mode === "temporary"
      ? subtitleState.activeTemporaryRequestId
      : subtitleState.activeFinalRequestId;
    if (requestId && requestId !== activeRequestId) return null;
    console.warn(`[AST] Failed to translate subtitles (${mode}):`, response?.error || "Unknown error");
    if (mode === "final" && subtitleState.enabled) {
      subtitleState.translationFailed = true;
      updateProviderMenuStatus();
      updateFallbackRetryPolicy(response?.errorKind, response?.retryAfterMs);
      const limitMessageKey = { quota_exceeded: "contentQuotaError", rate_limit_exceeded: "contentRateLimitError", request_restricted: "contentRequestRestrictedError", server_busy: "contentServerBusyError" }[response?.errorKind];
      const detail = [limitMessageKey ? contentText(limitMessageKey) : "", formatTranslationError(response?.error)].filter(Boolean).join("\n\n");
      showToast(contentText("contentTranslationFailed", [detail]), subtitleState.currentVideo, true);
    }
    return null;
  }

  return response.document;
}

function resolveDefaultTranslationProviderId(settings = {}) {
  const providerId = settings.fallback?.providerId;
  return providerId === "deepl" && settings.providerTestStatus?.[providerId] === "success"
    ? providerId
    : "googleTranslate";
}

function resolveActiveTranslationProviderId(settings = {}) {
  const providers = getAvailableProviders(settings);
  return providers.some((provider) => provider.id === settings.activeProvider)
    ? settings.activeProvider
    : "googleTranslate";
}

function resolveTemporaryPriorityWindowSeconds(settings = {}) {
  const configuredSeconds = Number(settings.maxChunkDurationSeconds);
  const seconds = Number.isFinite(configuredSeconds)
    ? configuredSeconds
    : DEFAULT_TEMPORARY_PRIORITY_WINDOW_SECONDS;
  return Math.min(MAX_TEMPORARY_PRIORITY_WINDOW_SECONDS, Math.max(MIN_TEMPORARY_PRIORITY_WINDOW_SECONDS, seconds));
}

async function getTranslationProviderIds() {
  try {
    const settings = await getPublicSettings();
    const availableProviders = getAvailableProviders(settings);
    return {
      activeProviderId: resolveActiveTranslationProviderId(settings),
      defaultProviderId: resolveDefaultTranslationProviderId(settings),
      temporaryPriorityWindowSeconds: resolveTemporaryPriorityWindowSeconds(settings),
      availableProviders
    };
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      disposeContentScript();
      return {
        activeProviderId: "googleTranslate",
        defaultProviderId: "googleTranslate",
        temporaryPriorityWindowSeconds: DEFAULT_TEMPORARY_PRIORITY_WINDOW_SECONDS,
        availableProviders: getAvailableProviders()
      };
    }
    throw error;
  }
}

async function loadSubtitleStyle() {
  try {
    const settings = await getPublicSettings();
    subtitleState.subtitleStyle = settings.subtitleStyle || null;
    subtitleState.subtitleDisplayMode = Object.hasOwn(SUBTITLE_DISPLAY_MESSAGE_KEYS, settings.subtitleDisplayMode)
      ? settings.subtitleDisplayMode : "dual";
    subtitleState.translationStyle = settings.translationStyle || "custom";
    applyCustomStyleLabels(settings);
    subtitleState.targetLanguages = settings.targetLanguages || subtitleState.targetLanguages;
    subtitleState.targetLanguage = settings.targetLanguage || "";
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      disposeContentScript();
      return;
    }
    console.warn("[AST] Failed to load subtitle style; using defaults:", error.message);
    subtitleState.subtitleStyle = null;
  }
}

function startDefaultCueTranslation(document, platform, sessionKey, video, providerId) {
  const targetVideo = resolveRenderVideo(video);
  const priorityDocument = buildTemporaryPriorityDocument(document, targetVideo?.currentTime || 0);
  if (!priorityDocument?.cues?.length) return;

  const requestId = createTranslationRequestId("temporary");
  subtitleState.activeTemporaryRequestId = requestId;
  translateDocument(priorityDocument, {
    providerId,
    mode: "temporary",
    forceNoCache: true,
    requestId
  }).then((translatedDocument) => {
    if (requestId !== subtitleState.activeTemporaryRequestId) return;
    if (!subtitleState.enabled || !isCurrentSession(platform, sessionKey) || !translatedDocument?.cues?.length) return;
    if (subtitleState.finalTranslatedCueIds.size > 0 || ["complete", "fallback"].includes(subtitleState.translationPhase)) return;
    showFallbackToast(translatedDocument);
    setTranslationPhase("temporary");
    applyTranslatedCues(targetVideo, translatedDocument.cues, { preserveFinalCues: true });
    refreshCurrentCueTranslationPhase(targetVideo);
  });
}

function startFinalTranslation(document, platform, sessionKey, video, providerId, retry = false) {
  if (subtitleState.enabled && isCurrentSession(platform, sessionKey) && !["temporary", "complete", "fallback"].includes(subtitleState.translationPhase)) {
    setTranslationPhase("temporary");
  }
  const requestId = createTranslationRequestId("final");
  subtitleState.activeFinalRequestId = requestId;
  subtitleState.pendingProviderId = providerId === "googleTranslate" ? "" : providerId;
  refreshOpenProviderMenu();
  translateDocument(document, {
    providerId,
    mode: "final",
    allowFallback: !retry,
    initialStartTime: normalizeInitialStartTime(resolveRenderVideo(video)?.currentTime),
    requestId
  }).then((translatedDocument) => {
    if (requestId !== subtitleState.activeFinalRequestId) return;
    if (!subtitleState.enabled || !isCurrentSession(platform, sessionKey) || !translatedDocument?.cues?.length) return;
    subtitleState.activeTemporaryRequestId = "";
    showFallbackToast(translatedDocument);
    applyFinalTranslationResult(video, translatedDocument.cues, translatedDocument);
    setTranslationPhase(hasCompleteFinalTranslation() ? "complete" : "temporary");
  }).catch((error) => {
    if (requestId === subtitleState.activeFinalRequestId) {
      console.warn(`[AST] ${providerId} translation failed:`, error.message);
      if (subtitleState.translationPhase === "fallback") {
        scheduleFallbackProviderRetry(platform, sessionKey, video, providerId);
      }
    }
  }).finally(() => {
    if (requestId !== subtitleState.activeFinalRequestId) return;
    subtitleState.pendingProviderId = "";
    refreshOpenProviderMenu();
    for (const cue of document.cues) {
      if (!isFinalTranslatedCue(cue)) subtitleState.fallbackCueIds.add(String(cue.id));
    }
    scheduleFallbackProviderRetry(platform, sessionKey, video, providerId);
  });
}

function startProviderTranslation(document, platform, sessionKey, video, providerId, defaultProviderId, options = {}) {
  if (!document?.cues?.length) return;
  invalidateTranslationRequests();
  subtitleState.hasAlignmentFallback = false;
  subtitleState.fallbackCueIds = new Set();
  subtitleState.fallbackRetryAttempts = 0;
  subtitleState.fallbackRetryBlocked = false;
  subtitleState.fallbackRetryNotBefore = 0;
  subtitleState.activeProviderId = providerId;
  subtitleState.defaultProviderId = defaultProviderId || "googleTranslate";
  subtitleState.expectedCueIds = new Set(document.cues.map((cue) => String(cue.id)));
  subtitleState.finalTranslatedCueIds = new Set();
  subtitleState.lastTemporaryPriorityKey = "";
  if (platform === "udemy") {
    resetUdemyTranscriptTranslations();
    ensureUdemyTranscriptObserver();
  }
  subtitleState.youtubeProvidedTranslationLanguage = "";
  subtitleState.youtubeProvidedTranslationSource = "";
  subtitleState.youtubeProvidedTranslationPending = false;
  subtitleState.providerBusy = false;
  subtitleState.translationFailed = false;
  const targetVideo = resolveRenderVideo(video);
  setTranslationPhase("source");
  renderOverlay(targetVideo, document.cues);

  const startRequests = () => {
    if (!options.skipTemporaryTranslation
      && !isMachineTranslationProvider(providerId)
      && providerId !== subtitleState.defaultProviderId) {
      startDefaultCueTranslation(document, platform, sessionKey, targetVideo, subtitleState.defaultProviderId);
    }
    startFinalTranslation(document, platform, sessionKey, targetVideo, providerId);
    refreshOpenProviderMenu();
  };
  const prefersYoutube = platform === "youtube" && subtitleState.preferYoutubeProvidedTranslation
    && !options.skipYoutubeProvidedTranslation && Boolean(subtitleState.targetLanguage);
  // YouTube's captions are already in the target language, so with YouTube-provided captions
  // preferred they are shown as they are, as the original line only (no copy as a "translation");
  // the retranslate button still asks the provider.
  if (prefersYoutube && isSameBaseLanguage(document.sourceLanguage, subtitleState.targetLanguage)) {
    subtitleState.youtubeProvidedTranslationPending = false;
    subtitleState.youtubeProvidedTranslationLanguage = document.sourceLanguage;
    subtitleState.youtubeProvidedTranslationSource = "human";
    setTranslationPhase("complete");
    refreshOpenProviderMenu();
    return;
  }
  const requestTarget = globalThis.astYoutubeCaptionCapture?.requestTarget;
  if (!prefersYoutube || !requestTarget) {
    startRequests();
    return;
  }

  // Human captions in the target language replace our own translation, so nothing is sent until they are ruled out.
  const generation = subtitleState.translationGeneration;
  const isCurrent = () => generation === subtitleState.translationGeneration
    && subtitleState.enabled && isCurrentSession(platform, sessionKey);
  subtitleState.youtubeProvidedTranslationPending = true;
  const sourceTrack = getSelectedSourceCaptionTrack("youtube", document.videoId);
  Promise.resolve(requestTarget({
    videoId: document.videoId,
    targetLanguage: subtitleState.targetLanguage,
    sourceLanguage: document.sourceLanguage,
    sourceIsAutoGenerated: Boolean(sourceTrack?.isAutoGenerated)
  }))
    .then((caption) => (caption ? buildYoutubeProvidedTranslation(document, caption) : null))
    .catch(() => null)
    .then((provided) => {
      if (!isCurrent()) return;
      subtitleState.youtubeProvidedTranslationPending = false;
      // The switch may have been turned off while YouTube's captions were still downloading.
      if (!provided || !subtitleState.preferYoutubeProvidedTranslation) {
        startRequests();
        return;
      }
      subtitleState.youtubeProvidedTranslationLanguage = provided.languageCode;
      subtitleState.youtubeProvidedTranslationSource = provided.source;
      applyFinalTranslationResult(targetVideo, provided.cues);
      setTranslationPhase("complete");
      refreshOpenProviderMenu();
    });
}

// Returns true when a setting that changes cue boundaries changed.
function applyCaptionDisplaySettings(settings = {}) {
  const before = [subtitleState.phraseSegmentation, subtitleState.phraseSegmentationSkipYoutubeManual];
  subtitleState.phraseSegmentation = settings.phraseSegmentation !== false;
  subtitleState.phraseSegmentationSkipYoutubeManual = settings.phraseSegmentationSkipYoutubeManual !== false;
  const highlight = settings.wordProgressHighlight !== false;
  if (highlight !== subtitleState.wordProgressHighlight) {
    subtitleState.wordProgressHighlight = highlight;
    if (subtitleState.currentVideo) renderCurrentOverlayCue(subtitleState.currentVideo);
  }
  return before[0] !== subtitleState.phraseSegmentation || before[1] !== subtitleState.phraseSegmentationSkipYoutubeManual;
}

function isYoutubeAutoGeneratedDocument(document) {
  const track = getSelectedSourceCaptionTrack("youtube", document.videoId);
  return track ? Boolean(track.isAutoGenerated) : document.cues.some((cue) => cue.words?.length);
}

function applyPhraseSegmentation(document, platform) {
  const segmentCues = globalThis.astPhraseSegmentation?.segmentCues;
  if (!segmentCues || !subtitleState.phraseSegmentation || !document?.cues?.length) return document;
  if (platform === "youtube" && subtitleState.phraseSegmentationSkipYoutubeManual
    && !isYoutubeAutoGeneratedDocument(document)) return document;
  try {
    const cues = segmentCues(document.cues, { language: document.sourceLanguage });
    if (!cues?.length || cues === document.cues) return document;
    const segmented = { ...document, cues };
    sourceDocumentsBySegmented.set(segmented, document);
    return segmented;
  } catch (error) {
    console.warn("[AST] Phrase segmentation failed; keeping the original cues:", error.message);
    return document;
  }
}

// Settings can change while a video plays; rebuild its cues from the original lines and translate again.
function reapplyPhraseSegmentation() {
  const sourceDocument = subtitleState.currentSourceDocument;
  const platform = subtitleState.currentPlatform;
  if (!sourceDocument || !platform || !subtitleState.currentDocument) return;
  const subtitleDocument = applyPhraseSegmentation(sourceDocument, platform);
  subtitleState.currentDocument = subtitleDocument;
  if (!subtitleState.enabled) return;
  startProviderTranslation(
    subtitleDocument,
    platform,
    subtitleState.currentSessionKey,
    subtitleState.currentVideo,
    subtitleState.activeProviderId || "googleTranslate",
    subtitleState.defaultProviderId
  );
}

function isSameBaseLanguage(left, right) {
  const base = (value) => String(value || "").toLowerCase().split(/[-_]/)[0];
  return Boolean(base(left)) && base(left) === base(right);
}

function buildYoutubeProvidedTranslation(document, caption) {
  if (caption.videoId !== document.videoId) return null;
  const targetCues = parseYoutubeTranscriptPayloadOnPage(caption.text);
  const sourceCues = sourceDocumentsBySegmented.get(document)?.cues || document.cues;
  if (caption.source === "auto" && !isUsableYoutubeAutoTranslation(sourceCues, targetCues)) return null;
  const cues = alignTargetCuesToSource(document.cues, targetCues, sourceCues);
  return cues ? { languageCode: caption.languageCode, source: caption.source, cues } : null;
}

const YOUTUBE_AUTO_TRANSLATION_SPAN_TOLERANCE_SECONDS = 30;
const YOUTUBE_AUTO_TRANSLATION_MIN_COVERAGE = 0.9;

// Decides whether YouTube's machine translation can stand in for our own. It often merges two
// source lines into one translated line, so line counts differ; what matters is that it spans the
// same time, leaves almost no source line uncovered, and is actually translated.
function isUsableYoutubeAutoTranslation(sourceCues, targetCues) {
  if (!sourceCues?.length || !targetCues?.length) return false;
  const span = (cues) => [Math.min(...cues.map((cue) => cue.start)), Math.max(...cues.map((cue) => cue.end))];
  const [sourceStart, sourceEnd] = span(sourceCues);
  const [targetStart, targetEnd] = span(targetCues);
  // A different cut of the video, or a track cut short, starts or ends somewhere else.
  if (Math.abs(sourceStart - targetStart) > YOUTUBE_AUTO_TRANSLATION_SPAN_TOLERANCE_SECONDS
    || Math.abs(sourceEnd - targetEnd) > YOUTUBE_AUTO_TRANSLATION_SPAN_TOLERANCE_SECONDS) return false;
  const covered = sourceCues.filter((cue) => targetCues.some((target) => target.start < cue.end && target.end > cue.start)).length;
  if (covered < sourceCues.length * YOUTUBE_AUTO_TRANSLATION_MIN_COVERAGE) return false;
  // Mostly unchanged text means the translation did not apply.
  const normalize = (text) => String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  const sourceTexts = new Set(sourceCues.map((cue) => normalize(cue.text)));
  const unchanged = targetCues.filter((cue) => sourceTexts.has(normalize(cue.text))).length;
  return unchanged <= targetCues.length * 0.5;
}

// YouTube's auto captions roll two lines at a time: each line stays up for seconds after the next one
// starts, and lines break mid-sentence (".  좋아요.  그렇다면 아주"). Matching those lines to source cues
// as they are puts one line on several cues and leaves a sentence's period at the start of the next line.
// So each line keeps only its own time (until the next line starts) and is cut into sentence pieces.
// A translated line starts with the same timestamp as the original line it came from; when both cut
// into the same number of sentences, each piece takes its original sentence's word times. Otherwise the
// pieces share the line's time by length. A piece that is only punctuation goes back to the sentence it ends.
const SENTENCE_PIECE_PATTERN = /[^.!?。！？]*[.!?。！？]+["'”’」』)\]]*|[^.!?。！？]+$/gu;

function getSentencePieceTimes(rawCue, count, lineEnd) {
  const words = rawCue?.words;
  if (!words?.length) return null;
  const starts = [words[0].start];
  for (let index = 0; index < words.length - 1; index += 1) {
    if (/[.!?]["'”’)\]]*$/u.test(words[index].text.trim())) starts.push(words[index + 1].start);
  }
  if (starts.length !== count) return null;
  return starts.map((start, index) => ({ start, end: Math.min(starts[index + 1] ?? lineEnd, lineEnd) }));
}

function splitTargetCuesIntoSentencePieces(targetCues, rawSourceCues = []) {
  const rawByStart = new Map(rawSourceCues.map((cue) => [Math.round(cue.start * 1000), cue]));
  const lines = targetCues
    .filter((cue) => String(cue.text || "").trim())
    .map((cue, index, all) => {
      const next = all.slice(index + 1).find((item) => item.start > cue.start);
      return { start: cue.start, end: next ? Math.min(cue.end, next.start) : cue.end, text: cue.text };
    });
  const pieces = [];
  for (const line of lines) {
    const parts = String(line.text).replace(/\s+/g, " ").trim().match(SENTENCE_PIECE_PATTERN) || [];
    const texts = parts.map((part) => part.trim()).filter(Boolean);
    const times = getSentencePieceTimes(rawByStart.get(Math.round(line.start * 1000)), texts.length, line.end);
    const total = texts.reduce((sum, text) => sum + text.length, 0) || 1;
    let cursor = line.start;
    texts.forEach((text, index) => {
      const end = cursor + (line.end - line.start) * text.length / total;
      const time = times?.[index] || { start: cursor, end };
      cursor = end;
      // Punctuation at the start of a line (".", ", 그리고…") closes the previous sentence.
      const lead = pieces.length ? text.match(/^[.!?。！？,，、"'”’」』)\]\s]+/u)?.[0] : "";
      if (lead) pieces.at(-1).text += lead.trim();
      const rest = text.slice(lead?.length || 0).trim();
      if (rest) pieces.push({ ...time, text: rest });
    });
  }
  return pieces;
}

// Splits one translated sentence across two source cues at the word nearest their length ratio.
function splitTranslatedTextByRatio(text, ratio) {
  const words = String(text).split(" ");
  if (words.length < 2) return null;
  const target = text.length * ratio;
  let best = 1;
  let length = 0;
  for (let index = 1; index < words.length; index += 1) {
    length += words[index - 1].length + 1;
    if (Math.abs(length - target) < Math.abs(words.slice(0, best).join(" ").length + 1 - target)) best = index;
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

// Human captions have their own timing. Each target piece goes to the source cue it overlaps most,
// so the source cue count and times stay intact. A source cue left without a piece takes over the
// overlapping piece from its neighbour (or a share of it), so the same sentence never shows twice.
function alignTargetCuesToSource(sourceCues, rawTargetCues, rawSourceCues = []) {
  if (!sourceCues?.length || !rawTargetCues?.length) return null;
  const targetCues = splitTargetCuesIntoSentencePieces(rawTargetCues, rawSourceCues);
  if (!targetCues.length) return null;
  const overlap = (a, b) => Math.min(a.end, b.end) - Math.max(a.start, b.start);
  const assigned = sourceCues.map(() => []);
  let first = 0;
  for (const target of targetCues) {
    while (first < sourceCues.length && sourceCues[first].end <= target.start) first += 1;
    let best = -1;
    let bestOverlap = 0;
    for (let index = first; index < sourceCues.length && sourceCues[index].start < target.end; index += 1) {
      const amount = overlap(sourceCues[index], target);
      if (amount > bestOverlap) {
        best = index;
        bestOverlap = amount;
      }
    }
    if (best >= 0) assigned[best].push({ ...target });
  }
  sourceCues.forEach((cue, index) => {
    if (assigned[index].length) return;
    let nearest = null;
    for (const target of targetCues) {
      if (overlap(cue, target) > 0 && (!nearest || overlap(cue, target) > overlap(cue, nearest))) nearest = target;
    }
    if (!nearest) return;
    const owner = [index - 1, index + 1].find((other) => assigned[other]?.some((piece) => piece.start === nearest.start));
    if (owner === undefined) {
      assigned[index].push({ ...nearest });
      return;
    }
    const pieces = assigned[owner];
    const position = pieces.findIndex((piece) => piece.start === nearest.start);
    const facesThisCue = owner < index ? position === pieces.length - 1 : position === 0;
    if (pieces.length > 1 && facesThisCue) {
      // The neighbour keeps its other sentences; this cue takes the one it shares in time.
      assigned[index].push(...pieces.splice(position, 1));
      return;
    }
    const [earlier, later] = owner < index ? [owner, index] : [index, owner];
    const length = (cueIndex) => String(sourceCues[cueIndex].text || "").length || 1;
    const shared = pieces[position];
    const halves = splitTranslatedTextByRatio(shared.text, length(earlier) / (length(earlier) + length(later)));
    if (!halves) {
      // A one-word sentence cannot be shared; it stays on screen across both cues.
      assigned[index].push({ ...shared });
      return;
    }
    shared.text = owner === earlier ? halves[0] : halves[1];
    assigned[index].push({ ...shared, text: owner === earlier ? halves[1] : halves[0] });
  });
  let covered = 0;
  const cues = sourceCues.map((cue, index) => {
    const text = assigned[index].map((piece) => piece.text).join(" ");
    if (text) covered += 1;
    return { id: cue.id, text };
  });
  // A track that leaves most source lines empty is likely a different cut of the video.
  return covered / sourceCues.length >= 0.6 ? cues : null;
}

async function selectMenuProvider(platform, providerId) {
  const provider = subtitleState.availableProviders.find((item) => item.id === providerId);
  if (!provider || subtitleState.loading) return;

  const response = await sendRuntimeMessage({
    type: "settings.setActiveProvider",
    providerId
  });
  if (!response?.ok) {
    showToast(contentText("contentProviderFailed", [response?.error || "Unknown error"]));
    return;
  }

  subtitleState.activeProviderId = providerId;
  const handler = platformHandlers[platform];
  if (!handler) return;
  const reusableDocument = subtitleState.currentDocument
    && subtitleState.currentPlatform === platform
    && subtitleState.currentSessionKey === handler.getSessionKey();

  if (!subtitleState.enabled) {
    await togglePlatformSubtitles(handler);
    if (!subtitleState.enabled || !reusableDocument) {
      refreshOpenProviderMenu();
      return;
    }
  }

  startProviderTranslation(
    subtitleState.currentDocument,
    platform,
    subtitleState.currentSessionKey,
    subtitleState.currentVideo,
    providerId,
    subtitleState.defaultProviderId
  );
}

async function selectTargetLanguage(platform, languageCode) {
  if (!subtitleState.targetLanguages.some((language) => language.code === languageCode)
    || languageCode === subtitleState.targetLanguage || subtitleState.loading) return;

  invalidateTranslationRequests();
  subtitleState.targetLanguageSelectionGeneration += 1;
  const selectionGeneration = subtitleState.targetLanguageSelectionGeneration;
  const response = await sendRuntimeMessage({
    type: "settings.setTargetLanguage",
    targetLanguage: languageCode
  });
  if (selectionGeneration !== subtitleState.targetLanguageSelectionGeneration) return;
  if (!response?.ok) {
    showToast(contentText("contentProviderFailed", [response?.error || "Unknown error"]));
    return;
  }

  subtitleState.targetLanguage = response.result?.targetLanguage || languageCode;
  const handler = platformHandlers[platform];
  const reusableDocument = subtitleState.currentDocument
    && subtitleState.currentPlatform === platform
    && subtitleState.currentSessionKey === handler?.getSessionKey();
  renderProviderMenu(platform);

  if (subtitleState.enabled
    && reusableDocument) {
    startProviderTranslation(
      subtitleState.currentDocument,
      platform,
      subtitleState.currentSessionKey,
      subtitleState.currentVideo,
      subtitleState.activeProviderId,
      subtitleState.defaultProviderId
    );
  }
}

async function selectPreferYoutubeProvidedTranslation(platform, enabled) {
  if (subtitleState.loading) return;
  const response = await sendRuntimeMessage({ type: "settings.setPreferYoutubeProvidedTranslation", enabled });
  if (!response?.ok) {
    showToast(contentText("contentProviderFailed", [response?.error || "Unknown error"]));
    return;
  }
  applyPreferYoutubeProvidedTranslation(enabled, platform);
  renderProviderMenu(platform);
}

// Shared by the player menu and the settings page, so either switch takes effect on the playing video.
function applyPreferYoutubeProvidedTranslation(enabled, platform = subtitleState.currentPlatform) {
  subtitleState.preferYoutubeProvidedTranslation = enabled;
  if (platform !== "youtube") return;
  const handler = platformHandlers[platform];
  const reusableDocument = subtitleState.currentDocument
    && subtitleState.currentPlatform === platform
    && subtitleState.currentSessionKey === handler?.getSessionKey();
  // Turning it off must replace YouTube's captions, including ones still being fetched;
  // turning it on may find them for this video. A fetch already under way counts as on.
  const usingYoutube = Boolean(subtitleState.youtubeProvidedTranslationLanguage) || subtitleState.youtubeProvidedTranslationPending;
  if (!subtitleState.enabled || !reusableDocument || enabled === usingYoutube) return;
  startProviderTranslation(
    subtitleState.currentDocument,
    platform,
    subtitleState.currentSessionKey,
    subtitleState.currentVideo,
    subtitleState.activeProviderId || "googleTranslate",
    subtitleState.defaultProviderId
  );
}

async function selectTranslationStyle(platform, styleId) {
  if (!Object.hasOwn(TRANSLATION_STYLE_MESSAGE_KEYS, styleId) || subtitleState.loading) return;

  subtitleState.translationStyleSelectionGeneration += 1;
  const selectionGeneration = subtitleState.translationStyleSelectionGeneration;
  const response = await sendRuntimeMessage({
    type: "settings.setTranslationStyle",
    translationStyle: styleId
  });
  if (selectionGeneration !== subtitleState.translationStyleSelectionGeneration) return;
  if (!response?.ok) {
    showToast(contentText("contentProviderFailed", [response?.error || "Unknown error"]));
    return;
  }

  subtitleState.translationStyle = response.result?.translationStyle || styleId;
  const handler = platformHandlers[platform];
  const reusableDocument = subtitleState.currentDocument
    && subtitleState.currentPlatform === platform
    && subtitleState.currentSessionKey === handler?.getSessionKey();
  renderProviderMenu(platform);

  if (subtitleState.enabled
    && reusableDocument
    && !isMachineTranslationProvider(subtitleState.activeProviderId)) {
    startProviderTranslation(
      subtitleState.currentDocument,
      platform,
      subtitleState.currentSessionKey,
      subtitleState.currentVideo,
      subtitleState.activeProviderId,
      subtitleState.defaultProviderId
    );
  }
}

const platformHandlers = {
  udemy: {
    platform: "udemy",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: getUdemyLectureId,
    findVideo: () => findVideoElement("udemy"),
    async listCaptionTracks() {
      const courseId = getUdemyCourseId();
      const lectureId = getUdemyLectureId();
      if (!courseId || !lectureId) return [];
      const response = await sendRuntimeMessage({
        type: "captions.udemy.listTracks",
        courseId,
        lectureId,
        hostname: location.hostname
      });
      if (!response?.ok) throw new Error(response?.error || "Could not load Udemy caption tracks.");
      return (response.tracks || [])
        .map((track) => createSourceCaptionTrack(track, {
          id: track.url,
          languageCode: track.languageCode,
          localeId: track.localeId,
          trackUrl: track.url
        }))
        .filter(Boolean);
    },
    buildTranscriptRequest({ quietMissingPageData = false } = {}) {
      const courseId = getUdemyCourseId();
      const lectureId = getUdemyLectureId();
      const video = this.findVideo();

      if (!courseId || !lectureId || !video) {
        if (!quietMissingPageData) {
          console.warn("[AST] Missing Udemy page data:", {
            courseId: courseId || null,
            lectureId: lectureId || null,
            hasVideo: Boolean(video),
            url: location.href
          });
          if (video) showOverlayMessage(video, contentText("contentMissingUdemy"), "error");
        }
        return null;
      }

      const selectedTrack = getSelectedSourceCaptionTrack(this.platform, lectureId);
      return {
        sessionKey: lectureId,
        video,
        message: {
          type: "captions.udemy.fetchTranscript",
          courseId,
          lectureId,
          hostname: location.hostname,
          languageCode: selectedTrack?.languageCode,
          localeId: selectedTrack?.localeId,
          trackUrl: selectedTrack?.trackUrl
        }
      };
    },
    markLoaded(sessionKey) {
      subtitleState.currentLectureId = sessionKey;
    }
  },
  youtube: {
    platform: "youtube",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: getYoutubeVideoId,
    findVideo: () => findVideoElement("youtube"),
    async fetchNativeTranscript(request) {
      // The player ignores caption requests while an ad plays, and the background fetch
      // cannot replace it: YouTube answers that one with empty caption bodies.
      await waitForYoutubeAdToEnd(request.sessionKey);
      const document = await getYoutubePlayerTranscriptDocument(request, true);
      if (!document) console.warn("[AST] The YouTube player did not return captions for", request.sessionKey);
      return document;
    },
    async listCaptionTracks() {
      const videoId = getYoutubeVideoId();
      if (!videoId) return [];
      // The page's embedded player data still describes the first video after SPA navigation.
      const playerTracks = await globalThis.astYoutubeCaptionCapture?.listTracks?.(videoId);
      let tracks = (playerTracks || []).map((track) => ({
        videoId,
        languageCode: track.languageCode,
        label: track.name || track.languageCode,
        isAutoGenerated: track.kind === "asr",
        baseUrl: track.baseUrl
      })).filter((track) => track.baseUrl);
      if (tracks.length === 0) tracks = getYoutubeCaptionTracksFromPage(videoId);
      if (tracks.length === 0) {
        const response = await sendRuntimeMessage({
          type: "captions.youtube.listTracks",
          urlOrId: location.href
        });
        if (!response?.ok) throw new Error(response?.error || "Could not load YouTube caption tracks.");
        tracks = response.tracks || [];
      }
      return tracks
        .map((track) => createSourceCaptionTrack(track, {
          id: track.baseUrl || track.url,
          languageCode: track.languageCode,
          captionTrackUrl: track.baseUrl || track.url
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest() {
      const videoId = getYoutubeVideoId();
      const video = this.findVideo();

      if (!videoId || !video) {
        console.warn("[AST] Missing YouTube page data:", {
          videoId: videoId || null,
          hasVideo: Boolean(video),
          url: location.href
        });
        if (video) showOverlayMessage(video, contentText("contentMissingYoutube"), "error");
        return null;
      }

      // Without a chosen track the request has no language, and the player's last caption
      // (often one YouTube turned on in the viewer's language) would be taken as the source.
      // A caption list that already says the video has none ends here, so the player and the
      // background are not asked for a transcript that cannot exist.
      const selectedTrack = getSelectedSourceCaptionTrack(this.platform, videoId)
        || await refreshSourceCaptionTracks(this.platform).catch((error) => {
          if (isCaptionsUnavailableError(error)) throw error;
          return null;
        });
      return {
        sessionKey: videoId,
        video,
        message: {
          type: "captions.youtube.fetchTranscript",
          urlOrId: location.href,
          videoId,
          languageCode: selectedTrack?.languageCode,
          captionTrackUrl: selectedTrack?.captionTrackUrl,
          captionTracks: getYoutubeCaptionTracksFromPage(videoId),
          ...getYoutubeTranscriptPanelDataFromPage(videoId)
        }
      };
    },
    async recoverTranscriptDocument(response, request) {
      const captured = await getYoutubePlayerTranscriptDocument(request);
      if (captured) return captured;
      const retry = buildYoutubePageTranscriptRetry(response, request.message);
      if (!retry) return null;
      return fetchYoutubeTranscriptPanelDocumentOnPage(retry);
    }
  },
  ted: {
    platform: "ted",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: () => getTedPlayerContext()?.sessionKey || null,
    findVideo: () => findVideoElement("ted"),
    async listCaptionTracks() {
      const context = getTedPlayerContext();
      if (!context) return [];
      const response = await sendRuntimeMessage({
        type: "captions.ted.listTracks",
        videoId: context.videoId,
        manifestUrl: context.manifestUrl
      });
      if (!response?.ok) throw new Error(response?.error || "Could not load TED caption tracks.");
      return (response.tracks || [])
        .map((track) => createSourceCaptionTrack(track, {
          id: track.trackUrl,
          languageCode: track.languageCode,
          trackUrl: track.trackUrl
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest({ quietMissingPageData = false } = {}) {
      const context = getTedPlayerContext();
      const video = this.findVideo();

      if (!context || !video) {
        if (!quietMissingPageData) {
          console.warn("[AST] Missing TED caption data:", {
            videoId: context?.videoId || null,
            hasVideo: Boolean(video),
            url: location.href
          });
          if (video) showOverlayMessage(video, contentText("contentMissingTed"), "error");
        }
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, context.sessionKey)
          || setSourceCaptionTracks(this.platform, context.sessionKey, await this.listCaptionTracks())
      );

      return {
        sessionKey: context.sessionKey,
        video,
        message: {
          type: "captions.ted.fetchTranscript",
          videoId: context.videoId,
          sourceLanguage: track.languageCode || context.sourceLanguage,
          trackUrl: track.trackUrl
        }
      };
    }
  },
  nvidia: {
    platform: "nvidia",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: getVimeoVideoId,
    findVideo: () => findVideoElement("nvidia"),
    async listCaptionTracks() {
      const videoId = getVimeoVideoId();
      return (await getVimeoTextTracks(videoId))
        .map((track) => createSourceCaptionTrack(track, {
          id: track.trackUrl,
          languageCode: track.sourceLanguage,
          trackUrl: track.trackUrl
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest() {
      const videoId = getVimeoVideoId();
      const video = this.findVideo();

      if (!videoId || !video) {
        console.warn("[AST] Missing NVIDIA Academy Vimeo caption data:", {
          videoId: videoId || null,
          hasVideo: Boolean(video),
          url: location.href
        });
        if (video) showOverlayMessage(video, contentText("contentMissingNvidia"), "error");
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, videoId)
          || setSourceCaptionTracks(this.platform, videoId, await this.listCaptionTracks())
      );

      return {
        sessionKey: videoId,
        video,
        message: {
          type: "captions.vimeo.fetchTranscript",
          videoId,
          sourceLanguage: track.languageCode,
          trackUrl: track.trackUrl,
          platform: "nvidia"
        }
      };
    }
  },
  generic: {
    platform: "generic",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: () => (typeof getGenericCurrentSessionKey === "function" ? getGenericCurrentSessionKey() : null),
    findVideo: () => findVideoElement("generic"),
    async listCaptionTracks() {
      const video = this.findVideo();
      if (!video) return [];
      const key = getGenericSessionKeyForVideo(video);
      const tracks = genericPlayerState.tracksBySession.get(key) || await listGenericCaptionTracks(video);
      return tracks.map((track) => createSourceCaptionTrack(track, {
        id: track.id,
        languageCode: track.languageCode,
        trackUrl: track.trackUrl
      })).filter(Boolean);
    },
    async buildTranscriptRequest() {
      const video = this.findVideo();
      const sessionKey = this.getSessionKey();
      if (!video || !sessionKey) return null;
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, sessionKey)
          || setSourceCaptionTracks(this.platform, sessionKey, await this.listCaptionTracks())
      );
      const meta = getGenericTrackMeta(track.id) || { source: "url", trackUrl: track.trackUrl, format: "auto" };
      return {
        sessionKey,
        video,
        generic: meta,
        message: {
          type: "captions.generic.fetchTranscript",
          sessionKey,
          trackUrl: meta.trackUrl || track.trackUrl,
          sourceLanguage: track.languageCode || "auto",
          format: meta.format === "hls" ? "hls" : "auto"
        }
      };
    },
    // Text tracks are read in the page, and same-origin files are fetched with the page's cookies;
    // anything else goes to the worker through the request message.
    fetchNativeTranscript(request) {
      return fetchGenericNativeDocument(request);
    }
  },
  edx: {
    platform: "edx",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: () => getEdxVideoContext()?.videoId || null,
    findVideo: () => findVideoElement("edx"),
    async listCaptionTracks() {
      const context = getEdxVideoContext();
      if (!context) return [];
      return Object.entries(context.languages)
        .filter(([code]) => /^[\w-]{1,35}$/.test(code))
        .map(([code, name]) => createSourceCaptionTrack({
          label: String(name || code),
          // The course's own transcript language is the original; other languages are translations.
          isAutoGenerated: Boolean(context.originalLanguage) && code !== context.originalLanguage
        }, {
          id: `${context.videoId}:${code}`,
          languageCode: code
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest({ quietMissingPageData = false } = {}) {
      const video = this.findVideo();
      const context = getEdxVideoContext(video);
      if (!context || !video) {
        if (!quietMissingPageData) {
          console.warn("[AST] Missing edX caption data:", { hasVideo: Boolean(video), url: location.href });
          if (video) showOverlayMessage(video, contentText("contentMissingEdx"), "error");
        }
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, context.videoId)
          || setSourceCaptionTracks(this.platform, context.videoId, await this.listCaptionTracks())
      );
      return {
        sessionKey: context.videoId,
        video,
        edx: { transcriptUrl: getEdxTranscriptUrl(context, track.languageCode) },
        message: {
          type: "captions.edx.buildTranscript",
          videoId: context.videoId,
          sourceLanguage: track.languageCode
        }
      };
    },
    fetchNativeTranscript(request) {
      return fetchEdxTranscriptDocument(request);
    }
  },
  deeplearningai: {
    platform: "deeplearningai",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: () => getDeeplearningaiLessonContext()?.lessonId || null,
    findVideo: () => findVideoElement("deeplearningai"),
    async listCaptionTracks() {
      return (await getDeeplearningaiTextTracks(getDeeplearningaiLessonContext()))
        .map((track) => createSourceCaptionTrack(track, {
          id: track.trackUrl,
          languageCode: track.languageCode,
          trackUrl: track.trackUrl
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest({ quietMissingPageData = false } = {}) {
      const context = getDeeplearningaiLessonContext();
      const video = this.findVideo();

      if (!context || !video) {
        if (!quietMissingPageData) {
          console.warn("[AST] Missing DeepLearning.AI caption data:", {
            lessonId: context?.lessonId || null,
            hasVideo: Boolean(video),
            url: location.href
          });
          if (video) showOverlayMessage(video, contentText("contentMissingDeeplearningai"), "error");
        }
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, context.lessonId)
          || setSourceCaptionTracks(this.platform, context.lessonId, await this.listCaptionTracks())
      );

      return {
        sessionKey: context.lessonId,
        video,
        message: {
          type: "captions.deeplearningai.fetchTranscript",
          lessonId: context.lessonId,
          sourceLanguage: track.languageCode,
          trackUrl: track.trackUrl
        }
      };
    }
  },
  nvidiaOnDemand: {
    platform: "nvidiaOnDemand",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: () => getNvidiaOnDemandSessionId() || null,
    findVideo: () => findVideoElement("nvidiaOnDemand"),
    async listCaptionTracks() {
      const sessionId = getNvidiaOnDemandSessionId();
      if (!sessionId) return [];
      const response = await sendRuntimeMessage({ type: "captions.nvidiaOnDemand.listTracks", sessionId });
      if (!response?.ok) throw new Error(response?.error || "Could not load NVIDIA On-Demand caption tracks.");
      return (response.tracks || [])
        .map((track) => createSourceCaptionTrack(track, {
          id: `${sessionId}:${track.languageCode}`,
          languageCode: track.languageCode
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest({ quietMissingPageData = false } = {}) {
      const sessionId = getNvidiaOnDemandSessionId();
      const video = this.findVideo();

      if (!sessionId || !video) {
        if (!quietMissingPageData) {
          console.warn("[AST] Missing NVIDIA On-Demand caption data:", {
            sessionId: sessionId || null,
            hasVideo: Boolean(video),
            url: location.href
          });
          if (video) showOverlayMessage(video, contentText("contentMissingNvidiaOnDemand"), "error");
        }
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, sessionId)
          || setSourceCaptionTracks(this.platform, sessionId, await this.listCaptionTracks())
      );

      return {
        sessionKey: sessionId,
        video,
        message: {
          type: "captions.nvidiaOnDemand.fetchTranscript",
          sessionId,
          sourceLanguage: track.languageCode
        }
      };
    }
  },
  oreilly: {
    platform: "oreilly",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: () => getOreillyClipContext()?.clipId || null,
    findVideo: () => findVideoElement("oreilly"),
    async listCaptionTracks() {
      const context = getOreillyClipContext();
      if (!context) return [];
      const response = await sendRuntimeMessage({ type: "captions.oreilly.listTracks", clipId: context.clipId });
      if (!response?.ok) throw new Error(response?.error || "Could not load O'Reilly caption tracks.");
      return (response.tracks || [])
        .map((track) => createSourceCaptionTrack(track, {
          id: `${context.clipId}:${track.languageCode}`,
          languageCode: track.languageCode
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest({ quietMissingPageData = false } = {}) {
      const context = getOreillyClipContext();
      const video = this.findVideo();

      if (!context || !video) {
        if (!quietMissingPageData) {
          console.warn("[AST] Missing O'Reilly caption data:", {
            clipId: context?.clipId || null,
            hasVideo: Boolean(video),
            url: location.href
          });
          if (video) showOverlayMessage(video, contentText("contentMissingOreilly"), "error");
        }
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, context.clipId)
          || setSourceCaptionTracks(this.platform, context.clipId, await this.listCaptionTracks())
      );

      return {
        sessionKey: context.clipId,
        video,
        message: {
          type: "captions.oreilly.fetchTranscript",
          clipId: context.clipId,
          sourceLanguage: track.languageCode
        }
      };
    }
  },
  linkedin: {
    platform: "linkedin",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: () => getLinkedinVideoContext()?.videoSlug || null,
    findVideo: () => findVideoElement("linkedin"),
    async listCaptionTracks() {
      return (await getLinkedinTextTracks(getLinkedinVideoContext()))
        .map((track) => createSourceCaptionTrack(track, {
          id: track.trackUrl,
          languageCode: track.languageCode,
          trackUrl: track.trackUrl
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest({ quietMissingPageData = false } = {}) {
      const context = getLinkedinVideoContext();
      const video = this.findVideo();

      if (!context || !video) {
        if (!quietMissingPageData) {
          console.warn("[AST] Missing LinkedIn Learning caption data:", {
            videoSlug: context?.videoSlug || null,
            hasVideo: Boolean(video),
            url: location.href
          });
          if (video) showOverlayMessage(video, contentText("contentMissingLinkedin"), "error");
        }
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, context.videoSlug)
          || setSourceCaptionTracks(this.platform, context.videoSlug, await this.listCaptionTracks())
      );

      return {
        sessionKey: context.videoSlug,
        video,
        message: {
          type: "captions.linkedin.fetchTranscript",
          videoId: context.videoSlug,
          sourceLanguage: track.languageCode,
          trackUrl: track.trackUrl
        }
      };
    }
  },
  coursera: {
    platform: "coursera",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: () => getCourseraLectureContext()?.itemId || null,
    findVideo: () => findVideoElement("coursera"),
    async listCaptionTracks() {
      return (await getCourseraTextTracks(getCourseraLectureContext()))
        .map((track) => createSourceCaptionTrack(track, {
          id: track.trackUrl,
          languageCode: track.languageCode,
          trackUrl: track.trackUrl
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest({ quietMissingPageData = false } = {}) {
      const context = getCourseraLectureContext();
      const video = this.findVideo();

      if (!context || !video) {
        if (!quietMissingPageData) {
          console.warn("[AST] Missing Coursera caption data:", {
            itemId: context?.itemId || null,
            hasVideo: Boolean(video),
            url: location.href
          });
          if (video) showOverlayMessage(video, contentText("contentMissingCoursera"), "error");
        }
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, context.itemId)
          || setSourceCaptionTracks(this.platform, context.itemId, await this.listCaptionTracks())
      );

      return {
        sessionKey: context.itemId,
        video,
        message: {
          type: "captions.coursera.fetchTranscript",
          videoId: context.itemId,
          sourceLanguage: track.languageCode,
          trackUrl: track.trackUrl
        }
      };
    }
  },
  vimeo: {
    platform: "vimeo",
    loadingMessage: contentText("contentTranslationPreparing"),
    getSessionKey: getVimeoVideoId,
    findVideo: () => findVideoElement("vimeo"),
    async listCaptionTracks() {
      const videoId = getVimeoVideoId();
      return (await getVimeoTextTracks(videoId))
        .map((track) => createSourceCaptionTrack(track, {
          id: track.trackUrl,
          languageCode: track.sourceLanguage,
          trackUrl: track.trackUrl
        }))
        .filter(Boolean);
    },
    async buildTranscriptRequest() {
      const videoId = getVimeoVideoId();
      const video = this.findVideo();

      if (!videoId || !video) {
        console.warn("[AST] Missing Vimeo caption data:", {
          videoId: videoId || null,
          hasVideo: Boolean(video),
          url: location.href
        });
        if (video) showOverlayMessage(video, contentText("contentMissingVimeo"), "error");
        return null;
      }
      const track = requireCaptionTrack(
        getSelectedSourceCaptionTrack(this.platform, videoId)
          || setSourceCaptionTracks(this.platform, videoId, await this.listCaptionTracks())
      );

      return {
        sessionKey: videoId,
        video,
        message: {
          type: "captions.vimeo.fetchTranscript",
          videoId,
          sourceLanguage: track.languageCode,
          trackUrl: track.trackUrl,
          platform: "vimeo"
        }
      };
    }
  }
};

async function loadPlatformSubtitleOverlay(handler, options = {}) {
  if (subtitleState.disposed) return false;
  const loadGeneration = ++subtitleState.subtitleLoadGeneration;
  const isCurrentLoad = () => !subtitleState.disposed && subtitleState.enabled
    && loadGeneration === subtitleState.subtitleLoadGeneration;

  let request;
  try {
    const pendingRequest = handler.buildTranscriptRequest(options);
    request = pendingRequest?.then ? await pendingRequest : pendingRequest;
  } catch (error) {
    if (!isCurrentLoad()) return false;
    if (isCaptionsUnavailableError(error)) {
      markCaptionsUnavailable(handler.findVideo(), handler.platform, handler.getSessionKey?.());
      return false;
    }
    throw error;
  }
  if (!isCurrentLoad() || !request) return false;

  const pendingNative = handler.fetchNativeTranscript?.(request);
  const nativeDocument = pendingNative?.then ? await pendingNative : pendingNative;
  if (!isCurrentLoad()) return false;
  let response = nativeDocument ? { ok: true, document: nativeDocument } : await sendRuntimeMessage(request.message);
  if (!isCurrentLoad()) return false;
  if (handler.getSessionKey && handler.getSessionKey() !== request.sessionKey) return false;
  if (!response?.ok && isExtensionContextInvalidated(response?.error)) {
    disposeContentScript();
    return false;
  }
  if (!response?.ok && handler.recoverTranscriptDocument) {
    try {
      const document = await handler.recoverTranscriptDocument(response, request);
      if (document) {
        response = { ok: true, document };
      }
    } catch (error) {
      const prefix = response?.error ? `${response.error}; ` : "";
      response = { ok: false, error: `${prefix}page transcript fallback failed: ${error.message}` };
    }
  }
  if (!isCurrentLoad()) return false;
  if (!response?.ok) {
    // A video that listed caption tracks has captions, so this is a load failure, not a missing track.
    if (isCaptionsUnavailableError(response) && !getSelectedSourceCaptionTrack(handler.platform, request.sessionKey)) {
      markCaptionsUnavailable(request.video, handler.platform, request.sessionKey);
      return false;
    }
    console.warn(`[AST] Failed to load ${handler.platform} subtitles:`, response?.error || "Unknown error");
    const failure = contentText("contentCaptionsLoadFailed", [response?.error || "Unknown error"]);
    showOverlayMessage(request.video, failure, "error");
    // The caller hides the overlay when loading fails, so the reason also goes to a toast.
    showToast(failure, request.video, true);
    return false;
  }

  if (handler.platform === "youtube" && request.message.languageCode
    && response.document.sourceLanguage !== request.message.languageCode) {
    throw new Error(`Unexpected YouTube caption language: ${response.document.sourceLanguage}`);
  }

  const captionSettings = await getPublicSettings().catch(() => null);
  if (!isCurrentLoad()) return false;
  if (captionSettings) applyCaptionDisplaySettings(captionSettings);
  const sourceDocument = response.document;
  response = { ...response, document: applyPhraseSegmentation(sourceDocument, handler.platform) };

  subtitleState.currentSessionKey = request.sessionKey;
  subtitleState.currentPlatform = handler.platform;
  subtitleState.currentVideoId = response.document.videoId;
  subtitleState.currentRouteKey = handler.platform === "ted" ? getTedTalkSlug() || "" : "";
  subtitleState.pendingRouteKey = "";
  subtitleState.currentVideo = request.video;
  subtitleState.currentSourceDocument = sourceDocument;
  subtitleState.currentDocument = response.document;
  subtitleState.activeProviderId = "";
  subtitleState.defaultProviderId = "";
  subtitleState.expectedCueIds = new Set(response.document.cues.map((cue) => String(cue.id)));
  subtitleState.finalTranslatedCueIds = new Set();
  subtitleState.lastTemporaryPriorityKey = "";
  subtitleState.lastFallbackToastKey = "";
  subtitleState.serverBusyNoticeShown = false;
  handler.markLoaded?.(request.sessionKey, sourceDocument);

  clearOverlayStatus(request.video);
  setTranslationPhase("source");
  renderOverlay(request.video, response.document.cues);

  getTranslationProviderIds()
    .then(({ activeProviderId, defaultProviderId, temporaryPriorityWindowSeconds, availableProviders }) => {
      if (!isCurrentLoad()) return;
      subtitleState.availableProviders = availableProviders;
      subtitleState.temporaryPriorityWindowSeconds = temporaryPriorityWindowSeconds;
      startProviderTranslation(
        response.document,
        handler.platform,
        request.sessionKey,
        request.video,
        activeProviderId,
        defaultProviderId
      );
    })
    .catch((error) => {
      if (!isCurrentLoad()) return;
      console.warn("[AST] Failed to read translation providers; starting final translation:", error.message);
      subtitleState.availableProviders = getAvailableProviders();
      subtitleState.temporaryPriorityWindowSeconds = DEFAULT_TEMPORARY_PRIORITY_WINDOW_SECONDS;
      startProviderTranslation(
        response.document,
        handler.platform,
        request.sessionKey,
        request.video,
        "googleTranslate",
        "googleTranslate"
      );
    });
  return true;
}

let subtitlePreferenceUpdateGeneration = 0;
// Segmented documents keep a link to the caption lines they were built from.
const sourceDocumentsBySegmented = new WeakMap();
// Set once initialization resolves the frame; an embedded Vimeo player may belong to NVIDIA.
let contentPlatform = null;
let contentPlatformStarted = false;

// The popup's "AST on this site" switch: turning it off stops AST here at once and removes its UI;
// turning it back on resumes without a reload.
function setAstSiteActive(active) {
  const platform = contentPlatform;
  const handler = platformHandlers[platform];
  if (!handler || subtitleState.disposed) return;
  if (!active) {
    subtitleState.siteInactive = true;
    subtitleState.autoEnablePending = false;
    if (subtitleState.enabled) {
      void togglePlatformSubtitles(handler).catch((error) => console.warn("[AST] Failed to turn AST off here:", error.message));
    }
    closeProviderMenu({ notify: false });
    document.getElementById(BUTTON_ID)?.remove();
    document.getElementById(FLOATING_TOOLBAR_ID)?.remove();
    if (platform === "generic" && typeof setGenericSiteInactive === "function") setGenericSiteInactive(true);
    return;
  }
  const wasInactive = subtitleState.siteInactive;
  subtitleState.siteInactive = false;
  if (platform === "generic" && typeof setGenericSiteInactive === "function") setGenericSiteInactive(false);
  if (!contentPlatformStarted) {
    startPlatform(platform, handler);
  } else if (wasInactive) {
    sendRuntimeMessage({ type: "settings.getSubtitleEnabled" }).then((preference) => {
      if (!subtitleState.siteInactive && preference?.ok && preference.enabled) subtitleState.autoEnablePending = true;
    }).catch(() => {});
  }
}

function startPlatform(platform, handler) {
  if (contentPlatformStarted) return;
  contentPlatformStarted = true;
  const begin = () => {
    if (platform === "generic") {
      watchGenericPlayer();
    } else {
      watch(platform);
    }
    watchPlatformChanges(handler);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", begin, { once: true });
  } else {
    begin();
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "subtitles.setEnabled" && typeof message.enabled === "boolean") {
    const generation = ++subtitlePreferenceUpdateGeneration;
    const platform = contentPlatform;
    const handler = platformHandlers[platform];
    if (!handler || subtitleState.disposed) return false;
    if (!message.enabled) subtitleState.autoEnablePending = false;
    if (subtitleState.enabled !== message.enabled) {
      if (!message.enabled) {
        // Turning OFF must not depend on another settings read.
        void togglePlatformSubtitles(handler).catch((error) => console.warn("[AST] Failed to apply subtitle toggle:", error.message));
      } else if (!handler.findVideo()) {
        subtitleState.autoEnablePending = true;
      } else {
        void isPlatformEnabled(platform).then((allowed) => {
          if (generation === subtitlePreferenceUpdateGeneration && allowed && subtitleState.enabled !== message.enabled) return togglePlatformSubtitles(handler);
        }).catch((error) => console.warn("[AST] Failed to apply subtitle toggle:", error.message));
      }
    }
    refreshOpenProviderMenu();
    return false;
  }
  if (message?.type === "ast.site.setActive" && typeof message.active === "boolean") {
    setAstSiteActive(message.active);
    return false;
  }
  if (message?.type === "ast.providerMenu.setOpen") {
    crossFrameProviderMenuOpen = Boolean(message.open);
    if (!crossFrameProviderMenuOpen) closeProviderMenu({ notify: false });
    return false;
  }
  if (message?.type === "settings.changed") {
    const settings = message.settings || {};
    if (contentPlatform && contentPlatform !== "generic" && settings.platforms) {
      const active = settings.platforms[contentPlatform] !== false;
      if (active === Boolean(subtitleState.siteInactive)) setAstSiteActive(active);
    }
    subtitleState.subtitleStyle = settings.subtitleStyle || subtitleState.subtitleStyle;
    if (Object.hasOwn(SUBTITLE_DISPLAY_MESSAGE_KEYS, settings.subtitleDisplayMode)) {
      subtitleState.subtitleDisplayMode = settings.subtitleDisplayMode;
    }
    subtitleState.translationStyle = settings.translationStyle || subtitleState.translationStyle;
    applyCustomStyleLabels(settings);
    if (typeof settings.preferYoutubeProvidedTranslation === "boolean"
      && settings.preferYoutubeProvidedTranslation !== subtitleState.preferYoutubeProvidedTranslation) {
      applyPreferYoutubeProvidedTranslation(settings.preferYoutubeProvidedTranslation);
    }
    if (applyCaptionDisplaySettings(settings)) reapplyPhraseSegmentation();
    subtitleState.targetLanguages = settings.targetLanguages || subtitleState.targetLanguages;
    subtitleState.targetLanguage = settings.targetLanguage || subtitleState.targetLanguage;
    subtitleState.availableProviders = getAvailableProviders(settings);
    if (subtitleState.availableProviders.some((provider) => provider.id === settings.activeProvider)) {
      subtitleState.activeProviderId = settings.activeProvider;
    }
    subtitleState.defaultProviderId = resolveDefaultTranslationProviderId(settings);
    subtitleState.temporaryPriorityWindowSeconds = resolveTemporaryPriorityWindowSeconds(settings);
    applyOverlayStyle(findOverlay(subtitleState.currentVideo));
    if (subtitleState.currentVideo) renderCurrentOverlayCue(subtitleState.currentVideo);
    renderUdemyTranscriptTranslations();
    refreshOpenProviderMenu();
    return false;
  }
  if (message?.type === "summary.progress") {
    updateSummaryProgress(message.requestId, message.progress);
    return false;
  }
  if (message?.type !== "translation.progress") return false;
  if (!subtitleState.enabled || message.videoId !== subtitleState.currentVideoId) return false;

  if (message.mode === "temporary") {
    if (message.requestId && message.requestId !== subtitleState.activeTemporaryRequestId) return false;
    if (["complete", "fallback"].includes(subtitleState.translationPhase) || !hasUnfinalizedCue(message.progress?.cues)) return false;
    showFallbackToast(message.progress);
    setTranslationPhase("temporary");
    applyTranslatedCues(subtitleState.currentVideo, message.progress?.cues, { preserveFinalCues: true });
    refreshCurrentCueTranslationPhase(subtitleState.currentVideo);
    return false;
  }
  if (message.mode === "final") {
    if (message.requestId && message.requestId !== subtitleState.activeFinalRequestId) return false;
    if (message.progress?.providerNotice === "server_busy") {
      subtitleState.providerBusy = true;
      updateProviderMenuStatus();
      showServerBusyNotice();
      return false;
    }
    showFallbackToast(message.progress);
    applyFinalTranslationResult(subtitleState.currentVideo, message.progress?.cues, message.progress);
    if (hasCompleteFinalTranslation()) setTranslationPhase("complete");
    else setTranslationPhase(hasCurrentFinalTranslation() ? "current" : "temporary");
    return false;
  }
  applyTranslatedCues(subtitleState.currentVideo, message.progress?.cues);
  return false;
});

async function togglePlatformSubtitles(handler) {
  if (subtitleState.disposed || (subtitleState.loading && !subtitleState.enabled)) return;

  subtitleState.autoEnablePending = false;
  subtitleState.enabled = !subtitleState.enabled;
  if (!subtitleState.enabled) {
    subtitleState.subtitleLoadGeneration += 1;
    subtitleState.loading = false;
    invalidateTranslationRequests();
    setTranslationPhase("off");
  }
  setButtonState(subtitleState.enabled, false);

  if (!subtitleState.enabled) {
    setOverlayVisible(subtitleState.currentVideo || handler.findVideo(), false);
    removeUdemyTranscriptTranslationElements();
    return;
  }

  setOverlayVisible(subtitleState.currentVideo, true);

  const sessionKey = handler.getSessionKey();
  if (sessionKey && subtitleState.currentPlatform === handler.platform && subtitleState.currentSessionKey === sessionKey && subtitleState.currentVideo?.astSubtitleCues) {
    if (!hasCompleteFinalTranslation() && subtitleState.currentDocument) {
      startProviderTranslation(
        subtitleState.currentDocument, handler.platform, sessionKey, subtitleState.currentVideo,
        subtitleState.activeProviderId, subtitleState.defaultProviderId
      );
      return;
    }
    renderOverlay(subtitleState.currentVideo, subtitleState.currentVideo.astSubtitleCues);
    renderUdemyTranscriptTranslations();
    return;
  }

  subtitleState.loading = true;
  subtitleState.loadingSessionKey = sessionKey || "";
  setButtonState(true, true);
  showOverlayMessage(handler.findVideo(), handler.loadingMessage);
  const loadGeneration = subtitleState.subtitleLoadGeneration + 1;
  try {
    const loaded = await loadPlatformSubtitleOverlay(handler);
    if (loadGeneration !== subtitleState.subtitleLoadGeneration) return;
    // A video without captions leaves AST on for the next video.
    if (!loaded && !isMarkedCaptionsUnavailable(handler.platform, handler.getSessionKey?.())) {
      subtitleState.enabled = false;
      setOverlayVisible(subtitleState.currentVideo, false);
    }
  } catch (error) {
    if (loadGeneration !== subtitleState.subtitleLoadGeneration) return;
    subtitleState.enabled = false;
    setOverlayVisible(subtitleState.currentVideo, false);
    throw error;
  } finally {
    if (loadGeneration === subtitleState.subtitleLoadGeneration) {
      subtitleState.loading = false;
      subtitleState.loadingSessionKey = "";
      setButtonState(subtitleState.enabled, false);
    }
  }
}

function toggleSubtitles(platform) {
  const handler = platformHandlers[platform];
  if (!handler || subtitleState.disposed || (subtitleState.loading && !subtitleState.enabled)) return Promise.resolve();
  const enabled = !subtitleState.enabled;
  // Turning AST on by hand checks the current video again.
  subtitleState.captionsUnavailable = null;
  void sendRuntimeMessage({ type: "settings.setSubtitleEnabled", enabled }).then((response) => {
    if (!response?.ok) console.warn("[AST] Failed to save subtitle toggle:", response?.error || "Unknown error");
  });
  return togglePlatformSubtitles(handler);
}

function watchPlatformChanges(handler) {
  const tryRefresh = () => {
    if (subtitleState.disposed || subtitleState.siteInactive) return;
    // A load for a YouTube video the viewer already left must not hold up the one they are on now;
    // starting the new load makes the old one stale, and it ends without a word.
    const leftLoadingVideo = handler.platform === "youtube" && subtitleState.loading
      && subtitleState.loadingSessionKey && handler.getSessionKey()
      && handler.getSessionKey() !== subtitleState.loadingSessionKey;
    if (subtitleState.loading && !leftLoadingVideo) return;
    if (subtitleState.autoEnablePending) {
      if (!handler.getSessionKey() || !handler.findVideo()) return;
      if (handler.platform === "udemy" && !getUdemyCourseId()) return;
      subtitleState.autoEnablePending = false;
      togglePlatformSubtitles(handler).catch((error) => {
        console.warn(`[AST] Failed to start ${handler.platform} subtitles:`, error.message);
        showToast(contentText("contentCaptionsLoadFailed", [error.message]));
      });
      return;
    }
    if (!subtitleState.enabled) return;
    if (handler.platform === "ted") {
      const routeKey = getTedTalkSlug();
      const routeChanged = Boolean(routeKey
        && subtitleState.currentPlatform === "ted"
        && subtitleState.currentRouteKey
        && routeKey !== subtitleState.currentRouteKey);
      if (routeChanged && subtitleState.pendingRouteKey !== routeKey) {
        subtitleState.pendingRouteKey = routeKey;
        invalidateTranslationRequests();
        subtitleState.finalTranslatedCueIds = new Set();
        setTranslationPhase("temporary");
        showOverlayMessage(handler.findVideo(), handler.loadingMessage);
      }
    }
    const sessionKey = handler.getSessionKey();
    if (!sessionKey || (subtitleState.currentPlatform === handler.platform && sessionKey === subtitleState.currentSessionKey)) return;
    // A video already found to have no captions is not asked for again.
    if (isMarkedCaptionsUnavailable(handler.platform, sessionKey)) return;

    subtitleState.loading = true;
    setButtonState(true, true);
    // The old video's lines must not stay up while the new captions load. A YouTube video id
    // is final at once; other platforms may briefly lose page data and keep their lines meanwhile.
    if (handler.platform === "youtube" && (subtitleState.currentSessionKey || leftLoadingVideo)) {
      invalidateTranslationRequests();
      showOverlayMessage(handler.findVideo(), handler.loadingMessage);
      // Its lines are gone now, so coming back to that video must load it again.
      subtitleState.currentSessionKey = "";
    }
    subtitleState.loadingSessionKey = sessionKey;
    const pending = loadPlatformSubtitleOverlay(handler, { quietMissingPageData: true });
    const generation = subtitleState.subtitleLoadGeneration;
    pending.finally(() => {
      // A newer load took over; it clears the loading state when it ends.
      if (generation !== subtitleState.subtitleLoadGeneration) return;
      subtitleState.loading = false;
      subtitleState.loadingSessionKey = "";
      setButtonState(subtitleState.enabled, false);
    });
  };

  const observer = new MutationObserver(() => {
    if (subtitleState.disposed) {
      observer.disconnect();
      return;
    }
    if (handler.platform === "ted") return;
    tryRefresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(() => {
    if (!subtitleState.disposed) tryRefresh();
  }, 1500);
  tryRefresh();
}

async function isPlatformEnabled(platform) {
  if (subtitleState.disposed || !chrome?.runtime?.id) return false;

  try {
    const settings = await getPublicSettings();
    return settings.platforms?.[platform] !== false;
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      disposeContentScript();
      return false;
    }
    console.warn("[AST] Failed to read platform settings; enabling by default:", error.message);
    return true;
  }
}

globalThis.addEventListener?.("resize", refreshActiveOverlayStyle);
document.addEventListener?.("fullscreenchange", refreshActiveOverlayStyle);

function closeProviderMenuOnOutsideInteraction(event) {
  const menu = document.getElementById(PROVIDER_MENU_ID);
  const button = document.getElementById(BUTTON_ID);
  if (menu && !menu.hidden) {
    if (button?.contains?.(event.target) || menu.contains?.(event.target)) return;
    closeProviderMenu();
    return;
  }
  if (event.type === "pointerdown" && crossFrameProviderMenuOpen && globalThis.top === globalThis) {
    void setProviderMenuVisibility(false);
  }
}

// Some player toolbar buttons stop click propagation. Listen while the event is
// captured so opening another player menu always closes the AST menu first.
document.addEventListener?.("pointerdown", closeProviderMenuOnOutsideInteraction, { capture: true });
document.addEventListener?.("click", closeProviderMenuOnOutsideInteraction, { capture: true });
document.addEventListener?.("keydown", (event) => {
  if (event.key === "Escape") closeProviderMenu();
});

async function isNvidiaAcademyVimeoFrame() {
  const response = await sendRuntimeMessage({ type: "platform.nvidia.isCoursePlayer" });
  return Boolean(response?.ok && response.isNvidiaCoursePlayer);
}

async function getVimeoPlayerPlatform() {
  const response = await sendRuntimeMessage({ type: "platform.vimeo.getContext" });
  return response?.ok && isVimeoPlatform(response.platform) ? response.platform : null;
}

async function initializeContentScript() {
  let platform = detectPlatform();
  if (!platform) return;
  if (platform === "vimeo") {
    platform = await getVimeoPlayerPlatform();
    if (!platform) return;
  }
  contentPlatform = platform;

  const preferenceGeneration = subtitlePreferenceUpdateGeneration;
  Promise.all([isPlatformEnabled(platform), loadSubtitleStyle(), sendRuntimeMessage({ type: "settings.getSubtitleEnabled" })]).then(([enabled, , preference]) => {
    const handler = platformHandlers[platform];
    if (!handler) return;
    if (!enabled) {
      // Turned off for this site; the popup can turn it back on without a reload.
      subtitleState.siteInactive = true;
      return;
    }
    if (preferenceGeneration === subtitlePreferenceUpdateGeneration) {
      subtitleState.autoEnablePending = preference?.ok === true && preference.enabled === true;
    }
    startPlatform(platform, handler);
  }).catch((error) => {
    if (isExtensionContextInvalidated(error)) {
      disposeContentScript();
      return;
    }
    console.warn("[AST] Failed to initialize content script:", error.message);
  });
}

void initializeContentScript();
