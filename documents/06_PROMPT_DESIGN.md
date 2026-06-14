# 06_PROMPT_DESIGN

## MVP 프롬프트

1. 글 기획서 생성
2. 본문 초안 생성
3. HTML 변환
4. 품질검사
5. AI 말투 제거/문체 변환
6. CTA 생성

## 출력 원칙

- 가능한 작업은 JSON schema를 정의한다.
- 품질검사는 점수, 경고, 차단 사유를 분리한다.
- 글 생성은 경쟁글 문장 복사를 금지한다.

## Patch 7B content_plan preview

Patch 7B의 content planning prompt preview는 실제 LLM 호출 없이 `/content/[id]` 화면에만 표시한다.

- system: helpful, original, people-first content planner 역할과 안전 원칙을 포함한다.
- user: content item, blog profile, brand profile, attached media metadata를 포함한다.
- outputFormat: `planJson` 기본 템플릿 구조를 포함한다.
- prompt preview는 DB에 저장하지 않는다.
- API Key, secret, provider headers, request template, media storagePath는 prompt에 포함하지 않는다.

## Patch 7C content_plan generation

Patch 7C는 Patch 7B의 prompt 구성을 실제 `content_plan` LLM 호출에 사용한다.

- LLM 응답은 JSON object로 추출하고 최소 planJson schema validation을 수행한다.
- 생성 후보는 자동 저장하지 않는다.
- validation error가 없을 때만 사용자가 후보를 `planJson`에 반영할 수 있다.
- prompt 전문과 raw LLM response 전문은 로그에 저장하지 않는다.

## Patch 7C-SAFETY-HOTFIX finance/investment guardrails

`content_plan` system prompt는 투자/금융/서비스 홍보 콘텐츠에서 다음 원칙을 명확히 지시한다.

- 수익 보장, 매수/매도 추천, 성공률 주장, 수익률 예시, 무위험 표현을 생성하지 않는다.
- 주식/투자 서비스는 정보 제공 또는 참고 도구로만 설명한다.
- 안전하게 매수 타이밍을 잡거나 더 나은 투자 성과를 보장한다는 인상을 주지 않는다.
- CTA는 정보성이고 절제된 수준으로 작성한다.
- 한국어 콘텐츠에서도 `수익률 예시`, `성공 사례`, `안전하게 매수` 같은 표현을 생성하지 않는다.

LLM 응답 후보는 저장 전 rule-based validation을 통과해야 한다. 심각한 금융/투자 위험 표현은 validation error로 처리해 `planJson` 반영을 막고, 주의 표현은 warning으로 표시한다. 투자 관련 서비스 홍보 맥락에서는 주의 표현도 더 엄격하게 error로 처리한다.

## Patch 8A draftMarkdown preview

Patch 8A는 저장된 `planJson`을 기반으로 본문 초안 생성을 준비하는 dry-run prompt preview만 제공한다.

- 실제 LLM 호출은 수행하지 않는다.
- `draftMarkdown`과 `draftHtml`은 저장하지 않는다.
- draft prompt는 `content_draft` Task Route를 기준으로 readiness를 확인한다.
- `content_plan` route를 본문 초안 생성용으로 재사용하지 않는다.
- prompt preview에는 저장된 content item, blog profile, brand profile, `planJson`, attached media metadata만 포함한다.
- prompt preview에는 API Key, secret, provider headers, request template, media `storagePath`를 포함하지 않는다.
- system prompt는 helpful, original, people-first article writer 역할과 Markdown 초안 작성 원칙을 포함한다.
- 투자/금융 콘텐츠는 정보 제공/참고 도구로만 표현하고, 수익 보장, 매수/매도 추천, 성공 사례, 수익률 예시, 안전하게 매수 같은 표현을 금지한다.
- output format은 Markdown only, H1/H2/H3 구조, intro/body/conclusion, FAQ, CTA, risk/disclaimer, media placeholder 사용 원칙을 포함한다.

## Patch 8B content_draft generation

Patch 8B는 저장된 `planJson`과 `content_draft` Task Route를 사용해 실제 LLM 호출로 `draftMarkdown` 후보를 생성한다.

- `content_plan` route는 draft generation에 사용하지 않는다.
- Generated Plan Candidate에만 있고 아직 저장되지 않은 후보는 draft generation 입력으로 사용하지 않는다.
- 생성 후보는 자동 저장하지 않고, 사용자가 검토 후 `draftMarkdown에 반영`을 눌렀을 때만 저장한다.
- `draftHtml` 생성, HTML 변환, 품질검사, Blogger 연동은 수행하지 않는다.
- OpenAI-compatible Provider는 chat completions 형식과 모델별 max token parameter를 사용한다.
- Ollama-compatible Provider는 `/api/generate`, `stream: false`, `options.temperature`, `options.num_predict`를 사용한다.
- custom HTTP/CLI Provider는 Patch 8B의 실제 draft generation 대상에서 제외한다.
- LLM 응답 후보는 Markdown 문자열로 취급하며 길이, H1, 섹션 구조, media placeholder, FAQ, risk/disclaimer, 금융/투자 위험 표현을 rule-based validation으로 검사한다.
- prompt 전문, raw response 전문, 후보 Markdown 전문은 `llm_call_logs`에 저장하지 않는다.

## Patch 8B-HOTFIX draft safety prompt and repair

Patch 8B-HOTFIX는 draft prompt의 금융/투자/서비스 홍보 안전 문구를 강화하고, draft validation error가 발생한 후보에 대해 1회 자동 repair를 수행한다.

- draft system/output prompt는 `무료 체험`, `지금 시작`, `더 유리합니다`, `신뢰할 수 있는 투자`, `매수 타이밍을 잡다`, `수익률`, `성공 사례`, `성공`, `수익 보장`, `원금 보장`, `손실 없음`, `리스크 없음`, `안전하게 매수`, `안전한 투자`, `매수 추천`, `매도 추천`, `확실한 수익`을 생성하지 말라고 명시한다.
- 중립 대체 표현으로 `기능 살펴보기`, `공식 페이지에서 확인하기`, `서비스 기능 확인하기`, `관심 종목 정보를 한 화면에서 참고하기`, `투자 판단을 돕는 참고 정보로 활용하기`, `최종 투자 판단은 사용자가 직접 해야 합니다`를 제시한다.
- CTA는 가입 유도형이나 긴급한 표현이 아니라 정보성/검토형으로 작성한다.
- draft validation error가 있으면 같은 provider/model에 repair prompt를 1회 보내고, 전체 구조를 유지하면서 문제가 된 문장/문구만 수정하도록 요청한다.
- repair 결과도 다시 validation하며, error가 남으면 사용자가 후보를 편집하고 재검증해야 한다.
- repair는 자동 저장을 하지 않으며, 사용자가 `draftMarkdown에 반영`을 눌렀을 때만 저장된다.

## 2026-06-14 closeout note

현재 prompt 구현 상태는 `content_plan`과 `content_draft` 후보 생성까지다. `draftHtml` 생성용 prompt, HTML 변환 prompt, 품질검사 prompt는 아직 구현하지 않았다.

다음 세션 Patch 8C에서는 저장된 `draftMarkdown`을 기반으로 HTML 변환 dry-run/preview prompt 또는 rule-based 변환 정책을 설계한다. 실제 Blogger 연동과 자동 저장은 포함하지 않는다.

## Patch 8C HTML dry-run conversion

Patch 8C는 LLM prompt를 사용하지 않는다. 저장된 `draftMarkdown`을 rule-based로 escaped HTML preview로 변환한다.

- Markdown heading, paragraph, list, blockquote, code fence, basic inline formatting을 제한적으로 변환한다.
- raw HTML 입력은 preview에서 escape한다.
- script/iframe/form/style 계열 raw HTML, `javascript:` URL, event handler 속성 패턴은 security readiness fail로 표시한다.
- media placeholder는 attached asset과 매칭해 preview용 figure markup으로 변환한다.
- previewHtml은 화면 표시용이며 DB에 저장하지 않는다.
- Blogger embed/upload/publish용 prompt 또는 API 호출은 포함하지 않는다.

## Patch 8D HTML candidate validation

Patch 8D도 LLM prompt를 사용하지 않는다. HTML 후보 편집, 재검증, `draftHtml` 수동 반영은 모두 rule-based validation으로 처리한다.

- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<button>`, `<style>`, `<link>`, `<meta>` 태그는 error다.
- `javascript:` URL과 `onload=`, `onclick=`, `onerror=` 같은 event handler 속성은 error다.
- `storagePath`, `local-data/`, `/uploads/`, 로컬 절대 경로, `file://`은 error다.
- `/api/content-assets/{assetId}/file` 참조는 현재 content item의 attached asset일 때만 허용한다.
- `<article>`, H1, H2/H3, media caption/alt, 외부 URL은 warning으로 검토한다.
- prompt 전문, raw LLM response, secret, API Key, provider header는 생성하거나 로그에 저장하지 않는다.

## Patch 9E-4C-1 provider-aware draft generation strategy foundation

Patch 9E-4C-1은 `content_draft` 생성을 위한 전략 판별 기반만 추가한다.

- commercial/high-performance remote provider는 기존 one-shot full draft 생성을 기본값으로 유지한다.
- `local`, `local_http`, `cli`, `ollama_compatible`, `custom_cli` 계열은 local/small-model-like provider로 판별해 skeleton-first + sectioned multi-pass + final polish 전략 후보로 표시한다.
- 이번 패치에서 실제 skeleton 생성, section별 LLM 호출, final polish LLM 호출은 구현하지 않는다.
- local/small-model-like route도 실제 생성은 기존 one-shot fallback 경로를 계속 사용한다.
- 생성 응답과 `llm_call_logs.metadata`에는 safe strategy metadata만 남긴다: `strategy`, `strategyReason`, provider/model summary, `isLocalLike`, `stepCount`, `plannedStepCount`, `sectionedGenerationImplemented=false`, `finalPolishImplemented=false`.
- prompt 전문, raw response 전문, 후보 Markdown 전문은 계속 저장하지 않는다.
- `TaskRoute` schema에 strategy field를 추가하지 않는다.

## Patch 9E-4C-2 Local LLM sectioned draft generation preview

Patch 9E-4C-2는 local/small-model-like `content_draft` route에서 실제 skeleton-first sectioned draft generation preview를 수행한다.

- commercial/high-performance remote provider는 기존 one-shot full draft generation을 계속 사용한다.
- `local_sectioned_multi_pass` 전략에서만 skeleton generation, section generation, deterministic assembly, final polish를 수행한다.
- skeleton prompt는 title, section keys, H2/H3 outline, section goals만 요구하고 긴 본문 생성을 금지한다.
- section generation은 intro/body/conclusion 계열 section fragment만 생성하며 H1 생성을 금지한다.
- final polish는 assembled draft의 톤, 흐름, 중복, CTA, disclaimer 균형을 다듬지만 새 주장 과다 추가와 투자 추천 표현을 금지한다.
- final polish 입력이 너무 길거나 final polish가 실패하면 deterministic assembled draft를 candidate로 반환할 수 있다.
- 최종 candidate는 기존 `validateDraftMarkdown`과 manual apply 흐름을 사용한다.
- API 응답에는 candidate Markdown preview가 포함될 수 있지만 DB/log에는 prompt 전문, raw response 전문, skeleton 전문, section fragment 전문, final polish 입력/출력 전문, candidate 전문을 저장하지 않는다.
- `llm_call_logs.metadata`에는 step/section key, prompt/response hash, duration, status, validation summary 같은 safe metadata만 저장한다.
- HTML template/theme rendering은 Patch 9E-4D로 분리한다.
