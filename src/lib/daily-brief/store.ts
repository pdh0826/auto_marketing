import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import type { DailyBriefRun, DailyBriefRunSummary, DailyBriefSideEffectSummary, DailyBriefStockPick } from "./types";
import { buildInvestmentSeoTitle } from "./investment-seo-title";

const runRoot = path.join(process.cwd(), "local-data", "daily-brief-runs");

export async function createDailyBriefRun(input: Partial<DailyBriefRun>) {
  const now = new Date().toISOString();
  const marketDate = input.marketDate ?? now.slice(0, 10);
  const stockPickLimit = input.stockPickLimit ?? 8;
  const id = `daily-${marketDate}-${Date.now().toString(36)}`;
  const run: DailyBriefRun = {
    id,
    status: "created",
    marketDate,
    title: input.title ?? buildDailyBriefSeoTitle(stockPickLimit, { marketDate }),
    targetKeyword: input.targetKeyword ?? "오늘의 국내주식 관심종목",
    stockPickLimit,
    stockDetailLimit: input.stockDetailLimit ?? 5,
    etfPickLimit: input.etfPickLimit ?? 5,
    includeEtfs: input.includeEtfs ?? true,
    krBoardUrl: input.krBoardUrl ?? "https://upsignal.co.kr/kr",
    etfBoardUrl: input.etfBoardUrl ?? "https://upsignal.co.kr/etf/summary",
    stockPicks: [],
    etfPicks: [],
    researchItems: [],
    officialDisclosureItems: [],
    prewriteContextItems: [],
    captures: [],
    contentItemId: null,
    tistoryReviewContentItemId: null,
    tistoryReviewExportUrl: null,
    tistoryReviewMode: null,
    tistoryReviewOutputs: {},
    draftMarkdownLength: null,
    draftHtmlLength: null,
    visibleTextLength: null,
    warnings: [],
    sideEffectSummary: buildDailyBriefSideEffects(),
    createdAt: now,
    updatedAt: now
  };

  await saveDailyBriefRun(run);
  return run;
}

export function buildDailyBriefSeoTitle(
  stockPickLimit: number,
  input: {
    marketDate?: string | null;
    stockPicks?: Pick<DailyBriefStockPick, "name">[];
  } = {}
) {
  return buildInvestmentSeoTitle({
    target: "blogger_daily_brief",
    marketDate: input.marketDate ?? new Date().toISOString().slice(0, 10),
    stockNames: (input.stockPicks ?? []).map((pick) => pick.name),
    stockLimit: stockPickLimit
  });
}

export function isGenericDailyBriefSeoTitle(value: string, stockPickLimit: number) {
  const trimmed = value.trim();
  return (
    trimmed === `오늘의 국내주식 관심종목 TOP ${stockPickLimit}: 급등포착 시그널보드 분석` ||
    trimmed === `오늘의 국내주식 관심종목 TOP ${stockPickLimit}` ||
    /^오늘의 국내주식 관심종목 TOP \d+(?:: 급등포착 시그널보드 분석)?(?: - .+)?$/.test(trimmed) ||
    /^오늘의 국내주식 관심종목 TOP \d+ \| \d{4}\.\d{2}\.\d{2} 급등포착$/.test(trimmed)
  );
}

export async function getDailyBriefRun(id: string) {
  try {
    const raw = await readFile(resolveRunPath(id), "utf8");
    return JSON.parse(raw) as DailyBriefRun;
  } catch {
    return null;
  }
}

export async function listDailyBriefRuns(): Promise<DailyBriefRunSummary[]> {
  await mkdir(runRoot, { recursive: true });
  const names = await readdir(runRoot);
  const runs = await Promise.all(
    names
      .filter((name) => name.endsWith(".json"))
      .map(async (name) => {
        const raw = await readFile(path.join(runRoot, name), "utf8");
        return JSON.parse(raw) as DailyBriefRun;
      })
  );

  return runs
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((run) => ({
      id: run.id,
      status: run.status,
      marketDate: run.marketDate,
      title: run.title,
      stockPickCount: run.stockPicks.length,
      etfPickCount: run.etfPicks.length,
      researchItemCount: run.researchItems.length,
      captureCount: run.captures.length,
      contentItemId: run.contentItemId,
      updatedAt: run.updatedAt
    }));
}

export async function saveDailyBriefRun(run: DailyBriefRun) {
  await mkdir(runRoot, { recursive: true });
  const next = {
    ...run,
    updatedAt: new Date().toISOString()
  };
  await writeFile(resolveRunPath(run.id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function buildDailyBriefSideEffects(overrides: Partial<DailyBriefSideEffectSummary> = {}): DailyBriefSideEffectSummary {
  return {
    dbWrite: false,
    contentItemCreated: false,
    contentAssetCreated: false,
    upsignalRead: false,
    newsSearchRead: false,
    bloggerApiRead: false,
    bloggerApiWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    tokenRefresh: false,
    llmCall: false,
    llmCallLogCreated: false,
    ...overrides
  };
}

function resolveRunPath(id: string) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(id)) {
    throw new Error("invalid_daily_brief_run_id");
  }
  return path.join(runRoot, `${id}.json`);
}
