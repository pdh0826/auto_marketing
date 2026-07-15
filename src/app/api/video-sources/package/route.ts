import { NextResponse } from "next/server";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { getDailyBriefRun } from "@/lib/daily-brief/store";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";
import { buildGenericUrlVideoSourcePreview } from "@/lib/video-automation/source-collection/generic-url-source";
import { buildManualVideoSourcePreview } from "@/lib/video-automation/source-collection/manual-source";
import { buildSiteRecipeVideoSourcePreview } from "@/lib/video-automation/source-collection/site-recipe-source";
import { buildContentItemVideoSourcePreview } from "@/lib/video-automation/source-collection/content-item-collector";
import { buildDailyBriefVideoSourcePreview } from "@/lib/video-automation/source-collection/daily-brief-collector";
import type {
  GenericUrlVideoSourceInput,
  ManualVideoSourceInput,
  SiteRecipeVideoSourceInput,
  VideoSourcePreviewResult
} from "@/lib/video-automation/source-collection/types";
import { buildVideoSourcePackagePreview, writeVideoSourcePackage } from "@/lib/video-automation/source-package/package";

export const runtime = "nodejs";

type VideoSourcePackageRequest =
  | { sourceKind: "manual"; manual: ManualVideoSourceInput; write?: boolean }
  | { sourceKind: "content_item"; contentItemId: string; write?: boolean }
  | { sourceKind: "daily_brief"; runId: string; write?: boolean }
  | { sourceKind: "site_recipe"; siteRecipe: SiteRecipeVideoSourceInput; write?: boolean }
  | { sourceKind: "generic_url"; genericUrl: GenericUrlVideoSourceInput; write?: boolean };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VideoSourcePackageRequest;
    const preview = await buildPreviewFromRequest(body);
    const result = body.write ? await writeVideoSourcePackage(preview) : buildVideoSourcePackagePreview(preview);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Video source package failed.") }, { status: 400 });
  }
}

async function buildPreviewFromRequest(body: VideoSourcePackageRequest): Promise<VideoSourcePreviewResult> {
  if (body.sourceKind === "manual") {
    return buildManualVideoSourcePreview(body.manual);
  }
  if (body.sourceKind === "site_recipe") {
    return buildSiteRecipeVideoSourcePreview(body.siteRecipe);
  }
  if (body.sourceKind === "generic_url") {
    return buildGenericUrlVideoSourcePreview(body.genericUrl);
  }
  if (body.sourceKind === "daily_brief") {
    const run = await getDailyBriefRun(body.runId);
    if (!run) {
      throw new Error("Daily brief run not found.");
    }
    return buildDailyBriefVideoSourcePreview(run);
  }

  const contentItem = await prisma.contentItem.findUnique({
    where: { id: body.contentItemId },
    include: {
      blog: true,
      brandProfile: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!contentItem) {
    throw new Error("Content item not found.");
  }

  return buildContentItemVideoSourcePreview(contentItem as unknown as ContentItemAdmin, contentItem.assets as unknown as ContentAssetAdmin[]);
}
