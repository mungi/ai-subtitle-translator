# AST 원본 자막 메뉴 구분선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 AST 메뉴에서 표시되는 원본 자막 서브메뉴의 바로 위에 기존 AI 자막 번역과 동일한 가로 구분선을 표시한다.

**Architecture:** `renderSourceCaptionMenu()`는 모든 지원 플랫폼이 공유하는 원본 자막 메뉴 렌더 경로다. 선택된 자막이 존재해 서브메뉴를 렌더링하는 경우에만 기존 `ast-provider-menu-separator` 요소를 먼저 추가해, 플랫폼별 CSS와 기존 AI 자막 번역 앞 구분선을 그대로 재사용한다.

**Tech Stack:** Manifest V3 Chrome extension, vanilla JavaScript, Node.js built-in test runner.

## Global Constraints

- 원본 자막·AI 자막 번역·설정 메뉴의 기존 동작과 순서를 바꾸지 않는다.
- 구분선에는 기존 `ast-provider-menu-separator` 클래스와 `role="separator"`를 사용한다.
- YouTube, Udemy, NVIDIA Academy, Vimeo 공통 렌더 경로만 변경한다.
- 원본 자막이 없는 메뉴에는 구분선을 렌더링하지 않는다.

---

### Task 1: 공통 원본 자막 메뉴 구분선

**Files:**
- Modify: `tests/content-script-youtube.test.mjs:704-734`
- Modify: `extension/content/content-script.js:271-314`

**Interfaces:**
- Consumes: `renderSourceCaptionMenu(menu, platform)`, `menu.children`, `ast-source-caption-submenu`
- Produces: 원본 자막 서브메뉴의 직전 형제 요소로 `ast-provider-menu-separator`를 추가한다.

- [x] **Step 1: Write the failing test**

`toolbar button opens a platform-styled provider menu before toggling AST` 테스트에서 원본 자막 서브메뉴를 찾고, 바로 앞 형제의 클래스를 확인한다.

```js
context.document.documentElement.innerHTML = `
  <script>
    var ytInitialPlayerResponse = {"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=abc123def45&lang=en","languageCode":"en","name":{"simpleText":"English"}}]}}};
  </script>
`;
const sourceCaptionSubmenu = menu.children.find((item) => item.className === "ast-source-caption-submenu");
assert.ok(sourceCaptionSubmenu, "expected the source caption submenu to be rendered");
const sourceCaptionIndex = menu.children.indexOf(sourceCaptionSubmenu);
assert.equal(menu.children.at(sourceCaptionIndex - 1).className, "ast-provider-menu-separator");
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/content-script-youtube.test.mjs`

Expected: the new assertion fails because the source caption submenu currently follows the provider items directly.

- [x] **Step 3: Write minimal implementation**

In `renderSourceCaptionMenu()`, immediately after `if (!selectedTrack) return;` and before creating `ast-source-caption-submenu`, append this existing separator shape to `menu`.

```js
const separator = document.createElement("div");
separator.className = "ast-provider-menu-separator";
separator.setAttribute("role", "separator");
menu.append(separator);
```

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/content-script-youtube.test.mjs`

Expected: all content-script tests pass, including the new source-caption separator assertion.

- [x] **Step 5: Run repository checks and commit**

Run: `npm test && npm run check && git diff --check`

Expected: all tests and syntax/manifest checks pass with no whitespace errors.

Commit:

```bash
git add extension/content/content-script.js tests/content-script-youtube.test.mjs docs/superpowers/plans/2026-07-14-ast-source-caption-separator.md
git commit -m "Add separator above source caption menu"
```
