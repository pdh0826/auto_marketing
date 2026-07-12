import type { InvestmentStockEvidence, InvestmentWritingEvidencePack } from "./investment-writing-contract";

export const INVESTMENT_WRITING_PREFLIGHT_VERSION = "investment_writing_preflight_v1";

export interface InvestmentWritingPreflightResult {
  version: typeof INVESTMENT_WRITING_PREFLIGHT_VERSION;
  ok: boolean;
  blockers: string[];
  warnings: string[];
  checklist: Array<{ key: string; pass: boolean; blocking: boolean }>;
  safeMetadata: {
    marketDate: string;
    marketSessionState: string;
    stockCount: number;
    etfCount: number;
    publishableFactCount: number;
    editorOnlyFactCount: number;
    unknownSystemBasisCount: number;
  };
}

export function validateInvestmentWritingEvidencePack(pack: InvestmentWritingEvidencePack): InvestmentWritingPreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const allFacts = [...pack.marketFacts, ...pack.stocks.flatMap((item) => item.facts), ...pack.etfs.flatMap((item) => item.facts)];
  const allSystemValues = [...pack.stocks.flatMap((item) => item.systemValues), ...pack.etfs.flatMap((item) => item.systemValues)];

  if (pack.stocks.length === 0 && pack.etfs.length === 0) blockers.push("writing_evidence_subject_required");
  if (pack.temporalContext.marketSessionState === "unknown") warnings.push("market_session_state_not_verified");
  if (!pack.temporalContext.nextTradingDateVerified) warnings.push("next_trading_date_not_verified");

  for (const fact of allFacts) {
    if (fact.publishable && (!fact.source.sourceName || !fact.source.url)) blockers.push(`publishable_fact_source_incomplete:${fact.id}`);
    if (fact.publishable && fact.confidence === "low") blockers.push(`low_confidence_fact_marked_publishable:${fact.id}`);
  }
  for (const value of allSystemValues) {
    if (value.basis === "unknown") warnings.push(`system_value_basis_unknown:${value.id}`);
  }
  pack.stocks.forEach((stock) => validateStockPriceDirections(stock, blockers, warnings));

  const leakedInternalNotes = allFacts.filter((fact) => /RSS|자동\s*수집|기사\s*전문|검토\s*후보|자료를\s*먼저\s*모아보면/i.test(fact.value));
  leakedInternalNotes.forEach((fact) => blockers.push(`internal_workflow_text_in_publishable_fact:${fact.id}`));

  const checklist = [
    { key: "subject_present", pass: pack.stocks.length + pack.etfs.length > 0, blocking: true },
    { key: "publishable_sources_complete", pass: !blockers.some((item) => item.includes("source_incomplete")), blocking: true },
    { key: "price_direction_valid", pass: !blockers.some((item) => item.includes("price_direction")), blocking: true },
    { key: "internal_workflow_text_separated", pass: leakedInternalNotes.length === 0, blocking: true },
    { key: "market_session_verified", pass: pack.temporalContext.marketSessionState !== "unknown", blocking: false },
    { key: "system_value_basis_documented", pass: !allSystemValues.some((item) => item.basis === "unknown"), blocking: false }
  ];

  return {
    version: INVESTMENT_WRITING_PREFLIGHT_VERSION,
    ok: blockers.length === 0,
    blockers: unique(blockers),
    warnings: unique([...warnings, ...pack.unresolvedIssues, ...pack.stocks.flatMap((item) => item.unresolvedIssues), ...pack.etfs.flatMap((item) => item.unresolvedIssues)]),
    checklist,
    safeMetadata: {
      marketDate: pack.temporalContext.dataDate,
      marketSessionState: pack.temporalContext.marketSessionState,
      stockCount: pack.stocks.length,
      etfCount: pack.etfs.length,
      publishableFactCount: allFacts.filter((item) => item.publishable).length,
      editorOnlyFactCount: allFacts.filter((item) => !item.publishable).length,
      unknownSystemBasisCount: allSystemValues.filter((item) => item.basis === "unknown").length
    }
  };
}

function validateStockPriceDirections(stock: InvestmentStockEvidence, blockers: string[], warnings: string[]) {
  const current = parseNumber(stock.facts.find((item) => item.field === "current_price")?.value);
  const target = parseNumber(stock.systemValues.find((item) => item.field === "target_price")?.value);
  const stop = parseNumber(stock.systemValues.find((item) => item.field === "stop_loss")?.value);
  if (current !== null && target !== null && target <= current) blockers.push(`target_price_direction_invalid:${stock.code}`);
  if (current !== null && stop !== null && stop >= current) blockers.push(`stop_loss_price_direction_invalid:${stock.code}`);
  if (current === null) warnings.push(`current_price_not_numeric:${stock.code}`);
}

function parseNumber(value: string | undefined) {
  if (!value) return null;
  const number = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
