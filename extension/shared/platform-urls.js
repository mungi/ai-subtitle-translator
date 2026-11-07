// One table of the sites AST supports with a dedicated handler. The popup's per-site switch,
// the generic player's exclusions, and the worker's sender checks all decide "which site is this"
// from here, so a new platform is added in one place (tests keep the manifest in step).

function hostIs(url, ...hosts) {
  return hosts.includes(url.hostname);
}

function hostEndsWith(url, domain) {
  return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
}

export const DEDICATED_PLATFORM_SITES = [
  { id: "udemy", label: "Udemy", test: (url) => hostEndsWith(url, "udemy.com") },
  { id: "youtube", label: "YouTube", test: (url) => hostEndsWith(url, "youtube.com") },
  { id: "ted", label: "TED", test: (url) => hostIs(url, "ted.com", "www.ted.com") },
  // NVIDIA has two players on one host, so the path decides.
  { id: "nvidia", label: "NVIDIA Academy", test: (url) => hostIs(url, "www.nvidia.com") && /\/training\/academy\//i.test(url.pathname) },
  { id: "nvidiaOnDemand", label: "NVIDIA On-Demand", test: (url) => hostIs(url, "www.nvidia.com") && /^\/[a-z]{2}-[a-z]{2}\/on-demand\//i.test(url.pathname) },
  { id: "vimeo", label: "Vimeo", test: (url) => hostIs(url, "vimeo.com", "www.vimeo.com", "player.vimeo.com") },
  { id: "coursera", label: "Coursera", test: (url) => hostIs(url, "coursera.org", "www.coursera.org") },
  { id: "linkedin", label: "LinkedIn Learning", test: (url) => hostIs(url, "www.linkedin.com") && url.pathname.startsWith("/learning") },
  { id: "oreilly", label: "O'Reilly", test: (url) => hostEndsWith(url, "oreilly.com") },
  { id: "deeplearningai", label: "DeepLearning.AI", test: (url) => hostIs(url, "learn.deeplearning.ai") },
  { id: "edx", label: "edX", test: (url) => hostEndsWith(url, "edx.org") }
];

export const DEDICATED_PLATFORM_IDS = DEDICATED_PLATFORM_SITES.map((site) => site.id);
export const GENERIC_PLATFORM_ID = "generic";
export const ALL_PLATFORM_IDS = [...DEDICATED_PLATFORM_IDS, GENERIC_PLATFORM_ID];

// The domains of the supported sites. The generic player never runs anywhere on them, not only on
// the player pages (a LinkedIn feed video or an nvidia.com page stays untouched), and the popup
// does not offer to add them.
export const DEDICATED_SITE_DOMAINS = [
  "udemy.com",
  "youtube.com",
  "ted.com",
  "nvidia.com",
  "vimeo.com",
  "coursera.org",
  "linkedin.com",
  "oreilly.com",
  "deeplearning.ai",
  "edx.org"
];

// Frames on these sites never get the generic probe: their own handler (or none) owns the video.
export const GENERIC_EXCLUDE_MATCHES = DEDICATED_SITE_DOMAINS.flatMap((domain) => [`*://${domain}/*`, `*://*.${domain}/*`]);

function parseUrl(value) {
  try {
    return value instanceof URL ? value : new URL(String(value || ""));
  } catch {
    return null;
  }
}

export function detectDedicatedPlatform(value) {
  const url = parseUrl(value);
  if (!url || !/^https?:$/.test(url.protocol)) return null;
  const site = DEDICATED_PLATFORM_SITES.find((item) => item.test(url));
  return site ? { id: site.id, label: site.label } : null;
}

export function getHostname(value) {
  const url = parseUrl(value);
  return url && /^https?:$/.test(url.protocol) ? url.hostname.toLowerCase() : "";
}

// A web page the generic player may run on: http(s) and not a dedicated site.
export function isDedicatedSiteHost(value) {
  const host = value instanceof URL ? value.hostname.toLowerCase() : String(value || "").toLowerCase();
  return DEDICATED_SITE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function isGenericEligibleUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && /^https?:$/.test(url.protocol) && !isDedicatedSiteHost(url));
}

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

export function normalizeGenericHost(value) {
  if (typeof value !== "string") return "";
  const host = String(value || "").trim().toLowerCase().replace(/\.$/, "");
  return HOSTNAME_PATTERN.test(host) ? host : "";
}

export function normalizeGenericHosts(value) {
  const hosts = Array.isArray(value)
    ? value.map(normalizeGenericHost).filter((host) => host && !isDedicatedSiteHost(host))
    : [];
  return [...new Set(hosts)].slice(0, 500);
}

// The generic player only runs on sites the user added from the popup (exact host names).
export function isHostListed(hosts, value) {
  const host = getHostname(value);
  return Boolean(host) && normalizeGenericHosts(hosts).includes(host);
}

// What the popup shows for a tab URL: the dedicated site's switch, or the generic list button.
export function describeSiteForUrl(value, settings = {}) {
  const host = getHostname(value);
  if (!host) return { kind: "unsupported", host: "" };
  const platform = detectDedicatedPlatform(value);
  if (platform) {
    return { kind: "dedicated", host, platform, active: settings.platforms?.[platform.id] !== false };
  }
  // Other pages of a supported site (a LinkedIn feed, an nvidia.com product page): nothing to switch.
  if (isDedicatedSiteHost(host)) return { kind: "unsupported", host };
  const genericEnabled = settings.platforms?.[GENERIC_PLATFORM_ID] !== false;
  const listed = isHostListed(settings.genericAllowedHosts, value);
  return { kind: "generic", host, genericEnabled, listed, active: genericEnabled && listed };
}

// The probe is registered only for listed sites; players in cross-origin frames of those sites
// get it from the worker when the page asks.
export function buildGenericProbeMatches(allowedHosts = []) {
  return normalizeGenericHosts(allowedHosts).map((host) => `*://${host}/*`);
}
