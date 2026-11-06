// Context window detection for the Custom LLM provider. The connection test asks the server a few
// read-only questions; the size it finds limits each request so prompt + reply fit the model.
// Field names come from each server's API docs: LM Studio /api/v1/models (loaded instance and model
// maximum), LM Studio /api/v0 and Ollama /api/show (maximum only). OpenAI-compatible /v1/models has
// no standard field, so a few common extras are read when present.

import { buildCustomHeaders } from "./custom-llm-options.js";

export const CONTEXT_DETECTION_PROVIDER_ID = "local";
const CONTEXT_REQUEST_TIMEOUT_MS = 5000;
// Rough characters per token used to size requests. Low on purpose: Korean, Japanese and Chinese
// use more tokens per character than English, and overestimating the prompt only shortens the reply.
const CHARS_PER_TOKEN = 1.5;
const CONTEXT_SAFETY_TOKENS = 128;
const MIN_OUTPUT_TOKENS = 256;

function positiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}

function sameModel(candidate, model) {
  const wanted = String(model || "").toLowerCase();
  return [candidate?.id, candidate?.key, candidate?.model, candidate?.name, candidate?.path]
    .some((value) => typeof value === "string" && value.toLowerCase() === wanted);
}

function pickModel(items, model) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.find((item) => sameModel(item, model)) || (items.length === 1 ? items[0] : null);
}

// OpenAI-compatible GET {baseUrl}/models. vLLM reports the length it serves as max_model_len;
// llama.cpp reports the training length as meta.n_ctx_train.
export function parseOpenAiModelsContext(body, model) {
  const item = pickModel(body?.data, model);
  if (!item) return {};
  const loaded = positiveInteger(item.max_model_len);
  const max = positiveInteger(item.context_length ?? item.context_window ?? item.max_context_length ?? item.meta?.n_ctx_train);
  return { ...(loaded ? { loaded } : {}), ...(max ? { max } : {}) };
}

// LM Studio GET /api/v1/models: models[].loaded_instances[].config.context_length and models[].max_context_length.
export function parseLmStudioModelsContext(body, model) {
  const item = pickModel(body?.models ?? body?.data, model);
  if (!item) return {};
  const loaded = (item.loaded_instances || [])
    .map((instance) => positiveInteger(instance?.config?.context_length))
    .find(Boolean);
  const max = positiveInteger(item.max_context_length);
  return { ...(loaded ? { loaded } : {}), ...(max ? { max } : {}) };
}

// Ollama POST /api/show: model_info["<architecture>.context_length"]. This is the model maximum;
// Ollama does not report the context it actually runs with.
export function parseOllamaShowContext(body) {
  const info = body?.model_info;
  if (!info || typeof info !== "object") return {};
  const key = Object.keys(info).find((name) => name.endsWith(".context_length"));
  const max = key ? positiveInteger(info[key]) : null;
  return max ? { max } : {};
}

export function getServerRootUrl(baseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "").replace(/\/v1$/i, "");
}

function authHeaders(provider) {
  const apiKey = String(provider.apiKey || "").trim();
  return { ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}), ...buildCustomHeaders(provider) };
}

async function fetchJsonQuietly(url, init) {
  try {
    const signal = typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(CONTEXT_REQUEST_TIMEOUT_MS) : undefined;
    const response = await fetch(url, { redirect: "error", ...init, ...(signal ? { signal } : {}) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export const CONTEXT_DETECTION_STEPS = ["models", "lmStudio", "ollama"];

// Asks up to three read-only endpoints on the configured server, stopping once the loaded size is
// known. onStep(stepName) runs before each request. Returns { contextLength, source } or null;
// source is "loaded" (what the server runs with) or "max" (what the model supports).
export async function detectContextLength(provider, { onStep } = {}) {
  const model = String(provider?.model || "");
  const baseUrl = String(provider?.baseUrl || "").replace(/\/+$/, "");
  const root = getServerRootUrl(baseUrl);
  const queries = {
    models: async () => parseOpenAiModelsContext(await fetchJsonQuietly(`${baseUrl}/models`, { headers: authHeaders(provider) }), model),
    lmStudio: async () => parseLmStudioModelsContext(await fetchJsonQuietly(`${root}/api/v1/models`, { headers: authHeaders(provider) }), model),
    ollama: async () => parseOllamaShowContext(await fetchJsonQuietly(`${root}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(provider) },
      body: JSON.stringify({ model })
    }))
  };
  let max = null;
  for (const step of CONTEXT_DETECTION_STEPS) {
    onStep?.(step);
    const found = await queries[step]();
    if (found.loaded) return { contextLength: found.loaded, source: "loaded" };
    if (found.max && !max) max = found.max;
  }
  return max ? { contextLength: max, source: "max" } : null;
}

export function createContextProfile(provider, detected) {
  if (!detected?.contextLength) return null;
  return {
    model: String(provider.model || ""),
    baseUrl: String(provider.baseUrl || ""),
    contextLength: detected.contextLength,
    source: detected.source
  };
}

// The detected size, only while the provider still points at the model and server it was found for.
export function getContextLength(provider) {
  const profile = provider?.contextProfile;
  if (provider?.id !== CONTEXT_DETECTION_PROVIDER_ID || !profile) return null;
  if (profile.model !== String(provider.model || "") || profile.baseUrl !== String(provider.baseUrl || "")) return null;
  return positiveInteger(profile.contextLength);
}

export function estimateTokens(text) {
  return Math.ceil(String(text ?? "").length / CHARS_PER_TOKEN);
}

// Output tokens to request so that prompt + reply stay inside the context window.
export function fitMaxTokensToContext(provider, maxTokens, promptText) {
  const contextLength = getContextLength(provider);
  if (!contextLength) return maxTokens;
  const room = contextLength - estimateTokens(promptText) - CONTEXT_SAFETY_TOKENS;
  return Math.min(maxTokens, Math.max(MIN_OUTPUT_TOKENS, room));
}

// Largest transcript part (in characters) for one summary request: about half the context for the
// input, leaving the rest for the prompt and the reply.
export function fitSummaryPartChars(provider, defaultChars) {
  const contextLength = getContextLength(provider);
  if (!contextLength) return defaultChars;
  return Math.max(1000, Math.min(defaultChars, Math.floor(contextLength * 0.45 * CHARS_PER_TOKEN)));
}
