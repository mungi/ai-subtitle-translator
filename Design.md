# Design.md

현재 Chrome 확장 구현 구조와 주요 설계 결정입니다.

## 목표

Udemy와 YouTube의 자막을 수집하고, 전체 subtitle 문맥을 활용해 자연스러운 번역 자막을 제공한다. 빠른 표시를 위해 Google Translate cue 번역을 먼저 보여주고, LLM/DeepL 등 최종 provider 번역이 완료되면 교체한다.

## 구현 구조

```text
extension/
  manifest.json
  background/
    service-worker.js
  content/
    content-script.js
    content-style.css
  platforms/
    youtube-captions.js
    udemy-captions.js
  shared/
    defaults.js
    provider-request.js
    storage.js
    subtitles.js
    translation.js
  popup/
  options/
```

## 핵심 데이터 모델

```ts
type SubtitleCue = {
  id: string;
  start: number;
  end: number;
  text: string;
};

type SubtitleDocument = {
  platform: "youtube" | "udemy" | "test";
  videoId: string;
  sourceLanguage: string;
  cues: SubtitleCue[];
};
```

## 자막 수집

- YouTube: watch 페이지에서 player config/caption track을 찾아 transcript XML을 수집한다.
- Udemy: course/lecture id를 추출하고 `/api-2.0/users/me/subscribed-courses/{courseId}/lectures/{lectureId}/?fields[asset]=captions`에서 caption URL을 가져온다.
- 기본 source language는 영어 track을 우선 선택한다.

## 번역 흐름

1. 자막 토글 버튼 클릭 시 원문 cue를 먼저 오버레이에 렌더링한다.
2. Google Translate cue 번역을 항상 시작하고, 이 상태는 노란색 아이콘으로 표시한다.
3. 사용자가 선택한 active provider로 전체 번역을 background에서 실행한다. LLM provider를 선택한 경우에만 설정된 임시 provider 번역을 먼저 표시할 수 있다.
4. LLM provider는 전체 subtitle JSON을 chunk 단위로 보내고, cue id 기준으로 결과를 병합한다. 현재 재생 위치의 1분을 우선 처리한 뒤 이후 구간을 먼저, 이전 구간을 나중에 처리한다. 일반 청크는 기본 최대 7분을 기준으로 하며 사용자가 2~15분 사이에서 조절할 수 있다. 내부 안전 상한은 24,000자·500 cue다. 응답이 불완전하면 해당 청크만 반으로 나눠 재시도한다.
5. 최종 번역이 완료되면 오버레이 cue를 교체하고 아이콘을 완료색으로 바꾼다.
6. LLM 실패 시 설정된 fallback provider를 사용한다. 기본 fallback은 Google Translate다.

## Provider

- Google Translate: API key 없는 `translate.googleapis.com/translate_a/single` 기반 cue 번역.
- DeepL: Free/Pro API.
- OpenAI: Responses API.
- Anthropic: Messages API.
- Google Gemini: `generateContent` API.
- OpenRouter: OpenAI 호환 `chat/completions`.
- NVIDIA NIM: OpenAI 호환 `chat/completions`.
- Local LLM: OpenAI 호환 `chat/completions`. Base URL은 최종 요청 URL에서 `/chat/completions` 직전까지만 입력한다.

OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA NIM, Local LLM은 옵션 화면에서 모델 목록을 불러올 수 있다. Local LLM API key는 선택 사항이다.

모델 목록 조회 후에는 실제 반환 목록에서 권장 모델을 자동 선택하고 저장한다. Google AI는 `gemini-3.1-flash-lite`, OpenAI는 `gpt-5.6-luna`, Anthropic은 `claude-haiku-4-5-20251001`, OpenRouter는 `deepseek/deepseek-v4-flash`, NVIDIA NIM은 `openai/gpt-oss-120b`를 최우선으로 선택하고 연결 테스트를 한 번 수행한다. Local LLM은 `google/gemma-4-e4b`를 최우선으로 선택하지만 자동 연결 테스트는 실행하지 않는다. 해당 ID가 없으면 Flash-Lite, Haiku, Qwen/Gemma 소형 instruct 계열을 우선하고, 없으면 사용 가능한 첫 text model로 fallback한다. audio, realtime, transcription, image, embedding 등 자막 번역에 맞지 않는 변형은 추천 대상에서 제외한다.

## 번역 스타일

- Natural: 자연스러운 일상 문장 중심.
- Lecture: 강의/튜토리얼 흐름에 맞춘 설명형 문장.
- Technical: 기술 용어와 code identifier 일관성 우선.
- Custom 1: 기존 일타 강사형 system prompt를 사용자가 직접 편집.
- Custom 2: 친절한 초보자 교사형 system prompt를 사용자가 직접 편집.

모든 스타일은 cue id와 cue 개수를 유지하는 JSON 응답 형식을 요구하며, target language는 저장된 설정에서 주입한다.

## 캐시

번역 캐시는 `chrome.storage.local`의 `translationCache`에 저장한다. 캐시 키는 platform, videoId, sourceLanguage, targetLanguage, style, provider, model, cue hash를 포함한다.

- 캐시는 최신 30개 항목과 직렬화 기준 약 4 MiB 이내로 유지한다.
- 한 항목만으로 용량 기준을 넘는 경우에는 해당 최신 항목 하나를 보존한다.
- 동시 번역 완료 시 read-modify-write 충돌을 피하도록 캐시 쓰기를 직렬화한다.

## 런타임 메시지 계약

background service worker는 처리 대상 메시지의 필수 payload를 네트워크 호출 전에 검증한다. 번역 요청은 subtitle document의 platform, videoId, sourceLanguage와 cue 시간 범위를 검사하며 한 요청의 cue를 20,000개로 제한한다. 알 수 없는 메시지는 다른 listener가 처리할 수 있도록 응답하지 않는다.

## 설정 백업과 복구

- 옵션 화면의 마지막 섹션에서 API key를 포함한 현재 설정을 백업하거나 복구한다. 번역 캐시는 제외한다.
- 백업 파일 확장자는 `.astbackup`을 사용하며 복구 파일 선택과 입력 검증도 이 확장자만 허용한다.
- Chrome File System Access API를 사용할 수 있으면 복구 파일 선택창의 첫 위치를 OS가 해석하는 `downloads` 표준 폴더로 제안한다. `ast-settings-restore` picker ID로 복구 전용 마지막 위치를 기억하며, API를 사용할 수 없거나 호출할 수 없는 환경에서는 `<input type="file">` 선택기로 대체한다.
- 비밀번호 입력란은 설정 화면에 상시 노출하지 않는다. 백업 버튼을 누르거나 복구 파일을 선택했을 때 `<dialog>` 기반 마스킹 입력 팝업을 열고, 완료 또는 취소 후 입력값을 유지하지 않는다.
- 사용자 화면에서는 `백업 비밀번호`로 표현하며, 영문, 숫자, ASCII 특수문자를 각각 1개 이상 포함한 10자 이상이어야 한다. 문자열 중간의 일반 space는 허용하되 앞뒤 space와 탭·줄바꿈은 거부하며, space는 특수문자 조건으로 인정하지 않는다.
- 파일마다 16-byte salt와 12-byte nonce를 무작위로 생성한다.
- PBKDF2-SHA-256 250,000회로 백업 비밀번호에서 256-bit AES-GCM key를 파생한다.
- backup format/version을 AES-GCM additional authenticated data에 포함해 다른 형식의 암호문 대입을 막는다.
- 백업 비밀번호는 storage나 백업 파일에 저장하지 않는다. 비밀번호 분실 시 복구할 방법은 없다.
- 복구 전에 5 MiB 파일 크기, envelope format/version, KDF/cipher parameter와 설정 payload 구조를 검증한다.
- 복구 완료 후 사용자가 동의하면 API key가 입력된 provider만 표시 순서대로 연결 테스트한다. 각 provider에는 최소 요청을 한 번 전송하며 성공한 provider만 `providerTestStatus`를 `success`로 갱신하고 실패·예외 provider의 기존 성공 상태는 제거한다.
- 복구 연결 테스트가 끝나면 성공·실패 개수와 함께 provider별 성공 여부를 줄 단위로 표시하고, 실패 provider에는 API key를 제외한 오류 메시지를 함께 보여준다.
- provider 연결 테스트는 일반 번역 fallback을 사용하지 않는다. 예를 들어 DeepL이 쿼터 초과를 반환하면 Google Translate 응답으로 성공 처리하지 않고 DeepL 연결 실패로 표시한다.

## 자막 오버레이

- 영상 컨트롤의 AST 아이콘은 자막을 바로 토글하지 않고 provider 메뉴를 연다.
- 메뉴 맨 위에서 AST를 켜고 끄며, 가운데에는 Google Translate와 연결 테스트에 성공한 provider를 표시하고, 맨 아래에서 설정을 연다. Google Translate와 DeepL도 사용자가 원하면 최종 provider로 선택할 수 있다.
- Provider 선택은 `activeProvider`에 저장하고 현재 재생 시각을 `initialStartTime`으로 전달해 해당 위치부터 우선 번역한다. 비-Google provider의 번역 중에는 선택된 항목 앞에만 spinner를 표시한다.
- Udemy와 YouTube의 메뉴는 각 사이트의 시각 언어를 참고하되 DOM과 CSS는 `ast-provider-menu-*` 이름의 확장 자체 요소로 독립 구현한다.
- 다른 플레이어 툴바 아이콘이 click 전파를 중단하더라도 AST 메뉴가 겹치지 않도록, 문서 캡처 단계의 `pointerdown`과 `click`에서 AST 버튼·메뉴 외부 상호작용을 감지해 메뉴를 닫는다.
- 번역 요청마다 request ID를 부여해 provider 전환 전에 시작한 progress나 최종 응답이 새 provider 결과를 덮어쓰지 않도록 한다.
- 자막 오버레이는 absolute layer로 영상 위에 표시한다.
- 위치는 드래그로 이동하고 `positionX`, `positionY`로 저장한다.
- 폭은 오른쪽 아래 resize 핸들로 수동 조절하고 `width`로 저장한다.
- 스타일 설정은 폰트, 웹폰트, 글자색, 그림자, 외곽선, 배경색/투명도를 포함한다.
- 외곽선은 `-webkit-text-stroke`, 웹폰트는 동적 `@font-face` style injection을 사용한다.

### AST 툴바 아이콘 상태

| 상태 | 색상 | 의미 |
| --- | --- | --- |
| 기본 | 흰색 | AST가 꺼져 있거나 원문 자막 상태 |
| 활성 | 파란색 | AST가 켜진 기본 번역 상태 |
| 임시 | 노란색 | 최종 번역 전 임시 번역 표시 중 |
| 현재 cue 완료 | 초록색 | 현재 재생 cue의 최종 번역 준비 완료 |
| 전체 완료 | 보라색 | 전체 자막의 최종 번역 완료 |
| 대체 번역 | 분홍색 | 쿼터 초과 등으로 Google Translate 대체 번역 사용 중 |

자막 또는 번역 요청을 준비하는 동안에는 현재 색상을 유지한 채 아이콘이 미세하게 깜빡인다.

## 보안/개인정보

- 일반 설정은 `chrome.storage.local`의 `llmSettings`에 저장하되 provider의 `apiKey` 필드는 제거한다.
- API key는 provider별 고유 nonce와 additional authenticated data를 사용하는 AES-GCM 암호문으로 별도 vault에 저장한다.
- AES key 생성용 seed는 3개 XOR share로 나누고, share마다 다른 바이트 순열과 mask를 적용해 서로 다른 storage key에 분산 저장한다. 최종 AES key는 복원한 seed, 확장 runtime ID와 내부 context를 SHA-256으로 조합해 생성한다.
- 기존 `llmSettings.providers.*.apiKey` 평문은 설정을 처음 읽을 때 암호화 vault로 자동 이전하고 원래 필드에서 제거한다.
- CST에서 AST로 명칭을 전환한 현재 초기 개발 단계에서는 `runtimeIndexV3` vault로 한 번만 초기화한다. API key는 다시 입력하거나 `.astbackup` 파일로 복구한다.
- 최초 출시 이후에는 storage key를 바꿔 사용자 설정을 초기화하지 않는다. 일반 설정이나 vault 구조를 변경할 때 schema/version을 올리고, 이전 출시 버전부터 현재 버전까지 순서대로 적용되는 마이그레이션을 함께 제공한다.
- vault는 고정 storage key 안의 `version`을 기준으로 단계별 마이그레이션한다. 알 수 없는 미래 버전이나 필요한 마이그레이션이 누락된 경우에는 데이터를 지우지 않고 오류로 중단한다.
- 옵션 화면의 저장된 API key 입력값은 앞 6자와 뒤 4자만 표시하고, 마스킹 값을 그대로 저장하면 기존 secret을 유지한다.
- 자막 텍스트는 사용자가 선택한 provider로 전송될 수 있다.
- Local LLM은 `localhost` 또는 `127.0.0.1` host permission으로 연결한다.

### API key 암호화의 보안 범위

현재 방식은 사용자 입력 없이 자동으로 복호화할 수 있어 사용성과 번역 시작 속도를 유지한다. 저장소에서 `apiKey` 필드나 알려진 key 패턴을 수집하는 범용 악성코드와 단순 유출에서는 평문 노출을 줄인다.

복호화 로직과 모든 key share는 확장 프로그램 안에서 자동으로 접근할 수 있으므로, 확장 코드와 해당 확장의 전체 storage를 함께 획득해 분석하는 표적 공격자는 API key를 복원할 수 있다. 따라서 OS 보안 저장소나 사용자 마스터 암호 기반 암호화와 같은 수준으로 표현하지 않는다.

추가 방어 단계로 `chrome.storage.local` 접근을 trusted extension context로 제한하고, content script에는 API key를 제외한 설정만 background 메시지로 전달할 수 있다. 현재 content script가 자막 스타일과 플랫폼 설정을 storage에서 직접 읽고 쓰므로 이 변경은 별도 리팩토링과 회귀 테스트가 필요하다.
