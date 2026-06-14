import { NextResponse } from "next/server";
import { buildBloggerDraftApprovalSnapshotHashes, buildBloggerDraftApprovalSummary } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftPayloadPreview } from "@/lib/blogger/draft-payload-preview";
import { BloggerDraftSaveError, saveBloggerDraftPost } from "@/lib/blogger/draft-save";
import { safeBloggerSecretError } from "@/lib/blogger/secrets";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import {
  getActiveBloggerDraftApproval,
  getLatestBloggerDraftApproval,
  toBloggerDraftApprovalAdmin
} from "@/lib/db/blogger-draft-approvals";
import {
  createBloggerDraftSaveFailure,
  createBloggerDraftSaveSuccess,
  getSuccessfulBloggerDraftSaveByApproval,
  toBloggerDraftSaveAdmin
} from "@/lib/db/blogger-draft-saves";
import type { SafeBloggerConnection } from "@/lib/db/blogger-connections";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

interface DraftSaveGuardContext {
  contentItem: NonNullable<Awaited<ReturnType<typeof loadContentItem>>>;
  bloggerConnection: SafeBloggerConnection;
  preview: ReturnType<typeof buildBloggerDraftPayloadPreview>;
  currentHashes: NonNullable<ReturnType<typeof buildBloggerDraftApprovalSnapshotHashes>>;
  activeApproval: NonNullable<Awaited<ReturnType<typeof getActiveBloggerDraftApproval>>>;
}

class BloggerDraftSaveGuardError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "BloggerDraftSaveGuardError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const context = await buildDraftSaveGuardContext(params.id);
    const previousSuccess = await getSuccessfulBloggerDraftSaveByApproval(context.activeApproval.id);
    if (previousSuccess) {
      return NextResponse.json(
        {
          error: "blogger_draft_already_saved_for_approval",
          message: "This approval snapshot already has a successful Blogger draft save.",
          data: {
            draftSave: toBloggerDraftSaveAdmin(previousSuccess),
            approvalMatched: true,
            draftSaveImplemented: true,
            publishImplemented: false,
            scheduledPublishImplemented: false,
            tokenRefreshImplemented: false
          }
        },
        { status: 400 }
      );
    }

    const targetBlog = context.preview.targetBlog;
    const titleCandidate = context.preview.titleCandidate;
    if (!targetBlog?.id || !titleCandidate || !context.contentItem?.draftHtml?.trim()) {
      throw new BloggerDraftSaveGuardError("blogger_draft_payload_not_ready", "Blogger draft payload preview is not ready.");
    }

    try {
      const result = await saveBloggerDraftPost({
        connectionId: context.bloggerConnection.id,
        targetBloggerBlogId: targetBlog.id,
        title: titleCandidate,
        content: context.contentItem.draftHtml,
        labels: context.preview.labelsCandidate
      });

      const save = await createBloggerDraftSaveSuccess({
        contentItemId: context.contentItem.id,
        approvalId: context.activeApproval.id,
        bloggerConnectionId: context.bloggerConnection.id,
        snapshotHash: context.currentHashes.snapshotHash,
        draftHtmlHash: context.currentHashes.draftHtmlHash,
        targetBloggerBlogId: targetBlog.id,
        targetBloggerBlogName: targetBlog.name,
        targetBloggerBlogUrl: targetBlog.url,
        titleCandidate,
        bloggerPostId: result.bloggerPostId,
        bloggerPostUrl: result.bloggerPostUrl,
        bloggerPostPublishedAt: result.bloggerPostPublishedAt,
        bloggerPostUpdatedAt: result.bloggerPostUpdatedAt
      });

      return NextResponse.json({
        data: {
          draftSave: toBloggerDraftSaveAdmin(save),
          approvalMatched: true,
          draftSaveImplemented: true,
          publishImplemented: false,
          scheduledPublishImplemented: false,
          tokenRefreshImplemented: false
        }
      });
    } catch (error) {
      if (error instanceof BloggerDraftSaveError) {
        const failure = await createBloggerDraftSaveFailure({
          contentItemId: context.contentItem.id,
          approvalId: context.activeApproval.id,
          bloggerConnectionId: context.bloggerConnection.id,
          snapshotHash: context.currentHashes.snapshotHash,
          draftHtmlHash: context.currentHashes.draftHtmlHash,
          targetBloggerBlogId: targetBlog.id,
          targetBloggerBlogName: targetBlog.name,
          targetBloggerBlogUrl: targetBlog.url,
          titleCandidate,
          errorCode: error.code,
          errorMessage: safeBloggerSecretError(error.message),
          retryable: error.retryable
        });

        return NextResponse.json(
          {
            error: error.code,
            message: safeBloggerSecretError(error.message),
            data: {
              draftSave: toBloggerDraftSaveAdmin(failure),
              approvalMatched: true,
              draftSaveImplemented: true,
              publishImplemented: false,
              scheduledPublishImplemented: false,
              tokenRefreshImplemented: false
            }
          },
          { status: error.httpStatus }
        );
      }

      throw error;
    }
  } catch (error) {
    if (error instanceof BloggerDraftSaveGuardError) {
      return NextResponse.json(
        {
          error: error.code,
          message: safeErrorMessage(error.message, error.httpStatus),
          data: {
            draftSave: null,
            approvalMatched: false,
            draftSaveImplemented: true,
            publishImplemented: false,
            scheduledPublishImplemented: false,
            tokenRefreshImplemented: false
          }
        },
        { status: error.httpStatus }
      );
    }

    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger draft save failed.", 500) }, { status: 400 });
  }
}

async function buildDraftSaveGuardContext(contentItemId: string): Promise<DraftSaveGuardContext> {
  const contentItem = await loadContentItem(contentItemId);
  if (!contentItem) {
    throw new BloggerDraftSaveGuardError("content_item_not_found", "Content item not found.", 404);
  }

  const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
  const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
  const preview = buildBloggerDraftPayloadPreview(
    contentItem as unknown as ContentItemAdmin,
    contentItem.assets as unknown as ContentAssetAdmin[],
    bloggerConnections
  );
  const currentHashes = buildBloggerDraftApprovalSnapshotHashes(preview, contentItem.draftHtml);
  const activeApproval = await getActiveBloggerDraftApproval(contentItem.id);
  const latestApproval = activeApproval ?? (await getLatestBloggerDraftApproval(contentItem.id));
  const approvalSummary = buildBloggerDraftApprovalSummary({
    approval: latestApproval ? toBloggerDraftApprovalAdmin(latestApproval) : null,
    approvalSnapshotHash: latestApproval?.snapshotHash ?? null,
    currentSnapshotHash: currentHashes?.snapshotHash ?? null,
    currentDraftHtmlHash: currentHashes?.draftHtmlHash ?? null,
    currentPreviewReady: preview.draftPayloadReady
  });

  if (!bloggerConnection) {
    throw new BloggerDraftSaveGuardError("blogger_connection_not_ready", "Exactly one Blogger connection is required for draft save.");
  }
  if (!preview.draftPayloadReady || !currentHashes) {
    throw new BloggerDraftSaveGuardError("blogger_draft_payload_not_ready", "Blogger draft payload preview is not ready.");
  }
  if (!activeApproval) {
    throw new BloggerDraftSaveGuardError("blogger_draft_approval_missing", "Active Blogger draft approval is required before saving a draft.");
  }
  if (activeApproval.snapshotHash !== currentHashes.snapshotHash || activeApproval.draftHtmlHash !== currentHashes.draftHtmlHash) {
    throw new BloggerDraftSaveGuardError("blogger_draft_approval_stale", "Active Blogger draft approval does not match the current payload preview.");
  }
  if (!approvalSummary.approvalMatchesCurrentPreview) {
    throw new BloggerDraftSaveGuardError("blogger_draft_approval_stale", "Active Blogger draft approval does not match the current payload preview.");
  }

  return {
    contentItem,
    bloggerConnection,
    preview,
    currentHashes,
    activeApproval
  };
}

function loadContentItem(contentItemId: string) {
  return prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      blog: true,
      brandProfile: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });
}
