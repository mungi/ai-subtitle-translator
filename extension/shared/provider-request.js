import { assertProviderEndpoint } from "./provider-security.js";

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
    return provider.id === "openrouter" && provider.disableReasoning === false ? "omit" : "none";
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
  if (provider.apiStyle === "anthropic-messages" || provider.id === "nvidiaNim") return ["low", "omit"];
  if (provider.id === "local" || provider.id === "openai" || provider.id === "openrouter") {
    return ["none", "minimal", "low", "omit"];
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

function resolveReasoningMode(provider, model, override) {
  if (override !== undefined) return override;
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

  if (provider.id === "nvidiaNim" || provider.id === "local") {
    return reasoningMode === "omit" ? {} : { reasoning_effort: reasoningMode };
  }

  return {};
}

export function isReasoningOptionError(error) {
  if (![400, 422].includes(Number(error?.status))) return false;
  return /(reasoning|thinking|output_config)/i
    .test(`${error?.message || ""} ${error?.details || ""}`);
}

export function shouldRetryOpenRouterWithoutReasoning(provider, error) {
  if (provider?.id !== "openrouter"
    || resolveReasoningMode(provider, resolveProviderModel(provider)) === "omit") return false;
  return isReasoningOptionError(error);
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
  const maxTokens = Number(maxTokensOverride ?? provider.maxTokens ?? 4096);

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
            text: { verbosity: "low" }
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
            ...(reasoningMode === "omit" ? {} : { output_config: { effort: reasoningMode } })
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
