import { createHash } from "crypto";
import type { BlogPostTemplatePreviewResult } from "@/lib/blog-renderer/blog-post-template-renderer";
import { buildBlogPostTemplatePreview } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-3P";
const PREVIEW_MODE = "read_only_draft_html_conversion_preview";

type PreviewMode = "preview" | "blocked_non_preview";

export interface DailyContentDraftHtmlConversionPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  includePreviewHtml?: unknown;
}

export interface DailyContentDraftHtmlConversionPreviewResponse extends DailyContentDraftHtmlConversionPreviewSummary {
  checkedAt: string;
  previewHtml: string | null;
  draftHtmlConversionPreviewSummary: DailyContentDraftHtmlConversionPreviewSummary;
}

export interface DailyContentDraftHtmlConversionPreviewSummary {
  patchVersion: "9F-3P";
  checked: true;
  mode: PreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  dryRunOnly: true;
  conversionPreviewImplemented: true;
  conversionPreviewReady: boolean;
  canProceedTo9F3Q: boolean;
  targetSummary: DraftHtmlConversionTargetSummary;
  conversionDetailSummary: DraftHtmlConversionDetailSummary;
  validationSummary: BlogPostTemplatePreviewResult["validationSummary"] | null;
  currentSideEffectSummary: DraftHtmlConversionSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DraftHtmlConversionTargetSummary {
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  planItemFound: boolean;
  planItemMatchesPlan: boolean | null;
  planItemMatchesContentItem: boolean | null;
  contentItemFound: boolean;
  contentStatus: string | null;
  draftMarkdownLength: number | null;
  draftMarkdownHash: string | null;
  draftHtmlLength: number | null;
  draftHtmlHash: string | null;
  publishedAtPresent: boolean | null;
  scheduledAtPresent: boolean | null;
}

export interface DraftHtmlConversionDetailSummary {
  source: "saved_draft_markdown";
  renderer: "blog_post_template_preview";
  theme: "clean_blog";
  titleCandidate: string | null;
  markdownHash: string | null;
  markdownLength: number | null;
  previewHtmlHash: string | null;
  previewHtmlLength: number | null;
  previewHtmlReturned: boolean;
  previewHtmlStored: false;
  draftHtmlApplied: false;
  fullDraftMarkdownReturned: false;
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
}

export interface DraftHtmlConversionSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  statusMutation: false;
  qualityScoreMutation: false;
  publishedAtMutation: false;
  scheduledAtMutation: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  llmCall: false;
  llmCallLogMutation: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentDraftHtmlConversionPreviewResponse(
  rawRequest: DailyContentDraftHtmlConversionPreviewRequest
): Promise<DailyContentDraftHtmlConversionPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [planItem, contentItem] = await Promise.all([
    request.planItemId
      ? prisma.blogDailyContentPlanItem.findUnique({
          where: { id: request.planItemId },
          select: {
            id: true,
            planId: true,
            contentItemId: true,
            status: true
          }
        })
      : null,
    request.contentItemId
      ? prisma.contentItem.findUnique({
          where: { id: request.contentItemId },
          include: {
            blog: true,
            brandProfile: true,
            assets: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            }
          }
        })
      : null
  ]);

  const draftMarkdown = contentItem?.draftMarkdown?.trim() ?? "";
  const draftHtml = contentItem?.draftHtml ?? "";
  const preview = draftMarkdown
    ? buildBlogPostTemplatePreview({
        contentItem: contentItem as unknown as ContentItemAdmin,
        assets: contentItem?.assets as unknown as ContentAssetAdmin[],
        markdown: draftMarkdown,
        source: "saved_draft_markdown",
        theme: "clean_blog"
      })
    : null;
  const previewHtml = preview?.html ?? "";
  const blockers = buildBlockers({
    mode: request.mode,
    planId: request.planId,
    planItem,
    contentItem,
    draftMarkdown,
    draftHtml,
    preview
  });
  const conversionPreviewReady = blockers.length === 0;
  const summary: DailyContentDraftHtmlConversionPreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    dryRunOnly: true,
    conversionPreviewImplemented: true,
    conversionPreviewReady,
    canProceedTo9F3Q: conversionPreviewReady,
    targetSummary: {
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId,
      planItemFound: Boolean(planItem),
      planItemMatchesPlan: planItem && request.planId ? planItem.planId === request.planId : null,
      planItemMatchesContentItem: planItem && request.contentItemId ? planItem.contentItemId === request.contentItemId : null,
      contentItemFound: Boolean(contentItem),
      contentStatus: contentItem?.status ?? null,
      draftMarkdownLength: contentItem ? contentItem.draftMarkdown?.length ?? 0 : null,
      draftMarkdownHash: contentItem ? sha256(contentItem.draftMarkdown ?? "") : null,
      draftHtmlLength: contentItem ? contentItem.draftHtml?.length ?? 0 : null,
      draftHtmlHash: contentItem ? sha256(contentItem.draftHtml ?? "") : null,
      publishedAtPresent: contentItem ? Boolean(contentItem.publishedAt) : null,
      scheduledAtPresent: contentItem ? Boolean(contentItem.scheduledAt) : null
    },
    conversionDetailSummary: {
      source: "saved_draft_markdown",
      renderer: "blog_post_template_preview",
      theme: "clean_blog",
      titleCandidate: preview?.sourceSummary.titleCandidate ?? null,
      markdownHash: draftMarkdown ? sha256(draftMarkdown) : null,
      markdownLength: draftMarkdown ? draftMarkdown.length : null,
      previewHtmlHash: previewHtml ? sha256(previewHtml) : null,
      previewHtmlLength: previewHtml ? previewHtml.length : null,
      previewHtmlReturned: Boolean(request.includePreviewHtml && previewHtml),
      previewHtmlStored: false,
      draftHtmlApplied: false,
      fullDraftMarkdownReturned: false,
      rawPromptStoredOrReturned: false,
      rawResponseStoredOrReturned: false
    },
    validationSummary: preview?.validationSummary ?? null,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: blockers,
    warnings: buildWarnings(request.includePreviewHtml)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    previewHtml: request.includePreviewHtml ? previewHtml || null : null,
    draftHtmlConversionPreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftHtmlConversionPreviewRequest): {
  mode: PreviewMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  includePreviewHtml: boolean;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" ? "preview" : "blocked_non_preview",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId),
    includePreviewHtml: rawRequest.includePreviewHtml === true
  };
}

function buildBlockers(input: {
  mode: PreviewMode;
  planId: string | null;
  planItem: { id: string; planId: string; contentItemId: string | null; status: string } | null;
  contentItem:
    | {
        id: string;
        status: string;
        draftMarkdown: string | null;
        draftHtml: string | null;
        publishedAt: Date | null;
        scheduledAt: Date | null;
      }
    | null;
  draftMarkdown: string;
  draftHtml: string;
  preview: BlogPostTemplatePreviewResult | null;
}) {
  const blockers: string[] = [];

  if (input.mode !== "preview") {
    blockers.push("draft_html_conversion_preview_is_read_only");
  }
  if (!input.contentItem) {
    blockers.push("content_item_not_found");
  }
  if (!input.planItem) {
    blockers.push("plan_item_not_found");
  }
  if (input.planId && input.planItem && input.planItem.planId !== input.planId) {
    blockers.push("plan_item_plan_mismatch");
  }
  if (input.contentItem && input.planItem && input.planItem.contentItemId !== input.contentItem.id) {
    blockers.push("plan_item_content_item_mismatch");
  }
  if (input.contentItem && input.contentItem.status !== "planned") {
    blockers.push("content_item_status_not_planned");
  }
  if (input.contentItem?.publishedAt) {
    blockers.push("content_item_already_published");
  }
  if (input.contentItem?.scheduledAt) {
    blockers.push("content_item_already_scheduled");
  }
  if (!input.draftMarkdown) {
    blockers.push("saved_draft_markdown_missing");
  }
  if (input.draftHtml.trim()) {
    blockers.push("draft_html_already_present");
  }
  if (!input.preview) {
    blockers.push("draft_html_preview_not_generated");
  }
  if (input.preview && !input.preview.validationSummary.ok) {
    blockers.push("draft_html_preview_validation_failed");
  }

  return blockers;
}

function buildWarnings(includePreviewHtml: boolean) {
  const warnings = [
    "draft_html_conversion_preview_only",
    "draft_html_not_persisted",
    "content_item_mutation_disabled",
    "blogger_write_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy"
  ];
  if (!includePreviewHtml) {
    warnings.push("preview_html_body_not_returned_by_default");
  }
  return warnings;
}

function buildSideEffectSummary(): DraftHtmlConversionSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    statusMutation: false,
    qualityScoreMutation: false,
    publishedAtMutation: false,
    scheduledAtMutation: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    llmCall: false,
    llmCallLogMutation: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: false
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
