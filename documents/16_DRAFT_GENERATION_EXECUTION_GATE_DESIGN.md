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

## Patch 9F-2Q Final Execution Checklist

Patch 9F-2Q adds the final read-only operator checklist and runbook before prompt-render preview or any later draft-generation execution patch:

- `POST /api/daily-content-plans/draft-generation-final-execution-checklist`
- `/settings/blogger` section `초안 생성 최종 실행 체크리스트`
- checklist mode `read_only_draft_generation_final_execution_checklist`

The checklist consolidates target fixture state, persisted operator approval, dry-run planner, LLM provider readiness, health-check preview, health-check execution gate, remaining blockers, pass/blocked/caution items, and safe next steps. It keeps `executionAllowed=false` and `finalDraftGenerationAllowed=false`.

It does not render prompts, run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, generate draft content, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.

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

## Patch 9F-2R Prompt Render Preview Gate

Patch 9F-2R is the read-only prompt preview gate after the final execution checklist.

- It renders deterministic prompt sections from Daily Content Plan metadata, the linked content fixture metadata, safe blog/brand context, operation policy, and content policy.
- It does not use existing `draftMarkdown` or `draftHtml` as prompt source material.
- It does not store the prompt, call any LLM/provider, run provider health checks, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- It keeps `executionAllowed=false` and `finalDraftGenerationAllowed=false` with the existing feature flag, confirmation phrase, and idempotency blockers.
- It exposes prompt version, section summaries, bounded full preview, SHA-256 hash, estimated tokens, redaction summary, and no-side-effect summary for operator review.
- Non-preview modes are blocked with `draft_generation_prompt_render_preview_is_preview_only`.

Next candidate gate:

- `9F-2S — Draft-generation prompt quality checklist preview, no LLM/no content mutation`

## Patch 9F-2S Prompt Quality Checklist Gate

Patch 9F-2S is the static quality checklist gate after prompt render preview.

- It reuses the 9F-2R prompt render preview in memory and evaluates static categories such as target context, required sections, safety policy, SEO structure, reader value, output contract, redaction safety, length/token budget, and execution safety.
- It does not run an LLM judge/evaluator, call any provider, run provider health checks, store prompt text, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- It keeps `executionAllowed=false` and `finalDraftGenerationAllowed=false` even when the static quality gate passes.
- It returns pass/warn/fail counts, category status, remediation text, forbidden scan summary, and side-effect summary for operator review.
- Non-preview modes are blocked with `draft_generation_prompt_quality_checklist_preview_is_preview_only`.

Next candidate gate:

- `9F-2T — Draft-generation LLM request envelope preview, no provider call/no content mutation`

## Patch 9F-2T Request Envelope Preview Gate

Patch 9F-2T is the read-only request envelope preview gate after the prompt quality checklist.

- It builds the future LLM request envelope shape in memory only from the sanitized 9F-2R prompt preview, 9F-2S prompt quality result, and 9F-2N safe provider/model readiness metadata.
- It exposes only safe route/provider/model metadata, endpoint category, header names without values, payload shape, prompt hash/length/token estimate, model parameters, idempotency requirements, and dispatch blockers.
- It does not store the request envelope, send it to a provider, run provider health checks, call any LLM, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- It keeps `requestEnvelopeStored=false`, `requestWouldBeSent=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, `executionAllowed=false`, and `finalDraftGenerationAllowed=false`.
- Non-preview modes are blocked with `draft_generation_llm_request_envelope_preview_is_preview_only`.

Next candidate gate:

- `9F-2U — Draft-generation LLM dispatch gate preview, no provider call/no content mutation`

## Patch 9F-2U Dispatch Gate Preview

Patch 9F-2U is the read-only dispatch gate preview after the request envelope preview.

- It reuses the 9F-2T request envelope preview and evaluates target, approval, prompt, request envelope, provider route, provider health, final execution checklist, feature flag, confirmation, idempotency, and side-effect policy gates.
- It keeps provider health check satisfaction false unless a later persistence mechanism proves otherwise.
- It keeps confirmation phrase and idempotency key absent in preview mode.
- It does not create a dispatch execution route, store a request envelope, send a request, call a provider, run provider health checks, call any LLM, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- It keeps `dispatchAllowedNow=false`, `dispatchWouldBeBlocked=true`, `requestSentToProvider=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, `executionAllowed=false`, and `finalDraftGenerationAllowed=false`.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_gate_preview_is_preview_only`.

Next candidate gate:

- `9F-2V — Draft-generation LLM dispatch audit schema design, no migration/no provider call/no content mutation`

## Patch 9F-2V Dispatch Audit Schema Design

Patch 9F-2V is the design-only audit schema step after the dispatch gate preview.

- It proposes future `blog_daily_content_llm_dispatch_attempts`, `blog_daily_content_llm_dispatch_events`, and optional `blog_daily_content_llm_dispatch_artifacts` storage.
- It defines safe attempt fields, append-only event fields, redacted artifact metadata, indexes, foreign keys, and idempotency unique constraints.
- It requires raw idempotency keys to stay out of storage; only hashes may be stored.
- It keeps raw secrets, raw tokens, raw provider request bodies, raw provider response bodies, authorization header values, full prompts, and full candidates out of default persistence.
- It does not modify `prisma/schema.prisma`, create a migration, apply a migration, create rows, store request envelopes, call providers, run health checks, call any LLM, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- It keeps `schemaModified=false`, `migrationCreated=false`, `migrationApplied=false`, `dbWrite=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, `executionAllowed=false`, and `finalDraftGenerationAllowed=false`.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_audit_schema_design_is_preview_only`.

Next candidate gate:

- `9F-2W — LLM dispatch audit schema scaffold, no apply/no provider call/no content mutation`

## Patch 9F-2W Dispatch Audit Schema Scaffold

Patch 9F-2W is the file-level scaffold step after the dispatch audit schema design.

- It adds Prisma schema models for future dispatch attempts, events, and redacted/hash-only artifacts.
- It adds migration scaffold `prisma/migrations/20260620000300_add_llm_dispatch_audit_schema/migration.sql`.
- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-schema-scaffold-preview` for read-only scaffold status.
- It keeps the migration unapplied; DB `to_regclass` checks for the three audit tables should remain null during 9F-2W.
- It keeps `executionAllowed=false`, `finalDraftGenerationAllowed=false`, `migrationApplied=false`, `dbWrite=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, and `contentMutationAttempted=false`.
- It does not create audit rows, store request envelopes, store prompts, call providers, run health checks, call any LLM, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_audit_schema_scaffold_preview_is_preview_only`.

Next candidate gate:

- `9F-2W-APPLY — Apply LLM dispatch audit migration only, no rows/no provider call/no content mutation`

## Patch 9F-2W-APPLY Dispatch Audit Migration Apply

Patch 9F-2W-APPLY applies only the 9F-2W migration scaffold.

- It applies migration `20260620000300_add_llm_dispatch_audit_schema` with Prisma migrate deploy.
- It creates the dispatch audit attempt/event/artifact tables in the local DB.
- It keeps all three audit tables empty after migration apply.
- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-migration-apply-readback` for read-only applied-state verification.
- It keeps `executionAllowed=false`, `finalDraftGenerationAllowed=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, `contentMutationAttempted=false`, and `bloggerWriteAttempted=false`.
- It does not create audit rows, store request envelopes, store prompts, call providers, run health checks, call any LLM, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_audit_migration_apply_readback_is_preview_only`.

Next candidate gate:

- `9F-2X — LLM dispatch attempt readback scaffold, no provider call/no content mutation`

## Patch 9F-2X Dispatch Attempt Readback

Patch 9F-2X is the first readback layer after the dispatch audit migration is applied.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-readback`.
- It reads the audit attempt/event/artifact tables and reports global plus target-scoped counts.
- The expected current lifecycle is `not_started` with `emptyState=true`, `latestTargetAttempt=null`, `latestTargetEvent=null`, and `latestTargetArtifact=null`.
- It keeps `executionAllowed=false`, `finalDraftGenerationAllowed=false`, `canCreateAttemptNow=false`, `canDispatchNow=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, and `contentMutationAttempted=false`.
- It does not create attempt rows, create event rows, create artifact rows, store request envelopes, store prompts, call providers, run health checks, call any LLM, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- Non-preview modes remain blocked with `draft_generation_llm_dispatch_attempt_readback_is_preview_only`.

Next candidate gate:

- `9F-2Y — LLM dispatch attempt creation gate preview, no rows/no provider call/no content mutation`

## Patch 9F-2Y Dispatch Attempt Creation Gate Preview

Patch 9F-2Y evaluates whether a future dispatch attempt row could be created, without creating one.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-creation-gate-preview`.
- It reuses 9F-2X readback and 9F-2U dispatch gate metadata.
- It verifies target fixture, audit tables, empty target readback, persisted operator approval, request envelope readiness, feature flags, confirmation phrase, idempotency key, provider health, and side-effect policy.
- It keeps `canCreateAttemptNow=false`, `attemptCreationAllowedInThisPatch=false`, `targetScopedExistingAttempts=0`, `latestTargetAttempt=null`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, and `contentMutationAttempted=false`.
- It does not create attempt rows, create event rows, create artifact rows, store request envelopes, store prompts, call providers, run health checks, call any LLM, create `llm_call_logs`, mutate `content_items`, create drafts, or call Blogger.
- Non-preview modes remain blocked with `draft_generation_llm_dispatch_attempt_creation_gate_preview_is_preview_only`.

Next candidate gate:

- `9F-2Z — Gated LLM dispatch attempt creation persistence, no provider call/no content mutation`

## Patch 9F-2Z Dispatch Attempt Creation Persistence

Patch 9F-2Z is the first guarded DB persistence step after the creation gate preview.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-creation`.
- `mode=preview` reads the same gate/envelope/checklist metadata and reports whether apply would be blocked without creating rows.
- `mode=apply` is allowed only with `BLOG_DAILY_CONTENT_LLM_DISPATCH_ATTEMPT_CREATE_ENABLED=true`, exact confirmation phrase, idempotency key, persisted operator approval, valid planned/empty fixture, existing audit tables, and no conflicting target attempt.
- The only allowed write is one `blog_daily_content_llm_dispatch_attempts` row with `attemptStatus=created_pending_dispatch_gate`.
- Duplicate apply with the same idempotency key hash must return the existing row and not create another row.
- Dispatch events/artifacts, provider health checks, provider calls, LLM calls, `llm_call_logs`, content item mutation, draft creation, Blogger write, publish, OAuth reconnect, and token refresh remain disabled.

Next candidate gate:

- `9F-3A — LLM dispatch attempt event creation preview, no provider call/no content mutation`

## Patch 9F-3A Dispatch Attempt Event Creation Preview

Patch 9F-3A previews the first audit event for the existing dispatch attempt.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-event-preview`.
- It reads the latest target attempt and constructs a candidate event with `eventType=dispatch_attempt_created` and `eventStatus=recorded_audit_only`.
- It keeps `eventCreationAllowedInThisPatch=false`, `eventInsertAttempted=false`, `auditRowsCreatedNow=false`, and `auditRowsMutatedNow=false`.
- Attempts/events/artifacts counts remain `1 / 0 / 0`.
- Provider calls, LLM calls, `llm_call_logs`, content mutation, draft creation, Blogger write, OAuth reconnect, and token refresh remain disabled.

Next candidate gate:

- `9F-3B — Gated LLM dispatch attempt event creation persistence, no provider call/no content mutation`

## Patch 9F-3B Dispatch Attempt Event Creation Persistence

Patch 9F-3B persists the first audit event row for the existing dispatch attempt.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-event-creation`.
- `mode=preview` reports the event creation gate without inserting rows.
- `mode=apply` is allowed only with `BLOG_DAILY_CONTENT_LLM_DISPATCH_EVENT_CREATE_ENABLED=true`, exact confirmation phrase, idempotency key, a ready candidate event, and no existing target event.
- The only allowed write is one event row with `eventType=dispatch_attempt_created` and `eventStatus=recorded_audit_only`.
- Attempts/events/artifacts counts move to `1 / 1 / 0` only after the gated apply smoke.
- Artifact creation, provider calls, LLM calls, `llm_call_logs`, content mutation, draft creation, Blogger write, OAuth reconnect, and token refresh remain disabled.

Next candidate gate:

- `9F-3C — LLM dispatch audit artifact preview, no provider call/no content mutation`

## Patch 9F-3C Dispatch Audit Artifact Preview

Patch 9F-3C previews a hash-only artifact for the existing dispatch attempt.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-artifact-preview`.
- It reads latest attempt/event metadata and constructs a `prompt_request_hash_bundle` candidate artifact.
- It keeps `artifactCreationAllowedInThisPatch=false`, `artifactInsertAttempted=false`, `auditRowsCreatedNow=false`, and `auditRowsMutatedNow=false`.
- Attempts/events/artifacts counts remain `1 / 1 / 0`.
- Artifact persistence, provider calls, LLM calls, `llm_call_logs`, content mutation, draft creation, Blogger write, OAuth reconnect, and token refresh remain disabled.

Next candidate gate:

- `9F-3D — Gated LLM dispatch audit artifact persistence, no provider call/no content mutation`

## Patch 9F-3D Dispatch Audit Artifact Persistence

Patch 9F-3D persists the first hash-only artifact row for the existing dispatch attempt.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-artifact-creation`.
- `mode=preview` reports artifact creation gate metadata without inserting rows.
- `mode=apply` is allowed only with `BLOG_DAILY_CONTENT_LLM_DISPATCH_ARTIFACT_CREATE_ENABLED=true`, exact confirmation phrase, idempotency key, a ready candidate artifact, and no duplicate target artifact.
- The only allowed write is one artifact row with `artifactKind=prompt_request_hash_bundle`, `artifactStorageMode=hash_only`, and `artifactRedactionStatus=redacted_or_hash_only`.
- Attempts/events/artifacts counts move to `1 / 1 / 1` only after the gated apply smoke.
- Provider health checks, provider calls, LLM calls, `llm_call_logs`, content mutation, draft creation, Blogger write, OAuth reconnect, and token refresh remain disabled.

Next candidate gate:

- `9F-3E — Provider health-check positive gated run`

## Patch 9F-3E Provider Health-Check Positive Run

Patch 9F-3E runs only the provider health-check gate.

- It reuses `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-execution`.
- It accepts `BLOG_DAILY_CONTENT_LLM_PROVIDER_HEALTHCHECK_EXECUTE_ENABLED=true` as the worklist feature flag alias.
- The only allowed external side effect is one metadata/connectivity health-check network call.
- Completion/chat/generate/responses calls, `llm_call_logs`, content mutation, draft creation, Blogger write, OAuth reconnect, and token refresh remain disabled.
- Attempts/events/artifacts counts remain `1 / 1 / 1`.

Next candidate gate:

- `9F-3F — Provider health-check audit/readback`

## Patch 9F-3F Provider Health-Check Readback

Patch 9F-3F reads provider health-check audit/gate state without executing another health-check.

- It adds `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-readback`.
- It reads the latest dispatch attempt, target-scoped audit counts, persisted health-check reference/hash fields, and current health-check execution gate shape.
- It records no new rows and does not convert the 9F-3E transient run into persisted provider result data.
- Provider health-check calls, completion/chat/generate/responses calls, `llm_call_logs`, content mutation, draft creation, Blogger write, OAuth reconnect, and token refresh remain disabled.
- Attempts/events/artifacts counts remain `1 / 1 / 1`.

Next candidate gate:

- `9F-3G — LLM dispatch final preflight`

## Patch 9F-3G LLM Dispatch Final Preflight

Patch 9F-3G aggregates the final pre-dispatch checks without executing dispatch.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-final-preflight`.
- It reads audit attempt/event/artifact readiness, prompt quality, request envelope readiness, provider readiness, provider health-check readback, idempotency policy, and confirmation policy.
- It keeps `dispatchExecutionAllowedInThisPatch=false`, `readyForLlmDispatchExecution=false`, and does not create a plan lock.
- Provider health-check calls, provider network calls, completion/chat/generate/responses calls, `llm_call_logs`, content mutation, draft creation, Blogger write, OAuth reconnect, and token refresh remain disabled.
- Attempts/events/artifacts counts remain `1 / 1 / 1`.

Next candidate gate:

- `9F-3H — LLM dispatch execution plan lock`

## Patch 9F-3H LLM Dispatch Execution Plan Lock

Patch 9F-3H computes a deterministic plan lock candidate without persisting it.

- It adds `POST /api/daily-content-plans/draft-generation-llm-dispatch-execution-plan-lock`.
- It reads the 9F-3G final preflight result and derives a stable lock envelope/hash.
- It keeps `lockPersistenceAllowedInThisPatch=false`, `lockPersistedNow=false`, and `dispatchExecutionAllowedInThisPatch=false`.
- Provider health-check calls, provider network calls, completion/chat/generate/responses calls, `llm_call_logs`, content mutation, draft creation, Blogger write, OAuth reconnect, and token refresh remain disabled.
- Attempts/events/artifacts counts remain `1 / 1 / 1`.

Next candidate gate:

- `9F-3I — Gated single LLM dispatch, no content mutation`

## Patch 9F-3I Gated Single LLM Dispatch

Patch 9F-3I executes at most one content-draft provider dispatch after all prior gates have passed.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-execution`.
- Default `preview` mode is read-only and is the only mode exposed from `/settings/blogger`.
- `execute` mode requires the dedicated feature flag, exact confirmation phrase, idempotency key, current lock hash match, plan lock readiness, final preflight readiness, route/model/provider readiness, and a latest dispatch attempt with no prior provider/LLM call.
- Success writes only dispatch audit metadata: one `llm_call_logs` row, one provider response event, one hash-only response artifact, and one attempt update.
- Failure writes only safe failed dispatch audit metadata and a failed `llm_call_logs` row.
- It never writes generated markdown/html into `content_items`, never changes item status/timestamps/quality score, and never calls Blogger/OAuth/token refresh.
- Raw prompts, raw provider response body/header, full generated candidate, secrets, and tokens remain unstored and unreturned.

Next candidate gate:

- `9F-3J — LLM dispatch result readback and no-content-mutation verification`

## Patch 9F-3J LLM Dispatch Response Readback

Patch 9F-3J verifies the 9F-3I result through safe audit readback only.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-response-readback`.
- It reads the latest attempt, redacted response event, hash-only response artifact, dispatch `llm_call_logs` metadata, and linked content item snapshot lengths.
- It checks response hash and length consistency across event/log/artifact safe metadata.
- It does not call the provider, create `llm_call_logs`, mutate audit rows, mutate content, write Blogger, reconnect OAuth, or refresh tokens.
- It returns no raw prompt, raw response body/header, full generated candidate, request body, API key, token, secret, or encrypted value.

Next candidate gate:

- `9F-3K — LLM output quality validation preview`

## Patch 9F-3K LLM Output Quality Validation Preview

Patch 9F-3K introduces deterministic output validation readiness without claiming to validate unavailable content.

- Route: `POST /api/daily-content-plans/draft-generation-llm-output-quality-validation-preview`.
- It reads the 9F-3J response readback and reports whether full Markdown candidate validation can run.
- Since 9F-3I stores only hash/length metadata, full Markdown candidate text is unavailable and the content checks are blocked.
- It surfaces Markdown structure, Korean readability, SEO headings, policy forbidden phrases, CTA/FAQ, and Blogger compatibility checks as blocked until candidate text artifact policy is approved.
- It does not call the provider, use an LLM judge, create `llm_call_logs`, mutate audit rows, mutate content, write Blogger, reconnect OAuth, or refresh tokens.
- It returns no raw prompt, raw response body/header, full generated candidate, request body, API key, token, secret, or encrypted value.

Next candidate gate:

- `9F-3L — Gated output validation persistence`

## Patch 9F-3L Gated Output Validation Persistence

Patch 9F-3L adds a gated local audit persistence path for the 9F-3K validation preview.

- Route: `POST /api/daily-content-plans/draft-generation-llm-output-validation-persistence`.
- Default preview mode returns the event/artifact candidate and blockers without DB write.
- Apply mode requires feature flag, exact confirmation phrase, idempotency key, validation candidate readiness, and duplicate artifact checks.
- Apply can create one redacted validation event and one hash-only validation artifact.
- `/settings/blogger` exposes preview only.
- It does not call the provider, use an LLM judge, create `llm_call_logs`, mutate content, write Blogger, reconnect OAuth, or refresh tokens.
- It returns no raw prompt, raw response body/header, full generated candidate, request body, API key, token, secret, or encrypted value.

Next candidate gate:

- `9F-3M — Markdown candidate acceptance gate`

## Patch 9F-3M Markdown Candidate Acceptance Gate

Patch 9F-3M determines whether a generated Markdown candidate can proceed toward draft persistence.

- Route: `POST /api/daily-content-plans/draft-generation-markdown-candidate-acceptance-gate`.
- It reads validation readiness and linked content item state.
- Candidate acceptance is currently blocked because no full candidate Markdown text exists and validation is not ready.
- It does not mutate audit rows, create `llm_call_logs`, mutate content, write Blogger, reconnect OAuth, or refresh tokens.
- It returns no raw prompt, raw response body/header, full generated candidate, request body, API key, token, secret, or encrypted value.

Next candidate gate:

- `9F-3N — draftMarkdown mutation gate preview`

## Patch 9F-3N draftMarkdown Mutation Gate Preview

Patch 9F-3N previews the first future content mutation without performing it.

- Route: `POST /api/daily-content-plans/draft-markdown-mutation-gate-preview`.
- It reads Markdown candidate acceptance and current content item lengths.
- It is blocked while no accepted Markdown candidate exists.
- It does not return the proposed draftMarkdown body and does not mutate content.

Next candidate gate:

- `9F-3O — Gated draftMarkdown persistence`

## Patch 9F-3O-prep Candidate Text Artifact Policy

Patch 9F-3O-prep blocks direct `draftMarkdown` persistence until a controlled candidate text artifact exists.

- Route: `POST /api/daily-content-plans/draft-generation-candidate-text-artifact-policy`.
- It requires the future persistence path to source text from an explicit `llm_candidate_markdown_text` artifact, not from hash-only response metadata.
- It reports `canProceedTo9F3O=false` when candidate text is missing.
- It does not call a provider, create `llm_call_logs`, mutate audit rows, mutate content, write Blogger, reconnect OAuth, or refresh tokens.

Next candidate gate:

- `9F-3I-R1 — gated redispatch with candidate text artifact`, or an explicitly approved manual candidate text import path.

## Patch 9F-3I-R1 Candidate Text Redispatch

Patch 9F-3I-R1 creates the missing controlled Markdown candidate artifact through a separate gated redispatch path.

- Route: `POST /api/daily-content-plans/draft-generation-candidate-text-redispatch`.
- Default preview mode is read-only.
- Execute mode requires feature flag, exact confirmation phrase, idempotency key, operator approval, linked fixture planned/no-draft state, and LLM route/model readiness.
- It may create a new redispatch attempt and controlled candidate artifact, but it does not write `content_items`.
- After success, output validation and mutation preview can use the artifact hash/length while still withholding the full body from responses.

Next candidate gate:

- `9F-3O — Gated draftMarkdown persistence` after candidate policy, validation, acceptance, and mutation preview pass.

## Patch 9F-3O Gated draftMarkdown Persistence

Patch 9F-3O is the first `content_items` content mutation in the daily queue path.

- Route: `POST /api/daily-content-plans/draft-markdown-persistence`.
- Preview mode is read-only.
- Apply mode requires feature flag, exact confirmation phrase, idempotency key, expected candidate hash, controlled candidate artifact, mutation gate readiness, and an empty planned content item.
- The only allowed mutation is `content_items.draftMarkdown`.
- `draftHtml`, status, quality score, publish timestamps, audit rows, LLM calls, Blogger writes, OAuth reconnect, and token refresh remain disabled.
- The approved 9F-3O apply persisted candidate artifact `cmr241dl40009iwkn78t0brg7` with SHA-256 `fb5fa8203eb830abd03b2d77dd52d70694f888a61882bd76f42932ad903c44b0`.
- After apply, duplicate persistence is blocked because the target content item already has `draftMarkdown`.

Next candidate gate:

- `9F-3P — draftHtml conversion preview`.

## Patch 9F-3P draftHtml Conversion Preview

Patch 9F-3P previews the next content transformation after `draftMarkdown` persistence.

- Route: `POST /api/daily-content-plans/draft-html-conversion-preview`.
- It reads saved `content_items.draftMarkdown` and renders a deterministic Blogger-ready HTML preview with the existing blog post template renderer.
- It does not write `content_items.draftHtml`.
- It blocks readiness if the linked plan item/content item do not match, the content item is not `planned`, saved `draftMarkdown` is missing, `draftHtml` is already present, or the renderer validation fails.
- Full preview HTML is opt-in via `includePreviewHtml=true`; the default response exposes safe hash/length/validation metadata only.
- LLM calls, provider calls, dispatch audit row mutations, Blogger writes, OAuth reconnect, token refresh, publish/schedule, and content mutations remain disabled.

Next candidate gate:

- `9F-3Q — gated draftHtml persistence`.

## Patch 9F-3Q Gated draftHtml Persistence

Patch 9F-3Q performs the approved HTML field mutation after the deterministic conversion preview.

- Route: `POST /api/daily-content-plans/draft-html-persistence`.
- Preview mode is read-only.
- Apply mode requires feature flag, exact confirmation phrase, idempotency key, expected preview HTML hash, 9F-3P readiness, and an empty planned `draftHtml` target.
- The server recomputes the preview HTML and does not trust a caller-supplied HTML body.
- The only allowed mutation is `content_items.draftHtml`.
- `draftMarkdown`, status, quality score, publish timestamps, audit rows, LLM calls, Blogger writes, OAuth reconnect, and token refresh remain disabled.

Next candidate gate:

- `9F-3R — saved draftHtml readiness readback`.

## Patch 9F-3R Saved draftHtml Readiness Readback

Patch 9F-3R verifies the post-HTML-persistence state before approval refresh.

- Route: `POST /api/daily-content-plans/saved-draft-html-readiness-readback`.
- It recomputes HTML quality, publish readiness, and Blogger draft payload readiness from saved `draftHtml`.
- It returns safe summaries only; full Markdown/HTML bodies are not returned.
- It does not mutate content, audit rows, Blogger state, OAuth state, or token state.
- It does not call LLM/provider or Blogger APIs.

Next candidate gate:

- `9F-3S — Blogger draft payload approval refresh`.

## Patch 9F-3R-FIX1 Saved draftHtml Finance-Risk Repair Preview

Patch 9F-3R-FIX1 repairs the blocker discovered by 9F-3R without writing content.

- Route: `POST /api/daily-content-plans/draft-html-finance-risk-repair-preview`.
- It scans saved `draftHtml` for finance risky phrases and builds a deterministic replacement candidate.
- It does not persist the candidate HTML.
- It reports before/after quality summaries and safe candidate hash/length metadata.
- LLM calls, Blogger calls, audit mutations, and content mutations remain disabled.

Next candidate gate:

- `9F-3R-FIX2 — gated finance-risk repaired draftHtml persistence`.

## Patch 9F-3R-FIX2 Gated Finance-Risk Repaired draftHtml Persistence

Patch 9F-3R-FIX2 applies the deterministic repair candidate from 9F-3R-FIX1.

- Route: `POST /api/daily-content-plans/draft-html-finance-risk-repair-persistence`.
- Preview mode is read-only.
- Apply mode requires feature flag, exact confirmation phrase, idempotency key, expected current `draftHtml` hash, expected candidate HTML hash, repair preview readiness, and planned content item.
- The server recomputes the repair candidate and does not trust caller-supplied HTML.
- The only allowed mutation is `content_items.draftHtml`.
- `draftMarkdown`, status, quality score, publish timestamps, audit rows, LLM calls, Blogger calls, OAuth reconnect, and token refresh remain disabled.
- Approved one-time apply updated the saved HTML from hash `dd89e256aa4af32cf34e79f77b8309a32b1624cb0fdb0b76b6318f7d8b91a96d` to `a6c57bbefe1788d82f7030ee92c71a034211f139c274f992ff4c7a331d7531c2`.
- Post-apply readiness readback confirms the finance-risk required check is cleared, while draft payload readiness is still blocked by blog profile/Blogger target setup.

Next candidate gate:

- Resolve the remaining draft payload blockers before moving to a refreshed Blogger approval gate.

## Patch 9F-3R-FIX3 Draft Payload Blocker Diagnosis

Patch 9F-3R-FIX3 explains the remaining blockers after finance-risk repair.

- Route: `POST /api/daily-content-plans/draft-payload-blocker-diagnosis`.
- It is read-only and reuses saved draftHtml readiness readback.
- It maps blockers such as `blog_profile_missing`, `blogger_connection_not_configured`, `manual_approval`, and `draft_payload_not_ready` to safe next actions.
- It lists safe Blog/Blogger target candidates without returning secrets, tokens, encrypted values, full Markdown, or full HTML.
- It may propose a future mutation preview for `content_items.blogId`, but does not perform that mutation.

Next candidate gate:

- `9F-3R-FIX4 — gated daily content item Blog target assignment`.
