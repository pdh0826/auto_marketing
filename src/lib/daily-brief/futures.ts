import type { DailyBriefFuturesPick } from "./types";
import { getDailyMarketReportProfile, type DailyMarketReportSession } from "./market-report-session";

const UPSIGNAL_FUTURES_URL = "https://upsignal.co.kr/futures";
const UPSIGNAL_FUTURES_API_URL = "https://upsignal.co.kr/api/v1/futures/board";

const FUTURES_INSTRUMENTS = [
  { symbol: "NQ", apiCode: "NQ", name: "E-mini NASDAQ100 선물", exchange: "CME" },
  { symbol: "ES", apiCode: "ES", name: "E-mini S&P500 선물", exchange: "CME" },
  { symbol: "KOSPI200", apiCode: "K200", name: "KOSPI200 선물", exchange: "KRX" },
  { symbol: "WTI", apiCode: "CL", name: "WTI 크루드오일 선물", exchange: "NYMEX" },
  { symbol: "GOLD", apiCode: "GC", name: "금 선물", exchange: "COMEX" },
  { symbol: "EURUSD", apiCode: "6E", name: "유로/달러 선물", exchange: "CME" }
] as const;

export async function fetchFuturesSignals(
  limit: number = FUTURES_INSTRUMENTS.length,
  options: { reportSession?: DailyMarketReportSession; symbols?: string[] } = {}
): Promise<DailyBriefFuturesPick[]> {
  const reportSession = options.reportSession ?? "morning";
  const requestedSymbols = options.symbols?.length ? new Set(options.symbols) : null;
  const instruments = orderInstruments(getDailyMarketReportProfile(reportSession).instrumentPriority).filter(
    (instrument) => !requestedSymbols || requestedSymbols.has(instrument.symbol)
  );
  const structured = await tryFetchFuturesSignalsFromApi(limit, reportSession, instruments).catch(() => []);
  if (structured.filter((item) => item.dataReady).length >= Math.min(3, limit)) {
    return prioritizeKoreaSessionSignals(structured, reportSession);
  }
  const live = await tryFetchFuturesSignalsWithPlaywright(limit, reportSession, instruments).catch(() => []);
  if (live.filter((item) => item.dataReady).length > structured.filter((item) => item.dataReady).length) {
    return prioritizeKoreaSessionSignals(live, reportSession);
  }
  if (structured.filter((item) => item.dataReady).length > 0) return prioritizeKoreaSessionSignals(structured, reportSession);
  return instruments.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    symbol: item.symbol,
    name: item.name,
    exchange: item.exchange,
    sourceName: null,
    statusLabel: "미수집",
    currentValue: null,
    changeRate: null,
    observedAtLabel: null,
    strategyName: null,
    strategyStatus: null,
    timeframe: null,
    performancePeriod: null,
    realizedProfit: null,
    realizedProfitMoney: null,
    completedTrades: null,
    winRate: null,
    currentPosition: null,
    entryValue: null,
    unrealizedProfit: null,
    signalLabel: null,
    marketState: null,
    confidence: null,
    indicatorSummary: null,
    upperLevels: [],
    lowerLevels: [],
    sourceUrl: UPSIGNAL_FUTURES_URL,
    dataReady: false,
    warnings: ["futures_playwright_live_data_not_available"]
  }));
}

async function tryFetchFuturesSignalsFromApi(
  limit: number,
  reportSession: DailyMarketReportSession,
  instruments: Array<(typeof FUTURES_INSTRUMENTS)[number]>
) {
  const timeframePriority = getDailyMarketReportProfile(reportSession).timeframePriority;
  return Promise.all(
    instruments.slice(0, limit).map(async (instrument, index) => {
      const snapshots = await Promise.all(
        timeframePriority.map((timeframe) => fetchFuturesApiSnapshot(instrument, timeframe).catch(() => emptyFuturesSnapshot()))
      );
      return buildFuturesPick(index + 1, instrument, selectPreferredTimeframeSnapshot(snapshots), "structured_api");
    })
  );
}

async function fetchFuturesApiSnapshot(
  instrument: (typeof FUTURES_INSTRUMENTS)[number],
  timeframeLabel: string
): Promise<FuturesDetailSnapshot> {
  const timeframe = toApiTimeframe(timeframeLabel);
  const url = new URL(UPSIGNAL_FUTURES_API_URL);
  url.searchParams.set("timeframe", timeframe);
  url.searchParams.set("code", instrument.apiCode);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("futures_api_request_failed");
    const payload = (await response.json()) as FuturesBoardApiResponse;
    return mapFuturesApiSnapshot(payload, instrument, timeframeLabel);
  } finally {
    clearTimeout(timeout);
  }
}

function mapFuturesApiSnapshot(
  payload: FuturesBoardApiResponse,
  instrument: (typeof FUTURES_INSTRUMENTS)[number],
  timeframeLabel: string
): FuturesDetailSnapshot {
  const data = payload.data;
  const quote = data?.instruments?.find((item) => item.code === instrument.apiCode) ?? null;
  const profile = data?.strategy_profile ?? null;
  const performance = data?.strategy_performance ?? null;
  const position = readApiPosition(performance?.current_position);
  const qualityReady = quote?.quality_status === "ok";
  return {
    title: quote?.name ?? instrument.name,
    rawText: qualityReady ? "structured_api_ready" : "structured_api_not_ready",
    sourceName: quote?.source_provider ?? null,
    statusLabel: qualityReady ? "정상" : quote?.quality_status ?? "미수집",
    currentValue: formatApiNumber(quote?.current_price),
    changeRate: formatApiPercent(quote?.change_percent),
    observedAtLabel: quote?.quote_time ?? payload.meta?.as_of ?? null,
    strategyName: profile?.display_name ?? null,
    strategyStatus: profile?.status ?? null,
    timeframe: timeframeLabel,
    performancePeriod: buildApiPerformancePeriod(performance),
    realizedProfit: formatApiPoints(performance?.realized_points),
    realizedProfitMoney: formatApiMoney(performance?.realized_cash, performance?.cash_currency),
    completedTrades: formatApiCount(performance?.completed_trades),
    winRate: formatApiPercent(performance?.win_rate),
    currentPosition: position.label,
    entryValue: position.entryValue,
    unrealizedProfit: formatApiPoints(position.unrealizedPoints ?? performance?.unrealized_points),
    signalLabel: quote?.signal?.signal_label ?? null,
    marketState: quote?.signal?.regime ?? null,
    confidence: formatApiPercent(quote?.signal?.confidence),
    indicatorSummary: quote?.signal?.reason ?? null,
    upperLevels: (quote?.signal?.upper_targets ?? []).map((value) => formatApiNumber(value)).filter((value): value is string => Boolean(value)),
    lowerLevels: (quote?.signal?.lower_targets ?? []).map((value) => formatApiNumber(value)).filter((value): value is string => Boolean(value))
  };
}

async function tryFetchFuturesSignalsWithPlaywright(
  limit: number,
  reportSession: DailyMarketReportSession,
  instruments: Array<(typeof FUTURES_INSTRUMENTS)[number]>
): Promise<DailyBriefFuturesPick[]> {
  const importer = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  const playwrightModule = await importer("playwright");
  const chromium = (playwrightModule as { chromium?: ChromiumLike }).chromium;
  if (!chromium) return [];

  const browser = await launchChromium(chromium);
  try {
    const page = await (browser as BrowserLike).newPage({ viewport: { width: 1440, height: 1120 }, deviceScaleFactor: 1 });
    await page.goto(UPSIGNAL_FUTURES_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissFuturesOverlays(page);
    await page.waitForTimeout(1200);
    await waitForFuturesCards(page);
    const items: DailyBriefFuturesPick[] = [];
    const timeframePriority = getDailyMarketReportProfile(reportSession).timeframePriority;
    for (const instrument of instruments.slice(0, limit)) {
      const instrumentCardText = await clickFuturesInstrument(page, instrument.name);
      if (!instrumentCardText) {
        items.push(buildUnavailableFuturesPick(items.length + 1, instrument, "futures_instrument_button_not_found"));
        continue;
      }
      await page.waitForTimeout(650);
      const timeframeSnapshots: FuturesDetailSnapshot[] = [];
      for (const timeframe of timeframePriority) {
        await clickFuturesTimeframe(page, timeframe);
        await page.waitForTimeout(450);
        timeframeSnapshots.push({ ...(await extractFuturesDetailSnapshot(page)), instrumentCardText });
      }

      const selectedSnapshot = selectPreferredTimeframeSnapshot(timeframeSnapshots);
      let parsed = buildFuturesPick(items.length + 1, instrument, selectedSnapshot);
      if (!parsed.dataReady && parsed.warnings.includes("futures_detail_temporarily_not_ready")) {
        await page.waitForTimeout(1100);
        parsed = buildFuturesPick(
          items.length + 1,
          instrument,
          { ...(await extractFuturesDetailSnapshot(page)), instrumentCardText },
          "retry"
        );
      }
      items.push(parsed);
    }

    return items;
  } finally {
    await (browser as BrowserLike).close();
  }
}

function orderInstruments(symbolPriority: string[]) {
  return [...FUTURES_INSTRUMENTS].sort((a, b) => symbolPriority.indexOf(a.symbol) - symbolPriority.indexOf(b.symbol));
}

function prioritizeKoreaSessionSignals(items: DailyBriefFuturesPick[], session: DailyMarketReportSession) {
  if (session !== "korea_intraday" && session !== "korea_close") return items;
  const kospi = items.find((item) => item.symbol === "KOSPI200");
  if (kospi && hasOpenPosition(kospi.currentPosition)) return items;
  const fallbackOrder = ["NQ", "ES", "KOSPI200", "WTI", "GOLD", "EURUSD"];
  return [...items].sort((a, b) => fallbackOrder.indexOf(a.symbol) - fallbackOrder.indexOf(b.symbol));
}

function selectPreferredTimeframeSnapshot(snapshots: FuturesDetailSnapshot[]) {
  const openPosition = snapshots.find((snapshot) => hasOpenPosition(snapshot.currentPosition));
  if (openPosition) return openPosition;
  return snapshots.find((snapshot) => snapshot.currentValue && snapshot.strategyName) ?? snapshots.at(-1) ?? emptyFuturesSnapshot();
}

function hasOpenPosition(value: string | null) {
  return Boolean(value && !/진입\s*없음|없음|대기|-/.test(value));
}

function emptyFuturesSnapshot(): FuturesDetailSnapshot {
  return {
    title: "",
    rawText: "",
    sourceName: null,
    statusLabel: null,
    currentValue: null,
    changeRate: null,
    observedAtLabel: null,
    strategyName: null,
    strategyStatus: null,
    timeframe: null,
    performancePeriod: null,
    realizedProfit: null,
    realizedProfitMoney: null,
    completedTrades: null,
    winRate: null,
    currentPosition: null,
    entryValue: null,
    unrealizedProfit: null,
    signalLabel: null,
    marketState: null,
    confidence: null,
    indicatorSummary: null,
    upperLevels: [],
    lowerLevels: []
  };
}

function buildUnavailableFuturesPick(
  rank: number,
  instrument: (typeof FUTURES_INSTRUMENTS)[number],
  warning: string
): DailyBriefFuturesPick {
  return {
    rank,
    symbol: instrument.symbol,
    name: instrument.name,
    exchange: instrument.exchange,
    sourceName: null,
    statusLabel: null,
    currentValue: null,
    changeRate: null,
    observedAtLabel: null,
    strategyName: null,
    strategyStatus: null,
    timeframe: null,
    performancePeriod: null,
    realizedProfit: null,
    realizedProfitMoney: null,
    completedTrades: null,
    winRate: null,
    currentPosition: null,
    entryValue: null,
    unrealizedProfit: null,
    signalLabel: null,
    marketState: null,
    confidence: null,
    indicatorSummary: null,
    upperLevels: [],
    lowerLevels: [],
    sourceUrl: UPSIGNAL_FUTURES_URL,
    dataReady: false,
    warnings: [warning]
  };
}

function buildFuturesPick(
  rank: number,
  instrument: (typeof FUTURES_INSTRUMENTS)[number],
  snapshot: FuturesDetailSnapshot,
  attempt = "initial"
): DailyBriefFuturesPick {
  const nameMismatch = snapshot.title && FUTURES_INSTRUMENTS.some((item) => item.name !== instrument.name && snapshot.title.includes(item.name));
  const warnings = [
    ...(nameMismatch ? ["futures_detail_title_mismatch"] : []),
    ...(snapshot.rawText.includes("미수집") || snapshot.rawText.includes("데이터 부족") ? ["futures_detail_temporarily_not_ready"] : []),
    ...(attempt === "retry" ? ["futures_detail_retry_used"] : [])
  ];
  const dataReady = Boolean(snapshot.currentValue && snapshot.strategyName && !warnings.includes("futures_detail_title_mismatch"));
  const parsedCurrentValue =
    parseCurrentValueFromInstrumentCard(snapshot.instrumentCardText ?? null, instrument.name, instrument.exchange) ??
    parseCurrentValueFromInstrumentCard(snapshot.rawText, instrument.name, instrument.exchange) ??
    snapshot.currentValue;
  const parsedChangeRate =
    parseChangeRateFromInstrumentCard(snapshot.instrumentCardText ?? null, instrument.name, instrument.exchange) ??
    snapshot.changeRate;

  return {
    rank,
    symbol: instrument.symbol,
    name: instrument.name,
    exchange: instrument.exchange,
    sourceName: snapshot.sourceName,
    statusLabel: snapshot.statusLabel,
    currentValue: parsedCurrentValue,
    changeRate: parsedChangeRate,
    observedAtLabel: snapshot.observedAtLabel,
    strategyName: snapshot.strategyName,
    strategyStatus: snapshot.strategyStatus,
    timeframe: snapshot.timeframe,
    performancePeriod: snapshot.performancePeriod,
    realizedProfit: snapshot.realizedProfit,
    realizedProfitMoney: snapshot.realizedProfitMoney,
    completedTrades: snapshot.completedTrades,
    winRate: snapshot.winRate,
    currentPosition: snapshot.currentPosition,
    entryValue: snapshot.entryValue,
    unrealizedProfit: snapshot.unrealizedProfit,
    signalLabel: snapshot.signalLabel,
    marketState: snapshot.marketState,
    confidence: snapshot.confidence,
    indicatorSummary: snapshot.indicatorSummary,
    upperLevels: snapshot.upperLevels,
    lowerLevels: snapshot.lowerLevels,
    sourceUrl: UPSIGNAL_FUTURES_URL,
    dataReady,
    warnings: Array.from(new Set(warnings))
  };
}

async function waitForFuturesCards(page: PageLike) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const readyCount = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button[class*='FuturesBoard_instrument']"));
      return buttons.filter((button) => {
        const text = (button.textContent || "").replace(/\s+/g, " ");
        return !text.includes("미수집") && /\d/.test(text);
      }).length;
    });
    if (readyCount >= 3) return;
    await page.waitForTimeout(1000);
  }
}

async function clickFuturesInstrument(page: PageLike, name: string) {
  return page.evaluate((targetName) => {
    const buttons = Array.from(document.querySelectorAll("button[class*='FuturesBoard_instrument']")) as HTMLButtonElement[];
    const button = buttons.find((item) => (item.textContent || "").includes(targetName));
    if (!button) return null;
    const text = (button.textContent || "").replace(/\s+/g, " ").trim();
    button.click();
    return text;
  }, name);
}

function parseCurrentValueFromInstrumentCard(cardText: string | null, name: string, exchange: string) {
  if (!cardText) return null;
  const normalized = cardText.replace(/\s+/g, " ").trim();
  const afterName = normalized.includes(name) ? normalized.slice(normalized.indexOf(name) + name.length) : normalized;
  const afterExchange = afterName.includes(exchange) ? afterName.slice(afterName.indexOf(exchange) + exchange.length) : afterName;
  return afterExchange.match(/([+-]?\d[\d,.]*)/)?.[1] ?? null;
}

function parseChangeRateFromInstrumentCard(cardText: string | null, name: string, exchange: string) {
  if (!cardText) return null;
  const normalized = cardText.replace(/\s+/g, " ").trim();
  const afterName = normalized.includes(name) ? normalized.slice(normalized.indexOf(name) + name.length) : normalized;
  const afterExchange = afterName.includes(exchange) ? afterName.slice(afterName.indexOf(exchange) + exchange.length) : afterName;
  return afterExchange.match(/[+-]?\d[\d,.]*\s*([+-]\d+(?:\.\d+)?%)/)?.[1] ?? null;
}

async function clickFuturesTimeframe(page: PageLike, label: string) {
  await page
    .evaluate((targetLabel) => {
      const buttons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
      const button = buttons.find((item) => (item.textContent || "").trim() === targetLabel);
      button?.click();
    }, label)
    .catch(() => undefined);
}

async function extractFuturesDetailSnapshot(page: PageLike): Promise<FuturesDetailSnapshot> {
  return page.evaluate(() => {
    const textOf = (selector: string) => (document.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim();
    const title = textOf("h2");
    const quoteText = textOf("[class*='FuturesBoard_quoteRow']");
    const strategyText = textOf("[class*='FuturesBoard_strategyRow']");
    const performanceText = textOf("[class*='FuturesBoard_performanceBand']");
    const signalText = textOf("[class*='FuturesBoard_signalPane']");
    const activeTimeframe =
      Array.from(document.querySelectorAll("[aria-label='시간봉 선택'] button"))
        .find((button) => button.getAttribute("aria-pressed") === "true")
        ?.textContent?.trim() || null;
    const rawText = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const quoteParts = quoteText.split(" ").filter(Boolean);
    const normalizedStrategy = strategyText.replace(/^적용 전략\s*/, "").replace(/신호 표시.*$/, "").trim();
    const metricBlocks = Array.from(document.querySelectorAll("[class*='FuturesBoard_performanceMetrics'] > div")).map((node) =>
      (node.textContent || "").replace(/\s+/g, " ").trim()
    );
    const levelSections = Array.from(document.querySelectorAll("[class*='FuturesBoard_levelSection']")).map((node) =>
      (node.textContent || "").replace(/\s+/g, " ").trim()
    );

    return {
      title,
      rawText,
      sourceName: quoteParts[0] && !/^[\d,.-]/.test(quoteParts[0]) ? quoteParts[0] : null,
      statusLabel: quoteText.includes("정상") ? "정상" : quoteText.includes("미수집") ? "미수집" : null,
      currentValue: quoteText.match(/(?:정상|미수집)\s*([+-]?\d[\d,.]*)/)?.[1] || quoteParts.find((part) => /^[+-]?\d[\d,.]*$/.test(part) && part.length > 2) || null,
      changeRate: quoteText.match(/(?:정상|미수집)\s*[+-]?\d[\d,.]*\s*([+-]\d+(?:\.\d+)?%)/)?.[1] || quoteParts.find((part) => /^[+-]\d+(?:\.\d+)?%$/.test(part)) || null,
      observedAtLabel: quoteText.match(/\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.[^적용]+/)?.[0]?.trim() || null,
      strategyName: normalizedStrategy || null,
      strategyStatus: null,
      timeframe: activeTimeframe,
      performancePeriod: performanceText.match(/\d{4}\.\s*\d{2}\.\s*\d{2}\.\s*~\s*\d{4}\.\s*\d{2}\.\s*\d{2}\.[^누적]+/)?.[0]?.trim() || null,
      realizedProfit: metricBlocks.find((block) => block.includes("누적 실현 손익"))?.replace(/^누적 실현 손익\s*/, "").replace(/\s*(?:ES|NQ|QM|QO|E7|Mini).*$/, "").trim() || null,
      realizedProfitMoney: metricBlocks.find((block) => block.includes("누적 실현 손익"))?.match(/[+−-]?(?:₩|US\$)[\d,]+(?:\.\d+)?/)?.[0] || null,
      completedTrades: metricBlocks.find((block) => block.includes("완료 거래"))?.match(/완료 거래\s*([\d,]+회?)/)?.[1] || null,
      winRate: metricBlocks.find((block) => block.includes("승률"))?.match(/승률\s*([\d.]+%)/)?.[1] || null,
      currentPosition: metricBlocks.find((block) => block.includes("현재 포지션"))?.replace(/^현재 포지션\s*/, "").replace(/\s*진입\s.*$/, "").trim() || null,
      entryValue: metricBlocks.find((block) => block.includes("현재 포지션"))?.match(/진입\s*([\d,.]+)/)?.[1] || null,
      unrealizedProfit: metricBlocks.find((block) => block.includes("미실현 손익"))?.replace(/^미실현 손익\s*/, "").replace(/\s*(?:ES|NQ|QM|QO|E7|Mini).*$/, "").trim() || null,
      signalLabel: signalText.match(/시장 신호\s*(?:단기|중기|장기)?\s*([^시장]+?)\s*시장 상태/)?.[1]?.trim() || null,
      marketState: signalText.match(/시장 상태\s*([^\s]+)\s*신뢰도/)?.[1]?.trim() || null,
      confidence: signalText.match(/신뢰도\s*([\d.]+%)/)?.[1] || null,
      indicatorSummary: signalText.match(/EMA20[^.]+기준입니다\./)?.[0] || null,
      upperLevels: parseLevels(levelSections.find((section) => section.includes("상단 참고 구간")) || ""),
      lowerLevels: parseLevels(levelSections.find((section) => section.includes("하단 참고 구간")) || "")
    };

    function parseLevels(value: string) {
      return Array.from(value.matchAll(/\d차\s*([\d,.]+)/g)).map((match) => match[1]).filter(Boolean);
    }
  });
}

async function dismissFuturesOverlays(page: PageLike) {
  await page.keyboard?.press("Escape").catch(() => undefined);
  await page
    .evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
      for (const button of buttons) {
        const text = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""}`.trim();
        if (/닫기|오늘 그만 보기|다시 열지 않음|×/.test(text)) {
          button.click();
        }
      }
    })
    .catch(() => undefined);
}

async function launchChromium(chromium: ChromiumLike) {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ headless: true, channel: "chrome" });
  }
}

interface FuturesDetailSnapshot {
  title: string;
  rawText: string;
  instrumentCardText?: string | null;
  sourceName: string | null;
  statusLabel: string | null;
  currentValue: string | null;
  changeRate: string | null;
  observedAtLabel: string | null;
  strategyName: string | null;
  strategyStatus: string | null;
  timeframe: string | null;
  performancePeriod: string | null;
  realizedProfit: string | null;
  realizedProfitMoney: string | null;
  completedTrades: string | null;
  winRate: string | null;
  currentPosition: string | null;
  entryValue: string | null;
  unrealizedProfit: string | null;
  signalLabel: string | null;
  marketState: string | null;
  confidence: string | null;
  indicatorSummary: string | null;
  upperLevels: string[];
  lowerLevels: string[];
}

interface FuturesBoardApiPerformance {
  coverage_start?: string | null;
  coverage_end?: string | null;
  realized_points?: number | null;
  unrealized_points?: number | null;
  realized_cash?: number | null;
  cash_currency?: string | null;
  completed_trades?: number | null;
  win_rate?: number | null;
  current_position?: unknown;
}

interface FuturesBoardApiResponse {
  data?: {
    timeframe?: string;
    selected_code?: string;
    instruments?: Array<{
      code: string;
      name?: string;
      current_price?: number | null;
      change_percent?: number | null;
      quote_time?: string | null;
      source_provider?: string | null;
      quality_status?: string | null;
      signal?: {
        signal_label?: string | null;
        regime?: string | null;
        confidence?: number | null;
        reason?: string | null;
        upper_targets?: number[];
        lower_targets?: number[];
      } | null;
    }>;
    strategy_profile?: {
      display_name?: string | null;
      status?: string | null;
    } | null;
    strategy_performance?: FuturesBoardApiPerformance | null;
  };
  meta?: {
    as_of?: string | null;
  };
}

function toApiTimeframe(label: string) {
  if (label === "240분봉") return "240m";
  if (label === "60분봉") return "60m";
  return "10m";
}

function readApiPosition(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { label: "진입 없음", entryValue: null, unrealizedPoints: null };
  }
  const position = value as Record<string, unknown>;
  const side = readString(position.side) ?? readString(position.direction) ?? readString(position.position);
  const label = side === "long" ? "매수 진입" : side === "short" ? "매도 진입" : side ?? "진입 없음";
  return {
    label,
    entryValue: formatApiNumber(readNumber(position.entry_price) ?? readNumber(position.entryValue)),
    unrealizedPoints: readNumber(position.unrealized_points) ?? readNumber(position.unrealizedProfit)
  };
}

function buildApiPerformancePeriod(performance: FuturesBoardApiPerformance | null | undefined) {
  const start = performance?.coverage_start;
  const end = performance?.coverage_end;
  return start && end ? `${start} ~ ${end}` : start ?? end ?? null;
}

function formatApiNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(value);
}

function formatApiPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value > 0 ? "+" : ""}${Math.round(value * 100) / 100}%`;
}

function formatApiPoints(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${value > 0 ? "+" : ""}${Math.round(value * 10000) / 10000} pt`;
}

function formatApiMoney(value: number | null | undefined, currency: string | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const prefix = currency === "KRW" ? "₩" : currency === "USD" ? "US$" : currency ? `${currency} ` : "";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${prefix}${Math.abs(Math.round(value)).toLocaleString("en-US")}`;
}

function formatApiCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}회` : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface ChromiumLike {
  launch(options: { headless: boolean; channel?: string }): Promise<unknown>;
}

interface BrowserLike {
  newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  keyboard?: {
    press(key: string): Promise<void>;
  };
  evaluate<T, TArg = undefined>(callback: (arg: TArg) => T | Promise<T>, arg?: TArg): Promise<T>;
}
