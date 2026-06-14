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
