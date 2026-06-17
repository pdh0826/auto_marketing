# 14_NEXT_SESSION_BRIEF

## Current State: 2026-06-16 Closeout

```text
repo: ~/blog-growth-agent
branch: master
latest committed baseline before Patch 9E-6C: 1c3f241 Add Blogger publish preflight dry run
milestone: Stepwise draft -> publish-ready HTML -> manual draftHtml apply -> Blogger OAuth/blog selection -> approval -> Blogger draft save 1회 성공
```

The current completed path is:

1. Local stepwise draft generation can create persisted runs, execute one step at a time, deterministically assemble sections, and final-polish a candidate.
2. A completed `finalCandidateMarkdown` can be copied into the existing Draft Markdown candidate editor as client-side state only.
3. Blog post template preview can deterministically render Markdown candidate HTML without saving or calling Blogger/LLM.
4. Preview HTML can be copied into the existing HTML candidate editor as client-side state only.
5. `validate-html` plus 2-step `apply-html` can manually save only `content_items.draftHtml`.
6. Blogger OAuth connection, verified blog selection, payload preview, approval snapshot, save preflight, and guarded draft save are complete for the test blog.
7. One live Blogger draft save has succeeded through the web UI.

## Current Blogger/Test State

- `contentItemId`: `cmqc2xqbr00011y70sxmgl65v`
- title candidate: `주식 초보자가 매수 타이밍을 놓치는 이유`
- `connectionId`: `cmqfst8vc0001iwrpi1qu8oj2`
- selected blog: `급등포착`
- `targetBloggerBlogId`: `3065973490356135805`
- `targetBloggerBlogUrl`: `https://mathlearningappl.blogspot.com/`
- `approvalId`: `cmqfwjz9u0009iwag9auo688v`
- `bloggerPostId`: `6376467965797870330`
- Blogger draft/preview was confirmed in Blogger admin.
- `blogger_draft_saves = 1`
- `blogger_draft_approvals = 1`
- `llm_call_logs = 22`
- content item `status = planned`
- `draftMarkdown` md5: `9e0921e7edc9e4a8464a0a52ba369d3d`
- `draftHtml` md5: `a7393df8fb009566201daeea18796027`
- `draftHtml` length: `2789`
- `qualityScore`, `publishedAt`, and `scheduledAt` remain unchanged.
- Post-save preflight confirms duplicate protection with `blogger_draft_already_saved_for_approval`.
- Current preflight may also include `access_token_expired_reauth_required`; this means a future Blogger write needs OAuth re-connection, not automatic token refresh.
- Automatic token refresh is not implemented.
- Draft update/retry policy is planning-only: successful same-approval saves are not retried, and `posts.update` is not implemented.
- Publish/scheduled publish policy is planning-only: saved Blogger draft is not publish-ready, and `publishReady=false`/top-level `ready=false` remain intentional.
- Publish preflight dry-run is read-only: `canPublish=false`, `canSchedulePublish=false`, side-effect flags all false, and publish/scheduled publish remain not implemented.
- Publish approval snapshot preview is read-only: `canCreatePublishApproval=false`, hash preview is persisted only after an explicit save action with acknowledgements.
- Publish approval persistence policy is partially implemented as local snapshot storage; invalidation UX, publish attempt audit, and real publish execution remain future work.
- Publish approval persistence storage is implemented locally: `blogger_publish_approvals` can store non-secret approval snapshots after explicit acknowledgements, but publish execution remains unimplemented.
- Publish approval readback is implemented: latest/active saved approval summaries can be read in API/UI, and one local DB insert smoke has been verified.
- Publish approval execution guard is implemented read-only: saved approval/current state matching and invalidation candidates can be checked, but invalidation DB update and publish execution remain unimplemented.
- Publish approval invalidation preview is implemented read-only: normal/manual invalidation dry-run plans can be checked, but invalidatedAt/invalidatedReason DB update remains unimplemented.
- `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, and `draftHtml` are not changed by publish-readiness or policy UI.

## Next Patch Priorities

A. **Patch 9E-5C: explicit token refresh design approval**

- Decide whether refresh is user-triggered, preflight-triggered, or guarded-write-triggered.
- Keep refresh token/raw response redaction and audit policy explicit before implementation.

B. **Patch 9E-5D: posts.update preflight/approval design**

- Design update target identity, update approval snapshot, rollback warning, and side-effect summary before any `posts.update` implementation.
- Keep retry limited to recorded retryable failures where Blogger draft creation is not known to have succeeded.

C. **Patch 9E-7E: publish approval invalidation action design**

- Decide whether invalidation is automatic, manual, or preflight-derived before adding any DB update route.
- Keep invalidation action separate from Blogger publish execution.
- Keep actual Blogger publish execution out of scope.

D. **Patch 9E-7F: publish execution audit/preflight design**

- Design publish execution attempt audit, partial failure handling, and local content status/timestamp mutation ordering.
- Do not call Blogger publish until design is explicitly approved.

General boundary:

- Do not implement publish/scheduled publish until draft update/retry, token refresh, and manual approval policies are settled.

## Do Not Start With

- Blogger publish implementation
- Scheduled publish implementation
- `posts.update` implementation
- Automatic token refresh implementation
- Extra Blogger draft save for the same approval
- Content item `status`, `publishedAt`, `scheduledAt`, or `qualityScore` mutation
- Automatic `draftMarkdown` or `draftHtml` overwrite
- Prompt/raw response/candidate full-text logging
- Secret, token, `.env.local`, `.env.local.backup*`, or encrypted value output
- `git add .` or `git add -A`

## Required Session Start Checks

Run these before the next patch:

```bash
git status --short
git log --oneline -8
npx prisma migrate status
```

Useful DB guard queries:

```bash
psql -d blog_growth_agent_dev -c "select count(*) as blogger_draft_saves from blogger_draft_saves;"
psql -d blog_growth_agent_dev -c "select count(*) as blogger_draft_approvals from blogger_draft_approvals;"
psql -d blog_growth_agent_dev -c "select count(*) as llm_call_logs from llm_call_logs;"
psql -d blog_growth_agent_dev -c "select md5(coalesce(\"draftMarkdown\", '')) as draft_markdown_md5, md5(coalesce(\"draftHtml\", '')) as draft_html_md5, status, \"qualityScore\", \"publishedAt\", \"scheduledAt\" from content_items where id = 'cmqc2xqbr00011y70sxmgl65v';"
```

Optional API guard after dev server is running:

```bash
curl -s -X POST http://localhost:3013/api/content-items/cmqc2xqbr00011y70sxmgl65v/blogger-draft-save-preflight
```

Expected preflight condition after the successful save:

- `canSaveDraft=false`
- `blockingReasons` may include `access_token_expired_reauth_required`
- `blockingReasons` includes `blogger_draft_already_saved_for_approval`
- `draftSavePreflightSummary.successfulSaveForCurrentApproval=true`
- `draftSavePreflightSummary.duplicateSaveBlocked=true`
- side-effect flags remain false

## Compact History

- 9E-4C-3A/3B added persisted stepwise run/step schema, repository helpers, and start/read APIs.
- 9E-4C-3C added one-step-at-a-time local step execution with safe LLM call logging.
- 9E-4C-3D added deterministic assemble and final polish APIs.
- 9E-4C-3E added the content detail stepwise UI.
- 9E-4C-3F added client-side handoff from final stepwise candidate to the Draft Markdown candidate editor.
- 9E-4D added deterministic Blog Post Template HTML preview.
- 9E-4E added client-side handoff from template HTML preview to the HTML candidate editor.
- 9E-4F hardened manual `draftHtml` apply with server revalidation and 2-step confirmation.
- 9E-4G-1 added saved `draftHtml` Blogger Draft Save Preflight.
- 9E-4G-1b improved readiness guidance and Blogger settings navigation.
- 9E-4G-1c fixed preflight blocker classification and duplicate-save blocker semantics.
- 9E-4G-2a enabled the guarded save button from `canSaveDraft=true` preflight and added 2-step save confirmation.
- 9E-4G-2b polished successful draft save UX, derived Blogger admin edit/preview links, and duplicate-save protection display.
- 9E-4H refreshed post-save Publish Readiness UX while keeping `ready=false` and `publishReady=false`.
- 9E-5A clarified token-expired readiness UX and token refresh design boundaries without implementing refresh.
- 9E-5B documented and surfaced Blogger draft update/retry policy planning without implementing `posts.update` or retry execution.
- 9E-6A documented and surfaced publish/scheduled publish policy planning without implementing publish, scheduling, or local status/timestamp mutation.
- 9E-6B added read-only publish preflight dry-run API/UI and documented the future publish approval snapshot model while keeping `canPublish=false`, `canSchedulePublish=false`, and all side-effect flags false.
- 9E-6C added read-only publish approval snapshot/hash preview API/UI while keeping `canCreatePublishApproval=false`, no approval persistence, and all side-effect flags false.
- 9E-6D documented and surfaced publish approval persistence policy/schema planning while keeping no approval table, no migration, no DB write, no publish, and no Blogger write.
- 9E-7A added local publish approval persistence storage in `blogger_publish_approvals`, guarded by server-side hash match and three acknowledgements, while keeping no publish, no scheduled publish, no Blogger write, no token refresh, and no content item mutation.
- 9E-7B added saved publish approval readback API/UI and verified one local approval insert plus idempotent re-save, while keeping no publish, no scheduled publish, no Blogger write, no token refresh, and no content item mutation.
- 9E-7C added read-only publish approval execution guard API/UI for current-state match and invalidation candidate checks, while keeping no invalidation DB update, no publish, no scheduled publish, no Blogger write, no token refresh, and no content item mutation.
- 9E-7D added read-only publish approval invalidation preview API/UI for normal/manual dry-run plans, while keeping no invalidation DB update, no publish, no scheduled publish, no Blogger write, no token refresh, and no content item mutation.

## Closeout Safety Notes

- The live draft save used Blogger `posts.insert` with `isDraft=true`.
- `posts.update`, publish, scheduled publish, token refresh, and bulk publishing are not implemented.
- Additional Blogger draft saves must not be run for the same approval unless a later patch intentionally changes approval/update semantics.
- Successful same-approval draft saves are not retry candidates. Draft corrections need a new approval/new draft or a separately approved `posts.update` policy.
- A saved Blogger draft is not publish-ready. Publish and scheduled publish need separate approval/preflight/side-effect/audit/rollback policy before implementation.
- Expired access token handling is currently OAuth re-connection guidance only; do not call refresh/token endpoints without a later explicit patch.
- `.env.local`, `.env.local.backup*`, secret backup files, tokens, client secrets, and encrypted values must not be read, modified, printed, or staged.
