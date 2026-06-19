import { safeBloggerSecretError } from "@/lib/blogger/secrets";

const BLOGGER_READ_POST_API_TIMEOUT_MS = 15000;

export interface ReadBloggerPostInput {
  accessToken: string;
  bloggerBlogId: string;
  bloggerPostId: string;
}

export interface ReadBloggerPostResult {
  ok: boolean;
  status: number;
  bloggerPostId?: string;
  bloggerPostUrl?: string;
  title?: string;
  publishedAt?: string;
  updatedAt?: string;
  statusLabel?: string;
  selfLinkPresent?: boolean;
  redactedResponse: Record<string, unknown>;
  retryable: boolean;
  errorCode?: string;
  errorMessageRedacted?: string;
}

interface BloggerPostReadApiResponse {
  id?: unknown;
  url?: unknown;
  title?: unknown;
  published?: unknown;
  updated?: unknown;
  status?: unknown;
  selfLink?: unknown;
}

export async function readBloggerPost(input: ReadBloggerPostInput): Promise<ReadBloggerPostResult> {
  const url = new URL(`https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(input.bloggerBlogId)}/posts/${encodeURIComponent(input.bloggerPostId)}`);
  url.searchParams.set("fields", "id,url,title,published,updated,status,selfLink");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(BLOGGER_READ_POST_API_TIMEOUT_MS)
    });
  } catch {
    return {
      ok: false,
      status: 0,
      redactedResponse: {
        receivedResponse: false,
        rawResponseStored: false
      },
      retryable: true,
      errorCode: "blogger_readback_request_failed",
      errorMessageRedacted: "Blogger post readback request failed before receiving a response."
    };
  }

  const parsed = parseBloggerPostReadJson(await response.text());
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      redactedResponse: buildRedactedResponse(parsed),
      retryable: response.status >= 500,
      errorCode: getReadbackErrorCode(response.status),
      errorMessageRedacted: safeBloggerSecretError(`Blogger post readback failed with HTTP ${response.status}.`)
    };
  }

  return {
    ok: true,
    status: response.status,
    bloggerPostId: getString(parsed.id) ?? input.bloggerPostId,
    bloggerPostUrl: getString(parsed.url) ?? undefined,
    title: getString(parsed.title) ?? undefined,
    publishedAt: getString(parsed.published) ?? undefined,
    updatedAt: getString(parsed.updated) ?? undefined,
    statusLabel: getString(parsed.status) ?? undefined,
    selfLinkPresent: Boolean(getString(parsed.selfLink)),
    redactedResponse: buildRedactedResponse(parsed),
    retryable: false
  };
}

function parseBloggerPostReadJson(rawText: string): BloggerPostReadApiResponse {
  if (!rawText.trim()) {
    return {};
  }

  try {
    return JSON.parse(rawText) as BloggerPostReadApiResponse;
  } catch {
    return {};
  }
}

function buildRedactedResponse(response: BloggerPostReadApiResponse): Record<string, unknown> {
  return {
    id: getString(response.id) ?? null,
    url: getString(response.url) ?? null,
    title: getString(response.title) ?? null,
    published: getString(response.published) ?? null,
    updated: getString(response.updated) ?? null,
    status: getString(response.status) ?? null,
    selfLinkPresent: Boolean(getString(response.selfLink)),
    rawResponseStored: false,
    contentReturned: false
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getReadbackErrorCode(status: number) {
  if (status === 401) {
    return "blogger_readback_unauthorized_reauth_required";
  }
  if (status === 403) {
    return "blogger_readback_forbidden";
  }
  if (status === 404) {
    return "blogger_readback_post_not_found";
  }
  return "blogger_readback_failed";
}
