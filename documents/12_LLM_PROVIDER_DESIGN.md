# 12_LLM_PROVIDER_DESIGN

## 목표

Blog Growth Agent는 OpenAI API와 로컬 LLM을 모두 지원한다.
관리자는 웹 설정에서 기본 Provider, 모델, 작업별 라우팅, fallback 정책을 변경할 수 있어야 한다.

## 작업별 라우팅

| 작업 | 권장 기본값 | 대체 |
|---|---|---|
| 글 기획서 생성 | OpenAI API | Local LLM |
| 본문 초안 생성 | OpenAI API | Local LLM |
| HTML 변환 | Rule-based + Local LLM | OpenAI API |
| 품질검사 | Rule-based + Local LLM | OpenAI API |
| 금지표현 검사 | Rule-based 필수 | LLM 보조 |
| CTA 생성 | Local LLM | OpenAI API |
| 문체 변환 | Local LLM | OpenAI API |

## Provider 추상화

```text
Content Tasks
→ LLM Router
→ OpenAI Provider / Local LLM Provider
```

## 필수 로그

- task_type
- provider_type
- model_name
- status
- latency_ms
- input_tokens
- output_tokens
- estimated_cost
- error_message

## 보안 원칙

- API Key는 평문 저장 금지
- 화면에 전체 API Key 표시 금지
- 로그에 API Key 출력 금지
- 민감 자료는 로컬 LLM 우선 처리 가능해야 함

## Patch 9F-1E Operation Profile Policy Simulation

Patch 9F-1E does not use an LLM provider.

The Operation Profile policy simulation is a deterministic, read-only summary built from existing publish gate metadata and the stored `safe_manual_publish` profile. It must not:

- call OpenAI, local HTTP, CLI, or any LLM provider
- create `llm_call_logs`
- store prompt, raw response, candidate, draft, or HTML text
- change publish blockers or execution permissions

The simulation is advisory-only and reports `policyEnforced=false`, `actualBlockerImpact=false`, and `actualExecutionPermissionImpact=false`.

Patch 9F-1F extends this same deterministic/read-only policy work with `operationProfileScenarioMatrixSummary`. The matrix is still simulation-only and must not call LLM providers or create `llm_call_logs`.

Patch 9F-2A adds Daily Auto Content Plan draft preview using deterministic/static planning metadata only. It must not call LLM providers, generate article bodies, create `content_items`, or create `llm_call_logs`.

Patch 9F-2E adds a Daily Content Queue operator approval workflow draft using existing persisted plan/item/content fixture metadata only. It must not call LLM providers, generate article bodies, create approval rows, mutate `content_items`, or create `llm_call_logs`.

Patch 9F-2F adds a draft-generation readiness preflight for the linked daily content fixture. It is structural/read-only only: it may report that a linked fixture is ready for a future generation step, but execution remains disabled. It must not call LLM providers, create `llm_call_logs`, generate `draftMarkdown`, generate `draftHtml`, or mutate `content_items`.

Patch 9F-2G is an operator approval persistence design only. It proposes future approval tables and gates, but does not create schema, persist approvals, call LLM providers, create `llm_call_logs`, generate draft content, or mutate `content_items`.

Patch 9F-2H is a draft-generation execution gate design only. It defines the future layers that must pass before a Daily Content Plan item can call an LLM and mutate one target content draft. It must not call OpenAI, local HTTP, CLI, or any LLM provider; it must not create `llm_call_logs`; and it must not generate or save `draftMarkdown` or `draftHtml`. In the future implementation, `BLOG_DAILY_CONTENT_DRAFT_GENERATION_LLM_ENABLED=true` is necessary but not sufficient: operator approval, content mutation/write flags, confirmation phrase, idempotency, provider/model health, and publish isolation gates must also pass.

Patch 9F-2I adds only the Prisma schema scaffold and unapplied migration draft for operator approval persistence. It must not call OpenAI, local HTTP, CLI, or any LLM provider; it must not create `llm_call_logs`; it must not generate or save `draftMarkdown` or `draftHtml`; and it must not apply the migration or create approval rows/events.

Patch 9F-2J adds a read-only draft-generation execution gate preview API and `/settings/blogger` UI readback. It checks target integrity, structural readiness, pending approval-table migration state, disabled LLM/content mutation/write flags, confirmation, idempotency, and publish isolation. It must not call any LLM provider, create `llm_call_logs`, generate drafts, mutate `content_items`, persist approvals, apply migrations, or query pending approval tables as Prisma models.

Patch 9F-2I-APPLY applies only the existing operator approval persistence migration. It creates approval tables but does not create approval rows/events and does not call LLM providers, create `llm_call_logs`, generate drafts, mutate `content_items`, or perform Blogger/OAuth/token/publish actions. After apply, 9F-2J preview can report approval persistence available while still blocking execution because operator approval is missing and LLM/content mutation/write gates remain disabled.

Patch 9F-2K adds the guarded operator approval persistence preview/apply route and Settings readback. It still does not call OpenAI, local HTTP, CLI, or any LLM provider; it does not create `llm_call_logs`; and it does not generate or save `draftMarkdown` or `draftHtml`. After the exact Korean approval phrase, the approved apply was executed once and created or idempotently confirmed one operator approval row and one approval event row only. LLM execution remains blocked until a later explicit draft-generation patch.

Patch 9F-2L polishes only the post-approval draft-generation execution gate preview and Settings readback. It confirms that the operator approval is persisted and satisfied, but it keeps draft-generation execution blocked because LLM execution, content mutation, draft generation write, confirmation phrase, and idempotency gates remain disabled or missing. It must not call OpenAI, local HTTP, CLI, or any LLM provider; it must not create `llm_call_logs`; it must not generate or save `draftMarkdown` or `draftHtml`; and it must not mutate `content_items`.

Patch 9F-2N adds a read-only LLM provider execution readiness preview for future Daily Content Plan draft generation. It reads the existing `content_draft` Task Route and safe provider/model metadata, checks only env presence booleans, and reports route/provider/model readiness blockers before any execution patch. It must not call OpenAI, local HTTP, Ollama, CLI, or any LLM provider; it must not run provider health checks or network calls; it must not expose env values, raw secrets, encrypted values, API keys, bearer tokens, provider request bodies, or raw responses; it must not create `llm_call_logs`; and it must not generate or save `draftMarkdown` or `draftHtml`.

Patch 9F-2O adds a read-only LLM provider health-check preview for future Daily Content Plan draft generation. It reuses the 9F-2N provider/model readiness result, describes the future safe health-check contract, and reports provider-specific allowed health-check types before any provider call is allowed. It must not execute provider health checks, make provider network calls, call completion/generate/chat endpoints, render or store prompts, create `llm_call_logs`, generate drafts, mutate `content_items`, or expose env values, raw secrets, encrypted values, API keys, bearer tokens, prompt text, provider request bodies, or raw responses. `mode=healthcheck_preview` remains gated/blocked and only previews the future health-check execution path.

Patch 9F-2P adds the first gated provider health-check execution path for future Daily Content Plan draft generation. The route is separate from content generation and defaults to blocked/no-network behavior unless both health-check feature flags, the exact confirmation phrase, idempotency key, route/provider/model readiness, required env presence, and supported safe endpoint category all pass. Completion/chat/generate/responses endpoints remain forbidden. A future explicitly approved positive health-check may only use safe metadata/version/tags/models/health endpoint categories, must use a short timeout with no retries, must not return raw response bodies or headers, and must not create `llm_call_logs` or mutate provider/content/Blogger/publish rows. Default validation must prove `providerNetworkCallAttempted=false`, `llmCompletionAttempted=false`, and all mutation side effects false.

Patch 9F-2Q adds a final read-only draft-generation execution checklist and operator runbook. It consolidates the 9F-2M dry-run planner, 9F-2N provider readiness, 9F-2O health-check preview, and 9F-2P health-check execution gate into an operator-facing status summary without calling LLM providers, rendering prompts, running provider health checks, creating `llm_call_logs`, or mutating content.

## Patch 3 설정 화면

`/settings/llm` 화면은 Patch 2의 PostgreSQL + Prisma CRUD API를 사용해 다음 데이터를 관리한다.

- LLM Provider
- LLM Model
- LLM Task Route
- LLM Call Log

Provider, Model, Task Route는 목록 조회, 생성, 수정, 삭제를 지원한다.
Call Log는 최근 로그 목록 조회만 지원한다.

### Patch 3 제외 항목

- 실제 OpenAI API 호출
- 실제 Local LLM HTTP 호출
- API Key 원문 입력/저장
- Google OAuth
- Blogger API
- 발행 기능

### 화면 보안 원칙

- Provider 화면은 `secretRef`, `apiKeyLast4` 같은 안전한 메타 정보만 다룬다.
- API Key 전체값을 입력하거나 표시하지 않는다.
- Call Log 화면은 secret, prompt 전문, 본문 원문을 표시하지 않는다.
- metadata는 요약/접기 형태로만 표시한다.

## Patch 7A Provider Invocation 확장

Patch 7A는 Provider 등록 구조를 `providerType`만으로 판단하지 않고 `invocationMode`와 `apiFormat` 중심으로 확장한다.

### Provider 유형

- `external_http`: 외부 HTTP LLM API
- `local_http`: 로컬 HTTP LLM API
- `cli`: 로컬 CLI 실행 기반 Provider

기존 `openai`, `local` providerType 값은 호환성을 위해 유지한다.

### API Format

- `openai_compatible`: `/v1/chat/completions` 형태의 외부 API 테스트
- `ollama_compatible`: `/api/generate` 형태의 로컬 Ollama API 테스트
- `custom_http`: 설정 저장은 가능하지만 Patch 7A에서는 자유 template 실행을 제한한다.
- `custom_cli`: 설정 저장은 가능하지만 Patch 7A에서는 CLI 테스트 실행을 비활성화한다.

### Secret 처리

- API Key 원문은 DB에 저장하지 않는다.
- API Key는 서버에서 `LLM_SECRET_ENCRYPTION_KEY`를 사용해 암호화한 뒤 `llm_provider_secrets.encryptedValue`에 저장한다.
- 화면과 API 응답에는 `hasSecret`, `apiKeyLast4`, `secretRef`만 표시한다.
- 저장 후 API Key 전체값은 다시 표시하지 않는다.
- `LLM_SECRET_ENCRYPTION_KEY`가 없으면 secret 저장과 secret이 필요한 연결 테스트는 실패한다.

### 연결 테스트 로그

- 연결 테스트 API는 `POST /api/settings/llm/providers/[id]/test`다.
- 테스트 로그는 `llm_call_logs.taskType = provider_test`로 저장한다.
- 로그 metadata에는 `purpose`, `invocationMode`, `apiFormat`, `httpStatus`, `responseSummary`, `latencyMs` 같은 제한된 진단 정보만 저장한다.
- secret, API Key, request body 전문, response 전문, prompt 전문은 저장하지 않는다.
- 외부 Provider의 error response 전문은 저장하지 않고 HTTP status 기반의 안전 요약만 저장한다.
- OpenAI-compatible 401/403은 `authentication_failed` 또는 `Authentication failed. Check the API key.` 수준으로만 표시한다.
- OpenAI-compatible 400은 외부 error body 전문이 아니라 `parameter_error` 수준으로만 표시한다.
- OpenAI-compatible 테스트 요청은 모델명에 따라 `max_tokens` 또는 `max_completion_tokens`를 선택한다.
- `gpt-5`, `gpt-5.*`, `gpt-5-*`, `o1*`, `o3*`, `o4*` 계열은 `max_completion_tokens`를 사용한다.
- Bearer token, `sk-` 계열 API Key, API key/token/secret fragment로 보이는 문자열은 저장 전 redaction을 통과시킨다.

### CLI 보안 원칙

- raw shell command는 저장하거나 실행하지 않는다.
- CLI 설정은 `cliExecutable`과 `cliArgsJson` string array로만 저장한다.
- Patch 7A에서는 CLI 연결 테스트 실행을 비활성화한다.
- 후속 패치에서 실행을 열 경우 `child_process.spawn`과 `shell: false`, timeout, stdout/stderr 길이 제한, dangerous executable 차단을 적용한다.

## Patch 7B Content Plan Dry Run

Patch 7B는 `/content/[id]`에서 실제 LLM 호출 전에 `content_plan` route와 prompt 구성을 검토하는 dry-run 화면을 제공한다.

- `GET /api/settings/llm/task-routes`를 재사용해 `content_plan` route를 찾는다.
- Primary/Fallback Provider와 Model, Provider test 상태를 표시한다.
- Dry Run은 route readiness와 prompt preview만 생성한다.
- OpenAI/Ollama/Local LLM 호출은 수행하지 않는다.
- `planJson`은 자동 생성하거나 저장하지 않는다.
- `llm_call_logs`는 생성하지 않는다.
- prompt preview는 system, user, outputFormat으로 분리해 화면에만 표시한다.
- prompt preview에는 content item, blog profile, brand profile, attached media metadata를 포함한다.
- prompt preview에는 API Key, apiKeyLast4, secretRef, encryptedValue, headersJson, requestTemplateJson, storagePath를 포함하지 않는다.

## Patch 7C Content Plan Generation Candidate

Patch 7C는 `/content/[id]`에서 `content_plan` Task Route를 사용해 실제 LLM 호출로 planJson 후보를 생성한다.

- 생성 API는 `POST /api/content-items/[id]/generate-plan`이다.
- 생성 결과는 자동 저장하지 않고 화면의 후보 preview로만 반환한다.
- 사용자가 `planJson에 반영` 버튼을 눌러야 기존 content item PATCH 흐름으로 저장한다.
- primary Provider 호출 자체가 실패하면 fallback Provider/Model을 1회 시도할 수 있다.
- JSON parse 실패와 validation 실패는 fallback하지 않는다.
- OpenAI-compatible 호출은 `/v1/chat/completions`를 사용하며 모델명에 따라 `max_tokens` 또는 `max_completion_tokens`를 선택한다.
- Ollama-compatible 호출은 `/api/generate`, `stream: false`를 사용한다.
- LLM raw response는 JSON 추출/파싱에만 사용하고 DB에 저장하지 않는다.
- `llm_call_logs` metadata에는 `purpose`, `usedFallback`, `apiFormat`, `invocationMode`, `responseSummary`, validation count만 저장한다.
- prompt 전문, request body 전문, raw response 전문, API Key, Bearer token, secretRef, encryptedValue, media storagePath는 로그에 저장하지 않는다.
- fallback provider 호출도 실패하면 fallback provider/model 기준으로 failed 로그를 남긴다.
- JSON parse 실패는 provider 호출 성공 후 실패로 보고 해당 provider/model 기준으로 `json_parse_failed` 요약만 기록한다.
- 투자/금융/서비스 홍보 안전성 검사는 생성 후보를 저장하기 전에 rule-based validation으로 수행한다.
- 수익 보장, 매수/매도 추천, 수익률 예시, 성공 사례, 안전하게 매수 같은 심각 표현은 validation error로 처리해 `planJson` 반영을 차단한다.
- 주의 표현은 warning으로 표시하되, 투자 관련 `service_promotion` 맥락에서는 더 엄격하게 error로 승격한다.

## Patch 7D Call Log Safe DTO

Patch 7D는 `/api/settings/llm/call-logs` 응답을 운영 화면용 Safe DTO로 축소한다.

- provider relation은 `id`, `name`, `providerType`, `invocationMode`, `apiFormat`만 반환한다.
- model relation은 `id`, `name`, `displayName`만 반환한다.
- contentItem relation은 `id`, `title`, `mode`, `status`, `targetKeyword`만 반환한다.
- `sourceMemo`, `planJson`, `draftMarkdown`, `draftHtml`, `headersJson`, `requestTemplateJson`, `secretRef`, `apiKeyLast4`, `hasSecret`, `lastTestError`, `encryptedValue`는 call logs 응답에서 제외한다.
- `POST /api/settings/llm/call-logs`는 막고, 로그 생성은 서버 내부 `createLlmCallLog()` 호출로만 수행한다.
- `/settings/llm` Call Logs 화면은 safe summary와 제한된 metadata만 표시한다.
- `/content/[id]` Generated Plan Candidate UI는 validation error/warning count와 반영 가능 여부를 명확히 표시한다.

## Patch 7E Candidate Edit And Revalidation

Patch 7E는 `/content/[id]`에서 생성된 `planJson` 후보를 사용자가 직접 수정하고, LLM 호출 없이 재검증할 수 있게 한다.

- validation 로직은 provider 호출 모듈에서 분리된 순수 content 모듈에서 수행한다.
- 재검증 API는 `POST /api/content-items/[id]/validate-plan`이다.
- 재검증 API는 content item, blog, brand profile context만 조회하고 Provider, secret, route 설정은 조회하지 않는다.
- 재검증은 OpenAI/Ollama/Local LLM 호출을 수행하지 않는다.
- 재검증은 `llm_call_logs`를 생성하지 않는다.
- 편집된 후보는 재검증 전에는 `planJson`에 반영할 수 없다.
- validation error가 있으면 반영을 막고, warning만 있으면 검토 후 반영할 수 있다.
- 후보 편집과 재검증은 DB에 자동 저장하지 않고, 사용자가 `planJson에 반영`을 클릭해야 기존 content item PATCH 흐름으로 저장한다.

## Patch 8A Draft Markdown Dry Run

Patch 8A는 저장된 `planJson`을 기반으로 본문 초안 생성 준비 상태와 prompt preview를 확인한다.

- draft generation task type은 기존 `content_draft`를 사용한다.
- `content_plan` route를 본문 초안 생성 대용으로 재사용하지 않는다.
- `content_draft` Task Route가 없으면 route not configured readiness fail로 표시한다.
- Dry Run은 실제 OpenAI/Ollama/Local LLM 호출을 수행하지 않는다.
- Dry Run은 `draftMarkdown`, `draftHtml`, `llm_call_logs`를 생성하거나 저장하지 않는다.
- Draft prompt preview는 saved `planJson`, content item, blog profile, brand profile, attached media metadata를 기반으로 만든다.
- Prompt preview에는 API Key, secret, provider headers, request template, media `storagePath`를 포함하지 않는다.
- Media mapping preview는 `planJson.mediaPlan`과 attached media metadata가 본문 placeholder에 어떻게 연결될지 보여준다.

## Patch 8B Content Draft Generation

Patch 8B는 `content_draft` Task Route를 사용해 저장된 `planJson` 기반 `draftMarkdown` 후보를 실제 LLM 호출로 생성한다.

- `content_plan` Task Route는 draft generation에 사용하지 않는다.
- 생성 후보는 자동 저장하지 않으며, 사용자가 `/content/[id]`에서 검토 후 `draftMarkdown에 반영`을 눌렀을 때만 저장한다.
- `draftHtml`, HTML 변환, 품질검사, Blogger upload/publish는 수행하지 않는다.
- OpenAI-compatible Provider는 chat completions endpoint와 모델별 max token parameter를 사용한다.
- Ollama-compatible Provider는 `/api/generate`, `stream: false`, `options.temperature`, `options.num_predict`를 사용한다.
- primary provider call 실패 시에만 fallback provider/model을 1회 시도한다.
- draft validation 실패는 fallback 대상이 아니다.
- custom HTTP/CLI Provider는 Patch 8B 실제 draft generation 대상에서 제외하고 안전한 오류를 반환한다.
- `llm_call_logs`에는 taskType `content_draft`, provider/model/contentItem, status, latency, 가능한 token count, 제한된 metadata만 저장한다.
- metadata에는 `purpose`, `usedFallback`, `apiFormat`, `invocationMode`, `responseSummary`, validation count, `markdownLength`, `mediaPlaceholderCount`만 저장한다.
- prompt 전문, raw response 전문, request body 전문, 후보 Markdown 전문, API Key, Bearer token, secretRef, encryptedValue, provider headers, request template, media `storagePath`는 로그와 응답 summary에 저장하지 않는다.

## Patch 8B-HOTFIX Draft Repair

Patch 8B-HOTFIX는 `content_draft` 생성 결과가 validation error를 포함할 때 같은 Provider/Model로 1회 자동 repair를 수행한다.

- repair는 provider call 성공 후 validation error가 있을 때만 수행한다.
- repair는 fallback 대상이 아니며, 이미 선택된 primary 또는 fallback Provider/Model을 그대로 사용한다.
- repair prompt에는 기존 후보 Markdown, validation errors/warnings, 금지/주의 문구 목록, 중립 대체 표현 가이드만 포함한다.
- repair prompt에는 API Key, secret, provider headers, request template, media `storagePath`를 포함하지 않는다.
- repair 결과를 다시 `validateDraftMarkdown()`으로 검사한다.
- repair 성공 시 repair된 후보를 API 응답과 UI에 표시하지만 자동 저장하지 않는다.
- repair 후에도 validation error가 있으면 반영 버튼은 비활성화되며 사용자가 후보 편집 후 재검증해야 한다.
- `llm_call_logs` metadata에는 `repairAttempted`, `repairSucceeded`, 초기/최종 validation count, `repairResponseSummary` 같은 안전 요약만 저장한다.
- original/repaired draft 전문, prompt 전문, raw response 전문, request body 전문, API Key, Bearer token, secretRef, encryptedValue, provider headers, media `storagePath`는 로그에 저장하지 않는다.

## 2026-06-14 closeout LLM route state

현재 실제 생성에 사용된 Task Route는 다음 원칙을 따른다.

- `content_plan`은 planJson 후보 생성 전용이다.
- `content_draft`는 saved planJson 기반 draftMarkdown 후보 생성 전용이다.
- `content_plan` route를 `content_draft` 대용으로 사용하지 않는다.
- 최신 확인된 `content_draft` route는 Local Ollama / OpenClaw General Qwen2.5 14B 조합에서 readiness pass 상태였다.
- 최신 확인된 `content_draft` 로그는 validation 통과, repair 미시도 정상 생성 케이스였다.

다음 세션 Patch 8C에서는 HTML 변환용 route 또는 rule-based 변환 전략을 별도 검토한다. Blogger publish route나 실제 발행 기능으로 바로 진행하지 않는다.

## Patch 8C HTML preview and LLM boundary

Patch 8C의 HTML 변환 dry-run/preview는 LLM Provider를 사용하지 않는다.

- `content_plan` route와 `content_draft` route를 사용하지 않는다.
- OpenAI-compatible, Ollama-compatible, Local HTTP, CLI Provider 호출은 발생하지 않는다.
- `llm_call_logs`를 생성하지 않는다.
- previewHtml은 rule-based Markdown conversion 결과이며 DB에 저장하지 않는다.
- HTML 변환 후보 생성 또는 Blogger publish 연동이 필요하면 후속 패치에서 별도 Task Route와 저장 정책을 먼저 설계한다.

## Patch 8D HTML candidate and LLM boundary

Patch 8D의 HTML 후보 편집, 재검증, `draftHtml` 수동 반영도 LLM Provider를 사용하지 않는다.

- `validate-html`과 `apply-html`은 provider/model/task route를 조회하지 않는다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- prompt 전문, raw response 전문, API Key, Bearer token, secretRef, encryptedValue, provider headers, requestTemplateJson, media storagePath는 응답/로그/문서에 남기지 않는다.
- 저장되는 `draftHtml`은 로컬 preview/검증용 HTML이다. Blogger 업로드/발행 HTML 변환은 별도 후속 패치에서 다룬다.

## Patch 8E Quality preview and LLM boundary

Patch 8E의 saved `draftHtml` 품질검사 dry-run/preview는 LLM Provider를 사용하지 않는다.

- `quality-preview`는 provider/model/task route를 조회하지 않는다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- score preview와 grade는 DB에 저장하지 않는다.
- Blogger OAuth/API/publish도 수행하지 않는다.

## Patch 8F Publish readiness and LLM boundary

Patch 8F의 publish readiness gate는 LLM Provider를 사용하지 않는다.

- `publish-readiness`는 provider/model/task route를 조회하지 않는다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- readiness 결과는 DB에 저장하지 않는다.
- Blogger OAuth/API/publish도 수행하지 않는다.

## Patch 9A Blogger connection placeholder and LLM boundary

Patch 9A의 Blogger connection placeholder는 LLM Provider를 사용하지 않는다.

- `/settings/blogger`는 Blogger OAuth/API 이전의 설정 placeholder만 관리한다.
- Blogger settings API는 provider/model/task route를 조회하지 않는다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- Blogger token/secret 원문은 LLM Provider secret 구조와 별도로 후속 패치에서 설계한다.

## Patch 9B OAuth dry-run and LLM boundary

Patch 9B의 OAuth state + authorization URL dry-run도 LLM Provider를 사용하지 않는다.

- OAuth start/callback dry-run은 provider/model/task route를 조회하지 않는다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- authorization code, access token, refresh token, client secret 원문은 저장하거나 로그에 남기지 않는다.

## Patch 9D-1 Blogger blog list and LLM boundary

Patch 9D-1의 read-only Blogger blog list 조회는 LLM Provider를 사용하지 않는다.

- `/api/settings/blogger/[id]/blogs`는 provider/model/task route를 조회하지 않는다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- Blogger API raw response/error body와 token 원문은 LLM 로그나 일반 로그에 남기지 않는다.

## Patch 9D-2 Blogger blog selection and LLM boundary

Patch 9D-2의 Blogger blog 선택 저장은 LLM Provider를 사용하지 않는다.

- `/api/settings/blogger/[id]/blogs/select`는 provider/model/task route를 조회하지 않는다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- Blogger API raw response/error body와 token 원문은 LLM 로그나 일반 로그에 남기지 않는다.

## Patch 9E-0 Blogger draft payload preview and LLM boundary

Patch 9E-0의 Blogger draft payload preview는 LLM Provider를 사용하지 않는다.

- `/api/content-items/[id]/blogger-draft-preview`는 provider/model/task route를 조회하지 않는다.
- saved `draftHtml`과 verified Blogger blog selection metadata만 preview source로 사용한다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- Blogger API read/write 호출도 없으므로 token 원문이나 raw Blogger response/error body를 다루지 않는다.

## Patch 9E-1 Blogger draft approval guard and LLM boundary

Patch 9E-1의 Blogger draft approval guard는 LLM Provider를 사용하지 않는다.

- `/api/content-items/[id]/blogger-draft-approval`은 provider/model/task route를 조회하지 않는다.
- approval snapshot은 saved `draftHtml` hash, verified Blogger blog metadata, title candidate, readiness summary로만 만든다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- Blogger API read/write 호출도 없으므로 token 원문이나 raw Blogger response/error body를 다루지 않는다.

## Patch 9E-2 Blogger draft save and LLM boundary

Patch 9E-2의 Blogger draft save는 LLM Provider를 사용하지 않는다.

- `/api/content-items/[id]/blogger-draft-save`는 provider/model/task route를 조회하지 않는다.
- draft payload는 이미 저장된 `draftHtml`과 current approval snapshot에서만 나온다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- Blogger API write는 approval guard 통과 후 `posts.insert?isDraft=true`만 수행한다.
- Blogger API raw response/error body, token 원문, encrypted value는 LLM 로그나 일반 응답에 남기지 않는다.

## Patch 9E-3 live verification runbook and LLM boundary

Patch 9E-3의 live verification runbook, retry/update policy documentation, UI guard wording polish는 LLM Provider를 사용하지 않는다.

- provider/model/task route를 조회하지 않는다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- 실제 Blogger live draft save도 Patch 9E-3 검증 중에는 실행하지 않는다.
- `posts.update`, `posts.delete`, publish, scheduled publish, token refresh는 구현하지 않는다.
- token 원문, encrypted value, raw Blogger response/error body는 문서, UI, 로그에 남기지 않는다.

## Patch 9E-4A HTML quality repair preview and LLM boundary

Patch 9E-4A의 manual HTML quality repair preview는 LLM Provider를 사용하지 않는다.

- `/api/content-items/[id]/quality-repair-preview`는 provider/model/task route를 조회하지 않는다.
- repair candidate는 saved `draftMarkdown` 또는 `draftHtml`을 rule-based 변환/append 방식으로 만든다.
- OpenAI/Ollama/Local LLM 호출은 없다.
- `llm_call_logs`는 생성하지 않는다.
- candidate는 자동 저장하지 않으며 사용자가 기존 `apply-html` flow를 실행해야만 `draftHtml`에 반영된다.
- Blogger API read/write, draft save, publish, scheduled publish, token refresh도 수행하지 않는다.

## Patch 9E-4B repair apply UX and LLM boundary

Patch 9E-4B는 UI-only handoff polish이며 LLM Provider를 사용하지 않는다.

- repair candidate를 `HTML 후보로 사용`해도 provider/model/task route를 조회하지 않는다.
- 복사된 candidate는 기존 `validate-html` / `apply-html` 흐름으로만 재검증/수동 저장한다.
- `apply-html` 성공 후 stale preview 결과를 clear하고 재실행 안내만 표시한다.
- OpenAI/Ollama/Local LLM 호출은 없고 `llm_call_logs`도 생성하지 않는다.
- Blogger API read/write, draft save, publish, scheduled publish, token refresh도 수행하지 않는다.

## Patch 9E-4C-1 draft strategy foundation and LLM boundary

Patch 9E-4C-1은 `content_draft` route의 provider/model metadata를 기준으로 draft generation strategy를 판별하는 기반만 추가한다.

- remote/commercial provider는 기존 `one_shot_full_draft`를 기본 전략으로 유지한다.
- `local`, `local_http`, `cli`, `ollama_compatible`, `custom_cli`는 local/small-model-like provider로 보고 `local_sectioned_multi_pass` 전략 후보를 표시한다.
- 실제 multi-pass LLM orchestration은 아직 없다. local strategy도 이번 패치에서는 기존 one-shot generation fallback을 사용한다.
- `TaskRoute`에는 strategy field를 추가하지 않는다. strategy는 현재 provider/model 설정에서 파생되는 UI/response/log metadata다.
- `content_draft` call log metadata에는 safe summary만 저장한다:
  - `strategy`
  - `strategyReason`
  - `isLocalLike`
  - `stepCount`
  - `plannedStepCount`
  - `sectionedGenerationImplemented=false`
  - `finalPolishImplemented=false`
  - provider/model safe summary
- prompt 전문, raw response 전문, candidate Markdown 전문, API key, secret, token, encrypted value는 저장하지 않는다.
- Blogger API read/write, draft save, publish, scheduled publish, token refresh와는 무관하다.

## Patch 9E-4C-2 local sectioned draft generation and LLM boundary

Patch 9E-4C-2는 `local_sectioned_multi_pass` 전략에서 실제 local sectioned draft preview를 생성한다.

- remote/commercial provider는 기존 one-shot path를 유지한다.
- local/Ollama/local_http-like provider는 skeleton, section generation, deterministic assembly, final polish orchestration을 사용한다.
- 기존 `POST /api/content-items/[id]/generate-draft` endpoint를 유지하며 신규 endpoint를 추가하지 않는다.
- local sectioned generation은 `src/lib/llm/local-sectioned-draft-generation.ts`에서 분리한다.
- section generation 실패 시 section별 1회 retry 후 deterministic fallback paragraph를 사용할 수 있다.
- final polish 실패 또는 입력 길이 초과는 assembled draft fallback으로 처리할 수 있다.
- 최종 candidate는 기존 `draftMarkdown` manual apply UI에 연결되며 자동 저장하지 않는다.
- `llm_call_logs`는 aggregate `content_draft` log에 safe metadata만 저장한다:
  - strategy, section count, section keys
  - final polish applied/fallback summary
  - fallback reasons
  - step summaries with step/section key, status, retry count, duration, prompt hash, response hash, response length
- prompt 전문, raw response 전문, candidate Markdown 전문, skeleton 전문, section fragment 전문, final polish 입력/출력 전문, API key, token, secret, encrypted value는 저장하지 않는다.
- `promptHash`와 `responseHash`는 원문이 아니라 safe hash metadata로 취급한다.
- Blogger API, draft save, publish, scheduled publish, token refresh와는 무관하다.

## Patch 9E-4C-2-hotfix FAQ preservation and LLM boundary

Patch 9E-4C-2-hotfix는 local sectioned draft에서 saved FAQ가 final candidate에 보존되도록 한다.

- `planJson.faq`가 있으면 skeleton/section/final polish prompt가 dedicated FAQ section preservation을 요구한다.
- final polish 이후 FAQ-like section이 없으면 deterministic fallback이 `## FAQ`와 `### 질문` 형태로 append된다.
- fallback 여부는 safe metadata로만 기록한다:
  - `faqRequired`
  - `faqSectionDetected`
  - `faqFallbackAppended`
  - `faqCount`
- FAQ 질문/답변 전문은 metadata/log에 저장하지 않는다.
- prompt 전문, raw response 전문, candidate Markdown 전문, section fragment 전문, final polish 입력/출력 전문, API key, token, secret, encrypted value는 저장하지 않는다.
- remote/commercial one-shot path는 변경하지 않는다.

## Patch 9E-4C-2-hotfix2 safety phrase scrub and LLM boundary

Patch 9E-4C-2-hotfix2는 local sectioned draft candidate가 validation에 들어가기 전에 deterministic safety phrase scrub을 수행한다.

- safety scrub은 `local_sectioned_multi_pass` 전략의 final candidate에만 적용한다.
- FAQ guard/fallback 이후, 기존 `validateDraftMarkdown` 호출 이전에 validation-blocking 금융/투자/서비스 홍보 문구를 safe alternative로 정규화한다.
- validation 실패 후 repair provider call이 수행되면 local sectioned repair result도 재검증 전에 같은 scrub을 통과한다.
- safe metadata만 저장한다:
  - `safetyScrubApplied`
  - `safetyScrubCount`
  - `safetyScrubCodes`
- scrubbed phrase 원문 pair, candidate Markdown 전문, prompt 전문, raw response 전문, section fragment 전문, final polish 입력/출력 전문은 저장하지 않는다.
- remote/commercial one-shot path는 변경하지 않으며 scrub metadata는 default false/0/empty로 남긴다.
- Blogger API, draft save, publish, scheduled publish, token refresh와는 무관하다.

## Patch 9E-4C-2-hotfix3 local sectioned timeout policy and LLM boundary

Patch 9E-4C-2-hotfix3는 local sectioned multi-pass draft generation의 timeout policy를 one-shot route와 분리한다.

- remote/commercial `one_shot_full_draft` path는 기존 route/provider timeout을 그대로 사용한다.
- `local_sectioned_multi_pass` path는 multi-call 특성을 반영해 extended timeout policy를 사용한다:
  - overall timeout: 600000ms
  - skeleton step timeout: 240000ms
  - section generation/retry timeout: 180000ms
  - final polish timeout: 300000ms
  - local sectioned repair timeout: 300000ms
- 각 step provider call에는 해당 step timeout을 명시적으로 전달한다.
- overall deadline을 초과하면 `local_sectioned_overall_timeout` safe error로 중단한다.
- provider abort timeout은 `provider_timeout` safe error/summary로 기록한다.
- safe metadata만 저장한다:
  - `timeoutPolicy`
  - `overallTimeoutMs`
  - `stepTimeoutMs`
  - `finalPolishTimeoutMs`
- prompt 전문, raw response 전문, candidate Markdown 전문, section fragment 전문, final polish 입력/출력 전문, API key, token, secret, encrypted value는 저장하지 않는다.
- Blogger API, draft save, publish, scheduled publish, token refresh와는 무관하다.

## Patch 9E-4C-2-hotfix4 local sectioned cold-start timeout policy

Patch 9E-4C-2-hotfix4는 Ollama cold-start/model-load 지연을 고려해 local sectioned timeout policy를 한 번 더 보정한다.

- remote/commercial `one_shot_full_draft` path는 기존 route/provider timeout을 그대로 사용한다.
- `local_sectioned_multi_pass` path만 cold-start extended timeout policy를 사용한다:
  - overall timeout: 1200000ms
  - skeleton step timeout: 600000ms
  - section generation/retry timeout: 300000ms
  - final polish timeout: 600000ms
  - local sectioned repair timeout: 600000ms
- safe metadata만 저장한다:
  - `timeoutPolicy`
  - `overallTimeoutMs`
  - `stepTimeoutMs`
  - `skeletonTimeoutMs`
  - `sectionTimeoutMs`
  - `finalPolishTimeoutMs`
  - `repairTimeoutMs`
- timeout error는 `provider_timeout` 또는 `local_sectioned_overall_timeout` safe error/summary로 유지한다.
- local smoke가 다시 timeout되면 추가 timeout 연장보다 async/background job 설계로 전환한다.
- prompt 전문, raw response 전문, candidate Markdown 전문, section fragment 전문, final polish 입력/출력 전문, API key, token, secret, encrypted value는 저장하지 않는다.
- Blogger API, draft save, publish, scheduled publish, token refresh와는 무관하다.

## Patch 9E-4C-3A local sectioned stepwise run foundation

Patch 9E-4C-3A는 Local LLM 장문 생성을 single HTTP request에서 끝내려는 방향을 멈추고, persisted stepwise run 구조로 전환하기 위한 foundation을 추가한다.

Design direction:

- `one_shot_full_draft`: remote/commercial provider용 기존 경로로 유지한다.
- `local_sectioned_multi_pass`: 기존 single-request local sectioned preview 경로이며 legacy/debug 성격으로 유지한다.
- `local_sectioned_stepwise`: 후속 패치에서 skeleton, section, assemble, final polish를 각각 별도 request로 실행할 기본 local strategy다.

Persistence:

- `content_draft_generation_runs`는 content item별 run status, current step, section keys, assembled/final candidate, validation summary, safe metadata를 저장한다.
- `content_draft_generation_steps`는 step status, attempt, normalized Markdown fragment, output summary, prompt/response hash, latency, safe error code, safe metadata를 저장한다.
- step output은 기능상 preview/retry에 필요한 Markdown fragment로만 저장한다.
- prompt 전문, raw provider response 전문, request/response body, full candidate 전문, API key, token, secret, encrypted value는 저장하지 않는다.

Boundary:

- Patch 9E-4C-3A는 schema/migration/repository only다.
- Start/read/execute step API는 Patch 9E-4C-3B 이후로 분리한다.
- Content detail UI는 Patch 9E-4C-3E 이후로 분리한다.
- `content_items.draftMarkdown`/`draftHtml` 자동 저장은 금지하며 manual apply에서만 변경한다.
- Blogger API, draft save, publish, scheduled publish, token refresh와는 무관하다.

## Patch 9E-4C-3B local sectioned stepwise start/read API

Patch 9E-4C-3B adds API access to the persisted stepwise run foundation without executing any LLM step.

API:

- `POST /api/content-items/[id]/draft-generation-runs`
  - Requires saved `planJson`.
  - Creates a `local_sectioned_stepwise` run with `pending` status and `currentStepKey=skeleton`.
  - Creates pending placeholders for `skeleton`, `intro`, `body_1`, `body_2`, `body_3`, and `conclusion_cta_faq`.
- `GET /api/content-items/[id]/draft-generation-runs`
  - Returns safe run summaries for the content item, newest first.
- `GET /api/content-items/[id]/draft-generation-runs/[runId]`
  - Returns one run detail with step summaries when the run belongs to the URL content item.

Boundary:

- No provider invocation, no prompt construction, no `llm_call_logs` creation.
- No step execution API, assembly API, final polish API, cancel API, or UI.
- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- Safe responses do not include prompt full text, raw response full text, request/response body, API key, token, secret, or encrypted value.
- `content_items.draftMarkdown`/`draftHtml`, status, `qualityScore`, `publishedAt`, and `scheduledAt` are not changed.

## Patch 9E-4C-3C local sectioned stepwise skeleton/section execution API

Patch 9E-4C-3C adds a one-step-at-a-time execution API for persisted local stepwise draft generation runs.

API:

- `POST /api/content-items/[id]/draft-generation-runs/[runId]/steps/[stepKey]`
  - Allowed step keys: `skeleton`, `intro`, `body_1`, `body_2`, `body_3`, `conclusion_cta_faq`.
  - Executes exactly one step per request.
  - Reuses an existing successful step unless `retry` or `force` is explicitly requested.
  - Refuses section execution until the skeleton step has succeeded.
  - Refuses completed/cancelled runs and already-running steps.

Provider boundary:

- Uses the existing `content_draft` primary TaskRoute.
- Requires a local-like provider route (`local`, `local_http`, `cli`, `local_http` invocation mode, `cli` invocation mode, `ollama_compatible`, or `custom_cli` style local detection).
- Remote/commercial one-shot routes are rejected with `local_stepwise_route_required`.
- Per-step provider timeout is capped at 600 seconds.

Persistence and logging:

- Step success stores normalized Markdown fragment, short output summary, prompt hash, response hash, latency, and safe metadata in `content_draft_generation_steps`.
- Step failure marks only that step as failed and records a safe error code/metadata.
- Retry increments only the failed/retried step attempt.
- `llm_call_logs` may be created for step execution, but only with safe metadata: run id, step key, section key, attempt, provider/model summary, hashes, latency, output length, and response summary.
- Prompt full text, raw provider response, output Markdown full text, skeleton/section fragment full text, candidate Markdown, API keys, tokens, secrets, and encrypted values are not stored in call logs.

Boundary:

- No automatic full run execution.
- No deterministic assembly API.
- No final polish API.
- No cancel API.
- No UI.
- No `content_items.draftMarkdown`/`draftHtml` mutation.
- Blogger API, draft save, publish, scheduled publish, and token refresh remain out of scope.

### Patch 9E-4C-3C smoke stabilization for local Ollama

The initial 9E-4C-3C smoke showed the selected Ollama model could keep `/api/generate` open for minutes without response bytes. The stepwise path now treats this as an operationally diagnosable provider condition rather than just waiting longer.

Ollama step request policy:

- Stepwise Ollama generation uses `stream:true`.
- Skeleton defaults are intentionally small:
  - `num_predict`: 360
  - `num_ctx`: 2048
- Section defaults are still bounded:
  - `num_predict`: 900
  - `num_ctx`: 4096
- `keep_alive` defaults to `30s` to reduce long GPU/model occupancy after a smoke call.
- Overall step timeout remains 600 seconds.
- First-byte timeout is 180 seconds.
- Stream idle timeout is 120 seconds.

Preflight and diagnostics:

- Before `/api/generate`, stepwise Ollama checks `/api/tags`.
- Missing model fails as `provider_model_not_found`.
- First-byte stall fails as `provider_first_byte_timeout`.
- Stream stalls after bytes begin fail as `provider_idle_timeout`.
- Safe metadata includes request options summary, provider/model safe summary, hashes, output length, and response summary.
- Safe metadata never includes prompt text, raw response text, output Markdown full text, candidate full text, tokens, secrets, or encrypted values.

Smoke helper:

- `scripts/smoke_9e4c3c_stepwise_local_ollama.mjs` checks the configured `content_draft` primary route and Ollama model availability.
- `--probe-generate` performs only a short streaming generate probe and does not mutate content items, generation runs, Blogger tables, or draft fields.

## Patch 9E-4C-3D local sectioned stepwise assemble/final polish API

Patch 9E-4C-3D adds the next two stepwise APIs after individual skeleton/section execution.

API:

- `POST /api/content-items/[id]/draft-generation-runs/[runId]/assemble`
  - Deterministically combines successful section outputs in the fixed order: `intro`, `body_1`, `body_2`, `body_3`, `conclusion_cta_faq`.
  - Does not call an LLM provider and does not create `llm_call_logs`.
  - Requires every required section step to be `success` with `outputMarkdown`.
  - Stores `assembledCandidateMarkdown`, validation summary, and safe metadata on the run.
  - Sets `status=running` and `currentStepKey=final_polish`.
  - Reuses an existing assembled candidate unless `force=true`.
- `POST /api/content-items/[id]/draft-generation-runs/[runId]/final-polish`
  - Requires `assembledCandidateMarkdown`.
  - Calls the configured local-like `content_draft` route for one final polish request.
  - Stores `finalCandidateMarkdown`, validation summary, and safe metadata on success.
  - Completes the run with `status=completed`, `currentStepKey=null`, and `completedAt`.
  - On failure, keeps the assembled candidate as fallback and records only safe failure metadata.

Safety and redaction:

- Assembly and final polish run deterministic H1/FAQ/safety validation summaries.
- FAQ fallback and safety phrase scrub metadata is stored as counts/codes only.
- Prompt full text, raw provider response text, assembled/final candidate full text in metadata, API keys, tokens, secrets, and encrypted values are not stored in `llm_call_logs.metadata`.
- Candidate Markdown is stored only in the run candidate fields needed for review and later manual apply.

Boundary:

- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- No UI is added in this patch.
- No automatic `content_items.draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- Blogger API, draft save, publish, scheduled publish, and token refresh remain out of scope.

## Patch 9E-4C-3E content detail stepwise UI

Patch 9E-4C-3E exposes the persisted local stepwise backend flow on the content detail page.

UI capabilities:

- List and select recent `local_sectioned_stepwise` runs for the current content item.
- Create a new run without executing LLM calls.
- Execute one skeleton/section step at a time through the step API.
- Run deterministic assemble when all section outputs are available.
- Run final polish as one explicit local LLM call after assembly.
- Display safe status, attempt, latency, hashes, output summary, validation summary, and read-only assembled/final candidates.

Boundary:

- The UI does not auto-apply run candidates to `content_items.draftMarkdown` or `draftHtml`.
- The UI does not change content item status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- The UI is separated from Blogger draft save/publish flows and does not call Blogger APIs.
- Retry/force UX and candidate apply UX remain follow-up work.

## Patch 9E-4C-3F stepwise final candidate manual apply guard

Patch 9E-4C-3F allows a reviewed stepwise final candidate to be copied into the existing draft Markdown candidate UI without saving it.

Boundary:

- The copy action is client-side state only.
- It does not call the LLM provider, create `llm_call_logs`, or call a server API.
- It does not mutate `content_items.draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- The existing manual `draftMarkdown에 반영` button remains the only path that can write the candidate to `content_items`.
- Blogger API, draft save, publish, scheduled publish, and token refresh remain out of scope.

## Patch 9E-4D blog post template renderer preview

Patch 9E-4D adds a deterministic Markdown-to-HTML theme preview for the current draft candidate.

Boundary:

- `/api/content-items/[id]/blog-post-template-preview` does not use an LLM provider or task route.
- The API reads content item/blog/brand/assets only to build a safe preview summary and media mapping counts.
- Raw HTML and blocked patterns are escaped/count-summarized; prompt text, provider responses, tokens, secrets, and encrypted values are not involved.
- The UI preview uses the current Draft Markdown candidate state and does not save `draftHtml`.
- No `llm_call_logs`, Blogger API calls, draft save, publish, scheduled publish, token refresh, or content item status/quality timestamp mutations occur.

## Patch 9E-4E blog template preview handoff guard

Patch 9E-4E allows a reviewed Blog Post Template HTML preview to be copied into the existing HTML candidate editor.

Boundary:

- The handoff action is client-side state only and does not call the LLM provider, create `llm_call_logs`, or call a server API.
- It does not mutate `content_items.draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- It marks the HTML candidate validation as stale so the existing `validate-html` and manual `apply-html` flow must be used before saving.
- Blogger API, draft save, publish, scheduled publish, and token refresh remain out of scope.

## Patch 9E-4F manual draftHtml apply guard hardening

Patch 9E-4F hardens the existing manual `apply-html` save path.

Boundary:

- `/api/content-items/[id]/apply-html` reuses deterministic HTML validation on the server immediately before saving.
- The route writes only `content_items.draftHtml`; it does not mutate `draftMarkdown`, status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- The route returns safe apply summary metadata only: source, validation status, HTML length, unsafe pattern count, applied field, and side-effect false flags.
- The UI keeps `draftHtml에 반영` disabled until a current HTML candidate validation has passed and the candidate is not dirty.
- The UI uses a 2-step explicit confirmation guard: the first click arms the save and the second click calls `apply-html`.

## Patch 9E-4G-1 saved draftHtml readiness recheck and Blogger draft save preflight

Patch 9E-4G-1 adds a read-only preflight gate before any future Blogger draft save attempt.

- `POST /api/content-items/[id]/blogger-draft-save-preflight` does not use the LLM provider abstraction.
- The route recomputes saved `draftHtml` validation, draft payload preview, approval snapshot match, and publish-readiness summary.
- Safe response metadata is limited to readiness booleans/counts, short hashes, selected blog metadata, connection/token presence booleans, approval status, blocking reasons, warnings, and side-effect flags.
- The route does not mutate `content_items`, Blogger tables, approvals, draft saves, or `llm_call_logs`.
- The route does not call Blogger write APIs, Blogger draft save, publish, scheduled publish, token refresh, or LLM providers.
- Full `draftHtml`, prompt text, raw model responses, token values, encrypted values, and raw Blogger response/error bodies are not returned or logged.

## Patch 9E-4G-1b Blogger draft save readiness UX and connection guidance

Patch 9E-4G-1b is a UI/readiness guidance patch on top of the preflight gate.

- It does not add LLM provider usage and does not create `llm_call_logs`.
- It maps preflight blocking reason keys to human-readable next actions in the content detail UI.
- It adds `/settings/blogger` navigation guidance when the preflight reports no Blogger connection.
- It keeps the actual Blogger Draft save button disabled until preflight passes.
- It keeps all preflight side-effect flags visible as false and does not mutate `content_items` or Blogger tables.
- It does not call Blogger API write, draft save, publish, scheduled publish, token refresh, or OAuth start automatically.

## Patch 9E-4G-1c draft save preflight blocker classification

Patch 9E-4G-1c refines read-only Blogger draft save preflight classification without changing LLM routing.

- `blogger_draft_saved` is filtered out of draft-save preflight blockers because “not saved yet” is expected before the first draft save.
- Duplicate draft save prevention uses `blogger_draft_already_saved_for_approval` only when a successful save already exists for the active approval.
- Expired access tokens are classified as `access_token_expired_reauth_required` blockers while token refresh remains unimplemented.
- Env-backed client secret configuration is reported through safe booleans and does not require an encrypted client-secret row when `clientSecretRef` is resolvable.
- This patch does not invoke LLM providers, create `llm_call_logs`, refresh tokens, start OAuth automatically, call Blogger APIs, or mutate content items.
- Blogger API, draft save, publish, scheduled publish, token refresh, LLM calls, and `llm_call_logs` remain out of scope.

## Patch 9E-5A Blogger token expiry readiness boundary

Patch 9E-5A is a Blogger OAuth/token readiness UX and design patch, not an LLM routing change.

- `access_token_expired_reauth_required` is surfaced as a Blogger readiness blocker.
- The UI guides the user toward OAuth re-connection before a future Blogger write.
- Automatic token refresh is still not implemented.
- No refresh token is used, no token endpoint is called, and no Blogger write is triggered.
- No LLM provider is invoked and no `llm_call_logs` row is created.
- Token/secret/raw OAuth response values remain outside UI, logs, docs, and test output.

## Patch 9E-5B Blogger draft update/retry policy boundary

Patch 9E-5B is a Blogger draft update/retry policy and UX patch, not an LLM routing change.

- The UI explains that successful same-approval draft saves are duplicate-blocked and that `posts.update` is not implemented.
- Retry/update policy is documented as planning only.
- No LLM provider is invoked and no `llm_call_logs` row is created.
- No Blogger write, additional draft save, `posts.update`, publish, scheduled publish, token refresh, content item mutation, schema change, or migration occurs.
- Prompt text, raw LLM responses, Blogger tokens, encrypted values, raw Blogger responses, and full draft HTML remain outside UI/log metadata.

## Patch 9E-6A publish/scheduled publish policy boundary

Patch 9E-6A is a Blogger publish/scheduled publish policy and UX patch, not an LLM routing change.

- The UI explains that a saved Blogger draft is not publish-ready and that `publishReady=false`/top-level `ready=false` remain intentional.
- Publish and scheduled publish are documented as planning-only until separate approval, preflight, side-effect summary, audit, rollback, and token policies exist.
- No LLM provider is invoked and no `llm_call_logs` row is created.
- No Blogger publish call, scheduled publish call, `posts.update`, additional draft save, token refresh, content item status/timestamp mutation, schema change, or migration occurs.
- Prompt text, raw LLM responses, Blogger tokens, encrypted values, raw Blogger responses, and full draft HTML remain outside UI/log metadata.

## Patch 9E-6B publish preflight dry-run boundary

Patch 9E-6B is a Blogger publish preflight dry-run and approval model design patch, not an LLM routing change.

- `POST /api/content-items/[id]/publish-preflight` is read-only.
- The dry-run summarizes saved draft, approval, token expiry, and future publish approval requirements.
- It keeps `canPublish=false`, `canSchedulePublish=false`, and all side-effect flags false.
- No LLM provider is invoked and no `llm_call_logs` row is created.
- No prompt, raw response, candidate text, Blogger token, encrypted value, raw Blogger response, or full draft HTML is stored in metadata.

## Patch 9E-6C publish approval snapshot preview boundary

Patch 9E-6C is a read-only publish approval snapshot/hash preview patch, not an LLM routing change.

- `POST /api/content-items/[id]/publish-approval-preview` must not call LLM providers.
- The snapshot preview includes only non-secret deterministic metadata and content hashes.
- `approvalSnapshotHashPreview` is computed locally from the preview payload; it is not an LLM output and is not persisted.
- No `llm_call_logs` row is created.
- Prompt text, raw responses, candidate text, Blogger tokens, encrypted values, raw Blogger responses, and full draft HTML remain outside UI/log metadata.

## Patch 9E-6D publish approval persistence policy boundary

Patch 9E-6D is a publish approval persistence policy/schema planning patch, not an LLM routing change.

- The patch adds no LLM provider call and creates no `llm_call_logs` row.
- Approval persistence planning uses existing snapshot/hash metadata only.
- The UI and docs describe future immutable approval persistence, invalidation, acknowledgement, token checkedAt, and publish attempt audit requirements.
- No prompt text, raw model response, generated candidate text, Blogger token, encrypted value, raw Blogger response, raw Blogger error body, or full draft HTML is stored in metadata.
- Future publish approval persistence must remain independent from content generation and must not call an LLM when creating or invalidating approval records.

## Patch 9E-7A publish approval persistence storage boundary

Patch 9E-7A adds local DB persistence for publish approval snapshots, not an LLM routing change.

- `POST /api/content-items/[id]/publish-approval-save` must not call LLM providers.
- The route stores server-regenerated non-secret snapshot metadata only.
- No `llm_call_logs` row is created by preview, save guard failure, or approval persistence.
- Prompt text, raw model responses, generated candidate text, Blogger tokens, encrypted values, raw Blogger responses, raw Blogger error bodies, and full draft HTML remain outside the approval snapshot.
- Stored publish approvals do not authorize or execute content generation, Blogger publish, scheduled publish, token refresh, or `posts.update`.

## Patch 9E-7B publish approval readback boundary

Patch 9E-7B adds readback and smoke verification for publish approval persistence, not an LLM routing change.

- `POST /api/content-items/[id]/publish-approval-readback` must not call LLM providers.
- `publish-approval-save` smoke and idempotency checks must not create `llm_call_logs`.
- Readback returns safe DB metadata only and does not expose prompts, raw responses, candidate text, Blogger tokens, encrypted values, raw Blogger responses, raw Blogger error bodies, or full draft HTML.
- Stored approval readback does not authorize content generation, Blogger publish, scheduled publish, token refresh, or `posts.update`.

## Patch 9E-7C publish approval execution guard boundary

Patch 9E-7C adds read-only publish approval execution guard checks, not an LLM routing change.

- `POST /api/content-items/[id]/publish-approval-execution-guard` must not call LLM providers.
- The guard compares safe saved approval metadata with current content/Blogger draft metadata.
- Invalidation candidates are read-only diagnostics and must not create or update `llm_call_logs`.
- The guard does not expose prompts, raw responses, candidate text, Blogger tokens, encrypted values, raw Blogger responses, raw Blogger error bodies, or full draft HTML.
- Execution guard results do not authorize content generation, Blogger publish, scheduled publish, token refresh, `posts.update`, or content item mutation.

## Patch 9E-7D publish approval invalidation dry-run boundary

Patch 9E-7D adds read-only publish approval invalidation preview checks, not an LLM routing change.

- `POST /api/content-items/[id]/publish-approval-invalidation-preview` must not call LLM providers.
- The invalidation preview uses execution guard and saved approval metadata only.
- Manual invalidation reason is treated as dry-run input and must not trigger an LLM call.
- The dry-run must not create or update `llm_call_logs`.
- The dry-run does not expose prompts, raw responses, candidate text, Blogger tokens, encrypted values, raw Blogger responses, raw Blogger error bodies, or full draft HTML.
- Invalidation preview results do not authorize content generation, Blogger publish, scheduled publish, token refresh, `posts.update`, approval invalidation DB update, or content item mutation.

## Patch 9E-7E publish execution attempt preview boundary

Patch 9E-7E adds read-only publish execution attempt policy/schema preview checks, not an LLM routing change.

- `POST /api/content-items/[id]/publish-execution-attempt-preview` must not call LLM providers.
- The attempt preview uses execution guard and saved approval metadata only.
- The preview must not create or update `llm_call_logs`.
- The preview must not persist attempt rows, mutate content items, call Blogger, publish, schedule publish, update posts, save another draft, or refresh tokens.
- Future attempt metadata should keep safe hashes, ids, timestamps, short error codes/messages, and redacted summaries only.
- Future attempt metadata must not expose prompts, raw model responses, generated candidate text, Blogger tokens, encrypted values, client secrets, raw OAuth responses, raw Blogger response/error bodies, or full draft HTML.

## Patch 9E-7F publish execution attempt storage boundary

Patch 9E-7F adds local DB storage/readback for publish execution attempt plans, not an LLM routing change.

- `POST /api/content-items/[id]/publish-execution-attempt-save` must not call LLM providers.
- `POST /api/content-items/[id]/publish-execution-attempt-readback` must not call LLM providers.
- Attempt save and idempotent save must not create `llm_call_logs`.
- Stored attempt metadata is server-generated from safe approval/execution-guard metadata only.
- Stored attempt metadata must not expose prompts, raw model responses, generated candidate text, Blogger tokens, encrypted values, client secrets, raw OAuth responses, raw Blogger response/error bodies, or full draft HTML.
- Stored attempt plans do not authorize content generation, Blogger publish, scheduled publish, token refresh, `posts.update`, approval invalidation DB update, or content item mutation.

## Patch 9E-8A publish OAuth gate boundary

Patch 9E-8A adds a read-only publish OAuth gate, not an LLM routing change.

- `POST /api/content-items/[id]/publish-oauth-gate` does not call LLM providers or create `llm_call_logs`.
- The gate reads safe Blogger connection/token expiry metadata and saved publish approval/attempt metadata only.
- The gate does not start OAuth, exchange codes, refresh tokens, call Blogger APIs, publish, schedule publish, call `posts.update`, save additional drafts, invalidate approvals, update attempts, or mutate content items.
- UI output must not expose prompts, raw model responses, generated candidate text, Blogger tokens, encrypted values, client secrets, raw OAuth responses, raw Blogger response/error bodies, or full draft HTML.

## Patch 9F-2R draft-generation prompt preview boundary

Patch 9F-2R adds a read-only prompt render preview before any future draft-generation LLM execution.

- `POST /api/daily-content-plans/draft-generation-prompt-render-preview` renders deterministic prompt sections for operator review only.
- The preview does not call OpenAI, local LLM, Ollama, custom HTTP/CLI providers, or provider health-check endpoints.
- The preview does not create `llm_call_logs`, store prompt text, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- Prompt preview redaction must keep raw secrets, API keys, bearer tokens, OAuth token material, provider credentials, and raw env values out of API/UI output.
- Future execution still requires separate feature flags, confirmation phrase, idempotency key, and an execution patch.

## Patch 9F-2S draft-generation prompt quality checklist boundary

Patch 9F-2S adds a static prompt quality checklist before any future draft-generation LLM execution.

- `POST /api/daily-content-plans/draft-generation-prompt-quality-checklist-preview` reuses the 9F-2R prompt preview in memory and evaluates deterministic rule checks only.
- The checklist is not an LLM judge/evaluator and does not call any provider, provider health endpoint, local LLM, Ollama, OpenAI, custom HTTP, or CLI process.
- The checklist does not create `llm_call_logs`, store prompts, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- The checklist reports category statuses, pass/warn/fail counts, remediation, redaction/forbidden scan summary, and no-side-effect flags.
- Even if `qualityGatePassed=true`, execution remains blocked until a later explicit execution patch with feature flags, confirmation phrase, and idempotency key.

## Patch 9F-2T draft-generation request envelope preview boundary

Patch 9F-2T adds a read-only request envelope preview immediately before any future LLM provider dispatch.

- `POST /api/daily-content-plans/draft-generation-llm-request-envelope-preview` builds the provider request structure in memory only.
- The preview reuses 9F-2R prompt rendering, 9F-2S prompt quality checklist metadata, and 9F-2N provider/model readiness metadata.
- It shows safe route/provider/model metadata, endpoint category, header names with values hidden, payload shape, message count, prompt hash/length/token estimate, and future dispatch blockers.
- It does not expose raw provider endpoints, header values, credential values, API keys, OAuth token material, env values, prompt storage records, or raw external payload values.
- It does not call any provider, provider health endpoint, local LLM, Ollama, OpenAI, custom HTTP endpoint, or CLI process.
- It does not create `llm_call_logs`, store request envelopes, store prompts, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- Non-preview modes remain blocked with `draft_generation_llm_request_envelope_preview_is_preview_only`.

## Patch 9F-2U draft-generation dispatch gate preview boundary

Patch 9F-2U adds a read-only dispatch gate preview after the request envelope preview and before any future provider call.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-gate-preview` evaluates whether the future request dispatch would still be blocked.
- The preview reuses the 9F-2T request envelope preview and checks target integrity, operator approval, prompt quality, request envelope readiness, provider route readiness, provider health status, feature flags, confirmation phrase, idempotency key, and side-effect policy.
- It keeps `dispatchAllowedNow=false`, `dispatchWouldBeBlocked=true`, `requestSentToProvider=false`, `providerNetworkCall=false`, `llmCall=false`, and `contentItemMutation=false`.
- It does not create a dispatch execution route, send the request envelope, call a provider, run provider health checks, call any LLM, create `llm_call_logs`, store request envelopes, store prompts, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- Non-preview modes remain blocked with `draft_generation_llm_dispatch_gate_preview_is_preview_only`.

## Patch 9F-2V draft-generation dispatch audit schema design boundary

Patch 9F-2V adds a design-only audit schema preview before any future dispatch persistence or provider call.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-schema-design` returns proposed future dispatch attempt/event/artifact persistence design.
- The design covers fields, indexes, foreign keys, unique constraints, idempotency hash semantics, redaction policy, retention policy, and migration sequencing.
- It keeps `schemaModified=false`, `migrationCreated=false`, `migrationApplied=false`, `dbWrite=false`, `providerNetworkCall=false`, `llmCall=false`, and `contentItemMutation=false`.
- It does not modify `prisma/schema.prisma`, create migrations, apply migrations, create rows, store request envelopes, store prompts, call providers, create `llm_call_logs`, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- Non-preview modes remain blocked with `draft_generation_llm_dispatch_audit_schema_design_is_preview_only`.

## Patch 9F-2W draft-generation dispatch audit schema scaffold boundary

Patch 9F-2W adds the file-level Prisma schema and migration scaffold for future dispatch audit persistence.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-schema-scaffold-preview` reports scaffold state only.
- The scaffold adds `BlogDailyContentLlmDispatchAttempt`, `BlogDailyContentLlmDispatchEvent`, and `BlogDailyContentLlmDispatchArtifact` models plus a migration SQL file.
- The migration is not applied in this patch; DB audit tables remain absent until `9F-2W-APPLY`.
- The scaffold keeps raw idempotency keys out of storage, stores only hashes, and keeps raw secrets/tokens/provider request/response payloads out of default persistence.
- It does not create rows, store request envelopes, store prompts, call providers, run provider health checks, call LLM providers, create `llm_call_logs`, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- Non-preview modes remain blocked with `draft_generation_llm_dispatch_audit_schema_scaffold_preview_is_preview_only`.

## Patch 9F-2W-APPLY draft-generation dispatch audit migration apply boundary

Patch 9F-2W-APPLY applies only the scaffolded dispatch audit schema migration.

- Migration `20260620000300_add_llm_dispatch_audit_schema` is applied with `npx prisma migrate deploy`.
- `blog_daily_content_llm_dispatch_attempts`, `blog_daily_content_llm_dispatch_events`, and `blog_daily_content_llm_dispatch_artifacts` exist in the DB after the patch.
- The audit tables remain empty after migration apply; row counts should be `0 / 0 / 0`.
- `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-migration-apply-readback` reports applied-state metadata only.
- The patch does not create audit rows, store request envelopes, store prompts, call providers, run provider health checks, call LLM providers, create `llm_call_logs`, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- Non-preview modes remain blocked with `draft_generation_llm_dispatch_audit_migration_apply_readback_is_preview_only`.

## Patch 9F-2X draft-generation dispatch attempt readback boundary

Patch 9F-2X adds a read-only readback scaffold for the empty dispatch attempt/event/artifact audit tables.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-readback` reads global and target-scoped dispatch audit counts only.
- The expected first state is `emptyState=true`, latest target attempt/event/artifact all `null`, and attempt/event/artifact counts `0 / 0 / 0`.
- The route exposes a future lifecycle/readback shape for operator visibility, but keeps `canCreateAttemptNow=false` and `canDispatchNow=false`.
- It does not create audit rows, insert events, store artifacts, store request envelopes, store prompts, call providers, run provider health checks, call LLM providers, create `llm_call_logs`, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- Non-preview modes remain blocked with `draft_generation_llm_dispatch_attempt_readback_is_preview_only`.

## Patch 9F-2Y draft-generation dispatch attempt creation gate boundary

Patch 9F-2Y adds a read-only creation gate preview for a future dispatch attempt row.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-creation-gate-preview` evaluates whether a future attempt row could be created.
- The preview reuses the 9F-2X readback and 9F-2U dispatch gate metadata.
- It keeps `canCreateAttemptNow=false`, `attemptCreationAllowedInThisPatch=false`, `targetScopedExistingAttempts=0`, and `latestTargetAttempt=null`.
- It reports future attempt field planning with hash-only idempotency/confirmation policy and no raw secret/token/request/response body storage by default.
- It does not create audit rows, insert events, store artifacts, store request envelopes, store prompts, call providers, run provider health checks, call LLM providers, create `llm_call_logs`, mutate `content_items`, or create `draftMarkdown`/`draftHtml`.
- Non-preview modes remain blocked with `draft_generation_llm_dispatch_attempt_creation_gate_preview_is_preview_only`.

## Patch 9F-2Z draft-generation dispatch attempt creation persistence boundary

Patch 9F-2Z adds the first gated persistence point for a future draft-generation dispatch audit attempt.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-creation` supports preview and guarded apply modes.
- Preview mode is DB-read-only and cannot create rows.
- Apply mode requires `BLOG_DAILY_CONTENT_LLM_DISPATCH_ATTEMPT_CREATE_ENABLED=true`, exact confirmation phrase, idempotency key, valid target fixture, persisted operator approval, existing audit tables, and no conflicting target attempt.
- The route may create one `blog_daily_content_llm_dispatch_attempts` row only; it must not create event/artifact rows.
- The created attempt stores hash-only idempotency and confirmation metadata, safe provider/model metadata, prompt/request-envelope hashes, and side-effect flags indicating no provider/LLM/content/Blogger action.
- Duplicate apply with the same idempotency key hash returns the existing attempt without another insert.
- This patch does not dispatch the request envelope, run provider health checks, call providers, create `llm_call_logs`, store raw prompts or raw request/response bodies, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3A — LLM dispatch attempt event creation preview, no provider call/no content mutation`.

## Patch 9F-3A draft-generation dispatch attempt event preview boundary

Patch 9F-3A previews the first audit event that would be attached to the existing dispatch attempt.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-event-preview` reads the latest target attempt and builds a candidate event in memory.
- The candidate event uses `eventType=dispatch_attempt_created` and `eventStatus=recorded_audit_only`.
- Candidate payload details are represented by safe hash/redaction metadata only.
- It keeps attempts/events/artifacts counts unchanged at `1 / 0 / 0`.
- It does not insert audit events, create artifacts, run provider health checks, call providers, create `llm_call_logs`, store prompts, store request/response bodies, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3B — Gated LLM dispatch attempt event creation persistence, no provider call/no content mutation`.

## Patch 9F-3B draft-generation dispatch attempt event persistence boundary

Patch 9F-3B persists the first audit event for the existing dispatch attempt.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-event-creation` supports preview and guarded apply modes.
- Apply mode requires `BLOG_DAILY_CONTENT_LLM_DISPATCH_EVENT_CREATE_ENABLED=true`, exact confirmation phrase, idempotency key, candidate event readiness, and no existing target event.
- The only allowed write is one `blog_daily_content_llm_dispatch_events` row.
- The event uses `eventType=dispatch_attempt_created` and `eventStatus=recorded_audit_only`.
- Duplicate apply returns the existing event and creates no additional row.
- It does not create artifacts, run provider health checks, call providers, create `llm_call_logs`, store prompts, store raw request/response bodies, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3C — LLM dispatch audit artifact preview, no provider call/no content mutation`.

## Patch 9F-3C draft-generation dispatch artifact preview boundary

Patch 9F-3C previews the first hash-only artifact for the existing dispatch attempt.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-artifact-preview` reads latest target attempt/event metadata.
- It builds a candidate artifact with `artifactKind=prompt_request_hash_bundle`, `artifactStorageMode=hash_only`, and `artifactRedactionStatus=redacted_or_hash_only`.
- It keeps raw prompt text, raw request bodies, raw response bodies, full candidates, secrets, tokens, and raw env values out of API/UI output.
- It keeps attempts/events/artifacts counts unchanged at `1 / 1 / 0`.
- It does not insert artifacts, run provider health checks, call providers, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3D — Gated LLM dispatch audit artifact persistence, no provider call/no content mutation`.

## Patch 9F-3D draft-generation dispatch artifact persistence boundary

Patch 9F-3D persists the first hash-only artifact for the existing dispatch attempt.

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-artifact-creation` supports preview and guarded apply modes.
- Apply mode requires `BLOG_DAILY_CONTENT_LLM_DISPATCH_ARTIFACT_CREATE_ENABLED=true`, exact confirmation phrase, idempotency key, candidate artifact readiness, and no existing target artifact with the same kind/hash.
- The only allowed write is one `blog_daily_content_llm_dispatch_artifacts` row.
- The artifact uses `artifactKind=prompt_request_hash_bundle`, `artifactStorageMode=hash_only`, and `artifactRedactionStatus=redacted_or_hash_only`.
- It does not run provider health checks, call providers, create `llm_call_logs`, store prompts, store raw request/response bodies, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3E — Provider health-check positive gated run`.

## Patch 9F-3E provider health-check execution boundary

Patch 9F-3E allows only a provider metadata/connectivity health-check network call.

- It reuses `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-execution`.
- The execution gate accepts `BLOG_DAILY_CONTENT_LLM_PROVIDER_HEALTHCHECK_EXECUTE_ENABLED=true` as the worklist flag alias, alongside the existing execution flag.
- It still requires `BLOG_DAILY_CONTENT_LLM_PROVIDER_NETWORK_CALLS_ENABLED=true`, exact confirmation phrase, idempotency key, provider route/config/model/env readiness, and a supported health-check endpoint.
- Allowed endpoints are metadata/version/models-list health-check endpoints only.
- Completion/chat/generate/responses calls remain forbidden.
- It does not create `llm_call_logs`, store prompts, store raw response bodies/headers, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3F — Provider health-check audit/readback`.

## Patch 9F-3F provider health-check readback boundary

Patch 9F-3F reads back provider health-check audit/gate state without any provider call.

- It adds `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-readback`.
- It reports latest dispatch attempt health-check reference/hash fields, target-scoped audit counts, and the current health-check gate shape.
- Because 9F-3E intentionally did not persist raw provider result data, the readback marks that positive run as transient.
- It does not create event/artifact rows, call provider health-check endpoints, call completion/chat/generate/responses endpoints, create `llm_call_logs`, store prompts, store raw provider response bodies/headers, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3G — LLM dispatch final preflight`.

## Patch 9F-3G LLM dispatch final preflight boundary

Patch 9F-3G aggregates final pre-dispatch readiness without executing dispatch.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-final-preflight`.
- It checks audit attempt/event/artifact presence, prompt quality, request envelope readiness, provider route/model readiness, health-check readback, confirmation policy, and idempotency policy.
- It keeps `dispatchExecutionAllowedInThisPatch=false` and does not create a plan lock.
- It does not call provider health-check endpoints, call completion/chat/generate/responses endpoints, create `llm_call_logs`, store prompts, store raw provider response bodies/headers, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3H — LLM dispatch execution plan lock`.

## Patch 9F-3H LLM dispatch execution plan lock boundary

Patch 9F-3H computes a deterministic execution plan lock candidate without dispatch execution.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-execution-plan-lock`.
- It derives a stable lock envelope/hash from the 9F-3G final preflight result.
- It keeps lock persistence disabled and returns `lockPersistedNow=false`.
- It does not call provider health-check endpoints, call completion/chat/generate/responses endpoints, create `llm_call_logs`, store prompts, store raw provider response bodies/headers, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- Next boundary is `9F-3I — Gated single LLM dispatch, no content mutation`.

## Patch 9F-3I gated single LLM dispatch boundary

Patch 9F-3I adds the first guarded content-draft provider dispatch path without mutating generated content.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-execution`.
- The route defaults to `mode=preview`; preview never calls the provider, never creates `llm_call_logs`, and never writes DB rows.
- Execute mode requires `BLOG_DAILY_CONTENT_DRAFT_GENERATION_LLM_ENABLED=true`, exact confirmation phrase, idempotency key, current execution plan lock hash match, final preflight/plan lock readiness, a ready `content_draft` route/model/provider, and no prior provider/LLM call on the latest dispatch attempt.
- A successful execute performs one provider call, creates one `llm_call_logs` row, updates the existing dispatch attempt, creates one redacted event, and creates one hash-only response artifact.
- Raw prompts, raw request bodies, raw provider response bodies/headers, API keys, tokens, secrets, and full generated candidate text are not stored or returned.
- `content_items.draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, and `scheduledAt` remain unchanged.
- Blogger write/publish, OAuth reconnect, and token refresh remain disabled.
- Next boundary is `9F-3J — LLM dispatch result readback and no-content-mutation verification`.

## Patch 9F-3J LLM dispatch response readback boundary

Patch 9F-3J reads back the 9F-3I dispatch result without another provider call.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-response-readback`.
- It reads the latest dispatch attempt, redacted provider response event, hash-only response artifact, latest `llm_call_logs` dispatch metadata, and content item snapshot lengths.
- It verifies response hash/length consistency across event, artifact, and LLM log metadata.
- It does not call provider health-check endpoints, call completion/chat/generate/responses endpoints, create `llm_call_logs`, store prompts, store raw provider response bodies/headers, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- It returns no raw prompt, raw request body, raw provider response, full generated candidate, secret, token, or encrypted value.
- Next boundary is `9F-3K — LLM output quality validation preview`.

## Patch 9F-3K LLM output quality validation preview boundary

Patch 9F-3K adds deterministic output validation readiness without fabricating a content validation result.

- It adds `POST /api/daily-content-plans/draft-generation-llm-output-quality-validation-preview`.
- It reads 9F-3J response metadata and reports that full Markdown candidate validation is blocked because 9F-3I stored only hash/length metadata.
- Markdown structure, Korean readability, SEO headings, policy forbidden phrases, CTA/FAQ, and Blogger compatibility checks remain blocked until an explicitly approved candidate text artifact policy exists.
- It performs no LLM judge call and no provider call.
- It does not create `llm_call_logs`, mutate audit rows, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- It returns no raw prompt, raw request body, raw provider response, full generated candidate, secret, token, or encrypted value.
- Next boundary is `9F-3L — Gated output validation persistence`.

## Patch 9F-3L gated output validation persistence boundary

Patch 9F-3L adds a gated local audit persistence path for the 9F-3K validation preview.

- It adds `POST /api/daily-content-plans/draft-generation-llm-output-validation-persistence`.
- The route defaults to preview mode; preview never writes DB rows.
- Apply mode requires a dedicated feature flag, exact confirmation phrase, idempotency key, validation candidate, and no duplicate validation artifact.
- Apply may create one redacted validation event and one hash-only validation artifact for the existing dispatch attempt.
- `/settings/blogger` exposes preview only.
- It does not call provider endpoints, use an LLM judge, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- It returns no raw prompt, raw request body, raw provider response, full generated candidate, secret, token, or encrypted value.
- Next boundary is `9F-3M — Markdown candidate acceptance gate`.

## Patch 9F-3M Markdown candidate acceptance gate boundary

Patch 9F-3M adds a read-only gate for whether an LLM output can become `draftMarkdown`.

- It adds `POST /api/daily-content-plans/draft-generation-markdown-candidate-acceptance-gate`.
- It reads 9F-3K validation readiness and the linked content item snapshot.
- Because candidate Markdown text is not stored yet, acceptance is blocked and `canAcceptMarkdownCandidate=false`.
- It does not mutate audit rows, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, call Blogger, reconnect OAuth, or refresh tokens.
- It returns no raw prompt, raw request body, raw provider response, full generated candidate, secret, token, or encrypted value.
- Next boundary is `9F-3N — draftMarkdown mutation gate preview`.

## Patch 9F-3N draftMarkdown mutation gate preview boundary

Patch 9F-3N previews the future `draftMarkdown` mutation without writing content.

- It adds `POST /api/daily-content-plans/draft-markdown-mutation-gate-preview`.
- It reads 9F-3M acceptance status and linked content item lengths.
- Because no accepted Markdown candidate is available, the mutation preview is blocked.
- It does not return a proposed draftMarkdown body and does not mutate `content_items`.
- Next boundary is `9F-3O — Gated draftMarkdown persistence`, the first content mutation, requiring explicit approval before execution.

## Patch 9F-3O-prep candidate text artifact policy boundary

Patch 9F-3O-prep adds a read-only policy gate before any `draftMarkdown` persistence attempt.

- It adds `POST /api/daily-content-plans/draft-generation-candidate-text-artifact-policy`.
- It checks for a controlled `llm_candidate_markdown_text` artifact on the latest dispatch attempt.
- It does not reconstruct candidate Markdown from hash-only response artifacts.
- It keeps `dbWrite=false`, `llmCall=false`, `llmCallLogMutation=false`, `contentItemMutation=false`, and `draftMarkdownMutation=false`.
- Current state is expected to block `9F-3O` because the existing dispatch stored only hash/length metadata.
- The next safe path is `9F-3I-R1 — gated redispatch with candidate text artifact`, or an explicitly approved manual candidate text import path.

## Patch 9F-3I-R1 candidate text redispatch boundary

Patch 9F-3I-R1 adds the controlled path for creating the missing Markdown candidate text artifact.

- It adds `POST /api/daily-content-plans/draft-generation-candidate-text-redispatch`.
- The prior 9F-3I response body cannot be reconstructed from hash-only metadata.
- Execute mode may perform one provider call and store the result as `llm_candidate_markdown_text` with `artifactStorageMode=controlled_candidate_text`.
- The route does not mutate `content_items`, create `draftMarkdown`/`draftHtml`, write Blogger, publish, reconnect OAuth, or refresh tokens.
- API responses return candidate hash/length/artifact ids only, not the full Markdown body.
