import { buildVideoSourcePreviewResult } from "./preview";
import { buildSourceCollectionPolicy, buildSourceCollectionSideEffects, clampSnippet, normalizeHttpUrl } from "./safety";
import { buildVideoSourceBundleFromCollectedSource } from "./to-source-bundle";
import type { CollectedEvidence, CollectedVideoSource, GenericUrlVideoSourceInput, VideoSourcePreviewResult } from "./types";
import { compactParts, stripHtml } from "../core/source-bundle";

export function collectGenericUrlVideoSource(input: GenericUrlVideoSourceInput): CollectedVideoSource {
  const sourceUrl = normalizeHttpUrl(input.url);
  const collectedAt = input.collectedAt ?? new Date().toISOString();
  const policy = buildSourceCollectionPolicy();
  const htmlTitle = input.htmlSnapshot ? extractTagText(input.htmlSnapshot, "title") : "";
  const metaDescription = input.htmlSnapshot ? extractMetaDescription(input.htmlSnapshot) : "";
  const title = clampSnippet(input.title || htmlTitle || sourceUrl, 120);
  const excerpt = clampSnippet(input.excerpt || input.description || metaDescription || "URL preview only. Automatic network fetch is not implemented for generic URL sources.", policy.maxSnippetChars);
  const evidence: CollectedEvidence[] = [
    {
      id: "generic-url-summary",
      title,
      textSnippet: excerpt,
      originalTextLength: (input.excerpt || input.description || metaDescription || "").length,
      snippetLength: excerpt.length,
      sourceUrl,
      selector: input.htmlSnapshot ? "title/meta/excerpt" : null,
      attribution: sourceUrl,
      collectedAt,
      tags: ["generic_url", input.htmlSnapshot ? "provided_html_snapshot" : "url_only"]
    }
  ];
  const bodySnippet = input.htmlSnapshot ? clampSnippet(stripHtml(input.htmlSnapshot), policy.maxSnippetChars) : "";
  if (bodySnippet && bodySnippet !== excerpt) {
    evidence.push({
      id: "generic-url-html-snippet",
      title: `${title} 본문 스니펫`,
      textSnippet: bodySnippet,
      originalTextLength: stripHtml(input.htmlSnapshot ?? "").length,
      snippetLength: bodySnippet.length,
      sourceUrl,
      selector: "provided_html_snapshot",
      attribution: sourceUrl,
      collectedAt,
      tags: ["generic_url", "bounded_html_snippet"]
    });
  }

  return {
    collectionKind: "generic_url",
    sourceType: "generic_url",
    sourceId: `generic-url-${new URL(sourceUrl).hostname.replace(/[^a-zA-Z0-9.-]/g, "-")}`,
    title,
    summary: compactParts(["generic URL preview", input.htmlSnapshot ? "provided HTML snapshot" : "no network fetch", `${evidence.length} evidence snippets`]),
    language: input.language ?? "ko",
    sourceUrl,
    collectedAt,
    evidence: evidence.slice(0, policy.maxEvidenceItems),
    visualCandidates: [],
    riskNotes: ["일반 URL 자료는 출처, 저작권, 인용 범위, 사실관계를 사람이 검토해야 합니다. 현재 generic URL collector는 외부 fetch 없이 preview만 생성합니다."],
    safetyPolicy: policy,
    sideEffectSummary: buildSourceCollectionSideEffects()
  };
}

export function buildGenericUrlVideoSourcePreview(input: GenericUrlVideoSourceInput): VideoSourcePreviewResult {
  const collection = collectGenericUrlVideoSource(input);
  return buildVideoSourcePreviewResult(collection, buildVideoSourceBundleFromCollectedSource(collection));
}

function extractTagText(html: string, tagName: string) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

function extractMetaDescription(html: string) {
  const match = html.match(/<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  return match ? stripHtml(match[1]) : "";
}
