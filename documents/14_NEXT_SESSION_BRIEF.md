# 14_NEXT_SESSION_BRIEF

## Current State: 2026-06-16 Closeout

```text
repo: ~/blog-growth-agent
branch: master
latest committed baseline before Patch 9E-8A: b558ead Add Blogger publish execution attempt storage
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
- Publish execution attempt preview is implemented read-only: future attempt schema/policy, retry/partial failure handling, redaction, and content mutation ordering can be checked, but no attempt table/migration/insert or publish execution exists.
- Publish execution attempt storage is implemented locally: `blogger_publish_execution_attempts` can store one planning-only attempt record after explicit acknowledgements, but publish execution remains unimplemented.
- Publish OAuth Gate is implemented read-only: saved approval/attempt records still cannot proceed to publish execution while access token state is expired or otherwise not gate-satisfied.
- The gate links users to `/settings/blogger` for manual OAuth reconnect guidance but does not start OAuth, refresh tokens, call Blogger, update attempts, invalidate approvals, or mutate content items.
- Manual OAuth Reconnect Completion Readiness is implemented inside the existing publish OAuth gate: it shows what must be rechecked after `/settings/blogger` reconnect, but still keeps `canExecutePublish=false`.
- Final Publish Execution Preflight Summary is implemented inside the existing publish OAuth gate: it integrates approval, execution attempt, OAuth/manual reconnect readiness, content/hash, target blog snapshot, rollback/safety placeholders, blockers, warnings, and side-effect summary while keeping `canExecutePublish=false`.
- Post-reconnect validation confirmed OAuth gate satisfied and final preflight ready, but publish execution remains disabled.
- Guarded Blogger Publish Execution Design is implemented inside the existing publish OAuth gate: it shows the future publish operation plan, redacted request plan, failure policy draft, implementation/execution requirements, blockers, warnings, and side-effect summary while keeping `canExecutePublish=false`.
- In the post-reconnect/final-preflight-ready path, legacy blockers `final_publish_preflight_not_implemented` and `publish_execution_still_disabled_until_final_preflight` should no longer appear; guarded publish implementation, rollback acknowledgement, external write risk acknowledgement, and final human approval remain blockers.
- Guarded Blogger Publish Execution route is implemented at `POST /api/content-items/[id]/guarded-publish-execution`.
- The route defaults to `mode=dry_run`, performs DB reads only, and keeps `canExecutePublish=false`.
- Live publish is code-gated by `BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=true`, exact confirmation phrase `I_UNDERSTAND_THIS_WILL_PUBLISH_TO_BLOGGER`, matching approval/attempt/hash/blog/post metadata, OAuth/final-preflight readiness, rollback acknowledgement, external write risk acknowledgement, and final human approval.
- `content_mutation_deferred_to_post_publish_patch` is no longer a live publish hard blocker. It is surfaced as a warning/post-publish deferred action for 9E-9D, because local `content_items.status`/`publishedAt` mutation must wait for publish result readback.
- Publish Result Readback is implemented at `POST /api/content-items/[id]/publish-result-readback`. It can perform Blogger read-only `posts.get`, returns redacted post metadata only, and previews the 9E-9D reconciliation plan without writing DB rows.
- After the 9E-9B-LIVE publish smoke, internal DB state intentionally remains unreconciled: content item status is still `planned`, `publishedAt=null`, and the saved publish execution attempt is still `planned_only` with no `bloggerResponseRedactedJson`.
- Blogger OAuth token refresh is implemented at `POST /api/settings/blogger/[id]/refresh-token` and in `/settings/blogger`. It uses Google OAuth refresh-token grant and may update only encrypted token secret storage plus token connection metadata.
- Publish OAuth gate now reports `tokenRefreshImplemented=true`, but R1 does not automatically refresh inside publish-oauth-gate, publish-result-readback, or guarded publish execution.
- Current OAuth expiry is a guarded route blocker, not a code implementation blocker. Live publish requires manual OAuth reconnect immediately before a separate live smoke.
- `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, and `draftHtml` are not changed by publish-readiness or policy UI.

## Next Patch Priorities

A. **Patch 9E-5C: explicit token refresh design approval**

- Decide whether refresh is user-triggered, preflight-triggered, or guarded-write-triggered.
- Keep refresh token/raw response redaction and audit policy explicit before implementation.

B. **Patch 9E-5D: posts.update preflight/approval design**

- Design update target identity, update approval snapshot, rollback warning, and side-effect summary before any `posts.update` implementation.
- Keep retry limited to recorded retryable failures where Blogger draft creation is not known to have succeeded.

C. **Patch 9E-7F: publish approval invalidation action design**

- Decide whether invalidation is automatic, manual, or preflight-derived before adding any DB update route.
- Keep invalidation action separate from Blogger publish execution.
- Keep actual Blogger publish execution out of scope.

D. **Patch 9E-7G: publish execution attempt execution preflight design**

- Design a read-only execution preflight for saved attempt records before any Blogger publish call.
- Require valid OAuth state, active approval, matching attempt plan, no invalidation candidates, and explicit execution side-effect acknowledgement.
- Preserve raw response redaction, retry-blocking on unknown side effects, and separate local content mutation ordering.
- Do not call Blogger publish until design is explicitly approved.

E. **Patch 9E-9B-LIVE or 9E-9C: live publish approval/readback**

- For `9E-9B-LIVE`, first complete manual OAuth reconnect in `/settings/blogger`, then get explicit user approval before running one live Blogger publish smoke.
- For `9E-9C`, publish result readback/reconciliation preview is now implemented; use it to verify Blogger readback before 9E-9D mutation.
- For `9E-9C-R2`, consider wiring readback to call the token refresh helper automatically when the access token is expired, with side effects clearly marked.
- Treat post-publish `content_items.status`/`publishedAt` mutation as a separate 9E-9D action after Blogger publish readback verifies the result.
- Keep scheduled publish execution disabled until a separate policy patch.
- Continue to block token refresh unless a separate token refresh policy patch is approved.

F. **Patch 9F roadmap candidate: Blog Operation Profile**

- Long-term direction is not repeated operator input on every content item.
- Explore Blog Operation Profile, default publishing policies, and an exception-focused dashboard for safer automated operations.

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
- 9E-7E added read-only publish execution attempt preview API/UI and documented future attempt schema/retry/partial failure/redaction/content mutation ordering policy, while keeping no attempt table, no migration, no attempt insert, no publish, no scheduled publish, no Blogger write, no token refresh, and no content item mutation.
- 9E-7F added local publish execution attempt storage/readback in `blogger_publish_execution_attempts`, guarded by server-side hash match and three acknowledgements, while keeping no publish, no scheduled publish, no Blogger write, no token refresh, no approval invalidation DB update, and no content item mutation.
- 9E-8A added read-only publish OAuth gate before future publish execution, while keeping no OAuth reconnect, no token refresh, no Blogger write, and no content mutation.
- 9E-8B added manual OAuth reconnect completion readiness inside the publish OAuth gate, while keeping `canExecutePublish=false`.
- 9E-8C added final publish execution preflight summary inside the publish OAuth gate, while keeping `canExecutePublish=false` and no publish/write/mutation side effects.
- 9E-8D was a validation milestone after manual OAuth reconnect: OAuth gate satisfied and final preflight ready were confirmed without a code patch.
- 9E-9A added guarded Blogger publish execution design inside the publish OAuth gate, cleaned up obsolete final-preflight-not-implemented blockers after final preflight is ready, and kept `canExecutePublish=false` with no publish/write/mutation side effects.
- 9E-9B added guarded Blogger publish execution route/lib and UI dry-run. Dry-run and live-negative smoke do not call Blogger or write DB. Live publish remains disabled unless the feature flag, exact phrase, acknowledgements, OAuth readiness, final preflight, and metadata matches are all satisfied.

## Closeout Safety Notes

- The live draft save used Blogger `posts.insert` with `isDraft=true`.
- `posts.update`, publish, scheduled publish, token refresh, and bulk publishing are not implemented.
- Additional Blogger draft saves must not be run for the same approval unless a later patch intentionally changes approval/update semantics.
- Successful same-approval draft saves are not retry candidates. Draft corrections need a new approval/new draft or a separately approved `posts.update` policy.
- A saved Blogger draft is not publish-ready. Publish and scheduled publish need separate approval/preflight/side-effect/audit/rollback policy before implementation.
- Expired access token handling is currently OAuth re-connection guidance only; do not call refresh/token endpoints without a later explicit patch.
- `.env.local`, `.env.local.backup*`, secret backup files, tokens, client secrets, and encrypted values must not be read, modified, printed, or staged.
