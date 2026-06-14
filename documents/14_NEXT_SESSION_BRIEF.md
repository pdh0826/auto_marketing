# 14_NEXT_SESSION_BRIEF

## Current Repository State

```text
repo: ~/blog-growth-agent
branch: master
latest commit before Patch 9E-3 work: 260c28d Add guarded Blogger draft save
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
- Blogger draft save live verification runbook and retry/update policy documentation
- Manual HTML quality repair preview for short/placeholder `draftHtml`

## Current Blogger State

- `blogger_connections` stores safe connection and selected blog metadata.
- `blogger_connection_secrets` stores encrypted token/client-secret metadata only.
- `blogger_draft_approvals` stores approval snapshot hashes and safe target blog metadata.
- `blogger_draft_saves` stores safe draft save success/failure metadata.
- Actual draft save is limited to Blogger `posts.insert` with `isDraft=true`.
- Duplicate successful saves for the same approval snapshot are blocked.
- Live verification requires explicit user approval with: `실제 Blogger test blog에 draft post가 생성됩니다. 실행해도 됩니까?`
- Patch 9E-3 did not execute a live Blogger draft save.
- `retryable=true` failure records are retry candidates; guard failures are not.
- `posts.update`, publish, scheduled publish, token refresh, and bulk publishing are not implemented.
- Content item status, `qualityScore`, `publishedAt`, and `scheduledAt` are not mutated by Blogger draft save.
- Publish readiness can show selected blog, manual approval, and draft saved checks, but `publishReady=false` and top-level `ready=false` remain.
- Patch 9E-4A adds `quality-repair-preview` to generate a rule-based HTML candidate without DB mutation, LLM calls, or Blogger API calls.
- Saving a repair candidate still requires the existing manual `apply-html` flow.

## Next Patch Candidate

Patch 9E-4B 후보: repair candidate apply UX polish.

Alternative candidates:

- Patch 9E-4C: Local LLM sectioned multi-pass long-form generation.
- Patch 9E-5: Blogger OAuth/test blog readiness 재점검.

Recommended scope:

- Decide whether the repair candidate should have a more direct but still manual apply UX.
- Keep automatic `draftHtml` save out of scope.
- Keep LLM long-form generation separate unless Patch 9E-4C is selected.
- Keep Blogger OAuth/live draft save out of scope unless Patch 9E-5 is selected.

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

현재 프로젝트 상태를 점검하고 Patch 9E-4B 작업계획을 제안해줘.

목표:
- Patch 9E-4A의 manual HTML quality repair preview 구현 상태를 확인한다.
- repair candidate apply UX polish를 설계한다.
- 자동 draftHtml 저장, LLM 호출, Blogger API 호출은 명시적으로 범위를 정하기 전까지 구현하지 않는다.

아직 구현하지 말고 계획만 작성해줘.
```
