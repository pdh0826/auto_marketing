import type { VideoSourceBundle } from "../core/types";
import type { CollectedVideoSource, VideoSourceCollectionKind, VideoSourcePreviewResult } from "./types";
import { buildSourceCollectionPolicy, buildSourceCollectionSideEffects, clampSnippet } from "./safety";
import { buildVideoSourcePreviewResult } from "./preview";

export function collectFromVideoSourceBundle(
  bundle: VideoSourceBundle,
  input: {
    collectionKind: VideoSourceCollectionKind;
    sourceUrl?: string | null;
    collectedAt?: string;
    dbRead?: boolean;
    networkRead?: boolean;
  }
): CollectedVideoSource {
  const policy = buildSourceCollectionPolicy({
    allowNetworkRead: input.networkRead ?? false
  });
  const collectedAt = input.collectedAt ?? new Date().toISOString();
  return {
    collectionKind: input.collectionKind,
    sourceType: bundle.sourceType,
    sourceId: bundle.sourceId,
    title: bundle.title,
    summary: bundle.summary,
    language: bundle.language,
    sourceUrl: input.sourceUrl ?? bundle.provenance.find((item) => item.url)?.url ?? null,
    collectedAt,
    evidence: bundle.insights.slice(0, policy.maxEvidenceItems).map((insight, index) => ({
      id: insight.id,
      title: insight.title,
      textSnippet: clampSnippet(insight.summary, policy.maxSnippetChars),
      originalTextLength: insight.summary.length,
      snippetLength: clampSnippet(insight.summary, policy.maxSnippetChars).length,
      sourceUrl: bundle.provenance.find((item) => insight.sourceRefs.includes(item.id))?.url ?? null,
      selector: null,
      attribution: insight.evidenceText || input.collectionKind,
      collectedAt,
      tags: insight.tags
    })),
    visualCandidates: bundle.visualMaterials.slice(0, policy.maxVisualCandidates).map((material) => ({
      id: material.id,
      kind: material.kind,
      title: material.title,
      description: material.description,
      sourceRef: material.sourceRef,
      sourceUrl: null,
      selector: null,
      fileName: material.fileName,
      mimeType: material.mimeType,
      width: material.width,
      height: material.height,
      safeForPublicUse: material.safeForPublicUse
    })),
    riskNotes: bundle.riskNotes,
    safetyPolicy: policy,
    sideEffectSummary: buildSourceCollectionSideEffects({
      dbRead: input.dbRead ?? false,
      networkRead: input.networkRead ?? false
    })
  };
}

export function buildCollectedBundlePreview(
  bundle: VideoSourceBundle,
  input: {
    collectionKind: VideoSourceCollectionKind;
    sourceUrl?: string | null;
    collectedAt?: string;
    dbRead?: boolean;
    networkRead?: boolean;
  }
): VideoSourcePreviewResult {
  return buildVideoSourcePreviewResult(collectFromVideoSourceBundle(bundle, input), bundle);
}
