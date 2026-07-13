# Public Privacy Pages Design

## Goal

Publish accurate, directly linkable privacy and security documentation for AI Subtitle Translator on its existing GitHub Pages site. The public pages must stay consistent with the extension repository and provide a stable URL suitable for the Chrome Web Store Developer Dashboard.

## Considered approaches

1. **Main-page summary plus three standalone policy pages — selected.**
   - Keeps the product page concise while providing complete Korean, English, and Japanese policies at stable URLs.
   - Lets the Chrome Web Store link directly to the Korean policy and gives visitors one-click language switching.
2. **One trilingual policy page.**
   - Fewer files, but creates an excessively long page and poor language-specific navigation.
3. **Link to Markdown files in the extension source repository.**
   - Avoids duplication, but gives the store and end users a developer-oriented GitHub document instead of a first-class product-site policy page.

## Information architecture

- `index.html`
  - Add `개인정보` to the main navigation.
  - Add a concise privacy and security section after the supported-provider section.
  - Explain local storage, provider transmission, absence of a developer backend, and the API-key storage limitation in plain Korean.
  - Link to all three full policies.
- `privacy.html`
  - Korean canonical privacy policy.
- `privacy-en.html`
  - English privacy policy.
- `privacy-ja.html`
  - Japanese privacy policy.
- Footer
  - Add a direct Korean privacy-policy link.

## Policy content

Each policy must disclose the same facts as the extension repository:

- Data handled: subtitle text and timing, page/video/course identifiers, provider settings and API keys, cache data, and encrypted backup files.
- Purpose: subtitle retrieval, translation, display, settings persistence, and backup/restore only.
- Local storage and retention, including encrypted API keys and the limits of automatic local decryption.
- External transmission to the selected translation provider, Udemy/YouTube, and configured font hosts.
- `storage` and host-permission purposes.
- Chrome Web Store Limited Use statement.
- Security boundaries: hosted-provider HTTPS origin allowlist, loopback-only Local LLM, no automatic redirect following, and no API-key exposure to content scripts.
- Contact and change notice.

## Visual design

The policy pages extend the current site rather than introduce a new visual identity.

- Palette: Ink `#17202a`, Muted `#52606d`, Paper `#f7f9fb`, Accent `#e95d2a`, Teal `#0f766e`, Line `#dbe2e8`.
- Typography: existing system sans stack for headings and body; compact utility labels use the current bold uppercase eyebrow treatment.
- Layout: a restrained document column with a narrow metadata rail on desktop and a single column on mobile.
- Signature: policy sections use the same strong horizontal rules and numbered information rhythm as the product page, making the legal content feel like part of the product rather than a detached template.
- Accessibility: semantic headings, visible keyboard focus, descriptive link text, sufficient contrast, and responsive layout.

## Verification

- Parse every HTML file and confirm all local links and assets resolve.
- Confirm the policy text includes every disclosed data category and every named third party.
- Serve the site locally and inspect the home page plus all policy pages at desktop and mobile widths.
- Confirm the canonical public URLs are:
  - `https://mungi.github.io/ai-subtitle-translator/privacy.html`
  - `https://mungi.github.io/ai-subtitle-translator/privacy-en.html`
  - `https://mungi.github.io/ai-subtitle-translator/privacy-ja.html`
- After push, wait for the GitHub Pages workflow and verify the deployed Korean privacy URL returns successfully.

## Release scope

Only public-site documentation, styling, and navigation are in scope. Extension source code, store installation behavior, and provider recommendations remain unchanged.
