export type BloggerConnectionStatus = "not_configured" | "configured" | "oauth_required" | "connected" | "expired" | "error";

export interface BloggerConnectionBlogSummary {
  id: string;
  name: string;
  url: string;
  bloggerBlogId: string | null;
}

export interface BloggerConnectionAdmin {
  id: string;
  blogId: string | null;
  name: string;
  status: BloggerConnectionStatus;
  bloggerBlogId: string | null;
  bloggerBlogName: string | null;
  connectedEmail: string | null;
  scopes: string[];
  oauthClientIdRef: string | null;
  clientSecretRef: string | null;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  blog: BloggerConnectionBlogSummary | null;
}

export interface BloggerConnectionStatusSummary {
  id: string;
  status: BloggerConnectionStatus;
  bloggerBlogId: string | null;
  bloggerBlogName: string | null;
  connectedEmail: string | null;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  blog: BloggerConnectionBlogSummary | null;
  oauthImplemented: boolean;
  bloggerApiImplemented: false;
  publishImplemented: false;
}

export interface BloggerOAuthStartDryRun {
  authorizationUrl: string;
  expiresAt: string;
  redirectUri: string;
  scopes: string[];
  oauthDryRun: true;
  tokenExchangeImplemented: boolean;
  bloggerApiImplemented: false;
}

export interface BloggerOAuthCallbackResult {
  status: "callback_dry_run_received" | "token_exchange_completed";
  connectionId: string;
  stateValid: true;
  tokenExchangeImplemented: boolean;
  bloggerApiImplemented: false;
  hasAccessToken?: boolean;
  hasRefreshToken?: boolean;
  tokenLast4?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenStored?: boolean;
  refreshTokenReused?: boolean;
  connectionStatus?: BloggerConnectionStatus;
  message?: string;
  secretMaterialReturned?: false;
}

export type BloggerSecretKind = "oauth_client_secret" | "access_token" | "refresh_token";

export interface BloggerConnectionSecretAdmin {
  id: string;
  connectionId: string;
  secretKind: BloggerSecretKind;
  keyVersion: string;
  last4: string | null;
  tokenType: string | null;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BloggerConnectionSecretStatus {
  connectionId: string;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scopes: string[];
  secrets: BloggerConnectionSecretAdmin[];
  secretMaterialReturned: false;
  tokenExchangeImplemented: boolean;
  bloggerApiImplemented: false;
}

export interface BloggerSecretSelfTestResult {
  keyConfigured: boolean;
  selfTestPassed: boolean;
  keyVersion: string;
  message: string;
  secretMaterialReturned: false;
  tokenExchangeImplemented: boolean;
  bloggerApiImplemented: false;
}
