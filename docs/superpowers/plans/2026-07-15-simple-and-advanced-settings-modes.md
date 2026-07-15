# 간단 설정과 고급 설정 모드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 옵션 화면을 기본 간단 설정과 전체 고급 설정으로 나누고, Google AI API Key 하나로 Gemini 3.1 Flash Lite 연결을 구성한다.

**Architecture:** 순수 설정 전환 로직은 `extension/shared/simple-google-settings.js`로 분리해 DOM 없이 테스트한다. 옵션 화면은 이 모듈로 키·모델·연결 상태를 저장하고, 고급 화면의 기존 섹션과 이벤트는 유지한다. 간단 화면의 안내 문구는 기존 Google 안내 메시지를 재사용하되 링크는 전용 두 개로 제한한다.

**Tech Stack:** Manifest V3 Chrome extension, ES modules, Node.js built-in test runner, CSS, Chrome i18n JSON.

## Global Constraints

- 기본 선택 탭은 페이지를 열 때마다 `simple`이며 저장하지 않는다.
- 간단 설정의 유일한 입력 필드는 Google AI API Key이며 저장된 키는 기존 마스킹 규칙을 따른다.
- 간단 설정에서 모델은 반드시 `gemini-3.1-flash-lite`다.
- Google 연결 검증 성공 때만 활성 Provider를 `google`로 바꾼다. 실패·빈 키는 기존 활성 Provider를 유지한다.
- 간단 설정 링크는 Google AI Studio `Get API Key`와 `https://www.youtube.com/watch?v=PLACEHOLDER`뿐이다.
- 모든 신규 문구는 한국어를 원본으로 작성하고 영어·일본어를 같은 키 구조로 동기화한다.
- YouTube와 Udemy 자막 기능 및 기존 고급 설정 동작을 변경하지 않는다.

---

### Task 1: 순수 Google 간단 설정 전환 로직

**Files:**
- Create: `extension/shared/simple-google-settings.js`
- Create: `tests/simple-google-settings.test.mjs`

**Interfaces:**
- Consumes: `resolveSecretFieldValue(visibleValue, storedValue)` from `extension/shared/secret-fields.js`.
- Produces: `SIMPLE_GOOGLE_MODEL`, `SIMPLE_GOOGLE_GUIDE_LINKS`, `stageSimpleGoogleApiKey(settings, visibleValue)`, `applySimpleGoogleTestResult(settings, ok)`.
- `stageSimpleGoogleApiKey` returns a new settings object, preserves every non-Google setting, resolves an unchanged masked key, enforces the model, and clears only Google’s previous connection-success state.
- `applySimpleGoogleTestResult` returns a new settings object. `ok === true` records Google success and activates Google; `ok === false` removes Google success and leaves `activeProvider` unchanged.

- [ ] **Step 1: Write the failing tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { maskSecretValue } from "../extension/shared/secret-fields.js";
import {
  SIMPLE_GOOGLE_GUIDE_LINKS,
  SIMPLE_GOOGLE_MODEL,
  applySimpleGoogleTestResult,
  stageSimpleGoogleApiKey
} from "../extension/shared/simple-google-settings.js";

function createSettings() {
  return {
    activeProvider: "openai",
    providers: {
      google: { apiKey: "stored-google-key", model: "older-model" },
      openai: { apiKey: "stored-openai-key" }
    },
    providerTestStatus: { google: "success", openai: "success" }
  };
}

test("staging a Google key preserves an untouched masked key and enforces Flash Lite", () => {
  const next = stageSimpleGoogleApiKey(createSettings(), maskSecretValue("stored-google-key"));
  assert.equal(next.providers.google.apiKey, "stored-google-key");
  assert.equal(next.providers.google.model, "gemini-3.1-flash-lite");
  assert.equal(next.providerTestStatus.google, undefined);
  assert.equal(next.providerTestStatus.openai, "success");
});

test("a successful simple Google test activates Google", () => {
  const next = applySimpleGoogleTestResult(stageSimpleGoogleApiKey(createSettings(), "new-google-key"), true);
  assert.equal(next.providers.google.apiKey, "new-google-key");
  assert.equal(next.activeProvider, "google");
  assert.equal(next.providerTestStatus.google, "success");
});

test("a failed simple Google test preserves the active provider", () => {
  const next = applySimpleGoogleTestResult(stageSimpleGoogleApiKey(createSettings(), "new-google-key"), false);
  assert.equal(next.activeProvider, "openai");
  assert.equal(next.providerTestStatus.google, undefined);
});

test("simple settings expose only the required API key and dummy YouTube links", () => {
  assert.deepEqual(SIMPLE_GOOGLE_GUIDE_LINKS, [
    { label: "Get API Key", url: "https://aistudio.google.com/api-keys" },
    { label: "YouTube 설정 가이드", url: "https://www.youtube.com/watch?v=PLACEHOLDER" }
  ]);
  assert.equal(SIMPLE_GOOGLE_MODEL, "gemini-3.1-flash-lite");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/simple-google-settings.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `extension/shared/simple-google-settings.js`.

- [ ] **Step 3: Write the minimal shared implementation**

```js
import { resolveSecretFieldValue } from "./secret-fields.js";

export const SIMPLE_GOOGLE_MODEL = "gemini-3.1-flash-lite";
export const SIMPLE_GOOGLE_GUIDE_LINKS = [
  { label: "Get API Key", url: "https://aistudio.google.com/api-keys" },
  { label: "YouTube 설정 가이드", url: "https://www.youtube.com/watch?v=PLACEHOLDER" }
];

function withoutGoogleTestSuccess(providerTestStatus = {}) {
  const { google, ...remaining } = providerTestStatus;
  return remaining;
}

export function stageSimpleGoogleApiKey(settings, visibleValue) {
  const google = settings.providers.google;
  return {
    ...settings,
    providers: {
      ...settings.providers,
      google: {
        ...google,
        apiKey: resolveSecretFieldValue(visibleValue, google.apiKey),
        model: SIMPLE_GOOGLE_MODEL
      }
    },
    providerTestStatus: withoutGoogleTestSuccess(settings.providerTestStatus)
  };
}

export function applySimpleGoogleTestResult(settings, ok) {
  const providerTestStatus = withoutGoogleTestSuccess(settings.providerTestStatus);
  if (!ok) return { ...settings, providerTestStatus };
  return {
    ...settings,
    activeProvider: "google",
    providerTestStatus: { ...providerTestStatus, google: "success" }
  };
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test tests/simple-google-settings.test.mjs`

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit the tested shared behavior**

```bash
git add extension/shared/simple-google-settings.js tests/simple-google-settings.test.mjs
git commit -m "Add simple Google settings state helpers"
```

### Task 2: 옵션 화면 탭과 간단 설정 패널

**Files:**
- Modify: `extension/options/options.html:12-25`
- Modify: `extension/options/options.html:27-250`
- Modify: `extension/options/options.css:140-180`
- Modify: `tests/options-layout.test.mjs`

**Interfaces:**
- Consumes: static IDs `settingsModeTabs`, `simpleSettingsPanel`, `advancedSettingsPanel`, `simpleGoogleApiKey`, and `simpleSettingsStatus` from the options document.
- Produces: two accessible buttons with `role="tab"` and connected `role="tabpanel"` containers. Existing advanced setting IDs remain within `advancedSettingsPanel`.

- [ ] **Step 1: Write the failing layout and localization tests**

```js
test("settings mode tabs default to a focused Google API key simple panel", () => {
  const headerEnd = optionsHtml.indexOf("</header>");
  const tabsIndex = optionsHtml.indexOf('id="settingsModeTabs"');
  const simpleIndex = optionsHtml.indexOf('id="simpleSettingsPanel"');
  const advancedIndex = optionsHtml.indexOf('id="advancedSettingsPanel"');

  assert.ok(tabsIndex > headerEnd);
  assert.ok(simpleIndex > tabsIndex);
  assert.ok(advancedIndex > simpleIndex);
  assert.match(optionsHtml, /id="simpleSettingsTab"[^>]*role="tab"[^>]*aria-selected="true"/);
  assert.match(optionsHtml, /id="advancedSettingsTab"[^>]*role="tab"[^>]*aria-selected="false"/);
  assert.match(optionsHtml, /id="simpleGoogleApiKey" type="password" autocomplete="off"/);
  assert.match(optionsHtml, /id="simpleSettingsStatus"[^>]*role="status"/);
  assert.match(optionsHtml, /id="advancedSettingsPanel"[^>]*hidden/);
  assert.equal(message("ko", "simpleSettingsTab"), "간단 설정");
  assert.equal(message("en", "simpleSettingsTab"), "Simple Settings");
  assert.equal(message("ja", "simpleSettingsTab"), "かんたん設定");
  assert.match(optionsCss, /\.settings-mode-tabs\s*\{/);
  assert.match(optionsCss, /\.settings-mode-tabs button\.active\s*\{/);
});

test("simple settings retain the existing Google guide but expose exactly two links", () => {
  const simpleStart = optionsHtml.indexOf('id="simpleSettingsPanel"');
  const simpleEnd = optionsHtml.indexOf("</section>", simpleStart);
  const simpleHtml = optionsHtml.slice(simpleStart, simpleEnd);

  assert.match(simpleHtml, /id="simpleGoogleGuide"/);
  assert.match(simpleHtml, /id="simpleGoogleGuideLinks"/);
  assert.doesNotMatch(simpleHtml, /id="providerTabs"/);
  assert.match(optionsJs, /SIMPLE_GOOGLE_GUIDE_LINKS/);
  assert.match(optionsJs, /getProviderGuide\("google"\)\.text/);
});
```

- [ ] **Step 2: Run the focused layout test to verify it fails**

Run: `node --test tests/options-layout.test.mjs`

Expected: FAIL because the settings-mode tab IDs and simple panel are absent.

- [ ] **Step 3: Add the structural HTML and CSS**

Place after `</header>`:

```html
<div id="settingsModeTabs" class="settings-mode-tabs" role="tablist" data-i18n-aria-label="settingsModeLabel">
  <button id="simpleSettingsTab" type="button" role="tab" aria-controls="simpleSettingsPanel" aria-selected="true" data-settings-mode="simple" data-i18n="simpleSettingsTab"></button>
  <button id="advancedSettingsTab" type="button" role="tab" aria-controls="advancedSettingsPanel" aria-selected="false" data-settings-mode="advanced" data-i18n="advancedSettingsTab"></button>
</div>
<section id="simpleSettingsPanel" class="settings-section simple-settings-panel" role="tabpanel" aria-labelledby="simpleSettingsTab">
  <div class="section-title-row"><h2 data-i18n="simpleSettingsTitle"></h2></div>
  <label class="simple-google-key-field"><span data-i18n="simpleGoogleApiKey"></span><input id="simpleGoogleApiKey" type="password" autocomplete="off" spellcheck="false"></label>
  <p id="simpleGoogleGuide" class="provider-note"></p>
  <div id="simpleGoogleGuideLinks" class="provider-note-links"></div>
  <p id="simpleSettingsStatus" class="status-line" role="status"></p>
</section>
<div id="advancedSettingsPanel" role="tabpanel" aria-labelledby="advancedSettingsTab" hidden>
  <!-- Move every existing settings-section here without changing its IDs. -->
</div>
```

Add CSS that gives the tab list the same panel spacing as sections, uses the active tab’s accent border/background, and hides `[hidden]` panels with `display: none`. Keep existing `.settings-section` styles and do not alter the existing provider-tab styles.

- [ ] **Step 4: Run the focused layout test to verify it passes**

Run: `node --test tests/options-layout.test.mjs`

Expected: PASS with all existing layout tests plus the two new tests passing.

- [ ] **Step 5: Commit the tested options layout**

```bash
git add extension/options/options.html extension/options/options.css tests/options-layout.test.mjs
git commit -m "Add simple and advanced settings panels"
```

### Task 3: 간단 설정 저장·검증·탭 전환 연결

**Files:**
- Modify: `extension/options/options.js:1-180`
- Modify: `extension/options/options.js:1218-1382`
- Modify: `tests/options-layout.test.mjs`

**Interfaces:**
- Consumes: Task 1 helper exports and Task 2 element IDs.
- Produces: `setSettingsMode(mode)`, `renderSimpleGoogleSettings()`, `testSimpleGoogleApiKey()`.
- `testSimpleGoogleApiKey()` saves staged settings, sends `llm.testActiveProvider` with `providerId: "google"`, applies the returned result, re-renders the simple panel and existing advanced controls, and reports status locally.

- [ ] **Step 1: Extend the failing layout test for behavior wiring**

```js
test("simple settings use the Google helper, test the key, and retain the current provider on failure", () => {
  assert.match(optionsJs, /import \{[\s\S]*stageSimpleGoogleApiKey[\s\S]*applySimpleGoogleTestResult[\s\S]*\} from "\.\.\/shared\/simple-google-settings\.js"/);
  assert.match(optionsJs, /function setSettingsMode\(mode\)/);
  assert.match(optionsJs, /function renderSimpleGoogleSettings\(\)/);
  assert.match(optionsJs, /async function testSimpleGoogleApiKey\(\)/);
  assert.match(optionsJs, /settings = stageSimpleGoogleApiKey\(settings, simpleGoogleApiKeyInput\.value\);/);
  assert.match(optionsJs, /type: "llm\.testActiveProvider",\s*providerId: "google"/);
  assert.match(optionsJs, /settings = applySimpleGoogleTestResult\(settings, response\?\.ok\);/);
  assert.match(optionsJs, /simpleGoogleApiKeyInput\.addEventListener\("change"/);
  assert.match(optionsJs, /setSettingsMode\("simple"\);/);
});
```

- [ ] **Step 2: Run the focused layout test to verify it fails**

Run: `node --test tests/options-layout.test.mjs`

Expected: FAIL because no simple settings functions or handler exist.

- [ ] **Step 3: Wire minimal behavior into `options.js`**

Import Task 1 exports and define document references for the two mode tabs, panels, simple key input, guide, guide links, and local status. Implement:

```js
function setSettingsMode(mode) {
  const isSimple = mode === "simple";
  simpleSettingsPanel.hidden = !isSimple;
  advancedSettingsPanel.hidden = isSimple;
  simpleSettingsTab.setAttribute("aria-selected", String(isSimple));
  advancedSettingsTab.setAttribute("aria-selected", String(!isSimple));
  simpleSettingsTab.classList.toggle("active", isSimple);
  advancedSettingsTab.classList.toggle("active", !isSimple);
}

function renderSimpleGoogleSettings() {
  simpleGoogleApiKeyInput.value = maskSecretValue(settings.providers.google.apiKey);
  simpleGoogleGuide.textContent = getProviderGuide("google").text;
  simpleGoogleGuideLinks.replaceChildren(...SIMPLE_GOOGLE_GUIDE_LINKS.map((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label;
    return anchor;
  }));
}

async function testSimpleGoogleApiKey() {
  settings = stageSimpleGoogleApiKey(settings, simpleGoogleApiKeyInput.value);
  await saveSettings(settings);
  if (!settings.providers.google.apiKey) {
    setSimpleSettingsStatus(t("simpleGoogleApiKeyRequired"), "error");
    return;
  }
  setSimpleSettingsStatus(t("simpleGoogleTesting"));
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: "llm.testActiveProvider", providerId: "google" });
  } catch (error) {
    response = { ok: false, error: error.message };
  }
  settings = applySimpleGoogleTestResult(settings, response?.ok);
  settings = await saveSettings(settings);
  renderAll();
  setSimpleSettingsStatus(response?.ok ? t("simpleGoogleTestSuccess") : `${t("simpleGoogleTestFailed")}: ${response?.error || "Unknown error"}`, response?.ok ? "success" : "error");
}
```

In `renderAll()`, call `renderSimpleGoogleSettings()` and `setSettingsMode("simple")`. In `init()`, add click handlers for both tabs and a `change` handler that calls `testSimpleGoogleApiKey()` with an error catch that preserves the existing active Provider and shows the local failure status. Do not attach the advanced `providerForm` listener to the simple key input.

- [ ] **Step 4: Run the focused layout test to verify it passes**

Run: `node --test tests/options-layout.test.mjs`

Expected: PASS with every options layout assertion green.

- [ ] **Step 5: Commit the tested interaction wiring**

```bash
git add extension/options/options.js tests/options-layout.test.mjs
git commit -m "Wire simple Google API key setup"
```

### Task 4: 세 언어 문자열과 전체 검증

**Files:**
- Modify: `extension/_locales/ko/messages.json`
- Modify: `extension/_locales/en/messages.json`
- Modify: `extension/_locales/ja/messages.json`
- Modify: `tests/options-layout.test.mjs`

**Interfaces:**
- Consumes: message keys `settingsModeLabel`, `simpleSettingsTab`, `advancedSettingsTab`, `simpleSettingsTitle`, `simpleGoogleApiKey`, `simpleGoogleApiKeyRequired`, `simpleGoogleTesting`, `simpleGoogleTestSuccess`, `simpleGoogleTestFailed`.
- Produces: complete Korean, English, and Japanese labels used by the Task 2 HTML and Task 3 behavior.

- [ ] **Step 1: Write the failing localization assertions**

```js
test("simple settings messages are synchronized in Korean, English, and Japanese", () => {
  assert.equal(message("ko", "advancedSettingsTab"), "고급 설정");
  assert.equal(message("en", "advancedSettingsTab"), "Advanced Settings");
  assert.equal(message("ja", "advancedSettingsTab"), "詳細設定");
  for (const locale of ["ko", "en", "ja"]) {
    for (const key of ["settingsModeLabel", "simpleSettingsTitle", "simpleGoogleApiKey", "simpleGoogleApiKeyRequired", "simpleGoogleTesting", "simpleGoogleTestSuccess", "simpleGoogleTestFailed"]) {
      assert.ok(message(locale, key), `${locale} should define ${key}`);
    }
  }
});
```

- [ ] **Step 2: Run the focused layout test to verify it fails**

Run: `node --test tests/options-layout.test.mjs`

Expected: FAIL because the new i18n keys are absent.

- [ ] **Step 3: Add the synchronized message values**

Add the following values to each locale JSON while preserving valid JSON syntax:

| Key | Korean | English | Japanese |
| --- | --- | --- | --- |
| `settingsModeLabel` | 설정 모드 | Settings mode | 設定モード |
| `simpleSettingsTab` | 간단 설정 | Simple Settings | かんたん設定 |
| `advancedSettingsTab` | 고급 설정 | Advanced Settings | 詳細設定 |
| `simpleSettingsTitle` | Google AI로 빠르게 시작하기 | Get started quickly with Google AI | Google AI ですぐに始める |
| `simpleGoogleApiKey` | Google AI API Key | Google AI API Key | Google AI API Key |
| `simpleGoogleApiKeyRequired` | Google AI API Key를 입력하세요. | Enter a Google AI API Key. | Google AI API Key を入力してください。 |
| `simpleGoogleTesting` | Google AI 연결을 확인하는 중입니다. | Checking the Google AI connection. | Google AI の接続を確認しています。 |
| `simpleGoogleTestSuccess` | Google AI 연결을 확인했고 Gemini 3.1 Flash Lite를 활성화했습니다. | Google AI is connected and Gemini 3.1 Flash Lite is active. | Google AI に接続し、Gemini 3.1 Flash Lite を有効にしました。 |
| `simpleGoogleTestFailed` | Google AI 연결에 실패했습니다. 기존 번역 엔진을 유지합니다. | Google AI connection failed. Your current translation provider is unchanged. | Google AI への接続に失敗しました。現在の翻訳プロバイダーを維持します。 |

- [ ] **Step 4: Run the full verification suite**

Run: `npm test`

Expected: PASS with 0 failures.

Run: `npm run check`

Expected: exit 0 and `manifest ok`.

- [ ] **Step 5: Commit localizations and verification-tested feature**

```bash
git add extension/_locales/ko/messages.json extension/_locales/en/messages.json extension/_locales/ja/messages.json tests/options-layout.test.mjs
git commit -m "Localize simple settings mode"
```
