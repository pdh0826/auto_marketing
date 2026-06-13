import { NextResponse } from "next/server";
import { createLlmTaskRoute, listLlmTaskRoutes } from "@/lib/db/llm-task-routes";

export async function GET() {
  const routes = await listLlmTaskRoutes();
  return NextResponse.json({ data: routes });
}

export async function POST(request: Request) {
  const body = await request.json();
  const route = await createLlmTaskRoute(body);
  return NextResponse.json({ data: route }, { status: 201 });
}
