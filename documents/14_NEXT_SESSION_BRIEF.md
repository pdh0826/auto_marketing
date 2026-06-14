# 14_NEXT_SESSION_BRIEF

## Current Repository State

```text
repo: ~/blog-growth-agent
branch: master
latest commit: d0168ff Add Blogger blog list read-only check
```

Recent commits:

```text
a53094c Improve draft safety repair flow
1c89245 Generate draft markdown candidates with LLM
a05c62b Add draft markdown dry run preview
2e7d5a0 Add editable plan candidate revalidation
78c5385 Return safe LLM call log summaries
af0ce9a Generate content plan candidates with LLM
```

## Implemented Scope

- PostgreSQL + Prisma CRUD API
- LLM Provider/Model/Task Route/Call Log management
- Provider invocation and connection test
- Safe call log DTO
- Blog and brand profile CRUD UI
- Content request CRUD UI
- Content asset upload and metadata management
- Rule-based media metadata suggestions
- `/content/[id]` detail screen
- Manual planJson editing and planned status transition
- `content_plan` dry-run preview
- `content_plan` LLM candidate generation
- Generated plan candidate editing and revalidation
- `content_draft` dry-run preview
- `content_draft` LLM candidate generation
- Generated draft candidate editing and revalidation
- Draft safety prompt hardening and one-time repair on validation failure
- Saved draftMarkdown based HTML Conversion Dry Run
- HTML candidate editing, revalidation, and manual draftHtml apply
- Saved draftHtml based Quality Dry Run preview
- Publish Readiness Gate preview
- Blogger connection placeholder settings
- Blogger OAuth state and authorization URL dry-run
- Blogger token storage security foundation
- Blogger OAuth callback token exchange
- Blogger blog list read-only lookup
- Blogger blog selection save with server revalidation

## Verified Runtime State

Test content item:

```text
id = cmqc2xqbr00011y70sxmgl65v
has_plan = true
has_draft = true
has_html = false
```

Latest verified `content_draft` call log:

```text
validationOk = true
repairAttempted = false
markdownLength = 1665
mediaPlaceholderCount = 1
```

## Next Patch

Patch 9E-1 후보: Blogger draft save 구현 전 최종 승인/guard 또는 actual draft save.

Current Blogger state:

- Patch 9A added `blogger_connections` placeholder model and migration.
- `/settings/blogger` can manage safe connection metadata.
- Blogger settings APIs return safe DTOs only.
- No access token, refresh token, or client secret plaintext is stored.
- Publish readiness can read Blogger connection status but `publishReady` remains false.
- Patch 9B added OAuth state storage and authorization URL dry-run.
- Patch 9C-1 added `blogger_connection_secrets`, Blogger token encryption helper, safe secret metadata helper, secret-status API, and secret self-test API.
- `/settings/blogger` can show Token Storage Security metadata and encryption self-test results.
- `encryptedValue`, token plaintext, client secret plaintext, and authorization code plaintext are not returned by API/UI.
- Patch 9C-2 added OAuth callback token exchange.
- Access/refresh tokens are stored only as encrypted values and safe metadata.
- Patch 9D-1 added read-only Blogger blog list lookup.
- Patch 9D-2 added verified Blogger blog selection save.
- Patch 9E-0 added Blogger draft payload preview/readiness without Blogger API calls or DB mutation.
- Blogger draft save, publish, scheduled publish, and token refresh are not implemented yet.

Target:

- Review the final guard requirements before calling Blogger posts APIs, then decide whether Patch 9E-1 should implement actual Blogger draft save.
- Keep token plaintext hidden and avoid storing raw Blogger responses.
- Keep publish/scheduled publish for a later patch unless explicitly approved.

## Do Not Start With

- Blogger draft/publish
- qualityScore automatic save
- HTML quality check and Blogger publishing in one patch
- API Key or secret output
- prompt full text or raw LLM response logging
- using `content_plan` route as a `content_draft` substitute
- `git add .` or `git add -A`

## First Prompt For Next Session

```text
AGENTS.md와 documents/ 폴더의 관련 문서를 먼저 읽어줘.

현재 프로젝트 상태를 점검하고 Patch 9E-1 작업계획을 제안해줘.

목표:
- Patch 9E-0의 Blogger draft payload preview/readiness 구현 상태를 확인한다.
- Patch 9E-1에서 actual Blogger draft save를 시작할지, 최종 승인/guard를 먼저 둘지 검토한다.
- token refresh, publish, scheduled publish는 구현하지 않는다.

아직 구현하지 말고 계획만 작성해줘.
```
