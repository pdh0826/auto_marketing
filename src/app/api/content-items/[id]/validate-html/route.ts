import { NextResponse } from "next/server";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
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

    const result = validateHtmlCandidate(body.candidateHtml, contentItem.assets as unknown as ContentAssetAdmin[], contentItem as unknown as ContentItemAdmin);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "HTML candidate validation failed.", 500) }, { status: 400 });
  }
}
