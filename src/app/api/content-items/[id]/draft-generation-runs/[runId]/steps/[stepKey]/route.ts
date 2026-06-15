import { NextResponse } from "next/server";
import { StepwiseDraftGenerationError, executeStepwiseDraftGenerationStep } from "@/lib/llm/stepwise-draft-generation";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
    runId: string;
    stepKey: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = await readOptionalJson(request);
    const result = await executeStepwiseDraftGenerationStep({
      contentItemId: params.id,
      runId: params.runId,
      stepKey: params.stepKey,
      retry: Boolean(body?.retry || body?.force)
    });

    return NextResponse.json({
      data: {
        ...result,
        stepExecutionImplemented: true,
        assemblyImplemented: false,
        finalPolishImplemented: false,
        uiImplemented: false,
        contentItemAutoApply: false,
        bloggerApiImplemented: false
      }
    });
  } catch (error) {
    if (error instanceof StepwiseDraftGenerationError) {
      return NextResponse.json(
        {
          error: error.code,
          message: safeErrorMessage(error.message, 500)
        },
        { status: error.status }
      );
    }

    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Stepwise draft generation step failed.", 500) }, { status: 400 });
  }
}

async function readOptionalJson(request: Request) {
  const text = await request.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as { retry?: unknown; force?: unknown };
  } catch {
    return null;
  }
}
