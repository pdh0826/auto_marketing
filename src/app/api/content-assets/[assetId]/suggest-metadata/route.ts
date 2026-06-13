import { NextResponse } from "next/server";
import { suggestAssetMetadata } from "@/lib/content/metadata-suggestions";
import { getContentAssetWithContext } from "@/lib/db/content-assets";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    assetId: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  const asset = await getContentAssetWithContext(params.assetId);

  if (!asset) {
    return NextResponse.json({ error: "Content asset not found" }, { status: 404 });
  }

  const suggestion = suggestAssetMetadata({
    asset,
    contentItem: asset.contentItem
  });

  return NextResponse.json({ data: suggestion });
}
