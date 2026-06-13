import { NextResponse } from "next/server";
import type { ContentAssetPlacement } from "@prisma/client";
import { createContentAsset, listContentAssets } from "@/lib/db/content-assets";
import { getContentItem } from "@/lib/db/content-items";
import { saveContentAssetFile, deleteContentAssetFile } from "@/lib/content/storage";

export const runtime = "nodejs";

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

  const assets = await listContentAssets(params.id);
  return NextResponse.json({ data: assets.map(toAssetResponse) });
}

export async function POST(request: Request, { params }: RouteContext) {
  const contentItem = await getContentItem(params.id);

  if (!contentItem) {
    return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const upload = formData.get("file");

    if (!(upload instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    const savedFile = await saveContentAssetFile(params.id, upload);

    try {
      const asset = await createContentAsset({
        contentItemId: params.id,
        assetType: savedFile.assetType,
        fileName: savedFile.fileName,
        originalName: savedFile.originalName,
        mimeType: savedFile.mimeType,
        fileSize: savedFile.fileSize,
        storagePath: savedFile.storagePath,
        thumbnailPath: null,
        caption: optionalFormString(formData.get("caption")),
        altText: optionalFormString(formData.get("altText")),
        userNote: optionalFormString(formData.get("userNote")),
        placementHint: parsePlacement(formData.get("placementHint")),
        sortOrder: parseInteger(formData.get("sortOrder"), 0),
        isPrimary: parseBoolean(formData.get("isPrimary"))
      });

      return NextResponse.json({ data: toAssetResponse(asset) }, { status: 201 });
    } catch (error) {
      await deleteContentAssetFile(savedFile.storagePath);
      throw error;
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset upload failed." }, { status: 400 });
  }
}

function toAssetResponse<T extends { storagePath: string }>(asset: T) {
  const { storagePath: _storagePath, ...safeAsset } = asset;
  return safeAsset;
}

function optionalFormString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseInteger(value: FormDataEntryValue | null, fallback: number) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

function parsePlacement(value: FormDataEntryValue | null): ContentAssetPlacement {
  if (typeof value !== "string") {
    return "gallery";
  }

  const allowed = ["hero", "intro", "middle", "outro", "gallery", "embed"];
  return allowed.includes(value) ? (value as ContentAssetPlacement) : "gallery";
}
