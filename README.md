# AI Subtitle Translator

[한국어](README.md) · [English](README_en.md) · [日本語](README_ja.md)

Udemy, YouTube, NVIDIA Academy, Vimeo의 자막을 번역하여 영상 위에 표시하는 Chrome Manifest V3 확장 프로그램입니다. Google Translate를 바로 사용하거나, 원하는 LLM 제공업체를 연결해 문맥을 반영한 번역을 이용할 수 있습니다.

Chrome 102 이상이 필요합니다.

## 주요 기능

- Udemy, YouTube, NVIDIA Academy, Vimeo의 자막을 수집하여 원문 또는 번역 자막으로 표시합니다.
- AST 메뉴에서 영상이 제공하는 원본 자막 언어와 번역 스타일을 바로 선택할 수 있습니다.
- Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, Custom LLM을 지원합니다.
- LLM 번역 시 자막 전체 문맥과 재생 위치를 고려하며, 긴 영상은 나누어 처리합니다.
- Natural, Lecture, Technical, 사용자 정의 번역 스타일을 제공합니다.
- 자막 위치, 크기, 글꼴, 색상, 그림자, 외곽선, 배경을 조정할 수 있습니다.
- 번역 결과를 캐시하고, LLM의 쿼터가 초과되면 Google Translate로 대체 번역합니다.
- 제공업체 연결 테스트, 모델 목록 조회, 설정 백업 및 복원을 제공합니다.

## 설치 방법

1. Chrome에서 `chrome://extensions`를 엽니다.
2. 오른쪽 위의 **개발자 모드**를 켭니다.
3. **압축해제된 확장 프로그램을 로드합니다**를 선택합니다.
4. 이 저장소의 `extension/` 폴더를 선택합니다.
5. 확장 프로그램 옵션에서 번역 제공업체와 대상 언어를 설정합니다.

## 빠르게 시작하기

1. 옵션 화면을 열면 `간단 설정`이 기본으로 표시됩니다.
2. API 키를 입력하지 않아도 Google Translate로 자막을 바로 번역할 수 있습니다.
3. Google Gemini를 사용하려면 [Google AI Studio API Keys](https://aistudio.google.com/api-keys)에서 키를 만든 뒤 `Google AI API 키`에 붙여 넣고 `API 키 확인`을 누릅니다. 확인에 성공하면 Gemini 3.1 Flash Lite가 자동 설정됩니다.
4. 다른 번역 제공업체, 자막 모양, 백업·복원은 `고급 설정`에서 조정합니다.

## 사용 방법

1. 자막이 있는 Udemy 강의, YouTube 영상, NVIDIA Academy 강의 또는 Vimeo 영상을 엽니다.
2. 영상 도구 모음의 AST 아이콘을 눌러 자막을 켭니다.
3. 메뉴에서 원본 자막 언어, 번역 제공업체, 번역 스타일을 선택하거나 설정 화면을 엽니다.

LLM 제공업체를 선택하면 현재 재생 위치 부근의 자막을 우선 번역한 뒤 나머지 자막을 처리합니다. 번역 중에도 원문 또는 임시 번역 자막을 계속 볼 수 있습니다.

## Custom LLM 설정

Custom LLM은 로컬 LLM과 사용자가 운영하는 OpenAI 호환 `chat/completions` 서버를 함께 지원합니다. 최종 요청 주소에서 `/chat/completions` 앞부분까지만 Base URL에 입력합니다. `localhost`와 `127.0.0.1`은 HTTP 또는 HTTPS를 사용할 수 있고, 외부 사용자 지정 서버는 HTTPS만 허용합니다. 외부 서버는 모델 가져오기 또는 연결 테스트를 할 때 해당 도메인 접근 권한을 승인한 뒤 사용할 수 있습니다. 자막 텍스트와 API Key(입력한 경우)는 이 서버로 직접 전송됩니다.

```text
Base URL: http://localhost:1234/v1
Request URL: http://localhost:1234/v1/chat/completions
```

## 개인정보 및 제한 사항

- 자막 텍스트는 선택한 번역 제공업체로 전송될 수 있습니다. 각 제공업체의 이용 약관과 요금 정책을 확인해 주세요.
- Udemy 자막 조회는 로그인 상태와 수강 권한에 따라 달라질 수 있습니다.
- API 키는 로컬 저장소에 암호화하여 저장하고 콘텐츠 스크립트에 전달하지 않습니다. 다만 마스터 비밀번호를 요구하지 않는 편의성 중심 설계이므로, 전용 비밀 관리 도구와 같은 수준의 보안을 제공하지는 않습니다.
- API 키를 화면 공유·공개 문서에 넣지 마세요. 노출이 의심되면 해당 제공업체 콘솔에서 키를 즉시 폐기하고 새 키를 만드세요.

자세한 내용은 개인정보 처리방침 [한국어](PRIVACY.md), [English](PRIVACY_en.md), [日本語](PRIVACY_ja.md)를 참고해 주세요.

## 개발 및 검증

```text
npm test
npm run check
```

추가 설계와 구현 정보는 [Design.md](Design.md), [CONTEXT.md](CONTEXT.md), [TASKS.md](TASKS.md)에서 확인할 수 있습니다.

## 릴리즈 패키지

Chrome Web Store에 올릴 ZIP 패키지는 릴리즈 태그가 현재 커밋을 가리키는 상태에서 생성합니다. 스크립트는 ZIP을 만들고 GitHub Release를 생성하거나 갱신한 뒤 ZIP을 첨부합니다.

```text
./release.sh
```

생성된 파일은 `release/ai-subtitle-translator-v<태그>.zip`이며, GitHub Release asset과 Chrome Web Store 패키지로 사용합니다.
