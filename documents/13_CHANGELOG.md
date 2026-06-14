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
