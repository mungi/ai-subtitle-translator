# AI Subtitle Translator - Chrome Web Store Listing

## Store Listing Basics

- Product name: AI Subtitle Translator
- One-line positioning: A Chrome extension that translates Udemy and YouTube subtitles and displays them over the video.
- Short description: Read Udemy and YouTube subtitles more naturally with AI context-aware translation and fast temporary translation.

## Detailed Description

AI Subtitle Translator translates Udemy course subtitles and YouTube video captions into your target language, directly on top of the video.

Use Google Translate to check subtitles quickly, or choose an AI provider such as OpenAI, Anthropic, or Google AI for translations that consider the flow of the whole video. Source subtitles or fast temporary translations remain visible while the AI translation is being prepared.

Open the AST menu from the AST icon in the video controls to turn subtitles on or off. When another player control is selected, the AST menu closes automatically so it does not overlap the player menu. Move and resize the subtitle box directly on the video, then customize the language, translation provider, font, color, shadow, outline, and background in the Options page.

## Key Features

- Subtitle translation for Udemy courses and YouTube videos
- AI context-aware translations that follow the video flow
- Fast temporary translation with Google Translate
- On-video subtitles with movable, resizable placement
- Font, color, shadow, outline, and background customization
- Natural, Lecture, Technical, Custom 1, and Custom 2 translation styles
- Automatic recommended-model selection and online-provider connection validation after model loading
- Long-video subtitle translation and translation cache
- Password-encrypted settings backup and restore, including API keys
- Optional connection validation for restored API keys
- Source or fast translated subtitles remain available if AI translation fails

## Supported Sites And Providers

- Supported sites: Udemy course player and YouTube video pages
- Translation providers: Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, and Local LLM
- Turn AST on or off, choose a translation provider, or open settings from the in-player AST menu

Udemy requires captions for a course the user can access. YouTube requires captions, either manual or auto-generated, provided by the video.

## How To Use

1. Install the extension and set a target language and translation provider in the Options page.
2. For providers that require one, enter an API key created with that provider.
3. Open a Udemy course or YouTube video and click the subtitle translation icon in the video controls.
4. Adjust the subtitle style in the Options page as needed.

## Recommended First Setup

- Start free: [Create an API key in Google AI Studio](https://aistudio.google.com/api-keys), then select the Google AI provider and `gemini-3.1-flash-lite`. Gemini 3.1 Flash-Lite is designed for low latency and cost efficiency, making it a strong starting model for translation.
- Google AI Free Tier requests-per-day (RPD) limits reset at midnight Pacific time. Available free quota and limits can vary by account and model, so check AI Studio for your current allowance.
- Subtitle translation is usually a clear input-output task, so start with a small, fast model instead of the largest frontier model. Gemini 3.1 Flash-Lite, GPT-5.6 Luna, and Claude Haiku 4.5 are good starting points; use a larger model only when you need higher quality.
- Paid recommendation: Select `deepseek/deepseek-v4-flash` with the OpenRouter provider. It is designed for fast, cost-efficient processing and is our recommended value starting point for paid translation. Check OpenRouter for current pricing and limits.

## Privacy And Data Handling

- Subtitle text may be sent to the translation provider selected by the user.
- API keys, settings, and translation cache are stored only in the user's browser.
- API keys are stored as provider-specific ciphertext in browser storage and are not left as plaintext in settings data.
- The extension does not store API keys on its own server or an external database.
- API keys are sent directly to the selected provider only when needed for authentication.
