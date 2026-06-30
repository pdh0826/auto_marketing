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
