# AST - AI Subtitle Translator 개인정보 처리방침

[한국어](PRIVACY.md) · [English](PRIVACY_en.md) · [日本語](PRIVACY_ja.md)

시행일: 2026년 7월 15일

AST - AI Subtitle Translator는 Udemy, YouTube, NVIDIA Academy, Vimeo의 자막을 사용자가 선택한 번역 서비스로 번역해 표시하는 Chrome 확장 프로그램입니다. 개발자는 별도의 서버를 운영하지 않으며, 광고·추적·분석 목적으로 사용자 데이터를 수집하지 않습니다.

## 처리하는 데이터

- Udemy, YouTube, NVIDIA Academy, Vimeo의 자막 텍스트와 cue 시간 정보
- 현재 영상·강의를 식별하는 URL, video ID, course ID, lecture ID 및 자막 언어 정보
- 사용자가 입력한 번역 provider API key, endpoint, 모델, 번역·자막 설정
- 번역 결과 캐시와 사용자가 직접 생성하는 암호화 설정 백업 파일

## 이용 목적

이 데이터는 자막 조회, 번역 요청, 번역 결과 표시, 사용자 설정 유지, 설정 백업·복구 기능을 제공하는 데만 사용됩니다. 개인 맞춤 광고, 사용자 프로파일링, 데이터 판매에 사용하지 않습니다.

## 저장과 보유

- 설정, 번역 캐시, API key는 사용자의 브라우저 `chrome.storage.local`에 저장됩니다.
- API key는 provider별 AES-GCM 암호문으로 저장되며 일반 설정에는 평문으로 남기지 않습니다. 복호화에 필요한 조각도 같은 브라우저 프로필에 있으므로, 브라우저 프로필 저장소 자체가 탈취되면 독립적으로 보호할 수 없으며 OS 보안 저장소나 사용자 master password 기반 vault와 동일한 보호 수준은 아닙니다.
- 저장소는 trusted extension context로 제한되며 content script는 API key 또는 복호화 조각에 직접 접근하지 않습니다.
- 설정 백업은 사용자가 입력한 비밀번호로 AES-GCM 암호화하며, 비밀번호는 저장하지 않습니다.
- 번역 캐시는 설정에서 삭제할 수 있고, 전체 설정은 초기화할 수 있습니다. 확장 프로그램을 제거하면 Chrome이 해당 로컬 저장소를 삭제합니다. 사용자가 내려받은 `.astbackup` 파일은 사용자가 직접 삭제해야 합니다.

## 외부 전송

- 자막 텍스트와 번역 설정은 사용자가 선택한 Google Translate, DeepL, OpenAI, Anthropic, Google AI, OpenRouter, NVIDIA NIM 또는 Custom LLM endpoint로 전송될 수 있습니다.
- API key는 인증이 필요한 요청에서 선택한 provider로 직접 전송됩니다. 개발자 서버로 전송되지 않습니다.
- 지원 사이트의 자막을 조회하기 위해 영상·강의 식별자와 사용자의 로그인 cookie가 포함된 요청이 전송될 수 있습니다. 확장 프로그램은 cookie 값을 별도로 저장하지 않습니다.
- 기본 또는 사용자 지정 Web font를 사용하면 Google Fonts, jsDelivr 또는 사용자가 CSS에 지정한 font host로 font 요청이 전송될 수 있습니다.
- 각 외부 서비스의 데이터 처리는 해당 서비스의 개인정보 처리방침과 이용약관을 따릅니다.

## 권한

- `storage`: 설정, 암호화된 API key와 번역 캐시를 로컬에 저장합니다.
- Host permissions: Udemy·YouTube·NVIDIA Academy·Vimeo 자막 조회, 선택한 번역 provider 호출, `localhost`/`127.0.0.1` Custom LLM 호출에 사용합니다. 사용자 지정 HTTPS Custom LLM domain은 모델 가져오기 또는 연결 테스트 시 사용자가 승인한 경우에만 접근합니다.

## Google API Limited Use

Google API로부터 수신한 정보의 사용은 Limited Use 요구사항을 포함한 [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)를 준수합니다.

## 보안

모든 원격 provider 요청은 HTTPS를 사용합니다. Custom LLM은 사용자의 컴퓨터에서 실행하는 로컬 LLM과 사용자 지정 서버를 함께 지원합니다. 로컬 LLM은 `localhost` 또는 `127.0.0.1`의 HTTP endpoint를 사용할 수 있고, 사용자 지정 서버는 HTTPS와 사용자의 런타임 domain 접근 승인이 필요합니다. 공식 provider의 Base URL은 해당 provider의 공식 HTTPS origin으로 제한하고 redirect 응답을 자동 추적하지 않습니다.

## 문의와 변경

개인정보 관련 문의와 보안 제보는 [GitHub Issues](https://github.com/mungi/ai-subtitle-translator/issues)를 이용해 주세요. 이 방침이 변경되면 이 문서의 시행일과 저장소 변경 이력에 반영합니다.
