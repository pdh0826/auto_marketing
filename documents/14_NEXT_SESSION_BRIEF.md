# 14_NEXT_SESSION_BRIEF

## Current Repository State

```text
repo: ~/blog-growth-agent
branch: master
latest commit: 34b1351 Add manual HTML candidate apply flow
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

Patch 9C-2 후보: OAuth callback token exchange.

Current Blogger state:

- Patch 9A added `blogger_connections` placeholder model and migration.
- `/settings/blogger` can manage safe connection metadata.
- Blogger settings APIs return safe DTOs only.
- No access token, refresh token, or client secret plaintext is stored.
- Publish readiness can read Blogger connection status but `publishReady` remains false.
- Patch 9B added OAuth state storage and authorization URL dry-run.
- OAuth callback dry-run validates and consumes state but does not exchange tokens.
- Patch 9C-1 added `blogger_connection_secrets`, Blogger token encryption helper, safe secret metadata helper, secret-status API, and secret self-test API.
- `/settings/blogger` can show Token Storage Security metadata and encryption self-test results.
- `encryptedValue`, token plaintext, client secret plaintext, and authorization code plaintext are not returned by API/UI.

Target:

- Add OAuth callback token exchange using the Patch 9C-1 encrypted storage foundation.
- Store access/refresh tokens only as encrypted values and safe metadata.
- Keep raw authorization code, raw token response, token plaintext, and client secret plaintext out of API/UI/logs.
- Actual Blogger draft save/publish remains later.

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

현재 프로젝트 상태를 점검하고 Patch 9C 작업계획을 제안해줘.

목표:
- OAuth token exchange와 token storage security 정책을 검토한다.
- refresh token 저장/회전/만료/redaction 정책을 확정한다.
- 실제 Blogger draft save/publish는 구현하지 않는다.

아직 구현하지 말고 계획만 작성해줘.
```
