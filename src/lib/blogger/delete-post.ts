import { safeBloggerSecretError } from "@/lib/blogger/secrets";

const BLOGGER_DELETE_API_TIMEOUT_MS = 15000;

export interface DeleteBloggerPostInput {
  accessToken: string;
  bloggerBlogId: string;
  bloggerPostId: string;
}

export interface DeleteBloggerPostResult {
  ok: boolean;
  status: number;
  bloggerPostId: string;
  retryable: boolean;
  errorCode?: string;
  errorMessageRedacted?: string;
}

export async function deleteExistingBloggerPost(input: DeleteBloggerPostInput): Promise<DeleteBloggerPostResult> {
  const url = new URL(
    `https://www.googleapis.com/blogger/v3/blogs/${encodeURIComponent(input.bloggerBlogId)}/posts/${encodeURIComponent(input.bloggerPostId)}`
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(BLOGGER_DELETE_API_TIMEOUT_MS)
    });
  } catch {
    return {
      ok: false,
      status: 0,
      bloggerPostId: input.bloggerPostId,
      retryable: true,
      errorCode: "blogger_delete_request_failed",
      errorMessageRedacted: "Blogger delete request failed before receiving a response."
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      bloggerPostId: input.bloggerPostId,
      retryable: response.status >= 500,
      errorCode: getDeleteErrorCode(response.status),
      errorMessageRedacted: safeBloggerSecretError(`Blogger delete request failed with HTTP ${response.status}.`)
    };
  }

  return {
    ok: true,
    status: response.status,
    bloggerPostId: input.bloggerPostId,
    retryable: false
  };
}

function getDeleteErrorCode(status: number) {
  if (status === 401) {
    return "blogger_token_expired_or_rejected";
  }
  if (status === 403) {
    return "blogger_api_forbidden";
  }
  if (status === 404) {
    return "blogger_post_not_found";
  }
  return "blogger_delete_failed";
}
