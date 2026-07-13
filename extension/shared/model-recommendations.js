const UNSUITABLE_MODEL_PATTERN = /(?:audio|realtime|transcri|speech|tts|image|embedding|moderation|search|computer-use)/i;

const PROVIDER_MODEL_PREFERENCES = {
  google: [
    "gemini-3.1-flash-lite",
    /gemini-3\.1-flash-lite/i,
    /gemini.*flash-lite/i,
    /gemini.*flash/i
  ],
  openai: [
    "gpt-5.6-luna",
    /^gpt-5(?:\.\d+)?-mini(?:-|$)/i,
    /^gpt-5.*mini/i,
    /^gpt-5.*nano/i,
    /^gpt-4\.1-mini(?:-|$)/i,
    /gpt.*mini/i
  ],
  anthropic: [
    "claude-haiku-4-5-20251001",
    /claude.*haiku.*4[-.]?5/i,
    /claude.*haiku/i
  ],
  openrouter: [
    "deepseek/deepseek-v4-flash",
    /^google\/gemini-3\.1-flash-lite(?::|$)/i,
    /^google\/gemini.*flash-lite/i,
    /^anthropic\/claude.*haiku/i,
    /^qwen\/qwen.*(?:4b|7b|8b|9b|14b).*instruct/i,
    /^deepseek\/deepseek.*flash/i
  ],
  nvidiaNim: [
    "openai/gpt-oss-120b",
    /^qwen\/qwen3(?:\.\d+)?-(?:4b|7b|8b|9b|14b)(?:-|$)/i,
    /^qwen\/qwen.*(?:4b|7b|8b|9b|14b).*instruct/i,
    /^microsoft\/phi-4-mini-instruct$/i,
    /^google\/gemma.*(?:4b|7b|8b|9b).*it/i,
    /^meta\/llama.*8b.*instruct/i
  ],
  local: [
    "google/gemma-4-e4b",
    /^qwen\/qwen3(?:\.\d+)?-(?:4b|7b|8b|9b|14b)(?:-|$)/i,
    /qwen.*(?:4b|7b|8b|9b|14b).*instruct/i,
    /gemma.*(?:4b|7b|8b|9b).*it/i,
    /llama.*8b.*instruct/i
  ]
};

const GENERAL_LIGHTWEIGHT_PATTERNS = [
  /flash-lite/i,
  /haiku/i,
  /(?:mini|nano)(?:-|$|\s)/i,
  /(?:4b|7b|8b|9b|14b).*instruct/i
];

function getSearchText(model) {
  return `${model?.id || ""} ${model?.label || ""}`;
}

function isSuitableTextModel(model) {
  return Boolean(model?.id) && !UNSUITABLE_MODEL_PATTERN.test(getSearchText(model));
}

function sortNewestFirst(models) {
  return [...models].sort((left, right) => String(right.id).localeCompare(String(left.id), "en", {
    numeric: true,
    sensitivity: "base"
  }));
}

function findPreferredModel(models, preference) {
  if (typeof preference === "string") {
    return models.find((model) => String(model.id).toLowerCase() === preference.toLowerCase()) || null;
  }
  return sortNewestFirst(models.filter((model) => (
    preference.test(String(model.id || "")) || preference.test(String(model.label || ""))
  )))[0] || null;
}

export function selectRecommendedModel(providerId, models = []) {
  const suitableModels = models.filter(isSuitableTextModel);
  const candidates = suitableModels.length > 0 ? suitableModels : models.filter((model) => model?.id);
  if (candidates.length === 0) return null;

  for (const preference of PROVIDER_MODEL_PREFERENCES[providerId] || []) {
    const match = findPreferredModel(candidates, preference);
    if (match) return match;
  }
  for (const pattern of GENERAL_LIGHTWEIGHT_PATTERNS) {
    const match = findPreferredModel(candidates, pattern);
    if (match) return match;
  }
  return candidates[0];
}

export const modelRecommendationInternals = {
  PROVIDER_MODEL_PREFERENCES,
  GENERAL_LIGHTWEIGHT_PATTERNS,
  isSuitableTextModel
};
