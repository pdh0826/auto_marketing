import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import { readContentAssetFileSync } from "@/lib/content/storage";
import { execFileSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

export interface BloggerPublishableHtmlSummary {
  checked: true;
  imageEmbedMode: "public_url" | "inline_data_url" | "compressed_jpeg_data_url" | "none";
  publicAssetBaseUrl: string | null;
  publicAssetBaseUrlConfigured: boolean;
  publicAssetBaseUrlUsableForBlogger: boolean;
  localAssetUrlCount: number;
  convertedAssetUrlCount: number;
  inlineDataUrlAssetCount: number;
  inlineDataUrlByteCount: number;
  inlineDataUrlEstimatedHtmlBytes: number;
  unresolvedLocalAssetUrlCount: number;
  firstImageSrc: string | null;
  firstImageAlt: string | null;
  firstImageAssetId: string | null;
  firstImageLooksLikeThumbnail: boolean;
  blockingIssues: string[];
  warnings: string[];
}

export interface BloggerPublishableHtmlResult {
  html: string;
  summary: BloggerPublishableHtmlSummary;
}

const LOCAL_ASSET_URL_PATTERN = /(?:https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?)?\/api\/content-assets\/([^/"'\s<>]+)\/file/g;
const INLINE_DATA_URL_MODE = "inline_data_url";
const COMPRESSED_JPEG_DATA_URL_MODE = "compressed_jpeg_data_url";
const MAX_INLINE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_INLINE_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_COMPRESSED_INLINE_TOTAL_BYTES = 2 * 1024 * 1024;
const COMPRESSED_JPEG_MAX_DIMENSION = 1200;
const COMPRESSED_JPEG_QUALITY = 68;

export function buildBloggerPublishableHtml(html: string, assets: ContentAssetAdmin[] = []): BloggerPublishableHtmlResult {
  const publicAssetBaseUrl = normalizePublicAssetBaseUrl(
    process.env.BLOGGER_PUBLIC_ASSET_BASE_URL ?? process.env.BLOG_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null
  );
  const publicAssetBaseUrlUsableForBlogger = isUsablePublicUrl(publicAssetBaseUrl);
  const configuredImageEmbedMode = getConfiguredImageEmbedMode();
  const inlineDataUrlEnabled = configuredImageEmbedMode === INLINE_DATA_URL_MODE || configuredImageEmbedMode === COMPRESSED_JPEG_DATA_URL_MODE;
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const localAssetMatches = Array.from(html.matchAll(LOCAL_ASSET_URL_PATTERN));
  const localAssetUrlCount = localAssetMatches.length;
  let convertedAssetUrlCount = 0;
  let inlineDataUrlAssetCount = 0;
  let inlineDataUrlByteCount = 0;
  let inlineDataUrlEstimatedHtmlBytes = 0;
  let transformedHtml = html;
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (publicAssetBaseUrlUsableForBlogger && localAssetUrlCount > 0) {
    transformedHtml = html.replace(LOCAL_ASSET_URL_PATTERN, (_match, encodedAssetId: string) => {
      convertedAssetUrlCount += 1;
      return `${publicAssetBaseUrl}/api/content-assets/${encodedAssetId}/file`;
    });
  } else if (inlineDataUrlEnabled && localAssetUrlCount > 0) {
    transformedHtml = html.replace(LOCAL_ASSET_URL_PATTERN, (match, encodedAssetId: string) => {
      const asset = findAssetByEncodedId(assetById, encodedAssetId);
      if (!asset) {
        blockingIssues.push("blogger_inline_asset_not_found");
        return match;
      }
      if (!asset.mimeType.startsWith("image/")) {
        blockingIssues.push("blogger_inline_asset_not_image");
        return match;
      }
      if (configuredImageEmbedMode !== COMPRESSED_JPEG_DATA_URL_MODE && asset.fileSize > MAX_INLINE_IMAGE_BYTES) {
        blockingIssues.push("blogger_inline_asset_too_large");
        return match;
      }

      try {
        const dataUrlResult =
          configuredImageEmbedMode === COMPRESSED_JPEG_DATA_URL_MODE ? buildCompressedJpegDataUrl(asset) : buildRawDataUrl(asset);
        const totalByteLimit =
          configuredImageEmbedMode === COMPRESSED_JPEG_DATA_URL_MODE ? MAX_COMPRESSED_INLINE_TOTAL_BYTES : MAX_INLINE_TOTAL_BYTES;
        if (inlineDataUrlByteCount + dataUrlResult.byteCount > totalByteLimit) {
          blockingIssues.push("blogger_inline_assets_total_too_large");
          return match;
        }

        inlineDataUrlByteCount += dataUrlResult.byteCount;
        inlineDataUrlAssetCount += 1;
        const dataUrl = dataUrlResult.dataUrl;
        inlineDataUrlEstimatedHtmlBytes += dataUrl.length;
        if (dataUrlResult.compressed) {
          warnings.push("blogger_inline_asset_compressed_to_jpeg");
        }
        return dataUrl;
      } catch {
        blockingIssues.push("blogger_inline_asset_file_not_found");
        return match;
      }
    });
  }

  const unresolvedLocalAssetUrlCount = (transformedHtml.match(LOCAL_ASSET_URL_PATTERN) ?? []).length;
  const firstImage = extractFirstImage(transformedHtml);
  const firstImageAssetId = firstImage?.src ? extractAssetIdFromAssetUrl(firstImage.src) : null;
  const firstImageLooksLikeThumbnail = Boolean(
    (firstImageAssetId && /thumb|thumbnail/i.test(firstImageAssetId)) ||
      (firstImage?.alt && /썸네일|thumbnail|thumb/i.test(firstImage.alt))
  );

  if (localAssetUrlCount > 0 && !publicAssetBaseUrlUsableForBlogger && !inlineDataUrlEnabled) {
    blockingIssues.push("blogger_public_asset_base_url_required");
  }
  if (unresolvedLocalAssetUrlCount > 0) {
    blockingIssues.push("blogger_local_asset_urls_unresolved");
  }
  if (firstImage && !firstImageLooksLikeThumbnail) {
    warnings.push("first_image_is_not_thumbnail_candidate");
  }
  if (localAssetUrlCount === 0) {
    warnings.push("no_local_content_asset_images_detected");
  }

  return {
    html: transformedHtml,
    summary: {
      checked: true,
      imageEmbedMode: resolveSummaryImageEmbedMode({
        localAssetUrlCount,
        inlineDataUrlAssetCount,
        configuredImageEmbedMode
      }),
      publicAssetBaseUrl,
      publicAssetBaseUrlConfigured: Boolean(publicAssetBaseUrl),
      publicAssetBaseUrlUsableForBlogger,
      localAssetUrlCount,
      convertedAssetUrlCount,
      inlineDataUrlAssetCount,
      inlineDataUrlByteCount,
      inlineDataUrlEstimatedHtmlBytes,
      unresolvedLocalAssetUrlCount,
      firstImageSrc: redactImageSrc(firstImage?.src ?? null),
      firstImageAlt: firstImage?.alt ?? null,
      firstImageAssetId,
      firstImageLooksLikeThumbnail,
      blockingIssues,
      warnings
    }
  };
}

function redactImageSrc(src: string | null) {
  if (!src) {
    return null;
  }
  if (src.startsWith("data:")) {
    const mime = /^data:([^;,]+)/.exec(src)?.[1] ?? "unknown";
    return `data:${mime};base64,[redacted]`;
  }
  return src;
}

function getConfiguredImageEmbedMode() {
  const configured = (process.env.BLOGGER_IMAGE_EMBED_MODE ?? process.env.BLOGGER_ASSET_EMBED_MODE ?? "").trim().toLowerCase();
  return configured === INLINE_DATA_URL_MODE || configured === COMPRESSED_JPEG_DATA_URL_MODE ? configured : "";
}

function buildRawDataUrl(asset: ContentAssetAdmin) {
  const bytes = readContentAssetFileSync(asset.storagePath);
  return {
    dataUrl: `data:${asset.mimeType};base64,${bytes.toString("base64")}`,
    byteCount: bytes.byteLength,
    compressed: false
  };
}

function buildCompressedJpegDataUrl(asset: ContentAssetAdmin) {
  if (!canCompressWithSips(asset.mimeType)) {
    return buildRawDataUrl(asset);
  }

  const outputPath = path.join(os.tmpdir(), `bga-blogger-inline-${crypto.randomBytes(6).toString("hex")}.jpg`);
  try {
    execFileSync(
      "sips",
      [
        "-s",
        "format",
        "jpeg",
        "-s",
        "formatOptions",
        String(COMPRESSED_JPEG_QUALITY),
        "-Z",
        String(COMPRESSED_JPEG_MAX_DIMENSION),
        resolveStoragePath(asset.storagePath),
        "--out",
        outputPath
      ],
      { stdio: "ignore" }
    );
    const bytes = fs.readFileSync(outputPath);
    return {
      dataUrl: `data:image/jpeg;base64,${bytes.toString("base64")}`,
      byteCount: bytes.byteLength,
      compressed: true
    };
  } finally {
    try {
      fs.unlinkSync(outputPath);
    } catch {
      // Best effort cleanup only.
    }
  }
}

function canCompressWithSips(mimeType: string) {
  return ["image/png", "image/jpeg", "image/jpg"].includes(mimeType.toLowerCase());
}

function resolveStoragePath(storagePath: string) {
  return path.isAbsolute(storagePath) ? storagePath : path.join(process.cwd(), storagePath);
}

function resolveSummaryImageEmbedMode(input: {
  localAssetUrlCount: number;
  inlineDataUrlAssetCount: number;
  configuredImageEmbedMode: string;
}): BloggerPublishableHtmlSummary["imageEmbedMode"] {
  if (input.localAssetUrlCount === 0) {
    return "none";
  }
  if (input.inlineDataUrlAssetCount > 0) {
    return input.configuredImageEmbedMode === COMPRESSED_JPEG_DATA_URL_MODE ? "compressed_jpeg_data_url" : "inline_data_url";
  }
  return "public_url";
}

function findAssetByEncodedId(assetById: Map<string, ContentAssetAdmin>, encodedAssetId: string) {
  const direct = assetById.get(encodedAssetId);
  if (direct) {
    return direct;
  }
  try {
    return assetById.get(decodeURIComponent(encodedAssetId)) ?? null;
  } catch {
    return null;
  }
}

function normalizePublicAssetBaseUrl(value: string | null) {
  const trimmed = value?.trim().replace(/\/+$/, "") ?? "";
  return trimmed || null;
}

function isUsablePublicUrl(value: string | null) {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1" && !hostname.endsWith(".local");
  } catch {
    return false;
  }
}

function extractFirstImage(html: string) {
  const imgMatch = html.match(/<img\b[^>]*>/i);
  if (!imgMatch) {
    return null;
  }
  return {
    src: extractAttribute(imgMatch[0], "src"),
    alt: extractAttribute(imgMatch[0], "alt")
  };
}

function extractAttribute(tag: string, attribute: string) {
  const match = tag.match(new RegExp(`\\s${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function extractAssetIdFromAssetUrl(src: string) {
  const match = src.match(/\/api\/content-assets\/([^/"'\s<>]+)\/file/);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
