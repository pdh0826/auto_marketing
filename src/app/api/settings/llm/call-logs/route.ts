import { NextResponse } from "next/server";
import { createLlmCallLog, listLlmCallLogs } from "@/lib/db/llm-call-logs";

export async function GET() {
  const logs = await listLlmCallLogs();
  return NextResponse.json({ data: logs });
}

export async function POST(request: Request) {
  const body = await request.json();
  const log = await createLlmCallLog(body);
  return NextResponse.json({ data: log }, { status: 201 });
}
