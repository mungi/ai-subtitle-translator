# AST - AI Subtitle Translator - Chrome 웹스토어 소개 문서

## 스토어 등록 기본 문구

- 제품명: AST - AI Subtitle Translator
- 한 줄 소개: Udemy, YouTube, TED, NVIDIA Academy, Vimeo 자막을 원하는 언어로 번역해 영상 위에 표시하는 Chrome 확장입니다.
- 짧은 설명: AI 문맥 번역과 빠른 임시 번역으로 Udemy·YouTube·TED·NVIDIA Academy·Vimeo 자막을 더 자연스럽게 읽으세요.

## Chrome Web Store 업로드 이미지

- [marquee-promo-tile.png](marquee-promo-tile.png): 1400×560 프로모션 marquee 이미지
- [small-promo-tile.png](small-promo-tile.png): 440×280 작은 프로모션 타일 이미지

## 상세 설명

AST - AI Subtitle Translator는 Udemy 강의, YouTube 영상, TED 영상, NVIDIA Academy 강의, Vimeo 영상의 자막을 원하는 언어로 번역해 영상 위에 보여줍니다.

Google Translate로 빠르게 자막을 확인하거나, OpenAI, Anthropic, Google AI 등 AI 번역 provider를 선택해 영상 전체 흐름을 고려한 번역을 볼 수 있습니다. AI 번역이 준비되는 동안에는 원문 또는 빠른 번역 자막이 먼저 표시됩니다.

영상 컨트롤 바의 AST 아이콘을 눌러 메뉴를 열고 자막을 켜고 끌 수 있습니다. 메뉴에서 영상이 제공하는 원본 자막 언어와 번역 스타일도 바로 선택할 수 있습니다. 다른 영상 컨트롤을 누르면 AST 메뉴는 자동으로 닫혀 플레이어 메뉴와 겹치지 않습니다. 자막 위치와 폭을 영상 위에서 조절하고, 옵션 페이지에서 언어, 번역 provider, 글꼴, 색상, 그림자, 외곽선, 배경을 원하는 대로 설정하세요.

## 주요 기능

- Udemy 강의, YouTube 영상, TED 영상, NVIDIA Academy 강의, Vimeo 영상 자막 번역
- 영상에서 제공하는 원본 자막 언어 선택
- 원문 흐름을 고려한 AI 문맥 번역
- Google Translate를 이용한 빠른 임시 번역
- 영상 위 자막 표시, 위치 이동, 폭 조절
- 글꼴, 색상, 그림자, 외곽선, 배경 스타일 설정
- Natural, Lecture, Technical, Custom 1, Custom 2 번역 스타일
- 모델 조회 후 권장 모델 자동 선택과 온라인 provider 연결 확인
- 긴 영상 자막 번역과 번역 캐시 지원
- API key를 포함한 설정의 비밀번호 기반 암호화 백업/복구
- 복구 후 저장된 API key의 선택적 일괄 연결 확인
- AI 번역 실패 시 원문 또는 빠른 번역 자막 유지

## 지원 사이트와 번역 Provider

- 지원 사이트: Udemy 강의 플레이어, YouTube 영상 페이지, TED 영상 페이지, NVIDIA Academy 강의, Vimeo 영상 페이지
- 번역 Provider: Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM, Custom LLM
- 영상의 AST 메뉴에서 자막 켜기/끄기, 원본 자막 언어·번역 Provider·번역 스타일 선택, 설정 열기

Udemy에서는 수강 권한이 있는 강의의 자막이 필요하며, YouTube, TED, NVIDIA Academy, Vimeo에서는 영상이 제공하는 자막이 필요합니다.

## 사용 방법

1. 확장 프로그램을 설치하고 Options 페이지에서 목표 언어와 번역 provider를 설정합니다.
2. API key가 필요한 provider를 사용할 경우, 해당 provider에서 발급한 API key를 입력합니다.
3. Udemy 강의, YouTube 영상, TED 영상, NVIDIA Academy 강의 또는 Vimeo 영상을 열고 영상 컨트롤 바의 자막 번역 아이콘을 누릅니다. 필요하면 메뉴에서 원본 자막 언어와 번역 스타일을 바꿉니다.
4. 필요에 따라 Options 페이지에서 자막 스타일을 조절합니다.

## 처음 시작할 때 권장 설정

- 무료로 시작: [Google AI Studio에서 API 키 발급](https://aistudio.google.com/api-keys) 후 Google AI provider와 `gemini-3.1-flash-lite` 모델을 선택하세요. Gemini 3.1 Flash-Lite는 빠른 응답과 비용 효율성을 목표로 하며, 번역 작업의 시작 모델로 적합합니다.
- Google AI 무료 등급의 일일 요청 한도(RPD)는 한국 시간으로 보통 오후 4시(미국 서부 서머타임 기준, 표준시에는 오후 5시)에 초기화됩니다. 실제 무료 한도와 사용 가능 여부는 계정과 모델에 따라 달라질 수 있으므로 AI Studio에서 확인하세요.
- 자막 번역은 비교적 명확한 입출력 작업이므로, 가장 큰 프론티어 모델보다 작고 빠른 모델부터 사용하는 편을 권장합니다. Gemini 3.1 Flash-Lite, GPT-5.6 Luna, Claude Haiku 4.5 등이 좋은 시작점이며, 더 높은 품질이 필요한 경우에만 큰 모델을 사용하세요.
- 유료 사용 권장: OpenRouter provider에서 `deepseek/deepseek-v4-flash`를 선택하세요. 빠른 처리와 비용 효율성을 갖춘 모델로, 유료 번역의 가성비 시작점으로 권장합니다. 현재 가격과 한도는 OpenRouter에서 확인하세요.

## 개인정보 및 데이터 처리

개인정보 처리방침: [한국어](../PRIVACY.md) · [English](../PRIVACY_en.md) · [日本語](../PRIVACY_ja.md)

- 자막 텍스트는 사용자가 선택한 번역 provider로 전송될 수 있습니다.
- API key와 설정, 번역 캐시는 사용자의 브라우저에만 저장됩니다.
- API key는 브라우저 저장소에 provider별 암호문으로 저장되며 설정 데이터에는 평문 API key를 남기지 않습니다.
- 저장소 접근은 trusted extension context로 제한하며 content script에는 API key를 전달하지 않습니다.
- 이 확장은 자체 서버나 외부 데이터베이스에 API key를 저장하지 않습니다.
- 번역 요청 시 API key는 인증을 위해 선택한 provider에 직접 전송됩니다.
- Hosted provider는 공식 HTTPS origin만 허용합니다. Custom LLM은 `localhost`/`127.0.0.1`의 HTTP 또는 HTTPS와, 사용자가 모델 가져오기 또는 연결 테스트 때 접근 권한을 승인한 사용자 지정 HTTPS origin을 사용할 수 있으며 redirect 응답을 자동 추적하지 않습니다.
