import assert from "node:assert/strict";
import test from "node:test";
import { selectRecommendedModel } from "../extension/shared/model-recommendations.js";

test("Google AI recommends Gemini 3.1 Flash Lite over larger and media models", () => {
  const selected = selectRecommendedModel("google", [
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
    { id: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" }
  ]);

  assert.equal(selected.id, "gemini-3.1-flash-lite");
});

test("provider recommendations choose configured models before lightweight fallbacks", () => {
  assert.equal(selectRecommendedModel("openai", [
    { id: "gpt-5.6", label: "GPT 5.6" },
    { id: "gpt-5.6-luna", label: "GPT 5.6 Luna" },
    { id: "gpt-5.4-mini", label: "GPT 5.4 Mini" }
  ]).id, "gpt-5.6-luna");

  assert.equal(selectRecommendedModel("anthropic", [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (20251001)" }
  ]).id, "claude-haiku-4-5-20251001");

  assert.equal(selectRecommendedModel("openrouter", [
    { id: "openai/gpt-5.5", label: "GPT 5.5" },
    { id: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
    { id: "deepseek/deepseek-v4-flash", label: "DeepSeek: DeepSeek V4 Flash" }
  ]).id, "deepseek/deepseek-v4-flash");

  assert.equal(selectRecommendedModel("nvidiaNim", [
    { id: "openai/gpt-oss-120b", label: "GPT OSS 120B" },
    { id: "qwen/qwen3-8b", label: "Qwen 3 8B" }
  ]).id, "openai/gpt-oss-120b");

  assert.equal(selectRecommendedModel("local", [
    { id: "local/huge-model-70b", label: "Huge Model 70B" },
    { id: "qwen/qwen3-8b", label: "Qwen 3 8B" },
    { id: "google/gemma-4-e4b", label: "Gemma 4 E4B" }
  ]).id, "google/gemma-4-e4b");
});

test("model recommendation excludes non-text variants and falls back safely", () => {
  assert.equal(selectRecommendedModel("openai", [
    { id: "gpt-5-mini-transcribe", label: "GPT 5 Mini Transcribe" },
    { id: "gpt-5", label: "GPT 5" }
  ]).id, "gpt-5");
  assert.equal(selectRecommendedModel("unknown", [{ id: "only-model", label: "Only Model" }]).id, "only-model");
  assert.equal(selectRecommendedModel("google", []), null);
});
