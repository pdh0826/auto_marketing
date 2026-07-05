import { NextResponse } from "next/server";
import { buildBloggerDraftApprovalSnapshotHashes, buildBloggerDraftApprovalSummary } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftPayloadPreview } from "@/lib/blogger/draft-payload-preview";
import type { PublishApprovalMode, PublishApprovalSaveResponse } from "@/lib/blogger/admin-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import { buildPublishApprovalPreview } from "@/lib/content/publish-approval-preview";
import { buildPublishPreflightDryRun } from "@/lib/content/publish-preflight";
import { getActiveBloggerDraftApproval, getLatestBloggerDraftApproval, toBloggerDraftApprovalAdmin } from "@/lib/db/blogger-draft-approvals";
import { getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getLatestSuccessfulBloggerDraftSave, toBloggerDraftSaveAdmin } from "@/lib/db/blogger-draft-saves";
import { createBloggerPublishApprovalFromSnapshot } from "@/lib/db/blogger-publish-approvals";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

interface PublishApprovalSaveRequest {
  mode?: PublishApprovalMode;
  scheduledAt?: string | null;
  timezone?: string | null;
  approvalSnapshotHashPreview?: string;
  tokenStateCheckedAt?: string | null;
  rollbackAcknowledged?: boolean;
  sideEffectSummaryAcknowledged?: boolean;
  approvalPersistenceAcknowledged?: boolean;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as PublishApprovalSaveRequest;
    const mode = parseMode(body.mode);
    const scheduledAt = normalizeNullableString(body.scheduledAt);
    const timezone = normalizeNullableString(body.timezone);
    const acknowledgementError = buildAcknowledgementError(body);

    if (acknowledgementError) {
      return NextResponse.json(acknowledgementError, { status: 400 });
    }
    if (!body.approvalSnapshotHashPreview?.trim()) {
      return NextResponse.json({ error: "approval_snapshot_hash_required", message: "approvalSnapshotHashPreview is required." }, { status: 400 });
    }

    const scheduleValidationError = validateSchedule(mode, scheduledAt, timezone);
    if (scheduleValidationError) {
      return NextResponse.json(scheduleValidationError, { status: 400 });
    }

    const checkedAt = parseCheckedAt(body.tokenStateCheckedAt) ?? new Date();

    const context = await loadPublishApprovalSaveContext(params.id, {
      mode,
      scheduledAt,
      timezone,
      checkedAt
    });

    if (!context) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const serverHash = context.preview.approvalSnapshotHashPreview;
    if (serverHash !== body.approvalSnapshotHashPreview.trim()) {
      return NextResponse.json(
        {
          error: "hash_mismatch",
          message: "Publish approval snapshot hash no longer matches the server-side regenerated snapshot."
        },
        { status: 400 }
      );
    }

    const readinessError = buildReadinessError(context.preview);
    if (readinessError) {
      return NextResponse.json(readinessError, { status: 400 });
    }

    const saved = await createBloggerPublishApprovalFromSnapshot({
      contentItemId: params.id,
      mode,
      snapshot: context.preview.approvalSnapshotPreview,
      snapshotHash: context.preview.approvalSnapshotHashPreview,
      hashAlgorithm: context.preview.hashAlgorithm,
      canonicalization: context.preview.canonicalization,
      bloggerDraftSaveId: context.latestSuccessfulDraftSave?.id ?? null,
      bloggerDraftApprovalId: context.latestApproval?.id ?? null,
      rollbackAcknowledged: true,
      sideEffectSummaryAcknowledged: true,
      approvalPersistenceAcknowledged: true,
      createdBy: null
    });

    const response: PublishApprovalSaveResponse = {
      contentItemId: params.id,
      approvalId: saved.approval.id,
      created: saved.created,
      existing: !saved.created,
      status: saved.approval.status,
      mode: saved.approval.mode,
      snapshotHash: saved.approval.snapshotHash,
      hashAlgorithm: "sha256",
      canonicalization: saved.approval.canonicalization,
      canPublish: false,
      canSchedulePublish: false,
      blockingReasons: context.preview.blockingReasons.filter((reason) => !PERSISTENCE_ACK_BLOCKING_REASONS.has(reason)),
      warnings: context.preview.warnings,
      savedApprovalSummary: {
        targetBloggerBlogId: saved.approval.targetBloggerBlogId,
        bloggerPostId: saved.approval.bloggerPostId,
        draftHtmlHash: saved.approval.draftHtmlHash,
        draftHtmlLength: saved.approval.draftHtmlLength,
        tokenState: context.preview.approvalSnapshotPreview.tokenState,
        rollbackAcknowledged: saved.approval.rollbackAcknowledged,
        sideEffectSummaryAcknowledged: saved.approval.sideEffectSummaryAcknowledged,
        approvalPersistenceAcknowledged: saved.approval.approvalPersistenceAcknowledged,
        createdAt: saved.approval.createdAt.toISOString()
      },
      sideEffectSummary: {
        dbWrite: saved.created,
        approvalPersistence: saved.created,
        contentItemMutation: false,
        bloggerApiWrite: false,
        bloggerPublish: false,
        bloggerScheduledPublish: false,
        bloggerPostsUpdate: false,
        bloggerDraftSave: false,
        tokenRefresh: false,
        llmCall: false
      }
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish approval save failed.", 500) }, { status: 400 });
  }
}

async function loadPublishApprovalSaveContext(
  contentItemId: string,
  input: {
    mode: PublishApprovalMode;
    scheduledAt: string | null;
    timezone: string | null;
    checkedAt: Date;
  }
) {
  const contentItem = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      blog: true,
      brandProfile: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!contentItem) {
    return null;
  }

  const safeContentItem = contentItem as unknown as ContentItemAdmin;
  const assets = contentItem.assets as unknown as ContentAssetAdmin[];
  const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
  const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
  const secretStatus = bloggerConnection ? await getBloggerConnectionSecretStatus(bloggerConnection.id) : null;
  const draftPayloadPreview = buildBloggerDraftPayloadPreview(safeContentItem, assets, bloggerConnections);
  const currentHashes = buildBloggerDraftApprovalSnapshotHashes(draftPayloadPreview, safeContentItem.draftHtml);
  const activeApproval = await getActiveBloggerDraftApproval(safeContentItem.id);
  const latestApproval = activeApproval ?? (await getLatestBloggerDraftApproval(safeContentItem.id));
  const approvalSummary = buildBloggerDraftApprovalSummary({
    approval: latestApproval ? toBloggerDraftApprovalAdmin(latestApproval) : null,
    approvalSnapshotHash: latestApproval?.snapshotHash ?? null,
    currentSnapshotHash: currentHashes?.snapshotHash ?? null,
    currentDraftHtmlHash: currentHashes?.draftHtmlHash ?? null,
    currentPreviewReady: draftPayloadPreview.draftPayloadReady
  });
  const latestSuccessfulDraftSave = await getLatestSuccessfulBloggerDraftSave(safeContentItem.id);
  const publishPreflight = buildPublishPreflightDryRun({
    contentItem: safeContentItem,
    draftPayloadPreview,
    approvalSummary,
    latestSuccessfulDraftSave: latestSuccessfulDraftSave ? toBloggerDraftSaveAdmin(latestSuccessfulDraftSave) : null,
    accessTokenExpired: isExpired(secretStatus?.accessTokenExpiresAt ?? null),
    checkedAt: input.checkedAt
  });
  const preview = buildPublishApprovalPreview({
    contentItem: safeContentItem,
    publishPreflight,
    publishMode: input.mode,
    scheduledAt: input.scheduledAt,
    timezone: input.timezone,
    checkedAt: input.checkedAt
  });

  return {
    latestApproval,
    latestSuccessfulDraftSave,
    preview
  };
}

function parseMode(value: unknown): PublishApprovalMode {
  return value === "scheduled_publish" ? "scheduled_publish" : "publish";
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildAcknowledgementError(body: PublishApprovalSaveRequest) {
  const missing = [
    body.rollbackAcknowledged === true ? null : "rollback_acknowledgement_required",
    body.sideEffectSummaryAcknowledged === true ? null : "side_effect_summary_acknowledgement_required",
    body.approvalPersistenceAcknowledged === true ? null : "approval_persistence_acknowledgement_required"
  ].filter(Boolean);

  if (missing.length === 0) {
    return null;
  }

  return {
    error: "acknowledgement_required",
    message: "All publish approval acknowledgements are required before saving the approval snapshot.",
    blockingReasons: missing
  };
}

const PERSISTENCE_ACK_BLOCKING_REASONS = new Set([
  "explicit_publish_approval_save_required",
  "rollback_acknowledgement_required",
  "side_effect_summary_acknowledgement_required",
  "approval_persistence_acknowledgement_required"
]);

function validateSchedule(mode: PublishApprovalMode, scheduledAt: string | null, timezone: string | null) {
  if (mode !== "scheduled_publish") {
    return null;
  }
  if (!scheduledAt) {
    return { error: "scheduled_at_required", message: "scheduledAt is required for scheduled publish approval." };
  }
  if (!timezone) {
    return { error: "timezone_required", message: "timezone is required for scheduled publish approval." };
  }
  const time = new Date(scheduledAt).getTime();
  if (!Number.isFinite(time)) {
    return { error: "scheduled_at_invalid", message: "scheduledAt must be a valid date-time." };
  }
  if (time <= Date.now()) {
    return { error: "scheduled_at_must_be_future", message: "scheduledAt must be in the future." };
  }
  return null;
}

function parseCheckedAt(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return date;
}

function buildReadinessError(preview: ReturnType<typeof buildPublishApprovalPreview>) {
  if (preview.blockingReasons.includes("content_status_not_planned")) {
    return { error: "content_status_not_planned", message: "Publish approval cannot be saved unless the content item is planned." };
  }
  if (preview.blockingReasons.includes("content_already_published")) {
    return { error: "content_already_published", message: "Publish approval cannot be saved for an already published content item." };
  }
  if (preview.blockingReasons.includes("content_already_scheduled")) {
    return { error: "content_already_scheduled", message: "Publish approval cannot be saved for an already scheduled content item." };
  }
  if (!preview.approvalSnapshotPreview.bloggerPostId) {
    return { error: "blogger_draft_post_id_missing", message: "Blogger draft post id is required before saving publish approval." };
  }
  if (!preview.approvalSnapshotPreview.targetBloggerBlogId) {
    return { error: "target_blogger_blog_missing", message: "Target Blogger blog is required before saving publish approval." };
  }
  if (!preview.approvalSnapshotPreview.approvalMatchesCurrentPreview) {
    return { error: "approval_snapshot_mismatch", message: "Current draft approval snapshot does not match the latest preview." };
  }
  if (preview.blockingReasons.includes("blogger_draft_not_saved")) {
    return { error: "blogger_draft_not_saved", message: "A successful Blogger draft save is required before publish approval." };
  }
  if (preview.blockingReasons.includes("manual_approval_missing")) {
    return { error: "manual_approval_missing", message: "Manual draft approval is required before publish approval." };
  }
  return null;
}

function isExpired(value: string | null) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}
