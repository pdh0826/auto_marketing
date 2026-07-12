import { createHash, randomBytes } from "node:crypto";
import type { SafeBloggerConnection } from "@/lib/db/blogger-connections";
import { createBloggerOAuthState, consumeBloggerOAuthState, findBloggerOAuthStateByHash } from "@/lib/db/blogger-oauth-states";

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const DEFAULT_BLOGGER_SCOPE = "https://www.googleapis.com/auth/blogger";
const DEFAULT_LOCAL_BLOGGER_OAUTH_REDIRECT_ORIGIN = "http://localhost:3004";
const BLOGGER_OAUTH_REDIRECT_ORIGIN_ENV = "BLOGGER_OAUTH_REDIRECT_ORIGIN";
const STATE_TTL_MINUTES = 10;

export interface BloggerOAuthStartDryRunInput {
  connection: SafeBloggerConnection;
  requestUrl: string;
}

export async function createBloggerOAuthStartDryRun({ connection, requestUrl }: BloggerOAuthStartDryRunInput) {
  if (!connection.oauthClientIdRef?.trim()) {
    throw new Error("oauthClientIdRef is required before OAuth dry-run URL generation.");
  }

  const redirectUri = buildRedirectUri(requestUrl);
  const state = randomBytes(32).toString("base64url");
  const stateHash = hashOAuthState(state);
  const scopes = connection.scopes.length > 0 ? connection.scopes : [DEFAULT_BLOGGER_SCOPE];
  const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000);

  await createBloggerOAuthState({
    connectionId: connection.id,
    stateHash,
    redirectUri,
    scopes,
    expiresAt
  });

  const authorizationUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
  authorizationUrl.searchParams.set("client_id", connection.oauthClientIdRef);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", scopes.join(" "));
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("prompt", "consent");

  return {
    authorizationUrl: authorizationUrl.toString(),
    expiresAt: expiresAt.toISOString(),
    redirectUri,
    scopes,
    oauthDryRun: true as const,
    tokenExchangeImplemented: true,
    bloggerApiImplemented: false as const
  };
}

export async function validateBloggerOAuthCallbackDryRun(state: string | null, code: string | null, error: string | null) {
  if (!state) {
    throw new Error("OAuth state is required.");
  }
  if (error) {
    throw new Error("OAuth provider returned an error before token exchange.");
  }
  if (!code) {
    throw new Error("OAuth code is required for callback dry-run validation.");
  }

  const stateRecord = await findBloggerOAuthStateByHash(hashOAuthState(state));
  if (!stateRecord) {
    throw new Error("OAuth state is invalid.");
  }
  if (stateRecord.consumedAt) {
    throw new Error("OAuth state has already been used.");
  }
  if (stateRecord.expiresAt.getTime() <= Date.now()) {
    throw new Error("OAuth state has expired.");
  }

  await consumeBloggerOAuthState(stateRecord.id);

  return {
    status: "callback_dry_run_received" as const,
    connectionId: stateRecord.connectionId,
    stateValid: true as const,
    tokenExchangeImplemented: false as const,
    bloggerApiImplemented: false as const
  };
}

export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

function buildRedirectUri(requestUrl: string) {
  const url = new URL(requestUrl);
  const configuredOrigin = normalizeOrigin(process.env[BLOGGER_OAUTH_REDIRECT_ORIGIN_ENV]);
  const redirectOrigin = configuredOrigin ?? (isLocalOrigin(url) ? DEFAULT_LOCAL_BLOGGER_OAUTH_REDIRECT_ORIGIN : url.origin);
  return `${redirectOrigin}/api/settings/blogger/oauth/callback`;
}

function normalizeOrigin(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(url: URL) {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
}
