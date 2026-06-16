import { NextResponse } from "next/server";
import { buildBloggerDraftApprovalSnapshotHashes, buildBloggerDraftApprovalSummary } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftPayloadPreview } from "@/lib/blogger/draft-payload-preview";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildPublishApprovalPreview } from "@/lib/content/publish-approval-preview";
import { buildPublishPreflightDryRun } from "@/lib/content/publish-preflight";
import { getActiveBloggerDraftApproval, getLatestBloggerDraftApproval, toBloggerDraftApprovalAdmin } from "@/lib/db/blogger-draft-approvals";
import { getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { getLatestSuccessfulBloggerDraftSave, toBloggerDraftSaveAdmin } from "@/lib/db/blogger-draft-saves";
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
    const checkedAt = new Date();
    const publishPreflight = buildPublishPreflightDryRun({
      contentItem: safeContentItem,
      draftPayloadPreview,
      approvalSummary,
      latestSuccessfulDraftSave: latestSuccessfulDraftSave ? toBloggerDraftSaveAdmin(latestSuccessfulDraftSave) : null,
      accessTokenExpired: isExpired(secretStatus?.accessTokenExpiresAt ?? null),
      checkedAt
    });
    const result = buildPublishApprovalPreview({
      contentItem: safeContentItem,
      publishPreflight,
      checkedAt
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Publish approval snapshot preview failed.", 500) }, { status: 400 });
  }
}

function isExpired(value: string | null) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}
