import { NextResponse } from "next/server";
import { buildPublicationReportPreview, getPublicationReportStatus, tickPublicationReport } from "@/lib/automation/publication-report";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [status, preview] = await Promise.all([getPublicationReportStatus(), buildPublicationReportPreview()]);
  return NextResponse.json({ data: { ...status, preview } });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const dryRun = body.dryRun !== false;
    if (!dryRun && body.confirmation !== "I_APPROVE_PDASH_TELEGRAM_PUBLICATION_REPORT") {
      return NextResponse.json({ error: "publication_report_confirmation_required" }, { status: 400 });
    }
    const data = await tickPublicationReport({ force: true, dryRun });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error instanceof Error ? error.message : "publication_report_failed", 300) },
      { status: 400 }
    );
  }
}
