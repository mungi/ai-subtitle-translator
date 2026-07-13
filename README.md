# AI Subtitle Translator

[한국어](README.md) · [English](README_en.md) · [日本語](README_ja.md)

Udemy와 YouTube 자막을 수집하고, Google Translate 또는 LLM provider로 번역해 영상 위에 표시하는 Chrome Manifest V3 확장입니다.

## 주요 기능

- Udemy 강의 자막 track 수집 및 WebVTT cue 파싱
- YouTube caption track 수집 및 XML/JSON3/SRV3/WebVTT/transcript panel cue 파싱
- Google Translate cue 단위 임시 번역
- OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, Local LLM, DeepL provider 지원
- OpenAI/Anthropic/Gemini/OpenRouter/NVIDIA NIM/Local LLM 모델 목록 불러오기
- 모델 조회 후 다국어 경량 권장 모델 자동 선택과 연결 테스트
- 전체 subtitle JSON 기반 LLM 번역
- Natural, Lecture, Technical, Custom 1, Custom 2 번역 스타일과 스타일별 사용자 system prompt
- 긴 영상용 chunk 번역과 번역 캐시

LLM 번역은 현재 재생 위치의 첫 1분을 우선 처리한 뒤, 이후 구간부터 기본적으로 최대 7분 단위로 나눕니다. 이후 구간을 마치면 이전 구간을 처리합니다. 설정에서 청크 최대 시간은 2~15분 사이로 조절할 수 있으며, 내부적으로 24,000자·500 cue 안전 상한도 적용합니다. 응답이 불완전하면 해당 청크만 반으로 나눠 재시도합니다.
- LLM 실패 시 Google Translate fallback
- Google Translate와 DeepL을 포함한 사용 가능한 provider를 최종 번역 provider로 직접 선택 가능
- 영상 툴바의 AST 아이콘에서 자막 켜기/끄기, provider 변경, 설정 열기 제공
- 다른 영상 툴바 아이콘을 누르면 AST 메뉴를 자동으로 닫아 플레이어 메뉴와 겹치지 않도록 처리
- Provider 변경 시 현재 재생 위치부터 우선 번역하며 선택한 비-Google provider에만 진행 애니메이션 표시

## AST 툴바 아이콘 상태

- 흰색 기본 상태: AST가 꺼져 있거나 원문 자막 상태입니다.
- 파란색: AST가 켜져 번역 자막을 준비하거나 표시하는 기본 활성 상태입니다.
- 노란색: LLM 최종 번역을 기다리는 동안 임시 번역을 표시 중입니다.
- 초록색: 현재 재생 중인 cue의 최종 번역이 준비되었습니다.
- 보라색: 전체 자막의 최종 번역이 완료되었습니다.
- 분홍색: 선택 provider의 쿼터 초과 등으로 Google Translate 대체 번역을 사용 중입니다.
- 아이콘이 미세하게 깜빡이면 자막 또는 번역 요청을 준비 중이라는 의미입니다.
- 번역 자막 오버레이 위치 드래그 이동
- 자막창 모서리 수동 크기 조절 및 폭 저장
- 자막 폰트, 웹폰트, 색상, 그림자, 외곽선, 배경 스타일 설정
- API key AES-GCM 암호화 저장과 마스킹 표시
- 사용자 비밀번호 기반 암호화 설정 백업/복구
- 브라우저 언어 기반 설정 UI와 기본 target language

## 로드 방법

1. Chrome에서 `chrome://extensions`를 연다.
2. 개발자 모드를 켠다.
3. `Load unpacked`를 누른다.
4. 이 저장소의 `extension/` 폴더를 선택한다.
5. 확장 옵션에서 provider와 target language를 설정한다.

## 문서

- [Design.md](Design.md): 현재 설계 결정과 주요 런타임 흐름.
- [CONTEXT.md](CONTEXT.md): 참조 코드 반영 내용과 현재 구현 요약.
- [TASKS.md](TASKS.md): 완료 항목, 검증 완료 항목, 수동 QA 목록.
- [docs/code-analysis.md](docs/code-analysis.md): 파일별 책임, 메시지 계약, 테스트/리스크 분석.
- [docs/chrome-web-store-ko.md](docs/chrome-web-store-ko.md), [docs/chrome-web-store-en.md](docs/chrome-web-store-en.md): Chrome Web Store 소개문.

## Local LLM Base URL

OpenAI 호환 `chat/completions` 서버는 Base URL에 최종 요청 URL에서 `/chat/completions` 직전까지만 입력한다.

```text
Base URL: http://localhost:1234/v1
Request URL: http://localhost:1234/v1/chat/completions
Model: OpenAI 호환 서버에서 제공하는 모델명
```

## Provider API 참고

- DeepL: Free/Pro 요금제에 맞는 endpoint를 사용하며 Free 플랜은 월 문자 사용량 제한이 있다. 참고: https://developers.deepl.com/docs/resources/usage-limits, https://www.deepl.com/pro-api
- OpenAI: 사용량 제한과 요금은 계정/모델/티어별로 달라질 수 있다. 참고: https://developers.openai.com/api/docs/guides/rate-limits, https://developers.openai.com/api/docs/pricing
- Anthropic: 사용량 제한과 요금은 계정/모델/티어별로 달라질 수 있다. 참고: https://platform.claude.com/docs/en/api/rate-limits, https://platform.claude.com/docs/en/about-claude/pricing
- Google AI: Gemini API 사용량 제한과 요금은 프로젝트/모델/티어별로 달라질 수 있다. API key: https://aistudio.google.com/api-keys, 참고: https://ai.google.dev/gemini-api/docs/rate-limits, https://ai.google.dev/gemini-api/docs/pricing
- OpenRouter: 무료 플랜/무료 모델 API는 사용량 제한이 있다. 참고: https://openrouter.ai/pricing, https://openrouter.ai/docs/api/reference/limits
- NVIDIA NIM: NVIDIA API Catalog의 무료 endpoint는 개발/프로토타이핑용이며 모델별/계정별 사용량 제한이 적용될 수 있다. 참고: https://build.nvidia.com/explore/discover, https://forums.developer.nvidia.com/t/nvidia-nim-faq/300317

## 권장 기본 모델

- Google AI: `gemini-3.1-flash-lite`
- OpenAI: `gpt-5.6-luna`
- Anthropic: `claude-haiku-4-5-20251001`
- OpenRouter: `deepseek/deepseek-v4-flash` (`DeepSeek: DeepSeek V4 Flash`)
- NVIDIA NIM: `openai/gpt-oss-120b`
- Local LLM은 `google/gemma-4-e4b`가 있으면 우선 선택하고, 없으면 Qwen/Gemma 소형 instruct 계열을 선택한다.
- 온라인 provider는 `모델 가져오기` 성공 후 권장 모델을 저장하고 즉시 최소 연결 테스트를 수행한다. 성공한 provider만 연결 성공 상태로 갱신한다.
- Local LLM의 `모델 가져오기`는 모델 선택까지만 수행하며 자동 연결 테스트는 실행하지 않는다.

## 자막 스타일

- 기본 폰트는 Pretendard 웹폰트다.
- 사용자 웹폰트는 Noonnu의 “웹폰트로 사용” CSS를 붙여 넣어 사용할 수 있다.
- 외곽선은 Chrome의 `-webkit-text-stroke`를 사용한다.
- 그림자는 오른쪽 아래 대각선 방향 거리와 blur 값을 설정한다.
- 자막 오버레이는 드래그로 위치를 이동하고, 오른쪽 아래 모서리로 폭을 수동 조절한다.

## 설정 백업과 복구

- 옵션 화면 최하단에서 API key를 포함한 현재 설정을 암호화된 `.astbackup` 파일로 백업하고 복구할 수 있다.
- `설정 백업`을 누르면 마스킹된 전용 팝업에서 백업 비밀번호를 입력하며, 복구할 때도 파일 선택 후 동일한 방식으로 비밀번호를 입력한다.
- 백업 비밀번호는 영문, 숫자, 특수문자를 각각 포함한 10자 이상 문자열이어야 한다. 중간의 일반 space는 허용하지만 앞뒤 공백, 탭과 줄바꿈은 허용하지 않는다.
- 백업마다 무작위 salt와 nonce를 생성하고 PBKDF2-SHA-256으로 비밀번호에서 AES-GCM 키를 파생한다.
- 백업 비밀번호는 확장 프로그램이나 백업 파일에 저장되지 않는다. 비밀번호를 잊으면 백업을 복구할 수 없다.
- 번역 캐시는 백업 대상에 포함하지 않는다.
- 복구 파일 선택창에는 `.astbackup` 파일만 표시하며 다른 확장자는 거부한다.
- 복구 파일 선택창은 처음에는 OS의 다운로드 폴더에서 시작하고, 이후에는 복구에 마지막으로 사용한 위치를 기억한다. 해당 기능을 지원하지 않는 환경에서는 기본 파일 선택기를 사용한다.
- 복구 후 동의하면 API key가 입력된 provider를 한 번씩 연결 테스트하고 성공 상태를 갱신한다.

## QA 체크

- 로컬 자동 검증:

```text
npm test
npm run check
```

- Udemy 로그인 상태에서 구매/수강 가능한 강의 페이지를 연다.
- 영상 컨트롤 영역에 확장 버튼이 보이는지 확인한다.
- AST 메뉴를 연 상태에서 자막, 설정 등 다른 영상 툴바 아이콘을 눌러 AST 메뉴가 닫히는지 확인한다.
- 자막이 있는 강의에서 Google cue 번역이 먼저 노란색 상태로 표시되는지 확인한다.
- LLM provider 선택 시 전체 번역 완료 후 최종 번역으로 교체되는지 확인한다.
- 강의를 이동했을 때 이전 강의 자막이 섞이지 않는지 확인한다.
- Options에서 provider 연결 테스트, 모델 목록 불러오기, 캐시 삭제가 동작하는지 확인한다.

## 한계

- Udemy API 호출은 사용자의 로그인 쿠키와 수강 권한에 의존한다.
- API 키는 provider별 AES-GCM 암호문으로 `chrome.storage.local`에 저장하고, 복호화 재료는 변환된 3개 조각으로 분산 저장한다. 옵션 화면에서는 저장된 API key를 마스킹한다.
- 마스터 암호 입력 없이 자동 복호화하는 편의성 우선 설계이므로 일반적인 평문 secret 수집을 어렵게 하지만, 확장 코드와 저장소를 함께 분석하는 표적 공격까지 막는 보안 저장소는 아니다.
- 자막 텍스트는 사용자가 선택한 번역 provider로 전송될 수 있다.
