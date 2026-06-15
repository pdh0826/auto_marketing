import { NextResponse } from "next/server";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import { validateHtmlCandidate } from "@/lib/content/html-preview";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as { candidateHtml?: unknown; source?: unknown };
    const contentItem = await prisma.contentItem.findUnique({
      where: { id: params.id },
      include: {
        assets: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const result = validateHtmlCandidate(body.candidateHtml, contentItem.assets as unknown as ContentAssetAdmin[]);
    const safeSource = typeof body.source === "string" && body.source.trim() ? body.source.trim().slice(0, 80) : "unknown";
    if (!result.validation.ok) {
      return NextResponse.json(
        {
          error: "html_candidate_validation_failed: HTML candidate did not pass validation.",
          errorCode: "html_candidate_validation_failed",
          data: {
            ...result,
            applySummary: buildApplySummary(result, safeSource, false)
          }
        },
        { status: 400 }
      );
    }

    const candidateHtml = typeof body.candidateHtml === "string" ? body.candidateHtml : "";
    const updated = await prisma.contentItem.update({
      where: { id: params.id },
      data: {
        draftHtml: candidateHtml
      },
      include: {
        blog: true,
        brandProfile: true
      }
    });

    return NextResponse.json({
      data: {
        contentItem: updated,
        validation: result.validation,
        securityChecks: result.securityChecks,
        mediaMappings: result.mediaMappings,
        metadata: result.metadata,
        applySummary: buildApplySummary(result, safeSource, true)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "HTML candidate apply failed.", 500) }, { status: 400 });
  }
}

function buildApplySummary(result: ReturnType<typeof validateHtmlCandidate>, source: string, applied: boolean) {
  return {
    source,
    validationOk: result.validation.ok,
    htmlLength: result.metadata.htmlLength,
    unsafePatternCount: result.metadata.unsafePatternCount,
    applied,
    appliedField: applied ? "draftHtml" : null,
    contentItemSideEffect: applied ? "draftHtml_only" : "none",
    bloggerSideEffect: false,
    llmSideEffect: false,
    publishSideEffect: false,
    tokenRefreshSideEffect: false
  };
}
