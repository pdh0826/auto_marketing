import { safeBloggerSecretError } from "@/lib/blogger/secrets";

const BLOGGER_PUBLISH_API_TIMEOUT_MS = 15000;

export interface PublishBloggerPostInput {
  accessToken: string;
  bloggerBlogId: string;
  bloggerPostId: string;
}

export interface PublishBloggerPostResult {
  ok: boolean;
  status: number;
  bloggerPostId?: string;
  bloggerPostUrl?: string;
  publishedAt?: string;
  updatedAt?: string;
  redactedResponse: Record<string, unknown>;
  retryable: boolean;
  errorCode?: string;
  errorMessageRedacted?: string;
}

interface BloggerPostPublishApiResponse {
  id?: unknown;
  url?: unknown;
  published?: unknown;
  updated?: unknown;
}

export async function publishExistingBloggerPost(input: PublishBloggerPostInput): Promise<PublishBloggerPostResult> {
  const url = new URL(
    `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(input.bloggerBlogId)}/posts/${encodeURIComponent(input.bloggerPostId)}/publish`
  );
  url.searchParams.set("fields", "id,url,published,updated");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(BLOGGER_PUBLISH_API_TIMEOUT_MS)
    });
  } catch {
    return {
      ok: false,
      status: 0,
      redactedResponse: {
        receivedResponse: false
      },
      retryable: true,
      errorCode: "blogger_publish_request_failed",
      errorMessageRedacted: "Blogger publish request failed before receiving a response."
    };
  }

  const responseText = await response.text();
  const parsed = parseBloggerPostPublishJson(responseText);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      redactedResponse: buildRedactedResponse(parsed),
      retryable: response.status >= 500,
      errorCode: getPublishErrorCode(response.status),
      errorMessageRedacted: safeBloggerSecretError(`Blogger publish request failed with HTTP ${response.status}.`)
    };
  }

  return {
    ok: true,
    status: response.status,
    bloggerPostId: getString(parsed.id) ?? input.bloggerPostId,
    bloggerPostUrl: getString(parsed.url) ?? undefined,
    publishedAt: getString(parsed.published) ?? undefined,
    updatedAt: getString(parsed.updated) ?? undefined,
    redactedResponse: buildRedactedResponse(parsed),
    retryable: false
  };
}

function parseBloggerPostPublishJson(rawText: string): BloggerPostPublishApiResponse {
  if (!rawText.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawText) as BloggerPostPublishApiResponse;
  } catch {
    return {};
  }
}

function buildRedactedResponse(response: BloggerPostPublishApiResponse): Record<string, unknown> {
  return {
    id: getString(response.id) ?? null,
    url: getString(response.url) ?? null,
    published: getString(response.published) ?? null,
    updated: getString(response.updated) ?? null,
    rawResponseStored: false
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPublishErrorCode(status: number) {
  if (status === 401) {
    return "blogger_token_expired_or_rejected";
  }
  if (status === 403) {
    return "blogger_api_forbidden";
  }
  if (status === 404) {
    return "blogger_post_not_found";
  }
  return "blogger_publish_failed";
}
