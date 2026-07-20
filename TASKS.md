# 배포 및 수동 QA 체크리스트

완료된 개발 작업의 이력은 Git 커밋에서 관리합니다. 이 문서는 새 릴리즈 전에 다시 확인해야 하는 항목만 유지합니다.

## 자동 검증

- [ ] `npm test`를 실행해 전체 자동 테스트를 통과한다.
- [ ] `npm run check`를 실행해 JavaScript 문법과 manifest JSON을 확인한다.
- [ ] `npm audit --omit=dev`로 프로덕션 의존성 취약점을 확인한다.

## 브라우저 수동 QA

- [ ] Chrome에서 `extension/`을 Load unpacked로 다시 로드하고 옵션 화면을 연다.
- [ ] 기본 `간단 설정`에서 API 키 없이 Google Translate 자막 번역을 확인한다.
- [ ] Google AI API 키를 입력하고 `API 키 확인`을 눌러 Gemini 3.1 Flash Lite 연결을 확인한다.
- [ ] `고급 설정`에서 기존 provider, 자막 스타일, 백업·복원 설정이 유지되는지 확인한다.
- [ ] Udemy 실제 강의에서 자막 토글, 강의 전환, Google Translate와 LLM 최종 번역 교체를 확인한다.
- [ ] YouTube 일반 자막과 자동 생성 자막 영상에서 자막 수집과 번역을 확인한다.
- [ ] NVIDIA Academy와 Vimeo에서 Vimeo 자막 track 수집과 번역을 확인한다.
- [ ] TED 영상에서 HLS 자막 track 수집, 원문 표시, 번역 표시를 확인한다.
- [ ] 실제 API 키로 사용할 provider의 모델 목록 조회와 연결 테스트를 확인한다.
- [ ] Custom LLM의 로컬 URL과 사용자 지정 HTTPS URL 권한 요청을 확인한다.

## Chrome Web Store 등록

- [ ] 공개된 개인정보 처리방침 URL과 실제 데이터 처리 항목을 Developer Dashboard에 입력한다.
- [ ] 등록 화면의 권한 설명이 `manifest.json` 및 개인정보 처리방침과 일치하는지 검토한다.
- [ ] 릴리즈 태그가 현재 커밋을 가리키는 상태에서 `./release.sh`를 실행하고, 생성된 ZIP과 GitHub Release asset을 확인한다.
