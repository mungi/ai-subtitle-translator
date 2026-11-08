# 코드 분석

이 문서는 현재 `extension/` 구현을 기준으로 한 개발자용 코드 맵입니다.

## 전체 구조

```text
extension/
  manifest.json                    Chrome MV3 권한, content script, background 등록
  background/service-worker.js      메시지 라우팅, provider 테스트, 모델 조회, 번역 실행 중재
  content/content-script.js         플랫폼 감지, 툴바 버튼, 자막 오버레이, 페이지 재시도
  content/youtube-capture-main.js   YouTube MAIN world의 실제 XHR/fetch 자막 응답 관찰
  content/youtube-capture-bridge.js 격리된 context의 자막 본문 캐시와 대기 요청
  content/content-style.css         툴바/오버레이 스타일
  platforms/
    youtube-captions.js             YouTube track/cue 수집과 fallback
    udemy-captions.js               Udemy caption API와 WebVTT 수집
    ted-captions.js                 TED HLS track 검증과 WebVTT 수집
    vimeo-captions.js               Vimeo 계열 caption URL 검증과 WebVTT 수집
  shared/
    subtitles.js                    내부 cue/document 표준화와 WebVTT 파서
    translation.js                  Google/DeepL/LLM 번역, chunk, cache, fallback
    provider-request.js             LLM provider별 HTTP request/response adapter
    provider-security.js            provider Base URL origin/loopback allowlist
    message-contracts.js             payload와 sender context 검증
    defaults.js                     provider, 언어, 스타일, prompt, subtitle style 기본값
    storage.js                      chrome.storage.local 설정 병합/저장
    secret-fields.js                API key 마스킹과 기존 secret 유지
    secret-storage.js               API key AES-GCM vault와 분산 key share
    settings-backup.js              사용자 백업 비밀번호 기반 설정 파일 암호화·복호화
    provider-guides.js              옵션 화면 provider 안내 문구
    provider-order.js               provider 표시 순서
    provider-key-validation.js      복구된 API key 일괄 연결 테스트와 상태 계산
    model-recommendations.js        provider별 다국어 경량 모델 선택 우선순위
  options/                          설정 UI
  popup/                            플랫폼 enable/disable와 옵션 이동
```

현재 가장 큰 파일은 `content/content-script.js`입니다. 자막 수집 요청 준비, YouTube 페이지 내부 fallback, UI 렌더링, 드래그/resize, 진행 상태 반영이 한 파일에 모여 있어 변경 시 회귀 범위가 넓습니다. 반면 번역과 provider request 계층은 `shared/` 아래로 비교적 잘 분리되어 있습니다.

## 현재 구현 범위

- Udemy, YouTube, TED, NVIDIA Academy, Vimeo의 자막 track을 수집하고 영어 source track을 우선 선택합니다.
- Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, Custom LLM을 번역 provider로 지원합니다.
- 원문 또는 임시 번역을 먼저 표시하고, 선택한 최종 provider의 cue별 번역 결과로 교체합니다.
- 옵션 화면에서 provider, 번역 스타일, 자막 모양, 암호화된 API key 저장, 설정 백업·복구를 관리합니다.
- API key는 AES-GCM vault에 저장하고, content script에는 비밀 정보를 제외한 공개 설정만 전달합니다.

실제 브라우저·외부 provider 검증 항목은 [TASKS.md](../TASKS.md)를 따릅니다.

## 내부 데이터 모델

모든 자막은 먼저 아래 cue 형태로 정규화됩니다.

```ts
type SubtitleCue = {
  id: string;
  start: number;
  end: number;
  text: string;
};

type SubtitleDocument = {
  platform: "youtube" | "udemy" | "ted" | "nvidia" | "vimeo" | "test";
  videoId: string;
  sourceLanguage: string;
  cues: SubtitleCue[];
};
```

`shared/subtitles.js`가 `normalizeCue`, `createSubtitleDocument`, `validateCues`, `parseWebVtt`를 제공하고, 플랫폼별 수집기는 최종적으로 이 모델을 반환합니다. LLM 번역 결과도 cue id 기준으로 다시 병합되므로 `id`, `start`, `end` 보존이 핵심 불변조건입니다.

## 런타임 흐름

1. `content/content-script.js`가 현재 host로 `youtube`, `udemy`, `ted`, `nvidia`, `vimeo`를 감지합니다.
2. 영상 컨트롤 영역에 `ast-toolbar-button`을 주입합니다. 버튼은 플랫폼별 독립 AST provider 메뉴를 엽니다.
3. 사용자가 메뉴에서 AST를 켜거나 provider를 선택하면 현재 플랫폼 handler가 session key와 video element를 확인합니다.
4. content script가 background service worker로 `captions.*.fetchTranscript` 메시지를 보냅니다.
5. `platforms/*-captions.js`가 track을 선택하고 cue를 파싱해 `SubtitleDocument`를 반환합니다.
6. 원문 cue가 먼저 오버레이에 렌더링됩니다.
7. active provider가 LLM이고 임시 provider와 다르면 `temporary` 번역을 먼저 요청합니다.
8. active provider 번역은 `final` 모드로 요청됩니다.
9. background는 `translation.translateDocument`를 받아 `shared/translation.js`를 실행하고, chunk 진행분은 `translation.progress`로 content script에 다시 보냅니다.
10. content script는 진행분을 cue id 기준으로 반영하고, 최종 완료 시 버튼/오버레이 상태를 `complete` 또는 `fallback`으로 바꿉니다.

## 메시지 계약

| 메시지 | 발신 | 수신 | 역할 |
| --- | --- | --- | --- |
| `captions.youtube.fetchTranscript` | content | background | YouTube track/cue 수집 |
| `captions.udemy.fetchTranscript` | content | background | Udemy caption URL/WebVTT 수집 |
| `captions.ted.listTracks` | content | background | TED HLS subtitle track 목록 수집 |
| `captions.ted.fetchTranscript` | content | background | TED caption WebVTT 수집 |
| `captions.vimeo.fetchTranscript` | content | background | NVIDIA Academy/Vimeo caption WebVTT 수집 |
| `translation.translateDocument` | content | background | provider 번역 실행 |
| `translation.progress` | background | content | chunk/cue 진행분 반영 |
| `settings.getPublic` | content | background | API key가 제거된 공개 설정 조회 |
| `settings.updateSubtitleStyle` | content | background | 검증된 자막 위치·폭 patch 저장 |
| `llm.testActiveProvider` | options | background | 선택 provider 연결 테스트 |
| `llm.listModels` | options | background | 모델 목록 조회 |
| `translation.clearCache` | options | background | `translationCache` 삭제 |
| `ast.openOptions` | content | background | 옵션 페이지 열기 |

`shared/message-contracts.js`가 background에서 처리하는 메시지의 필수 payload와 sender를 검증합니다. options page 전용 메시지는 extension page URL에서만, 자막·설정 bridge 메시지는 지원 사이트의 content-script tab에서만 허용합니다. 번역 요청은 표준 subtitle document와 cue 시간 범위를 검사하고, 비정상적으로 큰 요청을 막기 위해 cue 수를 20,000개로 제한합니다. 메시지 필드 변경 시 content/background, 계약 validator와 관련 테스트를 함께 수정해야 합니다.

## 플랫폼별 자막 수집

### YouTube

먼저 `scripting.registerContentScripts`로 등록한 MAIN world 수집기와 격리된 bridge를 `document_start`에 실행합니다. 실제 플레이어의 `timedtext` 응답을 복제해 읽고, 캐시가 없으면 요청한 언어의 네이티브 자막을 잠시 활성화합니다. 응답 또는 타임아웃 후 기존 자막 선택과 활성 상태를 복원합니다. 같은 페이지·origin의 전용 메시지만 처리하고 쿠키·헤더·서명 URL은 전달하지 않습니다. 본문 길이는 최대 2,097,152자, 캐시는 6개로 제한합니다.

네이티브 응답을 얻지 못하면 `platforms/youtube-captions.js`의 기존 경로를 사용합니다.

1. watch page의 `ytInitialPlayerResponse` caption track
2. Android Innertube player fallback
3. timedtext URL payload 후보: 원본 URL, `fmt=json3`, `fmt=srv3`, `fmt=vtt`, fmt 제거 URL
4. transcript panel endpoint fallback
5. background에서 401/403이 나면 page context retry metadata를 내려 content script에서 현재 페이지 fetch로 재시도

지원 파서는 XML `<text>`, JSON3, SRV3 `<p>`, WebVTT, transcript panel renderer입니다. track 선택은 요청 언어가 있으면 manual track을 우선하고, 언어 요청이 없으면 English manual, English auto, manual, 첫 track 순서입니다.

JSON3의 `segs[].tOffsetMs`는 선택적인 cue `words: [{ text, start, end }]`로 보존합니다. 영상 프레임 시각에 따라 원문을 미발화 단어의 `#A3A3A3`에서 설정된 글자색으로 바꾸며 단어 배경은 변경하지 않습니다. 시간 정보가 없거나 잘못되면 원문 단어 길이와 cue의 표시 구간(다음 cue 시작 시각까지)을 기준으로 진행을 추정합니다. 번역문은 단어 순서를 직접 대응시키지 않으며 cue 시간만 따릅니다. 원문과 단어 텍스트는 숫자·16진수 및 중첩 HTML entity를 텍스트로 디코딩합니다.

YouTube 플레이어의 `ad-showing`·`ad-interrupting` 상태는 CSS와 class 변경 관찰로 감지합니다. 광고 중에는 자막과 준비/실패 메시지를 숨기고, 광고 종료 시 본영상의 현재 cue를 다시 표시합니다. 광고 재생 중 네이티브 자막 트랙 활성화와 임시 번역 우선 요청도 중단합니다.

### Udemy

`platforms/udemy-captions.js`는 course id와 lecture id를 사용해 다음 API에서 captions 필드를 읽습니다.

```text
/api-2.0/users/me/subscribed-courses/{courseId}/lectures/{lectureId}/?fields[asset]=captions
```

caption URL의 WebVTT를 받아 `parseWebVtt`로 cue를 생성합니다. 로그인 쿠키와 수강 권한에 의존하므로 실제 QA가 필요합니다.

### TED

`platforms/ted-captions.js`는 TED 페이지의 `__NEXT_DATA__`에서 찾은 HLS master manifest를 `hls.ted.com` HTTPS 경로로 제한합니다. Manifest의 `EXT-X-MEDIA` subtitle 항목을 언어 track으로 만들고 각 `subtitles/{language}/full.vtt`를 읽어 표준 cue로 정규화합니다.

### NVIDIA Academy와 Vimeo

`platforms/vimeo-captions.js`는 Vimeo 계열 player가 제공한 caption URL을 `captions.vimeo.com` 또는 `captions.cloud.vimeo.com` HTTPS host로 제한한 뒤 WebVTT를 읽습니다. NVIDIA Academy는 Vimeo player를 사용하는 강의 화면에서 같은 경로를 사용합니다.

## 번역 계층

`shared/translation.js`의 공개 진입점은 `translateSubtitleDocument(document, options)`입니다.

- Google Translate: `/translate_a/t`에 cue별 `q` form 필드를 반복해서 POST하고 반환 배열을 cue 순서에 대응시킵니다. 언어·클라이언트 옵션은 query에, 자막 텍스트는 body에만 전달합니다. 기존 `/translate_a/single` 기본 설정은 새 주소로 정규화합니다.
- Google Translate 응답 개수·문자열·빈 항목을 검증하고, 잘못된 응답을 원문으로 대체해 성공 처리하지 않습니다. 네트워크·redirect 실패는 오류로 알리고 원문을 유지합니다. 캐시 버전 `v5`에 Google 전용 `google-batch-v1` 표시를 추가해 이전 요청 방식의 캐시는 재사용하지 않습니다.
- DeepL: request body 128 KiB와 request당 50 text 제한을 고려해 chunk를 나눕니다.
- LLM provider: 현재 재생 위치의 첫 1분을 우선 번역하고, 이후 구간을 먼저 처리한 다음 이전 구간을 처리합니다. 일반 청크는 기본 최대 7분을 기준으로 하며 사용자가 2~15분 사이에서 조절할 수 있습니다. 이 범위는 처리 순서를 정하는 단위이며, 실제 LLM 요청은 최대 40 cue·3,000자·시작 시각 기준 90초로 다시 나눕니다. 상한 안에서 문장 끝이나 1.2초 이상 발화 공백을 우선하며, 구두점이 없는 자동 자막에도 상한을 적용합니다. 단일 cue는 분해하지 않으므로 그 cue 자체가 문자·시간 상한보다 클 수 있습니다. 앞뒤 문맥은 각각 최대 4 cue·600자로 제한하고 가까운 문장 경계에서 멈춥니다. 문맥은 ID 없이 참고용으로만 제공하고, 응답 형식에는 번역 대상 ID 전체를 명시합니다. `{ translations: [{ id, text }] }` 응답만 허용합니다.
- LLM 병렬 실행은 저장된 설정 모드에 따라 결정합니다. 간단 설정은 항상 1개, 고급 설정은 기본 3개이며 1~8개로 조절할 수 있습니다. 모드·고급 설정 개수는 저장하며 간단 설정으로 전환해도 고급 설정 개수는 유지합니다. 첫 우선 청크는 단독 완료 후 나머지를 병렬 처리합니다. 작업 큐와 실제 네트워크 요청 제한에 같은 값을 적용하며, 429 응답 시에는 기존 정책에 따라 동시 요청을 1개로 낮춥니다. 설정 변경은 다음 번역 작업부터 적용하며 탭 전체의 전역 제한은 아닙니다.
- LLM 응답은 JSON fence, `<think>` 블록, 일부 loose object 형태를 회복합니다.
- cue 누락·빈 번역·범위 밖 ID 등 응답 검증 실패 시 부분 결과 전체를 폐기합니다. 원래 cue의 ID·시간은 유지하며, 반으로 나누는 재시도는 한 단계로 제한합니다. 계속 실패하면 해당 요청 구간만 Google Translate로 대체하고 다른 구간의 완료 결과는 유지합니다. 대체된 cue ID를 결과·진행 이벤트에 포함하고 별도로 추적합니다. 10초 후 해당 cue만 선택한 모델로 재시도하며 최대 5회로 제한합니다. 재시도에는 대체 번역을 비활성화해 실패할 때 Google Translate를 다시 호출하지 않습니다. 기존 LLM 완료 결과와 대체 번역은 유지하며 모든 대상이 복구되면 예약을 해제합니다. 응답 개수·마지막 청크 표시만으로 완료를 판단하지 않고 실제 cue 충족 여부를 확인합니다. 혼합 결과는 캐시에 저장하지 않습니다. 대체 번역을 포함해 모든 구간이 완료되면 아이콘·배경은 완료 상태로 전환하고 툴팁에는 Google Translate 대체 번역 포함 여부를 표시합니다. 일부 구간을 대체했다는 이유로 전체 영상을 계속 오류 색상으로 표시하지 않습니다. 429는 상태 코드만으로 사용 한도 소진으로 판단하지 않습니다. 일일 한도·잔액 소진이 명확하면 자동 재시도를 중지하고, 분당·초당 요청 제한이면 서버의 Retry-After 또는 RetryInfo 대기 시간을 반영합니다. 원인이 불명확한 429는 요청 제한으로 안내하며 사용 한도 소진으로 단정하지 않습니다. 오류 팝업은 16px 글꼴로 표시합니다.
- 캐시 버전 `v5`는 이전에 잘못 연결된 번역이 다시 사용되지 않도록 이전 버전 캐시를 무효화합니다.
- 쿼터/번역 실패 시 실패 청크에만 Google Translate fallback을 사용합니다. 병렬 작업의 한 구간이 실패해도 전체 영상을 대체 번역하지 않습니다.
- cache key는 platform, videoId, sourceLanguage, targetLanguage, style, 선택한 custom style prompt hash, provider, model, cue hash를 포함합니다.
- cache는 오래된 항목부터 제거하여 최대 30개, 직렬화 기준 약 4 MiB 이내로 유지하며 쓰기를 직렬화합니다.

`shared/provider-request.js`는 provider별 HTTP request와 response text 추출을 담당합니다. OpenAI Responses, Anthropic Messages, Gemini `generateContent`, OpenAI-compatible `chat/completions` 계열을 분기합니다. 요청을 만들기 전에 `shared/provider-security.js`가 hosted provider의 공식 HTTPS origin 또는 Custom LLM의 loopback host/사용자가 승인한 HTTPS origin인지 검증하며, 모델 목록 조회에도 같은 검사를 적용합니다. Provider 요청은 `redirect: "error"`로 자동 redirect를 거부해 allowlist 밖 origin으로 request body나 인증정보가 전달되지 않게 합니다.

## 설정과 secret 저장

일반 설정은 `chrome.storage.local`의 `llmSettings`에 저장됩니다. `storage.js`는 저장값을 `DEFAULT_SETTINGS`와 병합하고, 알려진 provider만 기본 metadata를 유지합니다. 저장 전에는 provider의 `apiKey` 필드를 제거합니다.

manifest는 Chrome 102 이상을 요구하고 service worker는 `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`을 적용합니다. background 메시지는 이 초기화가 끝난 뒤 처리하며 실패하면 fail-closed 응답을 반환합니다. content script는 storage API를 직접 사용하지 않으며 `settings.getPublic`으로 secret이 제거된 설정을 읽고, `settings.updateSubtitleStyle`으로 허용된 위치·폭 숫자만 저장합니다. 설정 변경은 background가 지원 사이트 tab에 공개 설정만 broadcast합니다.

API key는 `secret-storage.js`가 provider별 AES-GCM 암호문으로 별도 vault에 저장합니다. 복호화 seed는 3개 XOR share로 분리한 뒤 서로 다른 순열과 mask를 적용해 분산 저장합니다. 기존 평문 필드는 첫 조회 때 자동 마이그레이션합니다. 옵션 화면에서는 `secret-fields.js`가 앞 6자와 뒤 4자만 보여주고, 사용자가 마스킹 문자열을 그대로 저장하면 기존 secret을 유지합니다.

CST에서 AST로 명칭을 바꾼 현재 초기 개발 단계에서는 storage namespace를 한 번 초기화했습니다. `runtimeIndexV3`는 최초 출시 후 고정하며, 이후 vault 형식 변경은 `VAULT_VERSION`과 `VAULT_MIGRATIONS`의 순차 마이그레이션으로 처리합니다. 일반 설정 구조도 출시 이후에는 같은 원칙으로 이전 버전 데이터를 보존해야 합니다. 알 수 없는 미래 버전이나 마이그레이션 누락은 기존 데이터를 삭제하지 않고 오류로 처리합니다.

마스터 암호 없이 자동 복호화하는 편의성 우선 설계이므로 범용 평문 secret 수집에 대한 방어와 난독화가 목적입니다. 확장 코드와 전체 storage를 함께 분석할 수 있는 표적 공격자에 대해서는 비밀성을 보장하지 않습니다.

## UI 책임

### Content script

`content/content-script.js`가 담당하는 UI 책임은 다음과 같습니다.

- Udemy/YouTube/TED/NVIDIA Academy/Vimeo toolbar target 탐색
- SVG 기반 툴바 버튼과 플랫폼별 독립 provider 메뉴 삽입
- 문서 캡처 단계에서 다른 플레이어 툴바 아이콘 상호작용을 감지해 AST 메뉴를 닫고 메뉴 겹침 방지
- 현재 재생 위치 우선 provider 전환, 선택 저장, request ID 기반 이전 번역 격리

툴바 아이콘은 상태를 색으로 표시한다. 기본 흰색은 꺼짐/원문 상태, 파란색은 활성 상태, 노란색은 임시 번역, 초록색은 현재 cue 최종 번역 준비, 보라색은 전체 최종 번역 완료, 분홍색은 Google Translate 대체 번역이다. 자막 또는 번역 요청 중에는 현재 색상으로 pulse 애니메이션을 표시한다.
- 영상 위 subtitle overlay 생성
- 현재 video time에 맞는 cue 렌더링
- 겹치는 cue는 가장 최근에 시작한 활성 cue를 선택하고, 지원 브라우저에서는 영상 프레임 시각으로 자막 경계를 갱신합니다.
- `자막 표시` 메뉴는 원문 자막, 번역 자막(기본값), 이중 자막(원문 위·번역 아래)을 제공합니다. 번역은 원문 cue의 시간과 `sourceText`를 보존하며, 표시 모드는 검증된 `settings.setSubtitleDisplayMode` 메시지로 저장하고 지원 사이트에 공유합니다.
- 원문과 번역은 별도 줄 요소로 렌더링하고 언어별 `dir`·`lang` 및 `unicode-bidi: isolate`를 적용합니다. 페르시아어·아랍어·히브리어는 RTL, 영상 자막은 가운데 정렬, Udemy 대본 번역은 `text-align: start`로 표시합니다.
- 번역 상태별 버튼 class와 overlay 배경색 적용
- overlay 드래그 위치 저장
- overlay 폭 resize와 높이 자동 제한
- 설정 변경 시 subtitle style 즉시 반영

이 파일은 플랫폼 수집 보조 로직과 UI 로직이 함께 있어, 이후 리팩토링한다면 `youtube-page-retry`, `overlay`, `toolbar`, `session-state` 정도로 분리하는 것이 가장 효과적입니다.

### Options

`options/options.js`는 기본 `간단 설정`과 전체 `고급 설정`을 렌더링합니다. 간단 설정은 Google AI API key 한 개와 연결 확인만 제공하며, 성공 시 Gemini 3.1 Flash Lite를 자동 설정합니다. 고급 설정은 provider tab, provider별 field, 모델 조회, 연결 테스트, target language, translation style, subtitle style preview, cache clear와 설정 백업/복구를 렌더링합니다. 모델 조회가 끝나면 `model-recommendations.js`로 권장 모델을 선택합니다. 온라인 provider는 즉시 연결 테스트해 상태를 갱신하고, Custom LLM은 `google/gemma-4-e4b` 우선 모델 선택까지만 수행합니다. provider field는 `providerFieldDefs`에 모여 있어 provider 추가 시 defaults, request adapter, `provider-security.js` 허용 origin, field 정의, recommendation과 tests를 함께 갱신해야 합니다.

설정 백업은 API key가 복원된 현재 설정을 사용자 백업 비밀번호에서 파생한 AES-GCM key로 암호화해 `.astbackup` 파일로 저장합니다. 복구 선택창과 파일명 검증은 이 확장자만 허용합니다. 백업/복구 비밀번호는 버튼 동작 시 `<dialog>` 기반 마스킹 팝업에서 입력받고 저장하지 않습니다. PBKDF2-SHA-256 250,000회와 파일별 salt/nonce를 사용합니다. 복구는 파일 형식과 payload를 검증한 뒤 기존 `saveSettings` 흐름을 사용하므로 API key는 다시 내부 secret vault에 암호화 저장됩니다. 사용자가 동의하면 `provider-key-validation.js`가 API key가 있는 provider를 순차 테스트하고 성공 상태를 실제 결과로 갱신합니다.

### Popup

`popup/popup.js`는 현재 provider/target language 표시와 지원 사이트 platform toggle 저장을 담당합니다.

## 테스트 커버리지

자동 테스트는 Node 내장 test runner를 사용합니다.

```text
npm test
npm run check
```

주요 커버리지:

- YouTube caption track 선택, timedtext format fallback, transcript panel fallback
- TED HLS manifest track 파싱, caption URL 검증과 WebVTT 수집
- Vimeo/NVIDIA Academy caption URL 검증과 WebVTT 수집
- content script의 YouTube toolbar, translation message sequencing, progress 상태, overlay mount/style
- Google Translate/LLM 응답 정리, cue count/time 보존, fallback
- provider request body와 response text 추출
- provider 모델 목록 조회와 HTTP 오류 메시지
- options layout, provider guide, provider order
- secret masking, target language, default settings, manifest permission

자동 테스트는 실제 Chrome 확장 로드, 지원 사이트 로그인·수강 권한, 실제 provider API key 호출까지 보장하지 않습니다. 이 항목은 `TASKS.md`의 수동 QA 목록으로 남아 있습니다.

## 변경 영향 범위

| 변경 유형 | 확인할 파일 | 우선 테스트 |
| --- | --- | --- |
| 새 provider 추가 | `defaults.js`, `provider-request.js`, `service-worker.js`, `options.js`, `manifest.json` | `provider-request`, `background-service-worker`, `options-layout`, `manifest` |
| YouTube 수집 수정 | `platforms/youtube-captions.js`, `content/content-script.js` | `youtube-captions`, `content-script-youtube` |
| Udemy 수집 수정 | `platforms/udemy-captions.js`, `content/content-script.js` | WebVTT/수동 Udemy QA 추가 필요 |
| TED 수집 수정 | `platforms/ted-captions.js`, `content/content-script.js` | `ted-captions`, `ted-content`, 수동 TED QA |
| Vimeo/NVIDIA Academy 수집 수정 | `platforms/vimeo-captions.js`, `content/content-script.js` | `vimeo-captions`, `content-script-youtube`, 수동 Vimeo/NVIDIA QA |
| subtitle model 변경 | `subtitles.js`, `translation.js`, 플랫폼 수집기, content render | `youtube-captions`, `translation-cleanup`, `content-script-youtube` |
| overlay 스타일 변경 | `content-script.js`, `content-style.css`, `defaults.js`, `options.js` | `content-script-youtube`, `options-layout`, `default-settings` |
| 설정 저장 변경 | `storage.js`, `defaults.js`, `options.js`, `popup.js` | `default-settings`, `secret-fields`, `options-layout` |

## 확인된 리스크와 개선 후보

- `content/content-script.js`가 1900줄 이상이며 플랫폼 fallback과 UI state가 섞여 있습니다. 기능 추가 전 작은 단위로 분리하면 회귀 분석이 쉬워집니다.
- 메시지 payload와 sender context는 검증하지만 content/background가 하나의 생성형 정적 schema를 공유하는 구조는 아닙니다.
- YouTube 내부 구조와 Innertube endpoint는 변경 가능성이 높아 fallback 테스트와 수동 QA가 계속 필요합니다.
- Udemy는 인증/권한/강의 UI 구조에 의존하므로 자동 테스트만으로는 충분하지 않습니다.
- API key 암호화 key도 난독화된 형태로 로컬에 존재하므로 표적 분석에 대한 보안 저장소는 아닙니다. 배포 문서와 개인정보 문구에서 이 범위를 과장하지 않아야 합니다.
- 호스트 권한이 `<all_urls>`이므로 manifest가 네트워크 대상을 제한하지 않습니다. 번역 제공업체는 `provider-security.js` 허용 목록, Udemy·YouTube·TED·Vimeo 자막은 플랫폼별 주소 검사가 유일한 경계이므로 새 fetch 경로를 추가할 때 같은 검사를 거쳐야 합니다.
- `provider-error-sanitizer.js`는 provider 오류를 상태 영역에 보내기 전에 현재 API key의 원문·URL 인코딩 값, 인증 header 값, URL query의 인증 파라미터를 `[redacted]`로 바꿉니다. 모델 목록 조회, 연결 테스트, 백업 복원 뒤 일괄 키 확인에 공통 적용됩니다.
- 번역 cache는 항목 수와 직렬화 용량 기준으로 제한하지만, 설정 화면에서 현재 사용량이나 항목별 제거 기능은 제공하지 않습니다.

### Anthropic 연결 테스트의 추론 설정 비교

- `none`은 `thinking.type=disabled`와 `output_config.effort=low`를 함께 보냅니다. 모델 이름으로 지원을 단정하지 않고, 지원하지 않는 모델의 400/422 응답은 다음 후보로 진행합니다.
- 연결 테스트에서 6 cue 번역 샘플을 `low`, `omit`으로 비교합니다. 명시적 추론 끄기(`none`)는 전체 영상 검증에서 누락·대체 번역이 증가하여 자동 선택 후보에서 제외했습니다. 각 후보는 최대 15초·출력 2,048토큰으로 제한하고, ID·개수·빈 번역 검증에 통과한 후보 중 응답이 가장 빠른 설정을 선택합니다. 인증·서비스 오류는 숨기지 않습니다.
- 추론 프로필에 응답 시간과 API가 보고한 입력·출력·추론 토큰을 저장합니다. 이 프로필은 동일 모델·API 방식·주소에만 적용됩니다. 샘플은 의미 정확도를 전수 판정하지 않으며, 실행별 네트워크 변동에 따라 결과가 달라질 수 있습니다.
- 근거: https://platform.claude.com/docs/en/build-with-claude/thinking-troubleshooting
