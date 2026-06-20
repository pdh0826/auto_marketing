# 15_OPERATOR_APPROVAL_PERSISTENCE_DESIGN

## Patch 9F-2G Scope

Patch 9F-2G is design-only.

It does not:

- change `prisma/schema.prisma`
- create a Prisma migration
- create approval rows or events
- update Daily Content Plan rows or items
- update `content_items`
- generate `draftMarkdown` or `draftHtml`
- call LLM providers
- write to Blogger
- publish or schedule posts
- reconnect OAuth or refresh tokens

The goal is to define how a future patch can persist operator decisions for Daily Content Queue items while keeping approval persistence separate from generation, LLM execution, content mutation, Blogger write, and publish execution.

## Patch 9F-2I Scaffold And Apply Status

Patch 9F-2I adds the Prisma schema scaffold and one unapplied migration draft for this design.

Added scaffold:

- `BlogDailyContentOperatorApproval`
- `BlogDailyContentOperatorApprovalEvent`
- migration draft `prisma/migrations/20260620000200_add_daily_content_operator_approval_scaffold/migration.sql`

9F-2I does not:

- apply the migration
- create the operator approval tables in the DB
- create approval rows or events
- update approval status
- update Daily Content Plan rows or items
- update `content_items`
- generate `draftMarkdown` or `draftHtml`
- call LLM providers
- write to Blogger
- publish or schedule posts
- reconnect OAuth or refresh tokens

Patch 9F-2I-APPLY applied the existing migration exactly once after explicit operator approval.

DB state immediately after 9F-2I-APPLY and before 9F-2K-APPLY:

- `to_regclass('public.blog_daily_content_operator_approvals')` exists
- `to_regclass('public.blog_daily_content_operator_approval_events')` exists
- `operator_approvals_count = 0`
- `operator_approval_events_count = 0`

9F-2I-APPLY did not create approval rows/events, update approval status, mutate Daily Content Plan rows/items, mutate `content_items`, generate drafts, call LLM providers, write to Blogger, publish or schedule posts, reconnect OAuth, or refresh tokens.

## Patch 9F-2K Guarded Route And Apply Status

Patch 9F-2K implements the first guarded persistence route for this design:

- helper `src/lib/daily-content-plans/operator-approval-persistence.ts`
- route `POST /api/daily-content-plans/operator-approvals`
- Settings UI preview section `운영자 승인 저장`

The route supports:

- `mode=preview`, which is read-only and reports whether one approval row and one event row would be created
- `mode=apply`, which remains blocked unless the write feature flag, exact confirmation phrase, expected idempotency key, and target integrity checks all pass

Target approval for this patch:

- `approvalPurpose=draft_generation_execution`
- `approvalStatus=approved`
- `operatorAction=approve_for_draft_generation_execution`
- `operatorLabel=초안 생성 실행 승인`
- `planItemId=cmqlr1v1y0001iwj2gpv2875r`
- `contentItemId=daily_fixture_cmqlr1v1y0001iwj2gpv2875r`

Current state after the 9F-2K approved apply:

- The Korean approval phrase for approved apply was provided.
- Approved apply was executed exactly once through the guarded route.
- `operator_approvals_count = 1`
- `operator_approval_events_count = 1`
- approval id `cmqmcs1l10001iwu863doda1s`
- approval event id `cmqmcs1lg0003iwu8ff4780ll`
- `riskAcknowledged=true`
- `llmExecutionAcknowledged=true`
- `contentMutationAcknowledged=true`
- `externalWriteRiskAcknowledged=false`
- `bloggerWriteAcknowledged=false`

9F-2K does not generate content, call LLM providers, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.

## Patch 9F-2L Post-approval Readback Polish

Patch 9F-2L keeps the persisted approval rows unchanged and improves only post-approval readback:

- The operator approval preview now labels the current state as `승인 저장됨`.
- The same preview also states that `초안 생성 실행은 아직 차단됨`.
- The execution gate preview exposes post-approval state separately from execution blockers.
- `operator_approval_missing` is treated as resolved after the persisted approval is read.
- Remaining blockers stay focused on LLM execution, content mutation, draft generation write, confirmation phrase, and idempotency gates.

No new approval/event row is created by 9F-2L. The approval/event counts remain `1 / 1`. 9F-2L does not generate content, call LLM providers, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.

## Recommended Model

Use two future tables:

1. `blog_daily_content_operator_approvals`
2. `blog_daily_content_operator_approval_events`

`blog_daily_content_operator_approvals` is the current-state table. It stores the latest durable operator decision for a plan item, linked content item, and approval purpose. Future draft-generation gates should read this table to decide whether a linked fixture may proceed to the next guarded stage.

`blog_daily_content_operator_approval_events` is the append-only audit trail. It stores each operator action and transition, including approve, hold, reject, revoke, and supersede events. Events preserve the guardrail/readiness snapshot used when the operator made the decision.

Rejected alternative: event-sourced only.

An event-only design gives a strong audit trail, but every gate must replay events to find current approval state. That adds complexity to preflight routes and UI readback. A current-state table plus append-only events is clearer for the MVP and matches existing Blogger approval/attempt patterns.

Rejected alternative: one approval column on `blog_daily_content_plan_items`.

Putting approval state directly on plan items would be simple, but it blurs approval purposes, makes idempotency harder, and cannot audit transitions cleanly. It also couples future generation approval to the planning row too tightly.

## Approval Purposes

Future enum-like values:

- `draft_generation_readiness`
- `draft_generation_execution`
- `html_conversion_readiness`
- `publish_review_readiness`

Initial MVP recommendation:

- Persist `draft_generation_readiness` first for operator review of linked content fixtures.
- Keep `draft_generation_execution` as a separate, stricter purpose if the future execution gate needs a second approval immediately before LLM execution.

## Statuses And Actions

Approval status values:

- `pending`
- `approved`
- `held`
- `rejected`
- `revoked`
- `superseded`

Operator action values:

- `approve_for_draft_generation`
- `hold_for_topic_review`
- `request_topic_rework`
- `reject_topic`
- `revoke_approval`
- `supersede_approval`

## Proposed Columns

### `blog_daily_content_operator_approvals`

Required:

- `id`
- `planId`
- `planItemId`
- `contentItemId`
- `approvalPurpose`
- `approvalStatus`
- `operatorAction`
- `approvalPolicyPreset`
- `operationMode`
- `guardrailSnapshotJson`
- `readinessSnapshotJson`
- `sideEffectExpectationJson`
- `idempotencyKey`
- `createdAt`
- `updatedAt`

Nullable:

- `operatorLabel`
- `operatorNoteRedacted`
- `riskAcknowledged`
- `externalWriteRiskAcknowledged`
- `llmExecutionAcknowledged`
- `contentMutationAcknowledged`
- `bloggerWriteAcknowledged`
- `approvedAt`
- `heldAt`
- `rejectedAt`
- `revokedAt`
- `createdByOperatorId`
- `updatedByOperatorId`

Notes:

- `operatorNoteRedacted` must be short text only and must not contain prompt, generated draft, raw Blogger response, token, or secret material.
- `guardrailSnapshotJson` should include disabled generation/LLM/Blogger/publish flags.
- `readinessSnapshotJson` should include the 9F-2F structural readiness result hash or summary.
- `sideEffectExpectationJson` should explicitly state approval persistence only, with generation/LLM/content/Blogger side effects false.

### `blog_daily_content_operator_approval_events`

Required:

- `id`
- `approvalId`
- `planId`
- `planItemId`
- `contentItemId`
- `eventType`
- `toStatus`
- `operatorAction`
- `idempotencyKey`
- `guardrailSnapshotJson`
- `readinessSnapshotJson`
- `sideEffectExpectationJson`
- `createdAt`

Nullable:

- `fromStatus`
- `operatorNoteRedacted`
- `requestId`
- `createdByOperatorId`

Notes:

- Events are append-only.
- Future rollback should add a `revoke_approval` or `supersede_approval` event rather than hard deleting rows.

## Foreign Keys

Future foreign keys:

- `planId -> blog_daily_content_plans.id`
- `planItemId -> blog_daily_content_plan_items.id`
- `contentItemId -> content_items.id`
- `approvalId -> blog_daily_content_operator_approvals.id`

Recommended delete behavior:

- Plan delete cascades only in test/dev cleanup flows; production should avoid deleting operational history.
- Content item delete should be restricted or set-null only after policy review. The safer MVP default is restrict.

## Indexes And Duplicate Prevention

Indexes:

- `planId, createdAt`
- `planItemId, approvalPurpose`
- `contentItemId, approvalPurpose`
- `approvalStatus, approvalPurpose`
- `idempotencyKey`
- `createdAt`

Duplicate prevention:

- Use `idempotencyKey` for exact command dedupe.
- Validate status transitions in application code.
- Prefer at most one active approval per `planItemId + contentItemId + approvalPurpose`.

PostgreSQL partial index option:

```text
unique(planItemId, contentItemId, approvalPurpose)
where approvalStatus in ('pending', 'approved', 'held')
```

Tradeoff:

- Partial indexes are a good fit for active-state uniqueness.
- Prisma schema portability for partial indexes is limited, so this may require raw SQL in a future migration.
- If avoiding raw SQL, use a current-state marker such as `isCurrent=true` plus a composite unique constraint, and enforce status transitions carefully.

MVP recommendation:

- Use `idempotencyKey` for command dedupe.
- Use application-level transition checks.
- Add a PostgreSQL partial unique index in the migration only if the team accepts raw SQL migration content.

## State Machine

Allowed transitions:

- `pending -> approved`
- `pending -> held`
- `pending -> rejected`
- `approved -> revoked`
- `approved -> superseded`
- `held -> approved`
- `held -> rejected`
- `rejected -> superseded`

Future draft-generation execution may proceed only when all are true:

- linked content item exists
- 9F-2F readiness preflight passes structurally
- operator approval is approved for the required purpose
- explicit write flag is enabled
- confirmation phrase is accepted
- LLM provider execution gate passes
- content mutation gate passes

9F-2G implements none of those writes.

## Future API Proposal

Preview:

```text
POST /api/daily-content-plans/operator-approvals/preview
```

Apply:

```text
POST /api/daily-content-plans/operator-approvals/apply
```

Readback:

```text
GET /api/daily-content-plans/operator-approvals/readback
```

Future apply guard:

```text
BLOG_DAILY_CONTENT_OPERATOR_APPROVAL_WRITE_ENABLED=true
I_UNDERSTAND_THIS_WILL_PERSIST_OPERATOR_APPROVAL_ONLY
```

Allowed future apply side effects:

- approval current-state insert/update
- approval event insert

Still forbidden in approval apply:

- draft generation
- LLM call
- `content_items.draftMarkdown` mutation
- `content_items.draftHtml` mutation
- Blogger draft save
- Blogger publish
- scheduled publish
- token refresh
- OAuth reconnect

## Future UI Readback

`/settings/blogger` should eventually show:

- approval purpose
- current approval status
- latest operator action
- linked plan item
- linked content item
- readiness snapshot freshness
- whether generation execution remains disabled
- disabled actions until the generation execution gate is implemented

The UI should continue to separate:

- operator approval persistence
- draft generation execution
- content item mutation
- Blogger write/publish/schedule

## Relationship To Draft-generation Execution Gate

Patch 9F-2H adds the companion execution gate design in `documents/16_DRAFT_GENERATION_EXECUTION_GATE_DESIGN.md`.

The approval tables proposed here are intended to be read by that future execution gate. Approval persistence should not call LLM providers or mutate `content_items`; draft-generation execution should not create or silently repair approval state. If an approval is missing, mismatched, revoked, superseded, or stale, the execution gate should block before any LLM call or draft mutation.

## Future Smoke Plan

Required smokes for the implementation patch:

- preview-only smoke: `dbWrite=false`
- apply-negative with feature flag disabled: blocked, `dbWrite=false`
- apply-negative with missing confirmation: blocked, `dbWrite=false`
- approved apply exactly once: approval row/event only
- idempotency repeat: no duplicate active approval
- readback: approval state visible in operator workflow
- no-generation assertion: `draftMarkdown` and `draftHtml` unchanged
- no-LLM assertion: `llm_call_logs` unchanged
- no-Blogger assertion: Blogger/publication counts unchanged
- 9E baseline unchanged

## Rollback And Manual Recovery

9F-2G needs no rollback because it performs no DB mutation.

Future persisted approvals should not be hard deleted for normal rollback. Use:

- `revoke_approval`
- `supersede_approval`
- a matching append-only event
- a redacted operator note

Manual cleanup should be limited to test fixtures and only after explicit operator approval.

## Open Questions

- Should active-state uniqueness use a PostgreSQL partial index or a Prisma-portable `isCurrent` marker?
- Should the first approval purpose be `draft_generation_readiness`, `draft_generation_execution`, or both?
- Should approvals be keyed by plan item, content item, or both?
- What operator identity model should exist? Nullable/system-local is acceptable initially, but real users need stable operator ids later.
- Should approval snapshots include hashes of 9F-2F readiness responses to detect stale fixture state?
- Should rejected topics create a new approval row on reopen, or should they supersede the rejected row?
