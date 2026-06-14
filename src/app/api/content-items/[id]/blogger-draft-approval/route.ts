import { NextResponse } from "next/server";
import { buildBloggerDraftApprovalSnapshotHashes, buildBloggerDraftApprovalSummary } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftPayloadPreview } from "@/lib/blogger/draft-payload-preview";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import {
  createBloggerDraftApprovalFromSnapshot,
  revokeActiveBloggerDraftApproval,
  toBloggerDraftApprovalAdmin
} from "@/lib/db/blogger-draft-approvals";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const context = await loadBloggerDraftApprovalContext(params.id);
    if (!context) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    if (!context.preview.draftPayloadReady || !context.currentHashes) {
      return NextResponse.json(
        {
          error: "blogger_draft_payload_not_ready",
          message: "Blogger draft payload preview is not ready for manual approval.",
          data: {
            preview: context.preview,
            draftSaveImplemented: true,
            publishImplemented: false,
            tokenRefreshImplemented: false
          }
        },
        { status: 400 }
      );
    }

    const approval = await createBloggerDraftApprovalFromSnapshot({
      contentItemId: context.contentItem.id,
      snapshot: context.currentHashes.snapshot,
      snapshotHash: context.currentHashes.snapshotHash,
      draftHtmlHash: context.currentHashes.draftHtmlHash,
      approvedBy: null
    });
    const approvalAdmin = toBloggerDraftApprovalAdmin(approval);
    const approvalSummary = buildBloggerDraftApprovalSummary({
      approval: approvalAdmin,
      approvalSnapshotHash: approval.snapshotHash,
      currentSnapshotHash: context.currentHashes.snapshotHash,
      currentDraftHtmlHash: context.currentHashes.draftHtmlHash,
      currentPreviewReady: context.preview.draftPayloadReady
    });

    return NextResponse.json({
      data: {
        approval: approvalAdmin,
        approvalSummary,
        draftSaveImplemented: true,
        publishImplemented: false,
        tokenRefreshImplemented: false
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger draft approval failed.", 500) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const revokedApproval = await revokeActiveBloggerDraftApproval(params.id);
    if (!revokedApproval) {
      return NextResponse.json(
        {
          error: "blogger_draft_approval_not_found",
          message: "Active Blogger draft approval was not found."
        },
        { status: 404 }
      );
    }
    const context = await loadBloggerDraftApprovalContext(params.id);
    const revokedApprovalAdmin = toBloggerDraftApprovalAdmin(revokedApproval);
    const approvalSummary = buildBloggerDraftApprovalSummary({
      approval: revokedApprovalAdmin,
      approvalSnapshotHash: revokedApproval.snapshotHash,
      currentSnapshotHash: context?.currentHashes?.snapshotHash ?? null,
      currentDraftHtmlHash: context?.currentHashes?.draftHtmlHash ?? null,
      currentPreviewReady: Boolean(context?.preview.draftPayloadReady)
    });

    return NextResponse.json({
      data: {
        approval: revokedApprovalAdmin,
        approvalSummary,
        revoked: true,
        draftSaveImplemented: true,
        publishImplemented: false,
        tokenRefreshImplemented: false
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger draft approval revoke failed.", 500) }, { status: 400 });
  }
}

async function loadBloggerDraftApprovalContext(contentItemId: string) {
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

  const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
  const preview = buildBloggerDraftPayloadPreview(
    contentItem as unknown as ContentItemAdmin,
    contentItem.assets as unknown as ContentAssetAdmin[],
    bloggerConnections
  );
  const currentHashes = buildBloggerDraftApprovalSnapshotHashes(preview, contentItem.draftHtml);

  return {
    contentItem,
    preview,
    currentHashes
  };
}
