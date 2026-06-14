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
    const body = (await request.json()) as { candidateHtml?: unknown };
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
    if (!result.validation.ok) {
      return NextResponse.json({ error: "HTML candidate did not pass validation.", data: result }, { status: 400 });
    }

    const updated = await prisma.contentItem.update({
      where: { id: params.id },
      data: {
        draftHtml: body.candidateHtml as string
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
        metadata: result.metadata
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "HTML candidate apply failed.", 500) }, { status: 400 });
  }
}
