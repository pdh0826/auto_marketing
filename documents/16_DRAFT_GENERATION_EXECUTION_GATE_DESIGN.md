# 16_DRAFT_GENERATION_EXECUTION_GATE_DESIGN

## Patch 9F-2H Scope

Patch 9F-2H is documentation-only.

It does not:

- change `prisma/schema.prisma`
- create a Prisma migration
- create or update Daily Content Plan rows
- create or update Daily Content Plan item rows
- create or update operator approval rows
- update `content_items`
- generate `draftMarkdown` or `draftHtml`
- call LLM providers
- create `llm_call_logs`
- write to Blogger
- publish or schedule posts
- reconnect OAuth or refresh tokens

The goal is to define the future execution gate that must pass before a linked Daily Content Plan item can call an LLM and mutate one `content_items` draft.

## Patch 9F-2J Preview Implementation

Patch 9F-2J implements the read-only preview for this design:

- helper `src/lib/daily-content-plans/draft-generation-execution-gate-preview.ts`
- route `POST /api/daily-content-plans/draft-generation-execution-gate-preview`
- `/settings/blogger` readback section `초안 생성 실행 게이트`

The preview is not an execution route. It reports `executionAllowed=false` in the current baseline and keeps all side effects false except DB read.

Current expected blockers:

- `operator_approval_tables_not_applied`
- `operator_approval_missing`
- `llm_execution_feature_flag_disabled`
- `content_mutation_feature_flag_disabled`
- `draft_generation_write_feature_flag_disabled`
- `confirmation_phrase_missing`
- `idempotency_key_missing`

Because the 9F-2I migration is pending, the preview must not query `BlogDailyContentOperatorApproval` or `BlogDailyContentOperatorApprovalEvent` as Prisma models. It uses a safe read-only table existence check and treats absent tables as a blocker.

## Patch 9F-2I-APPLY Preview State

After 9F-2I-APPLY, the operator approval tables exist but contain no approval rows or events.

The 9F-2J preview should then report:

- `operatorApprovalTablesExist=true`
- `operatorApprovalPersistenceAvailable=true`
- `executionAllowed=false`
- `operatorApprovalSatisfied=false`
- blocker `operator_approval_missing`
- no blocker `operator_approval_tables_not_applied`

Execution remains blocked because operator approval has not been persisted and LLM execution, content mutation, draft write, confirmation, and idempotency gates remain unsatisfied.

## Patch 9F-2K Approval Apply State

Patch 9F-2K adds the guarded operator approval persistence route and updates this preview to read existing approved operator approval rows when the approval tables exist.

After the approved apply:

- `POST /api/daily-content-plans/operator-approvals` can preview the target approval.
- The Settings UI can display `운영자 승인 저장` preview state.
- One operator approval row and one operator approval event row exist for the target item/content.
- `operatorApprovalSatisfied=true`
- `operator_approval_missing` is removed from execution gate blockers.
- `executionAllowed=false`

Execution remains blocked because LLM execution, content mutation, draft write, confirmation, and idempotency gates remain blocked. 9F-2K approval persistence is necessary but not sufficient for draft generation execution.

## Patch 9F-2L Post-approval Preview Polish

Patch 9F-2L adds read-only post-approval clarity to the preview and Settings UI:

- `postApprovalState` shows persisted approval id/status/purpose/action and `operatorApprovalSatisfied=true`.
- `executionBlockerSummary` separates resolved blockers from remaining blockers.
- `operator_approval_missing` is resolved after the persisted approval is read.
- `executionAllowed=false` remains explicit and unchanged.
- Remaining blockers are `llm_execution_feature_flag_disabled`, `content_mutation_feature_flag_disabled`, `draft_generation_write_feature_flag_disabled`, `confirmation_phrase_missing`, and `idempotency_key_missing`.
- `nextSafeStepSummary` points to a future dry-run planner before any LLM call or content mutation.

This polish does not add an execution route, does not create execution runs, does not call LLM providers, does not mutate `content_items`, and does not write to Blogger. The persisted approval is necessary but still insufficient for draft-generation execution.

## Patch 9F-2M Dry-run Planner

Patch 9F-2M implements the read-only next safe step from 9F-2L:

- `POST /api/daily-content-plans/draft-generation-dry-run-planner`
- `/settings/blogger` section `초안 생성 dry-run 계획`
- planner mode `read_only_draft_generation_dry_run`

The planner reads the target plan item, linked fixture, persisted approval state, and existing execution gate state. It then shows:

- future input snapshot plan
- future prompt structure plan
- future model candidate source plan
- future output target plan
- current side-effect summary
- future side-effect requirements

It does not render a full prompt, store raw prompt text, call LLM providers, create `llm_call_logs`, generate draft content, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens. Non-preview modes are blocked with `draft_generation_dry_run_planner_is_preview_only`. Execution still remains blocked by LLM execution, content mutation, draft write, confirmation phrase, and idempotency gates.

## Patch 9F-2N LLM Provider Readiness Preview

Patch 9F-2N implements the static LLM provider/model readiness preview after the 9F-2M dry-run planner:

- `POST /api/daily-content-plans/draft-generation-llm-provider-readiness`
- `/settings/blogger` section `초안 생성 LLM 준비상태`
- readiness mode `read_only_llm_provider_execution_readiness`

The preview reads the existing `content_draft` Task Route, safe provider/model metadata, env presence booleans, and the existing execution gate state. It reports route resolution, provider kind/enabled status, model candidate status, secret/env metadata presence, readiness blockers, and next execution prerequisites.

It does not perform provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, render/store prompts, generate draft content, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens. It also does not expose env values, raw secrets, encrypted values, API keys, bearer tokens, provider request bodies, or raw provider responses. Execution still remains blocked by LLM execution, content mutation, draft write, confirmation phrase, and idempotency gates.

## Patch 9F-2O LLM Provider Health-check Preview

Patch 9F-2O implements the read-only health-check preview/gate after the 9F-2N static provider readiness step:

- `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-preview`
- `/settings/blogger` section `초안 생성 LLM health-check preview`
- health-check preview mode `read_only_llm_provider_health_check_preview`

The preview reuses the 9F-2N provider/model readiness result and describes the future safe health-check contract. It shows the selected provider/model, the provider-specific safe health-check type, feature flag/confirmation/idempotency blockers, and a no-side-effect summary.

It does not execute provider health checks, make provider network calls, call completion/generate/chat endpoints, render/store prompts, create `llm_call_logs`, generate draft content, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens. `mode=healthcheck_preview` is still blocked by design in 9F-2O and should only be opened by a later explicit health-check execution patch.

## Patch 9F-2P Gated LLM Provider Health-check Execution

Patch 9F-2P adds a separate gated health-check execution route after the 9F-2O preview:

- `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-execution`
- `/settings/blogger` section `초안 생성 LLM health-check 실행 게이트`
- execution mode `gated_llm_provider_health_check_execution`

The route may execute a future safe provider health/connectivity check only when explicit health-check feature flags, confirmation phrase, idempotency key, provider route/model readiness, required env presence, and supported provider health-check category all pass. Default validation keeps those gates closed, so no provider network call occurs.

This health-check execution path is not draft generation execution. A successful future provider health-check does not satisfy content mutation, draft write, confirmation/idempotency for draft generation, or publish isolation gates. It must not call completion/chat/generate/responses endpoints, render/store prompts, create `llm_call_logs`, mutate `content_items`, create/update `draftMarkdown` or `draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, or mutate publish approvals/attempts.

## Execution Gate Layers

The future execution route should evaluate these layers in order and return every blocking reason in a safe summary. No layer may store prompt text, raw LLM response text, generated candidate text, Blogger tokens, secrets, or external raw bodies.

| Layer | Required inputs | Pass condition | Fail/block reason | Side effects allowed | Side effects prohibited |
| --- | --- | --- | --- | --- | --- |
| Layer 0: Target integrity gate | `planId`, `planItemId`, `contentItemId` | Target plan item exists and points to the requested content item. | `target_plan_item_not_found`, `linked_content_fixture_not_found`, `linked_content_item_mismatch` | DB read | DB write, LLM, Blogger write |
| Layer 1: Daily plan item link gate | Plan item, linked fixture, plan metadata | Linked fixture exists, belongs to the target item, and the item is not published or scheduled. | `content_item_already_published`, `content_item_scheduled` | DB read | Draft mutation, publish mutation, schedule mutation |
| Layer 2: Draft-generation readiness preflight gate | 9F-2F readiness result or recomputed structural check | Structural readiness passes and existing drafts are absent unless regeneration is explicitly approved. | `draft_generation_readiness_failed`, `draft_already_exists_regeneration_not_approved` | DB read, readiness preview | LLM, draft write |
| Layer 3: Operator approval persistence gate | Approved operator approval for target item/content/purpose | Approval exists, matches the target item and content item, and is not revoked or superseded. | `operator_approval_missing`, `operator_approval_not_for_target_item`, `operator_approval_revoked`, `operator_approval_superseded` | DB read | Creating approval during execution, mutating approval without explicit approval flow |
| Layer 4: LLM provider/model gate | Provider key, model key, task route, health/readiness summary | Provider is configured and healthy, and model is allowed for draft generation. | `llm_provider_not_configured`, `llm_provider_unhealthy`, `draft_generation_model_not_allowed` | DB read, provider readiness check | Draft write, Blogger write |
| Layer 5: Content mutation write flag gate | Execution flags, operation profile, side-effect plan | Required LLM, content mutation, and draft write flags are all enabled. | `llm_execution_feature_flag_disabled`, `content_mutation_feature_flag_disabled`, `draft_generation_write_feature_flag_disabled` | DB read | LLM call or content mutation while any flag is disabled |
| Layer 6: Confirmation phrase and idempotency gate | Confirmation phrase, acknowledgement flags, idempotency key | Exact confirmation phrase and required acknowledgements are present; idempotency key is present and unused or replay-safe. | `confirmation_phrase_missing`, `idempotency_key_missing` | DB read, idempotency lookup | Duplicate LLM calls, duplicate draft mutation |
| Layer 7: Post-write readback/reconciliation gate | Previous draft hash, generated draft summary, mutation result | After future write, exactly one content item draft mutation is read back and classified. | Future `draft_generation_readback_failed` | One readback after approved write | Additional mutation, publish mutation |
| Layer 8: Publish isolation gate | Blogger/publish/schedule flags and route intent | Blogger write, publish, and schedule execution all remain disabled for draft generation. | `blogger_write_must_remain_disabled`, `publish_execution_must_remain_disabled`, `scheduled_publish_must_remain_disabled` | DB read | Blogger draft save, Blogger publish, scheduled publish, OAuth reconnect, token refresh |

## Required Future Pass Conditions

A future apply route may proceed only when all are true:

- the target Daily Content Plan item exists
- the linked content fixture exists
- the linked fixture matches the requested `contentItemId`
- the content item is not published
- the content item is not scheduled
- `draftMarkdown` and `draftHtml` are empty, unless a separate regeneration approval explicitly allows overwriting
- 9F-2F structural readiness passes
- an operator approval exists for the target item/content/purpose
- the approval is not revoked
- the approval is not superseded
- the LLM provider is configured and healthy
- the selected model is allowed for draft generation
- LLM execution, content mutation, and draft write feature flags are enabled
- the exact confirmation phrase is present
- an idempotency key is present
- Blogger write remains disabled
- publish execution remains disabled
- scheduled publish remains disabled

## Canonical Block Reasons

Future routes should use stable block reason keys:

- `target_plan_item_not_found`
- `linked_content_fixture_not_found`
- `linked_content_item_mismatch`
- `content_item_already_published`
- `content_item_scheduled`
- `draft_already_exists_regeneration_not_approved`
- `draft_generation_readiness_failed`
- `operator_approval_missing`
- `operator_approval_not_for_target_item`
- `operator_approval_revoked`
- `operator_approval_superseded`
- `llm_provider_not_configured`
- `llm_provider_unhealthy`
- `draft_generation_model_not_allowed`
- `llm_execution_feature_flag_disabled`
- `content_mutation_feature_flag_disabled`
- `draft_generation_write_feature_flag_disabled`
- `confirmation_phrase_missing`
- `idempotency_key_missing`
- `blogger_write_must_remain_disabled`
- `publish_execution_must_remain_disabled`
- `scheduled_publish_must_remain_disabled`

## Future Feature Flags

Preview may be allowed separately from write execution:

```text
BLOG_DAILY_CONTENT_DRAFT_GENERATION_PREVIEW_ENABLED=true
BLOG_DAILY_CONTENT_DRAFT_GENERATION_WRITE_ENABLED=true
BLOG_DAILY_CONTENT_DRAFT_GENERATION_LLM_ENABLED=true
BLOG_DAILY_CONTENT_CONTENT_MUTATION_ENABLED=true
```

Flag policy:

- Preview may return gate status without LLM calls or writes.
- LLM flag alone is not enough to execute.
- Write flag alone is not enough to execute.
- Content mutation flag alone is not enough to execute.
- All execution flags plus approval, confirmation, and idempotency must pass before apply.

## Confirmation Phrase

Machine confirmation phrase:

```text
I_UNDERSTAND_THIS_WILL_CALL_LLM_AND_MUTATE_ONE_CONTENT_ITEM_DRAFT
```

Korean UI phrase:

```text
승인합니다. 이 항목 1개의 초안 생성을 실행하며 LLM 호출과 content_items draft 필드 변경이 발생할 수 있음을 이해합니다.
```

The UI should require the operator to type the phrase before execution. A checkbox-only acknowledgement is not enough for the write path.

## Future API Proposal

Preview:

```text
POST /api/daily-content-plans/draft-generation-execution/preview
```

Apply:

```text
POST /api/daily-content-plans/draft-generation-execution/apply
```

Readback:

```text
GET /api/daily-content-plans/draft-generation-execution/readback
```

The preview route must be read-only and must not call LLM providers.

The apply route may eventually perform exactly one approved execution. It must reject when any gate fails and must return safe metadata only.

Allowed future apply side effects:

- one `llm_call_logs` insert
- one `content_items.draftMarkdown` and/or `content_items.draftHtml` mutation for the target content item
- one draft generation run/attempt row if the table exists

Forbidden future apply side effects:

- Blogger write
- Blogger draft save
- Blogger publish
- scheduled publish
- OAuth reconnect
- token refresh
- publish approval mutation
- publish attempt mutation
- unrelated `content_items` mutation

## Future Run And Audit Model

Recommended future tables:

- `blog_daily_content_draft_generation_runs`
- `blog_daily_content_draft_generation_steps`

Recommended run fields:

- `id`
- `planId`
- `planItemId`
- `contentItemId`
- `operatorApprovalId`
- `idempotencyKey`
- `providerKey`
- `modelKey`
- `promptVersion`
- `requestFingerprint`
- `inputSnapshotJson`
- `guardrailSnapshotJson`
- `sideEffectPlanJson`
- `status`
- `startedAt`
- `completedAt`
- `errorType`
- `errorCode`
- `errorMessageRedacted`
- `createdAt`
- `updatedAt`

Audit policy:

- Store hashes, ids, counts, provider/model safe metadata, status, latency, and redacted error summaries.
- Do not store prompt text, raw LLM response text, complete candidate Markdown, complete candidate HTML, Blogger tokens, API keys, encrypted values, or raw external response bodies.
- If full generated content must be persisted, store it only in the target draft fields after all execution gates pass.

## Idempotency And Replay Policy

The apply route must require an idempotency key.

Policy:

- Same key and same request fingerprint after success returns the existing safe summary.
- Same key with a different request fingerprint blocks as an idempotency conflict.
- A successful execution must not trigger duplicate LLM calls on replay.
- If a draft already exists, execution blocks unless a separate regeneration approval exists.
- Partial failures must be classified before retry.
- Unknown LLM results require manual review rather than automatic retry.
- If the LLM call succeeds but the content mutation status is unknown, do not call the LLM again until readback classifies the state.

## Future UI Proposal

The UI should show a dedicated `초안 생성 실행 준비` section.

It should display:

- each gate layer as pass/block/not applicable
- exact missing requirements
- expected side effects before execution
- LLM call warning
- `content_items` draft field mutation warning
- current idempotency key status
- operator approval status and freshness
- disabled Blogger write/publish/schedule status

Execution controls:

- The execute button remains disabled until every gate passes.
- The operator must type the confirmation phrase.
- The UI must separate `LLM 호출 발생` from `content_items draft 필드 변경 발생`.
- Blogger draft save, Blogger publish, scheduled publish, OAuth reconnect, and token refresh must be shown as disabled/not part of this step.

## Future Smoke Plan

Required smokes for future implementation:

- preview smoke: no writes and no LLM calls
- apply negative: all flags disabled
- apply negative: LLM flag only
- apply negative: write flag only
- apply negative: content mutation flag only
- apply negative: missing operator approval
- apply negative: missing idempotency key
- apply negative: Blogger write/publish/schedule requested
- approved apply: exactly one LLM call and exactly one target content item draft mutation
- idempotency replay: no duplicate LLM call and no duplicate draft mutation
- readback: target draft mutation matches expected run summary
- no-Blogger assertion: Blogger draft save, publish, schedule, OAuth reconnect, and token refresh remain untouched
- 9E baseline assertion: published milestone content remains unchanged

Patch 9F-2H performs none of those smokes beyond documentation and read-only baseline verification.

## Rollback And Manual Recovery

Patch 9F-2H needs no rollback because it performs no DB mutation.

Future execution rollback policy:

- External LLM calls cannot be rolled back.
- Content draft mutation rollback should preserve the prior draft hash/snapshot if regeneration is allowed.
- Unknown or partial results should stop before mutation whenever possible.
- If content mutation occurs but later checks fail, mark the run `manual_review_required` and keep the item not publishable.
- Do not publish, schedule, or write to Blogger as part of draft-generation rollback.

## Relationship To Operator Approval Persistence

This design consumes the approval model proposed in `documents/15_OPERATOR_APPROVAL_PERSISTENCE_DESIGN.md`.

Approval persistence and draft-generation execution remain separate:

- approval persistence can approve a future operation
- execution gate verifies that approval
- execution gate does not create or silently repair approval state
- stale, revoked, superseded, or mismatched approvals block execution

## Open Questions

- Should readiness approval and execution approval be separate purposes from the first implementation?
- Should OpenAI and local LLM execution use the exact same gate, or should local LLM have additional timeout/health constraints?
- Should the first execution mutation write Markdown only, or Markdown plus deterministic HTML?
- Should raw LLM output ever be stored in a redacted audit table, or only in target draft fields after approval?
- Which prompt/input hashes are stable enough for idempotency fingerprints?
- Should transient provider failures allow automatic retry, or require another operator-approved attempt?
