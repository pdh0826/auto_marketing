# 17_LLM_DISPATCH_AUDIT_SCHEMA_DESIGN

## Patch 9F-2V Scope

Patch 9F-2V is design-only.

It does not:

- change `prisma/schema.prisma`
- create a Prisma migration
- apply a migration
- create dispatch attempt rows
- create dispatch event rows
- store request envelopes
- store prompts
- call LLM providers
- create `llm_call_logs`
- mutate `content_items`
- create `draftMarkdown` or `draftHtml`
- write to Blogger
- publish or schedule posts
- reconnect OAuth or refresh tokens

## Proposed Tables

Future scaffold candidate:

- `blog_daily_content_llm_dispatch_attempts`
- `blog_daily_content_llm_dispatch_events`
- optional `blog_daily_content_llm_dispatch_artifacts`

The attempts table should store one row per future LLM dispatch attempt. It should link to the daily plan, daily plan item, target content item, and operator approval. It should store safe provider/model metadata, prompt/request hashes, dispatch gate version, health-check reference or hash, redacted error metadata, and boolean side-effect markers.

The events table should be append-only and capture safe lifecycle events such as gate preview, queued, started, provider request prepared, provider request sent, provider response received, validation started, validation failed, content mutation deferred, content mutation started, content mutation committed, and content mutation failed.

The optional artifacts table should store only redacted/hash metadata for prompt preview, request envelope preview, redacted provider request/response, and validated candidates.

## Idempotency

- Raw idempotency keys must not be stored.
- Store only `idempotencyKeyHash`.
- Future unique constraint: `unique(planItemId, contentItemId, attemptPurpose, idempotencyKeyHash)`.
- Duplicate idempotency requests should return existing attempt readback without re-execution.
- Failed attempt retry should require a new idempotency key unless a later policy explicitly allows replay.

## Redaction

- Raw secrets, API keys, bearer values, OAuth token material, and credential values must not be stored.
- Raw provider request and response bodies are not stored by default.
- If future debug artifacts are needed, store only redacted artifacts with hashes and bounded previews.
- Prompt hash and request envelope hash are allowed.
- Error messages must be redacted before storage.

## Retention

- Attempt metadata: long-lived.
- Event metadata: long-lived.
- Redacted artifacts: configurable future policy.
- Raw provider payload retention: not applicable because raw payloads are not stored.
- Cleanup jobs should be separate future patches.

## Migration Sequencing

Recommended sequence:

1. `9F-2W — LLM dispatch audit schema scaffold, no apply/no provider call/no content mutation`
2. `9F-2W-APPLY — Apply LLM dispatch audit migration only, no rows/no provider call/no content mutation`

Schema scaffolding and migration apply must remain separate from provider dispatch, LLM calls, and content mutation.

## Patch 9F-2W Scaffold Result

Patch 9F-2W moves the 9F-2V design into file-level scaffold only.

Scaffolded Prisma models:

- `BlogDailyContentLlmDispatchAttempt`
- `BlogDailyContentLlmDispatchEvent`
- `BlogDailyContentLlmDispatchArtifact`

Scaffolded tables:

- `blog_daily_content_llm_dispatch_attempts`
- `blog_daily_content_llm_dispatch_events`
- `blog_daily_content_llm_dispatch_artifacts`

Migration scaffold:

- `prisma/migrations/20260620000300_add_llm_dispatch_audit_schema/migration.sql`

9F-2W intentionally does not apply this migration. The DB tables should remain absent until an explicit `9F-2W-APPLY` patch.

The scaffold preview route is:

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-schema-scaffold-preview`

The route is read-only and reports:

- `scaffoldOnly=true`
- `schemaModified=true`
- `migrationCreated=true`
- `migrationApplied=false`
- `dbWrite=false`
- `providerNetworkCallAttempted=false`
- `llmCallAttempted=false`
- `contentMutationAttempted=false`

`9F-2W-APPLY` must remain separate from provider dispatch. Applying the migration must not create attempt/event/artifact rows, store prompts, store request envelopes, call providers, create `llm_call_logs`, mutate `content_items`, or call Blogger.

## Patch 9F-2W-APPLY Apply Result

Patch 9F-2W-APPLY applies the scaffolded migration only.

Applied migration:

- `20260620000300_add_llm_dispatch_audit_schema`

Created DB tables:

- `blog_daily_content_llm_dispatch_attempts`
- `blog_daily_content_llm_dispatch_events`
- `blog_daily_content_llm_dispatch_artifacts`

Expected row counts immediately after apply:

- attempts: `0`
- events: `0`
- artifacts: `0`

Readback route:

- `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-migration-apply-readback`

The route is read-only and reports:

- `migrationApplyOnly=true`
- `migrationApplied=true`
- `schemaTablesCreated=true`
- `rowsCreatedByMigration=false`
- `providerNetworkCallAttempted=false`
- `llmCallAttempted=false`
- `contentMutationAttempted=false`
- `bloggerWriteAttempted=false`

Next recommended patch:

- `9F-2X — LLM dispatch attempt readback scaffold, no provider call/no content mutation`

## Patch 9F-2X Readback And Empty-State Semantics

9F-2X adds a read-only readback scaffold on top of the applied audit tables.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-readback`.
- Expected first state: attempts/events/artifacts global counts `0 / 0 / 0`.
- Expected target-scoped state for the daily content fixture: attempts/events/artifacts counts `0 / 0 / 0`.
- `emptyState=true` means the schema is applied but no future LLM dispatch attempt lifecycle has started.
- `latestTargetAttempt`, `latestTargetEvent`, and `latestTargetArtifact` should be `null` until a later explicit attempt-creation patch.
- Current lifecycle status is `not_started`.
- Attempt creation, event insertion, artifact insertion, dispatch, provider network calls, LLM calls, `llm_call_logs`, and content mutation remain disabled.
- Future readbacks must expose safe scalar metadata, hashes, statuses, timestamps, and redacted error metadata only.
- Raw prompts, raw request bodies, raw response bodies, full generated candidates, secret values, token values, and raw env values must not be returned by the API or UI.

Next patch candidate:

- `9F-2Y — LLM dispatch attempt creation gate preview, no rows/no provider call/no content mutation`

## Patch 9F-2Y Attempt Creation Gate Semantics

9F-2Y adds a read-only gate preview before any future dispatch attempt row can be persisted.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-creation-gate-preview`.
- Expected first state: `targetScopedExistingAttempts=0`, `latestTargetAttempt=null`, and attempts/events/artifacts counts `0 / 0 / 0`.
- Attempt creation remains blocked by feature flags, confirmation phrase, idempotency key, provider health check, and patch policy.
- Future attempt persistence must store `idempotencyKeyHash`, not raw idempotency keys.
- Future confirmation material should be hash-only if persisted.
- Raw prompts, raw request bodies, raw response bodies, full generated candidates, secret values, token values, and raw env values must not be returned by the API or UI.
- 9F-2Y does not create attempt/event/artifact rows and does not store request envelopes or prompts.

Next patch candidate:

- `9F-2Z — Gated LLM dispatch attempt creation persistence, no provider call/no content mutation`

## Patch 9F-2Z Attempt Creation Persistence Semantics

9F-2Z persists the first audit attempt row without dispatching or mutating content.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-creation`.
- Preview mode returns safe metadata and keeps attempts/events/artifacts counts unchanged.
- Apply mode requires the dedicated attempt creation feature flag, exact confirmation phrase, idempotency key, valid target fixture, persisted operator approval, existing audit tables, and no conflicting target attempt.
- Created rows use `attemptPurpose=draft_generation_execution` and `attemptStatus=created_pending_dispatch_gate`.
- `idempotencyKeyHash` and `confirmationPhraseHash` are stored; raw idempotency keys and raw confirmation phrases are not stored.
- `requestEnvelopeHash`, `promptSha256`, `promptVersion`, `promptQualityChecklistVersion`, and `dispatchGateVersion` are safe hash/version metadata only.
- `providerNetworkCallAttempted`, `llmCallAttempted`, `llmCompletionReceived`, `contentMutationAttempted`, `draftMutationAttempted`, and `bloggerWriteAttempted` are initially false.
- No dispatch events or artifacts are created in 9F-2Z.
- Duplicate apply with the same `planItemId`, `contentItemId`, `attemptPurpose`, and `idempotencyKeyHash` returns the existing attempt by unique idempotency semantics.

Next patch candidate:

- `9F-3A — LLM dispatch attempt event creation preview, no provider call/no content mutation`

## Patch 9F-3A Event Preview Semantics

9F-3A previews the first event row without inserting it.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-event-preview`.
- Expected starting counts: attempts/events/artifacts `1 / 0 / 0`.
- Candidate event fields: `attemptId`, `eventType=dispatch_attempt_created`, `eventStatus=recorded_audit_only`, safe event message, safe payload hash, `rawSecretStored=false`, `rawTokenStored=false`.
- The preview may show whether duplicate target events already exist, but it must not insert or mutate rows.
- Event payload preview must not include raw prompt text, raw request bodies, raw response bodies, full generated candidates, secret values, token values, or raw env values.

Next patch candidate:

- `9F-3B — Gated LLM dispatch attempt event creation persistence, no provider call/no content mutation`

## Patch 9F-3B Event Persistence Semantics

9F-3B creates the first event row under explicit gate.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-event-creation`.
- Expected pre-apply counts: attempts/events/artifacts `1 / 0 / 0`.
- Expected post-apply counts: attempts/events/artifacts `1 / 1 / 0`.
- Created row fields: `attemptId`, `eventType=dispatch_attempt_created`, `eventStatus=recorded_audit_only`, safe event message, redacted payload JSON, `rawSecretStored=false`, `rawTokenStored=false`.
- The redacted payload may include idempotency and confirmation hashes, but must not store raw idempotency keys or raw confirmation phrases.
- Duplicate target event requests return the existing event and must not create another row.
- Artifact rows remain absent until 9F-3D or a later gated persistence patch.

Next patch candidate:

- `9F-3C — LLM dispatch audit artifact preview, no provider call/no content mutation`

## Patch 9F-3C Artifact Preview Semantics

9F-3C previews the first artifact row without inserting it.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-artifact-preview`.
- Expected counts: attempts/events/artifacts `1 / 1 / 0`.
- Candidate artifact fields: `attemptId`, `artifactKind=prompt_request_hash_bundle`, `artifactHash`, `artifactStorageMode=hash_only`, `artifactRedactionStatus=redacted_or_hash_only`, bounded safe preview, `rawSecretStored=false`, `rawTokenStored=false`.
- The preview must not include raw prompts, raw request bodies, raw response bodies, full generated candidates, secret values, token values, or raw env values.
- Artifact insert remains disabled until 9F-3D.

Next patch candidate:

- `9F-3D — Gated LLM dispatch audit artifact persistence, no provider call/no content mutation`

## Patch 9F-3D Artifact Persistence Semantics

9F-3D creates the first artifact row under explicit gate.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-artifact-creation`.
- Expected pre-apply counts: attempts/events/artifacts `1 / 1 / 0`.
- Expected post-apply counts: attempts/events/artifacts `1 / 1 / 1`.
- Created row fields: `attemptId`, `artifactKind=prompt_request_hash_bundle`, `artifactHash`, `artifactStorageMode=hash_only`, `artifactRedactionStatus=redacted_or_hash_only`, bounded safe preview, `rawSecretStored=false`, `rawTokenStored=false`.
- The artifact must not store raw prompts, raw request bodies, raw response bodies, full generated candidates, secret values, token values, or raw env values.
- Duplicate target artifact requests return the existing artifact and must not create another row.

Next patch candidate:

- `9F-3E — Provider health-check positive gated run`

## Patch 9F-3E Health-Check Positive Run Audit Boundary

9F-3E executes only a gated provider metadata/connectivity health-check.

- It does not create dispatch event or artifact rows.
- It does not persist raw provider response bodies, raw provider response headers, prompts, request bodies, generated content, secret values, token values, or env values.
- Existing attempts/events/artifacts counts remain `1 / 1 / 1`.

Next patch candidate:

- `9F-3F — Provider health-check audit/readback`

## Patch 9F-3F Provider Health-Check Readback Semantics

9F-3F uses the existing audit schema for readback only.

- Route: `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-readback`.
- It reads latest attempt `healthCheckReferenceId` / `healthCheckSummaryHash` plus target-scoped attempts/events/artifacts counts.
- It does not insert health-check event/artifact rows because 9F-3E did not persist a provider result object.
- It returns no raw prompt, raw request body, raw provider response body/header, secret value, token value, full candidate, or generated content.
- Attempts/events/artifacts counts remain `1 / 1 / 1`.

Next patch candidate:

- `9F-3G — LLM dispatch final preflight`

## Patch 9F-3G Final Preflight Audit Semantics

9F-3G reads existing audit rows as part of the final pre-dispatch check.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-final-preflight`.
- It requires no new schema and inserts no rows.
- It treats the existing attempt/event/artifact rows as prerequisites for the later plan lock.
- It returns no raw prompt, raw request body, raw provider response body/header, secret value, token value, full candidate, or generated content.
- Attempts/events/artifacts counts remain `1 / 1 / 1`.

Next patch candidate:

- `9F-3H — LLM dispatch execution plan lock`

## Patch 9F-3H Execution Plan Lock Audit Semantics

9F-3H computes an execution plan lock candidate without adding audit rows.

- Route: `POST /api/daily-content-plans/draft-generation-llm-dispatch-execution-plan-lock`.
- It derives `lockHash` from a stable JSON envelope based on final preflight readiness.
- It does not persist a lock row or mutate the existing attempt/event/artifact rows in this patch.
- It returns no raw prompt, raw request body, raw provider response body/header, secret value, token value, full candidate, or generated content.
- Attempts/events/artifacts counts remain `1 / 1 / 1`.

Next patch candidate:

- `9F-3I — Gated single LLM dispatch, no content mutation`

## Patch 9F-3I Dispatch Execution Audit Semantics

9F-3I is the first patch that may add provider-dispatch audit rows after an explicit execute request.

- Preview mode adds no rows and performs no provider/LLM call.
- Execute success adds one `llm_call_logs` row, one `llm_dispatch_provider_response_received` event, one `llm_response_metadata_hash` hash-only artifact, and updates the existing dispatch attempt.
- Execute failure adds one failed `llm_call_logs` row, one `llm_dispatch_provider_call_failed` event, and updates the existing dispatch attempt with safe error metadata.
- Attempt metadata may include safe ids, lock hash, response hash, response length, latency/token counts, and redaction booleans.
- Event/artifact payloads must not contain raw prompt, raw request body, raw provider response body/header, full generated candidate, API key, token, secret, or encrypted value.
- The dispatch attempt records provider/LLM call attempts but continues to record `contentMutationAttempted=false` and `bloggerWriteAttempted=false`.

Next patch candidate:

- `9F-3J — LLM dispatch result readback and no-content-mutation verification`

## Patch 9F-3J Response Readback Audit Semantics

9F-3J reads the 9F-3I dispatch audit result without adding rows.

- It reads only safe metadata from the latest dispatch attempt, provider response event, hash-only response artifact, and dispatch `llm_call_logs`.
- It compares response hash prefixes and response lengths across safe metadata to detect mismatch.
- It reports `responseArtifactAlreadyPersisted=true` when the 9F-3I hash-only artifact exists.
- It keeps `responseArtifactPersistedNow=false`, `dbWrite=false`, `auditEventMutation=false`, `auditArtifactMutation=false`, and `llmCallLogMutation=false`.
- It returns no raw prompt, raw request body, raw provider response body/header, full generated candidate, secret, token, or encrypted value.

Next patch candidate:

- `9F-3K — LLM output quality validation preview`

## Patch 9F-3K Output Validation Preview Audit Semantics

9F-3K is a read-only validation preview and does not add rows.

- It reads 9F-3J safe response metadata and produces a validation readiness summary.
- Because no full Markdown candidate is stored, content-based checks are blocked rather than fabricated.
- It keeps `dbWrite=false`, `auditEventMutation=false`, `auditArtifactMutation=false`, `llmCallLogMutation=false`, and `validationArtifactPersistedNow=false`.
- A future 9F-3L patch may persist this blocked validation preview as audit metadata, but 9F-3K itself only reads.
- It returns no raw prompt, raw request body, raw provider response body/header, full generated candidate, secret, token, or encrypted value.

Next patch candidate:

- `9F-3L — Gated output validation persistence`

## Patch 9F-3L Output Validation Persistence Audit Semantics

9F-3L adds a gated way to persist the validation preview as audit metadata.

- Preview mode adds no rows.
- Apply mode can add one `llm_output_quality_validation_previewed` event and one `llm_output_quality_validation_result` hash-only artifact.
- Apply requires feature flag, exact confirmation phrase, idempotency key, validation candidate, and no duplicate validation artifact.
- Persisted payloads include validation hash, readiness booleans, check counts, and redaction booleans only.
- It stores no raw prompt, raw request body, raw provider response body/header, full generated candidate, secret, token, or encrypted value.
- It keeps `contentMutationAttempted=false`, `draftMutationAttempted=false`, and `bloggerWriteAttempted=false`.

Next patch candidate:

- `9F-3M — Markdown candidate acceptance gate`

## Patch 9F-3M Markdown Candidate Acceptance Audit Semantics

9F-3M is read-only and adds no audit rows.

- It reads validation readiness and linked content item state.
- It reports candidate acceptance blockers, primarily missing candidate Markdown and validation not ready.
- It keeps `dbWrite=false`, `auditEventMutation=false`, `auditArtifactMutation=false`, and `llmCallLogMutation=false`.
- It stores and returns no raw prompt, raw request body, raw provider response body/header, full generated candidate, secret, token, or encrypted value.

Next patch candidate:

- `9F-3N — draftMarkdown mutation gate preview`

## Patch 9F-3N draftMarkdown Mutation Preview Audit Semantics

9F-3N is read-only and adds no audit rows.

- It previews whether a `draftMarkdown` mutation can be described.
- It is currently blocked because no accepted Markdown candidate exists.
- It keeps `dbWrite=false`, `contentItemMutation=false`, and `draftMarkdownMutation=false`.

Next patch candidate:

- `9F-3O — Gated draftMarkdown persistence`

## Patch 9F-3O-prep Candidate Text Artifact Policy Audit Semantics

9F-3O-prep is read-only and adds no audit rows.

- It checks whether the latest dispatch attempt has a controlled `llm_candidate_markdown_text` artifact.
- Existing `llm_response_metadata_hash` artifacts remain hash-only and are not used to reconstruct candidate text.
- It keeps `dbWrite=false`, `auditEventMutation=false`, `auditArtifactMutation=false`, `llmCallLogMutation=false`, `contentItemMutation=false`, and `draftMarkdownMutation=false`.
- It returns no raw prompt, raw request body, raw provider response body/header, full generated candidate, secret, token, or encrypted value.

Next patch candidate:

- `9F-3I-R1 — gated redispatch with candidate text artifact`, or an explicitly approved manual candidate text import path.

## Patch 9F-3I-R1 Candidate Text Redispatch Audit Semantics

9F-3I-R1 may create a second dispatch attempt dedicated to controlled candidate text storage.

- Attempt purpose: `daily_content_draft_generation_candidate_text_redispatch`.
- Candidate artifact kind: `llm_candidate_markdown_text`.
- Candidate artifact storage mode: `controlled_candidate_text`.
- The full Markdown body may be stored in the artifact row for later server-side validation/persistence, but API/UI responses must return only hash, length, artifact ids, and safe metadata.
- It may create one `llm_call_logs` row, one response event, one hash-only response metadata artifact, and one controlled candidate text artifact.
- It must keep `contentMutationAttempted=false`, `draftMutationAttempted=false`, and `bloggerWriteAttempted=false`.

## Patch 9F-3O draftMarkdown Persistence Audit Semantics

9F-3O consumes existing audit artifacts and does not add LLM dispatch audit rows.

- It reads the controlled candidate artifact and mutation gate state.
- It writes only `content_items.draftMarkdown`.
- It does not create or mutate dispatch attempts, dispatch events, dispatch artifacts, or `llm_call_logs`.
- Blogger write/publish, OAuth reconnect, and token refresh remain disabled.
- The approved apply leaves dispatch counts unchanged at attempts/events/artifacts `2/3/4` and `llm_call_logs=24`.
- Any future HTML conversion gate should read the persisted `draftMarkdown` without creating LLM dispatch audit rows unless a new provider call is explicitly approved.

## Patch 9F-3P draftHtml Conversion Preview Audit Semantics

9F-3P does not participate in LLM dispatch audit persistence.

- It reads `content_items.draftMarkdown` and deterministic renderer output metadata.
- It does not create or mutate dispatch attempts, dispatch events, dispatch artifacts, or `llm_call_logs`.
- It does not store preview HTML as an audit artifact.
- Blogger write/publish, OAuth reconnect, and token refresh remain disabled.

## Patch 9F-3Q draftHtml Persistence Audit Semantics

9F-3Q is a content item mutation, not an LLM dispatch audit mutation.

- It reads deterministic renderer metadata and writes only `content_items.draftHtml`.
- It does not create or mutate dispatch attempts, dispatch events, dispatch artifacts, or `llm_call_logs`.
- It does not store full preview HTML as an audit artifact.
- Blogger write/publish, OAuth reconnect, and token refresh remain disabled.
