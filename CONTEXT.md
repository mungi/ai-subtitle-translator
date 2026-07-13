# CONTEXT.md

현재 저장소 상태와 구현 요약입니다.

## 저장소 구성

- `extension/`: Load unpacked 가능한 Chrome Manifest V3 확장 구현.
- `docs/`: 코드 분석 문서와 Chrome Web Store 소개문.

## 구현 원칙

- Google Translate를 기본 번역 provider로 둔다.
- DeepL은 Free/Pro API provider로 둔다.
- Udemy 자막은 course/lecture id 기반 API에서 caption URL을 가져온다.
- Google cue 번역은 `\n\n` delimiter로 cue 텍스트를 묶어 chunk 요청하고, 응답을 다시 cue에 매핑한다.
- Google/DeepL은 전체 LLM fallback 전용이 아니라 선택 가능한 provider다.

## 현재 구현 요약

- Udemy와 YouTube 자막 track 수집.
- 영어 source track 우선 선택.
- Google Translate cue 번역을 즉시 표시.
- LLM/DeepL provider 번역 완료 시 최종 자막으로 교체.
- DeepL, OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA NIM, Local LLM provider 설정.
- OpenAI/Anthropic/Gemini/OpenRouter/NVIDIA NIM/Local LLM 모델 목록 불러오기.
- 모델 목록 조회 후 권장 모델 자동 선택. 온라인 provider는 연결 테스트까지 수행하고 Local LLM은 모델 선택까지만 수행.
- Natural, Lecture, Technical, Custom 번역 스타일과 사용자 system prompt.
- Local LLM은 OpenAI-compatible `chat/completions`만 지원.
- 자막 스타일 설정과 드래그/resize 오버레이.
- API key AES-GCM 암호화 저장, 분산 key share 난독화, 기존 평문 자동 마이그레이션.
- 저장된 API key 마스킹 표시와 기존 secret 유지 저장.
- `chrome.storage.local` trusted-context 제한과 API key를 제외한 content-script 설정 bridge.
- runtime message sender 분리, hosted provider 공식 HTTPS origin/Local LLM loopback allowlist, cross-origin redirect 차단.
- 사용자 백업 비밀번호 기반 AES-GCM 설정 백업/복구.
- 한국어·영어·일본어 개인정보 처리방침과 Chrome Web Store 문서 연결.
- Chrome Web Store용 아이콘과 소개문.

## 주요 메시지 흐름

- `captions.udemy.fetchTranscript`: Udemy transcript 수집.
- `captions.youtube.fetchTranscript`: YouTube transcript 수집.
- `translation.translateDocument`: provider 번역 실행.
- `translation.progress`: content script로 chunk/cue 번역 진행 전달.
- `settings.getPublic`: API key가 제거된 설정을 content script에 전달.
- `settings.updateSubtitleStyle`: content script의 자막 위치와 폭 변경만 검증해 저장.
- `llm.testActiveProvider`: 선택 provider 연결 테스트.
- `llm.listModels`: provider 모델 목록 조회.
- `translation.clearCache`: 번역 캐시 삭제.

## 남은 주의점

- Udemy는 로그인과 수강 권한에 의존한다.
- YouTube 자동 자막은 영상별 제공 여부에 의존한다.
- API key는 AES-GCM 암호문으로 저장되지만 자동 복호화를 위한 key share도 로컬에 있으므로 표적 분석까지 막는 보안 저장소는 아니다.
- Chrome Web Store 등록 시 공개된 개인정보 처리방침 URL을 입력하고 실제 등록 권한 설명과 문서가 일치하는지 확인해야 한다.
- 상세 파일별 책임과 변경 영향 범위는 `docs/code-analysis.md`를 기준으로 확인한다.
