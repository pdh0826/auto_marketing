import { NextResponse } from "next/server";
import { createBlog, listBlogs } from "@/lib/db/blogs";

export async function GET() {
  const blogs = await listBlogs();
  return NextResponse.json({ data: blogs });
}

export async function POST(request: Request) {
  const body = await request.json();
  const blog = await createBlog(body);
  return NextResponse.json({ data: blog }, { status: 201 });
}
