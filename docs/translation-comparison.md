# Chrome 내장 번역과 Google Translate 비교

[한국어](translation-comparison.md) · [English](translation-comparison-en.md) · [日本語](translation-comparison-ja.md)

## 시험 방법

2026-10-26에 영어→한국어 합성 문장 24개를 각 엔진으로 1회 번역했다. 일상 대화, 관용구, 부정·수량, 기술 용어, 고유명사, 구어, 중의성, 긴 문장, 분리·결합 자막, 조건·단위를 포함했다.

- Chrome: 사용자가 로컬 시험 페이지에서 실행한 `Translator` API의 저장 결과. 브라우저가 보고한 버전은 Chrome 156이며 번역 모델 버전은 수집하지 않았다.
- Google: AST의 `translateCuesWithGoogle`을 직접 실행한 결과. `/translate_a/t?client=gtx` 경로이며 공식 Google Cloud Translation API 결과가 아니다.
- 원문, 참고 번역, 실제 응답과 항목별 평가: [시험 데이터](translation-comparison-results.json).

## 평가 기준과 결과

작성자의 정성 평가다. 4점은 의미와 주요 표현 보존, 3점은 핵심 의미 보존과 경미한 어색함·누락, 2점은 부분 의미 보존과 중요 표현 손실, 1점은 주요 의미 오역, 0점은 핵심 의도 상실 또는 반대 의미다. 사전 작성 참고 번역은 유일한 정답으로 취급하지 않았다.

문맥 없는 `I saw her duck.`은 오리와 몸을 숙이는 동작으로 모두 해석할 수 있어 점수에서 제외했다. 나머지 23개에서 Chrome은 52/92점, Google은 63/92점이었다. Google 우세 6개, Chrome 우세 0개, 동률 17개였다. 이 점수는 정확도 백분율이 아니다.

| 사례 | Chrome 내장 | Google Translate |
| --- | --- | --- |
| `give me a hand` | 손을 내밀라는 표현으로 직역 | 어색하지만 도움 요청의 의미 보존 |
| `generalizes poorly` | 일반화 성능이 나쁘다는 의미 누락 | 핵심 의미 보존 |
| `Green River` | 녹색 강 | 그린 강 |
| `spilled the beans` | 콩을 쏟았다 | 콩을 쏟았다 |
| `not unlikely` | 가능성이 없다는 의미로 반전 | 가능성이 없다는 의미로 반전 |
| 공이 날아오는 문맥의 `her duck` | 그녀의 오리 | 그녀의 오리 |

## 시간과 한계

Chrome 초기화는 모델 다운로드·준비를 포함해 7.56초였으며, 이후 24회 번역 호출 합계는 196.8ms, 중앙값은 7.7ms였다. Google의 AST 배치 경로 전체는 332.7ms였다. 호출 구조, 캐시 상태와 실행 환경이 달라 이 값으로 엔진 속도 순위를 정하지 않는다.

도전적인 소규모 합성 표본이며 외부 평가자나 반복 측정이 없다. 다른 언어·영상·모델 버전의 품질을 대표하지 않는다. 특히 두 방식 모두 관용구와 문맥 해석에 실패한 사례가 있다.

## 적용 판단

이번 시험에서 Google이 우세했으므로 품질 개선을 이유로 기본 엔진을 Chrome 내장 번역으로 교체할 근거는 없다. 로컬 처리나 Google 연결 실패 시 대안으로는 검토할 수 있다. Chrome 내장 Translator API는 현재 AST에 통합하지 않았다.
