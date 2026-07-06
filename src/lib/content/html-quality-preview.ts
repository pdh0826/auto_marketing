import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { validateHtmlCandidate } from "@/lib/content/html-preview";
import { analyzeSeoArticleHtml } from "@/lib/content/seo-article-quality";

export type QualityCheckStatus = "pass" | "warn" | "fail";
export type QualityCheckSeverity = "required" | "recommended" | "optional";
export type QualityCheckGroup = "structure" | "seo" | "media" | "safety" | "bloggerCompatibility";
export type QualityGrade = "pass" | "warn" | "fail";

export interface HtmlQualityCheck {
  key: string;
  label: string;
  group: QualityCheckGroup;
  status: QualityCheckStatus;
  severity: QualityCheckSeverity;
  message: string;
}

export interface HtmlQualityPreviewResult {
  ready: boolean;
  scorePreview: number;
  grade: QualityGrade;
  checks: HtmlQualityCheck[];
  groups: Record<QualityCheckGroup, HtmlQualityCheck[]>;
  metadata: {
    draftHtmlLength: number;
    visibleTextLength: number;
    headingCount: number;
    h1Count: number;
    h2h3Count: number;
    paragraphCount: number;
    listCount: number;
    blockquoteCount: number;
    codeBlockCount: number;
    mediaReferenceCount: number;
    matchedMediaReferenceCount: number;
    unmatchedMediaReferenceCount: number;
    imageCount: number;
    videoCount: number;
    externalLinkCount: number;
    linkCount: number;
    ctaSignalCount: number;
    questionSignalCount: number;
    seoArticleGrade: "pass" | "warn" | "fail";
    seoArticleScore: number;
    seoArticleBlockingReasonCount: number;
    rawMarkdownHeadingCount: number;
    rawMarkdownListLineCount: number;
    codeBlockTextRatio: number;
  };
}

interface HtmlFacts {
  html: string;
  text: string;
  draftHtmlLength: number;
  headingCount: number;
  h1Count: number;
  h2h3Count: number;
  paragraphCount: number;
  listCount: number;
  blockquoteCount: number;
  codeBlockCount: number;
  imageCount: number;
  videoCount: number;
  linkTags: string[];
  externalLinkCount: number;
  ctaSignalCount: number;
  questionSignalCount: number;
}

export function buildHtmlQualityPreview(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[]): HtmlQualityPreviewResult {
  const html = contentItem.draftHtml ?? "";
  const facts = collectHtmlFacts(html);
  const candidateValidation = validateHtmlCandidate(html, assets, contentItem);
  const seoArticle = analyzeSeoArticleHtml(html, contentItem);
  const checks: HtmlQualityCheck[] = [];

  checks.push(...buildStructureChecks(contentItem, facts));
  checks.push(...buildSeoChecks(contentItem, facts));
  checks.push(...buildMediaChecks(facts, candidateValidation));
  checks.push(...buildSafetyChecks(contentItem, facts, candidateValidation));
  checks.push(...buildBloggerCompatibilityChecks(facts));
  checks.push(...buildSeoArticleTemplateChecks(seoArticle));

  const scorePreview = calculateScore(checks);
  const grade = calculateGrade(checks, scorePreview);
  const groups = groupChecks(checks);

  return {
    ready: Boolean(contentItem.draftHtml?.trim()) && !checks.some((check) => check.status === "fail" && check.severity === "required"),
    scorePreview,
    grade,
    checks,
    groups,
    metadata: {
      draftHtmlLength: facts.draftHtmlLength,
      visibleTextLength: seoArticle.facts.visibleTextLength,
      headingCount: facts.headingCount,
      h1Count: facts.h1Count,
      h2h3Count: facts.h2h3Count,
      paragraphCount: facts.paragraphCount,
      listCount: facts.listCount,
      blockquoteCount: facts.blockquoteCount,
      codeBlockCount: facts.codeBlockCount,
      mediaReferenceCount: candidateValidation.metadata.mediaReferenceCount,
      matchedMediaReferenceCount: candidateValidation.metadata.matchedMediaReferenceCount,
      unmatchedMediaReferenceCount: candidateValidation.metadata.unmatchedMediaReferenceCount,
      imageCount: facts.imageCount,
      videoCount: facts.videoCount,
      externalLinkCount: facts.externalLinkCount,
      linkCount: facts.linkTags.length,
      ctaSignalCount: facts.ctaSignalCount,
      questionSignalCount: facts.questionSignalCount,
      seoArticleGrade: seoArticle.grade,
      seoArticleScore: seoArticle.score,
      seoArticleBlockingReasonCount: seoArticle.blockingReasons.length,
      rawMarkdownHeadingCount: seoArticle.facts.rawMarkdownHeadingCount,
      rawMarkdownListLineCount: seoArticle.facts.rawMarkdownListLineCount,
      codeBlockTextRatio: seoArticle.facts.codeBlockTextRatio
    }
  };
}

function buildStructureChecks(contentItem: ContentItemAdmin, facts: HtmlFacts): HtmlQualityCheck[] {
  return [
    makeCheck(
      "saved_draft_html",
      "Saved draftHtml",
      "structure",
      contentItem.draftHtml?.trim() ? "pass" : "fail",
      "required",
      contentItem.draftHtml?.trim() ? "저장된 draftHtml이 있습니다." : "저장된 draftHtml이 없어 품질검사를 실행할 수 없습니다."
    ),
    makeCheck(
      "html_length",
      "HTML length",
      "structure",
      facts.draftHtmlLength >= 1200 ? "pass" : facts.draftHtmlLength >= 600 ? "warn" : "fail",
      "required",
      facts.draftHtmlLength >= 1200
        ? `HTML 길이가 충분합니다: ${facts.draftHtmlLength}자`
        : facts.draftHtmlLength >= 600
          ? `HTML 길이가 다소 짧습니다: ${facts.draftHtmlLength}자`
          : `HTML 길이가 너무 짧습니다: ${facts.draftHtmlLength}자`
    ),
    makeCheck(
      "article_wrapper",
      "Article wrapper",
      "structure",
      /<\s*article\b/i.test(facts.html) ? "pass" : "warn",
      "recommended",
      /<\s*article\b/i.test(facts.html) ? "article wrapper가 있습니다." : "article wrapper가 없습니다."
    ),
    makeCheck(
      "h1_structure",
      "H1 structure",
      "structure",
      facts.h1Count === 1 ? "pass" : "fail",
      "required",
      facts.h1Count === 1 ? "H1이 1개입니다." : `H1은 1개여야 합니다. 현재 ${facts.h1Count}개입니다.`
    ),
    makeCheck(
      "section_headings",
      "H2/H3 section structure",
      "structure",
      facts.h2h3Count >= 2 ? "pass" : facts.h2h3Count === 1 ? "warn" : "fail",
      "recommended",
      facts.h2h3Count >= 2 ? `H2/H3 섹션이 ${facts.h2h3Count}개입니다.` : "H2/H3 섹션 구조가 부족합니다."
    ),
    makeCheck(
      "paragraph_count",
      "Paragraph count",
      "structure",
      facts.paragraphCount >= 6 ? "pass" : facts.paragraphCount >= 3 ? "warn" : "fail",
      "recommended",
      facts.paragraphCount >= 6 ? `문단이 ${facts.paragraphCount}개입니다.` : `문단 수가 부족합니다: ${facts.paragraphCount}개`
    ),
    makeCheck(
      "rich_structure",
      "Rich structure elements",
      "structure",
      facts.listCount + facts.blockquoteCount + facts.codeBlockCount > 0 ? "pass" : "warn",
      "optional",
      facts.listCount + facts.blockquoteCount + facts.codeBlockCount > 0
        ? "목록, 인용, 코드 등 구조 요소가 포함되어 있습니다."
        : "목록, 인용, 코드 등 보조 구조 요소가 없습니다."
    )
  ];
}

function buildSeoChecks(contentItem: ContentItemAdmin, facts: HtmlFacts): HtmlQualityCheck[] {
  const targetKeyword = contentItem.targetKeyword?.trim();
  const hasTargetKeyword = targetKeyword ? facts.text.toLowerCase().includes(targetKeyword.toLowerCase()) : false;
  const hasServiceLink = Boolean(contentItem.brandProfile?.mainUrl && facts.html.includes(contentItem.brandProfile.mainUrl));
  const relMissingCount = facts.linkTags.filter((tag) => {
    if (!/href\s*=\s*["']https?:\/\//i.test(tag)) {
      return false;
    }
    const rel = tag.match(/\srel\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    return !["nofollow", "noopener", "noreferrer"].every((token) => rel.toLowerCase().includes(token));
  }).length;

  return [
    makeCheck(
      "target_keyword_presence",
      "Target keyword presence",
      "seo",
      !targetKeyword || hasTargetKeyword ? "pass" : "warn",
      "recommended",
      !targetKeyword ? "targetKeyword가 없어 키워드 포함 여부를 건너뜁니다." : hasTargetKeyword ? "targetKeyword가 본문에 포함되어 있습니다." : "targetKeyword가 본문에 직접 포함되어 있지 않습니다."
    ),
    makeCheck(
      "cta_presence",
      "CTA presence",
      "seo",
      facts.ctaSignalCount > 0 ? "pass" : "warn",
      "recommended",
      facts.ctaSignalCount > 0 ? `CTA 신호가 ${facts.ctaSignalCount}개 있습니다.` : "CTA 또는 다음 행동 안내가 약합니다."
    ),
    makeCheck(
      "faq_presence",
      "FAQ or question signals",
      "seo",
      /faq|자주 묻는 질문/i.test(facts.text) || facts.questionSignalCount >= 2 ? "pass" : "warn",
      "optional",
      /faq|자주 묻는 질문/i.test(facts.text) || facts.questionSignalCount >= 2 ? "FAQ 또는 질문형 문장이 있습니다." : "FAQ 섹션 또는 질문형 문장이 부족합니다."
    ),
    makeCheck(
      "external_link_rel",
      "External link rel",
      "seo",
      relMissingCount === 0 ? "pass" : "warn",
      "recommended",
      relMissingCount === 0 ? "외부 링크 rel 속성이 적절합니다." : `외부 링크 중 rel 보강이 필요한 항목이 있습니다: ${relMissingCount}개`
    ),
    makeCheck(
      "service_link",
      "Service or internal link",
      "seo",
      hasServiceLink || facts.linkTags.length > 0 ? "pass" : "warn",
      "optional",
      hasServiceLink ? "서비스 URL 링크가 포함되어 있습니다." : facts.linkTags.length > 0 ? "링크가 포함되어 있습니다." : "내부 링크 또는 서비스 관련 링크가 없습니다."
    )
  ];
}

function buildMediaChecks(facts: HtmlFacts, candidateValidation: ReturnType<typeof validateHtmlCandidate>): HtmlQualityCheck[] {
  const mediaWarnings = candidateValidation.validation.warnings.join(" ");
  const hasWeakAlt = /alt가 없거나 약한 이미지/.test(mediaWarnings);
  const hasNoCaption = /figcaption이 없습니다/.test(mediaWarnings);

  return [
    makeCheck(
      "media_reference_count",
      "Media references",
      "media",
      candidateValidation.metadata.mediaReferenceCount > 0 ? "pass" : "warn",
      "optional",
      candidateValidation.metadata.mediaReferenceCount > 0
        ? `미디어 참조가 ${candidateValidation.metadata.mediaReferenceCount}개 있습니다.`
        : "HTML에 미디어 참조가 없습니다."
    ),
    makeCheck(
      "media_reference_match",
      "Media reference matching",
      "media",
      candidateValidation.metadata.unmatchedMediaReferenceCount === 0 ? "pass" : "fail",
      "required",
      candidateValidation.metadata.unmatchedMediaReferenceCount === 0
        ? "모든 미디어 참조가 현재 content item의 첨부 자산과 매칭됩니다."
        : `매칭되지 않는 미디어 참조가 있습니다: ${candidateValidation.metadata.unmatchedMediaReferenceCount}개`
    ),
    makeCheck(
      "image_alt_quality",
      "Image alt quality",
      "media",
      facts.imageCount === 0 || !hasWeakAlt ? "pass" : "warn",
      "recommended",
      facts.imageCount === 0 ? "이미지가 없습니다." : !hasWeakAlt ? "이미지 alt가 설정되어 있습니다." : "alt가 없거나 약한 이미지가 있습니다."
    ),
    makeCheck(
      "media_caption",
      "Media caption",
      "media",
      facts.imageCount + facts.videoCount === 0 || !hasNoCaption ? "pass" : "warn",
      "optional",
      facts.imageCount + facts.videoCount === 0 ? "미디어가 없습니다." : !hasNoCaption ? "미디어 caption이 있습니다." : "미디어 caption이 부족합니다."
    )
  ];
}

function buildSafetyChecks(contentItem: ContentItemAdmin, facts: HtmlFacts, candidateValidation: ReturnType<typeof validateHtmlCandidate>): HtmlQualityCheck[] {
  const validationHasError = candidateValidation.validation.errors.length > 0;
  const hasRiskyFinancePhrase = findRiskyFinancePhrase(facts.text);
  const investmentContext = isInvestmentContext(contentItem, facts.text);
  const hasDisclaimer = /참고|투자 판단|사용자.*책임|손실|리스크|보장하지|정보 제공/i.test(facts.text);

  return [
    makeCheck(
      "html_security_validation",
      "HTML security validation",
      "safety",
      validationHasError ? "fail" : "pass",
      "required",
      validationHasError ? "HTML 보안 또는 미디어 참조 validation error가 있습니다." : "HTML 보안 validation error가 없습니다."
    ),
    makeCheck(
      "finance_risky_phrases",
      "Finance risky phrases",
      "safety",
      hasRiskyFinancePhrase ? "fail" : "pass",
      "required",
      hasRiskyFinancePhrase ? "금융/투자 위험 표현이 포함되어 있습니다." : "금융/투자 위험 표현이 감지되지 않았습니다."
    ),
    makeCheck(
      "finance_disclaimer",
      "Finance disclaimer",
      "safety",
      !investmentContext || hasDisclaimer ? "pass" : "warn",
      "recommended",
      !investmentContext ? "금융/투자 맥락이 강하지 않아 면책 문구 검사를 통과 처리합니다." : hasDisclaimer ? "투자 참고/책임/리스크 관련 안내가 있습니다." : "투자 참고/책임/리스크 관련 안내가 부족합니다."
    )
  ];
}

function buildBloggerCompatibilityChecks(facts: HtmlFacts): HtmlQualityCheck[] {
  const riskyTagCount = countMatches(facts.html, /<\s*(style|script|form|embed|object|iframe)\b/gi);
  const localPathPattern = /(storagePath|local-data\/|\/uploads\/|file:\/\/|\/Users\/|\/private\/|[A-Za-z]:\\)/i;
  const hasLocalPath = localPathPattern.test(facts.html);
  const hasEventHandler = /\son[a-z]+\s*=/i.test(facts.html);
  const hasJavascriptUrl = /javascript\s*:/i.test(facts.html);

  return [
    makeCheck(
      "blogger_risky_tags",
      "Blogger risky tags",
      "bloggerCompatibility",
      riskyTagCount === 0 ? "pass" : "fail",
      "required",
      riskyTagCount === 0 ? "Blogger 호환성 위험 태그가 없습니다." : `Blogger 호환성 위험 태그가 있습니다: ${riskyTagCount}개`
    ),
    makeCheck(
      "blogger_local_paths",
      "Local path exposure",
      "bloggerCompatibility",
      hasLocalPath ? "fail" : "pass",
      "required",
      hasLocalPath ? "로컬 저장 경로로 보이는 문자열이 포함되어 있습니다." : "로컬 저장 경로로 보이는 문자열이 없습니다."
    ),
    makeCheck(
      "blogger_inline_handlers",
      "Inline event handlers",
      "bloggerCompatibility",
      hasEventHandler || hasJavascriptUrl ? "fail" : "pass",
      "required",
      hasEventHandler || hasJavascriptUrl ? "inline event handler 또는 위험 URL 패턴이 있습니다." : "inline event handler와 위험 URL 패턴이 없습니다."
    )
  ];
}

function buildSeoArticleTemplateChecks(seoArticle: ReturnType<typeof analyzeSeoArticleHtml>): HtmlQualityCheck[] {
  return [
    makeCheck(
      "seo_article_template_gate",
      "SEO article template gate",
      "seo",
      seoArticle.ok ? "pass" : "fail",
      "required",
      seoArticle.ok
        ? `SEO article gate 통과: visible text ${seoArticle.facts.visibleTextLength}자, score ${seoArticle.score}`
        : `SEO article blocker가 있습니다: ${seoArticle.blockingReasons.join(", ")}`
    ),
    makeCheck(
      "seo_visible_text_length",
      "SEO visible text length",
      "seo",
      seoArticle.facts.visibleTextLength >= seoArticle.templatePolicy.minVisibleTextLengthToPublish ? "pass" : "fail",
      "required",
      `visible text ${seoArticle.facts.visibleTextLength}자 / minimum ${seoArticle.templatePolicy.minVisibleTextLengthToPublish}자 / target ${seoArticle.templatePolicy.targetVisibleTextLength}자`
    ),
    makeCheck(
      "seo_raw_markdown_absent",
      "Raw Markdown absent",
      "seo",
      seoArticle.facts.rawMarkdownHeadingCount === 0 && seoArticle.facts.rawMarkdownListLineCount < 4 ? "pass" : "fail",
      "required",
      seoArticle.facts.rawMarkdownHeadingCount === 0 && seoArticle.facts.rawMarkdownListLineCount < 4
        ? "HTML 본문에 raw Markdown heading/list가 남아 있지 않습니다."
        : `raw Markdown 신호가 남아 있습니다: heading ${seoArticle.facts.rawMarkdownHeadingCount}, list ${seoArticle.facts.rawMarkdownListLineCount}`
    ),
    makeCheck(
      "seo_code_block_absent",
      "Article code block absent",
      "seo",
      seoArticle.facts.preBlockCount === 0 && seoArticle.facts.codeBlockTextRatio < 0.05 ? "pass" : "fail",
      "required",
      seoArticle.facts.preBlockCount === 0 && seoArticle.facts.codeBlockTextRatio < 0.05
        ? "일반 블로그 글 본문이 code block 중심이 아닙니다."
        : `code block 중심 HTML로 보입니다: pre ${seoArticle.facts.preBlockCount}, ratio ${seoArticle.facts.codeBlockTextRatio.toFixed(2)}`
    )
  ];
}

function collectHtmlFacts(html: string): HtmlFacts {
  const text = stripTags(html);
  const linkTags = html.match(/<\s*a\b[^>]*>/gi) ?? [];

  return {
    html,
    text,
    draftHtmlLength: html.length,
    headingCount: countMatches(html, /<\s*h[1-6]\b/gi),
    h1Count: countMatches(html, /<\s*h1\b/gi),
    h2h3Count: countMatches(html, /<\s*h[23]\b/gi),
    paragraphCount: countMatches(html, /<\s*p\b/gi),
    listCount: countMatches(html, /<\s*(ul|ol)\b/gi),
    blockquoteCount: countMatches(html, /<\s*blockquote\b/gi),
    codeBlockCount: countMatches(html, /<\s*(pre|code)\b/gi),
    imageCount: countMatches(html, /<\s*img\b/gi),
    videoCount: countMatches(html, /<\s*video\b/gi),
    linkTags,
    externalLinkCount: countMatches(html, /href\s*=\s*["']https?:\/\//gi),
    ctaSignalCount: countMatches(text, /(확인|살펴보기|문의|자세히|공식|서비스|시작|검토|참고|활용)/gi),
    questionSignalCount: countMatches(text, /\?|무엇|어떻게|왜|인가요|할까요|되나요/g)
  };
}

function makeCheck(
  key: string,
  label: string,
  group: QualityCheckGroup,
  status: QualityCheckStatus,
  severity: QualityCheckSeverity,
  message: string
): HtmlQualityCheck {
  return { key, label, group, status, severity, message };
}

function calculateScore(checks: HtmlQualityCheck[]) {
  const score = checks.reduce((current, check) => {
    if (check.status === "pass") {
      return current;
    }

    if (check.status === "fail" && check.severity === "required") {
      return current - 20;
    }
    if (check.status === "fail") {
      return current - 12;
    }
    if (check.severity === "recommended") {
      return current - 5;
    }
    return current - 2;
  }, 100);

  return Math.max(0, Math.min(100, score));
}

function calculateGrade(checks: HtmlQualityCheck[], score: number): QualityGrade {
  if (checks.some((check) => check.status === "fail" && check.severity === "required") || score < 60) {
    return "fail";
  }
  if (checks.some((check) => check.status !== "pass") || score < 80) {
    return "warn";
  }
  return "pass";
}

function groupChecks(checks: HtmlQualityCheck[]): Record<QualityCheckGroup, HtmlQualityCheck[]> {
  return {
    structure: checks.filter((check) => check.group === "structure"),
    seo: checks.filter((check) => check.group === "seo"),
    media: checks.filter((check) => check.group === "media"),
    safety: checks.filter((check) => check.group === "safety"),
    bloggerCompatibility: checks.filter((check) => check.group === "bloggerCompatibility")
  };
}

function stripTags(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function findRiskyFinancePhrase(text: string) {
  return /(수익 보장|급등 확정|매수 추천|매도 추천|반드시 오른다|무조건 오른다|손실 없음|리스크 없음|원금 보장|수익률 예시|성공 사례|안전하게 매수|안전한 투자|확실한 수익)/i.test(text);
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
    text
  ]
    .filter(Boolean)
    .join(" ");

  return /(투자|주식|종목|매수|매도|급등|수익률|원금|ETF|ISA|IRP|차트|뉴스 흐름|인사이트)/i.test(values);
}
