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
