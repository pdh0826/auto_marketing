import { spawn } from "child_process";
import { stat, writeFile } from "fs/promises";
import path from "path";
import type { DailyBriefRun } from "@/lib/daily-brief/types";
import { renderDailyBriefVideoCards } from "./daily-brief-card-renderer";
import type {
  DailyBriefVideoCardRenderImage,
  DailyBriefVideoMp4RenderReport,
  DailyBriefVideoMp4RenderResult,
  DailyBriefVideoPackageFile,
  DailyBriefVideoSideEffectSummary
} from "./types";

export async function renderDailyBriefVideoMp4(run: DailyBriefRun, generatedAt = new Date().toISOString()): Promise<DailyBriefVideoMp4RenderResult> {
  const cardRender = await renderDailyBriefVideoCards(run, generatedAt);
  if (!cardRender.outputDirectory) {
    throw new Error("daily_brief_video_card_render_output_required");
  }

  const baseReport = buildBaseReport({
    generatedAt,
    sourceHash: cardRender.package.manifest.sourceSnapshot.hash,
    sourceHashPrefix: cardRender.package.manifest.sourceSnapshot.hashPrefix,
    expectedSceneCount: cardRender.package.manifest.storyboard.length,
    durationSec: cardRender.package.manifest.mp4.totalDurationSec
  });

  if (!cardRender.report.validation.ready) {
    const report = {
      ...baseReport,
      status: "blocked" as const,
      validation: {
        ...baseReport.validation,
        ready: false,
        errors: ["card_png_render_not_ready", ...cardRender.report.validation.errors],
        warnings: [...cardRender.report.validation.warnings]
      }
    };
    return writeMp4Report(cardRender, report);
  }

  const storyboard = cardRender.package.manifest.storyboard;
  const imageByCardId = new Map(cardRender.report.images.filter((image) => image.kind === "card_png").map((image) => [image.cardId, image]));
  const sceneInputs: Array<{ sceneId: string; image: DailyBriefVideoCardRenderImage; durationSec: number }> = [];
  for (const scene of storyboard) {
    const cardId = scene.id.replace(/^scene-\d+$/, "");
    const image = imageByCardId.get(cardId) ?? imageByCardId.get(scene.title === cardRender.package.manifest.cover.title ? "cover" : "");
    const directImage = imageByCardId.get(cardRender.package.manifest.cards[storyboard.indexOf(scene)]?.id ?? "");
    const selected = directImage ?? image;
    if (!selected) {
      const report = {
        ...baseReport,
        status: "blocked" as const,
        validation: {
          ...baseReport.validation,
          ready: false,
          errors: ["mp4_scene_image_missing"],
          warnings: []
        }
      };
      return writeMp4Report(cardRender, report);
    }
    sceneInputs.push({ sceneId: scene.id, image: selected, durationSec: scene.durationSec });
  }

  const ffmpegAvailable = await canRunFfmpeg();
  if (!ffmpegAvailable) {
    const report = {
      ...baseReport,
      status: "failed" as const,
      validation: {
        ...baseReport.validation,
        ready: false,
        errors: ["ffmpeg_not_available"],
        warnings: []
      }
    };
    return writeMp4Report(cardRender, report);
  }

  const concatPath = path.join(cardRender.outputDirectory, "mp4-concat-input.txt");
  const outputPath = path.join(cardRender.outputDirectory, "video.mp4");
  const commandPath = path.join(cardRender.outputDirectory, "mp4-render-command.json");
  const concatContent = renderConcatInput(sceneInputs);
  await writeFile(concatPath, concatContent, "utf8");

  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-vf",
    "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
    "-r",
    "30",
    "-an",
    outputPath
  ];
  const commandPayload = {
    executable: "ffmpeg",
    args,
    sourceHash: cardRender.package.manifest.sourceSnapshot.hash,
    note: "Local-only MP4 render. No external upload or publication is performed."
  };
  await writeFile(commandPath, JSON.stringify(commandPayload, null, 2), "utf8");
  const exitCode = await runFfmpeg(args);
  const outputStat = exitCode === 0 ? await stat(outputPath).catch(() => null) : null;
  const errors = exitCode === 0 && outputStat && outputStat.size > 10_000 ? [] : ["ffmpeg_mp4_render_failed"];
  const renderedFiles: DailyBriefVideoPackageFile[] = [
    {
      kind: "mp4_concat_input_txt",
      fileName: "mp4-concat-input.txt",
      relativePath: path.relative(process.cwd(), concatPath),
      mimeType: "text/plain",
      bytes: Buffer.byteLength(concatContent, "utf8")
    },
    {
      kind: "mp4_render_command_json",
      fileName: "mp4-render-command.json",
      relativePath: path.relative(process.cwd(), commandPath),
      mimeType: "application/json",
      bytes: Buffer.byteLength(JSON.stringify(commandPayload, null, 2), "utf8")
    }
  ];
  if (outputStat) {
    renderedFiles.push({
      kind: "video_mp4",
      fileName: "video.mp4",
      relativePath: path.relative(process.cwd(), outputPath),
      mimeType: "video/mp4",
      bytes: outputStat.size
    });
  }

  const report: DailyBriefVideoMp4RenderReport = {
    ...baseReport,
    status: errors.length ? "failed" : "rendered",
    validation: {
      ready: errors.length === 0,
      errors,
      warnings: [],
      inputImageCount: sceneInputs.length,
      expectedSceneCount: storyboard.length,
      outputBytes: outputStat?.size ?? null,
      durationSec: cardRender.package.manifest.mp4.totalDurationSec
    },
    command: {
      executable: "ffmpeg",
      args,
      exitCode
    },
    files: renderedFiles
  };

  return writeMp4Report(cardRender, report);
}

function renderConcatInput(sceneInputs: Array<{ image: DailyBriefVideoCardRenderImage; durationSec: number }>) {
  const lines: string[] = [];
  for (const input of sceneInputs) {
    lines.push(`file '${escapeConcatPath(path.join(process.cwd(), input.image.relativePath))}'`);
    lines.push(`duration ${input.durationSec}`);
  }
  const last = sceneInputs[sceneInputs.length - 1];
  if (last) {
    lines.push(`file '${escapeConcatPath(path.join(process.cwd(), last.image.relativePath))}'`);
  }
  return `${lines.join("\n")}\n`;
}

async function writeMp4Report(
  cardRender: Awaited<ReturnType<typeof renderDailyBriefVideoCards>>,
  report: DailyBriefVideoMp4RenderReport
): Promise<DailyBriefVideoMp4RenderResult> {
  if (!cardRender.outputDirectory) {
    throw new Error("daily_brief_video_card_render_output_required");
  }
  const reportPath = path.join(cardRender.outputDirectory, "mp4-render-report.json");
  const reportContent = JSON.stringify(report, null, 2);
  await writeFile(reportPath, reportContent, "utf8");
  const reportFile: DailyBriefVideoPackageFile = {
    kind: "mp4_render_report_json",
    fileName: "mp4-render-report.json",
    relativePath: path.relative(process.cwd(), reportPath),
    mimeType: "application/json",
    bytes: Buffer.byteLength(reportContent, "utf8")
  };
  const nextReport = {
    ...report,
    files: [...report.files, reportFile]
  };
  return {
    cardRender,
    report: nextReport,
    outputDirectory: cardRender.outputDirectory,
    files: [...cardRender.files, ...nextReport.files]
  };
}

function buildBaseReport(input: { generatedAt: string; sourceHash: string; sourceHashPrefix: string; expectedSceneCount: number; durationSec: number }): DailyBriefVideoMp4RenderReport {
  return {
    kind: "daily_brief_video_mp4_render_report",
    version: "VIDEO-1E",
    generatedAt: input.generatedAt,
    sourceHash: input.sourceHash,
    sourceHashPrefix: input.sourceHashPrefix,
    status: "blocked",
    renderer: {
      name: "ffmpeg",
      localBinaryRequired: true,
      audioIncluded: false,
      externalUploadEnabled: false
    },
    validation: {
      ready: false,
      errors: [],
      warnings: [],
      inputImageCount: 0,
      expectedSceneCount: input.expectedSceneCount,
      outputBytes: null,
      durationSec: input.durationSec
    },
    command: null,
    files: [],
    sideEffectSummary: buildMp4SideEffects()
  };
}

async function canRunFfmpeg() {
  return (await runProcess("ffmpeg", ["-version"])) === 0;
}

async function runFfmpeg(args: string[]) {
  return runProcess("ffmpeg", args);
}

async function runProcess(command: string, args: string[]) {
  return new Promise<number>((resolve) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(-1));
    child.on("close", (code) => resolve(code ?? -1));
  });
}

function escapeConcatPath(value: string) {
  return value.replace(/'/g, "'\\''");
}

function buildMp4SideEffects(): DailyBriefVideoSideEffectSummary {
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
