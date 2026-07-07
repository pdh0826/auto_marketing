import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { analyzeSeoEditorialQuality } from "@/lib/content/seo-editorial-quality";
import { SEO_ARTICLE_TEMPLATE_V1, buildSeoSearchIntentSpec } from "@/lib/content/seo-article-template";

export type SeoArticleGrade = "pass" | "warn" | "fail";

export interface SeoArticleQualityAnalysis {
  ok: boolean;
  grade: SeoArticleGrade;
  score: number;
  blockingReasons: string[];
  warnings: string[];
  facts: {
    htmlLength: number;
    visibleTextLength: number;
    articleCount: number;
    h1Count: number;
    h2Count: number;
    h3Count: number;
    paragraphCount: number;
    listCount: number;
    codeBlockCount: number;
    preBlockCount: number;
    codeBlockTextRatio: number;
    rawMarkdownHeadingCount: number;
    rawMarkdownListLineCount: number;
    faqQuestionCount: number;
    ctaSignalCount: number;
    financeDisclaimerDetected: boolean;
    targetKeywordPresent: boolean | null;
    editorialGrade: "pass" | "warn" | "fail";
    editorialScore: number;
    editorialBlockingReasonCount: number;
    editorialWarningCount: number;
    editorialBrokenExpressionCount: number;
    editorialBrandMentionCount: number;
    editorialBrandMentionsPerThousandChars: number;
    editorialPrimaryKeywordMentionCount: number | null;
    editorialPrimaryKeywordMentionsPerThousandChars: number | null;
    editorialDirectTradingSignalCount: number;
    editorialGenericHelpPhraseCount: number;
  };
  editorial: ReturnType<typeof analyzeSeoEditorialQuality>;
  templatePolicy: {
    version: string;
    targetVisibleTextLength: number;
    minVisibleTextLengthToPublish: number;
    minH2Count: number;
    minParagraphCount: number;
    minFaqCount: number;
  };
}

const CTA_PATTERN = /(확인|살펴보기|점검|검토|공식|서비스|참고|활용|다음|체크)/gi;
const DISCLAIMER_PATTERN = /(투자 판단|참고용|사용자.*책임|손실|리스크|보장하지|정보 제공|최종.*판단)/i;
const RAW_MARKDOWN_HEADING_PATTERN = /(^|\n)\s{0,3}#{1,6}\s+\S/g;
const RAW_MARKDOWN_LIST_PATTERN = /(^|\n)\s{0,3}[-*]\s+\S/g;

export function analyzeSeoArticleHtml(html: string, contentItem?: ContentItemAdmin | null): SeoArticleQualityAnalysis {
  const safeHtml = typeof html === "string" ? html : "";
  const visibleText = extractVisibleText(safeHtml);
  const codeText = extractCodeBlockText(safeHtml);
  const intent = contentItem ? buildSeoSearchIntentSpec(contentItem) : null;
  const targetKeyword = intent?.targetKeyword ?? null;
  const brandName = contentItem?.brandProfile?.serviceName ?? contentItem?.brandProfile?.name ?? null;
  const editorial = analyzeSeoEditorialQuality({
    text: visibleText,
    brandName,
    primaryKeyword: targetKeyword
  });
  const facts = {
    htmlLength: safeHtml.length,
    visibleTextLength: visibleText.length,
    articleCount: countMatches(safeHtml, /<\s*article\b/gi),
    h1Count: countMatches(safeHtml, /<\s*h1\b/gi),
    h2Count: countMatches(safeHtml, /<\s*h2\b/gi),
    h3Count: countMatches(safeHtml, /<\s*h3\b/gi),
    paragraphCount: countMatches(safeHtml, /<\s*p\b/gi),
    listCount: countMatches(safeHtml, /<\s*(ul|ol)\b/gi),
    codeBlockCount: countMatches(safeHtml, /<\s*code\b/gi),
    preBlockCount: countMatches(safeHtml, /<\s*pre\b/gi),
    codeBlockTextRatio: visibleText.length > 0 ? Math.min(1, codeText.length / visibleText.length) : 0,
    rawMarkdownHeadingCount: countMatches(visibleText, RAW_MARKDOWN_HEADING_PATTERN),
    rawMarkdownListLineCount: countMatches(visibleText, RAW_MARKDOWN_LIST_PATTERN),
    faqQuestionCount: countFaqQuestions(safeHtml, visibleText),
    ctaSignalCount: countMatches(visibleText, CTA_PATTERN),
    financeDisclaimerDetected: DISCLAIMER_PATTERN.test(visibleText),
    targetKeywordPresent: targetKeyword ? visibleText.toLowerCase().includes(targetKeyword.toLowerCase()) : null,
    editorialGrade: editorial.grade,
    editorialScore: editorial.score,
    editorialBlockingReasonCount: editorial.blockingReasons.length,
    editorialWarningCount: editorial.warnings.length,
    editorialBrokenExpressionCount: editorial.facts.brokenExpressionCount,
    editorialBrandMentionCount: editorial.facts.brandMentionCount,
    editorialBrandMentionsPerThousandChars: editorial.facts.brandMentionsPerThousandChars,
    editorialPrimaryKeywordMentionCount: editorial.facts.primaryKeywordMentionCount,
    editorialPrimaryKeywordMentionsPerThousandChars: editorial.facts.primaryKeywordMentionsPerThousandChars,
    editorialDirectTradingSignalCount: editorial.facts.directTradingSignalCount,
    editorialGenericHelpPhraseCount: editorial.facts.genericHelpPhraseCount
  };
  const blockingReasons = buildBlockingReasons(safeHtml, facts, editorial);
  const warnings = buildWarnings(facts, editorial);
  const score = calculateSeoScore(blockingReasons, warnings, facts);
  const grade: SeoArticleGrade = blockingReasons.length > 0 || score < 70 ? "fail" : warnings.length > 0 || score < 85 ? "warn" : "pass";

  return {
    ok: blockingReasons.length === 0,
    grade,
    score,
    blockingReasons,
    warnings,
    facts,
    editorial,
    templatePolicy: {
      version: SEO_ARTICLE_TEMPLATE_V1.version,
      targetVisibleTextLength: SEO_ARTICLE_TEMPLATE_V1.targetVisibleTextLength,
      minVisibleTextLengthToPublish: SEO_ARTICLE_TEMPLATE_V1.minVisibleTextLengthToPublish,
      minH2Count: SEO_ARTICLE_TEMPLATE_V1.minH2Count,
      minParagraphCount: SEO_ARTICLE_TEMPLATE_V1.minParagraphCount,
      minFaqCount: SEO_ARTICLE_TEMPLATE_V1.minFaqCount
    }
  };
}

function buildBlockingReasons(html: string, facts: SeoArticleQualityAnalysis["facts"], editorial: SeoArticleQualityAnalysis["editorial"]) {
  const blockers: string[] = [];

  if (!html.trim()) blockers.push("draft_html_missing");
  if (facts.preBlockCount > 0 && facts.codeBlockTextRatio >= 0.3) blockers.push("html_is_code_block");
  if (facts.rawMarkdownHeadingCount > 0) blockers.push("html_contains_raw_markdown_headings");
  if (facts.rawMarkdownListLineCount >= 4 && facts.paragraphCount < SEO_ARTICLE_TEMPLATE_V1.minParagraphCount) blockers.push("html_contains_raw_markdown_lists");
  if (facts.visibleTextLength > 0 && facts.visibleTextLength < SEO_ARTICLE_TEMPLATE_V1.minVisibleTextLengthToPublish) blockers.push("html_visible_text_too_short");
  if (facts.articleCount < 1) blockers.push("html_article_structure_invalid");
  if (facts.h1Count !== 1) blockers.push("html_h1_structure_invalid");
  if (facts.h2Count < SEO_ARTICLE_TEMPLATE_V1.minH2Count) blockers.push("html_h2_count_too_low");
  if (facts.paragraphCount < SEO_ARTICLE_TEMPLATE_V1.minParagraphCount) blockers.push("html_paragraph_count_too_low");
  if (facts.faqQuestionCount < SEO_ARTICLE_TEMPLATE_V1.minFaqCount) blockers.push("html_faq_count_too_low");
  if (!facts.financeDisclaimerDetected) blockers.push("html_finance_disclaimer_missing");
  blockers.push(...editorial.blockingReasons);

  return Array.from(new Set(blockers));
}

function buildWarnings(facts: SeoArticleQualityAnalysis["facts"], editorial: SeoArticleQualityAnalysis["editorial"]) {
  const warnings: string[] = [];

  if (facts.visibleTextLength >= SEO_ARTICLE_TEMPLATE_V1.minVisibleTextLengthToPublish && facts.visibleTextLength < SEO_ARTICLE_TEMPLATE_V1.minVisibleTextLengthWarning) {
    warnings.push("html_visible_text_below_seo_target");
  }
  if (facts.targetKeywordPresent === false) {
    warnings.push("target_keyword_not_detected");
  }
  if (facts.ctaSignalCount === 0) {
    warnings.push("cta_signal_not_detected");
  }
  if (facts.listCount === 0) {
    warnings.push("html_list_structure_missing");
  }
  warnings.push(...editorial.warnings);

  return Array.from(new Set(warnings));
}

function calculateSeoScore(blockers: string[], warnings: string[], facts: SeoArticleQualityAnalysis["facts"]) {
  let score = 100 - blockers.length * 14 - warnings.length * 4;
  if (facts.visibleTextLength < SEO_ARTICLE_TEMPLATE_V1.targetVisibleTextLength) {
    score -= Math.min(18, Math.ceil((SEO_ARTICLE_TEMPLATE_V1.targetVisibleTextLength - facts.visibleTextLength) / 150));
  }
  if (facts.codeBlockTextRatio > 0) {
    score -= Math.ceil(facts.codeBlockTextRatio * 30);
  }
  return Math.max(0, Math.min(100, score));
}

function extractVisibleText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<\s*(script|style|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\s*\/\s*(p|h[1-6]|li|blockquote|pre|div|section|article)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function extractCodeBlockText(html: string) {
  const matches = html.match(/<\s*pre\b[\s\S]*?<\s*\/\s*pre\s*>/gi) ?? [];
  return extractVisibleText(matches.join("\n"));
}

function countFaqQuestions(html: string, visibleText: string) {
  const faqHeadingCount = countMatches(html, /<\s*h[23]\b[^>]*>\s*(faq|자주 묻|질문|q&amp;a|q&a)/gi);
  const questionHeadingCount = countMatches(html, /<\s*h3\b[^>]*>[\s\S]*?(\?|인가요|되나요|할까요|무엇|어떻게|왜)[\s\S]*?<\s*\/\s*h3\s*>/gi);
  const textQuestionCount = countMatches(visibleText, /(\?|인가요|되나요|할까요|무엇인가요|어떻게 하나요|왜 그런가요)/g);
  return Math.max(faqHeadingCount > 0 ? SEO_ARTICLE_TEMPLATE_V1.minFaqCount : 0, questionHeadingCount, Math.min(textQuestionCount, 5));
}

function countMatches(value: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  return value.match(pattern)?.length ?? 0;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCharCode(value) : "";
    });
}
