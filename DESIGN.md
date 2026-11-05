---
name: AST - AI Subtitle Translator (intro site)
description: A parallel-text edition. Black ink for the source line, one cobalt ink for every translation.
colors:
  paper: "#ffffff"
  paper-2: "#f5f6f8"
  ink: "#111214"
  ink-2: "#33373d"
  muted: "#5a5f67"
  rule: "#d8dbe0"
  rule-strong: "#111214"
  cobalt: "#1f3fd1"
  cobalt-deep: "#1631ad"
  cobalt-tint: "#edf0ff"
  on-cobalt: "#ffffff"
  on-cobalt-2: "#d9e0ff"
  on-cobalt-rule: "rgba(255, 255, 255, .3)"
typography:
  display:
    fontFamily: "Source Serif 4, Gowun Batang, Shippori Mincho, serif"
    fontSize: "clamp(42px, 6.4vw, 92px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontVariation: "\"opsz\" 32"
  headline:
    fontFamily: "Source Serif 4, Gowun Batang, Shippori Mincho, serif"
    fontSize: "clamp(34px, 4.6vw, 62px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontVariation: "\"opsz\" 24"
  title:
    fontFamily: "Source Serif 4, Gowun Batang, Shippori Mincho, serif"
    fontSize: "clamp(22px, 2vw, 27px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontVariation: "\"opsz\" 16"
  gloss:
    fontFamily: "Gowun Batang | Shippori Mincho | Source Serif 4 italic (by gloss language)"
    fontSize: "max(.44em, 18px)"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0em"
  translation-line:
    fontFamily: "Gowun Batang | Shippori Mincho | Source Serif 4 (by target language)"
    fontSize: "clamp(20px, 1.9vw, 25px)"
    fontWeight: 700
    lineHeight: 1.45
  body:
    fontFamily: "Pretendard Variable, Pretendard, -apple-system, Segoe UI, Apple SD Gothic Neo, Hiragino Sans, Malgun Gothic, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Pretendard Variable, Pretendard, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 700
    fontFeature: "tnum"
rounded:
  hairline: "2px"
  dot: "50%"
spacing:
  gutter: "clamp(20px, 4vw, 56px)"
  section-y: "clamp(72px, 10vw, 136px)"
  column-gap: "clamp(32px, 6vw, 96px)"
  row: "28px"
  cue: "16px 0 18px"
  container: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-cobalt}"
    rounded: "{rounded.hairline}"
    padding: "12px 22px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.on-cobalt}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "12px 22px"
    height: "50px"
  button-quiet-hover:
    textColor: "{colors.cobalt}"
  button-invert:
    backgroundColor: "{colors.on-cobalt}"
    textColor: "{colors.cobalt-deep}"
    rounded: "{rounded.hairline}"
    padding: "12px 22px"
    height: "50px"
  button-invert-hover:
    backgroundColor: "{colors.on-cobalt-2}"
    textColor: "{colors.ink}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.hairline}"
    padding: "3px 11px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.cobalt-tint}"
    textColor: "{colors.cobalt}"
  select:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    padding: "4px 30px 4px 12px"
    height: "34px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.hairline}"
    size: "34px"
  text-link:
    textColor: "{colors.cobalt}"
---

# Design System: AST - AI Subtitle Translator (intro site)

Scope: this document records the intro website in `site/` (index page plus the three privacy policy pages, which share `site/styles.css`). The Chrome extension's own UI (options page, popup, in-player subtitle overlay and menu) is a separate incumbent surface that was not redesigned with this world; nothing here describes or constrains it.

## Overview

**Creative North Star: "The Parallel-Text Edition"**

The site reads like a bilingual edition of a lecture: every important line is set twice, source over translation, the way the product's dual subtitles read over a player. Black ink carries the source; one cobalt second ink carries every translation line, every heading gloss, and every marginal note. Where the argument is about the translation side itself (cost, the closing call to install), cobalt stops being an ink and becomes the whole field.

Structure comes from typesetting, not containers. Hairline rules, a heavier 2px rule opening each block, ruled margins holding cue numbers and timecodes in tabular mono figures, and narrow marginal notes do the work cards would do elsewhere. Display type is a sturdy transitional serif (Source Serif 4) for Latin, with batang (Korean) and mincho (Japanese) serifs carrying glosses and translation lines; running text is a neutral sans. The page is white, open, and sparse, with large section spacing and a 1240px measure.

Motion is one grammar: a left-to-right typesetting wipe (clip-path) that sets a translation line or gloss as if it were being printed. The hero passage runs it on a single playhead timeline; section glosses use it as they enter. Reduced motion shows everything finished and still.

**Key Characteristics:**
- Two inks only: black source, cobalt translation; cobalt fields for the "translation side".
- Every section heading carries a cobalt gloss beneath it in the other script.
- Rules, margins, and columns instead of cards, panels, or shadows.
- Sturdy transitional serif display, batang/mincho glosses, sans running text, mono for numbers and code.
- Near-square corners (2px) everywhere a box is unavoidable.
- One motion verb: the typesetting wipe.

## Colors

A white page, a near-black ink, and a single saturated cobalt that means "translation" wherever it appears.

### Primary
- **Translation Cobalt** (cobalt): every translation line, heading gloss, marginal note rule and label, link, hover state, focus ring, selection, step numeral, active cue marker, and the full-bleed fields of the cost section and closing band.
- **Deep Cobalt** (cobalt-deep): text on the inverted white button that sits inside cobalt fields.
- **Cobalt Wash** (cobalt-tint): background of the selected target-language chip only.

### Neutral
- **Page White** (paper): the page.
- **Proof Grey** (paper-2): inline code background on policy pages; nothing else.
- **Source Ink** (ink): source lines, headings, primary button fill, and the strong 2px opening rule (rule-strong shares this value).
- **Second Ink** (ink-2): body paragraphs, lede, nav, marginal note text.
- **Margin Grey** (muted): timecodes, captions, summaries, footer, labels.
- **Hairline** (rule): 1px dividers, control borders, cue separators.
- **On-Cobalt White / Pale / Rule** (on-cobalt, on-cobalt-2, on-cobalt-rule): text, secondary text and glosses, and table dividers inside cobalt fields.

### Named Rules
**The Second Ink Rule.** Cobalt means translation, gloss, or action. Never use it as decoration on a source line, and never introduce a second accent hue.

**The Translation Side Rule.** A section may invert to a full cobalt field only when its subject is the translation side itself (cost of translating, the install call). Inside it, text steps through on-cobalt, on-cobalt-2, and on-cobalt-rule; no greys.

The colored status dots in the icon state guide (sky, yellow, green, violet, rose, orange, white) reproduce the extension's toolbar icon states. They are data, owned by the extension, and not part of this palette.

## Typography

**Display Font:** Source Serif 4 (opsz axis, optical sizing off and pinned per role; chosen over a high-contrast didone, whose hairline strokes were too thin to read), falling back to Gowun Batang / Shippori Mincho, then serif
**Gloss and Translation Fonts:** Gowun Batang (Korean), Shippori Mincho (Japanese), Source Serif 4 italic (English glosses) or upright 600 (Spanish translation)
**Body Font:** Pretendard Variable with platform sans fallbacks
**Mono:** JetBrains Mono, always with tabular figures

**Character:** A sturdy transitional serif headline set over an East Asian book serif gloss, with a quiet sans for reading. The serif contrast is the bilingual edition; the sans keeps the argument legible.

### Hierarchy
- **Display** (600, clamp(42px, 6.4vw, 92px), 1; 40px fixed under 720px): hero headline only, opsz 32.
- **Headline** (600, clamp(34px, 4.6vw, 62px), 1.2): section h2, opsz 24. Closing title uses clamp(30px, 3.6vw, 48px), 1.1.
- **Title** (600, clamp(22px, 2vw, 27px), 1.25): column and guide h3; feature index h3 rises to clamp(24px, 2.4vw, 32px).
- **Gloss** (700 serif, max(.44em, 18px), 1.35, cobalt): set beneath every h1/h2 in a different script; hero gloss is max(.3em, 20px).
- **Body** (400, 17px / 16px under 720px, 1.65): running text, measures held at 40-64ch.
- **Label** (600, 13-14px): nav, captions, chips, picker, table heads (12.5px).
- **Mono** (13px 700 cue numbers, 12px timecodes, 15px code and cost figures): numbers and code only.

### Named Rules
**The Gloss Rule.** Every section heading is a pair: the page-language line, then its gloss in cobalt serif beneath. The gloss script is chosen by language (batang for Korean, mincho for Japanese, italic serif for English) and is hidden when empty.

**The Keep-All Rule.** Korean text uses `word-break: keep-all` with `overflow-wrap: break-word` so words never split mid-syllable-block.

**The Tabular Margin Rule.** Cue numbers, timecodes, cost figures, and policy section numbers are mono with tabular figures, set in the margin, never in the measure.

## Layout

A single 1240px container with a fluid gutter (clamp(20px, 4vw, 56px)) and generous vertical rhythm (section-y, clamp(72px, 10vw, 136px)). Sections are separated by a 1px top rule; each content block within opens on a 2px ink rule. Section heads are an asymmetric two-column grid (7fr heading / 4fr summary, aligned to the bottom), and most bodies use asymmetric splits (4/7, 5/7, 6/5, 7/4) with a column gap of clamp(32px, 6vw, 96px). Parallel columns (three for Custom LLM, two for guides) are divided by 1px vertical rules, not gaps alone.

The hero passage is a three-track interlinear grid: 168px margin (cue number, timecode), the measure, and a 260px marginal-note column. At 980px the note drops under the measure (132px margin); at 720px everything stacks and the margin metadata runs inline above the line.

Breakpoints: 980px (two-column splits collapse, steps go to two-up, brand subtitle hides) and 720px (single column, nav becomes a horizontally scrolling full-width row, cost table reflows to a two-column grid per row). Policy pages use a 220px sticky meta column beside a 760px document, with numbered sections in a 52px mono margin.

## Elevation & Depth

Flat. There are no box shadows on surfaces, no cards, and no layered panels. Depth is expressed by rule weight (1px hairline vs 2px ink), by the inversion to full cobalt fields, and by the sticky header's 94% white with a light backdrop blur over a 1px rule. The only shadow in the build is a 1px ring around the status dots so the white "off" dot reads on white.

### Named Rules
**The Ruled Page Rule.** Separate content with rules and margins. If something seems to need a card, give it a 2px top rule and column space instead.

## Shapes

Near-square. Every bordered control (buttons, chips, picker, icon buttons, focus outline) uses a 2px radius; text blocks, rules, the passage, and tables have no radius at all. The only round forms are the 11px status dots; the cue marker is a small 8px square that fills ink when set and cobalt (scaled 1.25) when active. Icons are inline SVG line or solid glyphs at 14-20px.

## Components

### Buttons
Typeset and blunt: heavy label, square corners, no shadow.
- **Shape:** near-square (2px), min-height 50px (46px on mobile, flexing to fill the row).
- **Primary:** ink fill with white text; hover turns the fill cobalt. 15px, weight 700.
- **Quiet:** transparent with a 1px ink border; hover turns border and text cobalt.
- **Invert:** for use inside cobalt fields only; white fill, deep-cobalt text; hover goes pale cobalt with ink text.
- **Active / Focus:** 1px press-down on active; focus is a 2px cobalt outline offset 3px.

### Text Link
Cobalt, 700, 1px underline at 5px offset that slides to 8px on hover. Used for secondary actions beside buttons and in guides.

### Chips
- **Style:** borderless, ink-2 text, 32px tall, 2px radius.
- **State:** selected (aria-pressed) gets a cobalt border, cobalt text, and the cobalt wash background; hover turns text cobalt.

### Inputs / Fields
- **Language picker:** native select with appearance reset, 1px hairline border, 2px radius, 34px tall, inline SVG chevron; hover darkens border to ink.
- **Icon buttons** (GitHub, play/pause): 34px (32px for play) square, hairline border, hover cobalt.

### Navigation
Header is sticky, 64px, with the wordmark (Source Serif 4 700, 22px) and a muted full product name. Nav links are 14px 600 ink-2; hover turns cobalt and draws a 1px cobalt underline left to right. Under 720px the nav wraps to its own scrolling row. Policy pages use a muted language nav with the current page in cobalt and underlined.

### Interlinear Passage (signature)
The hero demonstration. A caption bar (with target-language chips, a play/pause toggle, and a 2px cobalt progress line along its bottom edge) sits over a ruled list of cues. Each cue: mono cue number with a square marker and timecode in the margin, the source line in ink sans, the translation beneath in cobalt serif 700, resolved terms underlined in cobalt (2px), and an optional marginal note with a cobalt left rule and an italic serif label. One timeline sets translation lines in sequence with the typesetting wipe; notes stay muted until their cue is set.

### Ruled Index
Feature, provider, privacy-link, and icon-state lists are ruled rows (2px top, 1px between), not tiles. Privacy links carry a masked arrow that turns cobalt and nudges 4px right on hover.

### Cost Field
A full-cobalt section holding a tabular-figure table with on-cobalt hairlines and thin white bars scaled to cost, which grow left to right on entry (staggered 80ms per row).

### Motion
One easing (cubic-bezier(.16, 1, .3, 1)). Typesetting wipe for translations and glosses (clip-path, about 1-1.2s); a quiet 18px rise-and-fade for sections (.9s). Hover transitions are .2-.45s. Reduced motion removes all transitions and shows finished states.

## Do's and Don'ts

### Do:
- **Do** set every section heading with a cobalt serif gloss beneath it in another script.
- **Do** keep cobalt for translation, gloss, link, focus, and the translation-side fields; keep source text in ink.
- **Do** open content blocks with a 2px ink rule and divide rows with 1px hairlines.
- **Do** put numbers, timecodes, and code in JetBrains Mono with tabular figures, in a margin column where possible.
- **Do** use 2px corners on every bordered control.
- **Do** use the left-to-right typesetting wipe as the only entrance verb for translated text, and show finished states under reduced motion.
- **Do** keep Korean text on keep-all line breaking.

### Don't:
- **Don't** use cards, tiles, or shadowed panels; use rules, margins, and columns.
- **Don't** add a second accent hue; the extension's status-dot colors appear only as data in the icon state guide.
- **Don't** put small uppercase labels or eyebrows above headings; the gloss beneath is the heading's companion.
- **Don't** round controls beyond 2px or use pill shapes.
- **Don't** set running text in the display serif or translation lines in the sans.
