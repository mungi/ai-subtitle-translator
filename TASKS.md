# TASKS.md

현재 작업 상태 체크리스트입니다.

## 완료

- [x] Git 저장소 초기화와 주요 작업 단위 commit.
- [x] Chrome Manifest V3 기본 구조 작성.
- [x] Udemy 자막 track 수집과 WebVTT 파싱.
- [x] YouTube caption track 수집과 transcript XML 파싱.
- [x] 공통 `SubtitleCue`, `SubtitleDocument` 모델 정규화.
- [x] Google Translate cue chunk 번역 구현.
- [x] DeepL Free/Pro provider 구현.
- [x] OpenAI Responses provider 구현.
- [x] Anthropic Messages provider 구현.
- [x] Google Gemini provider 구현.
- [x] OpenRouter provider 구현.
- [x] NVIDIA NIM provider 구현.
- [x] Local LLM을 포함하는 Custom LLM OpenAI-compatible provider 구현.
- [x] LLM 전체 subtitle JSON prompt와 chunk 번역.
- [x] JSON 응답 파싱과 loose recovery.
- [x] 번역 캐시와 캐시 삭제.
- [x] LLM 실패 시 Google Translate fallback.
- [x] Udemy 툴바 아이콘 클릭으로 자막 토글.
- [x] YouTube 툴바 아이콘 클릭으로 자막 토글.
- [x] 다른 플레이어 툴바 아이콘 클릭 시 AST 메뉴 자동 닫기.
- [x] Google cue 번역 중 노란색 상태 표시.
- [x] 최종 번역 완료색 표시.
- [x] Extension 아이콘 PNG 4종 생성.
- [x] 자막 위치 드래그 이동과 위치 저장.
- [x] 자막창 수동 resize와 폭 저장.
- [x] 자막 스타일 설정: 폰트, 웹폰트, 색상, 그림자, 외곽선, 배경.
- [x] Pretendard 기본 폰트와 사용자 Noonnu 웹폰트 CSS 입력.
- [x] target language 콤보박스.
- [x] Natural, Lecture, Technical, Custom 번역 스타일과 사용자 system prompt.
- [x] 브라우저 언어 기반 options UI.
- [x] OpenAI/Anthropic/Gemini/OpenRouter/NVIDIA NIM 모델 목록 불러오기.
- [x] Provider 연결 테스트.
- [x] 저장된 API key 마스킹 표시와 기존 secret 유지 저장.
- [x] storage trusted-context 제한과 secret 제외 content-script 설정 bridge.
- [x] runtime message sender 구분, provider endpoint allowlist와 redirect 차단.
- [x] Chrome Web Store 소개 문서와 개인정보 처리방침 한글/영문/일문 작성.
- [x] 코드 분석과 개발자용 문서 색인 정리.

## 검증 완료

- [x] 주요 JS 파일 `node --check` 통과.
- [x] Manifest JSON 파싱 통과.
- [x] Provider request builder 기본 URL/body 검증.
- [x] Google Translate cue chunk/parser 내부 검증.
- [x] YouTube caption track, timedtext format fallback, transcript panel fallback 정규화 확인.
- [x] Udemy WebVTT 샘플 파싱 확인.
- [x] 옵션 저장 후 provider 탭 유지.
- [x] provider 탭 기준 연결 테스트.
- [x] API key 마스킹 표시와 기존 secret 유지 테스트.
- [x] 공개 설정 API key 제거, storage fail-closed, sender/endpoint/redirect 보안 경계 테스트.
- [x] YouTube toolbar 버튼 클릭 시 현재 페이지 caption/transcript 데이터를 background 요청에 포함하는 테스트.

## 수동 QA 필요

- [x] Chrome에서 `extension/` Load unpacked 후 전체 옵션 화면 확인.
- [x] Udemy 실제 강의에서 자막 토글, 강의 전환, Google cue 번역 확인.
- [x] Udemy 실제 강의에서 LLM 최종 번역 교체 확인.
- [x] YouTube 일반 자막 영상 테스트.
- [x] YouTube 자동 생성 자막 영상 테스트.
- [x] OpenAI/Anthropic/Gemini/OpenRouter 실제 API key로 모델 목록 조회 테스트.
- [x] Custom LLM의 로컬 OpenAI 호환 서버 Base URL `http://localhost:1234/v1` 연결 테스트.
- [x] Chrome Web Store 제출 전 권한/개인정보 문구 최종 검토.
- [ ] Chrome Web Store Developer Dashboard에 공개 개인정보 처리방침 URL과 실제 데이터 처리 항목 입력.
