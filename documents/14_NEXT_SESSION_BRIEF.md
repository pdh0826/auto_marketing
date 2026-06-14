# 14_NEXT_SESSION_BRIEF

## Current Repository State

```text
repo: ~/blog-growth-agent
branch: master
latest commit before Patch 9E-2 work: 64762c2 Add Blogger draft approval guard
```

## Implemented Scope

- PostgreSQL + Prisma CRUD API
- LLM Provider/Model/Task Route/Call Log management
- Blog and brand profile CRUD UI
- Content request CRUD UI
- Content asset upload and metadata management
- Content plan/draft generation with user review before DB save
- Saved draftMarkdown to HTML preview/apply
- Saved draftHtml quality preview
- Publish Readiness Gate preview
- Blogger connection placeholder settings
- Blogger OAuth state, callback token exchange, and encrypted token metadata
- Blogger blog list read-only lookup
- Verified Blogger blog selection save with server revalidation
- Blogger draft payload preview
- Blogger draft manual approval guard with snapshot hashes
- Blogger draft save via `posts.insert?isDraft=true` guarded by active approval snapshot match

## Current Blogger State

- `blogger_connections` stores safe connection and selected blog metadata.
- `blogger_connection_secrets` stores encrypted token/client-secret metadata only.
- `blogger_draft_approvals` stores approval snapshot hashes and safe target blog metadata.
- `blogger_draft_saves` stores safe draft save success/failure metadata.
- Actual draft save is limited to Blogger `posts.insert` with `isDraft=true`.
- Duplicate successful saves for the same approval snapshot are blocked.
- `posts.update`, publish, scheduled publish, token refresh, and bulk publishing are not implemented.
- Content item status, `qualityScore`, `publishedAt`, and `scheduledAt` are not mutated by Blogger draft save.
- Publish readiness can show selected blog, manual approval, and draft saved checks, but `publishReady=false` and top-level `ready=false` remain.

## Next Patch Candidate

Patch 9E-3 후보: Blogger draft update/retry policy 또는 draft save 이후 publish handoff readiness.

Recommended scope:

- Decide whether existing successful draft posts can be updated in a later patch or whether each new approval should create a new draft.
- Design retry policy for failed draft saves without token refresh.
- Keep publish/scheduled publish out of scope unless a separate plan is approved.
- Keep token refresh out of scope unless explicitly selected as the patch target.

## Do Not Start With

- Blogger publish/scheduled publish implementation
- Token refresh implementation
- `posts.update` without first designing update/retry semantics
- qualityScore automatic save
- content item status automatic transition
- API Key or secret output
- prompt full text or raw LLM response logging
- `git add .` or `git add -A`

## First Prompt For Next Session

```text
AGENTS.md와 documents/ 폴더의 관련 문서를 먼저 읽어줘.

현재 프로젝트 상태를 점검하고 Patch 9E-3 작업계획을 제안해줘.

목표:
- Patch 9E-2의 Blogger draft save 구현 상태를 확인한다.
- draft update/retry policy 또는 publish handoff readiness 중 다음 최소 패치를 설계한다.
- publish/scheduled publish와 token refresh는 명시적으로 범위를 정하기 전까지 구현하지 않는다.

아직 구현하지 말고 계획만 작성해줘.
```
