import { NextResponse } from "next/server";
import { deleteExistingBloggerPost } from "@/lib/blogger/delete-post";
import { decryptBloggerSecret, isBloggerSecretEncryptionConfigured } from "@/lib/blogger/secrets";
import { refreshBloggerAccessTokenForConnection } from "@/lib/blogger/token-refresh";
import { getEncryptedBloggerConnectionSecret } from "@/lib/db/blogger-connection-secrets";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getLatestSuccessfulBloggerDraftSave } from "@/lib/db/blogger-draft-saves";
import { findLatestBloggerPublishApprovalForContentItem } from "@/lib/db/blogger-publish-approvals";
import { findLatestBloggerPublishExecutionAttemptForContentItem } from "@/lib/db/blogger-publish-execution-attempts";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

const CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_WILL_DELETE_BLOGGER_POST";

interface RouteContext {
  params: {
    id: string;
  };
}

interface DeleteRequest {
  expectedBloggerBlogId?: unknown;
  expectedBloggerPostId?: unknown;
  confirmDeleteBloggerPost?: unknown;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as DeleteRequest;
    const expectedBloggerBlogId = getString(body.expectedBloggerBlogId);
    const expectedBloggerPostId = getString(body.expectedBloggerPostId);
    const confirmationAccepted = body.confirmDeleteBloggerPost === CONFIRMATION_PHRASE;
    const blockers = new Set<string>();

    if (!confirmationAccepted) blockers.add("delete_confirmation_missing");
    if (!expectedBloggerBlogId) blockers.add("expected_blogger_blog_id_required");
    if (!expectedBloggerPostId) blockers.add("expected_blogger_post_id_required");

    const contentItem = await prisma.contentItem.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        blogId: true
      }
    });
    if (!contentItem) {
      return NextResponse.json({ error: "content_item_not_found" }, { status: 404 });
    }

    const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
    const bloggerConnection = bloggerConnections.length === 1 ? bloggerConnections[0] : null;
    const [latestApproval, latestAttempt, latestDraftSave] = await Promise.all([
      findLatestBloggerPublishApprovalForContentItem(contentItem.id),
      findLatestBloggerPublishExecutionAttemptForContentItem(contentItem.id),
      getLatestSuccessfulBloggerDraftSave(contentItem.id)
    ]);
    const knownPostIds = new Set(
      [
        latestApproval?.bloggerPostId,
        latestAttempt?.bloggerPostId,
        latestDraftSave?.bloggerPostId
      ].filter((value): value is string => Boolean(value))
    );

    if (!bloggerConnection) blockers.add("single_blogger_connection_required");
    if (expectedBloggerBlogId && bloggerConnection?.bloggerBlogId !== expectedBloggerBlogId) blockers.add("target_blog_mismatch");
    if (expectedBloggerPostId && !knownPostIds.has(expectedBloggerPostId)) blockers.add("blogger_post_id_not_linked_to_content_item");

    if (blockers.size > 0) {
      return NextResponse.json(
        {
          error: "blogger_delete_blocked",
          blockingReasons: Array.from(blockers),
          sideEffectSummary: buildSideEffectSummary(false, false, false)
        },
        { status: 400 }
      );
    }

    const accessToken = await getUsableAccessTokenForDelete(bloggerConnection!.id);
    if (!accessToken.ok) {
      return NextResponse.json(
        {
          error: accessToken.errorCode,
          message: accessToken.errorMessageRedacted,
          sideEffectSummary: buildSideEffectSummary(accessToken.tokenRefreshAttempted, accessToken.tokenRefreshDbWrite, false)
        },
        { status: 400 }
      );
    }

    const result = await deleteExistingBloggerPost({
      accessToken: accessToken.value,
      bloggerBlogId: expectedBloggerBlogId!,
      bloggerPostId: expectedBloggerPostId!
    });

    return NextResponse.json({
      data: {
        contentItemId: contentItem.id,
        bloggerDeleteSummary: {
          attempted: true,
          ok: result.ok,
          status: result.status,
          bloggerBlogId: expectedBloggerBlogId,
          bloggerPostId: result.bloggerPostId,
          retryable: result.retryable,
          errorCode: result.errorCode ?? null,
          errorMessageRedacted: result.errorMessageRedacted ?? null,
          rawResponseReturned: false
        },
        sideEffectSummary: buildSideEffectSummary(accessToken.tokenRefreshAttempted, accessToken.tokenRefreshDbWrite, result.ok)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blogger post delete failed.", 500) }, { status: 400 });
  }
}

async function getUsableAccessTokenForDelete(
  connectionId: string
): Promise<
  | { ok: true; value: string; tokenRefreshAttempted: boolean; tokenRefreshDbWrite: boolean }
  | { ok: false; errorCode: string; errorMessageRedacted: string; tokenRefreshAttempted: boolean; tokenRefreshDbWrite: boolean }
> {
  let tokenRefreshAttempted = false;
  let tokenRefreshDbWrite = false;
  let accessTokenSecret = await getEncryptedBloggerConnectionSecret(connectionId, "access_token");

  if (!accessTokenSecret || (accessTokenSecret.expiresAt && accessTokenSecret.expiresAt.getTime() <= Date.now())) {
    tokenRefreshAttempted = true;
    const refresh = await refreshBloggerAccessTokenForConnection({
      connectionId,
      reason: "guarded_publish_execution",
      force: false
    });
    tokenRefreshDbWrite = refresh.sideEffectSummary.dbWrite;
    if (!refresh.refreshOk) {
      return {
        ok: false,
        errorCode: "access_token_refresh_blocked",
        errorMessageRedacted: "Blogger access token refresh did not complete before delete.",
        tokenRefreshAttempted,
        tokenRefreshDbWrite
      };
    }
    accessTokenSecret = await getEncryptedBloggerConnectionSecret(connectionId, "access_token");
  }

  if (!accessTokenSecret || (accessTokenSecret.expiresAt && accessTokenSecret.expiresAt.getTime() <= Date.now())) {
    return {
      ok: false,
      errorCode: "access_token_missing_or_expired",
      errorMessageRedacted: "Blogger access token is missing or expired before delete.",
      tokenRefreshAttempted,
      tokenRefreshDbWrite
    };
  }
  if (!isBloggerSecretEncryptionConfigured()) {
    return {
      ok: false,
      errorCode: "blogger_secret_key_not_configured",
      errorMessageRedacted: "Blogger secret encryption key is not configured.",
      tokenRefreshAttempted,
      tokenRefreshDbWrite
    };
  }

  try {
    return {
      ok: true,
      value: decryptBloggerSecret(accessTokenSecret.encryptedValue),
      tokenRefreshAttempted,
      tokenRefreshDbWrite
    };
  } catch {
    return {
      ok: false,
      errorCode: "token_decryption_failed",
      errorMessageRedacted: "Stored Blogger access token could not be decrypted.",
      tokenRefreshAttempted,
      tokenRefreshDbWrite
    };
  }
}

function buildSideEffectSummary(tokenRefresh: boolean, tokenRefreshDbWrite: boolean, bloggerDelete: boolean) {
  return {
    dbRead: true,
    dbWrite: tokenRefreshDbWrite,
    bloggerRead: false,
    bloggerWrite: bloggerDelete,
    bloggerDelete,
    bloggerPublish: false,
    bloggerDraftSave: false,
    bloggerUpdate: false,
    tokenRefresh,
    oauthReconnect: false,
    contentMutation: false,
    llmCall: false,
    rawResponseReturned: false
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
