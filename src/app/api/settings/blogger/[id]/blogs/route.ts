import { NextResponse } from "next/server";
import { BloggerBlogListError, listBloggerBlogsReadOnly } from "@/lib/blogger/blog-list";
import { safeBloggerSecretError } from "@/lib/blogger/secrets";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const result = await listBloggerBlogsReadOnly(params.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof BloggerBlogListError) {
      return NextResponse.json(
        {
          error: error.code,
          message: safeBloggerSecretError(error.message),
          data: {
            connectionId: params.id,
            readOnly: true,
            bloggerApiImplemented: true,
            tokenRefreshImplemented: false,
            draftPublishImplemented: false,
            statusSuggestion: error.statusSuggestion,
            blogs: [],
            metadata: {
              blogCount: 0,
              fetchedAt: new Date().toISOString()
            }
          }
        },
        { status: error.httpStatus }
      );
    }

    return NextResponse.json(
      {
        error: "blogger_blog_list_failed",
        message: safeBloggerSecretError(error instanceof Error ? error.message : "Blogger blog list failed."),
        data: {
          connectionId: params.id,
          readOnly: true,
          bloggerApiImplemented: true,
          tokenRefreshImplemented: false,
          draftPublishImplemented: false,
          statusSuggestion: "error",
          blogs: [],
          metadata: {
            blogCount: 0,
            fetchedAt: new Date().toISOString()
          }
        }
      },
      { status: 500 }
    );
  }
}
