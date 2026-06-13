import { NextResponse } from "next/server";
import { testLlmProvider } from "@/lib/llm/provider-test";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const result = await testLlmProvider(params.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Provider connection test failed." }, { status: 400 });
  }
}
