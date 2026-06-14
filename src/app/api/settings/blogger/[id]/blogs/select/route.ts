import { NextResponse } from "next/server";
import { BloggerBlogListError, listBloggerBlogsReadOnly } from "@/lib/blogger/blog-list";
import { safeBloggerSecretError } from "@/lib/blogger/secrets";
import { getBloggerConnection, selectBloggerBlogForConnection } from "@/lib/db/blogger-connections";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

class BloggerBlogSelectionError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(safeBloggerSecretError(message));
    this.name = "BloggerBlogSelectionError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const connection = await getBloggerConnection(params.id);
    if (!connection) {
      throw new BloggerBlogSelectionError("blogger_connection_not_found", "Blogger connection not found.", 404);
    }

    const body = (await request.json()) as Record<string, unknown>;
    const blogId = normalizeSelectedBlogId(body.blogId);
    const blogList = await listBloggerBlogsReadOnly(params.id);
    const selectedBlog = blogList.blogs.find((blog) => blog.id === blogId);

    if (!selectedBlog) {
      throw new BloggerBlogSelectionError("blogger_blog_not_accessible", "Selected Blogger blog is not accessible with the current connected token.");
    }

    const updatedConnection = await selectBloggerBlogForConnection(params.id, selectedBlog);
    return NextResponse.json({
      data: {
        connection: updatedConnection,
        selectedBlog,
        readOnlyRevalidated: true,
        draftPublishImplemented: false,
        tokenRefreshImplemented: false
      }
    });
  } catch (error) {
    if (error instanceof BloggerBlogSelectionError) {
      return NextResponse.json(
        {
          error: error.code,
          message: safeBloggerSecretError(error.message),
          data: safeFailureData(params.id)
        },
        { status: error.httpStatus }
      );
    }

    if (error instanceof BloggerBlogListError) {
      return NextResponse.json(
        {
          error: toSelectionSafeErrorCode(error.code),
          message: safeBloggerSecretError(error.message),
          data: safeFailureData(params.id)
        },
        { status: error.httpStatus }
      );
    }

    return NextResponse.json(
      {
        error: "blogger_blog_selection_failed",
        message: safeBloggerSecretError(error instanceof Error ? error.message : "Blogger blog selection failed."),
        data: safeFailureData(params.id)
      },
      { status: 500 }
    );
  }
}

function normalizeSelectedBlogId(value: unknown) {
  if (typeof value !== "string") {
    throw new BloggerBlogSelectionError("invalid_blog_id", "blogId is required.");
  }

  const blogId = value.trim();
  if (!blogId) {
    throw new BloggerBlogSelectionError("invalid_blog_id", "blogId is required.");
  }
  if (blogId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(blogId)) {
    throw new BloggerBlogSelectionError("invalid_blog_id", "blogId must be a safe Blogger blog identifier.");
  }

  return blogId;
}

function safeFailureData(connectionId: string) {
  return {
    connectionId,
    selectedBlog: null,
    readOnlyRevalidated: false,
    draftPublishImplemented: false,
    tokenRefreshImplemented: false
  };
}

function toSelectionSafeErrorCode(code: string) {
  if (code === "access_token_missing") {
    return "blogger_token_missing";
  }
  if (code === "access_token_expired") {
    return "blogger_token_expired";
  }
  return code;
}
