# AI Subtitle Translator

[한국어](README.md) · [English](README_en.md) · [日本語](README_ja.md)

A Chrome Manifest V3 extension that translates subtitles from Udemy, YouTube, NVIDIA Academy, and Vimeo and displays them over the video. Use Google Translate right away, or connect an LLM provider for context-aware translations.

Chrome 102 or later is required.

## Key features

- Collects subtitles from Udemy, YouTube, NVIDIA Academy, and Vimeo and displays the original or translated subtitles.
- Lets you choose a source subtitle language and translation style directly from the AST menu.
- Supports Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, and Local LLM.
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

## Usage

1. Open a Udemy course, YouTube video, NVIDIA Academy course, or Vimeo video with subtitles.
2. Select the AST icon in the video toolbar to enable subtitles.
3. Choose a source subtitle language, translation provider, and translation style from the menu, or open the settings page.

When you select an LLM provider, the extension translates subtitles near the current playback position first, then processes the remainder. You can continue viewing the original or temporary translated subtitles while translation is in progress.

## Local LLM setup

For an OpenAI-compatible `chat/completions` server, enter only the part of the final request URL before `/chat/completions` as the Base URL. For security, only `localhost` and `127.0.0.1` are allowed.

```text
Base URL: http://localhost:1234/v1
Request URL: http://localhost:1234/v1/chat/completions
```

## Privacy and limitations

- Subtitle text may be sent to the translation provider you choose. Please review each provider's terms and pricing.
- Access to Udemy subtitles depends on your signed-in state and course enrollment.
- API keys are encrypted in local storage and are not sent to content scripts. This is a convenience-focused design that does not require a master password, so it does not provide the same security as a dedicated secret manager.

For details, see the privacy policy in [Korean](PRIVACY.md), [English](PRIVACY_en.md), or [Japanese](PRIVACY_ja.md).

## Development and verification

```text
npm test
npm run check
```

For design and implementation details, see [Design.md](Design.md), [CONTEXT.md](CONTEXT.md), and [TASKS.md](TASKS.md).

## Release package

Create the Chrome Web Store ZIP package while the release tag points at the current commit.

```text
./release.sh
```

The generated `release/ai-subtitle-translator-v<tag>.zip` file is used as the GitHub Release asset and Chrome Web Store package.
