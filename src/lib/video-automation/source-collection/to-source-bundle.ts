import type { VideoInsight, VideoSourceBundle, VideoSourceProvenance } from "../core/types";
import { buildVideoSourceSideEffects, buildVideoSourceSnapshot, compactParts } from "../core/source-bundle";
import { buildSafeVisualMaterial, buildTextCardMaterial } from "../core/visual-materials";
import type { CollectedEvidence, CollectedVideoSource } from "./types";

export function buildVideoSourceBundleFromCollectedSource(source: CollectedVideoSource): VideoSourceBundle {
  const insights = source.evidence.map((item, index) => buildInsightFromEvidence(item, index));
  const visualMaterials = [
    ...source.visualCandidates.map((candidate) =>
      buildSafeVisualMaterial({
        id: candidate.id,
        kind: candidate.kind,
        title: candidate.title,
        description: candidate.description,
        sourceRef: candidate.sourceRef,
        fileName: candidate.fileName,
        mimeType: candidate.mimeType,
        width: candidate.width,
        height: candidate.height,
        safeForPublicUse: candidate.safeForPublicUse
      })
    ),
    ...insights.slice(0, 8).map((insight) =>
      buildTextCardMaterial({
        id: `text-card-${insight.id}`,
        title: insight.title,
        description: insight.summary,
        sourceRef: insight.id
      })
    )
  ];
  const provenance = buildProvenance(source);
  const sourceInput = {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: source.title,
    summary: source.summary,
    sourceUrl: source.sourceUrl,
    collectedAt: source.collectedAt,
    collectionKind: source.collectionKind,
    evidence: source.evidence.map((item) => ({
      id: item.id,
      title: item.title,
      textSnippet: item.textSnippet,
      originalTextLength: item.originalTextLength,
      snippetLength: item.snippetLength,
      sourceUrl: item.sourceUrl,
      selector: item.selector,
      attribution: item.attribution,
      tags: item.tags
    })),
    visualCandidates: source.visualCandidates,
    riskNotes: source.riskNotes,
    safetyPolicy: source.safetyPolicy,
    sideEffectSummary: source.sideEffectSummary
  };
  const sourceSnapshot = buildVideoSourceSnapshot({
    sourceInput,
    includedFields: [
      "source collection kind/type/id/title/summary/url",
      "bounded evidence snippets and attribution",
      "safe visual candidate metadata",
      "risk notes and safety policy",
      "read-only side-effect summary"
    ],
    excludedFields: [
      "generatedAt",
      "full source body",
      "local outputDirectory",
      "asset storagePath and thumbnailPath",
      "cookies, headers, credentials, env, secret, or token material"
    ]
  });

  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    title: source.title,
    summary: source.summary,
    language: source.language,
    sourceSnapshot,
    provenance,
    insights,
    visualMaterials,
    riskNotes: source.riskNotes,
    sideEffectSummary: buildVideoSourceSideEffects()
  };
}

function buildInsightFromEvidence(evidence: CollectedEvidence, index: number): VideoInsight {
  return {
    id: evidence.id,
    priority: index + 1,
    title: evidence.title,
    summary: evidence.textSnippet,
    evidenceText: compactParts([evidence.attribution, evidence.selector, evidence.sourceUrl]),
    sourceRefs: [evidence.id],
    tags: evidence.tags
  };
}

function buildProvenance(source: CollectedVideoSource): VideoSourceProvenance[] {
  const root: VideoSourceProvenance = {
    id: source.sourceId,
    kind: source.collectionKind === "content_item" ? "content_item" : source.collectionKind === "daily_brief" ? "run" : "manual",
    title: source.title,
    sourceName: source.collectionKind,
    url: source.sourceUrl,
    publishedAt: source.collectedAt
  };
  const evidenceProvenance = source.evidence.slice(0, 12).map((item) => ({
    id: item.id,
    kind: "context" as const,
    title: item.title,
    sourceName: item.attribution,
    url: item.sourceUrl,
    publishedAt: item.collectedAt
  }));
  return [root, ...evidenceProvenance];
}
