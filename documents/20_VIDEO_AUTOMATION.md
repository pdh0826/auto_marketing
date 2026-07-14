# 20_VIDEO_AUTOMATION

## Module Scope

Video automation is an internal Blog Growth Agent module.

It reuses existing Daily Brief run results as read-only input and prepares local video production artifacts:

- card news HTML
- storyboard JSON
- subtitle files
- cover HTML
- MP4 render plan
- upload package manifest

It is not a separate operating service.

## VIDEO-1A Implementation

VIDEO-1A adds the first safe vertical slice:

```text
Daily Brief run JSON
→ read-only video package preview
→ local package file generation
→ operator-visible side-effect summary
```

Routes:

- `GET /api/daily-brief/runs/[runId]/video-package`
- `POST /api/daily-brief/runs/[runId]/video-package`

Local output path:

```text
local-data/video-automation/daily-brief/{runId}/
```

Generated files:

- `manifest.json`
- `storyboard.json`
- `subtitles.srt`
- `subtitles.vtt`
- `card-news.html`
- `cover.html`
- `mp4-render-plan.json`

## Safety Boundary

VIDEO-1A must keep these side effects false:

- Daily Brief run mutation
- existing content item mutation
- DB write
- Blogger API write
- Tistory API write
- YouTube upload
- Instagram upload
- TikTok upload
- scheduled publish mutation
- LLM call
- secret read

`POST` writes local ignored files only under `local-data/video-automation`.

MP4 binary rendering is not implemented in VIDEO-1A. The MP4 artifact is a render plan only, and upload package readiness remains blocked until a later explicit patch adds renderer validation and manual review gates.

## VIDEO-1B Source Contract

VIDEO-1B fixes the package input contract before adding any renderer.

The video package manifest now includes:

- `version: "VIDEO-1B"`
- `sourceSnapshot.hashAlgorithm: "sha256"`
- `sourceSnapshot.hash`
- `sourceSnapshot.hashPrefix`
- `sourceSnapshot.canonicalJsonLength`
- `sourceSnapshot.includedFields`
- `sourceSnapshot.excludedFields`
- `validation.ready`
- `validation.checks`
- `validation.errors`
- `validation.warnings`
- deterministic artifact field list

The source snapshot is calculated from safe Daily Brief fields:

- run identity, status, date, title, and target keyword
- generation counts and content item references
- stock, ETF, and futures pick display fields
- research, disclosure, and prewrite summaries
- capture safe metadata
- Daily Brief safe side-effect summary

The source snapshot excludes:

- package `generatedAt`
- local output directory
- output file byte counts
- capture `storagePath`
- any env, token, credential, client secret, or other secret material

Validation checks enforce:

- source hash presence
- card id uniqueness
- closing risk note card presence
- storyboard/card count match
- continuous storyboard timing
- subtitle/storyboard alignment
- MP4 render-plan-only state
- platform uploads disabled
- side-effect boundary clean

VIDEO-1B still does not render card PNGs or MP4 binaries. It only makes later render steps safer by making the Daily Brief input identity explicit and reproducible.

## VIDEO-1C Card PNG Rendering

VIDEO-1C adds local-only PNG rendering for visual review.

Route:

- `POST /api/daily-brief/runs/[runId]/video-package/render-cards`

The route first regenerates the VIDEO-1B package, then renders:

- `cards/cover.png`
- `cards/card-001-{cardId}.png`
- `cards/card-002-{cardId}.png`
- additional card PNGs for every manifest card
- `card-render-report.json`

Renderer contract:

- Playwright is loaded dynamically.
- Chromium is launched headless.
- PNG viewport is `1080x1920`.
- Each card is rendered as an isolated 9:16 HTML document.
- The render report keeps the VIDEO-1B `sourceSnapshot.hash`.
- The report records image dimensions, file bytes, selector used, warnings, and errors.

Validation checks include:

- package validation must be ready before rendering
- rendered PNG file size must be non-trivial
- rendered card element must be large enough
- text/layout overflow is reported as a warning
- expected card count is recorded

VIDEO-1C still does not:

- generate MP4 binaries
- upload to YouTube, Instagram, TikTok, Blogger, or Tistory
- mutate Daily Brief run JSON
- mutate existing content items
- write DB rows
- change scheduler state
- call LLMs
- read secrets

## VIDEO-1D Storyboard and Subtitle Quality

VIDEO-1D strengthens the deterministic package validation before MP4 work.

Additional validation checks:

- closing risk note card must be the final card
- shortform package card count must stay at or below 9
- stock cards are compressed when the source Daily Brief has more stock picks than the shortform card budget
- scene duration must stay between 3 and 7 seconds
- subtitle cue indexes must be sequential
- subtitle text must stay at or below 160 characters per cue
- on-screen text lines must stay at or below 52 characters

Card compression remains deterministic:

- cover, market summary, and closing risk note are always preserved
- ETF and futures summary cards are preserved when source data exists
- remaining shortform budget is assigned to the highest-ranked stock cards

VIDEO-1D still does not generate MP4 binaries, call LLMs, read secrets, mutate source runs, mutate DB rows, or perform any external write.

## VIDEO-1E Local MP4 Rendering

VIDEO-1E adds local-only, silent MP4 preview rendering.

Route:

- `POST /api/daily-brief/runs/[runId]/video-package/render-mp4`

The route:

1. regenerates the VIDEO-1B package
2. renders VIDEO-1C card PNGs
3. checks card render readiness
4. checks whether local `ffmpeg` is available
5. writes a concat input file
6. writes a command record
7. writes `video.mp4` when `ffmpeg` succeeds
8. writes `mp4-render-report.json`

Generated files:

- `mp4-concat-input.txt`
- `mp4-render-command.json`
- `video.mp4`
- `mp4-render-report.json`

Renderer contract:

- renderer is local `ffmpeg`
- output is silent (`audioIncluded=false`)
- target video is 1080x1920, 30 fps
- source hash is carried from the VIDEO-1B manifest
- failed renderer availability or execution is recorded as a report instead of triggering any external write

VIDEO-1E still does not upload, publish, schedule, mutate source runs, mutate DB rows, call LLMs, or read secrets.

## VIDEO-1F Upload Metadata Package

VIDEO-1F generates platform metadata files for manual review only.

Route:

- `POST /api/daily-brief/runs/[runId]/video-package/upload-metadata`

Generated files:

- `upload/youtube.json`
- `upload/instagram.json`
- `upload/tiktok.json`
- `upload/operator-checklist.md`

All platform metadata keeps:

- `uploadEnabled=false`
- `platformUploadsEnabled=false`
- `manualReviewRequired=true`

No API upload route is created.

## VIDEO-1G Wizard Workflow

The Daily Brief wizard now exposes the video sequence:

1. package preview
2. local package generation
3. card PNG render
4. MP4 local render
5. upload metadata package
6. package readback

Each step reports local side effects and keeps external write flags false.

## VIDEO-1H Package Readback

Route:

- `GET /api/daily-brief/runs/[runId]/video-package/readback`

Readback:

- computes the current Daily Brief source hash
- checks local package artifacts under `local-data/video-automation`
- reads saved manifest source hash when present
- reports stale state when saved and current hashes differ
- reports artifact existence and file sizes

Readback is read-only and does not write files.

## VIDEO-1I Operating Guard

The video automation module remains guarded:

- operating repo touched: false
- 3004 server touched: false
- external write routes enabled: false
- scheduler mutation enabled: false
- secret read required: false

These are surfaced in package readback so operator review can confirm that video work remains local-only.

## VIDEO-1L Safety Regression Test

Command:

```bash
npm run test:video-automation
```

The regression test fixes the current source hash and safety boundary expectations without adding a new runtime write path.

It verifies:

- the package manifest keeps `version: "VIDEO-1B"`
- the source hash is a SHA-256 hex string
- source hash generation ignores package generation time
- source hash generation changes when safe Daily Brief source fields change
- capture `storagePath` and secret-like markers are excluded from emitted manifests
- upload readiness and platform upload enablement stay false
- the base package still describes MP4 as a render plan, not a binary render
- readback guard flags for operating repo, server 3004, external writes, scheduler mutation, and secret reads stay false
- preview/readback side-effect summaries keep DB writes, external service writes, platform uploads, scheduler mutation, LLM calls, and secret reads false

The test also statically scans video automation source files for DB/prisma imports, `process.env` access, secret file references, network `fetch` calls, and enabled external-write flags.

## VIDEO-1M Verification Hook

Command:

```bash
npm run verify:video-automation
```

The verification command runs:

- `npm run test:video-automation`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

`.github/workflows/video-automation.yml` runs the same verification command for VIDEO-related pull requests and pushes to `codex/video-automation-v1`.

The VIDEO-1L safety fixture also includes a stale readback case:

- writes a dedicated test-only `manifest.json` under `local-data/video-automation`
- gives the saved manifest a different source hash
- verifies readback reports `savedSourceHash`, the current hash, and `stale=true`
- removes the test-only local artifact before finishing

## VIDEO-1N Operator Runbook

Manual local MP4 review is documented in `documents/22_VIDEO_OPERATOR_RUNBOOK.md`.

The runbook defines:

- manual review outside the app as local-only inspection
- required artifacts before review
- required readback state, including `stale=false`
- source hash, visual, storyboard, subtitle, and metadata review steps
- forbidden upload, publish, scheduler, secret, operating repo, and server actions
- failure handling for stale readback, missing MP4, renderer failure, or leaked local paths

## VIDEO-2A Audio Design

Audio and narration are not implemented yet. See `documents/21_VIDEO_AUDIO_DESIGN.md`.
