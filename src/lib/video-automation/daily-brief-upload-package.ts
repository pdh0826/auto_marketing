import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import type { DailyBriefRun } from "@/lib/daily-brief/types";
import { buildDailyBriefVideoPackagePreview, writeDailyBriefVideoPackage } from "./daily-brief-package";
import type {
  DailyBriefVideoFileKind,
  DailyBriefVideoPackageFile,
  DailyBriefVideoPackageReadbackArtifact,
  DailyBriefVideoPackageReadbackResult,
  DailyBriefVideoSideEffectSummary,
  DailyBriefVideoUploadMetadataResult
} from "./types";

const OUTPUT_ROOT = path.join(process.cwd(), "local-data", "video-automation", "daily-brief");

export async function writeDailyBriefVideoUploadMetadata(run: DailyBriefRun, generatedAt = new Date().toISOString()): Promise<DailyBriefVideoUploadMetadataResult> {
  const videoPackage = await writeDailyBriefVideoPackage(run, generatedAt);
  if (!videoPackage.outputDirectory) {
    throw new Error("daily_brief_video_package_output_required");
  }
  const uploadDirectory = path.join(videoPackage.outputDirectory, "upload");
  await mkdir(uploadDirectory, { recursive: true });

  const base = {
    sourceRunId: videoPackage.manifest.source.id,
    sourceHash: videoPackage.manifest.sourceSnapshot.hash,
    sourceHashPrefix: videoPackage.manifest.sourceSnapshot.hashPrefix,
    uploadEnabled: false,
    platformUploadsEnabled: false,
    manualReviewRequired: true,
    blockedReasons: videoPackage.manifest.uploadPackage.blockedReasons,
    title: videoPackage.manifest.uploadPackage.title,
    description: videoPackage.manifest.uploadPackage.description,
    hashtags: videoPackage.manifest.uploadPackage.hashtags
  };
  const platformPayloads = [
    {
      kind: "upload_youtube_json" as const,
      fileName: "youtube.json",
      payload: {
        ...base,
        platform: "youtube",
        category: "education",
        madeForKids: false,
        visibility: "private_review_only"
      }
    },
    {
      kind: "upload_instagram_json" as const,
      fileName: "instagram.json",
      payload: {
        ...base,
        platform: "instagram",
        format: "reel",
        caption: `${base.title}\n\n${base.hashtags.map((tag) => `#${tag}`).join(" ")}`
      }
    },
    {
      kind: "upload_tiktok_json" as const,
      fileName: "tiktok.json",
      payload: {
        ...base,
        platform: "tiktok",
        format: "vertical_short",
        caption: `${base.title} ${base.hashtags.map((tag) => `#${tag}`).join(" ")}`
      }
    }
  ];

  const files: DailyBriefVideoPackageFile[] = [];
  for (const item of platformPayloads) {
    const filePath = path.join(uploadDirectory, item.fileName);
    const content = JSON.stringify(item.payload, null, 2);
    await writeFile(filePath, content, "utf8");
    files.push(fileRecord(item.kind, filePath, item.fileName, "application/json", Buffer.byteLength(content, "utf8")));
  }

  const checklist = renderOperatorChecklist(base);
  const checklistPath = path.join(uploadDirectory, "operator-checklist.md");
  await writeFile(checklistPath, checklist, "utf8");
  files.push(fileRecord("operator_checklist_md", checklistPath, "operator-checklist.md", "text/markdown", Buffer.byteLength(checklist, "utf8")));

  return {
    package: videoPackage,
    outputDirectory: videoPackage.outputDirectory,
    files: [...videoPackage.files, ...files],
    metadata: {
      version: "VIDEO-1F",
      sourceHash: videoPackage.manifest.sourceSnapshot.hash,
      sourceHashPrefix: videoPackage.manifest.sourceSnapshot.hashPrefix,
      uploadEnabled: false,
      platformUploadsEnabled: false,
      manualReviewRequired: true,
      blockedReasons: videoPackage.manifest.uploadPackage.blockedReasons,
      sideEffectSummary: buildSideEffects({ localFileWrite: true })
    }
  };
}

export async function readDailyBriefVideoPackage(run: DailyBriefRun): Promise<DailyBriefVideoPackageReadbackResult> {
  const preview = buildDailyBriefVideoPackagePreview(run);
  const packageSlug = preview.manifest.uploadPackage.packageSlug;
  const outputDirectory = path.join(OUTPUT_ROOT, packageSlug);
  const manifestPath = path.join(outputDirectory, "manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf8").catch(() => null);
  const savedSourceHash = readSavedSourceHash(manifestRaw);
  const artifacts = await Promise.all([
    artifact("manifest_json", outputDirectory, "manifest.json"),
    artifact("storyboard_json", outputDirectory, "storyboard.json"),
    artifact("subtitles_srt", outputDirectory, "subtitles.srt"),
    artifact("subtitles_vtt", outputDirectory, "subtitles.vtt"),
    artifact("card_news_html", outputDirectory, "card-news.html"),
    artifact("cover_html", outputDirectory, "cover.html"),
    artifact("card_render_report_json", outputDirectory, "card-render-report.json"),
    artifact("mp4_render_report_json", outputDirectory, "mp4-render-report.json"),
    artifact("video_mp4", outputDirectory, "video.mp4"),
    artifact("upload_youtube_json", path.join(outputDirectory, "upload"), "youtube.json"),
    artifact("upload_instagram_json", path.join(outputDirectory, "upload"), "instagram.json"),
    artifact("upload_tiktok_json", path.join(outputDirectory, "upload"), "tiktok.json"),
    artifact("operator_checklist_md", path.join(outputDirectory, "upload"), "operator-checklist.md")
  ]);

  return {
    version: "VIDEO-1H",
    package: preview,
    outputDirectory,
    exists: artifacts.some((item) => item.exists),
    currentSourceHash: preview.manifest.sourceSnapshot.hash,
    savedSourceHash,
    stale: savedSourceHash ? savedSourceHash !== preview.manifest.sourceSnapshot.hash : null,
    artifacts,
    guard: {
      operatingRepoTouched: false,
      server3004Touched: false,
      externalWriteRoutesEnabled: false,
      schedulerMutationEnabled: false,
      secretReadRequired: false
    },
    sideEffectSummary: buildSideEffects({ localFileWrite: false })
  };
}

function renderOperatorChecklist(input: {
  sourceRunId: string;
  sourceHashPrefix: string;
  title: string;
  description: string;
  hashtags: string[];
  blockedReasons: string[];
}) {
  return `# Daily Brief Video Operator Checklist

- Source run: ${input.sourceRunId}
- Source hash: ${input.sourceHashPrefix}
- Upload enabled: false
- External platform upload: false

## Review Before Any Manual Use

- [ ] Confirm the MP4 exists and plays locally.
- [ ] Confirm all stock/ETF/futures numbers against the source Daily Brief.
- [ ] Confirm the video includes the risk note.
- [ ] Confirm this is information, not investment advice.
- [ ] Confirm title, description, and hashtags are appropriate.
- [ ] Confirm no API upload or automated publishing route is being used.

## Title

${input.title}

## Description

${input.description}

## Hashtags

${input.hashtags.map((tag) => `#${tag}`).join(" ")}

## Blocked Reasons

${input.blockedReasons.map((reason) => `- ${reason}`).join("\n")}
`;
}

async function artifact(kind: DailyBriefVideoFileKind, directory: string, fileName: string): Promise<DailyBriefVideoPackageReadbackArtifact> {
  const filePath = path.join(directory, fileName);
  const fileStat = await stat(filePath).catch(() => null);
  return {
    kind,
    fileName,
    relativePath: path.relative(process.cwd(), filePath),
    exists: Boolean(fileStat),
    bytes: fileStat?.size ?? null
  };
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

function readSavedSourceHash(raw: string | null) {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { sourceSnapshot?: { hash?: unknown } };
    return typeof parsed.sourceSnapshot?.hash === "string" ? parsed.sourceSnapshot.hash : null;
  } catch {
    return null;
  }
}

function buildSideEffects(input: { localFileWrite: boolean }): DailyBriefVideoSideEffectSummary {
  return {
    dailyBriefRunRead: true,
    dailyBriefRunWrite: false,
    existingContentItemMutation: false,
    dbWrite: false,
    localFileWrite: input.localFileWrite,
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
