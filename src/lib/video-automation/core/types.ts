export type VideoSourceType = "daily_brief" | "content_item" | "blog_post" | "manual_collection" | string;
export type VideoLanguage = "ko" | "en";

export interface VideoSourceSnapshot {
  schemaVersion: "video_source_bundle_v1";
  hashAlgorithm: "sha256";
  hash: string;
  hashPrefix: string;
  canonicalJsonLength: number;
  includedFields: string[];
  excludedFields: string[];
}

export interface VideoSourceProvenance {
  id: string;
  kind: "run" | "content_item" | "asset" | "capture" | "research" | "disclosure" | "context" | "manual";
  title: string;
  sourceName: string;
  url: string | null;
  publishedAt: string | null;
}

export interface VideoInsight {
  id: string;
  priority: number;
  title: string;
  summary: string;
  evidenceText: string;
  sourceRefs: string[];
  tags: string[];
}

export type VideoVisualMaterialKind = "capture" | "image" | "chart" | "thumbnail" | "text_card" | "generated_card";

export interface VideoVisualMaterial {
  id: string;
  kind: VideoVisualMaterialKind;
  title: string;
  description: string;
  sourceRef: string;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  safeForPublicUse: boolean;
}

export interface VideoSourceSideEffectSummary {
  sourceRead: true;
  sourceWrite: false;
  existingContentItemMutation: false;
  dbWrite: false;
  localFileWrite: false;
  externalServiceWrite: false;
  secretRead: false;
  llmCall: false;
  schedulerMutation: false;
}

export interface VideoSourceBundle {
  sourceType: VideoSourceType;
  sourceId: string;
  title: string;
  summary: string;
  language: VideoLanguage;
  sourceSnapshot: VideoSourceSnapshot;
  provenance: VideoSourceProvenance[];
  insights: VideoInsight[];
  visualMaterials: VideoVisualMaterial[];
  riskNotes: string[];
  sideEffectSummary: VideoSourceSideEffectSummary;
}

export interface VideoScriptScene {
  id: string;
  title: string;
  narration: string;
  sourceInsightIds: string[];
  visualMaterialIds: string[];
}

export interface VideoScriptPlan {
  sourceHash: string;
  sourceHashPrefix: string;
  language: VideoLanguage;
  hook: string;
  scenes: VideoScriptScene[];
  closing: string;
  riskNote: string | null;
  fullScript: string;
}

export interface GenericVideoPackageScaffold {
  sourceType: VideoSourceType;
  sourceId: string;
  sourceHash: string;
  sourceHashPrefix: string;
  title: string;
  insightCount: number;
  visualMaterialCount: number;
  riskNoteCount: number;
  scriptSceneCount: number;
  uploadEnabled: false;
  platformUploadsEnabled: false;
}
