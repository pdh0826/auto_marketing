import { createHash } from "node:crypto";
import type { BloggerDraftApprovalAdmin, BloggerDraftApprovalSummary, BloggerDraftPayloadPreview } from "@/lib/blogger/admin-types";

export const BLOGGER_DRAFT_APPROVAL_SNAPSHOT_VERSION = "blogger-draft-approval-v1";
const HASH_PREFIX_LENGTH = 12;

export interface BloggerDraftApprovalSnapshot {
  snapshotVersion: typeof BLOGGER_DRAFT_APPROVAL_SNAPSHOT_VERSION;
  contentItemId: string;
  draftHtmlHash: string;
  titleCandidate: string;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  targetBloggerBlogVerifiedAt: string;
  labelsCandidate: string[];
  htmlLength: number;
  htmlSafetySummary: BloggerDraftPayloadPreview["htmlSafetySummary"];
  contentReady: boolean;
  bloggerConnectionReady: boolean;
  selectedBlogReady: boolean;
  draftPayloadReady: boolean;
  blockingIssues: string[];
  warnings: string[];
  qualityGrade: "pass" | "warn" | "fail";
  qualityScorePreview: number;
  qualityRequiredFailCount: number;
}

export interface BloggerDraftApprovalSnapshotHashes {
  snapshot: BloggerDraftApprovalSnapshot;
  snapshotHash: string;
  draftHtmlHash: string;
}

export function hashDraftHtml(draftHtml: string | null | undefined) {
  return sha256(draftHtml ?? "");
}

export function buildBloggerDraftApprovalSnapshot(preview: BloggerDraftPayloadPreview, draftHtml: string | null | undefined): BloggerDraftApprovalSnapshot | null {
  if (!preview.titleCandidate || !preview.targetBlog?.id || !preview.targetBlog.verifiedAt) {
    return null;
  }

  const draftHtmlHash = hashDraftHtml(draftHtml);
  return {
    snapshotVersion: BLOGGER_DRAFT_APPROVAL_SNAPSHOT_VERSION,
    contentItemId: preview.contentItemId,
    draftHtmlHash,
    titleCandidate: preview.titleCandidate,
    targetBloggerBlogId: preview.targetBlog.id,
    targetBloggerBlogName: preview.targetBlog.name,
    targetBloggerBlogUrl: preview.targetBlog.url,
    targetBloggerBlogVerifiedAt: preview.targetBlog.verifiedAt,
    labelsCandidate: preview.labelsCandidate,
    htmlLength: preview.htmlLength,
    htmlSafetySummary: preview.htmlSafetySummary,
    contentReady: preview.contentReady,
    bloggerConnectionReady: preview.bloggerConnectionReady,
    selectedBlogReady: preview.selectedBlogReady,
    draftPayloadReady: preview.draftPayloadReady,
    blockingIssues: preview.blockingIssues,
    warnings: preview.warnings,
    qualityGrade: preview.htmlSafetySummary.qualityGrade,
    qualityScorePreview: preview.htmlSafetySummary.qualityScorePreview,
    qualityRequiredFailCount: preview.htmlSafetySummary.qualityRequiredFailCount
  };
}

export function buildBloggerDraftApprovalSnapshotHashes(
  preview: BloggerDraftPayloadPreview,
  draftHtml: string | null | undefined
): BloggerDraftApprovalSnapshotHashes | null {
  const snapshot = buildBloggerDraftApprovalSnapshot(preview, draftHtml);
  if (!snapshot) {
    return null;
  }

  return {
    snapshot,
    snapshotHash: hashBloggerDraftApprovalSnapshot(snapshot),
    draftHtmlHash: snapshot.draftHtmlHash
  };
}

export function hashBloggerDraftApprovalSnapshot(snapshot: BloggerDraftApprovalSnapshot) {
  return sha256(stableStringify(snapshot));
}

export function buildBloggerDraftApprovalReadinessSummary(snapshot: BloggerDraftApprovalSnapshot) {
  return {
    snapshotVersion: snapshot.snapshotVersion,
    contentItemId: snapshot.contentItemId,
    titleCandidate: snapshot.titleCandidate,
    targetBloggerBlogId: snapshot.targetBloggerBlogId,
    targetBloggerBlogName: snapshot.targetBloggerBlogName,
    targetBloggerBlogUrl: snapshot.targetBloggerBlogUrl,
    targetBloggerBlogVerifiedAt: snapshot.targetBloggerBlogVerifiedAt,
    labelsCandidate: snapshot.labelsCandidate,
    htmlLength: snapshot.htmlLength,
    htmlSafetySummary: snapshot.htmlSafetySummary,
    contentReady: snapshot.contentReady,
    bloggerConnectionReady: snapshot.bloggerConnectionReady,
    selectedBlogReady: snapshot.selectedBlogReady,
    draftPayloadReady: snapshot.draftPayloadReady,
    blockingIssues: snapshot.blockingIssues,
    warnings: snapshot.warnings,
    qualityGrade: snapshot.qualityGrade,
    qualityScorePreview: snapshot.qualityScorePreview,
    qualityRequiredFailCount: snapshot.qualityRequiredFailCount
  };
}

export function buildBloggerDraftApprovalSummary(input: {
  approval: BloggerDraftApprovalAdmin | null;
  approvalSnapshotHash?: string | null;
  currentSnapshotHash: string | null;
  currentDraftHtmlHash: string | null;
  currentPreviewReady: boolean;
}): BloggerDraftApprovalSummary {
  const matches = Boolean(input.approval && input.currentSnapshotHash && input.approvalSnapshotHash === input.currentSnapshotHash);
  const approvalStatus = getApprovalStatus(input.approval, input.currentSnapshotHash, input.currentPreviewReady, matches);

  return {
    approvalStatus,
    approval: input.approval,
    approvalMatchesCurrentPreview: matches,
    currentSnapshotHashPrefix: input.currentSnapshotHash ? hashPrefix(input.currentSnapshotHash) : null,
    currentDraftHtmlHashPrefix: input.currentDraftHtmlHash ? hashPrefix(input.currentDraftHtmlHash) : null,
    manualApprovalImplemented: true,
    draftSaveImplemented: false
  };
}

export function hashPrefix(value: string | null | undefined) {
  return value ? value.slice(0, HASH_PREFIX_LENGTH) : "";
}

function getApprovalStatus(
  approval: BloggerDraftApprovalAdmin | null,
  currentSnapshotHash: string | null,
  currentPreviewReady: boolean,
  matches: boolean
): BloggerDraftApprovalSummary["approvalStatus"] {
  if (!approval) {
    return currentPreviewReady ? "missing" : "not_ready";
  }
  if (approval.status === "revoked") {
    return "revoked";
  }
  if (approval.status === "superseded") {
    return currentPreviewReady ? "missing" : "not_ready";
  }
  if (!currentPreviewReady || !currentSnapshotHash) {
    return "not_ready";
  }
  return matches ? "approved" : "stale";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
