import { NextResponse } from "next/server";
import { createLlmProvider, listLlmProviders } from "@/lib/db/llm-providers";

export async function GET() {
  const providers = await listLlmProviders();
  return NextResponse.json({ data: providers });
}

export async function POST(request: Request) {
  const body = await request.json();
  const provider = await createLlmProvider(body);
  return NextResponse.json({ data: provider }, { status: 201 });
}
