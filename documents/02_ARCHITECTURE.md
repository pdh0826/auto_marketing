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
