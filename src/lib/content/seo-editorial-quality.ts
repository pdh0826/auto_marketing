export type SeoEditorialGrade = "pass" | "warn" | "fail";

export interface SeoEditorialQualityAnalysis {
  ok: boolean;
  grade: SeoEditorialGrade;
  score: number;
  blockingReasons: string[];
  warnings: string[];
  facts: {
    visibleTextLength: number;
    brandMentionCount: number;
    brandMentionsPerThousandChars: number;
    primaryKeywordMentionCount: number | null;
    primaryKeywordMentionsPerThousandChars: number | null;
    brokenExpressionCount: number;
    brokenExpressions: string[];
    riskyFinancePhraseCount: number;
    riskyFinancePhrases: string[];
    directTradingSignalCount: number;
    genericHelpPhraseCount: number;
    checklistSignalCount: number;
    exampleSignalCount: number;
    disclaimerSignalCount: number;
  };
  policy: {
    maxBrandMentionsPerThousandChars: number;
    maxPrimaryKeywordMentionsPerThousandChars: number;
    maxGenericHelpPhraseCount: number;
    minChecklistSignalCount: number;
    minExampleSignalCount: number;
  };
}

const BROKEN_EXPRESSION_PATTERNS = [
  /재무\s*报表/g,
  /报表/g,
  /지지역/g,
  /매수\s+대상자/g,
  /과도한\s+간섭/g,
  /결과률/g,
  /가입없이/g,
  /이용가능/g
];

const RISKY_FINANCE_PATTERNS = [
  /수익\s*보장/g,
  /급등\s*확정/g,
  /매수\s*추천/g,
  /매도\s*추천/g,
  /반드시\s*오른다/g,
  /무조건\s*오른다/g,
  /손실\s*없음/g,
  /리스크\s*없음/g,
  /원금\s*보장/g,
  /확실한\s*수익/g,
  /성공\s*사례/g
];

const DIRECT_TRADING_SIGNAL_PATTERN = /(매수\s*신호|매도\s*신호|사야\s*한다|팔아야\s*한다)/g;
const GENERIC_HELP_PHRASE_PATTERN = /(도움(?:이|을)?\s*됩니다|도움을\s*줍니다|쉽게\s*확인할\s*수\s*있습니다|한\s*눈에\s*파악할\s*수\s*있습니다)/g;
const CHECKLIST_SIGNAL_PATTERN = /(체크리스트|확인\s*순서|점검\s*순서|먼저\s*확인|다음\s*기준|확인해야\s*합니다)/g;
const EXAMPLE_SIGNAL_PATTERN = /(예를\s*들어|예시|상황을\s*가정|케이스|반례|실제\s*확인)/g;
const DISCLAIMER_SIGNAL_PATTERN = /(투자\s*판단|참고용|최종\s*판단|사용자.*책임|손실|리스크|보장하지|투자\s*조언이\s*아닙니다)/g;

const POLICY = {
  maxBrandMentionsPerThousandChars: 3,
  maxPrimaryKeywordMentionsPerThousandChars: 8,
  maxGenericHelpPhraseCount: 10,
  minChecklistSignalCount: 4,
  minExampleSignalCount: 3
};

export function analyzeSeoEditorialQuality(input: {
  text: string;
  brandName?: string | null;
  primaryKeyword?: string | null;
}): SeoEditorialQualityAnalysis {
  const text = normalizeText(input.text);
  const visibleTextLength = text.length;
  const brandName = input.brandName?.trim() || null;
  const primaryKeyword = input.primaryKeyword?.trim() || null;
  const brandMentionCount = brandName ? countLiteral(text, brandName) : 0;
  const primaryKeywordMentionCount = primaryKeyword ? countLiteral(text, primaryKeyword) : null;
  const brokenExpressions = collectPatternMatches(text, BROKEN_EXPRESSION_PATTERNS);
  const riskyFinancePhrases = collectPatternMatches(text, RISKY_FINANCE_PATTERNS);
  const directTradingSignalCount = countMatches(text, DIRECT_TRADING_SIGNAL_PATTERN);
  const genericHelpPhraseCount = countMatches(text, GENERIC_HELP_PHRASE_PATTERN);
  const checklistSignalCount = countMatches(text, CHECKLIST_SIGNAL_PATTERN);
  const exampleSignalCount = countMatches(text, EXAMPLE_SIGNAL_PATTERN);
  const disclaimerSignalCount = countMatches(text, DISCLAIMER_SIGNAL_PATTERN);
  const brandMentionsPerThousandChars = perThousand(brandMentionCount, visibleTextLength);
  const primaryKeywordMentionsPerThousandChars = primaryKeywordMentionCount === null ? null : perThousand(primaryKeywordMentionCount, visibleTextLength);
  const blockingReasons = buildBlockingReasons({
    brokenExpressions,
    riskyFinancePhrases,
    brandMentionsPerThousandChars,
    primaryKeywordMentionsPerThousandChars,
    directTradingSignalCount
  });
  const warnings = buildWarnings({
    genericHelpPhraseCount,
    checklistSignalCount,
    exampleSignalCount,
    disclaimerSignalCount,
    brandMentionCount,
    primaryKeywordMentionCount
  });
  const score = calculateScore(blockingReasons, warnings, {
    brandMentionsPerThousandChars,
    primaryKeywordMentionsPerThousandChars,
    genericHelpPhraseCount,
    checklistSignalCount,
    exampleSignalCount
  });
  const grade: SeoEditorialGrade = blockingReasons.length > 0 || score < 70 ? "fail" : warnings.length > 0 || score < 86 ? "warn" : "pass";

  return {
    ok: blockingReasons.length === 0,
    grade,
    score,
    blockingReasons,
    warnings,
    facts: {
      visibleTextLength,
      brandMentionCount,
      brandMentionsPerThousandChars,
      primaryKeywordMentionCount,
      primaryKeywordMentionsPerThousandChars,
      brokenExpressionCount: brokenExpressions.length,
      brokenExpressions,
      riskyFinancePhraseCount: riskyFinancePhrases.length,
      riskyFinancePhrases,
      directTradingSignalCount,
      genericHelpPhraseCount,
      checklistSignalCount,
      exampleSignalCount,
      disclaimerSignalCount
    },
    policy: POLICY
  };
}

function buildBlockingReasons(input: {
  brokenExpressions: string[];
  riskyFinancePhrases: string[];
  brandMentionsPerThousandChars: number;
  primaryKeywordMentionsPerThousandChars: number | null;
  directTradingSignalCount: number;
}) {
  const blockers: string[] = [];

  if (input.brokenExpressions.length > 0) blockers.push("editorial_broken_expression_detected");
  if (input.riskyFinancePhrases.length > 0) blockers.push("editorial_risky_finance_phrase_detected");
  if (input.brandMentionsPerThousandChars > POLICY.maxBrandMentionsPerThousandChars) blockers.push("editorial_brand_repetition_too_high");
  if (
    input.primaryKeywordMentionsPerThousandChars !== null &&
    input.primaryKeywordMentionsPerThousandChars > POLICY.maxPrimaryKeywordMentionsPerThousandChars
  ) {
    blockers.push("editorial_primary_keyword_repetition_too_high");
  }
  if (input.directTradingSignalCount > 2) blockers.push("editorial_direct_trading_signal_overused");

  return Array.from(new Set(blockers));
}

function buildWarnings(input: {
  genericHelpPhraseCount: number;
  checklistSignalCount: number;
  exampleSignalCount: number;
  disclaimerSignalCount: number;
  brandMentionCount: number | null;
  primaryKeywordMentionCount: number | null;
}) {
  const warnings: string[] = [];

  if (input.genericHelpPhraseCount > POLICY.maxGenericHelpPhraseCount) warnings.push("editorial_generic_help_phrasing_repetitive");
  if (input.checklistSignalCount < POLICY.minChecklistSignalCount) warnings.push("editorial_practical_checklist_signal_low");
  if (input.exampleSignalCount < POLICY.minExampleSignalCount) warnings.push("editorial_example_signal_low");
  if (input.disclaimerSignalCount < 2) warnings.push("editorial_finance_disclaimer_signal_low");
  if (input.brandMentionCount === 0) warnings.push("editorial_brand_context_missing");
  if (input.primaryKeywordMentionCount === 0) warnings.push("editorial_primary_keyword_missing");

  return Array.from(new Set(warnings));
}

function calculateScore(
  blockers: string[],
  warnings: string[],
  facts: {
    brandMentionsPerThousandChars: number;
    primaryKeywordMentionsPerThousandChars: number | null;
    genericHelpPhraseCount: number;
    checklistSignalCount: number;
    exampleSignalCount: number;
  }
) {
  let score = 100 - blockers.length * 18 - warnings.length * 5;

  if (facts.brandMentionsPerThousandChars > POLICY.maxBrandMentionsPerThousandChars) {
    score -= Math.min(12, Math.ceil((facts.brandMentionsPerThousandChars - POLICY.maxBrandMentionsPerThousandChars) * 2));
  }
  if (
    facts.primaryKeywordMentionsPerThousandChars !== null &&
    facts.primaryKeywordMentionsPerThousandChars > POLICY.maxPrimaryKeywordMentionsPerThousandChars
  ) {
    score -= Math.min(10, Math.ceil(facts.primaryKeywordMentionsPerThousandChars - POLICY.maxPrimaryKeywordMentionsPerThousandChars));
  }
  if (facts.genericHelpPhraseCount > POLICY.maxGenericHelpPhraseCount) {
    score -= Math.min(8, facts.genericHelpPhraseCount - POLICY.maxGenericHelpPhraseCount);
  }
  if (facts.checklistSignalCount >= POLICY.minChecklistSignalCount && facts.exampleSignalCount >= POLICY.minExampleSignalCount) {
    score += 4;
  }

  return Math.max(0, Math.min(100, score));
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function countLiteral(value: string, literal: string) {
  if (!literal.trim()) {
    return 0;
  }
  return value.split(literal).length - 1;
}

function countMatches(value: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  return value.match(pattern)?.length ?? 0;
}

function collectPatternMatches(value: string, patterns: RegExp[]) {
  const matches: string[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match = pattern.exec(value);
    while (match) {
      if (match[0]) {
        matches.push(match[0]);
      }
      match = pattern.exec(value);
    }
  }
  return Array.from(new Set(matches));
}

function perThousand(count: number, visibleTextLength: number) {
  return visibleTextLength > 0 ? Number(((count / visibleTextLength) * 1000).toFixed(2)) : 0;
}
