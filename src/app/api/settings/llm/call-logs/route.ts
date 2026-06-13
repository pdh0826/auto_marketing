import { NextResponse } from "next/server";
import { listLlmCallLogs } from "@/lib/db/llm-call-logs";

export async function GET() {
  const logs = await listLlmCallLogs();
  return NextResponse.json({ data: logs });
}

export async function POST() {
  return NextResponse.json({ error: "Method Not Allowed. LLM call logs are created by server-side task runners only." }, { status: 405 });
}
