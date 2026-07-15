import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import {
  buildVideoSourceSideEffects,
  buildVideoSourceSnapshot,
  compactParts,
  redactUnsafeSourceValue,
  stripHtml,
  truncateText
} from "../core/source-bundle";
import { buildSafeVisualMaterial, buildTextCardMaterial } from "../core/visual-materials";
import type { VideoInsight, VideoSourceBundle, VideoSourceProvenance } from "../core/types";

export function buildContentItemVideoSourceBundle(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[] = []): VideoSourceBundle {
  const title = contentItem.title?.trim() || contentItem.targetKeyword?.trim() || `Content item ${contentItem.id}`;
  const visibleText = buildVisibleContentText(contentItem);
  const insights = buildContentItemInsights(contentItem, visibleText);
  const imageAssets = assets
    .filter((asset) => asset.assetType === "image")
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  const visualMaterials = [
    ...imageAssets.slice(0, 12).map((asset) =>
      buildSafeVisualMaterial({
        id: `asset-${asset.id}`,
        kind: asset.isPrimary ? "thumbnail" : "image",
        title: asset.caption || asset.altText || asset.originalName || asset.fileName,
        description: compactParts([asset.placementHint, asset.caption, asset.altText, asset.userNote, `${asset.fileSize} bytes`]),
        sourceRef: `asset-${asset.id}`,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        safeForPublicUse: true
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
  const provenance = buildContentItemProvenance(contentItem, imageAssets);
  const sourceInput = buildContentItemSourceInput(contentItem, imageAssets, visibleText, insights, visualMaterials, provenance);
  const sourceSnapshot = buildVideoSourceSnapshot({
    sourceInput,
    includedFields: [
      "content item identity/status/mode/title/keyword",
      "content item source memo and sanitized plan summary",
      "draft markdown/html visible text snippets",
      "safe image asset metadata without storage paths",
      "safe side-effect summary"
    ],
    excludedFields: [
      "generatedAt",
      "local output file bytes",
      "local outputDirectory",
      "asset storagePath and thumbnailPath",
      "any env/secret/token material"
    ]
  });

  return {
    sourceType: "content_item",
    sourceId: contentItem.id,
    title,
    summary: buildContentItemSummary(contentItem, imageAssets, visibleText),
    language: "ko",
    sourceSnapshot,
    provenance,
    insights,
    visualMaterials,
    riskNotes: ["원문 콘텐츠를 기반으로 재구성한 정보성 영상입니다. 업로드 전 사실관계, 출처, 이미지 사용 권리를 사람이 검토해야 합니다."],
    sideEffectSummary: buildVideoSourceSideEffects()
  };
}

function buildContentItemInsights(contentItem: ContentItemAdmin, visibleText: string): VideoInsight[] {
  const insights: VideoInsight[] = [];
  const title = contentItem.title?.trim() || contentItem.targetKeyword?.trim();
  if (title) {
    insights.push({
      id: "content-title",
      priority: 1,
      title,
      summary: compactParts([contentItem.mode, contentItem.status, contentItem.targetKeyword ? `키워드 ${contentItem.targetKeyword}` : null]),
      evidenceText: compactParts([contentItem.sourceMemo, contentItem.targetKeyword]),
      sourceRefs: ["content-item"],
      tags: ["content_item", contentItem.mode, contentItem.status]
    });
  }

  if (contentItem.sourceMemo?.trim()) {
    insights.push({
      id: "source-memo",
      priority: 10,
      title: "소재 메모",
      summary: truncateText(contentItem.sourceMemo, 220),
      evidenceText: truncateText(contentItem.sourceMemo, 220),
      sourceRefs: ["content-item"],
      tags: ["source_memo"]
    });
  }

  extractHeadings(contentItem.draftMarkdown, contentItem.draftHtml).slice(0, 5).forEach((heading, index) => {
    insights.push({
      id: `heading-${index + 1}`,
      priority: 20 + index,
      title: heading,
      summary: findSentenceNearHeading(visibleText, heading) ?? heading,
      evidenceText: heading,
      sourceRefs: ["content-item"],
      tags: ["heading"]
    });
  });

  const planSummary = summarizePlanJson(contentItem.planJson);
  if (planSummary) {
    insights.push({
      id: "plan-summary",
      priority: 40,
      title: "구성 계획",
      summary: planSummary,
      evidenceText: planSummary,
      sourceRefs: ["content-item"],
      tags: ["plan"]
    });
  }

  if (visibleText) {
    insights.push({
      id: "draft-summary",
      priority: 50,
      title: "본문 핵심 문맥",
      summary: truncateText(visibleText, 260),
      evidenceText: truncateText(visibleText, 260),
      sourceRefs: ["content-item"],
      tags: ["draft"]
    });
  }

  return insights;
}

function buildContentItemProvenance(contentItem: ContentItemAdmin, imageAssets: ContentAssetAdmin[]): VideoSourceProvenance[] {
  return [
    {
      id: contentItem.id,
      kind: "content_item",
      title: contentItem.title ?? contentItem.targetKeyword ?? contentItem.id,
      sourceName: "Blog Growth Agent content item",
      url: null,
      publishedAt: contentItem.updatedAt
    },
    ...imageAssets.slice(0, 12).map((asset) => ({
      id: `asset-${asset.id}`,
      kind: "asset" as const,
      title: asset.caption || asset.altText || asset.originalName || asset.fileName,
      sourceName: "Blog Growth Agent content asset",
      url: null,
      publishedAt: asset.createdAt
    }))
  ];
}

function buildContentItemSourceInput(
  contentItem: ContentItemAdmin,
  imageAssets: ContentAssetAdmin[],
  visibleText: string,
  insights: VideoInsight[],
  visualMaterials: VideoSourceBundle["visualMaterials"],
  provenance: VideoSourceProvenance[]
) {
  return {
    sourceType: "content_item",
    sourceId: contentItem.id,
    blogId: contentItem.blogId,
    brandProfileId: contentItem.brandProfileId,
    mode: contentItem.mode,
    status: contentItem.status,
    title: contentItem.title,
    targetKeyword: contentItem.targetKeyword,
    sourceMemo: truncateText(contentItem.sourceMemo ?? "", 400),
    planJson: redactUnsafeSourceValue(contentItem.planJson),
    draftMarkdownLength: contentItem.draftMarkdown?.length ?? 0,
    draftHtmlLength: contentItem.draftHtml?.length ?? 0,
    visibleTextSnippet: truncateText(visibleText, 1000),
    qualityScore: contentItem.qualityScore,
    scheduledAt: contentItem.scheduledAt,
    publishedAt: contentItem.publishedAt,
    createdAt: contentItem.createdAt,
    updatedAt: contentItem.updatedAt,
    imageAssets: imageAssets.map((asset) => ({
      id: asset.id,
      fileName: asset.fileName,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      caption: asset.caption,
      altText: asset.altText,
      userNote: asset.userNote,
      placementHint: asset.placementHint,
      sortOrder: asset.sortOrder,
      isPrimary: asset.isPrimary,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt
    })),
    insights,
    visualMaterials,
    provenance,
    sideEffectSummary: buildVideoSourceSideEffects()
  };
}

function buildVisibleContentText(contentItem: ContentItemAdmin) {
  const htmlText = contentItem.draftHtml ? stripHtml(contentItem.draftHtml) : "";
  const markdownText = contentItem.draftMarkdown ? stripMarkdown(contentItem.draftMarkdown) : "";
  return (htmlText || markdownText).replace(/\s+/g, " ").trim();
}

function buildContentItemSummary(contentItem: ContentItemAdmin, imageAssets: ContentAssetAdmin[], visibleText: string) {
  return compactParts([
    contentItem.status,
    contentItem.mode,
    contentItem.targetKeyword ? `keyword ${contentItem.targetKeyword}` : null,
    `${visibleText.length} visible chars`,
    `${imageAssets.length} image assets`
  ]);
}

function extractHeadings(markdown: string | null, html: string | null) {
  const headings = new Set<string>();
  if (markdown) {
    const markdownHeadingPattern = /^#{1,3}\s+(.+)$/gm;
    let match = markdownHeadingPattern.exec(markdown);
    while (match) {
      headings.add(truncateText(match[1], 100));
      match = markdownHeadingPattern.exec(markdown);
    }
  }
  if (html) {
    const htmlHeadingPattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let match = htmlHeadingPattern.exec(html);
    while (match) {
      headings.add(truncateText(stripHtml(match[1]), 100));
      match = htmlHeadingPattern.exec(html);
    }
  }
  return Array.from(headings).filter(Boolean);
}

function findSentenceNearHeading(visibleText: string, heading: string) {
  const index = visibleText.indexOf(heading);
  if (index < 0) {
    return null;
  }
  return truncateText(visibleText.slice(index, index + 260), 220);
}

function summarizePlanJson(planJson: Record<string, unknown> | null) {
  if (!planJson) {
    return null;
  }
  const safePlan = redactUnsafeSourceValue(planJson);
  return truncateText(JSON.stringify(safePlan), 260);
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
