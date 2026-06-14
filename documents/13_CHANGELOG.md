# 13_CHANGELOG

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
