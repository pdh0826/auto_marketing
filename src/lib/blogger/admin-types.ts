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
  oauthImplemented: false;
  bloggerApiImplemented: false;
  publishImplemented: false;
}
