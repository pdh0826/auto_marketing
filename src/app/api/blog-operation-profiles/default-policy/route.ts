import { NextResponse } from "next/server";
import { buildBlogOperationProfileDefaultPolicyResponse, type BlogOperationProfileDefaultPolicyRequest } from "@/lib/blog-operation-profiles/default-policy-preview";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await parseJsonBody(request)) as BlogOperationProfileDefaultPolicyRequest;
    const result = await buildBlogOperationProfileDefaultPolicyResponse(body);
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blog operation profile default policy failed.", 500) }, { status: 400 });
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
