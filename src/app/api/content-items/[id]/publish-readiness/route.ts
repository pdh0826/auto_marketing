import { NextResponse } from "next/server";
import { buildBloggerDraftApprovalSnapshotHashes, buildBloggerDraftApprovalSummary } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftPayloadPreview } from "@/lib/blogger/draft-payload-preview";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildPublishReadiness } from "@/lib/content/publish-readiness";
import { getActiveBloggerDraftApproval, getLatestBloggerDraftApproval, toBloggerDraftApprovalAdmin } from "@/lib/db/blogger-draft-approvals";
import { getLatestSuccessfulBloggerDraftSave } from "@/lib/db/blogger-draft-saves";
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
    const contentItem = await prisma.contentItem.findUnique({
      where: { id: params.id },
      include: {
        blog: true,
        brandProfile: true,
        assets: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
    const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
    const draftPreview = buildBloggerDraftPayloadPreview(
      contentItem as unknown as ContentItemAdmin,
      contentItem.assets as unknown as ContentAssetAdmin[],
      bloggerConnections
    );
    const currentHashes = buildBloggerDraftApprovalSnapshotHashes(draftPreview, contentItem.draftHtml);
    const activeApproval = await getActiveBloggerDraftApproval(contentItem.id);
    const latestApproval = activeApproval ?? (await getLatestBloggerDraftApproval(contentItem.id));
    const latestSuccessfulDraftSave = await getLatestSuccessfulBloggerDraftSave(contentItem.id);
    const approvalSummary = buildBloggerDraftApprovalSummary({
      approval: latestApproval ? toBloggerDraftApprovalAdmin(latestApproval) : null,
      approvalSnapshotHash: latestApproval?.snapshotHash ?? null,
      currentSnapshotHash: currentHashes?.snapshotHash ?? null,
      currentDraftHtmlHash: currentHashes?.draftHtmlHash ?? null,
      currentPreviewReady: draftPreview.draftPayloadReady
    });
    const result = buildPublishReadiness(
      contentItem as unknown as ContentItemAdmin,
      contentItem.assets as unknown as ContentAssetAdmin[],
      bloggerConnection,
      {
        status: approvalSummary.approvalStatus,
        snapshotHashPrefix: approvalSummary.currentSnapshotHashPrefix,
        matchesCurrentPreview: approvalSummary.approvalMatchesCurrentPreview,
        approvedAt: approvalSummary.approval?.approvedAt ?? null
      },
      latestSuccessfulDraftSave
        ? {
            draftSaved: true,
            bloggerPostId: latestSuccessfulDraftSave.bloggerPostId,
            bloggerPostUrl: latestSuccessfulDraftSave.bloggerPostUrl,
            savedAt: latestSuccessfulDraftSave.savedAt
          }
        : null
    );
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish readiness check failed.", 500) }, { status: 400 });
  }
}
