// Generic HTML5 video player support (technical preview).
// Loaded only into frames the worker attaches for the generic player, before content-script.js;
// the two share one isolated-world global scope. Caption sources, in order:
//   A. <track src> files       B. the player's text tracks (in-band / addTextTrack)
//   C. caption files the page already loaded (resource timing)
//   D. HLS master playlists with SUBTITLES renditions (resolved by the worker)
// Nothing is shown on a video until a caption source is found, so pages without captions stay untouched.

const GENERIC_TOOLBAR_ID = "ast-generic-toolbar";
const GENERIC_MIN_WIDTH = 240;
const GENERIC_MIN_HEIGHT = 135;
const GENERIC_MIN_DURATION_SECONDS = 30;
const GENERIC_SHADOW_SCAN_LIMIT = 4000;
const GENERIC_REFRESH_MS = 1500;
const GENERIC_RECHECK_MS = 8000;
const GENERIC_MAX_EMPTY_CHECKS = 6;
const GENERIC_TEXT_TRACK_WAIT_MS = 3000;
const GENERIC_SAME_ORIGIN_MAX_CHARS = 5 * 1024 * 1024;
const GENERIC_CAPTION_FILE_PATTERN = /\.(?:vtt|webvtt|srt|ttml|dfxp)(?:[?#]|$)/i;
const GENERIC_CAPTION_FILE_SKIP_PATTERN = /thumb|sprite|storyboard|chapter|segment|preview|metadata/i;
const GENERIC_HLS_PATTERN = /\.m3u8(?:[?#]|$)/i;
const GENERIC_HLS_SKIP_PATTERN = /subtitle|caption|\/(?:audio|video)\/|\bvideo_?\d{3,4}p?\b/i;

const genericPlayerState = {
  lastPlayed: null,
  tracksBySession: new Map(),
  emptyChecks: new Map(),
  lastCheckAt: new Map(),
  checking: new Set(),
  trackMeta: new Map(),
  hoverTimer: null,
  watching: false,
  siteInactive: false
};

// ---- videos

function collectGenericVideos(root = document, found = [], budget = { left: GENERIC_SHADOW_SCAN_LIMIT }) {
  for (const video of root.querySelectorAll?.("video") || []) found.push(video);
  for (const element of root.querySelectorAll?.("*") || []) {
    if (--budget.left <= 0) break;
    if (element.shadowRoot) collectGenericVideos(element.shadowRoot, found, budget);
  }
  return found;
}

function hasGenericCaptionHints(video) {
  if (video.querySelector?.("track[src]")) return true;
  const tracks = video.textTracks;
  for (let index = 0; index < (tracks?.length || 0); index += 1) {
    if (["subtitles", "captions"].includes(tracks[index].kind)) return true;
  }
  return false;
}

function isGenericCandidateVideo(video) {
  if (!video || video.tagName !== "VIDEO" || !video.isConnected) return false;
  const rect = video.getBoundingClientRect();
  if (rect.width < GENERIC_MIN_WIDTH || rect.height < GENERIC_MIN_HEIGHT) return false;
  if (hasGenericCaptionHints(video)) return true;
  if (video.loop && video.muted && !video.controls) return false;
  return Number.isFinite(video.duration) && video.duration >= GENERIC_MIN_DURATION_SECONDS;
}

// The video the viewer played last, else the largest candidate.
function pickGenericVideo() {
  const last = genericPlayerState.lastPlayed;
  if (last && isGenericCandidateVideo(last)) return last;
  const candidates = collectGenericVideos().filter(isGenericCandidateVideo);
  candidates.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return rb.width * rb.height - ra.width * ra.height;
  });
  return candidates[0] || null;
}

function hashGenericText(value) {
  let hash = 5381;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function absolutizeGenericUrl(value) {
  try {
    const url = new URL(String(value || ""), document.baseURI);
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function getGenericTrackElements(video) {
  return [...(video.querySelectorAll?.("track[src]") || [])]
    .filter((track) => ["subtitles", "captions", ""].includes(track.getAttribute("kind") || ""));
}

function getGenericVideoIdentity(video) {
  const trackUrl = getGenericTrackElements(video).map((track) => absolutizeGenericUrl(track.getAttribute("src"))).find(Boolean);
  if (trackUrl) return trackUrl;
  const source = absolutizeGenericUrl(video.currentSrc) || absolutizeGenericUrl(video.querySelector?.("source[src]")?.getAttribute("src"));
  if (source) return source.replace(/[?#].*$/, "");
  return `d${Math.round(Number(video.duration) || 0)}`;
}

function getGenericSessionKeyForVideo(video) {
  if (!video) return "";
  return `generic:${hashGenericText(location.origin + location.pathname)}:${hashGenericText(getGenericVideoIdentity(video))}`;
}

// Only a video with a found caption source counts, so AST never starts (or shows a loading line)
// on a video it cannot translate.
function findGenericVideo() {
  if (genericPlayerState.siteInactive) return null;
  const video = pickGenericVideo();
  if (!video) return null;
  const tracks = genericPlayerState.tracksBySession.get(getGenericSessionKeyForVideo(video));
  return tracks?.length ? video : null;
}

function getGenericCurrentSessionKey() {
  const video = findGenericVideo();
  return video ? getGenericSessionKeyForVideo(video) : null;
}

// ---- caption sources

function guessGenericLanguageFromUrl(url) {
  const match = String(url).match(/[/_.=-](en|ko|ja|zh|es|fr|de|pt|it|ru|ar|hi|id|vi|th|tr|nl|pl)(?:[-_][a-z]{2,4})?(?=[/_.?&#-]|$)/i);
  return match ? match[1].toLowerCase() : "";
}

function getGenericResourceUrls(pattern, skipPattern) {
  let entries = [];
  try {
    entries = performance.getEntriesByType?.("resource") || [];
  } catch {
    entries = [];
  }
  const urls = [];
  for (const entry of entries) {
    const url = absolutizeGenericUrl(entry.name);
    if (!url || !pattern.test(url) || skipPattern.test(url) || urls.includes(url)) continue;
    urls.push(url);
    if (urls.length >= 10) break;
  }
  return urls;
}

function getGenericHlsCandidates(video) {
  const candidates = [
    absolutizeGenericUrl(video.currentSrc),
    ...[...(video.querySelectorAll?.("source[src]") || [])].map((source) => absolutizeGenericUrl(source.getAttribute("src"))),
    ...getGenericResourceUrls(GENERIC_HLS_PATTERN, GENERIC_HLS_SKIP_PATTERN)
  ].filter((url) => url && GENERIC_HLS_PATTERN.test(url));
  return [...new Set(candidates)].slice(0, 5);
}

function rememberGenericTrack(track, meta) {
  genericPlayerState.trackMeta.set(track.id, meta);
  return track;
}

async function listGenericCaptionTracks(video) {
  const tracks = [];
  const trackElements = getGenericTrackElements(video);

  // A. <track src>
  for (const element of trackElements) {
    const trackUrl = absolutizeGenericUrl(element.getAttribute("src"));
    if (!trackUrl) continue;
    const languageCode = element.getAttribute("srclang") || "";
    tracks.push(rememberGenericTrack({
      id: `track:${trackUrl}`,
      languageCode,
      label: element.getAttribute("label") || languageCode || "Subtitles",
      isAutoGenerated: false,
      trackUrl
    }, { source: "url", trackUrl, format: "auto" }));
  }

  // D. HLS subtitle renditions (complete files, preferred over partially loaded in-band cues)
  const hlsCandidates = tracks.length === 0 ? getGenericHlsCandidates(video) : [];
  if (hlsCandidates.length > 0) {
    const response = await sendRuntimeMessage({ type: "captions.generic.listHlsTracks", urls: hlsCandidates }).catch(() => null);
    for (const track of response?.ok ? response.tracks || [] : []) {
      tracks.push(rememberGenericTrack({
        id: `hls:${track.trackUrl}`,
        languageCode: track.languageCode || "",
        label: track.label || track.languageCode || "Subtitles",
        isAutoGenerated: Boolean(track.isAutoGenerated),
        trackUrl: track.trackUrl
      }, { source: "url", trackUrl: track.trackUrl, format: "hls" }));
    }
  }

  // B. the player's own text tracks
  if (tracks.length === 0) {
    const textTracks = video.textTracks;
    for (let index = 0; index < (textTracks?.length || 0); index += 1) {
      const textTrack = textTracks[index];
      if (!["subtitles", "captions"].includes(textTrack.kind)) continue;
      if (trackElements.some((element) => element.track === textTrack)) continue;
      tracks.push(rememberGenericTrack({
        id: `texttrack:${index}:${textTrack.language || ""}:${textTrack.label || ""}`,
        languageCode: textTrack.language || "",
        label: textTrack.label || textTrack.language || "Subtitles",
        isAutoGenerated: false
      }, { source: "texttrack", index }));
    }
  }

  // C. caption files the page already fetched
  if (tracks.length === 0) {
    for (const trackUrl of getGenericResourceUrls(GENERIC_CAPTION_FILE_PATTERN, GENERIC_CAPTION_FILE_SKIP_PATTERN)) {
      const languageCode = guessGenericLanguageFromUrl(trackUrl);
      tracks.push(rememberGenericTrack({
        id: `resource:${trackUrl}`,
        languageCode,
        label: decodeURIComponent(trackUrl.split(/[?#]/)[0].split("/").pop() || "Subtitles"),
        isAutoGenerated: false,
        trackUrl
      }, { source: "url", trackUrl, format: "auto" }));
    }
  }
  return tracks;
}

function waitGeneric(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readGenericTextTrackCues(video, index) {
  const textTrack = video.textTracks?.[index];
  if (!textTrack) return [];
  const previousMode = textTrack.mode;
  // A disabled track never loads its cues; "hidden" loads them without drawing anything.
  if (previousMode === "disabled") textTrack.mode = "hidden";
  try {
    const deadline = Date.now() + GENERIC_TEXT_TRACK_WAIT_MS;
    while (!(textTrack.cues?.length > 0) && Date.now() < deadline) await waitGeneric(200);
    return [...(textTrack.cues || [])]
      .map((cue) => ({ start: cue.startTime, end: cue.endTime, text: String(cue.text || "") }))
      .filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.text.trim());
  } finally {
    if (previousMode === "disabled") textTrack.mode = "disabled";
  }
}

// Same-origin caption files may need the page's cookies, which the worker does not send.
async function fetchGenericSameOriginText(trackUrl) {
  try {
    if (new URL(trackUrl).origin !== location.origin) return null;
    const response = await fetch(trackUrl, { credentials: "same-origin" });
    if (!response.ok) return null;
    const text = await response.text();
    return text && text.length <= GENERIC_SAME_ORIGIN_MAX_CHARS ? text : null;
  } catch {
    return null;
  }
}

async function fetchGenericNativeDocument(request) {
  const meta = request.generic;
  if (!meta) return null;
  if (meta.source === "texttrack") {
    const cues = await readGenericTextTrackCues(request.video, meta.index);
    if (cues.length === 0) {
      const error = new Error("No captions are available for this video.");
      error.code = "CAPTIONS_UNAVAILABLE";
      throw error;
    }
    const response = await sendRuntimeMessage({
      type: "captions.generic.parseTranscript",
      sessionKey: request.sessionKey,
      sourceLanguage: request.message.sourceLanguage,
      cues: cues.slice(0, 20000)
    });
    if (!response?.ok) throw new Error(response?.error || "Could not read the player's captions.");
    return response.document;
  }
  if (meta.format !== "hls") {
    const text = await fetchGenericSameOriginText(meta.trackUrl);
    if (text) {
      const response = await sendRuntimeMessage({
        type: "captions.generic.parseTranscript",
        sessionKey: request.sessionKey,
        sourceLanguage: request.message.sourceLanguage,
        text
      });
      if (response?.ok) return response.document;
    }
  }
  return null;
}

// ---- toolbar over the video

function getGenericToolbarTarget() {
  return genericPlayerState.siteInactive ? null : document.getElementById(GENERIC_TOOLBAR_ID);
}

function showGenericToolbarBriefly(toolbar) {
  toolbar.classList.add("ast-generic-toolbar-visible");
  clearTimeout(genericPlayerState.hoverTimer);
  genericPlayerState.hoverTimer = setTimeout(() => {
    if (!toolbar.matches(":hover, :focus-within") && !document.getElementById(PROVIDER_MENU_ID)?.matches?.(":not([hidden])")) {
      toolbar.classList.remove("ast-generic-toolbar-visible");
    }
  }, 2500);
}

function ensureGenericToolbar(video) {
  const host = video?.parentElement;
  if (!host) return null;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  let toolbar = document.getElementById(GENERIC_TOOLBAR_ID);
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = GENERIC_TOOLBAR_ID;
    toolbar.className = "ast-generic-toolbar";
  }
  if (toolbar.parentElement !== host) host.append(toolbar);
  if (!host.astGenericHoverBound) {
    host.astGenericHoverBound = true;
    host.addEventListener("pointermove", () => showGenericToolbarBriefly(toolbar), { passive: true });
    host.addEventListener("pointerenter", () => showGenericToolbarBriefly(toolbar), { passive: true });
  }
  installGenericToolbarDrag(toolbar);
  applyGenericToolbarPosition(toolbar);
  return toolbar;
}

// ---- dragging the toolbar
// The toolbar can be moved anywhere over the video (it may cover the site's own controls).
// The place is kept as a fraction of the player size, so it holds through resizes and fullscreen,
// for as long as the page stays open.

const GENERIC_DRAG_THRESHOLD_PX = 4;

function clampGeneric(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function applyGenericToolbarPosition(toolbar) {
  const position = genericPlayerState.toolbarPosition;
  const host = toolbar.parentElement;
  if (!position || !host) return;
  const maxLeft = host.clientWidth - toolbar.offsetWidth;
  const maxTop = host.clientHeight - toolbar.offsetHeight;
  toolbar.style.left = `${Math.round(clampGeneric(position.x * host.clientWidth, 0, maxLeft))}px`;
  toolbar.style.top = `${Math.round(clampGeneric(position.y * host.clientHeight, 0, maxTop))}px`;
  toolbar.style.right = "auto";
}

function installGenericToolbarDrag(toolbar) {
  if (toolbar.astGenericDragBound) return;
  toolbar.astGenericDragBound = true;
  let drag = null;

  toolbar.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const host = toolbar.parentElement;
    if (!host) return;
    const toolbarRect = toolbar.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - toolbarRect.left,
      offsetY: event.clientY - toolbarRect.top,
      moved: false
    };
    // Keep the page's player from treating the press as a click on the video.
    event.stopPropagation();
    // A fast drag leaves the bar before its first move, so the press is followed on the window.
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
  });

  function onMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < GENERIC_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      toolbar.classList.add("ast-generic-toolbar-dragging");
    }
    const host = toolbar.parentElement;
    const hostRect = host.getBoundingClientRect();
    const left = clampGeneric(event.clientX - hostRect.left - drag.offsetX, 0, host.clientWidth - toolbar.offsetWidth);
    const top = clampGeneric(event.clientY - hostRect.top - drag.offsetY, 0, host.clientHeight - toolbar.offsetHeight);
    genericPlayerState.toolbarPosition = {
      x: host.clientWidth ? left / host.clientWidth : 0,
      y: host.clientHeight ? top / host.clientHeight : 0
    };
    applyGenericToolbarPosition(toolbar);
    showGenericToolbarBriefly(toolbar);
    if (typeof positionGenericProviderMenu === "function") positionGenericProviderMenu();
    event.preventDefault();
  }

  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", endDrag, true);
    window.removeEventListener("pointercancel", endDrag, true);
    if (drag.moved) {
      toolbar.classList.remove("ast-generic-toolbar-dragging");
      // The button would otherwise read the end of a drag as a click and open the menu.
      toolbar.astSuppressNextClick = true;
      setTimeout(() => { toolbar.astSuppressNextClick = false; }, 0);
    }
    drag = null;
  }

  toolbar.addEventListener("click", (event) => {
    if (!toolbar.astSuppressNextClick) return;
    toolbar.astSuppressNextClick = false;
    event.stopPropagation();
    event.preventDefault();
  }, true);

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => applyGenericToolbarPosition(toolbar)).observe(toolbar);
  }
  window.addEventListener("resize", () => applyGenericToolbarPosition(toolbar), { passive: true });
  document.addEventListener("fullscreenchange", () => applyGenericToolbarPosition(toolbar));
}

function removeGenericToolbar() {
  document.getElementById(GENERIC_TOOLBAR_ID)?.remove();
}

// ---- watching

function scheduleGenericTrackCheck(video, key) {
  const state = genericPlayerState;
  if (state.checking.has(key)) return;
  const known = state.tracksBySession.get(key);
  if (known?.length) return;
  const emptyChecks = state.emptyChecks.get(key) || 0;
  if (known && emptyChecks >= GENERIC_MAX_EMPTY_CHECKS) return;
  if (known && Date.now() - (state.lastCheckAt.get(key) || 0) < GENERIC_RECHECK_MS) return;
  state.checking.add(key);
  state.lastCheckAt.set(key, Date.now());
  listGenericCaptionTracks(video)
    .then((tracks) => {
      state.tracksBySession.set(key, tracks);
      if (tracks.length === 0) state.emptyChecks.set(key, emptyChecks + 1);
    })
    .catch((error) => {
      console.warn("[AST] Could not look for captions on this video:", error?.message || error);
      state.tracksBySession.set(key, []);
      state.emptyChecks.set(key, emptyChecks + 1);
    })
    .finally(() => {
      state.checking.delete(key);
      refreshGenericPlayer();
    });
}

function refreshGenericPlayer() {
  if (subtitleState.disposed) return;
  if (genericPlayerState.siteInactive) {
    removeGenericToolbar();
    return;
  }
  const video = pickGenericVideo();
  if (!video) {
    if (!subtitleState.enabled) removeGenericToolbar();
    return;
  }
  const key = getGenericSessionKeyForVideo(video);
  scheduleGenericTrackCheck(video, key);
  if (genericPlayerState.tracksBySession.get(key)?.length) {
    ensureGenericToolbar(video);
    ensureButton("generic");
  } else if (!subtitleState.enabled) {
    removeGenericToolbar();
  }
}

function watchGenericPlayer() {
  if (genericPlayerState.watching) return;
  genericPlayerState.watching = true;
  const onMedia = (event) => {
    if (event.target?.tagName === "VIDEO") {
      if (event.type === "play") genericPlayerState.lastPlayed = event.target;
      // Tracks are often added once the media loads; let the next check run now.
      genericPlayerState.lastCheckAt.delete(getGenericSessionKeyForVideo(event.target));
      refreshGenericPlayer();
    }
  };
  for (const type of ["play", "loadedmetadata"]) document.addEventListener(type, onMedia, true);
  setInterval(refreshGenericPlayer, GENERIC_REFRESH_MS);
  refreshGenericPlayer();
}

function setGenericSiteInactive(inactive) {
  genericPlayerState.siteInactive = Boolean(inactive);
  if (inactive) removeGenericToolbar();
  else refreshGenericPlayer();
}

function getGenericTrackMeta(trackId) {
  return genericPlayerState.trackMeta.get(trackId) || null;
}
