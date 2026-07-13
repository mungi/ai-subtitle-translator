# AI Subtitle Translator Privacy Policy

[한국어](PRIVACY.md) · [English](PRIVACY_en.md) · [日本語](PRIVACY_ja.md)

Effective date: July 13, 2026

AI Subtitle Translator is a Chrome extension that translates subtitles from Udemy and YouTube through a translation service selected by the user. The developer does not operate a separate backend server and does not collect user data for advertising, tracking, or analytics.

## Data handled

- Subtitle text and cue timing from Udemy and YouTube
- URLs, video IDs, course IDs, lecture IDs, and subtitle language information needed to identify the current video or lecture
- Translation provider API keys, endpoints, models, translation settings, and subtitle settings entered by the user
- Cached translation results and encrypted settings backup files created by the user

## Purpose

This data is used only to retrieve subtitles, request translations, display translated results, retain user settings, and provide settings backup and restore. It is not used for personalized advertising, user profiling, or data sales.

## Storage and retention

- Settings, translation cache entries, and API keys are stored in the user's browser through `chrome.storage.local`.
- API keys are stored as provider-specific AES-GCM ciphertext and are not left as plaintext in general settings. Because the decryption fragments are also present in the same browser profile, this is not equivalent to an operating-system secure store or a user-master-password vault.
- Storage access is restricted to trusted extension contexts. Content scripts cannot directly access API keys or their decryption fragments.
- Settings backups are encrypted with AES-GCM using a password supplied by the user. The password is not stored.
- Users can clear the translation cache or reset all settings. Chrome removes extension-local storage when the extension is uninstalled. Downloaded `.astbackup` files must be deleted by the user.

## External transmission

- Subtitle text and translation settings may be sent to the user-selected Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, or Local LLM endpoint.
- API keys are sent directly to the selected provider when authentication is required. They are not sent to a developer-operated server.
- Requests to retrieve Udemy and YouTube subtitles may include video or lecture identifiers and the user's login cookies. The extension does not separately store cookie values.
- When a default or custom web font is used, font requests may be sent to Google Fonts, jsDelivr, or a font host specified in user-provided CSS.
- Data handled by each external service is governed by that service's privacy policy and terms.

## Permissions

- `storage`: Stores settings, encrypted API keys, and translation cache entries locally.
- Host permissions: Retrieve Udemy and YouTube subtitles, contact the selected translation provider, and connect to a user-configured Local LLM.

## Google API Limited Use

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use), including the Limited Use requirements.

## Security

All remote provider requests use HTTPS. As an explicit exception, a Local LLM running on the user's own computer may use an HTTP endpoint on `localhost` or `127.0.0.1`. Base URLs for hosted providers are restricted to each provider's official HTTPS origin, and redirect responses are not followed automatically.

## Contact and changes

Use [GitHub Issues](https://github.com/mungi/llm-subtitle-translator/issues) for privacy questions and security reports. Material changes will be reflected in the effective date above and in the repository history.
