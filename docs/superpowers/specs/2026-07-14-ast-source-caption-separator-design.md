# AST 원본 자막 메뉴 구분선 설계

## 목적

모든 AST 플레이어 메뉴에서 `원본 자막: <선택된 자막>` 항목 바로 위에 가로 구분선을 표시한다. 이미 `AI 자막 번역` 항목 위에 쓰이는 구분선과 동일한 구조 및 스타일을 사용한다.

## 범위

- 공통 `renderSourceCaptionMenu()` 경로만 변경한다.
- YouTube, Udemy, NVIDIA Academy, Vimeo의 AST 메뉴에 동일하게 적용한다.
- 선택 가능한 원본 자막이 없어 해당 서브메뉴가 렌더링되지 않는 경우에는 구분선도 추가하지 않는다.

## 구현

`renderSourceCaptionMenu()`가 선택된 자막을 확인한 후 기존 `ast-provider-menu-separator` 요소를 만들고, 원본 자막 서브메뉴보다 먼저 메뉴에 추가한다. 기존 CSS 클래스와 플랫폼별 여백 규칙을 재사용하며, 별도의 스타일 변경은 하지 않는다.

## 검증

- 메뉴에 원본 자막 서브메뉴가 있는 경우, 바로 앞 형제 요소가 `ast-provider-menu-separator`인지 확인한다.
- 기존 `AI 자막 번역` 위 구분선과 설정 메뉴 순서가 유지되는지 확인한다.
- 기존 content-script 테스트와 전체 검사 명령을 실행한다.
