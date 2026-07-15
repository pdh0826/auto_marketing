# 13_CHANGELOG

## VIDEO-5 Source Preview to Local Package

Connected VIDEO-4 source previews to a generic local package generator.

- Added `video_source_package` manifest version `VIDEO-5`.
- Added generic package cards, storyboard, subtitles, script, cover/card HTML, and MP4 render plan outputs.
- Added concise subtitle generation rules so subtitle cues contain key points only.
- Added deterministic text-card image generation as local SVG files for cover/card scenes.
- Added `POST /api/video-sources/package` with `write=false` preview and `write=true` local package generation.
- Added `/wizard/video` local package generation controls and file summary.
- Added safety coverage for source package preview/write, source hash preservation, local-only output path, disabled upload flags, and no secret/LLM/external-write side effects.

Safety:

- Package writes are local-only under `local-data/video-automation/sources`.
- Text-card images are local SVG artifacts under the package `cards/` directory.
- No Blogger/Tistory publishing, platform upload, scheduler mutation, external service write, secret read, or LLM call is added.
- Content item package generation may read an existing content item and assets, but does not mutate content or asset rows.
- Generic MP4 rendering remains plan-only until a separate renderer connection patch.

## VIDEO-4A-4H Source Collection Layer

Added a read-only source collection layer so video automation can start from more than Daily Brief.

- Added `CollectedVideoSource`, evidence, visual candidate, safety policy, side-effect summary, and preview result contracts.
- Added manual source preview for operator-provided text, links, and visual metadata.
- Added content item source preview route for read-only existing content item and asset metadata.
- Added Daily Brief source preview route on the common collection contract.
- Added site recipe fixture parser with allowlisted domain validation and selector-based extraction.
- Added generic URL preview guard that does not fetch network content.
- Added `/wizard/video` for selecting source type and reviewing source hash, counts, safety flags, and script preview.
- Expanded safety tests for VIDEO-4 source previews and route read-only boundaries.
- Added `documents/23_VIDEO_SOURCE_COLLECTION.md`.

Safety:

- Preview routes do not write package files, upload, publish, call LLM/TTS providers, mutate scheduler state, or read secrets.
- Existing content item preview may read DB rows but does not mutate content items or assets.
- Site recipe and generic URL collectors do not perform network fetches in VIDEO-4.
- Upload flags remain disabled in the generic scaffold.

## VIDEO-3A-3H Common Video Source Pipeline

Refactored video automation so Daily Brief is one adapter on top of a reusable video source pipeline.

- Added common video source bundle types for source snapshots, provenance, insights, visual materials, risk notes, and generic package scaffolds.
- Added canonical SHA-256 hashing with redaction for unsafe flexible source values.
- Moved Daily Brief insight/material extraction into `buildDailyBriefVideoSourceBundle`.
- Switched voiceover script generation to the common script builder.
- Added a read-only content item adapter for future videos sourced from existing blog posts and attached image metadata.
- Added a generic package scaffold that keeps upload flags disabled.
- Added wizard source bundle counts for operator visibility.
- Expanded the safety fixture to lock Daily Brief adapter hashes, content item redaction, generic script generation, and disabled upload boundaries.

Safety:

- No Blogger/Tistory publishing, platform upload, scheduler mutation, DB write, Daily Brief mutation, content item mutation, secret read, external service write, or LLM call is added.
- Content item support is adapter-only and read-only; it accepts already-loaded content/asset metadata and does not query or mutate storage.
- Asset storage paths and unsafe flexible values are excluded/redacted from emitted source bundles.

## VIDEO-2C Free Local Voiceover Render

Added local-only voiceover automation for Daily Brief video packages.

- Added `POST /api/daily-brief/runs/[runId]/video-package/render-voiceover`.
- Added deterministic voiceover script generation from Daily Brief article insights: title, stock/ETF/futures picks, research summaries, disclosures, prewrite context, storyboard, and subtitles.
- Added free local TTS execution using macOS `say` first, then `espeak-ng` when available.
- Added local audio muxing with `ffmpeg` to create `video-with-voiceover.mp4`.
- Added `voiceover-script.txt`, local audio file, command records, `voiceover-render-report.json`, and voiced MP4 readback artifacts.
- The voiceover route also prepares the existing upload metadata package after a successful voiced MP4 render.
- Added wizard controls and status for free TTS voiceover rendering.
- Updated the safety fixture to verify voiceover script content and keep TTS/provider execution local-only.

Safety:

- No paid TTS subscription is required by the implementation.
- No OpenAI, ElevenLabs, Google, AWS, Azure, or other external provider call is added.
- No secret read, LLM call, DB write, Daily Brief mutation, content item mutation, scheduler mutation, Blogger/Tistory write, or platform upload is added.
- Upload metadata remains manual-review-only with uploads disabled.

## VIDEO-2B Audio Contract and No-Call Guard

Extended the design-only audio/narration contract while keeping audio implementation blocked.

- Expanded `documents/21_VIDEO_AUDIO_DESIGN.md` with VIDEO-2B status flags, allowed/forbidden scope, voiceover artifact contract, provider boundary, cost gate, and MP4 audio gate.
- Added static safety checks to `npm run test:video-automation` so video automation source fails if audio implementation/provider markers appear before approval.
- Added a compact local review checklist to `/wizard/daily-brief`.

Safety:

- No TTS execution, LLM narration, voiceover file write, audio binary write, MP4 audio muxing, provider call, secret read, upload, publish, scheduler mutation, DB write, Daily Brief mutation, or content item mutation.
- VIDEO remains silent local video generation until a separately approved implementation patch changes the contract.

## VIDEO-1O Wizard Review Status

Improved the Daily Brief wizard video automation status block.

- Added full source hash visibility to the package summary.
- Added upload-enabled, can-upload, and operator runbook status fields.
- Added operator-checklist file path and byte summary after upload metadata generation.
- Added a local MP4 review gate summary in readback, including hash match/stale state, MP4 artifact status, operator checklist status, and guard cleanliness.
- Added current/saved hash and manifest/checklist artifact details to readback.

Safety:

- UI-only patch.
- No new API route, DB write, Daily Brief mutation, content item mutation, scheduler mutation, secret read, external service write, upload, publish, or LLM call.

## VIDEO-1N Operator Runbook

Added operator-facing documentation for local MP4 review.

- Added `documents/22_VIDEO_OPERATOR_RUNBOOK.md`.
- Documented required local artifacts, readback state, source hash checks, visual review, storyboard/subtitle review, metadata review, forbidden actions, and failure handling.
- Added the runbook to the VIDEO verification workflow path filter.

Safety:

- Manual review outside the app is defined as local-only inspection.
- YouTube/Instagram/TikTok uploads, Blogger/Tistory writes, scheduler mutation, content item mutation, Daily Brief source mutation, secret reads, and operating repo/server usage remain forbidden.

## VIDEO-1M Video Automation Verification Hook

Connected the video automation safety fixture to a reusable verification command and CI workflow.

- Added `npm run verify:video-automation`.
- Added `.github/workflows/video-automation.yml` for VIDEO-related path changes.
- The workflow runs `npm ci`, `npm run test:video-automation`, `npm run lint`, `npm run typecheck`, and `npm run build` through the verification command.
- Extended the safety fixture with a saved-manifest stale hash readback case.

Safety:

- The stale-hash test writes and removes only a dedicated fixture manifest under `local-data/video-automation`.
- No Daily Brief source run, content item, scheduler state, DB row, secret, token, or external service is mutated.
- External platform uploads and Blogger/Tistory writes remain disabled.

## VIDEO-1L Source Hash and Safety Boundary Test

Pinned the video automation source contract and no-write safety boundary with a deterministic fixture test.

- Added `npm run test:video-automation`.
- Added a fixture that verifies the Daily Brief source hash is stable across package generation time changes.
- Added a fixture mutation check that verifies safe source field changes produce a different source hash.
- Verified capture `storagePath`, token, credential, and client-secret markers are not emitted into the manifest.
- Verified package/readback guards keep platform uploads, scheduler mutation, external writes, secret reads, DB writes, LLM calls, and operating repo/server touch disabled.
- Added a static source scan for video automation code to block DB/prisma imports, env access, secret file references, network fetches, and enabled external-write flags.

Safety:

- The test uses an in-memory Daily Brief fixture and does not mutate Daily Brief runs or existing content items.
- No Blogger/Tistory API write, YouTube/Instagram/TikTok upload, scheduled publish change, token refresh, secret read, DB write, LLM call, or external write is added.
- The readback check remains read-only.

## VIDEO-1F-1I Upload Metadata, Workflow, Readback, and Guard

Completed the remaining local-only VIDEO-1 workflow pieces.

- Added `POST /api/daily-brief/runs/[runId]/video-package/upload-metadata`.
- Added disabled platform metadata files for YouTube, Instagram, and TikTok plus `operator-checklist.md`.
- Added `GET /api/daily-brief/runs/[runId]/video-package/readback`.
- Added local artifact existence, file size, current source hash, saved source hash, and stale-state readback.
- Added operating guard fields for repo/server touch, external write route enablement, scheduler mutation, and secret-read requirement.
- Expanded the Daily Brief wizard video workflow with upload metadata and package readback actions.
- Updated `documents/20_VIDEO_AUTOMATION.md` with VIDEO-1F through VIDEO-1I.

Safety:

- All upload metadata keeps `uploadEnabled=false` and `platformUploadsEnabled=false`.
- No YouTube, Instagram, TikTok, Blogger, or Tistory API write route was added.
- Daily Brief run JSON remains read-only input.
- Existing content items, scheduler state, and DB rows are not mutated.
- No token refresh, secret read, LLM call, or external write.

## VIDEO-2A Audio Design

Added design-only documentation for future narration/audio support.

- Added `documents/21_VIDEO_AUDIO_DESIGN.md`.
- Kept audio and narration implementation out of scope.
- Documented required provider abstraction, call logging, cost policy, and secret redaction requirements before any external TTS or LLM integration.

Safety:

- No TTS call.
- No LLM call.
- No audio file generation.
- No secret read.
- No external write.

## VIDEO-1E Local MP4 Render

Added local-only silent MP4 preview rendering.

- Added `POST /api/daily-brief/runs/[runId]/video-package/render-mp4`.
- Added an `ffmpeg`-based renderer that uses VIDEO-1C card PNGs and storyboard durations.
- Added `mp4-concat-input.txt`, `mp4-render-command.json`, `video.mp4`, and `mp4-render-report.json` output records.
- Added MP4 render status and file summary to the Daily Brief wizard video block.
- Recorded ffmpeg availability/execution failures as local reports instead of performing any external write.
- Updated `documents/20_VIDEO_AUTOMATION.md` with the VIDEO-1E renderer contract.

Safety:

- Daily Brief run JSON remains read-only input.
- Existing content items, scheduler state, and DB rows are not mutated.
- MP4 rendering writes ignored local files under `local-data/video-automation` only.
- Rendered MP4 is silent and local preview only.
- No Blogger/Tistory API write, YouTube/Instagram/TikTok upload, scheduled publish change, token refresh, secret read, or LLM call.

## VIDEO-1D Storyboard and Subtitle Quality Gate

Hardened deterministic video package quality checks before MP4 rendering.

- Added shortform card budget enforcement with a 9-card limit.
- Added deterministic stock-card compression while preserving cover, market summary, optional ETF/futures summaries, and final risk note.
- Added validation that the closing risk note is the final card.
- Added scene duration bounds of 3 to 7 seconds.
- Added subtitle cue index sequence, subtitle text length, and on-screen text length checks.
- Updated `documents/20_VIDEO_AUTOMATION.md` with the VIDEO-1D validation contract.

Safety:

- Daily Brief run JSON remains read-only input.
- Existing content items, scheduler state, and DB rows are not mutated.
- MP4 binary rendering and external uploads remain blocked.
- No Blogger/Tistory API write, YouTube/Instagram/TikTok upload, scheduled publish change, token refresh, secret read, or LLM call.

## VIDEO-1C Daily Brief Card PNG Render

Added local-only visual rendering for Daily Brief video packages.

- Added `POST /api/daily-brief/runs/[runId]/video-package/render-cards`.
- Added a Playwright-based renderer that regenerates the VIDEO-1B package and writes `cards/cover.png`, one `cards/card-*.png` per manifest card, and `card-render-report.json`.
- Rendered each card as an isolated `1080x1920` HTML document for stable 9:16 PNG output.
- Recorded source hash, renderer settings, image dimensions, file sizes, validation errors, overflow warnings, and side-effect summary in the render report.
- Added a Daily Brief wizard button and result table for card PNG rendering.
- Updated `documents/20_VIDEO_AUTOMATION.md` with the VIDEO-1C renderer contract.

Safety:

- Daily Brief run JSON remains read-only input.
- Existing content items, scheduler state, and DB rows are not mutated.
- PNG rendering writes ignored local files under `local-data/video-automation` only.
- MP4 binary rendering and external uploads remain blocked.
- No Blogger/Tistory API write, YouTube/Instagram/TikTok upload, scheduled publish change, token refresh, secret read, or LLM call.

## VIDEO-1B Daily Brief Video Source Contract

Hardened the video package contract before any card or MP4 renderer is added.

- Bumped the video package manifest version to `VIDEO-1B`.
- Added a deterministic Daily Brief source snapshot with SHA-256 hash, hash prefix, canonical JSON length, included fields, and excluded fields.
- Added package validation checks for card id uniqueness, required risk note, storyboard timing continuity, subtitle alignment, MP4 render-plan-only state, disabled uploads, and side-effect boundary cleanliness.
- Added source hash and validation summary to the Daily Brief wizard video package block.
- Updated `documents/20_VIDEO_AUTOMATION.md` with the VIDEO-1B source contract.

Safety:

- Daily Brief run JSON remains read-only input.
- Existing content items, scheduler state, and DB rows are not mutated.
- Capture `storagePath`, env files, tokens, credentials, and client secrets are excluded from the source snapshot.
- MP4 binary rendering and external uploads remain blocked.
- No Blogger/Tistory API write, YouTube/Instagram/TikTok upload, scheduled publish change, token refresh, secret read, or LLM call.

## VIDEO-1A Daily Brief Video Package Scaffold

Added the first internal video automation slice for Daily Brief results.

- Added read-only package preview and local package generation at `/api/daily-brief/runs/[runId]/video-package`.
- Added deterministic card news, storyboard, subtitles, cover, MP4 render-plan, and upload manifest builders under `src/lib/video-automation`.
- Added a Daily Brief wizard section for previewing/generating the local package and inspecting file/side-effect summaries.
- Added `documents/20_VIDEO_AUTOMATION.md` to document the module scope and VIDEO-1A safety boundary.

Safety:

- Daily Brief run JSON is read-only input.
- Existing content items, scheduler state, and DB rows are not mutated.
- MP4 binary rendering is not implemented yet; VIDEO-1A writes an MP4 render plan only.
- No Blogger/Tistory API write, YouTube/Instagram/TikTok upload, scheduled publish change, token refresh, secret read, or LLM call.

## Tistory session keep-alive and login-required alerts

- Added a 30-minute, read-only Tistory persistent-profile session keep-alive check owned by the web scheduler.
- Added session status, last check, and next check visibility to `/automation/tistory`.
- Added one atomic PDash Telegram login-required alert per failed Tistory queue item at its due time.
- Added the same safe login-required alert to the 08:00 Blogger scheduler and all additional Blogger publication slots when OAuth refresh/reconnect blocks publishing.
- Fixed partial Tistory config updates so omitted fields no longer disable the scheduler or live-publish guard.
- Kept passwords, cookies, OAuth tokens, raw provider responses, and article bodies out of alert payloads.

## Blogger OAuth terminal blocker recovery

- Changed publication retry discovery to scan due entries across market-date boundaries, so a 23:30 retry is not orphaned after midnight.
- Added explicit `retryable` state and stopped repeated attempts for OAuth `invalid_grant`, reconnect-required, and unauthorized-client blockers.
- Added an atomic PDash blocker alert with only safe schedule/error metadata and links to Blogger settings and automation status.
- Kept content candidates intact while preventing Blogger draft/publish writes when OAuth recovery is required.

## Futures publication accuracy and readability

- Hardened scheduled Blogger and Tistory futures capture so the requested instrument/timeframe is selected and verified before a screenshot is accepted.
- Replaced the seven-column futures position table with a four-column summary and explicit `매수 거래`/`매도 거래` direction labels.
- Kept foreign-flow wording out of SEO titles unless a complete verified market-flow snapshot is available.

## Publication schedule registry

- Registered a single weekday publication timetable for five Blogger and seven Tistory editorial slots.
- Added `GET /api/automation/publication-schedule` and a full schedule/status view to the Daily Brief automation page.
- Kept only the existing Blogger 08:00 guarded slot active; all other slots expose their generation, market-flow, recurring queue, or per-content approval blockers without publishing.

## Patch 9G-13 project300 Tistory Style/SEO Guide

Prepared the reusable project300 Tistory writing standard.

- Added `src/lib/tistory/project300-style.ts` with:
  - style profile version
  - reference post list
  - personal investor blog voice rules
  - structure rules
  - SEO review checklist
  - banned weak/report-like phrases
  - reusable generation prompt
- Updated project300 Tistory export metadata to include style profile, tone policy, SEO checklist, and generation prompt.
- Updated Content Detail `Tistory HTML Export` to display the style profile and project300 SEO checklist.
- Updated Daily Tistory signal review metadata to record the active writing style profile.
- Corrected the actual Tistory-safe category label to `ETF 섹터 흐름 리뷰`.
- Added `documents/17_PROJECT300_TISTORY_STYLE_SEO_GUIDE.md` as the human-readable guide.

Safety:

- No Tistory API write.
- No Blogger API write.
- No draft save, publish, scheduled publish, token refresh, OAuth reconnect, or LLM call.

## Patch 9G-14 project300 Chart/Image Layout Template

Extended the project300 Tistory style profile into a reusable layout template.

- Added layout template rules for:
  - hero thumbnail
  - opening note
  - TOP summary table
  - stock chart image before stock interpretation
  - image explanation immediately after screenshots
  - news/disclosure links after chart interpretation
  - closing note and final risk guidance
- Added image/chart explanation policy so screenshots are treated as explanatory evidence rather than decoration.
- Updated Tistory export metadata and Content Detail UI to display the layout template and image explanation policy.
- Tuned the Daily Tistory signal review Markdown template:
  - more personal project300-style opening text
  - stock blocks now flow through chart image, chart read, entry/stop context, news/disclosure, weak point, and next check
  - ETF blocks now explain sector/market direction after the ETF board image

Safety:

- No Tistory API write.
- No Blogger API write.
- No draft save, publish, scheduled publish, token refresh, OAuth reconnect, or LLM call.

## Patch 9G-8 Daily UpSignal Brief Automation

Added the first vertical slice for a Daily UpSignal Brief workflow.

- New wizard route: `/wizard/daily-brief`.
- New read-only Daily Brief run APIs:
  - `POST /api/daily-brief/runs`
  - `GET /api/daily-brief/runs`
  - `GET /api/daily-brief/runs/[runId]`
  - `POST /api/daily-brief/runs/[runId]/capture-kr-board`
  - `POST /api/daily-brief/runs/[runId]/capture-stock-details`
  - `POST /api/daily-brief/runs/[runId]/capture-etf-board`
  - `POST /api/daily-brief/runs/[runId]/research`
  - `POST /api/daily-brief/runs/[runId]/generate-content`
  - `POST /api/daily-brief/runs/[runId]/run-all` as intentionally disabled preview.
- Added UpSignal read-only parsers for Korean stock board and ETF board.
- Added optional screenshot capture helper:
  - Uses Playwright if installed in the runtime.
  - Falls back to explicit placeholder PNG assets with warnings when Playwright is not configured.
- Added Daily Brief Markdown template:
  - Korean stock board summary.
  - TOP 8 table.
  - TOP 5 stock detail sections.
  - ETF TOP 5 section.
  - FAQ and investment disclaimer.
- Added content generation that creates one planned content item, attaches captured/placeholder images as ContentAssets, renders Blogger-ready HTML, and reports quality preview.

Safety:

- No Blogger draft save.
- No Blogger publish or scheduled publish.
- No token refresh.
- No LLM call.
- News search stores only title/source/URL/short safe summary, not article bodies.

## Patch 9G-7 User Wizard UI

Added wizard-first UI routes so normal article work can proceed without jumping across scattered admin panels.

- New route: `/wizard/new`.
  - Guides the user through article type, topic, source/materials, structure options, generation confirmation, and completion.
  - Uses the existing guided SEO article prep route only after the explicit `진행` button.
- New route: `/wizard/edit/[id]`.
  - Guides the user through edit goal, edit scope, candidate review, dry-run validation, and explicit manual apply.
  - Reuses the existing guarded SEO editorial candidate apply route and requires `APPLY_SEO_EDITORIAL_CANDIDATE` for content mutation.
- New route: `/wizard/publish/[id]`.
  - Guides the user through SEO workflow, Blogger draft payload preview, manual draft approval snapshot, and draft save preflight.
  - Does not run actual Blogger draft save or publish.
- Dashboard, `/auto`, `/content/new`, and content detail navigation now point users toward the wizard-first flows.

Safety:

- No automatic Blogger draft save.
- No automatic Blogger publish or scheduled publish.
- No token refresh.
- No LLM call.
- Existing guarded routes remain responsible for any explicit DB mutation.

## Patch 9G-6A Guided SEO Article Prep UI

Added an app-based guided action so a new SEO article can be prepared from `/content/new` without terminal orchestration.

- New route: `POST /api/content-items/guided-seo-article-prep`.
- New helper: `src/lib/content/guided-seo-article-prep.ts`.
- New `/content/new` UI block: `Guided SEO Article Prep`.
- The guided action creates one new `planned` content item with:
  - deterministic long-form `draftMarkdown`
  - Blogger-ready `draftHtml`
  - `planJson`
  - quality/workflow summary
- The UI links directly to the created content detail page.

Runtime smoke:

- `/content/new`: 200
- `POST /api/content-items/guided-seo-article-prep`: 201
- Created content item: `cmrb3vwg200015lek6r4bobps`
- Status: `planned`
- Title: `급등주 알림을 봤을 때 바로 사지 말고 확인할 7가지`
- `draftMarkdown` length `6331`
- `draftHtml` length `7378`
- visible text length `6293`
- quality ready `true`, grade `warn`, score `94`
- SEO editorial score `100`

Safety:

- This patch performs only the intended local content item creation.
- No Blogger API read/write.
- No Blogger draft save.
- No Blogger publish.
- No scheduled publish.
- No token refresh.
- No LLM call or `llm_call_logs` creation.

## Patch 9G-3/9G-4/9G-5 Bundled SEO Production Flow

Bundled the next three SEO production improvements into one larger patch so the project stops accumulating tiny approval-only steps.

9G-3 글 품질 엔진:

- Raised the SEO article publish floor to `3000` visible Korean characters.
- Raised the SEO article target to `5000` visible Korean characters.
- Raised structural expectations to at least `8` H2 sections and `16` paragraphs.
- Strengthened local sectioned and stepwise draft prompts so each section must be expanded with:
  - reader problem
  - concrete scenario
  - practical checks
  - beginner mistake
  - takeaway

9G-4 운영 UI:

- Content detail now shows the bundled 9G-3/9G-4/9G-5 workflow intent in the SEO Editorial Publish Workflow block.
- Blog template preview now exposes visible text length, publish floor, SEO target, and long-form gate status.

9G-5 다음 글 dry-run:

- Added deterministic dry-run script `scripts/generate_9g3_longform_seo_candidate.mjs`.
- Generated artifacts:
  - `documents/generated/9g-3-longform-seo-candidate.md`
  - `documents/generated/9g-3-longform-seo-candidate-preview.html`
  - `documents/generated/9g-3-longform-seo-review.json`
- Dry-run review result:
  - grade `pass`
  - score `100`
  - visible text length `6239`
  - blockers `[]`
  - warnings `[]`

Not executed:

- No Blogger draft save, Blogger publish/write, scheduled publish, `posts.update`, OAuth reconnect, token refresh, deploy, push, external LLM call, content item mutation, quality score mutation, publish timestamp mutation, or raw token/Blogger response output.

## Patch 9G-2A SEO Editorial Publish Workflow Readback

Added a read-only workflow readback so the successful SEO editorial publish path can be inspected from the content detail UI instead of being reconstructed from terminal steps.

- New route: `POST /api/content-items/[id]/seo-editorial-publish-workflow`.
- New helper: `src/lib/content/seo-editorial-publish-workflow.ts`.
- Content detail UI now includes a "SEO Editorial Publish Workflow" block with:
  - safe content/draft hash and length summary
  - quality and SEO editorial summary
  - Blogger connection/blog selection readiness
  - draft approval/save, publish approval/attempt, and reconciliation status
  - ordered step table and next recommended action
- The route is read-only and returns side-effect flags showing no DB write, content mutation, Blogger API read/write, draft save, publish, token refresh, or LLM call.

Not executed:

- No Blogger draft save, Blogger publish/write, scheduled publish, `posts.update`, OAuth reconnect, token refresh, deploy, push, external LLM call, quality score mutation, publish timestamp mutation, or raw token/Blogger response output.

## Patch 9G-1E through 9G-1O SEO Editorial Candidate Publish Completion

Completed the full guarded path for the 9G-1C SEO editorial candidate.

Runtime target:

- New planned content item: `cmrb2i6o100015lz6g0alf8c8`.
- Title: `주식 초보자가 매수 타이밍을 놓치는 이유: 급하게 사기 전에 확인할 5가지`.
- Target Blogger blog: `3065973490356135805` / `급등포착`.

Completed steps:

- 9G-1E: created one new `planned` content item instead of mutating an already published item.
- 9G-1F: applied the 9G-1C candidate through `seo-editorial-candidate-apply`.
  - Mutated only `draftMarkdown` and `draftHtml`.
  - `draftMarkdown` md5 `57d697d00345139442289ebfb7cb5f71`.
  - `draftHtml` md5 `3caa4f6a7d4d4f17d83c0f9843303531`.
  - `draftHtml` length `7301`.
- 9G-1G: quality/readiness/draft payload rechecks passed.
  - quality ready `true`, grade `warn`, score `96`.
  - SEO article/editorial score `100 / 100`.
  - draft payload ready `true`.
- 9G-1H: created Blogger draft approval `cmrb2k8he00035lz614h9k49l`.
- 9G-1I: first draft save preflight blocked on expired access token; then a guarded token refresh was executed once.
  - Refresh changed access token state to `valid`.
  - No Blogger write/publish occurred during refresh.
  - Re-run preflight returned `canSaveDraft=true`.
- 9G-1J: executed one guarded Blogger draft save.
  - Draft save id `cmrb2mg1f00075lz6c7v0czzp`.
  - Blogger post id `3766964499360138555`.
  - Draft save status `success`.
- 9G-1K: post-save preflight blocked duplicate draft save with `blogger_draft_already_saved_for_approval`; publish readiness reported `bloggerDraftSaved=true`.
- 9G-1L: saved publish approval and execution attempt.
  - Publish approval id `cmrb2om1500095lz6mhag01tg`.
  - Publish execution attempt id `cmrb2pe8s000b5lz6qn1anl58`.
- 9G-1M: guarded publish dry-run passed all metadata/OAuth/final-preflight matches while keeping Blogger publish disabled.
- 9G-1N: executed one guarded live Blogger publish with `BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=true`.
  - Public URL: `https://mathlearningappl.blogspot.com/2026/07/5.html`.
  - Blogger published/updated timestamp: `2026-07-07T13:02:11-07:00`.
- 9G-1O: publish result readback matched Blogger post id, URL, published timestamp, updated timestamp, approval, attempt, draft save, and target blog.
  - Reconciliation marked content item `published`.
  - Local `publishedAt`: `2026-07-07T20:02:11.000Z`.
  - Publish execution attempt marked `success` with redacted readback metadata.

Final DB state:

- Content item status `published`.
- `draftMarkdown` / `draftHtml` hashes unchanged after apply.
- `qualityScore=null`.
- `scheduledAt=null`.
- `llm_call_logs=27`.
- `blogger_draft_saves=4`.
- `blogger_publish_execution_attempts=4`.

Safety notes:

- No `posts.update` call.
- No scheduled publish.
- No raw Blogger response storage.
- No raw token/secret output.
- No LLM call during 9G-1E through 9G-1O.
- Content mutation after live publish was limited to post-publish reconciliation: status and `publishedAt`.

## Patch 9G-1D Guarded SEO Editorial Candidate Apply Route

Added a guarded route for moving an SEO editorial Markdown candidate into `content_items.draftMarkdown` and rendered `draftHtml`.

- New route: `POST /api/content-items/[id]/seo-editorial-candidate-apply`.
- Default mode is `dry_run`.
- `mode=apply` requires:
  - content item status `planned`
  - exact confirmation phrase `APPLY_SEO_EDITORIAL_CANDIDATE`
  - candidate Markdown present
  - blog template preview ready
  - HTML validation ready
  - optional current draft/candidate hash guards to match when provided
- If applied, only `draftMarkdown` and `draftHtml` may mutate.
- The route returns safe summaries only: current hashes, candidate hashes, validation status, SEO article/editorial scores, blockers, and side-effect flags.

Current DB state:

- All existing local content items are already `published`.
- Therefore the 9G-1C candidate must not be applied to the existing published content item until a new planned content item or an explicit correction/update policy exists.
- Negative smoke should report `content_item_not_planned` and no DB write.

Not executed:

- No Blogger draft save, Blogger publish/write, scheduled publish, `posts.update`, OAuth reconnect, token refresh, deploy, push, external LLM call, quality score mutation, publish timestamp mutation, or raw token/Blogger response output.

## Patch 9G-1C SEO Editorial Gate and Candidate Polish

Added a human-editor oriented SEO quality layer on top of the existing structural article gate.

- Added `src/lib/content/seo-editorial-quality.ts` to detect:
  - broken/mixed-language expressions such as `报表` or repeated typo patterns
  - risky finance phrasing
  - direct buy/sell signal phrasing overuse
  - excessive brand and primary keyword repetition
  - weak practical checklist/example/disclaimer signals
- Wired editorial quality into:
  - `src/lib/content/seo-article-quality.ts`
  - `src/lib/content/html-quality-preview.ts`
  - `src/lib/blog-renderer/blog-post-template-renderer.ts`
  - Content Detail template preview / quality preview UI
- Added `scripts/generate_9g1c_seo_editorial_candidate.mjs`.
- Generated preview-only artifacts:
  - `documents/generated/9g-1c-seo-editorial-candidate.md`
  - `documents/generated/9g-1c-seo-editorial-candidate-preview.html`
  - `documents/generated/9g-1c-seo-editorial-review.json`

Editorial candidate result:

- Grade/score: `pass / 100`
- Visible text length: `6029`
- Markdown length: `6143`
- HTML length: `7150`
- H1/H2/H3: `1 / 12 / 4`
- Paragraph count: `41`
- Brand mentions: `7`, per 1000 chars `1.16`
- Primary keyword mentions: `6`, per 1000 chars `1`
- Broken expression count: `0`
- Risky finance phrase count: `0`
- Direct trading signal count: `0`
- Checklist/example/disclaimer signals: `16 / 15 / 16`
- Blockers/warnings: `[] / []`

Not executed:

- No content item `draftMarkdown` or `draftHtml` mutation.
- No Blogger draft save, Blogger publish/write, scheduled publish, `posts.update`, OAuth reconnect, token refresh, deploy, push, quality score mutation, or raw token/Blogger response output.
- No external LLM provider call was made by this patch; the candidate was generated deterministically by the local script.

## Patch 9G-1B SEO-Sectioned Candidate Generation Smoke

Generated and validated one new SEO-sectioned candidate without saving it to `content_items` and without Blogger API write/publish.

- Target content item used for preview: `cmqc2xqbr00011y70sxmgl65v`.
- Initial attempt on `daily_fixture_cmqlr1v1y0002iwj27df8ac5a` stopped safely because its saved `planJson` did not pass validation.
- Successful generation route: `POST /api/content-items/cmqc2xqbr00011y70sxmgl65v/generate-draft`.
- Generation strategy: `local_sectioned_multi_pass`.
- Generation duration: about 478 seconds.
- Candidate Markdown length: `9168`.
- Candidate validation: `ok=true`, errors `0`, warnings `0`.
- Section keys generated:
  - `intro`
  - `summary`
  - `problem_context`
  - `check_method_1`
  - `check_method_2`
  - `beginner_mistakes`
  - `service_use_case`
  - `faq`
  - `risk_disclaimer`
  - `cta`
- FAQ required/detected: `true / true`.
- Safety scrub applied: `true`, count `1`, codes `success_outcome_phrase`.
- HTML template preview returned HTTP 200 and validation `ok=true`.
- HTML preview metrics:
  - Markdown length `9168`
  - HTML length `11284`
  - visible text length `8746`
  - H1 `1`
  - H2 `11`
  - H3 `29`
  - paragraphs `54`
  - unsafe patterns `0`
  - raw HTML escaped `false`
  - `<pre>`/`<code>` detected `false / false`
  - raw Markdown heading detected in HTML `false`
  - SEO article grade `pass`
  - SEO article score `100`
  - SEO blockers `[]`
  - SEO warnings `[]`
- `validate-html` for the rendered HTML returned `validation.ok=true`, errors `0`, HTML SEO grade `pass`, score `100`, visible text length `8746`.

Artifacts:

- Candidate Markdown: `documents/generated/9g-1b-seo-sectioned-candidate.md`.
- Candidate HTML preview: `documents/generated/9g-1b-seo-sectioned-candidate-preview.html`.

Verified side effects:

- No content item `draftMarkdown`, `draftHtml`, status, quality score, `publishedAt`, or `scheduledAt` mutation.
- Blogger draft approvals/saves and publish approvals/attempts remained `3 / 3 / 3 / 3`.
- `llm_call_logs` increased from `26` to `27` because one LLM candidate generation was intentionally executed.

Not executed:

- Blogger draft save, Blogger publish/write, scheduled publish, `posts.update`, OAuth reconnect, token refresh, deploy, push, draft Markdown apply, draft HTML apply, quality score mutation, raw Blogger response storage, or raw token output.

## Patch 9G-1A SEO Article Quality Engine Hardening

Shifted the pipeline from publish-safety-only checks toward SEO article quality gates.

- Added `src/lib/content/seo-article-template.ts` with a fixed SEO article template:
  - intro
  - summary
  - problem context
  - two check-method sections
  - beginner mistakes
  - service use case
  - FAQ
  - risk disclaimer
  - CTA
- Added `src/lib/content/seo-article-quality.ts` to detect:
  - code-block-centered article HTML
  - raw Markdown headings/lists left inside HTML
  - thin visible text
  - missing article/H1/H2/paragraph structure
  - missing FAQ and finance disclaimer
- Hardened `validateHtmlCandidate` so SEO article blockers fail validation.
- Wired SEO article validation into:
  - `validate-html`
  - `apply-html`
  - Blogger draft payload preview
  - Blogger draft save preflight
  - publish readiness / quality preview
- Hardened Markdown-to-HTML preview/rendering so code fences are not emitted as `<pre><code>` Blogger article bodies.
- Added SEO validation details to the Content Detail HTML candidate validation UI and Blogger draft save preflight UI.
- Updated local/stepwise section-generation prompts and default section keys so future runs fill fixed SEO template sections instead of relying on a loose four/five-section outline.

Smoke results:

- Bad HTML candidate with `<pre><code># ... ## ...</code></pre>` now fails validation with blockers including `html_is_code_block`, `html_contains_raw_markdown_headings`, `html_visible_text_too_short`, `html_h2_count_too_low`, `html_paragraph_count_too_low`, `html_faq_count_too_low`, and `html_finance_disclaimer_missing`.
- Blog template preview no longer turns fenced Markdown into `<pre><code>`; the same short candidate still fails SEO blockers because it is thin.
- The saved second fixture `draftHtml` now fails Blogger draft save preflight SEO validation with `html_is_code_block`, raw Markdown, thin-content, H2, paragraph, and FAQ blockers.

Published post audit notes:

- The first paid-LLM/API post is article-shaped but repetitive and still below the desired SEO depth.
- The 7/5 post is article-shaped but thin.
- The 7/6 post was published as Markdown inside a code block and now correctly fails the new gate.

Not executed:

- Blogger publish/write, scheduled publish, `posts.update`, extra draft save, OAuth reconnect, token refresh, LLM call, deploy, push, draft Markdown mutation, draft HTML mutation, quality score mutation, scheduled timestamp mutation, raw Blogger response storage, or raw token output.

## Patch 9F-5A / 9F-5B Second Fixture Post-Publish Duplicate Prevention Hardening

Verified the post-publish duplicate prevention and idempotent readback/reconciliation guards for the already published second daily fixture.

- Target content item: `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Published Blogger post id: `411073211994805417`.
- Published URL: `https://mathlearningappl.blogspot.com/2026/07/blog-post_06.html`.
- Publish preflight now reports `content_status_not_planned` and `content_already_published` for the second fixture.
- Publish approval preview reports `content_status_not_planned` and `content_already_published`.
- Publish approval save is rejected with HTTP 400 and `content_status_not_planned`; no publish approval row is created.
- Publish execution attempt save is rejected with HTTP 400, `approval_no_longer_matches_current_state`, and `content_status_changed`; no publish execution attempt row is created.
- Guarded publish execution dry-run remains blocked with `content_status_not_planned` and `content_already_published`; Blogger publish/write is not attempted.
- Publish result readback succeeds after local reconciliation, with all expected matches true.
- Repeated post-publish reconciliation apply returns no-op success with `applyOk=true`, `appliedContentItemPatch=false`, `appliedAttemptPatch=false`, and `dbWrite=false`.

Verified final second fixture state:

- Status remains `published`.
- `publishedAt=2026-07-06T15:36:05.000Z`.
- `scheduledAt=null`.
- `draftMarkdown` md5 remains `b62b37748074bcfcf6c7b25b6852d064`.
- `draftHtml` md5 remains `dbfed22f5d7e57be3449ade45eb30f6a`.
- `draftHtml` length remains `1505`.
- Counts remain `blogger_draft_approvals=3`, `blogger_draft_saves=3`, `blogger_publish_approvals=3`, `blogger_publish_execution_attempts=3`, `llm_call_logs=26`.

Not executed:

- Blogger publish/write, scheduled publish, `posts.update`, extra draft save, OAuth reconnect, token refresh, LLM call, deploy, push, draft Markdown mutation, draft HTML mutation, quality score mutation, scheduled timestamp mutation, raw Blogger response storage, or raw token output.

## Patch 9F-4D / 9F-4E Second Fixture Live Publish Completion

Completed the guarded live Blogger publish and post-publish reconciliation for the second fixture after explicit user approval.

- Target content item: `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Live publish approval text explicitly acknowledged Blogger post `411073211994805417` would be publicly published.
- Re-ran guarded publish dry-run with `BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=true` and confirmed final preflight ready, OAuth gate satisfied, and all expected metadata matched.
- Executed guarded live Blogger publish exactly once.
- Blogger publish result:
  - post id `411073211994805417`
  - URL `https://mathlearningappl.blogspot.com/2026/07/blog-post_06.html`
  - published at `2026-07-06T08:36:05-07:00`
  - updated at `2026-07-06T08:36:05-07:00`
- Publish result readback succeeded and matched approval, attempt, draft save, target blog, post id, URL, published timestamp, and updated timestamp.
- Applied post-publish reconciliation with `BLOGGER_POST_PUBLISH_RECONCILIATION_APPLY_ENABLED=true`.
- Local content item is now `published`.
- Publish execution attempt `cmr9d9v2m00055lmcsc6a247c` is now `success` with redacted Blogger readback metadata.

Final second fixture state:

- Status: `published`.
- `publishedAt=2026-07-06T15:36:05.000Z`.
- `scheduledAt=null`.
- `draftMarkdown` length `1094`, md5 `b62b37748074bcfcf6c7b25b6852d064`.
- `draftHtml` length `1505`, md5 `dbfed22f5d7e57be3449ade45eb30f6a`.
- `qualityScore=null`.
- Counts: `blogger_draft_approvals=3`, `blogger_draft_saves=3`, `blogger_publish_approvals=3`, `blogger_publish_execution_attempts=3`, `llm_call_logs=26`.

Not executed:

- Scheduled publish, `posts.update`, extra draft save, OAuth reconnect, LLM call, deploy, push, draft Markdown mutation, draft HTML mutation, quality score mutation, raw Blogger response storage, or raw token output.

## Patch 9F-4A / 9F-4B / 9F-4C Second Fixture Publish Gate Preparation

Completed the second fixture publish preflight, publish approval snapshot, and publish execution attempt planning gates.

- Target content item: `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Initial publish preflight reported the access token expired.
- Ran the existing Blogger token refresh route once with reason `publish_oauth_gate`; it did not call Blogger publish/write.
- Re-ran publish preflight and confirmed OAuth blockers were cleared.
- Publish approval preview produced snapshot hash `f0ca5d60e9bddc86f1328cb53b028c310562414334d67e855372005bec82a757`.
- Saved local publish approval `cmr9d98zm00035lmc25l1245z`.
- Publish execution attempt preview produced plan hash `d2c1bbd6b59c583670fe533973a2131e3aaa55d3c535c55c371bcafb08a0f195`.
- Saved local publish execution attempt `cmr9d9v2m00055lmcsc6a247c` with status `planned_only`.
- Guarded publish dry-run matched approval, attempt, content hashes, target Blogger blog, and Blogger post id.

Current second fixture publish metadata:

- Blogger post id: `411073211994805417`.
- Target Blogger blog id/name: `3065973490356135805` / `급등포착`.
- Content Markdown md5: `b62b37748074bcfcf6c7b25b6852d064`.
- Content HTML md5: `dbfed22f5d7e57be3449ade45eb30f6a`.
- Content HTML length: `1505`.

Verified side effects:

- `blogger_publish_approvals` increased by one, from `2` to `3`.
- `blogger_publish_execution_attempts` increased by one, from `2` to `3`.
- The second fixture remains `planned`.
- `draftMarkdown`, `draftHtml`, `qualityScore`, `publishedAt`, and `scheduledAt` were not changed.
- `llm_call_logs` remained `26`.

Not executed:

- Blogger live publish, scheduled publish, `posts.update`, extra draft save, OAuth reconnect, LLM call, deploy, push, content item mutation, publish attempt success mutation, raw Blogger response storage, or raw token output.

Blocked / waiting:

- 9F-4D live publish was not executed. A live-mode publish request with the confirmation phrase was rejected by the safety review because it would perform an external Blogger publish. Continue only after a separate explicit approval for `9F-4D guarded live Blogger publish` acknowledging that it will publish the Blogger post.

## Patch 9F-3U / 9F-3V / 9F-3W Second Fixture Blogger Draft Save Completion

Completed the guarded Blogger draft save flow for the second daily fixture after the operator completed Blogger OAuth reconnect in the local UI.

- Target content item: `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Re-ran Blogger draft save preflight and confirmed `canSaveDraft=true`, `blockingReasons=[]`, approval snapshot match, draft payload ready, and no duplicate save.
- Executed `POST /api/content-items/daily_fixture_cmqlr1v1y0002iwj27df8ac5a/blogger-draft-save` exactly once.
- Blogger draft save succeeded with local save id `cmr9atnfz00075lzxhay26282`.
- Blogger draft post id: `411073211994805417`.
- Target Blogger blog id/name: `3065973490356135805` / `급등포착`.
- Approval id: `cmr8xwn2200015l7u8q3rmajv`.
- Snapshot prefix: `28a2c54e2cb7`.
- Draft HTML hash prefix: `f27737115a62`.
- Post-save preflight now returns `canSaveDraft=false`, blocker `blogger_draft_already_saved_for_approval`, and `duplicateSaveBlocked=true`.
- Publish readiness now reports `contentReady=true`, `bloggerDraftSaved=true`, `bloggerDraftPostId=411073211994805417`, and stage `draft_saved_publish_not_implemented`.

Verified side effects:

- `blogger_draft_saves` increased by one, from `2` to `3`.
- The second fixture remains `planned`.
- `draftMarkdown`, `draftHtml`, `qualityScore`, `publishedAt`, and `scheduledAt` were not changed.
- `llm_call_logs` remained `26`.

Not executed:

- Blogger publish, scheduled publish, `posts.update`, extra draft save, token refresh by Codex, LLM call, deploy, push, content item status mutation, quality score mutation, publish timestamp mutation, or raw Blogger response/token/code storage.

Next recommended patch:

- `9F-4A — publish readiness final preflight after saved Blogger draft` for the second fixture.

## Patch 9F-3S / 9F-3T Second Fixture Draft Approval And Preflight

Completed the second fixture Blogger draft payload approval refresh and read-only draft save preflight.

- Target content item: `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Created local Blogger draft approval `cmr8xwn2200015l7u8q3rmajv`.
- Approval snapshot prefix: `28a2c54e2cb7`.
- Current draftHtml hash prefix: `f27737115a62`.
- Approval matches current preview: `true`.
- Target Blogger blog id/name: `3065973490356135805` / `급등포착`.
- Draft payload preflight confirmed saved draftHtml, selected Blogger blog, and approval snapshot are ready.
- Draft save preflight returned `canSaveDraft=false`.
- Blocking reason: `access_token_expired_reauth_required`.
- Because preflight did not pass, guarded Blogger draft save execution was not run.

Verified side effects:

- Local draft approval count increased by one.
- No Blogger draft save row was created for the second fixture.
- The second fixture remains `planned`.
- `draftMarkdown`, `draftHtml`, `qualityScore`, `publishedAt`, and `scheduledAt` were not changed.
- `llm_call_logs` remained `26`.

Not executed:

- Blogger draft save, Blogger publish/write, scheduled publish, OAuth reconnect, token refresh, LLM call, deploy, push, raw token output, raw Blogger response output, or content item mutation.

Next required action:

- Complete Blogger OAuth reconnect or an explicitly approved safe token refresh, then rerun draft save preflight. Only if `canSaveDraft=true`, proceed to the guarded `9F-3U` Blogger draft save route.

## Patch 9F-7F: Second Fixture Candidate Persistence and HTML Readiness

Completed the approved second fixture draft body path through candidate redispatch, validation persistence, draft Markdown persistence, deterministic HTML persistence, and Blog target assignment.

- Target plan item/content item: `cmqlr1v1y0002iwj27df8ac5a` / `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Executed candidate text redispatch once under the candidate redispatch feature flag.
- Created candidate redispatch attempt `cmr7vrhjk00015lvylymaxgj1`.
- Created LLM call log `cmr7vs5vt00035lvyu4d3k2fn`.
- Created response event/artifact `cmr7vs5wb00055lvyhqau0tdo` / `cmr7vs5wc00075lvy0kdyuo0f`.
- Created candidate Markdown artifact `cmr7vs5wc00095lvyuhmnaud7`.
- Persisted the LLM output validation audit result.
- Persisted `content_items.draftMarkdown` from the approved candidate only.
- Persisted deterministic `content_items.draftHtml` from the saved Markdown only.
- Linked the content item to Blog `cmqc0ugaz00001yek2ve7fv3x` after current blog id, draft Markdown hash, draft HTML hash, Blogger connection id, and Blogger blog id matched the guarded preview.
- Final saved draft HTML readiness readback reported `draftPayloadReady=true`, `contentReady=true`, `bloggerConnectionReady=true`, `selectedBlogReady=true`, and `canProceedTo9F3S=true`.

Final second fixture state:

- Status remains `planned`.
- `draftMarkdown` length `1094`, SHA-256 `6479923f89ff35ac44a9d92ed5c692335f9e262871a01b461b8648f2c2690304`.
- `draftHtml` length `1505`, SHA-256 `f27737115a62d9ce3d9a4ef6fb2372187e1d97a7b097b83cf5ba199710d3bbeb`.
- `blogId=cmqc0ugaz00001yek2ve7fv3x`.
- `qualityScore`, `publishedAt`, and `scheduledAt` remain unset.
- Publish readiness remains blocked by manual approval and Blogger draft save, as intended.

Not executed:

- Blogger API call, Blogger draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, raw prompt output storage, or raw provider response body storage.

## Patch 9F-7E: Second Fixture Gated LLM Dispatch

Executed the gated single LLM dispatch for the second daily fixture without content mutation.

- Target plan item/content item: `cmqlr1v1y0002iwj27df8ac5a` / `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Final preflight reported `finalPreflightReadyForPlanLock=true`; plan lock preview reported `planLockCandidateReady=true`.
- Used lock hash `ccfe44cfdf3637981320bf522518f72701df8e82563e8767c513670c246dc08e`.
- LLM dispatch returned `dispatchExecutionAllowed=true`, `dispatchExecutedNow=true`, and no blockers.
- Provider response summary was `ollama_generate_received`.
- Created LLM call log `cmr7vmprp00015lm1gu51rmyo`.
- Created response event `cmr7vmptw00035lm10rihad8d` and response artifact `cmr7vmptw00055lm1go6fih4e`.
- Readback confirmed provider response/event/artifact/log were found and response hash/length matched across audit.
- Dispatch attempts/events/artifacts are now `3 / 5 / 6`; `llm_call_logs=25`.
- The second fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.

Not executed:

- Content item mutation, `draftMarkdown`/`draftHtml` persistence, Blogger API call, draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, or raw prompt/response storage.

## Patch 9F-7D: Second Fixture Dispatch Audit Preparation

Created the audit-only dispatch preparation rows for the second daily fixture.

- Target plan item/content item: `cmqlr1v1y0002iwj27df8ac5a` / `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Created dispatch attempt `cmr7vhofm00015lm8rnoopfhg` with status `created_pending_dispatch_gate`.
- Created dispatch event `cmr7vhoj500035lm8y5h0elsw` with type/status `dispatch_attempt_created` / `recorded_audit_only`.
- Created dispatch artifact `cmr7vhom700055lm8mn0qm9t2` with kind/storage/redaction `prompt_request_hash_bundle` / `hash_only` / `redacted_or_hash_only`.
- Verified global dispatch attempts/events/artifacts are now `3 / 4 / 5`.
- Verified the second fixture target-scoped dispatch attempts/events/artifacts are now `1 / 1 / 1`.
- Verified `llm_call_logs=24`, and the second fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.

Not executed:

- LLM completion, provider completion, `llm_call_logs` mutation, content item mutation, `draftMarkdown`/`draftHtml` persistence, Blogger API call, draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, or external service write.

## Patch 9F-7C: Second Fixture Provider Health-check

Executed the safe provider health-check checkpoint for the second daily fixture.

- Target plan item/content item: `cmqlr1v1y0002iwj27df8ac5a` / `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Called `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-execution` once in `healthcheck_execute` mode with the exact health-check confirmation phrase.
- Result: `healthCheckExecutionAllowedNow=true`, `healthCheckExecuted=true`, sanitized provider result `success=true`, `statusCodeClass=2xx`, provider kind `local_http`, endpoint category `provider_version`.
- Verified readback-only route after the health-check and confirmed no target-scoped dispatch attempt/event/artifact rows exist yet for the second fixture.
- Verified counts remained dispatch attempts/events/artifacts `2 / 3 / 4` and `llm_call_logs=24`.
- Verified the second fixture remains `planned` with `draftMarkdown` length `0` and `draftHtml` length `0`.

Not executed:

- LLM completion, `llm_call_logs` mutation, dispatch audit row creation, content item mutation, `draftMarkdown`/`draftHtml` persistence, Blogger API call, draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, or external service write beyond the safe provider health endpoint.

## Patch 9F-7B: Second Fixture Draft-generation Planning Preview

Validated the second daily fixture through the existing read-only draft-generation planning preview bundle.

- Target plan item/content item: `cmqlr1v1y0002iwj27df8ac5a` / `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Confirmed HTTP 200 for dry-run planner, provider readiness preview, provider health-check preview, final checklist, prompt render preview, prompt quality checklist preview, request envelope preview, and dispatch gate preview.
- Confirmed the later execution blockers remain gated by feature flags, confirmation phrase, idempotency key, and provider health-check satisfaction.
- Kept validation output limited to safe metadata; prompt body, raw response, and candidate body were not printed.

Not executed:

- LLM completion, dispatch attempt creation, `llm_call_logs` mutation, content item mutation, `draftMarkdown`/`draftHtml` persistence, Blogger API call, draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, or external service write.

## Patch 9F-5A / 9F-5B Post-Publish Duplicate Prevention Hardening

Implemented after the daily Blogger publish milestone:

- Hardened publish preflight so already-published or already-scheduled content adds explicit blockers:
  - `content_status_not_planned`
  - `content_already_published`
  - `content_already_scheduled`
- Hardened publish approval preview/save so published content carries the same blockers and approval save is rejected server-side.
- Publish approval save for the published daily fixture now returns HTTP 400 with `content_status_not_planned` and does not create another approval row.
- Publish execution attempt save for the published daily fixture returns HTTP 400 with `approval_no_longer_matches_current_state` and `content_status_changed`.
- Guarded live publish remains blocked for the published daily fixture by `content_status_not_planned` and `content_already_published` before any Blogger write can occur.
- Improved publish result readback after local reconciliation so already-published, already-reconciled content can still perform read-only Blogger readback without requiring the pre-publish final execution gate.
- Improved post-publish reconciliation idempotency so a repeated apply on already reconciled content is a no-op success with no DB write.

Runtime smoke:

- Published fixture readback after reconciliation returned `readbackOk=true`, all expected post id/URL/timestamp matches true, and side-effect DB write false.
- Repeated reconciliation apply returned `applyOk=true`, `appliedContentItemPatch=false`, `appliedAttemptPatch=false`, and DB write false.
- Final counts remained daily draft saves / publish approvals / publish attempts / `llm_call_logs` = `1 / 1 / 1 / 24`.

Policy:

- No Blogger publish/write, scheduled publish, `posts.update`, extra draft save, OAuth reconnect, token refresh, LLM call, draft Markdown mutation, draft HTML mutation, quality score mutation, deploy, push, or raw Blogger response storage occurred in this hardening patch.

## Patch 9F-4A / 9F-4B / 9F-4C / 9F-4D / 9F-4E Daily Blogger Publish Completion

Completed after the daily Blogger draft save milestone:

- Ran publish preflight for `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- The first publish preflight found the saved draft ready but access token expired; ran the existing manual Blogger token refresh route for connection `cmqfst8vc0001iwrpi1qu8oj2`.
- Token refresh result: `refreshOk=true`, old state `expired_reauth_required`, new state `valid`, new expiry `2026-07-05T13:44:07.174Z`.
- Re-ran publish preflight and confirmed saved draft metadata was ready: Blogger blog `3065973490356135805`, draft post id `491846717642826194`, approval `cmr3joq6v00015lk6hd8umgzr`, and `accessTokenExpired=false`.
- Created publish approval `cmr7sapcr00035lwudp6uhasw` with snapshot hash `80785f1d8b47f807fdaafaca026489df1acdea8b72012ed796bebfb11e3a54e2`.
- Created planning-only publish execution attempt `cmr7sbu7b00055lwurw45hbwi` with plan hash `60d7b6897317d0bfc4addfc2ecc5be87114e57aaeef2870b1e03ee4ebad120fe`.
- Guarded publish dry-run passed all state matches while keeping Blogger write false.
- Live-negative smoke with the exact live body was blocked by `live_blogger_publish_feature_flag_disabled`, proving the feature flag gate.
- Restarted local server once with `BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=true` and executed guarded live publish exactly once.
- Blogger publish succeeded: post id `491846717642826194`, URL `https://mathlearningappl.blogspot.com/2026/07/blog-post.html`, published at `2026-07-05T05:48:17-07:00`.
- Publish readback succeeded before DB reconciliation and matched expected post id, URL, published timestamp, updated timestamp, approval, attempt, draft save, and target blog.
- Ran post-publish reconciliation apply once with `BLOGGER_POST_PUBLISH_RECONCILIATION_APPLY_ENABLED=true`.
- Reconciliation updated only the local content item status/timestamps and publish attempt row: content status `published`, `publishedAt=2026-07-05T12:48:17.000Z`, attempt status `success`, redacted Blogger response stored.
- Final daily fixture DB counts: draft saves `1`, publish approvals `1`, publish execution attempts `1`, `llm_call_logs=24`.
- Daily fixture draft Markdown md5 remains `5e6505fdec8762266ff972e149a07562`; draft HTML md5 remains `bf26fc216c779a21e7b5a3a80a1976e5`; draft HTML length remains `1716`; `qualityScore=null`; `scheduledAt=null`.

Policy:

- Blogger publish was executed once through the guarded route after exact metadata, feature flag, exact confirmation phrase, rollback acknowledgement, external write acknowledgement, and final human approval were satisfied.
- No scheduled publish, `posts.update`, extra draft save, OAuth reconnect, LLM call, `llm_call_logs` mutation, draft Markdown mutation, draft HTML mutation, quality score mutation, deploy, push, or raw Blogger response storage occurred.
- After reconciliation, additional publish execution must not be repeated for the same published content unless a later approved patch intentionally defines a retry/update policy.

## Patch 9F-3T-R1 / 9F-3U / 9F-3V / 9F-3W Daily Blogger Draft Save Completion

Completed after fixing the local Blogger OAuth redirect origin and refreshing the expired access token:

- Ran the manual Blogger access token refresh route for connection `cmqfst8vc0001iwrpi1qu8oj2`.
- Refresh result: `refreshOk=true`, old access token state `expired_reauth_required`, new access token state `valid`.
- Re-ran `POST /api/content-items/daily_fixture_cmqlr1v1y0001iwj2gpv2875r/blogger-draft-save-preflight`.
- Preflight returned `canSaveDraft=true`, no blocking reasons, approval `cmr3joq6v00015lk6hd8umgzr` matched current preview, draft payload was ready, duplicate save was not blocked, and `accessTokenExpired=false`.
- Ran `POST /api/content-items/daily_fixture_cmqlr1v1y0001iwj2gpv2875r/blogger-draft-save` exactly once.
- Blogger draft save succeeded with local save id `cmr72x71100035lh5aby7v4nf`.
- Safe Blogger result metadata: post id `491846717642826194`, post URL `https://mathlearningappl.blogspot.com/`, saved at `2026-07-05T00:55:04.403Z`.
- Post-save preflight now returns `canSaveDraft=false` with blocker `blogger_draft_already_saved_for_approval`, confirming duplicate-save protection for the same approval.
- Post-save DB counts: total `blogger_draft_saves=2`, daily fixture `blogger_draft_saves=1`, daily fixture `blogger_draft_approvals=1`, `llm_call_logs=24`, `blogger_publish_execution_attempts=1`.
- Daily fixture content item remains `status=planned`, draft Markdown md5 `5e6505fdec8762266ff972e149a07562`, draft HTML md5 `bf26fc216c779a21e7b5a3a80a1976e5`, draft HTML length `1716`, `qualityScore=null`, `publishedAt=null`, and `scheduledAt=null`.

Policy:

- The token refresh updated only encrypted Blogger token storage and connection metadata.
- The draft save used the existing guarded Blogger draft save route and Blogger draft insert path.
- No Blogger publish, scheduled publish, `posts.update`, content item status mutation, quality score mutation, published timestamp mutation, scheduled timestamp mutation, LLM call, or `llm_call_logs` mutation occurred.
- Additional draft saves for approval `cmr3joq6v00015lk6hd8umgzr` are blocked unless a later approved patch intentionally changes approval/update semantics.

## Patch: Fix Local Blogger OAuth Redirect Origin

Implemented after the daily draft save preflight blocker:

- Local Blogger OAuth redirect origin now defaults to `http://localhost:3013`.
- OAuth start no longer depends on whichever localhost port the request happened to use.
- The default generated redirect URI is `http://localhost:3013/api/settings/blogger/oauth/callback`.
- `BLOGGER_OAUTH_REDIRECT_ORIGIN` can override the origin when intentionally changing ports.

## Patch 9F-3R-FIX4 Gated Daily Content Item Blog Target Assignment

Implemented after Patch 9F-3R-FIX3:

- Added `POST /api/daily-content-plans/blog-target-assignment`.
- Preview mode recomputes the draft payload blocker diagnosis and checks whether the proposed Blog target still matches the safe diagnosis.
- Apply mode requires `BLOG_DAILY_CONTENT_BLOG_TARGET_ASSIGNMENT_ENABLED=true`, exact confirmation phrase, idempotency key, expected current `blogId`, expected saved draft hashes, expected Blog id, expected Blogger connection id, and expected Blogger blog id.
- Apply mode writes only `content_items.blogId`.
- Approved one-time apply linked the daily fixture content item to Blog `급등포착 블로그` (`cmqc0ugaz00001yek2ve7fv3x`).
- Duplicate apply is blocked after `blogId` is already present and performs no second write.

Policy:

- `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, and `scheduledAt` are not changed.
- Blogger API calls, draft save, publish/schedule, OAuth reconnect, token refresh, provider calls, LLM calls, `llm_call_logs`, and dispatch audit row mutations are not performed.

## Patch 9F-3R-R2 Saved draftHtml Readiness Readback After Blog Target Assignment

Completed after Patch 9F-3R-FIX4:

- Re-ran `POST /api/daily-content-plans/saved-draft-html-readiness-readback`.
- `draftPayloadReady=true`, `contentReady=true`, `bloggerConnectionReady=true`, and `selectedBlogReady=true`.
- Previous blockers `blog_profile_missing` and `blogger_connection_not_configured` are resolved.
- Remaining publish-readiness blockers are `manual_approval` and `blogger_draft_saved`, which is expected before approval refresh and draft save.
- `canProceedTo9F3S=true`.

Policy:

- Readback is read-only.
- No content item mutation, Blogger API call, draft save, publish/schedule, OAuth reconnect, token refresh, LLM call, `llm_call_logs`, or dispatch audit mutation occurred.

## Patch 9F-3S Refreshed Blogger Draft Payload Approval Snapshot

Completed after Patch 9F-3R-R2:

- Reused `POST /api/content-items/[id]/blogger-draft-approval` for the daily fixture content item.
- The route recalculated Blogger draft payload preview server-side and created approval `cmr3joq6v00015lk6hd8umgzr`.
- Approval snapshot prefix: `ea4df1ce3e19`.
- Current draftHtml hash prefix: `a6c57bbefe17`.
- Approval matches current preview: `true`.
- Remaining expected publish-readiness blocker: `blogger_draft_saved`.

Policy:

- This patch writes only the local Blogger draft approval row.
- No content item mutation, Blogger API call, draft save, publish/schedule, OAuth reconnect, token refresh, LLM call, or `llm_call_logs` mutation occurred.

## Patch 9F-3T Daily Blogger Draft Save Preflight

Completed after Patch 9F-3S:

- Ran `POST /api/content-items/daily_fixture_cmqlr1v1y0001iwj2gpv2875r/blogger-draft-save-preflight`.
- Saved `draftHtml`, draft payload readiness, selected Blogger blog, and approval snapshot are ready.
- Preflight returned `canSaveDraft=false` because the connected Blogger access token is expired.
- Blocking reason: `access_token_expired_reauth_required`.
- Because preflight did not pass, guarded Blogger draft save execution was not run.

Policy:

- Preflight is read-only.
- No Blogger draft save, publish/schedule, OAuth reconnect, token refresh, LLM call, or content item mutation occurred.

## Patch 9F-3R-FIX3 Daily Draft Payload Blocker Diagnosis

Implemented after Patch 9F-3R-FIX2:

- Added `POST /api/daily-content-plans/draft-payload-blocker-diagnosis`.
- The route reuses saved draftHtml readiness readback and adds a read-only diagnosis for remaining draft payload blockers.
- It reports safe Blog profile candidates, safe Blogger connection candidates, blocker-to-action mapping, and a suggested next mutation preview.
- Current diagnosis identifies that the daily fixture content item is not linked to a Blog profile even though an active Blog profile with a connected verified Blogger target exists.
- The recommended next patch is `9F-3R-FIX4`: a gated one-time link of the daily fixture content item to the active Blog profile.
- Runtime smoke result: `recommendedNextPatch=9F-3R-FIX4`, suggested mutation field `content_items.blogId`, proposed Blog `급등포착 블로그`, proposed Blogger target `급등포착`, and all side-effect write flags false.

Policy:

- The route does not mutate `content_items.blogId`.
- `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, and `scheduledAt` are not changed.
- Blogger API calls, draft save, publish/schedule, OAuth reconnect, token refresh, provider calls, LLM calls, `llm_call_logs`, and dispatch audit row mutations are not performed.

## Patch 9F-3R-FIX2 Gated Finance-Risk Repaired draftHtml Persistence

Implemented after Patch 9F-3R-FIX1:

- Added `POST /api/daily-content-plans/draft-html-finance-risk-repair-persistence`.
- The route recomputes the 9F-3R-FIX1 repair candidate server-side before any write.
- Apply mode requires `BLOG_DAILY_CONTENT_DRAFT_HTML_FINANCE_RISK_REPAIR_PERSISTENCE_ENABLED=true`, exact confirmation phrase, idempotency key, expected current `draftHtml` hash, expected repair candidate hash, repair preview readiness, and planned content item.
- Apply mode writes only `content_items.draftHtml`.
- The response returns candidate hash/length and before/after lengths, not the full HTML body.
- Approved one-time apply persisted repaired `draftHtml` length/hash `1716` / `a6c57bbefe1788d82f7030ee92c71a034211f139c274f992ff4c7a331d7531c2`.
- Post-apply readback reports quality `ready=true`, `grade=warn`, `scorePreview=96`, `requiredFailCount=0`, and no failed required checks.
- Duplicate apply is blocked after the saved `draftHtml` already matches the repair candidate.

Policy:

- `draftMarkdown`, status, `qualityScore`, `publishedAt`, and `scheduledAt` are not changed.
- Blogger API calls, draft save, publish/schedule, OAuth reconnect, token refresh, provider calls, LLM calls, `llm_call_logs`, and dispatch audit row mutations are not performed.
- Recommended next patch: resolve remaining draft payload blockers before `9F-3S`; current readback still reports `blog_profile_missing`, `blogger_connection_not_configured`, and `draft_payload_not_ready`.

## Patch 9F-3R-FIX1 Saved draftHtml Finance-Risk Repair Preview

Implemented after Patch 9F-3R:

- Added `POST /api/daily-content-plans/draft-html-finance-risk-repair-preview`.
- The route scans saved `draftHtml` for the required-check `finance_risky_phrases` blocker and builds a deterministic repair candidate.
- Runtime preview found `매수 추천` twice and replaces it with `매수 여부를 판단할 때 참고할 점`.
- The candidate improves quality from `grade=fail`, `requiredFailCount=1` to `grade=warn`, `requiredFailCount=0`.
- Candidate HTML is not returned by default and is not persisted.

Policy:

- 9F-3R-FIX1 is read-only and does not mutate `content_items`.
- Blogger API calls, draft save, publish/schedule, OAuth reconnect, token refresh, provider calls, LLM calls, `llm_call_logs`, and dispatch audit row mutations are not performed.
- Recommended next patch: `9F-3R-FIX2 — gated finance-risk repaired draftHtml persistence`.

## Patch 9F-3R Saved draftHtml Readiness Readback

Implemented after Patch 9F-3Q:

- Added `POST /api/daily-content-plans/saved-draft-html-readiness-readback`.
- The route reads the saved daily fixture `draftMarkdown`/`draftHtml` state and recomputes HTML quality, publish readiness, and Blogger draft payload readiness.
- The route returns safe hash/length/check summaries only and does not return full HTML or Markdown bodies.
- The route reads safe Blogger connection/approval/draft-save metadata from DB but does not call Blogger APIs.
- Runtime readback found saved HTML quality blocked by required check `finance_risky_phrases`; content readiness and draft payload readiness are therefore not ready.

Policy:

- 9F-3R is read-only and does not mutate `content_items`.
- Blogger write/read API calls, draft save, publish/schedule, OAuth reconnect, token refresh, provider calls, LLM calls, `llm_call_logs`, and dispatch audit row mutations are not performed.
- Recommended next patch: `9F-3R-FIX1 — saved draftHtml finance-risk quality repair preview`, before `9F-3S`.

## Patch 9F-3Q Gated draftHtml Persistence

Implemented after Patch 9F-3P:

- Added `POST /api/daily-content-plans/draft-html-persistence`.
- The route recomputes the 9F-3P deterministic HTML preview server-side before any write.
- Apply mode requires `BLOG_DAILY_CONTENT_DRAFT_HTML_PERSISTENCE_ENABLED=true`, exact confirmation phrase, idempotency key, expected preview HTML hash, preview readiness, planned content item, saved `draftMarkdown`, and empty `draftHtml`.
- Apply mode writes only `content_items.draftHtml`.
- The response returns preview HTML hash/length and before/after lengths, not the full HTML body.
- The approved one-time apply persisted preview HTML hash `dd89e256aa4af32cf34e79f77b8309a32b1624cb0fdb0b76b6318f7d8b91a96d` to fixture content item `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- Post-apply `draftHtml` length is `1690`; `draftMarkdown` remains length `1141`; status remains `planned`.
- Duplicate apply is blocked once `draftHtml` exists.

Policy:

- `draftMarkdown`, status, `qualityScore`, `publishedAt`, and `scheduledAt` are not changed.
- Blogger write/publish/schedule, OAuth reconnect, token refresh, provider calls, LLM calls, `llm_call_logs`, and dispatch audit row mutations are not performed.
- Recommended next patch: `9F-3R — saved draftHtml readiness readback`.

## Patch 9F-3P draftHtml Conversion Preview

Implemented after Patch 9F-3O:

- Added `POST /api/daily-content-plans/draft-html-conversion-preview`.
- The route reads the persisted daily fixture `draftMarkdown` and renders a deterministic Blogger-ready HTML preview with the existing blog post template renderer.
- The route verifies the linked plan item, content item status, saved `draftMarkdown`, empty `draftHtml`, and preview validation result before reporting `canProceedTo9F3Q=true`.
- Preview HTML is not returned by default; callers may request it with `includePreviewHtml=true`.

Policy:

- 9F-3P is read-only and does not persist `draftHtml`.
- `draftMarkdown`, status, `qualityScore`, `publishedAt`, and `scheduledAt` are not changed.
- Blogger write/publish/schedule, OAuth reconnect, token refresh, provider calls, LLM calls, `llm_call_logs`, and dispatch audit row mutations are not performed.
- Recommended next patch: `9F-3Q — gated draftHtml persistence`.

## Patch 9F-3O Gated draftMarkdown Persistence

Implemented after Patch 9F-3I-R1:

- Added `POST /api/daily-content-plans/draft-markdown-persistence`.
- The route revalidates the current mutation gate, controlled `llm_candidate_markdown_text` artifact, expected candidate hash, linked content item state, confirmation phrase, idempotency key, and feature flag before writing.
- Apply mode writes only `content_items.draftMarkdown`.
- The response returns candidate hash/length and before/after lengths, not the full Markdown body.
- The approved one-time apply persisted candidate artifact `cmr241dl40009iwkn78t0brg7` to fixture content item `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- Post-apply `draftMarkdown` length is `1141`; `draftHtml` remains empty; status remains `planned`.
- Duplicate apply is blocked once `draftMarkdown` exists.

Policy:

- `draftHtml`, status, `qualityScore`, `publishedAt`, and `scheduledAt` are not changed.
- Blogger write/publish/schedule, OAuth reconnect, token refresh, provider calls, LLM calls, and `llm_call_logs` are not performed.
- Apply mode requires `BLOG_DAILY_CONTENT_DRAFT_MARKDOWN_PERSISTENCE_ENABLED=true` and exact confirmation phrase.

## Patch 9F-3I-R1 Candidate Text Redispatch

Implemented after Patch 9F-3O-prep:

- Added `POST /api/daily-content-plans/draft-generation-candidate-text-redispatch`.
- The previous 9F-3I dispatch intentionally stored only hash/length metadata, so full Markdown could not be reconstructed.
- The new R1 route can perform one explicitly gated provider redispatch and store the generated Markdown as a controlled `llm_candidate_markdown_text` artifact.
- Existing validation and draftMarkdown mutation previews now read the controlled candidate text artifact for hash/length/readiness checks without returning the body.

Policy:

- `content_items.draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, and `scheduledAt` are not changed by R1.
- Blogger write/publish/schedule, OAuth reconnect, and token refresh remain disabled.
- Candidate Markdown is stored only as a controlled artifact and is not returned by API/UI responses.
- Execute mode requires `BLOG_DAILY_CONTENT_DRAFT_GENERATION_CANDIDATE_TEXT_REDISPATCH_ENABLED=true`, the exact confirmation phrase, and an idempotency key.

## Patch 9F-3O-prep Candidate Text Artifact Policy

Implemented after Patch 9F-3N:

- Added `POST /api/daily-content-plans/draft-generation-candidate-text-artifact-policy`.
- Added a `/settings/blogger` UI action and summary block for candidate text artifact policy/readiness.
- The policy checks whether the latest dispatch attempt has a controlled `llm_candidate_markdown_text` artifact before any `draftMarkdown` persistence work proceeds.
- Current state is expected to block 9F-3O because the existing dispatch stored only hash/length metadata, not full Markdown candidate text.

Policy:

- 9F-3O-prep does not write DB rows, call a provider, create `llm_call_logs`, mutate content, or write Blogger/OAuth/token state.
- 9F-3O-prep does not reconstruct candidate text from hash-only artifacts and does not return raw prompt, raw provider response, full generated candidate, API key, token, secret, or encrypted value.
- Recommended next patch is `9F-3I-R1 — gated redispatch with candidate text artifact`, or an explicitly approved manual candidate text import path.

## Patch 9F-3N draftMarkdown Mutation Gate Preview

Implemented after Patch 9F-3M:

- Added `POST /api/daily-content-plans/draft-markdown-mutation-gate-preview`.
- Added a `/settings/blogger` UI action and summary block for draftMarkdown mutation preview.
- Current state blocks mutation preview because no accepted Markdown candidate is available.
- The preview does not return a proposed draftMarkdown body and does not mutate `content_items`.

Policy:

- 9F-3N does not write DB rows, call a provider, create `llm_call_logs`, mutate content, or write Blogger/OAuth/token state.
- Recommended next patch is `9F-3O — Gated draftMarkdown persistence`, which is the first content item mutation and requires explicit approval before execution.

## Patch 9F-3M Markdown Candidate Acceptance Gate

Implemented after Patch 9F-3L:

- Added `POST /api/daily-content-plans/draft-generation-markdown-candidate-acceptance-gate`.
- Added a `/settings/blogger` UI action and summary block for Markdown candidate acceptance.
- The gate reads 9F-3K validation readiness and the linked fixture content snapshot.
- Current state blocks acceptance because full candidate Markdown text is not stored and validation is not ready.

Policy:

- 9F-3M does not write DB rows, call a provider, create `llm_call_logs`, mutate content, or write Blogger/OAuth/token state.
- 9F-3M does not return raw prompt, raw provider response, full generated candidate, request body, API key, token, secret, or encrypted value.
- Recommended next patch: `9F-3N — draftMarkdown mutation gate preview`.

## Patch 9F-3L Gated Output Validation Persistence

Implemented after Patch 9F-3K:

- Added `POST /api/daily-content-plans/draft-generation-llm-output-validation-persistence`.
- Added a `/settings/blogger` UI action and summary block for validation persistence preview.
- The route can build a redacted validation event and hash-only validation artifact candidate from the 9F-3K preview.
- Apply mode is gated by feature flag, exact confirmation phrase, idempotency key, validation candidate, and duplicate artifact checks.
- UI exposes preview only; no audit row insert was executed by the UI path.

Policy:

- 9F-3L does not call a provider, use an LLM judge, create `llm_call_logs`, mutate content, or write Blogger/OAuth/token state.
- 9F-3L does not return raw prompt, raw provider response, full generated candidate, request body, API key, token, secret, or encrypted value.
- Recommended next patch: `9F-3M — Markdown candidate acceptance gate`.

## Patch 9F-3K LLM Output Quality Validation Preview

Implemented after Patch 9F-3J:

- Added `POST /api/daily-content-plans/draft-generation-llm-output-quality-validation-preview`.
- Added a `/settings/blogger` UI action and summary block for deterministic output validation preview.
- The preview reads 9F-3J response metadata and reports that full Markdown validation is blocked because the 9F-3I dispatch stored only hash/length metadata.
- Markdown structure, Korean readability, SEO headings, forbidden phrase, CTA/FAQ, and Blogger compatibility checks are surfaced as blocked until a candidate text artifact policy exists.

Policy:

- 9F-3K does not call a provider, use an LLM judge, create `llm_call_logs`, mutate audit rows, mutate content, or write Blogger/OAuth/token state.
- 9F-3K does not return raw prompt, raw provider response, full generated candidate, request body, API key, token, secret, or encrypted value.
- Recommended next patch: `9F-3L — Gated output validation persistence`.

## Patch 9F-3J LLM Response Readback

Implemented after Patch 9F-3I:

- Added `POST /api/daily-content-plans/draft-generation-llm-dispatch-response-readback`.
- Added a `/settings/blogger` UI action and summary block for response event/artifact/LLM log readback.
- The route reads the latest dispatch attempt, redacted provider response event, hash-only response artifact, latest dispatch `llm_call_logs` metadata, and linked fixture content snapshot lengths.
- It checks response hash/length consistency across safe audit metadata.

Policy:

- 9F-3J does not call a provider, create `llm_call_logs`, mutate content, or write Blogger/OAuth/token state.
- 9F-3J does not return raw prompt, raw provider response, full generated candidate, request body, API key, token, secret, or encrypted value.
- Expected current counts after 9F-3I remain attempts/events/artifacts `1 / 2 / 2`, `llm_call_logs=23`.
- Recommended next patch: `9F-3K — LLM output quality validation preview`.

## Patch 9F-3I Gated LLM Dispatch Without Content Mutation

Implemented after Patch 9F-3H:

- Added `POST /api/daily-content-plans/draft-generation-llm-dispatch-execution`.
- Added a `/settings/blogger` UI action and summary block for dispatch execution preview.
- The route defaults to preview mode, which performs no DB write, provider call, LLM call, or `llm_call_logs` creation.
- Execute mode is gated by `BLOG_DAILY_CONTENT_DRAFT_GENERATION_LLM_ENABLED=true`, exact confirmation phrase, idempotency key, current execution plan lock hash match, final preflight/plan lock readiness, and no prior provider/LLM call on the latest attempt.
- A successful execute may create one `llm_call_logs` row, one redacted provider response event, one hash-only response artifact, and one attempt update.
- A failed execute records only safe failed-dispatch audit metadata and a failed `llm_call_logs` row.

Policy:

- 9F-3I does not store or return raw prompt, raw provider response body/header, full generated candidate, API key, token, secret, or encrypted value.
- 9F-3I does not mutate `content_items.draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- 9F-3I does not write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Recommended next patch: `9F-3J — LLM dispatch result readback and no-content-mutation verification`.

## Patch 9F-3H LLM Dispatch Execution Plan Lock

Implemented after Patch 9F-3G:

- Added `POST /api/daily-content-plans/draft-generation-llm-dispatch-execution-plan-lock`.
- Added a `/settings/blogger` UI action and summary block for execution plan lock candidate readback.
- The route computes a deterministic lock envelope/hash from final preflight readiness.
- It keeps lock persistence disabled in this patch and does not create new audit rows.

Policy:

- 9F-3H does not call provider health-check, completion/chat/generate/responses endpoints, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Audit counts remain attempts/events/artifacts `1 / 1 / 1`.
- Recommended next patch: `9F-3I — Gated single LLM dispatch, no content mutation`.

## Patch 9F-3G LLM Dispatch Final Preflight

Implemented after Patch 9F-3F:

- Added `POST /api/daily-content-plans/draft-generation-llm-dispatch-final-preflight`.
- Added a `/settings/blogger` UI action and summary block for final LLM dispatch preflight.
- The preflight aggregates attempt/event/artifact audit readiness, prompt quality, request envelope, provider readiness, health-check readback, confirmation policy, and idempotency policy.
- It keeps `dispatchExecutionAllowedInThisPatch=false` and does not create a plan lock.

Policy:

- 9F-3G does not call provider health-check, completion/chat/generate/responses endpoints, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Audit counts remain attempts/events/artifacts `1 / 1 / 1`.
- Recommended next patch: `9F-3H — LLM dispatch execution plan lock`.

## Patch 9F-3F Provider Health-Check Readback

Implemented after Patch 9F-3E:

- Added `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-readback`.
- Added a `/settings/blogger` UI action and readback block for provider health-check audit/readback.
- The readback checks the latest dispatch attempt health-check reference/hash fields and current gate shape without running another provider network call.
- It explicitly reports that the 9F-3E positive health-check run was transient and did not persist raw provider response body/header data.

Policy:

- 9F-3F does not create audit event/artifact rows.
- 9F-3F does not call provider health-check, completion/chat/generate/responses endpoints, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Audit counts remain attempts/events/artifacts `1 / 1 / 1`.
- Recommended next patch: `9F-3G — LLM dispatch final preflight`.

## Patch 9F-3E Provider Health-Check Positive Gated Run

Implemented after Patch 9F-3D:

- Reused existing route `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-execution`.
- Added support for the worklist feature flag alias `BLOG_DAILY_CONTENT_LLM_PROVIDER_HEALTHCHECK_EXECUTE_ENABLED`.
- The existing execution gate still requires provider network calls to be enabled, exact confirmation phrase, idempotency key, resolved provider route, provider config, model candidate, required env, and supported health-check endpoint.
- The allowed side effect is one provider metadata/connectivity health-check network call only.

Policy:

- 9F-3E does not call completion/chat/generate/responses endpoints.
- 9F-3E does not create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Audit counts remain attempts/events/artifacts `1 / 1 / 1`.
- Recommended next patch: `9F-3F — Provider health-check audit/readback`.

## Patch 9F-3D Gated LLM Dispatch Audit Artifact Persistence

Implemented after Patch 9F-3C:

- Added helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-artifact-creation.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-artifact-creation`.
- Added `/settings/blogger` `초안 생성 LLM dispatch artifact 생성 preview` UI readback.
- Apply mode can create exactly one `blog_daily_content_llm_dispatch_artifacts` row for the existing attempt when the feature flag, exact confirmation phrase, idempotency key, candidate artifact, and duplicate-artifact gate pass.
- The artifact uses `artifactKind=prompt_request_hash_bundle`, `artifactStorageMode=hash_only`, and `artifactRedactionStatus=redacted_or_hash_only`.

Policy:

- 9F-3D does not call providers, run provider health checks, call LLMs, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Positive local smoke is expected to move audit counts from `1 / 1 / 0` to `1 / 1 / 1`.
- Recommended next patch: `9F-3E — Provider health-check positive gated run`.

## Patch 9F-3C LLM Dispatch Audit Artifact Preview

Implemented after Patch 9F-3B:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-artifact-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-artifact-preview`.
- Added `/settings/blogger` `초안 생성 LLM dispatch artifact preview` UI readback.
- The preview reads the latest target attempt/event and constructs a hash-only candidate artifact with `artifactKind=prompt_request_hash_bundle`.
- The candidate artifact uses `artifactStorageMode=hash_only`, `artifactRedactionStatus=redacted_or_hash_only`, and safe prompt/request-envelope hash metadata only.

Policy:

- 9F-3C does not insert artifact rows.
- 9F-3C does not call providers, run provider health checks, call LLMs, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Audit row counts remain attempts/events/artifacts `1 / 1 / 0`.
- Recommended next patch: `9F-3D — Gated LLM dispatch audit artifact persistence, no provider call/no content mutation`.

## Patch 9F-3B Gated LLM Dispatch Attempt Event Creation Persistence

Implemented after Patch 9F-3A:

- Added helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-event-creation.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-event-creation`.
- Added `/settings/blogger` `초안 생성 LLM dispatch attempt event 생성 preview` UI readback.
- Apply mode can create exactly one `blog_daily_content_llm_dispatch_events` row for the existing attempt when the feature flag, exact confirmation phrase, idempotency key, candidate event, and duplicate-event gate pass.
- The event uses `eventType=dispatch_attempt_created` and `eventStatus=recorded_audit_only`.
- Duplicate apply returns the existing event without inserting another row.

Policy:

- 9F-3B does not create audit artifact rows.
- 9F-3B does not call providers, run provider health checks, call LLMs, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Positive local smoke is expected to move audit counts from `1 / 0 / 0` to `1 / 1 / 0`.
- Recommended next patch: `9F-3C — LLM dispatch audit artifact preview, no provider call/no content mutation`.

## Patch 9F-3A LLM Dispatch Attempt Event Creation Preview

Implemented after Patch 9F-2Z:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-event-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-event-preview`.
- Added `/settings/blogger` `초안 생성 LLM dispatch attempt event preview` UI readback.
- The preview reads the latest target dispatch attempt and constructs an in-memory candidate event with `eventType=dispatch_attempt_created` and `eventStatus=recorded_audit_only`.
- The candidate event includes safe hash/redaction metadata only and keeps raw secret/token storage false.

Policy:

- 9F-3A does not insert audit event rows or artifact rows.
- 9F-3A does not call providers, run provider health checks, call LLMs, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, or refresh tokens.
- Audit row counts remain attempts/events/artifacts `1 / 0 / 0`.
- Recommended next patch: `9F-3B — Gated LLM dispatch attempt event creation persistence, no provider call/no content mutation`.

## Patch 9F-2Z Gated LLM Dispatch Attempt Creation Persistence

Implemented after Patch 9F-2Y:

- Added helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-creation.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-creation`.
- Added `/settings/blogger` `초안 생성 LLM dispatch attempt 생성 preview` UI readback.
- The route supports `mode=preview` and guarded `mode=apply`.
- Preview mode performs DB reads only and never creates an attempt row.
- Apply mode can create at most one `blog_daily_content_llm_dispatch_attempts` row when `BLOG_DAILY_CONTENT_LLM_DISPATCH_ATTEMPT_CREATE_ENABLED=true`, the exact confirmation phrase is supplied, an idempotency key is supplied, the fixture remains planned/empty/unpublished/unscheduled, operator approval is satisfied, and no active target attempt exists.
- Duplicate apply with the same idempotency key hash returns the existing attempt instead of inserting another row.
- The persisted attempt uses `attemptPurpose=draft_generation_execution` and `attemptStatus=created_pending_dispatch_gate`.
- The persisted attempt stores hash-only idempotency and confirmation metadata, prompt/request-envelope hashes, safe provider/model metadata, and all provider/LLM/content/Blogger side-effect booleans as false.

Policy:

- 9F-2Z does not create dispatch events or artifacts.
- 9F-2Z does not store raw idempotency keys, raw confirmation phrases, raw prompts, raw request bodies, raw response bodies, full generated candidates, secret values, token values, or raw env values.
- 9F-2Z does not call providers, run provider health checks, call LLMs, create `llm_call_logs`, mutate `content_items`, create `draftMarkdown`/`draftHtml`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- The positive local apply smoke is expected to increase `blog_daily_content_llm_dispatch_attempts` from `0` to `1` only; events/artifacts remain `0 / 0`.
- Recommended next patch: `9F-3A — LLM dispatch attempt event creation preview, no provider call/no content mutation`.

## Patch 9F-2Y LLM Dispatch Attempt Creation Gate Preview

Implemented after Patch 9F-2X:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-creation-gate-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-creation-gate-preview`.
- Added `/settings/blogger` `초안 생성 LLM dispatch attempt 생성 gate preview` UI readback.
- The gate preview reports `patchVersion=9F-2Y`, `previewMode=read_only_draft_generation_llm_dispatch_attempt_creation_gate_preview`, `gatePreviewOnly=true`, `attemptCreationGateEvaluated=true`, `canCreateAttemptNow=false`, `attemptCreationAllowedInThisPatch=false`, `targetScopedExistingAttempts=0`, `latestTargetAttempt=null`, and safe future attempt field planning.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_attempt_creation_gate_preview_is_preview_only`.

Policy:

- 9F-2Y did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, 9F-2K approval apply, or 9F-2W migration apply.
- 9F-2Y did not create audit attempt rows, create audit event rows, create audit artifact rows, store request envelopes, store prompts, run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Audit table row counts remain `0 / 0 / 0`.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2Z — Gated LLM dispatch attempt creation persistence, no provider call/no content mutation`.

## Patch 9F-2X LLM Dispatch Attempt Readback

Implemented after Patch 9F-2W-APPLY:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-attempt-readback.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-attempt-readback`.
- Added `/settings/blogger` `초안 생성 LLM dispatch attempt readback` UI readback.
- The readback reports `patchVersion=9F-2X`, `previewMode=read_only_draft_generation_llm_dispatch_attempt_readback`, `readbackOnly=true`, `dryRunOnly=true`, `auditTablesExist=true`, empty global and target-scoped attempt/event/artifact counts, `emptyState=true`, `latestTargetAttempt=null`, `canCreateAttemptNow=false`, and `canDispatchNow=false`.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_attempt_readback_is_preview_only`.

Policy:

- 9F-2X did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, 9F-2K approval apply, or 9F-2W migration apply.
- 9F-2X did not create audit attempt rows, create audit event rows, create audit artifact rows, store request envelopes, store prompts, run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Audit table row counts remain `0 / 0 / 0`.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2Y — LLM dispatch attempt creation gate preview, no rows/no provider call/no content mutation`.

## Patch 9F-2W-APPLY LLM Dispatch Audit Migration Apply

Implemented after Patch 9F-2W:

- Applied Prisma migration `20260620000300_add_llm_dispatch_audit_schema` with `npx prisma migrate deploy`.
- Created DB tables `blog_daily_content_llm_dispatch_attempts`, `blog_daily_content_llm_dispatch_events`, and `blog_daily_content_llm_dispatch_artifacts`.
- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-audit-migration-apply-readback.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-migration-apply-readback`.
- Added `/settings/blogger` `초안 생성 LLM dispatch audit migration 적용 상태` UI readback.
- The readback reports `patchVersion=9F-2W-APPLY`, `previewMode=read_only_llm_dispatch_audit_migration_apply_readback`, `migrationApplyOnly=true`, `migrationApplied=true`, `schemaTablesCreated=true`, `rowsCreatedByMigration=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, and `contentMutationAttempted=false`.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_audit_migration_apply_readback_is_preview_only`.

Policy:

- 9F-2W-APPLY did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2W-APPLY did not create audit table rows, store request envelopes, store prompts, run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Audit table row counts remain `0 / 0 / 0`.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2X — LLM dispatch attempt readback scaffold, no provider call/no content mutation`.

## Patch 9F-2W LLM Dispatch Audit Schema Scaffold

Implemented after Patch 9F-2V:

- Added Prisma models `BlogDailyContentLlmDispatchAttempt`, `BlogDailyContentLlmDispatchEvent`, and `BlogDailyContentLlmDispatchArtifact`.
- Added migration scaffold `prisma/migrations/20260620000300_add_llm_dispatch_audit_schema/migration.sql`.
- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-audit-schema-scaffold-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-schema-scaffold-preview`.
- Added `/settings/blogger` `초안 생성 LLM dispatch audit schema scaffold` UI readback.
- The scaffold includes future attempt/event/artifact tables, foreign keys, indexes, idempotency unique constraint, safe redaction defaults, and append-only event/artifact metadata shapes.
- The response reports `patchVersion=9F-2W`, `previewMode=read_only_draft_generation_llm_dispatch_audit_schema_scaffold_preview`, `scaffoldOnly=true`, `schemaModified=true`, `migrationCreated=true`, `migrationApplied=false`, `dbWrite=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, and `contentMutationAttempted=false`.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_audit_schema_scaffold_preview_is_preview_only`.

Policy:

- 9F-2W did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2W did not apply the new migration, create audit tables in the DB, create rows, store request envelopes, store prompts, run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2W-APPLY — Apply LLM dispatch audit migration only, no rows/no provider call/no content mutation`.

## Patch 9F-2V Draft-generation LLM Dispatch Audit Schema Design

Implemented after Patch 9F-2U:

- Added design-only helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-audit-schema-design.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-audit-schema-design`.
- Added `/settings/blogger` `초안 생성 LLM dispatch audit schema design` UI readback.
- Added `documents/17_LLM_DISPATCH_AUDIT_SCHEMA_DESIGN.md`.
- The design proposes future `blog_daily_content_llm_dispatch_attempts`, `blog_daily_content_llm_dispatch_events`, and optional `blog_daily_content_llm_dispatch_artifacts` tables.
- The design covers proposed fields, indexes, foreign keys, unique constraints, idempotency semantics, redaction policy, retention policy, and future migration sequencing.
- The response reports `patchVersion=9F-2V`, `previewMode=read_only_draft_generation_llm_dispatch_audit_schema_design`, `designOnly=true`, `schemaModified=false`, `migrationCreated=false`, `migrationApplied=false`, `dbWrite=false`, `providerNetworkCallAttempted=false`, `llmCallAttempted=false`, and `contentMutationAttempted=false`.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_audit_schema_design_is_preview_only`.

Policy:

- 9F-2V did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2V did not modify `prisma/schema.prisma`, create a migration, apply a migration, create dispatch attempt rows, create event rows, store request envelopes, store prompts, run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2W — LLM dispatch audit schema scaffold, no apply/no provider call/no content mutation`.

## Patch 9F-2U Draft-generation LLM Dispatch Gate Preview

Implemented after Patch 9F-2T:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-dispatch-gate-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-dispatch-gate-preview`.
- Added `/settings/blogger` `초안 생성 LLM dispatch gate preview` UI readback.
- The preview reuses the 9F-2T request envelope preview and evaluates target, approval, prompt, request envelope, provider route, provider health, final execution checklist, feature flag, confirmation, idempotency, and side-effect policy gates.
- The response reports `patchVersion=9F-2U`, `previewMode=read_only_draft_generation_llm_dispatch_gate_preview`, `dryRunOnly=true`, `dispatchGateEvaluatedForPreview=true`, `dispatchAllowedNow=false`, `dispatchWouldBeBlocked=true`, `requestEnvelopeStored=false`, `requestWouldBeSent=false`, `requestSentToProvider=false`, `llmCallAttempted=false`, `providerNetworkCallAttempted=false`, `providerHealthCheckAttempted=false`, and `contentMutationAttempted=false`.
- Provider health check, confirmation phrase, idempotency key, and draft-generation feature flags remain blockers for any future dispatch execution.
- Non-preview modes are blocked with `draft_generation_llm_dispatch_gate_preview_is_preview_only`.

Policy:

- 9F-2U did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2U did not create, update, or delete business rows.
- 9F-2U did not modify `prisma/schema.prisma` or create a migration.
- 9F-2U did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, OAuth tokens, provider request values, response bodies, or raw provider responses.
- 9F-2U did not run LLM evaluator/judge calls, provider health checks, provider network calls, LLM provider calls, request dispatch, request storage, prompt storage, `llm_call_logs` creation, draft generation, `content_items` mutation, Blogger write, publish, schedule, OAuth reconnect, token refresh, publish approval mutation, or publish attempt mutation.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2V — Draft-generation LLM dispatch audit schema design, no migration/no provider call/no content mutation`.

## Patch 9F-2T Draft-generation LLM Request Envelope Preview

Implemented after Patch 9F-2S:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-request-envelope-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-request-envelope-preview`.
- Added `/settings/blogger` `초안 생성 LLM request envelope preview` UI readback.
- The preview reuses the 9F-2R prompt render preview, 9F-2S prompt quality checklist, and 9F-2N provider readiness metadata.
- The response reports `patchVersion=9F-2T`, `previewMode=read_only_draft_generation_llm_request_envelope_preview`, `dryRunOnly=true`, `requestEnvelopeBuiltForPreview=true`, `requestEnvelopeStored=false`, `requestWouldBeSent=false`, `llmCallAttempted=false`, `providerNetworkCallAttempted=false`, `providerHealthCheckAttempted=false`, and `contentMutationAttempted=false`.
- The envelope preview exposes only safe route/provider/model metadata, endpoint category, header names with values hidden, payload shape, prompt hash/length/token estimate, model parameters, dispatch blockers, and no-side-effect flags.
- Non-preview modes are blocked with `draft_generation_llm_request_envelope_preview_is_preview_only`.

Policy:

- 9F-2T did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2T did not create, update, or delete business rows.
- 9F-2T did not modify `prisma/schema.prisma` or create a migration.
- 9F-2T did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, OAuth tokens, provider request values, response bodies, or raw provider responses.
- 9F-2T did not run LLM evaluator/judge calls, provider health checks, provider network calls, LLM provider calls, request storage, prompt storage, `llm_call_logs` creation, draft generation, `content_items` mutation, Blogger write, publish, schedule, OAuth reconnect, token refresh, publish approval mutation, or publish attempt mutation.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2U — Draft-generation LLM dispatch gate preview, no provider call/no content mutation`.

## Patch 9F-2S Draft-generation Prompt Quality Checklist Preview

Implemented after Patch 9F-2R:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-prompt-quality-checklist-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-prompt-quality-checklist-preview`.
- Added `/settings/blogger` `초안 생성 prompt 품질 체크리스트` UI readback.
- The checklist reuses the 9F-2R prompt render preview in memory and evaluates it with deterministic static rules only.
- The preview reports `patchVersion=9F-2S`, `previewMode=read_only_draft_generation_prompt_quality_checklist_preview`, `dryRunOnly=true`, `promptRenderedForChecklist=true`, `promptStored=false`, `promptSentToLlm=false`, `llmCallAttempted=false`, `providerNetworkCallAttempted=false`, `providerHealthCheckAttempted=false`, and `contentMutationAttempted=false`.
- Quality categories cover target context, required prompt sections, safety and policy, SEO structure, reader value, output contract, redaction/secret safety, length/token budget, and execution safety.
- Non-preview modes are blocked with `draft_generation_prompt_quality_checklist_preview_is_preview_only`.

Policy:

- 9F-2S did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2S did not create, update, or delete business rows.
- 9F-2S did not modify `prisma/schema.prisma` or create a migration.
- 9F-2S did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, OAuth tokens, provider request bodies, response bodies, or raw provider responses.
- 9F-2S did not run LLM evaluator/judge calls, provider health checks, provider network calls, LLM provider calls, prompt storage, `llm_call_logs` creation, draft generation, `content_items` mutation, Blogger write, publish, schedule, OAuth reconnect, token refresh, publish approval mutation, or publish attempt mutation.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2T — Draft-generation LLM request envelope preview, no provider call/no content mutation`.

## Patch 9F-2R Draft-generation Prompt Render Preview

Implemented after Patch 9F-2Q:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-prompt-render-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-prompt-render-preview`.
- Added `/settings/blogger` `초안 생성 prompt preview` UI readback.
- The preview renders deterministic, bounded prompt sections for the linked daily content fixture so an operator can inspect the future LLM instruction before any execution patch.
- The preview reports `patchVersion=9F-2R`, `previewMode=read_only_draft_generation_prompt_render_preview`, `dryRunOnly=true`, `promptRenderedForPreview=true`, `promptStored=false`, `llmCallAttempted=false`, `providerNetworkCallAttempted=false`, `providerHealthCheckAttempted=false`, and `contentMutationAttempted=false`.
- The prompt preview exposes safe section text, char length, estimated token count, SHA-256 hash, redaction summary, and a truncated full prompt preview.
- Non-preview modes are blocked with `draft_generation_prompt_render_preview_is_preview_only`.

Policy:

- 9F-2R did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2R did not create, update, or delete business rows.
- 9F-2R did not modify `prisma/schema.prisma` or create a migration.
- 9F-2R did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, OAuth tokens, provider request bodies, response bodies, or raw provider responses.
- 9F-2R did not run provider health checks, make provider network calls, call LLM providers, store prompts, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2S — Draft-generation prompt quality checklist preview, no LLM/no content mutation`.

## Patch 9F-2Q Draft-generation Final Execution Checklist

Implemented after Patch 9F-2P:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-final-execution-checklist.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-final-execution-checklist`.
- Added `/settings/blogger` `초안 생성 최종 실행 체크리스트` UI readback.
- The checklist aggregates the daily plan/fixture state, persisted operator approval, 9F-2M dry-run planner, 9F-2N LLM readiness, 9F-2O health-check preview, 9F-2P health-check execution gate, remaining blockers, and operator runbook.
- The preview keeps `executionAllowed=false`, `finalDraftGenerationAllowed=false`, `llmCompletionAttempted=false`, `promptRendered=false`, `providerNetworkCallAttempted=false`, `contentMutationAttempted=false`, and `bloggerWriteAttempted=false`.
- Non-preview modes are blocked with `draft_generation_final_execution_checklist_is_preview_only`.

Policy:

- 9F-2Q did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2Q did not create, update, or delete business rows.
- 9F-2Q did not modify `prisma/schema.prisma` or create a migration.
- 9F-2Q did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, provider request bodies, prompt text, response bodies, or raw provider responses.
- 9F-2Q did not run provider health checks, make provider network calls, call LLM providers, render/store prompts, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2R — Draft-generation prompt render preview, no LLM/no content mutation`.

## Patch 9F-2P Gated LLM Provider Health-check Execution

Implemented after Patch 9F-2O:

- Added helper `src/lib/daily-content-plans/draft-generation-llm-provider-health-check-execution.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-execution`.
- Added `/settings/blogger` `초안 생성 LLM health-check 실행 게이트` UI readback.
- The route reuses the 9F-2O preview/readiness path and adds a gated provider health-check execution policy.
- Default `preview` and blocked `healthcheck_execute` smoke keep `healthCheckExecuted=false`, `providerNetworkCallAttempted=false`, `llmCompletionAttempted=false`, `promptRendered=false`, `promptStored=false`, and all mutation side effects false.
- Future positive execution requires `BLOG_DAILY_CONTENT_LLM_PROVIDER_HEALTHCHECK_EXECUTION_ENABLED=true`, `BLOG_DAILY_CONTENT_LLM_PROVIDER_NETWORK_CALLS_ENABLED=true`, the exact confirmation phrase, and an idempotency key.
- Completion/chat/generate/responses endpoints remain forbidden; only safe provider metadata/version/tags/models/health endpoint categories may be used by a future explicitly approved health-check.
- Unsupported modes are blocked with `draft_generation_llm_provider_health_check_execution_mode_not_allowed`.

Policy:

- 9F-2P did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2P did not create, update, or delete business rows during default validation.
- 9F-2P did not modify `prisma/schema.prisma` or create a migration.
- 9F-2P did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, provider request bodies, prompt text, response bodies, or raw provider responses.
- 9F-2P default validation did not run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2Q — Draft-generation final execution checklist and operator runbook, no LLM completion/no content mutation`.
- Alternative next patch after explicit approval: `9F-2P-LIVE-VERIFY — Execute one gated provider health-check only, no completion/no content mutation`.

## Patch 9F-2O LLM Provider Health-check Preview

Implemented after Patch 9F-2N:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-provider-health-check-preview.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-provider-health-check-preview`.
- Added `/settings/blogger` `초안 생성 LLM health-check preview` UI readback.
- The preview reuses the 9F-2N provider/model readiness response and shows the future provider health-check contract without executing it.
- The preview reports `healthCheckPreviewMode=read_only_llm_provider_health_check_preview`, `dryRunOnly=true`, `providerHealthCheckAttempted=false`, `providerNetworkCallAttempted=false`, `llmCompletionAttempted=false`, `promptRendered=false`, and `rawPromptStored=false`.
- `mode=healthcheck_preview` remains gated/blocked with health-check feature flag, confirmation phrase, idempotency, completion-disabled, and content-mutation-disabled blockers.
- Unsupported modes are blocked with `draft_generation_llm_provider_health_check_preview_is_preview_only`.

Policy:

- 9F-2O did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2O did not create, update, or delete business rows.
- 9F-2O did not modify `prisma/schema.prisma` or create a migration.
- 9F-2O did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, provider request bodies, prompt text, or raw provider responses.
- 9F-2O did not run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2P — Gated LLM provider health-check execution, no completion/no content mutation`.
- Alternative next patch: `9F-2Q — Draft-generation execution readiness checklist polish, no call/no mutation`.

## Patch 9F-2N LLM Provider Execution Readiness Preview

Implemented after Patch 9F-2M:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-llm-provider-readiness.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-llm-provider-readiness`.
- Added `/settings/blogger` `초안 생성 LLM 준비상태` UI readback.
- The readiness preview reads the existing `content_draft` Task Route plus safe provider/model metadata and env presence booleans.
- The preview keeps `operatorApprovalSatisfied=true`, `executionAllowed=false`, and the existing five execution blockers.
- The preview reports route resolution, provider kind/enabled state, model candidate status, missing env names, readiness blockers/warnings, and side-effect summary.
- Non-preview modes are blocked with `draft_generation_llm_provider_readiness_is_preview_only`.

Policy:

- 9F-2N did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2N did not create, update, or delete business rows.
- 9F-2N did not modify `prisma/schema.prisma` or create a migration.
- 9F-2N did not expose env values, raw secret values, encrypted values, API keys, bearer tokens, provider request bodies, or raw provider responses.
- 9F-2N did not run provider health checks, make provider network calls, call LLM providers, create `llm_call_logs`, generate drafts, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2O — LLM provider health-check preview for draft generation, no LLM completion/no content mutation`.
- Alternative next patch: `9F-2P — Draft-generation execution readiness checklist polish, no call/no mutation`.

## Patch 9F-2M Draft-generation Dry-run Planner

Implemented after Patch 9F-2L:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-dry-run-planner.ts`.
- Added route `POST /api/daily-content-plans/draft-generation-dry-run-planner`.
- Added `/settings/blogger` `초안 생성 dry-run 계획` UI readback.
- The planner reuses the post-approval execution gate state and shows persisted operator approval, linked fixture status, remaining execution blockers, input snapshot plan, prompt structure plan, model candidate plan, future output plan, and current no-side-effect summary.
- Preview for plan item `cmqlr1v1y0001iwj2gpv2875r` shows `operatorApprovalSatisfied=true`, `executionAllowed=false`, resolved blocker `operator_approval_missing`, and remaining blockers for LLM execution, content mutation, draft generation write, confirmation phrase, and idempotency.
- Non-preview modes are blocked with `draft_generation_dry_run_planner_is_preview_only`.

Policy:

- 9F-2M did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2M did not create, update, or delete business rows.
- 9F-2M did not modify `prisma/schema.prisma` or create a migration.
- 9F-2M did not render/store raw prompts, generate drafts, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`, and `llm_call_logs` remains `22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- Recommended next patch: `9F-2N — LLM provider execution readiness check for draft generation, no call/no mutation`.
- Alternative next patch: `9F-2O — Draft-generation dry-run planner UI polish, no LLM/no mutation`.

## Patch 9F-2L Draft-generation Execution Gate Post-approval Preview Polish

Implemented after Patch 9F-2K-APPLY:

- Polished the read-only draft-generation execution gate preview after operator approval persistence.
- Added explicit post-approval summary fields showing `operatorApprovalPersisted=true`, the approval id/status/purpose/action, and `operatorApprovalSatisfied=true`.
- Added execution blocker summary fields that separate resolved blockers from remaining blockers.
- Confirmed `operator_approval_missing` is resolved, while execution remains blocked by `llm_execution_feature_flag_disabled`, `content_mutation_feature_flag_disabled`, `draft_generation_write_feature_flag_disabled`, `confirmation_phrase_missing`, and `idempotency_key_missing`.
- Added a next-safe-step summary pointing to `9F-2M — Draft-generation dry-run planner, no LLM/no content mutation`.
- Polished `/settings/blogger` so the operator sees `운영자 승인 저장됨 · 실행 차단 유지`, approval id/status, remaining Korean blocker labels, resolved blocker labels, and no-side-effect details.
- Polished operator approval preview/readback so it clearly says approval is stored but draft-generation execution is still blocked.

Policy:

- 9F-2L did not rerun 9F-2B apply, 9F-2D apply, 9F-2I-APPLY, or 9F-2K approval apply.
- 9F-2L did not create, update, or delete business rows.
- 9F-2L did not modify `prisma/schema.prisma` or create a migration.
- 9F-2L did not create `draftMarkdown` or `draftHtml`, run content generation, call LLM providers, create `llm_call_logs`, mutate `content_items`, write to Blogger, publish, schedule, reconnect OAuth, refresh tokens, mutate publish approvals, or mutate publish attempts.
- Daily plan rows remain `1`, daily plan item rows remain `3`, `content_items` count remains `2`, and operator approvals/events remain `1 / 1`.
- Publish milestone counts remain `1 / 1 / 1 / 1 / 22`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2M — Draft-generation dry-run planner, no LLM/no content mutation`.
- Alternative next patch: `9F-2N — LLM provider execution readiness check for draft generation, no call/no mutation`.

## Patch 9F-2K-APPLY Persist Operator Approval For Draft Generation Gate

Applied after Patch 9F-2K:

- Executed the approved 9F-2K apply exactly once after the operator provided the Korean approval phrase.
- Created one operator approval row: `cmqmcs1l10001iwu863doda1s`.
- Created one operator approval event row: `cmqmcs1lg0003iwu8ff4780ll`.
- Approval target: plan item `cmqlr1v1y0001iwj2gpv2875r`, content item `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- Approval state: `approvalPurpose=draft_generation_execution`, `approvalStatus=approved`, `operatorAction=approve_for_draft_generation_execution`, `operatorLabel=초안 생성 실행 승인`.
- Confirmed `operator_approvals_count=1` and `operator_approval_events_count=1`.
- Confirmed post-apply preview reports `existingApprovalFound=true`, `approvalWouldBeCreated=false`, `eventWouldBeCreated=false`, and `dbWrite=false`.
- Confirmed 9F-2J execution gate preview now reports `operatorApprovalSatisfied=true`, removes `operator_approval_missing`, and keeps `executionAllowed=false` because LLM/content mutation/write/confirmation/idempotency gates remain blocked.

Policy:

- 9F-2K-APPLY did not rerun 9F-2B apply, 9F-2D apply, or 9F-2I-APPLY.
- 9F-2K-APPLY did not modify `prisma/schema.prisma` or create a migration.
- 9F-2K-APPLY did not mutate Daily Content Plan rows/items, `content_items`, Blogger tables, operation profiles, publish approvals, publish attempts, or LLM logs.
- 9F-2K-APPLY did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The linked fixture remains `planned` with empty `draftMarkdown` and `draftHtml`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2L — Draft-generation execution gate post-approval preview polish, no LLM/no mutation`.
- Alternative next patch: `9F-2M — Draft-generation dry-run planner, no LLM/no content mutation`.

## Patch 9F-2K Operator Approval Persistence Route

Implemented after Patch 9F-2I-APPLY:

- Added guarded helper `src/lib/daily-content-plans/operator-approval-persistence.ts`.
- Added route `POST /api/daily-content-plans/operator-approvals`.
- Added `/settings/blogger` `운영자 승인 저장` preview/readback UI.
- Updated the 9F-2J execution gate preview to read persisted approval state when the approval tables exist.
- Preview mode reports target integrity, existing approval/event state, whether approval/event would be created, guardrails, and side-effect summary.
- Apply mode is implemented but blocked unless `BLOG_DAILY_CONTENT_OPERATOR_APPROVAL_WRITE_ENABLED=true`, exact confirmation phrase `I_UNDERSTAND_THIS_WILL_PERSIST_OPERATOR_APPROVAL_ONLY`, and expected idempotency key are present.

Initial pending apply state:

- The required Korean approval phrase was not provided in this patch.
- Approved apply was not executed.
- `operator_approvals_count=0`.
- `operator_approval_events_count=0`.
- 9F-2J execution gate preview still reports `operatorApprovalSatisfied=false` and blocker `operator_approval_missing`.

Policy:

- 9F-2K did not modify `prisma/schema.prisma`.
- 9F-2K did not create a Prisma migration.
- 9F-2K did not rerun 9F-2B apply, 9F-2D apply, or 9F-2I-APPLY.
- 9F-2K did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- 9F-2K did not mutate Daily Content Plan rows/items, `content_items`, Blogger tables, operation profiles, publish approvals, publish attempts, or LLM logs.
- Recommended next patch: `9F-2K-APPLY — Persist one operator approval row/event, no generation/no LLM/no content mutation`.
- Alternative next patch: `9F-2K-UI — Operator approval preview UI polish, no mutation`.

## Patch 9F-2I-APPLY Operator Approval Persistence Migration Apply

Implemented after Patch 9F-2J:

- Applied existing migration `20260620000200_add_daily_content_operator_approval_scaffold` exactly once with `prisma migrate deploy`.
- Created DB tables `blog_daily_content_operator_approvals` and `blog_daily_content_operator_approval_events` with indexes and foreign keys from the existing migration draft.
- Confirmed `operator_approvals_count=0` and `operator_approval_events_count=0`.
- Confirmed `npx prisma migrate status` reports the database schema is up to date.
- Confirmed 9F-2J preview now reports approval persistence available while execution remains blocked by missing operator approval and disabled LLM/content mutation/write gates.

Policy:

- 9F-2I-APPLY did not modify `prisma/schema.prisma`.
- 9F-2I-APPLY did not create a new Prisma migration.
- 9F-2I-APPLY did not create, update, or delete business rows.
- 9F-2I-APPLY did not create approval rows or events.
- 9F-2I-APPLY did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2K — Operator approval persistence preview/apply route, approval row only, no generation/no LLM/no content mutation`.
- Alternative next patch: `9F-2K-DESIGN — Operator approval apply guard implementation plan, no code/no mutation`.

## Patch 9F-2J Draft-generation Execution Gate Preview API

Implemented after Patch 9F-2I:

- Added read-only helper `src/lib/daily-content-plans/draft-generation-execution-gate-preview.ts`.
- Added preview-only route `POST /api/daily-content-plans/draft-generation-execution-gate-preview`.
- Added `/settings/blogger` `초안 생성 실행 게이트` UI readback with execution blocked status, structural readiness, approval table migration state, missing requirements, disabled execution buttons, gate layers, canonical blockers, and side-effect summary.
- The preview safely checks pending operator approval table availability with `to_regclass` and does not query the pending approval Prisma models.
- Current preview blocks execution because the 9F-2I migration is pending/unapplied, operator approval is missing, LLM execution flag is disabled, content mutation flag is disabled, draft generation write flag is disabled, confirmation phrase is missing, and idempotency key is missing.

Policy:

- 9F-2J did not modify `prisma/schema.prisma`.
- 9F-2J did not create a Prisma migration.
- 9F-2J did not apply the pending 9F-2I migration.
- Operator approval tables do not exist in the DB yet.
- 9F-2J did not create, update, or delete business rows.
- 9F-2J did not create approval rows or events.
- 9F-2J did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2I-APPLY — Apply operator approval persistence migration, approval tables only, no approval rows`.
- Alternative next patch: `9F-2K — Draft-generation execution gate preview UI polish, no LLM/no mutation`.

## Patch 9F-2I Operator Approval Persistence Scaffold Migration Draft

Implemented after Patch 9F-2H:

- Added Prisma models `BlogDailyContentOperatorApproval` and `BlogDailyContentOperatorApprovalEvent`.
- Added relation arrays from `ContentItem`, `BlogDailyContentPlan`, and `BlogDailyContentPlanItem` to the operator approval scaffold.
- Added one unapplied migration draft at `prisma/migrations/20260620000200_add_daily_content_operator_approval_scaffold/migration.sql`.
- The migration draft creates `blog_daily_content_operator_approvals` and `blog_daily_content_operator_approval_events`, idempotency unique indexes, supporting lookup indexes, and foreign keys.
- Updated Data Model, Operator Approval Persistence Design, Test Plan, LLM Provider Design, Changelog, and Next Session Brief to record the scaffold/no-apply state.

Policy:

- 9F-2I did not apply the migration.
- Operator approval tables do not exist in the DB yet.
- 9F-2I did not create, update, or delete business rows.
- 9F-2I did not create approval rows or events.
- 9F-2I did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2J — Draft-generation execution gate preview API, no LLM/no mutation`.
- Alternative next patch: `9F-2I-APPLY — Apply operator approval persistence migration, approval tables only, no approval rows`.

## Patch 9F-2H Draft-generation Execution Gate Design

Implemented after Patch 9F-2G:

- Added design document `documents/16_DRAFT_GENERATION_EXECUTION_GATE_DESIGN.md`.
- Defined future draft-generation execution gate layers 0 through 8: target integrity, daily plan item link, draft-generation readiness preflight, operator approval persistence, LLM provider/model, content mutation write flags, confirmation/idempotency, post-write readback/reconciliation, and publish isolation.
- Documented future pass conditions, canonical block reasons, feature flags, confirmation phrases, API candidates, run/audit model, idempotency/replay policy, UI proposal, smoke plan, rollback/manual recovery, relationship to operator approval persistence, and open questions.
- Updated Test Plan, LLM Provider Design, Changelog, Next Session Brief, and Operator Approval Persistence Design to point at the proposal.

Policy:

- 9F-2H did not modify `prisma/schema.prisma`.
- 9F-2H did not create a Prisma migration.
- 9F-2H did not create, update, or delete business rows.
- 9F-2H did not persist operator approvals, execution runs, or generation attempts.
- 9F-2H did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2I — Operator approval persistence scaffold migration draft, no apply`.
- Alternative next patch: `9F-2J — Draft-generation execution gate preview API, no LLM/no mutation`.

## Patch 9F-2G Operator Approval Persistence Design

Implemented after Patch 9F-2F:

- Added design document `documents/15_OPERATOR_APPROVAL_PERSISTENCE_DESIGN.md`.
- Proposed future tables `blog_daily_content_operator_approvals` and `blog_daily_content_operator_approval_events`.
- Documented approval purposes, statuses, operator actions, proposed columns, foreign keys, indexes, duplicate prevention strategy, state transitions, future API routes, feature flag, confirmation phrase, smoke plan, rollback plan, and open questions.
- Updated Data Model, Test Plan, LLM Provider Design, Changelog, and Next Session Brief to point at the proposal.

Policy:

- 9F-2G did not modify `prisma/schema.prisma`.
- 9F-2G did not create a Prisma migration.
- 9F-2G did not create, update, or delete business rows.
- 9F-2G did not create approval rows or events.
- 9F-2G did not rerun 9F-2B apply or 9F-2D apply.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2H — Draft-generation execution gate design, no LLM/no content mutation`.
- Alternative next patch: `9F-2I — Operator approval persistence scaffold migration draft, no apply`.

## Patch 9F-2F Draft-generation Readiness Preflight

Implemented after Patch 9F-2E:

- Added read-only route `POST /api/daily-content-plans/draft-generation-readiness`.
- Added deterministic draft-generation readiness preflight logic for linked plan item `cmqlr1v1y0001iwj2gpv2875r`.
- The preflight checks linked fixture `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`, fixture existence, linked plan item match, non-published/non-scheduled state, empty `draftMarkdown`, empty `draftHtml`, and disabled generation/publish guardrails.
- Current fixture is structurally ready for future draft generation, but execution readiness remains false.
- Added `/settings/blogger` `초안 생성 준비 점검` UI with operator-friendly status, missing requirements, disabled generation/LLM buttons, and technical side-effect details.
- Non-preflight modes are blocked with `draft_generation_readiness_is_preflight_only`.

Policy:

- 9F-2F did not rerun 9F-2B apply.
- 9F-2F did not rerun 9F-2D apply.
- 9F-2F did not create, update, or delete Daily Content Plan rows, Daily Content Plan item rows, `content_items`, approval rows, publish attempts, or Blogger rows.
- 9F-2F did not create `draftMarkdown` or `draftHtml`.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2G — Operator approval persistence design, schema proposal only, no apply/no mutation`.
- Alternative next patch: `9F-2H — Draft-generation execution gate design, no LLM/no content mutation`.

## Patch 9F-2E Daily Content Queue Operator Approval Workflow Draft

Implemented after Patch 9F-2D:

- Added read-only route `POST /api/daily-content-plans/operator-approval-workflow`.
- Added deterministic queue workflow summary logic for the existing Daily Content Plan fixture.
- Added `/settings/blogger` `운영자 검토 워크플로우` preview UI.
- Item 1 is shown as ready for operator review when linked to fixture `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- Items 2 and 3 are shown as waiting for `content_items` fixtures.
- Approval actions are displayed as disabled/coming-soon only: draft-generation preparation approval, topic hold, and review request.
- Non-preview mode is blocked with `operator_approval_workflow_is_preview_only`.

Policy:

- 9F-2E did not rerun 9F-2B apply.
- 9F-2E did not rerun 9F-2D apply.
- 9F-2E did not create, update, or delete Daily Content Plan rows, Daily Content Plan item rows, `content_items`, approval rows, publish attempts, or Blogger rows.
- This patch did not run content generation, LLM calls, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Daily plan rows remain `1`, daily plan item rows remain `3`, and `content_items` count remains `2`.
- The 9E published/success milestone baseline remained unchanged.
- Recommended next patch: `9F-2F — Draft-generation readiness preflight for linked content item, no LLM/no Blogger write`.
- Alternative next patch: `9F-2G — Operator approval persistence design, schema proposal only, no apply/no mutation`.

## Patch 9F-2D Daily Plan To Content Item Fixture Apply

Implemented after Patch 9F-2C:

- Added guarded route `POST /api/daily-content-plans/content-item-fixture`.
- Added preview/apply summary logic for linking one Daily Content Plan item to one deterministic `content_items` fixture.
- Targeted only plan item `cmqlr1v1y0001iwj2gpv2875r` (`itemOrder=1`, `slotKey=morning_education`) for this patch.
- Added deterministic proposed fixture id `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`, with `mode=memo_expand`, `status=planned`, no generated draft Markdown, no generated HTML, no publish timestamp, and no schedule timestamp.
- Added feature flag and confirmation phrase guards: `BLOG_DAILY_PLAN_CONTENT_ITEM_FIXTURE_WRITE_ENABLED=true` plus `I_UNDERSTAND_THIS_WILL_CREATE_OR_LINK_ONE_CONTENT_ITEM_FIXTURE`.
- Added `/settings/blogger` preview-only fixture status/action affordance for Daily Content Queue rows.
- Executed the approved apply exactly once after the operator provided the Korean approval phrase.
- Created one deterministic content item fixture: `daily_fixture_cmqlr1v1y0001iwj2gpv2875r`.
- Linked only target plan item `cmqlr1v1y0001iwj2gpv2875r` to that fixture.
- Post-apply readback confirmed daily plan rows remained `1`, daily plan item rows remained `3`, and `content_items` count changed from `1` to `2`.
- Other daily plan items remain unlinked.
- After-apply preview confirmed `fixtureAlreadyLinked=true`, `fixtureWouldBeCreated=false`, and `dbWrite=false`.
- Feature-flag-disabled apply-negative remained blocked with `dbWrite=false`.

Policy:

- The only approved business mutation was one deterministic `content_items` fixture insert plus one target daily plan item `contentItemId` update.
- Preview and feature-flag-disabled apply-negative flows remain DB-write-safe after apply.
- This patch did not rerun 9F-2B apply, create/update/delete daily plan rows, mutate other daily plan items, mutate the published 9E content item, run content generation, call LLM providers, run Blogger publish/write/update/draft save/schedule, reconnect OAuth, refresh tokens, mutate publish approvals, mutate publish attempts, deploy, push, or external service writes.
- Do not rerun 9F-2D apply for item `cmqlr1v1y0001iwj2gpv2875r`; the fixture is already linked.
- Recommended next patch: `9F-2E — Daily Content Queue operator approval workflow draft, no generation/no publish execution`.
- Alternative next patch: `9F-2F — Draft-generation readiness preflight for linked content item, no LLM/no Blogger write`.

## Patch 9F-2C Daily Content Plan UI Polish And Queue Dashboard Draft

Implemented after Patch 9F-2B:

- Polished the Daily Content Plan response with additive persisted readback fields for existing plan status, persisted plan id/status, persisted item counts, existing plan summary, and persisted queue item rows.
- Kept the existing API response contract intact while making it easier for `/settings/blogger` to display the already-created 9F-2B fixture.
- Improved future guarded apply summaries so `appliedPlan` and `appliedItemCount` can be populated from transaction results, without rerunning apply in this patch.
- Reworked `/settings/blogger` Daily Content Plan UI into an operator-friendly `오늘 콘텐츠 계획` readback section with Korean status, guardrails, and a draft `후보 큐`.
- The queue shows persisted candidate rows, topic seeds, content intent, slot/status, content item linkage state, approval requirement, and disabled generation/publish/schedule flags.
- Technical details such as blockers, warnings, side-effect summary, guardrail summary, and readback ids are kept behind progressive disclosure.

Policy:

- 9F-2C did not rerun 9F-2B apply.
- 9F-2C did not create, update, or delete Daily Content Plan rows or item rows.
- Counts remained one daily plan row and three daily plan item rows.
- This patch did not run content generation, LLM calls, `content_items` mutation, Blogger publish/write/update/draft save/schedule, OAuth reconnect, token refresh, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The 9E published/success milestone baseline remained unchanged.
- The next recommended patch is `9F-2D — Daily plan to content-item draft fixture, no LLM/no Blogger write`.
- Alternative next patch: `9F-2E — Daily Content Queue operator approval workflow draft, no generation/no publish execution`.

## Patch 9F-2B Create/Apply Daily Content Plan Row

Applied after Patch 9F-2A:

- Created or idempotently confirmed the default Daily Content Plan row for the verified Blogger blog `급등포착`.
- Target Blogger blog: `3065973490356135805` / `https://mathlearningappl.blogspot.com/`.
- Created or idempotently confirmed three deterministic candidate item rows: `morning_education`, `midday_checklist`, and `evening_risk_review`.
- The guarded apply was executed once by the operator with `BLOG_DAILY_CONTENT_PLAN_WRITE_ENABLED=true` and confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_DAILY_CONTENT_PLAN`.
- DB readback confirmed `blog_daily_content_plans_count=1` and `blog_daily_content_plan_items_count=3`.
- Created plan baseline: `planId=cmqlr1v1d0000iwj2smxcsajr`, `planDateLocal=2026-06-20`, `status=draft`, `planKind=daily_auto_content_plan`, `operationMode=approval_required`, and `defaultPublishPolicyPreset=safe_manual_publish`.
- The plan keeps `contentGenerationEnabled=false`, `llmCallEnabled=false`, `publishExecutionEnabled=false`, and `scheduledPublishEnabled=false`.
- All item rows keep `contentItemId=null`, generation/publish flags false, and `requiresHumanApproval=true`.
- After-apply preview confirmed `planWouldBeCreated=false`, `planWouldBeUpdated=true`, `applyAttempted=false`, and `dbWrite=false`.
- Flag-disabled apply-negative smoke confirmed blocker `daily_content_plan_write_feature_flag_disabled`, `applyAttempted=false`, `applyBlocked=true`, `applyOk=false`, and `dbWrite=false`.
- Minor follow-up candidate: the apply API summary returned `appliedPlan=null` and `appliedItemCount=null`, while DB readback confirmed the rows.

Policy:

- This patch performed exactly one allowed business DB mutation in the daily content plan tables before this closeout documentation pass.
- This closeout did not rerun the apply.
- Generation, LLM, publishing, scheduling, Blogger write, OAuth, token, content item, publish approval, and publish attempt mutations remained disabled.
- The 9E published/success milestone baseline remained unchanged.
- The next recommended patch is `9F-2C — Daily Content Plan UI polish and queue dashboard draft`.
- Alternative next patch: `9F-2D — Daily plan to content-item draft fixture, no LLM/no Blogger write`.

## Patch 9F-2A Daily Auto Content Plan Draft Foundation

Implemented after Patch 9F-1F:

- Added `BlogDailyContentPlan` / `blog_daily_content_plans` schema.
- Added `BlogDailyContentPlanItem` / `blog_daily_content_plan_items` schema.
- Added schema-only migration `20260620000100_add_blog_daily_content_plans`.
- Added `POST /api/daily-content-plans/default-plan`.
- Added `DailyContentPlanSummary` with `planVersion=9F-2A` and `planMode=daily_auto_content_plan_draft`.
- Added deterministic/static daily planning metadata preview with three candidate slots: `morning_education`, `midday_checklist`, and `evening_risk_review`.
- Added guarded apply implementation behind `BLOG_DAILY_CONTENT_PLAN_WRITE_ENABLED=true` plus exact confirmation phrase, but validation only performs feature-flag-disabled apply-negative smoke.
- Added `/settings/blogger` Daily Content Plan Preview UI with plan items, guardrails, side-effect summary, and disabled Apply/Create guidance.

Policy:

- This patch added schema/migration only for daily planning and did not execute daily plan business row writes during validation.
- This patch did not create `content_items`, generate article content, call LLM providers, create `llm_call_logs`, run Blogger publish/write/update/draft save/schedule, run OAuth reconnect, run token refresh, mutate publish approvals, mutate publish attempts, deploy, push, or perform external service writes.
- The 9E published/success milestone baseline remained unchanged.
- `blog_operation_profiles_count` remains `1`.
- `blog_daily_content_plans_count = 0` and `blog_daily_content_plan_items_count = 0` after validation.
- The next recommended patch is `9F-2B — Create/Apply Daily Content Plan row, no content generation or publish execution`.
- Alternative next patch: `9F-2C — Daily Content Plan UI polish and queue dashboard draft`.

## Patch 9F-1F Policy Simulation Scenario Matrix

Implemented after Patch 9F-1E:

- Added `operationProfileScenarioMatrixSummary` as an advisory/read-only scenario matrix for Operation Profile policy simulation.
- Added reusable scenario matrix logic for `safe_manual_publish`.
- Added the matrix summary to `POST /api/content-items/[id]/publish-oauth-gate`.
- Added the matrix summary to `POST /api/blog-operation-profiles/default-policy` preview responses.
- Added Content Detail UI for the Publish OAuth Gate scenario matrix, including matrix mode, totals, scenario rows, simulated decisions, blocker counts, and operator takeaways.
- Added `/settings/blogger` Operation Profile scenario matrix preview for synthetic future/planning scenarios.
- Matrix scenarios include `current_published_item`, `future_planned_ready_item`, `future_planned_token_expired`, `profile_missing`, `profile_mismatch`, and `scheduled_publish_requested` when actual gate context is available.
- Direct Operation Profile preview includes the synthetic future/profile/scheduled scenarios and omits the actual current item scenario.
- `operation_profile_policy_*` blockers are simulation-only and remain inside scenario `simulatedAdditionalBlockers`.
- Existing publish blockers, final preflight blockers, guarded publish execution blockers, `canExecutePublish`, `canPublish`, and scheduled publish permissions are unchanged.

Policy:

- Operation Profile remains advisory-only and simulation-only in this patch.
- This patch does not enable auto publish, scheduled publish, retry, recovery, or actual policy-enforced gate behavior.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The next recommended patch is `9F-2A — Daily Auto Content Plan draft, no publish execution`.
- Alternative next patch: `9F-1G — Policy simulation scenario matrix polish and planned-item fixture`.

## Patch 9F-1E Policy-enforced Publish Gate Simulation

Implemented after Patch 9F-1D:

- Added `operationProfilePolicySimulationSummary` as an advisory/read-only dry-run simulation of future Operation Profile policy enforcement.
- Added reusable simulation logic for the stored `safe_manual_publish` policy.
- Added the simulation summary to `POST /api/content-items/[id]/publish-oauth-gate`.
- Added the simulation summary to `POST /api/blog-operation-profiles/default-policy` preview responses.
- Added Content Detail UI for the Publish OAuth Gate simulation summary, including simulated policy state, simulated additional/removed blockers, simulated decision, comparison, notes, and explicit dry-run-only copy.
- Added `/settings/blogger` Operation Profile simulation guidance showing that auto publish and scheduled publish remain disabled while human approval, OAuth/readback/reconciliation guards remain required.
- Current baseline reports `simulationVersion=9F-1E`, `simulationMode=policy_enforcement_dry_run`, `advisoryOnly=true`, `policyEnforced=false`, `actualBlockerImpact=false`, and `actualExecutionPermissionImpact=false`.
- Existing publish blockers, `canExecutePublish`, `canPublish`, scheduled publish permissions, and publish execution semantics are unchanged.
- `operation_profile_policy_*` blockers are simulation-only and are not copied into top-level publish `blockingReasons`.

Policy:

- Operation Profile policy enforcement remains simulation-only in this patch.
- This patch does not enable auto publish, scheduled publish, retry, recovery, or actual policy-enforced gate behavior.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The next recommended patch is `9F-1F — Policy simulation UX refinement and scenario matrix`.
- Alternative next patch: `9F-2A — Daily Auto Content Plan draft, no publish execution`.

## Patch 9F-1D Operation Profile Exception Dashboard Draft

Implemented after Patch 9F-1C:

- Added `operationProfileExceptionDashboardSummary` as an advisory/read-only exception-only dashboard draft.
- Added reusable dashboard summary logic that turns `operationProfileAdvisorySummary` into focus items, collapsed normal items, a compact policy snapshot, attention level, headline, and operator summary.
- Added the dashboard summary to `POST /api/content-items/[id]/publish-oauth-gate`.
- Added the dashboard summary to `POST /api/blog-operation-profiles/default-policy` preview responses without changing the existing profile summary contract.
- Polished `/settings/blogger` Blog Operation Profile preview so the healthy summary and focus items appear first, with detailed policy fields in a collapsed section.
- Polished Content Detail Publish OAuth Gate UI so the Blog Operation Profile block shows the exception-only dashboard first and keeps detailed advisory metadata collapsed.
- Current baseline loads `safe_manual_publish`, reports `profileFound=true`, `profileHealthy=true`, `advisoryOnly=true`, `policyEnforced=false`, `blockerImpact=false`, and `executionPermissionImpact=false`.
- Existing publish blockers, `canExecutePublish`, `canPublish`, and publish/scheduled publish execution permissions are unchanged.
- `blog_operation_profiles_count` remains `1`, and the 9E published/success milestone baseline remains unchanged.

Policy:

- Operation Profile remains advisory-only in this patch.
- This patch does not enable auto publish, scheduled publish, retry, recovery, or policy-enforced gate behavior.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The next recommended patch is `9F-1E — Policy-enforced publish gate simulation, dry-run only`.

## Patch 9F-1C Operation Profile Advisory In Publish Gate

Implemented after Patch 9F-1B:

- Added read-only Operation Profile advisory wiring to `POST /api/content-items/[id]/publish-oauth-gate`.
- Added `operationProfileAdvisorySummary` with `advisoryOnly=true`, `policyEnforced=false`, `blockerImpact=false`, and `executionPermissionImpact=false`.
- The advisory loads the existing `safe_manual_publish` profile for `급등포착` / `3065973490356135805`.
- The summary reports profile status, operation mode, default policy preset, target blog metadata, safe manual policy booleans, advisory matches, warnings/notes, and side-effect summary.
- Content Detail now displays a `Blog Operation Profile Advisory` block inside the Publish OAuth Gate result area.
- Existing publish blockers, `canExecutePublish`, `canPublish`, and publish/scheduled publish execution permissions are unchanged by the profile advisory.
- `blog_operation_profiles_count` remains `1`, and the 9E published/success milestone baseline remains unchanged.

Policy:

- Operation Profile is advisory-only in this patch.
- This patch does not enable auto publish, scheduled publish, retry, recovery, or policy-enforced gate behavior.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, business DB mutation, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- The next recommended patch is `9F-1D — Operation Profile Settings UX polish and exception-only dashboard draft`.

## Patch 9F-1B Create/Apply Default Blog Operation Profile

Applied after Patch 9F-1A:

- Created the default `safe_manual_publish` Blog Operation Profile row for the verified Blogger blog `급등포착`.
- Target Blogger blog: `3065973490356135805` / `https://mathlearningappl.blogspot.com/`.
- The created profile uses `profileName=Default`, `status=active`, `operationMode=approval_required`, and `defaultPublishPolicyPreset=safe_manual_publish`.
- Safe policy values remain `allowAutoPublish=false`, `allowScheduledPublish=false`, `requireOAuthGate=true`, `requireFinalHumanApproval=true`, `requireReadbackAfterPublish=true`, and `requirePostPublishReconciliation=true`.
- The guarded apply was executed once with `BLOG_OPERATION_PROFILE_WRITE_ENABLED=true` and confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE`.
- After apply, `blog_operation_profiles_count=1`.
- After disabling the write flag, apply-negative smoke returned `blog_operation_profile_write_feature_flag_disabled`, `applyAttempted=false`, `applyBlocked=true`, `applyOk=false`, and `dbWrite=false`.
- After-apply preview returned `profileFound=true`, `profileWouldBeCreated=false`, `profileWouldBeUpdated=false`, and `dbWrite=false`.
- The 9E published/success milestone baseline remained unchanged.

Policy:

- This patch performed exactly one allowed business DB mutation in `blog_operation_profiles`.
- This patch did not run Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM calls, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service writes.
- Operation profiles are still not wired into publish gates. The next recommended patch is `9F-1C — Wire Operation Profile into publish gate as read-only advisory`.

## Patch 9F-1A Blog Operation Profile + Default Publish Policy Preset

Implemented after the 9E first publish milestone closeout:

- Added `BlogOperationProfile` / `blog_operation_profiles` schema foundation.
- Added the `safe_manual_publish` default publish policy preset.
- Added `POST /api/blog-operation-profiles/default-policy` for operation profile preview and guarded apply.
- Added `/settings/blogger` Blog Operation Profile preview UI with Apply/Save disabled.
- Added feature flag guard `BLOG_OPERATION_PROFILE_WRITE_ENABLED=true` and confirmation phrase `I_UNDERSTAND_THIS_WILL_CREATE_OR_UPDATE_BLOG_OPERATION_PROFILE` for future profile writes.

Validation:

- Preview smoke returned `profileWouldBeCreated=true`, `defaultPublishPolicyPreset=safe_manual_publish`, `allowAutoPublish=false`, `allowScheduledPublish=false`, human approval/OAuth/readback/reconciliation requirements true, and `dbWrite=false`.
- Apply-negative smoke with the feature flag disabled returned `blog_operation_profile_write_feature_flag_disabled`, `applyAttempted=false`, `applyBlocked=true`, `applyOk=false`, and `dbWrite=false`.
- `blog_operation_profiles_count` remained `0`.
- The 9E published/success baseline remained unchanged.

Policy:

- Profile apply/write was implemented but not executed during validation.
- Operation profiles are not wired into publish gates yet.
- No Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, content generation, LLM call, content item mutation, publish approval mutation, publish attempt mutation, deploy, push, or external service write occurred.

## Patch 9E-9E Publish Milestone Closeout

Documented after `9E-9D-APPLY`:

- Closed out the first end-to-end Blogger publish milestone.
- Recorded the final published/success DB baseline for content item `cmqc2xqbr00011y70sxmgl65v`.
- Moved the earlier `planned` / `planned_only` state into historical pre-reconciliation context.
- Updated the next-session direction toward operation automation, with `9F-1A Blog Operation Profile + Default Publish Policy Preset` as the recommended next patch.

Milestone path:

- `9E-9B-LIVE`: ran one guarded Blogger `posts.publish` through feature flag, exact confirmation phrase, acknowledgements, OAuth readiness, final preflight, and matching metadata. Blogger URL: `https://mathlearningappl.blogspot.com/2026/06/blog-post.html`. Local content mutation was intentionally deferred at publish time.
- `9E-9C`: added Blogger post readback route/lib and verified external Blogger published state from redacted readback metadata.
- `9E-9C-R1`: implemented OAuth token refresh, reflected `tokenRefreshImplemented=true`, and verified the Google OAuth token endpoint path for reducing repeated manual reconnect pressure.
- `9E-9D`: added guarded post-publish reconciliation route/lib, preview mode, feature-flag-disabled apply negative guard, and transaction-based apply implementation.
- `9E-9D-APPLY`: after explicit approval, reconciled the local DB once: `content_items.status=published`, `content_items.publishedAt=2026-06-19 00:44:03`, publish execution attempt `status=success`, redacted response stored, error fields cleared, `contentStatusBefore=planned`, `contentStatusAfter=published`, and `contentMutationCompleted=true`.

Policy:

- This documentation closeout performs no Blogger publish/write, Blogger `posts.update`, Blogger draft save, OAuth reconnect, token refresh, DB mutation, content mutation, publish attempt mutation, external service write, deploy, or LLM call.

## Patch 9E-9D Post-publish DB Reconciliation

Implemented after Blogger publish readback/token refresh work:

- Added guarded post-publish reconciliation preview/apply route at `POST /api/content-items/[id]/post-publish-reconciliation`.
- Added `src/lib/content/post-publish-reconciliation.ts` to compare Blogger readback state with internal content/attempt state and produce safe proposed patches.
- Added `success` to `BloggerPublishExecutionAttemptStatus` for future guarded reconciliation of publish attempts after verified Blogger readback.
- Added a Content Detail preview block for post-publish DB reconciliation with a disabled apply control and explicit safety copy.

Policy:

- Preview mode does not mutate DB and may only perform Blogger read-only post GET through the existing readback helper.
- Apply mode is code-gated by `BLOGGER_POST_PUBLISH_RECONCILIATION_APPLY_ENABLED=true`, exact confirmation phrase, acknowledgements, current-state matches, successful readback, and transaction-based content/attempt updates.
- This patch does not execute apply mode, Blogger publish/write, posts.update, draft save, OAuth reconnect, token refresh, or LLM calls during validation.

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

## Patch 8F Publish Readiness Gate

Implemented after Patch 8E:

- Added `POST /api/content-items/[id]/publish-readiness`.
- Added saved planJson, draftMarkdown, draftHtml, HTML validation, and quality preview based readiness checks.
- Added `contentReady` and `publishReady` split.
- Added `/content/[id]` Publish Readiness Gate UI.

Policy:

- `publish-readiness` does not mutate DB.
- `publishReady` remains false until Blogger connection and manual approval storage exist.
- status, qualityScore, draftHtml, publishedAt, and scheduledAt are not changed.
- No LLM calls, no `llm_call_logs`, no Blogger OAuth/API/publish.

## Patch 9A Blogger Connection Placeholder

Implemented after Patch 8F:

- Added `BloggerConnectionStatus` enum.
- Added `blogger_connections` placeholder model and migration.
- Added `/api/settings/blogger` safe list/create API.
- Added `/api/settings/blogger/[id]` safe get/update API.
- Added `/api/settings/blogger/[id]/status` stored-status preview API.
- Added `/settings/blogger` placeholder UI.
- Wired publish readiness to stored Blogger connection status while keeping `publishReady=false`.

Policy:

- No Google OAuth start/callback.
- No access token or refresh token issuance.
- No token/client secret plaintext storage.
- No Blogger API calls, blog list reads, draft saves, publish, or scheduled publish.
- No LLM calls or `llm_call_logs`.

## Patch 9B Blogger OAuth State Dry Run

Implemented after Patch 9A:

- Added `BloggerOAuthState` model and migration.
- Added `oauthClientIdRef` safe metadata field to Blogger connections.
- Added `POST /api/settings/blogger/[id]/oauth/start`.
- Added `GET /api/settings/blogger/oauth/callback`.
- Added OAuth authorization URL dry-run UI to `/settings/blogger`.

Policy:

- OAuth state plaintext is not stored; only `stateHash` is persisted.
- Callback dry-run validates state and consumes it but does not exchange tokens.
- Authorization code plaintext is not persisted or returned.
- No access token or refresh token issuance/storage.
- No Blogger API calls, blog list reads, draft saves, publish, or scheduled publish.
- No LLM calls or `llm_call_logs`.

## Patch 9C-1 Blogger Token Storage Security Foundation

Implemented after Patch 9B:

- Added `BloggerSecretKind` enum.
- Added `blogger_connection_secrets` encrypted secret metadata model and migration.
- Added Blogger token encryption helper using `BLOGGER_SECRET_ENCRYPTION_KEY`.
- Added Blogger token redaction/safe error helpers.
- Added safe Blogger connection secret DB helper.
- Added `GET /api/settings/blogger/[id]/secret-status`.
- Added `POST /api/settings/blogger/[id]/secret-self-test`.
- Added Token Storage Security section to `/settings/blogger`.

Policy:

- No raw access token, refresh token, client secret, or authorization code columns.
- `encryptedValue` is never returned by API/UI.
- Self-test uses a server-internal dummy string and does not return plaintext/ciphertext/encryptedValue.
- Token exchange remains unimplemented.
- No Google token endpoint call.
- No Blogger API calls, blog list reads, draft saves, publish, or scheduled publish.
- No LLM calls or `llm_call_logs`.

## Patch 9C-2 Blogger OAuth Callback Token Exchange

Implemented after Patch 9C-1:

- Added Google OAuth token exchange helper for Blogger callback.
- Switched `/api/settings/blogger/oauth/callback` from dry-run validation to token exchange.
- Resolve `clientSecretRef` only as a server environment key name.
- Store access token as encrypted `BloggerConnectionSecret`.
- Store refresh token as encrypted `BloggerConnectionSecret` when Google returns one.
- Reuse existing refresh token metadata when Google does not return a new refresh token.
- Update Blogger connection status to `connected`, `oauth_required`, or `error` based on token exchange result.
- Keep publish readiness `publishReady=false`.

Policy:

- No authorization code plaintext persistence or response.
- No access token, refresh token, client secret, encrypted value, or raw token response returned by API/UI.
- No token refresh implementation.
- No Blogger API calls, blog list reads, draft saves, publish, or scheduled publish.
- No LLM calls or `llm_call_logs`.

## Patch 9D-1 Blogger Blog List Read-only

Implemented after Patch 9C-2:

- Added read-only Blogger blog list helper.
- Added `POST /api/settings/blogger/[id]/blogs`.
- Decrypt stored encrypted access token only inside server-side Blogger helper.
- Call only `GET https://www.googleapis.com/blogger/v3/users/self/blogs`.
- Return a safe blog DTO with ID, name, URL, published, and updated fields.
- Added “Blogger 목록 조회” action and result table to `/settings/blogger`.
- Updated Blogger settings copy to reflect that OAuth callback token exchange is implemented and Blogger API support is limited to read-only blog list.

Policy:

- No raw access token, refresh token, client secret, encrypted value, raw Blogger response, or raw Blogger error returned by API/UI.
- No DB mutation in the blog list route.
- No token refresh implementation.
- No Blogger draft save, publish, scheduled publish, or blog selection save.
- Keep publish readiness `publishReady=false`.
- No LLM calls or `llm_call_logs`.

## Patch 9D-2 Blogger Blog Selection

Implemented after Patch 9D-1:

- Added `bloggerBlogUrl` and `bloggerBlogVerifiedAt` safe metadata to `BloggerConnection`.
- Added `POST /api/settings/blogger/[id]/blogs/select`.
- Revalidate selected `blogId` by calling the read-only Blogger blog list helper before saving.
- Store only verified safe blog ID, name, URL, and verification timestamp.
- Added “이 블로그 선택” action to `/settings/blogger`.
- Added Blogger blog selection check to publish readiness while keeping `publishReady=false`.

Policy:

- Generic PATCH changes to Blogger blog ID/name do not create a verified selection.
- No token refresh implementation.
- No Blogger draft save, publish, or scheduled publish.
- No raw Blogger response/error, token, client secret, or encrypted value returned by API/UI.
- No LLM calls or `llm_call_logs`.

## Patch 9E-0 Blogger Draft Payload Preview

Implemented after Patch 9D-2:

- Added preview-only `POST /api/content-items/[id]/blogger-draft-preview`.
- Added a pure Blogger draft payload preview helper that uses saved `draftHtml` only.
- Uses stored verified Blogger blog selection metadata as the target blog.
- Treats `bloggerBlogId` without `bloggerBlogVerifiedAt` as unverified.
- Returns title candidate, short HTML snippet, labels candidate, HTML safety summary, readiness flags, blocking issues, and warnings.
- Adds a “Blogger Draft Payload Preview” section to the content detail page.
- Keeps actual Blogger draft save, publish, scheduled publish, token refresh, and Blogger API read/write out of scope.
- Keeps publish readiness `publishReady=false` and top-level `ready=false`.

Policy:

- No DB mutation.
- No Blogger API read/write call.
- No full `draftHtml` payload preview returned as a large response field.
- No access token, refresh token, client secret, encrypted value, raw Blogger response/error, LLM call, or `llm_call_logs`.

## Patch 9E-1 Blogger Draft Approval Guard

Implemented after Patch 9E-0:

- Added `BloggerDraftApprovalStatus` and `blogger_draft_approvals`.
- Added safe manual approval APIs:
  - `POST /api/content-items/[id]/blogger-draft-approval`
  - `DELETE /api/content-items/[id]/blogger-draft-approval`
- Approval creation recalculates the draft payload preview server-side and only accepts `draftPayloadReady=true`.
- Approval snapshot uses stable canonical JSON and SHA-256 hashes.
- Stores `draftHtmlHash`, `snapshotHash`, target Blogger blog safe metadata, title candidate, and readiness summary.
- Does not store full `draftHtml` or `htmlSnippet` in the approval record.
- Preview API now returns approval status, current hash prefixes, active/latest approval summary, and snapshot match status.
- Publish readiness manual approval check can pass when the active approval snapshot matches the current preview.
- Keeps `publishReady=false` and top-level `ready=false`.

Policy:

- No Blogger API read/write call.
- No Blogger draft save, publish, scheduled publish, or token refresh.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No access token, refresh token, encrypted value, raw Blogger response/error, LLM call, or `llm_call_logs`.

## Patch 9E-2 Blogger Draft Save

Implemented after Patch 9E-1:

- Added `BloggerDraftSaveStatus` and `blogger_draft_saves`.
- Added `POST /api/content-items/[id]/blogger-draft-save`.
- Draft save route recalculates the current Blogger draft payload preview server-side.
- Active approval `snapshotHash` and `draftHtmlHash` must match the current preview before any Blogger write call.
- Calls Blogger `posts.insert` with `isDraft=true` only.
- Blocks duplicate successful draft saves for the same approval snapshot.
- Stores safe success/failure metadata and exposes safe DTOs in preview/readiness UI.
- Publish readiness now includes `blogger_draft_saved` check and draft save metadata while keeping `publishReady=false`.

Policy:

- No `posts.update`, publish, scheduled publish, token refresh, or bulk publishing.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No full `draftHtml`, raw Blogger response/error body, access token, refresh token, encrypted value, LLM call, or `llm_call_logs`.

## Patch 9E-3 Blogger Draft Save Live Verification Runbook

Implemented after Patch 9E-2:

- Documented the live Blogger test blog draft save verification runbook.
- Added the fixed pre-live-write approval wording:
  - `실제 Blogger test blog에 draft post가 생성됩니다. 실행해도 됩니까?`
- Documented live verification prerequisites:
  - connected OAuth token
  - verified Blogger blog selection
  - saved `draftHtml`
  - `draftPayloadReady=true`
  - active approval snapshot match
  - no previous successful draft save for the same approval
  - user confirmation that the target blog is a test blog
- Documented retry policy for `retryable=true` failures and non-retryable OAuth/permission failures.
- Documented duplicate draft prevention for same approval success records.
- Documented that new approvals can create new drafts and may accumulate Blogger drafts.
- Kept `posts.update` as a separate Patch 9E-4 policy/design topic.
- Polished content detail UI confirmation, success, duplicate, retryable failure, and non-retryable failure wording.

Policy:

- No live Blogger draft save was executed during Patch 9E-3.
- No `posts.update`, `posts.delete`, publish, scheduled publish, token refresh, or bulk publishing.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No access token, refresh token, encrypted value, raw Blogger response/error, LLM call, or `llm_call_logs`.

## Patch 9E-4A Manual HTML Quality Repair Preview

Implemented after Patch 9E-3:

- Added a rule-based HTML quality repair preview helper.
- Added `POST /api/content-items/[id]/quality-repair-preview`.
- The preview uses saved `draftMarkdown` to rebuild a longer HTML candidate when current `draftHtml` is short or placeholder-like.
- The fallback path appends rule-based structure, CTA, and finance disclaimer sections to current `draftHtml`.
- Added a Quality Repair Preview section to the content detail page.
- The UI shows before/after length, grade, required fail count, CTA/disclaimer flags, source, validation, and editable candidate HTML.
- The candidate can be copied into the existing HTML candidate editor and then saved only through the existing manual `apply-html` flow.

Policy:

- No automatic `draftHtml` save.
- No `qualityScore`, status, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs`.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4B Repair Candidate Apply UX Polish

Implemented after Patch 9E-4A:

- Polished the Quality Repair Preview handoff into the existing HTML candidate editor.
- Renamed the repair handoff action to `HTML 후보로 사용`.
- Added a UI-only HTML candidate source state for `html-preview`, `quality-repair`, and `manual-edit`.
- Repair candidates copied into the HTML candidate editor now require `validate-html` revalidation before manual `apply-html`.
- The HTML candidate editor can be shown from a repair candidate even when no HTML Dry Run result is present.
- `apply-html` confirmation and success notices now warn that existing Blogger draft approval snapshots can become stale.
- After `apply-html` success, stale Quality Dry Run, Publish Readiness, and Blogger Draft Payload Preview results are cleared and the UI asks the user to rerun them.

Policy:

- No automatic `draftHtml` save or repair candidate auto-apply.
- No automatic quality/readiness/Blogger draft preview rerun.
- No DB/schema change.
- No LLM call, `llm_call_logs`, Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-1 Provider-Aware Draft Generation Strategy Foundation

Implemented after Patch 9E-4B:

- Added a provider-aware draft generation strategy resolver.
- Remote/commercial routes remain on the existing `one_shot_full_draft` default.
- Local/small-model-like routes are identified as `local_sectioned_multi_pass` strategy candidates.
- Added draft generation response metadata for strategy, reason, local-like status, executed/planned steps, implementation flags, and provider/model safe summary.
- Added the same safe strategy metadata to `content_draft` LLM call logs.
- Added content detail UI guidance for route-level strategy and generated candidate strategy metadata.
- Documented that actual skeleton-first, sectioned multi-pass generation and final polish are deferred to Patch 9E-4C-2.

Policy:

- Existing one-shot draft generation behavior is preserved.
- Local strategy still executes the current one-shot fallback path in this patch.
- No `TaskRoute` schema or DB migration.
- No automatic `draftMarkdown` or `draftHtml` save.
- No prompt full text, raw response, candidate Markdown, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-2 Local LLM Sectioned Draft Generation Preview

Implemented after Patch 9E-4C-1:

- Added local sectioned draft generation service.
- Kept remote/commercial routes on the existing one-shot full draft path.
- Local/small-model-like routes now run skeleton generation, section generation, deterministic assembly, and final polish when `content_draft` generation is requested.
- Reused the existing `POST /api/content-items/[id]/generate-draft` endpoint and manual `draftMarkdown` apply flow.
- Added local sectioned response metadata for section count, section keys, final polish status, fallback reasons, and safe step summaries.
- Added safe step metadata to `content_draft` call logs without storing prompts, raw responses, candidate Markdown, skeleton, section fragments, or final polish input/output.
- Allowed `promptHash` and `responseHash` as safe call-log metadata while continuing to redact prompt/response bodies.
- Updated content detail UI to show sectioned generation steps and fallback/final polish status.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- Blog post HTML template/theme rendering is deferred to Patch 9E-4D.

## Patch 9E-4C-2 Hotfix: Local FAQ Preservation

Implemented after Patch 9E-4C-2 smoke:

- Strengthened local sectioned skeleton/section prompts to preserve saved `planJson.faq`.
- Strengthened final polish prompt so FAQ headings and question structure are not removed or merged into general prose.
- Added deterministic post-polish FAQ guard.
- When saved FAQ exists and the candidate has no FAQ-like section, the guard appends a safe `## FAQ` section with `###` question headings.
- Added safe FAQ metadata: `faqRequired`, `faqSectionDetected`, `faqFallbackAppended`, and `faqCount`.
- Updated content detail UI to show FAQ preservation metadata.

Policy:

- Remote/commercial one-shot draft path is unchanged.
- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No FAQ question/answer full-text metadata or logs.
- No prompt full text, raw response, candidate Markdown, section fragment, final polish input/output, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-2 Hotfix2: Local Safety Phrase Scrub

Implemented after the FAQ preservation smoke exposed validation-blocking safety phrases:

- Added deterministic safety phrase scrub for local sectioned draft candidates.
- Applied scrub after FAQ guard/fallback and before `validateDraftMarkdown`.
- Reused the same scrub for local sectioned repair results before repair validation.
- Strengthened final polish prompt with explicit blocked phrases and neutral alternatives.
- Added safe scrub metadata: `safetyScrubApplied`, `safetyScrubCount`, and `safetyScrubCodes`.
- Updated content detail UI to show scrub summary without showing candidate or scrubbed sentence text.

Policy:

- Remote/commercial one-shot draft path is unchanged.
- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No prompt full text, raw response, candidate Markdown, scrubbed sentence text, section fragment, final polish input/output, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-2 Hotfix3: Local Sectioned Timeout Policy

Implemented after hotfix2 smoke showed local sectioned generation could exceed the existing 180s provider timeout:

- Added an extended timeout policy for `local_sectioned_multi_pass`.
- Kept remote/commercial `one_shot_full_draft` on the existing route/provider timeout behavior.
- Set local sectioned overall timeout to 600000ms.
- Set skeleton step timeout to 240000ms, section generation/retry timeout to 180000ms, and final polish timeout to 300000ms.
- Set local sectioned repair timeout to 300000ms.
- Added safe timeout metadata: `timeoutPolicy`, `overallTimeoutMs`, `stepTimeoutMs`, and `finalPolishTimeoutMs`.
- Changed content draft provider abort errors to the short safe message/summary `provider_timeout`.
- Updated content detail UI to show timeout policy metadata.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No prompt full text, raw response, candidate Markdown, section fragment, final polish input/output, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-2 Hotfix4: Local Sectioned Cold-Start Timeout Policy

Implemented after hotfix3 smoke exceeded the new 240s skeleton/provider step timeout:

- Increased local sectioned overall timeout to 1200000ms.
- Increased skeleton timeout to 600000ms.
- Increased section generation/retry timeout to 300000ms.
- Increased final polish timeout to 600000ms.
- Increased local sectioned repair timeout to 600000ms.
- Added more granular safe timeout metadata: `skeletonTimeoutMs`, `sectionTimeoutMs`, and `repairTimeoutMs`.
- Kept remote/commercial `one_shot_full_draft` on the existing route/provider timeout behavior.

Policy:

- If local smoke still times out, the next step is async/background job design rather than further timeout extension.
- No automatic `draftMarkdown` or `draftHtml` save.
- No DB/schema or TaskRoute schema change.
- No prompt full text, raw response, candidate Markdown, section fragment, final polish input/output, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3A: Local Stepwise Draft Generation Foundation

Implemented after the local sectioned timeout hotfixes showed that long Local LLM generation should move away from one large HTTP request:

- Added Prisma run/step status enums for persisted stepwise draft generation.
- Added `ContentDraftGenerationRun` mapped to `content_draft_generation_runs`.
- Added `ContentDraftGenerationStep` mapped to `content_draft_generation_steps`.
- Added a migration that creates only the new enums, tables, indexes, foreign keys, and grants.
- Added `src/lib/db/content-draft-generation-runs.ts` repository helpers for creating/listing/reading runs, creating/updating steps, completing runs, and cancelling runs.
- Added safe metadata sanitization in the repository helper so prompt/raw response/body/token/secret/encrypted value and full content body keys are removed before metadata storage.
- Added `local_sectioned_stepwise` to draft generation strategy types and labels for future API/UI patches.

Policy:

- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- Existing `local_sectioned_multi_pass` single-request path is preserved as legacy/debug behavior.
- No API route or UI was added in this patch.
- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No prompt full text, raw response, request/response body, candidate Markdown, section fragment, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3B: Local Stepwise Draft Generation Start/Read API

Implemented after Patch 9E-4C-3A:

- Added `POST /api/content-items/[id]/draft-generation-runs`.
- Added `GET /api/content-items/[id]/draft-generation-runs`.
- Added `GET /api/content-items/[id]/draft-generation-runs/[runId]`.
- The start API requires saved `planJson` and creates a `local_sectioned_stepwise` run only.
- New runs start as `pending`, set `currentStepKey=skeleton`, and create pending step placeholders for skeleton and default section keys.
- List and detail APIs return safe run/step DTOs.
- Reused the 3A repository helpers and added a local stepwise creation helper plus DTO mappers.

Policy:

- No LLM provider call and no `llm_call_logs` creation.
- No step execution, assembly, final polish, cancel API, or UI.
- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No prompt full text, raw response, request/response body, secret, token, or encrypted value response/storage.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3C: Local Stepwise Draft Generation Step Execution API

Implemented after Patch 9E-4C-3B:

- Added `POST /api/content-items/[id]/draft-generation-runs/[runId]/steps/[stepKey]`.
- Added a stepwise draft generation service for single-step skeleton/section execution.
- Supported step keys are `skeleton`, `intro`, `body_1`, `body_2`, `body_3`, and `conclusion_cta_faq`.
- Each request executes at most one step.
- Section steps are blocked until skeleton succeeds.
- Completed/cancelled runs, already-running steps, and remote/commercial routes are rejected.
- Existing successful steps are reused unless retry/force is explicitly requested.
- Retry increments only the target step attempt.
- Step success stores normalized Markdown output, short summary, prompt/response hashes, latency, and safe metadata in the step row.
- Step failure marks only the target step as failed.
- Step execution writes `content_draft` LLM call logs with safe stepwise metadata.

Policy:

- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- No automatic full step chain execution.
- No assembly, final polish, cancel API, or UI.
- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No prompt full text, raw response, request/response body, output Markdown full text, skeleton/section fragment full text, candidate Markdown, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3C Smoke Stabilization: Local Ollama Stepwise Calls

Implemented after the initial skeleton smoke reached the route but failed because the selected Ollama model did not return response bytes in time:

- Changed stepwise Ollama generation from `stream:false` to `stream:true`.
- Added separate overall, first-byte, and stream idle timeout handling.
- Added `/api/tags` preflight before Ollama `/api/generate`.
- Added safe request options diagnostics for step execution.
- Reduced skeleton defaults to smaller smoke-friendly generation settings.
- Added bounded section generation settings.
- Added short `keep_alive` for Ollama stepwise calls.
- Added safe error distinctions for model missing, first-byte timeout, idle timeout, overall timeout, network failure, empty response, stream parse failure, and stream provider error.
- Added `scripts/smoke_9e4c3c_stepwise_local_ollama.mjs` as a read-only route/tags probe with optional short generate probe.

Policy:

- No model route is changed automatically.
- No migration or schema change.
- No content item `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- No prompt full text, raw response full text, output Markdown full text, skeleton/section fragment full text, candidate Markdown, secret, token, or encrypted value logging.

## Patch 9E-4C-3D: Local Stepwise Assemble and Final Polish API

Implemented after Patch 9E-4C-3C smoke stabilization:

- Added `POST /api/content-items/[id]/draft-generation-runs/[runId]/assemble`.
- Added `POST /api/content-items/[id]/draft-generation-runs/[runId]/final-polish`.
- Added repository helpers for saving assembled candidates and marking run-level final polish failures.
- Deterministic assembly combines successful section outputs in the fixed stepwise order.
- Assembly requires all required section steps to be `success` with `outputMarkdown`.
- Assembly stores `assembledCandidateMarkdown`, safe validation summary, and safe metadata without calling an LLM.
- Final polish requires an assembled candidate and calls the configured local-like `content_draft` route once.
- Final polish success stores `finalCandidateMarkdown`, safe validation summary, and completes the run.
- Final polish failure keeps the assembled candidate as fallback and records safe failure metadata only.
- Added `scripts/smoke_9e4c3d_assemble_final_polish.mjs` for API-level assemble/final polish smoke checks.

Policy:

- Existing `POST /api/content-items/[id]/generate-draft` behavior is unchanged.
- No UI was added.
- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No prompt full text, raw response full text, assembled/final candidate full text in metadata, secret, token, or encrypted value logging.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4C-3E: Content Detail Stepwise UI

Implemented after Patch 9E-4C-3D:

- Added a Stepwise Draft Generation section to the content detail screen.
- Added UI for listing/selecting persisted stepwise runs.
- Added UI for creating a new stepwise run.
- Added one-step-at-a-time local LLM execution buttons for skeleton and section steps.
- Added deterministic assemble and final polish controls.
- Added read-only assembled/final candidate previews and validation summary display.
- Added human-readable diagnostics for common local provider timeout/model errors.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- Retry/force and content item candidate apply remain follow-up patches.

## Patch 9E-4C-3F: Stepwise Final Candidate Manual Apply Guard

Implemented after Patch 9E-4C-3E:

- Added a “수동 적용 후보로 사용” action for completed stepwise runs with `finalCandidateMarkdown`.
- The action copies the final candidate into the existing Draft Markdown candidate editor as client-side state only.
- Added draft candidate source labeling for LLM generated, stepwise final candidate, and manual edit sources.
- Added safety copy explaining that the copy action does not save content items or call Blogger/LLM APIs.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs` creation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4D: Blog Post Template Renderer Preview

Implemented after Patch 9E-4C-3F:

- Added deterministic Markdown-to-HTML blog post template preview rendering.
- Added `POST /api/content-items/[id]/blog-post-template-preview`.
- Added content detail UI controls to generate a themed HTML preview from the current Draft Markdown candidate.
- Preview output includes safe validation summary counts for headings, FAQ, media placeholders, unsafe patterns, and preview-only side-effect metadata.
- Preview HTML is displayed in an iframe and read-only textarea.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs` creation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4E: Blog HTML Preview Manual Apply Guard

Implemented after Patch 9E-4D:

- Added an “HTML 후보로 사용” action for Blog Post Template HTML previews.
- The action copies preview HTML into the existing HTML candidate editor as client-side state only.
- Added `blog template preview` HTML candidate source labeling.
- The handoff clears/stales HTML candidate validation so the existing `validate-html` and manual `apply-html` flow must be used before saving.
- Added UI copy clarifying that the handoff does not save `draftHtml`, mutate content items, or call Blogger APIs.

Policy:

- No automatic `draftMarkdown` or `draftHtml` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs` creation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4F: Manual draftHtml Apply Guard Hardening

Implemented after Patch 9E-4E:

- Hardened the existing `POST /api/content-items/[id]/apply-html` response with safe guard summary metadata.
- Added unsafe pattern count to HTML candidate validation metadata.
- Kept server-side validation immediately before saving `draftHtml`.
- Added UI copy clarifying that `draftHtml에 반영` saves only `draftHtml` and does not call Blogger draft save/publish/token refresh.
- Replaced the native confirm with an in-page 2-step explicit save confirmation guard.
- Added last apply guard summary display on the content detail page.
- After successful manual apply, the HTML candidate source is shown as applied/saved draftHtml.

Policy:

- `apply-html` writes only `content_items.draftHtml`.
- No automatic `draftMarkdown` save.
- No content item status, `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- No LLM call or `llm_call_logs` creation.
- No Blogger API read/write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.

## Patch 9E-4G-1: Saved draftHtml Readiness Recheck and Draft Save Preflight

Implemented after Patch 9E-4F:

- Added `POST /api/content-items/[id]/blogger-draft-save-preflight`.
- The preflight recomputes saved `draftHtml` validation, Blogger draft payload preview, current approval snapshot hash, and publish-readiness summary.
- Added safe connection, selected blog, token metadata presence, approval snapshot, blocking reason, warning, HTML hash prefix, and side-effect summaries.
- Added content detail UI controls for running Draft Save Preflight next to Blogger Draft Payload Preview.
- Blogger Draft save buttons now also require the latest preflight result to pass before enabling.
- Manual `draftHtml` apply success clears stale preflight results and asks the user to rerun Quality Dry Run, Publish Readiness, Blogger Draft Payload Preview, and Draft Save Preflight.

Policy:

- Preflight is read-only and does not call Blogger write APIs.
- No Blogger draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- No LLM call or `llm_call_logs` creation.
- No `content_items` mutation, including `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- Secret material, encrypted values, raw Blogger responses, prompt text, and full `draftHtml` are not returned.

## Patch 9E-4G-1b: Blogger Draft Save Readiness UX and Connection Guidance

Implemented after Patch 9E-4G-1:

- Improved the content detail Draft Save Preflight result block with a human-readable readiness checklist.
- Added blocking reason to next-action guidance for Blogger connection, blog selection, draft payload readiness, manual approval, stale approval, and draft save readiness.
- Added `/settings/blogger` navigation guidance when no Blogger connection exists.
- Added clearer copy around the disabled Blogger Draft save button explaining that preflight must pass before any real draft save attempt.
- Added stale approval guidance explaining that changed `draftHtml` can invalidate prior payload previews and approval snapshots.
- Kept side-effect flags visible and explicit: Blogger API write, draft save, publish, scheduled publish, token refresh, LLM call, and content item mutation remain false during preflight.

Policy:

- UX/readiness guidance only.
- No Blogger API write, draft save, publish, scheduled publish, token refresh, `posts.insert`, or `posts.update`.
- No LLM call or `llm_call_logs` creation.
- No `content_items` mutation, including `draftMarkdown`, `draftHtml`, status, `qualityScore`, `publishedAt`, or `scheduledAt`.
- No schema or migration change.

## Patch 9E-4G-1c: Draft Save Preflight Blocker Classification

Implemented after Patch 9E-4G-1b:

- Changed draft-save preflight classification so `blogger_draft_saved` from publish-readiness no longer blocks the first Blogger draft save attempt.
- Added same-approval duplicate-save detection with `blogger_draft_already_saved_for_approval`.
- Promoted expired access tokens to a true preflight blocker: `access_token_expired_reauth_required`.
- Added safe client secret diagnostics for env-backed `clientSecretRef` use: `hasClientSecretRef`, `clientSecretConfigured`, and `encryptedClientSecretStored`.
- Updated content detail guidance to show expired-token reauth guidance, duplicate-save guidance, and “draft not saved yet” as an expected first-save state.

Policy:

- No token refresh implementation.
- No OAuth start/callback is invoked automatically.
- No Blogger API write, draft save, publish, scheduled publish, `posts.insert`, or `posts.update`.
- No LLM call, `llm_call_logs` creation, schema change, migration, or content item mutation.

## Patch 9E-4G-2a: Blogger Draft Save UI Gate Activation Fix

Implemented after Patch 9E-4G-1c:

- Changed the content detail Blogger Draft save button to use the latest Draft Save Preflight result as the source of truth for UI activation.
- The button now requires `canSaveDraft=true`, zero blocking reasons, ready draft payload, matching approved snapshot, and no same-approval successful save.
- The UI no longer depends on top-level publish-readiness `ready=true` for draft save activation.
- Added in-page 2-step confirmation before calling the existing guarded Blogger draft save route.
- Added copy clarifying that the save action creates one Blogger draft post and does not publish, schedule publish, update posts, or refresh tokens.
- After successful UI save, the preflight state is marked as duplicate-blocked to prevent another click for the same approval.

Policy:

- No automatic draft save.
- No publish, scheduled publish, posts.update, token refresh, LLM call, schema change, or content item mutation.
- Blogger write remains possible only through the explicit user-clicked save button after preflight passes.

## Patch 9E-4G-2b: Blogger Draft Save Success UX and Admin Link Polish

Implemented after Patch 9E-4G-2a:

- Recorded the live smoke outcome where the web UI created one Blogger draft post in the test blog.
- Added safe latest-successful draft save metadata to Draft Save Preflight responses.
- Improved the content detail Blogger Draft Save section with a success block for saved draft metadata.
- Added derived Blogger admin edit/preview links from `targetBloggerBlogId` and `bloggerPostId`.
- Added guidance that Blogger may return a blog/home URL for draft posts and that the derived admin links are the useful management links.
- Reframed `blogger_draft_already_saved_for_approval` as a protective duplicate-save state instead of a scary error.
- Kept copy explicit that the saved post is still a draft and `posts.update`, publish, scheduled publish, and token refresh are not implemented/executed.

Live smoke record:

- `blogger_draft_saves=1`
- `blogger_draft_approvals=1`
- `llm_call_logs=22`
- `bloggerPostId=6376467965797870330`
- Duplicate preflight blocker `blogger_draft_already_saved_for_approval` confirmed.
- `draftMarkdown` hash stayed `9e0921e7edc9e4a8464a0a52ba369d3d`.
- `draftHtml` hash stayed `a7393df8fb009566201daeea18796027`.
- Content status stayed `planned`; `qualityScore`, `publishedAt`, and `scheduledAt` were unchanged.

Policy:

- UX/read-only metadata polish only.
- No new Blogger API write or additional draft save during this patch.
- No publish, scheduled publish, posts.update, token refresh, LLM call, schema change, migration, or content item mutation.

## Session Closeout: 2026-06-16 Stepwise Draft to Blogger Draft Save Milestone

Final milestone:

- Completed the end-to-end reviewed draft path from persisted local stepwise generation to Blogger draft save:
  `Stepwise draft -> publish-ready HTML preview -> manual draftHtml apply -> Blogger OAuth/blog selection -> payload preview -> approval snapshot -> Blogger draft save 1회 성공`.
- The milestone remains manual/review-gated at each persistence or external write boundary.
- No automatic publish pipeline has been enabled.

Completed patch sequence in this session:

- 9E-4C-3E: content detail stepwise draft UI.
- 9E-4C-3F: client-side guard for copying `finalCandidateMarkdown` into the Draft Markdown candidate editor.
- 9E-4D: deterministic Blog Post Template HTML preview renderer.
- 9E-4E: client-side guard for copying template preview HTML into the HTML candidate editor.
- 9E-4F: hardened manual `draftHtml` apply guard with server revalidation and 2-step confirmation.
- 9E-4G-1: saved `draftHtml` Blogger Draft Save Preflight gate.
- 9E-4G-1b: readiness UX and Blogger connection guidance.
- 9E-4G-1c: preflight blocker classification fix.
- 9E-4G-2a: guarded Blogger Draft save button activation from `canSaveDraft=true`.
- 9E-4G-2b: Blogger draft save success UX and derived admin edit/preview links.

Live smoke result:

- Test content item: `cmqc2xqbr00011y70sxmgl65v`.
- Title candidate: `주식 초보자가 매수 타이밍을 놓치는 이유`.
- Blogger connection: `cmqfst8vc0001iwrpi1qu8oj2`.
- Selected test blog: `급등포착`.
- Target Blogger blog id: `3065973490356135805`.
- Target Blogger blog URL: `https://mathlearningappl.blogspot.com/`.
- Approval: `cmqfwjz9u0009iwag9auo688v`.
- Blogger draft post id: `6376467965797870330`.
- Blogger admin draft/preview was confirmed by the user.

Safety/result record:

- `blogger_draft_saves=1`.
- `blogger_draft_approvals=1`.
- `llm_call_logs=22`.
- Content item status stayed `planned`.
- `draftMarkdown` md5 stayed `9e0921e7edc9e4a8464a0a52ba369d3d`.
- `draftHtml` md5 stayed `a7393df8fb009566201daeea18796027`.
- `draftHtml` length stayed `2789`.
- `qualityScore`, `publishedAt`, and `scheduledAt` stayed unchanged.
- Post-save preflight confirmed duplicate protection with `blogger_draft_already_saved_for_approval`.

Still not implemented:

- Blogger publish.
- Scheduled publish.
- `posts.update`.
- Token refresh.
- Automatic content item status transition.
- Automatic `qualityScore`, `publishedAt`, or `scheduledAt` mutation.
- Additional Blogger draft save for the same approval.

Security/redaction policy confirmed:

- No access token, refresh token, client secret, encrypted value, raw Blogger response body, full `draftHtml`, prompt full text, raw LLM response, or generated candidate full text is exposed in admin DTOs/log metadata.
- `.env.local`, `.env.local.backup*`, and secret backup files must not be read, modified, printed, or staged.

## Patch 9E-4H: Post-save Publish Readiness UX Refresh

Implemented after the 2026-06-16 closeout milestone:

- Improved the content detail Publish Readiness Gate with a post-save status block.
- The UI now separates “Blogger draft save 완료” from actual publish readiness.
- Blogger draft saved state, post id, saved time, manual approval match, duplicate-save protection, and implementation status are shown together.
- Publish Ready and top-level Ready remain visibly false after draft save.
- The UI explains that this is “초안 저장 완료, 발행 구현 전” rather than publish-ready.
- Duplicate save protection is shown as a protective post-save state, not a failure.
- If preflight reports `access_token_expired_reauth_required`, the UI explains that OAuth re-connection is needed before a future Blogger write and that automatic token refresh is not implemented.
- Blogger admin edit/preview links can be derived from publish-readiness metadata when blog id and post id are available.

Policy:

- UI/readiness display only.
- No Blogger API write, additional draft save, publish, scheduled publish, `posts.update`, token refresh, LLM call, schema change, migration, or content item mutation.
- `publishReady=false` and top-level `ready=false` remain the server semantics until publish is explicitly designed and implemented later.

## Patch 9E-5A: Blogger Token Refresh Readiness/Design

Implemented after Patch 9E-4H:

- Clarified the content detail UX for `access_token_expired_reauth_required`.
- The UI now explains that the stored Blogger access token is expired and that future Blogger writes require OAuth re-connection.
- The UI separates token expiry from the already saved Blogger draft: the existing draft remains intact and same-approval duplicate-save protection remains active.
- Added `/settings/blogger` navigation from token-expired readiness notices.
- Documented token refresh readiness policy and required decisions before implementing refresh.
- Kept Draft Save Preflight and Publish Readiness semantics unchanged: expired token keeps `canSaveDraft=false`; post-save publish readiness remains `ready=false`, `publishReady=false`.

Policy:

- No automatic token refresh implementation.
- No refresh token use, token endpoint call, OAuth token exchange call, Blogger write, additional draft save, publish, scheduled publish, `posts.update`, LLM call, schema change, migration, or content item mutation.
- Access token, refresh token, client secret, encrypted value, and raw OAuth response remain redacted and are not exposed in UI/docs/logs/test output.

## Patch 9E-5B: Blogger Draft Update/Retry Policy Planning

Implemented after Patch 9E-5A:

- Added content detail guidance for the post-save Blogger draft update/retry policy.
- The UI now explains that the saved Blogger draft is already protected by same-approval duplicate-save blocking.
- Added policy status labels for draft update planning, retry planning, `posts.update` not implemented, duplicate save blocked, and new approval before draft mutation.
- Documented that saved draft corrections require a later approved policy: `posts.update`, a new approval, or a new draft save.
- Documented retry boundaries: retry may only be considered for limited retryable failures where draft creation is not known to have succeeded.
- Documented non-retry states: already successful approval, token expiry, approval mismatch, content hash mismatch, auth/scope errors, and publish/scheduled publish.
- Added rollback guidance that Blogger `posts.update` changes external service state and should not be treated like a local rollback.

Policy:

- No `posts.update` implementation.
- No retry execution implementation.
- No Blogger API write, additional draft save, publish, scheduled publish, token refresh, LLM call, schema change, migration, or content item mutation.
- Existing Draft Save Preflight and Publish Readiness semantics remain unchanged.

## Patch 9E-6A: Publish / Scheduled Publish Policy Design

Implemented after Patch 9E-5B:

- Added content detail guidance for publish and scheduled publish policy planning.
- The UI now explains that a saved Blogger draft is not publish-ready.
- Publish Ready and top-level Ready remain visibly false after draft save.
- Added planning-only status labels for publish readiness policy, required pre-publish checks, content mutation, and external rollback.
- Documented the difference between immediate publish and scheduled publish.
- Documented future publish preflight requirements: saved draft, blog/post identity, approval snapshot, token status, duplicate/update conflict checks, manual publish approval, side-effect summary, and rollback acknowledgement.
- Documented future scheduled publish requirements: `scheduledAt`, explicit timezone, schedule cancel/update policy, local status/scheduledAt policy, and `sideEffectSummary.scheduledPublish=true`.
- Documented that local `content_items.status`, `publishedAt`, `scheduledAt`, `qualityScore`, and `draftHtml` mutations remain forbidden until a separate approved policy.

Policy:

- No publish implementation.
- No scheduled publish implementation.
- No Blogger publish call, Blogger write, additional draft save, `posts.update`, token refresh, LLM call, schema change, migration, or content item mutation.
- Existing Draft Save Preflight and Publish Readiness semantics remain unchanged.

## Patch 9E-6B: Blogger Publish Preflight Dry-run

Implemented after Patch 9E-6A:

- Added `POST /api/content-items/[id]/publish-preflight` as a read-only dry-run route.
- Added `src/lib/content/publish-preflight.ts` to build the safe publish preflight response model.
- Added Content Detail UI for Publish Preflight Dry-run results.
- The dry-run reports `canPublish=false` and `canSchedulePublish=false`.
- The dry-run reports not-implemented blockers for publish, scheduled publish, publish approval, and local content mutation policy.
- Expired access token metadata is surfaced as `access_token_expired_reauth_required`; no token refresh is performed.
- Existing Blogger draft save, target blog, Blogger post id, approval match, draft hash prefix, and duplicate save protection state are summarized as safe metadata.
- Proposed publish approval snapshot fields are listed for a later schema/approval patch.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- DB schema/migration changes
- LLM calls or `llm_call_logs`

## Patch 9E-6C: Blogger Publish Approval Snapshot Preview

Implemented after Patch 9E-6B:

- Added `POST /api/content-items/[id]/publish-approval-preview` as a read-only snapshot preview route.
- Added `src/lib/content/publish-approval-preview.ts` to build non-secret approval snapshot preview and SHA-256 hash preview.
- Added Content Detail UI for Publish Approval Snapshot Preview.
- The preview reports `canCreatePublishApproval=false`, `canPublish=false`, and `canSchedulePublish=false`.
- The preview reports `publish_approval_persistence_not_implemented` plus publish/scheduled publish not implemented blockers.
- Expired access token metadata is surfaced as `expired_reauth_required` token state and `access_token_expired_reauth_required`; no token refresh is performed.
- Snapshot hash preview is displayed as not persisted and not an approval record.

Not implemented:

- publish approval persistence, table, migration, insert, or update
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-6D: Publish Approval Persistence Policy and Schema Plan

Implemented after Patch 9E-6C:

- Added Content Detail UI guidance for publish approval persistence policy.
- Clarified that the current approval snapshot/hash remains preview-only and is not a DB-stored approval.
- Documented future approval persistence requirements: immutable snapshot, deterministic hash, rollback acknowledgement, side-effect acknowledgement, token state checkedAt, invalidation policy, and publish attempt audit linkage.
- Documented invalidation triggers for draft hash, title, target blog, Blogger post id, schedule/timezone, content status, token state, newer approval, and future `posts.update` flows.
- Documented a recommended dedicated future `blogger_publish_approvals` table and safe non-secret field set.
- Kept stored approval and actual publish execution as separate future steps.

Not implemented:

- publish approval persistence, table, migration, insert, or update
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- DB write/mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7A: Publish Approval Persistence Storage

Implemented after Patch 9E-6D:

- Added Prisma enums `BloggerPublishApprovalMode` and `BloggerPublishApprovalStatus`.
- Added `BloggerPublishApproval` model mapped to `blogger_publish_approvals`.
- Added migration `20260617000100_add_blogger_publish_approvals`.
- Added `src/lib/db/blogger-publish-approvals.ts` for safe approval insert/read/count helpers.
- Added `POST /api/content-items/[id]/publish-approval-save`.
- The save route regenerates the publish approval snapshot server-side and requires the client preview hash to match.
- The save route requires rollback acknowledgement, side-effect summary acknowledgement, and approval persistence acknowledgement.
- Same content/mode/snapshot/schedule active approval can be reused idempotently.
- Updated Publish Approval Snapshot Preview semantics: persistence exists, but explicit save and acknowledgements are required.
- Added Content Detail UI for publish approval storage options, acknowledgement checkboxes, local DB save button, and safe save result summary.
- Stored approval still returns `canPublish=false` and `canSchedulePublish=false`.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- publish execution attempt audit
- LLM calls or `llm_call_logs`

## Patch 9E-7B: Publish Approval Persistence Smoke and Readback

Implemented after Patch 9E-7A:

- Added `POST /api/content-items/[id]/publish-approval-readback` as a read-only saved approval summary route.
- Added latest and active publish approval read helpers.
- Added saved publish approval readback UI on Content Detail.
- Added `existing` to publish approval save response.
- Clarified idempotent save behavior: same active snapshot returns existing approval without creating a duplicate row.
- Verified one local DB publish approval insert smoke.
- Verified idempotent second save keeps `blogger_publish_approvals` count at `1`.
- Kept readback/save results at `canPublish=false` and `canSchedulePublish=false`.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7C: Publish Approval Invalidation and Execution Guard

Implemented after Patch 9E-7B:

- Added `POST /api/content-items/[id]/publish-approval-execution-guard` as a read-only execution guard route.
- Added `src/lib/content/publish-approval-execution-guard.ts` to compare the latest saved publish approval against current content item and Blogger draft metadata.
- Added Content Detail UI for execution guard match summary, invalidation candidates, blockers, required-before-execution gates, and side-effect summary.
- The guard reports `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canPublish=false`, and `canSchedulePublish=false`.
- Invalidation candidates are read-only diagnostics only; this patch does not update `invalidatedAt` or `invalidatedReason`.
- Token expired state remains an execution blocker via `access_token_expired_reauth_required`.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- publish approval invalidation DB update
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7D: Publish Approval Invalidation Dry-run and Policy

Implemented after Patch 9E-7C:

- Added `POST /api/content-items/[id]/publish-approval-invalidation-preview` as a read-only invalidation dry-run route.
- Added `src/lib/content/publish-approval-invalidation-preview.ts` to build dry-run invalidation plans from execution guard results.
- Added Content Detail UI for normal invalidation preview, manual invalidation dry-run reason, dry-run plan, invalidation reasons, blockers, and side-effect summary.
- Normal current-state preview reports `wouldInvalidate=false` and `canInvalidate=false`.
- Manual invalidation dry-run can report `wouldInvalidate=true`, but still keeps `canInvalidate=false`.
- Dry-run plans do not update `invalidatedAt` or `invalidatedReason`.

Not implemented:

- approval invalidation DB update or execution route
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7E: Publish Execution Attempt Preview and Policy

Implemented after Patch 9E-7D:

- Added `POST /api/content-items/[id]/publish-execution-attempt-preview` as a read-only future attempt planning route.
- Added `src/lib/content/publish-execution-attempt-preview.ts` to build planned-only attempt summaries from execution guard and saved approval metadata.
- Added Content Detail UI for publish execution attempt preview, planned attempt summary, blockers, required gates, retry/failure/partial failure policy, redaction policy, content mutation ordering, and side-effect summary.
- Documented future `blogger_publish_execution_attempts` schema fields and status candidates.
- Documented retry eligible, retry blocked, partial failure, redaction, and local content mutation ordering policy.
- The preview reports `attemptStorageImplemented=false`, `wouldCreateAttempt=false`, `canCreateAttempt=false`, `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canPublish=false`, and `canSchedulePublish=false`.

Not implemented:

- publish execution attempt table/model/migration
- publish attempt insert/update
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- approval invalidation DB update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-7F: Publish Execution Attempt Storage

Implemented after Patch 9E-7E:

- Added `BloggerPublishExecutionAttempt` Prisma model mapped to `blogger_publish_execution_attempts`.
- Added migration `20260618000100_add_blogger_publish_execution_attempts`.
- Added `src/lib/db/blogger-publish-execution-attempts.ts` for safe attempt insert/read/count helpers.
- Updated `POST /api/content-items/[id]/publish-execution-attempt-preview` to report `attemptStorageImplemented=true` and include `attemptPlanHashPreview`.
- Added `POST /api/content-items/[id]/publish-execution-attempt-save` for local DB planning-only attempt storage.
- Added `POST /api/content-items/[id]/publish-execution-attempt-readback` for safe saved attempt summaries.
- The save route regenerates the attempt preview server-side and requires the client preview hash to match.
- The save route requires attempt persistence, no Blogger write, and no content mutation acknowledgements.
- Same content/approval/attemptPlanHash returns the existing attempt idempotently.
- Added Content Detail UI for attempt acknowledgements, local DB save, safe save result, and readback summary.
- Stored attempts still return `canExecutePublish=false` and `canExecuteScheduledPublish=false`.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- token refresh or token endpoint call
- approval invalidation DB update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-8A: OAuth Reconnect Gate Before Publish

Implemented after Patch 9E-7F:

- Added `POST /api/content-items/[id]/publish-oauth-gate` as a read-only OAuth gate before future publish execution.
- Added `src/lib/content/publish-oauth-gate.ts` for safe gate summary construction.
- The gate reads safe Blogger connection metadata, selected blog metadata, access token expiry metadata, latest saved publish approval, and latest saved publish execution attempt.
- The gate reports expired access tokens as `expired_reauth_required` with manual reconnect and token-refresh-not-implemented blockers.
- Saved publish approvals and saved execution attempts do not bypass the OAuth gate.
- Added Content Detail UI for `Check Publish OAuth Gate`, blocker/warning lists, `/settings/blogger` reconnect guidance, and side-effect summary.
- Publish preflight and execution attempt required-before-execution copy now explicitly include the OAuth gate.

Not implemented:

- OAuth reconnect execution, OAuth callback/token exchange call, or token refresh
- Blogger publish or scheduled publish
- Blogger API write, `posts.update`, `posts.insert`, or additional draft save
- approval invalidation DB update or attempt status update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-8B: Manual OAuth Reconnect Completion Gate

Implemented after Patch 9E-8A:

- Extended the existing `POST /api/content-items/[id]/publish-oauth-gate` route instead of adding a second OAuth readiness route.
- Added `manualReconnectCompletionSummary` to describe what must be rechecked after a user manually reconnects OAuth in `/settings/blogger`.
- The summary checks safe metadata for Blogger connection existence, selected blog presence, selected blog vs saved approval target, access token state, saved publish approval validity, saved publish execution attempt planning-only status, content status, draft hash match, and target blog match.
- The response keeps `canExecutePublish=false`, `canExecuteScheduledPublish=false`, `canProceedToPublishExecution=false`, and `canProceedToScheduledPublishExecution=false`.
- `final_publish_preflight_not_implemented` and `publish_execution_still_disabled_until_final_preflight` remain blockers even when the reconnect completion gate becomes otherwise ready.
- Content Detail UI now shows a Manual Reconnect Completion Readiness block with blockers, warnings, safe match booleans, and side-effect summary.
- Documented 9F operation automation roadmap direction: Blog Operation Profile, default policy, and exception-focused dashboard instead of repeated manual configuration.

Not implemented:

- OAuth reconnect execution, OAuth callback/token exchange call, or token refresh
- Blogger publish or scheduled publish
- Blogger API read/write, `posts.update`, `posts.insert`, or additional draft save
- approval invalidation DB update or attempt status update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls or `llm_call_logs`

## Patch 9E-8C: Final Publish Execution Preflight Summary

Implemented after Patch 9E-8B:

- Extended the existing `POST /api/content-items/[id]/publish-oauth-gate` route instead of adding a separate final preflight route.
- Added `finalPublishExecutionPreflightSummary` to integrate publish approval, publish execution attempt, OAuth gate, manual reconnect completion readiness, content snapshot/hash, target blog snapshot, rollback/safety acknowledgement placeholders, blockers, warnings, and side-effect summary.
- The final summary reports `canProceedToPublishExecution=false`, `canProceedToScheduledPublishExecution=false`, and `canExecutePublish=false`.
- Current expired-token state keeps `access_token_still_expired_reauth_required` and `manual_reconnect_completion_not_ready` blockers.
- Guarded Blogger publish implementation, final human approval, rollback acknowledgement, and external write risk acknowledgement remain blockers.
- Added Content Detail UI for Final Publish Execution Preflight status, snapshot match booleans, acknowledgement placeholders, blockers, warnings, and side-effect summary.
- Kept the 9F operation automation roadmap note: Blog Operation Profile, default policy, and exception-focused dashboard instead of repeated manual configuration.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API read/write, `posts.update`, `posts.insert`, or additional draft save
- OAuth reconnect execution, OAuth callback/token exchange call, or token refresh
- publish approval insert/update/invalidation or publish execution attempt insert/update
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls, `llm_call_logs`, deploy, push, or external service writes

## Patch 9E-9A: Guarded Blogger Publish Execution Design

Implemented after the 9E-8D post-reconnect validation milestone:

- Extended the existing `POST /api/content-items/[id]/publish-oauth-gate` route instead of adding a new publish execution design route.
- Added `guardedPublishExecutionDesignSummary` as a read-only design summary for the future guarded Blogger publish execution patch.
- The summary reports the current final preflight status, approval/attempt ids, draft save id, target Blogger blog metadata, existing Blogger post id, planned operation kind, planned Blogger API action, redacted request plan, failure policy draft, and side-effect boundary.
- The summary keeps `guardedPublishImplementationReady=false`, `canProceedToPublishExecution=false`, `canProceedToScheduledPublishExecution=false`, and `canExecutePublish=false`.
- The post-reconnect/final-preflight-ready path now removes the old `final_publish_preflight_not_implemented` and `publish_execution_still_disabled_until_final_preflight` blockers from the manual reconnect completion taxonomy.
- Guarded publish implementation, rollback acknowledgement, external write risk acknowledgement, and final human approval remain blockers.
- Added Content Detail UI for the guarded publish design summary, redacted request plan, future implementation/execution requirements, failure policy, blockers, warnings, and side-effect summary.

Not implemented:

- Blogger publish or scheduled publish
- Blogger API read/write, `posts.update`, `posts.insert`, or additional draft save
- OAuth reconnect execution, OAuth callback/token exchange call, or token refresh
- publish approval insert/update/invalidation or publish execution attempt insert/update/execution
- content item status, `publishedAt`, `scheduledAt`, `qualityScore`, `draftHtml`, or `draftMarkdown` mutation
- LLM calls, `llm_call_logs`, deploy, push, or external service writes

## Patch 9F-7A: Second Fixture Operator Approval Persistence

Applied after Patch 9F-6C with explicit user approval:

- Used existing guarded route `POST /api/daily-content-plans/operator-approvals`.
- Created one operator approval row for second fixture `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Created one operator approval event row for the approval.
- Approval id: `cmr7uxdkd00015las7kqwfyr7`.
- Approval event id: `cmr7uxdkt00035lash5ttj6hz`.
- Follow-up preview confirmed `existingApprovalFound=true` and execution gate preview confirmed `operatorApprovalSatisfied=true`.

Not executed or not implemented:

- LLM calls, `llm_call_logs`, draft Markdown/HTML generation, content item mutation, Blogger API read/write, draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, or external service write.

## Patch 9F-6C: Next Draft-generation Readiness

Implemented after Patch 9F-6B apply:

- Added `POST /api/daily-content-plans/next-draft-generation-readiness`.
- Added a read-only helper that reads `next-item-readiness`, targets the newly linked second fixture, and reuses the existing draft-generation readiness preflight.
- The route is intended to confirm structural readiness for the next planned fixture and identify `9F-7A` as the next approval-gated step.

Not executed or not implemented:

- Operator approval persistence, LLM calls, `llm_call_logs`, content item mutation, draft Markdown/HTML generation, Blogger API read/write, draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, or external service write.

## Patch 9F-6B: Gated Next Daily Content Item Fixture

Implemented after Patch 9F-6A:

- Added `POST /api/daily-content-plans/next-content-item-fixture`.
- Added a gated helper for previewing and, with explicit operator controls, creating/linking one planned content item fixture for the next unlinked daily plan item.
- Apply mode requires `BLOG_DAILY_NEXT_CONTENT_ITEM_FIXTURE_WRITE_ENABLED=true`, exact confirmation phrase, and deterministic idempotency key.
- Preview mode and feature-flag-disabled negative checks perform DB reads only.
- After explicit user approval, applied the gate once for plan item `cmqlr1v1y0002iwj27df8ac5a`, creating/linking fixture content item `daily_fixture_cmqlr1v1y0002iwj27df8ac5a`.
- Adjusted next-item readiness selection so the earliest non-published/non-scheduled item in item order is selected after linking; it now recommends `9F-6C` for the newly linked planned fixture.

Not executed or not implemented:

- No draft Markdown/HTML generation, LLM call, `llm_call_logs`, Blogger API read/write, draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, or external service write occurred.

## Patch 9F-6A: Next Daily Item Readiness Readback

Implemented after Patch 9F-5:

- Added `POST /api/daily-content-plans/next-item-readiness`.
- Added a read-only next daily item readiness helper that summarizes the latest daily content plan, linked content statuses, safe draft body hashes, published milestone audit counts, and the next recommended plan item action.
- The response recommends `9F-6B` for gated next content item fixture creation/linking, `9F-6C` for restarting the draft pipeline on an existing planned item, or `manual_review` when the next item is unsafe or missing.

Not executed or not implemented:

- Content item creation/linking, daily plan mutation, approval/attempt/artifact mutation, LLM calls, `llm_call_logs`, Blogger API read/write, draft save, publish, scheduled publish, OAuth reconnect, token refresh, deploy, push, or external service write.
- Full `draftMarkdown`/`draftHtml` bodies, prompts, raw responses, tokens, secrets, encrypted values, and raw Blogger response bodies are not returned.

## Patch 9E-9B: Guarded Blogger Publish Execution Route

Implemented after Patch 9E-9A:

- Added `POST /api/content-items/[id]/guarded-publish-execution`.
- Added `src/lib/content/guarded-publish-execution.ts` to validate approval, attempt, content hashes, target Blogger blog, Blogger post id, OAuth gate, final preflight, feature flag, confirmation phrase, and acknowledgements.
- Added `src/lib/blogger/publish-post.ts` as the guarded Blogger `posts.publish` wrapper. It returns safe redacted metadata only and does not expose access tokens, request bodies, raw Blogger response bodies, or full `draftHtml`.
- The route defaults to `mode=dry_run`; dry-run performs DB reads only, never calls Blogger, never writes DB rows, and keeps `canExecutePublish=false`.
- Live mode is code-gated by `BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=true`, exact phrase `I_UNDERSTAND_THIS_WILL_PUBLISH_TO_BLOGGER`, matching approval/attempt/hash/blog/post metadata, OAuth/final-preflight readiness, rollback acknowledgement, external write risk acknowledgement, and final human approval.
- Content Detail UI now includes a Guarded Publish Execution dry-run button/result block. It does not expose a live publish button.
- Existing publish OAuth gate copy now reflects that the guarded route is implemented but live publish remains disabled by default.
- Current expired OAuth state is handled as a safe blocker rather than a patch blocker.

Validation notes:

- Dry-run smoke returns `implementationStatus=implemented_live_guarded`, `liveExecutionAttempted=false`, `liveExecutionBlocked=true`, `dryRunOnly=true`, and write side effects false.
- Live negative smoke with feature flag disabled returns `liveExecutionAttempted=false`, `bloggerWrite=false`, `bloggerPublish=false`, and `dbWrite=false`.
- No live Blogger publish/write smoke was executed in this patch.
- DB/hash/count guard remains unchanged.

Not implemented or not executed:

- Live Blogger publish/write smoke
- Blogger `posts.update`, additional draft save, OAuth reconnect, token refresh, deploy, push, or external service write
- `content_items.status`, `publishedAt`, `scheduledAt`, `draftMarkdown`, `draftHtml`, or `qualityScore` mutation
- publish result readback/reconciliation and post-publish content mutation, both deferred to later patches

## Patch 9E-9B-LIVE-READY: Deferred Content Mutation Taxonomy

Implemented after Patch 9E-9B:

- Moved `content_mutation_deferred_to_post_publish_patch` out of guarded publish execution hard blockers.
- Exposed the deferred `content_items` status/publishedAt mutation as a warning and `postPublishDeferredActions` metadata instead.
- Updated the Content Detail guarded publish execution result block so the deferred content mutation appears as a post-publish next step, not a Blogger publish call blocker.
- Kept `canExecutePublish=false`; live publish remains gated by feature flag, exact confirmation phrase, acknowledgements, OAuth/final preflight readiness, and request metadata matches.

Not executed:

- Live Blogger publish/write, Blogger `posts.update`, additional draft save, OAuth reconnect, token refresh, deploy, push, external service write, content item mutation, approval/attempt mutation, or LLM call.

## Patch 9E-9C: Publish Result Readback And Reconciliation Preview

Implemented after the 9E-9B-LIVE successful Blogger publish smoke:

- Added `src/lib/blogger/read-post.ts` for Blogger `posts.get` read-only post readback with redacted safe metadata only.
- Added `POST /api/content-items/[id]/publish-result-readback`.
- Added a read-only reconciliation preview that compares saved approval, saved publish attempt, successful draft save, content item state, target Blogger blog/post id, and Blogger readback metadata.
- The preview reports external Blogger state, internal DB state, match booleans, deferred mutation warnings, and a proposed 9E-9D content/attempt reconciliation plan.
- Content Detail UI now includes a Publish Result Readback button/result block.

Not executed or not implemented:

- Blogger publish/write, Blogger `posts.update`, additional draft save, OAuth reconnect, token refresh, content item mutation, approval mutation, attempt mutation, deploy, push, external service write, or LLM call.
- 9E-9D is still required before local `content_items.status`/`publishedAt` or publish attempt response fields are updated.

## Patch 9E-9C-R1: Blogger OAuth Token Refresh

Implemented after Patch 9E-9C:

- Added `src/lib/blogger/token-refresh.ts` for Google OAuth refresh-token grant.
- Added `POST /api/settings/blogger/[id]/refresh-token`.
- Added `/settings/blogger` Access Token Refresh UI with safe refresh summary, blockers, warnings, and side-effect summary.
- Updated publish OAuth gate summaries to report `tokenRefreshImplemented=true` while keeping automatic refresh out of the gate for R1.
- Refresh success can update only encrypted Blogger token secret storage and connection token metadata.
- Refresh failure returns safe blocker codes such as `token_refresh_invalid_grant_reconnect_required` or `token_refresh_unauthorized_client`.

Not executed or not implemented:

- Blogger publish/write, Blogger `posts.update`, additional draft save, content item mutation, publish approval mutation, publish execution attempt mutation, LLM call, deploy, push, or external service write beyond the Google OAuth token endpoint.
- R1 does not automatically refresh from publish readback or guarded publish execution; that remains a candidate for 9E-9C-R2.
## Patch 9G-8B: Daily UpSignal Live Capture And Guided Run-All

Implemented after Patch 9G-8A:

- Added Playwright as a dev dependency for Daily UpSignal screenshot capture.
- Hardened Daily Brief captures with target metadata, selector-used metadata, capture dimensions, and safe placeholder fallback warnings.
- Added capture profiles for the Korean signal board, top stock signal-chart area, and ETF signal board.
- Improved UpSignal stock/ETF parsing by preferring embedded page data for symbol, name, price, entry, target, stop-loss, score, and detail URLs, with the previous HTML-link parser kept as fallback.
- Added Daily Brief generation readiness checks before content item creation.
- Enabled `POST /api/daily-brief/runs/[runId]/run-all` to execute the staged read-only collection flow and then create the local content item/draft when readiness passes.
- Improved `/wizard/daily-brief` with a one-button “전체 준비 실행” flow, capture mode/count/selector display, and safety copy.

Not implemented or not executed:

- Blogger draft save, Blogger publish, scheduled publish, token refresh, OAuth reconnect, LLM calls, `llm_call_logs`, external writes outside read-only web fetches and local content item/asset creation.
- Investment recommendation, competitor article copying, or raw news/article body storage.

## Patch 9G-9A: Daily Brief Web Scheduler Foundation

Implemented after Patch 9G-8B:

- Added `/automation/daily-brief` for browser-based Daily Brief schedule management.
- Added server-process scheduler APIs under `/api/automation/daily-brief/scheduler`.
- The scheduler runs inside the Next.js Node process and checks the configured time every minute while the web server remains running.
- Added persisted local scheduler config/state under `local-data/daily-brief-scheduler`.
- Added a safe `run-now` path that uses the same Daily Brief run-all implementation and blocks duplicate generation when a Daily Brief content item already exists for the same market date.
- Refactored Daily Brief run-all into `src/lib/daily-brief/run-all.ts` so manual UI and scheduler execution share one path.

Not implemented or not executed:

- External cron/launchd registration.
- Automatic Blogger draft save, Blogger publish, scheduled publish, token refresh, OAuth reconnect, LLM calls, or `llm_call_logs`.
- Automatic duplicate publishing or same-day repeated Daily Brief generation from the scheduler.

## Patch 9G-9B: Daily Brief Guarded Blogger Automation Modes

Implemented after Patch 9G-9A:

- Added Daily Brief scheduler modes: `content_only`, `draft_save_only`, and `publish_live_guarded`.
- Added a guarded Daily Brief publish automation orchestrator that reuses existing internal API guards in order: Blogger draft approval, guarded draft save, publish approval preview/save, publish execution attempt preview/save, and guarded publish execution.
- Kept `content_only` as the default mode.
- `publish_live_guarded` only attempts live publish when `BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED=true`, `BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION=I_UNDERSTAND_THIS_WILL_PUBLISH_TO_BLOGGER`, and the existing `BLOGGER_GUARDED_PUBLISH_LIVE_ENABLED=true` flag are all present.
- Updated `/automation/daily-brief` to display and save automation mode, last automation result, blockers, Blogger post id/url, and live publish attempt status.
- Daily Brief content generation now creates a primary 1200x630 SVG SEO thumbnail asset with stock-market visual styling, large Korean title copy, date, and top stock names, then places it as the first hero media block in the generated Markdown/HTML.
- Blogger draft save now checks publishable HTML asset URLs before write. If local `/api/content-assets/.../file` image URLs remain and no non-local `BLOGGER_PUBLIC_ASSET_BASE_URL` / `BLOG_PUBLIC_BASE_URL` / `NEXT_PUBLIC_APP_URL` is configured, draft save is blocked instead of creating a Blogger post with broken images.
- Local startup now limits the Prisma connection pool for the dev server and starts a fresh log file, so thumbnail/image asset endpoints are less likely to fail from stale connection pressure or old fatal log patterns.

## Patch 9G-8A~8D: Blogger Publish Readiness Setup UX

Implemented after Patch 9G-9B:

- Changed the default local Blogger OAuth redirect origin from port 3013 to port 3004, matching the fixed local web server port.
- Added explicit Google OAuth redirect URI guidance to `/settings/blogger` so `redirect_uri_mismatch` can be fixed by copying the exact callback URI into Google Cloud Console.
- Added Blogger public asset URL guidance to `/settings/blogger`; Blogger image publishing requires a non-local `BLOGGER_PUBLIC_ASSET_BASE_URL` before draft save/publish can proceed with generated thumbnails and screenshots.
- Updated `start.sh` to pass non-secret Blogger public asset/OAuth redirect environment values into the background dev server process.
- Updated `check.sh --json` to expose non-secret Blogger public asset/OAuth redirect readiness fields for external monitoring.
- Expanded Content Detail Blogger Draft Payload Preview and Draft Save Preflight UI with public asset URL conversion status, local/converted/unresolved asset URL counts, and first-image thumbnail detection.
- Added action-item mapping for `blogger_public_asset_base_url_required` and `blogger_local_asset_urls_unresolved`.

Not executed:

- Blogger draft save, Blogger publish, scheduled publish, `posts.update`, token refresh, OAuth reconnect, LLM call, or content item mutation.
- Manual draft approval regeneration remains blocked until public asset URL and OAuth readiness are satisfied for the current Daily Brief draft.

## Patch 9G-10A: Daily Brief SEO Pre-Generation Hardening

Implemented:

- Daily Brief Markdown generation now adds an early "오늘 핵심 요약" section before the signal board section to improve first-screen search intent match and reader retention.
- Stock detail sections now use safer Korean topic particles, normalize the truncated `한국타이어앤테크놀로` display name, and include price-distance commentary for entry, target, and stop-loss levels.
- Stock detail sections now vary commentary by rough topic/sector such as beauty/consumer, air transport, financial, auto parts, and energy instead of repeating the same generic paragraph for every stock.
- Research fallback items no longer render as `(search_link)` placeholder text. They render as a real "네이버 뉴스 검색" Markdown link with a safe summary.
- Daily Brief readiness now reports `news_search_link_fallback_present` as a warning when real news extraction falls back to a search-result link.

Not executed or not implemented:

- No Blogger draft save, Blogger publish, scheduled publish, token refresh, OAuth reconnect, external write, LLM call, or `llm_call_logs` creation.
- Existing content items are not automatically overwritten by this generation hardening patch.

## Patch 9G-10B: Blogger UI Publish Export Guard

Implemented after Patch 9G-10A:

- Added `scripts/blogger_ui_publish_content_item.mjs` as a guarded local export/calibration path for Daily Brief posts when a public image hosting base URL is not available.
- The script reads a saved `content_items.draftHtml`, copies attached `content_assets` into `local-data/blogger-ui-publisher/{contentItemId}/assets`, and writes `post.html`, `post-title.txt`, `manifest.json`, and `index.html`.
- Exported HTML rewrites local `/api/content-assets/.../file` references to copied local `assets/...` references so the package can be inspected without localhost asset URLs.
- Added a Playwright `--open-browser` calibration mode that opens the exported preview and Blogger in a persistent local browser profile.
- The default `--dry-run` mode performs no Blogger API write, Blogger UI write, publish, token refresh, OAuth reconnect, LLM call, or content item mutation.

Not implemented or not executed:

- Automatic Blogger UI image upload, post creation, or publish clicking.
- Blogger API draft save/publish, scheduled publish, external asset hosting, token refresh, OAuth reconnect, or LLM calls.

## Patch 9G-10C: Blogger UI Publish Automation Wiring

Implemented after Patch 9G-10B:

- Extended `scripts/blogger_ui_publish_content_item.mjs` with guarded `--live-ui` and `--publish` modes.
- `--live-ui` requires the exact confirmation phrase `I_UNDERSTAND_THIS_USES_BLOGGER_WEB_UI_TO_PUBLISH`.
- The runner opens Blogger with a persistent Playwright browser profile, attempts to fill the post title and body HTML, and can click publish only when `--publish` is also supplied.
- For the no-external-hosting path, copied local images are converted to inline `data:` image URLs before Blogger UI insertion.
- Added scheduler integration: when `BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD=blogger_ui` and the Blogger UI auto-publish confirmation flags are set, `publish_live_guarded` mode calls the Blogger UI runner instead of the API draft/publish path.
- Updated `start.sh` to pass Blogger UI automation method/feature flags into the background server process, and default them when saved scheduler mode is `publish_live_guarded`.
- Updated `check.sh --json` to expose non-secret Blogger UI publish method/readiness fields.

Safety:

- Confirmation-less `--live-ui --publish` is blocked before opening Blogger.
- Blogger API publish/draft-save, token refresh, OAuth reconnect, LLM calls, and content item mutation are not performed by the UI runner.
- Actual Blogger UI publish still depends on a logged-in persistent browser profile and Blogger editor selector compatibility.

Not executed or not implemented:

- This patch does not enable live publish by default.
- No scheduled publish, `posts.update`, token refresh, OAuth reconnect, LLM call, or content item status/publishedAt mutation was added.

## Patch 9G-10D: API Publish Path Token Refresh Default

Implemented after the Blogger UI live calibration attempt:

- Changed the saved scheduler live-publish default from Blogger UI automation to the guarded Blogger API path by using `BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD=api` unless `blogger_ui` is explicitly configured.
- Updated `check.sh --json` to report `api` as the inferred live-publish method for enabled `publish_live_guarded` scheduler configs.
- Blogger draft payload preview and draft-save preflight now report `tokenRefreshImplemented=true`.
- Draft-save preflight no longer treats an expired access token as a hard reconnect blocker when a refresh token, client secret, and secret encryption configuration are available.
- Guarded live publish now attempts a safe OAuth access-token refresh before building the final live publish gate when the saved access token is expired.
- Draft save and guarded publish access-token resolution can recover from a missing/expired access token via the stored refresh token before requiring manual reconnect.

Safety:

- Dry-run paths still perform no token refresh, Blogger write, publish, or content mutation.
- Live token refresh can write only updated encrypted token material and OAuth status metadata; it does not expose token values.
- Blogger UI automation remains opt-in only via `BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD=blogger_ui`.
- Blogger publish is still blocked by publishable-image URL readiness until local image asset URLs are replaced with a Blogger-accessible public URL.

## Patch 9G-10E: Inline Data URL Image Publish Probe

Implemented and tested after Patch 9G-10D:

- Added an optional `BLOGGER_IMAGE_EMBED_MODE=inline_data_url` / `BLOGGER_ASSET_EMBED_MODE=inline_data_url` fallback.
- When enabled, Blogger publishable HTML converts local `/api/content-assets/{id}/file` image URLs into inline `data:{mime};base64,...` URLs using the saved local asset files.
- Publishable HTML safe metadata now reports:
  - `imageEmbedMode`
  - `inlineDataUrlAssetCount`
  - `inlineDataUrlByteCount`
  - `inlineDataUrlEstimatedHtmlBytes`
- Safe metadata redacts data URL bodies; the API/UI summary never returns full base64 image content.
- Draft payload preview/preflight can become ready without `BLOGGER_PUBLIC_ASSET_BASE_URL` when inline mode is explicitly enabled.

Live probe result:

- Content item `cmrehm0qc00015l2hhx65ifpf` reached `draftPayloadReady=true` with 8 inline image data URLs.
- Inline image payload size was approximately 1.65 MB raw image bytes and 2.2 MB estimated HTML data URL content.
- A guarded Blogger draft save was attempted once.
- Blogger rejected the draft save with HTTP 400 (`blogger_api_request_failed`).
- No Blogger post id/url was returned, and no publish call was made.
- `llm_call_logs` did not increase.

Conclusion:

- Inline data URL mode is useful as a diagnostic fallback but is not currently a reliable Blogger API publishing strategy.
- Keep inline mode opt-in only; do not enable it as the default daily auto-publish path.
- The recommended stable path remains a Blogger-accessible public image URL/asset host before guarded draft save/publish.

## Patch 9G-10F: Compressed Data URL Blogger Image Path

Implemented and tested after the full inline image probe:

- Added `BLOGGER_IMAGE_EMBED_MODE=compressed_jpeg_data_url`.
- In this mode, local Blogger publishable image URLs are converted to inline data URLs, but PNG/JPEG assets are first compressed to 900px JPEG at quality 45 using the local macOS image toolchain.
- `start.sh` now defaults `BLOGGER_IMAGE_EMBED_MODE` to `compressed_jpeg_data_url` so the Daily Brief guarded API path can run without a separate public asset host.
- `check.sh --json` reports the default image embed mode for monitoring.
- Safe metadata continues to redact base64 image bodies and reports only counts/byte totals.

Probe results:

- Public HTTPS image URL probe succeeded with guarded Blogger draft save.
- Tiny data URL probe succeeded with guarded Blogger draft save.
- Full-size PNG data URL probe failed with Blogger HTTP 400, confirming that large inline image payloads are not reliable.
- Compressed JPEG data URL probe succeeded with guarded Blogger draft save.
- The original Daily Brief item `cmrehm0qc00015l2hhx65ifpf` reached `canSaveDraft=true` with `imageEmbedMode=compressed_jpeg_data_url`, 8 inline image assets, 428,251 inline image bytes, and 0 unresolved local asset URLs.
- Guarded Blogger draft save succeeded for the original Daily Brief item with Blogger post id `8156328059408743742`.

Safety:

- No Blogger publish call was made in this patch.
- No scheduled publish, `posts.update`, LLM call, or content item status/publishedAt mutation was performed.
- `llm_call_logs` did not increase during the image publish probes.

## Patch 9G-10G: Daily Brief Personal Blog Tone Tuning

Implemented after the first live Daily Brief publish review:

- Changed the deterministic Daily Brief Markdown template from a stiff report tone to a personal morning-briefing blog tone.
- Replaced the "상위 3개가 먼저 보이는 이유" section with "오늘의 투자매력도 TOP 3".
- Reduced repetitive numeric prose such as "단순 여력" and moved numbers back to tables/charts where they are easier to scan.
- Kept the safer boundary between recommendation-style commentary and direct buy/sell instructions:
  - allowed: "오늘 먼저 볼 만한 종목", "투자매력도 TOP 3", "제 기준에서 눈에 들어온 종목"
  - still avoided: direct buy/sell commands, guaranteed returns, or certain price predictions
- Moved the article voice toward "같이 차트와 정보를 보며 살펴보는" explanations.
- Increased compressed JPEG data URL output quality from 900px/quality 45 to 1300px/quality 70, with a larger safe total inline budget, so Blogger-published screenshots are more readable.

Safety:

- This patch changes generated article wording and image compression policy only.
- It does not call LLM, Blogger draft save, Blogger publish, token refresh, OAuth reconnect, or mutate existing content items by itself.

## Patch 9G-10H: Daily Brief Human Investor Blog Voice

Implemented after reviewing the republished Daily Brief tone:

- Reworked the deterministic Daily Brief article template further away from data listing and toward a human Korean investor-blog voice.
- Renamed report-like sections:
  - `오늘 핵심 요약` -> `오늘 아침 브리핑`
  - `오늘의 한국장 시그널보드 요약` -> `오늘 보드는 이렇게 읽었습니다`
  - `TOP n 관심종목 요약표` -> `오늘 리스트 먼저 보기`
  - `상위 5개 종목 상세 체크` -> `종목별로 제가 보는 포인트`
- Rewrote stock sections so each stock starts with a conversational thesis, then price position, sector context, news/disclosure links, and a practical wrap-up.
- Reduced defensive language near the top of the post and kept investment responsibility/disclaimer copy at the end.
- Updated thumbnail footer copy from `정보성 참고자료` to `오늘 장 전 체크리스트 · 판단은 내 기준으로`.

Safety:

- The template may use confident personal-blog phrases, but still must not say `매수하세요`, `매도하세요`, promise returns, or state that a target price will definitely be reached.
- This patch changes generated wording only. It does not call LLM, Blogger draft save, Blogger publish, token refresh, OAuth reconnect, or mutate existing content items by itself.

## Patch 9G-10I: Daily Brief Screenshot Resolution Bump

Implemented after reviewing published screenshot readability:

- Daily Brief live captures now use Playwright `deviceScaleFactor=2` so board/chart screenshots are captured at higher pixel density.
- Capture metadata records the effective high-resolution pixel dimensions for selector and fallback captures.
- Blogger compressed inline image mode now uses JPEG max dimension `1200px` and quality `68`.
- The capture source remains high-density, but the Blogger inline payload is downsampled to stay below Blogger API limits.
- The compressed inline total budget is `2MB` to preserve a hard payload guard.

Safety:

- This patch affects future captures and future Blogger publishable HTML conversion only.
- It does not re-capture, regenerate, draft-save, publish, token-refresh, OAuth reconnect, or mutate existing content items by itself.
- A `1600px` / quality `78` probe produced a roughly 2.8MB base64 HTML image payload and Blogger rejected the draft save with HTTP 400; keep the safer `1200px` / quality `68` setting unless a public asset host is used.

## Patch 9G-10J: Tistory HTML Export Package

Implemented a Tistory-oriented manual export path:

- Added `POST /api/content-items/[id]/tistory-export`.
- The export reads saved `draftHtml` and attached content assets, then writes a local package under `local-data/tistory-export/{contentItemId}`.
- The package includes `post.html`, `post-inline.html`, `post-title.txt`, `manifest.json`, copied `assets/`, and a browser preview under `public/generated-previews/`.
- Content Detail now has a `Tistory HTML Export` section with a `티스토리 HTML 저장` button and a local preview link.
- This is a manual copy/paste bridge for Tistory editor use, not Tistory API publishing.

Safety:

- Tistory API write, Blogger API write, publish, token refresh, LLM calls, and content item mutation remain false.
- Full inline image bodies are written only to local files and are not returned in the API response or logs.

## Patch 9G-11: Tistory Recent-Signal Review Generator

Implemented a separate Tistory-oriented review generator for Daily Brief runs:

- Added a Daily Brief run route for generating a Tistory signal review content item and local Tistory HTML export package.
- The selection policy checks KR TOP 20 recent signal dates:
  - 3+ recent signals -> stock signal TOP3 focused review
  - 1-2 recent signals -> mixed stock + ETF review
  - 0 recent signals -> ETF/sector review
- The generated Tistory body is intentionally different from the Blogger Daily Brief and uses a more conversational investor-review voice.
- The review uses UpSignal chart/ETF screenshots, safe news/disclosure links, and local Tistory export artifacts.
- Daily Brief wizard now exposes a `티스토리 신호 리뷰 생성` action and links to the exported preview/edit/detail pages.

Safety:

- This path does not call Tistory API, Blogger API, Blogger draft save, Blogger publish, scheduled publish, token refresh, or LLM.
- It creates local DB content/assets and local export files only after the user explicitly runs the action.

## Patch 9G-12: project300 Tistory Channel Packaging

Added project300-specific packaging for the Tistory export path:

- Added a project300 Tistory profile with recommended category tree:
  - `급등포착 분석자료 > 오늘의 관심종목 리뷰`
  - `급등포착 분석자료 > 종목별 신호 집중분석`
  - `급등포착 분석자료 > ETF/섹터 흐름 리뷰`
  - `급등포착 분석자료 > 선물·옵션 시그널 기록`
- Tistory HTML export now writes extra operator files:
  - `project300-category.txt`
  - `project300-tags.txt`
  - `project300-upload-checklist.md`
- Tistory export responses now include recommended project300 category, tags, duplicate-content policy, and tone policy.
- Content Detail shows those project300 upload hints after export.
- Daily Brief Tistory signal review content items now record project300 target blog/category hints in `planJson` and `sourceMemo`.

Safety:

- This patch is still manual-export only.
- No Tistory API write, Blogger API write, draft save, publish, token refresh, OAuth reconnect, or LLM call is performed.

## Patch 9G-15/16: Project300 Style Review And GPT CLI Rewrite Loop

Added the Project300 post-generation review/rewrite foundation:

- Added deterministic Project300 style/SEO review scoring for generated Tistory Markdown.
- Added category-specific voice variation so daily posts do not reuse the exact same headings every day.
- Added `GPT CLI` as a distinct LLM provider type in settings.
- Added `POST /api/content-items/[id]/project300-style-rewrite-preview`.
- The route is preview-only by default. GPT CLI execution requires:
  - `PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED=true`
  - confirmation phrase `PROJECT300 GPT CLI REWRITE`
  - a ready `style_rewrite` route using a `gpt_cli` provider.
- GPT CLI logs store only safe metadata such as prompt/response hash, length, score, phase, and iteration.

Safety:

- The new review route does not publish to Tistory/Blogger.
- It does not mutate content items.
- It does not store prompt, raw response, or candidate Markdown in `llm_call_logs` metadata.

## Patch 9G-16A: Project300 Voice Anchor And Required CTA

Refined the Project300 writing profile after comparing against the user's MACD/system-trading sample:

- Updated the style profile to honorific explanatory blog style rather than banmal memo style.
- Stored representative Project300 voice anchor lines for GPT CLI review/rewrite prompts.
- Added required CTA policy for all Project300 categories:
  - If losses are frequent, do not trade only by feel.
  - Use UpSignal to check trade timing, entry, target, and stop 기준.
  - Keep wording as safe guidance, not return guarantee or buy/sell instruction.
- Renamed the fourth Project300 category from `시스템 개선 기록` to `선물·옵션 시그널 기록`.
- Updated deterministic review to warn on banmal memo tone, report tone, service marketing tone, repeated phrasing, and missing CTA.

## Patch 9G-16B: Project300 Three-Category Readiness Smoke

Prepared and verified the Project300 Tistory flow for the three active categories while excluding the unfinished futures/options signal category:

- Configured a `GPT CLI Final Reviewer` provider and `style_rewrite` task route for preview-gated Project300 review/rewrite.
- Generated three local Tistory review samples:
  - `mixed_stock_etf_review`
  - `stock_signal_top3_review`
  - `etf_sector_review`
- Verified each sample writes a local Tistory HTML export preview and uses high-resolution UpSignal chart/ETF assets.
- Updated Project300 style review so content assets count toward image requirements, avoiding false `image_count_too_low` warnings when images are inserted by the renderer rather than Markdown image syntax.
- Preview-only GPT CLI review gates reported ready route/provider state without calling the LLM.

Safety:

- No Tistory API write, Blogger API write, Blogger draft save, publish, scheduled publish, token refresh, or OAuth reconnect was performed.
- GPT CLI rewrite remained preview-gated and did not call the LLM during the smoke.

## Patch 9G-16C: Project300 Narrative Pattern Bank

Improved the generated Project300 Tistory prose after preview review:

- Added stock narrative pattern bank with 10 human-style explanation flows.
- Added ETF narrative pattern bank with 10 market-direction briefing flows.
- Each stock/ETF block now chooses a stable pattern from market date, code, and name, so posts vary without random output drift.
- Stock sections now include natural UpSignal and stock detail links in the prose.
- ETF sections now avoid stiff explainer language and read more like a personal market briefing.
- Style review now flags the old mechanical phrases:
  - `위 차트에서 제가 먼저 보는 건`
  - `첫 번째 체크는`
  - `세 번째는 뉴스와 공시`
  - `ETF는 개별 종목처럼...`

Safety:

- This patch changes future generated wording and review warnings only.
- It does not publish to Tistory/Blogger, call LLM, save Blogger drafts, refresh tokens, or mutate existing content items by itself.

## Patch 9G-16D: Project300 Cross-Category Internal Links

Added Project300 category circulation links inside generated Tistory articles:

- Added Tistory category URL helpers for:
  - `오늘의 관심종목 리뷰`
  - `종목별 신호 집중분석`
  - `ETF 섹터 흐름 리뷰`
  - `선물·옵션 시그널 기록`
- Generated posts now include a mid-article `같이 보면 좋은 급등포착 기록` section.
- The section links readers across the four Project300 categories.
- Futures/options references are conditional while that signal source is incomplete:
  - e.g. Nasdaq futures buy timing can later explain why US ETF signals become more attractive.
  - Current generated posts do not claim that a futures/options signal occurred today unless source data exists.

Safety:

- This patch changes future generated article structure only.
- It does not call Tistory/Blogger APIs, publish, refresh tokens, or call LLM.
# Patch 9G-Style-1C~1J

- FACT/SYSTEM/JUDGMENT/ACTION 기반 투자 글 증거 계약과 사용자 판단 원장을 추가했다.
- 날짜·시장상태·출처·가격 방향·시스템값 산출 근거 사전 검증기를 추가했다.
- 유사 종목 비교, 다른 업종 deep-dive, table-only 생략을 설계하는 outline builder를 추가했다.
- 승인된 Project300 예문 corpus와 단계별 작성 프롬프트를 추가했다.
- 내부 메모, 근거 없는 1인칭, 종목명 치환형 문단, 반복 시작구와 동일 문장 검수기를 추가했다.
- Tistory/Blogger Daily Brief 생성기를 outline 기반 렌더러로 연결했다.
- Content Detail에 사용자 판단 메모 기반 preview-only 검수 UI를 추가했다.
- 자동 draft-save/publish 전에 investment writing auto-publish eligibility gate를 추가했다.
- 골든 fixture read-only API를 추가했다.
- Blogger와 Tistory 4개 카테고리 대상이 같은 Investment Writing Orchestrator를 사용하도록 통합했다.
- deterministic 보완 후 재검수 단계를 추가했다.
- Tistory 카테고리별 생성 결과 map과 wizard category selector를 추가했다.
- 실제 source가 준비되지 않은 선물·옵션 카테고리는 명시적인 readiness blocker로 보호했다.
- Tistory 카테고리별 선택 종목/ETF 코드를 run output에 저장하고, 기존 결과의 `planJson.selection`도 읽어 카테고리 간 후보 중복을 차단했다.
- 종목별 신호 집중분석은 오늘의 관심종목 예약 후보를 생성 순서와 관계없이 제외하도록 변경했다.
- Blogger 주식/ETF/아침 시황/한국장 장중/한국장 마감/미국장 장중의 6개 편집 트랙을 공통 투자 글 파이프라인 대상에 등록했다.
- 다중 스케줄 엔진과 검증된 한국장 외국인 수급 source가 준비되지 않아 실제 다중 스케줄 활성화는 보류했다.
- read-only `GET /api/automation/daily-brief/blogger-editorial-plan`을 추가했다.

## Patch 9G Futures Signal Source + Anti-AI Chart Narrative

- Added a Playwright-backed UpSignal futures collector for the hydrated `https://upsignal.co.kr/futures` page.
- Added futures evidence to the investment writing contract, preflight, outline, and renderer.
- Enabled `futures_options_signal_record` generation when at least three futures instruments have ready data.
- Added futures board/detail screenshot capture targets.
- Added a futures-market Project300 renderer that writes a market briefing instead of repeating chart values item by item.
- Hardened anti-AI review against mechanical numeric chart recaps and checklist-style explanations.
- Updated docs so chart/futures posts use table-once, narrative-after rules.

## Patch 9G Futures Active Signal Capture And PnL Briefing

- Prioritized futures display as NASDAQ100, S&P500, KOSPI200, then commodities/FX.
- Added per-instrument timeframe selection: open 60-minute position first, then 240-minute, then 10-minute fallback.
- Added high-resolution detail captures for NASDAQ100, S&P500, and KOSPI200 using the selected timeframe.
- Added current open-position unrealized PnL in points beside daily change in the summary table.
- Preserved public strategy names when available and added safe buy/sell/waiting fallback labels.
- Shortened the futures article and connected US/Korean market direction and profitable recent timing to the UpSignal reference link without promising returns.

## Patch 9G Session-Aware Futures Reports And Korea Foreign Flow Gate

- Added four market report sessions: morning, Korea intraday, Korea close, and US intraday.
- Added session-specific instrument and timeframe priority policies.
- Korea intraday/close now inspect KOSPI200 first and fall back to NASDAQ100/S&P500 when no KOSPI200 position is open.
- Added a structured foreign flow contract for spot, futures, call options, and put options.
- Korea intraday/close generation is blocked before content creation unless the verified market-flow source is configured and complete.
- Added composite Tistory output keys so four futures sessions can coexist in one Daily Brief run.
- Added a read-only market report readiness API and wizard session selector.
- Registered a US intraday Blogger editorial track, while leaving multi-schedule activation blocked.
## 2026-07-13 - Channel-specific SEO titles and sample review

- Added a shared SEO title builder for all six Blogger and four Tistory investment-writing targets.
- Added a read-only per-run title preview API with safe title length, date, keyword, repetition, and punctuation checks.
- Kept Korea intraday/close samples blocked when verified foreign spot/futures/options flow is unavailable.
- Fixed a false futures source blocker caused by relying on changed Futures page CSS selectors. Structured `/api/v1/futures/board` data is now the primary DTO source, while Playwright remains the screenshot path and fallback.
- Regenerated Blogger morning/US intraday and Tistory futures samples from six ready instruments. Korea intraday/close remain blocked only on the separate foreign flow requirement.
## 2026-07-13 - 선물 채널별 스크린샷 편성 분리

- Blogger 시장 리포트 캡처를 한국장 장중/마감 `KOSPI200 + NQ`, 미국장 장중 `ES + NQ`로 고정했다.
- Tistory 선물 글을 `index`와 `macro` 트랙으로 분리하고 07:00, 08:00, 21:00, 22:00 네 슬롯을 정의했다.
- `index`는 NQ/ES/KOSPI200, `macro`는 GOLD/WTI/EURUSD 상세 차트를 각각 1장씩 사용한다.
- 선물 출력 키에 트랙과 세션을 포함해 같은 날짜에 네 글을 서로 덮어쓰지 않고 생성할 수 있게 했다.
- 전체 채널 샘플에서 한국장 수급 미연결은 발행 blocker로 유지하되 선물 차트 미리보기는 별도로 확인할 수 있게 했다.

## 2026-07-13 - Tistory app-owned publish scheduler

- 티스토리 공식 Open API 종료에 대응해 Playwright persistent-profile publisher를 추가했다.
- `/automation/tistory`에서 전용 로그인 창, 공개 발행 설정, 승인 큐, 즉시 실행과 결과 URL을 관리한다.
- publisher는 기존 `local-data/tistory-export/{contentItemId}`의 inline HTML, 제목, 카테고리, 태그를 재사용한다.
- 미리보기 이미지/표/heading 검증 후에만 공개 발행하며, 성공한 content item은 중복 발행하지 않는다.
- DB migration 없이 `local-data/tistory-scheduler`에 config/state/queue를 저장한다.
## Natural Voice GPT CLI Fallback

- Added an always-on deterministic second-pass review for stiff report-style endings and mechanical transitions.
- Remaining tone-only issues now recommend an automatic GPT CLI `style_rewrite` minimal-edit pass instead of blocking publication.
- Blogger and Tistory investment content generation call the fallback only when the second pass still reports an issue.
- GPT CLI candidates are rejected when numbers, dates, table rows, link URLs, or media placeholders change; prompt, raw response, and candidate bodies are not stored in log metadata.
- Added the multi-slot publication scheduler that wires the registered Blogger and Tistory timetable to slot-specific generation, readiness checks, guarded publication, date+slot duplicate prevention, bounded retry state, and automation-page status controls.
- Added scheduled Blogger ETF/market editorial generation and Tistory recurring generation-to-approved-queue execution. Korea intraday/close stays blocked when the verified foreign-flow source is unavailable.

## 2026-07-13 - Real-time futures generation at publish time

- Changed Tistory futures slots to ignore prepared candidates and regenerate from current signals at the scheduled execution time.
- The scheduled execution now keeps live signal collection, timeframe selection, fresh chart capture, full article generation, review, queueing, and guarded publication in one pipeline.
- A failed real-time generation no longer falls back to an older futures article.
- Manually published the approved focused-signal review at `https://project300.tistory.com/30` and recorded the slot success to prevent a duplicate retry.

## 2026-07-13 - Fresh-at-execution publication pipeline

- Changed every scheduled Blogger/Tistory first attempt to create fresh execution artifacts at the slot time instead of reusing a prepared same-day draft.
- Standardized the execution order as live screenshot capture, current source collection, article generation/review, then guarded publication.
- Preserved only same-day Tistory subject-selection history between slots so categories avoid duplicate subjects without sharing old images or prose.
- Kept bounded retries on the already generated content item to prevent duplicate article creation after login or network failures.

## 2026-07-13 - Optional Korea foreign-flow enrichment

- Changed Korea intraday/close foreign spot, futures, call, and put flow from a hard generation gate to optional enrichment.
- A configured structured source is still used only when all required fields and observation time are present.
- Missing, failed, or incomplete flow data now omits the entire flow table and narrative without inventing values or blocking the article.
- Removed the foreign-flow blocker from the Blogger publication timetable and sample-suite readiness.

## 2026-07-13 - Stock chart capture rendering guard

- Fixed blank stock charts caused by capturing before the chart canvas finished painting.
- Switched Daily Brief screenshots to installed Google Chrome first, with bundled Chromium as fallback.
- Added chart canvas pixel readiness, client-error detection, and bounded reload attempts.
- Stock-focused Tistory generation now fails closed when a live chart capture is unavailable instead of publishing a placeholder or error screen.

## 2026-07-13 - Tistory guarded automatic publication

- Changed all seven Tistory timetable slots from `approved_content_queue` to `automatic_live_guarded`.
- Replaced per-content approval for recurring slots with one persisted recurring-schedule approval while retaining per-content approval for manually queued posts.
- Added `approvalSource=recurring_schedule` to automatically queued items for safe operational audit.
- Kept persistent-login, category, image, table, heading, investment-writing, HTML-quality, duplicate, and bounded-retry guards before every live Tistory publish.
- Updated the automation UI to distinguish guarded automatic publication from manual per-content queueing.
- Expanded the Tistory ETF selection pool to 15 before same-day category de-duplication so the ETF slot retains up to five unused subjects instead of failing with an empty evidence pack.
- Moved the Tistory ETF sector review slot from 18:30 to 19:00 Asia/Seoul and shifted the current-day retry to the new scheduled time.

## 2026-07-13 - Tistory futures publication transaction hardening

- 선물 예약 슬롯은 최초 실행뿐 아니라 재시도에서도 이전 후보를 재사용하지 않고 현재 신호와 차트를 다시 수집하도록 변경했다.
- 생성 후보와 상세 차트에 15분 freshness 한계를 적용하고, 예약 실행과 publisher 실행 직전에 동일한 final guard를 수행한다.
- 선물 표를 Markdown table로 렌더링하고 상품별 차트·설명·급등포착 링크를 한 묶음으로 배치했다.
- 열린 포지션을 거래 방향의 기준으로 통일해 표와 상품별 제목/설명이 서로 다르게 표시되는 문제를 막았다.
- Tistory 편집기 입력을 TinyMCE 본문에 직접 동기화하고, 이미지 업로드만 저장되는 회귀를 editor/preview/public-page 검증으로 차단했다.
- 잘못 올라간 Tistory 글 32번을 20:02 기준 GOLD·WTI·EURUSD 차트와 전체 본문으로 교체했다. 공개 페이지에서 본문 3,338자, 소제목 14개, 표 1개, 1280px 차트 3개, 급등포착 링크 5개를 확인했다.

## 2026-07-13 - Daily 08:30 PDash publication report

- 매일 08:30 Asia/Seoul에 직전 보고 시각 이후 예정된 Blogger/Tistory 슬롯의 발행 결과를 집계하는 service-owned report scheduler를 추가했다.
- 전체/Blogger/Tistory 예정 건수와 정상 발행 건수, blocked/failed/missing 원인을 PDash `status` JSON으로 생성한다.
- Telegram 공용 큐는 `~/msg`를 사용하며 `.tmp` 완성 후 `.json` rename 방식으로만 노출한다.
- 앱 재기동 후에도 보고일별 중복 전송을 막는 local state를 추가했다.
- read-only status 및 queue-write 없는 dry-run API `/api/automation/publication-report`를 추가했다.
- 설치 당일 2026-07-13 보고서는 소급 발송하지 않고, 첫 자동 발송은 다음 08:30부터 수행하도록 초기화했다.
# 2026-07-14 - Automatic publication recovery

- Added service-side detection for recently missed publication slots and safely retryable failures.
- Added recovery metadata, cooldown, attempt limits, UI status, and 08:30 report visibility.
- Preserved date/slot duplicate protection: successful publications are never republished.
- Authentication failures remain manual and produce login guidance; exhausted recovery produces a PDash/Telegram alert.
