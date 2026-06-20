# 03_DATA_MODEL

## 핵심 테이블

- blogs
- brand_profiles
- content_items
- quality_checks
- publish_jobs
- prompt_templates
- llm_providers
- llm_models
- llm_task_routes
- llm_call_logs

## Patch 9F-1E Operation Profile Policy Simulation

Patch 9F-1E does not add a table or migration.

The existing `blog_operation_profiles` row is read to build an advisory-only `operationProfilePolicySimulationSummary` for:

- `POST /api/blog-operation-profiles/default-policy`
- `POST /api/content-items/[id]/publish-oauth-gate`

The simulation compares the current gate state with the stored `safe_manual_publish` policy and reports dry-run-only fields:

- `simulationVersion = 9F-1E`
- `simulationMode = policy_enforcement_dry_run`
- `advisoryOnly = true`
- `policyEnforced = false`
- `actualBlockerImpact = false`
- `actualExecutionPermissionImpact = false`
- simulated additional/removed blockers
- simulated decision/comparison metadata
- side-effect flags with `dbWrite=false`, Blogger write/publish false, token refresh false, OAuth reconnect false, content/approval/attempt mutation false, and LLM false

These simulation blockers are not copied into top-level publish `blockingReasons` and do not change `canExecutePublish`, `canPublish`, or scheduled publish permissions.

## Patch 9F-1F Operation Profile Scenario Matrix

Patch 9F-1F does not add a table or migration.

The existing `blog_operation_profiles` row is read to build an advisory-only `operationProfileScenarioMatrixSummary` for:

- `POST /api/blog-operation-profiles/default-policy`
- `POST /api/content-items/[id]/publish-oauth-gate`

The matrix expands the 9F-1E policy simulation into operator-facing scenarios:

- `current_published_item` for the actual current publish gate context when available
- `future_planned_ready_item`
- `future_planned_token_expired`
- `profile_missing`
- `profile_mismatch`
- `scheduled_publish_requested`

The matrix reports `matrixVersion=9F-1F`, `matrixMode=policy_simulation_scenario_matrix`, `advisoryOnly=true`, `policyEnforced=false`, `actualBlockerImpact=false`, and `actualExecutionPermissionImpact=false`.

Each scenario may contain simulation-only `operation_profile_policy_*` blockers, warnings, decisions, and an operator takeaway. These codes remain inside `operationProfileScenarioMatrixSummary` only and are not copied into top-level publish `blockingReasons`, final preflight blockers, guarded execution blockers, `canExecutePublish`, `canPublish`, or scheduled publish permissions.

## Patch 9F-2A Daily Auto Content Plan Draft Foundation

Patch 9F-2A adds schema only for daily content planning. It does not create business rows during validation.

New tables:

- `blog_daily_content_plans`
- `blog_daily_content_plan_items`

`blog_daily_content_plans` stores one draft planning record per Blogger blog and local date. Key policy fields default to the safe manual mode:

- `planKind = daily_auto_content_plan`
- `operationMode = approval_required`
- `defaultPublishPolicyPreset = safe_manual_publish`
- `contentGenerationEnabled = false`
- `llmCallEnabled = false`
- `publishExecutionEnabled = false`
- `scheduledPublishEnabled = false`

`blog_daily_content_plan_items` stores deterministic planning metadata slots. Items are not content drafts and do not create `content_items` rows in Patch 9F-2A. Item guards default to:

- `draftGenerationAllowed = false`
- `llmGenerationAllowed = false`
- `publishExecutionAllowed = false`
- `scheduledPublishAllowed = false`
- `requiresHumanApproval = true`

The preview API is `POST /api/daily-content-plans/default-plan`. Preview mode performs DB reads only and returns `DailyContentPlanSummary`. Apply mode is implemented behind `BLOG_DAILY_CONTENT_PLAN_WRITE_ENABLED=true` and exact confirmation phrase, but 9F-2A validation only performs feature-flag-disabled apply-negative smoke with `dbWrite=false`.

## Patch 9F-2B Daily Content Plan Row Baseline

Patch 9F-2B created or idempotently confirmed one daily planning fixture for the verified Blogger blog after explicit operator approval. It did not create content drafts, call LLM providers, call Blogger write/publish APIs, reconnect OAuth, refresh tokens, or mutate publish approvals/attempts.

Current daily plan baseline:

- `blog_daily_content_plans_count = 1`
- `blog_daily_content_plan_items_count = 3`
- `planId = cmqlr1v1d0000iwj2smxcsajr`
- `targetBloggerBlogId = 3065973490356135805`
- `targetBloggerBlogName = 급등포착`
- `targetBloggerBlogUrl = https://mathlearningappl.blogspot.com/`
- `operationProfileId = cmqkofe5d0000iwike1bd3c24`
- `planDateLocal = 2026-06-20`
- `timezone = Asia/Seoul`
- `planName = Daily Content Plan`
- `status = draft`
- `planKind = daily_auto_content_plan`
- `operationMode = approval_required`
- `defaultPublishPolicyPreset = safe_manual_publish`
- `contentGenerationEnabled = false`
- `llmCallEnabled = false`
- `publishExecutionEnabled = false`
- `scheduledPublishEnabled = false`
- `plannedItemCount = 3`

The three item rows are deterministic candidate slots:

- `morning_education`: beginner education topic seed, `contentItemId = null`
- `midday_checklist`: checklist education topic seed, `contentItemId = null`
- `evening_risk_review`: risk management education topic seed, `contentItemId = null`

All 9F-2B item rows keep generation and publishing disabled:

- `draftGenerationAllowed = false`
- `llmGenerationAllowed = false`
- `publishExecutionAllowed = false`
- `scheduledPublishAllowed = false`
- `requiresHumanApproval = true`

## Patch 9F-2D Daily Plan To Content Item Fixture Apply

Patch 9F-2D added a guarded bridge from one daily plan item to one deterministic `content_items` fixture. The approved apply was executed exactly once after the operator provided the required Korean approval phrase.

Target item:

- `planId = cmqlr1v1d0000iwj2smxcsajr`
- `planItemId = cmqlr1v1y0001iwj2gpv2875r`
- `itemOrder = 1`
- `slotKey = morning_education`
- `contentIntent = beginner_education`

The applied fixture is deterministic and non-publishable:

- content item id: `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`
- `mode = memo_expand`
- `status = planned`
- `title` and `targetKeyword` come from the plan item `topicSeed`
- `sourceMemo = 9F-2D fixture only. No LLM generation has been executed.`
- `draftMarkdown = null`
- `draftHtml = null`
- `qualityScore = null`
- `publishedAt = null`
- `scheduledAt = null`

Post-apply baseline:

- `content_items_count = 2`
- `blog_daily_content_plans_count = 1`
- `blog_daily_content_plan_items_count = 3`
- target item `contentItemId = daily_fixture_cmqlr1v1y0001iwj2gpv2875r`
- other daily plan items remain unlinked

The guarded apply updated only the target daily plan item `contentItemId` and inserted exactly one deterministic fixture row. It did not modify the daily plan row, other daily plan items, the published 9E content item, Blogger tables, publish approvals, publish attempts, operation profiles, or LLM call logs.

## Patch 9F-2G / 9F-2I Operator Approval Persistence

Patch 9F-2G did not add a table, migration, Prisma model, or business row.

The proposed future design is documented in `documents/15_OPERATOR_APPROVAL_PERSISTENCE_DESIGN.md`.

Patch 9F-2I adds the Prisma schema scaffold and one unapplied migration draft for:

- `blog_daily_content_operator_approvals`
- `blog_daily_content_operator_approval_events`

The current-state approval table holds the latest durable operator decision per plan item, linked content item, and approval purpose. The event table holds an append-only audit trail of approval state transitions.

9F-2I migration state:

- Prisma models exist in `prisma/schema.prisma`.
- Migration draft exists at `prisma/migrations/20260620000200_add_daily_content_operator_approval_scaffold/migration.sql`.
- The migration was applied once by 9F-2I-APPLY.
- The operator approval tables exist in the current DB.
- No approval row or approval event was created.
- Operator approval apply must be a separate explicitly approved patch.

The proposal keeps approval persistence separate from:

- draft generation
- LLM calls
- `content_items.draftMarkdown` / `content_items.draftHtml` mutation
- Blogger draft save
- Blogger publish
- scheduled publish
- OAuth reconnect
- token refresh

Future approval writes should be gated by `BLOG_DAILY_CONTENT_OPERATOR_APPROVAL_WRITE_ENABLED=true` and exact confirmation phrase `I_UNDERSTAND_THIS_WILL_PERSIST_OPERATOR_APPROVAL_ONLY`.

## Patch 9F-2K Operator Approval Persistence Route

Patch 9F-2K adds a guarded preview/apply route for the existing operator approval tables:

- `POST /api/daily-content-plans/operator-approvals`
- helper `src/lib/daily-content-plans/operator-approval-persistence.ts`

Current implementation state after approved 9F-2K apply:

- Preview mode reads the target daily plan, plan item, linked content fixture, and any existing operator approval/event.
- Apply mode is implemented but blocked unless `BLOG_DAILY_CONTENT_OPERATOR_APPROVAL_WRITE_ENABLED=true`, the exact confirmation phrase, and the expected idempotency key are present.
- The Settings UI can read back approval state and keeps direct approval apply controls disabled.
- The Korean approval phrase was provided after the pending implementation patch.
- 9F-2K approved apply was executed exactly once through the guarded route.
- `operator_approvals_count = 1`
- `operator_approval_events_count = 1`
- persisted approval id `cmqmcs1l10001iwu863doda1s`
- persisted event id `cmqmcs1lg0003iwu8ff4780ll`
- target approval has `approvalPurpose=draft_generation_execution`, `approvalStatus=approved`, `operatorAction=approve_for_draft_generation_execution`, and `operatorLabel=초안 생성 실행 승인`

9F-2K does not modify `prisma/schema.prisma`, create migrations, generate drafts, call LLM providers, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.

## Patch 9F-2L Post-approval Execution Gate Readback

Patch 9F-2L is a read-only UI/API polish patch for the already persisted operator approval.

Current implementation state after 9F-2L:

- No Prisma schema or migration changes.
- No new approval row or approval event was created.
- Existing operator approvals/events remain `1 / 1`.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The linked fixture `daily_fixture_cmqlr1v1y0001iwj2gpv2875r` remains `planned` with empty `draftMarkdown` and `draftHtml`.
- The execution gate preview explicitly separates persisted approval state from execution blockers.
- `operatorApprovalSatisfied=true` and `operator_approval_missing` is treated as a resolved blocker.
- `executionAllowed=false` remains because LLM execution, content mutation, draft generation write, confirmation phrase, and idempotency gates remain blocked.

9F-2L does not generate content, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.

## Patch 2 구현 테이블

Patch 2는 PostgreSQL + Prisma 기준으로 다음 테이블을 우선 구현한다.

- blogs
- brand_profiles
- content_items
- llm_providers
- llm_models
- llm_task_routes
- llm_call_logs

`quality_checks`, `publish_jobs`, `prompt_templates`는 후속 패치에서 구현한다.

## blogs 핵심 필드

```text
id
name
url
bloggerBlogId
mainTopic
subTopics
targetReader
tone
locale
forbiddenPhrases
preferredPhrases
defaultContentLength
defaultCtaStrength
dailyPublishLimit
nightExcludeStart
nightExcludeEnd
autoPublishEnabled
manualApprovalRequired
status
createdAt
updatedAt
```

## brand_profiles 핵심 필드

```text
id
name
serviceName
shortDescription
longDescription
targetUsers
coreFeatures
problemsSolved
mainUrl
ctaWeak
ctaNormal
ctaStrong
forbiddenPhrases
preferredPhrases
riskDisclaimer
isDefault
createdAt
updatedAt
```

## content_items mode

```text
seo_keyword
service_promotion
memo_expand
existing_draft_improve
```

`existing_draft_improve`는 사용자가 직접 입력한 초안, 메모, 기존 글을 보강하는 용도다.
경쟁글 문장을 복사하거나 재작성하는 용도로 사용하지 않는다.

## content_items 상태

```text
idea
planned
drafted
quality_review
approved
scheduled
published
failed
rewrite_needed
```

## LLM 보안 원칙

- llm_providers에는 API Key 원문을 저장하지 않는다.
- Patch 7A부터 API Key는 `llm_provider_secrets.encryptedValue`에 암호화 저장한다.
- 필요한 경우 `secretRef`, `apiKeyLast4`, `hasSecret` 같은 안전한 메타 필드만 화면에 표시한다.
- llm_call_logs에는 secret, prompt 전문, 원문 본문 전체를 저장하지 않는다.
- llm_call_logs.metadata는 제한된 진단 정보 저장용으로만 사용한다.

## Patch 4 프로필 관리 화면

Patch 4는 기존 `blogs`, `brand_profiles` CRUD API를 `/blogs`, `/brands` 화면에 연결한다.

- `/blogs`는 블로그별 주제, 문체, 금지/권장 표현, 발행 정책값을 관리한다.
- `/brands`는 서비스/브랜드 설명, CTA, 금지/권장 표현, 리스크 고지를 관리한다.
- 배열 필드는 textarea에서 쉼표 또는 줄바꿈 기준으로 입력받아 `String[]`로 저장한다.
- `autoPublishEnabled`는 정책 설정값이며 실제 자동 발행 기능은 후속 패치에서 연결한다.
- `isDefault`는 Patch 4에서 단일 기본값 강제를 구현하지 않는다.
- Google OAuth, Blogger API, 실제 발행 기능은 Patch 4 범위가 아니다.

## Patch 5 글 생성 요청 저장

Patch 5는 기존 `content_items` CRUD API를 `/content/new` 화면에 연결한다.

- `/content/new`는 블로그, 서비스/브랜드 프로필, mode, title, targetKeyword, sourceMemo, status를 입력받는다.
- 기본 status는 `idea`다.
- Patch 5는 글 생성 요청 저장까지만 구현한다.
- LLM 호출, 글 기획서 생성, 본문 생성, HTML 변환, 품질검사, Blogger 발행은 후속 패치 범위다.
- `existing_draft_improve`는 사용자가 직접 입력한 기존 글/초안 보강용이며 경쟁글 복사, 재작성, 재가공 용도가 아니다.

## Patch 6A 첨부 미디어 자산

Patch 6A는 `content_items`와 1:N 관계를 갖는 `content_assets` 모델을 추가한다.

- 파일 본문은 DB가 아니라 `local-data/uploads/content-assets/{contentItemId}/`에 저장한다.
- DB에는 파일 메타데이터와 글 배치용 정보만 저장한다.
- 지원 asset type은 `image`, `video`다.
- 지원 placement는 `hero`, `intro`, `middle`, `outro`, `gallery`, `embed`다.
- 관리 메타데이터는 caption, altText, userNote, placementHint, sortOrder, isPrimary다.
- `storagePath`는 public URL로 직접 노출하지 않고 파일 제공 API를 통해서만 사용한다.
- `isPrimary` 단일 강제는 Patch 6A에서 구현하지 않는다.
- 외부 스토리지, Blogger 업로드, 글 생성, 품질검사는 Patch 6A 범위가 아니다.

## Patch 6B 첨부 미디어 메타데이터 추천

Patch 6B는 `content_assets`의 caption, altText, userNote, placementHint, sortOrder를 룰 기반으로 추천한다.

- 추천 API는 asset, content item, blog, brand profile 메타데이터만 사용한다.
- 이미지/영상 파일 본문은 읽거나 분석하지 않는다.
- OpenAI API, Local LLM, 비전 분석, 영상 분석은 사용하지 않는다.
- 추천 결과는 DB에 바로 저장하지 않고 응답으로만 반환한다.
- 사용자가 `/content/new`에서 추천값을 확인한 뒤 메타데이터 수정 버튼을 눌러 저장한다.
- altText는 짧고 구체적으로 작성하며 targetKeyword를 반복 삽입하지 않는다.
- caption은 본문에 보이는 자연스러운 설명문으로 추천한다.
- userNote는 내부 작성 보조용 메모로 추천한다.
- `recommendedIsPrimary`는 추천값이며 대표 미디어 단일 강제는 후속 패치에서 처리한다.

## Patch 6C 콘텐츠 상세와 수동 기획서

Patch 6C는 `/content/[id]` 상세 화면에서 `content_items`의 기본 정보, 연결된 blog/brand profile, 첨부 미디어, `planJson`, `draftMarkdown`, `draftHtml`, `qualityScore`를 확인한다.

- 새 DB 모델이나 migration은 추가하지 않는다.
- `GET /api/content-items/[id]`, `PATCH /api/content-items/[id]`, `GET /api/content-items/[id]/assets`를 재사용한다.
- `planJson`은 JSON textarea로 수동 입력, 수정, 저장한다.
- 저장 전 `JSON.parse`로 object 여부를 검증한다.
- 빈 `planJson`에는 기본 기획 템플릿을 표시한다.
- `planned` 전환은 유효한 JSON이며 최소 하나 이상의 기획 항목이 있을 때만 허용한다.
- `draftHtml`은 실제 HTML로 렌더링하지 않고 문자열로만 표시한다.
- 첨부 미디어 상세에는 `storagePath`를 표시하지 않는다.
- 기획서 자동 생성, 본문 생성, HTML 변환, 품질검사, Blogger 발행은 후속 패치 범위다.

## Patch 7A LLM Provider 연결 테스트 기반

Patch 7A는 `/settings/llm`의 Provider 설정을 확장해 external HTTP, local HTTP, CLI 기반 Provider를 등록하고 연결 테스트 결과를 기록할 수 있게 한다.

- 기존 `LlmProviderType`의 `openai`, `local` 값은 유지하고 `external_http`, `local_http`, `cli`를 추가한다.
- 실제 호출 방식 판단은 `invocationMode`를 우선 사용한다.
- `LlmInvocationMode`는 `external_http`, `local_http`, `cli`를 지원한다.
- `LlmApiFormat`은 `openai_compatible`, `ollama_compatible`, `custom_http`, `custom_cli`를 지원한다.
- `LlmProviderTestStatus`는 `untested`, `success`, `failed`를 지원한다.
- `LlmTaskType`에는 연결 테스트 로그용 `provider_test`를 추가한다.
- `llm_providers`에는 endpoint, 기본 모델, JSON header/template, CLI executable/args, 최신 테스트 결과 필드를 추가한다.
- `llm_provider_secrets`는 Provider별 encrypted API Key와 `apiKeyLast4`를 저장한다.
- `llm_call_logs`는 provider connection test 로그에도 재사용한다.
- OpenAI-compatible과 Ollama-compatible 연결 테스트를 우선 지원한다.
- custom HTTP/CLI 테스트 실행은 Patch 7A에서 제한하거나 비활성 안내를 반환한다.
- 연결 테스트는 content planning, draft generation, quality check와 아직 연결하지 않는다.

## 2026-06-14 세션 종료 기준 콘텐츠 생성 상태

`content_items`는 현재 다음 생성 단계를 실제로 사용한다.

- `planJson`: `content_plan` Task Route로 생성한 후보를 사용자가 확인 후 저장한다.
- `draftMarkdown`: `content_draft` Task Route로 생성한 후보를 사용자가 확인 후 저장한다.
- `draftHtml`: 아직 생성하지 않는다.
- `qualityScore`: 아직 품질검사 전이다.

최종 수동 확인된 테스트 content item:

```text
id = cmqc2xqbr00011y70sxmgl65v
has_plan = true
has_draft = true
has_html = false
```

최종 수동 확인된 최신 `content_draft` call log 요약:

```text
validationOk = true
repairAttempted = false
markdownLength = 1665
mediaPlaceholderCount = 1
```

`llm_call_logs.metadata`에는 prompt 전문, raw response 전문, request body 전문, 후보 Markdown 전문, API Key, Bearer token, secretRef, encryptedValue, provider headers, media storagePath를 저장하지 않는다. grep 검사에서 `draftMarkdown` 문자열이 잡히는 경우 과거 안전한 errorMessage인 `Generated draftMarkdown did not pass validation.`일 수 있으므로 metadata 원문 저장 여부와 구분해서 확인한다.

## Patch 8C HTML preview data policy

Patch 8C는 새 DB 모델이나 migration을 추가하지 않는다.

- `content_items.draftMarkdown`은 read-only 입력으로만 사용한다.
- `content_items.draftHtml`은 변경하지 않는다.
- attached `content_assets`는 placeholder mapping과 preview media URL 생성에만 사용한다.
- `storagePath`는 API 응답, 화면, previewHtml에 포함하지 않는다.
- `llm_call_logs`는 생성하지 않는다.

## Patch 8D draftHtml manual apply policy

Patch 8D도 새 DB 모델이나 migration을 추가하지 않는다.

- `POST /api/content-items/[id]/validate-html`은 `candidateHtml`을 검증하지만 DB를 변경하지 않는다.
- `POST /api/content-items/[id]/apply-html`만 `content_items.draftHtml`을 업데이트한다.
- `apply-html`은 저장 전 서버에서 HTML validation/security/media reference 검사를 다시 수행한다.
- `draftHtml` 저장은 status, qualityScore, publishedAt, scheduledAt을 변경하지 않는다.
- 저장된 `draftHtml`은 로컬 preview/검증용 HTML이다. Blogger 업로드/발행용 최종 HTML 변환은 후속 패치 범위다.
- `storagePath`, secret, provider headers, request template은 `draftHtml`에 포함하지 않는다.

## Patch 8E quality preview data policy

Patch 8E도 새 DB 모델이나 migration을 추가하지 않는다.

- `POST /api/content-items/[id]/quality-preview`는 저장된 `content_items.draftHtml`을 read-only 입력으로 사용한다.
- 품질검사 결과의 `scorePreview`와 `grade`는 응답과 화면에만 표시한다.
- `content_items.qualityScore`, status, draftHtml, publishedAt, scheduledAt은 변경하지 않는다.
- `quality_checks` 테이블은 아직 구현하지 않는다.
- 원본 content item 객체와 원본 assets 객체를 API 응답에 그대로 반환하지 않는다.
- `storagePath`, local upload path, secret, provider headers, request template은 응답과 UI에 포함하지 않는다.

## Patch 8F publish readiness data policy

Patch 8F도 새 DB 모델이나 migration을 추가하지 않는다.

- `POST /api/content-items/[id]/publish-readiness`는 saved planJson, draftMarkdown, draftHtml, quality preview 결과를 read-only로 평가한다.
- `contentReady`, `publishReady`, stage, blocking issues, warnings는 응답과 화면에만 표시한다.
- `publishReady`는 Blogger 연결과 사용자 최종 승인 저장이 없으므로 Patch 8F에서 항상 false다.
- status, qualityScore, draftHtml, publishedAt, scheduledAt은 변경하지 않는다.
- `publish_jobs` 테이블은 아직 구현하지 않는다.
- Blogger OAuth token, Blogger blog list, publish job은 생성하지 않는다.

## Patch 9A Blogger connection placeholder

Patch 9A는 `blogger_connections`를 추가한다.

```text
id
blogId
name
status
bloggerBlogId
bloggerBlogName
connectedEmail
scopes
clientSecretRef
hasClientSecret
hasAccessToken
hasRefreshToken
tokenLast4
lastTestedAt
lastError
createdAt
updatedAt
```

`BloggerConnectionStatus`:

```text
not_configured
configured
oauth_required
connected
expired
error
```

정책:

- access token, refresh token, client secret 원문 저장 필드는 만들지 않는다.
- `clientSecretRef`, `hasClientSecret`, `hasAccessToken`, `hasRefreshToken`, `tokenLast4`는 placeholder 메타데이터다.
- 실제 encrypted token/secret 저장 기반은 Patch 9C-1에서 별도 모델로 추가한다.
- `Blog.bloggerBlogId`는 기존 호환 필드로 유지한다.
- 새 연결 흐름에서 Blogger blog ID의 source of truth는 `BloggerConnection.bloggerBlogId`다.
- Blogger OAuth callback, token 발급, Blogger API 호출, Blogger blog list 조회, publish job 생성은 Patch 9A 범위가 아니다.

## Patch 9B Blogger OAuth state

Patch 9B는 `blogger_oauth_states`를 추가한다.

```text
id
connectionId
stateHash
redirectUri
scopes
expiresAt
consumedAt
createdAt
```

정책:

- OAuth state 원문은 저장하지 않고 SHA-256 hash만 저장한다.
- authorization code 원문은 저장하지 않는다.
- access token, refresh token, client secret 원문 저장 테이블은 아직 만들지 않는다.
- `BloggerConnection.oauthClientIdRef`는 authorization URL dry-run의 `client_id` 입력값으로 사용한다.
- OAuth state는 만료 시간과 consumedAt으로 재사용을 막는다.
- token exchange, Blogger API 호출, Blogger blog list 조회, draft save, publish job 생성은 Patch 9B 범위가 아니다.

## Patch 9C-1 Blogger token storage foundation

Patch 9C-1은 OAuth token exchange 전에 필요한 encrypted token storage 기반만 추가한다.

`blogger_connection_secrets`:

```text
id
connectionId
secretKind
encryptedValue
keyVersion
last4
tokenType
scopes
expiresAt
createdAt
updatedAt
```

`BloggerSecretKind`:

```text
oauth_client_secret
access_token
refresh_token
```

정책:

- access token, refresh token, client secret 원문 컬럼은 만들지 않는다.
- `encryptedValue`는 DB 내부 저장값이며 API/UI 응답에 반환하지 않는다.
- `last4`, `hasAccessToken`, `hasRefreshToken`, `hasClientSecret`, `expiresAt`, `scopes` 같은 safe metadata만 운영 화면에서 확인한다.
- 암호화 key는 `BLOGGER_SECRET_ENCRYPTION_KEY`를 사용하도록 설계한다.
- Patch 9C-1은 token exchange, token refresh, Blogger API 호출, blog list 조회, draft save, publish를 구현하지 않는다.
- token storage model이 생겨도 publish readiness의 `publishReady`는 false를 유지한다.

## Patch 9C-2 OAuth callback token exchange

Patch 9C-2는 새 DB 모델을 추가하지 않고 Patch 9C-1의 `blogger_connection_secrets`를 사용한다.

저장 정책:

- access token은 `secretKind = access_token`으로 암호화 저장한다.
- refresh token은 새 값이 내려온 경우 `secretKind = refresh_token`으로 암호화 저장한다.
- refresh token이 내려오지 않고 기존 refresh token이 있으면 기존 값을 유지한다.
- refresh token이 내려오지 않고 기존 refresh token도 없으면 `BloggerConnection.status = oauth_required`로 둔다.
- `expiresAt`은 access token의 `expires_in`을 기준으로 계산한다.
- `tokenType`, `scopes`, `last4`는 safe metadata로 저장한다.
- `BloggerConnection.hasAccessToken`, `hasRefreshToken`, `tokenLast4`, `status`, `lastError`, `lastTestedAt`, `scopes`를 token exchange 결과에 맞춰 갱신한다.

미저장/미노출:

- authorization code 원문은 저장하지 않는다.
- access token, refresh token, client secret 원문 컬럼은 없다.
- Google raw token response body는 저장하지 않는다.
- `encryptedValue`는 API/UI 응답에 반환하지 않는다.
- Blogger blog list, draft save, publish job 생성은 Patch 9C-2 범위가 아니다.

## Patch 9D-1 Blogger blog list read-only data policy

Patch 9D-1은 새 DB 모델을 추가하지 않는다.

- read-only blog list 조회는 `BloggerConnectionSecret.secretKind = access_token`만 읽는다.
- `encryptedValue`는 서버 내부 helper에서만 조회하고 API/UI 응답에는 반환하지 않는다.
- access token 원문은 복호화 후 Blogger API Authorization header에만 사용한다.
- access token 만료 여부는 `BloggerConnectionSecret.expiresAt` metadata로 확인한다.
- Blogger blog list 결과는 DB에 저장하지 않는다.
- Blogger blog 선택 반영은 후속 Patch 9D-2 범위다.
- content item status, qualityScore, publishedAt, scheduledAt은 변경하지 않는다.
- publish readiness는 `publishReady=false`를 유지한다.

## Patch 9D-2 Blogger blog selection data policy

Patch 9D-2는 새 테이블을 추가하지 않고 `blogger_connections`에 검증된 선택 metadata만 추가한다.

- `bloggerBlogUrl`은 선택된 Blogger blog의 safe URL이다.
- `bloggerBlogVerifiedAt`은 서버가 현재 connected token으로 Blogger blog list를 다시 조회한 뒤 해당 blog ID가 접근 가능할 때만 저장한다.
- generic PATCH로 들어온 `bloggerBlogId`/`bloggerBlogName`은 검증된 선택으로 간주하지 않으며 verified metadata를 초기화한다.
- 선택 저장 API는 request body의 blog ID를 그대로 신뢰하지 않고 read-only blog list helper로 재검증한다.
- raw Blogger response, token, client secret, encrypted value는 저장하지 않는다.
- content item status, qualityScore, publishedAt, scheduledAt은 변경하지 않는다.
- publish readiness는 선택된 Blogger blog check를 추가하지만 `publishReady=false`를 유지한다.

## Patch 9E-0 Blogger draft payload preview data policy

Patch 9E-0은 새 테이블이나 컬럼을 추가하지 않는다.

- `POST /api/content-items/[id]/blogger-draft-preview`는 DB를 변경하지 않는다.
- preview target blog는 `bloggerBlogId`, `bloggerBlogName`, `bloggerBlogUrl`, `bloggerBlogVerifiedAt` safe metadata만 사용한다.
- `bloggerBlogId`만 있고 `bloggerBlogVerifiedAt`이 없으면 verified selection으로 보지 않는다.
- saved `draftHtml`만 payload 후보 source로 사용하며, API/UI에는 짧은 `htmlSnippet`과 summary 중심으로 반환한다.
- `qualityScore`, `status`, `publishedAt`, `scheduledAt`은 변경하지 않는다.
- Blogger API read/write, token refresh, draft save, publish는 수행하지 않는다.
- raw Blogger response, token, client secret, encrypted value는 저장하거나 반환하지 않는다.

## Patch 9E-1 Blogger draft approval data policy

Patch 9E-1은 `blogger_draft_approvals` 테이블을 추가한다.

- status는 `approved`, `revoked`, `superseded` 중 하나다.
- active approval은 앱 로직에서 `status=approved` 및 `revokedAt=null`로 관리한다.
- approval은 server-side draft payload preview 재계산 결과가 `draftPayloadReady=true`일 때만 생성한다.
- 저장 필드는 `snapshotHash`, `draftHtmlHash`, title candidate, target Blogger blog safe metadata, readiness summary다.
- full `draftHtml`, `htmlSnippet`, token, encrypted value, raw Blogger response/error body는 저장하지 않는다.
- content item status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경하지 않는다.
- publish readiness는 manual approval match를 표시하지만 `publishReady=false`를 유지한다.

## Patch 9E-2 Blogger draft save data policy

Patch 9E-2는 `blogger_draft_saves` 테이블과 `BloggerDraftSaveStatus` enum을 추가한다.

- status는 `success`, `failed` 중 하나다.
- 각 save record는 content item, approval, Blogger connection을 참조한다.
- 저장 필드는 approval snapshot hash, draftHtml hash, target Blogger blog safe metadata, title candidate, Blogger post id/url/timestamps, safe error code/message, retryable flag다.
- full `draftHtml`, raw Blogger response body, raw Blogger error body, access token, refresh token, encrypted value는 저장하지 않는다.
- 같은 approval snapshot에 성공 save가 이미 있으면 새 `posts.insert`를 실행하지 않는다.
- 실패 record는 approval guard를 통과한 뒤 token/API 단계에서 실패한 경우에만 저장한다.
- content item status, `qualityScore`, `publishedAt`, `scheduledAt`은 변경하지 않는다.
- publish readiness는 latest successful draft save를 metadata/check에 반영하지만 `publishReady=false`를 유지한다.

## Patch 9E-3 Blogger draft save retry/update data policy

Patch 9E-3은 schema를 변경하지 않는다.

- `blogger_draft_saves.retryable=true`는 재시도 후보 표시용 safe metadata다.
- guard failure는 `blogger_draft_saves` record를 만들지 않으므로 retry 대상이 아니다.
- same approval에 success record가 있으면 추가 save 요청은 중복 방지로 차단한다.
- 새 approval에 대한 새 draft insert는 허용 가능하지만 Blogger draft가 누적될 수 있다.
- 기존 draft update를 구현하려면 `bloggerPostId` 기반 update/retry semantics를 별도 Patch에서 설계해야 한다.
- `posts.update`, `posts.delete`, publish, scheduled publish, token refresh 관련 schema는 Patch 9E-3에서 추가하지 않는다.

## Patch 9E-4A HTML quality repair preview data policy

Patch 9E-4A는 schema를 변경하지 않는다.

- `quality-repair-preview`는 saved `draftMarkdown`과 `draftHtml`을 read-only 입력으로 사용한다.
- repair candidate, before/after quality, validation summary는 API 응답과 UI에만 표시한다.
- `content_items.draftHtml`은 자동 저장하지 않는다.
- `content_items.qualityScore`, status, `publishedAt`, `scheduledAt`은 변경하지 않는다.
- `llm_call_logs`, `quality_checks`, Blogger draft save 관련 테이블은 변경하지 않는다.
- 사용자가 기존 `apply-html`을 명시적으로 실행할 때만 `draftHtml` 저장이 가능하다.

## Patch 9E-6B Publish preflight dry-run data model

Patch 9E-6B adds a read-only publish preflight response model, not a schema change.

- No publish approval table, migration, enum, or content item column is added.
- `POST /api/content-items/[id]/publish-preflight` reads existing content item, Blogger connection safe metadata, draft approval, draft save, and token expiry metadata.
- The response keeps `canPublish=false` and `canSchedulePublish=false`.
- `sideEffectSummary` is all false: no Blogger write, no publish, no scheduled publish, no `posts.update`, no draft save, no token refresh, no LLM call, and no content item mutation.
- Current required blockers include `publish_not_implemented`, `scheduled_publish_not_implemented`, `publish_approval_not_implemented`, and `content_item_mutation_policy_not_implemented`.
- If safe access token expiry metadata is past, `access_token_expired_reauth_required` is also a blocker.
- Duplicate draft save protection may appear as warning/summary, but it is a draft-save safety state and does not grant publish permission.

Future publish approval snapshot fields should include `contentItemId`, `contentStatus`, `draftMarkdownHash`, `draftHtmlHash`, `draftHtmlLength`, `titleCandidate`, target Blogger blog safe metadata, `bloggerPostId`, `bloggerDraftSavedAt`, draft approval id/hash, approval match status, `publishMode`, `scheduledAt`, `timezone`, `requestedBy`, `approvalCreatedAt`, `rollbackAcknowledged`, `sideEffectSummaryAcknowledged`, and `tokenStateCheckedAt`.

## Patch 9E-6C Publish approval snapshot preview data model

Patch 9E-6C adds a read-only publish approval snapshot preview model, not persistence.

- No publish approval table, migration, enum, or insert/update route is added.
- `POST /api/content-items/[id]/publish-approval-preview` reads existing content item, Blogger draft save, draft approval, and safe token expiry metadata.
- The preview includes only non-secret fields.
- `approvalSnapshotHashPreview` is computed from deterministic canonical JSON and SHA-256, but it is not stored in DB and is not an approval record.
- `draftMarkdownHash` and `draftHtmlHash` are content hash previews used to show what the user would approve.
- `canCreatePublishApproval=false`, `canPublish=false`, and `canSchedulePublish=false` remain fixed.
- `sideEffectSummary` is all false, including `dbWrite=false` and `approvalPersistence=false`.

Before publish approval persistence can be implemented, decide whether to add a dedicated table or extend an existing table, how to store canonical snapshot fields and hash, how to capture rollback and side-effect acknowledgements, how to store token state checked time, how approval expiry/invalidation works when draft HTML/title/blog/post changes, how publish attempts link to approval id, how partial failures are audited, and how raw Blogger responses/tokens remain redacted.

## Patch 9E-6D Publish approval persistence policy and schema plan

Patch 9E-6D is a schema planning patch only. It adds no Prisma model, migration, enum, table, column, insert route, update route, or approval persistence write.

Recommended future model:

- Add a dedicated `blogger_publish_approvals` table rather than overloading draft approval records.
- Keep every approval immutable after creation.
- Store only non-secret snapshot metadata and a deterministic snapshot hash.
- Link publish execution attempts to a publish approval id in a separate audit model.
- Keep immediate publish approval and scheduled publish approval in the same model only if `publishMode`, `scheduledAt`, and `timezone` are part of the immutable snapshot.

Recommended future fields:

- `id`
- `contentItemId`
- `bloggerConnectionId`
- `bloggerDraftSaveId`
- `bloggerDraftApprovalId`
- `targetBloggerBlogId`
- `targetBloggerBlogName`
- `targetBloggerBlogUrl`
- `bloggerPostId`
- `draftMarkdownHash`
- `draftHtmlHash`
- `draftHtmlLength`
- `titleCandidate`
- `publishMode`
- `scheduledAt`
- `timezone`
- `snapshotJson`
- `snapshotHash`
- `hashAlgorithm`
- `canonicalization`
- `rollbackAcknowledged`
- `sideEffectSummaryAcknowledged`
- `tokenState`
- `tokenStateCheckedAt`
- `status`
- `createdBy`
- `createdAt`
- `invalidatedAt`
- `invalidatedReason`
- `supersededByApprovalId`

Recommended future statuses:

- `approved_for_publish`
- `approved_for_schedule`
- `invalidated`
- `used_for_publish_attempt`
- `used_for_schedule_attempt`
- `cancelled`

Invalidation policy:

- Invalidate or supersede approval when `draftHtml` hash, `draftMarkdown` hash, title candidate, target blog id, Blogger post id, `scheduledAt`, timezone, or content item status changes.
- Invalidate or block use when token state becomes expired before publish.
- Invalidate or supersede when a newer approval is created for the same content item and publish mode.
- A future `posts.update` flow must invalidate the old publish approval unless the update has its own approval chain and snapshot hash.

Acknowledgement policy:

- Approval creation must capture rollback acknowledgement.
- Approval creation must capture side-effect summary acknowledgement.
- The acknowledged side-effect summary for real publish must not be all false; it must clearly distinguish publish, scheduled publish, `posts.update`, token refresh, and content item mutation.
- Approval persistence alone must not execute publish or scheduled publish.

Audit policy:

- Publish execution attempts should be stored separately from approvals.
- Attempt records should link to approval id, Blogger post id, publish mode, safe status, safe error code/message, and local content mutation outcome.
- Raw Blogger response body, raw Blogger error body, access token, refresh token, client secret, encrypted value, and full `draftHtml` must not be stored.

## Patch 9E-7A Publish approval persistence storage

Patch 9E-7A adds the first publish approval persistence table and supporting enum types.

Added Prisma model:

- `BloggerPublishApproval`

Mapped table:

- `blogger_publish_approvals`

Added enums:

- `BloggerPublishApprovalMode`: `publish`, `scheduled_publish`
- `BloggerPublishApprovalStatus`: `approved_snapshot`, `invalidated`, `used_for_publish_attempt`, `used_for_schedule_attempt`, `cancelled`

Stored fields are non-secret snapshot metadata only:

- content item id
- publish approval mode/status
- target Blogger blog id/name/url
- Blogger draft post id
- related Blogger draft save id
- related Blogger draft approval id
- `draftMarkdown` hash
- `draftHtml` hash and length
- title candidate
- optional `scheduledAt` and timezone
- non-secret snapshot JSON
- snapshot hash, hash algorithm, canonicalization
- rollback acknowledgement
- side-effect summary acknowledgement
- approval persistence acknowledgement
- token state and token state checked time
- created/invalidated metadata

Policy:

- Approval persistence stores a local approval snapshot only.
- Approval persistence does not call Blogger.
- Approval persistence does not publish or schedule publish.
- Approval persistence does not mutate `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown`.
- The save route must regenerate the publish approval snapshot server-side and compare the server hash with the client preview hash.
- Active approvals are treated as `status=approved_snapshot` and `invalidatedAt=null`.
- Same `contentItemId` + mode + snapshot hash + scheduled time active approval is idempotent and can return the existing row.
- Token expired state may be persisted as snapshot metadata, but future publish execution remains blocked until OAuth reconnect or another approved token policy exists.

Still not added:

- publish execution attempt table
- publish/scheduled publish route
- `posts.update` policy table
- token refresh persistence
- local content status/timestamp mutation policy

## Patch 9E-7B Publish approval persistence smoke/readback

Patch 9E-7B uses the existing `blogger_publish_approvals` table and does not add a new migration.

Readback policy:

- `publish-approval-readback` returns safe approval summaries only.
- `snapshotJson` is not returned to UI/API clients.
- Latest and active approval summaries include id, mode, status, snapshot hash, hash metadata, target blog/post id, draft HTML hash/length, title candidate, token state, acknowledgement booleans, created time, and invalidation metadata.
- Readback side effects are `dbRead=true`, `dbWrite=false`, `approvalPersistence=false`, Blogger write false, token refresh false, content item mutation false, and LLM false.

Smoke policy:

- One local approval insert smoke is allowed for `blogger_publish_approvals`.
- The save route must still require acknowledgement guard before insert.
- A second save of the same content item, mode, snapshot hash, and scheduled time must return the existing active approval without creating a duplicate row.
- After smoke, expected `blogger_publish_approvals` count is `1`.
- `content_items`, `blogger_draft_saves`, `blogger_draft_approvals`, and `llm_call_logs` must remain unchanged.

## Patch 9E-7C Publish approval execution guard

Patch 9E-7C adds read-only execution guard logic for stored publish approvals. It does not add a schema migration.

The guard compares the latest saved publish approval safe fields against current state:

- content item id and status
- `draftMarkdown` hash
- `draftHtml` hash and length
- title candidate
- target Blogger blog id
- Blogger draft post id
- publish mode
- optional `scheduledAt` and timezone
- approval status and invalidation metadata
- token state

The guard returns read-only `invalidationCandidates` such as:

- `draft_html_hash_changed`
- `draft_markdown_hash_changed`
- `draft_html_length_changed`
- `title_candidate_changed`
- `target_blogger_blog_changed`
- `blogger_post_id_changed`
- `content_status_changed`
- `scheduled_at_changed`
- `timezone_changed`
- `approval_already_invalidated`
- `approval_status_not_executable`

Policy:

- `invalidationCandidates` are diagnostics only.
- This patch does not update `blogger_publish_approvals.invalidatedAt` or `invalidatedReason`.
- This patch does not insert a new publish approval.
- The guard keeps `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canPublish=false`, and `canSchedulePublish=false`.
- Token expired state remains an execution blocker, but no token refresh is attempted.
- No `content_items` status/timestamp/hash field is mutated.

## Patch 9E-7D Publish approval invalidation dry-run

Patch 9E-7D adds read-only invalidation preview logic for stored publish approvals. It does not add a schema migration.

The invalidation preview uses execution guard output and returns:

- approval found/active/current-state match summary
- manual invalidation request state
- manual invalidation reason preview
- `wouldInvalidate`
- `canInvalidate=false`
- `invalidationReasons`
- `invalidationCandidates`
- dry-run invalidation plan for `blogger_publish_approvals`
- side-effect summary with `dbRead=true` and all writes false

Policy:

- Normal current-state preview should not require invalidation when the saved approval still matches current content/Blogger draft metadata.
- Manual invalidation reason may be previewed, but it only adds `manual_user_requested_invalidation` to the dry-run plan.
- `canInvalidate` remains false until a separately approved future patch implements persistence.
- This patch does not update `blogger_publish_approvals.invalidatedAt` or `invalidatedReason`.
- This patch does not insert, update, or delete `blogger_publish_approvals`.
- This patch does not mutate `content_items`, `blogger_draft_saves`, `blogger_draft_approvals`, or `llm_call_logs`.

## Patch 9E-7E Publish execution attempt policy/schema plan

Patch 9E-7E documents the future publish execution attempt audit model and adds a read-only preview. It does not add a Prisma model or migration.

Future table name:

- `blogger_publish_execution_attempts`

Future fields should include:

- `id`
- `contentItemId`
- `publishApprovalId`
- `publishApprovalSnapshotHash`
- `mode`
- `status`
- `attemptNumber`
- `targetBloggerBlogId`
- `bloggerPostId`
- `draftHtmlHash`
- `titleCandidate`
- `requestedAt`
- `startedAt`
- `finishedAt`
- `requestedBy`
- `tokenStateAtAttempt`
- `executionGuardCheckedAt`
- `approvalMatchesCurrentState`
- `invalidationCandidatesJson`
- `sideEffectSummaryJson`
- `bloggerRequestSummaryJson`
- `bloggerResponseRedactedJson`
- `errorType`
- `errorCode`
- `errorMessageRedacted`
- `retryEligible`
- `retryBlockedReason`
- `contentMutationPlanned`
- `contentMutationCompleted`
- `contentStatusBefore`
- `contentStatusAfter`
- `publishedAtPlanned`
- `publishedAtApplied`
- `scheduledAtPlanned`
- `scheduledAtApplied`
- `createdAt`
- `updatedAt`

Future status candidates:

- `planned_only`
- `blocked_by_preflight`
- `ready_for_execution`
- `attempt_started`
- `blogger_publish_succeeded`
- `blogger_publish_failed`
- `local_content_mutation_pending`
- `local_content_mutation_succeeded`
- `local_content_mutation_failed`
- `partial_failure`
- `cancelled`
- `retry_planned`
- `retry_blocked`

Policy:

- Publish attempts must link to `publishApprovalId` and `publishApprovalSnapshotHash`.
- A successful publish approval must not be reused for another publish attempt.
- Retry decisions must be based on the attempt log plus approval id, not on ad hoc UI state.
- If an external Blogger side effect may have occurred, automatic retry is blocked until a separate verification step confirms state.
- Raw Blogger response/error bodies, tokens, encrypted values, full HTML, prompts, and raw LLM responses must not be stored.
- Confirmed Blogger success and local `content_items.status`/`publishedAt` mutation must be separate ordered steps; local mutation failure after Blogger success becomes `partial_failure`.

Patch 9E-7E read-only preview:

- `POST /api/content-items/[id]/publish-execution-attempt-preview`
- `attemptStorageImplemented=false`
- `wouldCreateAttempt=false`
- `canCreateAttempt=false`
- `canExecutePublish=false`
- `canExecuteScheduledPublish=false`
- `sideEffectSummary.dbRead=true`
- all write/publish/token/LLM/content mutation flags false

## Patch 9E-7F Publish execution attempt storage

Patch 9E-7F adds local DB storage for publish execution attempt planning records.

New Prisma model and table:

- model: `BloggerPublishExecutionAttempt`
- table: `blogger_publish_execution_attempts`

The stored row is a planning-only / blocked pre-execution audit record. It is not a Blogger publish execution record.

Key stored fields:

- `contentItemId`
- `publishApprovalId`
- `publishApprovalSnapshotHash`
- `mode`
- `status`
- `attemptNumber`
- `targetBloggerBlogId`
- `bloggerPostId`
- `draftHtmlHash`
- `titleCandidate`
- `tokenStateAtAttempt`
- `executionGuardCheckedAt`
- `approvalMatchesCurrentState`
- `invalidationCandidatesJson`
- `sideEffectSummaryJson`
- `bloggerRequestSummaryJson`
- `bloggerResponseRedactedJson`
- `errorType`
- `errorCode`
- `errorMessageRedacted`
- `retryEligible`
- `retryBlockedReason`
- `contentMutationPlanned`
- `contentMutationCompleted`
- `contentStatusBefore`
- `contentStatusAfter`
- `publishedAtPlanned`
- `publishedAtApplied`
- `scheduledAtPlanned`
- `scheduledAtApplied`
- `attemptPlanJson`
- `attemptPlanHash`
- `hashAlgorithm`
- `canonicalization`
- `createdAt`
- `updatedAt`

Status values implemented in this patch:

- `planned_only`
- `blocked_by_preflight`

Idempotency:

- `@@unique([contentItemId, publishApprovalId, attemptPlanHash])`
- Saving the same server-regenerated attempt plan returns the existing row instead of creating a duplicate.

Persistence policy:

- Attempt plan storage requires explicit acknowledgement for attempt persistence, no Blogger write, and no content mutation.
- The save route regenerates the attempt preview server-side and requires the client hash preview to match.
- The save route requires the publish approval to belong to the content item, be active, and still match current state.
- Stored attempt rows keep `canExecutePublish=false` and `canExecuteScheduledPublish=false`.
- Raw Blogger response/error bodies, access tokens, refresh tokens, client secrets, encrypted values, full HTML, prompts, and raw LLM responses are not stored.
- This patch does not mutate `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown`.

## Patch 9F-1A Blog Operation Profile

Patch 9F-1A adds a blog-level operation profile foundation for reducing repeated per-content operator input.

New Prisma model and table:

- model: `BlogOperationProfile`
- table: `blog_operation_profiles`

Core identity:

- `targetBloggerBlogId` is unique so each Blogger blog has one default operation profile.
- `targetBloggerBlogName` and `targetBloggerBlogUrl` are safe metadata only.

Safe-by-default policy fields:

- `operationMode = approval_required`
- `defaultPublishPolicyPreset = safe_manual_publish`
- `allowAutoPublish = false`
- `allowScheduledPublish = false`
- `requireOAuthGate = true`
- `requireFinalHumanApproval = true`
- `requireExternalWriteRiskAck = true`
- `requireRollbackPlanAck = true`
- `requireReadbackAfterPublish = true`
- `requirePostPublishReconciliation = true`
- `timezone = Asia/Seoul`

Extensibility fields:

- `policyJson`
- `guardrailJson`
- `exceptionRoutingJson`

Policy:

- 9F-1A implements preview and strongly guarded apply/write code, but validation does not create or update profile rows.
- Profile write requires `BLOG_OPERATION_PROFILE_WRITE_ENABLED=true` and the exact confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE`.
- The profile is not wired into publish gates yet. That remains a future 9F-1B/9F-1C step.
- No Blogger write/publish/update/draft save, OAuth reconnect, token refresh, content generation, LLM call, content mutation, approval mutation, or attempt mutation is performed by the 9F-1A validation flow.

## Patch 9F-1B Default Blog Operation Profile Row

Patch 9F-1B applies the `safe_manual_publish` profile row for the verified Blogger blog used in the first publish milestone.

Applied row:

- `targetBloggerBlogId = 3065973490356135805`
- `targetBloggerBlogName = 급등포착`
- `targetBloggerBlogUrl = https://mathlearningappl.blogspot.com/`
- `profileName = Default`
- `status = active`
- `operationMode = approval_required`
- `defaultPublishPolicyPreset = safe_manual_publish`
- `timezone = Asia/Seoul`

Persisted policy values:

- `allowAutoPublish = false`
- `allowScheduledPublish = false`
- `requireOAuthGate = true`
- `requireFinalHumanApproval = true`
- `requireExternalWriteRiskAck = true`
- `requireRollbackPlanAck = true`
- `requireReadbackAfterPublish = true`
- `requirePostPublishReconciliation = true`

Apply guard:

- The row was created through the existing guarded default-policy route.
- The only allowed business mutation was a single create/upsert in `blog_operation_profiles`.
- Apply required `BLOG_OPERATION_PROFILE_WRITE_ENABLED=true` and the exact confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE`.
- After apply, `blog_operation_profiles_count = 1`.
- With the write flag disabled, apply is still blocked by `blog_operation_profile_write_feature_flag_disabled`.

Policy boundary:

- 9F-1B does not wire operation profiles into publish gates.
- 9F-1B does not perform Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, content item mutation, publish approval mutation, or publish attempt mutation.
- 9F-1C should attach the profile summary to publish gates as read-only advisory metadata before any policy-enforced gate behavior is added.

## Patch 9F-1C Operation Profile Advisory

Patch 9F-1C wires the existing `BlogOperationProfile` row into publish gate/preflight responses as read-only advisory metadata.

New publish gate response field:

- `operationProfileAdvisorySummary`

Core semantics:

- `advisoryOnly = true`
- `policyEnforced = false`
- `blockerImpact = false`
- `executionPermissionImpact = false`
- `blockingReasons = []`

The advisory summary reads the profile for the current target Blogger blog and returns safe metadata:

- profile id presence
- target Blogger blog id/name/url
- profile status
- operation mode
- default publish policy preset
- timezone
- auto/scheduled publish booleans
- OAuth, human approval, external write risk, rollback, readback, and post-publish reconciliation requirements
- advisory match booleans for target blog, active status, safe preset, approval-required mode, disabled auto/scheduled publish, and required manual guards
- advisory warnings and notes
- side-effect summary

The current profile row remains:

- `targetBloggerBlogId = 3065973490356135805`
- `defaultPublishPolicyPreset = safe_manual_publish`
- `operationMode = approval_required`
- `allowAutoPublish = false`
- `allowScheduledPublish = false`
- `requireOAuthGate = true`
- `requireFinalHumanApproval = true`
- `requireReadbackAfterPublish = true`
- `requirePostPublishReconciliation = true`

Policy boundary:

- Profile advisory does not change `canExecutePublish`, `canPublish`, `canProceedToPublishExecution`, or blocker semantics.
- Profile missing/mismatch/preset issues are advisory warnings only in 9F-1C.
- No auto publish, scheduled publish, retry, recovery, Blogger write, OAuth reconnect, token refresh, content generation, LLM call, content mutation, approval mutation, attempt mutation, schema migration, or profile write is performed by the 9F-1C flow.

## Patch 9F-1D Operation Profile Exception Dashboard

Patch 9F-1D adds an exception-only dashboard draft on top of the read-only Operation Profile advisory.

New response field:

- `operationProfileExceptionDashboardSummary`

Surfaces:

- `POST /api/content-items/[id]/publish-oauth-gate`
- `POST /api/blog-operation-profiles/default-policy`

Core semantics:

- `dashboardVersion = 9F-1D`
- `dashboardMode = exception_only_draft`
- `advisoryOnly = true`
- `policyEnforced = false`
- `blockerImpact = false`
- `executionPermissionImpact = false`
- `blockingReasons = []`

Dashboard shape:

- `profileFound`
- `profileHealthy`
- `attentionLevel`
- `normalItemCount`
- `warningItemCount`
- `exceptionItemCount`
- `headline`
- `operatorSummary`
- `focusItems`
- `collapsedNormalItems`
- `profilePolicySnapshot`
- `advisoryWarnings`
- `advisoryNotes`
- `sideEffectSummary`

Current healthy baseline:

- `profileFound = true`
- `profileHealthy = true`
- `defaultPublishPolicyPreset = safe_manual_publish`
- `operationMode = approval_required`
- `allowAutoPublish = false`
- `allowScheduledPublish = false`
- `requireOAuthGate = true`
- `requireFinalHumanApproval = true`
- `requireReadbackAfterPublish = true`
- `requirePostPublishReconciliation = true`

Policy boundary:

- Dashboard focus items are advisory-only and do not become publish blockers in 9F-1D.
- Existing publish blockers, `canExecutePublish`, `canPublish`, and publish/scheduled publish permissions are unchanged.
- No auto publish, scheduled publish, retry, recovery, Blogger write, OAuth reconnect, token refresh, content generation, LLM call, business DB mutation, content mutation, approval mutation, attempt mutation, schema migration, or profile write is performed by the 9F-1D flow.
