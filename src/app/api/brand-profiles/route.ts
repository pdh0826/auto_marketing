import { NextResponse } from "next/server";
import { createBrandProfile, listBrandProfiles } from "@/lib/db/brand-profiles";

export async function GET() {
  const brandProfiles = await listBrandProfiles();
  return NextResponse.json({ data: brandProfiles });
}

export async function POST(request: Request) {
  const body = await request.json();
  const brandProfile = await createBrandProfile(body);
  return NextResponse.json({ data: brandProfile }, { status: 201 });
}
