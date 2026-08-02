# AST - AI Subtitle Translator

Naturally translate subtitles from videos on the following websites into your preferred language using LLM-based AI.
  - Udemy: https://www.udemy.com/
  - NVIDIA Academy: https://www.nvidia.com/en-us/training/academy/
  - YouTube: https://www.youtube.com/
  - Vimeo: https://vimeo.com/
  - TED: https://www.ted.com/

# Key Highlights
  - Translate subtitles quickly with Google Translate, or connect an LLM for natural translations that consider context.
  - Use prompts to specify a translation style.
  - Customize the subtitle display style directly.
  - Supports a range of LLM providers.
    - Google Gemini, OpenAI GPT, Anthropic Claude, DeepL, NVIDIA NIM, OpenRouter, and Custom LLM

# Notes
  - Providers other than Google Translate require an API key.
  - Create a Google AI API key and connect the free-tier Gemini 3.1 Flash Lite model to start AI translation with fast responses. (Recommended)
  - Check each LLM API provider's policy for free allowances, limits, and any applicable charges.

# Main Features
  - Subtitle translation for Udemy, NVIDIA Academy, YouTube, TED, and Vimeo videos
  - Context-aware AI translation that considers the flow of the source subtitles
  - Fast translation with Google Translate included by default
  - Fast translation is displayed first while LLM translation is being prepared
  - Choose a source subtitle language provided by the video (default: English)
  - Subtitle display, position adjustment, and width adjustment
  - Customize subtitle font, color, shadow, outline, background color, and opacity
  - Translation styles: Natural, Lecture, Technical, Custom 1 (Star Instructor), and Custom 2
  - Chunked and parallel translation for long-video subtitles, plus a translation cache
  - Password-encrypted backup and restore for settings, including API keys
  - If AI translation fails, source subtitles remain visible and Google Translate is used as a fallback when available

# How To Use
  - Google Translate is available by default after installation.
  - Click the `AST` icon in the video toolbar, then turn on the `AI Subtitle Translation` toggle.

  ## Simple Settings — Recommended
  1. Install the extension, then click the `Get API key` link at the bottom of Simple Settings to create a Google AI API key.
  2. Enter the free API key in the `Google AI API key` field in Settings, then click `Check API key`.

  ## Advanced Settings
  - To use a provider that requires an API key, enter the key issued by that provider, then click `Test connection`.
  - Adjust the translation style and subtitle display style as needed.
  - Back up all settings, including API keys. Backup files are encrypted with AES-256-GCM, and the password used during backup is required to restore them.
  - If you have a DeepL API key, you can use DeepL for fast translation.

# LLM Selection Guide For First-Time Users
  - Start for free: [Create an API key in Google AI Studio](https://aistudio.google.com/api-keys), then select the Google AI provider and the `gemini-3.1-flash-lite` model. Gemini 3.1 Flash Lite is designed for fast responses and cost efficiency, making it a good starting model for translation.
  - Google AI Free Tier daily request limits (RPD) typically reset at 4 PM Korea Standard Time during U.S. Pacific Daylight Time and at 5 PM during standard time. Available free quota and limits may vary by account and model, so check AI Studio.
  - Recommended models for paid use: Subtitle translation is a relatively clear input-output task, so start with a smaller, faster model instead of the largest frontier model. Gemini 3.1 Flash Lite, GPT-5.6 Luna, and Claude Haiku 4.5 are good starting points; use a larger model only when you need higher quality.
  - Value model for paid use: With the OpenRouter provider, `deepseek/deepseek-v4-flash` is a good cost-effective starting point for paid translation because of its fast processing and efficiency. Select `Use Nitro` to prioritize faster providers. Check OpenRouter for current pricing and limits.

# Major Changes
  [ v0.1.3 (2026-08-03) ]
  - Added support for ted.com.
  - Improved API key visibility controls, fallback translation notices, and the stability of subtitle and provider-menu behavior.

  [ v0.1.2 (2026-07-19) ]
  - Added Simple Settings mode.

# Project Information
  - License: MIT License
  - Source: https://github.com/mungi/ai-subtitle-translator
  - Site: https://mungi.github.io/ai-subtitle-translator/
  - Issue reports and feature requests: https://github.com/mungi/ai-subtitle-translator/issues

# Privacy And Data Handling
- Privacy policy: https://mungi.github.io/ai-subtitle-translator/privacy-en.html
- Subtitle text may be sent to the translation provider selected by the user.
- API keys, settings, and the translation cache are stored only in the user's browser.
- API keys are stored as provider-specific ciphertext in browser storage and are not left as plaintext in settings data.
- Storage access is restricted to trusted extension contexts, and API keys are not exposed to content scripts.
- The extension does not store API keys on its own server or in an external database.
- API keys are sent directly to the selected provider when needed for authentication.
- Hosted providers are limited to their official HTTPS origins. Custom LLM can use HTTP or HTTPS on `localhost` or `127.0.0.1`, plus a user-selected custom HTTPS origin after the user approves access while fetching models or testing the connection; redirect responses are not followed automatically.
