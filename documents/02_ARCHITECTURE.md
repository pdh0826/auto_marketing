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
- publish readiness는 Blogger connection status를 반영하지만, 사용자 최종 승인 저장과 실제 OAuth/API가 없으므로 `publishReady`는 계속 false다.
- Blogger OAuth start/callback, Blogger blog list 조회, draft save, publish는 Patch 9B 이후 범위다.

## Patch 9B/9C-1 Blogger OAuth and Token Storage Foundation

Patch 9B와 9C-1은 실제 Blogger API 호출 전 보안 경계를 먼저 만든다.

```text
/settings/blogger
→ OAuth authorization URL dry-run
→ callback state validation dry-run
→ encrypted token storage metadata status
→ encryption self-test
```

- OAuth state 원문은 저장하지 않고 `stateHash`만 저장한다.
- callback dry-run은 authorization code 원문을 저장하거나 반환하지 않는다.
- Patch 9C-1의 `blogger_connection_secrets`는 encrypted secret value와 safe metadata만 저장한다.
- secret status API와 UI는 `encryptedValue`, access token, refresh token, client secret 원문을 반환하지 않는다.
- secret self-test는 서버 내부 dummy string만 사용하며 plaintext/ciphertext/encryptedValue를 반환하지 않는다.
- token exchange, token refresh, Blogger blog list 조회, draft save, publish는 아직 구현하지 않는다.
