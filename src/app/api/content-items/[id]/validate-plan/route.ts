import { NextResponse } from "next/server";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { validatePlanJson } from "@/lib/content/plan-validation";
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
    const body = (await request.json()) as { candidatePlanJson?: unknown };
    const candidatePlanJson = body.candidatePlanJson;

    if (!candidatePlanJson || typeof candidatePlanJson !== "object" || Array.isArray(candidatePlanJson)) {
      return NextResponse.json({ error: "candidatePlanJson must be a JSON object." }, { status: 400 });
    }

    const contentItem = await prisma.contentItem.findUnique({
      where: { id: params.id },
      include: {
        blog: true,
        brandProfile: true
      }
    });

    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const planJson = candidatePlanJson as Record<string, unknown>;
    const validation = validatePlanJson(planJson, contentItem as unknown as ContentItemAdmin);

    return NextResponse.json({
      data: {
        candidatePlanJson: planJson,
        validation
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "planJson validation failed.", 500) }, { status: 400 });
  }
}
