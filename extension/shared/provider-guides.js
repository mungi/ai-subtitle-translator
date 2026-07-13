import { getMessage } from "./i18n.js";

const commonLinks = {
  deeplApiKeys: {
    label: "Get API Key",
    url: "https://www.deepl.com/your-account/keys"
  },
  deeplDocs: {
    label: "DeepL API docs",
    url: "https://developers.deepl.com/docs/getting-started/quickstart"
  },
  deeplLimits: {
    label: "DeepL usage limits",
    url: "https://developers.deepl.com/docs/resources/usage-limits"
  },
  deeplPricing: {
    label: "DeepL API pricing",
    url: "https://www.deepl.com/pro-api"
  },
  openaiApiKeys: {
    label: "Get API Key",
    url: "https://platform.openai.com/api-keys"
  },
  openaiDocs: {
    label: "OpenAI API docs",
    url: "https://developers.openai.com/api/docs"
  },
  openaiLimits: {
    label: "OpenAI rate limits",
    url: "https://developers.openai.com/api/docs/guides/rate-limits"
  },
  openaiPricing: {
    label: "OpenAI pricing",
    url: "https://developers.openai.com/api/docs/pricing"
  },
  anthropicApiKeys: {
    label: "Get API Key",
    url: "https://platform.claude.com/settings/keys"
  },
  anthropicDocs: {
    label: "Anthropic API docs",
    url: "https://platform.claude.com/docs/en/get-started"
  },
  anthropicLimits: {
    label: "Anthropic rate limits",
    url: "https://platform.claude.com/docs/en/api/rate-limits"
  },
  anthropicPricing: {
    label: "Anthropic pricing",
    url: "https://platform.claude.com/docs/en/about-claude/pricing"
  },
  geminiDocs: {
    label: "Gemini API docs",
    url: "https://ai.google.dev/gemini-api/docs"
  },
  googleAiApiKeys: {
    label: "Get API Key",
    url: "https://aistudio.google.com/api-keys"
  },
  geminiLimits: {
    label: "Gemini rate limits",
    url: "https://ai.google.dev/gemini-api/docs/rate-limits"
  },
  geminiPricing: {
    label: "Gemini pricing",
    url: "https://ai.google.dev/gemini-api/docs/pricing"
  },
  openrouterApiKeys: {
    label: "Get API Key",
    url: "https://openrouter.ai/settings/keys"
  },
  openrouterPricing: {
    label: "OpenRouter pricing",
    url: "https://openrouter.ai/pricing"
  },
  openrouterLimits: {
    label: "OpenRouter limits",
    url: "https://openrouter.ai/docs/api/reference/limits"
  },
  openrouterFreeModels: {
    label: "OpenRouter free models",
    url: "https://openrouter.ai/models?fmt=cards&max_price=0"
  },
  nvidiaApiKeys: {
    label: "Get API Key",
    url: "https://build.nvidia.com/settings/api-keys"
  },
  nvidiaCatalog: {
    label: "NVIDIA API Catalog",
    url: "https://build.nvidia.com/explore/discover"
  },
  nvidiaNimFaq: {
    label: "NVIDIA NIM FAQ",
    url: "https://forums.developer.nvidia.com/t/nvidia-nim-faq/300317"
  },
  nvidiaLlmApiDocs: {
    label: "NVIDIA NIM LLM API docs",
    url: "https://docs.api.nvidia.com/nim/reference/llm-apis"
  }
};

export const PROVIDER_GUIDES = {
  googleTranslate: { messageKey: "providerGuideGoogleTranslate", links: [] },
  deepl: {
    messageKey: "providerGuideDeepl",
    links: [commonLinks.deeplApiKeys, commonLinks.deeplDocs, commonLinks.deeplLimits, commonLinks.deeplPricing]
  },
  openai: {
    messageKey: "providerGuideOpenai",
    links: [commonLinks.openaiApiKeys, commonLinks.openaiDocs, commonLinks.openaiLimits, commonLinks.openaiPricing]
  },
  anthropic: {
    messageKey: "providerGuideAnthropic",
    links: [commonLinks.anthropicApiKeys, commonLinks.anthropicDocs, commonLinks.anthropicLimits, commonLinks.anthropicPricing]
  },
  google: {
    messageKey: "providerGuideGoogle",
    links: [commonLinks.googleAiApiKeys, commonLinks.geminiDocs, commonLinks.geminiLimits, commonLinks.geminiPricing]
  },
  openrouter: {
    messageKey: "providerGuideOpenrouter",
    links: [commonLinks.openrouterApiKeys, commonLinks.openrouterPricing, commonLinks.openrouterLimits, commonLinks.openrouterFreeModels]
  },
  nvidiaNim: {
    messageKey: "providerGuideNvidiaNim",
    links: [commonLinks.nvidiaApiKeys, commonLinks.nvidiaCatalog, commonLinks.nvidiaNimFaq, commonLinks.nvidiaLlmApiDocs]
  },
  local: { messageKey: "providerGuideLocal", links: [] }
};

export function getProviderGuide(providerId) {
  const guide = PROVIDER_GUIDES[providerId];
  return {
    text: guide ? getMessage(guide.messageKey) : "",
    links: guide?.links || []
  };
}
