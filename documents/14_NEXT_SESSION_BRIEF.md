# 14_NEXT_SESSION_BRIEF

## Current Repository State

```text
repo: ~/blog-growth-agent
branch: master
latest commit: 1f83c77 Add HTML preview dry run for saved drafts
```

Recent commits:

```text
a53094c Improve draft safety repair flow
1c89245 Generate draft markdown candidates with LLM
a05c62b Add draft markdown dry run preview
2e7d5a0 Add editable plan candidate revalidation
78c5385 Return safe LLM call log summaries
af0ce9a Generate content plan candidates with LLM
```

## Implemented Scope

- PostgreSQL + Prisma CRUD API
- LLM Provider/Model/Task Route/Call Log management
- Provider invocation and connection test
- Safe call log DTO
- Blog and brand profile CRUD UI
- Content request CRUD UI
- Content asset upload and metadata management
- Rule-based media metadata suggestions
- `/content/[id]` detail screen
- Manual planJson editing and planned status transition
- `content_plan` dry-run preview
- `content_plan` LLM candidate generation
- Generated plan candidate editing and revalidation
- `content_draft` dry-run preview
- `content_draft` LLM candidate generation
- Generated draft candidate editing and revalidation
- Draft safety prompt hardening and one-time repair on validation failure
- Saved draftMarkdown based HTML Conversion Dry Run
- HTML candidate editing, revalidation, and manual draftHtml apply

## Verified Runtime State

Test content item:

```text
id = cmqc2xqbr00011y70sxmgl65v
has_plan = true
has_draft = true
has_html = false
```

Latest verified `content_draft` call log:

```text
validationOk = true
repairAttempted = false
markdownLength = 1665
mediaPlaceholderCount = 1
```

## Next Patch

Patch 8E 후보: saved `draftHtml` 기반 품질검사 dry-run/preview.

Target:

- saved `draftHtml`을 기반으로 HTML 구조, 링크, CTA, 금융/투자 안전문구, media reference 품질을 검사한다.
- 품질검사 결과는 화면 preview로 표시한다.
- qualityScore 자동 저장은 하지 않거나 별도 수동 반영 정책을 먼저 설계한다.
- 실제 Blogger 연동 없음
- publish/scheduled publish 없음

## Do Not Start With

- Blogger OAuth/API/publish
- qualityScore automatic save
- HTML quality check and Blogger publishing in one patch
- API Key or secret output
- prompt full text or raw LLM response logging
- using `content_plan` route as a `content_draft` substitute
- `git add .` or `git add -A`

## First Prompt For Next Session

```text
AGENTS.md와 documents/ 폴더의 관련 문서를 먼저 읽어줘.

현재 프로젝트 상태를 점검하고 Patch 8E 작업계획을 제안해줘.

목표:
- 저장된 draftHtml 기반 품질검사 dry-run/preview를 설계한다.
- HTML 구조, 링크, CTA, 금융/투자 안전문구, media reference 품질을 점검한다.
- 실제 Blogger OAuth/API/publish는 구현하지 않는다.
- qualityScore 자동 저장은 하지 않는다.

아직 구현하지 말고 계획만 작성해줘.
```
