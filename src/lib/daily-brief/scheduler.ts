import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { runDailyBriefRunAll } from "@/lib/daily-brief/run-all";
import { buildDailyBriefSeoTitle, createDailyBriefRun, listDailyBriefRuns } from "@/lib/daily-brief/store";

const schedulerRoot = path.join(process.cwd(), "local-data", "daily-brief-scheduler");
const configPath = path.join(schedulerRoot, "config.json");
const statePath = path.join(schedulerRoot, "state.json");
const defaultIntervalMs = 60_000;

export interface DailyBriefSchedulerConfig {
  enabled: boolean;
  scheduleTime: string;
  timezone: string;
  targetKeyword: string;
  stockPickLimit: number;
  stockDetailLimit: number;
  etfPickLimit: number;
  includeEtfs: boolean;
  mode: "content_only";
}

export interface DailyBriefSchedulerState {
  running: boolean;
  intervalMs: number;
  startedAt: string | null;
  stoppedAt: string | null;
  lastTickAt: string | null;
  lastDueCheckLocalDate: string | null;
  lastRunDate: string | null;
  lastRunId: string | null;
  lastContentItemId: string | null;
  lastResult: "idle" | "skipped" | "success" | "failed";
  lastMessage: string | null;
  inFlight: boolean;
}

export interface DailyBriefSchedulerStatus {
  config: DailyBriefSchedulerConfig;
  state: DailyBriefSchedulerState;
  nextActionSummary: {
    serverProcessTimerActive: boolean;
    webServerMustStayRunning: true;
    bloggerDraftSave: false;
    bloggerPublish: false;
    tokenRefresh: false;
    llmCall: false;
  };
}

interface SchedulerRuntime {
  timer: NodeJS.Timeout | null;
  inFlight: boolean;
}

const runtime = getSchedulerRuntime();

export async function getDailyBriefSchedulerStatus(): Promise<DailyBriefSchedulerStatus> {
  const config = await getDailyBriefSchedulerConfig();
  if (config.enabled && !runtime.timer) {
    await startDailyBriefScheduler();
  }
  return {
    config,
    state: {
      ...(await getDailyBriefSchedulerState()),
      running: Boolean(runtime.timer),
      inFlight: runtime.inFlight
    },
    nextActionSummary: buildSchedulerSideEffectSummary()
  };
}

export async function getDailyBriefSchedulerConfig(): Promise<DailyBriefSchedulerConfig> {
  await mkdir(schedulerRoot, { recursive: true });
  try {
    const raw = await readFile(configPath, "utf8");
    return normalizeConfig(JSON.parse(raw) as Partial<DailyBriefSchedulerConfig>);
  } catch {
    const config = normalizeConfig({});
    await writeDailyBriefSchedulerConfigFile(config);
    return config;
  }
}

export async function writeDailyBriefSchedulerConfig(input: Partial<DailyBriefSchedulerConfig>) {
  const current = await getDailyBriefSchedulerConfig().catch(() => normalizeConfig({}));
  const config = normalizeConfig({ ...current, ...input });
  config.enabled = typeof input.enabled === "boolean" ? input.enabled : current.enabled;
  await mkdir(schedulerRoot, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  if (config.enabled) {
    await startDailyBriefScheduler();
  } else {
    await stopDailyBriefScheduler();
  }
  return getDailyBriefSchedulerStatus();
}

async function writeDailyBriefSchedulerConfigFile(config: DailyBriefSchedulerConfig) {
  await mkdir(schedulerRoot, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

export async function startDailyBriefScheduler() {
  const config = await getDailyBriefSchedulerConfig();
  await writeDailyBriefSchedulerConfigFile({ ...config, enabled: true });
  if (!runtime.timer) {
    runtime.timer = setInterval(() => {
      void tickDailyBriefScheduler({ force: false });
    }, defaultIntervalMs);
  }
  const state = await updateDailyBriefSchedulerState({
    running: true,
    intervalMs: defaultIntervalMs,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    inFlight: runtime.inFlight,
    lastMessage: "scheduler_started"
  });
  return {
    config: await getDailyBriefSchedulerConfig(),
    state,
    nextActionSummary: buildSchedulerSideEffectSummary()
  };
}

export async function stopDailyBriefScheduler() {
  const config = await getDailyBriefSchedulerConfig();
  await writeDailyBriefSchedulerConfigFile({ ...config, enabled: false });
  if (runtime.timer) {
    clearInterval(runtime.timer);
    runtime.timer = null;
  }
  const state = await updateDailyBriefSchedulerState({
    running: false,
    stoppedAt: new Date().toISOString(),
    inFlight: false,
    lastMessage: "scheduler_stopped"
  });
  return {
    config: await getDailyBriefSchedulerConfig(),
    state,
    nextActionSummary: buildSchedulerSideEffectSummary()
  };
}

export async function tickDailyBriefScheduler(input: { force: boolean }) {
  if (runtime.inFlight) {
    const state = await updateDailyBriefSchedulerState({
      lastTickAt: new Date().toISOString(),
      lastResult: "skipped",
      lastMessage: "scheduler_run_already_in_flight",
      inFlight: true
    });
    return { status: "skipped" as const, reason: "scheduler_run_already_in_flight", state };
  }

  const config = await getDailyBriefSchedulerConfig();
  const localNow = getLocalDateTime(config.timezone);
  const due = input.force || (config.enabled && localNow.time === config.scheduleTime);
  await updateDailyBriefSchedulerState({
    lastTickAt: new Date().toISOString(),
    lastDueCheckLocalDate: localNow.date,
    inFlight: false
  });

  if (!due) {
    const state = await updateDailyBriefSchedulerState({
      lastResult: "skipped",
      lastMessage: `not_due:${localNow.date} ${localNow.time}`
    });
    return { status: "skipped" as const, reason: "not_due", state };
  }

  const existingRun = await findGeneratedRunForDate(localNow.date);
  if (existingRun) {
    const state = await updateDailyBriefSchedulerState({
      lastRunDate: localNow.date,
      lastRunId: existingRun.id,
      lastContentItemId: existingRun.contentItemId,
      lastResult: "skipped",
      lastMessage: "daily_brief_already_generated_for_date"
    });
    return { status: "skipped" as const, reason: "daily_brief_already_generated_for_date", state };
  }

  runtime.inFlight = true;
  await updateDailyBriefSchedulerState({ inFlight: true, lastMessage: "scheduler_run_started" });
  try {
    const run = await createDailyBriefRun({
      marketDate: localNow.date,
      title: buildDailyBriefSeoTitle(config.stockPickLimit),
      targetKeyword: config.targetKeyword,
      stockPickLimit: config.stockPickLimit,
      stockDetailLimit: config.stockDetailLimit,
      etfPickLimit: config.etfPickLimit,
      includeEtfs: config.includeEtfs
    });
    const result = await runDailyBriefRunAll(run.id);
    if (!result.ok) {
      runtime.inFlight = false;
      const state = await updateDailyBriefSchedulerState({
        lastRunDate: localNow.date,
        lastRunId: result.run.id,
        lastContentItemId: null,
        lastResult: "failed",
        lastMessage: `daily_brief_not_ready:${result.readiness.blockingReasons.join(",")}`,
        inFlight: false
      });
      return { status: "failed" as const, reason: "daily_brief_not_ready", result, state };
    }

    runtime.inFlight = false;
    const state = await updateDailyBriefSchedulerState({
      lastRunDate: localNow.date,
      lastRunId: result.run.id,
      lastContentItemId: result.contentItemId,
      lastResult: "success",
      lastMessage: `content_generated:${result.contentItemId}`,
      inFlight: false
    });
    return { status: "success" as const, result, state };
  } catch (error) {
    runtime.inFlight = false;
    const state = await updateDailyBriefSchedulerState({
      lastRunDate: localNow.date,
      lastResult: "failed",
      lastMessage: error instanceof Error ? error.message.slice(0, 180) : "scheduler_run_failed",
      inFlight: false
    });
    return { status: "failed" as const, reason: "scheduler_run_failed", state };
  } finally {
    runtime.inFlight = false;
  }
}

async function getDailyBriefSchedulerState(): Promise<DailyBriefSchedulerState> {
  await mkdir(schedulerRoot, { recursive: true });
  try {
    const raw = await readFile(statePath, "utf8");
    return normalizeState(JSON.parse(raw) as Partial<DailyBriefSchedulerState>);
  } catch {
    const state = normalizeState({});
    await writeDailyBriefSchedulerState(state);
    return state;
  }
}

async function updateDailyBriefSchedulerState(input: Partial<DailyBriefSchedulerState>) {
  const current = await getDailyBriefSchedulerState();
  const state = normalizeState({ ...current, ...input, running: Boolean(runtime.timer), inFlight: runtime.inFlight || Boolean(input.inFlight) });
  await writeDailyBriefSchedulerState(state);
  return state;
}

async function writeDailyBriefSchedulerState(state: DailyBriefSchedulerState) {
  await mkdir(schedulerRoot, { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

async function findGeneratedRunForDate(marketDate: string) {
  const runs = await listDailyBriefRuns();
  return runs.find((run) => run.marketDate === marketDate && run.contentItemId) ?? null;
}

function normalizeConfig(input: Partial<DailyBriefSchedulerConfig>): DailyBriefSchedulerConfig {
  const scheduleTime = input.scheduleTime;
  return {
    enabled: input.enabled === true,
    scheduleTime: isTimeString(scheduleTime) ? scheduleTime : "08:00",
    timezone: typeof input.timezone === "string" && input.timezone.trim() ? input.timezone.trim().slice(0, 64) : "Asia/Seoul",
    targetKeyword:
      typeof input.targetKeyword === "string" && input.targetKeyword.trim() ? input.targetKeyword.trim().slice(0, 80) : "오늘의 국내주식 관심종목",
    stockPickLimit: clampNumber(input.stockPickLimit, 8, 1, 20),
    stockDetailLimit: clampNumber(input.stockDetailLimit, 5, 1, 10),
    etfPickLimit: clampNumber(input.etfPickLimit, 5, 0, 20),
    includeEtfs: input.includeEtfs !== false,
    mode: "content_only"
  };
}

function normalizeState(input: Partial<DailyBriefSchedulerState>): DailyBriefSchedulerState {
  return {
    running: input.running === true,
    intervalMs: clampNumber(input.intervalMs, defaultIntervalMs, 10_000, 3_600_000),
    startedAt: input.startedAt ?? null,
    stoppedAt: input.stoppedAt ?? null,
    lastTickAt: input.lastTickAt ?? null,
    lastDueCheckLocalDate: input.lastDueCheckLocalDate ?? null,
    lastRunDate: input.lastRunDate ?? null,
    lastRunId: input.lastRunId ?? null,
    lastContentItemId: input.lastContentItemId ?? null,
    lastResult: input.lastResult ?? "idle",
    lastMessage: input.lastMessage ?? null,
    inFlight: input.inFlight === true
  };
}

function getLocalDateTime(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function isTimeString(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) && Number(value.slice(0, 2)) < 24 && Number(value.slice(3, 5)) < 60;
}

function buildSchedulerSideEffectSummary() {
  return {
    serverProcessTimerActive: Boolean(runtime.timer),
    webServerMustStayRunning: true as const,
    bloggerDraftSave: false as const,
    bloggerPublish: false as const,
    tokenRefresh: false as const,
    llmCall: false as const
  };
}

function getSchedulerRuntime() {
  const globalWithScheduler = globalThis as typeof globalThis & { __dailyBriefSchedulerRuntime?: SchedulerRuntime };
  if (!globalWithScheduler.__dailyBriefSchedulerRuntime) {
    globalWithScheduler.__dailyBriefSchedulerRuntime = {
      timer: null,
      inFlight: false
    };
  }
  return globalWithScheduler.__dailyBriefSchedulerRuntime;
}
