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
    if (LOOPBACK_LLM_HOSTNAMES.has(url.hostname)) {
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Custom LLM Base URL must use HTTP or HTTPS.");
      }
      return url;
    }
    if (url.protocol !== "https:") {
      throw new Error("Custom LLM Base URL must use HTTPS unless it uses localhost or 127.0.0.1.");
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

export function getCustomLlmPermissionOrigin(provider) {
  const url = assertProviderEndpoint(provider);
  if (provider?.id !== "local" || LOOPBACK_LLM_HOSTNAMES.has(url.hostname)) {
    return null;
  }
  return `${url.protocol}//${url.hostname}/*`;
}

export const providerSecurityInternals = {
  HOSTED_PROVIDER_ORIGINS,
  LOOPBACK_LLM_HOSTNAMES,
  parseProviderUrl
};
