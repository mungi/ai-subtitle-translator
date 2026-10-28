# AST - AI Subtitle Translator
AI를 활용해 다음 웹사이트 영상의 자막을 원하는 언어로 자연스럽게 번역합니다.
  - Udemy: https://www.udemy.com/
  - NVIDIA Academy: https://www.nvidia.com/en-us/training/academy/
  - YouTube: https://www.youtube.com/
  - Vimeo: https://vimeo.com/
  - TED: https://www.ted.com/

# 주요 특징
  - Google 번역으로 자막을 빠르게 번역하거나, LLM을 활용해 문맥을 고려한 자연스러운 번역을 제공합니다.
  - 프롬프트를 활용하여 번역 스타일을 지정할 수 있습니다.
  - 자막 표시 스타일을 다양하게 직접 변경할 수 있습니다.
  - 다양한 상용 AI API와 OpenAI 호환 API·로컬 서버를 포함한 여러 LLM 제공업체를 지원합니다. 설정에서 제공업체·모델·API 키를 선택할 수 있으며, 전체 지원 목록은 Chrome Web Store의 설정 화면 스크린샷에서 확인하세요.

# 주의 사항
  - 일부 번역 제공업체는 API 키가 필요합니다. Custom LLM의 API 키는 선택 사항입니다.
  - Google AI API 키를 발급해 무료 등급의 Gemini 3.1 Flash Lite를 연결하면 응답이 빠른 AI 번역을 시작할 수 있습니다. (권장)
  - 무료 사용량과 제한 및 발생 비용은 각 LLM API 제공업체의 정책을 확인해 주세요.

# 주요 기능
  - Udemy, NVIDIA Academy, YouTube, TED, Vimeo 영상 자막 번역
  - 원문 흐름을 고려한 AI 문맥 번역
  - Google 번역을 이용한 빠른 번역 기본 제공
  - LLM 번역이 준비되는 동안 임시 번역을 먼저 표시
  - 영상에서 제공하는 자막 언어를 번역 소스 언어로 선택 가능 (기본값: 영어)
  - 자막 표시, 위치 이동, 폭 조절 지원
  - 이중 자막·원문 자막·번역 자막 선택 가능 (기본값: 번역 자막)
  - 자막 글꼴, 색상, 그림자, 외곽선, 배경색, 투명도 변경 지원
  - 다양한 번역 스타일 지원: Natural, Lecture, Technical, Custom 1(스타 강사), Custom 2
  - 긴 영상 자막의 분할·병렬 번역 및 번역 캐시 지원
  - API 키를 포함한 설정의 비밀번호 기반 암호화 백업·복구 제공
  - AI 번역 실패 시 원문 자막을 유지하고, 가능한 경우 Google 번역으로 대체

# 사용 방법
  - 설치 시 Google 번역이 기본 제공됩니다.
  - 자막이 제공되는 지원 영상에서는 번역이 자동으로 시작됩니다. 동영상 툴바의 `AST` 메뉴에서 `AI 자막 번역`을 켜거나 끌 수 있습니다.

  ## 간단 설정 - 권장
  1. 확장 프로그램을 설치하고 설정 페이지에서 간단 설정 하단의 `API 키 발급하기` 링크를 클릭하여 Google AI API 키를 발급받습니다.
  2. 발급받은 무료 API 키를 설정의 `Google AI API 키` 항목에 넣고 `API 키 확인` 버튼을 누릅니다. 확인에 성공하면 Google AI 제공업체와 `gemini-3.1-flash-lite` 모델이 자동으로 설정됩니다.

  처음 사용하는 모델 선택 가이드는 소개 웹사이트의 [LLM 선택 가이드](https://mungi.github.io/ai-subtitle-translator/#llm-selection-guide)에서 확인하세요.

  ## 고급 설정
  - API 키가 필요한 제공업체를 사용할 경우, 해당 제공업체에서 발급한 API 키를 입력한 후 `연결 테스트` 버튼을 누릅니다.
  - 필요에 따라 번역 스타일과 자막 표시 스타일을 조절할 수 있습니다.
  - API 키를 포함한 모든 설정값을 백업할 수 있습니다. 백업 파일은 AES-256-GCM으로 암호화되며, 복구 시에는 백업할 때 입력한 암호가 필요합니다.
  - DeepL API 키가 있는 경우 빠른 번역에 DeepL을 사용할 수 있습니다.

# 주요 변경
  [ v0.1.4 (2026-10-28) ]
  - YouTube 자막 수집·싱크 개선, 원문 단어별 진행 표시 및 광고 중 자막 숨김.
  - 이중 자막·원문 자막·번역 자막 선택과 페르시아어·아랍어의 오른쪽에서 왼쪽 쓰기 지원.
  - 현재 영상 다시 번역, 번역 오류 재시도 및 모델 변경 시 이전 요청 취소 기능 개선.
  - 폰트 로딩 안정화와 한국어·영어·일본어 화면 문구 및 안내 개선.

  [ v0.1.3 (2026-08-03) ]
  - ted.com 지원 추가
  - API 키 표시·숨김, 대체 번역 안내, 자막 및 제공업체 메뉴 동작 안정성 개선.

  [ v0.1.2 (2026-07-19) ]
  - "간단 설정" 모드 추가

# 프로젝트 정보
  - 라이선스: MIT License
  - 소스 코드: https://github.com/mungi/ai-subtitle-translator
  - 웹사이트: https://mungi.github.io/ai-subtitle-translator/
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
