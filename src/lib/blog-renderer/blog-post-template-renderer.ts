import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";

export type BlogPostTemplatePreviewSource = "manual_draft_candidate" | "stepwise_final_candidate" | "saved_draft_markdown";
export type BlogPostTemplateTheme = "clean_blog";

export interface BlogPostTemplatePreviewResult {
  html: string;
  sourceSummary: {
    source: BlogPostTemplatePreviewSource;
    contentItemId: string;
    titleCandidate: string;
    theme: BlogPostTemplateTheme;
  };
  validationSummary: {
    ok: boolean;
    errors: string[];
    warnings: string[];
    markdownLength: number;
    htmlLength: number;
    h1Count: number;
    h2Count: number;
    h3Count: number;
    paragraphCount: number;
    faqHeadingCount: number;
    mediaPlaceholderCount: number;
    matchedMediaCount: number;
    unmatchedMediaPlaceholderCount: number;
    assetWithoutPlaceholderCount: number;
    unsafePatternCount: number;
    rawHtmlEscaped: boolean;
  };
  metadata: {
    previewOnly: true;
    dbMutation: false;
    llmCall: false;
    bloggerApiCall: false;
    draftHtmlApplied: false;
  };
}

interface BuildBlogPostTemplatePreviewInput {
  contentItem: ContentItemAdmin;
  assets: ContentAssetAdmin[];
  markdown: string;
  source: BlogPostTemplatePreviewSource;
  theme?: BlogPostTemplateTheme;
}

interface PlaceholderToken {
  full: string;
  assetId: string;
  placement: string | null;
  caption: string | null;
}

interface RenderState {
  html: string[];
  paragraph: string[];
  unorderedItems: string[];
  orderedItems: string[];
  inCodeFence: boolean;
  codeLines: string[];
  h2Count: number;
  h3Count: number;
  paragraphCount: number;
}

const BLOCKED_PATTERN = /<\s*(script|iframe|object|embed|form|input|button|style|link|meta)\b|javascript\s*:|\son[a-z]+\s*=/gi;

export function buildBlogPostTemplatePreview(input: BuildBlogPostTemplatePreviewInput): BlogPostTemplatePreviewResult {
  const markdown = input.markdown.trim();
  const placeholders = extractMediaPlaceholders(markdown);
  const rawHtmlEscaped = /<\/?[a-z][\s\S]*>/i.test(markdown);
  const unsafePatternCount = countMatches(markdown, BLOCKED_PATTERN);
  const titleCandidate = resolveTitleCandidate(markdown, input.contentItem);
  const rendered = renderMarkdownBody(markdown, placeholders, input.assets);
  const matchedMediaCount = rendered.matchedMediaCount;
  const unmatchedMediaPlaceholderCount = rendered.unmatchedMediaPlaceholderCount;
  const assetWithoutPlaceholderCount = countAssetsWithoutPlaceholder(input.assets, placeholders);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!markdown) {
    errors.push("Markdown 후보가 비어 있습니다.");
  }
  if (!titleCandidate.trim()) {
    warnings.push("제목 후보가 약합니다. content item title 또는 Markdown H1을 확인하세요.");
  }
  if (rendered.h2Count + rendered.h3Count === 0) {
    warnings.push("H2/H3 섹션이 없습니다.");
  }
  if (unsafePatternCount > 0 || rawHtmlEscaped) {
    warnings.push("raw HTML 또는 차단 대상 패턴은 preview에서 escape 처리됩니다.");
  }
  if (unmatchedMediaPlaceholderCount > 0) {
    warnings.push(`매칭되지 않은 media placeholder가 있습니다: ${unmatchedMediaPlaceholderCount}개`);
  }
  if (input.assets.length > 0 && placeholders.length === 0) {
    warnings.push("첨부 미디어가 있지만 Markdown 후보에 media placeholder가 없습니다.");
  }
  if (!hasCtaSignal(markdown, input.contentItem)) {
    warnings.push("CTA 또는 다음 행동 안내가 약합니다.");
  }

  const html = wrapCleanBlogTemplate({
    title: titleCandidate,
    bodyHtml: rendered.html,
    contentItem: input.contentItem
  });

  if (!html.trim()) {
    errors.push("HTML preview가 비어 있습니다.");
  }

  return {
    html,
    sourceSummary: {
      source: input.source,
      contentItemId: input.contentItem.id,
      titleCandidate,
      theme: input.theme ?? "clean_blog"
    },
    validationSummary: {
      ok: errors.length === 0,
      errors,
      warnings,
      markdownLength: markdown.length,
      htmlLength: html.length,
      h1Count: titleCandidate.trim() ? 1 : 0,
      h2Count: rendered.h2Count,
      h3Count: rendered.h3Count,
      paragraphCount: rendered.paragraphCount,
      faqHeadingCount: countFaqHeadings(markdown),
      mediaPlaceholderCount: placeholders.length,
      matchedMediaCount,
      unmatchedMediaPlaceholderCount,
      assetWithoutPlaceholderCount,
      unsafePatternCount,
      rawHtmlEscaped
    },
    metadata: {
      previewOnly: true,
      dbMutation: false,
      llmCall: false,
      bloggerApiCall: false,
      draftHtmlApplied: false
    }
  };
}

function renderMarkdownBody(markdown: string, placeholders: PlaceholderToken[], assets: ContentAssetAdmin[]) {
  const lines = markdown.split(/\r?\n/);
  const state: RenderState = {
    html: [],
    paragraph: [],
    unorderedItems: [],
    orderedItems: [],
    inCodeFence: false,
    codeLines: [],
    h2Count: 0,
    h3Count: 0,
    paragraphCount: 0
  };
  let skippedFirstH1 = false;
  let matchedMediaCount = 0;
  let unmatchedMediaPlaceholderCount = 0;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (state.inCodeFence) {
        state.html.push(`<pre><code>${escapeHtml(state.codeLines.join("\n"))}</code></pre>`);
        state.codeLines = [];
        state.inCodeFence = false;
      } else {
        flushParagraph(state);
        flushLists(state);
        state.inCodeFence = true;
      }
      continue;
    }

    if (state.inCodeFence) {
      state.codeLines.push(line);
      continue;
    }

    const mediaPlaceholder = placeholders.find((placeholder) => placeholder.full.trim() === line.trim());
    if (mediaPlaceholder) {
      flushParagraph(state);
      flushLists(state);
      const rendered = renderMediaPlaceholder(mediaPlaceholder, assets);
      state.html.push(rendered.html);
      if (rendered.matched) {
        matchedMediaCount += 1;
      } else {
        unmatchedMediaPlaceholderCount += 1;
      }
      continue;
    }

    if (!line.trim()) {
      flushParagraph(state);
      flushLists(state);
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(state);
      flushLists(state);
      const level = headingMatch[1].length;
      if (level === 1 && !skippedFirstH1) {
        skippedFirstH1 = true;
        continue;
      }
      const normalizedLevel = Math.min(Math.max(level, 2), 3);
      if (normalizedLevel === 2) {
        state.h2Count += 1;
      }
      if (normalizedLevel === 3) {
        state.h3Count += 1;
      }
      state.html.push(`<h${normalizedLevel}>${formatInlineMarkdown(headingMatch[2].trim())}</h${normalizedLevel}>`);
      continue;
    }

    const blockquoteMatch = line.match(/^>\s+(.+)$/);
    if (blockquoteMatch) {
      flushParagraph(state);
      flushLists(state);
      state.html.push(`<blockquote>${formatInlineMarkdown(blockquoteMatch[1].trim())}</blockquote>`);
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph(state);
      flushOrderedList(state);
      state.unorderedItems.push(unorderedMatch[1].trim());
      continue;
    }

    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph(state);
      flushUnorderedList(state);
      state.orderedItems.push(orderedMatch[1].trim());
      continue;
    }

    state.paragraph.push(line.trim());
  }

  if (state.inCodeFence) {
    state.html.push(`<pre><code>${escapeHtml(state.codeLines.join("\n"))}</code></pre>`);
  }
  flushParagraph(state);
  flushLists(state);

  return {
    html: state.html.join("\n"),
    h2Count: state.h2Count,
    h3Count: state.h3Count,
    paragraphCount: state.paragraphCount,
    matchedMediaCount,
    unmatchedMediaPlaceholderCount
  };
}

function wrapCleanBlogTemplate(input: { title: string; bodyHtml: string; contentItem: ContentItemAdmin }) {
  const subtitleParts = [input.contentItem.targetKeyword, input.contentItem.blog?.name, input.contentItem.brandProfile?.serviceName].filter(Boolean);
  const riskDisclaimer = input.contentItem.brandProfile?.riskDisclaimer?.trim() ?? "";
  const cta = input.contentItem.brandProfile?.ctaWeak?.trim() || input.contentItem.brandProfile?.ctaNormal?.trim() || "";

  return [
    '<article class="bga-post bga-theme-clean-blog">',
    '  <header class="bga-post-header">',
    `    <h1>${formatInlineMarkdown(input.title)}</h1>`,
    subtitleParts.length > 0 ? `    <p class="bga-post-meta">${escapeHtml(subtitleParts.join(" · "))}</p>` : "",
    "  </header>",
    '  <div class="bga-post-body">',
    indentHtml(input.bodyHtml, 4),
    "  </div>",
    cta ? `  <aside class="bga-post-cta"><h2>다음 확인 사항</h2><p>${formatInlineMarkdown(cta)}</p></aside>` : "",
    riskDisclaimer ? `  <aside class="bga-post-disclaimer"><h2>참고 및 유의사항</h2><p>${formatInlineMarkdown(riskDisclaimer)}</p></aside>` : "",
    "</article>"
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function flushParagraph(state: RenderState) {
  if (state.paragraph.length === 0) {
    return;
  }
  state.html.push(`<p>${formatInlineMarkdown(state.paragraph.join(" "))}</p>`);
  state.paragraph = [];
  state.paragraphCount += 1;
}

function flushLists(state: RenderState) {
  flushUnorderedList(state);
  flushOrderedList(state);
}

function flushUnorderedList(state: RenderState) {
  if (state.unorderedItems.length === 0) {
    return;
  }
  state.html.push(`<ul>${state.unorderedItems.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ul>`);
  state.unorderedItems = [];
}

function flushOrderedList(state: RenderState) {
  if (state.orderedItems.length === 0) {
    return;
  }
  state.html.push(`<ol>${state.orderedItems.map((item) => `<li>${formatInlineMarkdown(item)}</li>`).join("")}</ol>`);
  state.orderedItems = [];
}

function renderMediaPlaceholder(placeholder: PlaceholderToken, assets: ContentAssetAdmin[]) {
  const asset = assets.find((item) => item.id === placeholder.assetId) ?? null;
  if (!asset) {
    return {
      matched: false,
      html: `<aside class="bga-media-warning" data-asset-id="${escapeAttribute(placeholder.assetId)}">Media placeholder could not be resolved.</aside>`
    };
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

  return {
    matched: true,
    html: `<figure class="bga-media" data-asset-id="${escapeAttribute(asset.id)}" data-placement="${escapeAttribute(placement)}">${media}${escapedCaption ? `<figcaption>${escapedCaption}</figcaption>` : ""}</figure>`
  };
}

function resolveTitleCandidate(markdown: string, contentItem: ContentItemAdmin) {
  const markdownTitle = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const planTitle = extractPlanTitle(contentItem.planJson);
  return markdownTitle || planTitle || contentItem.title || contentItem.sourceMemo?.split(/\r?\n/)[0]?.trim() || "Untitled draft";
}

function extractPlanTitle(planJson: Record<string, unknown> | null) {
  if (!planJson) {
    return null;
  }
  if (typeof planJson.title === "string") {
    return planJson.title;
  }
  if (Array.isArray(planJson.titleCandidates) && typeof planJson.titleCandidates[0] === "string") {
    return planJson.titleCandidates[0];
  }
  return null;
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

function countFaqHeadings(markdown: string) {
  const headings = markdown.match(/^#{2,6}\s+.*(faq|자주 묻는 질문|질문과 답변|q&a|qa)/gim) ?? [];
  return headings.length;
}

function hasCtaSignal(markdown: string, contentItem: ContentItemAdmin) {
  const cta = [contentItem.brandProfile?.ctaWeak, contentItem.brandProfile?.ctaNormal, contentItem.brandProfile?.ctaStrong].filter(Boolean).join(" ");
  return /(확인|살펴보기|문의|자세히|공식|서비스|시작|검토|참고|활용)/i.test(`${markdown} ${cta}`);
}

function countMatches(value: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  return value.match(pattern)?.length ?? 0;
}

function indentHtml(value: string, spaces: number) {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function formatInlineMarkdown(value: string) {
  const codeTokens: string[] = [];
  let output = escapeHtml(value).replace(/`([^`]+)`/g, (_match, code: string) => {
    const token = `@@BGA_CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  output = output.replace(/(^|[\s(])_([^_\n]+)_/g, "$1<em>$2</em>");
  output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, text: string, href: string) => {
    return `<a href="${escapeAttribute(href)}" rel="nofollow noopener noreferrer">${escapeHtml(text)}</a>`;
  });
  codeTokens.forEach((token, index) => {
    output = output.replace(`@@BGA_CODE_${index}@@`, token);
  });
  return output;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
