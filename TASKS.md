# 배포 및 수동 QA 체크리스트

완료된 개발 작업의 이력은 Git 커밋에서 관리합니다. 이 문서는 새 릴리스 전에 다시 확인해야 하는 항목만 유지합니다.

## 자동 검증

- [ ] `npm test`를 실행해 전체 자동 테스트를 통과한다.
- [ ] `npm run check`를 실행해 JavaScript 문법과 manifest JSON을 확인한다.
- [ ] `npm audit --omit=dev`로 프로덕션 의존성 취약점을 확인한다.

## 0.1.4 배포 검증 기록 (2026-10-28)

- 전체 자동 테스트 334개 중 333개 통과, 실패 0개. Windows에서 POSIX 실행 권한을 확인할 수 없는 릴리스 스크립트 검사 1개는 건너뛰었다.
- 모델 변경 시 Google AI·Google Translate·DeepL 요청이 실제로 취소되고 재시도·대체 번역을 시작하지 않는 회귀 테스트를 통과했다.
- `release/ai-subtitle-translator-v0.1.4.zip` 생성 완료. 최적화된 JavaScript 구문 검사, manifest 버전, 폰트·언어 리소스 포함 및 개발용 디렉터리 제외를 확인했다.

## 이전 변경 검증 기록 (2026-10-26)

- 전체 자동 테스트 324개 중 323개 통과. Windows에서는 `release-script.test.mjs`의 POSIX 실행 권한 검사 1개가 실패한다. Git에 기록된 `release.sh` 모드는 `100755`이며, Unix 환경의 실행 검증은 릴리스 전에 별도로 수행한다.
- 모든 확장 JavaScript의 `node --check`, manifest·언어 리소스·번역 비교 데이터 JSON 파싱, `git diff --check` 통과. Windows에서는 `npm run check` 대신 같은 문법·JSON 검사를 직접 수행했다.
- 소개 웹사이트의 한국어·영어·일본어 콘텐츠와 언어 선택 자동 테스트 3개 통과. 프로덕션 의존성 audit에서 취약점 0개.
- 실제 Google Translate 경로로 합성 문장 24개를 번역하고 로컬 Translator API 결과와 비교했다. 방법·한계와 결과는 [번역 비교](docs/translation-comparison.md)에 기록했다. 지원 사이트 전체의 수동 QA 완료를 의미하지 않는다.

## 브라우저 수동 QA

- [ ] Chrome에서 `extension/`을 Load unpacked로 다시 로드하고 옵션 화면을 연다.
- [ ] 기본 `간단 설정`에서 API 키 없이 Google Translate 자막 번역을 확인한다.
- [ ] 기존 Google Translate 설정을 유지한 채 재로드한 뒤 `/translate_a/t` 요청, cue별 번역 대응, 접근 제한·빈 응답 시 오류 안내와 원문 유지를 확인한다. 네트워크 점검은 확장 프로그램 service worker 개발자 도구에서 수행한다.
- [ ] Google AI API 키를 입력하고 `API 키 확인`을 눌러 Gemini 3.1 Flash Lite 연결을 확인한다.
- [ ] `고급 설정`에서 기존 provider, 자막 스타일, 백업·복원 설정이 유지되는지 확인한다.
- [ ] Udemy 실제 강의에서 자막 토글, 강의 전환, Google Translate와 LLM 최종 번역 교체를 확인한다.
- [ ] YouTube 일반 자막과 자동 생성 자막 영상에서 자막 수집과 번역을 확인한다.
- [ ] 확장 프로그램 재로드와 YouTube 새로고침 후 네이티브 자막 응답 수집, 기존 자막 활성 상태·언어 복원, XML/403 대체 경로를 확인한다.
- [ ] YouTube 단어 시간이 있는 원문에서 강조 진행, 앞으로/뒤로 탐색·배속 재생, 이중 자막의 원문 강조와 번역문의 문장 단위 표시를 확인한다.
- [ ] YouTube 수동 자막에서 특수문자 코드 디코딩, 단어 시간 없는 자막의 진행 추정, 배경 유지와 회색→설정 글자색 전환을 확인한다.
- [ ] YouTube 시작·중간 광고에서 AST 자막과 준비 메시지가 숨겨지고, 광고 종료 후 본영상 현재 시점의 자막이 복원되는지 확인한다.
- [ ] YouTube 자동 생성 자막의 겹치는 시간 구간, 앞으로/뒤로 탐색, 배속 재생에서 원문·번역 전환 시점이 맞는지 확인한다.
- [ ] 모든 지원 사이트에서 `자막 표시`의 이중 자막·원문 자막·번역 자막 전환, 기본 번역 자막, 번역 대기 중 원문 유지와 새로고침 후 선택 유지 여부를 확인한다.
- [ ] 페르시아어·아랍어 번역에서 영어·숫자·괄호가 섞인 문장, 원문/번역의 독립된 글 방향, Udemy 대본 번역의 오른쪽 시작 정렬을 확인한다.
- [ ] NVIDIA Academy와 Vimeo에서 Vimeo 자막 track 수집과 번역을 확인한다.
- [ ] TED 영상에서 HLS 자막 track 수집, 원문 표시, 번역 표시를 확인한다.
- [ ] 실제 API 키로 사용할 provider의 모델 목록 조회와 연결 테스트를 확인한다.
- [ ] Custom LLM의 로컬 URL과 사용자 지정 HTTPS URL 권한 요청을 확인한다.

## Chrome Web Store 등록

- [ ] 공개된 개인정보 처리방침 URL과 실제 데이터 처리 항목을 Developer Dashboard에 입력한다.
- [ ] 등록 화면의 권한 설명이 `manifest.json` 및 개인정보 처리방침과 일치하는지 검토한다.
- [ ] 릴리스 태그가 현재 커밋을 가리키는 상태에서 `./release.sh`를 실행하고, 생성된 ZIP과 GitHub Release asset을 확인한다.
