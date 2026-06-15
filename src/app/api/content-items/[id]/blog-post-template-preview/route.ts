import { NextResponse } from "next/server";
import type { BlogPostTemplatePreviewSource } from "@/lib/blog-renderer/blog-post-template-renderer";
import { buildBlogPostTemplatePreview } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

const PREVIEW_SOURCES = new Set<BlogPostTemplatePreviewSource>(["manual_draft_candidate", "stepwise_final_candidate", "saved_draft_markdown"]);

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      markdown?: unknown;
      source?: unknown;
      theme?: unknown;
    };

    const contentItem = await prisma.contentItem.findUnique({
      where: { id: params.id },
      include: {
        blog: true,
        brandProfile: true,
        assets: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!contentItem) {
      return NextResponse.json({ error: "Content item not found." }, { status: 404 });
    }

    const source = resolvePreviewSource(body.source);
    const markdown = resolvePreviewMarkdown(body.markdown, source, contentItem.draftMarkdown);

    if (!markdown.trim()) {
      return NextResponse.json({ error: "markdown_required", message: "Markdown 후보가 비어 있습니다." }, { status: 400 });
    }

    const result = buildBlogPostTemplatePreview({
      contentItem: contentItem as unknown as ContentItemAdmin,
      assets: contentItem.assets as unknown as ContentAssetAdmin[],
      markdown,
      source,
      theme: "clean_blog"
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Blog post template preview failed.", 500) }, { status: 400 });
  }
}

function resolvePreviewSource(value: unknown): BlogPostTemplatePreviewSource {
  if (typeof value === "string" && PREVIEW_SOURCES.has(value as BlogPostTemplatePreviewSource)) {
    return value as BlogPostTemplatePreviewSource;
  }
  return "manual_draft_candidate";
}

function resolvePreviewMarkdown(markdown: unknown, source: BlogPostTemplatePreviewSource, savedDraftMarkdown: string | null) {
  if (typeof markdown === "string") {
    return markdown;
  }
  if (source === "saved_draft_markdown") {
    return savedDraftMarkdown ?? "";
  }
  return "";
}
