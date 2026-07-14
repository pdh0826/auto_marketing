export type DailyBriefRunStatus = "created" | "captured" | "researched" | "content_generated" | "failed";
export type DailyBriefCaptureMode = "live_screenshot" | "placeholder";
export type DailyBriefCaptureTarget =
  | "kr_signal_board"
  | "stock_signal_chart"
  | "etf_signal_board"
  | "futures_signal_board"
  | "futures_signal_detail";

export interface DailyBriefRun {
  id: string;
  status: DailyBriefRunStatus;
  marketDate: string;
  title: string;
  targetKeyword: string;
  stockPickLimit: number;
  stockDetailLimit: number;
  etfPickLimit: number;
  includeEtfs: boolean;
  krBoardUrl: string;
  etfBoardUrl: string;
  stockPicks: DailyBriefStockPick[];
  etfPicks: DailyBriefEtfPick[];
  futuresPicks?: DailyBriefFuturesPick[];
  researchItems: DailyBriefResearchItem[];
  officialDisclosureItems: DailyBriefOfficialDisclosureItem[];
  prewriteContextItems: DailyBriefPrewriteContextItem[];
  captures: DailyBriefCapture[];
  contentItemId: string | null;
  tistoryReviewContentItemId?: string | null;
  tistoryReviewExportUrl?: string | null;
  tistoryReviewMode?: DailyTistorySignalReviewMode | null;
  tistoryReviewOutputs?: Record<string, DailyTistoryReviewOutputSummary>;
  draftMarkdownLength: number | null;
  draftHtmlLength: number | null;
  visibleTextLength: number | null;
  warnings: string[];
  sideEffectSummary: DailyBriefSideEffectSummary;
  createdAt: string;
  updatedAt: string;
}

export interface DailyBriefStockPick {
  rank: number;
  name: string;
  code: string;
  market: string;
  statusLabel: string | null;
  currentPrice: string | null;
  entryPrice: string | null;
  targetPrice: string | null;
  stopLoss: string | null;
  recentSignalDate: string | null;
  trendScore: string | null;
  totalScore: string | null;
  detailUrl: string;
  chartCaptureId: string | null;
}

export interface DailyBriefEtfPick {
  rank: number;
  name: string;
  code: string;
  category: string | null;
  statusLabel: string | null;
  currentPrice: string | null;
  targetPotential: string | null;
  recentBuyDate: string | null;
  currentReturn: string | null;
  totalScore: string | null;
}

export interface DailyBriefFuturesPick {
  rank: number;
  symbol: string;
  name: string;
  exchange: string;
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
  sourceUrl: string;
  dataReady: boolean;
  warnings: string[];
}

export type DailyTistorySignalReviewMode = "stock_signal_top3_review" | "mixed_stock_etf_review" | "etf_sector_review" | "futures_options_signal_record";

export interface DailyTistorySignalReviewSelection {
  mode: DailyTistorySignalReviewMode;
  modeReason: string;
  recentSignalWindowDays: number;
  topTwentyCount: number;
  recentSignalStockCount: number;
  selectedStockCodes: string[];
  selectedEtfCodes: string[];
  selectedFuturesSymbols?: string[];
  marketReportSession?: import("./market-report-session").DailyMarketReportSession;
  futuresEditorialTrack?: import("./market-report-session").DailyFuturesEditorialTrack;
  warnings: string[];
}

export interface DailyTistoryReviewOutputSummary {
  contentItemId: string;
  previewUrl: string;
  mode: DailyTistorySignalReviewMode;
  selectedStockCodes?: string[];
  selectedEtfCodes?: string[];
  selectedFuturesSymbols?: string[];
  marketReportSession?: import("./market-report-session").DailyMarketReportSession;
  futuresEditorialTrack?: import("./market-report-session").DailyFuturesEditorialTrack;
  createdAt: string;
}

export interface DailyBriefResearchItem {
  symbolCode: string;
  symbolName: string;
  query: string;
  searchUrl: string;
  title: string;
  source: string;
  sourceName?: string | null;
  publishedAt: string | null;
  url: string;
  shortSummary: string;
}

export interface DailyBriefOfficialDisclosureItem {
  symbolCode: string;
  symbolName: string;
  title: string;
  source: "dart_openapi";
  sourceName: "DART 전자공시";
  publishedAt: string | null;
  url: string;
  receiptNo: string | null;
  shortSummary: string;
}

export interface DailyBriefPrewriteContextItem {
  kind:
    | "market_kr_flow"
    | "market_us_flow"
    | "market_supply"
    | "futures_market_context"
    | "stock_chart_context"
    | "stock_upsignal_issue"
    | "etf_market_context"
    | "writing_angle";
  symbolCode?: string | null;
  symbolName?: string | null;
  title: string;
  summary: string;
  sourceName: string;
  url?: string | null;
  publishedAt?: string | null;
  confidence: "high" | "medium" | "low";
}

export interface DailyBriefCapture {
  id: string;
  kind: "kr_board" | "stock_chart" | "etf_board" | "futures_board" | "futures_detail";
  label: string;
  sourceUrl: string;
  target: DailyBriefCaptureTarget;
  selectorUsed: string | null;
  storagePath: string;
  fileName: string;
  mimeType: "image/png";
  fileSize: number;
  width: number | null;
  height: number | null;
  mode: DailyBriefCaptureMode;
  warning: string | null;
  createdAt: string;
}

export interface DailyBriefSideEffectSummary {
  dbWrite: boolean;
  contentItemCreated: boolean;
  contentAssetCreated: boolean;
  upsignalRead: boolean;
  newsSearchRead: boolean;
  bloggerApiRead: false;
  bloggerApiWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  tokenRefresh: false;
  llmCall: false;
  llmCallLogCreated: false;
}

export interface DailyBriefCreateRequest {
  marketDate?: unknown;
  title?: unknown;
  targetKeyword?: unknown;
  stockPickLimit?: unknown;
  stockDetailLimit?: unknown;
  etfPickLimit?: unknown;
  includeEtfs?: unknown;
}

export interface DailyBriefRunSummary {
  id: string;
  status: DailyBriefRunStatus;
  marketDate: string;
  title: string;
  stockPickCount: number;
  etfPickCount: number;
  researchItemCount: number;
  captureCount: number;
  contentItemId: string | null;
  updatedAt: string;
}
