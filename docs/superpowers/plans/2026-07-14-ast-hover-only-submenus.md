# AST Hover-Only Submenus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AST의 원본 자막·번역 스타일 서브메뉴가 hover에서만 열리고, 상위 항목 클릭이 메뉴 상태를 고정하지 않게 한다.

**Architecture:** CSS의 기존 `:hover` 표시 규칙은 유지한다. content script에서 상위 항목 클릭 리스너와 확장 상태를 제거하고, CSS의 `:focus-within` 및 `.open` 표시 경로를 제거해 클릭으로 남는 표시 상태를 없앤다.

**Tech Stack:** Vanilla JavaScript, CSS, Node.js built-in test runner.

## Global Constraints

- 하위 원본 자막·번역 스타일 항목의 선택 클릭은 유지한다.
- 상위 `원본 자막`·`번역 스타일` 항목은 hover 이외에 서브메뉴 열림 상태를 변경하지 않는다.
- 상위 항목 클릭은 이후 별도 기능을 연결할 수 있도록 열기·닫기 동작을 갖지 않는다.

---

### Task 1: AST 상위 메뉴의 hover-only 동작

**Files:**
- Modify: `tests/content-script-youtube.test.mjs:697-764`
- Modify: `extension/content/content-script.js:65-69,271-356,502-515,2530-2545`
- Modify: `extension/content/content-style.css:270-275`

**Interfaces:**
- Consumes: `.ast-source-caption-submenu:hover`, `.ast-translation-style-submenu:hover`
- Produces: 상위 메뉴 클릭 시 유지 상태 없이 hover만으로 표시되는 서브메뉴

- [x] **Step 1: Write the failing tests**

기존 AST 메뉴 테스트에서 두 상위 항목을 클릭한 뒤에도 같은 submenu 객체가 남는지 확인한다. CSS 테스트는 hover 규칙은 존재하고 `:focus-within`·`.open` 표시 규칙은 없다고 확인한다.

```js
sourceToggle.dispatchEvent({ type: "click", stopPropagation: () => {}, preventDefault: () => {} });
assert.equal(menu.children.find((item) => item.className === "ast-source-caption-submenu"), sourceCaptionSubmenu);

assert.match(contentCss, /\.ast-source-caption-submenu:hover \.ast-source-caption-list,/);
assert.doesNotMatch(contentCss, /ast-source-caption-submenu:focus-within|ast-source-caption-submenu\.open/);
assert.doesNotMatch(contentScript, /sourceCaptionMenuExpanded|translationStyleMenuExpanded/);
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test tests/content-script-youtube.test.mjs`

Expected: the top-level click re-renders the menu and CSS/source still contain click-lock paths.

- [x] **Step 3: Write minimal implementation**

Remove `sourceCaptionMenuExpanded` and `translationStyleMenuExpanded`, their top-level click listeners, their `open` class/ARIA-expanded rendering, and the two CSS visibility selectors. Keep lower submenu item click handlers unchanged.

- [x] **Step 4: Run targeted tests to verify they pass**

Run: `node --test tests/content-script-youtube.test.mjs`

Expected: all content-script tests pass, including hover-only static CSS checks and lower submenu selection tests.

- [x] **Step 5: Run repository checks and commit**

Run: `npm test && npm run check && git diff --check`

Expected: all tests, syntax checks, manifest validation, and whitespace checks pass.

Commit:

```bash
git add extension/content/content-script.js extension/content/content-style.css tests/content-script-youtube.test.mjs docs/superpowers/plans/2026-07-14-ast-hover-only-submenus.md
git commit -m "Make AST submenus hover-only"
```
