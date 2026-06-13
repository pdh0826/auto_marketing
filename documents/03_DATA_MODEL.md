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
- Patch 2에서는 API Key 저장/암호화 구현을 하지 않는다.
- 필요한 경우 `secretRef`, `apiKeyLast4` 같은 안전한 메타 필드만 둔다.
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
