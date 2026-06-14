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
