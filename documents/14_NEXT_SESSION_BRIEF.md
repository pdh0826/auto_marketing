# 14_NEXT_SESSION_BRIEF

## Current Repository State

```text
repo: ~/blog-growth-agent
branch: master
latest committed baseline before Patch 9E-4C-3A: 60685b2 Harden local sectioned draft safety and timeout policy
```

## Implemented Scope

- PostgreSQL + Prisma CRUD API
- LLM Provider/Model/Task Route/Call Log management
- Blog and brand profile CRUD UI
- Content request CRUD UI
- Content asset upload and metadata management
- Content plan/draft generation with user review before DB save
- Saved draftMarkdown to HTML preview/apply
- Saved draftHtml quality preview
- Publish Readiness Gate preview
- Blogger connection placeholder settings
- Blogger OAuth state, callback token exchange, and encrypted token metadata
- Blogger blog list read-only lookup
- Verified Blogger blog selection save with server revalidation
- Blogger draft payload preview
- Blogger draft manual approval guard with snapshot hashes
- Blogger draft save via `posts.insert?isDraft=true` guarded by active approval snapshot match
- Blogger draft save live verification runbook and retry/update policy documentation
- Manual HTML quality repair preview for short/placeholder `draftHtml`
- Repair candidate apply UX polish with explicit validate/apply handoff
- Provider-aware draft generation strategy foundation for `content_draft`
- Local LLM sectioned draft generation preview for `content_draft`
- Local sectioned draft FAQ preservation hotfix
- Local sectioned draft safety phrase scrub hotfix
- Local sectioned draft timeout policy hotfix
- Local sectioned draft cold-start timeout policy hotfix
- Local stepwise draft generation DB schema/repository foundation

## Current Blogger State

- `blogger_connections` stores safe connection and selected blog metadata.
- `blogger_connection_secrets` stores encrypted token/client-secret metadata only.
- `blogger_draft_approvals` stores approval snapshot hashes and safe target blog metadata.
- `blogger_draft_saves` stores safe draft save success/failure metadata.
- Actual draft save is limited to Blogger `posts.insert` with `isDraft=true`.
- Duplicate successful saves for the same approval snapshot are blocked.
- Live verification requires explicit user approval with: `실제 Blogger test blog에 draft post가 생성됩니다. 실행해도 됩니까?`
- Patch 9E-3 did not execute a live Blogger draft save.
- `retryable=true` failure records are retry candidates; guard failures are not.
- `posts.update`, publish, scheduled publish, token refresh, and bulk publishing are not implemented.
- Content item status, `qualityScore`, `publishedAt`, and `scheduledAt` are not mutated by Blogger draft save.
- Publish readiness can show selected blog, manual approval, and draft saved checks, but `publishReady=false` and top-level `ready=false` remain.
- Patch 9E-4A adds `quality-repair-preview` to generate a rule-based HTML candidate without DB mutation, LLM calls, or Blogger API calls.
- Saving a repair candidate still requires the existing manual `apply-html` flow.
- Patch 9E-4B makes repair candidate handoff explicit: candidates can be used as HTML candidates, must be revalidated, and can only be saved through manual `apply-html`.
- After `draftHtml` changes, Quality Dry Run, Publish Readiness, and Blogger Draft Payload Preview must be rerun; existing Blogger draft approval snapshots may become stale.
- Patch 9E-4C-1 keeps remote/commercial draft generation on the existing one-shot full draft path.
- Patch 9E-4C-1 identifies local/small-model-like draft routes as `local_sectioned_multi_pass` strategy candidates, but actual sectioned generation is not implemented yet.
- Draft generation responses and `content_draft` call logs now include safe strategy metadata only.
- Patch 9E-4C-2 implements local sectioned draft preview behind the existing `generate-draft` endpoint.
- Local sectioned draft generation runs skeleton, section generation, deterministic assembly, and final polish/fallback.
- Patch 9E-4C-2-hotfix preserves saved `planJson.faq` in local sectioned drafts.
- If final polish removes the FAQ structure, deterministic fallback appends a safe `## FAQ` section and records safe FAQ metadata.
- Patch 9E-4C-2-hotfix2 scrubs validation-blocking local sectioned safety phrases after FAQ guard/fallback and before draft validation.
- Local sectioned repair results also pass through the same deterministic scrub before repair validation.
- Scrub metadata is limited to `safetyScrubApplied`, `safetyScrubCount`, and `safetyScrubCodes`.
- Patch 9E-4C-2-hotfix3 separates local sectioned timeout policy from one-shot timeout behavior.
- Local sectioned generation uses a 600000ms overall timeout, 240000ms skeleton timeout, 180000ms section timeout, and 300000ms final polish/repair timeout.
- Timeout metadata is limited to `timeoutPolicy`, `overallTimeoutMs`, `stepTimeoutMs`, and `finalPolishTimeoutMs`.
- Patch 9E-4C-2-hotfix4 extends the local sectioned timeout policy for Ollama cold-start/model-load delays.
- Local sectioned generation now uses a 1200000ms overall timeout, 600000ms skeleton timeout, 300000ms section/retry timeout, and 600000ms final polish/repair timeout.
- Timeout metadata also includes `skeletonTimeoutMs`, `sectionTimeoutMs`, and `repairTimeoutMs`.
- If local sectioned smoke still times out, the next step should be async/background job design instead of further timeout extension.
- Generated candidate Markdown still requires manual `draftMarkdown에 반영`; `draftHtml` generation/apply and quality checks remain separate.
- Remote/commercial routes still use the existing one-shot full draft path.
- Patch 9E-4C-3A adds persisted stepwise draft generation run/step tables and repository helpers.
- `local_sectioned_stepwise` is now a strategy type/label for future stepwise API/UI patches.
- The new run/step repository stores safe status/hash/latency/metadata and normalized Markdown fragments only.
- Patch 9E-4C-3A does not add API routes or UI and does not change the existing `generate-draft` route.
- Existing `local_sectioned_multi_pass` single-request behavior is preserved as legacy/debug behavior.

## Next Patch Candidate

Patch 9E-4C-3B 후보: Local stepwise draft generation start/read run API.

Alternative candidates:

- Patch 9E-4C-3C: Local stepwise skeleton/section execution API.
- Patch 9E-4D: Blog post template renderer / publish-ready HTML theme.
- Patch 9E-5: Blogger OAuth/test blog readiness 재점검.

Recommended scope:

- Add start/read APIs for `content_draft_generation_runs`.
- Start run should create run state only and must not call the LLM.
- Read run should return run + step safe DTOs without prompt/raw response/body fields.
- Keep existing `generate-draft` route unchanged.
- Keep commercial/high-performance remote providers on the existing one-shot full draft path.
- Keep Blogger OAuth/live draft save out of scope unless Patch 9E-5 is selected.

## Do Not Start With

- Blogger publish/scheduled publish implementation
- Token refresh implementation
- `posts.update` without first designing update/retry semantics
- qualityScore automatic save
- content item status automatic transition
- API Key or secret output
- prompt full text or raw LLM response logging
- candidate Markdown full text logging
- skeleton/section/final polish full text logging
- prompt/raw response/request body storage in run/step metadata
- FAQ question/answer full text logging
- safety scrubbed sentence full text logging
- Blogger post HTML theme auto-save
- `git add .` or `git add -A`

## First Prompt For Next Session

```text
AGENTS.md와 documents/ 폴더의 관련 문서를 먼저 읽어줘.

현재 프로젝트 상태를 점검하고 Patch 9E-4C-3B 작업계획을 제안해줘.

목표:
- Patch 9E-4B의 repair candidate apply UX polish 구현 상태를 확인한다.
- Patch 9E-4C-1의 provider-aware draft generation strategy foundation 구현 상태를 확인한다.
- Patch 9E-4C-2의 Local LLM sectioned draft generation preview 구현 상태를 확인한다.
- Patch 9E-4C-2-hotfix의 Local FAQ preservation 구현 상태를 확인한다.
- Patch 9E-4C-2-hotfix2의 Local safety phrase scrub 구현 상태를 확인한다.
- Patch 9E-4C-2-hotfix3의 Local sectioned timeout policy 구현 상태를 확인한다.
- Patch 9E-4C-2-hotfix4의 Local sectioned cold-start timeout policy 구현 상태를 확인한다.
- Patch 9E-4C-3A의 Local stepwise draft generation DB schema/repository foundation 구현 상태를 확인한다.
- Local stepwise draft generation start/read run API의 최소 범위를 설계한다.
- remote/commercial provider의 기존 one-shot draft generation은 유지한다.
- 자동 draftHtml 저장, Blogger API 호출, publish/scheduled publish는 명시적으로 범위를 정하기 전까지 구현하지 않는다.

아직 구현하지 말고 계획만 작성해줘.
```
