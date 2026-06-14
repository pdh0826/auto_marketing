import type { BloggerDraftPayloadPreview } from "@/lib/blogger/admin-types";
import type { SafeBloggerConnection } from "@/lib/db/blogger-connections";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildBloggerDraftApprovalSummary } from "@/lib/blogger/draft-approval";
import { buildPublishReadiness } from "@/lib/content/publish-readiness";
import { validateHtmlCandidate } from "@/lib/content/html-preview";

const HTML_SNIPPET_LIMIT = 800;
const LABEL_LIMIT = 10;
const LABEL_MAX_LENGTH = 80;
const BLOGGER_SELECTION_OLD_DAYS = 30;

export function buildBloggerDraftPayloadPreview(
  contentItem: ContentItemAdmin,
  assets: ContentAssetAdmin[],
  bloggerConnections: SafeBloggerConnection[]
): BloggerDraftPayloadPreview {
  const connection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
  const publishReadiness = buildPublishReadiness(contentItem, assets, connection);
  const html = contentItem.draftHtml ?? "";
  const htmlValidation = validateHtmlCandidate(html, assets);
  const titleCandidate = buildTitleCandidate(contentItem);
  const labelsCandidate = buildLabelsCandidate(contentItem);
  const bloggerConnectionReady = connection?.status === "connected";
  const verifiedAt = normalizeDateString(connection?.bloggerBlogVerifiedAt ?? null);
  const selectedBlogReady = bloggerConnectionReady && Boolean(connection?.bloggerBlogId && verifiedAt);
  const blockingIssues = buildBlockingIssues({
    contentItem,
    bloggerConnections,
    bloggerConnectionReady,
    selectedBlogReady,
    titleCandidate,
    htmlValidationOk: htmlValidation.validation.ok,
    contentReady: publishReadiness.contentReady,
    qualityRequiredFailCount: publishReadiness.metadata.qualityRequiredFailCount
  });
  const warnings = buildWarnings({
    htmlLength: html.length,
    labelsCandidate,
    verifiedAt,
    publishReadinessWarnings: publishReadiness.warnings.map((warning) => warning.key)
  });
  const draftPayloadReady =
    bloggerConnectionReady &&
    selectedBlogReady &&
    Boolean(html.trim()) &&
    Boolean(titleCandidate) &&
    htmlValidation.validation.ok &&
    publishReadiness.contentReady &&
    publishReadiness.metadata.qualityRequiredFailCount === 0 &&
    blockingIssues.length === 0;

  return {
    contentItemId: contentItem.id,
    targetBlog:
      connection?.bloggerBlogId && verifiedAt
        ? {
            id: connection.bloggerBlogId,
            name: connection.bloggerBlogName,
            url: connection.bloggerBlogUrl,
            verifiedAt
          }
        : null,
    titleCandidate,
    htmlLength: html.length,
    htmlSnippet: html.trim() ? html.trim().slice(0, HTML_SNIPPET_LIMIT) : null,
    htmlSafetySummary: {
      validationOk: htmlValidation.validation.ok,
      issueCount: htmlValidation.validation.errors.length,
      warningCount: htmlValidation.validation.warnings.length,
      qualityGrade: publishReadiness.metadata.qualityGrade,
      qualityScorePreview: publishReadiness.metadata.qualityScorePreview,
      qualityRequiredFailCount: publishReadiness.metadata.qualityRequiredFailCount
    },
    labelsCandidate,
    contentReady: publishReadiness.contentReady,
    bloggerConnectionReady,
    selectedBlogReady,
    draftPayloadReady,
    blockingIssues,
    warnings,
    approvalSummary: buildBloggerDraftApprovalSummary({
      approval: null,
      currentSnapshotHash: null,
      currentDraftHtmlHash: null,
      currentPreviewReady: draftPayloadReady
    }),
    draftSaveSummary: {
      latestSuccessfulDraftSave: null,
      latestDraftSave: null,
      draftSaved: false,
      draftSaveImplemented: true,
      publishImplemented: false,
      scheduledPublishImplemented: false,
      tokenRefreshImplemented: false
    },
    bloggerApiWriteImplemented: true,
    bloggerApiReadImplemented: false,
    draftSaveImplemented: true,
    publishImplemented: false,
    tokenRefreshImplemented: false
  };
}

function buildBlockingIssues({
  contentItem,
  bloggerConnections,
  bloggerConnectionReady,
  selectedBlogReady,
  titleCandidate,
  htmlValidationOk,
  contentReady,
  qualityRequiredFailCount
}: {
  contentItem: ContentItemAdmin;
  bloggerConnections: SafeBloggerConnection[];
  bloggerConnectionReady: boolean;
  selectedBlogReady: boolean;
  titleCandidate: string | null;
  htmlValidationOk: boolean;
  contentReady: boolean;
  qualityRequiredFailCount: number;
}) {
  const issues: string[] = [];

  if (!contentItem.blogId) {
    issues.push("blog_profile_missing");
  }
  if (bloggerConnections.length > 1) {
    issues.push("blogger_connection_ambiguous");
  }
  if (bloggerConnections.length === 0) {
    issues.push("blogger_connection_not_configured");
  }
  if (bloggerConnections.length === 1 && !bloggerConnectionReady) {
    issues.push("blogger_connection_not_connected");
  }
  if (bloggerConnectionReady && !selectedBlogReady) {
    issues.push("blogger_blog_not_verified");
  }
  if (!contentItem.draftHtml?.trim()) {
    issues.push("draft_html_missing");
  }
  if (contentItem.draftHtml?.trim() && !htmlValidationOk) {
    issues.push("draft_html_validation_failed");
  }
  if (!titleCandidate) {
    issues.push("title_candidate_missing");
  }
  if (qualityRequiredFailCount > 0) {
    issues.push("quality_required_checks_failed");
  }
  if (!contentReady) {
    issues.push("content_readiness_not_passed");
  }

  return Array.from(new Set(issues));
}

function buildWarnings({
  htmlLength,
  labelsCandidate,
  verifiedAt,
  publishReadinessWarnings
}: {
  htmlLength: number;
  labelsCandidate: string[];
  verifiedAt: string | null;
  publishReadinessWarnings: string[];
}) {
  const warnings = [...publishReadinessWarnings];

  if (verifiedAt && isOlderThanDays(verifiedAt, BLOGGER_SELECTION_OLD_DAYS)) {
    warnings.push("blogger_blog_selection_old");
  }
  if (labelsCandidate.length === 0) {
    warnings.push("labels_candidate_empty");
  }
  if (htmlLength > 0 && htmlLength < 600) {
    warnings.push("html_too_short");
  }
  if (htmlLength > 120000) {
    warnings.push("html_too_long");
  }

  return Array.from(new Set(warnings));
}

function buildTitleCandidate(contentItem: ContentItemAdmin) {
  const plan = asRecord(contentItem.planJson);
  const titleFromPlan =
    firstString(plan?.titleCandidates) ??
    firstString(plan?.title) ??
    firstString(plan?.headline) ??
    firstString(plan?.h1) ??
    firstString(plan?.articleTitle);

  return normalizeText(titleFromPlan ?? contentItem.title ?? contentItem.targetKeyword ?? firstMemoLine(contentItem.sourceMemo), 140);
}

function buildLabelsCandidate(contentItem: ContentItemAdmin) {
  const plan = asRecord(contentItem.planJson);
  const values = [
    contentItem.targetKeyword,
    contentItem.blog?.mainTopic,
    ...(contentItem.blog?.subTopics ?? []),
    contentItem.brandProfile?.name,
    contentItem.brandProfile?.serviceName,
    plan?.targetKeyword,
    plan?.topic,
    plan?.subtopic,
    plan?.category,
    plan?.labels,
    plan?.tags,
    plan?.keywords
  ];

  const labels = values
    .flatMap(flattenStrings)
    .map((value) => normalizeText(value, LABEL_MAX_LENGTH))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(labels)).slice(0, LABEL_LIMIT);
}

function normalizeDateString(value: Date | string | null) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isOlderThanDays(value: string, days: number) {
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    return false;
  }
  return Date.now() - parsed > days * 24 * 60 * 60 * 1000;
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = firstString(entry);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }
  const record = asRecord(value);
  if (record) {
    return firstString(record.title) ?? firstString(record.headline) ?? firstString(record.name);
  }
  return null;
}

function flattenStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenStrings);
  }
  const record = asRecord(value);
  if (record) {
    return [record.title, record.name, record.label, record.keyword].flatMap(flattenStrings);
  }
  return [];
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, maxLength);
}

function firstMemoLine(value: string | null) {
  return value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}
