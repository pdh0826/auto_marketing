import type { BloggerConnectionStatus } from "@prisma/client";
import { encryptBloggerSecret, isBloggerSecretEncryptionConfigured, safeBloggerSecretError } from "@/lib/blogger/secrets";
import { getBloggerConnection, updateBloggerConnectionOAuthStatus } from "@/lib/db/blogger-connections";
import { getBloggerConnectionSecretStatus, upsertEncryptedBloggerConnectionSecret } from "@/lib/db/blogger-connection-secrets";
import { consumeBloggerOAuthState, findBloggerOAuthStateByHash } from "@/lib/db/blogger-oauth-states";
import { hashOAuthState } from "@/lib/blogger/oauth";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLIENT_SECRET_ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

interface GoogleTokenResponse {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  scope?: unknown;
  error?: unknown;
}

export interface BloggerTokenExchangeResult {
  status: "token_exchange_completed";
  connectionId: string;
  stateValid: true;
  tokenExchangeImplemented: true;
  bloggerApiImplemented: false;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenStored: boolean;
  refreshTokenReused: boolean;
  connectionStatus: BloggerConnectionStatus;
  message: string;
  secretMaterialReturned: false;
}

export class BloggerTokenExchangeError extends Error {
  readonly connectionId?: string;
  readonly connectionStatus: BloggerConnectionStatus;

  constructor(message: string, options?: { connectionId?: string; connectionStatus?: BloggerConnectionStatus }) {
    super(safeBloggerSecretError(message));
    this.name = "BloggerTokenExchangeError";
    this.connectionId = options?.connectionId;
    this.connectionStatus = options?.connectionStatus ?? "error";
  }
}

export async function exchangeBloggerOAuthCallback(state: string | null, code: string | null, error: string | null): Promise<BloggerTokenExchangeResult> {
  if (!state) {
    throw new BloggerTokenExchangeError("OAuth state is required.", { connectionStatus: "oauth_required" });
  }
  if (error) {
    throw new BloggerTokenExchangeError("OAuth provider returned an error before token exchange.", { connectionStatus: "oauth_required" });
  }
  if (!code) {
    throw new BloggerTokenExchangeError("OAuth code is required for token exchange.", { connectionStatus: "oauth_required" });
  }

  const stateRecord = await findBloggerOAuthStateByHash(hashOAuthState(state));
  if (!stateRecord) {
    throw new BloggerTokenExchangeError("OAuth state is invalid.", { connectionStatus: "oauth_required" });
  }
  if (stateRecord.consumedAt) {
    throw new BloggerTokenExchangeError("OAuth state has already been used.", {
      connectionId: stateRecord.connectionId,
      connectionStatus: "oauth_required"
    });
  }
  if (stateRecord.expiresAt.getTime() <= Date.now()) {
    throw new BloggerTokenExchangeError("OAuth state has expired.", {
      connectionId: stateRecord.connectionId,
      connectionStatus: "oauth_required"
    });
  }

  const connection = await getBloggerConnection(stateRecord.connectionId);
  if (!connection) {
    throw new BloggerTokenExchangeError("Blogger connection not found.", {
      connectionId: stateRecord.connectionId,
      connectionStatus: "error"
    });
  }

  const clientId = resolveClientId(connection.oauthClientIdRef);
  const clientSecret = await resolveClientSecret(connection.id, connection.clientSecretRef);
  await ensureEncryptionConfigured(connection.id);

  await consumeBloggerOAuthState(stateRecord.id);

  try {
    const tokenResponse = await requestGoogleToken({
      code,
      clientId,
      clientSecret,
      redirectUri: stateRecord.redirectUri
    });

    return await persistTokenResponse({
      connectionId: connection.id,
      tokenResponse,
      stateScopes: stateRecord.scopes
    });
  } catch (caught) {
    const exchangeError = toExchangeError(caught, connection.id);
    await updateBloggerConnectionOAuthStatus(connection.id, {
      status: exchangeError.connectionStatus,
      lastError: exchangeError.message,
      lastTestedAt: new Date()
    });
    throw exchangeError;
  }
}

function resolveClientId(value: string | null) {
  const clientId = value?.trim();
  if (!clientId) {
    throw new BloggerTokenExchangeError("oauthClientIdRef is required for token exchange.", { connectionStatus: "error" });
  }
  return clientId;
}

async function resolveClientSecret(connectionId: string, ref: string | null) {
  const envKey = ref?.trim();
  if (!envKey) {
    await updateBloggerConnectionOAuthStatus(connectionId, {
      status: "error",
      lastError: "Client secret reference is not configured.",
      lastTestedAt: new Date()
    });
    throw new BloggerTokenExchangeError("Client secret reference is not configured.", { connectionId, connectionStatus: "error" });
  }
  if (!CLIENT_SECRET_ENV_KEY_PATTERN.test(envKey)) {
    await updateBloggerConnectionOAuthStatus(connectionId, {
      status: "error",
      lastError: "Client secret reference must be a safe server environment key name.",
      lastTestedAt: new Date()
    });
    throw new BloggerTokenExchangeError("Client secret reference must be a safe server environment key name.", { connectionId, connectionStatus: "error" });
  }

  const clientSecret = process.env[envKey]?.trim();
  if (!clientSecret) {
    await updateBloggerConnectionOAuthStatus(connectionId, {
      status: "error",
      lastError: "Client secret is not configured on the server.",
      lastTestedAt: new Date()
    });
    throw new BloggerTokenExchangeError("Client secret is not configured on the server.", { connectionId, connectionStatus: "error" });
  }

  return clientSecret;
}

async function ensureEncryptionConfigured(connectionId: string) {
  if (isBloggerSecretEncryptionConfigured()) {
    return;
  }

  await updateBloggerConnectionOAuthStatus(connectionId, {
    status: "error",
    lastError: "BLOGGER_SECRET_ENCRYPTION_KEY is not configured.",
    lastTestedAt: new Date()
  });
  throw new BloggerTokenExchangeError("BLOGGER_SECRET_ENCRYPTION_KEY is not configured.", { connectionId, connectionStatus: "error" });
}

async function requestGoogleToken(input: { code: string; clientId: string; clientSecret: string; redirectUri: string }) {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    signal: AbortSignal.timeout(15000)
  });
  const rawText = await response.text();
  const parsed = parseGoogleTokenJson(rawText);

  if (!response.ok) {
    throw new BloggerTokenExchangeError(summarizeGoogleTokenError(parsed, response.status), {
      connectionStatus: getFailureStatus(parsed)
    });
  }

  return parsed;
}

function parseGoogleTokenJson(rawText: string): GoogleTokenResponse {
  if (!rawText.trim()) {
    return {};
  }
  try {
    return JSON.parse(rawText) as GoogleTokenResponse;
  } catch {
    return {};
  }
}

function summarizeGoogleTokenError(parsed: GoogleTokenResponse, status: number) {
  const errorCode = typeof parsed.error === "string" ? parsed.error : "provider_http_error";
  if (errorCode === "invalid_grant") {
    return "Google token exchange failed: invalid_grant. Generate a new OAuth URL and try again.";
  }
  if (status === 401 || status === 403 || errorCode === "invalid_client") {
    return "Google token exchange authentication failed. Check the server OAuth client configuration.";
  }
  return `Google token exchange failed with HTTP ${status}.`;
}

function getFailureStatus(parsed: GoogleTokenResponse): BloggerConnectionStatus {
  return parsed.error === "invalid_grant" ? "oauth_required" : "error";
}

async function persistTokenResponse(input: { connectionId: string; tokenResponse: GoogleTokenResponse; stateScopes: string[] }): Promise<BloggerTokenExchangeResult> {
  const accessToken = typeof input.tokenResponse.access_token === "string" ? input.tokenResponse.access_token : null;
  if (!accessToken) {
    throw new BloggerTokenExchangeError("Google token response did not include an access token.", {
      connectionId: input.connectionId,
      connectionStatus: "error"
    });
  }

  const tokenType = typeof input.tokenResponse.token_type === "string" ? input.tokenResponse.token_type : "Bearer";
  const scopes = parseScopes(input.tokenResponse.scope, input.stateScopes);
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

  const previousSecretStatus = await getBloggerConnectionSecretStatus(input.connectionId);
  const refreshToken = typeof input.tokenResponse.refresh_token === "string" ? input.tokenResponse.refresh_token : null;
  let refreshTokenStored = false;
  let refreshTokenReused = false;

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
    refreshTokenStored = true;
  } else {
    refreshTokenReused = previousSecretStatus.hasRefreshToken;
  }

  const secretStatus = await getBloggerConnectionSecretStatus(input.connectionId);
  const hasRefreshToken = refreshTokenStored || refreshTokenReused || secretStatus.hasRefreshToken;
  const connectionStatus: BloggerConnectionStatus = hasRefreshToken ? "connected" : "oauth_required";
  const message = hasRefreshToken
    ? "OAuth token exchange completed. Blogger API calls remain disabled until a later patch."
    : "Refresh token was not returned. Reconnect with consent prompt.";

  await updateBloggerConnectionOAuthStatus(input.connectionId, {
    status: connectionStatus,
    lastError: hasRefreshToken ? null : message,
    lastTestedAt: new Date(),
    scopes
  });

  const finalSecretStatus = await getBloggerConnectionSecretStatus(input.connectionId);
  return {
    status: "token_exchange_completed",
    connectionId: input.connectionId,
    stateValid: true,
    tokenExchangeImplemented: true,
    bloggerApiImplemented: false,
    hasAccessToken: finalSecretStatus.hasAccessToken,
    hasRefreshToken,
    tokenLast4: finalSecretStatus.tokenLast4,
    accessTokenExpiresAt: finalSecretStatus.accessTokenExpiresAt,
    refreshTokenStored,
    refreshTokenReused,
    connectionStatus,
    message,
    secretMaterialReturned: false
  };
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

function toExchangeError(error: unknown, connectionId: string) {
  if (error instanceof BloggerTokenExchangeError) {
    return new BloggerTokenExchangeError(error.message, {
      connectionId,
      connectionStatus: error.connectionStatus
    });
  }

  return new BloggerTokenExchangeError("Google token exchange failed.", {
    connectionId,
    connectionStatus: "error"
  });
}
