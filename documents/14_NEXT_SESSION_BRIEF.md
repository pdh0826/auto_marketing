# 14_NEXT_SESSION_BRIEF

## Current Repository State

```text
repo: ~/blog-growth-agent
branch: master
latest committed baseline before Patch 9E-4C-3C: 3cb3fbc Add stepwise draft generation run APIs
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
- Local stepwise draft generation start/read API
- Local stepwise draft generation skeleton/section step execution API
- Local Ollama stepwise smoke stabilization for skeleton/section execution

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
- Patch 9E-4C-3B adds start/read APIs for persisted stepwise runs.
- `POST /api/content-items/[id]/draft-generation-runs` creates a `local_sectioned_stepwise` pending run only and requires saved `planJson`.
- `GET /api/content-items/[id]/draft-generation-runs` returns safe run summaries.
- `GET /api/content-items/[id]/draft-generation-runs/[runId]` returns one run detail with pending/executed step summaries.
- Patch 9E-4C-3B does not execute LLM steps, create `llm_call_logs`, add UI, or change `generate-draft`.
- Patch 9E-4C-3C adds `POST /api/content-items/[id]/draft-generation-runs/[runId]/steps/[stepKey]`.
- Step execution supports `skeleton`, `intro`, `body_1`, `body_2`, `body_3`, and `conclusion_cta_faq`.
- Each request executes at most one step and requires a local-like `content_draft` primary route.
- Section steps require a successful skeleton step.
- Successful step output is stored only on `content_draft_generation_steps` as normalized Markdown fragment plus short summary/hash/latency metadata.
- Step execution may create `llm_call_logs`, but logs contain only safe step metadata and hashes, not prompt/raw response/output Markdown.
- Patch 9E-4C-3C does not add assembly, final polish, cancel API, UI, or content item auto-apply.
- Patch 9E-4C-3C smoke stabilization switches stepwise Ollama generation to streaming responses with first-byte/idle/overall timeout diagnostics.
- Stepwise Ollama calls preflight `/api/tags` and fail with safe codes such as `provider_model_not_found`, `provider_first_byte_timeout`, `provider_idle_timeout`, or `provider_timeout`.
- Skeleton smoke defaults are intentionally small (`num_predict=360`, `num_ctx=2048`) and use short `keep_alive=30s`.
- `scripts/smoke_9e4c3c_stepwise_local_ollama.mjs` can check the configured local route and selected Ollama model without mutating content items or Blogger data.
- Patch 9E-4C-3D adds deterministic assemble and final polish APIs for persisted local stepwise runs.
- `POST /api/content-items/[id]/draft-generation-runs/[runId]/assemble` combines successful section outputs in fixed order without LLM calls.
- `POST /api/content-items/[id]/draft-generation-runs/[runId]/final-polish` runs one local-like provider final polish call after assembly.
- Assemble/final polish store candidates only on the run and do not auto-apply to `content_items`.
- `scripts/smoke_9e4c3d_assemble_final_polish.mjs` can run assemble-only by default, or include final polish with `--final-polish`.
- Patch 9E-4C-3E adds content detail UI for listing/selecting stepwise runs, creating a run, executing one step at a time, assembling, and final polishing.
- Stepwise UI shows safe step metadata, hashes, validation summary, and read-only assembled/final candidate previews.
- Stepwise UI does not auto-apply candidates to `content_items` and remains separate from Blogger draft save/publish controls.
- Patch 9E-4C-3F adds a client-side manual apply guard for completed stepwise final candidates.
- The “수동 적용 후보로 사용” action copies `finalCandidateMarkdown` into the existing Draft Markdown candidate editor only.
- The copy action does not call APIs, create `llm_call_logs`, mutate `content_items`, or touch Blogger tables.
- Patch 9E-4D adds deterministic Blog Post Template HTML preview from the current Draft Markdown candidate.
- `POST /api/content-items/[id]/blog-post-template-preview` is preview-only and does not mutate content items, create `llm_call_logs`, or call Blogger APIs.
- The content detail UI can render themed preview HTML in an iframe/read-only textarea, but does not provide a `draftHtml` apply button in that preview area.
- Patch 9E-4E adds a client-side handoff guard from Blog Post Template HTML preview to the existing HTML candidate editor.
- The “HTML 후보로 사용” action does not call APIs, save `draftHtml`, create `llm_call_logs`, mutate content items, or touch Blogger tables.
- HTML candidate source can now show `blog template preview`; validation is stale until existing `validate-html` is run.
- Patch 9E-4F hardens the manual `apply-html` path.
- `POST /api/content-items/[id]/apply-html` still revalidates server-side and writes only `content_items.draftHtml`.
- The content detail UI shows safe apply summary metadata and confirms Blogger/LLM/publish/token side effects remain false.
- Manual `draftHtml` save now uses an in-page 2-step confirmation guard before calling `apply-html`.
- Patch 9E-4G-1 adds a read-only Blogger Draft Save Preflight route and UI.
- `POST /api/content-items/[id]/blogger-draft-save-preflight` recomputes saved `draftHtml` validation, draft payload preview, current approval snapshot match, and publish-readiness summary.
- Draft Save Preflight returns only safe metadata: short hashes, counts, blocking reasons, warnings, selected blog summary, connection/token presence booleans, approval status, and side-effect flags.
- The content detail Blogger Draft save button now requires a passing preflight result in addition to existing payload approval guards.
- Preflight does not mutate content items, create `llm_call_logs`, call Blogger APIs, save Blogger drafts, publish, schedule publish, or refresh tokens.
- Patch 9E-4G-1b improves Draft Save Preflight UX/readiness guidance.
- Content detail now maps blocking reasons to next actions, shows a readiness checklist, links to `/settings/blogger` when no Blogger connection exists, and keeps the Blogger Draft save button disabled until preflight passes.
- 9E-4G-1b does not change preflight server behavior, mutate content items, create `llm_call_logs`, call Blogger APIs, start OAuth automatically, save drafts, publish, schedule publish, or refresh tokens.
- Patch 9E-4G-1c refines Draft Save Preflight blocker classification.
- `blogger_draft_saved` is no longer a first-draft-save blocker; same-approval duplicate saves use `blogger_draft_already_saved_for_approval`.
- Expired access tokens block preflight with `access_token_expired_reauth_required`; token refresh is still not implemented.
- Env-backed `clientSecretRef` can satisfy client secret readiness through safe boolean diagnostics without returning secret material.
- Patch 9E-4G-2a fixes the content detail Blogger Draft save UI activation gate.
- The save button now activates from the latest passing Draft Save Preflight result rather than publish-readiness top-level readiness.
- The UI uses an in-page 2-step confirmation before calling the existing guarded Blogger draft save route.
- Codex smoke should verify the enabled button but should not click the final save confirmation without explicit user approval.
- Patch 9E-4G-2b documents the first successful web UI Blogger draft save smoke.
- The test blog draft save created Blogger post id `6376467965797870330`; `blogger_draft_saves=1`, `blogger_draft_approvals=1`, and `llm_call_logs=22`.
- The content item stayed `planned`; `draftMarkdown` hash `9e0921e7edc9e4a8464a0a52ba369d3d` and `draftHtml` hash `a7393df8fb009566201daeea18796027` were unchanged.
- Draft Save Preflight can now return the latest same-approval successful draft save as safe metadata.
- Content detail shows a success/protection block with draft metadata, derived Blogger admin edit/preview links, and duplicate-save guidance.
- `blogger_draft_already_saved_for_approval` is a protective state for the same approval, not a publish failure.
- `posts.update`, publish, scheduled publish, token refresh, and additional draft save remain out of scope unless explicitly requested.

## Next Patch Candidate

Patch 9E-4G-3 후보: Blogger draft update/retry policy planning, or Patch 9E-5 Blogger OAuth/token refresh readiness planning.

Alternative candidates:

- Patch 9E-5: Blogger OAuth/test blog readiness 재점검.
- Patch 9E-4H: post-save publish-readiness UX refresh without publish implementation.

Recommended scope:

- Treat the current same-approval draft save as already completed and duplicate-blocked.
- Do not create another Blogger draft unless a new patch explicitly designs update/retry/new-approval semantics.
- If preflight is blocked by `access_token_expired_reauth_required`, manually re-run OAuth before considering any further Blogger write.
- For another save attempt, require intentional `draftHtml` change, new payload preview, new approval snapshot, and user-approved live write.
- Keep publish, scheduled publish, token refresh, and posts.update out of scope.
- Keep automatic `draftHtml`, status, qualityScore, Blogger draft save, and publish out of scope unless separately requested.
- Keep existing `generate-draft` route unchanged.
- Keep commercial/high-performance remote providers on the existing one-shot full draft path.
- Keep additional Blogger live draft save out of scope unless explicitly selected.

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

현재 프로젝트 상태를 점검하고 Patch 9E-4G 작업계획을 제안해줘.

목표:
- Patch 9E-4G-1/1b/1c의 saved draftHtml readiness recheck / Blogger Draft Save Preflight UX와 blocker classification 구현 상태를 확인한다.
- 저장된 `draftHtml` 기준 Quality Dry Run / Publish Readiness / Blogger Draft Payload Preview / Draft Save Preflight 결과를 점검한다.
- preflight checklist와 action item이 현재 blocker를 정확히 안내하는지 확인한다.
- expired access token이면 OAuth를 사용자가 직접 다시 실행해야 하며 token refresh는 구현하지 않는다.
- 실제 Blogger draft save를 진행할 경우 live test blog 사용자 승인, active approval snapshot match, verified selected blog, access token 상태를 다시 확인한다.
- content item status/qualityScore/publishedAt/scheduledAt 자동 변경, Blogger publish/scheduled publish/token refresh, LLM 호출은 금지한다.
- 실제 live draft save는 별도 승인 후 Patch 9E-4G-2 또는 Patch 9E-5 후보로 분리한다.

아직 구현하지 말고 계획만 작성해줘.
```
