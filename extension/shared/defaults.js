export const DEEPL_ENDPOINTS = {
  free: "https://api-free.deepl.com/v2/translate",
  pro: "https://api.deepl.com/v2/translate"
};

// The DeepL plan picks the endpoint, so a stored Base URL cannot disagree with it.
export function getDeepLEndpoint(plan) {
  return plan === "pro" ? DEEPL_ENDPOINTS.pro : DEEPL_ENDPOINTS.free;
}

export const PROVIDERS = {
  googleTranslate: {
    id: "googleTranslate",
    label: "Google Translate",
    apiStyle: "google-translate",
    baseUrl: "https://translate.googleapis.com/translate_a/t"
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
    model: "gpt-6-luna",
    temperature: 0.2,
    maxTokens: 16384
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    apiStyle: "anthropic-messages",
    baseUrl: "https://api.anthropic.com",
    apiKey: "",
    model: "claude-haiku-5-5",
    anthropicVersion: "2023-06-01",
    temperature: 0.2,
    maxTokens: 16384
  },
  google: {
    id: "google",
    label: "Google AI",
    apiStyle: "google-generate-content",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    model: "gemini-3.1-flash-lite",
    temperature: 0.2,
    maxTokens: 16384
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    apiStyle: "openai-chat",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    model: "deepseek/deepseek-v4-flash:nitro",
    nitro: true,
    siteUrl: "",
    appTitle: "AST - AI Subtitle Translator",
    temperature: 0.2,
    maxTokens: 16384
  },
  nvidiaNim: {
    id: "nvidiaNim",
    label: "NVIDIA NIM",
    apiStyle: "openai-chat",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKey: "",
    model: "openai/gpt-oss-120b",
    temperature: 0.2,
    maxTokens: 16384
  },
  local: {
    id: "local",
    label: "Custom LLM 1",
    apiStyle: "openai-chat",
    baseUrl: "http://localhost:1234/v1",
    apiKey: "",
    model: "google/gemma-4-e4b",
    temperature: 0.2,
    maxTokens: 16384,
    reasoningEffort: "auto",
    jsonMode: "off",
    customHeaders: []
  },
  local2: {
    id: "local2",
    label: "Custom LLM 2",
    apiStyle: "openai-chat",
    baseUrl: "http://localhost:1234/v1",
    apiKey: "",
    model: "google/gemma-4-e4b",
    temperature: 0.2,
    maxTokens: 16384,
    reasoningEffort: "auto",
    jsonMode: "off",
    customHeaders: []
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
    src: url('__AST_GOWUN_BATANG_FONT_URL__') format('woff');
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
  "Subtitle alignment takes priority over stylistic rewriting. Each output id must translate only the source text belonging to that same input id. Never merge, summarize, renumber, or move meaning between cue ids, even when a sentence spans multiple cues.",
  "Use contextBefore and contextAfter only to understand incomplete sentences and terminology. Do not translate those context entries or copy their meaning into the requested cues. A cue may remain a sentence fragment; do not complete it with speech from a later cue.",
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
  "Use the target language's natural informal, direct lecture register: energetic, confident, and conversational like a skilled top instructor explaining a point on a whiteboard. Avoid formal textbook phrasing.",
  "Make broken or awkward auto-caption wording feel like a clean instructional explanation.",
  "Prefer concise paraphrase over literal translation when it improves understanding. Preserve the speaker's intent, examples, and step-by-step logic.",
  "Keep technical terms, code, commands, product names, and UI labels accurate. Add brief clarifying wording only when it helps comprehension and is supported by context.",
  "Avoid celebrity catchphrases, excessive slang, forced humor, rude wording, or overdramatic hype. Keep each cue short enough to read comfortably as subtitles."
].join("\n");

const KOREAN_STAR_INSTRUCTOR_STYLE_PROMPT = "When the target language is 한국어, use 반말 강의체 by default: crisp endings such as ~야, ~해, ~거든, ~지, ~보자, and ~하면 돼. Make it sound like a sharp 일타 강사 explaining the point on a whiteboard.";

const DEFAULT_CUSTOM_2_STYLE_SYSTEM_PROMPT = [
  "Style: Friendly beginner teacher.",
  "",
  "Translate like a patient and friendly teacher explaining the lesson to a beginner.",
  "",
  "Use clear, simple, and natural language in the target language specified by the system prompt. Prefer easy paraphrasing over literal translation when it improves understanding, but preserve the speaker’s meaning, examples, and step-by-step logic.",
  "",
  "Use the target language's natural warm, polite lecture register. Keep it respectful but conversational, like a patient teacher guiding beginners.",
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

export function buildDefaultCustomStyleSystemPrompt(targetLanguage) {
  if (String(targetLanguage || "").trim() === "ko") {
    return [DEFAULT_CUSTOM_STYLE_SYSTEM_PROMPT, KOREAN_STAR_INSTRUCTOR_STYLE_PROMPT].join("\n");
  }
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

export const CUSTOM_STYLE_LABEL_MAX_LENGTH = 24;

export function getCustomStyleLabelSettingKey(styleId) {
  return styleId === "custom2" ? "custom2StyleLabel" : "customStyleLabel";
}

// The label shown beside "Custom 1/2" in the player menu. Never saved is the default; saved empty means none.
export function normalizeCustomStyleLabel(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/\s+/g, " ").trim().slice(0, CUSTOM_STYLE_LABEL_MAX_LENGTH).trim();
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
    const targetLanguage = normalizeTargetLanguageForPrompt(settings.targetLanguage);
    const defaultCustomSystemPrompt = settings.translationStyle === "custom2"
      ? buildDefaultCustom2StyleSystemPrompt()
      : buildDefaultCustomStyleSystemPrompt(targetLanguage);
    const customSystemPrompt = extractStyleSystemPrompt(settings[promptSettingKey] || defaultCustomSystemPrompt);
    const resolvedCustomSystemPrompt = settings.translationStyle === "custom"
      && customSystemPrompt === buildDefaultCustomStyleSystemPrompt()
      ? buildDefaultCustomStyleSystemPrompt(targetLanguage)
      : customSystemPrompt;
    if (resolvedCustomSystemPrompt) {
      return [
        ...COMMON_SYSTEM_PROMPT_LINES,
        resolvedCustomSystemPrompt,
        `Target language: ${targetLanguage}.`
      ].join("\n");
    }
  }

  return buildPresetSystemPrompt(settings.translationStyle || "lecture", settings.targetLanguage);
}

export function normalizeLlmParallelRequests(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.min(8, Math.max(1, Math.trunc(count))) : 3;
}

// Editable in Settings. The output language and the long-video part/merge instructions are added in code.
export const DEFAULT_SUMMARY_SYSTEM_PROMPT = [
  "You write accurate, well-structured, reading-friendly summaries of video transcripts: lectures and other educational videos first, and also tutorials, technical talks, seminars, panel discussions, interviews, conferences, and meetings.",
  "The reader should understand the main messages, essential details, reasoning, and conclusions without watching the video, and be able to review what was taught from the summary.",
  "",
  "Principles:",
  "- Keep key information: important ideas, definitions, explanations, reasons, examples, evidence, numbers, names, warnings, procedures, decisions, and conclusions. Never drop essential information just to make the summary shorter.",
  "- Prioritize: find the central message of the whole video and the main point of each topic. Give more room to important explanations and findings than to repeated or incidental remarks.",
  "- Connect: explain not only what was said but how claims, reasons, examples, and conclusions relate to one another.",
  "- Stay faithful: use only what the transcript says. Do not add outside knowledge, opinions, evaluations, recommendations, or unsupported interpretations.",
  "- Keep the flow: follow the order in which topics are introduced, since a lecture builds each idea on earlier ones. Group closely related remarks when it helps, but do not rearrange content in a way that changes the discussion. When a topic comes back later, show how it developed.",
  "- Attribute views: when speakers differ, say who holds which position, and keep meaningful disagreements, counterarguments, and agreements.",
  "- Transcription errors: the transcript comes from speech recognition. Use context to read through errors, broken sentences, and awkward wording. Fix an obvious error only when the intended meaning is clear; never guess uncertain facts, names, or numbers.",
  "- Technical accuracy: keep code, commands, file names, product names, technical terms, numbers, and units exactly as given. Do not silently change or normalize them.",
  "- Remove noise: leave out greetings, filler, repetition, off-topic interruptions, and conversational transitions unless they help understanding.",
  "- Adapt: fit the structure and detail to the kind of video. Do not force every video into the same categories, and do not create sections for things the video does not contain.",
  "",
  "Depending on the kind of video, keep in particular (only when relevant):",
  "- Lectures and educational videos: concepts, definitions, explanations, and the examples used to illustrate them.",
  "- Tutorials and procedures: the complete sequence of steps, commands, conditions, and cautions.",
  "- Technical talks: how systems and mechanisms work, performance data, constraints, and demonstrated results.",
  "- Panel discussions and interviews: each speaker's position and arguments, agreements, disagreements, and open questions.",
  "- Meetings: decisions, action items, owners, deadlines, and open issues that are stated explicitly.",
  "- Research talks: research questions, methods, results, limitations, and conclusions.",
  "- Outlooks: established facts, current developments, stated goals, and predictions, kept apart.",
  "",
  "Structure (Markdown; write every heading in the output language):",
  "1. First line: `# ` followed by a concise title that names the main topic.",
  "2. An overview of 2-3 sentences: what the video is about, its central message or most important findings, and its conclusion if it gives one. Then 3-5 `-` bullets with the points most worth remembering.",
  "3. One `## ` section per topic, in the order of the video. Open with the topic's main point, then explain the essential concepts, arguments, or information with the supporting examples, data, or comparisons, any limitations, disagreements, or uncertainties, and the conclusion reached. Write natural short paragraphs, not these elements as labels. Use `### ` only when a topic has clearly separate subtopics.",
  "",
  "Formatting:",
  "- Bold important concepts, findings, and conclusions.",
  "- Use a numbered list (1. 2. 3.) for procedures, steps, and sequences, and `-` bullets for parallel items such as features, options, and cautions. Prefer connected prose when it explains reasoning better than bullets.",
  "- Use a table only when it clearly helps a comparison or structured data.",
  "- Write clearly and precisely, easy to follow without oversimplifying important details.",
  "",
  "Length: fit the density and complexity of the video; completeness and clarity come before any word count. Do not pad a video with little content. Do not reproduce the transcript or rewrite it sentence by sentence.",
  "",
  "Before answering, check that the central message is clear at once; every major topic and important conclusion is included; key facts, names, examples, technical details, and numbers are kept; claims stay linked to their reasons and evidence; different speakers' views are not merged; important disagreements, limitations, and uncertainties remain visible; the order and meaning of the video are kept; nothing from outside the transcript and no opinion of your own was added; and the summary can be understood without the video.",
  "Output only the summary. No preamble, no comments about the summarizing, no closing remarks."
].join("\n");

// Earlier built-in defaults. Settings saved with one of them follow the current default.
const PREVIOUS_DEFAULT_SUMMARY_SYSTEM_PROMPTS = [
  [
    "You write reading-friendly summaries of video transcripts.",
    "Source text is a video transcript (subtitles). It may contain speech-recognition errors; read through them using context.",
    "Keep every key point: main ideas, definitions, reasons, examples, numbers, names, warnings, steps, and conclusions. Do not drop important content to make the text shorter.",
    "Use only what the transcript says. Do not add opinions, evaluations, advice, background knowledge, or comments about the video or the speaker.",
    "Keep code, commands, file names, product names, and numbers exactly as given.",
    "Follow the order in which the video presents the content.",
    "Format as Markdown:",
    "- First line: `# ` followed by a short title that names the topic.",
    "- Then a 2-3 sentence overview of the whole video.",
    "- Then one `## ` section per topic, in order. Inside a section, write short paragraphs.",
    "- When the content is a procedure or sequence, use a numbered list (1. 2. 3.). Use `-` bullets for parallel items such as options, features, or cautions. Use `###` only when a section has clearly separate sub-parts.",
    "Output only the summary. No preamble, no closing remarks."
  ].join("\n")
];

export function normalizeSummarySystemPrompt(value) {
  const prompt = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!prompt || PREVIOUS_DEFAULT_SUMMARY_SYSTEM_PROMPTS.includes(prompt)) return DEFAULT_SUMMARY_SYSTEM_PROMPT;
  return prompt;
}

// The "Brief" summary style: slide-ready bullet points. The output language is added in code.
export const BRIEF_SUMMARY_SYSTEM_PROMPT = [
  "You extract the key insights from video transcripts of lectures, seminars, presentations, panel discussions, meetings, and technical talks.",
  "Summarize the transcript as concise, structured, slide-ready bullet points.",
  "The transcript comes from speech recognition. Read through recognition errors using context, and never guess uncertain names or numbers.",
  "",
  "Principles:",
  "- Key insights first: find the central message and the most important findings.",
  "- Concise writing: short, direct phrases in note style rather than full sentences.",
  "- Structured hierarchy: organize the content into clear topics, subtopics, and supporting points.",
  "- High information density: remove filler, repetition, conversational expressions, and unnecessary explanation.",
  "- Preserve essentials: keep critical facts, technical concepts, arguments, examples, numbers, and conclusions.",
  "- Logical relationships: state causes, effects, comparisons, limitations, and implications clearly.",
  "- Objective accuracy: use only what the transcript says. Do not add outside information, personal opinions, or unsupported interpretations.",
  "- Different viewpoints: keep significant disagreements and contrasting positions when there are any.",
  "- Flexible structure: fit the number of sections and bullets to the content instead of forcing a fixed template.",
  "",
  "Output format (Markdown; write every heading in the output language):",
  "1. `## ` Key messages: the 1-2 conclusions that run through the whole content, one line each.",
  "2. `## ` Main content: 3-6 sections by topic, each a `### ` heading with the topic name. In each, a `-` bullet for the key point or claim, nested `-` bullets under it for the main evidence, numbers, or examples and for technical features, differences, or limitations, and a `-` bullet for the important result or change.",
  "3. `## ` Key issues and outlook, only when the transcript covers them: the main debates and opposing views, open problems and technical limits, and the future direction and outlook.",
  "4. `## ` Final takeaways: the 3 things to remember, one line each, condensing the core of the whole discussion rather than repeating earlier bullets.",
  "",
  "Writing rules:",
  "- Write every bullet as a short note-style phrase. Prefer noun phrases to full sentences: \"Growing importance of hybrid computing\" rather than \"The importance of hybrid computing is growing\" (in Korean, 개조식 such as \"하이브리드 컴퓨팅 중요성 확대\").",
  "- One key message per bullet.",
  "- Aim for about 15-40 characters per bullet in Korean, Japanese, or Chinese (about 4-12 words in other languages), and about 3-5 bullets per section.",
  "- Keep technical terms, product names, names, numbers, and units exactly as given.",
  "- Bold only the most important keywords.",
  "- Use `→`, `vs.`, or `+` to show relationships briefly when it helps.",
  "- Leave out long paragraphs, repeated explanations, and needless modifiers, but do not shorten so much that the source's logic or core meaning is lost.",
  "- Do not create conclusions or outlooks that are not in the source.",
  "- Prefer nested bullets to tables.",
  "",
  "Goal: high-density, logically structured, presentation-ready summaries that show the most important messages at a glance.",
  "Output only the structured summary. No preamble, no closing remarks."
].join("\n");

// Summary styles offered in Settings and in the player's download menu. "Detailed" uses the default
// prompt above; "Custom" uses the prompt edited in Settings (which starts as that default).
export const SUMMARY_STYLES = [
  { id: "brief", messageKey: "summaryStyleBrief" },
  { id: "detailed", messageKey: "summaryStyleDetailed" },
  { id: "custom", messageKey: "summaryStyleCustom" }
];

export function normalizeSummaryStyle(value, fallback = "detailed") {
  return SUMMARY_STYLES.some((style) => style.id === value) ? value : fallback;
}

export function getSummaryStyleSystemPrompt(settings = {}, style = settings.summaryStyle) {
  switch (normalizeSummaryStyle(style)) {
    case "brief":
      return BRIEF_SUMMARY_SYSTEM_PROMPT;
    case "custom":
      return normalizeSummarySystemPrompt(settings.summarySystemPrompt);
    default:
      return DEFAULT_SUMMARY_SYSTEM_PROMPT;
  }
}

export const DEFAULT_SETTINGS = {
  settingsMode: "simple",
  llmParallelRequests: 3,
  subtitleDisplayMode: "dual",
  activeProvider: "googleTranslate",
  targetLanguage: "",
  translationStyle: "custom",
  preferYoutubeProvidedTranslation: true,
  phraseSegmentation: true,
  sourceCaptionLanguages: {},
  phraseSegmentationSkipYoutubeManual: true,
  wordProgressHighlight: true,
  customSystemPrompt: DEFAULT_CUSTOM_STYLE_SYSTEM_PROMPT,
  custom2SystemPrompt: DEFAULT_CUSTOM_2_STYLE_SYSTEM_PROMPT,
  summaryStyle: "detailed",
  summarySystemPrompt: DEFAULT_SUMMARY_SYSTEM_PROMPT,
  customStyleLabel: "Star Instructor",
  custom2StyleLabel: "Friendly Teacher",
  maxChunkDurationSeconds: 420,
  cacheTranslations: true,
  fallback: {
    providerId: "googleTranslate"
  },
  providerTestStatus: {},
  platforms: {
    udemy: true,
    youtube: true,
    ted: true,
    nvidia: true,
    vimeo: true,
    coursera: true,
    linkedin: true,
    oreilly: true,
    nvidiaOnDemand: true,
    deeplearningai: true,
    edx: true,
    // Technical preview: HTML5 videos on other sites, only on sites added from the popup.
    generic: true
  },
  // Sites the user added to the generic player from the toolbar popup.
  genericAllowedHosts: [],
  subtitleStyle: {
    positionX: 50,
    positionY: 78,
    fontSize: 30,
    fontPreset: "gowun-batang",
    fontFamily: "'GounBatang', serif",
    webFontCss: WEB_FONT_PRESETS.find((preset) => preset.id === "gowun-batang").css,
    customWebFontCss: DEFAULT_CUSTOM_WEB_FONT_CSS,
    width: 1024,
    textColor: "#e2ffad",
    sourceFontSize: 28,
    sourceTextColor: "#f2f2f2",
    // The original line defaults to Arial at regular weight in every language; the translation font
    // varies by language and stays bold (700), as subtitles looked before the weight setting.
    fontWeight: 700,
    sourceFontWeight: 400,
    sourceFontPreset: "system-arial",
    sourceFontFamily: "Arial, sans-serif",
    sourceWebFontCss: "",
    translationOnTop: false,
    shadowEnabled: true,
    shadowColor: "#000000",
    shadowBlur: 3,
    shadowDistance: 2,
    outlineEnabled: true,
    outlineColor: "#000000",
    outlineWidth: 2,
    backgroundColor: "#000000",
    pendingBackgroundColor: "#750000",
    backgroundOpacity: 0.8
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
  { code: "fa", nativeLabel: "فارسی", labels: { ko: "페르시아어", en: "Persian" } },
  { code: "he", nativeLabel: "עברית", labels: { ko: "히브리어", en: "Hebrew" } },
  { code: "hi", nativeLabel: "हिन्दी", labels: { ko: "힌디어", en: "Hindi" } },
  { code: "id", nativeLabel: "Bahasa Indonesia", labels: { ko: "인도네시아어", en: "Indonesian" } },
  { code: "vi", nativeLabel: "Tiếng Việt", labels: { ko: "베트남어", en: "Vietnamese" } },
  { code: "th", nativeLabel: "ไทย", labels: { ko: "태국어", en: "Thai" } },
  { code: "tr", nativeLabel: "Türkçe", labels: { ko: "튀르키예어", en: "Turkish" } },
  { code: "pl", nativeLabel: "Polski", labels: { ko: "폴란드어", en: "Polish" } },
  { code: "nl", nativeLabel: "Nederlands", labels: { ko: "네덜란드어", en: "Dutch" } },
  { code: "sv", nativeLabel: "Svenska", labels: { ko: "스웨덴어", en: "Swedish" } },
  { code: "uk", nativeLabel: "Українська", labels: { ko: "우크라이나어", en: "Ukrainian" } }
];
