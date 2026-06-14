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
