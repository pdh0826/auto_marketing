import type { Project300CategoryKind } from "@/lib/tistory/project300-voice-variation";

export const INVESTMENT_WRITING_CONTRACT_VERSION = "investment_writing_contract_v1";

export type InvestmentWritingChannel = "blogger_daily_brief" | "project300_tistory";
export type InvestmentInformationClass = "FACT" | "SYSTEM" | "JUDGMENT" | "ACTION";
export type InvestmentEvidenceConfidence = "high" | "medium" | "low";
export type InvestmentMarketSessionState = "pre_market" | "open" | "after_market" | "closed_weekend" | "closed_holiday" | "unknown";
export type InvestmentSystemValueBasis = "provider_defined" | "fixed_ratio" | "chart_level" | "manual" | "unknown";
export type InvestmentJudgmentInputSource = "typed_note" | "voice_transcript" | "approved_edit";
export type InvestmentActionKind = "buy" | "sell" | "hold" | "wait" | "pass" | "no_action" | "not_provided";
export type InvestmentPositionState = "holding" | "not_holding" | "partial_holding" | "waiting_entry" | "closed" | "not_provided";

export interface InvestmentSourceReference {
  sourceName: string;
  url: string | null;
  observedAt: string | null;
  publishedAt: string | null;
}

export interface InvestmentFactEvidence {
  id: string;
  informationClass: "FACT";
  subjectCode: string | null;
  subjectName: string | null;
  field: string;
  value: string;
  source: InvestmentSourceReference;
  confidence: InvestmentEvidenceConfidence;
  publishable: boolean;
  editorNote: string | null;
}

export interface InvestmentSystemEvidence {
  id: string;
  informationClass: "SYSTEM";
  subjectCode: string | null;
  subjectName: string | null;
  field: "score" | "status" | "entry_price" | "target_price" | "stop_loss" | "signal" | "other";
  value: string;
  basis: InvestmentSystemValueBasis;
  source: InvestmentSourceReference;
  publishable: boolean;
  editorNote: string | null;
}

export interface InvestmentWritingTemporalContext {
  timeZone: "Asia/Seoul";
  generatedAt: string;
  writingDate: string;
  dataDate: string;
  dataWeekday: string;
  isWeekend: boolean;
  marketSessionState: InvestmentMarketSessionState;
  nextWeekdayCandidate: string;
  nextTradingDateVerified: boolean;
}

export interface InvestmentStockEvidence {
  code: string;
  name: string;
  market: string | null;
  sector: string | null;
  theme: string | null;
  facts: InvestmentFactEvidence[];
  systemValues: InvestmentSystemEvidence[];
  unresolvedIssues: string[];
}

export interface InvestmentEtfEvidence {
  code: string;
  name: string;
  category: string | null;
  facts: InvestmentFactEvidence[];
  systemValues: InvestmentSystemEvidence[];
  unresolvedIssues: string[];
}

export interface InvestmentFuturesEvidence {
  symbol: string;
  name: string;
  exchange: string;
  facts: InvestmentFactEvidence[];
  systemValues: InvestmentSystemEvidence[];
  unresolvedIssues: string[];
}

export interface InvestmentWritingEvidencePack {
  version: typeof INVESTMENT_WRITING_CONTRACT_VERSION;
  channel: InvestmentWritingChannel;
  categoryKind: Project300CategoryKind | null;
  temporalContext: InvestmentWritingTemporalContext;
  marketFacts: InvestmentFactEvidence[];
  stocks: InvestmentStockEvidence[];
  etfs: InvestmentEtfEvidence[];
  futures: InvestmentFuturesEvidence[];
  unresolvedIssues: string[];
  internalEditorNotes: string[];
}

export interface InvestmentJudgmentEntry {
  id: string;
  informationClass: "JUDGMENT";
  subjectCode: string | null;
  subjectName: string | null;
  text: string;
  inputSource: InvestmentJudgmentInputSource;
  userProvided: true;
}

export interface InvestmentActionEntry {
  id: string;
  informationClass: "ACTION";
  subjectCode: string | null;
  subjectName: string | null;
  action: Exclude<InvestmentActionKind, "not_provided">;
  text: string;
  inputSource: InvestmentJudgmentInputSource;
  userProvided: true;
}

export interface InvestmentJudgmentLedger {
  version: typeof INVESTMENT_WRITING_CONTRACT_VERSION;
  positionState: InvestmentPositionState;
  firstImpression: string | null;
  mostInterestingSubject: string | null;
  comparisonCandidates: string[];
  excludedCandidates: string[];
  noActionReason: string | null;
  mainConcern: string | null;
  revisitConditions: string[];
  exclusionConditions: string[];
  similarPastExperience: string | null;
  preservedExpressions: string[];
  judgments: InvestmentJudgmentEntry[];
  actions: InvestmentActionEntry[];
  userInputPresent: boolean;
}

export interface InvestmentJudgmentLedgerInput {
  positionState?: InvestmentPositionState;
  firstImpression?: string | null;
  mostInterestingSubject?: string | null;
  comparisonCandidates?: string[];
  excludedCandidates?: string[];
  noActionReason?: string | null;
  mainConcern?: string | null;
  revisitConditions?: string[];
  exclusionConditions?: string[];
  similarPastExperience?: string | null;
  preservedExpressions?: string[];
  judgments?: Array<Omit<InvestmentJudgmentEntry, "informationClass" | "userProvided">>;
  actions?: Array<Omit<InvestmentActionEntry, "informationClass" | "userProvided">>;
}

export function createInvestmentJudgmentLedger(input: InvestmentJudgmentLedgerInput = {}): InvestmentJudgmentLedger {
  const judgments = (input.judgments ?? [])
    .map((entry) => ({
      ...entry,
      text: normalizeOptionalText(entry.text),
      informationClass: "JUDGMENT" as const,
      userProvided: true as const
    }))
    .filter((entry): entry is InvestmentJudgmentEntry => Boolean(entry.text));
  const actions = (input.actions ?? [])
    .map((entry) => ({
      ...entry,
      text: normalizeOptionalText(entry.text),
      informationClass: "ACTION" as const,
      userProvided: true as const
    }))
    .filter((entry): entry is InvestmentActionEntry => Boolean(entry.text));

  const ledger: InvestmentJudgmentLedger = {
    version: INVESTMENT_WRITING_CONTRACT_VERSION,
    positionState: input.positionState ?? "not_provided",
    firstImpression: normalizeOptionalText(input.firstImpression),
    mostInterestingSubject: normalizeOptionalText(input.mostInterestingSubject),
    comparisonCandidates: normalizeTextList(input.comparisonCandidates),
    excludedCandidates: normalizeTextList(input.excludedCandidates),
    noActionReason: normalizeOptionalText(input.noActionReason),
    mainConcern: normalizeOptionalText(input.mainConcern),
    revisitConditions: normalizeTextList(input.revisitConditions),
    exclusionConditions: normalizeTextList(input.exclusionConditions),
    similarPastExperience: normalizeOptionalText(input.similarPastExperience),
    preservedExpressions: normalizeTextList(input.preservedExpressions),
    judgments,
    actions,
    userInputPresent: false
  };

  ledger.userInputPresent = hasInvestmentJudgmentInput(ledger);
  return ledger;
}

export function hasInvestmentJudgmentInput(ledger: InvestmentJudgmentLedger) {
  return Boolean(
    ledger.firstImpression ||
      ledger.mostInterestingSubject ||
      ledger.comparisonCandidates.length ||
      ledger.excludedCandidates.length ||
      ledger.noActionReason ||
      ledger.mainConcern ||
      ledger.revisitConditions.length ||
      ledger.exclusionConditions.length ||
      ledger.similarPastExperience ||
      ledger.preservedExpressions.length ||
      ledger.judgments.length ||
      ledger.actions.length ||
      ledger.positionState !== "not_provided"
  );
}

export function canUseFirstPersonInvestmentJudgment(ledger: InvestmentJudgmentLedger) {
  return ledger.judgments.length > 0 || ledger.actions.length > 0 || Boolean(ledger.firstImpression || ledger.noActionReason || ledger.mainConcern);
}

export function buildInvestmentWritingTemporalContext(input: {
  dataDate: string;
  generatedAt?: string;
  marketSessionState?: InvestmentMarketSessionState;
  nextTradingDate?: string | null;
}): InvestmentWritingTemporalContext {
  const dataDate = normalizeIsoDate(input.dataDate);
  const generatedAt = normalizeIsoDateTime(input.generatedAt ?? new Date().toISOString());
  const writingDate = formatDateInTimeZone(new Date(generatedAt), "Asia/Seoul");
  const dataDateObject = new Date(`${dataDate}T12:00:00+09:00`);
  const dataWeekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "long"
  }).format(dataDateObject);
  const weekdayIndex = dataDateObject.getUTCDay();
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;
  const nextWeekdayCandidate = input.nextTradingDate ? normalizeIsoDate(input.nextTradingDate) : findNextWeekdayCandidate(dataDate);
  const suppliedState = input.marketSessionState ?? "unknown";
  const marketSessionState = isWeekend && suppliedState === "unknown" ? "closed_weekend" : suppliedState;

  return {
    timeZone: "Asia/Seoul",
    generatedAt,
    writingDate,
    dataDate,
    dataWeekday,
    isWeekend,
    marketSessionState,
    nextWeekdayCandidate,
    nextTradingDateVerified: Boolean(input.nextTradingDate)
  };
}

export function createInvestmentWritingEvidencePack(input: Omit<InvestmentWritingEvidencePack, "version">): InvestmentWritingEvidencePack {
  return {
    version: INVESTMENT_WRITING_CONTRACT_VERSION,
    ...input,
    unresolvedIssues: normalizeTextList(input.unresolvedIssues),
    internalEditorNotes: normalizeTextList(input.internalEditorNotes)
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
}

function normalizeTextList(values: string[] | undefined) {
  return Array.from(new Set((values ?? []).map((value) => normalizeOptionalText(value)).filter((value): value is string => Boolean(value))));
}

function normalizeIsoDate(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw new Error("invalid_investment_writing_date");
  }
  return normalized;
}

function normalizeIsoDateTime(value: string) {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new Error("invalid_investment_writing_datetime");
  }
  return new Date(normalized).toISOString();
}

function formatDateInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("investment_writing_date_format_failed");
  }
  return `${year}-${month}-${day}`;
}

function findNextWeekdayCandidate(dataDate: string) {
  const candidate = new Date(`${dataDate}T12:00:00+09:00`);
  do {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  } while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6);
  return formatDateInTimeZone(candidate, "Asia/Seoul");
}
