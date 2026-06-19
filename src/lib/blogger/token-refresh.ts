import type { BloggerConnectionStatus } from "@prisma/client";
import type {
  BloggerTokenRefreshAccessTokenState,
  BloggerTokenRefreshReason,
  BloggerTokenRefreshSummary
} from "@/lib/blogger/admin-types";
import { decryptBloggerSecret, encryptBloggerSecret, getBloggerSecretLast4, isBloggerSecretEncryptionConfigured, safeBloggerSecretError } from "@/lib/blogger/secrets";
import { getBloggerConnection, updateBloggerConnectionOAuthStatus } from "@/lib/db/blogger-connections";
import {
  getBloggerConnectionSecretStatus,
  getEncryptedBloggerConnectionSecret,
  upsertEncryptedBloggerConnectionSecret
} from "@/lib/db/blogger-connection-secrets";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLIENT_SECRET_ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const GOOGLE_TOKEN_REFRESH_TIMEOUT_MS = 15000;

interface GoogleRefreshTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  scope?: unknown;
  error?: unknown;
}

export async function refreshBloggerAccessTokenForConnection(input: {
  connectionId: string;
  reason: BloggerTokenRefreshReason;
  force?: boolean;
}): Promise<BloggerTokenRefreshSummary> {
  const warnings = new Set<string>();
  const blockingReasons = new Set<string>();
  const connection = await getBloggerConnection(input.connectionId);
  const secretStatus = connection ? await getBloggerConnectionSecretStatus(input.connectionId) : null;
  const oldAccessTokenState = getAccessTokenState(secretStatus?.hasAccessToken ?? false, secretStatus?.accessTokenExpiresAt ?? null);
  const hasClientSecretRef = Boolean(connection?.clientSecretRef);
  const clientSecretConfigured = Boolean(connection?.clientSecretRef && CLIENT_SECRET_ENV_KEY_PATTERN.test(connection.clientSecretRef) && process.env[connection.clientSecretRef]?.trim());
  const hasRefreshToken = Boolean(secretStatus?.hasRefreshToken);
  let refreshAttempted = false;
  let accessTokenUpdated = false;
  let refreshTokenUpdated = false;
  let dbWrite = false;
  let googleTokenEndpointCall = false;
  let expiresAt: string | null = secretStatus?.accessTokenExpiresAt ?? null;
  let tokenLast4: string | null = secretStatus?.tokenLast4 ?? null;
  let newAccessTokenState = oldAccessTokenState;

  if (!connection) {
    blockingReasons.add("blogger_connection_not_found");
  }
  if (!hasRefreshToken) {
    blockingReasons.add("refresh_token_missing");
  }
  if (!hasClientSecretRef) {
    blockingReasons.add("client_secret_ref_missing");
  }
  if (connection?.clientSecretRef && !CLIENT_SECRET_ENV_KEY_PATTERN.test(connection.clientSecretRef)) {
    blockingReasons.add("client_secret_ref_invalid");
  }
  if (hasClientSecretRef && !clientSecretConfigured) {
    blockingReasons.add("client_secret_env_missing");
  }
  if (!connection?.oauthClientIdRef?.trim()) {
    blockingReasons.add("oauth_client_id_missing");
  }
  if (!isBloggerSecretEncryptionConfigured()) {
    blockingReasons.add("blogger_secret_key_not_configured");
  }
  if (oldAccessTokenState === "valid" && !input.force) {
    blockingReasons.add("token_refresh_not_attempted_access_token_still_valid");
    warnings.add("access_token_already_valid");
  }

  if (blockingReasons.size === 0 && connection) {
    refreshAttempted = true;
    googleTokenEndpointCall = true;
    try {
      const refreshTokenSecret = await getEncryptedBloggerConnectionSecret(input.connectionId, "refresh_token");
      if (!refreshTokenSecret) {
        blockingReasons.add("refresh_token_missing");
      } else {
        const refreshToken = decryptBloggerSecret(refreshTokenSecret.encryptedValue);
        const tokenResponse = await requestGoogleRefreshToken({
          clientId: connection.oauthClientIdRef?.trim() ?? "",
          clientSecret: process.env[connection.clientSecretRef ?? ""]?.trim() ?? "",
          refreshToken
        });
        const persisted = await persistRefreshTokenResponse({
          connectionId: input.connectionId,
          tokenResponse,
          fallbackScopes: secretStatus?.scopes ?? []
        });
        accessTokenUpdated = persisted.accessTokenUpdated;
        refreshTokenUpdated = persisted.refreshTokenUpdated;
        dbWrite = true;
        expiresAt = persisted.expiresAt;
        tokenLast4 = persisted.tokenLast4;
        newAccessTokenState = persisted.expiresAt ? getAccessTokenState(true, persisted.expiresAt) : "valid";
        await updateBloggerConnectionOAuthStatus(input.connectionId, {
          status: "connected",
          lastError: null,
          lastTestedAt: new Date(),
          scopes: persisted.scopes
        });
      }
    } catch (caught) {
      const failure = toRefreshFailure(caught);
      blockingReasons.add(failure.code);
      newAccessTokenState = oldAccessTokenState;
      if (failure.shouldUpdateConnection && connection) {
        dbWrite = true;
        await updateBloggerConnectionOAuthStatus(input.connectionId, {
          status: failure.connectionStatus,
          lastError: failure.message,
          lastTestedAt: new Date(),
          scopes: connection.scopes
        });
      }
    }
  }

  const refreshOk = refreshAttempted && accessTokenUpdated && blockingReasons.size === 0;
  return {
    checked: true,
    refreshAttempted,
    refreshOk,
    refreshBlocked: !refreshAttempted || !refreshOk,
    reason: input.reason,
    connectionId: input.connectionId,
    hasRefreshToken,
    hasClientSecretRef,
    clientSecretConfigured,
    oldAccessTokenState,
    newAccessTokenState,
    accessTokenUpdated,
    refreshTokenUpdated,
    expiresAt,
    tokenLast4,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings),
    sideEffectSummary: {
      dbRead: true,
      dbWrite,
      googleTokenEndpointCall,
      bloggerRead: false,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      bloggerDraftSave: false,
      oauthReconnect: false,
      contentMutation: false,
      approvalMutation: false,
      attemptMutation: false,
      llmCall: false,
      externalSend: googleTokenEndpointCall
    }
  };
}

async function requestGoogleRefreshToken(input: { clientId: string; clientSecret: string; refreshToken: string }) {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token"
  });

  let response: Response;
  try {
    response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body,
      signal: AbortSignal.timeout(GOOGLE_TOKEN_REFRESH_TIMEOUT_MS)
    });
  } catch {
    throw new BloggerTokenRefreshError("token_refresh_failed", "Google token refresh request failed before receiving a response.", "error");
  }

  const parsed = parseGoogleRefreshJson(await response.text());
  if (!response.ok) {
    const code = getRefreshErrorCode(parsed, response.status);
    throw new BloggerTokenRefreshError(code, summarizeGoogleRefreshError(code, response.status), getFailureStatus(code));
  }

  return parsed;
}

async function persistRefreshTokenResponse(input: { connectionId: string; tokenResponse: GoogleRefreshTokenResponse; fallbackScopes: string[] }) {
  const accessToken = typeof input.tokenResponse.access_token === "string" ? input.tokenResponse.access_token : null;
  if (!accessToken) {
    throw new BloggerTokenRefreshError("token_refresh_response_missing_access_token", "Google token refresh response did not include an access token.", "error");
  }

  const tokenType = typeof input.tokenResponse.token_type === "string" ? input.tokenResponse.token_type : "Bearer";
  const scopes = parseScopes(input.tokenResponse.scope, input.fallbackScopes);
  const accessTokenExpiresAt = getAccessTokenExpiresAt(input.tokenResponse.expires_in);
  const encryptedAccessToken = encryptBloggerSecret(accessToken);
  await upsertEncryptedBloggerConnectionSecret({
    connectionId: input.connectionId,
    secretKind: "access_token",
    encryptedValue: encryptedAccessToken.encryptedValue,
    keyVersion: encryptedAccessToken.keyVersion,
    rawValueForLast4: accessToken,
    tokenType,
    scopes,
    expiresAt: accessTokenExpiresAt
  });

  const refreshToken = typeof input.tokenResponse.refresh_token === "string" ? input.tokenResponse.refresh_token : null;
  let refreshTokenUpdated = false;
  if (refreshToken) {
    const encryptedRefreshToken = encryptBloggerSecret(refreshToken);
    await upsertEncryptedBloggerConnectionSecret({
      connectionId: input.connectionId,
      secretKind: "refresh_token",
      encryptedValue: encryptedRefreshToken.encryptedValue,
      keyVersion: encryptedRefreshToken.keyVersion,
      rawValueForLast4: refreshToken,
      tokenType: "refresh_token",
      scopes,
      expiresAt: null
    });
    refreshTokenUpdated = true;
  }

  return {
    accessTokenUpdated: true,
    refreshTokenUpdated,
    expiresAt: accessTokenExpiresAt?.toISOString() ?? null,
    tokenLast4: getBloggerSecretLast4(accessToken),
    scopes
  };
}

function parseGoogleRefreshJson(rawText: string): GoogleRefreshTokenResponse {
  if (!rawText.trim()) {
    return {};
  }
  try {
    return JSON.parse(rawText) as GoogleRefreshTokenResponse;
  } catch {
    return {};
  }
}

function getAccessTokenState(hasAccessToken: boolean, expiresAt: string | null): BloggerTokenRefreshAccessTokenState {
  if (!hasAccessToken) {
    return "missing";
  }
  if (!expiresAt) {
    return "unknown";
  }
  return new Date(expiresAt).getTime() <= Date.now() ? "expired_reauth_required" : "valid";
}

function parseScopes(value: unknown, fallback: string[]) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  return value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
}

function getAccessTokenExpiresAt(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(Date.now() + value * 1000);
}

function getRefreshErrorCode(parsed: GoogleRefreshTokenResponse, status: number) {
  const providerCode = typeof parsed.error === "string" ? parsed.error : "";
  if (providerCode === "invalid_grant") {
    return "token_refresh_invalid_grant_reconnect_required";
  }
  if (providerCode === "unauthorized_client") {
    return "token_refresh_unauthorized_client";
  }
  if (status === 401 || status === 403 || providerCode === "invalid_client") {
    return "token_refresh_unauthorized_client";
  }
  return "token_refresh_failed";
}

function summarizeGoogleRefreshError(code: string, status: number) {
  if (code === "token_refresh_invalid_grant_reconnect_required") {
    return "Google token refresh failed with invalid_grant. Manual OAuth reconnect is required.";
  }
  if (code === "token_refresh_unauthorized_client") {
    return "Google token refresh authentication failed. Check the server OAuth client configuration.";
  }
  return safeBloggerSecretError(`Google token refresh failed with HTTP ${status}.`);
}

function getFailureStatus(code: string): BloggerConnectionStatus {
  return code === "token_refresh_invalid_grant_reconnect_required" ? "oauth_required" : "error";
}

function toRefreshFailure(error: unknown) {
  if (error instanceof BloggerTokenRefreshError) {
    return {
      code: error.code,
      message: error.message,
      connectionStatus: error.connectionStatus,
      shouldUpdateConnection: true
    };
  }
  return {
    code: "token_refresh_failed",
    message: "Google token refresh failed.",
    connectionStatus: "error" as BloggerConnectionStatus,
    shouldUpdateConnection: true
  };
}

class BloggerTokenRefreshError extends Error {
  readonly code: string;
  readonly connectionStatus: BloggerConnectionStatus;

  constructor(code: string, message: string, connectionStatus: BloggerConnectionStatus) {
    super(safeBloggerSecretError(message));
    this.name = "BloggerTokenRefreshError";
    this.code = code;
    this.connectionStatus = connectionStatus;
  }
}
