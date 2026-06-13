import { NextResponse } from "next/server";
import { deleteLlmModel, getLlmModel, updateLlmModel } from "@/lib/db/llm-models";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const model = await getLlmModel(params.id);

  if (!model) {
    return NextResponse.json({ error: "LLM model not found" }, { status: 404 });
  }

  return NextResponse.json({ data: model });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await request.json();
  const model = await updateLlmModel(params.id, body);
  return NextResponse.json({ data: model });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  await deleteLlmModel(params.id);
  return NextResponse.json({ data: { id: params.id } });
}
