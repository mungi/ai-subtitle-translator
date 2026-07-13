# AI Subtitle Translator

[한국어](README.md) · [English](README_en.md) · [日本語](README_ja.md)

A Chrome Manifest V3 extension that collects subtitles from Udemy and YouTube, translates them with Google Translate or an LLM provider, and displays them over the video.

Chrome 102 or later is required.

## Key features

- Collects Udemy lecture subtitle tracks and parses WebVTT cues.
- Collects YouTube caption tracks and parses XML, JSON3, SRV3, WebVTT, and transcript-panel cues.
- Provides temporary, cue-level translation with Google Translate.
- Supports OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, Local LLM, and DeepL providers.
- Fetches models for OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA NIM, and Local LLM.
- Selects a recommended lightweight multilingual model after model discovery and tests the connection.
- Translates complete subtitle JSON documents with LLMs.
- Includes Natural, Lecture, Technical, Custom 1, and Custom 2 translation styles with style-specific system prompts.
- Supports chunked translation and a translation cache for long videos.

For LLM translation, the first minute at the current playback position is processed first. The remaining later portion is then processed in chunks of up to seven minutes by default, followed by the earlier portion. The maximum chunk duration is configurable from 2 to 15 minutes. A 24,000-character and 500-cue safety limit also applies. Incomplete responses retry only the affected chunk after splitting it in half.

- Falls back to Google Translate if an LLM request fails.
- Lets users choose an available provider, including Google Translate and DeepL, as the final translation provider.
- The AST icon in the player toolbar toggles subtitles, changes providers, and opens settings.
- Automatically closes the AST menu when another player toolbar icon is selected to avoid overlapping player menus.
- Prioritizes translation from the current playback position when the provider changes, and shows a progress animation only for selected non-Google providers.

## AST toolbar icon states

- White: AST is off or original subtitles are shown.
- Blue: AST is active and is preparing or displaying translated subtitles.
- Yellow: A temporary translation is displayed while waiting for the final LLM translation.
- Green: The final translation for the currently playing cue is ready.
- Purple: The final translation for the whole subtitle document is complete.
- Pink: A Google Translate fallback is in use, such as after a selected provider quota is exceeded.
- A subtle blink means a subtitle or translation request is being prepared.
- Drag the subtitle overlay to reposition it.
- Resize the subtitle window manually from its corner; its width is saved.
- Configure subtitle fonts, web fonts, colors, shadows, outlines, and backgrounds.
- Encrypt API keys with AES-GCM and display saved values masked.
- Prevent direct content-script storage access and expose only a secret-free settings bridge.
- Restrict hosted providers to official HTTPS origins and Local LLM endpoints to loopback hosts.
- Back up and restore settings with a user-password-encrypted file.
- Localize the settings UI and default target language based on browser language.

## Load the extension

1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose this repository's `extension/` folder.
5. Configure a provider and target language in the extension options.

## Documentation

- [Design.md](Design.md): Current design decisions and key runtime flows. (Korean)
- [CONTEXT.md](CONTEXT.md): Implementation overview and current repository context. (Korean)
- [TASKS.md](TASKS.md): Completed items, verified items, and manual QA checklist. (Korean)
- [docs/code-analysis.md](docs/code-analysis.md): File responsibilities, message contracts, test, and risk analysis. (Korean)
- Chrome Web Store copy: [Korean](docs/chrome-web-store-ko.md), [English](docs/chrome-web-store-en.md), [Japanese](docs/chrome-web-store-ja.md).
- Privacy policy: [Korean](PRIVACY.md), [English](PRIVACY_en.md), [Japanese](PRIVACY_ja.md).

## Local LLM Base URL

For an OpenAI-compatible `chat/completions` server, enter the Base URL only up to the segment immediately before `/chat/completions` in the final request URL.
For security, the host must be `localhost` or `127.0.0.1`.

```text
Base URL: http://localhost:1234/v1
Request URL: http://localhost:1234/v1/chat/completions
Model: The model name provided by the OpenAI-compatible server
```

## Provider API references

- DeepL: Use the endpoint that matches the Free or Pro plan. The Free plan has a monthly character limit. References: https://developers.deepl.com/docs/resources/usage-limits, https://www.deepl.com/pro-api
- OpenAI: Usage limits and pricing vary by account, model, and tier. References: https://developers.openai.com/api/docs/guides/rate-limits, https://developers.openai.com/api/docs/pricing
- Anthropic: Usage limits and pricing vary by account, model, and tier. References: https://platform.claude.com/docs/en/api/rate-limits, https://platform.claude.com/docs/en/about-claude/pricing
- Google AI: Gemini API limits and pricing vary by project, model, and tier. API key: https://aistudio.google.com/api-keys. References: https://ai.google.dev/gemini-api/docs/rate-limits, https://ai.google.dev/gemini-api/docs/pricing
- OpenRouter: Free plans and free-model APIs have usage limits. References: https://openrouter.ai/pricing, https://openrouter.ai/docs/api/reference/limits
- NVIDIA NIM: Free NVIDIA API Catalog endpoints are intended for development and prototyping and may have model- and account-specific usage limits. References: https://build.nvidia.com/explore/discover, https://forums.developer.nvidia.com/t/nvidia-nim-faq/300317

## Recommended default models

- Google AI: `gemini-3.1-flash-lite`
- OpenAI: `gpt-5.6-luna`
- Anthropic: `claude-haiku-4-5-20251001`
- OpenRouter: `deepseek/deepseek-v4-flash` (`DeepSeek: DeepSeek V4 Flash`)
- NVIDIA NIM: `openai/gpt-oss-120b`
- Local LLM prioritizes `google/gemma-4-e4b` when available; otherwise it selects a compact Qwen or Gemma instruct model.
- After successfully fetching models, online providers save the recommended model and immediately run a minimal connection test. Only successful providers are marked connected.
- Fetching models for Local LLM only chooses a model; it does not run an automatic connection test.

## Subtitle styling

- The default font is the Pretendard web font.
- Paste a Noonnu “use as web font” CSS snippet to use a custom web font.
- Outlines use Chrome's `-webkit-text-stroke`.
- Configure shadow distance and blur in the bottom-right diagonal direction.
- Drag the subtitle overlay to move it, and use its lower-right corner to adjust width.

## Settings backup and restore

- At the bottom of the options page, back up or restore the current settings, including API keys, in an encrypted `.astbackup` file.
- Selecting **Back up settings** opens a dedicated masked popup to enter a backup password. Restore uses the same password flow after choosing a file.
- A backup password must be at least 10 characters and include letters, numbers, and special characters. Ordinary internal spaces are allowed; leading/trailing spaces, tabs, and line breaks are not.
- Each backup creates a random salt and nonce and derives an AES-GCM key from the password with PBKDF2-SHA-256.
- The password is never stored in the extension or backup file. A forgotten password cannot be recovered.
- Translation cache entries are excluded from backups.
- The restore picker shows only `.astbackup` files and rejects other extensions.
- The restore picker starts in the OS Downloads folder and remembers the last restore location when supported; otherwise it uses the default file picker.
- After restoring, users can opt in to test every provider with a configured API key and refresh successful status.

## QA checklist

- Local automated checks:

```text
npm test
npm run check
```

- Open an enrolled Udemy course page while signed in.
- Verify the extension button appears in the video controls.
- With the AST menu open, select another player toolbar icon such as subtitles or settings and verify the AST menu closes.
- In a lecture with subtitles, verify Google cue translation appears first in the yellow state.
- With an LLM provider selected, verify final subtitles replace the temporary translation after complete translation.
- Move to another lecture and verify subtitles from the previous lecture do not appear.
- In Options, verify provider connection tests, model discovery, and cache deletion.

## Limitations

- Udemy API calls depend on the user's login cookies and course enrollment permission.
- API keys are stored in `chrome.storage.local` as provider-specific AES-GCM ciphertext with decryption material distributed across three transformed fragments. The options page masks saved API keys.
- This convenience-first design decrypts keys automatically without a master-password prompt. It makes ordinary plaintext secret collection harder, but is not a secure vault against targeted analysis of both the extension code and local storage.
- Storage access is restricted to trusted extension contexts, and API keys are not exposed to content scripts.
- Hosted providers are limited to their official HTTPS origins; Local LLM is limited to `localhost` or `127.0.0.1`, and redirect responses are not followed automatically.
- Subtitle text may be sent to the translation provider selected by the user.
