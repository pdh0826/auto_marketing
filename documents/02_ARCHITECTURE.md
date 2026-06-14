# 02_ARCHITECTURE

## 권장 구조

```text
Frontend: Next.js 관리자 웹
Backend: Next.js Route Handlers
Database: PostgreSQL
ORM: Prisma
Scheduler: Node cron 또는 별도 worker
LLM Layer: OpenAI Adapter + Local LLM Adapter + LLM Router
Blogger Integration: Google OAuth + Blogger API
```

## 핵심 흐름

```text
입력 소재
→ 글 기획서
→ 본문 초안
→ HTML 변환
→ 품질검사
→ 미리보기
→ Blogger 초안 저장
→ 예약 발행
```

## 2026-06-14 실제 구현 구조

```text
Next.js App Router 관리자 UI
→ Next.js Route Handlers
→ Prisma Client
→ PostgreSQL
```

LLM 호출은 task route 기반으로 분리되어 있다.

```text
content_plan
→ Task Route 조회
→ primary Provider/Model 호출
→ provider call failure일 때만 fallback 1회
→ planJson 후보 validation
→ 사용자 확인 후 PATCH 저장
```

```text
content_draft
→ saved planJson 기반 readiness 확인
→ Task Route 조회
→ primary Provider/Model 호출
→ provider call failure일 때만 fallback 1회
→ draftMarkdown 후보 validation
→ validation error 시 같은 Provider/Model로 repair 1회
→ 사용자 확인 후 PATCH 저장
```

현재 `content_plan`과 `content_draft`는 서로 다른 Task Route를 사용한다. `content_plan` route를 draft generation 대용으로 사용하지 않는다.

## 다음 아키텍처 단계

Patch 8C에서는 저장된 `draftMarkdown`을 입력으로 HTML 변환 dry-run/preview를 추가한다.

- 실제 Blogger 연동은 하지 않는다.
- `draftHtml` 자동 저장은 하지 않는다.
- media placeholder 변환 preview와 HTML sanitization/security policy를 먼저 검토한다.

## Patch 8C HTML Dry Run

Patch 8C는 저장된 `draftMarkdown`을 read-only로 조회해 HTML preview를 생성한다.

```text
saved draftMarkdown
→ Markdown validation
→ media placeholder mapping
→ escaped HTML conversion
→ sanitization/security readiness
→ previewHtml response
```

- API는 `POST /api/content-items/[id]/html-preview`다.
- content item, blog, brand, attached assets는 read-only로 조회한다.
- previewHtml은 응답과 화면에만 사용하고 `content_items.draftHtml`에는 저장하지 않는다.
- LLM 호출과 `llm_call_logs` 생성은 없다.
- media placeholder는 `/api/content-assets/{assetId}/file` 형태의 내부 file API URL로 preview한다.
- media `storagePath`, provider headers, request template, API Key, secret은 응답과 화면에 포함하지 않는다.

## Patch 8D HTML Candidate Apply

Patch 8D는 Patch 8C의 `previewHtml`을 편집 가능한 HTML 후보로 다룬다.

```text
HTML dry-run preview
→ editable HTML candidate
→ POST /api/content-items/[id]/validate-html
→ user review
→ POST /api/content-items/[id]/apply-html
→ content_items.draftHtml manual update
```

- `validate-html`은 read-only 검증만 수행하고 DB를 변경하지 않는다.
- `apply-html`은 서버에서 동일한 validation/security/media reference 검사를 다시 수행한다.
- validation error가 있으면 `draftHtml`을 저장하지 않는다.
- warning만 있으면 사용자가 검토 후 저장할 수 있다.
- 저장되는 `draftHtml`은 로컬 preview/검증용 HTML이며 Blogger 최종 발행 HTML이 아니다.
- Blogger OAuth/API/publish, LLM 호출, `llm_call_logs` 생성은 수행하지 않는다.

## Patch 8E Quality Dry Run

Patch 8E는 저장된 `draftHtml`을 read-only로 조회해 품질검사 preview를 생성한다.

```text
saved draftHtml
→ HTML/security/media validation reuse
→ structure / SEO / media / safety / Blogger compatibility checks
→ scorePreview and grade
→ UI preview only
```

- API는 `POST /api/content-items/[id]/quality-preview`다.
- content item, blog, brand, attached assets는 내부 검사용으로만 조회한다.
- 응답에는 원본 content item이나 원본 assets를 그대로 반환하지 않는다.
- `scorePreview`와 `grade`는 화면 표시용이며 `content_items.qualityScore`에는 저장하지 않는다.
- status, draftHtml, publishedAt, scheduledAt은 변경하지 않는다.
- Blogger OAuth/API/publish, LLM 호출, `llm_call_logs` 생성은 수행하지 않는다.

## Patch 8F Publish Readiness Gate

Patch 8F는 저장된 생성 산출물과 quality preview를 바탕으로 발행 준비 상태를 read-only로 점검한다.

```text
saved planJson / draftMarkdown / draftHtml
→ HTML validation
→ quality preview reuse
→ publish readiness checks
→ contentReady / publishReady split
→ UI preview only
```

- API는 `POST /api/content-items/[id]/publish-readiness`다.
- `contentReady`는 콘텐츠 산출물과 품질 기준 통과 여부를 의미한다.
- `publishReady`는 실제 발행 가능 여부를 의미하며 Patch 8F에서는 항상 false다.
- Blogger 연결과 사용자 최종 승인 기능은 아직 없으므로 readiness gate는 preview 전용이다.
- status, qualityScore, draftHtml, publishedAt, scheduledAt은 변경하지 않는다.
- Blogger OAuth/API/publish, LLM 호출, `llm_call_logs` 생성은 수행하지 않는다.

## Patch 9A Blogger Connection Placeholder

Patch 9A는 실제 OAuth/API 호출 전에 Blogger 연결 설정을 안전한 placeholder로 관리한다.

```text
/settings/blogger
→ Blogger connection placeholder CRUD
→ safe status summary API
→ publish readiness Blogger status context
→ OAuth/API/publish disabled placeholders
```

- `blogger_connections`는 Blogger 연결 상태와 안전한 메타데이터만 저장한다.
- access token, refresh token, client secret 원문은 저장하지 않는다.
- `Blog.bloggerBlogId`는 기존 호환 필드로 유지하되 새 연결 흐름의 source of truth는 `BloggerConnection.bloggerBlogId`다.
- publish readiness는 Blogger connection status를 반영하지만, 사용자 최종 승인 저장과 실제 발행 기능이 없으므로 `publishReady`는 계속 false다.
- Blogger OAuth start/callback과 read-only blog list 조회는 구현되었다. Blogger blog 선택 저장, draft save, publish는 후속 범위다.

## Patch 9B/9C Blogger OAuth and Token Storage Foundation

Patch 9B, 9C-1, 9C-2는 실제 Blogger API 호출 전 OAuth/token 보안 경계를 먼저 만든다.

```text
/settings/blogger
→ OAuth authorization URL dry-run
→ callback state validation and token exchange
→ encrypted token storage metadata status
→ encryption self-test
```

- OAuth state 원문은 저장하지 않고 `stateHash`만 저장한다.
- callback은 authorization code 원문을 저장하거나 반환하지 않는다.
- Patch 9C-1의 `blogger_connection_secrets`는 encrypted secret value와 safe metadata만 저장한다.
- Patch 9C-2는 access token과 refresh token을 encrypted secret value로만 저장한다.
- `clientSecretRef`는 서버 내부 env key name으로만 해석한다.
- secret status API와 UI는 `encryptedValue`, access token, refresh token, client secret 원문을 반환하지 않는다.
- secret self-test는 서버 내부 dummy string만 사용하며 plaintext/ciphertext/encryptedValue를 반환하지 않는다.
- token refresh, draft save, publish는 아직 구현하지 않는다.

## Patch 9D-1 Blogger Blog List Read-only

Patch 9D-1은 encrypted access token을 서버 내부에서만 복호화해 Blogger blog list를 read-only로 조회한다.

```text
/settings/blogger
→ Blogger 목록 조회
→ POST /api/settings/blogger/[id]/blogs
→ decrypt access_token server-side
→ GET https://www.googleapis.com/blogger/v3/users/self/blogs
→ safe DTO only
```

- API/UI는 Blogger blog ID, name, URL, published, updated만 표시한다.
- access token 원문은 Authorization header에만 사용하고 반환하지 않는다.
- refresh token은 사용하지 않으며 token refresh도 수행하지 않는다.
- Blogger API raw response/error body는 반환하거나 저장하지 않는다.
- DB mutation, Blogger blog 선택 저장, draft save, publish는 수행하지 않는다.
- publish readiness는 계속 `publishReady=false`를 유지한다.

## Patch 9D-2 Blogger Blog Selection

Patch 9D-2는 read-only 조회 결과 중 사용자가 선택한 Blogger blog를 connection에 verified metadata로 저장한다.

```text
/settings/blogger
→ Blogger 목록 조회
→ 이 블로그 선택
→ POST /api/settings/blogger/[id]/blogs/select
→ read-only blog list 재조회
→ verified safe metadata 저장
```

- 저장 필드는 Blogger blog ID, name, URL, verified timestamp뿐이다.
- request body의 blog ID는 저장 전에 현재 token으로 조회 가능한 blog인지 재검증한다.
- generic PATCH로 저장된 Blogger blog ID/name은 verified selection으로 보지 않는다.
- publish readiness는 Blogger blog selection check를 추가하지만 `publishReady=false`를 유지한다.
- token refresh, draft save, publish는 후속 범위다.

## Patch 9E-0 Blogger Draft Payload Preview

Patch 9E-0은 실제 Blogger draft save 전에 payload 후보와 readiness를 preview-only로 확인한다.

```text
/content/[id]
→ Draft Payload Preview
→ POST /api/content-items/[id]/blogger-draft-preview
→ saved draftHtml + verified Blogger selection metadata 확인
→ safe preview DTO 반환
```

- API는 request body에서 target Blogger blog ID를 받지 않는다.
- target blog는 content item의 Blog에 연결된 `BloggerConnection` verified metadata만 사용한다.
- 연결된 Blogger connection이 여러 개면 임의 선택하지 않고 blocking issue를 반환한다.
- saved `draftHtml`만 payload 후보 HTML source로 사용하며 `draftMarkdown` 즉시 변환은 하지 않는다.
- Blogger API read/write, token refresh, DB mutation, draft save, publish는 수행하지 않는다.
- publish readiness의 `publishReady=false`와 top-level `ready=false`는 유지한다.

## Patch 9E-1 Blogger Draft Approval Guard

Patch 9E-1은 실제 Blogger draft save 전에 현재 draft payload preview snapshot에 대한 manual approval을 저장한다.

```text
/content/[id]
→ Draft Payload Preview
→ 이 payload 승인
→ POST /api/content-items/[id]/blogger-draft-approval
→ 서버에서 preview 재계산
→ snapshot hash 저장
```

- approval API는 request body의 title/blogId/hash를 신뢰하지 않는다.
- full `draftHtml`은 저장하지 않고 `draftHtmlHash`만 저장한다.
- snapshot hash는 canonical JSON + SHA-256으로 계산한다.
- draftHtml/title/target blog/readiness가 바뀌면 current snapshot과 approval snapshot이 mismatch가 되어 재승인이 필요하다.
- publish readiness manual approval check는 snapshot match 시 pass할 수 있지만 `publishReady=false`와 top-level `ready=false`는 유지한다.
- Blogger API read/write, token refresh, draft save, publish는 수행하지 않는다.

## Patch 9E-2 Blogger Draft Save

Patch 9E-2는 active approval snapshot이 현재 draft payload preview와 일치할 때만 Blogger draft post를 저장한다.

```text
/content/[id]
→ Draft Payload Preview
→ 이 payload 승인
→ Blogger Draft 저장
→ POST /api/content-items/[id]/blogger-draft-save
→ 서버에서 preview/hash/approval 재검증
→ Blogger posts.insert?isDraft=true
→ safe draft save metadata 저장
```

- draft save API는 request body의 blog/title/html/hash를 신뢰하지 않고 서버에서 현재 content item 기준 preview를 다시 계산한다.
- active approval의 `snapshotHash`와 `draftHtmlHash`가 current preview hash와 일치해야 한다.
- Blogger API write는 `posts.insert` + `isDraft=true`만 사용한다. `posts.update`, publish, scheduled publish는 수행하지 않는다.
- 성공/실패 결과는 `blogger_draft_saves`에 safe metadata로 저장한다.
- raw Blogger response/error body, token, encrypted value, full `draftHtml`은 저장하거나 반환하지 않는다.
- token refresh는 구현하지 않는다. 401/403/expired token은 safe error와 reconnect guidance로 처리한다.
- content item status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경하지 않는다.
- publish readiness는 draft saved check를 표시할 수 있지만 `publishReady=false`와 top-level `ready=false`는 유지한다.

## Patch 9E-3 Blogger Draft Save Live Verification Policy

Patch 9E-3은 draft save 구현을 확장하지 않고 live verification runbook과 retry/update 정책을 고정한다.

- 실제 live draft save 검증은 사용자 별도 승인 전까지 실행하지 않는다.
- live write 전 승인 문구는 `실제 Blogger test blog에 draft post가 생성됩니다. 실행해도 됩니까?`로 고정한다.
- live verification은 connected token, verified test blog selection, saved `draftHtml`, `draftPayloadReady=true`, active approval snapshot match, no prior success 조건을 모두 만족해야 한다.
- same approval success record가 있으면 추가 `posts.insert`를 계속 차단한다.
- guard failure는 retry 대상이 아니며, `retryable=true` failure만 재시도 후보로 본다.
- 새 approval은 새 draft insert가 가능하지만 Blogger draft가 누적될 수 있다.
- `posts.update`와 `posts.delete`는 구현하지 않고 update/retry semantics는 별도 Patch 9E-4에서 검토한다.
- publish readiness는 `publishReady=false`와 top-level `ready=false`를 유지한다.

## Patch 9E-4A Manual HTML Quality Repair Preview

Patch 9E-4A는 Blogger live draft save 전에 saved `draftHtml` 품질 fail을 줄이기 위한 preview-only repair path를 추가한다.

```text
saved draftMarkdown / draftHtml
→ POST /api/content-items/[id]/quality-repair-preview
→ rule-based HTML repair candidate
→ validate-html / apply-html 수동 흐름 재사용
```

- repair preview는 saved `draftMarkdown` 기반 rule-based HTML rebuild를 우선 사용한다.
- `draftMarkdown`이 없거나 너무 짧으면 현재 `draftHtml`에 section/CTA/disclaimer를 append하는 fallback candidate를 만든다.
- API는 candidate와 before/after quality/validation summary만 반환한다.
- `draftHtml`, `qualityScore`, status, `publishedAt`, `scheduledAt`은 자동 변경하지 않는다.
- 저장은 기존 `apply-html` 수동 반영 flow에서만 가능하다.
- LLM Provider와 Blogger API는 호출하지 않고 `llm_call_logs`도 생성하지 않는다.
- `draftHtml`을 수동 반영하면 기존 Blogger approval snapshot은 stale이 될 수 있다.

## Patch 9E-4B Repair Candidate Apply UX Polish

Patch 9E-4B는 Patch 9E-4A의 repair candidate를 기존 HTML candidate apply path로 더 명확히 연결한다.

```text
Quality Repair Preview candidate
→ HTML 후보로 사용
→ HTML candidate editor source = quality-repair
→ POST /api/content-items/[id]/validate-html
→ POST /api/content-items/[id]/apply-html manual save
→ rerun Quality / Publish Readiness / Blogger Draft Payload Preview
```

- repair candidate를 HTML 후보로 복사해도 자동 저장하거나 자동 apply하지 않는다.
- 복사된 후보는 HTML candidate validation을 clear/stale 처리하고 재검증 후에만 수동 반영할 수 있다.
- HTML candidate source는 UI-only 상태로 `html-preview`, `quality-repair`, `manual-edit`를 표시한다.
- `apply-html` 성공 후 기존 quality/readiness/Blogger draft preview 결과는 stale로 보고 다시 실행해야 한다.
- `draftHtml` 변경 후 Blogger draft approval snapshot은 stale이 될 수 있으므로 Blogger draft save 전 재승인이 필요하다.
