# AST - AI Subtitle Translator

[한국어](README.md) · [English](README_en.md) · [日本語](README_ja.md)

A Chrome Manifest V3 extension that translates subtitles from Udemy, YouTube, TED, NVIDIA Academy, and Vimeo and displays them over the video. Use Google Translate right away, or connect an LLM provider for context-aware translations.

Product page: <https://mungi.github.io/ai-subtitle-translator/>

Chrome 102 or later is required.

## Key features

- Collects subtitles from Udemy, YouTube, TED, NVIDIA Academy, and Vimeo and displays the original or translated subtitles.
- Lets you choose a source subtitle language and translation style directly from the AST menu.
- On YouTube, prioritizes native player caption responses and changes source words from dark gray to the configured text color as speech progresses. When word timing is unavailable, progress is estimated from cue timing. Translations use cue-level display, and AST subtitles are hidden during ads.
- Supports Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, and Custom LLM.
- Uses the full subtitle context and current playback position for LLM translation, splitting long videos into manageable parts.
- Provides Natural, Lecture, Technical, and custom translation styles.
- Lets you adjust subtitle position, size, font, color, shadow, outline, and background.
- Caches translations and falls back to Google Translate when an LLM quota is exceeded.
- Provides provider connection tests, model discovery, and settings backup and restore.

## Installation

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository's `extension/` folder.
5. Set a translation provider and target language in the extension options.

After reloading the extension, also refresh any open YouTube pages to activate caption capture. The `scripting` permission lets the extension observe the native player's caption responses from the start of the YouTube page.

## Quick start

1. Open the extension options. **Simple Settings** is shown by default.
2. You can translate subtitles with Google Translate without entering an API key.
3. To use Google Gemini, create a key in [Google AI Studio API Keys](https://aistudio.google.com/api-keys), paste it into **Google AI API key**, and select **Check API key**. On success, Gemini 3.5 Flash Lite is configured automatically.
4. Use **Advanced Settings** for other translation providers, subtitle appearance, and backup or restore.

## Usage

1. Open a Udemy course, YouTube video, TED video, NVIDIA Academy course, or Vimeo video with subtitles.
2. Select the AST icon in the video toolbar to enable subtitles.
3. Choose a source subtitle language, translation provider, and translation style from the menu, or open the settings page.
4. Under **Subtitle display**, choose **Dual subtitles**, **Main subtitles**, or **Translated subtitles**. The default, **Main subtitles**, shows the selected source language. **Dual subtitles** shows the source above its translation. The source remains visible while translation is pending or fails. The display mode is shared across supported sites and saved for future use.

Persian and Arabic subtitles use right-to-left text direction. Dual subtitles handle the source and translation directions independently while remaining centered over the video. Translations in the Udemy transcript align to the start of their language's text direction.

When you select an LLM provider, the extension translates subtitles near the current playback position first, then processes the remainder. You can continue viewing the original or temporary translated subtitles while translation is in progress.

See [Chrome built-in translation and Google Translate comparison](docs/translation-comparison-en.md) for the translation quality trial. The Chrome Translator API is not currently integrated into the extension.

## Custom LLM setup

Custom LLM supports both local LLMs and user-operated OpenAI-compatible `chat/completions` servers. Enter only the part of the final request URL before `/chat/completions` as the Base URL. `localhost` and `127.0.0.1` can use HTTP or HTTPS; external custom servers must use HTTPS. To use an external server, approve access to its domain when you fetch models or test the connection. Subtitle text and the API key, if entered, are sent directly to that server.

```text
Base URL: http://localhost:1234/v1
Request URL: http://localhost:1234/v1/chat/completions
```

## Privacy and limitations

- Google Translate uses an unofficial web translation endpoint without an API key. It differs from the official Google Cloud Translation API and may fail due to request limits or service changes.
- Subtitle text may be sent to the translation provider you choose. Please review each provider's terms and pricing.
- Access to Udemy subtitles depends on your signed-in state and course enrollment.
- API keys are encrypted in local storage and are not sent to content scripts. This is a convenience-focused design that does not require a master password, so it does not provide the same security as a dedicated secret manager.
- Never put an API key in screen shares or public documents. If you suspect exposure, revoke the key in the provider console immediately and create a replacement.

For details, see the privacy policy in [Korean](PRIVACY.md), [English](PRIVACY_en.md), or [Japanese](PRIVACY_ja.md).

## Development and verification

```text
npm test
npm run check
```

`npm run check` uses Unix `find` and `xargs`; on Windows, run it in Git Bash or WSL.

For design and implementation details, see [Design.md](Design.md), [code analysis](docs/code-analysis.md), and [TASKS.md](TASKS.md).

## Release package

Create the Chrome Web Store ZIP package while the release tag points at the current commit. The script creates the ZIP, creates or updates the GitHub Release, and attaches the ZIP.

```text
./release.sh
```

The generated `release/ai-subtitle-translator-v<tag>.zip` file is used as the GitHub Release asset and Chrome Web Store package.

## License

This project is licensed under the [MIT License](LICENSE).
