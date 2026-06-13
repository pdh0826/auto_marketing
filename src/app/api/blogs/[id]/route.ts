import { NextResponse } from "next/server";
import { deleteBlog, getBlog, updateBlog } from "@/lib/db/blogs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const blog = await getBlog(params.id);

  if (!blog) {
    return NextResponse.json({ error: "Blog not found" }, { status: 404 });
  }

  return NextResponse.json({ data: blog });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await request.json();
  const blog = await updateBlog(params.id, body);
  return NextResponse.json({ data: blog });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  await deleteBlog(params.id);
  return NextResponse.json({ data: { id: params.id } });
}
