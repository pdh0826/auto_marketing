import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { buildBlogPostTemplatePreview } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { validateHtmlCandidate } from "@/lib/content/html-preview";
import { prisma } from "@/lib/db/client";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id: string;
  };
}

type ApplyMode = "dry_run" | "apply";

const APPLY_CONFIRMATION_PHRASE = "APPLY_SEO_EDITORIAL_CANDIDATE";

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      markdown?: unknown;
      mode?: unknown;
      confirmationPhrase?: unknown;
      expectedCurrentDraftMarkdownMd5?: unknown;
      expectedCurrentDraftHtmlMd5?: unknown;
      expectedCandidateMarkdownSha256?: unknown;
      expectedCandidateHtmlSha256?: unknown;
      source?: unknown;
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

    const mode = resolveMode(body.mode);
    const markdown = typeof body.markdown === "string" ? body.markdown.trim() : "";
    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim().slice(0, 120) : "unknown";
    const currentDraftMarkdownMd5 = md5(contentItem.draftMarkdown ?? "");
    const currentDraftHtmlMd5 = md5(contentItem.draftHtml ?? "");
    const blockers = new Set<string>();

    if (!markdown) {
      blockers.add("candidate_markdown_missing");
    }

    const templatePreview = markdown
      ? buildBlogPostTemplatePreview({
          contentItem: contentItem as unknown as ContentItemAdmin,
          assets: contentItem.assets as unknown as ContentAssetAdmin[],
          markdown,
          source: "manual_draft_candidate",
          theme: "clean_blog"
        })
      : null;

    const candidateHtml = templatePreview?.html ?? "";
    const htmlValidation = validateHtmlCandidate(candidateHtml, contentItem.assets as unknown as ContentAssetAdmin[], contentItem as unknown as ContentItemAdmin);
    const candidateMarkdownSha256 = sha256(markdown);
    const candidateHtmlSha256 = sha256(candidateHtml);

    if (contentItem.status !== "planned") {
      blockers.add("content_item_not_planned");
    }
    if (templatePreview && !templatePreview.validationSummary.ok) {
      blockers.add("template_preview_not_ready");
    }
    if (!htmlValidation.validation.ok) {
      blockers.add("html_validation_not_ready");
    }
    if (hasExpectedMismatch(body.expectedCurrentDraftMarkdownMd5, currentDraftMarkdownMd5)) {
      blockers.add("current_draft_markdown_hash_mismatch");
    }
    if (hasExpectedMismatch(body.expectedCurrentDraftHtmlMd5, currentDraftHtmlMd5)) {
      blockers.add("current_draft_html_hash_mismatch");
    }
    if (hasExpectedMismatch(body.expectedCandidateMarkdownSha256, candidateMarkdownSha256)) {
      blockers.add("candidate_markdown_hash_mismatch");
    }
    if (hasExpectedMismatch(body.expectedCandidateHtmlSha256, candidateHtmlSha256)) {
      blockers.add("candidate_html_hash_mismatch");
    }
    if (mode === "apply" && body.confirmationPhrase !== APPLY_CONFIRMATION_PHRASE) {
      blockers.add("apply_confirmation_phrase_required");
    }

    const canApply = blockers.size === 0;
    const applyRequested = mode === "apply";
    const shouldApply = applyRequested && canApply;
    const updated = shouldApply
      ? await prisma.contentItem.update({
          where: { id: params.id },
          data: {
            draftMarkdown: markdown,
            draftHtml: candidateHtml
          },
          select: {
            id: true,
            status: true,
            draftMarkdown: true,
            draftHtml: true,
            qualityScore: true,
            publishedAt: true,
            scheduledAt: true,
            updatedAt: true
          }
        })
      : null;

    const statusCode = applyRequested && !canApply ? 400 : 200;

    return NextResponse.json(
      {
        data: {
          mode,
          source,
          canApply,
          applied: Boolean(updated),
          blockingReasons: Array.from(blockers),
          currentContentItemSummary: {
            id: contentItem.id,
            status: contentItem.status,
            draftMarkdownMd5: currentDraftMarkdownMd5,
            draftHtmlMd5: currentDraftHtmlMd5,
            draftMarkdownLength: contentItem.draftMarkdown?.length ?? 0,
            draftHtmlLength: contentItem.draftHtml?.length ?? 0,
            qualityScore: contentItem.qualityScore,
            publishedAt: contentItem.publishedAt,
            scheduledAt: contentItem.scheduledAt
          },
          candidateSummary: {
            markdownLength: markdown.length,
            htmlLength: candidateHtml.length,
            candidateMarkdownSha256,
            candidateHtmlSha256,
            titleCandidate: templatePreview?.sourceSummary.titleCandidate ?? null,
            templatePreviewOk: templatePreview?.validationSummary.ok ?? false,
            htmlValidationOk: htmlValidation.validation.ok,
            seoArticle: {
              ok: htmlValidation.metadata.seoArticle.ok,
              grade: htmlValidation.metadata.seoArticle.grade,
              score: htmlValidation.metadata.seoArticle.score,
              visibleTextLength: htmlValidation.metadata.seoArticle.facts.visibleTextLength,
              blockingReasons: htmlValidation.metadata.seoArticle.blockingReasons,
              warnings: htmlValidation.metadata.seoArticle.warnings,
              editorialGrade: htmlValidation.metadata.seoArticle.editorial.grade,
              editorialScore: htmlValidation.metadata.seoArticle.editorial.score,
              editorialBlockingReasons: htmlValidation.metadata.seoArticle.editorial.blockingReasons,
              editorialWarnings: htmlValidation.metadata.seoArticle.editorial.warnings
            }
          },
          updatedContentItemSummary: updated
            ? {
                id: updated.id,
                status: updated.status,
                draftMarkdownMd5: md5(updated.draftMarkdown ?? ""),
                draftHtmlMd5: md5(updated.draftHtml ?? ""),
                draftMarkdownLength: updated.draftMarkdown?.length ?? 0,
                draftHtmlLength: updated.draftHtml?.length ?? 0,
                qualityScore: updated.qualityScore,
                publishedAt: updated.publishedAt,
                scheduledAt: updated.scheduledAt,
                updatedAt: updated.updatedAt
              }
            : null,
          confirmationPolicy: {
            requiredForApply: true,
            phrase: APPLY_CONFIRMATION_PHRASE
          },
          sideEffectSummary: {
            dbRead: true,
            dbWrite: Boolean(updated),
            contentMutation: Boolean(updated),
            mutatedFields: updated ? ["draftMarkdown", "draftHtml"] : [],
            bloggerWrite: false,
            bloggerDraftSave: false,
            bloggerPublish: false,
            scheduledPublish: false,
            postsUpdate: false,
            tokenRefresh: false,
            llmCall: false
          }
        }
      },
      { status: statusCode }
    );
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "SEO editorial candidate apply failed.", 500) }, { status: 400 });
  }
}

function resolveMode(value: unknown): ApplyMode {
  return value === "apply" ? "apply" : "dry_run";
}

function hasExpectedMismatch(expected: unknown, actual: string) {
  return typeof expected === "string" && expected.trim() && expected.trim() !== actual;
}

function md5(value: string) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
