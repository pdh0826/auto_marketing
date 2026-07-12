import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import type { InvestmentJudgmentLedger } from "@/lib/daily-brief/investment-writing-contract";
import type { InvestmentWritingOutline } from "@/lib/daily-brief/investment-writing-outline";
import { prisma } from "@/lib/db/client";
import { buildProject300TistoryMetadata, type Project300TistoryExportMetadata } from "./project300";
import { reviewProject300GeneratedPost, summarizeProject300StyleReview } from "./project300-style-review";
import { inferProject300CategoryKind } from "./project300-voice-variation";

type TistoryExportContentItem = Prisma.ContentItemGetPayload<{
  include: {
    blog: true;
    assets: {
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }];
    };
  };
}>;

export interface TistoryHtmlExportAsset {
  id: string;
  copied: boolean;
  originalName: string;
  fileName: string;
  exportFileName: string | null;
  relativePath: string | null;
  mimeType: string;
  fileSize: number;
  caption: string | null;
  altText: string | null;
  placementHint: string;
  sortOrder: number;
  warning: string | null;
}

export interface TistoryHtmlExportResult {
  generatedAt: string;
  contentItemId: string;
  title: string | null;
  status: string;
  exportDir: string;
  htmlPath: string;
  inlineHtmlPath: string;
  titlePath: string;
  categoryPath: string;
  tagsPath: string;
  uploadChecklistPath: string;
  manifestPath: string;
  localPreviewPath: string;
  localPreviewUrl: string;
  assetCount: number;
  copiedAssetCount: number;
  htmlLength: number;
  inlineHtmlLength: number;
  assetExports: TistoryHtmlExportAsset[];
  project300: Project300TistoryExportMetadata;
  project300StyleReview: ReturnType<typeof summarizeProject300StyleReview>;
  sideEffectSummary: {
    dbRead: true;
    dbWrite: false;
    localFileWrite: true;
    tistoryApiWrite: false;
    bloggerApiWrite: false;
    publish: false;
    tokenRefresh: false;
    llmCall: false;
    contentMutation: false;
  };
  manualSteps: string[];
}

export async function exportTistoryHtmlForContentItem(contentItemId: string): Promise<TistoryHtmlExportResult> {
  const contentItem = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      blog: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!contentItem) {
    throw new Error("content_item_not_found");
  }

  if (!contentItem.draftHtml?.trim()) {
    throw new Error("saved_draft_html_required");
  }

  return writeTistoryHtmlExport(contentItem);
}

async function writeTistoryHtmlExport(contentItem: TistoryExportContentItem): Promise<TistoryHtmlExportResult> {
  const repoRoot = process.cwd();
  const localDataRoot = path.resolve(repoRoot, "local-data");
  const exportDir = path.join(localDataRoot, "tistory-export", contentItem.id);
  const assetsDir = path.join(exportDir, "assets");
  const generatedPreviewDir = path.join(repoRoot, "public", "generated-previews");
  const localPreviewPath = path.join(generatedPreviewDir, `tistory_export_${safeFileName(contentItem.id)}.html`);

  await mkdir(assetsDir, { recursive: true });
  await mkdir(generatedPreviewDir, { recursive: true });

  const assetExports: TistoryHtmlExportAsset[] = [];
  let copiedAssetCount = 0;

  for (const asset of contentItem.assets) {
    const absoluteSource = path.resolve(repoRoot, asset.storagePath);
    if (!isPathInside(absoluteSource, localDataRoot)) {
      assetExports.push({
        id: asset.id,
        copied: false,
        originalName: asset.originalName,
        fileName: asset.fileName,
        exportFileName: null,
        relativePath: null,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
        caption: asset.caption,
        altText: asset.altText,
        placementHint: asset.placementHint,
        sortOrder: asset.sortOrder,
        warning: "asset_storage_path_outside_local_data"
      });
      continue;
    }

    const exportFileName = `${String(asset.sortOrder).padStart(2, "0")}-${asset.id}-${safeFileName(asset.fileName)}`;
    const relativePath = `assets/${exportFileName}`;
    await copyFile(absoluteSource, path.join(assetsDir, exportFileName));
    copiedAssetCount += 1;

    assetExports.push({
      id: asset.id,
      copied: true,
      originalName: asset.originalName,
      fileName: asset.fileName,
      exportFileName,
      relativePath,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      caption: asset.caption,
      altText: asset.altText,
      placementHint: asset.placementHint,
      sortOrder: asset.sortOrder,
      warning: null
    });
  }

  const html = replaceAssetReferences(contentItem.draftHtml ?? "", assetExports);
  const inlineHtml = await inlineAssetDataUrls(html, exportDir, assetExports);
  const project300 = buildProject300TistoryMetadata(contentItem);
  const investmentWritingContext = readInvestmentWritingContext(contentItem.planJson);
  const project300StyleReview = summarizeProject300StyleReview(
    reviewProject300GeneratedPost({
      title: contentItem.title ?? "",
      markdown: contentItem.draftMarkdown ?? "",
      categoryKind: inferProject300CategoryKind(readSelectionMode(contentItem.planJson)),
      subjectNames: investmentWritingContext.subjectNames,
      judgmentLedger: investmentWritingContext.judgmentLedger,
      investmentOutline: investmentWritingContext.outline
    })
  );
  const result: TistoryHtmlExportResult = {
    generatedAt: new Date().toISOString(),
    contentItemId: contentItem.id,
    title: contentItem.title,
    status: contentItem.status,
    exportDir,
    htmlPath: path.join(exportDir, "post.html"),
    inlineHtmlPath: path.join(exportDir, "post-inline.html"),
    titlePath: path.join(exportDir, "post-title.txt"),
    categoryPath: path.join(exportDir, "project300-category.txt"),
    tagsPath: path.join(exportDir, "project300-tags.txt"),
    uploadChecklistPath: path.join(exportDir, "project300-upload-checklist.md"),
    manifestPath: path.join(exportDir, "manifest.json"),
    localPreviewPath,
    localPreviewUrl: `/generated-previews/tistory_export_${safeFileName(contentItem.id)}.html`,
    assetCount: contentItem.assets.length,
    copiedAssetCount,
    htmlLength: html.length,
    inlineHtmlLength: inlineHtml.length,
    assetExports,
    project300,
    project300StyleReview,
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      localFileWrite: true,
      tistoryApiWrite: false,
      bloggerApiWrite: false,
      publish: false,
      tokenRefresh: false,
      llmCall: false,
      contentMutation: false
    },
    manualSteps: [
      `${project300.blogName}(${project300.blogUrl}) 티스토리 관리자에서 글쓰기를 엽니다.`,
      `카테고리는 ${project300.recommendedCategoryLabel}를 권장합니다.`,
      "티스토리 글쓰기 화면을 직접 엽니다.",
      "제목은 post-title.txt의 내용을 사용합니다.",
      "태그는 project300-tags.txt를 참고합니다.",
      "HTML 모드에서 post.html을 붙여넣고, 이미지가 외부에서 보이지 않으면 post-inline.html을 사용해 확인합니다.",
      "티스토리 미리보기에서 이미지, 표, 링크, 문단 간격을 확인한 뒤 수동 저장 또는 발행합니다."
    ]
  };

  await writeFile(result.htmlPath, html, "utf8");
  await writeFile(result.inlineHtmlPath, inlineHtml, "utf8");
  await writeFile(result.titlePath, contentItem.title ?? "", "utf8");
  await writeFile(result.categoryPath, `${project300.recommendedCategoryLabel}\n`, "utf8");
  await writeFile(result.tagsPath, `${project300.recommendedTags.join(", ")}\n`, "utf8");
  await writeFile(result.uploadChecklistPath, buildProject300ChecklistMarkdown(project300), "utf8");
  await writeFile(result.manifestPath, `${JSON.stringify(stripInlineBodies(result), null, 2)}\n`, "utf8");
  await writeFile(localPreviewPath, wrapPreviewHtml(contentItem, inlineHtml, result), "utf8");

  return result;
}

function replaceAssetReferences(html: string, assetExports: TistoryHtmlExportAsset[]) {
  let result = html;
  for (const asset of assetExports) {
    if (!asset.copied || !asset.relativePath) {
      continue;
    }
    const encodedId = encodeURIComponent(asset.id);
    const patterns = [
      `/api/content-assets/${asset.id}/file`,
      `/api/content-assets/${encodedId}/file`,
      `http://localhost:3004/api/content-assets/${asset.id}/file`,
      `http://127.0.0.1:3004/api/content-assets/${asset.id}/file`,
      `http://localhost:3013/api/content-assets/${asset.id}/file`,
      `http://127.0.0.1:3013/api/content-assets/${asset.id}/file`
    ];

    for (const pattern of patterns) {
      result = result.replace(new RegExp(escapeRegExp(pattern), "g"), asset.relativePath);
    }
  }
  return result;
}

async function inlineAssetDataUrls(html: string, exportDir: string, assetExports: TistoryHtmlExportAsset[]) {
  let result = html;
  for (const asset of assetExports) {
    if (!asset.copied || !asset.relativePath) {
      continue;
    }
    const bytes = await readFile(path.join(exportDir, asset.relativePath));
    const dataUrl = `data:${asset.mimeType};base64,${bytes.toString("base64")}`;
    result = result.replace(new RegExp(escapeRegExp(asset.relativePath), "g"), dataUrl);
  }
  return result;
}

function wrapPreviewHtml(contentItem: TistoryExportContentItem, inlineHtml: string, result: TistoryHtmlExportResult) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(contentItem.title ?? "Tistory HTML export preview")}</title>
  <style>
    body { margin: 0; background: #eef3fb; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
    main { max-width: 960px; margin: 0 auto; background: #fff; min-height: 100vh; padding: 48px 56px; box-sizing: border-box; }
    h1, h2, h3 { color: #10264a; line-height: 1.25; }
    p, li { font-size: 17px; line-height: 1.78; }
    img { max-width: 100%; height: auto; border-radius: 10px; border: 1px solid #d8e1ef; }
    figure { margin: 28px 0; }
    figcaption { color: #526070; font-size: 14px; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 15px; }
    th, td { border: 1px solid #dbe5f2; padding: 10px; text-align: left; }
    th { background: #f4f7fb; }
    .bga-export-note { border: 1px solid #d7e3f4; background: #f8fbff; border-radius: 10px; padding: 14px 16px; margin-bottom: 28px; font-size: 14px; color: #45556c; }
  </style>
</head>
<body>
  <main>
    <section class="bga-export-note">
      <strong>Tistory HTML export preview</strong><br />
      contentItemId: ${escapeHtml(result.contentItemId)}<br />
      assetCount: ${result.assetCount}, copiedAssetCount: ${result.copiedAssetCount}<br />
      targetBlog: ${escapeHtml(result.project300.blogName)} / category: ${escapeHtml(result.project300.recommendedCategoryLabel)}<br />
      styleReview: ${escapeHtml(result.project300StyleReview.grade)} / ${result.project300StyleReview.score}<br />
      sideEffects: Tistory API write=false, Blogger API write=false, DB write=false, publish=false
    </section>
    ${inlineHtml}
  </main>
</body>
</html>`;
}

function stripInlineBodies(result: TistoryHtmlExportResult) {
  return {
    ...result,
    assetExports: result.assetExports.map((asset) => ({ ...asset }))
  };
}

function buildProject300ChecklistMarkdown(metadata: Project300TistoryExportMetadata) {
  return `# ${metadata.blogName} 업로드 체크리스트

- Blog: ${metadata.blogUrl}
- Recommended category: ${metadata.recommendedCategoryLabel}
- Recommended tags: ${metadata.recommendedTags.join(", ")}

## Menu Setup

${metadata.menuSetupSteps.map((step) => `- ${step}`).join("\n")}

## Upload Checklist

${metadata.uploadChecklist.map((step) => `- ${step}`).join("\n")}

## Duplicate Content Policy

${metadata.duplicateContentPolicy.map((step) => `- ${step}`).join("\n")}

## Tone Policy

${metadata.tonePolicy.map((step) => `- ${step}`).join("\n")}

## Style + SEO Review

${metadata.seoReviewChecklist.map((step) => `- ${step}`).join("\n")}

## GPT CLI Review Rewrite Loop

${metadata.reviewRewriteLoopPolicy.map((step) => `- ${step}`).join("\n")}
`;
}

function readSelectionMode(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const selection = (value as Record<string, unknown>).selection;
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
    return null;
  }
  const mode = (selection as Record<string, unknown>).mode;
  return typeof mode === "string" ? mode : null;
}

function readInvestmentWritingContext(value: Prisma.JsonValue | null): {
  subjectNames: string[];
  judgmentLedger: InvestmentJudgmentLedger | null;
  outline: InvestmentWritingOutline | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { subjectNames: [], judgmentLedger: null, outline: null };
  }
  const root = value as Record<string, unknown>;
  const selection = root.selection && typeof root.selection === "object" && !Array.isArray(root.selection) ? (root.selection as Record<string, unknown>) : {};
  const subjectNames = Array.isArray(selection.selectedStockNames) ? selection.selectedStockNames.filter((item): item is string => typeof item === "string") : [];
  const writing = root.investmentWriting && typeof root.investmentWriting === "object" && !Array.isArray(root.investmentWriting)
    ? (root.investmentWriting as Record<string, unknown>)
    : null;
  return {
    subjectNames,
    judgmentLedger: writing?.judgmentLedger && typeof writing.judgmentLedger === "object" ? (writing.judgmentLedger as InvestmentJudgmentLedger) : null,
    outline: writing?.outline && typeof writing.outline === "object" ? (writing.outline as InvestmentWritingOutline) : null
  };
}

function safeFileName(value: string) {
  return String(value || "file")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140) || "file";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isPathInside(targetPath: string, rootPath: string) {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
