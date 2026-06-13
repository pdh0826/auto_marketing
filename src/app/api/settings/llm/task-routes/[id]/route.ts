import { NextResponse } from "next/server";
import { deleteLlmTaskRoute, getLlmTaskRoute, updateLlmTaskRoute } from "@/lib/db/llm-task-routes";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const route = await getLlmTaskRoute(params.id);

  if (!route) {
    return NextResponse.json({ error: "LLM task route not found" }, { status: 404 });
  }

  return NextResponse.json({ data: route });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await request.json();
  const route = await updateLlmTaskRoute(params.id, body);
  return NextResponse.json({ data: route });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  await deleteLlmTaskRoute(params.id);
  return NextResponse.json({ data: { id: params.id } });
}
