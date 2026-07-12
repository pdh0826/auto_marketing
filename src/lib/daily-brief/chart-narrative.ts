import type { DailyBriefEtfPick, DailyBriefRun, DailyBriefStockPick } from "./types";

export interface DailyBriefMarketNarrativeContext {
  stockThemeSummary: string;
  etfThemeSummary: string;
  financialStockCount: number;
  usEtfPresent: boolean;
  bondEtfPresent: boolean;
  dividendEtfPresent: boolean;
}

interface StockChartNarrativeContext {
  name: string;
  subjectName: string;
  objectName: string;
  theme: string;
  marketDate: string;
  recentSignalDate: string;
  signalAgeText: string;
  currentPrice: string;
  entryPrice: string;
  targetPrice: string;
  stopLoss: string;
  stopLossSubject: string;
  pricePositionText: string;
  targetRoomText: string;
  riskRoomText: string;
  trendScoreText: string;
  movingAverageHint: string;
  bollingerHint: string;
  signalClusterHint: string;
  marketInfluenceHint: string;
  supplyHint: string;
}

export function buildDailyBriefMarketNarrativeContext(run: DailyBriefRun): DailyBriefMarketNarrativeContext {
  return buildMarketNarrativeContextFromPicks(run.stockPicks, run.etfPicks);
}

export function buildMarketNarrativeContextFromPicks(
  stockPicks: DailyBriefStockPick[],
  etfPicks: DailyBriefEtfPick[]
): DailyBriefMarketNarrativeContext {
  const stockThemeCounts = stockPicks.reduce<Record<string, number>>((acc, pick) => {
    const theme = describeStockTheme(pick.name);
    acc[theme] = (acc[theme] ?? 0) + 1;
    return acc;
  }, {});
  const etfThemeCounts = etfPicks.reduce<Record<string, number>>((acc, pick) => {
    const theme = pick.category ?? inferEtfTheme(pick.name);
    acc[theme] = (acc[theme] ?? 0) + 1;
    return acc;
  }, {});

  return {
    stockThemeSummary: summarizeThemeCounts(stockThemeCounts, "국내주식"),
    etfThemeSummary: summarizeThemeCounts(etfThemeCounts, "ETF"),
    financialStockCount: stockThemeCounts["금융주"] ?? 0,
    usEtfPresent: etfPicks.some((pick) => /미국|해외|S&P|나스닥/i.test(`${pick.name} ${pick.category ?? ""}`)),
    bondEtfPresent: etfPicks.some((pick) => /채권|금리|현금/i.test(`${pick.name} ${pick.category ?? ""}`)),
    dividendEtfPresent: etfPicks.some((pick) => /배당|인컴/i.test(`${pick.name} ${pick.category ?? ""}`))
  };
}

export function buildStockChartInterpretation(input: {
  pick: DailyBriefStockPick;
  marketDate: string;
  marketContext: DailyBriefMarketNarrativeContext;
  variantSeed?: string;
}) {
  const context = buildStockChartNarrativeContext(input.pick, input.marketDate, input.marketContext);
  const pattern =
    STOCK_CHART_INTERPRETATION_PATTERNS[
      stableIndex([input.marketDate, input.pick.code, input.variantSeed ?? "chart-interpretation"].join(":"), STOCK_CHART_INTERPRETATION_PATTERNS.length)
    ];
  return pattern(context);
}

const STOCK_CHART_INTERPRETATION_PATTERNS: Array<(context: StockChartNarrativeContext) => string> = [
  (context) => `차트에서 제가 먼저 보는 건 ${context.signalAgeText}입니다. ${context.subjectName} ${context.pricePositionText} ${context.movingAverageHint} 이 구간에서 거래가 붙으면 “신호가 살아 있구나” 하고 볼 수 있고, 반대로 기준선 아래로 밀리면 일단 힘이 빠진 걸로 봅니다.

볼린저밴드는 세게 뚫고 나가는지보다, 상단 근처에서 너무 과열되지 않았는지를 보는 용도로 씁니다. ${context.bollingerHint} ${context.targetRoomText} 그래도 ${context.riskRoomText}`,
  (context) => `${context.objectName} 볼 때는 최근 신호가 나온 가격대부터 확인합니다. ${context.recentSignalDate} 신호 이후 현재 위치는 ${context.pricePositionText} ${context.signalClusterHint}

저는 여기서 이평선 정배열을 단정하기보다, 가격이 기준선 위에서 버티는지부터 봅니다. ${context.movingAverageHint} 여기에 ${context.marketInfluenceHint}까지 같이 맞아주면 조금 더 편하게 볼 수 있습니다.`,
  (context) => `이 차트는 목표가만 볼 게 아니라 신호가 나온 뒤의 움직임을 봐야 합니다. ${context.subjectName} ${context.pricePositionText} ${context.targetRoomText}

다만 올라가는 종목일수록 손절 기준을 대충 보면 안 됩니다. ${context.riskRoomText} 저는 이런 경우 볼린저밴드 상단을 따라가는 힘이 있는지, 아니면 윗꼬리만 남기고 밀리는지를 같이 봅니다.`,
  (context) => `${context.subjectName} 숫자보다 차트 위치가 더 중요해 보입니다. 최근 신호는 ${context.recentSignalDate}이고, 지금은 ${context.pricePositionText} ${context.trendScoreText}

이평선 위에서 가격이 버티면 다음 캔들이 조금 더 중요해집니다. ${context.movingAverageHint} 여기에 한국장 수급이 같이 붙어야 신호가 하루짜리로 끝나지 않습니다. ${context.supplyHint}`,
  (context) => `저는 이런 차트에서 “지금 고점인가?”를 먼저 생각합니다. ${context.subjectName} ${context.pricePositionText} 이미 신호 가격대에서 많이 멀어졌다면 좋은 종목이어도 기다리는 쪽이 편합니다.

반대로 기준 근처에서 버틴다면 이야기가 달라집니다. ${context.movingAverageHint} 볼린저밴드도 상단을 타고 가는지, 중단선으로 내려오는지에 따라 해석이 달라집니다.`,
  (context) => `${context.subjectName} 최근 신호가 ${context.recentSignalDate}에 잡혀 있습니다. 저는 이 날짜 이후 가격이 무너졌는지, 아니면 기준 위에서 버티는지를 봅니다. 지금은 ${context.pricePositionText}

장 흐름도 같이 봐야 합니다. ${context.marketInfluenceHint} 특히 ${context.theme} 종목은 같은 업종이 같이 올라오는지 확인해야 힘이 오래 갑니다.`,
  (context) => `차트를 열면 제일 먼저 진입가 주변을 봅니다. ${context.name}의 진입 기준은 ${context.entryPrice}, 현재가는 ${context.currentPrice}입니다. ${context.pricePositionText}

이평선은 복잡하게 말할 필요 없습니다. 가격이 주요 이평선 위에서 버티면 기대를 조금 더 하고, 이평선 아래로 밀리면 신호가 약해졌다고 봅니다. ${context.bollingerHint}`,
  (context) => `${context.objectName} 오늘 보는 이유는 신호가 찍힌 뒤 바로 무너지지 않았는지 확인하기 위해서입니다. ${context.signalClusterHint} ${context.pricePositionText}

목표가 ${context.targetPrice}만 보면 글이 달콤해지는데, 실제로는 ${context.stopLossSubject} 더 중요합니다. ${context.riskRoomText} 이 기준이 불편하면 아무리 점수가 좋아도 저는 크게 보지 않습니다.`,
  (context) => `오늘 ${context.name} 차트는 “따라갈 자리인가, 기다릴 자리인가”를 나눠서 봐야 합니다. ${context.pricePositionText} ${context.targetRoomText}

볼린저밴드 상단 근처에서 계속 버티면 강한 흐름이고, 상단을 찍고 바로 밀리면 단기 과열일 수 있습니다. 아직 밴드 수치를 따로 계산하지는 않으니, 실제 화면에서 캔들 위치를 한 번 더 확인하는 게 좋습니다.`,
  (context) => `${context.subjectName} 혼자만 좋은지, 업종이 같이 좋은지부터 보겠습니다. ${context.supplyHint} ${context.marketInfluenceHint}

차트상으로는 최근 신호 가격대와 현재가의 거리가 핵심입니다. ${context.pricePositionText} 이평선 위에서 버티고 거래대금이 붙으면 다음 장에서도 볼 이유가 있고, 기준선 아래로 밀리면 굳이 서두를 필요가 없습니다.`,
  (context) => `${context.subjectName} 최근 신호 이후의 후속 움직임을 확인할 종목입니다. ${context.signalAgeText}이고, 현재 위치는 ${context.pricePositionText}

저는 여기서 이동평균선, 볼린저밴드, 거래대금을 한 번에 봅니다. 이평선 위에서 버티고 밴드 상단을 너무 무리하게 뚫지 않는 흐름이면 괜찮고, 거래 없이 위로만 떠 있으면 조심합니다.`,
  (context) => `이 종목은 차트만 놓고 “무조건 좋다”라고 쓰기보다, 체크할 순서를 정해두는 게 낫습니다. 첫째, ${context.pricePositionText} 둘째, ${context.movingAverageHint} 셋째, ${context.marketInfluenceHint}

이 세 가지가 같이 맞으면 ${context.objectName} 조금 더 재미있게 볼 수 있습니다. 하나라도 어긋나면 글은 좋아 보여도 실제 매매는 피곤해질 수 있습니다.`
];

function buildStockChartNarrativeContext(
  pick: DailyBriefStockPick,
  marketDate: string,
  marketContext: DailyBriefMarketNarrativeContext
): StockChartNarrativeContext {
  const name = normalizeName(pick.name);
  const theme = describeStockTheme(name);
  const signalAgeDays = calculateSignalAgeDays(marketDate, pick.recentSignalDate);
  const trendScore = parseNumber(pick.trendScore);
  return {
    name,
    subjectName: withSubjectParticle(name),
    objectName: withObjectParticle(name),
    theme,
    marketDate,
    recentSignalDate: pick.recentSignalDate ?? "원문 화면 확인 필요",
    signalAgeText: buildSignalAgeText(signalAgeDays),
    currentPrice: pick.currentPrice ?? "-",
    entryPrice: pick.entryPrice ?? "-",
    targetPrice: pick.targetPrice ?? "-",
    stopLoss: pick.stopLoss ?? "-",
    stopLossSubject: pick.stopLoss ? `손절선 ${pick.stopLoss}원이` : "손절선이",
    pricePositionText: buildPricePositionText(pick),
    targetRoomText: buildTargetRoomText(pick),
    riskRoomText: buildRiskRoomText(pick),
    trendScoreText: Number.isFinite(trendScore) ? `트렌드 점수는 ${pick.trendScore}점으로 표시됩니다.` : "트렌드 점수는 원문 화면에서 다시 확인이 필요합니다.",
    movingAverageHint: buildMovingAverageHint(pick),
    bollingerHint: buildBollingerHint(pick),
    signalClusterHint: buildSignalClusterHint(signalAgeDays, pick),
    marketInfluenceHint: buildMarketInfluenceHint(marketContext),
    supplyHint: buildSupplyHint(theme, marketContext)
  };
}

function buildSignalAgeText(signalAgeDays: number | null) {
  if (signalAgeDays === null) {
    return "최근 신호일은 원문 차트에서 다시 확인해야 하는 상태";
  }
  if (signalAgeDays === 0) {
    return "오늘 바로 신호가 나온 상태";
  }
  if (signalAgeDays <= 2) {
    return `${signalAgeDays}거래일 안쪽의 꽤 최근 신호`;
  }
  if (signalAgeDays <= 7) {
    return `최근 ${signalAgeDays}일 안에 나온 신호`;
  }
  return `신호가 나온 지 ${signalAgeDays}일 정도 지난 상태`;
}

function buildPricePositionText(pick: DailyBriefStockPick) {
  const current = parsePrice(pick.currentPrice);
  const entry = parsePrice(pick.entryPrice);
  if (!current || !entry) {
    return "현재가와 진입 기준의 거리는 원문 화면에서 다시 확인해야 합니다.";
  }
  const gap = ((current - entry) / entry) * 100;
  if (gap >= 5) {
    return `진입 기준 위로 약 ${formatPercent(gap)} 올라와 있어 추격 부담을 먼저 봐야 하는 자리입니다.`;
  }
  if (gap >= 1) {
    return `진입 기준 위에서 약 ${formatPercent(gap)} 정도 버티는 자리입니다.`;
  }
  if (gap >= -1) {
    return "진입 기준과 거의 붙어 있어 기준선 근처 거래를 보기 좋은 자리입니다.";
  }
  return `진입 기준 아래로 약 ${formatPercent(Math.abs(gap))} 내려와 있어 신호 회복 여부를 먼저 봐야 합니다.`;
}

function buildTargetRoomText(pick: DailyBriefStockPick) {
  const current = parsePrice(pick.currentPrice);
  const target = parsePrice(pick.targetPrice);
  if (!current || !target) {
    return "목표가까지의 공간은 원문 화면에서 다시 확인해야 합니다.";
  }
  const gap = ((target - current) / current) * 100;
  if (gap <= 0) {
    return "목표가 기준으로는 이미 상단에 가까워 보여, 새로 따라붙기보다는 식는지부터 봐야 합니다.";
  }
  if (gap >= 15) {
    return `목표가까지 단순 여력은 약 ${formatPercent(gap)}로 꽤 남아 있습니다.`;
  }
  return `목표가까지 단순 여력은 약 ${formatPercent(gap)} 정도입니다.`;
}

function buildRiskRoomText(pick: DailyBriefStockPick) {
  const current = parsePrice(pick.currentPrice);
  const stopLoss = parsePrice(pick.stopLoss);
  if (!current || !stopLoss) {
    return "손절선과의 거리는 원문 화면에서 다시 확인해야 합니다.";
  }
  const gap = ((current - stopLoss) / current) * 100;
  if (gap <= 0) {
    return "손절 기준을 이미 건드렸는지 먼저 확인해야 합니다.";
  }
  return `손절선까지는 약 ${formatPercent(gap)} 정도 여유가 있습니다.`;
}

function buildMovingAverageHint(pick: DailyBriefStockPick) {
  const trendScore = parseNumber(pick.trendScore);
  if (Number.isFinite(trendScore) && trendScore >= 70) {
    return "트렌드 점수가 높게 잡혀 있어서, 주요 이평선 위에서 가격이 버티는지 확인할 만합니다.";
  }
  if (Number.isFinite(trendScore) && trendScore <= 35) {
    return "트렌드 점수는 강하지 않아서, 이평선 정배열을 단정하기보다 기준선 회복 여부를 먼저 봐야 합니다.";
  }
  return "이평선은 정배열인지 단정하기보다, 현재가가 주요 이평선 위에서 버티는지 확인하는 용도로 보겠습니다.";
}

function buildBollingerHint(pick: DailyBriefStockPick) {
  const current = parsePrice(pick.currentPrice);
  const target = parsePrice(pick.targetPrice);
  if (current && target && target > current * 1.15) {
    return "목표가까지 공간이 남아 있는 만큼, 볼린저밴드 상단을 무리하게 찢고 가는지보다 중단선 위에서 유지되는지를 보겠습니다.";
  }
  return "볼린저밴드는 상단 과열인지, 중단선 지지를 받는지 정도를 확인하는 보조 도구로 보겠습니다.";
}

function buildSignalClusterHint(signalAgeDays: number | null, pick: DailyBriefStockPick) {
  if (signalAgeDays !== null && signalAgeDays <= 3) {
    return "최근 신호가 아주 멀지 않은 날짜에 찍혀 있어서, 신호 가격대가 아직 살아 있는지 보는 게 중요합니다.";
  }
  if (pick.statusLabel?.includes("감시")) {
    return "상태가 감시 쪽으로 잡혀 있어, 신호가 반복되는지와 거래대금이 붙는지를 같이 봐야 합니다.";
  }
  return "최근 신호가 여러 번 반복됐는지는 차트 화면에서 직접 확인하고, 같은 가격대에 신호가 몰렸다면 그 구간을 기준선으로 보겠습니다.";
}

function buildMarketInfluenceHint(context: DailyBriefMarketNarrativeContext) {
  if (context.usEtfPresent && context.financialStockCount >= 2) {
    return "미국 ETF와 금융주가 같이 보드에 올라와 있어, 미국장 흐름과 국내 금융주 수급을 같이 봐야 합니다.";
  }
  if (context.usEtfPresent) {
    return "미국 ETF가 상단에 보여서, 전날 미국장 흐름이 국내장 초반 분위기에 영향을 줄 수 있습니다.";
  }
  if (context.bondEtfPresent) {
    return "채권·금리형 ETF가 보이면 금리 부담과 방어적 수급도 같이 체크해야 합니다.";
  }
  if (context.dividendEtfPresent) {
    return "배당·인컴 ETF가 같이 올라와 있어, 시장이 안정적인 현금흐름 쪽을 선호하는지도 확인할 만합니다.";
  }
  return "한국장 전체 수급과 코스피·코스닥 방향이 같이 도와주는지 확인해야 합니다.";
}

function buildSupplyHint(theme: string, context: DailyBriefMarketNarrativeContext) {
  if (theme === "금융주" && context.financialStockCount >= 2) {
    return "오늘은 금융주가 여러 개 같이 보이기 때문에, 개별 종목보다 업종 수급이 붙는지가 더 중요합니다.";
  }
  if (context.stockThemeSummary !== "국내주식") {
    return `오늘 보드에는 ${context.stockThemeSummary} 흐름이 보입니다. 같은 테마가 같이 움직이는지 확인해야 합니다.`;
  }
  return "거래대금이 붙는지, 같은 업종 종목이 같이 움직이는지 확인해야 합니다.";
}

function summarizeThemeCounts(counts: Record<string, number>, fallback: string) {
  const entries = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (entries.length === 0) {
    return fallback;
  }
  return entries.map(([theme, count]) => `${theme} ${count}개`).join(", ");
}

function describeStockTheme(name: string) {
  if (/금융|신한|하나|KB|은행|지주/i.test(name)) {
    return "금융주";
  }
  if (/콜마|화장품|뷰티|달바|오리온/i.test(name)) {
    return "소비재";
  }
  if (/건설/i.test(name)) {
    return "건설";
  }
  if (/타이어|자동차|현대|기아|모비스/i.test(name)) {
    return "자동차·부품";
  }
  if (/항공|여행|운송/i.test(name)) {
    return "항공·운송";
  }
  if (/오일|정유|화학|에너지/i.test(name)) {
    return "에너지·화학";
  }
  return "개별 종목";
}

function inferEtfTheme(name: string) {
  if (/S&P|나스닥|미국|해외/i.test(name)) {
    return "미국·해외";
  }
  if (/배당|커버드|인컴|고배당/i.test(name)) {
    return "배당·인컴";
  }
  if (/채권|금리|머니|현금|단기/i.test(name)) {
    return "채권·금리·현금성";
  }
  if (/반도체|AI|테크|기술|GPU/i.test(name)) {
    return "반도체·AI";
  }
  return "ETF";
}

function calculateSignalAgeDays(marketDate: string, recentSignalDate: string | null) {
  if (!recentSignalDate) {
    return null;
  }
  const marketTime = new Date(`${marketDate.slice(0, 10)}T00:00:00Z`).getTime();
  const signalTime = new Date(`${recentSignalDate.slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(marketTime) || !Number.isFinite(signalTime)) {
    return null;
  }
  return Math.max(0, Math.floor((marketTime - signalTime) / 86_400_000));
}

function parsePrice(value: string | null) {
  const parsed = value ? Number(value.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNumber(value: string | null) {
  const parsed = value ? Number(value.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function withSubjectParticle(name: string) {
  return `${name}${hasFinalConsonant(name) ? "은" : "는"}`;
}

function withObjectParticle(name: string) {
  return `${name}${hasFinalConsonant(name) ? "을" : "를"}`;
}

function hasFinalConsonant(value: string) {
  const last = Array.from(value.trim()).at(-1);
  if (!last) {
    return false;
  }
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return false;
  }
  return (code - 0xac00) % 28 !== 0;
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function stableIndex(value: string, modulo: number) {
  if (modulo <= 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}
