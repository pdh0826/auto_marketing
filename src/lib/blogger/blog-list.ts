import type { BloggerConnectionStatus } from "@prisma/client";
import { decryptBloggerSecret, isBloggerSecretEncryptionConfigured, safeBloggerSecretError } from "@/lib/blogger/secrets";
import { getBloggerConnection } from "@/lib/db/blogger-connections";
import { getEncryptedBloggerConnectionSecret } from "@/lib/db/blogger-connection-secrets";

const BLOGGER_BLOG_LIST_URL = "https://www.googleapis.com/blogger/v3/users/self/blogs";
const BLOGGER_API_TIMEOUT_MS = 15000;

export interface BloggerBlogListItem {
  id: string;
  name: string;
  url: string | null;
  published: string | null;
  updated: string | null;
}

export interface BloggerBlogListResult {
  connectionId: string;
  readOnly: true;
  bloggerApiImplemented: true;
  tokenRefreshImplemented: false;
  draftPublishImplemented: false;
  statusSuggestion: BloggerConnectionStatus;
  blogs: BloggerBlogListItem[];
  metadata: {
    blogCount: number;
    fetchedAt: string;
  };
}

interface BloggerBlogListApiResponse {
  items?: unknown;
}

export class BloggerBlogListError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly statusSuggestion: BloggerConnectionStatus;

  constructor(code: string, message: string, options: { httpStatus: number; statusSuggestion: BloggerConnectionStatus }) {
    super(safeBloggerSecretError(message));
    this.name = "BloggerBlogListError";
    this.code = code;
    this.httpStatus = options.httpStatus;
    this.statusSuggestion = options.statusSuggestion;
  }
}

export async function listBloggerBlogsReadOnly(connectionId: string): Promise<BloggerBlogListResult> {
  const connection = await getBloggerConnection(connectionId);
  if (!connection) {
    throw new BloggerBlogListError("blogger_connection_not_found", "Blogger connection not found.", {
      httpStatus: 404,
      statusSuggestion: "not_configured"
    });
  }

  const accessTokenSecret = await getEncryptedBloggerConnectionSecret(connectionId, "access_token");
  if (!accessTokenSecret) {
    throw new BloggerBlogListError("access_token_missing", "Blogger access token is missing. Reconnect OAuth before reading Blogger blogs.", {
      httpStatus: 400,
      statusSuggestion: "oauth_required"
    });
  }

  if (accessTokenSecret.expiresAt && accessTokenSecret.expiresAt.getTime() <= Date.now()) {
    throw new BloggerBlogListError("access_token_expired", "Blogger access token is expired. Token refresh is not implemented yet.", {
      httpStatus: 400,
      statusSuggestion: "expired"
    });
  }

  if (!isBloggerSecretEncryptionConfigured()) {
    throw new BloggerBlogListError("blogger_secret_key_not_configured", "BLOGGER_SECRET_ENCRYPTION_KEY is not configured.", {
      httpStatus: 500,
      statusSuggestion: "error"
    });
  }

  const accessToken = decryptAccessToken(accessTokenSecret.encryptedValue);
  const blogs = await requestBloggerBlogs(accessToken);

  return {
    connectionId,
    readOnly: true,
    bloggerApiImplemented: true,
    tokenRefreshImplemented: false,
    draftPublishImplemented: false,
    statusSuggestion: connection.status === "connected" ? "connected" : connection.status,
    blogs,
    metadata: {
      blogCount: blogs.length,
      fetchedAt: new Date().toISOString()
    }
  };
}

function decryptAccessToken(encryptedValue: string) {
  try {
    return decryptBloggerSecret(encryptedValue);
  } catch {
    throw new BloggerBlogListError("token_decryption_failed", "Stored Blogger access token could not be decrypted.", {
      httpStatus: 500,
      statusSuggestion: "error"
    });
  }
}

async function requestBloggerBlogs(accessToken: string) {
  let response: Response;
  try {
    response = await fetch(BLOGGER_BLOG_LIST_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(BLOGGER_API_TIMEOUT_MS)
    });
  } catch {
    throw new BloggerBlogListError("blogger_api_request_failed", "Blogger blog list request failed before receiving a response.", {
      httpStatus: 502,
      statusSuggestion: "error"
    });
  }

  if (response.status === 401) {
    throw new BloggerBlogListError("blogger_api_unauthorized", "Blogger API rejected the access token. Reconnect OAuth before retrying.", {
      httpStatus: 400,
      statusSuggestion: "expired"
    });
  }
  if (response.status === 403) {
    throw new BloggerBlogListError("blogger_api_forbidden", "Blogger API denied this read-only blog list request. Check OAuth scopes and Blogger access.", {
      httpStatus: 400,
      statusSuggestion: "oauth_required"
    });
  }
  if (!response.ok) {
    throw new BloggerBlogListError("blogger_api_request_failed", `Blogger blog list request failed with HTTP ${response.status}.`, {
      httpStatus: 502,
      statusSuggestion: "error"
    });
  }

  const parsed = parseBloggerBlogListJson(await response.text());
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return items.map(toBloggerBlogListItem).filter((item): item is BloggerBlogListItem => Boolean(item));
}

function parseBloggerBlogListJson(rawText: string): BloggerBlogListApiResponse {
  if (!rawText.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawText) as BloggerBlogListApiResponse;
  } catch {
    return {};
  }
}

function toBloggerBlogListItem(value: unknown): BloggerBlogListItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id : "";
  const name = typeof item.name === "string" ? item.name : "";
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    url: typeof item.url === "string" ? item.url : null,
    published: typeof item.published === "string" ? item.published : null,
    updated: typeof item.updated === "string" ? item.updated : null
  };
}
