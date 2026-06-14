import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { validateHtmlCandidate, type HtmlCandidateValidationResult } from "@/lib/content/html-preview";
import { buildHtmlQualityPreview, type HtmlQualityPreviewResult } from "@/lib/content/html-quality-preview";

const TARGET_MIN_HTML_LENGTH = 1200;
const FALLBACK_MIN_MARKDOWN_LENGTH = 300;

export type HtmlQualityRepairPreviewSource = "draft_markdown_rule_based_rebuild" | "draft_html_plus_rule_based_repair";

export interface HtmlQualityRepairPreviewResult {
  candidateHtml: string;
  source: HtmlQualityRepairPreviewSource;
  beforeQuality: HtmlQualityPreviewResult;
  afterValidation: HtmlCandidateValidationResult;
  afterQuality: HtmlQualityPreviewResult;
  repairSummary: {
    addedSections: string[];
    targetMinLength: number;
    beforeLength: number;
    afterLength: number;
    ctaAdded: boolean;
    disclaimerAdded: boolean;
    mutationPerformed: false;
    llmUsed: false;
    bloggerApiCalled: false;
  };
}

export function buildHtmlQualityRepairPreview(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[]): HtmlQualityRepairPreviewResult {
  const beforeQuality = buildHtmlQualityPreview(contentItem, assets);
  const source = shouldRebuildFromMarkdown(contentItem) ? "draft_markdown_rule_based_rebuild" : "draft_html_plus_rule_based_repair";
  const baseHtml = source === "draft_markdown_rule_based_rebuild" ? rebuildHtmlFromMarkdown(contentItem) : normalizeExistingDraftHtml(contentItem);
  const repair = appendRepairSections(baseHtml, contentItem, source);
  const candidateHtml = repair.html;
  const afterValidation = validateHtmlCandidate(candidateHtml, assets);
  const afterQuality = buildHtmlQualityPreview(
    {
      ...contentItem,
      draftHtml: candidateHtml
    },
    assets
  );

  return {
    candidateHtml,
    source,
    beforeQuality,
    afterValidation,
    afterQuality,
    repairSummary: {
      addedSections: repair.addedSections,
      targetMinLength: TARGET_MIN_HTML_LENGTH,
      beforeLength: contentItem.draftHtml?.length ?? 0,
      afterLength: candidateHtml.length,
      ctaAdded: repair.ctaAdded,
      disclaimerAdded: repair.disclaimerAdded,
      mutationPerformed: false,
      llmUsed: false,
      bloggerApiCalled: false
    }
  };
}

function shouldRebuildFromMarkdown(contentItem: ContentItemAdmin) {
  const markdownLength = contentItem.draftMarkdown?.trim().length ?? 0;
  const html = contentItem.draftHtml?.trim() ?? "";
  const looksLikePlaceholder = /HTML Preview Candidate|검증된 로컬 preview HTML|본문 요약/.test(html);

  return markdownLength >= FALLBACK_MIN_MARKDOWN_LENGTH && (html.length < 600 || looksLikePlaceholder);
}

function rebuildHtmlFromMarkdown(contentItem: ContentItemAdmin) {
  const markdown = contentItem.draftMarkdown ?? "";
  const blocks = splitMarkdownBlocks(markdown);
  let h1Seen = false;
  const htmlBlocks = blocks
    .map((block, index) => {
      const rendered = renderMarkdownBlock(block, index, h1Seen);
      if (rendered.startsWith("<h1")) {
        h1Seen = true;
      }
      return rendered;
    })
    .filter(Boolean);
  const title = normalizeText(firstHeadingText(markdown) ?? contentItem.title ?? contentItem.targetKeyword ?? "Draft Article", 120);
  const hasH1 = htmlBlocks.some((block) => /^<h1\b/i.test(block));
  const body = hasH1 ? htmlBlocks.join("\n") : [`<h1>${escapeHtml(title)}</h1>`, ...htmlBlocks].join("\n");

  return `<article>\n${body}\n</article>`;
}

function normalizeExistingDraftHtml(contentItem: ContentItemAdmin) {
  const html = contentItem.draftHtml?.trim();
  if (!html) {
    const title = normalizeText(contentItem.title ?? contentItem.targetKeyword ?? "Draft Article", 120);
    return `<article>\n<h1>${escapeHtml(title)}</h1>\n</article>`;
  }

  return /<\s*article\b/i.test(html) ? html : `<article>\n${html}\n</article>`;
}

function appendRepairSections(baseHtml: string, contentItem: ContentItemAdmin, source: HtmlQualityRepairPreviewSource) {
  let html = baseHtml.trim();
  const addedSections: string[] = [];
  const ctaAlreadyPresent = hasCtaSignal(stripTags(html));
  const disclaimerAlreadyPresent = hasDisclaimer(stripTags(html));
  const targetKeyword = normalizeText(contentItem.targetKeyword ?? firstHeadingText(contentItem.draftMarkdown ?? "") ?? contentItem.title ?? "", 80);
  const topic = targetKeyword || normalizeText(contentItem.title ?? "주제", 80);
  const sections: string[] = [];

  if (countMatches(html, /<\s*h[23]\b/gi) < 2) {
    sections.push(renderSection("핵심 점검 포인트", buildChecklist(topic)));
    addedSections.push("structure_checklist");
  }

  if ((html.length + sections.join("\n").length) < TARGET_MIN_HTML_LENGTH) {
    sections.push(renderSection("놓치기 쉬운 판단 기준", buildDecisionGuide(topic)));
    addedSections.push("decision_guide");
  }

  if ((html.length + sections.join("\n").length) < TARGET_MIN_HTML_LENGTH) {
    sections.push(renderSection("실전에서 확인할 흐름", buildPracticalFlow(topic)));
    addedSections.push("practical_flow");
  }

  let ctaAdded = false;
  if (!ctaAlreadyPresent) {
    sections.push(renderSection("다음 행동", [`${topic}에 대해 바로 결론을 내리기보다, 본문에서 정리한 기준을 체크리스트로 다시 확인해 보세요.`, "관련 지표와 자신의 투자 원칙을 함께 검토한 뒤 다음 판단으로 넘어가는 것이 좋습니다."]));
    addedSections.push("cta");
    ctaAdded = true;
  }

  let disclaimerAdded = false;
  if (isInvestmentContext(contentItem, stripTags(html)) && !disclaimerAlreadyPresent) {
    sections.push(renderSection("투자 유의사항", ["이 글은 투자 판단을 돕기 위한 참고용 정보입니다.", "특정 종목의 매수나 매도를 권유하지 않으며, 최종 판단과 책임은 사용자에게 있습니다.", "시장 상황과 개인의 재무 상태에 따라 결과는 달라질 수 있습니다."]));
    addedSections.push("finance_disclaimer");
    disclaimerAdded = true;
  }

  html = insertBeforeArticleClose(html, sections.join("\n"));

  if (source === "draft_html_plus_rule_based_repair" && !addedSections.includes("source_note")) {
    html = insertBeforeArticleClose(html, renderSection("보강 메모", ["현재 저장된 HTML이 짧아 rule-based 보강 후보를 덧붙였습니다.", "내용을 검토한 뒤 필요한 문장만 남기고 수동 반영하세요."]));
    addedSections.push("source_note");
  }

  return {
    html,
    addedSections,
    ctaAdded,
    disclaimerAdded
  };
}

function splitMarkdownBlocks(markdown: string) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function renderMarkdownBlock(block: string, index: number, h1Seen: boolean) {
  const heading = block.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    const level = heading[1].length === 1 && h1Seen ? 2 : Math.min(heading[1].length, 3);
    return `<h${level}>${escapeHtml(heading[2].trim())}</h${level}>`;
  }

  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line))) {
    return `<ul>\n${lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`).join("\n")}\n</ul>`;
  }

  if (lines.length > 1 && lines.every((line) => /^\d+\.\s+/.test(line))) {
    return `<ol>\n${lines.map((line) => `<li>${renderInlineMarkdown(line.replace(/^\d+\.\s+/, ""))}</li>`).join("\n")}\n</ol>`;
  }

  if (lines.length > 1) {
    return lines.map((line) => `<p>${renderInlineMarkdown(line)}</p>`).join("\n");
  }

  if (index === 0 && block.length < 100 && !/[.!?。！？]$/.test(block)) {
    return `<h2>${escapeHtml(block)}</h2>`;
  }

  return `<p>${renderInlineMarkdown(block)}</p>`;
}

function renderInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderSection(title: string, paragraphs: string[]) {
  return `<section>\n<h2>${escapeHtml(title)}</h2>\n${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}\n</section>`;
}

function buildChecklist(topic: string) {
  return [
    `${topic}을 판단할 때는 가격 움직임만 보지 말고 거래량, 뉴스의 성격, 시장 전체 분위기를 함께 확인해야 합니다.`,
    "한 가지 신호만으로 판단하면 매수 타이밍을 놓치거나 반대로 성급하게 진입할 수 있습니다.",
    "초보자일수록 진입 기준, 손실 허용 범위, 확인할 지표를 미리 적어 두는 방식이 도움이 됩니다."
  ];
}

function buildDecisionGuide(topic: string) {
  return [
    `${topic} 관련 의사결정은 빠른 결론보다 반복 가능한 기준을 만드는 것이 중요합니다.`,
    "이미 오른 뒤에 따라가는 상황인지, 아직 확인해야 할 리스크가 남아 있는지 구분해야 합니다.",
    "관심 종목을 바로 매수하기보다 관찰 가격대와 재검토 조건을 정해 두면 감정적인 결정을 줄일 수 있습니다."
  ];
}

function buildPracticalFlow(topic: string) {
  return [
    `실전에서는 ${topic}을 한 번에 맞히려 하기보다, 작은 단위로 가설을 세우고 결과를 기록하는 편이 안전합니다.`,
    "예상과 다른 흐름이 나왔을 때 무엇을 확인할지 정해 두면 다음 판단이 더 일관됩니다.",
    "이 과정을 반복하면 매수 타이밍 자체보다 자신에게 맞는 판단 구조를 만드는 데 도움이 됩니다."
  ];
}

function insertBeforeArticleClose(html: string, addition: string) {
  if (!addition.trim()) {
    return html;
  }
  if (/<\/\s*article\s*>\s*$/i.test(html)) {
    return html.replace(/<\/\s*article\s*>\s*$/i, `${addition}\n</article>`);
  }
  return `${html}\n${addition}`;
}

function firstHeadingText(value: string) {
  return value.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function hasCtaSignal(text: string) {
  return /(확인|살펴보기|문의|자세히|공식|서비스|시작|검토|참고|활용)/i.test(text);
}

function hasDisclaimer(text: string) {
  return /참고|투자 판단|사용자.*책임|손실|리스크|보장하지|정보 제공/i.test(text);
}

function isInvestmentContext(contentItem: ContentItemAdmin, text: string) {
  const values = [
    contentItem.mode,
    contentItem.targetKeyword,
    contentItem.sourceMemo,
    contentItem.blog?.mainTopic,
    contentItem.blog?.targetReader,
    contentItem.brandProfile?.name,
    contentItem.brandProfile?.serviceName,
    contentItem.brandProfile?.shortDescription,
    contentItem.brandProfile?.riskDisclaimer,
    contentItem.draftMarkdown,
    text
  ]
    .filter(Boolean)
    .join(" ");

  return /(투자|주식|종목|매수|매도|급등|수익률|원금|ETF|ISA|IRP|차트|뉴스 흐름|인사이트)/i.test(values);
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) {
    return "";
  }
  return normalized.length > maxLength ? normalized.slice(0, maxLength).trim() : normalized;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}
