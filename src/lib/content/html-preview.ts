import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import type { ReadinessStatus } from "@/lib/content/content-plan-preview";
import { validateDraftMarkdown, type DraftValidationResult } from "@/lib/content/draft-validation";

export interface HtmlReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  message: string;
}

export interface HtmlMediaMapping {
  placeholder: string;
  assetId: string | null;
  assetType: string | null;
  originalName: string | null;
  placement: string | null;
  caption: string | null;
  matched: boolean;
  message: string;
}

export interface HtmlSecurityCheck {
  key: string;
  status: ReadinessStatus;
  message: string;
}

export interface HtmlPreviewDryRunResult {
  ready: boolean;
  checks: HtmlReadinessCheck[];
  draftValidation: DraftValidationResult;
  mediaMappings: HtmlMediaMapping[];
  securityChecks: HtmlSecurityCheck[];
  previewHtml: string;
  metadata: {
    draftMarkdownLength: number;
    previewHtmlLength: number;
    placeholderCount: number;
    matchedPlaceholderCount: number;
    unmatchedPlaceholderCount: number;
    assetWithoutPlaceholderCount: number;
  };
}

interface PlaceholderToken {
  full: string;
  assetId: string;
  placement: string | null;
  caption: string | null;
}

export function buildHtmlPreviewDryRun(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[]): HtmlPreviewDryRunResult {
  const draftMarkdown = contentItem.draftMarkdown ?? "";
  const draftValidation = validateDraftMarkdown(draftMarkdown, { contentItem, assets });
  const placeholders = extractMediaPlaceholders(draftMarkdown);
  const mediaMappings = buildHtmlMediaMappings(placeholders, assets);
  const securityChecks = buildSecurityChecks(draftMarkdown);
  const checks = buildHtmlReadinessChecks(contentItem, draftValidation, mediaMappings, securityChecks);
  const previewHtml = convertMarkdownToHtml(draftMarkdown, placeholders, assets);
  const unmatchedPlaceholderCount = mediaMappings.filter((mapping) => !mapping.matched).length;
  const matchedPlaceholderCount = mediaMappings.length - unmatchedPlaceholderCount;
  const assetWithoutPlaceholderCount = countAssetsWithoutPlaceholder(assets, placeholders);

  return {
    ready: checks.every((check) => check.status !== "fail") && securityChecks.every((check) => check.status !== "fail"),
    checks,
    draftValidation,
    mediaMappings,
    securityChecks,
    previewHtml,
    metadata: {
      draftMarkdownLength: draftMarkdown.length,
      previewHtmlLength: previewHtml.length,
      placeholderCount: placeholders.length,
      matchedPlaceholderCount,
      unmatchedPlaceholderCount,
      assetWithoutPlaceholderCount
    }
  };
}

function buildHtmlReadinessChecks(
  contentItem: ContentItemAdmin,
  draftValidation: DraftValidationResult,
  mediaMappings: HtmlMediaMapping[],
  securityChecks: HtmlSecurityCheck[]
): HtmlReadinessCheck[] {
  const checks: HtmlReadinessCheck[] = [];

  checks.push({
    key: "saved_draft_markdown",
    label: "Saved draftMarkdown",
    status: contentItem.draftMarkdown?.trim() ? "pass" : "fail",
    message: contentItem.draftMarkdown?.trim() ? "저장된 draftMarkdown이 있습니다." : "저장된 draftMarkdown이 없습니다."
  });

  checks.push({
    key: "draft_validation",
    label: "Markdown validation",
    status: draftValidation.ok ? "pass" : "fail",
    message: draftValidation.ok ? "draftMarkdown validation error가 없습니다." : `draftMarkdown validation error가 있습니다: ${draftValidation.errors.length}개`
  });

  if (draftValidation.warnings.length > 0) {
    checks.push({
      key: "draft_validation_warnings",
      label: "Markdown warnings",
      status: "warn",
      message: `draftMarkdown validation warning이 있습니다: ${draftValidation.warnings.length}개`
    });
  }

  const unmatchedCount = mediaMappings.filter((mapping) => !mapping.matched).length;
  checks.push({
    key: "media_placeholder_mapping",
    label: "Media placeholders",
    status: unmatchedCount > 0 ? "warn" : "pass",
    message:
      mediaMappings.length === 0
        ? "media placeholder가 없습니다."
        : unmatchedCount > 0
          ? `매칭되지 않은 media placeholder가 있습니다: ${unmatchedCount}개`
          : `media placeholder ${mediaMappings.length}개가 첨부 자산과 매칭됩니다.`
  });

  const securityFailures = securityChecks.filter((check) => check.status === "fail").length;
  checks.push({
    key: "sanitization_security",
    label: "Sanitization/security",
    status: securityFailures > 0 ? "fail" : "pass",
    message: securityFailures > 0 ? `HTML 변환 전 차단해야 할 보안 패턴이 있습니다: ${securityFailures}개` : "HTML preview는 escaped HTML과 제한된 media markup만 사용합니다."
  });

  return checks;
}

function buildHtmlMediaMappings(placeholders: PlaceholderToken[], assets: ContentAssetAdmin[]): HtmlMediaMapping[] {
  return placeholders.map((placeholder) => {
    const asset = assets.find((item) => item.id === placeholder.assetId) ?? null;

    return {
      placeholder: placeholder.full,
      assetId: placeholder.assetId,
      assetType: asset?.assetType ?? null,
      originalName: asset?.originalName ?? null,
      placement: placeholder.placement ?? asset?.placementHint ?? null,
      caption: placeholder.caption ?? asset?.caption ?? null,
      matched: Boolean(asset),
      message: asset ? "첨부 자산과 매칭됩니다." : "해당 assetId의 첨부 자산을 찾을 수 없습니다."
    };
  });
}

function buildSecurityChecks(markdown: string): HtmlSecurityCheck[] {
  const checks: HtmlSecurityCheck[] = [];
  checks.push({
    key: "raw_html_escaped",
    status: /<\/?[a-z][\s\S]*>/i.test(markdown) ? "warn" : "pass",
    message: /<\/?[a-z][\s\S]*>/i.test(markdown) ? "raw HTML로 보이는 입력은 preview에서 escape됩니다." : "raw HTML 입력이 감지되지 않았습니다."
  });
  checks.push({
    key: "script_like_markup",
    status: /<\s*(script|iframe|object|embed|form|input|button|style|link|meta)\b/i.test(markdown) ? "fail" : "pass",
    message: /<\s*(script|iframe|object|embed|form|input|button|style|link|meta)\b/i.test(markdown)
      ? "script/iframe/form/style 계열 raw HTML은 HTML 변환 전 제거해야 합니다."
      : "차단 대상 raw HTML 태그가 감지되지 않았습니다."
  });
  checks.push({
    key: "javascript_url",
    status: /javascript\s*:/i.test(markdown) ? "fail" : "pass",
    message: /javascript\s*:/i.test(markdown) ? "javascript: URL 패턴이 감지되었습니다." : "javascript: URL 패턴이 감지되지 않았습니다."
  });
  checks.push({
    key: "event_handler_attribute",
    status: /\son[a-z]+\s*=/i.test(markdown) ? "fail" : "pass",
    message: /\son[a-z]+\s*=/i.test(markdown) ? "HTML event handler 속성 패턴이 감지되었습니다." : "HTML event handler 속성 패턴이 감지되지 않았습니다."
  });
  return checks;
}

function convertMarkdownToHtml(markdown: string, placeholders: PlaceholderToken[], assets: ContentAssetAdmin[]) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let inCodeFence = false;
  let codeLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    html.push(`<p>${formatInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    html.push(`<ul>${listItems.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCodeFence) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCodeFence = false;
      } else {
        flushParagraph();
        flushList();
        inCodeFence = true;
      }
      continue;
    }

    if (inCodeFence) {
      codeLines.push(line);
      continue;
    }

    const mediaPlaceholder = placeholders.find((placeholder) => placeholder.full.trim() === line.trim());
    if (mediaPlaceholder) {
      flushParagraph();
      flushList();
      html.push(renderMediaPlaceholder(mediaPlaceholder, assets));
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2].trim())}</h${level}>`);
      continue;
    }

    const blockquoteMatch = line.match(/^>\s+(.+)$/);
    if (blockquoteMatch) {
      flushParagraph();
      flushList();
      html.push(`<blockquote>${formatInlineMarkdown(blockquoteMatch[1].trim())}</blockquote>`);
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1].trim());
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCodeFence) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph();
  flushList();

  return `<article class="content-preview">\n${html.join("\n")}\n</article>`;
}

function renderMediaPlaceholder(placeholder: PlaceholderToken, assets: ContentAssetAdmin[]) {
  const asset = assets.find((item) => item.id === placeholder.assetId) ?? null;
  if (!asset) {
    return `<aside class="media-placeholder media-placeholder-missing" data-asset-id="${escapeAttribute(placeholder.assetId)}">Missing media asset: ${escapeHtml(placeholder.assetId)}</aside>`;
  }

  const caption = placeholder.caption ?? asset.caption ?? "";
  const placement = placeholder.placement ?? asset.placementHint;
  const src = `/api/content-assets/${encodeURIComponent(asset.id)}/file`;
  const escapedCaption = escapeHtml(caption);
  const escapedAlt = escapeAttribute(asset.altText || caption || asset.originalName);
  const media =
    asset.assetType === "image"
      ? `<img src="${src}" alt="${escapedAlt}" loading="lazy" />`
      : `<video src="${src}" controls preload="metadata"></video>`;

  return `<figure class="media-placeholder" data-asset-id="${escapeAttribute(asset.id)}" data-placement="${escapeAttribute(placement)}">${media}${escapedCaption ? `<figcaption>${escapedCaption}</figcaption>` : ""}</figure>`;
}

function extractMediaPlaceholders(markdown: string): PlaceholderToken[] {
  const regex = /<!--\s*media:([^\s]+)([\s\S]*?)-->/g;
  const placeholders: PlaceholderToken[] = [];
  let match = regex.exec(markdown);

  while (match) {
    placeholders.push({
      full: match[0],
      assetId: match[1],
      placement: match[2]?.match(/\bplacement:([^\s]+)/)?.[1] ?? null,
      caption: extractCaption(match[2] ?? "")
    });
    match = regex.exec(markdown);
  }

  return placeholders;
}

function extractCaption(value: string) {
  const quoted = value.match(/\bcaption:"([^"]*)"/);
  if (quoted) {
    return quoted[1];
  }
  const singleQuoted = value.match(/\bcaption:'([^']*)'/);
  if (singleQuoted) {
    return singleQuoted[1];
  }
  return null;
}

function countAssetsWithoutPlaceholder(assets: ContentAssetAdmin[], placeholders: PlaceholderToken[]) {
  const placeholderAssetIds = new Set(placeholders.map((placeholder) => placeholder.assetId));
  return assets.filter((asset) => !placeholderAssetIds.has(asset.id)).length;
}

function formatInlineMarkdown(value: string) {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, text: string, href: string) => {
    return `<a href="${escapeAttribute(href)}" rel="nofollow noopener noreferrer">${escapeHtml(text)}</a>`;
  });
  return output;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
