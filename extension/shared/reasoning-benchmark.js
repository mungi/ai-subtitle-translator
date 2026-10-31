import { buildSystemPromptFromSettings } from "./defaults.js";
import { buildProviderRequest, createReasoningProfile, extractText, getReasoningProbeModes, isReasoningOptionError } from "./provider-request.js";
import { translationInternals } from "./translation.js";

const SAMPLE = {
  platform: "test", videoId: "reasoning-benchmark", sourceLanguage: "en",
  cues: [
    "Before you can create", "a project, you must apply", "for eligibility.",
    "The review usually takes", "two business days.", "Then you can start using resources."
  ].map((text, index) => ({ id: `test-${index}`, start: index * 2, end: index * 2 + 2, text }))
};

// Compare translation requests, not an OK response that may hide reasoning cost.
export async function benchmarkReasoningModes(provider, targetLanguage) {
  const measurements = [];
  let selected;
  for (const mode of getReasoningProbeModes(provider)) {
    const request = buildProviderRequest(provider, {
      systemPrompt: buildSystemPromptFromSettings({ translationStyle: "natural", targetLanguage }),
      input: translationInternals.buildTranslationInput(SAMPLE), maxTokens: 2048, reasoningMode: mode
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const started = performance.now();
    let body;
    const measurement = { mode, valid: false };
    try {
      const response = await fetch(request.url, { ...request.init, signal: controller.signal });
      body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error?.message || body.message || response.statusText);
        error.status = response.status;
        if (!isReasoningOptionError(error)) throw error;
        measurement.unsupported = true;
      } else {
        const translations = translationInternals.parseTranslationResponse(extractText(provider, body));
        translationInternals.validateChunkTranslations(SAMPLE, translations);
        measurement.valid = true;
        measurement.inputTokens = body.usage?.input_tokens ?? null;
        measurement.outputTokens = body.usage?.output_tokens ?? null;
        measurement.thinkingTokens = body.usage?.output_tokens_details?.thinking_tokens
          ?? body.usage?.thinking_tokens ?? null;
      }
    } catch (error) {
      if (error.status) throw error;
      // A timeout or malformed translation disqualifies this mode only.
    } finally {
      clearTimeout(timeout);
      measurement.elapsedMs = Math.round(performance.now() - started);
      measurements.push(measurement);
    }
    if (measurement.valid && (!selected || measurement.elapsedMs < selected.measurement.elapsedMs)) {
      selected = { mode, body, measurement };
    }
  }
  if (!selected) throw new Error("No reasoning setting returned a complete subtitle translation.");
  return {
    providerId: provider.id, providerLabel: provider.label, text: "OK",
    reasoningProfile: { ...createReasoningProfile(provider, selected.mode), measurements },
    raw: selected.body
  };
}
