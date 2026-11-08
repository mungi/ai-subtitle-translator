import { assertProviderEndpoint } from "./provider-security.js";
import { fitMaxTokensToContext } from "./provider-context.js";
import { buildCustomHeaders, CUSTOM_LLM_PROVIDER_ID, normalizeJsonMode, normalizeReasoningEffort } from "./custom-llm-options.js";

function joinUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function requireValue(value, label) {
  if (!value || String(value).trim() === "") {
    throw new Error(`${label} is required.`);
  }
  return String(value).trim();
}

function buildMessages(systemPrompt, input) {
  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: input }
  ];
}

export const ANTHROPIC_DIRECT_BROWSER_ACCESS_HEADER = "anthropic-dangerous-direct-browser-access";

function defaultReasoningMode(provider, model) {
  if (provider.id === "openai" || provider.id === "openrouter") {
    return provider.id === "openrouter" && provider.disableReasoning === false ? "omit" : "low";
  }
  if (provider.id === "nvidiaNim") return "low";
  if (provider.apiStyle === "google-generate-content") {
    if (model.includes("gemini-2.5")) return model.includes("pro") ? "budget:128" : "budget:0";
    if (model.includes("gemini-3")) return model.includes("flash-lite") ? "minimal" : "low";
  }
  if (provider.apiStyle !== "anthropic-messages") return "omit";
  const normalizedModel = String(model || "").toLowerCase();
  return (
    normalizedModel.includes("fable")
    || normalizedModel.includes("opus")
    || normalizedModel.includes("sonnet")
  ) ? "low" : "omit";
}

const TRANSLATION_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "subtitle_translations",
    strict: true,
    schema: {
      type: "object",
      properties: {
        translations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" }
            },
            required: ["id", "text"],
            additionalProperties: false
          }
        }
      },
      required: ["translations"],
      additionalProperties: false
    }
  }
};

export function getReasoningProbeModes(provider) {
  if (provider.apiStyle === "google-generate-content") {
    const model = String(provider.model || "").toLowerCase();
    if (model.includes("gemini-2.5")) return [model.includes("pro") ? "budget:128" : "budget:0", "omit"];
    return ["minimal", "low", "omit"];
  }
  if (provider.apiStyle === "anthropic-messages") return ["low", "omit"];
  if (provider.id === "nvidiaNim") return ["low", "omit"];
  // A reasoning value chosen in Custom LLM settings is the only one the connection test tries.
  const chosenEffort = getChosenReasoningEffort(provider);
  if (chosenEffort) return [chosenEffort];
  if (provider.id === "local" || provider.id === "openai" || provider.id === "openrouter") {
    // Start with "low" for natural translations; step down to turning reasoning off only on an error.
    return ["low", "minimal", "none", "omit"];
  }
  return ["omit"];
}

export function createReasoningProfile(provider, mode) {
  return {
    model: resolveProviderModel(provider),
    apiStyle: provider.apiStyle,
    baseUrl: provider.baseUrl,
    mode
  };
}

// The Custom LLM's reasoning setting when it is not "auto"; "omit" means send no reasoning_effort.
function getChosenReasoningEffort(provider) {
  if (provider?.id !== CUSTOM_LLM_PROVIDER_ID) return null;
  const effort = normalizeReasoningEffort(provider.reasoningEffort);
  return effort === "auto" ? null : effort;
}

function resolveReasoningMode(provider, model, override) {
  if (override !== undefined) return override;
  const chosenEffort = getChosenReasoningEffort(provider);
  if (chosenEffort) return chosenEffort;
  const profile = provider.reasoningProfile;
  if (profile?.model === model && profile.apiStyle === provider.apiStyle
    && profile.baseUrl === provider.baseUrl && getReasoningProbeModes(provider).includes(profile.mode)) {
    return profile.mode;
  }
  if (provider.id === "openrouter" && provider.disableReasoning === false) return "omit";
  return defaultReasoningMode(provider, model.toLowerCase());
}

function buildGoogleThinkingConfig(mode) {
  if (mode === "minimal" || mode === "low") return { thinkingLevel: mode };
  if (mode === "budget:0" || mode === "budget:128") return { thinkingBudget: Number(mode.slice(7)) };
  return null;
}

function buildOpenAICompatibleOptions(provider, { structuredOutput = true, reasoningMode } = {}) {
  if (provider.id === "openrouter") {
    return {
      ...(reasoningMode === "omit" ? {} : { reasoning: { effort: reasoningMode } }),
      ...(structuredOutput ? { response_format: TRANSLATION_RESPONSE_FORMAT } : {})
    };
  }

  if (provider.id === "local") {
    // JSON mode is the user's choice: many local servers do not accept response_format.
    const jsonMode = structuredOutput ? normalizeJsonMode(provider.jsonMode) : "off";
    return {
      ...(reasoningMode === "omit" ? {} : { reasoning_effort: reasoningMode }),
      ...(jsonMode === "json_schema" ? { response_format: TRANSLATION_RESPONSE_FORMAT } : {}),
      ...(jsonMode === "json_object" ? { response_format: { type: "json_object" } } : {})
    };
  }

  if (provider.id === "nvidiaNim") {
    return reasoningMode === "omit" ? {} : { reasoning_effort: reasoningMode };
  }

  return {};
}

export function isReasoningOptionError(error) {
  if (![400, 422].includes(Number(error?.status))) return false;
  return /(reasoning|thinking|output_config)/i
    .test(`${error?.message || ""} ${error?.details || ""}`);
}

// After a reasoning option error: turn reasoning off first, then stop sending the option at all.
export function getReasoningFallbackMode(provider, error) {
  if (provider?.id !== "openrouter" && provider?.id !== "openai") return null;
  const current = resolveReasoningMode(provider, resolveProviderModel(provider));
  if (current === "omit" || !isReasoningOptionError(error)) return null;
  return current === "none" ? "omit" : "none";
}

function resolveProviderModel(provider) {
  const model = requireValue(provider.model, "Model");
  if (provider.id !== "openrouter") return model;

  const baseModel = model.replace(/:nitro$/i, "");
  return provider.nitro === false ? baseModel : `${baseModel}:nitro`;
}

export function buildProviderRequest(provider, { systemPrompt, input, structuredOutput = true, maxTokens: maxTokensOverride, reasoningMode: reasoningModeOverride }) {
  assertProviderEndpoint(provider);
  const apiStyle = requireValue(provider.apiStyle, "API style");
  const model = resolveProviderModel(provider);
  const reasoningMode = resolveReasoningMode(provider, model, reasoningModeOverride);
  const temperature = Number(provider.temperature ?? 0.2);
  // A Custom LLM whose context size the connection test found asks for no more than fits.
  const maxTokens = fitMaxTokensToContext(provider, Number(maxTokensOverride ?? provider.maxTokens ?? 4096), `${systemPrompt ?? ""}${input ?? ""}`);

  switch (apiStyle) {
    case "openai-responses": {
      const baseUrl = requireValue(provider.baseUrl, "Base URL");
      const apiKey = requireValue(provider.apiKey, "API key");
      return {
        url: joinUrl(baseUrl, "responses"),
        init: {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            instructions: systemPrompt,
            input,
            ...(reasoningMode === "omit" ? { temperature } : {}),
            max_output_tokens: maxTokens,
            ...(reasoningMode === "omit" ? {} : { reasoning: { effort: reasoningMode } }),
            // A strict schema keeps a subtitle line such as ">> Yes" from breaking the reply's JSON.
            text: {
              verbosity: "low",
              ...(structuredOutput ? { format: { type: "json_schema", ...TRANSLATION_RESPONSE_FORMAT.json_schema } } : {})
            }
          })
        }
      };
    }
    case "anthropic-messages": {
      const baseUrl = requireValue(provider.baseUrl, "Base URL");
      const apiKey = requireValue(provider.apiKey, "API key");
      return {
        url: joinUrl(baseUrl, "v1/messages"),
        init: {
          method: "POST",
          redirect: "error",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": provider.anthropicVersion || "2023-06-01",
            [ANTHROPIC_DIRECT_BROWSER_ACCESS_HEADER]: "true",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            system: systemPrompt,
            messages: [{ role: "user", content: input }],
            max_tokens: maxTokens,
            ...(reasoningMode === "none" ? { thinking: { type: "disabled" }, output_config: { effort: "low" } }
              : reasoningMode === "omit" ? {} : { output_config: { effort: reasoningMode } })
          })
        }
      };
    }
    case "google-generate-content": {
      const baseUrl = requireValue(provider.baseUrl, "Base URL");
      const apiKey = requireValue(provider.apiKey, "API key");
      const url = `${joinUrl(baseUrl, `models/${encodeURIComponent(model)}:generateContent`)}?key=${encodeURIComponent(apiKey)}`;
      const thinkingConfig = buildGoogleThinkingConfig(reasoningMode);
      return {
        url,
        init: {
          method: "POST",
          redirect: "error",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: input }]
              }
            ],
            generationConfig: {
              ...(/^gemini-3\.5-flash-lite(?:-|$)/i.test(model) ? {} : { temperature }),
              maxOutputTokens: maxTokens,
              ...(thinkingConfig ? { thinkingConfig } : {})
            }
          })
        }
      };
    }
    case "openai-chat": {
      const baseUrl = requireValue(provider.baseUrl, "Base URL");
      const apiKey = provider.apiKey?.trim();
      const headers = {
        "Content-Type": "application/json"
      };

      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      if (provider.siteUrl) {
        headers["HTTP-Referer"] = provider.siteUrl;
      }

      if (provider.appTitle) {
        headers["X-Title"] = provider.appTitle;
      }

      // Custom LLM extra headers; one named Authorization replaces the Bearer API key header.
      Object.assign(headers, buildCustomHeaders(provider));

      return {
        url: joinUrl(baseUrl, "chat/completions"),
        init: {
          method: "POST",
          redirect: "error",
          headers,
          body: JSON.stringify({
            model,
            messages: buildMessages(systemPrompt, input),
            temperature,
            max_tokens: maxTokens,
            ...buildOpenAICompatibleOptions(provider, { structuredOutput, reasoningMode })
          })
        }
      };
    }
    default:
      throw new Error(`Unsupported API style: ${apiStyle}`);
  }
}

export function extractText(provider, responseBody) {
  switch (provider.apiStyle) {
    case "openai-responses":
      return responseBody.output_text
        || responseBody.output?.flatMap((item) => item.content || [])
          .map((part) => part.text || part.output_text || "")
          .join("")
        || "";
    case "anthropic-messages":
      return responseBody.content?.map((part) => part.text || "").join("") || "";
    case "google-generate-content":
      return responseBody.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
    case "openai-chat": {
      const content = responseBody.choices?.[0]?.message?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((part) => part?.text || part?.content || "").join("");
      }
      return "";
    }
    default:
      return "";
  }
}
