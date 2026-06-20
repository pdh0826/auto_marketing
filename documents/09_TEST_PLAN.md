# 09_TEST_PLAN

## 기본 검증

```bash
npm run lint
npm run typecheck
npm run build
```

## 9E Publish Milestone Closeout Baseline

Expected current state after `9E-9D-APPLY`:

- `content_items.status = published`
- `content_items.publishedAt = 2026-06-19 00:44:03`
- `content_items.scheduledAt = null`
- `draftMarkdown md5 = 9e0921e7edc9e4a8464a0a52ba369d3d`
- `draftHtml md5 = a7393df8fb009566201daeea18796027`
- `draftHtml length = 2789`
- `blogger_publish_execution_attempts.status = success`
- `blogger_publish_execution_attempts.bloggerPostId = 6376467965797870330`
- `blogger_publish_execution_attempts.bloggerResponseRedactedJson is not null`
- `errorType/errorCode/errorMessageRedacted = null`
- `contentStatusBefore = planned`
- `contentStatusAfter = published`
- `contentMutationPlanned = true`
- `contentMutationCompleted = true`
- `publishedAtApplied = 2026-06-19 00:44:03`
- `blogger_publish_approvals.invalidatedAt = null`
- counts: `blogger_draft_saves / blogger_draft_approvals / blogger_publish_approvals / blogger_publish_execution_attempts / llm_call_logs = 1 / 1 / 1 / 1 / 22`

Closeout verification:

- `9E-9B-LIVE` completed one guarded Blogger `posts.publish` call for post `6376467965797870330`.
- `9E-9C` readback verified the external Blogger post exists, has the expected URL, and appears published.
- `9E-9C-R1` implemented token refresh and confirmed `tokenRefreshImplemented=true`.
- `9E-9D` added guarded post-publish reconciliation preview/apply code with feature flag and confirmation phrase.
- `9E-9D-APPLY` reconciled local DB once after explicit approval: content is now `published` and the publish execution attempt is `success`.

Historical pre-apply baseline:

- Before `9E-9D-APPLY`, the expected local state was `content_items.status=planned`, `publishedAt=null`, and `blogger_publish_execution_attempts.status=planned_only`.
- That planned/planned_only state is now a historical pre-reconciliation baseline, not the current session-start baseline.

Next session start DB guard should use the published/success values above. The closeout documentation patch must not run Blogger publish/write, `posts.update`, draft save, OAuth reconnect, token refresh, DB mutation, content mutation, publish attempt mutation, or LLM calls.

## Patch 9F-1A Blog Operation Profile + Default Publish Policy Preset

- Prisma model/table `BlogOperationProfile` / `blog_operation_profiles` should exist.
- `blog_operation_profiles_count` should remain `0` during 9F-1A validation unless rows existed before the patch.
- `POST /api/blog-operation-profiles/default-policy` should support `mode=preview` and return the `safe_manual_publish` proposed profile without DB writes.
- Preview should show `allowAutoPublish=false`, `allowScheduledPublish=false`, `requireFinalHumanApproval=true`, `requireOAuthGate=true`, `requireReadbackAfterPublish=true`, and `requirePostPublishReconciliation=true`.
- Preview warnings should include `blog_operation_profile_preview_only`, `safe_manual_publish_preset_selected`, `auto_publish_disabled_by_default`, and `scheduled_publish_disabled_by_default`.
- `mode=apply` is implemented but must be blocked unless `BLOG_OPERATION_PROFILE_WRITE_ENABLED=true` and confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE` are present.
- Feature flag disabled apply-negative smoke should return `applyAttempted=false`, `applyBlocked=true`, `applyOk=false`, blocker `blog_operation_profile_write_feature_flag_disabled`, and `sideEffectSummary.dbWrite=false`.
- `/settings/blogger` should show a `Blog Operation Profile` preview section and keep Apply/Save disabled with explicit CLI/feature-flag guidance.
- 9F-1A must not wire operation profiles into publish execution gates yet.
- 9F-1A validation must not run Blogger publish/write, `posts.update`, draft save, OAuth reconnect, token refresh, content generation, LLM calls, content mutation, publish approval mutation, publish attempt mutation, or profile row apply/write.
- The 9E published/success milestone baseline must remain unchanged after preview and apply-negative smoke.

## Patch 9F-1B Create/Apply Default Blog Operation Profile

- `blog_operation_profiles_count` should be `0` before the first controlled apply, unless a matching idempotent profile row already exists.
- Pre-apply preview for target Blogger blog `3065973490356135805` / `급등포착` / `https://mathlearningappl.blogspot.com/` should return `mode=preview`, `profileFound=false`, `profileWouldBeCreated=true`, `applyAttempted=false`, `applyOk=false`, `blockingReasons=[]`, and `sideEffectSummary.dbWrite=false`.
- The single allowed apply requires `BLOG_OPERATION_PROFILE_WRITE_ENABLED=true` and confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE`.
- Successful apply should return `mode=apply`, `featureFlagEnabled=true`, `confirmationPhraseAccepted=true`, `applyAttempted=true`, `applyBlocked=false`, `applyOk=true`, and `sideEffectSummary.dbWrite=true`.
- Successful apply must keep Blogger, OAuth, token refresh, content mutation, approval mutation, attempt mutation, external send, and LLM side-effect flags false.
- DB readback after apply should show exactly one profile row for `targetBloggerBlogId=3065973490356135805`.
- The created row should have `profileName=Default`, `status=active`, `operationMode=approval_required`, `defaultPublishPolicyPreset=safe_manual_publish`, `timezone=Asia/Seoul`, `allowAutoPublish=false`, `allowScheduledPublish=false`, `requireOAuthGate=true`, `requireFinalHumanApproval=true`, `requireExternalWriteRiskAck=true`, `requireRollbackPlanAck=true`, `requireReadbackAfterPublish=true`, and `requirePostPublishReconciliation=true`.
- After disabling `BLOG_OPERATION_PROFILE_WRITE_ENABLED`, preview should return `profileFound=true`, `profileWouldBeCreated=false`, `profileWouldBeUpdated=false`, and `sideEffectSummary.dbWrite=false`.
- After disabling the write flag, apply-negative smoke should return blocker `blog_operation_profile_write_feature_flag_disabled`, `applyAttempted=false`, `applyBlocked=true`, `applyOk=false`, and `sideEffectSummary.dbWrite=false`.
- The 9E published/success milestone baseline must remain unchanged: content status `published`, published timestamp `2026-06-19 00:44:03`, draft hashes unchanged, publish attempt status `success`, and counts `1 / 1 / 1 / 1 / 22`.
- 9F-1B must not run Blogger publish/write, `posts.update`, draft save, OAuth reconnect, token refresh, content generation, LLM calls, content mutation, publish approval mutation, or publish attempt mutation.
- Operation profiles should not affect publish gates yet; that is deferred to `9F-1C` as read-only advisory wiring.

## Patch 9F-1C Operation Profile Advisory In Publish Gate

- `POST /api/content-items/[id]/publish-oauth-gate` should include `operationProfileAdvisorySummary`.
- `operationProfileAdvisorySummary.checked` should be `true`.
- `advisoryOnly=true`, `policyEnforced=false`, `blockerImpact=false`, and `executionPermissionImpact=false`.
- `profileLookupAttempted=true`, `profileFound=true`, and `targetBloggerBlogId=3065973490356135805` for the current test content item.
- The advisory should show `operationMode=approval_required`, `defaultPublishPolicyPreset=safe_manual_publish`, `allowAutoPublish=false`, `allowScheduledPublish=false`, `requireOAuthGate=true`, `requireFinalHumanApproval=true`, `requireReadbackAfterPublish=true`, and `requirePostPublishReconciliation=true`.
- `operationProfileAdvisorySummary.blockingReasons` must be an empty array.
- The advisory side-effect summary should report `dbRead=true`, `dbWrite=false`, Blogger read/write/publish/update/draft save false, token refresh false, OAuth reconnect false, content/approval/attempt mutation false, LLM false, and external send false.
- Profile missing, mismatch, or preset problems must stay in advisory warnings only and must not be added to top-level `blockingReasons`.
- 9F-1C must not change existing `canProceedToPublishExecution`, `canProceedToScheduledPublishExecution`, `canExecutePublish`, `canExecuteScheduledPublish`, `canPublish`, `canSchedulePublish`, or existing publish blocker semantics.
- Content Detail should show a `Blog Operation Profile Advisory` result block after running Publish OAuth Gate.
- 9F-1C must not run Blogger publish/write, `posts.update`, draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content mutation, publish approval mutation, or publish attempt mutation.
- DB baseline must remain unchanged: 9E published/success values unchanged, counts `1 / 1 / 1 / 1 / 22`, and `blog_operation_profiles_count=1`.

## Patch 9F-1D Operation Profile Exception Dashboard Draft

- `POST /api/content-items/[id]/publish-oauth-gate` should include `operationProfileExceptionDashboardSummary`.
- `POST /api/blog-operation-profiles/default-policy` preview should also include `operationProfileExceptionDashboardSummary` without breaking `blogOperationProfileSummary`.
- The dashboard should report `checked=true`, `dashboardVersion=9F-1D`, `dashboardMode=exception_only_draft`, `advisoryOnly=true`, `policyEnforced=false`, `blockerImpact=false`, and `executionPermissionImpact=false`.
- Current baseline should return `profileFound=true`, `profileHealthy=true`, `defaultPublishPolicyPreset=safe_manual_publish`, `allowAutoPublish=false`, `allowScheduledPublish=false`, `requireFinalHumanApproval=true`, and `requireOAuthGate=true`.
- Dashboard `blockingReasons` must remain an empty array.
- Profile-related issues must appear only as dashboard focus items/advisory warnings and must not leak into top-level publish `blockingReasons`.
- `/settings/blogger` should show a compact Operation Profile status card, exception dashboard focus items first, and detailed policy fields in a collapsed section.
- Content Detail Publish OAuth Gate should show the Operation Profile exception dashboard before detailed advisory metadata.
- 9F-1D must not change existing `canProceedToPublishExecution`, `canProceedToScheduledPublishExecution`, `canExecutePublish`, `canExecuteScheduledPublish`, `canPublish`, `canSchedulePublish`, or publish blocker semantics.
- 9F-1D must not run Blogger publish/write, `posts.update`, draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content mutation, publish approval mutation, or publish attempt mutation.
- DB baseline must remain unchanged: 9E published/success values unchanged, counts `1 / 1 / 1 / 1 / 22`, and `blog_operation_profiles_count=1`.

## Patch 9F-1E Policy-enforced Publish Gate Simulation

- `POST /api/blog-operation-profiles/default-policy` should include `operationProfilePolicySimulationSummary`.
- `POST /api/content-items/[id]/publish-oauth-gate` should include `operationProfilePolicySimulationSummary`.
- The simulation should report `checked=true`, `simulationVersion=9F-1E`, `simulationMode=policy_enforcement_dry_run`, `advisoryOnly=true`, `policyEnforced=false`, `actualBlockerImpact=false`, and `actualExecutionPermissionImpact=false`.
- Current baseline should return `profileFound=true`, `profileHealthy=true`, `profileWouldBeApplicable=true`, and `defaultPublishPolicyPreset=safe_manual_publish`.
- Simulated policy state should require OAuth gate, final human approval, external write risk acknowledgement, rollback plan acknowledgement, readback, and post-publish reconciliation.
- Simulated policy state should keep auto publish disabled, scheduled publish disabled, and publish without human approval disabled.
- `simulatedAdditionalBlockers` may include `operation_profile_policy_*` codes, but these codes must stay inside the simulation summary.
- Top-level publish `blockingReasons` must not include `operation_profile*` or `operation_profile_policy*` codes from the simulation.
- The simulation `blockingReasons` array must remain empty and side-effect summary must report DB write false, Blogger write/publish/update/draft save false, token refresh false, OAuth reconnect false, content/approval/attempt mutation false, LLM false, and external send false.
- 9F-1E must not change existing `canProceedToPublishExecution`, `canProceedToScheduledPublishExecution`, `canExecutePublish`, `canExecuteScheduledPublish`, `canPublish`, `canSchedulePublish`, or publish blocker semantics.
- `/settings/blogger` should show a policy simulation block explaining that auto publish and scheduled publish remain disabled and human approval/readback/reconciliation remain required.
- Content Detail Publish OAuth Gate should show the policy simulation block with simulated policy state, simulated blockers, simulated decision, and notes.
- 9F-1E must not run Blogger publish/write, `posts.update`, draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content mutation, publish approval mutation, publish attempt mutation, migration, deploy, or push.
- DB baseline must remain unchanged: 9E published/success values unchanged, counts `1 / 1 / 1 / 1 / 22`, and `blog_operation_profiles_count=1`.

## Patch 9E-9D Post-publish DB Reconciliation

- `POST /api/content-items/[id]/post-publish-reconciliation` route가 있어야 한다.
- 기본 `mode=preview`는 DB read와 필요한 경우 Blogger read-only GET만 수행하며, `content_items`와 `blogger_publish_execution_attempts`를 변경하지 않아야 한다.
- Preview 결과는 readback 상태, external Blogger published 판단, internal DB before 상태, proposed content item patch, proposed attempt patch, blockers/warnings, side-effect summary를 표시해야 한다.
- `mode=apply`는 `BLOGGER_POST_PUBLISH_RECONCILIATION_APPLY_ENABLED=true`, 정확한 confirmation phrase, content/attempt mutation acknowledgement, final DB reconciliation approval, readbackOk, expected post/blog/timestamp match, planned internal DB 상태가 모두 맞을 때만 transaction으로 허용되어야 한다.
- Feature flag disabled 상태의 apply negative smoke는 `post_publish_reconciliation_apply_feature_flag_disabled`로 차단되어야 하며 DB write/content mutation/attempt mutation/Blogger write/publish가 모두 false여야 한다.
- Preview/negative smoke에서는 실제 apply mode를 실행하지 않는다.
- 사용자 명시 승인 후 `9E-9D-APPLY`를 1회 실행하면 `content_items.status=published`, `publishedAt=2026-06-19 00:44:03`, publish attempt `status=success`, `contentMutationCompleted=true`가 되어야 한다.

## MVP 기능 검증

- LLM Provider 등록 가능
- LLM Model 등록 가능
- LLM Task Route 등록 가능
- LLM Call Log 조회 가능
- OpenAI/Local LLM 연결 테스트 가능
- 블로그 프로필 저장 가능
- 서비스 프로필 저장 가능
- 글 생성 요청 저장 가능
- 기획서 생성 가능
- 품질검사 차단 가능
- 테스트 Blogger 초안 저장 가능
- 예약 발행 로그 확인 가능

## Patch 3 수동 검증

- `/settings/llm`에서 Provider 목록, 빈 상태, 로딩 상태, 오류 상태가 표시된다.
- Provider 생성/수정/삭제가 가능하다.
- Provider 화면에는 API Key 원문 입력 필드가 없다.
- Model 생성 시 Provider를 선택할 수 있다.
- Task Route 생성 시 primary Provider에 속한 Model만 primary Model 후보로 표시된다.
- Task Route 생성 시 fallback Provider에 속한 Model만 fallback Model 후보로 표시된다.
- Task Route 중복 생성 실패 시 오류 메시지가 화면에 표시된다.
- Call Log metadata는 전체 원문이 아니라 접기/요약 형태로 표시된다.

## Patch 4 수동 검증

- `/blogs`에서 블로그 프로필 목록, 빈 상태, 로딩 상태, 오류 상태가 표시된다.
- `/blogs`에서 블로그 프로필 생성, 수정, 삭제가 가능하다.
- `/blogs`의 배열 필드는 textarea 입력을 쉼표 또는 줄바꿈 기준으로 `String[]`로 저장한다.
- `/blogs`의 `autoPublishEnabled`는 정책 설정값으로만 표시되며 실제 자동 발행은 연결하지 않는다.
- `/blogs`에는 Blogger OAuth 실행 버튼이나 Blogger API 호출 기능이 없다.
- `/brands`에서 서비스/브랜드 프로필 목록, 빈 상태, 로딩 상태, 오류 상태가 표시된다.
- `/brands`에서 서비스/브랜드 프로필 생성, 수정, 삭제가 가능하다.
- `/brands`의 배열 필드는 textarea 입력을 쉼표 또는 줄바꿈 기준으로 `String[]`로 저장한다.
- `/brands`의 `isDefault`는 단일 기본값 강제를 하지 않는다.
- `/brands`에는 OpenAI API, Local LLM, Blogger API 호출 기능이 없다.

## Patch 5 수동 검증

- `/content/new`에서 블로그 목록과 서비스/브랜드 프로필 목록을 선택할 수 있다.
- `/content/new`에서 기존 글 생성 요청 목록, 빈 상태, 로딩 상태, 오류 상태가 표시된다.
- `/content/new`에서 글 생성 요청 생성, 수정, 삭제가 가능하다.
- `blogId`, `brandProfileId`가 비어 있으면 `null`로 저장된다.
- `sourceMemo` 또는 `targetKeyword` 중 하나 이상 없으면 저장을 막고 오류를 표시한다.
- `seo_keyword` 모드에서 targetKeyword가 없으면 권장 안내를 표시한다.
- `service_promotion` 모드에서 brandProfileId가 없으면 권장 안내를 표시한다.
- `existing_draft_improve`는 사용자가 직접 입력한 기존 글/초안 보강용이며 경쟁글 복사·재작성·재가공 용도가 아니라는 안내가 표시된다.
- 목록 테이블에서 sourceMemo는 전체 본문이 아니라 요약으로 표시된다.
- LLM 호출, 글 기획서 생성, 본문 생성, HTML 변환, 품질검사, Blogger 발행 기능은 없다.

## Patch 6A 수동 검증

- `/content/new`에서 글 생성 요청을 선택한 뒤 첨부 미디어 섹션을 사용할 수 있다.
- 선택된 글 생성 요청이 없으면 먼저 요청을 선택하라는 안내가 표시된다.
- 허용된 이미지/동영상 MIME type만 업로드할 수 있다.
- 이미지 최대 10MB, 영상 최대 100MB 제한을 적용한다.
- 업로드 파일은 `local-data/uploads/content-assets/{contentItemId}/`에 저장되고 Git에 포함되지 않는다.
- DB에는 파일 본문이 아니라 content asset 메타데이터만 저장된다.
- UI에는 `storagePath`가 표시되지 않는다.
- image는 이미지 미리보기, video는 controls가 있는 동영상 미리보기를 표시한다.
- caption, altText, userNote, placementHint, sortOrder, isPrimary를 수정할 수 있다.
- 자산 삭제 시 DB row와 로컬 파일을 함께 삭제한다.
- content item 삭제 시 연결된 asset 파일도 정리한다.
- 대표 미디어 단일 강제, 외부 스토리지, Blogger 업로드, LLM 호출은 구현하지 않는다.

## Patch 6B 수동 검증

- `/content/new`의 첨부 미디어 카드에서 `메타데이터 자동 추천` 버튼을 사용할 수 있다.
- 기존 caption, altText, userNote가 있으면 추천값을 채우기 전 confirm이 표시된다.
- 추천 버튼은 `POST /api/content-assets/[assetId]/suggest-metadata`를 호출한다.
- 추천 API는 추천값을 DB에 바로 저장하지 않는다.
- 추천 결과는 asset metadata edit form에 채워진다.
- 사용자가 `메타데이터 수정` 버튼을 눌러야 DB에 저장된다.
- 추천 결과 안내에 rationale과 warnings가 표시된다.
- warnings에는 파일 내용 분석 없이 메타데이터만 사용했다는 한계가 표시된다.
- OpenAI API, Local LLM, 이미지/영상 분석, Blogger API 호출은 발생하지 않는다.

## Patch 6C 수동 검증

- `/content/new` 목록에서 `상세` 링크로 `/content/[id]` 상세 화면에 이동할 수 있다.
- `/content/[id]`에서 content item 기본 정보, blog name, brand profile name, sourceMemo가 표시된다.
- `planJson`이 비어 있으면 기본 템플릿이 textarea에 표시된다.
- 유효하지 않은 JSON은 저장하지 않고 오류를 표시한다.
- 유효한 JSON object는 `PATCH /api/content-items/[id]`로 저장된다.
- 빈 `{}` 또는 빈 템플릿만으로는 `planned` 전환을 허용하지 않는다.
- 기획 항목이 있는 유효한 `planJson`은 저장 후 status를 `planned`로 전환할 수 있다.
- 첨부 미디어는 이미지/동영상 미리보기와 메타데이터를 읽기 중심으로 표시한다.
- 첨부 미디어 상세 화면에는 `storagePath`가 표시되지 않는다.
- `draftMarkdown`, `draftHtml`, `qualityScore`는 read-only로 표시되며 `draftHtml`은 실제 HTML로 렌더링하지 않는다.
- OpenAI API, Local LLM, 글 생성, HTML 변환, 품질검사, Blogger API 호출은 발생하지 않는다.

## Patch 7A 수동 검증

- `/settings/llm` Provider 섹션에서 invocationMode와 apiFormat을 선택할 수 있다.
- Provider에 baseUrl, endpointPath, defaultModel, headersJson, requestTemplateJson, cliExecutable, cliArgsJson을 저장할 수 있다.
- API Key 입력 필드는 저장/교체 전용이며 저장 후 비워진다.
- Provider 목록에는 API Key 전체값이 표시되지 않고 `hasSecret` 또는 `apiKeyLast4`만 표시된다.
- `headersJson`에 authorization, token, api-key 계열 민감 header를 넣으면 저장이 실패한다.
- CLI executable에 sh, bash, zsh, fish, sudo, rm, osascript, curl, wget을 넣으면 저장이 실패한다.
- OpenAI-compatible Provider 연결 테스트는 `/v1/chat/completions` 형태의 짧은 내부 테스트 prompt를 사용한다.
- Ollama-compatible Provider 연결 테스트는 `/api/generate` 형태의 짧은 내부 테스트 prompt를 사용한다.
- custom_http, custom_cli 테스트는 Patch 7A에서 비활성 안내를 반환한다.
- 연결 테스트 결과는 Provider의 lastTestStatus, lastTestedAt, lastTestError에 반영된다.
- 연결 테스트는 `llm_call_logs.taskType = provider_test`로 제한된 metadata만 기록한다.
- 테스트 로그 metadata에는 secret, API Key, prompt 전문, request body 전문, response 전문이 저장되지 않는다.
- 실제 content_plan, 본문 생성, HTML 변환, 품질검사, Blogger API 호출은 발생하지 않는다.

## Patch 7A-HOTFIX 수동 검증

- 잘못된 OpenAI-compatible API Key로 연결 테스트를 실행해도 응답 JSON, Provider lastTestError, llm_call_logs errorMessage, metadata.responseSummary에 API Key 일부가 표시되지 않는다.
- OpenAI HTTP 401/403 실패는 외부 error.message 전문이 아니라 `authentication_failed` 또는 `Authentication failed. Check the API key.` 수준의 안전 요약만 표시한다.
- OpenAI HTTP 404 실패는 외부 응답 전문이 아니라 endpoint/model not found 수준의 안전 요약만 표시한다.
- Ollama 실패도 외부 response body 전문을 저장하지 않고 HTTP status 기반 안전 요약만 저장한다.
- provider_test metadata에는 secret, API Key, Bearer token, prompt 전문, request body 전문, response 전문이 저장되지 않는다.
- `/settings/llm`에서 실패 응답 처리 시 `body stream already read` 오류가 표시되지 않는다.
- Local Ollama provider 연결 테스트 success 흐름은 유지된다.

## Patch 7A-HOTFIX-2 수동 검증

- OpenAI-compatible Provider의 defaultModel이 `gpt-5.4-mini`이면 연결 테스트 request body에 `max_completion_tokens`가 사용된다.
- `gpt-5`, `gpt-5.*`, `gpt-5-*`, `o1*`, `o3*`, `o4*` 계열은 `max_completion_tokens`를 사용한다.
- 그 외 구형 chat-completions 호환 모델은 `max_tokens`를 사용한다.
- OpenAI-compatible HTTP 400 실패는 외부 error body 전문이 아니라 `parameter_error` 또는 provider parameter 확인 수준의 안전 요약만 저장한다.
- Local Ollama provider 연결 테스트 success 흐름은 유지된다.
- provider_test 로그에는 API Key, Bearer token, request body 전문, response body 전문이 저장되지 않는다.

## Patch 7B 수동 검증

- `/content/[id]` 상세 화면에 `Content Plan Dry Run` 섹션이 표시된다.
- 화면은 `GET /api/settings/llm/task-routes`를 재사용해 `content_plan` route를 표시한다.
- Primary Provider/Model, Fallback Provider/Model, Provider lastTestStatus, lastTestedAt, lastTestError가 표시된다.
- `Dry Run` 버튼은 실제 LLM 호출 없이 readiness checks와 prompt preview만 생성한다.
- readiness는 route 존재, route 활성화, primary provider/model 존재 및 활성화, provider test success, sourceMemo 또는 targetKeyword 존재 여부를 fail 조건으로 판단한다.
- blog 누락, brand 누락, media 없음, fallback 없음, fallback 중복, fallback test 실패는 warning으로 표시된다.
- prompt preview는 system, user, outputFormat으로 분리되어 화면에만 표시된다.
- prompt preview에는 API Key, apiKeyLast4, secretRef 원문, encryptedValue, headersJson, requestTemplateJson, storagePath가 포함되지 않는다.
- Dry Run은 `planJson`을 자동 저장하지 않고 `llm_call_logs`를 생성하지 않는다.
- OpenAI API, Ollama API, Local LLM HTTP 호출, Blogger API 호출은 발생하지 않는다.

## Patch 7C 수동 검증

- `/content/[id]`의 `Content Plan Dry Run`에서 readiness가 통과하면 `기획서 생성` 버튼을 사용할 수 있다.
- `POST /api/content-items/[id]/generate-plan`은 `content_plan` Task Route의 primary Provider/Model로 실제 LLM 호출을 수행한다.
- primary provider 호출 자체가 실패하면 fallback Provider/Model이 있을 때 1회 fallback을 시도한다.
- JSON parse 실패나 validation 실패는 fallback하지 않고 안전한 오류 또는 후보 검증 결과를 반환한다.
- 생성 후보 planJson은 read-only preview로 표시되며 자동 저장되지 않는다.
- validation error가 있으면 `planJson에 반영` 버튼이 비활성화된다.
- warning만 있으면 `planJson에 반영` 버튼을 사용할 수 있다.
- `planJson에 반영` 클릭 시에만 기존 `PATCH /api/content-items/[id]`로 planJson이 저장된다.
- 반영 후 Manual Plan JSON textarea가 저장된 값으로 갱신된다.
- planned 전환은 기존 버튼으로 별도 수행한다.
- `llm_call_logs`에는 taskType `content_plan`, provider/model/contentItem, status, latency, 제한된 metadata만 저장된다.
- `llm_call_logs`에는 prompt 전문, request body 전문, raw response 전문, API Key, Bearer token, secretRef 원문, encryptedValue, storagePath가 저장되지 않는다.
- 본문 생성, HTML 변환, 품질검사, Blogger API 호출은 발생하지 않는다.

## Patch 7C-HOTFIX 수동 검증

- primary provider 호출 실패 후 fallback provider 호출도 실패하면 fallback provider/model 기준으로 `llm_call_logs` failed 로그가 남는다.
- fallback이 없어서 primary 실패로 종료되면 primary provider/model 기준으로 `llm_call_logs` failed 로그가 남는다.
- provider 호출은 성공했지만 LLM 응답 JSON parse가 실패하면 해당 provider/model 기준으로 `responseSummary: json_parse_failed` failed 로그가 남는다.
- parse 실패 로그에는 prompt 전문, raw response 전문, request body 전문, API Key, Bearer token, secretRef 원문, encryptedValue, storagePath가 저장되지 않는다.

## Patch 7C-SAFETY-HOTFIX 수동 검증

- `content_plan` 후보 planJson에 `수익 보장`, `급등 확정`, `매수 추천`, `매도 추천`, `반드시 오른다`, `무조건 오른다`, `손실 없음`, `리스크 없음`, `원금 보장`, `수익률 예시`, `성공 사례`, `안전하게 매수`, `안전한 투자`, `확실한 수익`이 포함되면 validation error가 표시된다.
- validation error가 있으면 `/content/[id]`의 `planJson에 반영` 버튼이 비활성화된다.
- `무료 체험`, `지금 시작`, `신뢰할 수 있는 투자`, `매수 타이밍을 잡다`, `수익률`, `성공`은 기본적으로 validation warning으로 표시된다.
- `service_promotion` 모드에서 연결된 brand profile이 투자/주식/종목/매수/급등/투자 인사이트 관련이면 위 warning 표현도 validation error로 승격된다.
- warning만 있는 후보는 `planJson에 반영`이 가능하지만 화면에 경고가 표시된다.
- 생성 prompt는 투자/금융 서비스가 정보 제공 또는 참고 도구라는 원칙과 수익 보장/매수 추천/수익률 예시/성공 사례/안전하게 매수 금지를 포함한다.
- 안전성 validation 결과는 error/warning count만 `llm_call_logs` metadata에 반영되며 prompt 전문, raw response 전문, API Key, request body 전문은 저장되지 않는다.

## Patch 7D 수동 검증

- `GET /api/settings/llm/call-logs` 응답의 provider는 `id`, `name`, `providerType`, `invocationMode`, `apiFormat`만 포함한다.
- `GET /api/settings/llm/call-logs` 응답의 model은 `id`, `name`, `displayName`만 포함한다.
- `GET /api/settings/llm/call-logs` 응답의 contentItem은 `id`, `title`, `mode`, `status`, `targetKeyword`만 포함한다.
- call logs 응답에는 `sourceMemo`, `planJson`, `draftMarkdown`, `draftHtml`, `headersJson`, `requestTemplateJson`, `secretRef`, `apiKeyLast4`, `hasSecret`, `lastTestError`, `encryptedValue`가 포함되지 않는다.
- `POST /api/settings/llm/call-logs`는 JSON 형태의 405 Method Not Allowed 응답을 반환한다.
- `/settings/llm` Call Logs 화면은 task, status, provider, model, content summary, latency, tokens, error, createdAt, metadata만 표시한다.
- Call Logs 화면에는 prompt 전문, raw response, secret, API Key, content body를 반환하지 않는다는 안내가 표시된다.
- `/content/[id]` Generated Plan Candidate 영역은 validation status와 error/warning count를 표시한다.
- validation error가 있으면 planJson 반영 불가 안내가 표시되고 `planJson에 반영` 버튼이 비활성화된다.
- warning만 있으면 검토 후 반영 가능 안내가 표시된다.

## Patch 7E 수동 검증

- `/content/[id]` Generated Plan Candidate 영역에서 `후보 편집` 버튼으로 candidate planJson textarea를 편집 모드로 전환할 수 있다.
- 후보를 편집하면 `편집된 후보는 재검증 후 반영할 수 있습니다.` 안내가 표시되고 `planJson에 반영` 버튼이 비활성화된다.
- `재검증` 버튼은 실제 LLM 호출 없이 `POST /api/content-items/[id]/validate-plan`만 호출한다.
- 잘못된 JSON을 입력하고 재검증하면 API 호출 없이 `유효하지 않은 JSON입니다. 재검증할 수 없습니다.` 안내가 표시된다.
- 위험 표현이 포함된 JSON을 재검증하면 validation error가 표시되고 `planJson에 반영` 버튼이 비활성화된다.
- warning만 있는 후보를 재검증하면 warning 안내가 표시되고 `planJson에 반영` 버튼을 사용할 수 있다.
- 재검증만으로 DB의 `content_items.planJson`은 변경되지 않는다.
- 재검증만으로 `llm_call_logs`가 생성되지 않는다.
- `planJson에 반영`을 클릭해야 기존 content item PATCH 흐름으로 planJson이 저장된다.

## Patch 8A 수동 검증

- `/content/[id]`에 `Draft Markdown Dry Run` 섹션이 표시된다.
- Draft Dry Run은 저장된 `contentItem.planJson`만 사용하고, 아직 `planJson에 반영`하지 않은 Generated Plan Candidate는 사용하지 않는다.
- 저장된 `planJson`이 없으면 readiness fail과 `먼저 planJson에 반영하세요` 안내가 표시된다.
- `content_draft` Task Route가 없으면 `draft generation route not configured` fail이 표시된다.
- `content_plan` route는 draft generation 대용으로 사용되지 않는다.
- 저장된 `planJson`이 있고 `content_draft` route가 준비되어 있으면 draft prompt preview가 system/user/outputFormat으로 표시된다.
- readiness는 planJson 존재, validation, outline/coreMessage, route/provider/model enabled, provider lastTestStatus를 fail 기준으로 확인한다.
- blog/brand 누락, provider test timestamp 없음 또는 24시간 초과, attached media 없음, mediaPlan/assets 불일치, fallback 미설정 또는 fallback test 미성공은 warning으로 표시된다.
- media mapping preview는 attached media의 originalName, assetType, placementHint, caption, placeholder를 표시한다.
- prompt preview와 media mapping에는 API Key, secret, provider headers, request template, media `storagePath`가 포함되지 않는다.
- Draft Dry Run만으로 `draftMarkdown`, `draftHtml`, `llm_call_logs`가 변경되지 않는다.
- 실제 OpenAI/Ollama/Local LLM 호출, HTML 변환, 품질검사, Blogger API 호출은 발생하지 않는다.

## Patch 8B 수동 검증

- `/content/[id]`에서 Draft Dry Run readiness가 pass이면 `본문 초안 생성` 버튼을 사용할 수 있다.
- `POST /api/content-items/[id]/generate-draft`는 저장된 `planJson`과 `content_draft` Task Route만 사용한다.
- 저장된 `planJson`이 없거나 validation error가 있으면 draft generation을 수행하지 않고 JSON error를 반환한다.
- `content_draft` route가 준비되지 않았거나 primary provider/model readiness가 fail이면 draft generation을 수행하지 않는다.
- Local Ollama 또는 OpenAI-compatible Provider 호출 성공 시 `candidateDraftMarkdown`, validation, route summary, latency, markdown length가 응답된다.
- 후보 생성 직후 DB의 `draftMarkdown`은 자동 저장되지 않는다.
- 후보 textarea는 기본 read-only이며, `후보 편집` 후에는 재검증 전 `draftMarkdown에 반영` 버튼이 비활성화된다.
- 재검증은 client-side rule-based validation으로 수행하며 LLM 호출과 `llm_call_logs` 생성을 하지 않는다.
- 위험 표현이 있으면 validation error가 표시되고 `draftMarkdown에 반영`이 비활성화된다.
- warning만 있으면 안내를 표시하되 사용자가 검토 후 `draftMarkdown에 반영`할 수 있다.
- `draftMarkdown에 반영` 클릭 시 기존 content item PATCH 흐름으로 `draftMarkdown`만 저장하고 `draftHtml`은 생성하지 않는다.
- 실제 LLM 호출 결과는 `llm_call_logs`에 taskType `content_draft`로 기록하되 prompt 전문, raw response 전문, 후보 Markdown 전문, request body 전문, API Key, Bearer token, secretRef, encryptedValue, provider headers, media `storagePath`는 저장하지 않는다.
- call logs API 응답에도 후보 Markdown 전문과 민감 필드가 노출되지 않는지 확인한다.

## Patch 8B-HOTFIX 수동 검증

- Draft prompt preview에는 금융/투자/서비스 홍보 위험 문구 금지와 중립 대체 표현이 포함된다.
- `POST /api/content-items/[id]/generate-draft`에서 초안 후보 validation error가 발생하면 같은 provider/model로 repair를 1회 시도한다.
- repair는 fallback 대상이 아니며, primary/fallback 선택 이후 실제 사용된 provider/model에서만 수행된다.
- repair 성공 시 응답 metadata에 `repairAttempted: true`, `repairSucceeded: true`, 초기/최종 validation count가 표시된다.
- repair 후에도 validation error가 있으면 `repairSucceeded: false`이며 `/content/[id]`에서 반영 버튼이 비활성화된다.
- repair 여부와 결과는 Generated Draft Candidate 영역에 표시된다.
- repair 후에도 후보는 자동 저장되지 않고, `draftMarkdown에 반영` 클릭 전까지 DB의 `draftMarkdown`은 변경되지 않는다.
- `llm_call_logs` metadata에는 repair 요약 count와 `repairResponseSummary`만 저장하고 original/repaired draft 전문, prompt 전문, raw response 전문, API Key, Bearer token, provider headers, media `storagePath`는 저장하지 않는다.
- 재검증은 여전히 client-side validation이며 LLM 호출과 `llm_call_logs` 생성을 하지 않는다.

## 2026-06-14 closeout 검증 기록

실제 확인된 상태:

- 최신 커밋은 `a53094c Improve draft safety repair flow`다.
- 테스트 content item `cmqc2xqbr00011y70sxmgl65v`는 `has_plan = true`, `has_draft = true`, `has_html = false` 상태로 확인되었다.
- 최신 `content_draft` call log는 `validationOk = true`, `repairAttempted = false`, `markdownLength = 1665`, `mediaPlaceholderCount = 1`인 정상 생성 케이스로 확인되었다.
- draftMarkdown 후보는 생성 직후 자동 저장되지 않았고, 사용자가 `draftMarkdown에 반영`을 클릭했을 때만 DB에 저장되었다.
- `draftHtml`은 아직 생성하지 않았다.

다음 세션 검증 시작점:

- Patch 8C는 저장된 `draftMarkdown`을 입력으로 HTML 변환 dry-run/preview를 검증한다.
- `draftHtml` 자동 저장, Blogger OAuth/API/publish, 품질검사는 여전히 금지한다.

## Patch 8C 수동 검증

- `/content/[id]`에 `HTML Conversion Dry Run` 섹션이 표시된다.
- 저장된 `draftMarkdown`이 없으면 dry-run을 실행할 수 없고 안내가 표시된다.
- `POST /api/content-items/[id]/html-preview`는 content item, blog, brand, attached assets를 read-only로 조회한다.
- HTML Dry Run 실행 시 previewHtml, readiness checks, draft validation, media placeholder mapping, sanitization/security checks가 표시된다.
- previewHtml은 화면에만 표시되고 `content_items.draftHtml`에는 저장되지 않는다.
- 테스트 content item `cmqc2xqbr00011y70sxmgl65v`는 HTML Dry Run 후에도 `has_plan = true`, `has_draft = true`, `has_html = false` 상태를 유지해야 한다.
- media placeholder가 attached asset과 매칭되면 preview에서는 내부 file API URL만 사용하고 `storagePath`를 표시하지 않는다.
- raw HTML은 escape되고, script/iframe/form/style, `javascript:`, event handler 속성 패턴은 security readiness fail로 표시된다.
- LLM 호출, `llm_call_logs` 생성, Blogger API 호출은 발생하지 않는다.

## Patch 8D 수동 검증

- HTML Dry Run 성공 후 `previewHtml`이 편집 가능한 HTML 후보로 표시된다.
- HTML 후보를 편집하면 재검증 전 `draftHtml에 반영` 버튼이 비활성화된다.
- `POST /api/content-items/[id]/validate-html`은 DB를 변경하지 않는다.
- `<script>alert(1)</script>`, `javascript:`, `onerror=`가 포함되면 validation error가 표시된다.
- `local-data/`, `/uploads/`, `storagePath`, 로컬 절대 경로가 포함되면 validation error가 표시된다.
- `/api/content-assets/unknown/file`처럼 현재 content item의 attached asset이 아닌 media reference는 validation error가 된다.
- warning만 있는 HTML 후보는 검토 후 `draftHtml에 반영`할 수 있다.
- `POST /api/content-items/[id]/apply-html`은 서버에서 validation을 다시 수행하고, error가 없을 때만 `content_items.draftHtml`을 업데이트한다.
- validate/apply 과정에서 LLM 호출, `llm_call_logs` 생성, Blogger OAuth/API/publish는 발생하지 않는다.

## Patch 8E 수동 검증

- `/content/[id]`에 `Quality Dry Run` 섹션이 표시된다.
- 저장된 `draftHtml`이 없으면 품질검사를 실행할 수 없고 안내가 표시된다.
- `POST /api/content-items/[id]/quality-preview`는 저장된 `draftHtml`을 read-only로 검사한다.
- API 응답에는 원본 content item 객체와 원본 assets 객체를 그대로 반환하지 않는다.
- score preview, grade, metadata, structure/SEO/media/safety/Blogger compatibility 그룹별 check가 표시된다.
- `qualityScore 저장`은 후속 패치 placeholder이며 Patch 8E에서 저장하지 않는다.
- quality-preview 호출 전후 `qualityScore`, status, draftHtml, publishedAt, scheduledAt이 변경되지 않는다.
- quality-preview 호출만으로 `llm_call_logs`가 생성되지 않는다.
- 응답과 UI에는 `storagePath`, local upload path, API Key, secret, token, provider headers, request template이 포함되지 않는다.
- H1 없음, H1 2개 이상, H2/H3 부족, paragraph 부족, CTA 없음, FAQ 없음, external link rel 누락, unknown media reference, img alt 누락, 위험 HTML 패턴, 금융 위험 표현과 안전문구 누락이 check로 표시된다.

## Patch 8F 수동 검증

- `/content/[id]`에 `Publish Readiness Gate` 섹션이 표시된다.
- `POST /api/content-items/[id]/publish-readiness`는 saved planJson, draftMarkdown, draftHtml, HTML validation, quality preview 결과를 read-only로 평가한다.
- 응답에는 `ready`, `contentReady`, `publishReady`, stage, summary, checks, blockingIssues, warnings, metadata가 포함된다.
- Patch 8F에서는 Blogger 연결과 사용자 최종 승인 저장이 없으므로 `publishReady`와 top-level `ready`는 false다.
- Blogger connection은 `not_configured` placeholder로 표시된다.
- publish-readiness 호출 전후 status, qualityScore, draftHtml, publishedAt, scheduledAt이 변경되지 않는다.
- publish-readiness 호출만으로 `llm_call_logs`가 생성되지 않는다.
- 응답과 UI에는 원본 content item/assets 객체, `storagePath`, local upload path, API Key, secret, token, provider headers, request template이 포함되지 않는다.
- Blogger OAuth/API/draft/publish, scheduled publish는 발생하지 않는다.

## Patch 9A 수동 검증

- `/settings/blogger` 페이지가 표시된다.
- `GET /api/settings/blogger`는 Blogger connection placeholder 목록을 반환한다.
- `POST /api/settings/blogger`는 placeholder connection을 생성하지만 OAuth/API 호출을 하지 않는다.
- `PATCH /api/settings/blogger/[id]`는 안전한 설정 필드만 수정한다.
- `GET /api/settings/blogger/[id]/status`는 DB에 저장된 상태만 반환한다.
- API 응답에는 access token, refresh token, client secret 원문, encryptedValue, Bearer token, API Key가 포함되지 않는다.
- `accessToken`, `refreshToken`, `clientSecret`, `encryptedValue` 같은 민감 필드를 요청에 넣으면 저장이 거부된다.
- `/settings/blogger`의 OAuth 시작과 Blogger 연결 테스트 버튼은 disabled placeholder다.
- publish readiness는 Blogger connection status를 반영하지만 `publishReady`와 top-level `ready`는 false를 유지한다.
- Blogger OAuth start/callback, Blogger blog list 조회, draft save, publish, scheduled publish는 발생하지 않는다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9B 수동 검증

- `POST /api/settings/blogger/[id]/oauth/start`는 authorization URL dry-run을 반환한다.
- OAuth start 응답에는 authorizationUrl, expiresAt, redirectUri, scopes, `oauthDryRun: true`가 포함된다.
- OAuth start 응답에는 stateHash, access token, refresh token, client secret, authorization code 원문이 포함되지 않는다.
- `blogger_oauth_states`에는 state 원문이 아니라 `stateHash`만 저장된다.
- authorizationUrl에는 client_id, redirect_uri, scope, state가 포함된다.
- Patch 9C-2 이후 `GET /api/settings/blogger/oauth/callback`은 state 검증 후 token exchange를 수행한다.
- 같은 state를 재사용하면 400으로 거부된다.
- 만료된 state는 400으로 거부된다.
- `/settings/blogger`에는 OAuth URL 생성 UI와 token exchange 구현 완료 안내가 표시된다.
- Blogger API 호출, Blogger blog list 조회, draft save, publish, scheduled publish는 발생하지 않는다.
- publish readiness는 계속 `publishReady=false`를 유지한다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9C-1 수동 검증

- Prisma schema에 `BloggerSecretKind`와 `BloggerConnectionSecret`이 추가되어 있다.
- `blogger_connection_secrets`에는 `encryptedValue`와 safe metadata만 있으며 access token, refresh token, client secret 원문 컬럼은 없다.
- `GET /api/settings/blogger/[id]/secret-status`는 secret metadata만 반환한다.
- secret status 응답에는 `encryptedValue`, access token 원문, refresh token 원문, client secret 원문, authorization code 원문이 포함되지 않는다.
- `POST /api/settings/blogger/[id]/secret-self-test`는 서버 내부 dummy string만 사용한다.
- secret self-test 응답에는 plaintext, ciphertext, `encryptedValue`가 포함되지 않는다.
- `BLOGGER_SECRET_ENCRYPTION_KEY`가 없으면 self-test는 safe failure를 반환하고 token exchange는 계속 비활성 상태다.
- `/settings/blogger`에는 Token Storage Security 섹션이 표시되며 token/client secret 원문 입력창은 없다.
- Patch 9C-2 이후 OAuth callback token exchange와 `https://oauth2.googleapis.com/token` 호출 helper가 구현되어 있다.
- Blogger API 호출, Blogger blog list 조회, draft save, publish, scheduled publish는 발생하지 않는다.
- publish readiness는 계속 `publishReady=false`를 유지한다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9C-2 수동 검증

- `GET /api/settings/blogger/oauth/callback`은 state 검증 후 authorization code token exchange를 수행한다.
- token exchange 직전에 state는 consumed 처리되며 실패 후 같은 state는 재사용할 수 없다.
- `BLOGGER_SECRET_ENCRYPTION_KEY`가 없으면 callback은 safe error를 반환하고 connection status는 `error`가 된다.
- `clientSecretRef`가 없거나 서버 env에서 resolve되지 않으면 callback은 safe error를 반환하고 connection status는 `error`가 된다.
- invalid/reused/expired state는 400으로 거부된다.
- Google token endpoint 실패 시 raw error body 전문은 응답, DB, UI에 저장하지 않는다.
- `invalid_grant`는 `oauth_required` 상태로 처리한다.
- 성공 시 access token은 `blogger_connection_secrets.secretKind = access_token`으로 암호화 저장된다.
- 새 refresh token이 있으면 `secretKind = refresh_token`으로 암호화 저장된다.
- 새 refresh token이 없고 기존 refresh token이 있으면 기존 refresh token을 유지한다.
- 새 refresh token도 기존 refresh token도 없으면 status는 `oauth_required`로 둔다.
- callback 응답에는 authorization code, access token, refresh token, client secret, `encryptedValue`, raw token response가 포함되지 않는다.
- `secret-status` 응답에는 safe metadata만 표시된다.
- Blogger API 호출, Blogger blog list 조회, draft save, publish, scheduled publish는 발생하지 않는다.
- publish readiness는 Blogger status가 `connected`이면 connection check만 pass할 수 있지만 `publishReady=false`를 유지한다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9D-1 수동 검증

- `POST /api/settings/blogger/[id]/blogs`는 encrypted access token을 서버 내부에서만 복호화해 Blogger blog list를 read-only로 조회한다.
- access token이 없으면 400 `access_token_missing` safe error를 반환한다.
- access token metadata가 만료되어 있으면 Blogger API를 호출하지 않고 400 `access_token_expired` safe error를 반환한다.
- `BLOGGER_SECRET_ENCRYPTION_KEY`가 없으면 500 `blogger_secret_key_not_configured` safe error를 반환한다.
- 복호화 실패는 500 `token_decryption_failed` safe error를 반환한다.
- Blogger API 401/403은 raw body 없이 safe error와 `statusSuggestion`만 반환한다.
- 성공 응답의 `blogs`는 Blog ID, Name, URL, Published, Updated만 포함한다.
- 응답에는 `Bearer`, token 원문, refresh token 원문, client secret 원문, `encryptedValue`, raw Blogger response가 포함되지 않는다.
- `/settings/blogger`에는 “Blogger 목록 조회” 버튼과 결과 테이블이 표시된다.
- Blogger blog 선택 저장, token refresh, draft save, publish, scheduled publish는 발생하지 않는다.
- publish readiness는 계속 `publishReady=false`를 유지한다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9D-2 수동 검증

- `POST /api/settings/blogger/[id]/blogs/select`는 body의 `blogId`를 1차 검증한다.
- select route는 저장 전 현재 token으로 Blogger blog list를 다시 조회한다.
- 조회 결과에 없는 `blogId`는 400 `blogger_blog_not_accessible` safe error를 반환한다.
- access token 없음/만료/복호화 실패/401/403은 safe error만 반환한다.
- 성공 시 `bloggerBlogId`, `bloggerBlogName`, `bloggerBlogUrl`, `bloggerBlogVerifiedAt`만 저장한다.
- generic PATCH로 들어온 `bloggerBlogId`/`bloggerBlogName`은 verified metadata를 초기화한다.
- `/settings/blogger` blog list row에 “이 블로그 선택” 버튼이 표시된다.
- publish readiness에는 `blogger_blog_selection` check가 추가되지만 `publishReady=false`, top-level `ready=false`를 유지한다.
- token refresh, draft save, publish, scheduled publish는 발생하지 않는다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9E-0 수동 검증

- `POST /api/content-items/[id]/blogger-draft-preview`는 request body의 blog id를 받지 않는다.
- target blog는 content item의 Blog에 연결된 `BloggerConnection` verified metadata에서만 결정한다.
- 연결된 Blogger connection이 여러 개면 임의 선택하지 않고 `blogger_connection_ambiguous` blocking issue를 반환한다.
- `bloggerBlogId`와 `bloggerBlogVerifiedAt`이 모두 있어야 `selectedBlogReady=true`다.
- saved `draftHtml`만 HTML source로 사용하고 `draftMarkdown` 즉시 변환은 수행하지 않는다.
- 응답은 `htmlSnippet`을 짧게 반환하고 full `draftHtml`을 payload preview로 크게 반환하지 않는다.
- draftHtml 없음, title 후보 없음, HTML validation fail, quality required fail은 `draftPayloadReady=false`를 만든다.
- verified blog + connected connection + valid draftHtml + content readiness pass면 `draftPayloadReady=true`가 될 수 있지만 `draftSaveImplemented=false`다.
- Blogger API read/write, token refresh, draft save, publish, scheduled publish는 발생하지 않는다.
- content item status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경되지 않는다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9E-1 수동 검증

- `POST /api/content-items/[id]/blogger-draft-approval`은 request body의 title/blogId/hash를 신뢰하지 않는다.
- approval API는 서버에서 content item, assets, Blogger connection을 다시 읽고 draft payload preview를 재계산한다.
- `draftPayloadReady=false`이면 400 `blogger_draft_payload_not_ready` safe error를 반환한다.
- ready preview 승인 시 기존 active approval은 `superseded` 처리하고 새 `approved` approval을 생성한다.
- `DELETE /api/content-items/[id]/blogger-draft-approval`은 active approval을 `revoked`로 soft revoke한다.
- approval DB에는 full `draftHtml`이나 `htmlSnippet`을 저장하지 않고 `draftHtmlHash`, `snapshotHash`, safe target blog metadata, title, readiness summary만 저장한다.
- preview API 응답에는 approval status, current hash prefix, approval hash prefix, snapshot match 여부가 포함된다.
- publish readiness의 manual approval check는 current preview snapshot과 active approval이 일치하면 pass할 수 있다.
- publish readiness는 그래도 `publishReady=false`, top-level `ready=false`를 유지한다.
- Blogger API read/write, token refresh, draft save, publish, scheduled publish는 발생하지 않는다.
- content item status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경되지 않는다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9E-2 수동 검증

- `POST /api/content-items/[id]/blogger-draft-save`는 request body의 blog id/title/html/hash를 신뢰하지 않는다.
- route는 서버에서 content item, assets, Blogger connection, draft payload preview, approval snapshot hash를 다시 계산한다.
- active approval이 없으면 400 `blogger_draft_approval_missing` safe error를 반환하고 Blogger API를 호출하지 않는다.
- active approval의 `snapshotHash` 또는 `draftHtmlHash`가 current preview와 다르면 400 `blogger_draft_approval_stale` safe error를 반환한다.
- `draftPayloadReady=false`이면 400 `blogger_draft_payload_not_ready` safe error를 반환한다.
- 같은 approval에 successful draft save가 이미 있으면 400 `blogger_draft_already_saved_for_approval`을 반환하고 중복 `posts.insert`를 실행하지 않는다.
- guard 통과 후 access token 없음/만료/복호화 실패/401/403은 safe error를 반환하고 raw token/raw Blogger body를 반환하지 않는다.
- 성공 시 Blogger API는 `posts.insert` + `isDraft=true`만 호출한다.
- 성공/실패 record에는 safe draft save metadata만 저장하고 full `draftHtml`, token, encrypted value, raw Blogger response/error body는 저장하지 않는다.
- content detail UI에는 승인된 snapshot일 때만 “Blogger Draft 저장” 버튼이 활성화된다.
- publish readiness는 `blogger_draft_saved` check와 draft save metadata를 표시할 수 있지만 `publishReady=false`, top-level `ready=false`를 유지한다.
- `posts.update`, publish, scheduled publish, token refresh는 발생하지 않는다.
- content item status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경되지 않는다.
- live Blogger test blog에 실제 draft post가 생성되는 검증은 사용자 명시 승인 없이는 수행하지 않는다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9E-3 live verification runbook 검증

- Patch 9E-3 자체 검증에서는 실제 Blogger live draft save를 실행하지 않는다.
- live verification prerequisite를 문서에서 확인한다:
  - connected OAuth token
  - verified Blogger blog selection
  - saved `draftHtml`
  - `draftPayloadReady=true`
  - active approval snapshot match
  - same approval에 successful draft save 없음
  - target blog가 test blog인지 사용자 확인
- live write 전 고정 승인 문구가 문서와 UI에 반영되어 있어야 한다:

```text
실제 Blogger test blog에 draft post가 생성됩니다. 실행해도 됩니까?
```

- 승인 후 실행은 1회만 허용하는 운영 절차로 문서화되어 있어야 한다.
- 성공 확인 항목은 `bloggerPostId`, `bloggerPostUrl`, `savedAt`, Blogger UI draft 상태다.
- cleanup은 앱에서 `posts.delete`를 구현하지 않고 Blogger UI 수동 삭제로 안내한다.
- retry policy는 guard failure를 제외하고 `retryable=true` failure만 재시도 후보로 설명한다.
- same approval success가 있으면 중복 `posts.insert` 차단 정책을 유지한다.
- `posts.update`는 구현하지 않고 Patch 9E-4 이후 별도 설계 대상으로 남긴다.
- publish readiness는 draft saved check가 pass 가능해도 `publishReady=false`, top-level `ready=false`를 유지한다.
- 검증 명령은 `git diff --check`, Prisma validate/generate, lint, typecheck, build, static `rg` 확인으로 제한한다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9E-4A manual HTML quality repair preview 검증

- `POST /api/content-items/[id]/quality-repair-preview`는 saved `draftMarkdown`과 `draftHtml`을 read-only로 조회한다.
- 현재 `draftHtml`이 짧거나 placeholder에 가까우면 `draft_markdown_rule_based_rebuild` source를 사용한다.
- `draftMarkdown`이 없거나 너무 짧으면 `draft_html_plus_rule_based_repair` fallback source를 사용할 수 있다.
- 응답에는 `candidateHtml`, source, before/after quality, after validation, repair summary가 포함된다.
- candidate는 H1/H2/H3/p/ul/ol/strong/code/section/article 중심의 안전한 HTML이어야 한다.
- candidate에는 `<script>`, iframe, inline event handler, external tracking code를 넣지 않는다.
- candidate는 CTA signal과 투자/주식 맥락의 참고/책임/disclaimer 문구를 포함할 수 있다.
- API 호출 전후 `draftHtml`, `qualityScore`, status, `publishedAt`, `scheduledAt`은 변경되지 않는다.
- API 호출만으로 `llm_call_logs`는 생성되지 않는다.
- Blogger API read/write, draft save, publish, scheduled publish, token refresh는 발생하지 않는다.
- UI는 Quality Repair Preview candidate textarea, 재검증, HTML 후보 편집기로 복사 버튼을 제공한다.
- 실제 저장은 기존 `apply-html` 수동 반영 flow에서만 가능하다.
- `draftHtml`을 수동 반영하면 기존 Blogger approval snapshot이 stale 될 수 있음을 안내한다.

## Patch 9E-4B repair candidate apply UX polish 검증

- Quality Repair Preview 섹션의 버튼은 repair candidate를 `HTML 후보로 사용` 흐름으로 안내한다.
- `HTML 후보로 사용`은 repair candidate를 기존 HTML candidate textarea state로 복사하지만 `draftHtml`에 저장하지 않는다.
- repair candidate를 HTML 후보로 복사하면 HTML candidate source가 `quality-repair`로 표시된다.
- repair candidate를 복사한 직후 기존 HTML candidate validation은 clear/stale 처리되어 `validate-html` 재검증 전에는 `draftHtml에 반영`할 수 없다.
- HTML candidate textarea를 편집하면 source가 `manual-edit`로 표시되고 재검증 전 `draftHtml에 반영` 버튼이 비활성화된다.
- HTML Dry Run 결과가 없어도 repair candidate에서 넘어온 HTML candidate editor가 표시되어 기존 `validate-html` / `apply-html` 흐름을 사용할 수 있다.
- `apply-html` confirm은 `draftHtml` 변경 시 기존 Blogger draft approval snapshot이 stale 될 수 있음을 안내한다.
- `apply-html` 성공 후 기존 Quality Dry Run, Publish Readiness, Blogger Draft Payload Preview 결과는 clear/stale 처리된다.
- `apply-html` 성공 notice는 Quality Dry Run / Publish Readiness / Blogger Draft Payload Preview 재실행과 Blogger draft save 전 재승인을 안내한다.
- 자동 quality-preview, publish-readiness, blogger-draft-preview 재실행은 수행하지 않는다.
- 자동 `draftHtml` 저장, repair candidate 자동 apply, Blogger API read/write, draft save, publish, scheduled publish, token refresh는 발생하지 않는다.
- `llm_call_logs`는 생성되지 않는다.

## Patch 9E-4C-1 provider-aware draft strategy foundation 검증

- `src/lib/llm/draft-generation-strategy.ts`가 provider/model safe metadata만으로 draft strategy를 판별한다.
- remote/commercial provider는 `one_shot_full_draft`로 판별되고 기존 one-shot generation 경로를 유지한다.
- `local`, `local_http`, `cli`, `ollama_compatible`, `custom_cli` 계열은 `local_sectioned_multi_pass` 전략 후보로 표시된다.
- local strategy에서도 이번 패치의 실제 LLM 호출은 기존 one-shot fallback 1회 경로를 사용한다.
- 응답 metadata와 `llm_call_logs.metadata`에는 `strategy`, `strategyReason`, provider/model summary, `isLocalLike`, `stepCount`, `plannedStepCount`, `sectionedGenerationImplemented=false`, `finalPolishImplemented=false`가 포함된다.
- Content detail UI는 route 기준 전략 안내와 생성 결과 기준 전략 metadata를 표시한다.
- `TaskRoute` schema/DB migration은 변경하지 않는다.
- skeleton generation, section generation, final polish generation, automatic `draftMarkdown`/`draftHtml` save는 구현하지 않는다.
- prompt 전문, raw response body, 후보 Markdown 전문, secret, token, encrypted value는 metadata/log/UI에 출력하지 않는다.
- Blogger API read/write, draft save, publish, scheduled publish, token refresh는 발생하지 않는다.
- 검증 명령은 `git diff --check`, `npm run lint`, `npm run typecheck`, `npm run build`를 우선 사용한다.

## Patch 9E-4C-2 Local LLM sectioned draft generation 검증

- remote/commercial provider route에서는 기존 `one_shot_full_draft` 경로가 유지된다.
- local/Ollama/local_http-like route에서는 `local_sectioned_multi_pass` 경로가 skeleton, section generation, deterministic assembly, final polish 순서로 실행된다.
- `POST /api/content-items/[id]/generate-draft`는 신규 endpoint 없이 strategy에 따라 내부 분기한다.
- local sectioned response metadata에는 `sectionCount`, `sectionKeys`, `finalPolishApplied`, `finalPolishInputTooLong`, `finalPolishFallbackReason`, `fallbackUsed`, `fallbackReasons`, `stepSummaries`가 포함된다.
- `stepSummaries`에는 step key, section key, status, retry count, duration, prompt hash, response hash, response length만 포함된다.
- response의 `candidateDraftMarkdown`은 preview/manual apply 대상이며 자동 저장되지 않는다.
- `draftHtml`, `qualityScore`, content item status, `publishedAt`, `scheduledAt`은 변경되지 않는다.
- section generation 실패는 section별 1회 retry 후 fallback paragraph를 사용할 수 있으며 metadata에 표시된다.
- final polish 실패 또는 입력 길이 초과는 전체 실패가 아니라 assembled draft fallback candidate로 반환될 수 있다.
- `llm_call_logs`에는 prompt 전문, raw response 전문, candidate Markdown 전문, skeleton 전문, section fragment 전문, final polish 입력/출력 전문, secret, token, encrypted value를 저장하지 않는다.
- call logs API sanitizer는 원문 prompt/response는 숨기되 `promptHash`와 `responseHash` 같은 safe hash metadata는 허용한다.
- Blogger API read/write, draft save, publish, scheduled publish, token refresh는 발생하지 않는다.
- HTML template/theme rendering은 Patch 9E-4D 범위다.

## Patch 9E-4C-2-hotfix Local FAQ preservation 검증

- saved `planJson.faq`가 있으면 local sectioned draft candidate에 FAQ-like section이 포함되어야 한다.
- section prompt는 `conclusion_cta_faq`/`faq` section에서 `## FAQ`와 `### 질문` 구조를 요구한다.
- final polish prompt는 FAQ heading/question structure를 삭제하거나 일반 문단으로 병합하지 않도록 요구한다.
- final polish 이후 FAQ-like section이 없으면 deterministic `## FAQ` fallback이 append된다.
- FAQ fallback은 최대 5개 항목만 사용하고 HTML tag를 제거한 safe Markdown line/paragraph로 구성한다.
- 이미 FAQ-like section이 있으면 fallback을 중복 append하지 않는다.
- 응답/log metadata에는 `faqRequired`, `faqSectionDetected`, `faqFallbackAppended`, `faqCount`가 포함된다.
- FAQ 질문/답변 전문은 metadata/log에 저장하지 않는다.
- hotfix 후 local smoke에서 기존 `planJson.faq exists, but the draft does not appear to include an FAQ-like section.` warning이 사라지는지 확인한다.
- 자동 `draftMarkdown`/`draftHtml` 저장, status/qualityScore/publishedAt/scheduledAt 변경, Blogger API/draft save/publish/token refresh는 발생하지 않는다.

## Patch 9E-4C-2-hotfix2 Local safety phrase scrub 검증

- local sectioned final candidate는 FAQ guard 이후, `validateDraftMarkdown` 이전에 deterministic safety phrase scrub을 통과해야 한다.
- `안전한 투자`, `안전하게 매수`, `성공`, `성공 사례`, `수익 보장`, `확실한 수익`, `수익률 예시`, `매수 추천`, `매도 추천`, `원금 보장`, `손실 없음`, `리스크 없음` 같은 문구가 validation-blocking phrase로 남지 않아야 한다.
- validation 실패 후 repair가 수행되면 local sectioned repair 결과도 재검증 전에 safety scrub을 통과해야 한다.
- response/log/UI metadata에는 `safetyScrubApplied`, `safetyScrubCount`, `safetyScrubCodes` safe summary만 포함한다.
- scrub 전후 문장 전문, prompt 전문, raw response 전문, candidate Markdown 전문, section fragment 전문은 logs/API metadata에 저장하지 않는다.
- remote/commercial one-shot provider route는 기존 경로와 metadata default(`safetyScrubApplied=false`, count 0)를 유지해야 한다.
- FAQ preservation metadata와 fallback 동작은 유지되어야 한다.
- 자동 `draftMarkdown`/`draftHtml` 저장, status/qualityScore/publishedAt/scheduledAt 변경, Blogger API/draft save/publish/token refresh는 발생하지 않는다.

## Patch 9E-4C-2-hotfix3 Local sectioned timeout policy 검증

- `local_sectioned_multi_pass` 전략은 기존 route/provider timeout을 그대로 각 step에 적용하지 않고 extended timeout policy를 사용한다.
- local sectioned overall timeout은 600000ms로 제한한다.
- skeleton step timeout은 240000ms, section generation/retry timeout은 180000ms, final polish 및 local sectioned repair timeout은 300000ms를 사용한다.
- remote/commercial `one_shot_full_draft` 경로는 기존 route/provider timeout 정책을 유지한다.
- response/log/UI metadata에는 `timeoutPolicy`, `overallTimeoutMs`, `stepTimeoutMs`, `finalPolishTimeoutMs` safe summary만 포함한다.
- timeout error는 `provider_timeout` 또는 `local_sectioned_overall_timeout` 같은 짧은 safe message로 유지한다.
- timeout 발생 시에도 prompt 전문, raw response 전문, candidate Markdown 전문, section fragment 전문, final polish 입력/출력 전문은 logs/API metadata에 저장하지 않는다.
- local smoke는 1회만 실행하고, 다시 timeout되면 반복 실행하지 않고 중단한다.
- 자동 `draftMarkdown`/`draftHtml` 저장, status/qualityScore/publishedAt/scheduledAt 변경, Blogger API/draft save/publish/token refresh는 발생하지 않는다.

## Patch 9E-4C-2-hotfix4 Local sectioned cold-start timeout 보정 검증

- `local_sectioned_multi_pass` 전략은 Ollama cold-start/model-load 지연을 고려한 더 긴 timeout policy를 사용한다.
- local sectioned overall timeout은 1200000ms로 제한한다.
- skeleton step timeout은 600000ms, section generation/retry timeout은 300000ms, final polish 및 local sectioned repair timeout은 600000ms를 사용한다.
- remote/commercial `one_shot_full_draft` 경로는 기존 route/provider timeout 정책을 유지한다.
- response/log/UI metadata에는 `timeoutPolicy`, `overallTimeoutMs`, `stepTimeoutMs`, `skeletonTimeoutMs`, `sectionTimeoutMs`, `finalPolishTimeoutMs`, `repairTimeoutMs` safe summary만 포함한다.
- timeout error는 계속 `provider_timeout` 또는 `local_sectioned_overall_timeout` 같은 짧은 safe message로 유지한다.
- local smoke는 1회만 실행하고, 다시 timeout되면 timeout 추가 연장이 아니라 async/background job 설계로 전환한다.
- 자동 `draftMarkdown`/`draftHtml` 저장, status/qualityScore/publishedAt/scheduledAt 변경, Blogger API/draft save/publish/token refresh는 발생하지 않는다.

## Patch 9E-4C-3A Local stepwise draft generation DB/repository foundation 검증

- Prisma schema에 `ContentDraftGenerationRunStatus`, `ContentDraftGenerationStepStatus`, `ContentDraftGenerationRun`, `ContentDraftGenerationStep`가 추가되어야 한다.
- migration은 새 enum/table/index/FK/grant만 추가해야 하며 기존 데이터 삭제, reset, destructive migration이 없어야 한다.
- `content_draft_generation_runs`는 content item별 stepwise run 상태, strategy, section keys, assembled/final candidate, validation summary, safe metadata를 저장할 수 있어야 한다.
- `content_draft_generation_steps`는 step key, optional section key, attempt, status, normalized Markdown fragment, output summary, prompt/response hash, latency, safe error code, safe metadata를 저장할 수 있어야 한다.
- repository helper는 run 생성/조회/list, step 생성/running/success/failed, run progress update, complete, cancel을 제공해야 한다.
- repository metadata sanitizer는 prompt/raw response/body/token/secret/encryptedValue/sourceMemo/planJson/draftMarkdown/draftHtml/candidate/section fragment 계열 키를 저장 전에 제거해야 하며 `promptHash`/`responseHash`는 허용해야 한다.
- 이번 패치는 API route와 UI를 추가하지 않는다.
- 기존 `POST /api/content-items/[id]/generate-draft` 동작은 변경하지 않는다.
- 자동 `content_items.draftMarkdown`/`draftHtml` 저장, status/qualityScore/publishedAt/scheduledAt 변경, Blogger API/draft save/publish/token refresh는 발생하지 않는다.
- 검증 명령은 `git diff --check`, placeholder `DATABASE_URL` 기반 `npx prisma validate`, `npx prisma generate`, `npm run lint`, `npm run typecheck`, `npm run build`를 사용한다.

## Patch 9E-4C-3B Local stepwise draft generation start/read API 검증

- `POST /api/content-items/[id]/draft-generation-runs`는 saved `planJson`이 있는 content item에 대해서만 `local_sectioned_stepwise` run을 생성해야 한다.
- run 생성은 LLM provider를 호출하지 않고 `llm_call_logs`를 생성하지 않아야 한다.
- 생성된 run은 `pending` status, `currentStepKey=skeleton`, 기본 section keys(`intro`, `body_1`, `body_2`, `body_3`, `conclusion_cta_faq`)를 가져야 한다.
- 생성 응답은 run detail과 pending step summaries만 반환해야 하며 prompt/raw response/body/token/secret/encryptedValue를 반환하지 않아야 한다.
- `GET /api/content-items/[id]/draft-generation-runs`는 해당 content item의 run 목록을 최신순 safe summary로 반환해야 한다.
- `GET /api/content-items/[id]/draft-generation-runs/[runId]`는 해당 content item에 속한 run만 steps 포함 detail로 반환해야 한다.
- 이번 패치는 step execution, assemble, final polish, cancel API를 추가하지 않는다.
- 기존 `POST /api/content-items/[id]/generate-draft` 동작은 변경하지 않는다.
- 자동 `content_items.draftMarkdown`/`draftHtml` 저장, status/qualityScore/publishedAt/scheduledAt 변경, Blogger API/draft save/publish/token refresh는 발생하지 않는다.
- local DB smoke는 3A migration 적용 여부가 확인된 경우에만 수행한다.

## Patch 9E-4C-3C Local stepwise skeleton/section step execution API 검증

- `POST /api/content-items/[id]/draft-generation-runs/[runId]/steps/[stepKey]`는 한 요청에서 하나의 step만 실행해야 한다.
- 허용 step key는 `skeleton`, `intro`, `body_1`, `body_2`, `body_3`, `conclusion_cta_faq`뿐이다.
- URL content item id와 run id가 일치하지 않으면 404를 반환해야 한다.
- run status가 `completed` 또는 `cancelled`이면 409로 실행을 거부해야 한다.
- step status가 `running`이면 409로 실행을 거부해야 한다.
- step status가 `success`이고 retry/force 요청이 없으면 기존 step result를 반환하고 LLM을 다시 호출하지 않아야 한다.
- section step은 skeleton step이 `success`이고 `outputMarkdown`이 있을 때만 실행되어야 하며, 아니면 `skeleton_required` 409를 반환해야 한다.
- `content_draft` primary route가 local/Ollama/local_http-like가 아니면 `local_stepwise_route_required`로 거부해야 한다.
- 성공 시 step row에 normalized `outputMarkdown`, short `outputSummary`, `promptHash`, `responseHash`, latency, safe metadata가 저장되어야 한다.
- 실패 시 해당 step만 `failed`로 표시하고 run은 `failed`/current step 상태가 되어야 하며, retry 시 해당 step attempt만 증가해야 한다.
- `llm_call_logs`에는 run id, step key, section key, attempt, hash, latency, response summary, output length 같은 safe metadata만 저장해야 한다.
- `llm_call_logs`와 metadata에는 prompt 전문, raw response 전문, outputMarkdown 전문, candidate 전문, skeleton/section fragment 전문, secret/token/encryptedValue가 없어야 한다.
- 이번 패치는 assemble/final polish/cancel API와 UI를 추가하지 않는다.
- 자동 `content_items.draftMarkdown`/`draftHtml` 저장, status/qualityScore/publishedAt/scheduledAt 변경, Blogger API/draft save/publish/token refresh는 발생하지 않는다.
- smoke는 migration 적용 여부 확인 후 skeleton 1회, skeleton 성공 시 section 1개까지만 수행하고 반복 실행하지 않는다.

## Patch 9E-4C-3C-smoke Local Ollama 안정화 검증

- Stepwise Ollama 호출은 `stream:true`를 사용해 first byte timeout, idle timeout, overall timeout을 분리해야 한다.
- Skeleton step 기본 생성량은 장문 생성이 아니라 구조 초안이므로 작은 `num_predict`와 `num_ctx`를 사용해야 한다.
- Ollama 호출 전 `/api/tags` preflight로 daemon reachable 및 route model 존재 여부를 확인해야 한다.
- 실패 error code는 `provider_timeout`, `provider_first_byte_timeout`, `provider_idle_timeout`, `provider_network_error`, `provider_model_not_found`, `provider_empty_response`처럼 구분되어야 한다.
- step/run metadata와 `llm_call_logs.metadata`에는 `requestOptionsSummary`, provider safe summary, hash, length, response summary만 저장해야 한다.
- prompt 전문, raw response 전문, outputMarkdown 전문, candidate 전문, skeleton/section fragment 전문, secret/token/encryptedValue는 저장하지 않아야 한다.
- `scripts/smoke_9e4c3c_stepwise_local_ollama.mjs`는 기본적으로 route와 `/api/tags`를 확인하는 read-only helper로 동작한다.
- `--probe-generate` 옵션은 짧은 streaming generate probe만 수행하며 content item, Blogger table, draft generation run을 변경하지 않는다.
- 실제 step smoke는 run 생성, skeleton step 1회, content item hash/status 불변, Blogger count 불변, log redaction 확인 순서로 수행한다.
- selected model이 first-byte timeout을 반복하면 route/model 변경 또는 Ollama runner 정리 같은 운영 조치를 먼저 수행하고, timeout 무제한 연장으로 해결하지 않는다.

## Patch 9E-4C-3D Local stepwise deterministic assemble/final polish API 검증

- `POST /api/content-items/[id]/draft-generation-runs/[runId]/assemble`는 LLM provider를 호출하지 않아야 한다.
- assemble API는 `intro`, `body_1`, `body_2`, `body_3`, `conclusion_cta_faq` section step이 모두 `success`이고 `outputMarkdown`이 있을 때만 동작해야 한다.
- skeleton step output은 assembly body로 붙이지 않고 reference/precondition 용도로만 사용해야 한다.
- required section이 빠져 있으면 `section_steps_required` 계열 400/409 응답을 반환해야 한다.
- 성공 시 run의 `assembledCandidateMarkdown`, `validationSummary`, safe metadata만 갱신하고 `currentStepKey=final_polish`, `status=running`으로 이동해야 한다.
- 이미 assembled candidate가 있으면 `force=true`가 없을 때 기존 결과를 재사용하고 LLM/DB 추가 변경을 피해야 한다.
- `POST /api/content-items/[id]/draft-generation-runs/[runId]/final-polish`는 assembled candidate가 있을 때만 실행되어야 한다.
- final polish API는 기존 local stepwise provider policy를 재사용하며 local/Ollama/local_http-like `content_draft` route가 아니면 거부해야 한다.
- final polish 성공 시 run의 `finalCandidateMarkdown`, `validationSummary`, safe metadata를 저장하고 `status=completed`, `currentStepKey=null`, `completedAt`을 설정해야 한다.
- final polish 실패 시 assembled candidate는 fallback candidate로 남아야 하며, prompt/raw response/final candidate 전문을 `llm_call_logs.metadata`에 저장하지 않아야 한다.
- `llm_call_logs`에는 final polish의 run id, step key, prompt/response hash, output length, request options summary, provider safe summary만 저장해야 한다.
- `content_items.draftMarkdown`/`draftHtml`, status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경하지 않는다.
- Blogger API, draft save, publish, scheduled publish, token refresh는 호출하지 않는다.
- `scripts/smoke_9e4c3d_assemble_final_polish.mjs`는 API 기반 smoke helper이며 기본은 assemble만 수행하고 `--final-polish`가 있을 때만 LLM 호출을 포함한다.

## Patch 9E-4C-3E Content detail stepwise UI 검증

- `/content/[id]` 화면에 Stepwise Draft Generation 섹션이 표시되어야 한다.
- UI는 run 목록 조회, run 선택, 새 run 생성, skeleton/section step 실행, deterministic assemble, final polish를 기존 9E-4C API로 호출해야 한다.
- 성공한 step은 이번 UI에서 재실행 버튼을 제공하지 않고 완료/재사용 상태로 보여야 한다.
- assemble 버튼은 `intro`, `body_1`, `body_2`, `body_3`, `conclusion_cta_faq`가 모두 success이고 outputMarkdown이 있을 때만 활성화되어야 한다.
- final polish 버튼은 assembled candidate가 있을 때만 활성화되어야 한다.
- assembled/final candidate preview는 읽기 전용이어야 하며 `content_items.draftMarkdown`/`draftHtml`에 반영하는 버튼을 제공하지 않는다.
- UI 문구는 content item 자동 변경 없음, Blogger API/draft save/publish/token refresh 없음, run candidate only 정책을 명확히 표시해야 한다.
- timeout/model 관련 errorCode는 사람이 이해할 수 있는 안내로 표시해야 한다.
- Runtime smoke는 page 200, existing run 조회, 새 run 생성, precondition에 따른 버튼 활성화, content item/Blogger side effect 없음 순서로 확인한다.

## Patch 9E-4C-3F Stepwise final candidate manual apply guard 검증

- completed stepwise run에 `finalCandidateMarkdown`이 있으면 “수동 적용 후보로 사용” 버튼이 표시되어야 한다.
- 버튼 클릭은 client-side state만 변경해야 하며 API 호출, LLM 호출, DB write를 수행하지 않아야 한다.
- 기존 Draft Markdown 후보 textarea에 final candidate가 채워지고 source가 `stepwise final candidate`로 표시되어야 한다.
- 기존 `draftMarkdown에 반영` 버튼을 별도로 누르기 전까지 `content_items.draftMarkdown`/`draftHtml`, status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경되지 않아야 한다.
- Blogger API, Blogger draft save, publish, scheduled publish, token refresh는 호출하지 않아야 한다.
- `llm_call_logs`, `blogger_draft_saves`, `blogger_draft_approvals` count가 버튼 클릭만으로 증가하지 않아야 한다.

## Patch 9E-4D Blog post template renderer preview 검증

- `POST /api/content-items/[id]/blog-post-template-preview`는 request body의 Markdown 후보를 deterministic HTML theme preview로 변환한다.
- API는 content item/blog/brand/assets를 read-only로 조회하고 `content_items`, Blogger tables, `llm_call_logs`를 변경하지 않는다.
- Markdown 후보가 비어 있으면 400 `markdown_required`를 반환해야 한다.
- renderer는 raw HTML과 script/iframe/form/style/javascript/event-handler 계열 패턴을 escape하고 safe summary count만 반환해야 한다.
- preview summary에는 title candidate, theme, H1/H2/H3/paragraph/FAQ/media/unsafe pattern counts, warnings/errors, preview-only metadata가 포함되어야 한다.
- UI는 Draft Markdown 후보 섹션에서 “블로그 HTML preview 생성” 버튼을 제공하고, 결과를 iframe/read-only textarea로 표시한다.
- UI preview 영역은 `draftHtml에 반영` 버튼을 제공하지 않는다.
- preview 버튼 클릭 후 `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, `scheduledAt`이 변경되지 않아야 한다.
- preview 버튼 클릭 후 Blogger API/draft save/publish/token refresh와 LLM 호출이 발생하지 않아야 한다.

## Patch 9E-4E Blog HTML preview manual apply guard 검증

- Blog post template preview 결과가 있고 validation error가 없으면 “HTML 후보로 사용” 버튼이 표시/활성화되어야 한다.
- “HTML 후보로 사용”은 preview HTML을 기존 HTML candidate editor state로만 복사해야 한다.
- 복사 직후 HTML candidate source는 `blog template preview` 계열로 표시되어야 한다.
- 복사 직후 HTML candidate validation은 stale/empty 상태가 되어 기존 `validate-html` 재검증 전 `draftHtml에 반영` 버튼이 활성화되지 않아야 한다.
- 기존 `validate-html` / `apply-html` route와 버튼은 그대로 재사용해야 하며, 이번 패치에서 새 저장 API를 만들지 않는다.
- preview validation error가 있으면 HTML 후보로 가져오기 버튼은 disabled이거나 error 안내를 표시해야 한다.
- 버튼 클릭만으로 `content_items.draftMarkdown`/`draftHtml`, status, `qualityScore`, `publishedAt`, `scheduledAt`이 변경되지 않아야 한다.
- 버튼 클릭만으로 Blogger API, Blogger draft save, publish, scheduled publish, token refresh, LLM 호출, `llm_call_logs` 생성이 발생하지 않아야 한다.

## Patch 9E-4F Manual draftHtml apply guard hardening 검증

- `POST /api/content-items/[id]/apply-html`는 저장 전 서버에서 `validateHtmlCandidate`를 다시 실행해야 한다.
- 비어 있는 HTML, validation fail, 위험 태그/script/iframe/event handler/javascript URL/local path 패턴은 저장을 거부해야 한다.
- 저장 성공 시 업데이트 대상은 `content_items.draftHtml`뿐이어야 하며 `updatedAt` 외 `draftMarkdown`, status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경하지 않아야 한다.
- apply 응답에는 full HTML이 아닌 safe guard summary가 포함되어야 한다: source, validationOk, htmlLength, unsafePatternCount, appliedField, side-effect false flags.
- UI는 재검증 전 또는 validation fail/stale 상태에서 `draftHtml에 반영` 버튼을 disabled로 유지해야 한다.
- UI는 저장 버튼 주변에 draftHtml만 저장, Blogger draft save/publish/token refresh 없음, publish/scheduled publish 별도 단계 문구를 표시해야 한다.
- UI 저장은 2-step 명시 승인 guard를 사용한다: 첫 클릭은 저장 확인 대기 상태를 표시하고, 두 번째 클릭에서만 `apply-html`을 호출한다.
- 저장 성공 후 HTML candidate source는 saved/applied 상태로 표시되고, Quality Dry Run / Publish Readiness / Blogger Draft Payload Preview 재실행 및 draft approval stale 가능성을 안내해야 한다.
- 저장 smoke에서는 `draftHtml` hash만 변경되고 `draftMarkdown`, status, `qualityScore`, `publishedAt`, `scheduledAt`, Blogger tables, `llm_call_logs`는 변경되지 않아야 한다.

## Patch 9E-4G-1 Saved draftHtml readiness recheck / Blogger draft save preflight 검증

- `POST /api/content-items/[id]/blogger-draft-save-preflight`는 저장된 `draftHtml`만 기준으로 HTML validation, draft payload preview, approval snapshot match, publish-readiness summary를 다시 계산해야 한다.
- 응답에는 `canSaveDraft`, `blockingReasons`, `warnings`, `htmlHashPrefix`, `htmlLength`, selected blog summary, connection/token presence summary, approval snapshot status, draft payload summary, side-effect summary가 포함되어야 한다.
- side-effect summary는 `bloggerApiWrite=false`, `bloggerDraftSave=false`, `publish=false`, `scheduledPublish=false`, `tokenRefresh=false`, `llmCall=false`, `contentItemMutation=false`여야 한다.
- Blogger 연결이 없거나 verified selected blog가 없거나 active approval snapshot match가 없으면 `canSaveDraft=false`와 safe blocking reason을 반환해야 한다.
- UI는 Quality Dry Run, Publish Readiness, Blogger Draft Payload Preview, Draft Save Preflight를 저장된 `draftHtml` 기준 재확인 흐름으로 보여야 한다.
- Blogger Draft 저장 버튼은 approval 조건뿐 아니라 Draft Save Preflight 통과 전에는 disabled 상태여야 한다.
- `apply-html` 성공 후 기존 Quality Dry Run, Publish Readiness, Blogger Draft Payload Preview, Draft Save Preflight 결과는 stale/clear 처리되어야 한다.
- preflight 호출 전후 `content_items.draftMarkdown`/`draftHtml`, status, `qualityScore`, `publishedAt`, `scheduledAt`, Blogger tables, `llm_call_logs`는 변경되지 않아야 한다.
- preflight는 prompt/raw response/full `draftHtml`, access token, refresh token, encrypted value, raw Blogger response/error body를 반환하지 않아야 한다.

## Patch 9E-4G-1b Blogger draft save readiness UX / connection guidance 검증

- Content detail의 Draft Save Preflight 결과는 raw blocking key만 보여주지 않고 사용자 친화적인 next action을 함께 표시해야 한다.
- `blogger_connection_not_configured` 또는 `blogger_connection`은 `/settings/blogger` 이동 안내와 함께 Blogger 연결 완료 action으로 표시해야 한다.
- `blogger_blog_selection`은 대상 Blogger blog 선택 action으로 표시해야 한다.
- `manual_approval` 또는 `blogger_draft_approval_required`는 Draft Payload Preview 확인 후 수동 approval snapshot 생성 action으로 표시해야 한다.
- `draft_payload_not_ready`는 Draft Payload Preview 재실행 및 blocking issue 해결 action으로 표시해야 한다.
- `blogger_draft_saved`는 아직 draft save 성공 기록이 없거나 현재 approval과 일치하지 않는다는 안내로 표시해야 한다.
- UI checklist는 saved draftHtml, HTML validation, Quality Dry Run, Publish Readiness, Blogger connection, blog selection, payload preview, manual approval match, draft saved/save ready 상태를 표시해야 한다.
- connectionCount=0 상태에서 `/settings/blogger` 링크가 보이고 OAuth start를 자동 호출하지 않아야 한다.
- 실제 Blogger Draft 저장 버튼은 `canSaveDraft=false`일 때 disabled 상태를 유지해야 한다.
- UX 패치 전후 `content_items.draftMarkdown`/`draftHtml`, status, `qualityScore`, `publishedAt`, `scheduledAt`, Blogger tables, `llm_call_logs`는 변경되지 않아야 한다.

## Patch 9E-4G-1c Draft save preflight blocker classification 검증

- `blogger_draft_saved`는 publish-readiness check로 남을 수 있지만 first Blogger draft save를 위한 preflight blocker에는 포함하지 않아야 한다.
- 같은 active approval에 successful Blogger draft save가 이미 있으면 `blogger_draft_already_saved_for_approval`로 중복 저장을 차단해야 한다.
- access token이 만료되어 있고 token refresh가 구현되지 않았으면 `access_token_expired_reauth_required`를 blocking reason으로 반환해야 한다.
- expired token은 warning만으로 처리하지 않고 `canSaveDraft=false`를 만들어야 한다.
- env-backed `clientSecretRef`가 서버에서 해석 가능하면 encrypted `oauth_client_secret` row가 없어도 `blogger_client_secret_missing`을 반환하지 않아야 한다.
- preflight 응답은 `hasClientSecretRef`, `clientSecretConfigured`, `encryptedClientSecretStored`, `secretMaterialReturned=false` 같은 safe diagnostic boolean만 반환해야 한다.
- Content detail UI는 “draft not saved yet”을 첫 save 전 expected state로 표시하고, duplicate blocker는 same-approval success가 있을 때만 표시해야 한다.
- token refresh, OAuth start, Blogger draft save, Blogger API write, publish/scheduled publish, LLM 호출은 발생하지 않아야 한다.

## Patch 9E-4G-2a Blogger draft save UI gate activation 검증

- Content detail의 “Blogger Draft 저장” 버튼은 최신 Draft Save Preflight 결과가 통과했을 때 활성화되어야 한다.
- 활성 조건은 `canSaveDraft=true`, `blockingReasons=[]`, `draftPayloadReady=true`, approval snapshot approved/match, same-approval successful save 없음, 현재 저장 중 아님이어야 한다.
- `publishReadiness.ready=false`는 draft save 버튼을 비활성화하지 않아야 한다.
- `quality_grade` warning은 draft save 버튼을 비활성화하지 않아야 한다.
- 버튼 주변에는 preflight 통과 후 활성화, draft post 1개 생성, publish/scheduled publish/posts.update/token refresh 미실행 안내가 보여야 한다.
- UI는 실제 save route 호출 전에 2-step confirmation을 사용해야 한다.
- Codex smoke에서는 사용자 명시 승인 없이 “Blogger Draft 저장” 확정 클릭을 하지 않는다.
- save 성공 후에는 post id/draft URL이 있으면 표시하고, 같은 approval 중복 저장이 막히도록 UI state를 갱신해야 한다.
- save 실패 시 safe error만 표시하고 token/client secret/encrypted value/raw Blogger response/full draftHtml은 노출하지 않아야 한다.

## Patch 9E-4G-2b Blogger draft save success UX / admin link polish 검증

- live smoke에서 웹 UI를 통한 Blogger draft save가 1회 성공한 뒤 `blogger_draft_saves=1`, `blogger_draft_approvals=1`, `llm_call_logs=22`가 유지되어야 한다.
- 성공 row의 safe metadata가 Content detail에 표시되어야 한다: status, savedAt, approvalId, target blog name/id/url, title candidate, Blogger post id, stored Blogger post URL.
- blog id와 post id가 있으면 UI가 derived Blogger admin links를 표시해야 한다:
  - `https://www.blogger.com/blog/post/edit/{targetBloggerBlogId}/{bloggerPostId}`
  - `https://www.blogger.com/blog/post/edit/preview/{targetBloggerBlogId}/{bloggerPostId}`
- stored `bloggerPostUrl`이 blog home URL처럼 보이면 Blogger가 draft post에 blog/home URL을 반환할 수 있고 관리자 링크가 더 유용하다는 안내가 보여야 한다.
- post-save preflight에서 `blogger_draft_already_saved_for_approval`이 반환되면 scary error가 아니라 success/protection state로 표시되어야 한다.
- 같은 approval에 대한 “Blogger Draft 저장” 버튼은 disabled로 유지되어야 하며, 다른 draft save는 draftHtml 변경 및 새 approval snapshot이 필요하다는 안내가 보여야 한다.
- UI는 `publish=false`, `scheduledPublish=false`, `posts.update not implemented`, `token refresh not implemented`를 명확히 표시해야 한다.
- 9E-4G-2b 구현/스모크 중에는 Blogger API write, 추가 draft save, publish/scheduled publish, posts.update, token refresh, LLM 호출, content item mutation이 발생하지 않아야 한다.

## 2026-06-16 Session Closeout Smoke Baseline

Confirmed milestone:

- Stepwise final candidate can flow through manual Draft Markdown candidate handoff.
- Blog template preview can render deterministic Blogger-ready HTML preview.
- Template HTML can flow through manual HTML candidate handoff.
- `validate-html` and explicit 2-step `apply-html` can save only `draftHtml`.
- Blogger OAuth connection and verified blog selection are configured for the test blog.
- Blogger draft payload preview, approval snapshot, and draft save preflight can gate real draft save.
- Web UI Blogger draft save succeeded once for the test content item.

Post-save baseline:

- `contentItemId=cmqc2xqbr00011y70sxmgl65v`
- `approvalId=cmqfwjz9u0009iwag9auo688v`
- `bloggerPostId=6376467965797870330`
- `blogger_draft_saves=1`
- `blogger_draft_approvals=1`
- `llm_call_logs=22`
- `draftMarkdown` md5 unchanged: `9e0921e7edc9e4a8464a0a52ba369d3d`
- `draftHtml` md5 unchanged: `a7393df8fb009566201daeea18796027`
- content item status remains `planned`
- `qualityScore`, `publishedAt`, and `scheduledAt` unchanged
- post-save preflight blocks duplicate save with `blogger_draft_already_saved_for_approval`

Next tests:

- Post-save publish-readiness refresh should show draft saved while keeping `publishReady=false` and top-level `ready=false`.
- Token expiry/re-auth behavior should be tested without implementing automatic refresh.
- Draft correction/update/retry policy should be tested only after a separate posts.update/retry design patch.
- Publish and scheduled publish tests remain forbidden until a later explicit design/approval patch.

Safety guard:

- Do not run another Blogger draft save for the same approval.
- Do not call publish, scheduled publish, `posts.update`, token refresh, or LLM in closeout/readiness UX patches.
- Do not mutate content item status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- Do not read, print, modify, or stage `.env.local`, `.env.local.backup*`, token files, client secrets, encrypted values, or secret backup files.

## Patch 9E-4H Post-save publish-readiness UX refresh 검증

- Publish Readiness Check 실행 후 `Post-save Publish Readiness Status` 블록이 보여야 한다.
- Blogger draft save 성공 기록이 있으면 “초안 저장 완료, 발행 구현 전” 상태로 표시해야 한다.
- Blogger Draft Saved, Blogger Draft Post ID, Blogger Draft Saved At, Manual Approval Match가 표시되어야 한다.
- Draft Save Preflight를 실행해 duplicate blocker가 확인된 경우 Duplicate Save Protection은 protective state로 표시되어야 한다.
- `publishReady=false`와 top-level `ready=false`가 명확히 보여야 한다.
- Publish, Scheduled Publish, `posts.update`, Token Refresh는 `not implemented`로 표시되어야 한다.
- Access token 만료 blocker가 preflight에 있으면 향후 Blogger write 전 OAuth 재연결이 필요하고 token refresh 자동 구현은 범위 밖이라는 안내가 보여야 한다.
- Blogger blog id와 draft post id가 있으면 관리자 edit/preview 링크가 표시되어야 한다.
- Publish Readiness Check, Draft Save Preflight, UI 확인 중 Blogger API write, 추가 draft save, publish/scheduled publish, `posts.update`, token refresh, LLM 호출, DB 저장은 발생하지 않아야 한다.
- DB guard 기대값은 session closeout baseline과 동일해야 한다: `blogger_draft_saves=1`, `blogger_draft_approvals=1`, `llm_call_logs=22`, content item status `planned`, draft hashes unchanged.

## Patch 9E-5A Blogger token refresh readiness/design 검증

- Draft Save Preflight가 `access_token_expired_reauth_required`를 반환하면 UI가 Blogger OAuth 재연결 필요를 명확히 안내해야 한다.
- 안내는 이미 저장된 Blogger draft가 유지되고 같은 approval의 duplicate save protection이 계속 동작한다고 설명해야 한다.
- 안내는 다음 Blogger write 전 OAuth 재연결이 필요하다고 말해야 하며, 자동 token refresh가 구현된 것처럼 표현하면 안 된다.
- `/settings/blogger`로 이동하는 재연결 확인 링크는 허용되지만 OAuth start/token endpoint/refresh endpoint를 자동 호출하면 안 된다.
- UI/API/log/test output에는 access token, refresh token, client secret, encrypted value, raw OAuth response가 노출되지 않아야 한다.
- Preflight side effect summary는 `tokenRefresh=false`, `bloggerApiWrite=false`, `bloggerDraftSave=false`, `publish=false`, `scheduledPublish=false`, `llmCall=false`, `contentItemMutation=false`를 유지해야 한다.
- Publish readiness는 계속 `ready=false`, `publishReady=false`, `stage=draft_saved_publish_not_implemented`, `metadata.bloggerDraftSaved=true`를 유지해야 한다.
- DB guard 기대값은 변경 전과 동일해야 한다: `blogger_draft_saves=1`, `blogger_draft_approvals=1`, `llm_call_logs=22`, content item status `planned`, draft hashes unchanged.

## Patch 9E-5B Blogger posts.update / retry policy planning 검증

- Content detail UI는 저장된 Blogger draft가 이미 있고 같은 approval snapshot으로는 duplicate protection 때문에 다시 저장하지 않는다고 설명해야 한다.
- UI는 `Draft Update Policy: planning only`, `posts.update: not implemented`, `Retry Policy: planning only`, `Duplicate Save: blocked for current approval` 의미를 보여야 한다.
- UI는 저장된 Blogger draft 수정에는 `posts.update`, 새 approval, 새 draft save 중 별도 승인된 정책이 필요하다고 안내해야 한다.
- Retry는 timeout/network/5xx 같은 제한된 실패에서만 검토 가능하고, 이미 성공한 approval, token expired, approval mismatch, content hash mismatch, publish 단계에서는 retry하지 않는다고 안내해야 한다.
- UI는 Blogger `posts.update`가 외부 Blogger draft를 직접 수정하며 쉽게 rollback된다고 가정하면 안 된다고 안내해야 한다.
- token expired 상태에서는 update/retry보다 OAuth 재연결 안내가 우선이어야 한다.
- Blogger Draft 저장 버튼은 계속 disabled여야 하며 update/retry/save 버튼이 새로 생기면 안 된다.
- Draft Save Preflight는 계속 `canSaveDraft=false`, `blogger_draft_already_saved_for_approval`, `access_token_expired_reauth_required`, side-effect all false를 유지해야 한다.
- Publish readiness는 계속 `ready=false`, `publishReady=false`, `stage=draft_saved_publish_not_implemented`, `metadata.bloggerDraftSaved=true`를 유지해야 한다.
- 9E-5B 구현/스모크 중에는 Blogger API write, 추가 draft save, `posts.update`, publish/scheduled publish, token refresh, LLM 호출, DB/schema/content item mutation이 발생하지 않아야 한다.

## Patch 9E-6A Publish / Scheduled Publish policy design 검증

- Content detail UI는 Blogger draft 저장 완료가 publish-ready가 아니라는 점을 명확히 표시해야 한다.
- UI는 `Publish / Scheduled Publish Policy` 또는 동등한 planning-only 안내를 표시해야 한다.
- UI는 `publishReady=false`와 top-level `ready=false` 의미를 유지해야 한다.
- UI는 publish/scheduled publish가 아직 구현되지 않았고 별도 approval, preflight, side-effect summary, rollback 안내가 필요하다고 설명해야 한다.
- UI는 `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml` 변경이 이번 패치에서 허용되지 않는다고 안내해야 한다.
- token expired 상태에서는 publish/scheduled publish보다 OAuth 재연결이 우선이라는 안내가 유지되어야 한다.
- posts.update/retry 정책과 publish/scheduled publish 정책은 분리되어 표시되어야 한다.
- publish 또는 scheduled publish 버튼이 새로 활성화되면 안 되며, Blogger Draft 저장 버튼도 same-approval duplicate 상태에서는 disabled여야 한다.
- Draft Save Preflight는 계속 `canSaveDraft=false`, `blogger_draft_already_saved_for_approval`, `access_token_expired_reauth_required`, side-effect all false를 유지해야 한다.
- Publish readiness는 계속 `ready=false`, `contentReady=true`, `publishReady=false`, `stage=draft_saved_publish_not_implemented`, `metadata.bloggerDraftSaved=true`를 유지해야 한다.
- 9E-6A 구현/스모크 중에는 Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, LLM 호출, DB/schema/content item mutation이 발생하지 않아야 한다.

## Patch 9E-6B Publish preflight dry-run 검증

- `POST /api/content-items/[id]/publish-preflight`는 read-only dry-run이어야 한다.
- 응답은 `canPublish=false`, `canSchedulePublish=false`를 유지해야 한다.
- `blockingReasons`에는 `publish_not_implemented`, `scheduled_publish_not_implemented`, `publish_approval_not_implemented`, `content_item_mutation_policy_not_implemented`가 포함되어야 한다.
- 현재 token expiry metadata가 만료 상태이면 `access_token_expired_reauth_required`도 포함되어야 한다.
- 성공한 Blogger draft save가 있으면 `publishPreflightSummary.bloggerDraftSaved=true`, `bloggerPostId`와 target blog safe metadata가 표시되어야 한다.
- duplicate save protection은 warning/summary로 표시할 수 있지만 publish permission으로 해석하면 안 된다.
- `sideEffectSummary`는 `bloggerApiWrite=false`, `bloggerPublish=false`, `bloggerScheduledPublish=false`, `bloggerPostsUpdate=false`, `bloggerDraftSave=false`, `tokenRefresh=false`, `llmCall=false`, `contentItemMutation=false`여야 한다.
- Content Detail UI는 Publish Preflight Dry-run 버튼과 결과 블록을 보여야 하며, publish/scheduled publish 실행 버튼을 활성화하면 안 된다.
- UI는 requiredBeforePublish, requiredBeforeScheduledPublish, proposed publish approval snapshot fields를 표시해야 한다.
- Publish Readiness는 계속 `ready=false`, `contentReady=true`, `publishReady=false`, `stage=draft_saved_publish_not_implemented`, `metadata.bloggerDraftSaved=true`를 유지해야 한다.
- 9E-6B 구현/스모크 중에는 Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, LLM 호출, DB/schema/content item mutation이 발생하지 않아야 한다.

## Patch 9E-6C Publish approval snapshot preview 검증

- `POST /api/content-items/[id]/publish-approval-preview`는 read-only snapshot/hash preview여야 한다.
- 응답은 `canCreatePublishApproval=false`, `canPublish=false`, `canSchedulePublish=false`를 유지해야 한다.
- `blockingReasons`에는 `publish_approval_persistence_not_implemented`, `publish_not_implemented`, `scheduled_publish_not_implemented`가 포함되어야 한다.
- 현재 token expiry metadata가 만료 상태이면 `access_token_expired_reauth_required`도 포함되어야 한다.
- `approvalSnapshotPreview`에는 content item id/status, draft hashes, target Blogger blog id, Blogger post id, publishMode, tokenState가 safe metadata로 표시되어야 한다.
- `approvalSnapshotHashPreview`는 non-empty SHA-256 hex string이어야 하지만 DB에 저장된 approval hash로 표시하면 안 된다.
- `sideEffectSummary`는 `bloggerApiWrite=false`, `bloggerPublish=false`, `bloggerScheduledPublish=false`, `bloggerPostsUpdate=false`, `bloggerDraftSave=false`, `tokenRefresh=false`, `llmCall=false`, `contentItemMutation=false`, `dbWrite=false`, `approvalPersistence=false`여야 한다.
- Content Detail UI는 Publish Approval Snapshot Preview 버튼과 결과 블록을 보여야 하며, publish approval 생성/publish/scheduled publish 실행 버튼을 활성화하면 안 된다.
- UI는 requiredBeforeApprovalPersistence를 표시해야 한다.
- 9E-6C 구현/스모크 중에는 publish approval insert/update, Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, LLM 호출, DB/schema/content item mutation이 발생하지 않아야 한다.

## Patch 9E-6D Publish approval persistence policy/schema plan 검증

- Content Detail UI는 Publish Approval Snapshot Preview 결과 안에 `Publish Approval Persistence Policy` 안내를 표시해야 한다.
- UI는 approval persistence, schema/migration, approval DB write가 `not implemented` 또는 planning-only임을 보여야 한다.
- UI는 snapshot hash가 preview-only이며 DB에 저장된 approval hash가 아님을 보여야 한다.
- UI는 immutable snapshot, invalidation triggers, rollback acknowledgement, side-effect acknowledgement, token state checkedAt, publish attempt audit model이 approval persistence 전 필요하다고 표시해야 한다.
- UI는 draft hash, title, target blog, Blogger post id, schedule/timezone, content status, token state 변경이 approval을 stale 또는 invalidated 상태로 만들어야 한다고 안내해야 한다.
- `POST /api/content-items/[id]/publish-approval-preview` 응답은 계속 `canCreatePublishApproval=false`, `canPublish=false`, `canSchedulePublish=false`, `approvalPersistence=false`, `dbWrite=false`를 유지해야 한다.
- `POST /api/content-items/[id]/publish-preflight` 응답은 계속 `canPublish=false`, `canSchedulePublish=false`를 유지해야 한다.
- Publish Readiness는 계속 `ready=false`, `contentReady=true`, `publishReady=false`, `stage=draft_saved_publish_not_implemented`, `metadata.bloggerDraftSaved=true`를 유지해야 한다.
- 9E-6D 구현/스모크 중에는 Prisma schema/migration 변경, publish approval insert/update, Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, token endpoint call, LLM 호출, DB write/mutation, content item mutation이 발생하지 않아야 한다.
- DB guard 기대값은 기존 post-save baseline과 같아야 한다: `blogger_draft_saves=1`, `blogger_draft_approvals=1`, `llm_call_logs=22`, content item status `planned`, draft hashes unchanged.

## Patch 9E-7A Publish approval persistence storage 검증

- Prisma schema에 `BloggerPublishApproval` model과 publish approval mode/status enum이 있어야 한다.
- `blogger_publish_approvals` table이 존재해야 한다.
- 새 table은 smoke 전 count `0`이어야 한다.
- `POST /api/content-items/[id]/publish-approval-preview`는 더 이상 `publish_approval_persistence_not_implemented` blocker를 반환하지 않아야 한다.
- preview는 `explicit_publish_approval_save_required`, `rollback_acknowledgement_required`, `side_effect_summary_acknowledgement_required`, `approval_persistence_acknowledgement_required`를 표시할 수 있다.
- `POST /api/content-items/[id]/publish-approval-save`는 acknowledgement가 없으면 `acknowledgement_required`로 실패하고 DB insert를 만들지 않아야 한다.
- 실제 save smoke는 사용자 명시 승인 없이는 수행하지 않는다.
- 실제 save smoke를 수행하는 경우 response는 approval id, snapshot hash, `canPublish=false`, `canSchedulePublish=false`, `contentItemMutation=false`, `bloggerApiWrite=false`, `bloggerPublish=false`, `bloggerScheduledPublish=false`, `tokenRefresh=false`, `llmCall=false`를 반환해야 한다.
- 저장된 snapshot에는 access token, refresh token, client secret, encrypted value, raw OAuth response, raw Blogger response/error body, full `draftHtml`이 없어야 한다.
- Content Detail UI는 acknowledgement checkbox 3개와 Save Publish Approval Snapshot 버튼을 보여야 한다.
- checkbox 전에는 save 버튼이 disabled여야 한다.
- UI는 approval 저장이 local DB snapshot storage일 뿐 publish 실행이 아니라고 표시해야 한다.
- publish/scheduled publish 실행 버튼은 여전히 없어야 하거나 disabled여야 한다.
- Blogger Draft 저장 버튼은 duplicate save 상태에서 계속 disabled여야 한다.
- Draft Save Preflight는 계속 duplicate blocker와 token expired blocker를 표시하고 side-effect all false를 유지해야 한다.
- Publish Readiness는 계속 `ready=false`, `contentReady=true`, `publishReady=false`, `stage=draft_saved_publish_not_implemented`를 유지해야 한다.
- Publish Preflight는 계속 `canPublish=false`, `canSchedulePublish=false`, side-effect all false를 유지해야 한다.
- 9E-7A 구현/스모크 중에는 Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, token endpoint call, LLM 호출, content item mutation이 발생하지 않아야 한다.

## Patch 9E-7B Publish approval persistence smoke/readback 검증

- 시작 전 `blogger_publish_approvals` count는 `0`이어야 한다. 이미 1 이상이면 existing readback/idempotency 중심으로 진행한다.
- `publish-approval-save` acknowledgement false 요청은 `acknowledgement_required`로 실패해야 하고 count를 증가시키면 안 된다.
- acknowledgement true 요청은 local DB에 publish approval snapshot 1건을 저장해야 한다.
- first save response는 `approvalId` present, `created=true`, `existing=false`, `canPublish=false`, `canSchedulePublish=false`여야 한다.
- first save side effects는 `dbWrite=true`, `approvalPersistence=true`, `contentItemMutation=false`, `bloggerApiWrite=false`, `bloggerPublish=false`, `bloggerScheduledPublish=false`, `tokenRefresh=false`, `llmCall=false`여야 한다.
- `blogger_publish_approvals` count는 first save 후 `1`이어야 한다.
- `publish-approval-readback`은 `count=1`, `latestApproval.id` present, latest snapshot hash equals saved snapshot hash, `canPublish=false`, `canSchedulePublish=false`를 반환해야 한다.
- readback side effects는 `dbRead=true`, `dbWrite=false`, `approvalPersistence=false`, Blogger write false, token refresh false, content mutation false, LLM false여야 한다.
- same snapshot save를 다시 실행하면 같은 approval id를 반환하고 `created=false`, `existing=true`여야 한다.
- idempotent save 후 `blogger_publish_approvals` count는 계속 `1`이어야 한다.
- Content Detail UI는 latest saved approval summary를 표시해야 한다.
- UI는 저장된 approval이 publish 실행이 아니며 `canPublish=false`, `canSchedulePublish=false`가 유지된다고 표시해야 한다.
- Blogger Draft 저장 버튼은 duplicate save 상태에서 계속 disabled여야 한다.
- publish/scheduled publish 실행 버튼은 새로 활성화되면 안 된다.
- 9E-7B 구현/스모크 중에는 Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, token endpoint call, LLM 호출, content item mutation이 발생하지 않아야 한다.

## Patch 9E-7C Publish approval execution guard 검증

- `POST /api/content-items/[id]/publish-approval-execution-guard`는 read-only route여야 한다.
- 응답은 latest saved publish approval과 current content item/Blogger draft metadata를 비교해야 한다.
- 현재 기준 item에서는 `approvalFound=true`, `approvalActive=true`, `approvalMatchesCurrentState=true`가 기대된다.
- 응답은 `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canPublish=false`, `canSchedulePublish=false`를 유지해야 한다.
- `blockingReasons`에는 `publish_execution_not_implemented`, `publish_not_implemented`, `scheduled_publish_not_implemented`, `content_item_mutation_policy_not_implemented`가 포함되어야 한다.
- token expired 상태이면 `access_token_expired_reauth_required`가 계속 포함되어야 한다.
- current state mismatch가 없으면 `invalidationCandidates=[]`가 기대된다.
- mismatch가 있으면 `draft_html_hash_changed`, `draft_markdown_hash_changed`, `draft_html_length_changed`, `title_candidate_changed`, `target_blogger_blog_changed`, `blogger_post_id_changed`, `content_status_changed`, `scheduled_at_changed`, `timezone_changed` 같은 read-only invalidation candidate가 표시되어야 한다.
- `sideEffectSummary`는 `dbRead=true`, `dbWrite=false`, `approvalInvalidation=false`, Blogger write false, token refresh false, content mutation false, LLM false여야 한다.
- Content Detail UI는 execution guard result, match summary, invalidation candidates, blockers, required-before-execution gates를 표시해야 한다.
- UI는 invalidation candidates가 read-only 판단 결과이며 이번 패치에서 DB에 `invalidatedAt`을 쓰지 않는다고 표시해야 한다.
- 9E-7C 구현/스모크 중에는 `blogger_publish_approvals` insert/update, approval invalidation DB update, Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, token endpoint call, LLM 호출, content item mutation이 발생하지 않아야 한다.

## Patch 9E-7D Publish approval invalidation dry-run 검증

- `POST /api/content-items/[id]/publish-approval-invalidation-preview`는 read-only route여야 한다.
- normal preview는 latest saved publish approval과 execution guard 결과를 기반으로 invalidation plan만 반환해야 한다.
- 현재 기준 item에서는 `approvalFound=true`, `approvalActive=true`, `approvalMatchesCurrentState=true`, `wouldInvalidate=false`, `canInvalidate=false`, `invalidationReasons=[]`, `invalidationCandidates=[]`가 기대된다.
- manual dry-run 요청은 `manualInvalidationRequested=true`, `wouldInvalidate=true`, `canInvalidate=false`, `invalidationReasons`에 `manual_user_requested_invalidation`을 포함해야 한다.
- 모든 invalidation preview 응답은 `invalidation_persistence_not_implemented` 또는 동등한 blocker를 유지해야 한다.
- `sideEffectSummary`는 `dbRead=true`, `dbWrite=false`, `approvalInvalidation=false`, Blogger write false, token refresh false, content mutation false, LLM false여야 한다.
- `invalidationPlan.dryRunOnly=true`, `dbUpdateImplemented=false`여야 한다.
- Content Detail UI는 invalidation preview result, manual reason dry-run, invalidation reasons/candidates, dry-run plan, side-effect summary를 표시해야 한다.
- UI는 manual reason을 입력해도 이번 단계에서는 DB에 `invalidatedAt`/`invalidatedReason`을 쓰지 않는다고 표시해야 한다.
- 9E-7D 구현/스모크 중에는 `blogger_publish_approvals` insert/update/delete, approval invalidation DB update, Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, token endpoint call, LLM 호출, content item mutation이 발생하지 않아야 한다.

## Patch 9E-7E Publish execution attempt preview 검증

- `POST /api/content-items/[id]/publish-execution-attempt-preview`는 read-only route여야 한다.
- 응답은 latest saved publish approval, latest successful Blogger draft save, token expiry state, execution guard 결과를 기반으로 future attempt plan만 반환해야 한다.
- 현재 기준 item에서는 `approvalId=cmqh37dbb0001iwd7ft6yrxo0`, `approvalMatchesCurrentState=true`, `invalidationCandidates=[]`가 기대된다.
- 응답은 `attemptStorageImplemented=false`, `wouldCreateAttempt=false`, `canCreateAttempt=false`, `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canPublish=false`, `canSchedulePublish=false`를 유지해야 한다.
- `blockingReasons`에는 `attempt_storage_not_implemented`, `publish_execution_not_implemented`가 포함되어야 한다.
- token expired 상태이면 `access_token_expired_reauth_required`가 계속 포함되어야 한다.
- `plannedAttempt.futureTable=blogger_publish_execution_attempts`, `plannedAttempt.status=planned_only`, `plannedAttempt.publishApprovalId`와 `plannedAttempt.publishApprovalSnapshotHash`가 saved approval과 일치해야 한다.
- `failurePolicySummary`는 retry eligible, retry blocked, partial failure 예시를 포함해야 한다.
- `redactionPolicySummary`는 raw Blogger response/error body, tokens, encrypted values, full HTML, prompt/raw LLM response 저장 금지를 명시해야 한다.
- `contentMutationOrdering`은 Blogger success 기록과 `content_items.status`/`publishedAt` mutation을 분리해야 한다고 표시해야 한다.
- `sideEffectSummary`는 `dbRead=true`, `dbWrite=false`, `attemptPersistence=false`, Blogger write false, publish false, scheduled publish false, token refresh false, content mutation false, LLM false여야 한다.
- Content Detail UI는 Publish Execution Attempt Preview 버튼과 planning-only result, blockers, failure/retry/partial failure policy, redaction policy, side-effect summary를 표시해야 한다.
- UI는 Create attempt, Publish, Schedule Publish, Retry, Token Refresh 실행 버튼을 제공하면 안 된다.
- 9E-7E 구현/스모크 중에는 schema/migration 변경, attempt insert, `blogger_publish_approvals` update/delete, approval invalidation DB update, Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, token endpoint call, LLM 호출, content item mutation이 발생하지 않아야 한다.

## Patch 9E-7F Publish execution attempt storage 검증

- Prisma schema에 `BloggerPublishExecutionAttempt` model과 `BloggerPublishExecutionAttemptStatus` enum이 있어야 한다.
- `blogger_publish_execution_attempts` table이 존재해야 한다.
- 새 table은 approved save smoke 전 count `0`이어야 한다.
- `publish-execution-attempt-preview`는 `attemptStorageImplemented=true`, `attemptPlanHashPreview` present, `canCreateAttempt=false`, `canExecutePublish=false`, `canExecuteScheduledPublish=false`를 반환해야 한다.
- preview blockers에는 `explicit_attempt_save_required`, `attempt_acknowledgement_required`, `publish_execution_not_implemented`가 포함되어야 한다.
- acknowledgement false save 요청은 `attempt_acknowledgement_required` 또는 acknowledgement blocker로 실패하고 insert를 만들지 않아야 한다.
- acknowledgement true save 요청은 local DB에 publish execution attempt plan 1건을 저장해야 한다.
- first save response는 `attemptId` present, `created=true`, `existing=false`, `canExecutePublish=false`, `canExecuteScheduledPublish=false`여야 한다.
- first save side effects는 `dbWrite=true`, `attemptPersistence=true`, `contentItemMutation=false`, `bloggerApiWrite=false`, `bloggerPublish=false`, `bloggerScheduledPublish=false`, `tokenRefresh=false`, `llmCall=false`여야 한다.
- 같은 attempt plan을 다시 저장하면 같은 attempt id를 반환하고 `created=false`, `existing=true`여야 한다.
- idempotent save 후 `blogger_publish_execution_attempts` count는 계속 `1`이어야 한다.
- readback은 `count=1`, `latestAttempt.id` present, latest attempt plan hash equals saved hash, `canExecutePublish=false`, `canExecuteScheduledPublish=false`를 반환해야 한다.
- readback side effects는 `dbRead=true`, `dbWrite=false`, `attemptPersistence=false`, Blogger write false, token refresh false, content mutation false, LLM false여야 한다.
- Content Detail UI는 acknowledgement checkbox 3개, Save Publish Execution Attempt Plan 버튼, saved attempt readback summary를 표시해야 한다.
- checkbox 전에는 save 버튼이 disabled여야 한다.
- UI는 attempt 저장이 local DB planning record일 뿐 publish 실행이 아니라고 표시해야 한다.
- publish/scheduled publish 실행 버튼은 새로 활성화되면 안 된다.
- Blogger Draft 저장 버튼은 duplicate save 상태에서 계속 disabled여야 한다.
- 저장된 attempt에는 access token, refresh token, client secret, encrypted value, raw OAuth response, raw Blogger response/error body, full `draftHtml`이 없어야 한다.
- 9E-7F 구현/스모크 중에는 Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, token endpoint call, approval invalidation DB update, LLM 호출, content item mutation이 발생하지 않아야 한다.

## Patch 9E-8A Publish OAuth reconnect gate 검증

- `POST /api/content-items/[id]/publish-oauth-gate`는 read-only로 동작해야 한다.
- 응답은 safe Blogger connection metadata, selected blog metadata, access token expiry state, latest saved publish approval id, latest saved publish attempt id만 포함해야 한다.
- access token이 만료된 경우 `accessTokenState=expired_reauth_required`, `reauthRequired=true`, `manualReconnectRequired=true`, `tokenRefreshImplemented=false`, `autoReconnectImplemented=false`를 반환해야 한다.
- expired token 상태에서는 `access_token_expired_reauth_required`, `manual_blogger_oauth_reconnect_required`, `token_refresh_not_implemented`, `oauth_gate_not_satisfied`, `publish_execution_not_allowed_until_oauth_gate_passes` blocker가 보여야 한다.
- saved publish approval과 saved publish execution attempt가 있어도 `canProceedToPublishExecution=false`, `canProceedToScheduledPublishExecution=false`, `canPublish=false`, `canSchedulePublish=false`를 유지해야 한다.
- Content Detail UI는 `Check Publish OAuth Gate` 버튼, blocker/warning 목록, `/settings/blogger` 재연결 안내, side-effect summary를 표시해야 한다.
- side effects는 `dbRead=true`이고 `dbWrite=false`, OAuth reconnect false, token refresh false, Blogger write/publish/scheduled publish/posts.update/draft save false, content mutation false, LLM false여야 한다.
- UI/API/log/test output에는 access token, refresh token, client secret, encrypted value, raw OAuth response, raw Blogger response/error body가 노출되지 않아야 한다.
- 9E-8A 구현/스모크 중에는 OAuth reconnect 실행, token endpoint call, Blogger API write, additional draft save, `posts.update`, publish/scheduled publish, token refresh, approval invalidation update, attempt status update, LLM 호출, content item mutation이 발생하지 않아야 한다.

## Patch 9E-8B Manual OAuth reconnect completion gate 검증

- `POST /api/content-items/[id]/publish-oauth-gate`는 기존 route를 확장해 `manualReconnectCompletionSummary`를 반환해야 한다.
- 별도 OAuth reconnect, token refresh, Blogger API read/write, publish, scheduled publish, `posts.update`, additional draft save, approval invalidation update, attempt status update, content item mutation, LLM 호출은 발생하지 않아야 한다.
- access token이 아직 만료 상태라면 `manualReconnectCompletionSummary.accessTokenState=expired_reauth_required`, `reauthRequired=true`, `manualReconnectRequired=true`, `reconnectCompletionReady=false`여야 한다.
- saved approval/attempt가 있더라도 `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canProceedToPublishExecution=false`, `canProceedToScheduledPublishExecution=false`를 유지해야 한다.
- `manualReconnectCompletionSummary`는 connection/blog selection, selected blog vs approval target, approval validity, attempt planning-only status, content status, draft markdown/html hash match, target blog match를 safe boolean/null metadata로 표시해야 한다.
- 정상에 가까운 상태에서도 `final_publish_preflight_not_implemented`와 `publish_execution_still_disabled_until_final_preflight` blocker를 유지해야 한다.
- side effects는 `dbRead=true`이고 `dbWrite=false`, `bloggerRead=false`, `bloggerWrite=false`, Blogger publish false, token refresh false, OAuth reconnect false, content mutation false, LLM false여야 한다.
- UI는 Manual Reconnect Completion Readiness 블록을 표시하고 `/settings/blogger` 재연결 안내와 final publish preflight 미구현 상태를 명확히 보여야 한다.
- 9F 운영 자동화 로드맵 후보: 장기적으로 운영자가 매번 설정을 입력하는 구조가 아니라 Blog Operation Profile, 기본 정책, 예외 중심 대시보드 기반 자동 운영 구조로 전환하는 방향을 검토한다.

## Patch 9E-8C Final publish execution preflight summary 검증

- `POST /api/content-items/[id]/publish-oauth-gate`는 기존 route를 확장해 `finalPublishExecutionPreflightSummary`를 반환해야 한다.
- Summary는 publish approval, publish execution attempt, OAuth gate, manual reconnect completion readiness, content snapshot/hash, target blog snapshot, rollback/safety acknowledgement placeholder, side-effect summary를 통합해야 한다.
- `canProceedToPublishExecution=false`, `canProceedToScheduledPublishExecution=false`, `canExecutePublish=false`, `canExecuteScheduledPublish=false`를 유지해야 한다.
- access token이 아직 expired 상태라면 final summary blocker에 `access_token_still_expired_reauth_required`와 `manual_reconnect_completion_not_ready`가 포함되어야 한다.
- 정상에 가까운 상태에서도 `guarded_blogger_publish_not_implemented`, `publish_execution_still_disabled_until_guarded_publish_implementation`, `final_human_approval_required`는 blocker 또는 warning으로 유지되어야 한다.
- `rollbackPlanAcknowledged=false`, `externalWriteRiskAcknowledged=false`, `finalHumanApprovalRequired=true`를 표시해야 한다.
- Final preflight side effects는 `dbRead=true`, `dbWrite=false`, `bloggerRead=false`, `bloggerWrite=false`, `bloggerPublish=false`, `bloggerUpdate=false`, `tokenRefresh=false`, `oauthReconnect=false`, `contentMutation=false`, `approvalMutation=false`, `attemptMutation=false`, `llmCall=false`, `externalSend=false`여야 한다.
- UI는 Final Publish Execution Preflight 블록을 표시하고 “Final publish execution is still disabled until guarded Blogger publish implementation is added.” 문구를 유지해야 한다.
- 9E-8C 구현/스모크 중에는 Blogger publish/write, Blogger `posts.update`, OAuth reconnect, token refresh, DB/content/approval/attempt mutation, external send, LLM 호출이 발생하지 않아야 한다.
- 9F 운영 자동화 로드맵 후보는 계속 유지한다: Blog Operation Profile, 기본 정책, 예외 중심 대시보드 기반 자동 운영 구조.

## Patch 9E-9A Guarded Blogger publish execution design 검증

- `POST /api/content-items/[id]/publish-oauth-gate`는 기존 route를 확장해 `guardedPublishExecutionDesignSummary`를 반환해야 한다.
- 별도 publish execution route, Blogger write route, Blogger read route, OAuth reconnect route, token refresh route를 추가하지 않아야 한다.
- post-reconnect 상태에서 final preflight가 ready이면 `finalPublishExecutionPreflightSummary.finalPreflightReady=true`가 유지되어야 한다.
- `guardedPublishExecutionDesignSummary.designVersion=9E-9A`, `implementationStatus=design_only_not_implemented`, `guardedPublishImplementationReady=false`여야 한다.
- `canProceedToPublishExecution=false`, `canProceedToScheduledPublishExecution=false`, `canExecutePublish=false`, `canPublish=false`, `canSchedulePublish=false`를 계속 유지해야 한다.
- final preflight가 ready인 상태에서는 legacy blocker `final_publish_preflight_not_implemented`와 `publish_execution_still_disabled_until_final_preflight`가 top-level/manual reconnect blocker에 남지 않아야 한다.
- blocker에는 `guarded_blogger_publish_not_implemented`, `publish_execution_still_disabled_until_guarded_publish_implementation`, `rollback_plan_not_acknowledged`, `external_write_risk_not_acknowledged`, `final_human_approval_required`가 남아야 한다.
- summary는 publish approval id, publish execution attempt id, Blogger draft save id, target Blogger blog id/name/url, existing Blogger post id, planned operation kind, planned Blogger API action을 safe metadata로 표시해야 한다.
- redacted request plan은 access token, refresh token, client secret, encrypted value, raw Blogger request/response body, full `draftHtml`을 포함하지 않아야 한다.
- side effects는 `dbRead=true`이고 `dbWrite=false`, `bloggerRead=false`, `bloggerWrite=false`, `bloggerPublish=false`, `bloggerUpdate=false`, `bloggerDraftSave=false`, `tokenRefresh=false`, `oauthReconnect=false`, `contentMutation=false`, `approvalMutation=false`, `attemptMutation=false`, `llmCall=false`, `externalSend=false`여야 한다.
- Content Detail UI는 Guarded Blogger Publish Execution Design 블록을 표시하고 design-only 상태, redacted request plan, required-before-implementation/execution, failure policy, blockers, warnings, side-effect summary를 보여야 한다.
- UI는 publish/scheduled publish 실행 버튼을 활성화하거나 추가하면 안 된다.
- 9E-9A 구현/스모크 중에는 Blogger publish/write, Blogger read API, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, DB/content/approval/attempt mutation, external send, LLM 호출이 발생하지 않아야 한다.

## Patch 9E-9B Guarded Blogger publish execution route 검증

- `POST /api/content-items/[id]/guarded-publish-execution` route가 있어야 한다.
- 기본 mode는 `dry_run`이어야 한다.
- dry-run은 approval id, execution attempt id, draft markdown/html hash, draft HTML length, target Blogger blog id/url, Blogger post id를 검증해야 한다.
- dry-run은 Blogger API를 호출하지 않고 DB write를 수행하지 않아야 한다.
- dry-run은 `implementationStatus=implemented_live_guarded`, `liveExecutionAttempted=false`, `liveExecutionBlocked=true`, `dryRunOnly=true`, `canExecutePublish=false`를 반환해야 한다.
- dry-run side effects는 `dbRead=true`, `dbWrite=false`, `bloggerWrite=false`, `bloggerPublish=false`, `bloggerUpdate=false`, `bloggerDraftSave=false`, `tokenRefresh=false`, `oauthReconnect=false`, `contentMutation=false`, `approvalMutation=false`, `attemptMutation=false`, `llmCall=false`여야 한다.
- OAuth token이 expired이면 dry-run은 `access_token_expired_reauth_required`, `oauth_gate_not_satisfied`, `manual_reconnect_completion_not_ready`, `final_publish_execution_preflight_not_ready` 같은 blocker를 안전하게 반환할 수 있다. 이는 구현 중단 사유가 아니다.
- 기본 dry-run blocker에는 `guarded_blogger_publish_route_implemented_but_live_disabled`, `live_blogger_publish_feature_flag_disabled`, `rollback_plan_not_acknowledged`, `external_write_risk_not_acknowledged`, `final_human_approval_required`가 포함될 수 있다.
- `content_mutation_deferred_to_post_publish_patch`는 live publish hard blocker가 아니며 `warnings` 또는 `postPublishDeferredActions`에 표시되어야 한다.
- live mode는 `BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=true`, exact confirmation phrase `I_UNDERSTAND_THIS_WILL_PUBLISH_TO_BLOGGER`, rollback/external/final-human acknowledgements, OAuth valid state, final preflight ready state, and matching expected metadata가 모두 필요하다.
- feature flag 없이 live mode negative smoke를 실행하면 `featureFlagEnabled=false`, `confirmationPhraseAccepted=true`, `liveExecutionAttempted=false`, `liveExecutionBlocked=true`, `canExecutePublish=false`, `bloggerWrite=false`, `bloggerPublish=false`, `dbWrite=false`여야 한다.
- `src/lib/blogger/publish-post.ts`는 live guard가 통과한 뒤에만 Blogger `posts.publish`를 호출할 수 있으며, safe redacted metadata만 반환해야 한다.
- UI는 Guarded Publish Execution dry-run block을 표시해야 하며 live publish 실행 버튼을 제공하면 안 된다.
- 9E-9B 구현/스모크 중에는 live Blogger publish/write, Blogger read API, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, DB/content/approval/attempt mutation, external service write, LLM 호출이 발생하지 않아야 한다.
- DB guard는 unchanged여야 한다: content item status `planned`, `publishedAt=null`, `scheduledAt=null`, draft hashes unchanged, `blogger_draft_saves=1`, `blogger_draft_approvals=1`, `blogger_publish_approvals=1`, `blogger_publish_execution_attempts=1`, `llm_call_logs=22`.
- 다음 단계는 사용자 명시 승인 후 `9E-9B-LIVE` 또는 `9E-9C publish result readback`이다.
- 9F 운영 자동화 로드맵 후보는 계속 유지한다: Blog Operation Profile, 기본 정책, 예외 중심 대시보드 기반 자동 운영 구조.

## Patch 9E-9B-LIVE-READY deferred content mutation taxonomy 검증

- `POST /api/content-items/[id]/guarded-publish-execution` dry-run 응답의 `blockingReasons`에는 `content_mutation_deferred_to_post_publish_patch`가 포함되지 않아야 한다.
- 같은 응답의 `warnings` 또는 `postPublishDeferredActions`에는 `content_mutation_deferred_to_post_publish_patch` 또는 `content_items_status_mutation` deferred action이 포함되어야 한다.
- feature flag 없이 live mode negative smoke를 실행하면 `live_blogger_publish_feature_flag_disabled` 때문에 `liveExecutionAttempted=false`, `liveExecutionBlocked=true`, `bloggerWrite=false`, `bloggerPublish=false`, `dbWrite=false`여야 한다.
- 9E-9B-LIVE-READY 구현/스모크 중에는 live Blogger publish/write, `posts.update`, draft save, OAuth reconnect, token refresh, approval/attempt/content mutation, external service write, LLM 호출이 발생하지 않아야 한다.
- DB guard는 unchanged여야 한다: content item status `planned`, `publishedAt=null`, `scheduledAt=null`, draft hashes unchanged, `blogger_draft_saves=1`, `blogger_draft_approvals=1`, `blogger_publish_approvals=1`, `blogger_publish_execution_attempts=1`, `llm_call_logs=22`.

## Patch 9E-9C publish result readback/reconciliation preview 검증

- `POST /api/content-items/[id]/publish-result-readback` route가 있어야 한다.
- Route는 DB read와 Blogger read-only `posts.get`만 허용하며 DB write, Blogger publish/write, `posts.update`, draft save, OAuth reconnect, token refresh, content mutation, approval mutation, attempt mutation, LLM 호출을 수행하지 않아야 한다.
- 정상 readback에서는 `readbackAttempted=true`, `readbackOk=true`, `readbackBlocked=false`, `bloggerReadbackRedacted.status=200`, `bloggerPostId=6376467965797870330`이 기대된다.
- 응답은 Blogger raw response body, post content/body/HTML, access token, refresh token, client secret, encryptedValue를 반환하지 않아야 한다.
- `matches`는 approval/attempt/draft save/current target blog/post id 및 expected URL/time 비교 결과를 safe boolean/null metadata로 표시해야 한다.
- external Blogger state가 published로 보이고 internal DB가 아직 `planned`이면 `reconciliationPreview.reconciliationNeeded=true`, `recommendedNextPatch=9E-9D`, `contentMutationRequired=true`, `attemptMutationRequired=true`가 기대된다.
- OAuth token이 만료되어 readback이 차단되면 `blogger_readback_unauthorized_reauth_required` 또는 OAuth blocker를 표시하고, `/settings/blogger` manual reconnect 후 smoke를 재실행해야 한다.
- 9E-9C 구현/스모크 후 DB guard는 unchanged여야 한다: content item status `planned`, `publishedAt=null`, `scheduledAt=null`, draft hashes unchanged, attempt status `planned_only`, `bloggerResponseRedactedJson=null`, counts `1/1/1/1/22`.
- 다음 단계는 9E-9D post-publish DB reconciliation/mutation이며, 그 전까지 내부 content/attempt 상태를 자동 변경하지 않는다.

## Patch 9E-9C-R1 Blogger OAuth token refresh 검증

- `POST /api/settings/blogger/[id]/refresh-token` route가 있어야 한다.
- Route는 Google OAuth token endpoint refresh grant만 호출할 수 있으며 Blogger read/write, Blogger publish, `posts.update`, draft save, content mutation, approval mutation, attempt mutation, LLM 호출을 수행하지 않아야 한다.
- 성공 시 access token은 `blogger_connection_secrets.secretKind=access_token`으로 암호화 갱신되고 `expiresAt`, `tokenType`, scopes, last4 safe metadata만 갱신되어야 한다.
- Google이 새 refresh token을 반환하지 않으면 기존 refresh token을 유지해야 한다.
- 실패 시 raw Google response body, access token, refresh token, client secret, encryptedValue를 응답/UI/log에 노출하지 않아야 한다.
- invalid grant는 `token_refresh_invalid_grant_reconnect_required`, client config 실패는 `token_refresh_unauthorized_client` 또는 safe equivalent blocker로 표시해야 한다.
- `/settings/blogger`는 Access Token Refresh 버튼과 safe summary, blockers/warnings, side-effect summary를 표시해야 한다.
- `publish-oauth-gate`는 `tokenRefreshImplemented=true`를 표시하되 R1에서는 자동 refresh를 실행하지 않아야 한다.
- R1 smoke 후 content/publish 관련 DB guard는 unchanged여야 한다: content item status `planned`, `publishedAt=null`, `scheduledAt=null`, draft hashes unchanged, attempt status `planned_only`, `bloggerResponseRedactedJson=null`, counts `1/1/1/1/22`.
- 다음 단계는 9E-9C-R2 readback auto-refresh integration 또는 9E-9D post-publish DB reconciliation/mutation이다.
