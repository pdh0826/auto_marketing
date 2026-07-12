import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { readFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, VIDEO_MIME_TYPES, type ContentAssetType } from "./asset-types";

const uploadRoot = path.join(process.cwd(), "local-data", "uploads", "content-assets");

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov"
};

export function getAssetType(mimeType: string): ContentAssetType | null {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return "image";
  }
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return "video";
  }
  return null;
}

export function validateUpload(mimeType: string, fileSize: number) {
  const assetType = getAssetType(mimeType);
  if (!assetType) {
    throw new Error("Unsupported media type. Only approved image and video files are allowed.");
  }

  const maxBytes = assetType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (fileSize > maxBytes) {
    throw new Error(`${assetType} file is too large.`);
  }

  return assetType;
}

export async function saveContentAssetFile(contentItemId: string, file: File) {
  const assetType = validateUpload(file.type, file.size);
  const extension = extensionByMimeType[file.type];
  const fileName = `${randomUUID()}${extension}`;
  const relativeDir = path.join("local-data", "uploads", "content-assets", contentItemId);
  const relativePath = path.join(relativeDir, fileName);
  const absoluteDir = safeResolve(relativeDir);
  const absolutePath = safeResolve(relativePath);
  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, bytes);

  return {
    assetType,
    fileName,
    storagePath: relativePath,
    mimeType: file.type,
    fileSize: file.size,
    originalName: sanitizeOriginalName(file.name)
  };
}

export async function readContentAssetFile(storagePath: string) {
  return readFile(safeResolve(storagePath));
}

export function readContentAssetFileSync(storagePath: string) {
  return readFileSync(safeResolve(storagePath));
}

export async function deleteContentAssetFile(storagePath: string) {
  try {
    await unlink(safeResolve(storagePath));
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    throw error;
  }
}

export async function deleteContentAssetFiles(assets: Array<{ storagePath: string }>) {
  const failures: string[] = [];

  for (const asset of assets) {
    try {
      await deleteContentAssetFile(asset.storagePath);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `Failed to delete ${asset.storagePath}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Some asset files could not be deleted: ${failures.join("; ")}`);
  }
}

function safeResolve(relativePath: string) {
  const resolved = path.resolve(process.cwd(), relativePath);
  const root = path.resolve(uploadRoot);

  if (!resolved.startsWith(root)) {
    throw new Error("Invalid asset storage path.");
  }

  return resolved;
}

function sanitizeOriginalName(value: string) {
  const baseName = path.basename(value);
  return baseName.replace(/[^\w.\- ()]/g, "_").slice(0, 180) || "upload";
}

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
