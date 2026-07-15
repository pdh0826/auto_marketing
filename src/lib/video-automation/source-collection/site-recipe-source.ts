import { compactParts } from "../core/source-bundle";
import { buildVideoSourcePreviewResult } from "./preview";
import {
  assertAllowedDomain,
  buildSourceCollectionPolicy,
  buildSourceCollectionSideEffects,
  clampSnippet,
  normalizeHttpUrl
} from "./safety";
import { buildVideoSourceBundleFromCollectedSource } from "./to-source-bundle";
import type { CollectedEvidence, CollectedVideoSource, CollectedVisualCandidate, SiteRecipeVideoSourceInput, VideoSourcePreviewResult } from "./types";

export function collectSiteRecipeVideoSource(input: SiteRecipeVideoSourceInput): CollectedVideoSource {
  const sourceUrl = normalizeHttpUrl(input.recipe.sourceUrl);
  assertAllowedDomain(sourceUrl, input.recipe.allowedDomains);
  const policy = buildSourceCollectionPolicy({
    allowedDomains: input.recipe.allowedDomains,
    maxSnippetChars: input.recipe.maxSnippetChars ?? 500,
    requireAttribution: input.recipe.requireAttribution ?? true
  });
  const collectedAt = input.collectedAt ?? new Date().toISOString();
  const title = clampSnippet(extractFirstText(input.html, input.recipe.titleSelector) || input.recipe.name, 120);
  const summary = clampSnippet(extractFirstText(input.html, input.recipe.summarySelector ?? input.recipe.titleSelector) || title, policy.maxSnippetChars);
  const evidenceSelectors = input.recipe.evidenceSelectors.length ? input.recipe.evidenceSelectors : [input.recipe.summarySelector ?? input.recipe.titleSelector];
  const evidence: CollectedEvidence[] = evidenceSelectors
    .flatMap((selector, selectorIndex) =>
      extractTexts(input.html, selector).map((text, index) => ({
        id: `site-${selectorIndex + 1}-${index + 1}`,
        title: index === 0 ? title : `${input.recipe.name} 포인트 ${selectorIndex + 1}-${index + 1}`,
        textSnippet: clampSnippet(text, policy.maxSnippetChars),
        originalTextLength: text.length,
        snippetLength: clampSnippet(text, policy.maxSnippetChars).length,
        sourceUrl,
        selector,
        attribution: input.recipe.name,
        collectedAt,
        tags: ["site_recipe", input.recipe.id]
      }))
    )
    .filter((item) => item.textSnippet)
    .slice(0, policy.maxEvidenceItems);
  const normalizedEvidence = evidence.length
    ? evidence
    : [
        {
          id: "site-summary-1",
          title,
          textSnippet: summary,
          originalTextLength: summary.length,
          snippetLength: summary.length,
          sourceUrl,
          selector: input.recipe.summarySelector ?? input.recipe.titleSelector,
          attribution: input.recipe.name,
          collectedAt,
          tags: ["site_recipe", input.recipe.id, "fallback_summary"]
        }
      ];
  const visualCandidates = (input.recipe.visualSelectors ?? []).flatMap((selector, selectorIndex) =>
    extractVisuals(input.html, selector, sourceUrl).map((visual, index) => ({
      id: `site-visual-${selectorIndex + 1}-${index + 1}`,
      kind: "capture" as const,
      title: visual.title || `${input.recipe.name} visual ${selectorIndex + 1}-${index + 1}`,
      description: compactParts([visual.description, selector]),
      sourceRef: normalizedEvidence[index]?.id ?? normalizedEvidence[0]?.id ?? "site-summary-1",
      sourceUrl,
      selector,
      fileName: visual.fileName,
      mimeType: visual.mimeType,
      width: visual.width,
      height: visual.height,
      safeForPublicUse: true
    }))
  );

  return {
    collectionKind: "site_recipe",
    sourceType: "site_recipe",
    sourceId: `site-recipe-${input.recipe.id}`,
    title,
    summary: compactParts([summary, `${normalizedEvidence.length} evidence snippets`, `${visualCandidates.length} visual candidates`]),
    language: "ko",
    sourceUrl,
    collectedAt,
    evidence: normalizedEvidence,
    visualCandidates: visualCandidates.slice(0, policy.maxVisualCandidates),
    riskNotes: ["외부 사이트에서 추출한 자료는 출처와 저작권을 확인한 뒤 정보성 영상으로만 사용해야 합니다. 원문 전체 복제나 무단 전재는 금지됩니다."],
    safetyPolicy: policy,
    sideEffectSummary: buildSourceCollectionSideEffects()
  };
}

export function buildSiteRecipeVideoSourcePreview(input: SiteRecipeVideoSourceInput): VideoSourcePreviewResult {
  const collection = collectSiteRecipeVideoSource(input);
  return buildVideoSourcePreviewResult(collection, buildVideoSourceBundleFromCollectedSource(collection));
}

function extractFirstText(html: string, selector: string) {
  return extractTexts(html, selector)[0] ?? "";
}

function extractTexts(html: string, selector: string) {
  return extractElements(html, selector)
    .map((element) => clampSnippet(element.inner, 2000))
    .filter(Boolean);
}

function extractVisuals(html: string, selector: string, sourceUrl: string): Array<{
  title: string;
  description: string;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
}> {
  return extractElements(html, selector).map((element) => {
    const src = getAttribute(element.openingTag, "src");
    const alt = getAttribute(element.openingTag, "alt");
    const width = Number(getAttribute(element.openingTag, "width"));
    const height = Number(getAttribute(element.openingTag, "height"));
    return {
      title: clampSnippet(alt || element.inner || selector, 120),
      description: src ? new URL(src, sourceUrl).toString() : clampSnippet(element.inner, 180),
      fileName: src ? safeFileNameFromUrl(new URL(src, sourceUrl).toString()) : null,
      mimeType: mimeTypeFromFileName(src),
      width: Number.isFinite(width) ? width : null,
      height: Number.isFinite(height) ? height : null
    };
  });
}

function extractElements(html: string, selector: string): Array<{ openingTag: string; inner: string }> {
  const normalized = selector.trim();
  if (!normalized) {
    return [];
  }
  if (normalized.startsWith("#")) {
    return extractByAttribute(html, "id", normalized.slice(1));
  }
  if (normalized.startsWith(".")) {
    return extractByClass(html, normalized.slice(1));
  }
  const attributeMatch = normalized.match(/^\[([^=\]]+)=["']?([^"'\]]+)["']?\]$/);
  if (attributeMatch) {
    return extractByAttribute(html, attributeMatch[1], attributeMatch[2]);
  }
  if (/^[a-z][a-z0-9-]*$/i.test(normalized)) {
    return extractByTag(html, normalized);
  }
  return [];
}

function extractByAttribute(html: string, attributeName: string, attributeValue: string) {
  const pattern = new RegExp(`<([a-z][a-z0-9-]*)\\b([^>]*\\b${escapeRegExp(attributeName)}=["'][^"']*${escapeRegExp(attributeValue)}[^"']*["'][^>]*)>([\\s\\S]*?)<\\/\\1>|<([a-z][a-z0-9-]*)\\b([^>]*\\b${escapeRegExp(attributeName)}=["'][^"']*${escapeRegExp(attributeValue)}[^"']*["'][^>]*)\\s*\\/?>`, "gi");
  return collectMatches(html, pattern);
}

function extractByClass(html: string, className: string) {
  const pattern = new RegExp(`<([a-z][a-z0-9-]*)\\b([^>]*\\bclass=["'][^"']*${escapeRegExp(className)}[^"']*["'][^>]*)>([\\s\\S]*?)<\\/\\1>|<([a-z][a-z0-9-]*)\\b([^>]*\\bclass=["'][^"']*${escapeRegExp(className)}[^"']*["'][^>]*)\\s*\\/?>`, "gi");
  return collectMatches(html, pattern);
}

function extractByTag(html: string, tagName: string) {
  const pattern = new RegExp(`<(${escapeRegExp(tagName)})\\b([^>]*)>([\\s\\S]*?)<\\/\\1>|<(${escapeRegExp(tagName)})\\b([^>]*)\\s*\\/?>`, "gi");
  return collectMatches(html, pattern);
}

function collectMatches(html: string, pattern: RegExp) {
  const result: Array<{ openingTag: string; inner: string }> = [];
  let match = pattern.exec(html);
  while (match) {
    const tag = match[1] ?? match[4] ?? "div";
    const attributes = match[2] ?? match[5] ?? "";
    result.push({
      openingTag: `<${tag}${attributes}>`,
      inner: match[3] ?? ""
    });
    match = pattern.exec(html);
  }
  return result;
}

function getAttribute(openingTag: string, name: string) {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}=["']([^"']+)["']`, "i");
  return openingTag.match(pattern)?.[1] ?? null;
}

function mimeTypeFromFileName(value: string | null) {
  if (!value) {
    return null;
  }
  const pathname = value.toLowerCase();
  if (pathname.endsWith(".png")) {
    return "image/png";
  }
  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }
  if (pathname.endsWith(".gif")) {
    return "image/gif";
  }
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return null;
}

function safeFileNameFromUrl(value: string) {
  const pathname = new URL(value).pathname.split("/").pop();
  return pathname ? pathname.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 120) : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
