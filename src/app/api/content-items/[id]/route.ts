import { NextResponse } from "next/server";
import { deleteContentItem, getContentItem, updateContentItem } from "@/lib/db/content-items";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const contentItem = await getContentItem(params.id);

  if (!contentItem) {
    return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  }

  return NextResponse.json({ data: contentItem });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await request.json();
  const contentItem = await updateContentItem(params.id, body);
  return NextResponse.json({ data: contentItem });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  await deleteContentItem(params.id);
  return NextResponse.json({ data: { id: params.id } });
}
