import type { GenericVideoPackageScaffold, VideoLanguage, VideoScriptPlan, VideoSourceBundle, VideoSourceType, VideoVisualMaterialKind } from "../core/types";

export type VideoSourceCollectionKind = "manual" | "content_item" | "daily_brief" | "site_recipe" | "generic_url";

export interface SourceCollectionSafetyPolicy {
  mode: "read_only_preview";
  maxSnippetChars: number;
  maxEvidenceItems: number;
  maxVisualCandidates: number;
  allowNetworkRead: boolean;
  allowedDomains: string[];
  requireAttribution: boolean;
  storeFullBody: false;
  externalWriteEnabled: false;
  secretReadEnabled: false;
  llmCallEnabled: false;
}

export interface SourceCollectionSideEffectSummary {
  sourceRead: true;
  sourceWrite: false;
  dbRead: boolean;
  dbWrite: false;
  networkRead: boolean;
  localFileWrite: false;
  externalServiceWrite: false;
  secretRead: false;
  llmCall: false;
  schedulerMutation: false;
}

export interface CollectedEvidence {
  id: string;
  title: string;
  textSnippet: string;
  originalTextLength: number;
  snippetLength: number;
  sourceUrl: string | null;
  selector: string | null;
  attribution: string;
  collectedAt: string;
  tags: string[];
}

export interface CollectedVisualCandidate {
  id: string;
  kind: VideoVisualMaterialKind;
  title: string;
  description: string;
  sourceRef: string;
  sourceUrl: string | null;
  selector: string | null;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  safeForPublicUse: boolean;
}

export interface CollectedVideoSource {
  collectionKind: VideoSourceCollectionKind;
  sourceType: VideoSourceType;
  sourceId: string;
  title: string;
  summary: string;
  language: VideoLanguage;
  sourceUrl: string | null;
  collectedAt: string;
  evidence: CollectedEvidence[];
  visualCandidates: CollectedVisualCandidate[];
  riskNotes: string[];
  safetyPolicy: SourceCollectionSafetyPolicy;
  sideEffectSummary: SourceCollectionSideEffectSummary;
}

export interface ManualVisualInput {
  id?: string;
  title: string;
  description?: string;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface ManualVideoSourceInput {
  title: string;
  sourceText: string;
  notes?: string | null;
  referenceUrls?: string[];
  visuals?: ManualVisualInput[];
  language?: VideoLanguage;
  toneHint?: string | null;
  platformHint?: string | null;
}

export interface VideoSiteRecipe {
  id: string;
  name: string;
  allowedDomains: string[];
  sourceUrl: string;
  titleSelector: string;
  summarySelector?: string | null;
  evidenceSelectors: string[];
  visualSelectors?: string[];
  maxSnippetChars?: number;
  requireAttribution?: boolean;
}

export interface SiteRecipeVideoSourceInput {
  recipe: VideoSiteRecipe;
  html: string;
  collectedAt?: string;
}

export interface GenericUrlVideoSourceInput {
  url: string;
  title?: string | null;
  description?: string | null;
  excerpt?: string | null;
  htmlSnapshot?: string | null;
  language?: VideoLanguage;
  collectedAt?: string;
}

export interface VideoSourcePreviewResult {
  kind: "video_source_preview";
  version: "VIDEO-4";
  collection: {
    kind: VideoSourceCollectionKind;
    sourceType: VideoSourceType;
    sourceId: string;
    sourceUrl: string | null;
    collectedAt: string;
    evidenceCount: number;
    visualCandidateCount: number;
    safetyPolicy: SourceCollectionSafetyPolicy;
    sideEffectSummary: SourceCollectionSideEffectSummary;
  };
  sourceBundle: VideoSourceBundle;
  packageScaffold: GenericVideoPackageScaffold;
  scriptPlan: VideoScriptPlan;
  readiness: {
    ready: boolean;
    blockingReasons: string[];
    warnings: string[];
  };
}
