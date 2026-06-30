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
