import { NextResponse } from "next/server";
import { createContentItem, listContentItems } from "@/lib/db/content-items";

export async function GET() {
  const contentItems = await listContentItems();
  return NextResponse.json({ data: contentItems });
}

export async function POST(request: Request) {
  const body = await request.json();
  const contentItem = await createContentItem(body);
  return NextResponse.json({ data: contentItem }, { status: 201 });
}
