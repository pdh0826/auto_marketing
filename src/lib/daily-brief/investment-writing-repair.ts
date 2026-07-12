import { PROJECT300_INVESTMENT_FORBIDDEN_PATTERNS } from "@/lib/tistory/project300-investment-voice-corpus";
import type { InvestmentJudgmentLedger } from "./investment-writing-contract";

export const INVESTMENT_WRITING_REPAIR_VERSION = "investment_writing_repair_v1";

export function repairInvestmentWritingDraft(input: { markdown: string; judgmentLedger: InvestmentJudgmentLedger }) {
  const removedCodes: string[] = [];
  const seenParagraphs = new Set<string>();
  const canUseFirstPerson = Boolean(
    input.judgmentLedger.judgments.length ||
      input.judgmentLedger.actions.length ||
      input.judgmentLedger.firstImpression ||
      input.judgmentLedger.mainConcern ||
      input.judgmentLedger.noActionReason
  );
  const paragraphs = input.markdown.split(/\n\s*\n/).filter((paragraph) => {
    const normalized = paragraph.replace(/\s+/g, " ").trim();
    if (!normalized) return false;
    if (/RSS\s*검색|자동\s*수집(?:된|한)?\s*(?:결과|뉴스|자료)|기사\s*전문(?:은|을)?\s*저장하지|검토\s*후보|자료를\s*먼저\s*모아보면|글쓰기\s*전에\s*모아둔/i.test(normalized)) {
      removedCodes.push("internal_workflow_paragraph_removed");
      return false;
    }
    if (!canUseFirstPerson && /저는|제가|제\s*기준/.test(normalized)) {
      removedCodes.push("unsupported_first_person_paragraph_removed");
      return false;
    }
    if (PROJECT300_INVESTMENT_FORBIDDEN_PATTERNS.some((pattern) => normalized.includes(pattern))) {
      removedCodes.push("forbidden_pattern_paragraph_removed");
      return false;
    }
    const key = normalized.replace(/[+-]?\d[\d,.]*%?/g, "[숫자]");
    if (seenParagraphs.has(key)) {
      removedCodes.push("duplicate_paragraph_removed");
      return false;
    }
    seenParagraphs.add(key);
    return true;
  });
  const markdown = paragraphs.join("\n\n").trim();
  return {
    version: INVESTMENT_WRITING_REPAIR_VERSION,
    attempted: removedCodes.length > 0,
    changed: markdown !== input.markdown.trim(),
    markdown,
    removedCodes: Array.from(new Set(removedCodes)),
    beforeLength: input.markdown.trim().length,
    afterLength: markdown.length
  };
}
