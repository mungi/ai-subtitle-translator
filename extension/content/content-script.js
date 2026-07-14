const BUTTON_ID = "ast-toolbar-button";
const FLOATING_TOOLBAR_ID = "ast-floating-toolbar";
const PROVIDER_MENU_ID = "ast-provider-menu";
const OVERLAY_ID = "ast-subtitle-overlay";
const TOAST_ID = "ast-toast";
const UDEMY_TRANSCRIPT_PANEL_SELECTOR = '[data-purpose="transcript-panel"]';
const UDEMY_TRANSCRIPT_CUE_SELECTOR = '[data-purpose="transcript-cue"], [data-purpose="transcript-cue-active"]';
const UDEMY_TRANSCRIPT_CUE_TEXT_SELECTOR = '[data-purpose="cue-text"]';
const UDEMY_TRANSCRIPT_TRANSLATION_CLASS = "ast-udemy-transcript-translation";
const WEB_FONT_STYLE_ID = "ast-web-font-style";
const OVERLAY_VERTICAL_MARGIN_PX = 12;
const OVERLAY_MIN_HEIGHT_PX = 42;
const OVERLAY_RESIZE_HIT_WIDTH_PX = 18;
const OVERLAY_REFERENCE_WIDTH_PX = 1280;
const OVERLAY_REFERENCE_HEIGHT_PX = 720;
const UDEMY_FLOATING_TOOLBAR_DELAY_MS = 2500;
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
  ["local", "Local LLM", "openai-chat"]
];
const TRANSLATION_STYLE_MESSAGE_KEYS = {
  natural: "styleNatural",
  lecture: "styleLecture",
  technical: "styleTechnical",
  custom: "styleCustom",
  custom2: "styleCustom2"
};
const YOUTUBE_TRANSCRIPT_TEXT_PATTERN = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
const YOUTUBE_XML_ATTRIBUTE_PATTERN = /(\w+)="([^"]*)"/g;
const YOUTUBE_ANDROID_INNERTUBE_CONTEXT = {
  client: {
    clientName: "ANDROID",
    clientVersion: "20.10.38"
  }
};
const YOUTUBE_ENTITY_MAP = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&#39;": "'",
  "&apos;": "'"
};
const subtitleState = {
  enabled: false,
  loading: false,
  currentLectureId: "",
  currentSessionKey: "",
  currentPlatform: "",
  currentVideoId: "",
  currentVideo: null,
  currentDocument: null,
  activeProviderId: "",
  translationStyle: "",
  defaultProviderId: "",
  sourceCaptionTracks: [],
  sourceCaptionSessionKey: "",
  selectedSourceCaptionTrackId: "",
  sourceCaptionMenuExpanded: false,
  translationStyleMenuExpanded: false,
  temporaryPriorityWindowSeconds: DEFAULT_TEMPORARY_PRIORITY_WINDOW_SECONDS,
  availableProviders: [],
  translationGeneration: 0,
  translationRequestSequence: 0,
  activeFinalRequestId: "",
  activeTemporaryRequestId: "",
  pendingProviderId: "",
  translationPhase: "off",
  expectedCueIds: new Set(),
  finalTranslatedCueIds: new Set(),
  lastTemporaryPriorityKey: "",
  lastQuotaToastKey: "",
  toastTimeoutId: null,
  subtitleStyle: null,
  udemyTranscriptTranslations: new Map(),
  udemyTranscriptObserver: null,
  udemyTranscriptRefreshQueued: false,
  disposed: false
};
const CAPTION_SVG = `
<svg class="ast-toolbar-icon" viewBox="0 0 1240 1240" width="24" height="24" aria-hidden="true" focusable="false">
  <path class="ast-toolbar-icon-bg" d="M330 110H910Q1100 110 1100 327V797Q1100 969 910 969H850V1109Q850 1132 818 1119L680 969H330Q140 969 140 797V327Q140 110 330 110Z"/>
  <path class="ast-toolbar-icon-outline" d="M335 150H905Q1060 150 1060 331V801Q1060 936 905 936H835V1076Q835 1094 823 1088L665 936H335Q180 936 180 801V331Q180 150 335 150Z"/>
  <text class="ast-toolbar-icon-mark" x="620" y="715" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="400" letter-spacing="-8">AST</text>
</svg>`.trim();

function detectPlatform() {
  const host = location.hostname;
  if (host.includes("youtube.com")) return "youtube";
  if (host.includes("udemy.com")) return "udemy";
  if (host === "player.vimeo.com") return "vimeo";
  if ((host === "vimeo.com" || host === "www.vimeo.com") && getVimeoVideoId()) return "vimeo";
  return null;
}

function isVimeoPlatform(platform) {
  return platform === "nvidia" || platform === "vimeo";
}

function contentText(key, substitutions) {
  return chrome?.i18n?.getMessage?.(key, substitutions) || key;
}

function getAvailableProviders(settings = {}) {
  return PROVIDER_MENU_ORDER.map(([id, defaultLabel, apiStyle]) => ({
    id,
    label: settings.providers?.[id]?.label || defaultLabel,
    apiStyle: settings.providers?.[id]?.apiStyle || apiStyle
  })).filter((provider) => provider.apiStyle === "google-translate"
    || settings.providerTestStatus?.[provider.id] === "success"
    || settings.activeProvider === provider.id);
}

function isMachineTranslationProvider(providerId) {
  return providerId === "googleTranslate" || providerId === "deepl";
}

function disposeContentScript() {
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

async function getPublicSettings() {
  const response = await sendRuntimeMessage({ type: "settings.getPublic" });
  if (!response?.ok) {
    throw new Error(response?.error || "Could not load extension settings.");
  }
  return response.settings || {};
}

function findToolbarTarget(platform, { allowFloatingToolbar = true } = {}) {
  if (platform === "udemy") {
    return document.querySelector('[data-purpose="video-controls"]')
      || findUdemyPlayerControls()
      || (allowFloatingToolbar ? ensureFloatingToolbar() : null);
  }

  if (platform === "youtube") {
    return document.querySelector("#movie_player .ytp-right-controls");
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
  if (platform === "youtube") {
    return document.querySelector("#movie_player");
  }
  if (isVimeoPlatform(platform)) {
    return document.querySelector(".vp-player-ui-overlays")
      || document.querySelector(".vp-player")
      || findOverlayHost(platform, findVideoElement(platform));
  }
  return document.querySelector('[data-purpose="media-player-container"]')
    || findOverlayHost(platform, findVideoElement(platform));
}

function closeProviderMenu() {
  const menu = document.getElementById(PROVIDER_MENU_ID);
  if (menu) menu.hidden = true;
  const button = document.getElementById(BUTTON_ID);
  button?.setAttribute("aria-expanded", "false");
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
  return contentText(TRANSLATION_STYLE_MESSAGE_KEYS[styleId] || "styleNatural");
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
  if (subtitleState.sourceCaptionMenuExpanded) submenu.classList.add("open");

  const toggle = createProviderMenuButton(
    "ast-provider-menu-item ast-source-caption-toggle",
    `${contentText("contentSourceCaptions")}: ${getSourceCaptionTrackLabel(selectedTrack)}`
  );
  toggle.setAttribute("role", "menuitem");
  toggle.setAttribute("aria-expanded", String(subtitleState.sourceCaptionMenuExpanded));
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    subtitleState.sourceCaptionMenuExpanded = !subtitleState.sourceCaptionMenuExpanded;
    renderProviderMenu(platform);
  });
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

function renderTranslationStyleMenu(menu, platform) {
  const selectedStyle = subtitleState.translationStyle || "custom";
  const submenu = document.createElement("div");
  submenu.className = "ast-translation-style-submenu";
  if (subtitleState.translationStyleMenuExpanded) submenu.classList.add("open");

  const toggle = createProviderMenuButton(
    "ast-provider-menu-item ast-translation-style-toggle",
    `${contentText("translationStyle")}: ${getTranslationStyleLabel(selectedStyle)}`
  );
  toggle.setAttribute("role", "menuitem");
  toggle.setAttribute("aria-haspopup", "menu");
  toggle.setAttribute("aria-expanded", String(subtitleState.translationStyleMenuExpanded));
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    subtitleState.translationStyleMenuExpanded = !subtitleState.translationStyleMenuExpanded;
    renderProviderMenu(platform);
  });
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
  submenu.append(list);
  menu.append(submenu);
}

function renderProviderMenu(platform = detectPlatform()) {
  const menu = document.getElementById(PROVIDER_MENU_ID);
  if (!menu) return;
  clearElement(menu);
  menu.dataset.phase = subtitleState.translationPhase;

  const toggleButton = createProviderMenuButton(
    "ast-provider-menu-item ast-provider-toggle-item",
    contentText("contentToggleSubtitles")
  );
  toggleButton.setAttribute("role", "menuitemcheckbox");
  toggleButton.setAttribute("aria-checked", String(subtitleState.enabled));
  const toggle = document.createElement("span");
  toggle.className = "ast-provider-toggle";
  toggle.setAttribute("aria-hidden", "true");
  toggleButton.append(toggle);
  toggleButton.addEventListener("click", (event) => {
    event.stopPropagation();
    Promise.resolve(toggleSubtitles(platform))
      .catch((error) => showToast(error.message))
      .finally(() => renderProviderMenu(platform));
  });

  for (const provider of subtitleState.availableProviders) {
    const isActive = provider.id === subtitleState.activeProviderId;
    const item = createProviderMenuButton("ast-provider-menu-item ast-provider-item", provider.label);
    item.dataset.providerId = provider.id;
    item.setAttribute("role", "menuitemradio");
    item.setAttribute("aria-checked", String(isActive));
    if (isActive) item.classList.add("active");

    if (provider.id === subtitleState.pendingProviderId) {
      const spinner = document.createElement("span");
      spinner.className = "ast-provider-spinner";
      spinner.setAttribute("aria-hidden", "true");
      item.prepend(spinner);
      item.classList.add("pending");
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
  renderTranslationStyleMenu(menu, platform);

  const lastSeparator = document.createElement("div");
  lastSeparator.className = "ast-provider-menu-separator";
  lastSeparator.setAttribute("role", "separator");
  menu.append(lastSeparator);
  menu.append(toggleButton);

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
}

function ensureProviderMenu(platform) {
  const host = getProviderMenuHost(platform);
  if (!host) return null;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
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
  } else {
    menu.className = `ast-provider-menu ast-provider-menu-${platform}`;
    menu.dataset.platform = platform;
  }
  if (menu.parentElement !== host) host.append(menu);
  return menu;
}

async function refreshAvailableProviders() {
  const settings = await getPublicSettings();
  subtitleState.availableProviders = getAvailableProviders(settings);
  const activeProviderAvailable = subtitleState.availableProviders
    .some((provider) => provider.id === settings.activeProvider);
  subtitleState.activeProviderId = activeProviderAvailable ? settings.activeProvider : "googleTranslate";
  subtitleState.translationStyle = settings.translationStyle || "custom";
  subtitleState.defaultProviderId = resolveDefaultTranslationProviderId(settings);
  subtitleState.temporaryPriorityWindowSeconds = resolveTemporaryPriorityWindowSeconds(settings);
  return settings;
}

async function refreshSourceCaptionTracks(platform) {
  const handler = platformHandlers[platform];
  const sessionKey = handler?.getSessionKey();
  if (!handler || !sessionKey || !handler.listCaptionTracks) return null;
  if (subtitleState.sourceCaptionSessionKey === `${platform}:${sessionKey}` && subtitleState.sourceCaptionTracks.length > 0) {
    return getSelectedSourceCaptionTrack(platform, sessionKey);
  }
  const tracks = await handler.listCaptionTracks();
  return setSourceCaptionTracks(platform, sessionKey, tracks);
}

async function toggleProviderMenu(platform) {
  const menu = ensureProviderMenu(platform);
  if (!menu) return;
  if (!menu.hidden) {
    closeProviderMenu();
    return;
  }
  try {
    await Promise.all([refreshAvailableProviders(), refreshSourceCaptionTracks(platform)]);
  } catch (error) {
    console.warn("[AST] Failed to load provider menu:", error.message);
    subtitleState.availableProviders = getAvailableProviders();
    subtitleState.activeProviderId ||= "googleTranslate";
    subtitleState.defaultProviderId ||= "googleTranslate";
  }
  renderProviderMenu(platform);
  menu.hidden = false;
  document.getElementById(BUTTON_ID)?.setAttribute("aria-expanded", "true");
}

async function selectSourceCaptionTrack(platform, trackId) {
  const handler = platformHandlers[platform];
  const sessionKey = handler?.getSessionKey();
  const track = subtitleState.sourceCaptionTracks.find((item) => item.id === trackId);
  if (!handler || !sessionKey || !track || subtitleState.loading) return;
  if (track.id === subtitleState.selectedSourceCaptionTrackId) {
    subtitleState.sourceCaptionMenuExpanded = false;
    renderProviderMenu(platform);
    return;
  }

  subtitleState.selectedSourceCaptionTrackId = track.id;
  subtitleState.sourceCaptionMenuExpanded = false;
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

function refreshOpenProviderMenu() {
  const menu = document.getElementById(PROVIDER_MENU_ID);
  if (menu && !menu.hidden) renderProviderMenu(menu.dataset.platform || detectPlatform());
}

function findVideoElement(platform) {
  if (platform === "udemy") {
    return document.querySelector("video");
  }

  if (platform === "youtube") {
    return document.querySelector("#movie_player video, video");
  }

  if (isVimeoPlatform(platform)) {
    return document.querySelector("video");
  }

  return null;
}

function findOverlayHost(platform, video) {
  if (platform === "youtube") {
    return document.querySelector("#movie_player") || video?.parentElement || null;
  }

  if (isVimeoPlatform(platform)) {
    return document.querySelector(".vp-player-ui-overlays") || video?.parentElement || null;
  }

  return video?.parentElement || null;
}

function findOverlay(video, platform = subtitleState.currentPlatform || detectPlatform()) {
  return findOverlayHost(platform, video)?.querySelector(`#${OVERLAY_ID}`) || null;
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

  const pathMatch = location.pathname.match(/^\/(?:shorts|embed)\/([a-zA-Z0-9_-]{11})/);
  return pathMatch?.[1] || null;
}

function getVimeoVideoId() {
  const match = location.pathname.match(/(?:^|\/)(\d+)(?:\/[a-zA-Z0-9_-]+)?\/?$/);
  return match?.[1] || null;
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

function selectDefaultSourceCaptionTrack(tracks) {
  const usableTracks = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
  if (usableTracks.length === 1) return usableTracks[0];
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
    subtitleState.selectedSourceCaptionTrackId = selectDefaultSourceCaptionTrack(normalizedTracks)?.id || "";
  }
  return getSelectedSourceCaptionTrack(platform, sessionKey);
}

function getSelectedSourceCaptionTrack(platform, sessionKey) {
  if (subtitleState.sourceCaptionSessionKey !== `${platform}:${sessionKey}`) return null;
  return subtitleState.sourceCaptionTracks
    .find((track) => track.id === subtitleState.selectedSourceCaptionTrackId)
    || selectDefaultSourceCaptionTrack(subtitleState.sourceCaptionTracks);
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

function getYoutubeTranscriptPanelDataFromPage() {
  const pageData = parseJsonObjectAfter(document.documentElement?.innerHTML, "ytInitialData");
  const ytcfg = parseYoutubeConfigFromPage();

  return {
    transcriptParams: findYoutubeTranscriptParams(pageData),
    innertubeApiKey: ytcfg.INNERTUBE_API_KEY || null,
    innertubeContext: ytcfg.INNERTUBE_CONTEXT || null
  };
}

function cloneYoutubeAndroidContext() {
  return JSON.parse(JSON.stringify(YOUTUBE_ANDROID_INNERTUBE_CONTEXT));
}

function decodeYoutubeXmlEntities(value) {
  return String(value ?? "").replace(/&(amp|lt|gt|quot|apos|#39);/g, (entity) => YOUTUBE_ENTITY_MAP[entity] || entity);
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
    cues.push(normalizeYoutubePageCue({
      id: `yt-${cues.length}`,
      start,
      end: start + Math.max(durationMs / 1000, 0.001),
      text
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

async function fetchYoutubeJsonOnPage(url, init) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = body.error?.message || body.message || response.statusText;
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  return body;
}

async function fetchYoutubeTextOnPage(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return text;
}

function normalizeYoutubeCaptionTracksOnPage(playerJson, videoId) {
  const renderer = playerJson?.captions?.playerCaptionsTracklistRenderer
    || playerJson?.playerCaptionsTracklistRenderer;
  const tracks = renderer?.captionTracks;

  if (!Array.isArray(tracks)) {
    return [];
  }

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

function isYoutubeEnglishTrack(track) {
  const languageCode = String(track?.languageCode || "").toLowerCase();
  const label = String(track?.label || "").toLowerCase();

  return languageCode === "en"
    || languageCode.startsWith("en-")
    || label.includes("english");
}

function selectYoutubeCaptionTrackOnPage(tracks, languageCode) {
  if (languageCode) {
    const requested = String(languageCode).toLowerCase();
    return tracks.find((track) => String(track.languageCode || "").toLowerCase() === requested && !track.isAutoGenerated)
      || tracks.find((track) => String(track.languageCode || "").toLowerCase() === requested);
  }

  return tracks.find((track) => isYoutubeEnglishTrack(track) && !track.isAutoGenerated)
    || tracks.find(isYoutubeEnglishTrack)
    || tracks.find((track) => !track.isAutoGenerated)
    || tracks[0];
}

function setYoutubeUrlParam(url, key, value) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  } catch (_error) {
    const separator = String(url).includes("?") ? "&" : "?";
    return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

function removeYoutubeUrlParam(url, key) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete(key);
    return parsed.toString();
  } catch (_error) {
    return String(url).replace(new RegExp(`([?&])${key}=[^&]+&?`), "$1").replace(/[?&]$/, "");
  }
}

function getYoutubeTranscriptUrlCandidatesOnPage(baseUrl, { preferPlainXml = false } = {}) {
  const urls = [];
  const add = (url) => {
    if (url && !urls.includes(url)) {
      urls.push(url);
    }
  };

  if (preferPlainXml) {
    add(removeYoutubeUrlParam(baseUrl, "fmt"));
  }
  add(String(baseUrl));
  for (const format of ["json3", "srv3", "vtt"]) {
    add(setYoutubeUrlParam(baseUrl, "fmt", format));
  }

  const withoutFmt = removeYoutubeUrlParam(baseUrl, "fmt");
  if (withoutFmt !== String(baseUrl)) {
    add(withoutFmt);
  }
  return urls;
}

async function fetchYoutubeTrackCuesOnPage(track, { preferPlainXml = false } = {}) {
  let lastError = null;
  for (const transcriptUrl of getYoutubeTranscriptUrlCandidatesOnPage(track.baseUrl, { preferPlainXml })) {
    try {
      const payload = await fetchYoutubeTextOnPage(transcriptUrl, {
        credentials: "include",
        referrer: `https://www.youtube.com/watch?v=${encodeURIComponent(track.videoId)}`,
        headers: {
          Accept: "application/json,text/xml,text/plain,*/*",
          "Accept-Language": track.languageCode || "en"
        }
      });
      return parseYoutubeTranscriptPayloadOnPage(payload);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Could not parse YouTube transcript.");
}

function buildYoutubeAndroidTranscriptRetry(response, requestMessage) {
  const error = String(response?.error || "");
  const apiKey = response?.retryOnPage?.innertubeApiKey || requestMessage?.innertubeApiKey;
  if (!apiKey || !requestMessage?.videoId) {
    return null;
  }

  if (error.includes("android player fallback failed")) {
    return {
      videoId: requestMessage.videoId,
      languageCode: response?.retryOnPage?.languageCode || requestMessage.languageCode,
      innertubeApiKey: apiKey
    };
  }

  return null;
}

async function fetchYoutubeAndroidTranscriptDocumentOnPage(retry) {
  const playerJson = await fetchYoutubeJsonOnPage(
    `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(retry.innertubeApiKey)}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": retry.languageCode || "en"
      },
      body: JSON.stringify({
        context: cloneYoutubeAndroidContext(),
        videoId: retry.videoId,
        contentCheckOk: true,
        racyCheckOk: true
      })
    }
  );
  const tracks = normalizeYoutubeCaptionTracksOnPage(playerJson, retry.videoId);
  const selectedTrack = selectYoutubeCaptionTrackOnPage(tracks, retry.languageCode);

  if (!selectedTrack?.baseUrl) {
    throw new Error("No YouTube captions are available for this video.");
  }

  return {
    platform: "youtube",
    videoId: selectedTrack.videoId,
    sourceLanguage: selectedTrack.languageCode,
    cues: await fetchYoutubeTrackCuesOnPage(selectedTrack, { preferPlainXml: true })
  };
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

function normalizeYoutubePageCue({ id, start, end, text }) {
  return {
    id: String(id),
    start: Number(start),
    end: Number(end),
    text: String(text ?? "").replace(/\s+/g, " ").trim()
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
    return response.retryOnPage;
  }

  const error = String(response?.error || "");
  if (!error.includes("transcript panel fallback failed") || !requestMessage?.transcriptParams || !requestMessage?.innertubeApiKey) {
    return null;
  }

  return {
    type: "youtubeTranscriptPanel",
    videoId: requestMessage.videoId,
    languageCode: requestMessage.languageCode,
    params: requestMessage.transcriptParams,
    innertubeApiKey: requestMessage.innertubeApiKey,
    innertubeContext: requestMessage.innertubeContext
  };
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

  return {
    platform: "youtube",
    videoId: retry.videoId || getYoutubeVideoId(),
    sourceLanguage: retry.languageCode || client.hl || "en",
    cues: parseYoutubeTranscriptPanelResponseOnPage(body)
  };
}

function getCurrentSessionKey(platform) {
  if (platform === "youtube") return getYoutubeVideoId();
  if (platform === "udemy") return getUdemyLectureId();
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

function findActiveCue(cues, currentTime) {
  if (!Array.isArray(cues)) return null;
  return cues.find((cue) => currentTime >= cue.start && currentTime < cue.end) || null;
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

function getOverlayScale(overlay) {
  const parentRect = overlay?.parentElement?.getBoundingClientRect();
  if (!parentRect?.width || !parentRect?.height) return 1;

  const widthScale = parentRect.width / OVERLAY_REFERENCE_WIDTH_PX;
  const heightScale = parentRect.height / OVERLAY_REFERENCE_HEIGHT_PX;
  return clampNumber(Math.min(widthScale, heightScale), 0.35, 3, 1);
}

function scalePx(value, scale, min = 0) {
  return Math.max(min, value * scale);
}

function buildTextShadow(style, scale = 1) {
  if (style.shadowEnabled) {
    const distance = scalePx(clampNumber(style.shadowDistance, 0, 12, 2), scale);
    const blur = scalePx(clampNumber(style.shadowBlur, 0, 20, 4), scale);
    return `${formatPx(distance)} ${formatPx(distance)} ${formatPx(blur)} ${style.shadowColor || "#000000"}`;
  }
  return "none";
}

function getOverlayBackgroundColor(style) {
  if (subtitleState.translationPhase === "temporary") {
    return style.pendingBackgroundColor || "#750000";
  }
  return style.backgroundColor || "#b0b0b0";
}

function applyWebFontCss(css) {
  let styleElement = document.getElementById(WEB_FONT_STYLE_ID);
  if (!css) {
    styleElement?.remove();
    return;
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

function calculateOverlayMaxHeight(overlay, yPercent) {
  const parentRect = overlay.parentElement?.getBoundingClientRect();
  if (!parentRect?.height) {
    return null;
  }

  const centerY = (clampNumber(yPercent, 0, 100, 78) / 100) * parentRect.height;
  const availableAbove = centerY - OVERLAY_VERTICAL_MARGIN_PX;
  const availableBelow = parentRect.height - centerY - OVERLAY_VERTICAL_MARGIN_PX;
  const centeredLimit = Math.floor(Math.min(availableAbove, availableBelow) * 2);
  const fullLimit = Math.floor(parentRect.height - OVERLAY_VERTICAL_MARGIN_PX * 2);
  return Math.max(OVERLAY_MIN_HEIGHT_PX, Math.min(centeredLimit, fullLimit));
}

function fitOverlayHeightToViewport(overlay, yPercent) {
  overlay.style.height = "auto";
  overlay.style.overflowX = "hidden";
  overlay.style.overflowY = "auto";

  const maxHeight = calculateOverlayMaxHeight(overlay, yPercent);
  if (maxHeight === null) {
    overlay.style.maxHeight = "";
    return;
  }

  overlay.style.maxHeight = `${maxHeight}px`;
}

function applyOverlayStyle(overlay) {
  if (!overlay) return;
  const style = subtitleState.subtitleStyle || {};
  const x = clampNumber(style.positionX, 0, 100, 50);
  const y = clampNumber(style.positionY, 0, 100, 78);
  const width = clampNumber(style.width, 160, 1400, 720);
  const backgroundOpacity = clampNumber(style.backgroundOpacity, 0, 1, 0.3);
  const backgroundColor = getOverlayBackgroundColor(style);
  const scale = getOverlayScale(overlay);
  const displayWidth = scalePx(width, scale, 80);
  const fontSize = scalePx(clampNumber(style.fontSize, 10, 64, 30), scale, 8);
  const outlineWidth = scalePx(clampNumber(style.outlineWidth, 0, 16, 3), scale);
  applyWebFontCss(style.webFontCss || "");

  overlay.style.left = `${x}%`;
  overlay.style.top = `${y}%`;
  overlay.style.bottom = "auto";
  overlay.style.transform = "translate(-50%, -50%)";
  overlay.style.width = formatPx(displayWidth);
  overlay.style.minHeight = formatPx(scalePx(OVERLAY_MIN_HEIGHT_PX, scale, 20));
  overlay.style.padding = `${formatPx(scalePx(8, scale, 3))} ${formatPx(scalePx(14, scale, 5))}`;
  overlay.style.fontSize = formatPx(fontSize);
  overlay.style.fontFamily = style.fontFamily || "Arial, sans-serif";
  overlay.style.color = style.textColor || "#ffffff";
  overlay.style.textShadow = buildTextShadow(style, scale);
  overlay.style.webkitTextStroke = style.outlineEnabled ?? true
    ? `${formatPx(outlineWidth)} ${style.outlineColor || "#000000"}`
    : "0 transparent";
  overlay.style.paintOrder = "stroke fill";
  overlay.style.background = `rgba(${hexToRgb(backgroundColor)}, ${backgroundOpacity})`;
  fitOverlayHeightToViewport(overlay, y);
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
  let resizeMaxWidth = 1400;
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
    const resizeParentRect = overlay.parentElement?.getBoundingClientRect();
    const scale = getOverlayScale(overlay);
    const minWidth = scalePx(160, scale, 56);
    if (!resizeParentRect?.width) {
      return scalePx(1400, scale, 490);
    }
    return Math.max(minWidth, Math.min(scalePx(1400, scale, 490), Math.floor(resizeParentRect.width * 0.96)));
  };

  const applyResizeWidth = (width) => {
    const scale = getOverlayScale(overlay);
    const minWidth = scalePx(160, scale, 56);
    resizeCurrentWidth = clampNumber(width, minWidth, resizeMaxWidth, resizeStartWidth || scalePx(720, scale, 252));
    overlay.style.width = formatPx(resizeCurrentWidth);
    if (resizeParentRect?.width) {
      const centerX = resizeStartLeft - resizeParentRect.left + resizeCurrentWidth / 2;
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
    const actualWidth = resizeMoved ? resizeCurrentWidth : measuredWidth;
    const nextWidth = clampNumber(Math.round(actualWidth / scale), 160, 1400, 720);
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
      resizeParentRect = overlay.parentElement?.getBoundingClientRect();
      resizing = true;
      resizeMoved = false;
      resizeStartX = event.clientX;
      resizeStartLeft = resizeRect.left;
      resizeStartWidth = Math.round(resizeRect.width);
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
    parentRect = overlay.parentElement?.getBoundingClientRect();
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
      applyResizeWidth(resizeStartWidth + event.clientX - resizeStartX);
      consumeOverlayEvent(event);
      return;
    }

    if (!dragging || event.pointerId !== activePointerId || !parentRect?.width || !parentRect?.height) return;
    const centerX = event.clientX - parentRect.left - dragOffsetX;
    const centerY = event.clientY - parentRect.top - dragOffsetY;
    const positionX = clampNumber((centerX / parentRect.width) * 100, 0, 100, 50);
    const positionY = clampNumber((centerY / parentRect.height) * 100, 0, 100, 86);
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

  const computedPosition = getComputedStyle(parent).position;
  if (computedPosition === "static") {
    parent.style.position = "relative";
  }

  let overlay = parent.querySelector(`#${OVERLAY_ID}`);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "ast-subtitle-overlay";
    parent.append(overlay);
  }
  applyOverlayStyle(overlay);
  installOverlayDrag(overlay);
  return overlay;
}

function setButtonState(enabled, loading = false) {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;

  button.classList.toggle("active", enabled);
  button.classList.toggle("loading", loading);
  button.classList.toggle("temporary", subtitleState.translationPhase === "temporary");
  button.classList.toggle("current", subtitleState.translationPhase === "current");
  button.classList.toggle("complete", subtitleState.translationPhase === "complete");
  button.classList.toggle("fallback", subtitleState.translationPhase === "fallback");
  button.setAttribute("aria-pressed", String(enabled));
  button.title = loading ? contentText("contentTranslationPreparing") : contentText("contentMenuTitle");
  refreshOpenProviderMenu();
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
  overlay.hidden = false;
}

function findToastHost(video = subtitleState.currentVideo) {
  const targetVideo = resolveRenderVideo(video);
  const platform = subtitleState.currentPlatform || detectPlatform();
  if (!platform || !targetVideo) return null;

  return findOverlayHost(platform, targetVideo);
}

function showToast(message, video = subtitleState.currentVideo) {
  if (!document.body) return;
  let toast = document.getElementById(TOAST_ID);
  const toastHost = findToastHost(video);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "ast-toast";
  }
  toast.classList.toggle("ast-toast-video", Boolean(toastHost));
  if (toastHost) {
    const computedPosition = getComputedStyle(toastHost).position;
    if (computedPosition === "static") {
      toastHost.style.position = "relative";
    }
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

function showQuotaFallbackToast(detail = {}) {
  if (detail.fallbackReason !== "quota_exceeded") return;
  const key = `${subtitleState.currentVideoId}:${detail.fallbackProviderId || "googleTranslate"}:${detail.fallbackReason}`;
  if (subtitleState.lastQuotaToastKey === key) return;
  subtitleState.lastQuotaToastKey = key;
  showToast(contentText("contentQuotaFallback"), subtitleState.currentVideo);
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

  const cueIdsByText = getUdemyTranscriptCueIdsByText(subtitleState.currentDocument);
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

    const translation = subtitleState.udemyTranscriptTranslations.get(cueId);
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
  targetVideo.astSubtitleCues = targetVideo.astSubtitleCues.map((cue) => translatedById.get(cue.id) || cue);
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

function refreshCurrentCueTranslationPhase(video = subtitleState.currentVideo) {
  if (!["temporary", "current"].includes(subtitleState.translationPhase)) return;
  if (hasCompleteFinalTranslation()) {
    setTranslationPhase("complete");
    return;
  }
  setTranslationPhase(hasCurrentFinalTranslation(video) ? "current" : "temporary");
}

function isLastTranslationProgress(progress = {}) {
  if (typeof progress.isComplete === "boolean") return progress.isComplete;
  const chunkIndex = Number(progress.chunkIndex);
  const chunkCount = Number(progress.chunkCount);
  const completedChunkCount = Number(progress.completedChunkCount);
  if (Number.isFinite(completedChunkCount) && Number.isFinite(chunkCount) && chunkCount > 0) {
    return completedChunkCount >= chunkCount;
  }
  if (!Number.isFinite(chunkIndex) || !Number.isFinite(chunkCount) || chunkCount <= 1) {
    return true;
  }
  return chunkIndex >= chunkCount - 1;
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

function requestTemporaryTranslationAtCurrentCue(video = subtitleState.currentVideo) {
  if (!subtitleState.enabled || ["complete", "fallback"].includes(subtitleState.translationPhase)) return false;
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
    showQuotaFallbackToast(translatedDocument);
    setTranslationPhase("temporary");
    applyTranslatedCues(targetVideo, translatedDocument.cues, { preserveFinalCues: true });
    refreshCurrentCueTranslationPhase(targetVideo);
  });

  return true;
}

function createButton(platform) {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.title = contentText("contentMenuTitle");
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
  button.innerHTML = CAPTION_SVG;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    toggleProviderMenu(platform);
  });
  return button;
}

function ensureButton(platform, options = {}) {
  const target = findToolbarTarget(platform, options);
  if (!target) return false;

  const existing = target.querySelector(`#${BUTTON_ID}`);
  if (existing) return true;
  const existingAnywhere = document.getElementById(BUTTON_ID);
  if (existingAnywhere) {
    target.append(existingAnywhere);
    const floatingToolbar = document.getElementById(FLOATING_TOOLBAR_ID);
    if (floatingToolbar && floatingToolbar !== target && floatingToolbar.children.length === 0) {
      floatingToolbar.remove();
    }
    return true;
  }

  const button = createButton(platform);
  target.append(button);
  return true;
}

function shouldAllowFloatingToolbar(platform) {
  if (platform === "udemy") return false;
  if (!isVimeoPlatform(platform)) return true;
  return location.hostname === "player.vimeo.com" || Boolean(document.querySelector("video"));
}

function watch(platform) {
  const allowFloatingToolbar = shouldAllowFloatingToolbar(platform);
  const installed = ensureButton(platform, { allowFloatingToolbar });
  if (platform !== "udemy" && !isVimeoPlatform(platform) && installed) return;

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

function renderCurrentOverlayCue(video) {
  const targetVideo = resolveRenderVideo(video);
  if (!targetVideo) return;
  const overlay = ensureOverlay(targetVideo);
  if (!overlay) return;
  if (overlay.dataset.status) return;
  const activeCue = findActiveCue(targetVideo.astSubtitleCues, targetVideo.currentTime);
  overlay.textContent = activeCue?.text || "";
  overlay.hidden = !subtitleState.enabled || overlay.dataset.disabled === "true" || !activeCue;
  refreshCurrentCueTranslationPhase(targetVideo);
}

function renderOverlay(video, cues) {
  const targetVideo = resolveRenderVideo(video);
  if (!targetVideo) return;
  targetVideo.astSubtitleCues = cues;
  if (!ensureOverlay(targetVideo)) return;

  if (targetVideo.astSubtitleRendererInstalled) {
    renderCurrentOverlayCue(targetVideo);
    return;
  }

  targetVideo.astSubtitleRendererInstalled = true;
  targetVideo.addEventListener("timeupdate", () => renderCurrentOverlayCue(targetVideo));
  targetVideo.addEventListener("seeked", () => {
    renderCurrentOverlayCue(targetVideo);
    requestTemporaryTranslationAtCurrentCue(targetVideo);
  });
  targetVideo.addEventListener("play", () => renderCurrentOverlayCue(targetVideo));
  targetVideo.addEventListener("pause", () => renderCurrentOverlayCue(targetVideo));
  renderCurrentOverlayCue(targetVideo);
}

async function translateDocument(document, {
  providerId,
  mode = "final",
  forceNoCache = false,
  initialStartTime,
  requestId
} = {}) {
  const response = await sendRuntimeMessage({
    type: "translation.translateDocument",
    document,
    providerId,
    mode,
    forceNoCache,
    initialStartTime,
    requestId
  });

  if (!response?.ok) {
    if (isExtensionContextInvalidated(response?.error)) {
      disposeContentScript();
      return null;
    }
    console.warn(`[AST] Failed to translate subtitles (${mode}):`, response?.error || "Unknown error");
    return null;
  }

  return response.document;
}

function resolveDefaultTranslationProviderId(settings = {}) {
  return settings.fallback?.providerId === "deepl" && settings.providerTestStatus?.deepl === "success"
    ? "deepl"
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
    subtitleState.translationStyle = settings.translationStyle || "custom";
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
    showQuotaFallbackToast(translatedDocument);
    setTranslationPhase("temporary");
    applyTranslatedCues(targetVideo, translatedDocument.cues, { preserveFinalCues: true });
    refreshCurrentCueTranslationPhase(targetVideo);
  });
}

function startFinalTranslation(document, platform, sessionKey, video, providerId) {
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
    initialStartTime: normalizeInitialStartTime(resolveRenderVideo(video)?.currentTime),
    requestId
  }).then((translatedDocument) => {
    if (requestId !== subtitleState.activeFinalRequestId) return;
    if (!subtitleState.enabled || !isCurrentSession(platform, sessionKey) || !translatedDocument?.cues?.length) return;
    showQuotaFallbackToast(translatedDocument);
    trackFinalTranslatedCues(translatedDocument.cues);
    applyTranslatedCues(video, translatedDocument.cues);
    setTranslationPhase(translatedDocument.fallbackProviderId ? "fallback" : "complete");
  }).catch((error) => {
    if (requestId === subtitleState.activeFinalRequestId) {
      console.warn(`[AST] ${providerId} translation failed:`, error.message);
    }
  }).finally(() => {
    if (requestId !== subtitleState.activeFinalRequestId) return;
    subtitleState.pendingProviderId = "";
    refreshOpenProviderMenu();
  });
}

function startProviderTranslation(document, platform, sessionKey, video, providerId, defaultProviderId) {
  if (!document?.cues?.length) return;
  invalidateTranslationRequests();
  subtitleState.activeProviderId = providerId;
  subtitleState.defaultProviderId = defaultProviderId || "googleTranslate";
  subtitleState.expectedCueIds = new Set(document.cues.map((cue) => String(cue.id)));
  subtitleState.finalTranslatedCueIds = new Set();
  subtitleState.lastTemporaryPriorityKey = "";
  if (platform === "udemy") {
    resetUdemyTranscriptTranslations();
    ensureUdemyTranscriptObserver();
  }
  const targetVideo = resolveRenderVideo(video);
  setTranslationPhase("source");
  renderOverlay(targetVideo, document.cues);

  if (!isMachineTranslationProvider(providerId) && providerId !== subtitleState.defaultProviderId) {
    startDefaultCueTranslation(document, platform, sessionKey, targetVideo, subtitleState.defaultProviderId);
  }
  startFinalTranslation(document, platform, sessionKey, targetVideo, providerId);
  refreshOpenProviderMenu();
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

async function selectTranslationStyle(platform, styleId) {
  if (!Object.hasOwn(TRANSLATION_STYLE_MESSAGE_KEYS, styleId) || subtitleState.loading) return;

  const response = await sendRuntimeMessage({
    type: "settings.setTranslationStyle",
    translationStyle: styleId
  });
  if (!response?.ok) {
    showToast(contentText("contentProviderFailed", [response?.error || "Unknown error"]));
    return;
  }

  subtitleState.translationStyle = response.result?.translationStyle || styleId;
  subtitleState.translationStyleMenuExpanded = false;
  const handler = platformHandlers[platform];
  const reusableDocument = subtitleState.currentDocument
    && subtitleState.currentPlatform === platform
    && subtitleState.currentSessionKey === handler?.getSessionKey();
  renderProviderMenu(platform);

  if (subtitleState.enabled && reusableDocument) {
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
    async listCaptionTracks() {
      const videoId = getYoutubeVideoId();
      if (!videoId) return [];
      let tracks = getYoutubeCaptionTracksFromPage(videoId);
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
    buildTranscriptRequest() {
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

      const selectedTrack = getSelectedSourceCaptionTrack(this.platform, videoId);
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
          ...getYoutubeTranscriptPanelDataFromPage()
        }
      };
    },
    async recoverTranscriptDocument(response, request) {
      const androidRetry = buildYoutubeAndroidTranscriptRetry(response, request.message);
      if (androidRetry) {
        try {
          return await fetchYoutubeAndroidTranscriptDocumentOnPage(androidRetry);
        } catch (error) {
          console.warn("[AST] YouTube page Android fallback failed:", error.message);
        }
      }

      const retry = buildYoutubePageTranscriptRetry(response, request.message);
      if (!retry) return null;
      return fetchYoutubeTranscriptPanelDocumentOnPage(retry);
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
      const track = getSelectedSourceCaptionTrack(this.platform, videoId)
        || setSourceCaptionTracks(this.platform, videoId, await this.listCaptionTracks());

      if (!videoId || !video || !track) {
        console.warn("[AST] Missing NVIDIA Academy Vimeo caption data:", {
          videoId: videoId || null,
          hasVideo: Boolean(video),
          hasTrack: Boolean(track),
          url: location.href
        });
        if (video) showOverlayMessage(video, contentText("contentMissingNvidia"), "error");
        return null;
      }

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
      const track = getSelectedSourceCaptionTrack(this.platform, videoId)
        || setSourceCaptionTracks(this.platform, videoId, await this.listCaptionTracks());

      if (!videoId || !video || !track) {
        console.warn("[AST] Missing Vimeo caption data:", {
          videoId: videoId || null,
          hasVideo: Boolean(video),
          hasTrack: Boolean(track),
          url: location.href
        });
        if (video) showOverlayMessage(video, contentText("contentMissingVimeo"), "error");
        return null;
      }

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

  const pendingRequest = handler.buildTranscriptRequest(options);
  const request = pendingRequest?.then ? await pendingRequest : pendingRequest;
  if (!request) return false;

  let response = await sendRuntimeMessage(request.message);
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
  if (!response?.ok) {
    console.warn(`[AST] Failed to load ${handler.platform} subtitles:`, response?.error || "Unknown error");
    showOverlayMessage(request.video, contentText("contentCaptionsLoadFailed", [response?.error || "Unknown error"]), "error");
    return false;
  }

  subtitleState.currentSessionKey = request.sessionKey;
  subtitleState.currentPlatform = handler.platform;
  subtitleState.currentVideoId = response.document.videoId;
  subtitleState.currentVideo = request.video;
  subtitleState.currentDocument = response.document;
  subtitleState.activeProviderId = "";
  subtitleState.defaultProviderId = "";
  subtitleState.expectedCueIds = new Set(response.document.cues.map((cue) => String(cue.id)));
  subtitleState.finalTranslatedCueIds = new Set();
  subtitleState.lastTemporaryPriorityKey = "";
  subtitleState.lastQuotaToastKey = "";
  handler.markLoaded?.(request.sessionKey, response.document);

  clearOverlayStatus(request.video);
  setTranslationPhase("source");
  renderOverlay(request.video, response.document.cues);

  getTranslationProviderIds()
    .then(({ activeProviderId, defaultProviderId, temporaryPriorityWindowSeconds, availableProviders }) => {
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

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "settings.changed") {
    const settings = message.settings || {};
    subtitleState.subtitleStyle = settings.subtitleStyle || subtitleState.subtitleStyle;
    subtitleState.translationStyle = settings.translationStyle || subtitleState.translationStyle;
    subtitleState.availableProviders = getAvailableProviders(settings);
    if (subtitleState.availableProviders.some((provider) => provider.id === settings.activeProvider)) {
      subtitleState.activeProviderId = settings.activeProvider;
    }
    subtitleState.defaultProviderId = resolveDefaultTranslationProviderId(settings);
    subtitleState.temporaryPriorityWindowSeconds = resolveTemporaryPriorityWindowSeconds(settings);
    applyOverlayStyle(findOverlay(subtitleState.currentVideo));
    refreshOpenProviderMenu();
    return false;
  }
  if (message?.type !== "translation.progress") return false;
  if (!subtitleState.enabled || message.videoId !== subtitleState.currentVideoId) return false;

  if (message.mode === "temporary") {
    if (message.requestId && message.requestId !== subtitleState.activeTemporaryRequestId) return false;
    if (["complete", "fallback"].includes(subtitleState.translationPhase) || !hasUnfinalizedCue(message.progress?.cues)) return false;
    showQuotaFallbackToast(message.progress);
    setTranslationPhase("temporary");
    applyTranslatedCues(subtitleState.currentVideo, message.progress?.cues, { preserveFinalCues: true });
    refreshCurrentCueTranslationPhase(subtitleState.currentVideo);
    return false;
  }
  if (message.mode === "final") {
    if (message.requestId && message.requestId !== subtitleState.activeFinalRequestId) return false;
    trackFinalTranslatedCues(message.progress?.cues);
    const isFallback = Boolean(message.progress?.fallbackProviderId);
    showQuotaFallbackToast(message.progress);
    applyTranslatedCues(subtitleState.currentVideo, message.progress?.cues);
    if (isFallback) {
      setTranslationPhase("fallback");
    } else if (hasCompleteFinalTranslation() || isLastTranslationProgress(message.progress)) {
      setTranslationPhase("complete");
    } else {
      refreshCurrentCueTranslationPhase(subtitleState.currentVideo);
    }
    return false;
  }
  applyTranslatedCues(subtitleState.currentVideo, message.progress?.cues);
  return false;
});

async function togglePlatformSubtitles(handler) {
  if (subtitleState.disposed || subtitleState.loading) return;

  subtitleState.enabled = !subtitleState.enabled;
  if (!subtitleState.enabled) {
    invalidateTranslationRequests();
    setTranslationPhase("off");
  }
  setButtonState(subtitleState.enabled, false);

  if (!subtitleState.enabled) {
    setOverlayVisible(subtitleState.currentVideo, false);
    removeUdemyTranscriptTranslationElements();
    return;
  }

  setOverlayVisible(subtitleState.currentVideo, true);

  const sessionKey = handler.getSessionKey();
  if (sessionKey && subtitleState.currentPlatform === handler.platform && subtitleState.currentSessionKey === sessionKey && subtitleState.currentVideo?.astSubtitleCues) {
    renderOverlay(subtitleState.currentVideo, subtitleState.currentVideo.astSubtitleCues);
    renderUdemyTranscriptTranslations();
    return;
  }

  subtitleState.loading = true;
  setButtonState(true, true);
  showOverlayMessage(handler.findVideo(), handler.loadingMessage);
  try {
    const loaded = await loadPlatformSubtitleOverlay(handler);
    if (!loaded) {
      subtitleState.enabled = false;
      setOverlayVisible(subtitleState.currentVideo, false);
    }
  } finally {
    subtitleState.loading = false;
    setButtonState(subtitleState.enabled, false);
  }
}

function toggleSubtitles(platform) {
  const handler = platformHandlers[platform];
  return handler ? togglePlatformSubtitles(handler) : Promise.resolve();
}

function watchPlatformChanges(handler) {
  const tryRefresh = () => {
    if (subtitleState.disposed || !subtitleState.enabled || subtitleState.loading) return;
    const sessionKey = handler.getSessionKey();
    if (!sessionKey || (subtitleState.currentPlatform === handler.platform && sessionKey === subtitleState.currentSessionKey)) return;

    subtitleState.loading = true;
    setButtonState(true, true);
    loadPlatformSubtitleOverlay(handler, { quietMissingPageData: true })
      .finally(() => {
        subtitleState.loading = false;
        setButtonState(subtitleState.enabled, false);
      });
  };

  const observer = new MutationObserver(() => {
    if (subtitleState.disposed) {
      observer.disconnect();
      return;
    }
    tryRefresh();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(() => {
    if (!subtitleState.disposed) tryRefresh();
  }, 1500);
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
  if (!menu || menu.hidden || button?.contains?.(event.target) || menu.contains?.(event.target)) return;
  closeProviderMenu();
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

  Promise.all([isPlatformEnabled(platform), loadSubtitleStyle()]).then(([enabled]) => {
    if (!enabled) return;
    const handler = platformHandlers[platform];
    if (!handler) return;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        watch(platform);
        watchPlatformChanges(handler);
      }, { once: true });
    } else {
      watch(platform);
      watchPlatformChanges(handler);
    }
  }).catch((error) => {
    if (isExtensionContextInvalidated(error)) {
      disposeContentScript();
      return;
    }
    console.warn("[AST] Failed to initialize content script:", error.message);
  });
}

void initializeContentScript();
