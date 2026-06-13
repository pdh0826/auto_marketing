import { NextResponse } from "next/server";
import { deleteBrandProfile, getBrandProfile, updateBrandProfile } from "@/lib/db/brand-profiles";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const brandProfile = await getBrandProfile(params.id);

  if (!brandProfile) {
    return NextResponse.json({ error: "Brand profile not found" }, { status: 404 });
  }

  return NextResponse.json({ data: brandProfile });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await request.json();
  const brandProfile = await updateBrandProfile(params.id, body);
  return NextResponse.json({ data: brandProfile });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  await deleteBrandProfile(params.id);
  return NextResponse.json({ data: { id: params.id } });
}
