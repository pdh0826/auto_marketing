import { createHash } from "crypto";
import { PROJECT300_INVESTMENT_FORBIDDEN_PATTERNS } from "@/lib/tistory/project300-investment-voice-corpus";
import type { InvestmentJudgmentLedger } from "./investment-writing-contract";
import type { InvestmentWritingOutline } from "./investment-writing-outline";

export const INVESTMENT_WRITING_REVIEW_VERSION = "investment_writing_review_v1";

export interface InvestmentWritingDraftReview {
  version: typeof INVESTMENT_WRITING_REVIEW_VERSION;
  ok: boolean;
  antiAiScore: number;
  blockers: string[];
  warnings: string[];
  internalWorkflowLeaks: string[];
  unsupportedFirstPersonClaims: string[];
  substitutionTestWarnings: string[];
  repeatedOpeningWarnings: string[];
  repeatedPhraseWarnings: string[];
  safeMetadata: {
    markdownHash: string;
    markdownLength: number;
    paragraphCount: number;
    uniqueOpeningRatio: number;
  };
}

export function reviewInvestmentWritingDraft(input: {
  markdown: string;
  subjectNames: string[];
  judgmentLedger?: InvestmentJudgmentLedger | null;
  outline?: InvestmentWritingOutline | null;
}): InvestmentWritingDraftReview {
  const markdown = input.markdown.trim();
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(
      (item) =>
        item &&
        !item.startsWith("|") &&
        !item.startsWith("![") &&
        !item.startsWith("#") &&
        !item.startsWith("<!--") &&
        !item.startsWith("- ")
    );
  const internalWorkflowLeaks = findMatches(markdown, [
    /RSS\s*검색/gi,
    /자동\s*수집(?:된|한)?\s*(?:결과|뉴스|자료)/gi,
    /기사\s*전문(?:은|을)?\s*저장하지/gi,
    /검토\s*후보/gi,
    /자료를\s*먼저\s*모아보면/gi,
    /글쓰기\s*전에\s*모아둔/gi,
    /수동\s*확인\s*후보/gi
  ]);
  const firstPersonParagraphs = paragraphs.filter((paragraph) => /저는|제가|제\s*기준/.test(paragraph));
  const canUseFirstPerson = Boolean(
    input.judgmentLedger?.judgments.length ||
      input.judgmentLedger?.actions.length ||
      input.judgmentLedger?.firstImpression ||
      input.judgmentLedger?.noActionReason ||
      input.judgmentLedger?.mainConcern
  );
  const unsupportedFirstPersonClaims = canUseFirstPerson ? [] : firstPersonParagraphs.map((paragraph) => summarizeParagraph(paragraph));
  const substitutionTestWarnings = paragraphs
    .filter((paragraph) => looksGenericAfterSubjectSubstitution(paragraph, input.subjectNames))
    .map((paragraph) => summarizeParagraph(paragraph));
  const openings = paragraphs.map((paragraph) => normalizeOpening(paragraph, input.subjectNames)).filter(Boolean);
  const openingCounts = countValues(openings);
  const repeatedOpeningWarnings = Array.from(openingCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([opening, count]) => `repeated_opening:${opening}:${count}`);
  const repeatedPhraseWarnings = findRepeatedPhrases(markdown);
  const repeatedSentenceWarnings = findRepeatedSentences(markdown);
  const forbiddenMatches = PROJECT300_INVESTMENT_FORBIDDEN_PATTERNS.filter((pattern) => markdown.includes(pattern));
  const blockers = [
    ...internalWorkflowLeaks.map((item) => `internal_workflow_leak:${item}`),
    ...unsupportedFirstPersonClaims.map((_, index) => `unsupported_first_person_claim:${index + 1}`),
    ...repeatedSentenceWarnings.map((item) => `repeated_exact_sentence:${item}`),
    ...forbiddenMatches.map((item) => `forbidden_investment_pattern:${item}`)
  ];
  const warnings = [
    ...substitutionTestWarnings.map((_, index) => `stock_name_substitution_warning:${index + 1}`),
    ...repeatedOpeningWarnings,
    ...repeatedPhraseWarnings,
    ...(input.outline && !input.outline.ready ? ["investment_outline_not_ready"] : [])
  ];
  const uniqueOpeningRatio = openings.length ? new Set(openings).size / openings.length : 1;
  const antiAiScore = clamp(
    100 - blockers.length * 25 - substitutionTestWarnings.length * 5 - repeatedOpeningWarnings.length * 8 - repeatedPhraseWarnings.length * 5
  );

  return {
    version: INVESTMENT_WRITING_REVIEW_VERSION,
    ok: blockers.length === 0 && antiAiScore >= 80 && substitutionTestWarnings.length <= 2,
    antiAiScore,
    blockers: unique(blockers),
    warnings: unique(warnings),
    internalWorkflowLeaks,
    unsupportedFirstPersonClaims,
    substitutionTestWarnings,
    repeatedOpeningWarnings,
    repeatedPhraseWarnings,
    safeMetadata: {
      markdownHash: createHash("sha256").update(markdown).digest("hex"),
      markdownLength: markdown.length,
      paragraphCount: paragraphs.length,
      uniqueOpeningRatio: Math.round(uniqueOpeningRatio * 1000) / 1000
    }
  };
}

function looksGenericAfterSubjectSubstitution(paragraph: string, subjectNames: string[]) {
  if (paragraph.length < 100) return false;
  let normalized = paragraph;
  subjectNames.forEach((name) => {
    normalized = normalized.split(name).join("[종목]");
  });
  normalized = normalized
    .replace(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/g, "[날짜]")
    .replace(/[+-]?\d[\d,.]*%?/g, "[숫자]")
    .replace(/\[[^\]]+]\([^)]+\)/g, "[링크]");
  const genericSignals = ["현재가", "진입", "목표가", "손절", "다시", "확인", "흐름", "뉴스", "공시"].filter((item) => normalized.includes(item)).length;
  const uniqueEvidenceSignals = /기사|공시|실적|수급|거래대금|이평선|볼린저|신호일|업종|보유|매수하지|제외/.test(normalized);
  return genericSignals >= 4 && !uniqueEvidenceSignals;
}

function normalizeOpening(paragraph: string, subjectNames: string[]) {
  let value = paragraph.replace(/[*_`#]/g, "").replace(/\[[^\]]+]\([^)]+\)/g, "링크");
  subjectNames.forEach((name) => {
    value = value.split(name).join("종목");
  });
  return value.replace(/[+-]?\d[\d,.]*%?/g, "숫자").replace(/\s+/g, " ").trim().slice(0, 32);
}

function findRepeatedPhrases(markdown: string) {
  const phrases = ["먼저 봅니다", "확인해 보겠습니다", "다시 볼", "아쉬운 점", "정리하면", "제 기준", "차트와 뉴스", "흐름이 이어지는지"];
  return phrases.flatMap((phrase) => {
    const count = markdown.split(phrase).length - 1;
    return count >= 2 ? [`repeated_phrase:${phrase}:${count}`] : [];
  });
}

function findRepeatedSentences(markdown: string) {
  const sentences = markdown
    .replace(/<!--[^>]+-->/g, " ")
    .replace(/^#{1,6}\s+.*$/gm, " ")
    .split(/[.!?]\n?|\n+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= 35 && !item.startsWith("|") && !item.startsWith("- ["));
  const counts = countValues(sentences);
  return Array.from(counts.entries()).filter(([, count]) => count >= 2).map(([sentence, count]) => `${sentence.slice(0, 80)}:${count}`);
}

function findMatches(text: string, patterns: RegExp[]) {
  return unique(patterns.flatMap((pattern) => text.match(pattern) ?? []).map((item) => item.replace(/\s+/g, " ").trim()));
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

function summarizeParagraph(value: string) {
  return value.replace(/\s+/g, " ").slice(0, 120);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}
