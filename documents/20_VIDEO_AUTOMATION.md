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
