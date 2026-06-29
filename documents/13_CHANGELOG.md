# 13_CHANGELOG

## Patch 9F-2T Draft-generation LLM Request Envelope Preview

Implemented after Patch 9F-2S:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-request-envelope-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-request-envelope-preview`.
- Added `/settings/blogger` `초안 생성 LLM request envelope preview` UI readback.
- The preview reuses the 9F-2R prompt render preview, 9F-2S prompt quality checklist, and 9F-2N provider readiness metadata.
- The response reports `patchVersion=9F-2T`, `previewMode=read_only_draft_generation_llm_request_envelope_preview`, `dryRunOnly=true`, `requestEnvelopeBuiltForPreview=true`, `requestEnvelopeStored=false`, `requestWouldBeSent=false`, `llmCallAttempted=false`, `providerNetworkCallAttempted=false`, `providerHealthCheckAttempted=false`, and `contentMutationAttempted=false`.
- The envelope preview exposes only safe route/provider/model metadata, endpoint category, header names with values hidden, payload shape, prompt hash/length/token estimate, model parameters, dispatch blockers, and no-side-effect flags.
- Non-preview modes are blocked with `draft_generation_llm_request_envelope_preview_is_preview_only`.

Policy:

- 9F-2T did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2T did not create, update, or delete business rows.
- 9F-2T did not modify `prisma/schema.prisma` or create a migration.
- 9F-2T did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, OAuth tokens, provider request values, response bodies, or raw provider responses.
- 9F-2T did not run LLM evaluator/judge calls, provider health checks, provider network calls, LLM provider calls, request storage, prompt storage, `llm_call_logs` creation, draft generation, `content_items` mutation, Blogger write, publish, schedule, OAuth reconnect, token refresh, publish approval mutation, or publish attempt mutation.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2U — Draft-generation LLM dispatch gate preview, no provider call/no content mutation`.

## Patch 9F-2S Draft-generation Prompt Quality Checklist Preview

Implemented after Patch 9F-2R:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-prompt-quality-checklist-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-prompt-quality-checklist-preview`.
- Added `/settings/blogger` `초안 생성 prompt 품질 체크리스트` UI readback.
- The checklist reuses the 9F-2R prompt render preview in memory and evaluates it with deterministic static rules only.
- The preview reports `patchVersion=9F-2S`, `previewMode=read_only_draft_generation_prompt_quality_checklist_preview`, `dryRunOnly=true`, `promptRenderedForChecklist=true`, `promptStored=false`, `promptSentToLlm=false`, `llmCallAttempted=false`, `providerNetworkCallAttempted=false`, `providerHealthCheckAttempted=false`, and `contentMutationAttempted=false`.
- Quality categories cover target context, required prompt sections, safety and policy, SEO structure, reader value, output contract, redaction/secret safety, length/token budget, and execution safety.
- Non-preview modes are blocked with `draft_generation_prompt_quality_checklist_preview_is_preview_only`.

Policy:

- 9F-2S did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2S did not create, update, or delete business rows.
- 9F-2S did not modify `prisma/schema.prisma` or create a migration.
- 9F-2S did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, OAuth tokens, provider request bodies, response bodies, or raw provider responses.
- 9F-2S did not run LLM evaluator/judge calls, provider health checks, provider network calls, LLM provider calls, prompt storage, `llm_call_logs` creation, draft generation, `content_items` mutation, Blogger write, publish, schedule, OAuth reconnect, token refresh, publish approval mutation, or publish attempt mutation.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2T — Draft-generation LLM request envelope preview, no provider call/no content mutation`.

## Patch 9F-2R Draft-generation Prompt Render Preview

Implemented after Patch 9F-2Q:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-prompt-render-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-prompt-render-preview`.
- Added `/settings/blogger` `초안 생성 prompt preview` UI readback.
- The preview renders deterministic, bounded prompt sections for the linked daily content fixture so an operator can inspect the future LLM instruction before any execution patch.
- The preview reports `patchVersion=9F-2R`, `previewMode=read_only_draft_generation_prompt_render_preview`, `dryRunOnly=true`, `promptRenderedForPreview=true`, `promptStored=false`, `llmCallAttempted=false`, `providerNetworkCallAttempted=false`, `providerHealthCheckAttempted=false`, and `contentMutationAttempted=false`.
- The prompt preview exposes safe section text, char length, estimated token count, SHA-256 hash, redaction summary, and a truncated full prompt preview.
- Non-preview modes are blocked with `draft_generation_prompt_render_preview_is_preview_only`.

Policy:

- 9F-2R did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2R did not create, update, or delete business rows.
- 9F-2R did not modify `prisma/schema.prisma` or create a migration.
- 9F-2R did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, OAuth tokens, provider request bodies, response bodies, or raw provider responses.
- 9F-2R did not run provider health checks, make provider network calls, call LLM providers, store prompts, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2S — Draft-generation prompt quality checklist preview, no LLM/no content mutation`.

## Patch 9F-2Q Draft-generation Final Execution Checklist

Implemented after Patch 9F-2P:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-final-execution-checklist.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-final-execution-checklist`.
- Added `/settings/blogger` `초안 생성 최종 실행 체크리스트` UI readback.
- The checklist aggregates the daily plan/fixture state, persisted operator approval, 9F-2M dry-run planner, 9F-2N LLM readiness, 9F-2O health-check preview, 9F-2P health-check execution gate, remaining blockers, and operator runbook.
- The preview keeps `executionAllowed=false`, `finalDraftGenerationAllowed=false`, `llmCompletionAttempted=false`, `promptRendered=false`, `providerNetworkCallAttempted=false`, `contentMutationAttempted=false`, and `bloggerWriteAttempted=false`.
- Non-preview modes are blocked with `draft_generation_final_execution_checklist_is_preview_only`.

Policy:

- 9F-2Q did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2Q did not create, update, or delete business rows.
- 9F-2Q did not modify `prisma/schema.prisma` or create a migration.
- 9F-2Q did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, provider request bodies, prompt text, response bodies, or raw provider responses.
- 9F-2Q did not run provider health checks, make provider network calls, call LLM providers, render/store prompts, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2R — Draft-generation prompt render preview, no LLM/no content mutation`.

## Patch 9F-2P Gated LLM Provider Health-check Execution

Implemented after Patch 9F-2O:

- Added helper `src/lib/daily-content-plans/draft-generation-llm-provider-health-check-execution.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-execution`.
- Added `/settings/blogger` `초안 생성 LLM health-check 실행 게이트` UI readback.
- The route reuses the 9F-2O preview/readiness path and adds a gated provider health-check execution policy.
- Default `preview` and blocked `healthcheck_execute` smoke keep `healthCheckExecuted=false`, `providerNetworkCallAttempted=false`, `llmCompletionAttempted=false`, `promptRendered=false`, `promptStored=false`, and all mutation side effects false.
- Future positive execution requires `BLOG_DAILY_CONTENT_LLM_PROVIDER_HEALTHCHECK_EXECUTION_ENABLED=true`, `BLOG_DAILY_CONTENT_LLM_PROVIDER_NETWORK_CALLS_ENABLED=true`, the exact confirmation phrase, and an idempotency key.
- Completion/chat/generate/responses endpoints remain forbidden; only safe provider metadata/version/tags/models/health endpoint categories may be used by a future explicitly approved health-check.
- Unsupported modes are blocked with `draft_generation_llm_provider_health_check_execution_mode_not_allowed`.

Policy:

- 9F-2P did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2P did not create, update, or delete business rows during default validation.
- 9F-2P did not modify `prisma/schema.prisma` or create a migration.
- 9F-2P did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, provider request bodies, prompt text, response bodies, or raw provider responses.
- 9F-2P default validation did not run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2Q — Draft-generation final execution checklist and operator runbook, no LLM completion/no content mutation`.
- Alternative next patch after explicit approval: `9F-2P-LIVE-VERIFY — Execute one gated provider health-check only, no completion/no content mutation`.

## Patch 9F-2O LLM Provider Health-check Preview

Implemented after Patch 9F-2N:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-provider-health-check-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-preview`.
- Added `/settings/blogger` `초안 생성 LLM health-check preview` UI readback.
- The preview reuses the 9F-2N provider/model readiness response and shows the future provider health-check contract without executing it.
- The preview reports `healthCheckPreviewMode=read_only_llm_provider_health_check_preview`, `dryRunOnly=true`, `providerHealthCheckAttempted=false`, `providerNetworkCallAttempted=false`, `llmCompletionAttempted=false`, `promptRendered=false`, and `rawPromptStored=false`.
- `mode=healthcheck_preview` remains gated/blocked with health-check feature flag, confirmation phrase, idempotency, completion-disabled, and content-mutation-disabled blockers.
- Unsupported modes are blocked with `draft_generation_llm_provider_health_check_preview_is_preview_only`.

Policy:

- 9F-2O did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2O did not create, update, or delete business rows.
- 9F-2O did not modify `prisma/schema.prisma` or create a migration.
- 9F-2O did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, provider request bodies, prompt text, or raw provider responses.
- 9F-2O did not run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2P — Gated LLM provider health-check execution, no completion/no content mutation`.
- Alternative next patch: `9F-2Q — Draft-generation execution readiness checklist polish, no call/no mutation`.

## Patch 9F-2N LLM Provider Execution Readiness Preview

Implemented after Patch 9F-2M:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-provider-readiness.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-provider-readiness`.
- Added `/settings/blogger` `초안 생성 LLM 준비상태` UI readback.
- The readiness preview reads the existing `content_draft` Task Route plus safe provider/model metadata and env presence booleans.
- The preview keeps `operatorApprovalSatisfied=true`, `executionAllowed=false`, and the existing five execution blockers.
- The preview reports route resolution, provider kind/enabled state, model candidate status, missing env names, readiness blockers/warnings, and side-effect summary.
- Non-preview modes are blocked with `draft_generation_llm_provider_readiness_is_preview_only`.

Policy:

- 9F-2N did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2N did not create, update, or delete business rows.
- 9F-2N did not modify `prisma/schema.prisma` or create a migration.
- 9F-2N did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, provider request bodies, or raw provider responses.
- 9F-2N did not run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2O — LLM provider health-check preview for draft generation, no LLM completion/no content mutation`.
- Alternative next patch: `9F-2P — Draft-generation execution readiness checklist polish, no call/no mutation`.

## Patch 9F-2M Draft-generation Dry-run Planner

Implemented after Patch 9F-2L:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-dry-run-planner.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-dry-run-planner`.
- Added `/settings/blogger` `초안 생성 dry-run 계획` UI readback.
- The planner reuses the post-approval execution gate state and shows persisted operator approval, linked fixture status, remaining execution blockers, input snapshot plan, prompt structure plan, model candidate plan, future output plan, and current no-side-effect summary.
- Preview for plan item `cmqlr1v1y0001iwj2gpv2875r` shows `operatorApprovalSatisfied=true`, `executionAllowed=false`, resolved blocker `operator_approval_missing`, and remaining blockers for LLM execution, content mutation, draft generation write, confirmation phrase, and idempotency.
- Non-preview modes are blocked with `draft_generation_dry_run_planner_is_preview_only`.

Policy:

- 9F-2M did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2M did not create, update, or delete business rows.
- 9F-2M did not modify `prisma/schema.prisma` or create a migration.
- 9F-2M did not render/store raw prompts, generate drafts, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2N — LLM provider execution readiness check for draft generation, no call/no mutation`.
- Alternative next patch: `9F-2O — Draft-generation dry-run planner UI polish, no LLM/no mutation`.

## Patch 9F-2L Draft-generation Execution Gate Post-approval Preview Polish

Implemented after Patch 9F-2K-APPLY:

- Polished the read-only draft-generation execution gate preview after operator approval persistence.
- Added explicit post-approval summary fields showing `operatorApprovalPersisted=true`, the approval id/status/purpose/action, and `operatorApprovalSatisfied=true`.
- Added execution blocker summary fields that separate resolved blockers from remaining blockers.
- Confirmed `operator_approval_missing` is resolved, while execution remains blocked by `llm_execution_feature_flag_disabled`, `content_mutation_feature_flag_disabled`, `draft_generation_write_feature_flag_disabled`, `confirmation_phrase_missing`, and `idempotency_key_missing`.
- Added a next-safe-step summary pointing to `9F-2M — Draft-generation dry-run planner, no LLM/no content mutation`.
- Polished `/settings/blogger` so the operator sees `운영자 승인 저장됨 · 실행 차단 유지`, approval id/status, remaining Korean blocker labels, resolved blocker labels, and no-side-effect details.
- Polished operator approval preview/readback so it clearly says approval is stored but draft-generation execution is still blocked.

Policy:

- 9F-2L did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2L did not create, update, or delete business rows.
- 9F-2L did not modify `prisma/schema.prisma` or create a migration.
- 9F-2L did not create `draftMarkdown` or `draftHtml`, run content generation, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2M — Draft-generation dry-run planner, no LLM/no content mutation`.
- Alternative next patch: `9F-2N — LLM provider execution readiness check for draft generation, no call/no mutation`.

## Patch 9F-2K-APPLY Persist Operator Approval For Draft Generation Gate

Applied after Patch 9F-2K:

- Executed the approved 9F-2K apply exactly once after the operator provided the Korean approval phrase.
- Created one operator approval row: `cmqmcs1l10001iwu863doda1s`.
- Created one operator approval event row: `cmqmcs1lg0003iwu8ff4780ll`.
- Approval target: plan item `cmqlr1v1y0001iwj2gpv2875r`, content item `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- Approval state: `approvalPurpose=draft_generation_execution`, `approvalStatus=approved`, `operatorAction=approve_for_draft_generation_execution`, `operatorLabel=초안 생성 실행 승인`.
- Confirmed `operator_approvals_count=1` and `operator_approval_events_count=1`.
- Confirmed post-apply preview reports `existingApprovalFound=true`, `approvalWouldBeCreated=false`, `eventWouldBeCreated=false`, and `dbWrite=false`.
- Confirmed 9F-2J execution gate preview now reports `operatorApprovalSatisfied=true`, removes `operator_approval_missing`, and keeps `executionAllowed=false` because LLM/content mutation/write/confirmation/idempotency gates remain blocked.

Policy:

- 9F-2K-APPLY did not rerun 9F-2B apply, 9F-2D apply, or 9F-2I-APPLY.
- 9F-2K-APPLY did not modify `prisma/schema.prisma` or create a migration.
- 9F-2K-APPLY did not mutate Daily Content Plan rows/items, `content_items`, Blogger tables, operation profiles, publish approvals, publish attempts, or LLM logs.
- 9F-2K-APPLY did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2L — Draft-generation execution gate post-approval preview polish, no LLM/no mutation`.
- Alternative next patch: `9F-2M — Draft-generation dry-run planner, no LLM/no content mutation`.

## Patch 9F-2K Operator Approval Persistence Route

Implemented after Patch 9F-2I-APPLY:

- Added guarded helper `src/lib/daily-content-plans/operator-approval-persistence.ts`.
- Added route `POST /api/daily-content-plans/operator-approvals`.
- Added `/settings/blogger` `운영자 승인 저장` preview/readback UI.
- Updated the 9F-2J execution gate preview to read persisted approval state when the approval tables exist.
- Preview mode reports target integrity, existing approval/event state, whether approval/event would be created, guardrails, and side-effect summary.
- Apply mode is implemented but blocked unless `BLOG_DAILY_CONTENT_OPERATOR_APPROVAL_WRITE_ENABLED=true`, exact confirmation phrase `I_UNDERSTAND_THIS_WILL_PERSIST_OPERATOR_APPROVAL_ONLY`, and expected idempotency key are present.

Initial pending apply state:

- The required Korean approval phrase was not provided in this patch.
- Approved apply was not executed.
- `operator_approvals_count=0`.
- `operator_approval_events_count=0`.
- 9F-2J execution gate preview still reports `operatorApprovalSatisfied=false` and blocker `operator_approval_missing`.

Policy:

- 9F-2K did not modify `prisma/schema.prisma`.
- 9F-2K did not create a Prisma migration.
- 9F-2K did not rerun 9F-2B apply, 9F-2D apply, or 9F-2I-APPLY.
- 9F-2K did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- 9F-2K did not mutate Daily Content Plan rows/items, `content_items`, Blogger tables, operation profiles, publish approvals, publish attempts, or LLM logs.
- Recommended next patch: `9F-2K-APPLY — Persist one operator approval row/event, no generation/no LLM/no content mutation`.
- Alternative next patch: `9F-2K-UI — Operator approval preview UI polish, no mutation`.

## Patch 9F-2I-APPLY Operator Approval Persistence Migration Apply

Implemented after Patch 9F-2J:

- Applied existing migration `20260620000200_add_daily_content_operator_approval_scaffold` exactly once with `prisma migrate deploy`.
- Created DB tables `blog_daily_content_operator_approvals` and `blog_daily_content_operator_approval_events` with indexes and foreign keys from the existing migration draft.
- Confirmed `operator_approvals_count=0` and `operator_approval_events_count=0`.
- Confirmed `npx prisma migrate status` reports the database schema is up to date.
- Confirmed 9F-2J preview now reports approval persistence available while execution remains blocked by missing operator approval and disabled LLM/content mutation/write gates.

Policy:

- 9F-2I-APPLY did not modify `prisma/schema.prisma`.
- 9F-2I-APPLY did not create a new Prisma migration.
- 9F-2I-APPLY did not create, update, or delete business rows.
- 9F-2I-APPLY did not create approval rows or events.
- 9F-2I-APPLY did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2K — Operator approval persistence preview/apply route, approval row only, no generation/no LLM/no content mutation`.
- Alternative next patch: `9F-2K-DESIGN — Operator approval apply guard implementation plan, no code/no mutation`.

## Patch 9F-2J Draft-generation Execution Gate Preview API

Implemented after Patch 9F-2I:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-execution-gate-preview.ts`.
- Added preview-only route `POST /api/daily-content-plans/draft-generation-execution-gate-preview`.
- Added `/settings/blogger` `초안 생성 실행 게이트` UI readback with execution blocked status, structural readiness, approval table migration state, missing requirements, disabled execution buttons, gate layers, canonical blockers, and side-effect summary.
- The preview safely checks pending operator approval table availability with `to_regclass` and does not query the pending approval Prisma models.
- Current preview blocks execution because the 9F-2I migration is pending/unapplied, operator approval is missing, LLM execution flag is disabled, content mutation flag is disabled, draft generation write flag is disabled, confirmation phrase is missing, and idempotency key is missing.

Policy:

- 9F-2J did not modify `prisma/schema.prisma`.
- 9F-2J did not create a Prisma migration.
- 9F-2J did not apply the pending 9F-2I migration.
- Operator approval tables do not exist in the DB yet.
- 9F-2J did not create, update, or delete business rows.
- 9F-2J did not create approval rows or events.
- 9F-2J did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2I-APPLY — Apply operator approval persistence migration, approval tables only, no approval rows`.
- Alternative next patch: `9F-2K — Draft-generation execution gate preview UI polish, no LLM/no mutation`.

## Patch 9F-2I Operator Approval Persistence Scaffold Migration Draft

Implemented after Patch 9F-2H:

- Added Prisma models `BlogDailyContentOperatorApproval` and `BlogDailyContentOperatorApprovalEvent`.
- Added relation arrays from `ContentItem`, `BlogDailyContentPlan`, and `BlogDailyContentPlanItem` to the operator approval scaffold.
- Added one unapplied migration draft at `prisma/migrations/20260620000200_add_daily_content_operator_approval_scaffold/migration.sql`.
- The migration draft creates `blog_daily_content_operator_approvals` and `blog_daily_content_operator_approval_events`, idempotency unique indexes, supporting lookup indexes, and foreign keys.
- Updated Data Model, Operator Approval Persistence Design, Test Plan, LLM Provider Design, Changelog, and Next Session Brief to record the scaffold/no-apply state.

Policy:

- 9F-2I did not apply the migration.
- Operator approval tables do not exist in the DB yet.
- 9F-2I did not create, update, or delete business rows.
- 9F-2I did not create approval rows or events.
- 9F-2I did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2J — Draft-generation execution gate preview API, no LLM/no mutation`.
- Alternative next patch: `9F-2I-APPLY — Apply operator approval persistence migration, approval tables only, no approval rows`.

## Patch 9F-2H Draft-generation Execution Gate Design

Implemented after Patch 9F-2G:

- Added design document `documents/16_DRAFT_GENERATION_EXECUTION_GATE_DESIGN.md`.
- Defined future draft-generation execution gate layers 0 through 8: target integrity, daily plan item link, draft-generation readiness preflight, operator approval persistence, LLM provider/model, content mutation write flags, confirmation/idempotency, post-write readback/reconciliation, and publish isolation.
- Documented future pass conditions, canonical block reasons, feature flags, confirmation phrases, API candidates, run/audit model, idempotency/replay policy, UI proposal, smoke plan, rollback/manual recovery, relationship to operator approval persistence, and open questions.
- Updated Test Plan, LLM Provider Design, Changelog, Next Session Brief, and Operator Approval Persistence Design to point at the proposal.

Policy:

- 9F-2H did not modify `prisma/schema.prisma`.
- 9F-2H did not create a Prisma migration.
- 9F-2H did not create, update, or delete business rows.
- 9F-2H did not persist operator approvals, execution runs, or generation attempts.
- 9F-2H did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2I — Operator approval persistence scaffold migration draft, no apply`.
- Alternative next patch: `9F-2J — Draft-generation execution gate preview API, no LLM/no mutation`.

## Patch 9F-2G Operator Approval Persistence Design

Implemented after Patch 9F-2F:

- Added design document `documents/15_OPERATOR_APPROVAL_PERSISTENCE_DESIGN.md`.
- Proposed future tables `blog_daily_content_operator_approvals` and `blog_daily_content_operator_approval_events`.
- Documented approval purposes, statuses, operator actions, proposed columns, foreign keys, indexes, duplicate prevention strategy, state transitions, future API routes, feature flag, confirmation phrase, smoke plan, rollback plan, and open questions.
- Updated Data Model, Test Plan, LLM Provider Design, Changelog, and Next Session Brief to point at the proposal.

Policy:

- 9F-2G did not modify `prisma/schema.prisma`.
- 9F-2G did not create a Prisma migration.
- 9F-2G did not create, update, or delete business rows.
- 9F-2G did not create approval rows or events.
- 9F-2G did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2H — Draft-generation execution gate design, no LLM/no content mutation`.
- Alternative next patch: `9F-2I — Operator approval persistence scaffold migration draft, no apply`.

## Patch 9F-2F Draft-generation Readiness Preflight

Implemented after Patch 9F-2E:

- Added read-only route `POST /api/daily-content-plans/draft-generation-readiness`.
- Added deterministic draft-generation readiness preflight logic for linked plan item `cmqlr1v1y0001iwj2gpv2875r`.
- The preflight checks linked fixture `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`, fixture existence, linked plan item match, non-published/non-scheduled state, empty `draftMarkdown`, empty `draftHtml`, and disabled generation/publish guardrails.
- Current fixture is structurally ready for future draft generation, but execution readiness remains false.
- Added `/settings/blogger` `초안 생성 준비 점검` UI with operator-friendly status, missing requirements, disabled generation/LLM buttons, and technical side-effect details.
- Non-preflight modes are blocked with `draft_generation_readiness_is_preflight_only`.

Policy:

- 9F-2F did not rerun 9F-2B apply.
- 9F-2F did not rerun 9F-2D apply.
- 9F-2F did not create, update, or delete Daily Content Plan rows, Daily Content Plan item rows, `content_items`, approval rows, publish attempts, or Blogger rows.
- 9F-2F did not create `draftMarkdown` or `draftHtml`.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2G — Operator approval persistence design, schema proposal only, no apply/no mutation`.
- Alternative next patch: `9F-2H — Draft-generation execution gate design, no LLM/no content mutation`.

## Patch 9F-2E Daily Content Queue Operator Approval Workflow Draft

Implemented after Patch 9F-2D:

- Added read-only route `POST /api/daily-content-plans/operator-approval-workflow`.
- Added deterministic queue workflow summary logic for the existing Daily Content Plan fixture.
- Added `/settings/blogger` `운영자 검토 워크플로우` preview UI.
- Item 1 is shown as ready for operator review when linked to fixture `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- Items 2 and 3 are shown as waiting for `content_items` fixtures.
- Approval actions are displayed as disabled/coming-soon only: draft-generation preparation approval, topic hold, and review request.
- Non-preview mode is blocked with `operator_approval_workflow_is_preview_only`.

Policy:

- 9F-2E did not rerun 9F-2B apply.
- 9F-2E did not rerun 9F-2D apply.
- 9F-2E did not create, update, or delete Daily Content Plan rows, Daily Content Plan item rows, `content_items`, approval rows, publish attempts, or Blogger rows.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2F — Draft-generation readiness preflight for linked content item, no LLM/no Blogger write`.
- Alternative next patch: `9F-2G — Operator approval persistence design, schema proposal only, no apply/no mutation`.

## Patch 9F-2D Daily Plan To Content Item Fixture Apply

Implemented after Patch 9F-2C:

- Added guarded route `POST /api/daily-content-plans/content-item-fixture`.
- Added preview/apply summary logic for linking one Daily Content Plan item to one deterministic `content_items` fixture.
- Targeted only plan item `cmqlr1v1y0001iwj2gpv2875r` (`itemOrder=1`, `slotKey=morning_education`) for this patch.
- Added deterministic proposed fixture id `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`, with `mode=memo_expand`, `status=planned`, no generated draft Markdown, no generated HTML, no publish timestamp, and no schedule timestamp.
- Added feature flag and confirmation phrase guards: `BLOG_DAILY_PLAN_CONTENT_ITEM_FIXTURE_WRITE_ENABLED=true` plus `I_UNDERSTAND_THIS_WILL_CREATE_OR_LINK_ONE_CONTENT_ITEM_FIXTURE`.
- Added `/settings/blogger` preview-only fixture status/action affordance for Daily Content Queue rows.
- Executed the approved apply exactly once after the operator provided the Korean approval phrase.
- Created one deterministic content item fixture: `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- Linked only target plan item `cmqlr1v1y0001iwj2gpv2875r` to that fixture.
- Post-apply readback confirmed daily plan rows remained `1`, daily plan item rows remained `3`, and `content_items` count changed from `1` to `2`.
- Other daily plan items remain unlinked.
- After-apply preview confirmed `fixtureAlreadyLinked=true`, `fixtureWouldBeCreated=false`, and `dbWrite=false`.
- Feature-flag-disabled apply-negative remained blocked with `dbWrite=false`.

Policy:

- The only approved business mutation was one deterministic `content_items` fixture insert plus one target daily plan item `contentItemId` update.
- Preview and feature-flag-disabled apply-negative flows remain DB-write-safe after apply.
- This patch did not rerun 9F-2B apply, create/update/delete daily plan rows, mutate other daily plan items, mutate the published 9E content item, run content generation, call LLM providers, run Blogger publish/write/update/draft save/schedule, reconnect OAuth, refresh tokens, mutate publish approvals, mutate publish attempts, deploy, push, or external service writes.
- Do not rerun 9F-2D apply for item `cmqlr1v1y0001iwj2gpv2875r`; the fixture is already linked.
- Recommended next patch: `9F-2E — Daily Content Queue operator approval workflow draft, no generation/no publish execution`.
- Alternative next patch: `9F-2F — Draft-generation readiness preflight for linked content item, no LLM/no Blogger write`.

## Patch 9F-2C Daily Content Plan UI Polish And Queue Dashboard Draft

Implemented after Patch 9F-2B:

- Polished the Daily Content Plan response with additive persisted readback fields for existing plan status, persisted plan id/status, persisted item counts, existing plan summary, and persisted queue item rows.
- Kept the existing API response contract intact while making it easier for `/settings/blogger` to display the already-created 9F-2B fixture.
- Improved future guarded apply summaries so `appliedPlan` and `appliedItemCount` can be populated from transaction results, without rerunning apply in this patch.
- Reworked `/settings/blogger` Daily Content Plan UI into an operator-friendly `오늘 콘텐츠 계획` readback section with Korean status, guardrails, and a draft `후보 큐`.
- The queue shows persisted candidate rows, topic seeds, content intent, slot/status, content item linkage state, approval requirement, and disabled generation/publish/schedule flags.
- Technical details such as blockers, warnings, side-effect summary, guardrail summary, and readback ids are kept behind progressive disclosure.

Policy:

- 9F-2C did not rerun 9F-2B apply.
- 9F-2C did not create, update, or delete Daily Content Plan rows or item rows.
- Counts remained one daily plan row and three daily plan item rows.
- This patch did not run content generation, LLM calls, `content_items` mutation, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The 9E published/success milestone baseline remained unchanged.
- The next recommended patch is `9F-2D — Daily plan to content-item draft fixture, no LLM/no Blogger write`.
- Alternative next patch: `9F-2E — Daily Content Queue operator approval workflow draft, no generation/no publish execution`.

## Patch 9F-2B Create/Apply Daily Content Plan Row

Applied after Patch 9F-2A:

- Created or idempotently confirmed the default Daily Content Plan row for the verified Blogger blog `급등포착`.
- Target Blogger blog: `3065973490356135805` / `https://mathlearningappl.blogspot.com/`.
- Created or idempotently confirmed three deterministic candidate item rows: `morning_education`, `midday_checklist`, and `evening_risk_review`.
- The guarded apply was executed once by the operator with `BLOG_DAILY_CONTENT_PLAN_WRITE_ENABLED=true` and confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_DAILY_CONTENT_PLAN`.
- DB readback confirmed `blog_daily_content_plans_count=1` and `blog_daily_content_plan_items_count=3`.
- Created plan baseline: `planId=cmqlr1v1d0000iwj2smxcsajr`, `planDateLocal=2026-06-20`, `status=draft`, `planKind=daily_auto_content_plan`, `operationMode=approval_required`, and `defaultPublishPolicyPreset=safe_manual_publish`.
- The plan keeps `contentGenerationEnabled=false`, `llmCallEnabled=false`, `publishExecutionEnabled=false`, and `scheduledPublishEnabled=false`.
- All item rows keep `contentItemId=null`, generation/publish flags false, and `requiresHumanApproval=true`.
- After-apply preview confirmed `planWouldBeCreated=false`, `planWouldBeUpdated=true`, `applyAttempted=false`, and `dbWrite=false`.
- Flag-disabled apply-negative smoke confirmed blocker `daily_content_plan_write_feature_flag_disabled`, `applyAttempted=false`, `applyBlocked=true`, `applyOk=false`, and `dbWrite=false`.
- Minor follow-up candidate: the apply API summary returned `appliedPlan=null` and `appliedItemCount=null`, while DB readback confirmed the rows.

Policy:

- This patch performed exactly one allowed business DB mutation in the daily content plan tables before this closeout documentation pass.
- This closeout did not rerun the apply.
- Generation, LLM, publishing, scheduling, Blogger write, OAuth, token, content item, publish approval, and publish attempt mutations remained disabled.
- The 9E published/success milestone baseline remained unchanged.
- The next recommended patch is `9F-2C — Daily Content Plan UI polish and queue dashboard draft`.
- Alternative next patch: `9F-2D — Daily plan to content-item draft fixture, no LLM/no Blogger write`.

## Patch 9F-2A Daily Auto Content Plan Draft Foundation

Implemented after Patch 9F-1F:

- Added `BlogDailyContentPlan` / `blog_daily_content_plans` schema.
- Added `BlogDailyContentPlanItem` / `blog_daily_content_plan_items` schema.
- Added schema-only migration `20260620000100_add_blog_daily_content_plans`.
- Added `POST /api/daily-content-plans/default-plan`.
- Added `DailyContentPlanSummary` with `planVersion=9F-2A` and `planMode=daily_auto_content_plan_draft`.
- Added deterministic/static daily planning metadata preview with three candidate slots: `morning_education`, `midday_checklist`, and `evening_risk_review`.
- Added guarded apply implementation behind `BLOG_DAILY_CONTENT_PLAN_WRITE_ENABLED=true` plus exact confirmation phrase, but validation only performs feature-flag-disabled apply-negative smoke.
- Added `/settings/blogger` Daily Content Plan Preview UI with plan items, guardrails, side-effect summary, and disabled Apply/Create guidance.

Policy:

- This patch added schema/migration only for daily planning and did not execute daily plan business row writes during validation.
- This patch did not create `content_items`, generate article content, call LLM providers, create `llm_call_logs`, run Blogger publish/write/update/draft save/schedule, run OAuth reconnect, run token refresh, mutate publish approvals, mutate publish attempts, deploy, push, or perform external service writes.
- The 9E published/success milestone baseline remained unchanged.
- `blog_operation_profiles_count` remains `1`.
- `blog_daily_content_plans_count = 0` and `blog_daily_content_plan_items_count = 0` after validation.
- The next recommended patch is `9F-2B — Create/Apply Daily Content Plan row, no content generation or publish execution`.
- Alternative next patch: `9F-2C — Daily Content Plan UI polish and queue dashboard draft`.

## Patch 9F-1F Policy Simulation Scenario Matrix

Implemented after Patch 9F-1E:

- Added `operationProfileScenarioMatrixSummary` as an advisory/read-only scenario matrix for Operation Profile policy simulation.
- Added reusable scenario matrix logic for `safe_manual_publish`.
- Added the matrix summary to `POST /api/content-items/[id]/publish-oauth-gate`.
- Added the matrix summary to `POST /api/blog-operation-profiles/default-policy` preview responses.
- Added Content Detail UI for the Publish OAuth Gate scenario matrix, including matrix mode, totals, scenario rows, simulated decisions, blocker counts, and operator takeaways.
- Added `/settings/blogger` Operation Profile scenario matrix preview for synthetic future/planning scenarios.
- Matrix scenarios include `current_published_item`, `future_planned_ready_item`, `future_planned_token_expired`, `profile_missing`, `profile_mismatch`, and `scheduled_publish_requested` when actual gate context is available.
- Direct Operation Profile preview includes the synthetic future/profile/scheduled scenarios and omits the actual current item scenario.
- `operation_profile_policy_*` blockers are simulation-only and remain inside scenario `simulatedAdditionalBlockers`.
- Existing publish blockers, final preflight blockers, guarded publish execution blockers, `canExecutePublish`, `canPublish`, and scheduled publish permissions are unchanged.

Policy:

- Operation Profile remains advisory-only and simulation-only in this patch.
- This patch does not enable auto publish, scheduled publish, retry, recovery, or actual policy-enforced gate behavior.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The next recommended patch is `9F-2A — Daily Auto Content Plan draft, no publish execution`.
- Alternative next patch: `9F-1G — Policy simulation scenario matrix polish and planned-item fixture`.

## Patch 9F-1E Policy-enforced Publish Gate Simulation

Implemented after Patch 9F-1D:

- Added `operationProfilePolicySimulationSummary` as an advisory/read-only dry-run simulation of future Operation Profile policy enforcement.
- Added reusable simulation logic for the stored `safe_manual_publish` policy.
- Added the simulation summary to `POST /api/content-items/[id]/publish-oauth-gate`.
- Added the simulation summary to `POST /api/blog-operation-profiles/default-policy` preview responses.
- Added Content Detail UI for the Publish OAuth Gate simulation summary, including simulated policy state, simulated additional/removed blockers, simulated decision, comparison, notes, and explicit dry-run-only copy.
- Added `/settings/blogger` Operation Profile simulation guidance showing that auto publish and scheduled publish remain disabled while human approval, OAuth/readback/reconciliation guards remain required.
- Current baseline reports `simulationVersion=9F-1E`, `simulationMode=policy_enforcement_dry_run`, `advisoryOnly=true`, `policyEnforced=false`, `actualBlockerImpact=false`, and `actualExecutionPermissionImpact=false`.
- Existing publish blockers, `canExecutePublish`, `canPublish`, scheduled publish permissions, and publish execution semantics are unchanged.
- `operation_profile_policy_*` blockers are simulation-only and are not copied into top-level publish `blockingReasons`.

Policy:

- Operation Profile policy enforcement remains simulation-only in this patch.
- This patch does not enable auto publish, scheduled publish, retry, recovery, or actual policy-enforced gate behavior.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The next recommended patch is `9F-1F — Policy simulation UX refinement and scenario matrix`.
- Alternative next patch: `9F-2A — Daily Auto Content Plan draft, no publish execution`.

## Patch 9F-1D Operation Profile Exception Dashboard Draft

Implemented after Patch 9F-1C:

- Added `operationProfileExceptionDashboardSummary` as an advisory/read-only exception-only dashboard draft.
- Added reusable dashboard summary logic that turns `operationProfileAdvisorySummary` into focus items, collapsed normal items, a compact policy snapshot, attention level, headline, and operator summary.
- Added the dashboard summary to `POST /api/content-items/[id]/publish-oauth-gate`.
- Added the dashboard summary to `POST /api/blog-operation-profiles/default-policy` preview responses without changing the existing profile summary contract.
- Polished `/settings/blogger` Blog Operation Profile preview so the healthy summary and focus items appear first, with detailed policy fields in a collapsed section.
- Polished Content Detail Publish OAuth Gate UI so the Blog Operation Profile block shows the exception-only dashboard first and keeps detailed advisory metadata collapsed.
- Current baseline loads `safe_manual_publish`, reports `profileFound=true`, `profileHealthy=true`, `advisoryOnly=true`, `policyEnforced=false`, `blockerImpact=false`, and `executionPermissionImpact=false`.
- Existing publish blockers, `canExecutePublish`, `canPublish`, and publish/scheduled publish execution permissions are unchanged.
- `blog_operation_profiles_count` remains `1`, and the 9E published/success milestone baseline remains unchanged.

Policy:

- Operation Profile remains advisory-only in this patch.
- This patch does not enable auto publish, scheduled publish, retry, recovery, or policy-enforced gate behavior.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The next recommended patch is `9F-1E — Policy-enforced publish gate simulation, dry-run only`.

## Patch 9F-1C Operation Profile Advisory In Publish Gate

Implemented after Patch 9F-1B:

- Added read-only Operation Profile advisory wiring to `POST /api/content-items/[id]/publish-oauth-gate`.
- Added `operationProfileAdvisorySummary` with `advisoryOnly=true`, `policyEnforced=false`, `blockerImpact=false`, and `executionPermissionImpact=false`.
- The advisory loads the existing `safe_manual_publish` profile for `급등포착` / `3065973490356135805`.
- The summary reports profile status, operation mode, default policy preset, target blog metadata, safe manual policy booleans, advisory matches, warnings/notes, and side-effect summary.
- Content Detail now displays a `Blog Operation Profile Advisory` block inside the Publish OAuth Gate result area.
- Existing publish blockers, `canExecutePublish`, `canPublish`, and publish/scheduled publish execution permissions are unchanged by the profile advisory.
- `blog_operation_profiles_count` remains `1`, and the 9E published/success milestone baseline remains unchanged.

Policy:

- Operation Profile is advisory-only in this patch.
- This patch does not enable auto publish, scheduled publish, retry, recovery, or policy-enforced gate behavior.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The next recommended patch is `9F-1D — Operation Profile Settings UX polish and exception-only dashboard draft`.

## Patch 9F-1B Create/Apply Default Blog Operation Profile

Applied after Patch 9F-1A:

- Created the default `safe_manual_publish` Blog Operation Profile row for the verified Blogger blog `급등포착`.
- Target Blogger blog: `3065973490356135805` / `https://mathlearningappl.blogspot.com/`.
- The created profile uses `profileName=Default`, `status=active`, `operationMode=approval_required`, and `defaultPublishPolicyPreset=safe_manual_publish`.
- Safe policy values remain `allowAutoPublish=false`, `allowScheduledPublish=false`, `requireOAuthGate=true`, `requireFinalHumanApproval=true`, `requireReadbackAfterPublish=true`, and `requirePostPublishReconciliation=true`.
- The guarded apply was executed once with `BLOG_OPERATION_PROFILE_WRITE_ENABLED=true` and confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE`.
- After apply, `blog_operation_profiles_count=1`.
- After disabling the write flag, apply-negative smoke returned `blog_operation_profile_write_feature_flag_disabled`, `applyAttempted=false`, `applyBlocked=true`, `applyOk=false`, and `dbWrite=false`.
- After-apply preview returned `profileFound=true`, `profileWouldBeCreated=false`, `profileWouldBeUpdated=false`, and `dbWrite=false`.
- The 9E published/success milestone baseline remained unchanged.

Policy:

- This patch performed exactly one allowed business DB mutation in `blog_operation_profiles`.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Operation profiles are still not wired into publish gates. The next recommended patch is `9F-1C — Wire Operation Profile into publish gate as read-only advisory`.

## Patch 9F-1A Blog Operation Profile + Default Publish Policy Preset

Implemented after the 9E first publish milestone closeout:

- Added `BlogOperationProfile` / `blog_operation_profiles` schema foundation.
- Added the `safe_manual_publish` default publish policy preset.
- Added `POST /api/blog-operation-profiles/default-policy` for operation profile preview and guarded apply.
- Added `/settings/blogger` Blog Operation Profile preview UI with Apply/Save disabled.
- Added feature flag guard `BLOG_OPERATION_PROFILE_WRITE_ENABLED=true` and confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE` for future profile writes.

Validation:

- Preview smoke returned `profileWouldBeCreated=true`, `defaultPublishPolicyPreset=safe_manual_publish`, `allowAutoPublish=false`, `allowScheduledPublish=false`, human approval/OAuth/readback/reconciliation requirements true, and `dbWrite=false`.
- Apply-negative smoke with the feature flag disabled returned `blog_operation_profile_write_feature_flag_disabled`, `applyAttempted=false`, `applyBlocked=true`, `applyOk=false`, and `dbWrite=false`.
- `blog_operation_profiles_count` remained `0`.
- The 9E published/success baseline remained unchanged.

Policy:

- Profile apply/write was implemented but not executed during validation.
- Operation profiles are not wired into publish gates yet.
- No Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM call, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service write occurred.

## Patch 9E-9E Publish Milestone Closeout

Documented after `9E-9D-APPLY`:

- Closed out the first end-to-end Blogger publish milestone.
- Recorded the final published/success DB baseline for content item `cmqc2xqbr00011y70sxmgl65v`.
- Moved the earlier `planned` / `planned_only` state into historical pre-reconciliation context.
- Updated the next-session direction toward operation automation, with `9F-1A Blog Operation Profile + Default Publish Policy Preset` as the recommended next patch.

Milestone path:

- `9E-9B-LIVE`: ran one guarded Blogger `posts.publish` through feature flag, exact confirmation phrase, acknowledgements, OAuth readiness, final preflight, and matching metadata. Blogger URL: `https://mathlearningappl.blogspot.com/2026/06/blog-post.html`. Local content mutation was intentionally deferred at publish time.
- `9E-9C`: added Blogger post readback route/lib and verified external Blogger published state from redacted readback metadata.
- `9E-9C-R1`: implemented OAuth token refresh, reflected `tokenRefreshImplemented=true`, and verified the Google OAuth token endpoint path for reducing repeated manual reconnect pressure.
- `9E-9D`: added guarded post-publish reconciliation route/lib, preview mode, feature-flag-disabled apply negative guard, and transaction-based apply implementation.
- `9E-9D-APPLY`: after explicit approval, reconciled the local DB once: `content_items.status=published`, `content_items.publishedAt=2026-06-19 00:44:03`, publish execution attempt `status=success`, redacted response stored, error fields cleared, `contentStatusBefore=planned`, `contentStatusAfter=published`, and `contentMutationCompleted=true`.

Policy:

- This documentation closeout performs no Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, DB mutation, content mutation, publish attempt mutation, external service write, deploy, or LLM call.

## Patch 9E-9D Post-publish DB Reconciliation

Implemented after Blogger publish readback/token refresh work:

- Added guarded post-publish reconciliation preview/apply route at `POST /api/content-items/[id]/post-publish-reconciliation`.
- Added `src/lib/content/post-publish-reconciliation.ts` to compare Blogger readback state with internal content/attempt state and produce safe proposed patches.
- Added `success` to `BloggerPublishExecutionAttemptStatus` for future guarded reconciliation of publish attempts after verified Blogger readback.
- Added a Content Detail preview block for post-publish DB reconciliation with a disabled apply control and explicit safety copy.

Policy:

- Preview mode does not mutate DB and may only perform Blogger read-only post GET through the existing readback helper.
- Apply mode is code-gated by `BLOGGER_POST_PUBLISH_RECONCILIATION_APPLY_ENABLED=true`, exact confirmation phrase, acknowledgements, current-state matches, successful readback, and transaction-based content/attempt updates.
- This patch does not execute apply mode, Blogger publish/write, posts.update, draft save, OAuth reconnect, token refresh, or LLM calls during validation.

## 2026-06-14 Closeout

Latest branch: `master`

Latest commits:

- `a53094c` Improve draft safety repair flow
- `1c89245` Generate draft markdown candidates with LLM
- `a05c62b` Add draft markdown dry run preview
- `2e7d5a0` Add editable plan candidate revalidation
- `78c5385` Return safe LLM call log summaries
- `af0ce9a` Generate content plan candidates with LLM

Completed in the current documented session:

1. LLM Provider/Model/Task Route 기반 구조 정리
2. `content_plan` dry-run preview
3. `content_plan` 실제 LLM 후보 생성
4. planJson 후보 편집, 재검증, 수동 반영
5. LLM call logs Safe DTO
6. `draftMarkdown` dry-run preview
7. `content_draft` Task Route 기반 draftMarkdown 후보 생성
8. draftMarkdown 후보 편집, 재검증, 수동 반영
9. draft safety prompt 강화와 validation 실패 시 자동 repair 1회
10. 테스트 content item에서 planJson 저장, draftMarkdown 저장, draftHtml 미생성 상태 확인

Verified test content item:

```text
id = cmqc2xqbr00011y70sxmgl65v
has_plan = true
has_draft = true
has_html = false
```

Verified latest `content_draft` log summary:

```text
validationOk = true
repairAttempted = false
markdownLength = 1665
mediaPlaceholderCount = 1
```

Security/logging policy confirmed for this stage:

- `draftMarkdown` is not automatically saved after LLM generation.
- DB save occurs only after the user clicks `draftMarkdown에 반영`.
- `llm_call_logs.metadata` must not store prompt full text, raw LLM response full text, request body full text, candidate Markdown full text, API Key, Bearer token, secretRef, encryptedValue, provider headers, or media storagePath.
- A grep hit for `draftMarkdown` can be a false positive from the safe historical error message `Generated draftMarkdown did not pass validation.`

Not implemented yet:

- `draftHtml` generation
- HTML conversion
- quality checks
- Google OAuth
- Blogger API draft save
- publishing or scheduled publishing

Next recommended patch:

- Patch 8C: saved `draftMarkdown` 기반 HTML 변환 dry-run/preview.

## Patch 8C HTML Dry Run

Implemented after closeout:

- Added `POST /api/content-items/[id]/html-preview`.
- Added rule-based saved `draftMarkdown` to escaped previewHtml conversion.
- Added media placeholder mapping preview for attached assets.
- Added sanitization/security readiness checks for raw HTML, script-like tags, `javascript:` URLs, and event handler attributes.
- Added `/content/[id]` HTML Conversion Dry Run UI.

Verified test content item:

```text
id = cmqc2xqbr00011y70sxmgl65v
has_plan = true
has_draft = true
has_html = false
```

Verified dry-run behavior:

```text
ready = true
placeholderCount = 1
matchedPlaceholderCount = 1
unmatchedPlaceholderCount = 0
llm_call_logs count before = 8
llm_call_logs count after = 8
```

Patch 8C does not call LLM providers, does not create `llm_call_logs`, does not save `draftHtml`, and does not call Blogger APIs.

## Patch 8D HTML Candidate Apply

Implemented after Patch 8C:

- Added `POST /api/content-items/[id]/validate-html`.
- Added `POST /api/content-items/[id]/apply-html`.
- Added editable HTML candidate state to `/content/[id]`.
- Added server-side validation/security/media reference checks before `draftHtml` save.
- Added manual `draftHtml에 반영` flow.

Policy:

- `validate-html` does not mutate DB.
- `apply-html` revalidates on the server and only saves when there are no validation errors.
- Warnings can be reviewed by the user before manual save.
- `draftHtml` is local preview/validation HTML, not Blogger final publish HTML.
- No LLM calls, no `llm_call_logs`, no Blogger OAuth/API/publish.

## Patch 8E Quality Dry Run

Implemented after Patch 8D:

- Added `POST /api/content-items/[id]/quality-preview`.
- Added saved `draftHtml` based quality dry-run rules.
- Added score preview and grade calculation.
- Added structure, SEO, media, safety, and Blogger compatibility check groups.
- Added `/content/[id]` Quality Dry Run UI.

Policy:

- `quality-preview` does not mutate DB.
- `qualityScore`, status, draftHtml, publishedAt, and scheduledAt are not changed.
- The API does not return raw content item or raw asset objects.
- No LLM calls, no `llm_call_logs`, no Blogger OAuth/API/publish.

## Patch 8F Publish Readiness Gate

Implemented after Patch 8E:

- Added `POST /api/content-items/[id]/publish-readiness`.
- Added saved planJson, draftMarkdown, draftHtml, HTML validation, and quality preview based readiness checks.
- Added `contentReady` and `publishReady` split.
- Added `/content/[id]` Publish Readiness Gate UI.

Policy:

- `publish-readiness` does not mutate DB.
- `publishReady` remains false until Blogger connection and manual approval storage exist.
- status, qualityScore, draftHtml, publishedAt, and scheduledAt are not changed.
- No LLM calls, no `llm_call_logs`, no Blogger OAuth/API/publish.

## Patch 9A Blogger Connection Placeholder

Implemented after Patch 8F:

- Added `BloggerConnectionStatus` enum.
- Added `blogger_connections` placeholder model and migration.
- Added `/api/settings/blogger` safe list/create API.
- Added `/api/settings/blogger/[id]` safe get/update API.
- Added `/api/settings/blogger/[id]/status` stored-status preview API.
- Added `/settings/blogger` placeholder UI.
- Wired publish readiness to stored Blogger connection status while keeping `publishReady=false`.

Policy:

- No Google OAuth start/callback.
- No access token or refresh token issuance.
- No token/client secret plaintext storage.
- No Blogger API calls, blog list reads, draft saves, publish, or scheduled publish.
- No LLM calls or `llm_call_logs`.

## Patch 9B Blogger OAuth State Dry Run

Implemented after Patch 9A:

- Added `BloggerOAuthState` model and migration.
- Added `oauthClientIdRef` safe metadata field to Blogger connections.
- Added `POST /api/settings/blogger/[id]/oauth/start`.
- Added `GET /api/settings/blogger/oauth/callback`.
- Added OAuth authorization URL dry-run UI to `/settings/blogger`.

Policy:

- OAuth state plaintext is not stored; only `stateHash` is persisted.
- Callback dry-run validates state and consumes it but does not exchange tokens.
- Authorization code plaintext is not persisted or returned.
- No access token or refresh token issuance/storage.
- No Blogger API calls, blog list reads, draft saves, publish, or scheduled publish.
- No LLM calls or `llm_call_logs`.

## Patch 9C-1 Blogger Token Storage Security Foundation

Implemented after Patch 9B:

- Added `BloggerSecretKind` enum.
- Added `blogger_connection_secrets` encrypted secret metadata model and migration.
- Added Blogger token encryption helper using `BLOGGER_SECRET_ENCRYPTION_KEY`.
- Added Blogger token redaction/safe error helpers.
- Added safe Blogger connection secret DB helper.
- Added `GET /api/settings/blogger/[id]/secret-status`.
- Added `POST /api/settings/blogger/[id]/secret-self-test`.
- Added Token Storage Security section to `/settings/blogger`.

Policy:

- No raw access token, refresh token, client secret, or authorization code columns.
- `encryptedValue` is never returned by API/UI.
- Self-test uses a server-internal dummy string and does not return plaintext/ciphertext/encryptedValue.
- Token exchange remains unimplemented.
- No Google token endpoint call.
- No Blogger API calls, blog list reads, draft saves, publish, or scheduled publish.
- No LLM calls or `llm_call_logs`.

## Patch 9C-2 Blogger OAuth Callback Token Exchange

Implemented after Patch 9C-1:

- Added Google OAuth token exchange helper for Blogger callback.
- Switched `/api/settings/blogger/oauth/callback` from dry-run validation to token exchange.
- Resolve `clientSecretRef` only as a server environment key name.
- Store access token as encrypted `BloggerConnectionSecret`.
- Store refresh token as encrypted `BloggerConnectionSecret` when Google returns one.
- Reuse existing refresh token metadata when Google does not return a new refresh token.
- Update Blogger connection status to `connected`, `oauth_required`, or `error` based on token exchange result.
- Keep publish readiness `publishReady=false`.

Policy:

- No authorization code plaintext persistence or response.
- No access token, refresh token, client secret, encrypted value, or raw token response returned by API/UI.
- No token refresh implementation.
- No Blogger API calls, blog list reads, draft saves, publish, or scheduled publish.
- No LLM calls or `llm_call_logs`.

## Patch 9D-1 Blogger Blog List Read-only

Implemented after Patch 9C-2:

- Added read-only Blogger blog list helper.
- Added `POST /api/settings/blogger/[id]/blogs`.
- Decrypt stored encrypted access token only inside server-side Blogger helper.
- Call only `GET https://www.googleapis.com/blogger/v3/users/self/blogs`.
- Return a safe blog DTO with ID, name, URL, published, and updated fields.
- Added “Blogger 목록 조회” action and result table to `/settings/blogger`.
- Updated Blogger settings copy to reflect that OAuth callback token exchange is implemented and Blogger API support is limited to read-only blog list.

Policy:

- No raw access token, refresh token, client secret, encrypted value, raw Blogger response, or raw Blogger error returned by API/UI.
- No DB mutation in the blog list route.
- No token refresh implementation.
- No Blogger draft save, publish, scheduled publish, or blog selection save.
- Keep publish readiness `publishReady=false`.
- No LLM calls or `llm_call_logs`.

## Patch 9D-2 Blogger Blog Selection

Implemented after Patch 9D-1:

- Added `bloggerBlogUrl` and `bloggerBlogVerifiedAt` safe metadata to `BloggerConnection`.
- Added `POST /api/settings/blogger/[id]/blogs/select`.
- Revalidate selected `blogId` by calling the read-only Blogger blog list helper before saving.
- Store only verified safe blog ID, name, URL, and verification timestamp.
- Added “이 블로그 선택” action to `/settings/blogger`.
- Added Blogger blog selection check to publish readiness while keeping `publishReady=false`.

Policy:

- Generic PATCH changes to Blogger blog ID/name do not create a verified selection.
- No token refresh implementation.
- No Blogger draft save, publish, or scheduled publish.
- No raw Blogger response/error, token, client secret, or encrypted value returned by API/UI.
- No LLM calls or `llm_call_logs`.

## Patch 9E-0 Blogger Draft Payload Preview

Implemented after Patch 9D-2:

- Added preview-only `POST /api/content-items/[id]/blogger-draft-preview`.
- Added a pure Blogger draft payload preview helper that uses saved `draftHtml` only.
- Uses stored verified Blogger blog selection metadata as the target blog.
- Treats `bloggerBlogId` without `bloggerBlogVerifiedAt` as unverified.
- Returns title candidate, short HTML snippet, labels candidate, HTML safety summary, readiness flags, blocking issues, and warnings.
- Adds a “Blogger Draft Payload Preview” section to the content detail page.
- Keeps actual Blogger draft save, publish, scheduled publish, token refresh, and Blogger API read/write out of scope.
- Keeps publish readiness `publishReady=false` and top-level `ready=false`.

Policy:

- No DB mutation.
- No Blogger API read/write call.
- No full `draftHtml` payload preview returned as a large response field.
- No access token, refresh token, client secret, encrypted value, raw Blogger response/error, LLM call, or `llm_call_logs`.

## Patch 9E-1 Blogger Draft Approval Guard

Implemented after Patch 9E-0:

- Added `BloggerDraftApprovalStatus` and `blogger_draft_approvals`.
- Added safe manual approval APIs:
  - `POST /api/content-items/[id]/blogger-draft-approval`
  - `DELETE /api/content-items/[id]/blogger-draft-approval`
- Approval creation recalculates the draft payload preview server-side and only accepts `draftPayloadReady=true`.
- Approval snapshot uses stable canonical JSON and SHA-256 hashes.
- Stores `draftHtmlHash`, `snapshotHash`, target Blogger blog safe metadata, title candidate, and readiness summary.
- Does not store full `draftHtml` or `htmlSnippet` in the approval record.
- Preview API now returns approval status, current hash prefixes, active/latest approval summary, and snapshot match status.
- Publish readiness manual approval check can pass when the active approval snapshot matches the current preview.
- Keeps `publishReady=false` and top-level `ready=false`.

Policy:

- No Blogger API read/write call.
- No Blogger draft save, publish, scheduled publish, or token refresh.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No access token, refresh token, encrypted value, raw Blogger response/error, LLM call, or `llm_call_logs`.

## Patch 9E-2 Blogger Draft Save

Implemented after Patch 9E-1:

- Added `BloggerDraftSaveStatus` and `blogger_draft_saves`.
- Added `POST /api/content-items/[id]/blogger-draft-save`.
- Draft save route recalculates the current Blogger draft payload preview server-side.
- Active approval `snapshotHash` and `draftHtmlHash` must match the current preview before any Blogger write call.
- Calls Blogger `posts.insert` with `isDraft=true` only.
- Blocks duplicate successful draft saves for the same approval snapshot.
- Stores safe success/failure metadata and exposes safe DTOs in preview/readiness UI.
- Publish readiness now includes `blogger_draft_saved` check and draft save metadata while keeping `publishReady=false`.

Policy:

- No `posts.update`, publish, scheduled publish, token refresh, or bulk publishing.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No full `draftHtml`, raw Blogger response/error body, access token, refresh token, encrypted value, LLM call, or `llm_call_logs`.

## Patch 9E-3 Blogger Draft Save Live Verification Runbook

Implemented after Patch 9E-2:

- Documented the live Blogger test blog draft save verification runbook.
- Added the fixed pre-live-write approval wording:
  - `실제 Blogger test blog에 draft post가 생성됩니다. 실행해도 됩니까?`
- Documented live verification prerequisites:
  - connected OAuth token
  - verified Blogger blog selection
  - saved `draftHtml`
  - `draftPayloadReady=true`
  - active approval snapshot match
  - no previous successful draft save for the same approval
  - user confirmation that the target blog is a test blog
- Documented retry policy for `retryable=true` failures and non-retryable OAuth/permission failures.
- Documented duplicate draft prevention for same approval success records.
- Documented that new approvals can create new drafts and may accumulate Blogger drafts.
- Kept `posts.update` as a separate Patch 9E-4 policy/design topic.
- Polished content detail UI confirmation, success, duplicate, retryable failure, and non-retryable failure wording.

Policy:

- No live Blogger draft save was executed during Patch 9E-3.
- No `posts.update`, `posts.delete`, publish, scheduled publish, token refresh, or bulk publishing.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No access token, refresh token, encrypted value, raw Blogger response/error, LLM call, or `llm_call_logs`.

## Patch 9E-4A Manual HTML Quality Repair Preview

Implemented after Patch 9E-3:

- Added a rule-based HTML quality repair preview helper.
- Added `POST /api/content-items/[id]/quality-repair-preview`.
- The preview uses saved `draftMarkdown` to rebuild a longer HTML candidate when current `draftHtml` is short or placeholder-like.
- The fallback path appends rule-based structure, CTA, and finance disclaimer sections to current `draftHtml`.
- Added a Quality Repair Preview section to the content detail page.
- The UI shows before/after length, grade, required fail count, CTA/disclaimer flags, source, validation, and editable candidate HTML.
- The candidate can be copied into the existing HTML candidate editor and then saved only through the existing manual `apply-html` flow.

Policy:

- No automatic `draftHtml` save.
- No `qualityScore`, status, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs`.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4B Repair Candidate Apply UX Polish

Implemented after Patch 9E-4A:

- Polished the Quality Repair Preview handoff into the existing HTML candidate editor.
- Renamed the repair handoff action to `HTML 후보로 사용`.
- Added a UI-only HTML candidate source state for `html-preview`, `quality-repair`, and `manual-edit`.
- Repair candidates copied into the HTML candidate editor now require `validate-html` revalidation before manual `apply-html`.
- The HTML candidate editor can be shown from a repair candidate even when no HTML Dry Run result is present.
- `apply-html` confirmation and success notices now warn that existing Blogger draft approval snapshots can become stale.
- After `apply-html` success, stale Quality Dry Run, Publish Readiness, and Blogger Draft Payload Preview results are cleared and the UI asks the user to rerun them.

Policy:

- No automatic `draftHtml` save or repair candidate auto-apply.
- No automatic quality/readiness/Blogger draft preview rerun.
- No DB/schema change.
- No LLM call, `llm_call_logs`, Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-1 Provider-Aware Draft Generation Strategy Foundation

Implemented after Patch 9E-4B:

- Added a provider-aware draft generation strategy resolver.
- Remote/commercial routes remain on the existing `one_shot_full_draft` default.
- Local/small-model-like routes are identified as `local_sectioned_multi_pass` strategy candidates.
- Added draft generation response metadata for strategy, reason, local-like status, executed/planned steps, implementation flags, and provider/model safe summary.
- Added the same safe strategy metadata to `content_draft` LLM call logs.
- Added content detail UI guidance for route-level strategy and generated candidate strategy metadata.
- Documented that actual skeleton-first, sectioned multi-pass generation and final polish are deferred to Patch 9E-4C-2.

Policy:

- Existing one-shot draft generation behavior is preserved.
- Local strategy still executes the current one-shot fallback path in this patch.
- No `TaskRoute` schema or DB migration.
- No automatic `draftMarkdown` or `draftHtml` save.
- No prompt full text, raw response, candidate Markdown, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-2 Local LLM Sectioned Draft Generation Preview

Implemented after Patch 9E-4C-1:

- Added local sectioned draft generation service.
- Kept remote/commercial routes on the existing one-shot full draft path.
- Local/small-model-like routes now run skeleton generation, section generation, deterministic assembly, and final polish when `content_draft` generation is requested.
- Reused the existing `POST /api/content-items/[id]/generate-draft` endpoint and manual `draftMarkdown` apply flow.
- Added local sectioned response metadata for section count, section keys, final polish status, fallback reasons, and safe step summaries.
- Added safe step metadata to `content_draft` call logs without storing prompts, raw responses, candidate Markdown, skeleton, section fragments, or final polish input/output.
- Allowed `promptHash` and `responseHash` as safe call-log metadata while continuing to redact prompt/response bodies.
- Updated content detail UI to show sectioned generation steps and fallback/final polish status.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- Blog post HTML template/theme rendering is deferred to Patch 9E-4D.

## Patch 9E-4C-2 Hotfix: Local FAQ Preservation

Implemented after Patch 9E-4C-2 smoke:

- Strengthened local sectioned skeleton/section prompts to preserve saved `planJson.faq`.
- Strengthened final polish prompt so FAQ headings and question structure are not removed or merged into general prose.
- Added deterministic post-polish FAQ guard.
- When saved FAQ exists and the candidate has no FAQ-like section, the guard appends a safe `## FAQ` section with `###` question headings.
- Added safe FAQ metadata: `faqRequired`, `faqSectionDetected`, `faqFallbackAppended`, and `faqCount`.
- Updated content detail UI to show FAQ preservation metadata.

Policy:

- Remote/commercial one-shot draft path is unchanged.
- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No FAQ question/answer full-text metadata or logs.
- No prompt full text, raw response, candidate Markdown, section fragment, final polish input/output, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-2 Hotfix2: Local Safety Phrase Scrub

Implemented after the FAQ preservation smoke exposed validation-blocking safety phrases:

- Added deterministic safety phrase scrub for local sectioned draft candidates.
- Applied scrub after FAQ guard/fallback and before `validateDraftMarkdown`.
- Reused the same scrub for local sectioned repair results before repair validation.
- Strengthened final polish prompt with explicit blocked phrases and neutral alternatives.
- Added safe scrub metadata: `safetyScrubApplied`, `safetyScrubCount`, and `safetyScrubCodes`.
- Updated content detail UI to show scrub summary without showing candidate or scrubbed sentence text.

Policy:

- Remote/commercial one-shot draft path is unchanged.
- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No prompt full text, raw response, candidate Markdown, scrubbed sentence text, section fragment, final polish input/output, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-2 Hotfix3: Local Sectioned Timeout Policy

Implemented after hotfix2 smoke showed local sectioned generation could exceed the existing 180s provider timeout:

- Added an extended timeout policy for `local_sectioned_multi_pass`.
- Kept remote/commercial `one_shot_full_draft` on the existing route/provider timeout behavior.
- Set local sectioned overall timeout to 600000ms.
- Set skeleton step timeout to 240000ms, section generation/retry timeout to 180000ms, and final polish timeout to 300000ms.
- Set local sectioned repair timeout to 300000ms.
- Added safe timeout metadata: `timeoutPolicy`, `overallTimeoutMs`, `stepTimeoutMs`, and `finalPolishTimeoutMs`.
- Changed content draft provider abort errors to the short safe message/summary `provider_timeout`.
- Updated content detail UI to show timeout policy metadata.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No prompt full text, raw response, candidate Markdown, section fragment, final polish input/output, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-2 Hotfix4: Local Sectioned Cold-Start Timeout Policy

Implemented after hotfix3 smoke exceeded the new 240s skeleton/provider step timeout:

- Increased local sectioned overall timeout to 1200000ms.
- Increased skeleton timeout to 600000ms.
- Increased section generation/retry timeout to 300000ms.
- Increased final polish timeout to 600000ms.
- Increased local sectioned repair timeout to 600000ms.
- Added more granular safe timeout metadata: `skeletonTimeoutMs`, `sectionTimeoutMs`, and `repairTimeoutMs`.
- Kept remote/commercial `one_shot_full_draft` on the existing route/provider timeout behavior.

Policy:

- If local smoke still times out, the next step is async/background job design rather than further timeout extension.
- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No prompt full text, raw response, candidate Markdown, section fragment, final polish input/output, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3A: Local Stepwise Draft Generation Foundation

Implemented after the local sectioned timeout hotfixes showed that long Local LLM generation should move away from one large HTTP request:

- Added Prisma run/step status enums for persisted stepwise draft generation.
- Added `ContentDraftGenerationRun` mapped to `content_draft_generation_runs`.
- Added `ContentDraftGenerationStep` mapped to `content_draft_generation_steps`.
- Added a migration that creates only the new enums, tables, indexes, foreign keys, and grants.
- Added `src/lib/db/content-draft-generation-runs.ts` repository helpers for creating/listing/reading runs, creating/updating steps, completing runs, and cancelling runs.
- Added safe metadata sanitization in the repository helper so prompt/raw response/body/token/secret/encrypted value and full content body keys are removed before metadata storage.
- Added `local_sectioned_stepwise` to draft generation strategy types and labels for future API/UI patches.

Policy:

- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- Existing `local_sectioned_multi_pass` single-request path is preserved as legacy/debug behavior.
- No API route or UI was added in this patch.
- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No prompt full text, raw response, request/response body, candidate Markdown, section fragment, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3B: Local Stepwise Draft Generation Start/Read API

Implemented after Patch 9E-4C-3A:

- Added `POST /api/content-items/[id]/draft-generation-runs`.
- Added `GET /api/content-items/[id]/draft-generation-runs`.
- Added `GET /api/content-items/[id]/draft-generation-runs/[runId]`.
- The start API requires saved `planJson` and creates a `local_sectioned_stepwise` run only.
- New runs start as `pending`, set `currentStepKey=skeleton`, and create pending step placeholders for skeleton and default section keys.
- List and detail APIs return safe run/step DTOs.
- Reused the 3A repository helpers and added a local stepwise creation helper plus DTO mappers.

Policy:

- No LLM provider call and no `llm_call_logs` creation.
- No step execution, assembly, final polish, cancel API, or UI.
- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No prompt full text, raw response, request/response body, secret, token, or encrypted value response/storage.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3C: Local Stepwise Draft Generation Step Execution API

Implemented after Patch 9E-4C-3B:

- Added `POST /api/content-items/[id]/draft-generation-runs/[runId]/steps/[stepKey]`.
- Added a stepwise draft generation service for single-step skeleton/section execution.
- Supported step keys are `skeleton`, `intro`, `body_1`, `body_2`, `body_3`, and `conclusion_cta_faq`.
- Each request executes at most one step.
- Section steps are blocked until skeleton succeeds.
- Completed/cancelled runs, already-running steps, and remote/commercial routes are rejected.
- Existing successful steps are reused unless retry/force is explicitly requested.
- Retry increments only the target step attempt.
- Step success stores normalized Markdown output, short summary, prompt/response hashes, latency, and safe metadata in the step row.
- Step failure marks only the target step as failed.
- Step execution writes `content_draft` LLM call logs with safe stepwise metadata.

Policy:

- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- No automatic full step chain execution.
- No assembly, final polish, cancel API, or UI.
- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No prompt full text, raw response, request/response body, output Markdown full text, skeleton/section fragment full text, candidate Markdown, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3C Smoke Stabilization: Local Ollama Stepwise Calls

Implemented after the initial skeleton smoke reached the route but failed because the selected Ollama model did not return response bytes in time:

- Changed stepwise Ollama generation from `stream:false` to `stream:true`.
- Added separate overall, first-byte, and stream idle timeout handling.
- Added `/api/tags` preflight before Ollama `/api/generate`.
- Added safe request options diagnostics for step execution.
- Reduced skeleton defaults to smaller smoke-friendly generation settings.
- Added bounded section generation settings.
- Added short `keep_alive` for Ollama stepwise calls.
- Added safe error distinctions for model missing, first-byte timeout, idle timeout, overall timeout, network failure, empty response, stream parse failure, and stream provider error.
- Added `scripts/smoke_9e4c3c_stepwise_local_ollama.mjs` as a read-only route/tags probe with optional short generate probe.

Policy:

- No model route is changed automatically.
- No migration or schema change.
- No content item `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- No prompt full text, raw response full text, output Markdown full text, skeleton/section fragment full text, candidate Markdown, secret, token, or encrypted value logging.

## Patch 9E-4C-3D: Local Stepwise Assemble and Final Polish API

Implemented after Patch 9E-4C-3C smoke stabilization:

- Added `POST /api/content-items/[id]/draft-generation-runs/[runId]/assemble`.
- Added `POST /api/content-items/[id]/draft-generation-runs/[runId]/final-polish`.
- Added repository helpers for saving assembled candidates and marking run-level final polish failures.
- Deterministic assembly combines successful section outputs in the fixed stepwise order.
- Assembly requires all required section steps to be `success` with `outputMarkdown`.
- Assembly stores `assembledCandidateMarkdown`, safe validation summary, and safe metadata without calling an LLM.
- Final polish requires an assembled candidate and calls the configured local-like `content_draft` route once.
- Final polish success stores `finalCandidateMarkdown`, safe validation summary, and completes the run.
- Final polish failure keeps the assembled candidate as fallback and records safe failure metadata only.
- Added `scripts/smoke_9e4c3d_assemble_final_polish.mjs` for API-level assemble/final polish smoke checks.

Policy:

- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- No UI was added.
- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No prompt full text, raw response full text, assembled/final candidate full text in metadata, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3E: Content Detail Stepwise UI

Implemented after Patch 9E-4C-3D:

- Added a Stepwise Draft Generation section to the content detail screen.
- Added UI for listing/selecting persisted stepwise runs.
- Added UI for creating a new stepwise run.
- Added one-step-at-a-time local LLM execution buttons for skeleton and section steps.
- Added deterministic assemble and final polish controls.
- Added read-only assembled/final candidate previews and validation summary display.
- Added human-readable diagnostics for common local provider timeout/model errors.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- Retry/force and content item candidate apply remain follow-up patches.

## Patch 9E-4C-3F: Stepwise Final Candidate Manual Apply Guard

Implemented after Patch 9E-4C-3E:

- Added a “수동 적용 후보로 사용” action for completed stepwise runs with `finalCandidateMarkdown`.
- The action copies the final candidate into the existing Draft Markdown candidate editor as client-side state only.
- Added draft candidate source labeling for LLM generated, stepwise final candidate, and manual edit sources.
- Added safety copy explaining that the copy action does not save content items or call Blogger/LLM APIs.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs` creation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4D: Blog Post Template Renderer Preview

Implemented after Patch 9E-4C-3F:

- Added deterministic Markdown-to-HTML blog post template preview rendering.
- Added `POST /api/content-items/[id]/blog-post-template-preview`.
- Added content detail UI controls to generate a themed HTML preview from the current Draft Markdown candidate.
- Preview output includes safe validation summary counts for headings, FAQ, media placeholders, unsafe patterns, and preview-only side-effect metadata.
- Preview HTML is displayed in an iframe and read-only textarea.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs` creation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4E: Blog HTML Preview Manual Apply Guard

Implemented after Patch 9E-4D:

- Added an “HTML 후보로 사용” action for Blog Post Template HTML previews.
- The action copies preview HTML into the existing HTML candidate editor as client-side state only.
- Added `blog template preview` HTML candidate source labeling.
- The handoff clears/stales HTML candidate validation so the existing `validate-html` and manual `apply-html` flow must be used before saving.
- Added UI copy clarifying that the handoff does not save `draftHtml`, mutate content items, or call Blogger APIs.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs` creation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4F: Manual draftHtml Apply Guard Hardening

Implemented after Patch 9E-4E:

- Hardened the existing `POST /api/content-items/[id]/apply-html` response with safe guard summary metadata.
- Added unsafe pattern count to HTML candidate validation metadata.
- Kept server-side validation immediately before saving `draftHtml`.
- Added UI copy clarifying that `draftHtml에 반영` saves only `draftHtml` and does not call Blogger draft save/publish/token refresh.
- Replaced the native confirm with an in-page 2-step explicit save confirmation guard.
- Added last apply guard summary display on the content detail page.
- After successful manual apply, the HTML candidate source is shown as applied/saved draftHtml.

Policy:

- `apply-html` writes only `content_items.draftHtml`.
- No automatic `draftMarkdown` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs` creation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4G-1: Saved draftHtml Readiness Recheck and Draft Save Preflight

Implemented after Patch 9E-4F:

- Added `POST /api/content-items/[id]/blogger-draft-save-preflight`.
- The preflight recomputes saved `draftHtml` validation, Blogger draft payload preview, current approval snapshot hash, and publish-readiness summary.
- Added safe connection, selected blog, token metadata presence, approval snapshot, blocking reason, warning, HTML hash prefix, and side-effect summaries.
- Added content detail UI controls for running Draft Save Preflight next to Blogger Draft Payload Preview.
- Blogger Draft save buttons now also require the latest preflight result to pass before enabling.
- Manual `draftHtml` apply success clears stale preflight results and asks the user to rerun Quality Dry Run, Publish Readiness, Blogger Draft Payload Preview, and Draft Save Preflight.

Policy:

- Preflight is read-only and does not call Blogger write APIs.
- No Blogger draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- No LLM call or `llm_call_logs` creation.
- No `content_items` mutation, including `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- Secret material, encrypted values, raw Blogger responses, prompt text, and full `draftHtml` are not returned.

## Patch 9E-4G-1b: Blogger Draft Save Readiness UX and Connection Guidance

Implemented after Patch 9E-4G-1:

- Improved the content detail Draft Save Preflight result block with a human-readable readiness checklist.
- Added blocking reason to next-action guidance for Blogger connection, blog selection, draft payload readiness, manual approval, stale approval, and draft save readiness.
- Added `/settings/blogger` navigation guidance when no Blogger connection exists.
- Added clearer copy around the disabled Blogger Draft save button explaining that preflight must pass before any real draft save attempt.
- Added stale approval guidance explaining that changed `draftHtml` can invalidate prior payload previews and approval snapshots.
- Kept side-effect flags visible and explicit: Blogger API write, draft save, publish, scheduled publish, token refresh, LLM call, and content item mutation remain false during preflight.

Policy:

- UX/readiness guidance only.
- No Blogger API write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- No LLM call or `llm_call_logs` creation.
- No `content_items` mutation, including `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- No schema or migration change.

## Patch 9E-4G-1c: Draft Save Preflight Blocker Classification

Implemented after Patch 9E-4G-1b:

- Changed draft-save preflight classification so `blogger_draft_saved` from publish-readiness no longer blocks the first Blogger draft save attempt.
- Added same-approval duplicate-save detection with `blogger_draft_already_saved_for_approval`.
- Promoted expired access tokens to a true preflight blocker: `access_token_expired_reauth_required`.
- Added safe client secret diagnostics for env-backed `clientSecretRef` use: `hasClientSecretRef`, `clientSecretConfigured`, and `encryptedClientSecretStored`.
- Updated content detail guidance to show expired-token reauth guidance, duplicate-save guidance, and “draft not saved yet” as an expected first-save state.

Policy:

- No token refresh implementation.
- No OAuth start/callback is invoked automatically.
- No Blogger API write, draft save, publish, scheduled publish, `posts.insert`, or `posts.update`.
- No LLM call, `llm_call_logs` creation, schema change, migration, or content item mutation.

## Patch 9E-4G-2a: Blogger Draft Save UI Gate Activation Fix

Implemented after Patch 9E-4G-1c:

- Changed the content detail Blogger Draft save button to use the latest Draft Save Preflight result as the source of truth for UI activation.
- The button now requires `canSaveDraft=true`, zero blocking reasons, ready draft payload, matching approved snapshot, and no same-approval successful save.
- The UI no longer depends on top-level publish-readiness `ready=true` for draft save activation.
- Added in-page 2-step confirmation before calling the existing guarded Blogger draft save route.
- Added copy clarifying that the save action creates one Blogger draft post and does not publish, schedule publish, update posts, or refresh tokens.
- After successful UI save, the preflight state is marked as duplicate-blocked to prevent another click for the same approval.

Policy:

- No automatic draft save.
- No publish, scheduled publish, posts.update, token refresh, LLM call, schema change, or content item mutation.
- Blogger write remains possible only through the explicit user-clicked save button after preflight passes.

## Patch 9E-4G-2b: Blogger Draft Save Success UX and Admin Link Polish

Implemented after Patch 9E-4G-2a:

- Recorded the live smoke outcome where the web UI created one Blogger draft post in the test blog.
- Added safe latest-successful draft save metadata to Draft Save Preflight responses.
- Improved the content detail Blogger Draft Save section with a success block for saved draft metadata.
- Added derived Blogger admin edit/preview links from `targetBloggerBlogId` and `bloggerPostId`.
- Added guidance that Blogger may return a blog/home URL for draft posts and that the derived admin links are the useful management links.
- Reframed `blogger_draft_already_saved_for_approval` as a protective duplicate-save state instead of a scary error.
- Kept copy explicit that the saved post is still a draft and `posts.update`, publish, scheduled publish, and token refresh are not implemented/executed.

Live smoke record:

- `blogger_draft_saves=1`
- `blogger_draft_approvals=1`
- `llm_call_logs=22`
- `bloggerPostId=6376467965797870330`
- Duplicate preflight blocker `blogger_draft_already_saved_for_approval` confirmed.
- `draftMarkdown` hash stayed `9e0921e7edc9e4a8464a0a52ba369d3d`.
- `draftHtml` hash stayed `a7393df8fb009566201daeea18796027`.
- Content status stayed `planned`; `qualityScore`, `publishedAt`, and `scheduledAt` were unchanged.

Policy:

- UX/read-only metadata polish only.
- No new Blogger API write or additional draft save during this patch.
- No publish, scheduled publish, posts.update, token refresh, LLM call, schema change, migration, or content item mutation.

## Session Closeout: 2026-06-16 Stepwise Draft to Blogger Draft Save Milestone

Final milestone:

- Completed the end-to-end reviewed draft path from persisted local stepwise generation to Blogger draft save:
  `Stepwise draft -> publish-ready HTML preview -> manual draftHtml apply -> Blogger OAuth/blog selection -> payload preview -> approval snapshot -> Blogger draft save 1회 성공`.
- The milestone remains manual/review-gated at each persistence or external write boundary.
- No automatic publish pipeline has been enabled.

Completed patch sequence in this session:

- 9E-4C-3E: content detail stepwise draft UI.
- 9E-4C-3F: client-side guard for copying `finalCandidateMarkdown` into the Draft Markdown candidate editor.
- 9E-4D: deterministic Blog Post Template HTML preview renderer.
- 9E-4E: client-side guard for copying template preview HTML into the HTML candidate editor.
- 9E-4F: hardened manual `draftHtml` apply guard with server revalidation and 2-step confirmation.
- 9E-4G-1: saved `draftHtml` Blogger Draft Save Preflight gate.
- 9E-4G-1b: readiness UX and Blogger connection guidance.
- 9E-4G-1c: preflight blocker classification fix.
- 9E-4G-2a: guarded Blogger Draft save button activation from `canSaveDraft=true`.
- 9E-4G-2b: Blogger draft save success UX and derived admin edit/preview links.

Live smoke result:

- Test content item: `cmqc2xqbr00011y70sxmgl65v`.
- Title candidate: `주식 초보자가 매수 타이밍을 놓치는 이유`.
- Blogger connection: `cmqfst8vc0001iwrpi1qu8oj2`.
- Selected test blog: `급등포착`.
- Target Blogger blog id: `3065973490356135805`.
- Target Blogger blog URL: `https://mathlearningappl.blogspot.com/`.
- Approval: `cmqfwjz9u0009iwag9auo688v`.
- Blogger draft post id: `6376467965797870330`.
- Blogger admin draft/preview was confirmed by the user.

Safety/result record:

- `blogger_draft_saves=1`.
- `blogger_draft_approvals=1`.
- `llm_call_logs=22`.
- Content item status stayed `planned`.
- `draftMarkdown` md5 stayed `9e0921e7edc9e4a8464a0a52ba369d3d`.
- `draftHtml` md5 stayed `a7393df8fb009566201daeea18796027`.
- `draftHtml` length stayed `2789`.
- `qualityScore`, `publishedAt`, and `scheduledAt` stayed unchanged.
- Post-save preflight confirmed duplicate protection with `blogger_draft_already_saved_for_approval`.

Still not implemented:

- Blogger publish.
- Scheduled publish.
- `posts.update`.
- Token refresh.
- Automatic content item status transition.
- Automatic `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- Additional Blogger draft save for the same approval.

Security/redaction policy confirmed:

- No access token, refresh token, client secret, encrypted value, raw Blogger response body, full `draftHtml`, prompt full text, raw LLM response, or generated candidate full text is exposed in admin DTOs/log metadata.
- `.env.local`, `.env.local.backup*`, and secret backup files must not be read, modified, printed, or staged.

## Patch 9E-4H: Post-save Publish Readiness UX Refresh

Implemented after the 2026-06-16 closeout milestone:

- Improved the content detail Publish Readiness Gate with a post-save status block.
- The UI now separates “Blogger draft save 완료” from actual publish readiness.
- Blogger draft saved state, post id, saved time, manual approval match, duplicate-save protection, and implementation status are shown together.
- Publish Ready and top-level Ready remain visibly false after draft save.
- The UI explains that this is “초안 저장 완료, 발행 구현 전” rather than publish-ready.
- Duplicate save protection is shown as a protective post-save state, not a failure.
- If preflight reports `access_token_expired_reauth_required`, the UI explains that OAuth re-connection is needed before a future Blogger write and that automatic token refresh is not implemented.
- Blogger admin edit/preview links can be derived from publish-readiness metadata when blog id and post id are available.

Policy:

- UI/readiness display only.
- No Blogger API write, additional draft save, publish, scheduled publish, `posts.update`, token refresh, LLM call, schema change, migration, or content item mutation.
- `publishReady=false` and top-level `ready=false` remain the server semantics until publish is explicitly designed and implemented later.

## Patch 9E-5A: Blogger Token Refresh Readiness/Design

Implemented after Patch 9E-4H:

- Clarified the content detail UX for `access_token_expired_reauth_required`.
- The UI now explains that the stored Blogger access token is expired and that future Blogger writes require OAuth re-connection.
- The UI separates token expiry from the already saved Blogger draft: the existing draft remains intact and same-approval duplicate-save protection remains active.
- Added `/settings/blogger` navigation from token-expired readiness notices.
- Documented token refresh readiness policy and required decisions before implementing refresh.
- Kept Draft Save Preflight and Publish Readiness semantics unchanged: expired token keeps `canSaveDraft=false`; post-save publish readiness remains `ready=false`, `publishReady=false`.

Policy:

- No automatic token refresh implementation.
- No refresh token use, token endpoint call, OAuth token exchange call, Blogger write, additional draft save, publish, scheduled publish, `posts.update`, LLM call, schema change, migration, or content item mutation.
- Access token, refresh token, client secret, encrypted value, and raw OAuth response remain redacted and are not exposed in UI/docs/logs/test output.

## Patch 9E-5B: Blogger Draft Update/Retry Policy Planning

Implemented after Patch 9E-5A:

- Added content detail guidance for the post-save Blogger draft update/retry policy.
- The UI now explains that the saved Blogger draft is already protected by same-approval duplicate-save blocking.
- Added policy status labels for draft update planning, retry planning, `posts.update` not implemented, duplicate save blocked, and new approval before draft mutation.
- Documented that saved draft corrections require a later approved policy: `posts.update`, a new approval, or a new draft save.
- Documented retry boundaries: retry may only be considered for limited retryable failures where draft creation is not known to have succeeded.
- Documented non-retry states: already successful approval, token expiry, approval mismatch, content hash mismatch, auth/scope errors, and publish/scheduled publish.
- Added rollback guidance that Blogger `posts.update` changes external service state and should not be treated like a local rollback.

Policy:

- No `posts.update` implementation.
- No retry execution implementation.
- No Blogger API write, additional draft save, publish, scheduled publish, token refresh, LLM call, schema change, migration, or content item mutation.
- Existing Draft Save Preflight and Publish Readiness semantics remain unchanged.

## Patch 9E-6A: Publish / Scheduled Publish Policy Design

Implemented after Patch 9E-5B:

- Added content detail guidance for publish and scheduled publish policy planning.
- The UI now explains that a saved Blogger draft is not publish-ready.
- Publish Ready and top-level Ready remain visibly false after draft save.
- Added planning-only status labels for publish readiness policy, required pre-publish checks, content mutation, and external rollback.
- Documented the difference between immediate publish and scheduled publish.
- Documented future publish preflight requirements: saved draft, blog/post identity, approval snapshot, token status, duplicate/update conflict checks, manual publish approval, side-effect summary, and rollback acknowledgement.
- Documented future scheduled publish requirements: `scheduledAt`, explicit timezone, schedule cancel/update policy, local status/scheduledAt policy, and `sideEffectSummary.scheduledPublish=true`.
- Documented that local `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, and `draftHtml` mutations remain forbidden until a separate approved policy.

Policy:

- No publish implementation.
- No scheduled publish implementation.
- No Blogger publish call, Blogger write, additional draft save, `posts.update`, token refresh, LLM call, schema change, migration, or content item mutation.
- Existing Draft Save Preflight and Publish Readiness semantics remain unchanged.

## Patch 9E-6B: Blogger Publish Preflight Dry-run

Implemented after Patch 9E-6A:

- Added `POST /api/content-items/[id]/publish-preflight` as a read-only dry-run route.
- Added `src/lib/content/publish-preflight.ts` to build the safe publish preflight response model.
- Added Content Detail UI for Publish Preflight Dry-run results.
- The dry-run reports `canPublish=false` and `canSchedulePublish=false`.
- The dry-run reports not-implemented blockers for publish, scheduled publish, publish approval, and local content mutation policy.
- Expired access token metadata is surfaced as `access_token_expired_reauth_required`; no token refresh is performed.
- Existing Blogger draft save, target blog, Blogger post id, approval match, draft hash prefix, and duplicate save protection state are summarized as safe metadata.
- Proposed publish approval snapshot fields are listed for a later schema/approval patch.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- DB schema/migration changes
- LLM calls or `llm_call_logs`

## Patch 9E-6C: Blogger Publish Approval Snapshot Preview

Implemented after Patch 9E-6B:

- Added `POST /api/content-items/[id]/publish-approval-preview` as a read-only snapshot preview route.
- Added `src/lib/content/publish-approval-preview.ts` to build non-secret approval snapshot preview and SHA-256 hash preview.
- Added Content Detail UI for Publish Approval Snapshot Preview.
- The preview reports `canCreatePublishApproval=false`, `canPublish=false`, and `canSchedulePublish=false`.
- The preview reports `publish_approval_persistence_not_implemented` plus publish/scheduled publish not implemented blockers.
- Expired access token metadata is surfaced as `expired_reauth_required` token state and `access_token_expired_reauth_required`; no token refresh is performed.
- Snapshot hash preview is displayed as not persisted and not an approval record.

Not implemented:

- publish approval persistence, table, migration, insert, or update
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-6D: Publish Approval Persistence Policy and Schema Plan

Implemented after Patch 9E-6C:

- Added Content Detail UI guidance for publish approval persistence policy.
- Clarified that the current approval snapshot/hash remains preview-only and is not a DB-stored approval.
- Documented future approval persistence requirements: immutable snapshot, deterministic hash, rollback acknowledgement, side-effect acknowledgement, token state checkedAt, invalidation policy, and publish attempt audit linkage.
- Documented invalidation triggers for draft hash, title, target blog, Blogger post id, schedule/timezone, content status, token state, newer approval, and future `posts.update` flows.
- Documented a recommended dedicated future `blogger_publish_approvals` table and safe non-secret field set.
- Kept stored approval and actual publish execution as separate future steps.

Not implemented:

- publish approval persistence, table, migration, insert, or update
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- DB write/mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7A: Publish Approval Persistence Storage

Implemented after Patch 9E-6D:

- Added Prisma enums `BloggerPublishApprovalMode` and `BloggerPublishApprovalStatus`.
- Added `BloggerPublishApproval` model mapped to `blogger_publish_approvals`.
- Added migration `20260617000100_add_blogger_publish_approvals`.
- Added `src/lib/db/blogger-publish-approvals.ts` for safe approval insert/read/count helpers.
- Added `POST /api/content-items/[id]/publish-approval-save`.
- The save route regenerates the publish approval snapshot server-side and requires the client preview hash to match.
- The save route requires rollback acknowledgement, side-effect summary acknowledgement, and approval persistence acknowledgement.
- Same content/mode/snapshot/schedule active approval can be reused idempotently.
- Updated Publish Approval Snapshot Preview semantics: persistence exists, but explicit save and acknowledgements are required.
- Added Content Detail UI for publish approval storage options, acknowledgement checkboxes, local DB save button, and safe save result summary.
- Stored approval still returns `canPublish=false` and `canSchedulePublish=false`.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- publish execution attempt audit
- LLM calls or `llm_call_logs`

## Patch 9E-7B: Publish Approval Persistence Smoke and Readback

Implemented after Patch 9E-7A:

- Added `POST /api/content-items/[id]/publish-approval-readback` as a read-only saved approval summary route.
- Added latest and active publish approval read helpers.
- Added saved publish approval readback UI on Content Detail.
- Added `existing` to publish approval save response.
- Clarified idempotent save behavior: same active snapshot returns existing approval without creating a duplicate row.
- Verified one local DB publish approval insert smoke.
- Verified idempotent second save keeps `blogger_publish_approvals` count at `1`.
- Kept readback/save results at `canPublish=false` and `canSchedulePublish=false`.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7C: Publish Approval Invalidation and Execution Guard

Implemented after Patch 9E-7B:

- Added `POST /api/content-items/[id]/publish-approval-execution-guard` as a read-only execution guard route.
- Added `src/lib/content/publish-approval-execution-guard.ts` to compare the latest saved publish approval against current content item and Blogger draft metadata.
- Added Content Detail UI for execution guard match summary, invalidation candidates, blockers, required-before-execution gates, and side-effect summary.
- The guard reports `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canPublish=false`, and `canSchedulePublish=false`.
- Invalidation candidates are read-only diagnostics only; this patch does not update `invalidatedAt` or `invalidatedReason`.
- Token expired state remains an execution blocker via `access_token_expired_reauth_required`.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- publish approval invalidation DB update
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7D: Publish Approval Invalidation Dry-run and Policy

Implemented after Patch 9E-7C:

- Added `POST /api/content-items/[id]/publish-approval-invalidation-preview` as a read-only invalidation dry-run route.
- Added `src/lib/content/publish-approval-invalidation-preview.ts` to build dry-run invalidation plans from execution guard results.
- Added Content Detail UI for normal invalidation preview, manual invalidation dry-run reason, dry-run plan, invalidation reasons, blockers, and side-effect summary.
- Normal current-state preview reports `wouldInvalidate=false` and `canInvalidate=false`.
- Manual invalidation dry-run can report `wouldInvalidate=true`, but still keeps `canInvalidate=false`.
- Dry-run plans do not update `invalidatedAt` or `invalidatedReason`.

Not implemented:

- approval invalidation DB update or execution route
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7E: Publish Execution Attempt Preview and Policy

Implemented after Patch 9E-7D:

- Added `POST /api/content-items/[id]/publish-execution-attempt-preview` as a read-only future attempt planning route.
- Added `src/lib/content/publish-execution-attempt-preview.ts` to build planned-only attempt summaries from execution guard and saved approval metadata.
- Added Content Detail UI for publish execution attempt preview, planned attempt summary, blockers, required gates, retry/failure/partial failure policy, redaction policy, content mutation ordering, and side-effect summary.
- Documented future `blogger_publish_execution_attempts` schema fields and status candidates.
- Documented retry eligible, retry blocked, partial failure, redaction, and local content mutation ordering policy.
- The preview reports `attemptStorageImplemented=false`, `wouldCreateAttempt=false`, `canCreateAttempt=false`, `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canPublish=false`, and `canSchedulePublish=false`.

Not implemented:

- publish execution attempt table/model/migration
- publish attempt insert/update
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- approval invalidation DB update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7F: Publish Execution Attempt Storage

Implemented after Patch 9E-7E:

- Added `BloggerPublishExecutionAttempt` Prisma model mapped to `blogger_publish_execution_attempts`.
- Added migration `20260618000100_add_blogger_publish_execution_attempts`.
- Added `src/lib/db/blogger-publish-execution-attempts.ts` for safe attempt insert/read/count helpers.
- Updated `POST /api/content-items/[id]/publish-execution-attempt-preview` to report `attemptStorageImplemented=true` and include `attemptPlanHashPreview`.
- Added `POST /api/content-items/[id]/publish-execution-attempt-save` for local DB planning-only attempt storage.
- Added `POST /api/content-items/[id]/publish-execution-attempt-readback` for safe saved attempt summaries.
- The save route regenerates the attempt preview server-side and requires the client preview hash to match.
- The save route requires attempt persistence, no Blogger write, and no content mutation acknowledgements.
- Same content/approval/attemptPlanHash returns the existing attempt idempotently.
- Added Content Detail UI for attempt acknowledgements, local DB save, safe save result, and readback summary.
- Stored attempts still return `canExecutePublish=false` and `canExecuteScheduledPublish=false`.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- approval invalidation DB update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-8A: OAuth Reconnect Gate Before Publish

Implemented after Patch 9E-7F:

- Added `POST /api/content-items/[id]/publish-oauth-gate` as a read-only OAuth gate before future publish execution.
- Added `src/lib/content/publish-oauth-gate.ts` for safe gate summary construction.
- The gate reads safe Blogger connection metadata, selected blog metadata, access token expiry metadata, latest saved publish approval, and latest saved publish execution attempt.
- The gate reports expired access tokens as `expired_reauth_required` with manual reconnect and token-refresh-not-implemented blockers.
- Saved publish approvals and saved execution attempts do not bypass the OAuth gate.
- Added Content Detail UI for `Check Publish OAuth Gate`, blocker/warning lists, `/settings/blogger` reconnect guidance, and side-effect summary.
- Publish preflight and execution attempt required-before-execution copy now explicitly include the OAuth gate.

Not implemented:

- OAuth reconnect execution, OAuth callback/token exchange call, or token refresh
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- approval invalidation DB update or attempt status update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-8B: Manual OAuth Reconnect Completion Gate

Implemented after Patch 9E-8A:

- Extended the existing `POST /api/content-items/[id]/publish-oauth-gate` route instead of adding a second OAuth readiness route.
- Added `manualReconnectCompletionSummary` to describe what must be rechecked after a user manually reconnects OAuth in `/settings/blogger`.
- The summary checks safe metadata for Blogger connection existence, selected blog presence, selected blog vs saved approval target, access token state, saved publish approval validity, saved publish execution attempt planning-only status, content status, draft hash match, and target blog match.
- The response keeps `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canProceedToPublishExecution=false`, and `canProceedToScheduledPublishExecution=false`.
- `final_publish_preflight_not_implemented` and `publish_execution_still_disabled_until_final_preflight` remain blockers even when the reconnect completion gate becomes otherwise ready.
- Content Detail UI now shows a Manual Reconnect Completion Readiness block with blockers, warnings, safe match booleans, and side-effect summary.
- Documented 9F operation automation roadmap direction: Blog Operation Profile, default policy, and exception-focused dashboard instead of repeated manual configuration.

Not implemented:

- OAuth reconnect execution, OAuth callback/token exchange call, or token refresh
- Blogger publish or scheduled publish
- Blogger API read/write, `posts.update`, `posts.insert`, or additional draft save
- approval invalidation DB update or attempt status update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-8C: Final Publish Execution Preflight Summary

Implemented after Patch 9E-8B:

- Extended the existing `POST /api/content-items/[id]/publish-oauth-gate` route instead of adding a separate final preflight route.
- Added `finalPublishExecutionPreflightSummary` to integrate publish approval, publish execution attempt, OAuth gate, manual reconnect completion readiness, content snapshot/hash, target blog snapshot, rollback/safety acknowledgement placeholders, blockers, warnings, and side-effect summary.
- The final summary reports `canProceedToPublishExecution=false`, `canProceedToScheduledPublishExecution=false`, and `canExecutePublish=false`.
- Current expired-token state keeps `access_token_still_expired_reauth_required` and `manual_reconnect_completion_not_ready` blockers.
- Guarded Blogger publish implementation, final human approval, rollback acknowledgement, and external write risk acknowledgement remain blockers.
- Added Content Detail UI for Final Publish Execution Preflight status, snapshot match booleans, acknowledgement placeholders, blockers, warnings, and side-effect summary.
- Kept the 9F operation automation roadmap note: Blog Operation Profile, default policy, and exception-focused dashboard instead of repeated manual configuration.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API read/write, `posts.update`, `posts.insert`, or additional draft save
- OAuth reconnect execution, OAuth callback/token exchange call, or token refresh
- publish approval insert/update/invalidation or publish execution attempt insert/update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls, `llm_call_logs`, deploy, push, or external service writes

## Patch 9E-9A: Guarded Blogger Publish Execution Design

Implemented after the 9E-8D post-reconnect validation milestone:

- Extended the existing `POST /api/content-items/[id]/publish-oauth-gate` route instead of adding a new publish execution design route.
- Added `guardedPublishExecutionDesignSummary` as a read-only design summary for the future guarded Blogger publish execution patch.
- The summary reports the current final preflight status, approval/attempt ids, draft save id, target Blogger blog metadata, existing Blogger post id, planned operation kind, planned Blogger API action, redacted request plan, failure policy draft, and side-effect boundary.
- The summary keeps `guardedPublishImplementationReady=false`, `canProceedToPublishExecution=false`, `canProceedToScheduledPublishExecution=false`, and `canExecutePublish=false`.
- The post-reconnect/final-preflight-ready path now removes the old `final_publish_preflight_not_implemented` and `publish_execution_still_disabled_until_final_preflight` blockers from the manual reconnect completion taxonomy.
- Guarded publish implementation, rollback acknowledgement, external write risk acknowledgement, and final human approval remain blockers.
- Added Content Detail UI for the guarded publish design summary, redacted request plan, future implementation/execution requirements, failure policy, blockers, warnings, and side-effect summary.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API read/write, `posts.update`, `posts.insert`, or additional draft save
- OAuth reconnect execution, OAuth callback/token exchange call, or token refresh
- publish approval insert/update/invalidation or publish execution attempt insert/update/execution
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls, `llm_call_logs`, deploy, push, or external service writes

## Patch 9E-9B: Guarded Blogger Publish Execution Route

Implemented after Patch 9E-9A:

- Added `POST /api/content-items/[id]/guarded-publish-execution`.
- Added `src/lib/content/guarded-publish-execution.ts` to validate approval, attempt, content hashes, target Blogger blog, Blogger post id, OAuth gate, final preflight, feature flag, confirmation phrase, and acknowledgements.
- Added `src/lib/blogger/publish-post.ts` as the guarded Blogger `posts.publish` wrapper. It returns safe redacted metadata only and does not expose access tokens, request bodies, raw Blogger response bodies, or full `draftHtml`.
- The route defaults to `mode=dry_run`; dry-run performs DB reads only, never calls Blogger, never writes DB rows, and keeps `canExecutePublish=false`.
- Live mode is code-gated by `BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=true`, exact phrase `I_UNDERSTAND_THIS_WILL_PUBLISH_TO_BLOGGER`, matching approval/attempt/hash/blog/post metadata, OAuth/final-preflight readiness, rollback acknowledgement, external write risk acknowledgement, and final human approval.
- Content Detail UI now includes a Guarded Publish Execution dry-run button/result block. It does not expose a live publish button.
- Existing publish OAuth gate copy now reflects that the guarded route is implemented but live publish remains disabled by default.
- Current expired OAuth state is handled as a safe blocker rather than a patch blocker.

Validation notes:

- Dry-run smoke returns `implementationStatus=implemented_live_guarded`, `liveExecutionAttempted=false`, `liveExecutionBlocked=true`, `dryRunOnly=true`, and write side effects false.
- Live negative smoke with feature flag disabled returns `liveExecutionAttempted=false`, `bloggerWrite=false`, `bloggerPublish=false`, and `dbWrite=false`.
- No live Blogger publish/write smoke was executed in this patch.
- DB/hash/count guard remains unchanged.

Not implemented or not executed:

- Live Blogger publish/write smoke
- Blogger `posts.update`, additional draft save, OAuth reconnect, token refresh, deploy, push, or external service write
- `content_items.status`, `publishedAt`, `scheduledAt`, `draftMarkdown`, `draftHtml`, or `qualityScore` mutation
- publish result readback/reconciliation and post-publish content mutation, both deferred to later patches

## Patch 9E-9B-LIVE-READY: Deferred Content Mutation Taxonomy

Implemented after Patch 9E-9B:

- Moved `content_mutation_deferred_to_post_publish_patch` out of guarded publish execution hard blockers.
- Exposed the deferred `content_items` status/publishedAt mutation as a warning and `postPublishDeferredActions` metadata instead.
- Updated the Content Detail guarded publish execution result block so the deferred content mutation appears as a post-publish next step, not a Blogger publish call blocker.
- Kept `canExecutePublish=false`; live publish remains gated by feature flag, exact confirmation phrase, acknowledgements, OAuth/final preflight readiness, and request metadata matches.

Not executed:

- Live Blogger publish/write, Blogger `posts.update`, additional draft save, OAuth reconnect, token refresh, deploy, push, external service write, content item mutation, approval/attempt mutation, or LLM call.

## Patch 9E-9C: Publish Result Readback And Reconciliation Preview

Implemented after the 9E-9B-LIVE successful Blogger publish smoke:

- Added `src/lib/blogger/read-post.ts` for Blogger `posts.get` read-only post readback with redacted safe metadata only.
- Added `POST /api/content-items/[id]/publish-result-readback`.
- Added a read-only reconciliation preview that compares saved approval, saved publish attempt, successful draft save, content item state, target Blogger blog/post id, and Blogger readback metadata.
- The preview reports external Blogger state, internal DB state, match booleans, deferred mutation warnings, and a proposed 9E-9D content/attempt reconciliation plan.
- Content Detail UI now includes a Publish Result Readback button/result block.

Not executed or not implemented:

- Blogger publish/write, Blogger `posts.update`, additional draft save, OAuth reconnect, token refresh, content item mutation, approval mutation, attempt mutation, deploy, push, external service write, or LLM call.
- 9E-9D is still required before local `content_items.status`/`publishedAt` or publish attempt response fields are updated.

## Patch 9E-9C-R1: Blogger OAuth Token Refresh

Implemented after Patch 9E-9C:

- Added `src/lib/blogger/token-refresh.ts` for Google OAuth refresh-token grant.
- Added `POST /api/settings/blogger/[id]/refresh-token`.
- Added `/settings/blogger` Access Token Refresh UI with safe refresh summary, blockers, warnings, and side-effect summary.
- Updated publish OAuth gate summaries to report `tokenRefreshImplemented=true` while keeping automatic refresh out of the gate for R1.
- Refresh success can update only encrypted Blogger token secret storage and connection token metadata.
- Refresh failure returns safe blocker codes such as `token_refresh_invalid_grant_reconnect_required` or `token_refresh_unauthorized_client`.

Not executed or not implemented:

- Blogger publish/write, Blogger `posts.update`, additional draft save, content item mutation, publish approval mutation, publish execution attempt mutation, LLM call, deploy, push, or external service write beyond the Google OAuth token endpoint.
- R1 does not automatically refresh from publish readback or guarded publish execution; that remains a candidate for 9E-9C-R2.
