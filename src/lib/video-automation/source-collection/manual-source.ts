import { buildVideoSourceBundleFromCollectedSource } from "./to-source-bundle";
import type { CollectedEvidence, CollectedVideoSource, CollectedVisualCandidate, ManualVideoSourceInput, VideoSourcePreviewResult } from "./types";
import {
  buildSourceCollectionPolicy,
  buildSourceCollectionSideEffects,
  clampSnippet,
  normalizeHttpUrl,
  splitEvidenceSnippets
} from "./safety";
import { buildVideoSourcePreviewResult } from "./preview";
import { compactParts, truncateText } from "../core/source-bundle";

export function collectManualVideoSource(input: ManualVideoSourceInput, collectedAt = new Date().toISOString()): CollectedVideoSource {
  const policy = buildSourceCollectionPolicy();
  const title = clampSnippet(input.title, 120) || "Manual video source";
  const referenceUrls = (input.referenceUrls ?? []).map((url) => normalizeHttpUrl(url));
  const textParts = [input.notes ?? "", input.sourceText].filter((item) => item.trim());
  const snippets = splitEvidenceSnippets(textParts.join("\n"), {
    maxSnippetChars: policy.maxSnippetChars,
    maxItems: policy.maxEvidenceItems
  });
  const evidence: CollectedEvidence[] = snippets.map((snippet, index) => ({
    id: `manual-evidence-${index + 1}`,
    title: index === 0 ? title : `자료 포인트 ${index + 1}`,
    textSnippet: snippet,
    originalTextLength: textParts.join("\n").length,
    snippetLength: snippet.length,
    sourceUrl: referenceUrls[index] ?? referenceUrls[0] ?? null,
    selector: null,
    attribution: referenceUrls[index] ?? referenceUrls[0] ?? "manual_user_input",
    collectedAt,
    tags: ["manual", input.platformHint ?? "platform_unspecified"].filter(Boolean)
  }));
  const visualCandidates: CollectedVisualCandidate[] = (input.visuals ?? []).slice(0, policy.maxVisualCandidates).map((visual, index) => ({
    id: visual.id ?? `manual-visual-${index + 1}`,
    kind: "image",
    title: clampSnippet(visual.title, 120) || `Manual visual ${index + 1}`,
    description: compactParts([visual.description, visual.fileName, visual.mimeType]),
    sourceRef: evidence[index]?.id ?? evidence[0]?.id ?? `manual-visual-${index + 1}`,
    sourceUrl: null,
    selector: null,
    fileName: visual.fileName ?? null,
    mimeType: visual.mimeType ?? null,
    width: visual.width ?? null,
    height: visual.height ?? null,
    safeForPublicUse: true
  }));

  return {
    collectionKind: "manual",
    sourceType: "manual_collection",
    sourceId: buildManualSourceId(title, input.sourceText),
    title,
    summary: compactParts([
      `${snippets.length} evidence snippets`,
      `${visualCandidates.length} visual candidates`,
      input.toneHint ? `tone ${input.toneHint}` : null,
      input.platformHint ? `platform ${input.platformHint}` : null
    ]),
    language: input.language ?? "ko",
    sourceUrl: referenceUrls[0] ?? null,
    collectedAt,
    evidence,
    visualCandidates,
    riskNotes: ["사용자가 제공한 자료를 바탕으로 만든 정보성 영상 소스입니다. 업로드 전 사실관계, 저작권, 출처 표기를 사람이 검토해야 합니다."],
    safetyPolicy: policy,
    sideEffectSummary: buildSourceCollectionSideEffects()
  };
}

export function buildManualVideoSourceBundle(input: ManualVideoSourceInput, collectedAt?: string) {
  return buildVideoSourceBundleFromCollectedSource(collectManualVideoSource(input, collectedAt));
}

export function buildManualVideoSourcePreview(input: ManualVideoSourceInput, collectedAt?: string): VideoSourcePreviewResult {
  const collection = collectManualVideoSource(input, collectedAt);
  return buildVideoSourcePreviewResult(collection, buildVideoSourceBundleFromCollectedSource(collection));
}

function buildManualSourceId(title: string, sourceText: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_.-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `manual-${slug || "source"}-${truncateText(String(sourceText.length), 12)}`;
}
