import type { DailyBriefEtfPick, DailyBriefPrewriteContextItem, DailyBriefStockPick } from "./types";

const UPSIGNAL_CONTEXT_FETCH_TIMEOUT_MS = 8000;

export async function collectDailyBriefPrewriteContext(input: {
  marketDate: string;
  stockPicks: DailyBriefStockPick[];
  etfPicks: DailyBriefEtfPick[];
}) {
  const marketItems = buildMarketContextItems(input.stockPicks, input.etfPicks);
  const stockContextItems = input.stockPicks.flatMap((pick) => buildStockContextItems(input.marketDate, pick, input.stockPicks, input.etfPicks));
  const etfContextItems = buildEtfContextItems(input.etfPicks);
  const upsignalIssueItems = (
    await Promise.all(input.stockPicks.slice(0, 5).map((pick) => collectUpsignalIssueContext(pick).catch(() => [])))
  ).flat();
  const writingAngleItems = buildWritingAngleItems(input.stockPicks, input.etfPicks);

  return [...marketItems, ...stockContextItems, ...etfContextItems, ...upsignalIssueItems, ...writingAngleItems];
}

export function summarizePrewriteContextForSymbol(items: DailyBriefPrewriteContextItem[], symbolCode: string) {
  const symbolItems = items.filter((item) => item.symbolCode === symbolCode);
  if (symbolItems.length === 0) {
    return "글쓰기 전 수집된 추가 컨텍스트는 아직 충분하지 않습니다. 차트, 뉴스, 공시, 장중 수급을 함께 확인하는 쪽으로 보겠습니다.";
  }
  const chart = symbolItems.find((item) => item.kind === "stock_chart_context" && item.title === "신호 이후 가격 위치");
  const supply = symbolItems.find((item) => item.kind === "market_supply");
  const checklist = symbolItems.find((item) => item.kind === "stock_chart_context" && item.title === "차트 해석 체크리스트");
  const etf = symbolItems.find((item) => item.kind === "etf_market_context");
  const issue = symbolItems.find((item) => item.kind === "stock_upsignal_issue" && item.confidence !== "low");
  const parts = [
    chart ? `자료를 먼저 모아보면 ${chart.summary}` : null,
    supply ? supply.summary : null,
    etf ? etf.summary : null,
    checklist ? checklist.summary : null,
    issue ? `업시그널 상세 화면에서 같이 볼 만한 이슈로는 “${issue.title}”도 잡혔습니다.` : null
  ].filter(Boolean);
  return parts.join(" ");
}

export function summarizePrewriteMarketContext(items: DailyBriefPrewriteContextItem[]) {
  const marketItems = items.filter((item) => item.kind === "market_kr_flow" || item.kind === "market_us_flow" || item.kind === "market_supply");
  if (marketItems.length === 0) {
    return "시장 맥락은 한국장 방향, 미국장 영향, 업종 수급을 함께 확인하는 방식으로 보겠습니다.";
  }
  const kr = marketItems.find((item) => item.kind === "market_kr_flow");
  const us = marketItems.find((item) => item.kind === "market_us_flow");
  const supply = marketItems.find((item) => item.kind === "market_supply");
  const parts = [
    kr ? `오늘 장 전체를 먼저 보면 ${kr.summary}` : null,
    us ? us.summary : null,
    supply ? supply.summary : null
  ].filter(Boolean);
  return parts.join(" ");
}

function buildMarketContextItems(stockPicks: DailyBriefStockPick[], etfPicks: DailyBriefEtfPick[]): DailyBriefPrewriteContextItem[] {
  const stockThemeCounts = countThemes(stockPicks.map((pick) => describeStockTheme(pick.name)));
  const dominantStocks = summarizeCounts(stockThemeCounts);
  const usEtfs = etfPicks.filter((pick) => /미국|해외|S&P|나스닥/i.test(`${pick.name} ${pick.category ?? ""}`));
  const bondEtfs = etfPicks.filter((pick) => /채권|금리|현금/i.test(`${pick.name} ${pick.category ?? ""}`));
  const dividendEtfs = etfPicks.filter((pick) => /배당|인컴/i.test(`${pick.name} ${pick.category ?? ""}`));
  const items: DailyBriefPrewriteContextItem[] = [
    {
      kind: "market_kr_flow",
      title: "한국장 보드 상단 업종 흐름",
      summary: dominantStocks ? `오늘 국내주식 상위권에는 ${dominantStocks} 흐름이 먼저 보입니다.` : "오늘 국내주식 상위권 업종 분포는 추가 확인이 필요합니다.",
      sourceName: "급등포착 한국장 시그널보드",
      confidence: stockPicks.length > 0 ? "high" : "low"
    },
    {
      kind: "market_supply",
      title: "최근 수급 체크 포인트",
      summary:
        "종목별 실제 외국인·기관 수급 수치는 별도 원문 확인이 필요합니다. 글 작성 전에는 거래대금 증가, 같은 업종 동반 상승, 관심도/트렌드 점수 변화를 우선 확인합니다.",
      sourceName: "prewrite rule",
      confidence: "medium"
    }
  ];

  if (usEtfs.length > 0) {
    items.push({
      kind: "market_us_flow",
      title: "미국장 영향 후보",
      summary: `ETF 상위권에 ${usEtfs.slice(0, 2).map((pick) => pick.name).join(", ")}가 보여 전날 미국장과 나스닥/S&P500 흐름을 같이 언급할 만합니다.`,
      sourceName: "급등포착 ETF 시그널보드",
      confidence: "medium"
    });
  }
  if (bondEtfs.length > 0) {
    items.push({
      kind: "market_us_flow",
      title: "금리·채권 민감도",
      summary: `채권·금리형 ETF(${bondEtfs.slice(0, 2).map((pick) => pick.name).join(", ")})가 보여 금리 부담과 방어적 수급을 같이 확인할 만합니다.`,
      sourceName: "급등포착 ETF 시그널보드",
      confidence: "medium"
    });
  }
  if (dividendEtfs.length > 0) {
    items.push({
      kind: "market_supply",
      title: "배당·인컴 선호",
      summary: `배당·인컴 ETF(${dividendEtfs.slice(0, 2).map((pick) => pick.name).join(", ")})가 보여 안정적 현금흐름 선호를 같이 언급할 수 있습니다.`,
      sourceName: "급등포착 ETF 시그널보드",
      confidence: "medium"
    });
  }
  return items;
}

function buildStockContextItems(
  marketDate: string,
  pick: DailyBriefStockPick,
  stockPicks: DailyBriefStockPick[],
  etfPicks: DailyBriefEtfPick[]
): DailyBriefPrewriteContextItem[] {
  const theme = describeStockTheme(pick.name);
  const sameThemeCount = stockPicks.filter((item) => describeStockTheme(item.name) === theme).length;
  const signalAge = calculateSignalAgeDays(marketDate, pick.recentSignalDate);
  const positionText = buildPositionSummary(pick);
  const trendText = pick.trendScore ? `트렌드/관심도 점수는 ${pick.trendScore}점입니다.` : "트렌드/관심도 점수는 원문에서 확인이 필요합니다.";
  const relatedEtf = findRelatedEtf(theme, etfPicks);

  return [
    {
      kind: "stock_chart_context",
      symbolCode: pick.code,
      symbolName: pick.name,
      title: "신호 이후 가격 위치",
      summary: `${pick.recentSignalDate ?? "최근 신호일 미확인"} 신호 이후 ${positionText} ${trendText}`,
      sourceName: "급등포착 종목 신호 차트",
      url: pick.detailUrl,
      publishedAt: pick.recentSignalDate,
      confidence: pick.recentSignalDate ? "high" : "medium"
    },
    {
      kind: "market_supply",
      symbolCode: pick.code,
      symbolName: pick.name,
      title: "업종 동반 수급 힌트",
      summary:
        sameThemeCount >= 2
          ? `${theme} 종목이 상위권에 ${sameThemeCount}개 같이 보여 개별 종목보다 업종 수급을 먼저 언급할 만합니다.`
          : `${theme} 단독 후보에 가까워 업종 동반 상승보다 개별 뉴스와 거래대금 확인이 더 중요합니다.`,
      sourceName: "급등포착 한국장 시그널보드",
      confidence: "medium"
    },
    {
      kind: "stock_chart_context",
      symbolCode: pick.code,
      symbolName: pick.name,
      title: "차트 해석 체크리스트",
      summary: buildChartChecklistSummary(signalAge),
      sourceName: "prewrite rule",
      url: pick.detailUrl,
      confidence: "medium"
    },
    {
      kind: "etf_market_context",
      symbolCode: pick.code,
      symbolName: pick.name,
      title: "연결해서 볼 ETF/시장 힌트",
      summary: relatedEtf
        ? `${relatedEtf.name}(${relatedEtf.category ?? "ETF"}) 흐름과 같이 보면 종목 신호가 시장 방향과 맞는지 확인하기 좋습니다.`
        : "직접 연결되는 ETF가 뚜렷하지 않아 코스피·코스닥 방향과 거래대금 변화를 우선 확인합니다.",
      sourceName: "급등포착 ETF 시그널보드",
      confidence: relatedEtf ? "medium" : "low"
    }
  ];
}

function buildEtfContextItems(etfPicks: DailyBriefEtfPick[]): DailyBriefPrewriteContextItem[] {
  return etfPicks.slice(0, 5).map((pick) => ({
    kind: "etf_market_context",
    symbolCode: pick.code,
    symbolName: pick.name,
    title: `${pick.name} ETF 흐름`,
    summary: `카테고리는 ${pick.category ?? "미분류"}, 현재가는 ${pick.currentPrice ?? "미확인"}, 목표여력은 ${pick.targetPotential ?? "미확인"}, 최근매수 기준은 ${pick.recentBuyDate ?? "미확인"}입니다.`,
    sourceName: "급등포착 ETF 시그널보드",
    publishedAt: pick.recentBuyDate,
    confidence: "medium"
  }));
}

async function collectUpsignalIssueContext(pick: DailyBriefStockPick): Promise<DailyBriefPrewriteContextItem[]> {
  const html = await fetchText(pick.detailUrl);
  const articleLinks = extractIssueLinks(html).slice(0, 4);
  if (articleLinks.length === 0) {
    return [
      {
        kind: "stock_upsignal_issue",
        symbolCode: pick.code,
        symbolName: pick.name,
        title: "업시그널 상세페이지 주요기사 확인 필요",
        summary: "상세페이지에서 구조화된 주요기사 링크를 자동 추출하지 못했습니다. 원문 화면의 뉴스/블로그/공시 영역을 수동 확인 후보로 남깁니다.",
        sourceName: "급등포착 상세페이지",
        url: pick.detailUrl,
        confidence: "low"
      }
    ];
  }
  return articleLinks.map((link) => ({
    kind: "stock_upsignal_issue",
    symbolCode: pick.code,
    symbolName: pick.name,
    title: link.title,
    summary: "급등포착 상세페이지에서 추출한 주요기사/이슈 후보입니다. 본문 전체는 저장하지 않고 제목과 URL만 글감으로 사용합니다.",
    sourceName: link.sourceName,
    url: link.url,
    confidence: "medium"
  }));
}

function buildWritingAngleItems(stockPicks: DailyBriefStockPick[], etfPicks: DailyBriefEtfPick[]): DailyBriefPrewriteContextItem[] {
  const topStocks = stockPicks.slice(0, 3).map((pick) => pick.name).join(", ");
  const hasFinancialCluster = stockPicks.slice(0, 5).filter((pick) => describeStockTheme(pick.name) === "금융주").length >= 2;
  const hasUsEtf = etfPicks.some((pick) => /미국|S&P|나스닥|해외/i.test(`${pick.name} ${pick.category ?? ""}`));
  const summary = hasFinancialCluster
    ? `오늘은 ${topStocks}를 중심으로 금융주 동반 흐름을 먼저 풀고, ETF 보드에서 미국장/금리 힌트를 연결하는 구성이 자연스럽습니다.`
    : `오늘은 ${topStocks}를 중심으로 신호가 나온 가격대와 주요 이슈를 먼저 풀고, 부족한 시장 맥락은 ETF 보드로 보강하는 구성이 자연스럽습니다.`;
  return [
    {
      kind: "writing_angle",
      title: "오늘 글의 전개 방향",
      summary: hasUsEtf ? `${summary} 미국 ETF가 같이 보여 전날 미국장 영향도 짧게 연결할 수 있습니다.` : summary,
      sourceName: "prewrite rule",
      confidence: "high"
    }
  ];
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSIGNAL_CONTEXT_FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "User-Agent": "BlogGrowthAgent/1.0 read-only prewrite context",
      Accept: "text/html,application/xhtml+xml"
    }
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`upsignal_context_fetch_failed:${response.status}`);
  }
  return response.text();
}

function extractIssueLinks(html: string) {
  const decoded = decodeEscapedPageData(html);
  const linkMatches = Array.from(decoded.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g));
  const seen = new Set<string>();
  return linkMatches
    .map((match) => {
      const url = normalizeUrl(decodeHtml(match[1] ?? ""));
      const title = normalizeText(stripTags(decodeHtml(match[2] ?? "")));
      if (!url || !title || title.length < 8 || seen.has(url)) {
        return null;
      }
      if (!isIssueLike(title, url)) {
        return null;
      }
      seen.add(url);
      return {
        title: title.slice(0, 140),
        url,
        sourceName: inferSourceName(url)
      };
    })
    .filter((item): item is { title: string; url: string; sourceName: string } => Boolean(item));
}

function buildPositionSummary(pick: DailyBriefStockPick) {
  const current = parsePrice(pick.currentPrice);
  const entry = parsePrice(pick.entryPrice);
  const target = parsePrice(pick.targetPrice);
  const stopLoss = parsePrice(pick.stopLoss);
  const parts: string[] = [];
  if (current && entry) {
    const gap = ((current - entry) / entry) * 100;
    parts.push(gap >= 0 ? `진입 기준 위에서 약 ${formatPercent(gap)} 버티고 있습니다.` : `진입 기준 아래로 약 ${formatPercent(Math.abs(gap))} 내려와 있습니다.`);
  }
  if (current && target) {
    parts.push(`목표가까지 단순 여력은 약 ${formatPercent(((target - current) / current) * 100)}입니다.`);
  }
  if (current && stopLoss) {
    parts.push(`손절선까지 거리는 약 ${formatPercent(((current - stopLoss) / current) * 100)}입니다.`);
  }
  return parts.join(" ") || "가격 위치는 원문 화면 확인이 필요합니다.";
}

function buildChartChecklistSummary(signalAge: number | null) {
  const signalText =
    signalAge === null
      ? "최근 신호일은 원문 차트에서 다시 확인합니다."
      : signalAge <= 3
        ? "최근 신호가 가까운 날짜에 나왔으므로 신호 가격대가 아직 살아 있는지 봅니다."
        : "신호가 나온 뒤 시간이 지났으므로 현재 가격이 기준선을 다시 회복했는지 봅니다.";
  return `${signalText} 이평선은 정배열 단정 대신 주요 이평선 위에서 버티는지 확인하고, 볼린저밴드는 상단 과열인지 중단선 지지인지 확인합니다. 최근 수급은 거래대금, 관심도/트렌드 점수, 업종 동반 움직임으로 보강합니다.`;
}

function findRelatedEtf(theme: string, etfPicks: DailyBriefEtfPick[]) {
  if (theme === "금융주") {
    return etfPicks.find((pick) => /은행|금융|배당|인컴/i.test(`${pick.name} ${pick.category ?? ""}`)) ?? null;
  }
  if (theme === "소비재") {
    return etfPicks.find((pick) => /소비|배당|미국|해외/i.test(`${pick.name} ${pick.category ?? ""}`)) ?? null;
  }
  return etfPicks.find((pick) => /미국|S&P|나스닥|채권|금리/i.test(`${pick.name} ${pick.category ?? ""}`)) ?? null;
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

function countThemes(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function summarizeCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme, count]) => `${theme} ${count}개`)
    .join(", ");
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

function isIssueLike(title: string, url: string) {
  return (
    /뉴스|기사|공시|실적|매수|매도|수급|외국인|기관|목표가|전망|급등|하락|상승|IR|배당|자사주|금리|환율|시장|증시|리포트/i.test(title) ||
    /news|article|finance|stock|dart|kind|naver|google/i.test(url)
  );
}

function inferSourceName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "웹";
  }
}

function normalizeUrl(value: string) {
  if (!value) {
    return "";
  }
  if (value.startsWith("http")) {
    return value;
  }
  if (value.startsWith("/")) {
    return `https://upsignal.co.kr${value}`;
  }
  return value;
}

function parsePrice(value: string | null) {
  const parsed = value ? Number(value.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function decodeEscapedPageData(value: string) {
  return value
    .replace(/\\"/g, "\"")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\n/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
