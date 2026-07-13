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

const OPENAI_REASONING_OPTIONS = {
  reasoning: {
    effort: "none"
  },
  text: {
    verbosity: "low"
  }
};

const ANTHROPIC_LOW_EFFORT_OPTIONS = {
  output_config: {
    effort: "low"
  }
};

export const ANTHROPIC_DIRECT_BROWSER_ACCESS_HEADER = "anthropic-dangerous-direct-browser-access";

function buildAnthropicModelOptions(model) {
  const normalizedModel = String(model || "").toLowerCase();
  if (normalizedModel.includes("haiku")) {
    return {};
  }
  if (
    normalizedModel.includes("fable")
    || normalizedModel.includes("opus")
    || normalizedModel.includes("sonnet")
  ) {
    return ANTHROPIC_LOW_EFFORT_OPTIONS;
  }
  return {};
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

function buildGoogleThinkingConfig(provider) {
  const model = String(provider.model || "").toLowerCase();

  if (model.includes("gemini-3")) {
    return {
      thinkingLevel: model.includes("flash-lite") ? "minimal" : "low"
    };
  }

  if (model.includes("gemini-2.5")) {
    if (model.includes("flash") || model.includes("lite")) {
      return {
        thinkingBudget: 0
      };
    }

    if (model.includes("pro")) {
      return {
        thinkingBudget: 128
      };
    }
  }

  return null;
}

function buildOpenAICompatibleOptions(provider, { structuredOutput = true } = {}) {
  if (provider.id === "openrouter") {
    return {
      ...(provider.disableReasoning === false ? {} : {
        reasoning: {
          effort: "none"
        }
      }),
      ...(structuredOutput ? { response_format: TRANSLATION_RESPONSE_FORMAT } : {})
    };
  }

  if (provider.id === "nvidiaNim") {
    return {
      reasoning_effort: "low"
    };
  }

  return {};
}

export function shouldRetryOpenRouterWithoutReasoning(provider, error) {
  if (provider?.id !== "openrouter" || provider.disableReasoning === false) return false;
  if (![400, 422].includes(Number(error?.status))) return false;
  return /\b(reasoning|thinking|reasoning[_ -]?effort)\b/i.test(String(error?.message || ""));
}

function resolveProviderModel(provider) {
  const model = requireValue(provider.model, "Model");
  if (provider.id !== "openrouter") return model;

  const baseModel = model.replace(/:nitro$/i, "");
  return provider.nitro === false ? baseModel : `${baseModel}:nitro`;
}

export function buildProviderRequest(provider, { systemPrompt, input, structuredOutput = true, maxTokens: maxTokensOverride }) {
  const apiStyle = requireValue(provider.apiStyle, "API style");
  const model = resolveProviderModel(provider);
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
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            instructions: systemPrompt,
            input,
            temperature,
            max_output_tokens: maxTokens,
            ...OPENAI_REASONING_OPTIONS
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
            ...buildAnthropicModelOptions(model)
          })
        }
      };
    }
    case "google-generate-content": {
      const baseUrl = requireValue(provider.baseUrl, "Base URL");
      const apiKey = requireValue(provider.apiKey, "API key");
      const url = `${joinUrl(baseUrl, `models/${encodeURIComponent(model)}:generateContent`)}?key=${encodeURIComponent(apiKey)}`;
      const thinkingConfig = buildGoogleThinkingConfig(provider);
      return {
        url,
        init: {
          method: "POST",
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
              temperature,
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
          headers,
          body: JSON.stringify({
            model,
            messages: buildMessages(systemPrompt, input),
            temperature,
            max_tokens: maxTokens,
            ...buildOpenAICompatibleOptions(provider, { structuredOutput })
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
