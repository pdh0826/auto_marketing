import { decryptBloggerSecret, isBloggerSecretEncryptionConfigured, safeBloggerSecretError } from "@/lib/blogger/secrets";
import { getEncryptedBloggerConnectionSecret } from "@/lib/db/blogger-connection-secrets";

const BLOGGER_API_TIMEOUT_MS = 15000;

export interface BloggerDraftSavePostInput {
  connectionId: string;
  targetBloggerBlogId: string;
  title: string;
  content: string;
  labels: string[];
}

export interface BloggerDraftSavePostResult {
  bloggerPostId: string;
  bloggerPostUrl: string | null;
  bloggerPostPublishedAt: Date | null;
  bloggerPostUpdatedAt: Date | null;
}

interface BloggerPostInsertApiResponse {
  id?: unknown;
  url?: unknown;
  published?: unknown;
  updated?: unknown;
}

export class BloggerDraftSaveError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, options: { httpStatus: number; retryable: boolean }) {
    super(safeBloggerSecretError(message));
    this.name = "BloggerDraftSaveError";
    this.code = code;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable;
  }
}

export async function saveBloggerDraftPost(input: BloggerDraftSavePostInput): Promise<BloggerDraftSavePostResult> {
  const accessToken = await getUsableAccessToken(input.connectionId);
  const response = await requestBloggerDraftInsert(input, accessToken);
  return parseBloggerDraftSaveResponse(response);
}

async function getUsableAccessToken(connectionId: string) {
  const accessTokenSecret = await getEncryptedBloggerConnectionSecret(connectionId, "access_token");
  if (!accessTokenSecret) {
    throw new BloggerDraftSaveError("access_token_missing", "Blogger access token is missing. Reconnect OAuth before saving a draft.", {
      httpStatus: 400,
      retryable: false
    });
  }

  if (accessTokenSecret.expiresAt && accessTokenSecret.expiresAt.getTime() <= Date.now()) {
    throw new BloggerDraftSaveError("access_token_expired", "Blogger access token is expired. Token refresh is not implemented yet.", {
      httpStatus: 400,
      retryable: false
    });
  }

  if (!isBloggerSecretEncryptionConfigured()) {
    throw new BloggerDraftSaveError("blogger_secret_key_not_configured", "BLOGGER_SECRET_ENCRYPTION_KEY is not configured.", {
      httpStatus: 500,
      retryable: false
    });
  }

  try {
    return decryptBloggerSecret(accessTokenSecret.encryptedValue);
  } catch {
    throw new BloggerDraftSaveError("token_decryption_failed", "Stored Blogger access token could not be decrypted.", {
      httpStatus: 500,
      retryable: false
    });
  }
}

async function requestBloggerDraftInsert(input: BloggerDraftSavePostInput, accessToken: string) {
  const url = new URL(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(input.targetBloggerBlogId)}/posts`);
  url.searchParams.set("isDraft", "true");
  url.searchParams.set("fields", "id,url,published,updated,title");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        kind: "blogger#post",
        blog: { id: input.targetBloggerBlogId },
        title: input.title,
        content: input.content,
        labels: input.labels
      }),
      signal: AbortSignal.timeout(BLOGGER_API_TIMEOUT_MS)
    });
  } catch {
    throw new BloggerDraftSaveError("blogger_api_request_failed", "Blogger draft save request failed before receiving a response.", {
      httpStatus: 502,
      retryable: true
    });
  }

  if (response.status === 401) {
    throw new BloggerDraftSaveError("blogger_token_expired_or_rejected", "Blogger API rejected the access token. Reconnect OAuth before retrying.", {
      httpStatus: 400,
      retryable: false
    });
  }
  if (response.status === 403) {
    throw new BloggerDraftSaveError("blogger_api_forbidden", "Blogger API denied this draft save request. Check OAuth scopes and Blogger blog access.", {
      httpStatus: 400,
      retryable: false
    });
  }
  if (!response.ok) {
    throw new BloggerDraftSaveError("blogger_api_request_failed", `Blogger draft save request failed with HTTP ${response.status}.`, {
      httpStatus: 502,
      retryable: response.status >= 500
    });
  }

  return parseBloggerPostInsertJson(await response.text());
}

function parseBloggerPostInsertJson(rawText: string): BloggerPostInsertApiResponse {
  if (!rawText.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawText) as BloggerPostInsertApiResponse;
  } catch {
    return {};
  }
}

function parseBloggerDraftSaveResponse(response: BloggerPostInsertApiResponse): BloggerDraftSavePostResult {
  const bloggerPostId = typeof response.id === "string" ? response.id.trim() : "";
  if (!bloggerPostId) {
    throw new BloggerDraftSaveError("blogger_api_response_missing_post_id", "Blogger draft save response did not include a post id.", {
      httpStatus: 502,
      retryable: true
    });
  }

  return {
    bloggerPostId,
    bloggerPostUrl: typeof response.url === "string" && response.url.trim() ? response.url.trim() : null,
    bloggerPostPublishedAt: parseDate(response.published),
    bloggerPostUpdatedAt: parseDate(response.updated)
  };
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
