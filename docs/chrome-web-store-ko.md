# AST - AI Subtitle Translator
다음 웹사이트 영상의 자막을 LLM AI를 활용해 원하는 언어로 자연스럽게 번역합니다.
  - Udemy: https://www.udemy.com/
  - NVIDIA Academy: https://www.nvidia.com/en-us/training/academy/
  - YouTube: https://www.youtube.com/
  - Vimeo: https://vimeo.com/
  - TED: https://www.ted.com/

# 주요 특징
  - Google 번역으로 자막을 빠르게 번역하거나, LLM AI를 활용해 문맥을 고려한 자연스러운 번역을 제공합니다.
  - 프롬프트를 활용하여 번역 스타일을 지정할 수 있습니다.
  - 자막 표시 스타일을 다양하게 직접 변경할 수 있습니다.
  - 다양한 LLM 제공업체를 지원합니다.
    - Google Gemini, OpenAI GPT, Anthropic Claude, DeepL, NVIDIA NIM, OpenRouter, Custom LLM

# 주의 사항
  - Google 번역 외의 제공업체는 API 키가 필요합니다.
  - Google AI API 키를 발급해 무료 등급의 Gemini 3.1 Flash Lite를 연결하면 빠른 응답의 AI 번역을 시작할 수 있습니다. (권장)
  - 무료 사용량과 제한 및 발생 비용은 각 LLM API 제공 업체의 정책을 확인해 주세요.

# 주요 기능
  - Udemy, NVIDIA Academy, YouTube, TED, Vimeo 영상 자막 번역
  - 원문 흐름을 고려한 AI 문맥 번역
  - Google 번역을 이용한 빠른 번역 기본 제공
  - LLM 번역이 준비되는 동안에는 빠른 번역이 먼저 제공
  - 영상에서 제공하는 자막 언어를 번역 소스 언어로 선택 가능 (기본값: 영어)
  - 자막 표시, 위치 이동, 폭 조절 지원
  - 자막 글꼴, 색상, 그림자, 외곽선, 배경색, 투명도 변경 지원
  - 다양한 번역 스타일 지원: Natural, Lecture, Technical, Custom 1(스타 강사), Custom 2
  - 긴 영상 자막의 분할·병렬 번역 및 번역 캐시 지원
  - API 키를 포함한 설정의 비밀번호 기반 암호화 백업·복구 제공
  - AI 번역 실패 시 원문 자막을 유지하고, 가능한 경우 Google 번역으로 대체

# 사용 방법
  - 설치 시 Google 번역이 기본 제공됩니다.
  - 동영상 하단 툴바에서 `AST` 아이콘을 클릭한 후 `AI 자막 번역` 토글 버튼을 활성화합니다.

  ## 간단 설정 - 권장
  1. 확장 프로그램을 설치하고 설정 페이지에서 간단 설정 하단의 `API 키 발급하기` 링크를 클릭하여 Google AI API 키를 발급받습니다.
  2. 발급받은 무료 API 키를 설정의 `Google AI API 키` 항목에 넣고 `API 키 확인` 버튼을 누릅니다.

  ## 고급 설정
  - API 키가 필요한 제공업체를 사용할 경우, 해당 제공업체에서 발급한 API 키를 입력한 후 `연결 테스트` 버튼을 누릅니다.
  - 필요에 따라 번역 스타일과 자막 표시 스타일을 조절할 수 있습니다.
  - API 키를 포함한 모든 설정 값을 백업할 수 있습니다. 백업 파일은 AES-256-GCM으로 암호화되며, 복구 시에는 백업할 때 입력한 암호가 필요합니다.
  - DeepL API 키가 있는 경우 빠른 번역에 DeepL을 사용할 수 있습니다.

# 처음 시작할 때 LLM 선택 가이드
  - 무료로 시작: [Google AI Studio에서 API 키 발급](https://aistudio.google.com/api-keys) 후 Google AI 제공업체와 `gemini-3.1-flash-lite` 모델을 선택하세요. Gemini 3.1 Flash Lite는 빠른 응답과 비용 효율성을 목표로 하며, 번역 작업의 시작 모델로 적합합니다.
  - Google AI 무료 등급의 일일 요청 한도(RPD)는 한국 시간으로 보통 오후 4시(미국 서부 서머타임 기준, 표준시에는 오후 5시)에 초기화됩니다. 실제 무료 한도와 사용 가능 여부는 계정과 모델에 따라 달라질 수 있으므로 AI Studio에서 확인하세요.
  - 유료 권장 모델 : 자막 번역은 비교적 명확한 입출력 작업이므로, 가장 큰 프론티어 모델보다 작고 빠른 모델부터 사용하는 편을 권장합니다. Gemini 3.1 Flash Lite, GPT-5.6 Luna, Claude Haiku 4.5 등이 좋은 시작점이며, 더 높은 품질이 필요한 경우에만 큰 모델을 사용하세요.
  - 유료 가성비 모델 : OpenRouter 제공업체에서 `deepseek/deepseek-v4-flash`의 빠른 처리와 비용 효율성을 갖춘 모델로, 유료 번역의 가성비 시작점으로 적합합니다. `Nitro 사용`을 체크하면 빠른 제공업체가 우선 제공됩니다. 현재 가격과 한도는 OpenRouter에서 확인하세요.

# 주요 변경
  [ v0.1.3 (2026-08-03) ]
  - ted.com 지원 추가
  - API 키 표시·숨김, 대체 번역 안내, 자막 및 제공업체 메뉴 동작 안정성 개선.

  [ v0.1.2 (2026-07-19) ]
  - "간단 설정" 모드 추가

# 프로젝트 정보
  - 라이선스: MIT License
  - Source: https://github.com/mungi/ai-subtitle-translator
  - Site: https://mungi.github.io/ai-subtitle-translator/
  - 이슈 등록 및 기능 개선 요청: https://github.com/mungi/ai-subtitle-translator/issues

# 개인정보 및 데이터 처리
- 개인정보 처리방침: https://mungi.github.io/ai-subtitle-translator/privacy.html
- 자막 텍스트는 사용자가 선택한 번역 제공업체로 전송될 수 있습니다.
- API 키와 설정, 번역 캐시는 사용자의 브라우저에만 저장됩니다.
- API 키는 브라우저 저장소에 제공업체별 암호문으로 저장되며 설정 데이터에는 평문 API 키를 남기지 않습니다.
- 저장소 접근은 신뢰된 확장 프로그램 컨텍스트로 제한하며 콘텐츠 스크립트에는 API 키를 전달하지 않습니다.
- 이 확장은 자체 서버나 외부 데이터베이스에 API 키를 저장하지 않습니다.
- 번역 요청 시 API 키는 인증을 위해 선택한 제공업체에 직접 전송됩니다.
- 호스팅 제공업체는 공식 HTTPS 오리진만 허용합니다. Custom LLM은 `localhost`/`127.0.0.1`의 HTTP 또는 HTTPS와, 사용자가 모델 가져오기 또는 연결 테스트 때 접근 권한을 승인한 사용자 지정 HTTPS 오리진을 사용할 수 있으며 리디렉션 응답을 자동으로 추적하지 않습니다.
