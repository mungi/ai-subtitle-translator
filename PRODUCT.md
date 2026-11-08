# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Online course learners (primary):** people watching foreign-language lectures on Udemy, YouTube, TED, NVIDIA Academy, and Vimeo (and, additionally, Coursera, LinkedIn Learning, O'Reilly, NVIDIA On-Demand, DeepLearning.AI, and edX) who want subtitles in their own language while they study.
- **Developers and power users:** people who run local LLMs or hold API keys with several AI providers and want to plug those into subtitle translation.
- **General YouTube viewers:** people who want to follow foreign-language videos beyond lectures, such as talks, interviews, and vlogs.

The main use happens while a video plays: the viewer glances at subtitles over the player, so anything shown there competes with the video itself.

## Product Purpose

AST - AI Subtitle Translator is a Chrome Manifest V3 extension that collects a video's subtitles and shows the original, a translation, or both over the player. It can translate with Google Translate right away, or with an LLM that reads the whole subtitle track for natural, connected translations. Success means the viewer understands the video in their language without leaving the player, and pays little or nothing to do so.

## Positioning

In priority order, as confirmed by the owner:

1. **Custom LLM connection:** any OpenAI-compatible `chat/completions` server works, so a model running on the viewer's own laptop or any LLM service they already use can do the translating. Subtitle text goes straight from the browser to that server.
2. **LLM translation with full-video context:** the LLM sees surrounding subtitles and the flow of the whole video instead of translating line by line, and results are placed back on the original cue times.

Supporting facts the owner asked the intro site to highlight (2026-11-06): no monthly subscription, because viewers bring their own API key (OpenAI, Anthropic, Google AI, OpenRouter, and others) and pay the provider only for tokens used, which is very cheap with small, fast models; and the project is free open source under the MIT License with no developer server.

## Operating Context

- Surfaces: the AST toolbar icon and menu inside each site's video player, the subtitle overlay on the video, the extension popup, the options page (Simple and Advanced settings), and the intro site at `https://mungi.github.io/ai-subtitle-translator/` (served from `site/`).
- Install path: Chrome Web Store listing `ccejdofkiceeaaamfcbbmddoeahmnodi`, or loading `extension/` unpacked.
- The toolbar icon's color reports translation state (off, active, temporary, current cue ready, complete, fallback, YouTube auto-translation).
- Udemy and YouTube are the priority platforms.

## Capabilities and Constraints

- Providers: Google Translate (no key), DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, and Custom LLM. Custom LLM allows HTTP only for `localhost`, `127.0.0.1`, RFC 1918 private addresses, and `.local` names; all other servers must use HTTPS.
- Display modes: translated, source, or dual subtitles. Translation styles: Natural, Lecture, Technical, and two custom prompts with editable labels.
- On YouTube it can show YouTube's own human subtitles in the target language, or YouTube's auto-translation, instead of translating; this can be turned off.
- Subtitle appearance (position, size, width, fonts, weights, colors, outline, shadow, background) is user-adjustable.
- Subtitles are normalized to `{ id, start, end, text }` cues; LLM output must keep the original cue count and time ranges. On failure, a translation error is shown and source subtitles stay visible.
- Network calls go through the background service worker. API keys live in `chrome.storage.local`, encrypted at rest but not equal to OS secure storage; this limit is documented.
- Chrome 102 or later. Extension UI is localized in English, Korean, and Japanese.
- Notifications over the player are for errors only; no informational popups.
- Documentation: Korean is the source; English and Japanese are synced translations. `README.md` and `PRIVACY.md` are English for the repository front page; Korean lives in `_ko.md`, Japanese in `_ja.md`.

## Brand Commitments

- Name: "AST - AI Subtitle Translator". Icon: `extension/assets/` and `site/assets/ast-icon.png`.
- Code and documents must never name or reference the two competing subtitle-translation extensions the owner has ruled out; the product does not present itself as derived from any other product.
- Intro site and store copy are maintained in English, Korean, and Japanese with the same content and structure.

## Evidence on Hand

- Measured translation cost from real AST runs (English to Korean, 2026): GPT-6 Luna about $0.20 and Claude Haiku 5.5 about $0.35 per 10,000 subtitle sentences; other models on the intro site are estimated from the same token usage at list prices dated 2026-11-06. Prices must be re-dated when updated.
- Translation quality comparison: `docs/translation-comparison*.md`.
- Store listing copy: `docs/chrome-web-store-*.md`. Promo images: `docs/marquee-promo-tile.png`, `docs/small-promo-tile.png`. Site hero image: `site/assets/subtitle-video-hero.png`.
- There are no user testimonials, ratings, install counts, press, or customer logos on hand. Do not fabricate them.

## Product Principles

1. The video comes first: subtitles and controls stay out of the way and never block the player with non-essential messages.
2. The viewer owns the pipeline: their key, their provider, or their own machine, with no developer server in between.
3. Context over line-by-line: translation quality comes from reading the whole track, while timing stays faithful to the original cues.
4. Fail soft: when translation fails, the original subtitles keep playing and the reason is stated plainly.
5. Honest claims: costs, prices, and capabilities shown to users are measured or dated, never inflated.

## Accessibility & Inclusion

- Right-to-left subtitle languages (such as Persian, Arabic, and Hebrew) are rendered with correct text direction, including in dual mode.
- Subtitle size, color, outline, and background are adjustable for readability over any video.
