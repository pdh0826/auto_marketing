import { NextResponse } from "next/server";
import type { ContentAssetPlacement } from "@prisma/client";
import { deleteContentAsset, getContentAsset, updateContentAsset } from "@/lib/db/content-assets";
import { deleteContentAssetFile } from "@/lib/content/storage";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    assetId: string;
  };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const body = await request.json();
  const asset = await updateContentAsset(params.assetId, {
    caption: normalizeOptionalString(body.caption),
    altText: normalizeOptionalString(body.altText),
    userNote: normalizeOptionalString(body.userNote),
    placementHint: parsePlacement(body.placementHint),
    sortOrder: typeof body.sortOrder === "number" ? Math.trunc(body.sortOrder) : 0,
    isPrimary: Boolean(body.isPrimary)
  });

  return NextResponse.json({ data: toAssetResponse(asset) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const asset = await getContentAsset(params.assetId);

  if (!asset) {
    return NextResponse.json({ error: "Content asset not found" }, { status: 404 });
  }

  try {
    await deleteContentAssetFile(asset.storagePath);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? `Asset file delete failed: ${error.message}` : "Asset file delete failed." },
      { status: 500 }
    );
  }

  await deleteContentAsset(params.assetId);
  return NextResponse.json({ data: { id: params.assetId } });
}

function toAssetResponse<T extends { storagePath: string }>(asset: T) {
  const { storagePath: _storagePath, ...safeAsset } = asset;
  return safeAsset;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePlacement(value: unknown): ContentAssetPlacement {
  if (typeof value !== "string") {
    return "gallery";
  }

  const allowed = ["hero", "intro", "middle", "outro", "gallery", "embed"];
  return allowed.includes(value) ? (value as ContentAssetPlacement) : "gallery";
}
