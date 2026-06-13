export type ContentAssetType = "image" | "video";
export type ContentAssetPlacement = "hero" | "intro" | "middle" | "outro" | "gallery" | "embed";

export interface ContentAssetAdmin {
  id: string;
  contentItemId: string;
  assetType: ContentAssetType;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  thumbnailPath: string | null;
  caption: string | null;
  altText: string | null;
  userNote: string | null;
  placementHint: ContentAssetPlacement;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContentAssetMetadataSuggestion {
  caption: string;
  altText: string;
  userNote: string;
  placementHint: ContentAssetPlacement;
  sortOrder: number;
  recommendedIsPrimary: boolean;
  rationale: string[];
  warnings: string[];
}

export const CONTENT_ASSET_PLACEMENTS: Array<{ value: ContentAssetPlacement; label: string }> = [
  { value: "hero", label: "hero" },
  { value: "intro", label: "intro" },
  { value: "middle", label: "middle" },
  { value: "outro", label: "outro" },
  { value: "gallery", label: "gallery" },
  { value: "embed", label: "embed" }
];

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
