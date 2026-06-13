import { NextResponse } from "next/server";
import { deleteLlmProvider, getLlmProvider, updateLlmProvider } from "@/lib/db/llm-providers";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const provider = await getLlmProvider(params.id);

  if (!provider) {
    return NextResponse.json({ error: "LLM provider not found" }, { status: 404 });
  }

  return NextResponse.json({ data: provider });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json();
    const provider = await updateLlmProvider(params.id, body);
    return NextResponse.json({ data: provider });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "LLM provider could not be updated." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  await deleteLlmProvider(params.id);
  return NextResponse.json({ data: { id: params.id } });
}
