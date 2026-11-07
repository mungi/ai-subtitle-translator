// Generic video player probe (technical preview). Registered on every web page only while the
// generic player is on. It stays tiny and passive: it only listens for media events and asks the
// worker to load AST into this frame once a real video (not an ad loop or background clip) appears.
(() => {
  if (globalThis.__astGenericProbe) return;
  globalThis.__astGenericProbe = true;

  const MIN_WIDTH = 240;
  const MIN_HEIGHT = 135;
  const MIN_DURATION_SECONDS = 30;
  const SHADOW_SCAN_LIMIT = 4000;
  let requested = false;

  function hasCaptionTracks(video) {
    if (video.querySelector?.("track[src]")) return true;
    const tracks = video.textTracks;
    if (!tracks) return false;
    for (let index = 0; index < tracks.length; index += 1) {
      if (["subtitles", "captions"].includes(tracks[index].kind)) return true;
    }
    return false;
  }

  function isCandidate(video) {
    if (!(video instanceof HTMLVideoElement) || !video.isConnected) return false;
    const rect = video.getBoundingClientRect();
    if (rect.width < MIN_WIDTH || rect.height < MIN_HEIGHT) return false;
    if (hasCaptionTracks(video)) return true;
    // Muted, looping clips without controls are decoration or previews.
    if (video.loop && video.muted && !video.controls) return false;
    return Number.isFinite(video.duration) && video.duration >= MIN_DURATION_SECONDS;
  }

  // Media events do not cross shadow roots, so open shadow roots are searched on the timed checks.
  function collectVideos(root, found = [], budget = { left: SHADOW_SCAN_LIMIT }) {
    for (const video of root.querySelectorAll?.("video") || []) found.push(video);
    for (const element of root.querySelectorAll?.("*") || []) {
      if (--budget.left <= 0) break;
      if (element.shadowRoot) collectVideos(element.shadowRoot, found, budget);
    }
    return found;
  }

  function requestAttach() {
    if (requested) return;
    requested = true;
    try {
      chrome.runtime.sendMessage({ type: "generic.attach" }).then((response) => {
        if (!response?.ok) requested = false;
      }, () => {
        requested = false;
      });
    } catch {
      requested = false;
    }
  }

  function onMediaEvent(event) {
    if (!requested && isCandidate(event.target)) requestAttach();
  }

  function scan({ shadow = false } = {}) {
    if (requested || !document.documentElement) return;
    const videos = shadow ? collectVideos(document) : [...document.getElementsByTagName("video")];
    if (videos.some(isCandidate)) requestAttach();
  }

  // Only listed sites get this script from the registration, and matching uses each frame's own
  // address. The top frame therefore asks the worker to load the probe into the page's other frames
  // (cross-origin players), now and when frames are added later.
  function prepareFrames() {
    try {
      chrome.runtime.sendMessage({ type: "generic.prepareFrames" }).catch(() => {});
    } catch {
      // The extension was reloaded; nothing to do.
    }
  }

  if (window.top === window) {
    let frameCount = document.getElementsByTagName("iframe").length;
    let pending = null;
    let requests = 0;
    if (frameCount > 0) prepareFrames();
    new MutationObserver(() => {
      const count = document.getElementsByTagName("iframe").length;
      if (count <= frameCount || pending || requests >= 20) return;
      frameCount = count;
      pending = setTimeout(() => {
        pending = null;
        requests += 1;
        prepareFrames();
      }, 1000);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  for (const type of ["loadedmetadata", "play", "playing"]) {
    document.addEventListener(type, onMediaEvent, true);
  }
  scan();
  setTimeout(() => scan({ shadow: true }), 3000);
  setTimeout(() => scan({ shadow: true }), 10000);
})();
