import type { ContentItemAdmin } from "@/lib/content/admin-types";

export interface PlanValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_FIELDS = ["titleCandidates", "targetKeyword", "searchIntent", "audience", "coreMessage", "outline", "ctaPlan", "mediaPlan", "faq", "risks"];
const ARRAY_FIELDS = ["titleCandidates", "outline", "mediaPlan", "faq", "risks"];
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
const FINANCIAL_SAFETY_WARNING_PHRASES = ["무료 체험", "지금 시작", "신뢰할 수 있는 투자", "매수 타이밍을 잡다", "수익률", "성공"];
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

export function validatePlanJson(value: Record<string, unknown>, contentItem?: ContentItemAdmin): PlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in value)) {
      warnings.push(`Missing field: ${field}`);
    }
  }

  for (const field of ARRAY_FIELDS) {
    if (field in value && !Array.isArray(value[field])) {
      warnings.push(`Field should be an array: ${field}`);
    }
  }

  const coreMessage = typeof value.coreMessage === "string" ? value.coreMessage.trim() : "";
  const outline = Array.isArray(value.outline) ? value.outline : [];
  if (!coreMessage && outline.length === 0) {
    errors.push("coreMessage or outline must be present.");
  }

  const safetyValidation = validateFinancialSafety(value, contentItem);
  errors.push(...safetyValidation.errors);
  warnings.push(...safetyValidation.warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

function validateFinancialSafety(value: Record<string, unknown>, contentItem?: ContentItemAdmin): Pick<PlanValidationResult, "errors" | "warnings"> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const serializedPlan = JSON.stringify(value);
  const errorMatches = findPhraseMatches(serializedPlan, FINANCIAL_SAFETY_ERROR_PHRASES);
  const warningMatches = findPhraseMatches(serializedPlan, FINANCIAL_SAFETY_WARNING_PHRASES).filter(
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

function findPhraseMatches(value: string, phrases: string[]) {
  const normalized = value.toLowerCase();
  return phrases.filter((phrase) => normalized.includes(phrase.toLowerCase()));
}

function isStrictInvestmentServicePromotion(contentItem?: ContentItemAdmin) {
  if (contentItem?.mode !== "service_promotion" || !contentItem.brandProfile) {
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
