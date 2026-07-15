# 23_VIDEO_SOURCE_COLLECTION

VIDEO-4 adds the source collection layer for video automation.

Goal:

```text
manual input / existing content item / Daily Brief / site recipe fixture / generic URL preview
→ CollectedVideoSource
→ VideoSourceBundle
→ common script, cards, subtitles, MP4, upload package metadata
```

## Source Types

Implemented preview sources:

- Manual input: operator-provided title, text, reference URLs, and optional visual metadata.
- Existing content item: already-loaded Blog Growth Agent content item plus image asset metadata.
- Daily Brief: existing Daily Brief run results.
- Site recipe fixture: allowlisted URL plus fixture HTML and selectors.
- Generic URL preview: URL plus operator-provided title/summary/excerpt, with no automatic network fetch.

## Safety Contract

All VIDEO-4 source previews are read-only:

- `sourceWrite=false`
- `dbWrite=false`
- `localFileWrite=false`
- `externalServiceWrite=false`
- `secretRead=false`
- `llmCall=false`
- `schedulerMutation=false`
- `uploadEnabled=false`
- `platformUploadsEnabled=false`

Content item preview may perform a DB read to load an existing content item and assets. It must not mutate content items or assets.

Site recipe and generic URL preview do not perform network fetches in VIDEO-4. Site recipe parsing accepts fixture HTML only. Generic URL preview accepts operator-provided metadata only.

## Data Contract

`CollectedVideoSource` contains:

- collection kind and source type
- source id/title/summary/url
- bounded evidence snippets
- visual candidates
- attribution
- collection safety policy
- side-effect summary

It must not contain:

- full source body
- cookies
- request headers
- credentials
- local storage paths
- asset `storagePath` or `thumbnailPath`
- secret-like values

`VideoSourceBundle` remains the downstream contract for script, card, subtitle, MP4, and upload package preparation.

## Routes

Preview-only routes:

- `POST /api/video-sources/manual/preview`
- `GET /api/video-sources/content-items/[id]/preview`
- `GET /api/video-sources/daily-brief/[runId]/preview`
- `POST /api/video-sources/site-recipe/preview`
- `POST /api/video-sources/generic-url/preview`

Package route:

- `POST /api/video-sources/package`

`write=false` or omitted returns a package preview. `write=true` writes local package files under `local-data/video-automation/sources`.

VIDEO-5 package writes include concise subtitles and local SVG text-card images:

- `text-card-images.json`
- `cards/cover.svg`
- `cards/card-{index}-{cardId}.svg`

No route uploads to external platforms, calls LLM/TTS providers, mutates scheduler state, or publishes content.

## UI

`/wizard/video` lets the operator select a source type and generate a source preview.

The UI shows:

- source type
- source hash prefix
- evidence and visual candidate counts
- script scene count
- side-effect summary
- disabled upload flags
- deterministic script preview

## Next Steps

- Convert generic source package SVG cards to PNG/MP4 and connect local voiceover renderers.
- Add persisted source recipe definitions only after approval and a no-secret storage review.
- Add real read-only network collection only behind allowlisted domains, bounded snippets, attribution, timeout controls, and tests that block cookies, credentials, and non-GET operations.
