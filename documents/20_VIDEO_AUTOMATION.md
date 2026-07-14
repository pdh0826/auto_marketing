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
