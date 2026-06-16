# 04_BLOGGER_API_SETUP

## 준비사항

1. 테스트용 Google 계정 준비
2. 테스트용 Blogger 블로그 생성
3. Google Cloud 프로젝트 생성
4. Blogger API 활성화
5. OAuth 동의 화면 설정
6. OAuth Client ID 생성
7. Redirect URI 등록

## 원칙

- 초기 개발은 반드시 테스트 블로그만 사용한다.
- 운영 블로그 발행은 MVP 검증 후 별도 승인 단계에서 진행한다.
- OAuth Secret과 Token은 Git에 포함하지 않는다.

## Patch 9A placeholder 정책

Patch 9A는 실제 OAuth/API 호출 없이 Blogger 연결 설정 placeholder만 추가한다.

- `/settings/blogger`에서 connection placeholder를 생성/수정한다.
- 저장 가능한 값은 name, 연결 대상 blog profile, Blogger blog ID/name, status, scope, 안전한 secret/token 메타데이터다.
- access token, refresh token, client secret 원문은 입력하거나 저장하지 않는다.
- OAuth 시작 버튼과 연결 테스트 버튼은 disabled placeholder다.
- Blogger blog list 조회, draft save, publish는 Patch 9B 이후에만 검토한다.

## Patch 9B OAuth dry-run 정책

Patch 9B는 OAuth state 저장과 authorization URL 생성 dry-run만 구현한다.

- `/api/settings/blogger/[id]/oauth/start`는 Google authorization URL을 생성하지만 Google API를 호출하지 않는다.
- OAuth state 원문은 DB에 저장하지 않고 `stateHash`만 저장한다.
- OAuth state는 10분 만료로 관리하며 callback dry-run에서 1회만 사용할 수 있다.
- `/api/settings/blogger/oauth/callback`은 state/code/error query를 받아 state 검증까지만 수행한다.
- callback dry-run은 authorization code 원문을 DB/API/UI/log에 저장하지 않는다.
- token exchange, access token 저장, refresh token 저장, Blogger blog list 조회, draft save, publish는 아직 구현하지 않는다.

## Patch 9C-1 token storage security foundation

Patch 9C-1은 실제 token exchange 전에 encrypted token storage 기반만 구현한다.

- `blogger_connection_secrets`는 encrypted secret value와 safe metadata만 저장한다.
- access token, refresh token, client secret 원문 컬럼은 만들지 않는다.
- API와 UI는 `encryptedValue`를 반환하지 않는다.
- `/api/settings/blogger/[id]/secret-status`는 저장된 secret metadata만 반환한다.
- `/api/settings/blogger/[id]/secret-self-test`는 서버 내부 dummy string으로 암복호화 helper만 검증하며 plaintext/ciphertext/encryptedValue를 반환하지 않는다.
- 암호화 key는 `BLOGGER_SECRET_ENCRYPTION_KEY`를 사용한다.
- key가 없으면 self-test는 safe failure를 반환하며 token exchange는 계속 비활성 상태다.
- token exchange, token refresh, Blogger API 호출, Blogger blog list 조회, draft save, publish는 아직 구현하지 않는다.

## Patch 9C-2 OAuth callback token exchange

Patch 9C-2는 OAuth callback에서 authorization code를 Google token endpoint로 교환한다.

- `/api/settings/blogger/oauth/callback`은 state를 검증한 뒤 token exchange 직전에 state를 consumed 처리한다.
- token exchange 실패 후 같은 state는 재사용하지 않는다.
- Google token endpoint는 `https://oauth2.googleapis.com/token`만 호출한다.
- `oauthClientIdRef`는 Google token endpoint의 `client_id`로 사용한다.
- `clientSecretRef`는 서버 내부 `process.env[clientSecretRef]` key name으로만 해석한다.
- `.env.local` 내용은 읽거나 출력하지 않는다.
- `BLOGGER_SECRET_ENCRYPTION_KEY`가 없으면 token exchange를 중단하고 safe error를 반환한다.
- access token과 refresh token은 `blogger_connection_secrets.encryptedValue`에만 저장한다.
- refresh token이 새로 내려오지 않으면 기존 refresh token을 유지한다.
- 새 refresh token도 기존 refresh token도 없으면 connection status는 `oauth_required`로 둔다.
- API/UI/log에는 authorization code, access token, refresh token, client secret, encryptedValue, raw token response를 반환하거나 저장하지 않는다.
- token refresh, Blogger API 호출, Blogger blog list 조회, draft save, publish는 아직 구현하지 않는다.

## Patch 9D-1 Blogger blog list read-only

Patch 9D-1은 저장된 encrypted access token을 서버 내부에서만 복호화해 Blogger blog list를 read-only로 조회한다.

- `POST /api/settings/blogger/[id]/blogs`는 `https://www.googleapis.com/blogger/v3/users/self/blogs`만 호출한다.
- `BloggerConnectionSecret.secretKind = access_token`만 사용하며 refresh token은 사용하지 않는다.
- access token 원문은 Authorization header에만 사용하고 API/UI/log/docs에 반환하지 않는다.
- 응답은 Blogger blog ID, name, URL, published, updated만 포함하는 safe DTO로 축소한다.
- access token이 없거나 만료된 경우 Blogger API를 호출하지 않고 safe error를 반환한다.
- `BLOGGER_SECRET_ENCRYPTION_KEY`가 없거나 복호화에 실패하면 safe server error를 반환한다.
- Blogger API 401/403은 raw error body 없이 safe message와 status suggestion만 반환한다.
- DB 저장, Blogger blog 선택 반영, token refresh, draft save, publish, scheduled publish는 구현하지 않는다.

## Patch 9D-2 Blogger blog selection

Patch 9D-2는 read-only로 조회한 Blogger blog 중 하나를 connection에 수동 반영한다.

- `POST /api/settings/blogger/[id]/blogs/select`는 body의 `blogId`만 받는다.
- 저장 전 현재 connected token으로 Blogger blog list를 다시 조회해 접근 가능한 blog인지 재검증한다.
- 조회 결과에 있는 blog만 `bloggerBlogId`, `bloggerBlogName`, `bloggerBlogUrl`, `bloggerBlogVerifiedAt`으로 저장한다.
- raw Blogger response, token, client secret, encrypted value는 반환하거나 저장하지 않는다.
- token refresh, draft save, publish, scheduled publish는 구현하지 않는다.

## Patch 9E-0 Blogger draft payload preview

Patch 9E-0은 Blogger posts API를 호출하기 전에 draft payload 후보와 readiness만 preview한다.

- `POST /api/content-items/[id]/blogger-draft-preview`는 Blogger API를 호출하지 않는다.
- target blog는 저장된 verified Blogger blog selection metadata만 사용한다.
- saved `draftHtml`만 HTML source로 사용하고 `draftMarkdown` 변환은 수행하지 않는다.
- 응답에는 target blog safe metadata, title candidate, HTML length/snippet, labels candidate, readiness flags, blocking issues, warnings를 포함한다.
- DB mutation, token refresh, draft save, publish, scheduled publish는 구현하지 않는다.

## Patch 9E-1 Blogger draft approval guard

Patch 9E-1은 Blogger posts API 호출 전 manual approval guard만 추가한다.

- `POST /api/content-items/[id]/blogger-draft-approval`은 서버에서 draft payload preview를 다시 계산한 뒤 approval snapshot을 저장한다.
- `DELETE /api/content-items/[id]/blogger-draft-approval`은 active approval을 soft revoke한다.
- approval snapshot은 hash와 safe metadata만 저장하며 full `draftHtml`은 저장하지 않는다.
- preview API는 approval status와 current snapshot match 여부를 반환한다.
- Blogger API read/write, token refresh, draft save, publish, scheduled publish는 구현하지 않는다.

## Patch 9E-2 Blogger draft save

Patch 9E-2는 승인된 payload snapshot에 한해서 Blogger draft save를 수행한다.

- `POST /api/content-items/[id]/blogger-draft-save`는 서버에서 draft payload preview와 approval hash를 다시 검증한다.
- 검증 통과 후 Blogger API `posts.insert`를 `isDraft=true`로 호출한다.
- request body의 blog id, title, HTML, hash는 신뢰하지 않는다.
- access token은 서버 내부에서만 복호화해 Authorization header에 사용한다.
- token refresh는 구현하지 않는다. expired/401/403은 safe error와 reconnect 안내로 처리한다.
- raw Blogger response/error body, token, encrypted value는 저장하거나 반환하지 않는다.
- 성공/실패 결과는 safe draft save metadata로만 저장한다.
- `posts.update`, publish, scheduled publish는 구현하지 않는다.

## Patch 9E-3 Blogger draft save live verification runbook

Patch 9E-3은 실제 Blogger draft save 기능을 추가로 확장하지 않고, live test blog 검증 절차와 retry/update 정책을 문서화한다.

Live verification prerequisite:

- connected OAuth access token이 있어야 한다.
- verified Blogger blog selection이 있어야 한다.
- saved `draftHtml`이 있어야 한다.
- `draftPayloadReady=true`여야 한다.
- active approval snapshot이 current preview snapshot과 match해야 한다.
- same approval에 successful draft save record가 없어야 한다.
- target Blogger blog가 test blog인지 사용자가 확인해야 한다.

Live write 전 고정 승인 문구:

```text
실제 Blogger test blog에 draft post가 생성됩니다. 실행해도 됩니까?
```

승인 후 운영 절차:

- 승인 후 1회만 `POST /api/content-items/[id]/blogger-draft-save`를 실행한다.
- 성공 시 safe DTO의 `bloggerPostId`, `bloggerPostUrl`, `savedAt`을 확인한다.
- 사용자가 Blogger UI에서 draft 상태로 생성되었는지 확인한다.
- 앱은 cleanup용 `posts.delete`를 구현하지 않는다.
- 테스트 draft 삭제가 필요하면 사용자가 Blogger UI에서 수동 삭제한다.

Retry/update policy:

- guard failure는 retry 대상이 아니다.
- `retryable=true` failure만 같은 approval snapshot에서 재시도 후보로 본다.
- same approval에 success record가 있으면 추가 `posts.insert`를 계속 차단한다.
- token expired/permission 문제는 OAuth reconnect 또는 Blogger blog selection 재확인 후 재시도한다.
- 새 approval이 생성되면 새 draft insert는 가능하지만 Blogger draft가 누적될 수 있다.
- `posts.update`는 Patch 9E-3에서 구현하지 않는다.
- 기존 draft update 정책은 별도 Patch 9E-4에서 update/retry semantics를 설계한 뒤 검토한다.

Publish readiness:

- successful draft save가 있으면 draft saved check는 pass할 수 있다.
- `publishReady=false`, top-level `ready=false`는 유지한다.
- publish/scheduled publish는 후속 패치 범위다.

## Patch 9E-5A Blogger token refresh readiness/design

Patch 9E-5A는 자동 token refresh 구현이 아니라 access token 만료 상태에 대한 readiness/design 및 UX 정리다.

Current behavior:

- `access_token_expired_reauth_required` means the stored Blogger access token is expired and a future Blogger write must not proceed.
- Draft Save Preflight keeps `canSaveDraft=false` while this blocker is present.
- Already saved Blogger drafts remain in Blogger and are not changed by the expired token state.
- Duplicate save protection for the same approval remains active with `blogger_draft_already_saved_for_approval`.
- The safe next action is OAuth re-connection through the existing Blogger settings flow.
- Automatic token refresh is not implemented and must not be implied by UI copy.

Security policy:

- Refresh token, access token, client secret, encrypted value, and raw OAuth response bodies must not be displayed in UI, logs, docs, or test output.
- Preflight responses may expose safe booleans such as token presence/expired status and `tokenRefreshImplemented=false`, but not secret material.
- `sideEffectSummary.tokenRefresh` must remain `false` until a later patch explicitly implements a refresh operation.

Before implementing token refresh in a later patch, decide:

1. Whether refresh should run automatically during preflight, only from a user-clicked reconnect/refresh action, or only immediately before a guarded write.
2. How to audit refresh attempts without storing raw token responses.
3. How to prevent duplicate refresh attempts and handle clock skew around expiry.
4. How refresh failure falls back to OAuth re-authorization.
5. Whether a refreshed token still requires a fresh Draft Save Preflight before Blogger write.

## Patch 9E-5B Blogger posts.update / retry policy planning

Patch 9E-5B is a policy and UX planning patch. It does not implement `posts.update`, retry execution, additional draft saves, publish, scheduled publish, or token refresh.

Current policy:

- A successful Blogger draft save for the current approval is final for that approval.
- `blogger_draft_already_saved_for_approval` is a protective duplicate-save blocker, not a recoverable error.
- The same approval snapshot must not trigger another `posts.insert`.
- If saved `draftHtml`, title, target blog, or approval snapshot changes, the old approval must not be reused for another draft mutation.
- Token-expired state blocks update/retry planning actions until OAuth re-connection is completed in the existing settings flow.

Retry policy:

- Retry may only be considered for a recorded `retryable=true` failure where Blogger draft creation is not known to have succeeded, such as a timeout, network failure, or 5xx response.
- Retry is not allowed for an already successful approval, auth/scope errors, token expiry, approval mismatch, content hash mismatch, or publish/scheduled-publish paths.

Before implementing `posts.update`, decide:

1. The update target identity: `bloggerPostId`, `bloggerBlogId`, approval id, title hash, and `draftHtml` hash.
2. Whether each update requires a new approval or a separate update-approval snapshot.
3. How to verify that the remote Blogger post is still a draft before updating.
4. What preflight and side-effect summary fields are required for update attempts.
5. How to display rollback limitations because Blogger updates change external service state.
6. How to audit update attempts without storing raw Blogger response bodies or full HTML.
7. How token expiry, duplicate update collisions, and concurrent edits are blocked.
8. How to keep `posts.update` separate from publish and scheduled publish.

## Patch 9E-6A Publish / scheduled publish policy design

Patch 9E-6A is a policy and UX planning patch. It does not implement Blogger publish, scheduled publish, a publish route, scheduled publish route, `posts.update`, additional draft save, token refresh, or local content status mutation.

Current behavior:

- A Blogger draft can be saved and visible in Blogger admin, but this is not publish-ready.
- Publish Readiness intentionally keeps `publishReady=false` and top-level `ready=false`.
- `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, and `draftHtml` are not changed by publish-readiness or this policy patch.
- Token-expired state blocks future Blogger writes until OAuth re-connection is completed.
- Draft update/retry policy remains separate from publish/scheduled publish policy.

Publish policy:

- Publish means converting an existing Blogger draft to a public post.
- It changes external Blogger state and may later require local `content_items.status` and `publishedAt` mutation, but that mutation requires a separate approved policy.
- Before publish, a dedicated publish preflight must confirm draft existence, target blog/post id, approval snapshot, token status, duplicate/update collision state, no prior publish success, manual publish approval, side-effect summary, and rollback warning acknowledgement.
- A publish preflight must explicitly show `sideEffectSummary.publish=true` before the user confirms the real action.

Scheduled publish policy:

- Scheduled publish means configuring a post to become public at a future time.
- Blogger API support details, timezone handling, schedule cancellation/update, failure handling, and local `scheduledAt`/status policy require separate design.
- Scheduled publish preflight must include every publish preflight requirement plus future `scheduledAt`, explicit timezone, schedule update/cancel policy, and `sideEffectSummary.scheduledPublish=true`.

Future local mutation design must decide:

1. Whether publish success changes `planned -> published` or needs an intermediate status.
2. Whether scheduled publish changes `planned -> scheduled` and when `scheduledAt` is recorded.
3. How to handle partial failure between Blogger success and local DB update.
4. Whether to create a pending state before Blogger write or update the DB only after success.
5. How to keep raw Blogger responses, tokens, and full HTML out of logs/audit metadata.
6. Whether `posts.update` is allowed after publish or scheduled publish.

## Patch 9E-6B Publish preflight dry-run

Patch 9E-6B adds a read-only publish preflight dry-run API and Content Detail UI block.

Route:

```text
POST /api/content-items/[id]/publish-preflight
```

This route does not call Blogger. It does not publish, schedule, update, insert, save another draft, refresh tokens, call LLMs, or mutate DB rows.

Current expected behavior:

- `canPublish=false`
- `canSchedulePublish=false`
- `blockingReasons` includes `publish_not_implemented`
- `blockingReasons` includes `scheduled_publish_not_implemented`
- `blockingReasons` includes `publish_approval_not_implemented`
- `blockingReasons` includes `content_item_mutation_policy_not_implemented`
- if safe token expiry metadata is expired, `blockingReasons` includes `access_token_expired_reauth_required`
- `sideEffectSummary` fields are all false

The dry-run summarizes the already saved Blogger draft state: target blog id/name/url, Blogger post id, draft saved timestamp, current draft approval status/match, draft hash prefix, duplicate save protection, and token expiry state.

Before real publish can be implemented, a later patch must define a publish approval snapshot, rollback acknowledgement, side-effect acknowledgement, token freshness policy, Blogger write audit policy, and local `content_items.status`/`publishedAt` mutation ordering.

## Patch 9E-6C Publish approval snapshot preview

Patch 9E-6C adds a read-only publish approval snapshot preview API and Content Detail UI block.

Route:

```text
POST /api/content-items/[id]/publish-approval-preview
```

This route does not persist approval. It does not call Blogger. It does not publish, schedule, update, insert, save another draft, refresh tokens, call LLMs, or mutate DB rows.

Current expected behavior:

- `canCreatePublishApproval=false`
- `canPublish=false`
- `canSchedulePublish=false`
- `blockingReasons` includes `publish_approval_persistence_not_implemented`
- `blockingReasons` includes `publish_not_implemented`
- `blockingReasons` includes `scheduled_publish_not_implemented`
- if safe token expiry metadata is expired, `blockingReasons` includes `access_token_expired_reauth_required`
- `approvalSnapshotHashPreview` is a non-empty SHA-256 preview hash
- `sideEffectSummary` fields are all false, including `dbWrite=false` and `approvalPersistence=false`

The snapshot preview contains non-secret fields only: content id/status, draft content hashes, title candidate, target Blogger blog safe metadata, Blogger post id, draft saved timestamp, draft approval id/hash, approval match status, publish mode, optional schedule fields, acknowledgement placeholders, and safe token state.

`approvalSnapshotHashPreview` is not a stored approval hash and does not mean publish approval was created.

## Patch 9E-6D Publish approval persistence policy

Patch 9E-6D documents the approval persistence policy before any real approval table or Blogger publish implementation.

This patch does not add a route, table, migration, token refresh flow, Blogger API write, publish call, scheduled publish call, `posts.update`, `posts.insert`, or additional draft save.

Future publish approval persistence must require:

- A verified saved Blogger draft record with Blogger post id and target blog safe metadata.
- A current Blogger draft approval snapshot match.
- A deterministic publish approval snapshot and hash.
- Explicit rollback acknowledgement.
- Explicit side-effect summary acknowledgement.
- Token state checked at approval time and rechecked before any later publish write.
- Approval invalidation rules for content hash, title, blog, post, schedule, timezone, token state, and status changes.
- A separate publish execution audit record for any later Blogger publish attempt.

Future publish execution remains separate:

- A stored publish approval should only authorize a later publish preflight; it should not publish by itself.
- Immediate publish and scheduled publish must show different side-effect summaries.
- Scheduled publish must include `scheduledAt` and timezone in the approval snapshot.
- Token refresh is still not implemented and must not be called implicitly.
- Raw Blogger responses, raw error bodies, access tokens, refresh tokens, client secrets, encrypted values, and full HTML must remain redacted.

## Patch 9E-7A Publish approval persistence storage

Patch 9E-7A adds local DB storage for publish approval snapshots.

New route:

```text
POST /api/content-items/[id]/publish-approval-save
```

The route stores a non-secret approval snapshot in `blogger_publish_approvals` only after:

- server-side publish approval snapshot regeneration
- client preview hash matches the server hash
- rollback acknowledgement is true
- side-effect summary acknowledgement is true
- approval persistence acknowledgement is true
- successful Blogger draft save metadata exists
- target Blogger blog id exists
- Blogger draft post id exists
- current draft approval snapshot still matches

Allowed side effect:

- local DB insert into `blogger_publish_approvals`, or idempotent reuse of an existing active approval with the same snapshot.

Still forbidden:

- Blogger API write
- Blogger publish
- scheduled publish
- `posts.update`
- `posts.insert`
- additional draft save
- token refresh or token endpoint call
- content item status/timestamp mutation
- LLM call

Access token expired policy:

- `expired_reauth_required` may be recorded in the approval snapshot.
- This does not authorize publish execution.
- Any future Blogger publish write must re-check token state and require OAuth reconnect or a later approved token refresh policy.
