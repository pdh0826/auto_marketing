import { NextResponse } from "next/server";
import { getBloggerEditorialPlan } from "@/lib/daily-brief/blogger-editorial-plan";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ data: getBloggerEditorialPlan() });
}
