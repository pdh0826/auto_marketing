# 21_VIDEO_AUDIO_DESIGN

## Scope

VIDEO-2A/VIDEO-2B are design and contract work.

VIDEO-2C implements free local voiceover rendering only.

The current video automation module can generate a deterministic voiceover script, call a local free TTS command when available, and mux local audio into a local MP4. It still does not use external TTS providers, LLM narration, secrets, upload, publish, or scheduler mutation.

## Goals

Future audio support may add:

- voiceover script file
- local TTS output
- optional external TTS provider integration
- audio/video synchronization report
- audio-included MP4 render

## Required Safety Gates Before Implementation

Before any TTS or narration implementation:

- choose local TTS or external TTS explicitly
- define provider abstraction before any external provider is used
- define task type for call logs before any provider call
- record provider, model, status, latency, and error message for each provider call
- define cost policy and per-run cost ceiling
- define secret storage and redaction policy
- block raw secret output
- block raw provider response storage unless explicitly reviewed and redacted
- define local review gate before mixing audio into MP4
- keep upload and publish paths disabled even after audio exists

## VIDEO-2B Contract

VIDEO-2B was a contract-only patch.

Status:

- `audioImplemented=true` for free local TTS only
- `ttsCallImplemented=true` for local command execution only
- `llmNarrationImplemented=false`
- `audioIncludedInMp4=true` only for `video-with-voiceover.mp4`
- `externalProviderCallsEnabled=false`
- `secretReadRequired=false`
- `uploadEnabled=false`

Allowed after VIDEO-2C:

- documentation
- type/interface proposal
- validation checklist
- deterministic voiceover script generation from the common `VideoSourceBundle`
- local TTS command execution with `say` or `espeak-ng`
- local audio muxing with `ffmpeg`
- static tests that prove voiceover remains local-only
- UI copy that explains uploads remain blocked

Forbidden after VIDEO-2C:

- external TTS execution
- OpenAI or other LLM narration generation
- API keys, tokens, credentials, or secret reads
- platform upload or publish
- scheduler mutation
- operating server mutation

## Voiceover Artifact Contract

Possible local files:

- `voiceover-script.txt`
- `voiceover.aiff` or `voiceover.wav`
- `voiceover-render-report.json`

VIDEO-2C may write these files under `local-data/video-automation` only.

`voiceover-script.txt` contract:

- plain UTF-8 text
- derived only from the common source bundle and existing deterministic package data unless a later approved LLM narration gate exists
- no raw news article bodies
- no secrets, local absolute paths, `storagePath`, provider headers, or tokens
- includes investment-risk wording consistent with the final video card

`voiceover-report.json` contract:

- source hash
- package slug
- storyboard hash
- script hash
- script bytes
- audio duration
- expected video duration
- scene duration match status
- subtitle alignment status
- provider mode: `none`, `local_tts`, or `external_tts`
- provider type
- provider name
- model name when applicable
- call log id when applicable
- cost estimate and cost ceiling when applicable
- local file bytes
- side-effect summary
- warnings
- blocking reasons

`voiceover-report.json` side-effect summary must include:

- Daily Brief run read
- Daily Brief run write
- existing content item mutation
- DB write
- local file write
- external provider call
- secret read
- LLM call
- upload
- publish
- scheduler mutation

All write/external/secret fields remain false until a separately approved implementation patch changes them.

## Provider Boundary

If a future patch uses external TTS or LLM narration, it must reuse the existing LLM/provider design principles:

- provider selection goes through an abstraction layer
- provider/model/task metadata is recorded
- latency/status/error are recorded
- request and response bodies are redacted or omitted by default
- secrets are never printed or committed
- raw provider output is not stored unless reviewed and redacted
- deterministic no-call preview exists before execution

Future task types should be explicit, for example:

- `video_voiceover_script_preview`
- `video_voiceover_tts_preview`
- `video_voiceover_tts_execution`

The exact names can change in implementation, but the task boundary must remain auditable.

## Cost Gate

Before any paid provider call:

- estimate input characters/tokens
- estimate audio duration
- estimate provider cost
- require an operator-visible cost ceiling
- block execution when the estimate exceeds the ceiling
- log accepted cost metadata without exposing secrets

## MP4 Audio Gate

Audio may be mixed into MP4 only after:

- silent MP4 render is ready
- voiceover report is ready
- source hash matches the package hash
- script hash matches the approved script
- audio duration is within the approved tolerance
- risk note remains present
- local review passes
- upload remains disabled

## VIDEO-2C Local Voiceover Implementation

VIDEO-2C adds:

- `POST /api/daily-brief/runs/[runId]/video-package/render-voiceover`
- deterministic `voiceover-script.txt`
- local `say` or `espeak-ng` TTS execution when available
- local `ffmpeg` audio muxing
- `video-with-voiceover.mp4`
- `voiceover-render-report.json`
- upload metadata package preparation with uploads still disabled

Provider policy:

- `subscriptionRequired=false`
- `externalProvider=false`
- no API key
- no secret read
- no network call

If no local TTS command is available, the route writes the script and report, then blocks with `local_tts_command_not_available`.

## Forbidden Until Explicit Approval

- external TTS API calls
- OpenAI or other LLM calls for narration
- secret reads outside approved provider abstraction
- automatic upload
- automatic publishing
- scheduler mutation
- operating server mutation

## Current Decision

Keep VIDEO-2C as free local voiceover generation only.

Proceed to external provider implementation only after the provider boundary, cost gate, redaction policy, no-call preview, and local review gate are explicitly approved.
