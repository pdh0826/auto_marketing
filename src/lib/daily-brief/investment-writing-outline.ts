import type { InvestmentJudgmentLedger, InvestmentStockEvidence, InvestmentWritingEvidencePack } from "./investment-writing-contract";
import type { InvestmentWritingPreflightResult } from "./investment-writing-preflight";

export const INVESTMENT_WRITING_OUTLINE_VERSION = "investment_writing_outline_v1";

export type InvestmentStockNarrativeRole = "comparison" | "deep_dive" | "supporting" | "table_only";

export interface InvestmentStockNarrativeAssignment {
  subjectCodes: string[];
  subjectNames: string[];
  role: InvestmentStockNarrativeRole;
  theme: string;
  question: string;
  evidenceIds: string[];
  judgmentIds: string[];
  actionIds: string[];
}

export interface InvestmentWritingOutline {
  version: typeof INVESTMENT_WRITING_OUTLINE_VERSION;
  ready: boolean;
  centerJudgment: string;
  centerJudgmentSource: "user" | "evidence";
  titleDirections: string[];
  stockAssignments: InvestmentStockNarrativeAssignment[];
  includeEtfSection: boolean;
  etfInclusionReason: string | null;
  sections: Array<{
    key: string;
    purpose: string;
    subjectCodes: string[];
    allowedInformationClasses: Array<"FACT" | "SYSTEM" | "JUDGMENT" | "ACTION">;
  }>;
  omittedSubjectCodes: string[];
  editorWarnings: string[];
}

export function buildInvestmentWritingOutline(input: {
  evidencePack: InvestmentWritingEvidencePack;
  judgmentLedger: InvestmentJudgmentLedger;
  preflight: InvestmentWritingPreflightResult;
}): InvestmentWritingOutline {
  const grouped = groupStocks(input.evidencePack.stocks);
  const assignments: InvestmentStockNarrativeAssignment[] = [];
  const omittedSubjectCodes: string[] = [];

  grouped.forEach((stocks, groupIndex) => {
    if (stocks.length >= 2) {
      assignments.push(buildAssignment(stocks.slice(0, 3), "comparison", input.judgmentLedger, groupIndex));
      omittedSubjectCodes.push(...stocks.slice(3).map((item) => item.code));
      return;
    }
    const stock = stocks[0];
    if (!stock) return;
    const role: InvestmentStockNarrativeRole = assignments.length < 2 ? "deep_dive" : assignments.length < 3 ? "supporting" : "table_only";
    assignments.push(buildAssignment([stock], role, input.judgmentLedger, groupIndex));
  });

  const userCenter = input.judgmentLedger.firstImpression ?? input.judgmentLedger.mostInterestingSubject;
  const centerJudgment = userCenter ?? buildEvidenceCenterJudgment(assignments, input.evidencePack);
  const includeEtfSection = shouldIncludeEtfs(input.evidencePack, assignments);
  const editorWarnings = [...input.preflight.blockers.map((item) => `preflight_blocker:${item}`), ...input.preflight.warnings.map((item) => `preflight_warning:${item}`)];
  if (!input.judgmentLedger.userInputPresent) editorWarnings.push("user_judgment_missing_first_person_claims_not_allowed");
  if (assignments.some((item) => item.role === "table_only")) editorWarnings.push("some_stocks_table_only_to_prevent_repetition");

  const sections: InvestmentWritingOutline["sections"] = [
    {
      key: "opening",
      purpose: "데이터 기준일과 오늘 글의 중심 판단을 짧게 제시",
      subjectCodes: assignments.flatMap((item) => item.subjectCodes),
      allowedInformationClasses: input.judgmentLedger.userInputPresent ? ["FACT", "SYSTEM", "JUDGMENT", "ACTION"] : ["FACT", "SYSTEM"]
    },
    {
      key: "summary_table",
      purpose: "반복 설명 없이 핵심 숫자를 한 번만 정리",
      subjectCodes: input.evidencePack.stocks.map((item) => item.code),
      allowedInformationClasses: ["FACT", "SYSTEM"]
    },
    ...assignments
      .filter((item) => item.role !== "table_only")
      .map((item, index) => ({
        key: `${item.role}_${index + 1}`,
        purpose: item.question,
        subjectCodes: item.subjectCodes,
        allowedInformationClasses: ["FACT", "SYSTEM", "JUDGMENT", "ACTION"] as Array<"FACT" | "SYSTEM" | "JUDGMENT" | "ACTION">
      })),
    ...(includeEtfSection
      ? [
          {
            key: "etf_context",
            purpose: "본문 결론에 영향을 주는 섹터 또는 교차시장 흐름만 보강",
            subjectCodes: input.evidencePack.etfs.slice(0, 3).map((item) => item.code),
            allowedInformationClasses: ["FACT", "SYSTEM"] as Array<"FACT" | "SYSTEM" | "JUDGMENT" | "ACTION">
          }
        ]
      : []),
    ...(input.evidencePack.futures.length
      ? [
          {
            key: "futures_market_context",
            purpose: "선물 신호를 상품별 숫자 나열이 아니라 미국장, 한국장, 원자재, 환율 흐름으로 묶어 해석",
            subjectCodes: input.evidencePack.futures.map((item) => item.symbol),
            allowedInformationClasses: ["FACT", "SYSTEM"] as Array<"FACT" | "SYSTEM" | "JUDGMENT" | "ACTION">
          }
        ]
      : []),
    {
      key: "next_conditions",
      purpose: "다음 거래일에 다시 보거나 제외할 조건을 기록",
      subjectCodes: assignments.flatMap((item) => item.subjectCodes),
      allowedInformationClasses: ["FACT", "JUDGMENT", "ACTION"]
    }
  ];

  return {
    version: INVESTMENT_WRITING_OUTLINE_VERSION,
    ready: input.preflight.ok && (assignments.length > 0 || input.evidencePack.etfs.length > 0 || input.evidencePack.futures.length > 0),
    centerJudgment,
    centerJudgmentSource: userCenter ? "user" : "evidence",
    titleDirections: buildTitleDirections(centerJudgment, assignments, input.evidencePack.temporalContext.dataDate),
    stockAssignments: assignments,
    includeEtfSection,
    etfInclusionReason: includeEtfSection ? buildEtfInclusionReason(input.evidencePack, assignments) : null,
    sections,
    omittedSubjectCodes,
    editorWarnings: unique(editorWarnings)
  };
}

function groupStocks(stocks: InvestmentStockEvidence[]) {
  const groups = new Map<string, InvestmentStockEvidence[]>();
  for (const stock of stocks) {
    const inferredGroup = stock.theme ?? stock.sector;
    const key = !inferredGroup || inferredGroup === "개별 종목" ? `single:${stock.code}` : inferredGroup;
    groups.set(key, [...(groups.get(key) ?? []), stock]);
  }
  return Array.from(groups.values()).sort((left, right) => right.length - left.length);
}

function buildAssignment(stocks: InvestmentStockEvidence[], role: InvestmentStockNarrativeRole, ledger: InvestmentJudgmentLedger, index: number) {
  const names = stocks.map((item) => item.name);
  const theme = stocks[0]?.theme ?? stocks[0]?.sector ?? "개별 종목";
  const question = role === "comparison"
    ? `${names.join("과 ")} 중 실제로 다시 볼 종목을 무엇으로 구분할 것인가`
    : role === "deep_dive"
      ? `${names[0]}에서 오늘만 확인할 수 있는 신호, 가격, 뉴스의 연결은 무엇인가`
      : role === "supporting"
        ? `${names[0]}이 중심 판단을 보강하거나 반박하는 부분은 무엇인가`
        : `${names[0]}은 표에만 남기고 본문 반복을 피한다`;
  const codes = new Set(stocks.map((item) => item.code));
  return {
    subjectCodes: stocks.map((item) => item.code),
    subjectNames: names,
    role,
    theme,
    question,
    evidenceIds: stocks.flatMap((item) => [...item.facts, ...item.systemValues].map((entry) => entry.id)),
    judgmentIds: ledger.judgments.filter((item) => !item.subjectCode || codes.has(item.subjectCode)).map((item) => item.id),
    actionIds: ledger.actions.filter((item) => !item.subjectCode || codes.has(item.subjectCode)).map((item) => item.id),
    order: index
  };
}

function buildEvidenceCenterJudgment(assignments: InvestmentStockNarrativeAssignment[], pack: InvestmentWritingEvidencePack) {
  const comparison = assignments.find((item) => item.role === "comparison");
  if (comparison) return `${comparison.theme} 종목이 함께 잡힌 날이라 개별 숫자 반복보다 후보 간 차이를 먼저 본다.`;
  const first = assignments[0];
  if (first) return `${first.subjectNames.join(", ")}의 최근 신호와 확인된 재료가 같은 방향인지 살펴본다.`;
  if (pack.futures.length) return "국내외 선물 흐름으로 오늘 장의 방향과 매매 타점을 먼저 확인한다.";
  if (pack.etfs.length) return "종목 신호보다 ETF와 섹터 흐름이 더 분명한 날인지 확인한다.";
  return "확인된 자료만으로 오늘 기록할 중심을 정한다.";
}

function shouldIncludeEtfs(pack: InvestmentWritingEvidencePack, assignments: InvestmentStockNarrativeAssignment[]) {
  if (!pack.etfs.length) return false;
  if (!assignments.length || pack.stocks.length < 3) return true;
  const stockThemes = new Set(assignments.map((item) => item.theme));
  return pack.etfs.some((etf) => Array.from(stockThemes).some((theme) => etf.category?.includes(theme.replace(/주$/, ""))));
}

function buildEtfInclusionReason(pack: InvestmentWritingEvidencePack, assignments: InvestmentStockNarrativeAssignment[]) {
  if (!assignments.length) return "최근 종목 신호가 부족해 시장 방향을 ETF로 확인한다.";
  return `${assignments.map((item) => item.theme).join(", ")} 흐름이 ETF 보드에서도 이어지는지 확인할 필요가 있다.`;
}

function buildTitleDirections(center: string, assignments: InvestmentStockNarrativeAssignment[], dataDate: string) {
  const names = assignments.flatMap((item) => item.subjectNames).slice(0, 3);
  if (!assignments.length) {
    return [`${dataDate} 시장 방향과 매매 타점 점검`, "오늘 선물 신호에서 먼저 볼 흐름", center];
  }
  return [
    `${dataDate} ${names.join("·")} 신호를 다시 본 이유`,
    assignments[0]?.role === "comparison" ? `${assignments[0].subjectNames.join("과 ")}, 둘 다 볼 필요가 있을까` : `${names[0] ?? "오늘 신호"}, 지금 확인할 숫자와 재료`,
    center
  ];
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
