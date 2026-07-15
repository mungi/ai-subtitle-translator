# Google AI Studio API 키 발급 안내 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 간단 설정 패널에서만 Google AI Studio API 키 발급 절차, 무료 등급 한도 안내, 명시적 API 키 연결 확인을 제공한다.

**Architecture:** 간단 설정 패널에 정적이고 접근 가능한 다섯 단계 안내 블록과 명시적 연결 확인 버튼을 둔다. 키 변경은 Flash Lite 설정만 자동 저장하고, 버튼이 기존 Google 연결 검증을 실행해 상태 메시지에 결과를 표시한다.

**Tech Stack:** Manifest V3 옵션 페이지 HTML/CSS/ES modules, Chrome i18n JSON, Node 내장 테스트 러너.

## Global Constraints

- 가이드는 simpleSettingsPanel 아래에만 렌더링하고 advancedSettingsPanel에는 렌더링하지 않는다.
- 간단 설정의 API 키 입력은 한 개만 유지하며 기존 저장·마스킹을 유지한다. 키 변경은 Flash Lite 설정을 자동 저장하고, 연결 검증은 `API 키 확인` 버튼으로만 실행한다.
- 가이드는 로그인, 처음 사용하는 경우의 영문 프로젝트 생성, 키 생성·복사, 무료 등급 확인, 복사·입력과 `API 키 확인` 버튼의 명시적 연결 확인의 다섯 단계다.
- 키를 공유하거나 공개 문서에 넣지 말라는 주의 문구를 표시한다.
- 한국어를 원본으로 영어·일본어 메시지를 같은 키 구조로 동기화한다.
- 링크는 Google AI Studio API 키 페이지와 기존 더미 YouTube 설정 가이드만 유지한다.
- 무료 등급에는 사용 한도가 있고 일일 요청 한도는 미국 태평양 시간 자정에 초기화된다는 안내를 표시한다.

---

### Task 1: 간단 설정 가이드의 실패 테스트 작성

**Files:**
- Modify: tests/options-layout.test.mjs:49-103
- Modify: tests/simple-google-settings.test.mjs:74-80

**Interfaces:**
- Consumes: SIMPLE_GOOGLE_GUIDE_LINKS from extension/shared/simple-google-settings.js.
- Produces: simple-panel-only guide structure and localized link-label expectations.

- [ ] **Step 1: Write the failing layout and locale assertions**

~~~js
test("simple settings contain the Google AI Studio key guide only", () => {
  const simpleStart = optionsHtml.indexOf('id="simpleSettingsPanel"');
  const simpleEnd = optionsHtml.indexOf("</section>", simpleStart);
  const advancedStart = optionsHtml.indexOf('id="advancedSettingsPanel"');
  const advancedEnd = optionsHtml.indexOf("</div>", advancedStart);
  const simpleHtml = optionsHtml.slice(simpleStart, simpleEnd);
  const advancedHtml = optionsHtml.slice(advancedStart, advancedEnd);

  assert.match(simpleHtml, /id="simpleGoogleKeyGuide"/);
  assert.match(simpleHtml, /simpleGoogleKeyGuideStep1[\s\S]*simpleGoogleKeyGuideStep5/);
  assert.match(simpleHtml, /data-i18n="simpleGoogleKeySecurityNotice"/);
  assert.doesNotMatch(advancedHtml, /simpleGoogleKeyGuide/);
});
~~~

Add the guide-title, four-step, security-notice, and both link-label keys to the synchronized locale key list. Change the shared-link expectation to message keys simpleGoogleGetApiKey and simpleGoogleYoutubeGuide.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: node --test tests/options-layout.test.mjs tests/simple-google-settings.test.mjs

Expected: FAIL because the guide block and localized labelKey fields do not exist yet.

- [ ] **Step 3: Commit the failing tests**

~~~bash
git add tests/options-layout.test.mjs tests/simple-google-settings.test.mjs
git commit -m "Test Google AI Studio key guide"
~~~

### Task 2: 간단 설정 전용 가이드와 현지화 구현

**Files:**
- Modify: extension/options/options.html:32-42
- Modify: extension/options/options.css:158-172
- Modify: extension/options/options.js:1148-1161
- Modify: extension/shared/simple-google-settings.js:3-7
- Modify: extension/_locales/ko/messages.json:17-45
- Modify: extension/_locales/en/messages.json:17-45
- Modify: extension/_locales/ja/messages.json:17-45

**Interfaces:**
- SIMPLE_GOOGLE_GUIDE_LINKS becomes an array of { labelKey, url }.
- renderSimpleGoogleSettings() renders every link with t(link.labelKey).
- Static HTML guide uses data-i18n keys: simpleGoogleKeyGuideTitle, simpleGoogleKeyGuideStep1, simpleGoogleKeyGuideStep2, simpleGoogleKeyGuideStep3, simpleGoogleKeyGuideStep4, simpleGoogleKeyGuideStep5, simpleGoogleKeySecurityNotice.

- [ ] **Step 1: Add the guide directly after the existing simple Google provider note**

~~~html
<section id="simpleGoogleKeyGuide" class="simple-google-key-guide" aria-labelledby="simpleGoogleKeyGuideTitle">
  <h3 id="simpleGoogleKeyGuideTitle" data-i18n="simpleGoogleKeyGuideTitle"></h3>
  <ol>
    <li data-i18n="simpleGoogleKeyGuideStep1"></li>
    <li data-i18n="simpleGoogleKeyGuideStep2"></li>
    <li data-i18n="simpleGoogleKeyGuideStep3"></li>
    <li data-i18n="simpleGoogleKeyGuideStep4"></li>
    <li data-i18n="simpleGoogleKeyGuideStep5"></li>
  </ol>
  <p class="simple-google-key-security-notice" data-i18n="simpleGoogleKeySecurityNotice"></p>
</section>
~~~

Keep this block inside simpleSettingsPanel and before simpleGoogleGuideLinks. Do not add it to the advanced panel.

- [ ] **Step 2: Style only the guide block**

~~~css
.simple-google-key-guide {
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.simple-google-key-guide h3 { margin: 0; }
.simple-google-key-guide ol { margin: 10px 0; padding-left: 22px; }
.simple-google-key-security-notice { margin: 0; }
~~~

Use the nearest existing color custom properties if needed; do not introduce page-wide style changes.

- [ ] **Step 3: Localize labels, steps, and link captions**

Add these simple-settings keys to Korean, English, and Japanese: simpleGoogleGetApiKey, simpleGoogleKeyGuideTitle, simpleGoogleKeyGuideStep1, simpleGoogleKeyGuideStep2, simpleGoogleKeyGuideStep3, simpleGoogleKeyGuideStep4, simpleGoogleKeyGuideStep5, simpleGoogleKeySecurityNotice.

Korean uses Google AI API 키, API 키 발급하기, and five concise user actions, including an English project name example and free-tier check. English and Japanese convey the same steps. Replace raw link labels with:

~~~js
export const SIMPLE_GOOGLE_GUIDE_LINKS = [
  { labelKey: "simpleGoogleGetApiKey", url: "https://aistudio.google.com/api-keys" },
  { labelKey: "simpleGoogleYoutubeGuide", url: "https://www.youtube.com/watch?v=PLACEHOLDER" }
];
~~~

Then render links with anchor.textContent = t(link.labelKey).

- [ ] **Step 4: Run focused tests and verify they pass**

Run: node --test tests/options-layout.test.mjs tests/simple-google-settings.test.mjs

Expected: PASS with the simple-only guide, localized message keys, and the two original URLs.

- [ ] **Step 5: Commit the implementation**

~~~bash
git add extension/options/options.html extension/options/options.css extension/options/options.js extension/shared/simple-google-settings.js extension/_locales/ko/messages.json extension/_locales/en/messages.json extension/_locales/ja/messages.json tests/options-layout.test.mjs tests/simple-google-settings.test.mjs
git commit -m "Add Google AI Studio key guide"
~~~

### Task 3: 전체 회귀 검증

**Files:**
- Verify only: all files changed in Tasks 1 and 2.

**Interfaces:**
- Consumes: final options UI, shared guide-link data, and synchronized locale messages.
- Produces: verified main worktree without whitespace errors.

- [ ] **Step 1: Run the complete test suite**

Run: npm test

Expected: PASS with no failed tests.

- [ ] **Step 2: Run syntax and manifest validation**

Run: npm run check

Expected: manifest ok and exit status 0.

- [ ] **Step 3: Check the final patch**

Run: git diff --check HEAD^..HEAD && git status --short

Expected: no whitespace errors and a clean worktree.
