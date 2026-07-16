export const PROVIDERS = {
  googleTranslate: {
    id: "googleTranslate",
    label: "Google Translate",
    apiStyle: "google-translate",
    baseUrl: "https://translate.googleapis.com/translate_a/single"
  },
  deepl: {
    id: "deepl",
    label: "DeepL",
    apiStyle: "deepl",
    baseUrl: "https://api-free.deepl.com/v2/translate",
    apiKey: "",
    plan: "free"
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    apiStyle: "openai-responses",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-5.6-luna",
    temperature: 0.2,
    maxTokens: 8192
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    apiStyle: "anthropic-messages",
    baseUrl: "https://api.anthropic.com",
    apiKey: "",
    model: "claude-haiku-4-5-20251001",
    anthropicVersion: "2023-06-01",
    temperature: 0.2,
    maxTokens: 8192
  },
  google: {
    id: "google",
    label: "Google AI",
    apiStyle: "google-generate-content",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    model: "gemini-3.1-flash-lite",
    temperature: 0.2,
    maxTokens: 8192
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    apiStyle: "openai-chat",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    model: "deepseek/deepseek-v4-flash:nitro",
    nitro: true,
    disableReasoning: true,
    siteUrl: "",
    appTitle: "AI Subtitle Translator",
    temperature: 0.2,
    maxTokens: 8192
  },
  nvidiaNim: {
    id: "nvidiaNim",
    label: "NVIDIA NIM",
    apiStyle: "openai-chat",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey: "",
    model: "openai/gpt-oss-120b",
    temperature: 0.2,
    maxTokens: 8192
  },
  local: {
    id: "local",
    label: "Custom LLM",
    apiStyle: "openai-chat",
    baseUrl: "http://localhost:1234/v1",
    apiKey: "",
    model: "google/gemma-4-e4b",
    temperature: 0.2,
    maxTokens: 8192
  }
};

export const DEFAULT_CUSTOM_WEB_FONT_CSS = `@font-face {
    font-family: 'Pretendard';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Bold.woff2') format('woff2');
    font-weight: 700;
    font-display: swap;
}`;

export const WEB_FONT_PRESETS = [
  {
    id: "system-arial",
    label: "Arial",
    labels: { ko: "Arial", en: "Arial" },
    fontFamily: "Arial, sans-serif",
    css: ""
  },
  {
    id: "system-segoe",
    label: "Segoe UI",
    labels: { ko: "Segoe UI", en: "Segoe UI" },
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    css: ""
  },
  {
    id: "system-times",
    label: "Times New Roman",
    labels: { ko: "Times New Roman", en: "Times New Roman" },
    fontFamily: "'Times New Roman', serif",
    css: ""
  },
  {
    id: "system-courier",
    label: "Courier New",
    labels: { ko: "Courier New", en: "Courier New" },
    fontFamily: "'Courier New', monospace",
    css: ""
  },
  {
    id: "noto-sans-jp",
    label: "Noto Sans JP",
    labels: { ko: "Noto Sans JP", en: "Noto Sans JP", ja: "Noto Sans JP" },
    fontFamily: "'Noto Sans JP', sans-serif",
    css: "@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');"
  },
  {
    id: "noto-serif-jp",
    label: "Noto Serif JP",
    labels: { ko: "Noto Serif JP", en: "Noto Serif JP", ja: "Noto Serif JP" },
    fontFamily: "'Noto Serif JP', serif",
    css: "@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap');"
  },
  {
    id: "pretendard",
    label: "Pretendard",
    labels: { ko: "프리텐다드", en: "Pretendard" },
    fontFamily: "'Pretendard', sans-serif",
    css: `@font-face {
    font-family: 'Pretendard';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Regular.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
}`
  },
  {
    id: "gowun-batang",
    label: "고운바탕",
    labels: { ko: "고운바탕", en: "Gowun Batang" },
    fontFamily: "'GounBatang', serif",
    css: `@font-face {
    font-family: 'GounBatang';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2108@1.1/GowunBatang-Regular.woff') format('woff');
    font-weight: normal;
    font-display: swap;
}`
  },
  {
    id: "binggre",
    label: "빙그레체",
    labels: { ko: "빙그레체", en: "Binggre" },
    fontFamily: "'Binggre', sans-serif",
    css: `@font-face {
    font-family: 'Binggre';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/Binggrae.woff') format('woff');
    font-weight: normal;
    font-display: swap;
}
@font-face {
    font-family: 'Binggre';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2110@1.0/Binggrae-Bold.woff2') format('woff2');
    font-weight: 700;
    font-display: swap;
}`
  },
  {
    id: "paperlogy",
    label: "Paperlogy",
    labels: { ko: "페이퍼로지", en: "Paperozi" },
    fontFamily: "'Paperozi', sans-serif",
    css: `@font-face {
    font-family: 'Paperozi';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-3@1.0/Paperlogy-4Regular.woff2') format('woff2');
    font-weight: 400;
    font-display: swap;
}`
  },
  {
    id: "jeonju-wanpanbon",
    label: "전주완판본 각체",
    labels: { ko: "전주완판본 각체", en: "Jeonju Wanpanbon Gak" },
    fontFamily: "'JeonjuWanpanbon', serif",
    css: `@font-face {
    font-family: 'JeonjuWanpanbon';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2102-01@1.0/Jeonju_gakR.woff') format('woff');
    font-weight: normal;
    font-display: swap;
}`
  },
  {
    id: "gangwon-moduche",
    label: "GangwonEducationModuche",
    labels: { ko: "강원교육모두체", en: "GangwonEducationModuche" },
    fontFamily: "'GangwonEducationModuche', Arial, sans-serif",
    css: `@font-face {
    font-family: 'GangwonEducationModuche';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2201-2@1.0/GangwonEdu_OTFLightA.woff') format('woff');
    font-weight: 300;
    font-display: swap;
}
@font-face {
    font-family: 'GangwonEducationModuche';
    src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2201-2@1.0/GangwonEdu_OTFBoldA.woff') format('woff');
    font-weight: 700;
    font-display: swap;
}`
  }
];

export function getWebFontPresetLabel(preset, languageCode = "en") {
  const language = ["ko", "ja"].includes(languageCode) ? languageCode : "en";
  return preset?.labels?.[language] || preset?.label || preset?.id || "";
}

export function getTargetLanguageLabel(language, languageCode = "en") {
  const uiLanguage = ["ko", "ja"].includes(languageCode) ? languageCode : "en";
  return language?.nativeLabel || language?.labels?.[uiLanguage] || language?.labels?.en || language?.code || "";
}

const COMMON_SYSTEM_PROMPT_LINES = [
  "You are a professional subtitle translator for video courses and tutorials.",
  "Source subtitles may be auto-generated from speech and can contain ASR errors: typos, misheard words, missing punctuation, wrong casing, broken sentence boundaries, duplicated words, or incomplete phrases.",
  "Use the full subtitle document, nearby cue context, topic flow, and technical vocabulary to infer the intended meaning. Silently correct obvious transcription errors when confidence is high.",
  "Translate the intended meaning naturally. Do not preserve awkward source wording when a clear idiomatic paraphrase is better for the target language.",
  "Do not invent facts that are not supported by the context. If the source is genuinely ambiguous, preserve that ambiguity.",
  "Keep names, product terms, code identifiers, commands, UI labels, and technical terminology consistent across all cues.",
  "Preserve every original cue id and return exactly one translation for each input cue id. Keep each translated cue concise enough to fit the original subtitle timing.",
  "Return only minified valid JSON with this exact shape: {\"translations\":[{\"id\":\"cue id\",\"text\":\"translated text\"}]}",
  "Do not include markdown fences, explanations, trailing commas, or extra keys."
];

const STYLE_SYSTEM_PROMPT_LINES = {
  natural: [
    "Style: Natural.",
    "Translate into fluent, everyday target-language phrasing that sounds natural to a native viewer.",
    "Prioritize readability, conversational flow, and smooth subtitle rhythm while preserving the speaker's meaning, tone, intent, and emotional nuance.",
    "Rephrase awkward, fragmented, or literal auto-caption wording into clear and natural sentences when the intended meaning is supported by context.",
    "Use idiomatic expressions where appropriate, but do not add new information, jokes, opinions, or emotional emphasis that is not present in the source.",
    "Preserve names, numbers, dates, key details, and important distinctions accurately.",
    "Avoid stiff wording, unnatural source-language structure, excessive literalness, and unnecessary formality.",
    "Keep each subtitle cue concise, easy to read, and consistent with the surrounding dialogue."
  ],
  lecture: [
    "Style: Lecture.",
    "Translate using clear, structured, and instructional wording suited to lectures, tutorials, training videos, and online courses.",
    "Make the explanation easy to follow by preserving definitions, causal relationships, examples, comparisons, transitions, and step-by-step reasoning.",
    "Reconstruct broken or incomplete auto-caption wording into a coherent explanation when the intended meaning is clear from context.",
    "Prefer concise explanatory phrasing over literal translation when it improves comprehension, but do not simplify away important details or alter the speaker's logic.",
    "Clarify pronouns, references, or implied subjects only when the surrounding context clearly supports the clarification.",
    "Keep technical terms, numbers, examples, warnings, and procedural steps accurate.",
    "Avoid overly academic wording, unnecessary repetition, invented explanations, and excessive motivational language.",
    "Keep subtitle cues concise, logically connected, and comfortable to read."
  ],
  technical: [
    "Style: Technical.",
    "Prioritize technical accuracy, terminology consistency, and precise relationships between concepts.",
    "Keep code, commands, configuration values, API names, library names, product names, protocols, acronyms, file paths, UI labels, and domain-specific terms stable and accurate.",
    "Preserve conditions, dependencies, limitations, comparisons, cause-and-effect relationships, units, versions, and numerical values exactly.",
    "Use established target-language technical terminology when available. When no standard translation exists, retain the original term or use the most widely recognized form.",
    "Avoid over-paraphrasing, vague simplification, casual substitution of technical terms, or wording that changes scope or certainty.",
    "Clean up fragmented auto-caption text only when the intended technical meaning is clear from context. Do not guess missing technical details.",
    "Do not add external facts, assumptions, examples, or explanations that are not supported by the source.",
    "Keep each subtitle cue concise and readable without sacrificing technical precision."
  ]
};

const DEFAULT_CUSTOM_STYLE_SYSTEM_PROMPT = [
  "Style: Star instructor lecture.",
  "Translate with the clarity, confidence, and energy of a top academy instructor explaining difficult ideas to motivated learners.",
  "Use a casual lecture tone in the target language specified by the system prompt. Prefer informal, direct speech where it is natural for that language, like a skilled instructor talking to students during class.",
  "When the target language is 한국어, use 반말 강의체 by default: crisp endings such as ~야, ~해, ~거든, ~지, ~보자, and ~하면 돼. Make it sound like a sharp 일타 강사 explaining the point on a whiteboard.",
  "Make broken or awkward auto-caption wording feel like a clean instructional explanation.",
  "Prefer concise paraphrase over literal translation when it improves understanding. Preserve the speaker's intent, examples, and step-by-step logic.",
  "Keep technical terms, code, commands, product names, and UI labels accurate. Add brief clarifying wording only when it helps comprehension and is supported by context.",
  "Avoid celebrity catchphrases, excessive slang, forced humor, rude wording, or overdramatic hype. Keep each cue short enough to read comfortably as subtitles."
].join("\n");

const DEFAULT_CUSTOM_2_STYLE_SYSTEM_PROMPT = [
  "Style: Friendly beginner teacher.",
  "",
  "Translate like a patient and friendly teacher explaining the lesson to a beginner.",
  "",
  "Use clear, simple, and natural language in the target language specified by the system prompt. Prefer easy paraphrasing over literal translation when it improves understanding, but preserve the speaker’s meaning, examples, and step-by-step logic.",
  "",
  "When the target language is 한국어, use 친근한 존댓말 강의체 by default. Prefer natural endings such as ~예요, ~하면 돼요, ~라고 보면 돼요, ~부터 살펴볼게요, and ~가 핵심이에요.",
  "",
  "Clean up broken or awkward auto-caption wording so it sounds like a smooth lesson. Keep technical terms, code, commands, product names, numbers, versions, and UI labels accurate.",
  "",
  "Briefly clarify difficult terms only when the meaning is supported by context. Do not add external facts, invented examples, or unnecessary explanations.",
  "",
  "Avoid stiff wording, childish expressions, excessive praise, slang, memes, forced humor, sarcasm, or dramatic hype.",
  "",
  "For warnings and high-risk information, prioritize accuracy and seriousness over friendliness.",
  "",
  "Keep each subtitle cue short, easy to read, and consistent in tone."
].join("\n");

function normalizeTargetLanguageForPrompt(targetLanguage) {
  return String(targetLanguage || "ko").trim() || "ko";
}

export function buildStyleSystemPrompt(styleId = "lecture") {
  const normalizedStyleId = STYLE_SYSTEM_PROMPT_LINES[styleId] ? styleId : "lecture";
  return STYLE_SYSTEM_PROMPT_LINES[normalizedStyleId].join("\n");
}

export function buildDefaultCustomStyleSystemPrompt() {
  return DEFAULT_CUSTOM_STYLE_SYSTEM_PROMPT;
}

export function buildDefaultCustom2StyleSystemPrompt() {
  return DEFAULT_CUSTOM_2_STYLE_SYSTEM_PROMPT;
}

export function isCustomTranslationStyle(styleId) {
  return styleId === "custom" || styleId === "custom2";
}

export function getCustomSystemPromptSettingKey(styleId) {
  return styleId === "custom2" ? "custom2SystemPrompt" : "customSystemPrompt";
}

export function extractStyleSystemPrompt(systemPrompt) {
  const text = String(systemPrompt || "").trim();
  const styleIndex = text.search(/(^|\n)Style:/);
  const styleText = (styleIndex >= 0 ? text.slice(styleIndex).trim() : text)
    // Keep the saved Custom 1/2 prompt text in sync with the simplified header.
    .replace(/^Style: Custom - /, "Style: ");
  return styleText
    .split("\n")
    .filter((line) => !/^Target language:/i.test(line.trim()))
    .join("\n")
    .trim();
}

export function buildPresetSystemPrompt(styleId = "lecture", targetLanguage = "ko") {
  return [
    ...COMMON_SYSTEM_PROMPT_LINES,
    buildStyleSystemPrompt(styleId),
    `Target language: ${normalizeTargetLanguageForPrompt(targetLanguage)}.`
  ].join("\n");
}

export function buildSystemPromptFromSettings(settings = {}) {
  if (isCustomTranslationStyle(settings.translationStyle)) {
    const promptSettingKey = getCustomSystemPromptSettingKey(settings.translationStyle);
    const defaultCustomSystemPrompt = settings.translationStyle === "custom2"
      ? buildDefaultCustom2StyleSystemPrompt()
      : buildDefaultCustomStyleSystemPrompt();
    const customSystemPrompt = extractStyleSystemPrompt(settings[promptSettingKey] || defaultCustomSystemPrompt);
    if (customSystemPrompt) {
      return [
        ...COMMON_SYSTEM_PROMPT_LINES,
        customSystemPrompt,
        `Target language: ${normalizeTargetLanguageForPrompt(settings.targetLanguage)}.`
      ].join("\n");
    }
  }

  return buildPresetSystemPrompt(settings.translationStyle || "lecture", settings.targetLanguage);
}

export const DEFAULT_SETTINGS = {
  activeProvider: "googleTranslate",
  targetLanguage: "",
  translationStyle: "custom",
  customSystemPrompt: DEFAULT_CUSTOM_STYLE_SYSTEM_PROMPT,
  custom2SystemPrompt: DEFAULT_CUSTOM_2_STYLE_SYSTEM_PROMPT,
  maxChunkDurationSeconds: 420,
  cacheTranslations: true,
  fallback: {
    providerId: "googleTranslate"
  },
  providerTestStatus: {},
  platforms: {
    udemy: true,
    youtube: true,
    nvidia: true,
    vimeo: true
  },
  subtitleStyle: {
    positionX: 50,
    positionY: 78,
    fontSize: 30,
    fontPreset: "gowun-batang",
    fontFamily: "'GounBatang', serif",
    webFontCss: WEB_FONT_PRESETS.find((preset) => preset.id === "gowun-batang").css,
    customWebFontCss: DEFAULT_CUSTOM_WEB_FONT_CSS,
    width: 720,
    textColor: "#f2f2f2",
    shadowEnabled: true,
    shadowColor: "#000000",
    shadowBlur: 3,
    shadowDistance: 2,
    outlineEnabled: true,
    outlineColor: "#000000",
    outlineWidth: 2,
    backgroundColor: "#000000",
    pendingBackgroundColor: "#750000",
    backgroundOpacity: 0.5
  },
  providers: PROVIDERS
};

export const TRANSLATION_STYLES = [
  {
    id: "natural",
    label: "Natural",
    description: "문맥을 살려 자연스럽게 번역"
  },
  {
    id: "lecture",
    label: "Lecture",
    description: "강의/튜토리얼에 맞는 설명형 번역"
  },
  {
    id: "technical",
    label: "Technical",
    description: "전문 용어를 안정적으로 유지"
  },
  {
    id: "custom",
    label: "Custom 1",
    description: "사용자 번역 스타일 1"
  },
  {
    id: "custom2",
    label: "Custom 2",
    description: "사용자 번역 스타일 2"
  }
];

export const TARGET_LANGUAGES = [
  { code: "ko", nativeLabel: "한국어", labels: { ko: "한국어", en: "Korean" } },
  { code: "en", nativeLabel: "English", labels: { ko: "영어", en: "English" } },
  { code: "ja", nativeLabel: "日本語", labels: { ko: "일본어", en: "Japanese" } },
  { code: "zh-CN", nativeLabel: "简体中文", labels: { ko: "중국어 간체", en: "Chinese Simplified" } },
  { code: "zh-TW", nativeLabel: "繁體中文", labels: { ko: "중국어 번체", en: "Chinese Traditional" } },
  { code: "es", nativeLabel: "Español", labels: { ko: "스페인어", en: "Spanish" } },
  { code: "fr", nativeLabel: "Français", labels: { ko: "프랑스어", en: "French" } },
  { code: "de", nativeLabel: "Deutsch", labels: { ko: "독일어", en: "German" } },
  { code: "it", nativeLabel: "Italiano", labels: { ko: "이탈리아어", en: "Italian" } },
  { code: "pt", nativeLabel: "Português", labels: { ko: "포르투갈어", en: "Portuguese" } },
  { code: "pt-BR", nativeLabel: "Português (Brasil)", labels: { ko: "포르투갈어 브라질", en: "Portuguese Brazil" } },
  { code: "ru", nativeLabel: "Русский", labels: { ko: "러시아어", en: "Russian" } },
  { code: "ar", nativeLabel: "العربية", labels: { ko: "아랍어", en: "Arabic" } },
  { code: "hi", nativeLabel: "हिन्दी", labels: { ko: "힌디어", en: "Hindi" } },
  { code: "id", nativeLabel: "Bahasa Indonesia", labels: { ko: "인도네시아어", en: "Indonesian" } },
  { code: "vi", nativeLabel: "Tiếng Việt", labels: { ko: "베트남어", en: "Vietnamese" } },
  { code: "th", nativeLabel: "ไทย", labels: { ko: "태국어", en: "Thai" } },
  { code: "tr", nativeLabel: "Türkçe", labels: { ko: "터키어", en: "Turkish" } },
  { code: "pl", nativeLabel: "Polski", labels: { ko: "폴란드어", en: "Polish" } },
  { code: "nl", nativeLabel: "Nederlands", labels: { ko: "네덜란드어", en: "Dutch" } },
  { code: "sv", nativeLabel: "Svenska", labels: { ko: "스웨덴어", en: "Swedish" } },
  { code: "uk", nativeLabel: "Українська", labels: { ko: "우크라이나어", en: "Ukrainian" } }
];
