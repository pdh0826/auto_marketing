import { NextResponse } from "next/server";
import { getContentAsset } from "@/lib/db/content-assets";
import { readContentAssetFile } from "@/lib/content/storage";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    assetId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const asset = await getContentAsset(params.assetId);

  if (!asset) {
    return NextResponse.json({ error: "Content asset not found" }, { status: 404 });
  }

  try {
    const file = await readContentAssetFile(asset.storagePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(file.byteLength),
        "Content-Disposition": `inline; filename="${asset.fileName}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Asset file not found" }, { status: 404 });
  }
}
