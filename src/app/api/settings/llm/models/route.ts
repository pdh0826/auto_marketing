import { NextResponse } from "next/server";
import { createLlmModel, listLlmModels } from "@/lib/db/llm-models";

export async function GET() {
  const models = await listLlmModels();
  return NextResponse.json({ data: models });
}

export async function POST(request: Request) {
  const body = await request.json();
  const model = await createLlmModel(body);
  return NextResponse.json({ data: model }, { status: 201 });
}
