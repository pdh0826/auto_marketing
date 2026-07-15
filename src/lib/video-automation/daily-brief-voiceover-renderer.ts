import { createHash } from "crypto";
import { spawn } from "child_process";
import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import type { DailyBriefRun } from "@/lib/daily-brief/types";
import { buildDailyBriefVideoSourceBundle } from "./adapters/daily-brief-source";
import { buildVideoScriptPlan } from "./core/script-builder";
import { renderDailyBriefVideoMp4 } from "./daily-brief-mp4-renderer";
import { writeDailyBriefVideoUploadMetadata } from "./daily-brief-upload-package";
import type {
  DailyBriefVideoFileKind,
  DailyBriefVideoMp4RenderResult,
  DailyBriefVideoPackageFile,
  DailyBriefVideoSideEffectSummary,
  DailyBriefVideoUploadMetadataResult,
  DailyBriefVideoVoiceoverRenderReport,
  DailyBriefVideoVoiceoverRenderResult
} from "./types";

export function buildDailyBriefVoiceoverScript(run: DailyBriefRun, _mp4Render: DailyBriefVideoMp4RenderResult) {
  const sourceBundle = buildDailyBriefVideoSourceBundle(run);
  return normalizeScript(buildVideoScriptPlan(sourceBundle).fullScript);
}

export async function renderDailyBriefVideoVoiceover(run: DailyBriefRun, generatedAt = new Date().toISOString()): Promise<DailyBriefVideoVoiceoverRenderResult> {
  const mp4Render = await renderDailyBriefVideoMp4(run, generatedAt);
  if (!mp4Render.outputDirectory) {
    throw new Error("daily_brief_video_mp4_render_output_required");
  }
  await mkdir(mp4Render.outputDirectory, { recursive: true });

  const manifest = mp4Render.cardRender.package.manifest;
  const script = buildDailyBriefVoiceoverScript(run, mp4Render);
  const scriptPath = path.join(mp4Render.outputDirectory, "voiceover-script.txt");
  await writeFile(scriptPath, script, "utf8");
  const scriptBytes = Buffer.byteLength(script, "utf8");
  const scriptHash = sha256(script);
  const scriptFile = fileRecord("voiceover_script_txt", scriptPath, "voiceover-script.txt", "text/plain", scriptBytes);
  const baseReport = buildBaseReport({
    generatedAt,
    sourceHash: manifest.sourceSnapshot.hash,
    sourceHashPrefix: manifest.sourceSnapshot.hashPrefix,
    scriptHash,
    scriptBytes,
    scriptCharacterCount: script.length,
    contentItemId: run.contentItemId,
    expectedVideoDurationSec: manifest.mp4.totalDurationSec,
    files: [scriptFile]
  });

  if (!mp4Render.report.validation.ready) {
    return writeVoiceoverReport(mp4Render, null, {
      ...baseReport,
      status: "blocked",
      validation: {
        ...baseReport.validation,
        ready: false,
        errors: ["silent_mp4_not_ready", ...mp4Render.report.validation.errors],
        warnings: [...mp4Render.report.validation.warnings]
      }
    });
  }

  const provider = await findLocalTtsProvider();
  if (!provider) {
    return writeVoiceoverReport(mp4Render, null, {
      ...baseReport,
      status: "blocked",
      provider: {
        ...baseReport.provider,
        commandAvailable: false
      },
      validation: {
        ...baseReport.validation,
        ready: false,
        errors: ["local_tts_command_not_available"],
        warnings: ["Install macOS say or espeak-ng to render free local voiceover audio."]
      }
    });
  }

  const audioFileName = provider.name === "say" ? "voiceover.aiff" : "voiceover.wav";
  const audioKind: DailyBriefVideoFileKind = provider.name === "say" ? "voiceover_audio_aiff" : "voiceover_audio_wav";
  const audioPath = path.join(mp4Render.outputDirectory, audioFileName);
  const ttsArgs = provider.name === "say" ? ["-o", audioPath, "-f", scriptPath] : ["-v", "ko", "-w", audioPath, "-f", scriptPath];
  const ttsCommandPath = path.join(mp4Render.outputDirectory, "voiceover-tts-command.json");
  const ttsCommandPayload = {
    executable: provider.name,
    args: ttsArgs,
    sourceHash: manifest.sourceSnapshot.hash,
    subscriptionRequired: false,
    externalProvider: false,
    note: "Local-only free TTS render. No external provider call is performed."
  };
  await writeFile(ttsCommandPath, JSON.stringify(ttsCommandPayload, null, 2), "utf8");
  const ttsExitCode = await runProcess(provider.name, ttsArgs);
  const audioStat = ttsExitCode === 0 ? await stat(audioPath).catch(() => null) : null;
  const ttsCommandFile = fileRecord("voiceover_tts_command_json", ttsCommandPath, "voiceover-tts-command.json", "application/json", Buffer.byteLength(JSON.stringify(ttsCommandPayload, null, 2), "utf8"));

  if (!audioStat || audioStat.size <= 0) {
    return writeVoiceoverReport(mp4Render, null, {
      ...baseReport,
      status: "failed",
      provider: {
        ...baseReport.provider,
        name: provider.name,
        commandAvailable: true
      },
      validation: {
        ...baseReport.validation,
        ready: false,
        errors: ["local_tts_render_failed"],
        warnings: []
      },
      ttsCommand: {
        executable: provider.name,
        args: ttsArgs,
        exitCode: ttsExitCode
      },
      files: [...baseReport.files, ttsCommandFile]
    });
  }

  const audioFile = fileRecord(audioKind, audioPath, audioFileName, provider.name === "say" ? "audio/aiff" : "audio/wav", audioStat.size);
  const silentVideoPath = path.join(mp4Render.outputDirectory, "video.mp4");
  const outputPath = path.join(mp4Render.outputDirectory, "video-with-voiceover.mp4");
  const muxCommandPath = path.join(mp4Render.outputDirectory, "voiceover-mux-command.json");
  const muxArgs = [
    "-y",
    "-i",
    silentVideoPath,
    "-i",
    audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    outputPath
  ];
  const muxCommandPayload = {
    executable: "ffmpeg",
    args: muxArgs,
    sourceHash: manifest.sourceSnapshot.hash,
    note: "Local-only audio mux. External upload and publication remain disabled."
  };
  await writeFile(muxCommandPath, JSON.stringify(muxCommandPayload, null, 2), "utf8");
  const muxExitCode = await runProcess("ffmpeg", muxArgs);
  const outputStat = muxExitCode === 0 ? await stat(outputPath).catch(() => null) : null;
  const muxCommandFile = fileRecord("voiceover_mux_command_json", muxCommandPath, "voiceover-mux-command.json", "application/json", Buffer.byteLength(JSON.stringify(muxCommandPayload, null, 2), "utf8"));
  const voiceoverVideoFile = outputStat
    ? fileRecord("video_with_voiceover_mp4", outputPath, "video-with-voiceover.mp4", "video/mp4", outputStat.size)
    : null;
  const uploadMetadata = outputStat && outputStat.size > 10_000 ? await writeDailyBriefVideoUploadMetadata(run, generatedAt) : null;
  const audioDurationSec = await readAudioDurationSec(audioPath);
  const errors = outputStat && outputStat.size > 10_000 ? [] : ["ffmpeg_voiceover_mux_failed"];

  return writeVoiceoverReport(mp4Render, uploadMetadata, {
    ...baseReport,
    status: errors.length ? "failed" : "rendered",
    provider: {
      ...baseReport.provider,
      name: provider.name,
      commandAvailable: true
    },
    renderer: {
      ...baseReport.renderer,
      audioIncluded: errors.length === 0
    },
    validation: {
      ready: errors.length === 0,
      errors,
      warnings: audioDurationSec === null ? ["ffprobe_not_available_for_audio_duration"] : [],
      expectedVideoDurationSec: manifest.mp4.totalDurationSec,
      audioDurationSec,
      audioBytes: audioStat.size,
      outputBytes: outputStat?.size ?? null,
      sourceHashMatchesMp4: mp4Render.report.sourceHash === manifest.sourceSnapshot.hash,
      uploadMetadataPrepared: Boolean(uploadMetadata)
    },
    ttsCommand: {
      executable: provider.name,
      args: ttsArgs,
      exitCode: ttsExitCode
    },
    muxCommand: {
      executable: "ffmpeg",
      args: muxArgs,
      exitCode: muxExitCode
    },
    files: [
      ...baseReport.files,
      ttsCommandFile,
      audioFile,
      muxCommandFile,
      ...(voiceoverVideoFile ? [voiceoverVideoFile] : [])
    ]
  });
}

async function writeVoiceoverReport(
  mp4Render: DailyBriefVideoMp4RenderResult,
  uploadMetadata: DailyBriefVideoUploadMetadataResult | null,
  report: DailyBriefVideoVoiceoverRenderReport
): Promise<DailyBriefVideoVoiceoverRenderResult> {
  if (!mp4Render.outputDirectory) {
    throw new Error("daily_brief_video_mp4_render_output_required");
  }
  const reportPath = path.join(mp4Render.outputDirectory, "voiceover-render-report.json");
  const reportContent = JSON.stringify(report, null, 2);
  await writeFile(reportPath, reportContent, "utf8");
  const reportFile = fileRecord("voiceover_render_report_json", reportPath, "voiceover-render-report.json", "application/json", Buffer.byteLength(reportContent, "utf8"));
  const nextReport = {
    ...report,
    files: [...report.files, reportFile]
  };
  return {
    mp4Render,
    uploadMetadata,
    report: nextReport,
    outputDirectory: mp4Render.outputDirectory,
    files: [...mp4Render.files, ...nextReport.files, ...(uploadMetadata?.files ?? [])]
  };
}

function buildBaseReport(input: {
  generatedAt: string;
  sourceHash: string;
  sourceHashPrefix: string;
  scriptHash: string;
  scriptBytes: number;
  scriptCharacterCount: number;
  contentItemId: string | null;
  expectedVideoDurationSec: number;
  files: DailyBriefVideoPackageFile[];
}): DailyBriefVideoVoiceoverRenderReport {
  return {
    kind: "daily_brief_video_voiceover_render_report",
    version: "VIDEO-2C",
    generatedAt: input.generatedAt,
    sourceHash: input.sourceHash,
    sourceHashPrefix: input.sourceHashPrefix,
    status: "blocked",
    script: {
      fileName: "voiceover-script.txt",
      hashAlgorithm: "sha256",
      hash: input.scriptHash,
      bytes: input.scriptBytes,
      characterCount: input.scriptCharacterCount,
      derivedFrom: [
        "daily_brief_run",
        "video_package_storyboard",
        "video_package_subtitles",
        "stock_pick_insights",
        "etf_pick_insights",
        "research_summaries",
        "disclosure_summaries",
        "prewrite_context"
      ],
      contentItemId: input.contentItemId,
      contentItemRead: false
    },
    provider: {
      mode: "local_tts",
      name: null,
      subscriptionRequired: false,
      externalProvider: false,
      commandAvailable: false
    },
    renderer: {
      name: "ffmpeg",
      audioIncluded: false,
      externalUploadEnabled: false
    },
    validation: {
      ready: false,
      errors: [],
      warnings: [],
      expectedVideoDurationSec: input.expectedVideoDurationSec,
      audioDurationSec: null,
      audioBytes: null,
      outputBytes: null,
      sourceHashMatchesMp4: false,
      uploadMetadataPrepared: false
    },
    ttsCommand: null,
    muxCommand: null,
    files: input.files,
    sideEffectSummary: buildVoiceoverSideEffects()
  };
}

async function findLocalTtsProvider(): Promise<{ name: "say" | "espeak-ng" } | null> {
  if ((await runProcess("which", ["say"])) === 0) {
    return { name: "say" };
  }
  if ((await runProcess("which", ["espeak-ng"])) === 0) {
    return { name: "espeak-ng" };
  }
  return null;
}

async function readAudioDurationSec(audioPath: string) {
  const output = await runProcessWithOutput("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath]);
  if (output.exitCode !== 0) {
    return null;
  }
  const parsed = Number(output.stdout.trim());
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

async function runProcess(command: string, args: string[]) {
  return new Promise<number>((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code ?? -1));
  });
}

async function runProcessWithOutput(command: string, args: string[]) {
  return new Promise<{ exitCode: number; stdout: string }>((resolve) => {
    let stdout = "";
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("error", () => resolve({ exitCode: -1, stdout }));
    child.on("close", (code) => resolve({ exitCode: code ?? -1, stdout }));
  });
}

function fileRecord(kind: DailyBriefVideoFileKind, filePath: string, fileName: string, mimeType: string, bytes: number): DailyBriefVideoPackageFile {
  return {
    kind,
    fileName,
    relativePath: path.relative(process.cwd(), filePath),
    mimeType,
    bytes
  };
}

function normalizeScript(value: string) {
  return `${value
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")}\n`;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function buildVoiceoverSideEffects(): DailyBriefVideoSideEffectSummary {
  return {
    dailyBriefRunRead: true,
    dailyBriefRunWrite: false,
    existingContentItemMutation: false,
    dbWrite: false,
    localFileWrite: true,
    externalServiceWrite: false,
    bloggerApiWrite: false,
    tistoryApiWrite: false,
    youtubeUpload: false,
    instagramUpload: false,
    tiktokUpload: false,
    scheduledPublishMutation: false,
    llmCall: false,
    secretRead: false
  };
}
