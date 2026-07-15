# 간단 설정과 고급 설정 모드 설계

## 목적

설정 화면의 항목이 많아 처음 사용하는 사용자가 혼란을 겪지 않도록 `간단 설정`과 `고급 설정` 탭으로 나눈다. 기본 화면에서는 Google AI API Key 하나만 입력하면 Gemini 3.1 Flash Lite를 사용할 수 있어야 한다.

## 범위

- 옵션 화면의 `AI 자막 번역 설정` 제목 바로 아래에 `간단 설정`과 `고급 설정` 탭을 추가한다.
- 페이지를 열 때마다 `간단 설정` 탭을 기본 선택한다. 선택 탭은 저장하지 않는다.
- 간단 설정에는 Google AI API Key 입력, 기존 Google AI 안내 문구, `Get API Key` 링크, 더미 YouTube 설정 가이드 링크만 표시한다.
- 고급 설정에는 현재의 지원 사이트, 기본 번역, Provider별, 임시 번역, 자막 스타일, 백업/복원 설정을 유지한다.
- 한국어 메시지를 원본으로 추가하고 영어·일본어 메시지와 같은 구조로 동기화한다.

## 간단 설정 동작

1. Google AI API Key 입력은 기존 Provider API Key와 동일한 마스킹 규칙을 사용한다. 저장된 원문 키는 다시 표시하거나 복사할 수 없어야 하며, 마스킹된 값을 그대로 저장해도 원문 키가 보존되어야 한다.
2. 입력값 변경은 기존 자동 저장 방식에 맞춰 저장한다.
3. 저장할 때 Google Provider의 모델을 `gemini-3.1-flash-lite`로 설정한다.
4. 키가 바뀌면 Google Provider 연결을 자동으로 검증한다.
5. 검증 성공 시 Google Provider의 연결 성공 상태를 저장하고 활성 번역 Provider를 Google AI로 바꾼다.
6. 검증 실패 시 Google Provider의 성공 상태를 제거하고, 기존 활성 Provider는 바꾸지 않는다. 간단 설정 안에 실패 상태를 표시한다.
7. 안내 문구는 기존 `providerGuideGoogle` 메시지를 그대로 쓴다. 링크는 Google AI Studio의 `Get API Key`와 더미 URL `https://www.youtube.com/watch?v=PLACEHOLDER`의 YouTube 설정 가이드만 제공한다.

## 화면 구조

`page-header` 직후에 접근 가능한 탭 목록을 둔다. 각 탭은 `role=tab`과 연결된 `role=tabpanel`을 가지며, 키보드로 선택할 수 있다. 간단 설정 패널에는 제목, API Key 입력, 안내 문구, 두 링크, 연결 상태만 둔다. 고급 설정 패널은 기존 설정 섹션을 감싸며 기존 ID와 이벤트 연결을 유지한다.

## 오류 처리

- 자동 연결 검증 중에는 간단 설정의 상태 메시지로 진행 상태를 표시한다.
- 검증 실패는 API Key가 유효하지 않거나 네트워크 요청을 완료하지 못한 경우를 포함한다. 실패 메시지는 기존 활성 번역 Provider를 변경하지 않는다는 동작과 함께 표시한다.
- 빈 키로 변경하면 Google Provider의 연결 성공 상태를 제거하고 활성 Provider를 변경하지 않는다.

## 검증

- 옵션 레이아웃 테스트로 제목 아래 탭, 기본 간단 설정 선택, 고급 설정의 기존 섹션 보존을 확인한다.
- 간단 설정 테스트로 API Key 단일 입력, 기존 안내 문구, `Get API Key` 한 개, 더미 YouTube 가이드 링크 한 개를 확인한다.
- 동작 테스트로 키 저장 시 모델이 `gemini-3.1-flash-lite`가 되는 것, 연결 성공 시 Google AI 활성화, 실패·빈 키 시 기존 활성 Provider 유지와 Google 성공 상태 해제를 확인한다.
- 전체 `npm test`와 `npm run check`를 실행한다.
