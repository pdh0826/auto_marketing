# 21_VIDEO_AUDIO_DESIGN

## Scope

VIDEO-2A is design only.

Audio and narration are not implemented in the current video automation module.

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
- define provider abstraction if any external provider is used
- define task type for call logs
- record provider, model, status, latency, and error message for each provider call
- define cost policy
- define secret storage and redaction policy
- block raw secret output
- block raw provider response storage unless explicitly reviewed and redacted

## Recommended VIDEO-2B Contract

Possible local files:

- `voiceover-script.txt`
- `voiceover.wav` or `voiceover.mp3`
- `voiceover-report.json`

Report fields:

- source hash
- script hash
- audio duration
- scene duration match
- provider type
- provider name
- model name when applicable
- local file bytes
- side-effect summary

## Forbidden Until Explicit Approval

- external TTS API calls
- OpenAI or other LLM calls for narration
- secret reads outside approved provider abstraction
- automatic upload
- automatic publishing
- scheduler mutation
- operating server mutation

## Current Decision

Keep VIDEO-1 as silent local video generation.

Proceed to audio only after the local silent MP4 workflow, package readback, and operator guard are stable.
