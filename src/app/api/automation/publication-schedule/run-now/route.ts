import { NextResponse } from "next/server";
import { tickPublicationScheduler } from "@/lib/automation/publication-scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const dryRun = body.dryRun !== false;
    if (!dryRun && body.confirmation !== "I_APPROVE_THIS_SCHEDULED_SLOT_EXECUTION") {
      return NextResponse.json({ error: "publication_slot_execution_confirmation_required" }, { status: 400 });
    }
    const data = await tickPublicationScheduler({
      force: true,
      dryRun,
      slotId: typeof body.slotId === "string" ? body.slotId : undefined,
      regenerate: body.regenerate === true
    });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "publication_slot_execution_failed", 300) }, { status: 400 });
  }
}
