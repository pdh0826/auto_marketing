import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";

export interface DraftValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface DraftValidationContext {
  contentItem?: ContentItemAdmin | null;
  assets?: ContentAssetAdmin[];
}

const MIN_DRAFT_LENGTH = 800;
const FINANCIAL_SAFETY_ERROR_PHRASES = [
  "수익 보장",
  "급등 확정",
  "매수 추천",
  "매도 추천",
  "반드시 오른다",
  "무조건 오른다",
  "손실 없음",
  "리스크 없음",
  "원금 보장",
  "수익률 예시",
  "성공 사례",
  "안전하게 매수",
  "안전한 투자",
  "확실한 수익"
];
const FINANCIAL_SAFETY_WARNING_PHRASES = ["무료 체험", "지금 시작", "신뢰할 수 있는 투자", "매수 타이밍을 잡다", "수익률", "성공", "더 유리합니다"];
const INVESTMENT_CONTEXT_KEYWORDS = [
  "투자",
  "주식",
  "종목",
  "매수",
  "매도",
  "급등",
  "투자 인사이트",
  "수익률",
  "포트폴리오",
  "증권",
  "금융",
  "코인",
  "etf",
  "stock",
  "invest",
  "investment",
  "trading",
  "trade"
];

export function validateDraftMarkdown(markdown: unknown, context: DraftValidationContext = {}): DraftValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof markdown !== "string") {
    return {
      ok: false,
      errors: ["draftMarkdown must be a string."],
      warnings
    };
  }

  const trimmed = markdown.trim();
  if (!trimmed) {
    errors.push("draftMarkdown is empty.");
  }

  if (trimmed.length > 0 && trimmed.length < MIN_DRAFT_LENGTH) {
    errors.push(`draftMarkdown is too short. Minimum length is ${MIN_DRAFT_LENGTH} characters.`);
  }

  if (!/^#\s+\S+/m.test(markdown)) {
    errors.push("draftMarkdown must include an H1 title.");
  }

  if (!/^#{2,3}\s+\S+/m.test(markdown)) {
    warnings.push("draftMarkdown should include H2 or H3 sections.");
  }

  const contentItem = context.contentItem ?? null;
  const planJson = contentItem?.planJson ?? null;
  if (planJson) {
    warnings.push(...validatePlanReflection(markdown, planJson));
    if (Array.isArray(planJson.faq) && planJson.faq.length > 0 && !/(^|\n)#{2,3}\s*(faq|자주 묻|질문)|faq|자주 묻|질문/i.test(markdown)) {
      warnings.push("planJson.faq exists, but the draft does not appear to include an FAQ-like section.");
    }
  }

  const assets = context.assets ?? [];
  if (assets.length > 0 && !/<!--\s*media:/i.test(markdown)) {
    warnings.push("Attached media exists, but the draft does not include media placeholders.");
  }

  const safetyValidation = validateFinancialSafety(markdown, contentItem);
  errors.push(...safetyValidation.errors);
  warnings.push(...safetyValidation.warnings);

  if (needsRiskDisclaimer(contentItem) && !/(리스크|위험|참고|정보 제공|면책|보장하지|투자 판단|손실|risk|disclaimer|reference|informational)/i.test(markdown)) {
    warnings.push("Investment-related or risk-disclaimed content should include risk/reference/disclaimer wording.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function validatePlanReflection(markdown: string, planJson: Record<string, unknown>) {
  const warnings: string[] = [];
  const coreMessage = typeof planJson.coreMessage === "string" ? planJson.coreMessage.trim() : "";
  const outlineItems = Array.isArray(planJson.outline) ? planJson.outline : [];
  const referenceSnippets = [coreMessage, ...outlineItems.map((item) => (typeof item === "string" ? item : JSON.stringify(item)))]
    .map((value) => normalizeSnippet(value))
    .filter((value) => value.length >= 8)
    .slice(0, 5);

  if (referenceSnippets.length === 0) {
    return warnings;
  }

  const normalizedMarkdown = normalizeText(markdown);
  const reflected = referenceSnippets.some((snippet) => normalizedMarkdown.includes(snippet.slice(0, Math.min(snippet.length, 24))));
  if (!reflected) {
    warnings.push("The draft may not reflect the saved planJson coreMessage or outline.");
  }

  return warnings;
}

function validateFinancialSafety(markdown: string, contentItem: ContentItemAdmin | null): Pick<DraftValidationResult, "errors" | "warnings"> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const errorMatches = findPhraseMatches(markdown, FINANCIAL_SAFETY_ERROR_PHRASES);
  const warningMatches = findPhraseMatches(markdown, FINANCIAL_SAFETY_WARNING_PHRASES).filter(
    (warningPhrase) => !errorMatches.some((errorPhrase) => errorPhrase.includes(warningPhrase) || warningPhrase.includes(errorPhrase))
  );
  const strictInvestmentServicePromotion = isStrictInvestmentServicePromotion(contentItem);

  for (const phrase of errorMatches) {
    errors.push(`Financial/investment safety blocked phrase: "${phrase}"`);
  }

  for (const phrase of warningMatches) {
    if (strictInvestmentServicePromotion) {
      errors.push(`Investment service promotion safety phrase requires removal: "${phrase}"`);
    } else {
      warnings.push(`Financial/investment safety caution phrase: "${phrase}"`);
    }
  }

  return { errors, warnings };
}

function needsRiskDisclaimer(contentItem: ContentItemAdmin | null) {
  return Boolean(contentItem?.brandProfile?.riskDisclaimer) || isInvestmentRelatedContent(contentItem);
}

function isStrictInvestmentServicePromotion(contentItem: ContentItemAdmin | null) {
  return contentItem?.mode === "service_promotion" && isInvestmentRelatedContent(contentItem);
}

function isInvestmentRelatedContent(contentItem: ContentItemAdmin | null) {
  if (!contentItem) {
    return false;
  }

  return INVESTMENT_CONTEXT_KEYWORDS.some((keyword) => buildInvestmentContextText(contentItem).includes(keyword.toLowerCase()));
}

function buildInvestmentContextText(contentItem: ContentItemAdmin) {
  const brandProfile = contentItem.brandProfile;
  const fields = [
    contentItem.title,
    contentItem.targetKeyword,
    contentItem.sourceMemo,
    brandProfile?.name,
    brandProfile?.serviceName,
    brandProfile?.shortDescription,
    brandProfile?.longDescription,
    brandProfile?.riskDisclaimer,
    ...(brandProfile?.targetUsers ?? []),
    ...(brandProfile?.coreFeatures ?? []),
    ...(brandProfile?.problemsSolved ?? []),
    ...(brandProfile?.forbiddenPhrases ?? []),
    ...(brandProfile?.preferredPhrases ?? [])
  ];

  return fields
    .filter((field): field is string => typeof field === "string")
    .join(" ")
    .toLowerCase();
}

function findPhraseMatches(value: string, phrases: string[]) {
  const normalized = value.toLowerCase();
  return phrases.filter((phrase) => normalized.includes(phrase.toLowerCase()));
}

function normalizeSnippet(value: string) {
  return normalizeText(value).slice(0, 80);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
