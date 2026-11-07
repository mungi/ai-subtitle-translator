const HOSTED_PROVIDER_ORIGINS = Object.freeze({
  googleTranslate: {
    label: "Google Translate",
    origins: ["https://translate.googleapis.com"]
  },
  deepl: {
    label: "DeepL",
    origins: ["https://api-free.deepl.com", "https://api.deepl.com"]
  },
  openai: {
    label: "OpenAI",
    origins: ["https://api.openai.com"]
  },
  anthropic: {
    label: "Anthropic",
    origins: ["https://api.anthropic.com"]
  },
  google: {
    label: "Google AI",
    origins: ["https://generativelanguage.googleapis.com"]
  },
  openrouter: {
    label: "OpenRouter",
    origins: ["https://openrouter.ai"]
  },
  nvidiaNim: {
    label: "NVIDIA NIM",
    origins: ["https://integrate.api.nvidia.com"]
  }
});
const LOOPBACK_LLM_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// RFC 1918 private IPv4 ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
function isRfc1918Hostname(hostname) {
  const match = IPV4_PATTERN.exec(hostname);
  if (!match) {
    return false;
  }
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) {
    return false;
  }
  const [first, second] = octets;
  return first === 10
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

// mDNS-style local network names such as my-mac.local.
function isLocalNetworkName(hostname) {
  return hostname.length > ".local".length && hostname.endsWith(".local");
}

// Hosts that stay on this machine or the user's local network, where plain HTTP is allowed.
export function isLocalNetworkHostname(hostname) {
  const host = String(hostname || "").toLowerCase();
  return LOOPBACK_LLM_HOSTNAMES.has(host) || isRfc1918Hostname(host) || isLocalNetworkName(host);
}

function parseProviderUrl(provider) {
  let url;
  try {
    url = new URL(String(provider?.baseUrl || ""));
  } catch {
    throw new Error(`${provider?.label || provider?.id || "Provider"} Base URL is invalid.`);
  }

  if (url.username || url.password || url.hash) {
    throw new Error(`${provider?.label || provider?.id || "Provider"} Base URL must not contain credentials or a fragment.`);
  }
  return url;
}

export function assertProviderEndpoint(provider) {
  const url = parseProviderUrl(provider);
  if (provider?.id === "local") {
    if (isLocalNetworkHostname(url.hostname)) {
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Custom LLM Base URL must use HTTP or HTTPS.");
      }
      return url;
    }
    if (url.protocol !== "https:") {
      throw new Error("Custom LLM Base URL must use HTTPS unless it uses localhost, 127.0.0.1, a private network address (RFC 1918), or a .local name.");
    }
    return url;
  }

  const rule = HOSTED_PROVIDER_ORIGINS[provider?.id];
  if (!rule) {
    throw new Error(`Unsupported provider endpoint: ${provider?.id || "unknown"}.`);
  }
  if (!rule.origins.includes(url.origin)) {
    throw new Error(`${rule.label} Base URL must use ${rule.origins.join(" or ")}.`);
  }
  return url;
}

export const providerSecurityInternals = {
  HOSTED_PROVIDER_ORIGINS,
  LOOPBACK_LLM_HOSTNAMES,
  parseProviderUrl
};
