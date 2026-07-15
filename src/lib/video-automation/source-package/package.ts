import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { truncateText } from "../core/source-bundle";
import type { VideoScriptScene } from "../core/types";
import type { VideoSourcePreviewResult } from "../source-collection/types";
import type {
  VideoSourcePackageCard,
  VideoSourcePackageFile,
  VideoSourcePackageManifest,
  VideoSourcePackageResult,
  VideoSourcePackageSideEffectSummary,
  VideoSourcePackageStoryboardScene,
  VideoSourcePackageSubtitleCue,
  VideoSourcePackageTextCardImage,
  VideoSourcePackageTextCardImagePlan
} from "./types";

const VIDEO_SOURCE_PACKAGE_VERSION = "VIDEO-5";
const OUTPUT_ROOT = path.join(process.cwd(), "local-data", "video-automation", "sources");
const MAX_PACKAGE_CARD_COUNT = 9;
const TEXT_CARD_WIDTH = 1080;
const TEXT_CARD_HEIGHT = 1920;
const TEXT_CARD_TITLE_MAX_CHARS = 38;
const TEXT_CARD_BODY_LINE_MAX_CHARS = 34;
const TEXT_CARD_BODY_LINE_MAX_COUNT = 4;
const SUBTITLE_MAX_CHARS = 56;
const SUBTITLE_MAX_LINES = 1;

export function buildVideoSourcePackagePreview(preview: VideoSourcePreviewResult, generatedAt = new Date().toISOString()): VideoSourcePackageResult {
  const packageSlug = buildPackageSlug(preview);
  const cards = buildCards(preview.scriptPlan.scenes, preview.sourceBundle.riskNotes[0] ?? null);
  const textCardImagePlan = buildTextCardImagePlan(packageSlug, cards);
  const storyboard = buildStoryboard(cards);
  const subtitles = buildSubtitles(storyboard);
  const sideEffectSummary = buildPackageSideEffects(preview, false);
  const validation = buildValidation(preview, cards, storyboard, subtitles);
  const blockingReasons = Array.from(new Set([...preview.readiness.blockingReasons, ...validation.errors]));
  const warnings = Array.from(new Set([...preview.readiness.warnings, ...validation.warnings, "generic_mp4_renderer_not_connected_in_video_5", "external_uploads_disabled_by_policy"]));
  const manifest: VideoSourcePackageManifest = {
    kind: "video_source_package",
    version: VIDEO_SOURCE_PACKAGE_VERSION,
    generatedAt,
    packageSlug,
    sourceSnapshot: preview.sourceBundle.sourceSnapshot,
    sourceCollection: {
      kind: preview.collection.kind,
      sourceType: preview.collection.sourceType,
      sourceId: preview.collection.sourceId,
      sourceUrl: preview.collection.sourceUrl,
      evidenceCount: preview.collection.evidenceCount,
      visualCandidateCount: preview.collection.visualCandidateCount,
      sideEffectSummary: preview.collection.sideEffectSummary
    },
    source: {
      title: preview.sourceBundle.title,
      summary: preview.sourceBundle.summary,
      hash: preview.sourceBundle.sourceSnapshot.hash,
      hashPrefix: preview.sourceBundle.sourceSnapshot.hashPrefix
    },
    readiness: {
      canGeneratePackage: blockingReasons.length === 0,
      canRenderMp4: false,
      canUpload: false,
      blockingReasons,
      warnings
    },
    scriptPlan: preview.scriptPlan,
    cards,
    textCardImagePlan,
    storyboard,
    subtitles,
    mp4: {
      status: "render_plan_only",
      renderImplemented: false,
      targetFileName: `${packageSlug}.mp4`,
      sourceHash: preview.sourceBundle.sourceSnapshot.hash,
      sourceHashPrefix: preview.sourceBundle.sourceSnapshot.hashPrefix,
      resolution: "1080x1920",
      fps: 30,
      totalDurationSec: storyboard.length ? storyboard[storyboard.length - 1].endSec : 0,
      requiredRenderer: "future_generic_video_renderer",
      blockingReason: "generic_mp4_binary_rendering_not_connected_in_video_5"
    },
    uploadPackage: {
      ready: false,
      packageSlug,
      title: truncateText(preview.sourceBundle.title, 80),
      description: [
        `${preview.sourceBundle.title} 영상 소스 기반 로컬 패키지입니다.`,
        "VIDEO-5는 source preview를 로컬 패키지 산출물로 연결하지만 외부 업로드는 비활성입니다.",
        "업로드 전 사람이 원문, 출처, 저작권, 위험 고지, 자막을 검토해야 합니다."
      ].join("\n"),
      hashtags: ["VideoSource", "BlogGrowthAgent", "Shortform"],
      blockedReasons: ["generic_mp4_renderer_not_connected_in_video_5", "youtube_instagram_tiktok_uploads_forbidden", "manual_review_required_before_any_external_write"],
      platformUploadsEnabled: false
    },
    files: buildPackageFileList(packageSlug, textCardImagePlan),
    validation,
    sideEffectSummary
  };

  return {
    preview,
    manifest,
    outputDirectory: null,
    files: manifest.files
  };
}

export async function writeVideoSourcePackage(preview: VideoSourcePreviewResult, generatedAt = new Date().toISOString()): Promise<VideoSourcePackageResult> {
  const packagePreview = buildVideoSourcePackagePreview(preview, generatedAt);
  if (!packagePreview.manifest.readiness.canGeneratePackage) {
    return packagePreview;
  }
  const outputDirectory = path.join(OUTPUT_ROOT, packagePreview.manifest.packageSlug);
  await mkdir(outputDirectory, { recursive: true });
  const artifactContents = buildArtifactContents(packagePreview.manifest);
  const writtenFiles: VideoSourcePackageFile[] = [];
  for (const artifact of artifactContents) {
    const filePath = path.join(outputDirectory, artifact.fileName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, artifact.content, "utf8");
    writtenFiles.push({
      kind: artifact.kind,
      fileName: artifact.fileName,
      relativePath: path.relative(process.cwd(), filePath),
      mimeType: artifact.mimeType,
      bytes: Buffer.byteLength(artifact.content, "utf8")
    });
  }

  let manifestBytes: number | null = null;
  let manifest = {
    ...packagePreview.manifest,
    files: [buildManifestFile(packagePreview.manifest.packageSlug, manifestBytes), ...writtenFiles],
    sideEffectSummary: buildPackageSideEffects(preview, true)
  };
  let manifestContent = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    manifestContent = JSON.stringify(manifest, null, 2);
    const nextBytes = Buffer.byteLength(manifestContent, "utf8");
    if (nextBytes === manifestBytes) {
      break;
    }
    manifestBytes = nextBytes;
    manifest = {
      ...manifest,
      files: [buildManifestFile(packagePreview.manifest.packageSlug, manifestBytes), ...writtenFiles]
    };
  }
  manifestContent = JSON.stringify(manifest, null, 2);
  await writeFile(path.join(outputDirectory, "manifest.json"), manifestContent, "utf8");

  return {
    preview,
    manifest,
    outputDirectory,
    files: manifest.files
  };
}

function buildCards(scenes: VideoScriptScene[], riskNote: string | null): VideoSourcePackageCard[] {
  const insightCards = scenes.slice(0, Math.max(0, MAX_PACKAGE_CARD_COUNT - 2)).map((scene, index) => ({
    id: `insight-${String(index + 1).padStart(2, "0")}`,
    title: truncateText(scene.title, TEXT_CARD_TITLE_MAX_CHARS),
    bodyLines: buildTextCardBodyLines(scene.narration),
    visualMaterialIds: scene.visualMaterialIds,
    sourceInsightIds: scene.sourceInsightIds
  }));
  return [
    {
      id: "cover",
      title: truncateText(scenes[0]?.title ?? "영상 소스 패키지", TEXT_CARD_TITLE_MAX_CHARS),
      bodyLines: ["선택한 소스를 영상 카드로 변환합니다."],
      visualMaterialIds: scenes[0]?.visualMaterialIds ?? [],
      sourceInsightIds: scenes[0]?.sourceInsightIds ?? []
    },
    ...insightCards,
    {
      id: "closing-risk-note",
      title: "검토 후 업로드",
      bodyLines: buildTextCardBodyLines(riskNote ?? "이 콘텐츠는 정보 제공 목적이며 업로드 전 사람이 출처와 사실관계를 검토해야 합니다."),
      visualMaterialIds: [],
      sourceInsightIds: []
    }
  ].slice(0, MAX_PACKAGE_CARD_COUNT);
}

function buildTextCardBodyLines(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }
  const sentences = normalized
    .split(/(?<=[.!?。！？다요죠음임함됨니다])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const source = sentences.length ? sentences : [normalized];
  const lines: string[] = [];
  for (const sentence of source) {
    lines.push(...wrapText(sentence, TEXT_CARD_BODY_LINE_MAX_CHARS));
    if (lines.length >= TEXT_CARD_BODY_LINE_MAX_COUNT) {
      break;
    }
  }
  return lines.slice(0, TEXT_CARD_BODY_LINE_MAX_COUNT).map((line) => truncateText(line, TEXT_CARD_BODY_LINE_MAX_CHARS));
}

function buildStoryboard(cards: VideoSourcePackageCard[]): VideoSourcePackageStoryboardScene[] {
  let cursor = 0;
  return cards.map((card, index) => {
    const durationSec = index === 0 || index === cards.length - 1 ? 4 : 5;
    const scene = {
      id: `scene-${String(index + 1).padStart(2, "0")}`,
      startSec: cursor,
      endSec: cursor + durationSec,
      durationSec,
      title: card.title,
      narration: truncateText([card.title, ...card.bodyLines].join(" "), 220),
      visualMaterialIds: card.visualMaterialIds,
      sourceInsightIds: card.sourceInsightIds
    };
    cursor += durationSec;
    return scene;
  });
}

function buildSubtitles(storyboard: VideoSourcePackageStoryboardScene[]): VideoSourcePackageSubtitleCue[] {
  return storyboard.map((scene, index) => ({
    index: index + 1,
    startSec: scene.startSec,
    endSec: scene.endSec,
    text: buildSubtitleText(scene)
  }));
}

function buildSubtitleText(scene: VideoSourcePackageStoryboardScene) {
  const firstSentence =
    scene.narration
      .replace(/\s+/g, " ")
      .trim()
      .split(/(?<=[.!?。！？다요죠음임함됨니다])\s+/)
      .find((item) => item.trim() && item.trim() !== scene.title.trim()) ?? scene.title;
  const normalized = firstSentence.replace(/\s+/g, " ").trim();
  if (normalized.length <= SUBTITLE_MAX_CHARS) {
    return normalized;
  }
  const withoutPrefix = normalized.startsWith(scene.title) ? normalized.slice(scene.title.length).replace(/^[\s.·:-]+/, "") : normalized;
  return truncateText(withoutPrefix || scene.title, SUBTITLE_MAX_CHARS);
}

function buildValidation(
  preview: VideoSourcePreviewResult,
  cards: VideoSourcePackageCard[],
  storyboard: VideoSourcePackageStoryboardScene[],
  subtitles: VideoSourcePackageSubtitleCue[]
): VideoSourcePackageManifest["validation"] {
  const errors = [
    !preview.readiness.ready ? "source_preview_not_ready" : null,
    cards.length === 0 ? "cards_missing" : null,
    cards[cards.length - 1]?.id !== "closing-risk-note" ? "closing_risk_note_missing" : null,
    storyboard.length !== cards.length ? "storyboard_card_count_mismatch" : null,
    subtitles.length !== storyboard.length ? "subtitle_storyboard_count_mismatch" : null,
    subtitles.every((subtitle) => subtitle.text.length <= SUBTITLE_MAX_CHARS) ? null : "subtitle_text_too_long",
    preview.packageScaffold.uploadEnabled === false && preview.packageScaffold.platformUploadsEnabled === false ? null : "upload_flags_must_stay_disabled"
  ].filter((item): item is string => Boolean(item));
  const warnings = [
    preview.collection.visualCandidateCount === 0 ? "visual_candidates_missing_text_cards_only" : null,
    "mp4_render_plan_only"
  ].filter((item): item is string => Boolean(item));
  return {
    ready: errors.length === 0,
    errors,
    warnings,
    counts: {
      cardCount: cards.length,
      storyboardSceneCount: storyboard.length,
      subtitleCueCount: subtitles.length,
      totalDurationSec: storyboard.length ? storyboard[storyboard.length - 1].endSec : 0
    }
  };
}

function buildPackageSideEffects(preview: VideoSourcePreviewResult, localFileWrite: boolean): VideoSourcePackageSideEffectSummary {
  return {
    sourceRead: true,
    sourceWrite: false,
    dbRead: preview.collection.sideEffectSummary.dbRead,
    dbWrite: false,
    networkRead: preview.collection.sideEffectSummary.networkRead,
    localFileWrite,
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

function buildArtifactContents(manifest: VideoSourcePackageManifest) {
  return [
    {
      kind: "storyboard_json" as const,
      fileName: "storyboard.json",
      mimeType: "application/json",
      content: JSON.stringify({ version: manifest.version, scenes: manifest.storyboard }, null, 2)
    },
    {
      kind: "subtitles_srt" as const,
      fileName: "subtitles.srt",
      mimeType: "application/x-subrip",
      content: renderSrt(manifest.subtitles)
    },
    {
      kind: "subtitles_vtt" as const,
      fileName: "subtitles.vtt",
      mimeType: "text/vtt",
      content: renderVtt(manifest.subtitles)
    },
    {
      kind: "script_txt" as const,
      fileName: "script.txt",
      mimeType: "text/plain",
      content: manifest.scriptPlan.fullScript
    },
    {
      kind: "text_card_manifest_json" as const,
      fileName: "text-card-images.json",
      mimeType: "application/json",
      content: JSON.stringify(manifest.textCardImagePlan, null, 2)
    },
    ...manifest.textCardImagePlan.images.map((image, index) => ({
      kind: image.kind,
      fileName: image.fileName,
      mimeType: "image/svg+xml",
      content: renderTextCardSvg(manifest.cards[index], image, manifest.source.hashPrefix)
    })),
    {
      kind: "card_news_html" as const,
      fileName: "card-news.html",
      mimeType: "text/html",
      content: renderCardNewsHtml(manifest)
    },
    {
      kind: "cover_html" as const,
      fileName: "cover.html",
      mimeType: "text/html",
      content: renderCoverHtml(manifest)
    },
    {
      kind: "mp4_render_plan_json" as const,
      fileName: "mp4-render-plan.json",
      mimeType: "application/json",
      content: JSON.stringify(manifest.mp4, null, 2)
    }
  ];
}

function buildPackageFileList(packageSlug: string, textCardImagePlan: VideoSourcePackageTextCardImagePlan): VideoSourcePackageFile[] {
  return [
    buildManifestFile(packageSlug, null),
    fileRecord("storyboard_json", packageSlug, "storyboard.json", "application/json"),
    fileRecord("subtitles_srt", packageSlug, "subtitles.srt", "application/x-subrip"),
    fileRecord("subtitles_vtt", packageSlug, "subtitles.vtt", "text/vtt"),
    fileRecord("script_txt", packageSlug, "script.txt", "text/plain"),
    fileRecord("text_card_manifest_json", packageSlug, "text-card-images.json", "application/json"),
    ...textCardImagePlan.images.map((image) => imageFileRecord(image)),
    fileRecord("card_news_html", packageSlug, "card-news.html", "text/html"),
    fileRecord("cover_html", packageSlug, "cover.html", "text/html"),
    fileRecord("mp4_render_plan_json", packageSlug, "mp4-render-plan.json", "application/json")
  ];
}

function buildManifestFile(packageSlug: string, bytes: number | null): VideoSourcePackageFile {
  return fileRecord("manifest_json", packageSlug, "manifest.json", "application/json", bytes);
}

function fileRecord(kind: VideoSourcePackageFile["kind"], packageSlug: string, fileName: string, mimeType: string, bytes: number | null = null): VideoSourcePackageFile {
  return {
    kind,
    fileName,
    relativePath: path.join("local-data", "video-automation", "sources", packageSlug, fileName),
    mimeType,
    bytes
  };
}

function imageFileRecord(image: VideoSourcePackageTextCardImage): VideoSourcePackageFile {
  return {
    kind: image.kind,
    fileName: image.fileName,
    relativePath: image.relativePath,
    mimeType: "image/svg+xml",
    bytes: null
  };
}

function renderSrt(cues: VideoSourcePackageSubtitleCue[]) {
  return `${cues.map((cue) => `${cue.index}\n${formatSrtTime(cue.startSec)} --> ${formatSrtTime(cue.endSec)}\n${cue.text}`).join("\n\n")}\n`;
}

function renderVtt(cues: VideoSourcePackageSubtitleCue[]) {
  return `WEBVTT\n\n${cues.map((cue) => `${formatVttTime(cue.startSec)} --> ${formatVttTime(cue.endSec)}\n${cue.text}`).join("\n\n")}\n`;
}

function renderCardNewsHtml(manifest: VideoSourcePackageManifest) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(manifest.source.title)} - Video Source Cards</title>
  <style>
    body { margin: 0; background: #f7f7f8; color: #18181b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .card { aspect-ratio: 9 / 16; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #d4d4d8; border-radius: 8px; background: #ffffff; padding: 20px; }
    h1 { margin: 0 0 18px; font-size: 28px; line-height: 1.2; }
    h2 { margin: 0; font-size: 24px; line-height: 1.18; }
    p { margin: 10px 0 0; font-size: 16px; line-height: 1.45; }
    small { color: #71717a; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(manifest.source.title)}</h1>
    <div class="grid">
      ${manifest.cards
        .map(
          (card) => `<article class="card">
        <div>
          <small>${escapeHtml(card.id)}</small>
          <h2>${escapeHtml(card.title)}</h2>
          ${card.bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        </div>
        <small>source hash ${escapeHtml(manifest.source.hashPrefix)}</small>
      </article>`
        )
        .join("\n")}
    </div>
  </main>
</body>
</html>
`;
}

function renderCoverHtml(manifest: VideoSourcePackageManifest) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(manifest.source.title)} - Cover</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #18181b; color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .cover { width: min(420px, 92vw); aspect-ratio: 9 / 16; display: flex; flex-direction: column; justify-content: space-between; border-radius: 8px; padding: 34px 28px; background: linear-gradient(160deg, #18181b 0%, #164e63 52%, #22c55e 100%); }
    .eyebrow { font-size: 14px; opacity: 0.82; }
    h1 { margin: 14px 0 0; font-size: 34px; line-height: 1.12; }
    p { margin: 0; line-height: 1.5; }
    code { color: #d9f99d; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="eyebrow">VIDEO-5 Source Package</div>
      <h1>${escapeHtml(manifest.source.title)}</h1>
    </div>
    <p>${escapeHtml(manifest.source.summary)}</p>
    <p><code>${escapeHtml(manifest.source.hashPrefix)}</code></p>
  </section>
</body>
</html>
`;
}

function buildTextCardImagePlan(packageSlug: string, cards: VideoSourcePackageCard[]): VideoSourcePackageTextCardImagePlan {
  return {
    format: "svg",
    width: TEXT_CARD_WIDTH,
    height: TEXT_CARD_HEIGHT,
    rules: {
      titleMaxChars: TEXT_CARD_TITLE_MAX_CHARS,
      bodyLineMaxChars: TEXT_CARD_BODY_LINE_MAX_CHARS,
      bodyLineMaxCount: TEXT_CARD_BODY_LINE_MAX_COUNT,
      subtitleMaxChars: SUBTITLE_MAX_CHARS,
      subtitleMaxLines: SUBTITLE_MAX_LINES
    },
    images: cards.map((card, index) => {
      const fileName = index === 0 ? "cards/cover.svg" : `cards/card-${String(index).padStart(3, "0")}-${sanitizeFileSegment(card.id)}.svg`;
      return {
        kind: index === 0 ? "cover_svg" : "card_svg",
        cardId: card.id,
        fileName,
        relativePath: path.join("local-data", "video-automation", "sources", packageSlug, fileName),
        width: TEXT_CARD_WIDTH,
        height: TEXT_CARD_HEIGHT,
        format: "svg"
      };
    })
  };
}

function renderTextCardSvg(card: VideoSourcePackageCard, image: VideoSourcePackageTextCardImage, sourceHashPrefix: string) {
  const titleLines = wrapText(card.title, 14).slice(0, 3);
  const bodyLines = card.bodyLines.flatMap((line) => wrapText(line, TEXT_CARD_BODY_LINE_MAX_CHARS)).slice(0, TEXT_CARD_BODY_LINE_MAX_COUNT);
  const isCover = image.kind === "cover_svg";
  const background = isCover
    ? `<linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#18181b"/><stop offset="52%" stop-color="#155e75"/><stop offset="100%" stop-color="#22c55e"/></linearGradient>`
    : `<linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#fafafa"/><stop offset="55%" stop-color="#ecfeff"/><stop offset="100%" stop-color="#dcfce7"/></linearGradient>`;
  const titleColor = isCover ? "#f8fafc" : "#18181b";
  const bodyColor = isCover ? "#e5e7eb" : "#3f3f46";
  const metaColor = isCover ? "#bbf7d0" : "#0f766e";
  const titleY = 310;
  const bodyY = titleY + titleLines.length * 108 + 130;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TEXT_CARD_WIDTH}" height="${TEXT_CARD_HEIGHT}" viewBox="0 0 ${TEXT_CARD_WIDTH} ${TEXT_CARD_HEIGHT}">
  <defs>${background}</defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect x="58" y="58" width="964" height="1804" rx="36" fill="${isCover ? "rgba(15,23,42,0.18)" : "rgba(255,255,255,0.68)"}" stroke="${isCover ? "rgba(248,250,252,0.35)" : "#d4d4d8"}" stroke-width="3"/>
  <text x="92" y="142" fill="${metaColor}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="34" font-weight="700">VIDEO SOURCE · ${escapeXml(sourceHashPrefix)}</text>
  ${titleLines
    .map(
      (line, index) =>
        `<text x="92" y="${titleY + index * 108}" fill="${titleColor}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="82" font-weight="800">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  ${bodyLines
    .map(
      (line, index) =>
        `<text x="98" y="${bodyY + index * 72}" fill="${bodyColor}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="46" font-weight="650">${escapeXml(line)}</text>`
    )
    .join("\n  ")}
  <text x="92" y="1754" fill="${metaColor}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="30" font-weight="700">${escapeXml(card.id)}</text>
</svg>
`;
}

function formatSrtTime(seconds: number) {
  return formatTime(seconds, ",");
}

function formatVttTime(seconds: number) {
  return formatTime(seconds, ".");
}

function formatTime(seconds: number, millisecondSeparator: "," | ".") {
  const whole = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}${millisecondSeparator}000`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value: string) {
  return escapeHtml(value);
}

function wrapText(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.flatMap((line) => splitLongWord(line, maxChars));
}

function splitLongWord(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return [value];
  }
  const result: string[] = [];
  for (let index = 0; index < value.length; index += maxChars) {
    result.push(value.slice(index, index + maxChars));
  }
  return result;
}

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "-").replace(/-+/g, "-").slice(0, 80);
}

function buildPackageSlug(preview: VideoSourcePreviewResult) {
  const slug = `${preview.collection.kind}-${preview.collection.sourceId}-${preview.sourceBundle.sourceSnapshot.hashPrefix}`
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  if (!slug || slug === "." || slug === "..") {
    throw new Error("invalid_video_source_package_slug");
  }
  return slug;
}
