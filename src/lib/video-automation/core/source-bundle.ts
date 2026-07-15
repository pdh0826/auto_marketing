import { createHash } from "crypto";
import type { VideoSourceBundle, VideoSourceSnapshot, VideoSourceSideEffectSummary } from "./types";

export const VIDEO_SOURCE_BUNDLE_SCHEMA_VERSION = "video_source_bundle_v1";

export function buildVideoSourceSnapshot(input: {
  sourceInput: unknown;
  includedFields: string[];
  excludedFields: string[];
}): VideoSourceSnapshot {
  const canonicalJson = JSON.stringify(toCanonicalValue(redactUnsafeSourceValue(input.sourceInput)));
  const hash = createHash("sha256").update(canonicalJson, "utf8").digest("hex");
  return {
    schemaVersion: VIDEO_SOURCE_BUNDLE_SCHEMA_VERSION,
    hashAlgorithm: "sha256",
    hash,
    hashPrefix: hash.slice(0, 12),
    canonicalJsonLength: Buffer.byteLength(canonicalJson, "utf8"),
    includedFields: input.includedFields,
    excludedFields: input.excludedFields
  };
}

export function redactUnsafeSourceValue(value: unknown): unknown {
  const forbiddenValuePatterns = buildForbiddenValuePatterns();
  return redactValue(value, forbiddenValuePatterns);
}

export function toCanonicalValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalValue(item));
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    result[key] = toCanonicalValue(source[key]);
  }
  return result;
}

export function buildVideoSourceSideEffects(): VideoSourceSideEffectSummary {
  return {
    sourceRead: true,
    sourceWrite: false,
    existingContentItemMutation: false,
    dbWrite: false,
    localFileWrite: false,
    externalServiceWrite: false,
    secretRead: false,
    llmCall: false,
    schedulerMutation: false
  };
}

export function assertVideoSourceBundleSafe(bundle: VideoSourceBundle) {
  return isSafeValue(bundle, buildForbiddenValuePatterns());
}

function buildForbiddenValuePatterns() {
  return [
    /local-data\//i,
    /\/Users\//,
    /\/private\//,
    /file:\/\//i,
    new RegExp("\\." + "env", "i"),
    new RegExp(["token", "json"].join("\\."), "i"),
    new RegExp(["credentials", "json"].join("\\."), "i"),
    new RegExp(["client", "secret"].join("_"), "i"),
    new RegExp("\\." + "pem\\b", "i"),
    new RegExp("\\." + "key\\b", "i")
  ];
}

function redactValue(value: unknown, forbiddenValuePatterns: RegExp[]): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return forbiddenValuePatterns.some((pattern) => pattern.test(value)) ? "[redacted]" : value;
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, forbiddenValuePatterns));
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/^(storagePath|thumbnailPath|outputDirectory|localPath)$/i.test(key)) {
      continue;
    }
    result[key] = redactValue(item, forbiddenValuePatterns);
  }
  return result;
}

function isSafeValue(value: unknown, forbiddenValuePatterns: RegExp[]): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return !forbiddenValuePatterns.some((pattern) => pattern.test(value));
  }
  if (typeof value !== "object") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => isSafeValue(item, forbiddenValuePatterns));
  }
  return Object.entries(value as Record<string, unknown>).every(([key, item]) => {
    if (/^(storagePath|thumbnailPath|outputDirectory|localPath)$/i.test(key)) {
      return false;
    }
    return isSafeValue(item, forbiddenValuePatterns);
  });
}

export function compactParts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

export function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, Math.max(0, maxLength - 1))}…` : trimmed;
}
