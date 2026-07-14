# Compact Translation Style Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팝업과 AST 메뉴에는 번역 스타일의 이름만 표시하고, 설정 화면의 전체 설명은 유지한다.

**Architecture:** 두 좁은 표시 경로는 로컬라이즈된 스타일 문구를 `공백-하이픈-공백`에서 잘라 앞부분만 렌더링한다. 설정 화면은 기존 메시지 전체를 직접 선택 옵션에 넣는 경로를 변경하지 않는다.

**Tech Stack:** Vanilla JavaScript, Chrome extension content scripts, Node.js built-in test runner.

## Global Constraints

- 팝업과 AST 메뉴는 `Natural`, `Lecture`, `Technical`, `Custom 1`, `Custom 2` 형식만 표시한다.
- 설정 화면의 전체 스타일 설명, 저장된 `translationStyle`, 번역 프롬프트 동작은 유지한다.
- 하이픈 구분자가 없는 로컬라이즈된 문구는 원문 전체를 표시한다.

---

### Task 1: 좁은 UI의 번역 스타일 표기 축약

**Files:**
- Modify: `tests/content-script-youtube.test.mjs:697-757`
- Modify: `tests/app-name.test.mjs:1-43`
- Modify: `extension/content/content-script.js:267-269`
- Modify: `extension/popup/popup.js:37-39`

**Interfaces:**
- Consumes: 로컬라이즈된 `styleNatural`, `styleLecture`, `styleTechnical`, `styleCustom`, `styleCustom2` 메시지
- Produces: `label.split(/\\s+-\\s+/, 1)[0]` 기반의 컴팩트 스타일 이름

- [x] **Step 1: Write the failing tests**

AST 메뉴 테스트에서 현재 선택 스타일의 토글과 다섯 선택지가 이름만 보이는지 확인하고, 팝업의 `formatTranslationStyle()`가 같은 분리 규칙을 쓰는지 확인한다.

```js
const styleSubmenu = menu.children.find((item) => item.className === "ast-translation-style-submenu");
assert.equal(styleSubmenu.children[0].children[0].textContent, "번역 스타일: Custom 1");
assert.deepEqual(
  styleSubmenu.children[1].children.map((item) => item.children[0].textContent),
  ["Natural", "Lecture", "Technical", "Custom 1", "Custom 2"]
);
assert.match(popupJs, /return t\(STYLE_MESSAGE_KEYS\[style\] \|\| "styleNatural"\)\.split\(\/\\s\+-\\s\+\/, 1\)\[0\];/);
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test tests/content-script-youtube.test.mjs tests/app-name.test.mjs`

Expected: AST menu includes the explanatory suffixes and popup source does not split the localized style label.

- [x] **Step 3: Write minimal implementation**

Change only the popup and AST display functions to split the localized message once at ` /\\s+-\\s+/ ` and return the first segment.

```js
return t(STYLE_MESSAGE_KEYS[style] || "styleNatural").split(/\s+-\s+/, 1)[0];
```

- [x] **Step 4: Run targeted tests to verify they pass**

Run: `node --test tests/content-script-youtube.test.mjs tests/app-name.test.mjs tests/options-layout.test.mjs`

Expected: AST and popup compact-display checks pass; the settings-layout test still confirms full Custom 1 and Custom 2 descriptions.

- [x] **Step 5: Run repository checks and commit**

Run: `npm test && npm run check && git diff --check`

Expected: all tests and static checks pass without whitespace errors.

Commit:

```bash
git add extension/content/content-script.js extension/popup/popup.js tests/content-script-youtube.test.mjs tests/app-name.test.mjs docs/superpowers/plans/2026-07-14-compact-translation-style-labels.md
git commit -m "Compact translation style labels in narrow UI"
```
