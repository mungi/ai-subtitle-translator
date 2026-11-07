# AST - AI Subtitle Translator

Naturally translate subtitles of educational content (online courses, lectures, and tutorial videos) on major online learning and video sites such as Udemy and YouTube into your preferred language using LLM-based AI. Learning without a language barrier also makes video content more accessible.
See the introduction website for the full list of supported sites: https://mungi.github.io/ai-subtitle-translator/

# Key Highlights
  - Bring your own API key. Enter your own key from providers such as OpenAI, Anthropic, or Google AI, or connect any OpenAI-compatible server or local LLM (such as Ollama or LM Studio) through Custom LLM and translate with the model you choose.
  - Translate subtitles quickly with Google Translate, or connect an LLM for natural translations that consider context.
  - Watch with dual subtitles: the original and the translation shown together, so you can follow educational content in your own language while picking up the original expressions.
  - Generic video player (technical preview): add a site that is not on the supported list to the generic player list from the toolbar popup, and translate the subtitles of standard HTML5 videos that have caption tracks.
  - Use prompts to specify a translation style.
  - Customize the subtitle display style directly.
  - Supports multiple LLM providers, including commercial AI APIs, OpenAI-compatible APIs, and local servers. Choose providers, models, and API keys in Settings; see the Chrome Web Store settings screenshot for the full list of supported providers.

# Notes
  - Some translation providers require an API key. The API key for Custom LLM is optional.
  - Create a Google AI API key and connect the free-tier Gemini 3.1 Flash Lite model to get fast AI translations. (Recommended)
  - The free Google AI API may return errors during busy hours. For steadier translation, a paid API such as OpenAI gpt-6-luna or Anthropic claude-haiku-5-5 is recommended (about $0.2–$0.5 per 10,000 sentences).
  - Check each LLM API provider's policy for free allowances, limits, and any applicable charges.

# Main Features
  - AI subtitle translation for videos on the major supported sites
  - Context-aware AI translation that considers the flow of the source subtitles
  - Fast translation with Google Translate included by default
  - Fast translation is displayed first while LLM translation is being prepared
  - Choose a source subtitle language provided by the video (default: English)
  - Subtitle display, position adjustment, and width adjustment
  - Choose dual, source, or translated subtitles (default: dual subtitles)
  - Use YouTube's own subtitles in your language, or YouTube's auto-translation, when available (optional)
  - Separate fonts for the original and translated lines, and a choice of translation position (top or bottom)
  - Regroup auto-generated subtitles into phrases for easier reading
  - Translation status and progress shown in the player menu
  - Customize subtitle font, color, shadow, outline, background color, and opacity
  - Translation styles: Natural, Lecture, Technical, Custom 1 (Star Instructor), and Custom 2
  - Chunked and parallel translation of subtitles for long videos, plus a translation cache
  - Password-encrypted backup and restore for settings, including API keys
  - If AI translation fails, source subtitles remain visible and Google Translate is used as a fallback when available

# How to Use
  - Google Translate is available by default after installation.
  - Translation starts automatically on supported videos with captions. Use `AI Subtitle Translation` in the video toolbar's `AST` menu to turn it on or off.

  ## Simple Settings — Recommended
  1. Install the extension, then click the `Get API key` link at the bottom of Simple Settings to create a Google AI API key.
  2. Enter the free API key in the `Google AI API key` field in Settings, then click `Check API key`. After verification succeeds, the Google AI provider and the `gemini-3.1-flash-lite` model are configured automatically.

See the introduction website's [LLM selection guide](https://mungi.github.io/ai-subtitle-translator/#llm-selection-guide) for first-time model recommendations.

  ## Advanced Settings
  - To use a provider that requires an API key, enter the key issued by that provider, then click `Test connection`.
  - Adjust the translation style and subtitle display style as needed.
  - Back up all settings, including API keys. Backup files are encrypted with AES-256-GCM, and the password used during backup is required to restore them.
  - If you have a DeepL API key, you can use DeepL for fast translation (Free or Pro plan).

# Major Changes
  [ v0.2.2 (2026-11-08) ]
  - Added support for 6 more sites.
  - Added a generic video player (technical preview): add a site from the toolbar popup to translate subtitles of standard HTML5 videos.
  - Custom LLM now allows HTTP on private network addresses (RFC 1918) and .local names, and adds reasoning, JSON response, and extra header settings.
  - Added subtitle font size controls, cleaned up the popup and Settings, and made YouTube caption capture more stable.

  [ v0.2.1 (2026-11-07) ]
  - Added downloads for AI-translated subtitles and summaries.
  - Improved subtitle styles and the subtitle box.
  - Richer player menu: model names and a word highlight on/off switch (YouTube).
  - Shows when YouTube auto-translation is in use (default).
  - Temporary translation now always uses Google Translate.

  [ v0.2.0 (2026-11-01) ]
  ※ Site access now covers all sites. Chrome pauses the extension after this update until you approve the new permission on the extensions page. (See "Permissions" below.)
  - Dual subtitles are now the default, with separate fonts and a top/bottom position option.
  - UX fixes for video switching, Shorts, long videos, and retranslation; fewer pop-ups.
  - Prefer YouTube's own subtitles or auto-translation when available.
  - Phrase-based regrouping of auto-generated subtitles.
  - Translation status and progress in the player menu.
  - More reliable AI translation and new default models (gpt-6-luna, claude-haiku-5-5).

  [ v0.1.4 (2026-10-28) ]
  - Improved YouTube caption retrieval and synchronization, added source word progress highlighting, and hid AST subtitles during ads.
  - Added dual, source, and translated subtitle modes, plus right-to-left support for Persian and Arabic.
  - Improved video retranslation, retries after translation errors, and cancellation of previous requests when switching models.
  - Improved font loading and Korean, English, and Japanese interface text and guidance.

  ※ For the change history of earlier versions, see GitHub Releases: https://github.com/mungi/ai-subtitle-translator/releases

# Project Information
  - License: MIT License
  - Source: https://github.com/mungi/ai-subtitle-translator
  - Site: https://mungi.github.io/ai-subtitle-translator/
  - Issue reports and feature requests: https://github.com/mungi/ai-subtitle-translator/issues

# Permissions
  - Site access (all sites)
    - Since v0.2.0, the list of individual sites the extension could access (24 entries) is replaced by a single "all sites" permission.
    - Why it is needed
      - We plan to keep adding supported video sites. Granting access once avoids a new permission request, and a fresh approval, every time a site is added.
      - Custom LLM: an OpenAI-compatible server you run or choose can live at any address. Previously, every change of address needed its own permission request.
      - Subtitle servers of video sites and the endpoints of the translation providers you choose work right away.
      - Chrome's site access list showed a long list of addresses that was hard to read.
      - Generic video player (Technical Preview): the extension registers a small video detection script only on sites the user adds to the generic player list from the toolbar popup, and injects the subtitle script only into frames with a captioned video to translate that video's captions. Because the user chooses the sites, they cannot be listed as permissions in advance.
    - What it is actually used for
      - The subtitle script runs only on supported video sites. It does not read or change other websites.
      - Network requests go only to supported sites for subtitles and to the translation provider you select. Request targets are checked again in code.
  - storage: stores settings, encrypted API keys, and the translation cache in your browser.
  - scripting: runs the script that fetches subtitles on supported video sites.

# Privacy and Data Handling
- Privacy policy: https://mungi.github.io/ai-subtitle-translator/privacy-en.html
- Subtitle text may be sent to the translation provider selected by the user.
- API keys, settings, and the translation cache are stored only in the user's browser.
- API keys are stored as provider-specific ciphertext in browser storage and are not left as plaintext in settings data.
- Storage access is restricted to trusted extension contexts, and API keys are not exposed to content scripts.
- The extension does not store API keys on its own server or in an external database.
- API keys are sent directly to the selected provider when needed for authentication.
- Hosted providers are limited to their official HTTPS origins. Custom LLM can use HTTP or HTTPS on `localhost`, `127.0.0.1`, private network addresses (RFC 1918), or `.local` names, plus a custom HTTPS origin the user enters; redirect responses are not followed automatically.
- Host access is requested once for all sites, but the subtitle script is injected only into supported video sites, and network requests go only to those sites for subtitles and to the translation provider the user selects.
