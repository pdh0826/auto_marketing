import type { DailyBriefRun } from "@/lib/daily-brief/types";

export type DailyBriefVideoFileKind =
  | "manifest_json"
  | "storyboard_json"
  | "subtitles_srt"
  | "subtitles_vtt"
  | "card_news_html"
  | "cover_html"
  | "mp4_render_plan_json"
  | "cover_png"
  | "card_png"
  | "card_render_report_json"
  | "video_mp4"
  | "mp4_render_report_json"
  | "mp4_render_command_json"
  | "mp4_concat_input_txt"
  | "upload_youtube_json"
  | "upload_instagram_json"
  | "upload_tiktok_json"
  | "operator_checklist_md"
  | "package_readback_json";

export interface DailyBriefVideoPackageFile {
  kind: DailyBriefVideoFileKind;
  fileName: string;
  relativePath: string;
  mimeType: string;
  bytes: number | null;
}

export interface DailyBriefVideoSourceSnapshot {
  schemaVersion: "daily_brief_video_source_v1";
  hashAlgorithm: "sha256";
  hash: string;
  hashPrefix: string;
  canonicalJsonLength: number;
  includedFields: string[];
  excludedFields: string[];
}

export type DailyBriefVideoValidationStatus = "pass" | "warn" | "fail";

export interface DailyBriefVideoValidationCheck {
  code: string;
  status: DailyBriefVideoValidationStatus;
  message: string;
}

export interface DailyBriefVideoPackageValidation {
  ready: boolean;
  errors: string[];
  warnings: string[];
  checks: DailyBriefVideoValidationCheck[];
  counts: {
    cardCount: number;
    storyboardSceneCount: number;
    subtitleCueCount: number;
    sourceCaptureReferenceCount: number;
    uniqueSourceCaptureReferenceCount: number;
    totalDurationSec: number;
  };
  deterministicArtifactFields: string[];
}

export interface DailyBriefVideoSideEffectSummary {
  dailyBriefRunRead: true;
  dailyBriefRunWrite: false;
  existingContentItemMutation: false;
  dbWrite: false;
  localFileWrite: boolean;
  externalServiceWrite: false;
  bloggerApiWrite: false;
  tistoryApiWrite: false;
  youtubeUpload: false;
  instagramUpload: false;
  tiktokUpload: false;
  scheduledPublishMutation: false;
  llmCall: false;
  secretRead: false;
}

export interface DailyBriefVideoCard {
  id: string;
  title: string;
  bodyLines: string[];
  visualHint: string;
  sourceCaptureIds: string[];
}

export interface DailyBriefVideoStoryboardScene {
  id: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  title: string;
  narration: string;
  onScreenText: string[];
  visualSource: string;
  sourceCaptureIds: string[];
}

export interface DailyBriefVideoSubtitleCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface DailyBriefVideoCoverSpec {
  title: string;
  subtitle: string;
  marketDate: string;
  highlightLabels: string[];
  sourceCaptureIds: string[];
}

export interface DailyBriefVideoMp4Plan {
  status: "render_plan_only";
  renderImplemented: false;
  targetFileName: string;
  sourceHash: string;
  sourceHashPrefix: string;
  resolution: "1080x1920";
  fps: 30;
  totalDurationSec: number;
  requiredRenderer: "future_video_renderer";
  blockingReason: "mp4_binary_rendering_not_implemented_in_video_1a";
}

export interface DailyBriefVideoUploadPackage {
  ready: false;
  packageSlug: string;
  title: string;
  description: string;
  hashtags: string[];
  blockedReasons: string[];
  platformUploadsEnabled: false;
}

export interface DailyBriefVideoPackageManifest {
  kind: "daily_brief_video_package";
  version: "VIDEO-1B";
  generatedAt: string;
  sourceSnapshot: DailyBriefVideoSourceSnapshot;
  source: Pick<
    DailyBriefRun,
    | "id"
    | "status"
    | "marketDate"
    | "title"
    | "targetKeyword"
    | "contentItemId"
    | "draftMarkdownLength"
    | "draftHtmlLength"
    | "visibleTextLength"
    | "createdAt"
    | "updatedAt"
  > & {
    stockPickCount: number;
    etfPickCount: number;
    futuresPickCount: number;
    researchItemCount: number;
    captureCount: number;
  };
  readiness: {
    canGeneratePackage: boolean;
    canRenderMp4: false;
    canUpload: false;
    blockingReasons: string[];
    warnings: string[];
  };
  cover: DailyBriefVideoCoverSpec;
  cards: DailyBriefVideoCard[];
  storyboard: DailyBriefVideoStoryboardScene[];
  subtitles: DailyBriefVideoSubtitleCue[];
  mp4: DailyBriefVideoMp4Plan;
  uploadPackage: DailyBriefVideoUploadPackage;
  validation: DailyBriefVideoPackageValidation;
  files: DailyBriefVideoPackageFile[];
  sideEffectSummary: DailyBriefVideoSideEffectSummary;
}

export interface DailyBriefVideoPackageResult {
  manifest: DailyBriefVideoPackageManifest;
  outputDirectory: string | null;
  files: DailyBriefVideoPackageFile[];
}

export interface DailyBriefVideoCardRenderImage {
  kind: "cover_png" | "card_png";
  cardId: string;
  fileName: string;
  relativePath: string;
  width: number;
  height: number;
  bytes: number;
  selectorUsed: string;
  warning: string | null;
}

export interface DailyBriefVideoCardRenderReport {
  kind: "daily_brief_video_card_render_report";
  version: "VIDEO-1C";
  generatedAt: string;
  sourceHash: string;
  sourceHashPrefix: string;
  packageManifestVersion: DailyBriefVideoPackageManifest["version"];
  status: "rendered" | "blocked" | "failed";
  renderer: {
    name: "playwright";
    viewport: "1080x1920";
    deviceScaleFactor: 1;
    pngRenderImplemented: true;
    mp4RenderImplemented: false;
  };
  validation: {
    ready: boolean;
    errors: string[];
    warnings: string[];
    renderedImageCount: number;
    expectedCardCount: number;
  };
  images: DailyBriefVideoCardRenderImage[];
  files: DailyBriefVideoPackageFile[];
  sideEffectSummary: DailyBriefVideoSideEffectSummary;
}

export interface DailyBriefVideoCardRenderResult {
  package: DailyBriefVideoPackageResult;
  report: DailyBriefVideoCardRenderReport;
  outputDirectory: string | null;
  files: DailyBriefVideoPackageFile[];
}

export interface DailyBriefVideoMp4RenderReport {
  kind: "daily_brief_video_mp4_render_report";
  version: "VIDEO-1E";
  generatedAt: string;
  sourceHash: string;
  sourceHashPrefix: string;
  status: "rendered" | "blocked" | "failed";
  renderer: {
    name: "ffmpeg";
    localBinaryRequired: true;
    audioIncluded: false;
    externalUploadEnabled: false;
  };
  validation: {
    ready: boolean;
    errors: string[];
    warnings: string[];
    inputImageCount: number;
    expectedSceneCount: number;
    outputBytes: number | null;
    durationSec: number;
  };
  command: {
    executable: "ffmpeg";
    args: string[];
    exitCode: number | null;
  } | null;
  files: DailyBriefVideoPackageFile[];
  sideEffectSummary: DailyBriefVideoSideEffectSummary;
}

export interface DailyBriefVideoMp4RenderResult {
  cardRender: DailyBriefVideoCardRenderResult;
  report: DailyBriefVideoMp4RenderReport;
  outputDirectory: string | null;
  files: DailyBriefVideoPackageFile[];
}

export interface DailyBriefVideoUploadMetadataResult {
  package: DailyBriefVideoPackageResult;
  outputDirectory: string;
  files: DailyBriefVideoPackageFile[];
  metadata: {
    version: "VIDEO-1F";
    sourceHash: string;
    sourceHashPrefix: string;
    uploadEnabled: false;
    platformUploadsEnabled: false;
    manualReviewRequired: true;
    blockedReasons: string[];
    sideEffectSummary: DailyBriefVideoSideEffectSummary;
  };
}

export interface DailyBriefVideoPackageReadbackArtifact {
  kind: DailyBriefVideoFileKind;
  fileName: string;
  relativePath: string;
  exists: boolean;
  bytes: number | null;
}

export interface DailyBriefVideoPackageReadbackResult {
  version: "VIDEO-1H";
  package: DailyBriefVideoPackageResult;
  outputDirectory: string;
  exists: boolean;
  currentSourceHash: string;
  savedSourceHash: string | null;
  stale: boolean | null;
  artifacts: DailyBriefVideoPackageReadbackArtifact[];
  guard: {
    operatingRepoTouched: false;
    server3004Touched: false;
    externalWriteRoutesEnabled: false;
    schedulerMutationEnabled: false;
    secretReadRequired: false;
  };
  sideEffectSummary: DailyBriefVideoSideEffectSummary;
}
