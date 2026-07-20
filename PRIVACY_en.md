# AST - AI Subtitle Translator Privacy Policy

[한국어](PRIVACY.md) · [English](PRIVACY_en.md) · [日本語](PRIVACY_ja.md)

Effective date: July 21, 2026

AST - AI Subtitle Translator is a Chrome extension that translates subtitles from Udemy, YouTube, TED, NVIDIA Academy, and Vimeo through a translation service selected by the user. The developer does not operate a separate backend server and does not collect user data for advertising, tracking, or analytics.

## Data handled

- Subtitle text and cue timing from Udemy, YouTube, TED, NVIDIA Academy, and Vimeo
- URLs, video IDs, course IDs, lecture IDs, and subtitle language information needed to identify the current video or lecture
- Translation provider API keys, endpoints, models, translation settings, and subtitle settings entered by the user
- Cached translation results and encrypted settings backup files created by the user

## Purpose

This data is used only to retrieve subtitles, request translations, display translated results, retain user settings, and provide settings backup and restore. It is not used for personalized advertising, user profiling, or data sales.

## Storage and retention

- Settings, translation cache entries, and API keys are stored in the user's browser through `chrome.storage.local`.
- API keys are stored as provider-specific AES-GCM ciphertext and are not left as plaintext in general settings. Because the decryption fragments are also present in the same browser profile, this does not independently protect keys if that browser profile storage is compromised and is not equivalent to an operating-system secure store or a user-master-password vault.
- Storage access is restricted to trusted extension contexts. Content scripts cannot directly access API keys or their decryption fragments.
- Settings backups are encrypted with AES-GCM using a password supplied by the user. The password is not stored.
- Users can clear the translation cache or reset all settings. Chrome removes extension-local storage when the extension is uninstalled. Downloaded `.astbackup` files must be deleted by the user.

## External transmission

- Subtitle text and translation settings may be sent to the user-selected Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, or Custom LLM endpoint.
- API keys are sent directly to the selected provider when authentication is required. They are not sent to a developer-operated server.
- Requests to retrieve subtitles from supported sites may include video or lecture identifiers and the user's login cookies. The extension does not separately store cookie values.
- When a default or custom web font is used, font requests may be sent to Google Fonts, jsDelivr, or a font host specified in user-provided CSS.
- Data handled by each external service is governed by that service's privacy policy and terms.

## Permissions

- `storage`: Stores settings, encrypted API keys, and translation cache entries locally.
- Host permissions: Retrieve subtitles from Udemy, YouTube, TED, NVIDIA Academy, and Vimeo, contact the selected translation provider, and connect to Custom LLM on `localhost` or `127.0.0.1`. A custom HTTPS Custom LLM domain is accessed only after the user approves it while fetching models or testing the connection.

## Google API Limited Use

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use), including the Limited Use requirements.

## Security

All remote provider requests use HTTPS. Custom LLM supports both a local LLM and a user-operated custom server. A local LLM running on the user's own computer may use an HTTP endpoint on `localhost` or `127.0.0.1`; a custom server requires HTTPS and the user's runtime approval for its domain. Base URLs for hosted providers are restricted to each provider's official HTTPS origin, and redirect responses are not followed automatically.

## Contact and changes

Use [GitHub Issues](https://github.com/mungi/ai-subtitle-translator/issues) for privacy questions and security reports. Material changes will be reflected in the effective date above and in the repository history.
