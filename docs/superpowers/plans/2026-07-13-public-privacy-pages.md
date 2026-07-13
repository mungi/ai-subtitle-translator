# Public Privacy Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a concise privacy summary to the AI Subtitle Translator introduction page and publish complete Korean, English, and Japanese privacy-policy pages at stable GitHub Pages URLs.

**Architecture:** Keep the existing dependency-free static-site structure. `index.html` remains the product introduction, three standalone HTML documents contain the synchronized policies, and `styles.css` supplies shared product and policy-page presentation.

**Tech Stack:** Static HTML5, CSS, Node.js built-in modules for validation, GitHub Pages.

## Global Constraints

- Preserve the current product copy, provider recommendations, palette, system-font stack, and responsive behavior.
- Publish `privacy.html`, `privacy-en.html`, and `privacy-ja.html` as independent, directly linkable documents.
- Policy facts must match `/Users/mungi/play/llm-subtitle-translator/PRIVACY*.md` as of 2026-07-13.
- Do not add JavaScript or third-party runtime dependencies.
- Commit only the public-site repository changes and push `main` to `origin/main`.

---

### Task 1: Public privacy content

**Files:**
- Modify: `index.html`
- Create: `privacy.html`
- Create: `privacy-en.html`
- Create: `privacy-ja.html`

**Interfaces:**
- Consumes: the existing header, section, button, and footer conventions in `index.html`.
- Produces: anchors `#privacy`, `privacy.html`, `privacy-en.html`, and `privacy-ja.html` for navigation and Chrome Web Store use.

- [ ] **Step 1: Run the pre-implementation content check**

```bash
node -e 'const fs=require("fs"); for (const file of ["privacy.html","privacy-en.html","privacy-ja.html"]) if (!fs.existsSync(file)) throw new Error(`${file} missing`)'
```

Expected: FAIL with `privacy.html missing`.

- [ ] **Step 2: Add main-page privacy navigation and summary**

Add a `개인정보` navigation link, a `section#privacy` after the support section, and a footer link. The summary must state:

```text
자막 텍스트는 선택한 번역 provider로 전송될 수 있습니다.
API key와 설정은 사용자 브라우저에 저장되며 개발자 서버로 전송되지 않습니다.
저장소는 trusted extension context로 제한되지만 자동 복호화 방식은 OS 보안 저장소와 같지 않습니다.
```

Link the section to all three policy pages with explicit language labels.

- [ ] **Step 3: Create the three complete policy pages**

Each page uses this semantic shell and localized text derived from its matching source policy:

```html
<header class="policy-header">
  <a class="brand" href="index.html">
    <img class="brand-mark" src="assets/ast-icon.png?v=2" alt="">
    <span>AI Subtitle Translator</span>
  </a>
  <nav class="language-nav" aria-label="Language">
    <a href="privacy.html">한국어</a>
    <a href="privacy-en.html">English</a>
    <a href="privacy-ja.html">日本語</a>
  </nav>
</header>
<main class="policy-page">
  <aside class="policy-meta">
    <p class="eyebrow">PRIVACY</p>
    <p>Effective July 13, 2026</p>
  </aside>
  <article class="policy-document">
    <h1>AI Subtitle Translator Privacy Policy</h1>
    <section aria-labelledby="data-title">
      <h2 id="data-title">Data handled</h2>
      <p>Localized policy content copied from the matching source policy.</p>
    </section>
  </article>
</main>
<footer class="policy-footer">
  <a href="index.html">AI Subtitle Translator home</a>
</footer>
```

Every localized article must cover: handled data, purpose, storage/retention, external transmission, permissions, Limited Use, security, and contact/changes. Set `<html lang>` to `ko`, `en`, and `ja` respectively.

- [ ] **Step 4: Run the content check**

```bash
node - <<'NODE'
const fs = require('fs');
const checks = {
  'privacy.html': ['OpenAI', 'API key', 'Chrome Web Store User Data Policy'],
  'privacy-en.html': ['OpenAI', 'API keys', 'Chrome Web Store User Data Policy'],
  'privacy-ja.html': ['OpenAI', 'API key', 'Chrome Web Store User Data Policy']
};
for (const [file, needles] of Object.entries(checks)) {
  const html = fs.readFileSync(file, 'utf8');
  for (const needle of needles) if (!html.includes(needle)) throw new Error(`${file}: missing ${needle}`);
}
NODE
```

Expected: exit 0.

### Task 2: Shared presentation and release validation

**Files:**
- Modify: `styles.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: policy classes from Task 1.
- Produces: responsive policy layouts and documented public URLs.

- [ ] **Step 1: Add restrained policy-page styles**

Extend `styles.css` with:

```css
.privacy-section { padding-top: 100px; padding-bottom: 100px; background: #edf5f3; }
.privacy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; }
.policy-header { min-height: 72px; display: flex; align-items: center; justify-content: space-between; }
.policy-page { display: grid; grid-template-columns: 220px minmax(0, 760px); gap: 72px; }
.policy-meta { color: var(--muted); }
.policy-document { min-width: 0; }
.policy-document section { padding: 32px 0; border-top: 1px solid var(--line); }
.policy-footer { display: flex; justify-content: space-between; }
a:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
```

Use the existing CSS variables. Desktop policy layout is a 220px metadata rail plus a readable document column; at `max-width: 760px` it becomes one column. Add visible `:focus-visible` outlines to links.

- [ ] **Step 2: Document public endpoints**

Update `README.md` with the Pages home URL and all three privacy URLs.

- [ ] **Step 3: Validate local links and assets**

```bash
node - <<'NODE'
const fs = require('fs');
const path = require('path');
for (const file of fs.readdirSync('.').filter((name) => name.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (/^(?:https?:|#|mailto:)/.test(target)) continue;
    const local = target.split(/[?#]/)[0];
    if (local && !fs.existsSync(path.resolve(local))) throw new Error(`${file}: missing ${local}`);
  }
}
NODE
```

Expected: exit 0.

- [ ] **Step 4: Browser verification**

Serve the repository locally and inspect `index.html`, `privacy.html`, `privacy-en.html`, and `privacy-ja.html` at desktop and 390px mobile widths. Confirm navigation, language switching, no horizontal overflow, readable policy headings, and visible focus states.

- [ ] **Step 5: Commit and push**

```bash
git add index.html styles.css README.md privacy.html privacy-en.html privacy-ja.html docs/superpowers/plans/2026-07-13-public-privacy-pages.md
git commit -m "Publish privacy pages"
git push origin main
```

- [ ] **Step 6: Verify GitHub Pages deployment**

Wait for the `Deploy GitHub Pages` workflow to succeed, then confirm `https://mungi.github.io/ai-subtitle-translator/privacy.html` returns the Korean policy.
