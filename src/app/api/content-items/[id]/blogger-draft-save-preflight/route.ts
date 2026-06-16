import { NextResponse } from "next/server";
import type { BloggerDraftSavePreflight } from "@/lib/blogger/admin-types";
import { buildBloggerDraftApprovalSnapshotHashes, buildBloggerDraftApprovalSummary, hashDraftHtml, hashPrefix } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftPayloadPreview } from "@/lib/blogger/draft-payload-preview";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { validateHtmlCandidate } from "@/lib/content/html-preview";
import { buildPublishReadiness } from "@/lib/content/publish-readiness";
import { getActiveBloggerDraftApproval, getLatestBloggerDraftApproval, toBloggerDraftApprovalAdmin } from "@/lib/db/blogger-draft-approvals";
import { getBloggerConnectionSecretStatus } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getSuccessfulBloggerDraftSaveByApproval } from "@/lib/db/blogger-draft-saves";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

const CLIENT_SECRET_ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const contentItem = await prisma.contentItem.findUnique({
      where: { id: params.id },
      include: {
        blog: true,
        brandProfile: true,
        assets: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const safeContentItem = contentItem as unknown as ContentItemAdmin;
    const assets = contentItem.assets as unknown as ContentAssetAdmin[];
    const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
    const connection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
    const secretStatus = connection ? await getBloggerConnectionSecretStatus(connection.id) : null;
    const htmlValidation = validateHtmlCandidate(safeContentItem.draftHtml ?? "", assets);
    const payloadPreview = buildBloggerDraftPayloadPreview(safeContentItem, assets, bloggerConnections);
    const currentHashes = buildBloggerDraftApprovalSnapshotHashes(payloadPreview, safeContentItem.draftHtml);
    const activeApproval = await getActiveBloggerDraftApproval(safeContentItem.id);
    const latestApproval = activeApproval ?? (await getLatestBloggerDraftApproval(safeContentItem.id));
    const successfulSaveForCurrentApproval = activeApproval ? await getSuccessfulBloggerDraftSaveByApproval(activeApproval.id) : null;
    const approvalSummary = buildBloggerDraftApprovalSummary({
      approval: latestApproval ? toBloggerDraftApprovalAdmin(latestApproval) : null,
      approvalSnapshotHash: latestApproval?.snapshotHash ?? null,
      currentSnapshotHash: currentHashes?.snapshotHash ?? null,
      currentDraftHtmlHash: currentHashes?.draftHtmlHash ?? null,
      currentPreviewReady: payloadPreview.draftPayloadReady
    });
    const publishReadiness = buildPublishReadiness(
      safeContentItem,
      assets,
      connection,
      {
        status: approvalSummary.approvalStatus,
        snapshotHashPrefix: approvalSummary.approval?.snapshotHashPrefix ?? null,
        matchesCurrentPreview: approvalSummary.approvalMatchesCurrentPreview,
        approvedAt: approvalSummary.approval?.approvedAt ?? null
      },
      null
    );
    const clientSecretDiagnostic = buildClientSecretDiagnostic(connection?.clientSecretRef ?? null, secretStatus?.hasClientSecret ?? false);
    const accessTokenExpired = isExpired(secretStatus?.accessTokenExpiresAt ?? null);

    const blockingReasons = buildBlockingReasons({
      hasDraftHtml: Boolean(safeContentItem.draftHtml?.trim()),
      htmlValidationOk: htmlValidation.validation.ok,
      bloggerConnectionCount: bloggerConnections.length,
      connectionStatus: connection?.status ?? "not_configured",
      hasSelectedBlog: Boolean(connection?.bloggerBlogId && connection.bloggerBlogVerifiedAt),
      hasClientSecret: clientSecretDiagnostic.clientSecretConfigured,
      hasAccessToken: Boolean(secretStatus?.hasAccessToken),
      accessTokenExpired,
      payloadReady: payloadPreview.draftPayloadReady,
      approvalStatus: approvalSummary.approvalStatus,
      approvalMatchesCurrentPreview: approvalSummary.approvalMatchesCurrentPreview,
      successfulSaveForCurrentApproval: Boolean(successfulSaveForCurrentApproval),
      contentReady: publishReadiness.contentReady,
      readinessBlockingKeys: publishReadiness.blockingIssues.map((issue) => issue.key),
      payloadBlockingIssues: payloadPreview.blockingIssues
    });
    const warnings = Array.from(
      new Set([
        ...payloadPreview.warnings,
        ...publishReadiness.warnings.map((warning) => warning.key),
        ...(approvalSummary.approvalStatus === "stale" ? ["blogger_draft_approval_stale"] : [])
      ])
    );
    const canSaveDraft = blockingReasons.length === 0;
    const htmlHash = hashDraftHtml(safeContentItem.draftHtml);
    const result: BloggerDraftSavePreflight = {
      ok: canSaveDraft,
      canSaveDraft,
      blockingReasons,
      warnings,
      htmlHash,
      htmlHashPrefix: hashPrefix(htmlHash),
      htmlLength: safeContentItem.draftHtml?.length ?? 0,
      htmlValidation: {
        ok: htmlValidation.validation.ok,
        errorCount: htmlValidation.validation.errors.length,
        warningCount: htmlValidation.validation.warnings.length,
        unsafePatternCount: htmlValidation.metadata.unsafePatternCount
      },
      qualitySummary: {
        grade: publishReadiness.metadata.qualityGrade,
        scorePreview: publishReadiness.metadata.qualityScorePreview,
        requiredFailCount: publishReadiness.metadata.qualityRequiredFailCount,
        contentReady: publishReadiness.contentReady
      },
      publishReadinessSummary: {
        ready: publishReadiness.ready,
        contentReady: publishReadiness.contentReady,
        publishReady: publishReadiness.publishReady,
        stage: publishReadiness.stage,
        blockingIssueCount: publishReadiness.blockingIssues.length,
        warningCount: publishReadiness.warnings.length
      },
      selectedBlogSummary: {
        selected: Boolean(connection?.bloggerBlogId && connection.bloggerBlogVerifiedAt),
        id: connection?.bloggerBlogId ?? null,
        name: connection?.bloggerBlogName ?? null,
        url: connection?.bloggerBlogUrl ?? null,
        verifiedAt: formatOptionalDate(connection?.bloggerBlogVerifiedAt ?? null)
      },
      bloggerConnectionSummary: {
        connectionCount: bloggerConnections.length,
        status: connection?.status ?? "not_configured",
        connectionId: connection?.id ?? null,
        connectedEmail: connection?.connectedEmail ?? null,
        hasClientSecretRef: clientSecretDiagnostic.hasClientSecretRef,
        clientSecretConfigured: clientSecretDiagnostic.clientSecretConfigured,
        encryptedClientSecretStored: clientSecretDiagnostic.encryptedClientSecretStored,
        hasClientSecret: clientSecretDiagnostic.clientSecretConfigured,
        hasAccessToken: Boolean(secretStatus?.hasAccessToken),
        hasRefreshToken: Boolean(secretStatus?.hasRefreshToken),
        accessTokenExpiresAt: secretStatus?.accessTokenExpiresAt ?? null,
        accessTokenExpired,
        tokenRefreshImplemented: false,
        secretMaterialReturned: false
      },
      approvalSnapshotStatus: {
        status: approvalSummary.approvalStatus,
        approvalId: approvalSummary.approval?.id ?? null,
        approvalMatchesCurrentPreview: approvalSummary.approvalMatchesCurrentPreview,
        currentSnapshotHashPrefix: approvalSummary.currentSnapshotHashPrefix,
        currentDraftHtmlHashPrefix: approvalSummary.currentDraftHtmlHashPrefix,
        approvedAt: approvalSummary.approval?.approvedAt ?? null,
        stale: approvalSummary.approvalStatus === "stale",
        requiresReapproval: approvalSummary.approvalStatus !== "approved"
      },
      draftPayloadPreviewSummary: {
        draftPayloadReady: payloadPreview.draftPayloadReady,
        blockingIssues: payloadPreview.blockingIssues,
        warnings: payloadPreview.warnings,
        titleCandidate: payloadPreview.titleCandidate
      },
      draftSavePreflightSummary: {
        draftNotSavedYetExpected: !successfulSaveForCurrentApproval,
        successfulSaveForCurrentApproval: Boolean(successfulSaveForCurrentApproval),
        duplicateSaveBlocked: Boolean(successfulSaveForCurrentApproval)
      },
      sideEffectSummary: {
        bloggerApiWrite: false,
        bloggerDraftSave: false,
        publish: false,
        scheduledPublish: false,
        tokenRefresh: false,
        llmCall: false,
        contentItemMutation: false
      }
    };

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger draft save preflight failed.", 500) }, { status: 400 });
  }
}

function formatOptionalDate(value: Date | string | null) {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function buildClientSecretDiagnostic(clientSecretRef: string | null, encryptedClientSecretStored: boolean) {
  const ref = clientSecretRef?.trim() ?? "";
  const hasClientSecretRef = Boolean(ref);
  const clientSecretRefIsSafeEnvKey = hasClientSecretRef && CLIENT_SECRET_ENV_KEY_PATTERN.test(ref);
  const envClientSecretConfigured = clientSecretRefIsSafeEnvKey ? Boolean(process.env[ref]?.trim()) : false;

  return {
    hasClientSecretRef,
    clientSecretConfigured: encryptedClientSecretStored || envClientSecretConfigured,
    encryptedClientSecretStored,
    clientSecretRefIsSafeEnvKey,
    envClientSecretConfigured
  };
}

function isExpired(value: string | null) {
  if (!value) {
    return false;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}

function buildBlockingReasons(input: {
  hasDraftHtml: boolean;
  htmlValidationOk: boolean;
  bloggerConnectionCount: number;
  connectionStatus: string;
  hasSelectedBlog: boolean;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  accessTokenExpired: boolean;
  payloadReady: boolean;
  approvalStatus: string;
  approvalMatchesCurrentPreview: boolean;
  successfulSaveForCurrentApproval: boolean;
  contentReady: boolean;
  readinessBlockingKeys: string[];
  payloadBlockingIssues: string[];
}) {
  const reasons: string[] = [];

  if (!input.hasDraftHtml) {
    reasons.push("draft_html_missing");
  }
  if (input.hasDraftHtml && !input.htmlValidationOk) {
    reasons.push("draft_html_validation_failed");
  }
  if (input.bloggerConnectionCount === 0) {
    reasons.push("blogger_connection_not_configured");
  }
  if (input.bloggerConnectionCount > 1) {
    reasons.push("blogger_connection_ambiguous");
  }
  if (input.bloggerConnectionCount === 1 && input.connectionStatus !== "connected") {
    reasons.push("blogger_connection_not_connected");
  }
  if (input.bloggerConnectionCount === 1 && !input.hasClientSecret) {
    reasons.push("blogger_client_secret_missing");
  }
  if (input.bloggerConnectionCount === 1 && !input.hasAccessToken) {
    reasons.push("blogger_access_token_missing");
  }
  if (input.bloggerConnectionCount === 1 && input.hasAccessToken && input.accessTokenExpired) {
    reasons.push("access_token_expired_reauth_required");
  }
  if (input.bloggerConnectionCount === 1 && !input.hasSelectedBlog) {
    reasons.push("blogger_blog_not_verified");
  }
  if (!input.contentReady) {
    reasons.push("content_readiness_not_passed");
  }
  if (!input.payloadReady) {
    reasons.push("draft_payload_not_ready");
  }
  if (input.approvalStatus !== "approved" || !input.approvalMatchesCurrentPreview) {
    reasons.push(input.approvalStatus === "stale" ? "blogger_draft_approval_stale" : "blogger_draft_approval_required");
  }
  if (input.successfulSaveForCurrentApproval) {
    reasons.push("blogger_draft_already_saved_for_approval");
  }

  const draftSavePreflightReadinessKeys = input.readinessBlockingKeys.filter((key) => key !== "blogger_draft_saved");
  return Array.from(new Set([...reasons, ...draftSavePreflightReadinessKeys, ...input.payloadBlockingIssues]));
}
