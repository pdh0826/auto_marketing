import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildContentItemVideoSourceBundle } from "../adapters/content-item-source";
import type { VideoSourcePreviewResult } from "./types";
import { buildCollectedBundlePreview, collectFromVideoSourceBundle } from "./bundle-collection";

export function collectContentItemVideoSource(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[] = [], collectedAt?: string) {
  return collectFromVideoSourceBundle(buildContentItemVideoSourceBundle(contentItem, assets), {
    collectionKind: "content_item",
    collectedAt,
    dbRead: true
  });
}

export function buildContentItemVideoSourcePreview(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[] = [], collectedAt?: string): VideoSourcePreviewResult {
  return buildCollectedBundlePreview(buildContentItemVideoSourceBundle(contentItem, assets), {
    collectionKind: "content_item",
    collectedAt,
    dbRead: true
  });
}
