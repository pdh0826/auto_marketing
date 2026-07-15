import type { VideoScriptPlan, VideoSourceSnapshot, VideoSourceType } from "../core/types";
import type { SourceCollectionSideEffectSummary, VideoSourceCollectionKind, VideoSourcePreviewResult } from "../source-collection/types";

export type VideoSourcePackageFileKind =
  | "manifest_json"
  | "storyboard_json"
  | "subtitles_srt"
  | "subtitles_vtt"
  | "script_txt"
  | "text_card_manifest_json"
  | "cover_svg"
  | "card_svg"
  | "card_news_html"
  | "cover_html"
  | "mp4_render_plan_json";

export interface VideoSourcePackageFile {
  kind: VideoSourcePackageFileKind;
  fileName: string;
  relativePath: string;
  mimeType: string;
  bytes: number | null;
}

export interface VideoSourcePackageSideEffectSummary {
  sourceRead: true;
  sourceWrite: false;
  dbRead: boolean;
  dbWrite: false;
  networkRead: boolean;
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

export interface VideoSourcePackageCard {
  id: string;
  title: string;
  bodyLines: string[];
  visualMaterialIds: string[];
  sourceInsightIds: string[];
}

export interface VideoSourcePackageStoryboardScene {
  id: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  title: string;
  narration: string;
  visualMaterialIds: string[];
  sourceInsightIds: string[];
}

export interface VideoSourcePackageSubtitleCue {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface VideoSourcePackageTextCardImage {
  kind: "cover_svg" | "card_svg";
  cardId: string;
  fileName: string;
  relativePath: string;
  width: 1080;
  height: 1920;
  format: "svg";
}

export interface VideoSourcePackageTextCardImagePlan {
  format: "svg";
  width: 1080;
  height: 1920;
  rules: {
    titleMaxChars: number;
    bodyLineMaxChars: number;
    bodyLineMaxCount: number;
    subtitleMaxChars: number;
    subtitleMaxLines: 1;
  };
  images: VideoSourcePackageTextCardImage[];
}

export interface VideoSourcePackageManifest {
  kind: "video_source_package";
  version: "VIDEO-5";
  generatedAt: string;
  packageSlug: string;
  sourceSnapshot: VideoSourceSnapshot;
  sourceCollection: {
    kind: VideoSourceCollectionKind;
    sourceType: VideoSourceType;
    sourceId: string;
    sourceUrl: string | null;
    evidenceCount: number;
    visualCandidateCount: number;
    sideEffectSummary: SourceCollectionSideEffectSummary;
  };
  source: {
    title: string;
    summary: string;
    hash: string;
    hashPrefix: string;
  };
  readiness: {
    canGeneratePackage: boolean;
    canRenderMp4: false;
    canUpload: false;
    blockingReasons: string[];
    warnings: string[];
  };
  scriptPlan: VideoScriptPlan;
  cards: VideoSourcePackageCard[];
  textCardImagePlan: VideoSourcePackageTextCardImagePlan;
  storyboard: VideoSourcePackageStoryboardScene[];
  subtitles: VideoSourcePackageSubtitleCue[];
  mp4: {
    status: "render_plan_only";
    renderImplemented: false;
    targetFileName: string;
    sourceHash: string;
    sourceHashPrefix: string;
    resolution: "1080x1920";
    fps: 30;
    totalDurationSec: number;
    requiredRenderer: "future_generic_video_renderer";
    blockingReason: "generic_mp4_binary_rendering_not_connected_in_video_5";
  };
  uploadPackage: {
    ready: false;
    packageSlug: string;
    title: string;
    description: string;
    hashtags: string[];
    blockedReasons: string[];
    platformUploadsEnabled: false;
  };
  files: VideoSourcePackageFile[];
  validation: {
    ready: boolean;
    errors: string[];
    warnings: string[];
    counts: {
      cardCount: number;
      storyboardSceneCount: number;
      subtitleCueCount: number;
      totalDurationSec: number;
    };
  };
  sideEffectSummary: VideoSourcePackageSideEffectSummary;
}

export interface VideoSourcePackageResult {
  preview: VideoSourcePreviewResult;
  manifest: VideoSourcePackageManifest;
  outputDirectory: string | null;
  files: VideoSourcePackageFile[];
}
