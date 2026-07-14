import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { runDailyBriefPublishAutomation, type DailyBriefPublishAutomationResult, type DailyBriefSchedulerMode } from "@/lib/daily-brief/publish-automation";
import { runDailyBriefRunAll } from "@/lib/daily-brief/run-all";
import { buildDailyBriefSeoTitle, createDailyBriefRun, getDailyBriefRun } from "@/lib/daily-brief/store";
import { enqueuePublicationLoginAlert, findBloggerLoginBlocker } from "@/lib/automation/publication-login-alert";

const schedulerRoot = path.join(process.cwd(), "local-data", "daily-brief-scheduler");
const configPath = path.join(schedulerRoot, "config.json");
const statePath = path.join(schedulerRoot, "state.json");
const defaultIntervalMs = 60_000;

export interface DailyBriefSchedulerConfig {
  enabled: boolean;
  scheduleTime: string;
  timezone: string;
  businessDaysOnly: boolean;
  targetKeyword: string;
  stockPickLimit: number;
  stockDetailLimit: number;
  etfPickLimit: number;
  includeEtfs: boolean;
  mode: DailyBriefSchedulerMode;
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
  lastAutomationResult: DailyBriefPublishAutomationResult | null;
  lastLoginAlertDate: string | null;
  lastLoginAlertAt: string | null;
  inFlight: boolean;
}

export interface DailyBriefSchedulerStatus {
  config: DailyBriefSchedulerConfig;
  state: DailyBriefSchedulerState;
  nextActionSummary: {
    serverProcessTimerActive: boolean;
    webServerMustStayRunning: true;
    bloggerDraftSave: boolean;
    bloggerPublish: boolean;
    tokenRefresh: false;
    llmCall: false;
    livePublishRequiresEnvFlags: true;
  };
}

interface SchedulerRuntime {
  timer: NodeJS.Timeout | null;
  inFlight: boolean;
  lastKnownMode?: DailyBriefSchedulerMode;
}

const runtime = getSchedulerRuntime();

export async function getDailyBriefSchedulerStatus(): Promise<DailyBriefSchedulerStatus> {
  const config = await getDailyBriefSchedulerConfig();
  runtime.lastKnownMode = config.mode;
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
    const config = normalizeConfig(JSON.parse(raw) as Partial<DailyBriefSchedulerConfig>);
    runtime.lastKnownMode = config.mode;
    return config;
  } catch {
    const config = normalizeConfig({});
    runtime.lastKnownMode = config.mode;
    await writeDailyBriefSchedulerConfigFile(config);
    return config;
  }
}

export async function writeDailyBriefSchedulerConfig(input: Partial<DailyBriefSchedulerConfig>) {
  const current = await getDailyBriefSchedulerConfig().catch(() => normalizeConfig({}));
  const config = normalizeConfig({ ...current, ...input });
  config.enabled = typeof input.enabled === "boolean" ? input.enabled : current.enabled;
  runtime.lastKnownMode = config.mode;
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

export async function tickDailyBriefScheduler(input: { force: boolean; regenerate?: boolean }) {
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
  const businessDay = isBusinessDay(localNow.date, config.timezone);
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

  if (!input.force && config.businessDaysOnly && !businessDay) {
    const state = await updateDailyBriefSchedulerState({
      lastResult: "skipped",
      lastMessage: `not_business_day:${localNow.date}`
    });
    return { status: "skipped" as const, reason: "not_business_day", state };
  }

  const existingRun = input.regenerate === true ? null : await findScheduledRunForDate(localNow.date);
  if (existingRun) {
    if (config.mode !== "content_only" && existingRun.contentItemId) {
      runtime.inFlight = true;
      const automationResult = await runDailyBriefPublishAutomation({
        contentItemId: existingRun.contentItemId,
        mode: config.mode
      });
      const loginAlertState = await enqueueDailyBriefLoginAlertIfNeeded({
        automationResult,
        marketDate: localNow.date,
        scheduledTime: config.scheduleTime
      });
      runtime.inFlight = false;
      const state = await updateDailyBriefSchedulerState({
        lastRunDate: localNow.date,
        lastRunId: existingRun.id,
        lastContentItemId: existingRun.contentItemId,
        lastResult: automationResult.status === "failed" ? "failed" : "success",
        lastMessage: `daily_brief_already_generated_for_date; automation_${automationResult.status}:${automationResult.stage}`,
        lastAutomationResult: automationResult,
        ...loginAlertState,
        inFlight: false
      });
      return {
        status: automationResult.status === "failed" ? ("failed" as const) : ("success" as const),
        reason: "daily_brief_already_generated_for_date",
        automationResult,
        state
      };
    }
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
      title: buildDailyBriefSeoTitle(config.stockPickLimit, { marketDate: localNow.date }),
      targetKeyword: config.targetKeyword,
      stockPickLimit: config.stockPickLimit,
      stockDetailLimit: config.stockDetailLimit,
      etfPickLimit: config.etfPickLimit,
      includeEtfs: config.includeEtfs
    });
    await updateDailyBriefSchedulerState({
      lastRunDate: localNow.date,
      lastRunId: run.id,
      lastContentItemId: null,
      lastMessage: "scheduler_fresh_run_created"
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

    const contentItemId = result.contentItemId;
    if (!contentItemId) {
      runtime.inFlight = false;
      const state = await updateDailyBriefSchedulerState({
        lastRunDate: localNow.date,
        lastRunId: result.run.id,
        lastContentItemId: null,
        lastResult: "failed",
        lastMessage: "daily_brief_content_item_missing",
        inFlight: false
      });
      return { status: "failed" as const, reason: "daily_brief_content_item_missing", result, state };
    }

    const state = await updateDailyBriefSchedulerState({
      lastRunDate: localNow.date,
      lastRunId: result.run.id,
      lastContentItemId: contentItemId,
      lastResult: "success",
      lastMessage: `content_generated:${contentItemId}`,
      lastAutomationResult: null,
      inFlight: false
    });
    const automationResult = await runDailyBriefPublishAutomation({
      contentItemId,
      mode: config.mode
    });
    const loginAlertState = await enqueueDailyBriefLoginAlertIfNeeded({
      automationResult,
      marketDate: localNow.date,
      scheduledTime: config.scheduleTime
    });
    runtime.inFlight = false;
    const stateAfterAutomation = await updateDailyBriefSchedulerState({
      lastRunDate: localNow.date,
      lastRunId: result.run.id,
      lastContentItemId: contentItemId,
      lastResult: automationResult.status === "failed" ? "failed" : "success",
      lastMessage:
        config.mode === "content_only"
          ? `content_generated:${contentItemId}`
          : `content_generated:${contentItemId}; automation_${automationResult.status}:${automationResult.stage}`,
      lastAutomationResult: automationResult,
      ...loginAlertState,
      inFlight: false
    });
    return {
      status: automationResult.status === "failed" ? ("failed" as const) : ("success" as const),
      result,
      automationResult,
      state: stateAfterAutomation
    };
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

async function findScheduledRunForDate(marketDate: string) {
  const state = await getDailyBriefSchedulerState();
  if (state.lastRunDate !== marketDate || !state.lastRunId) return null;
  const run = await getDailyBriefRun(state.lastRunId);
  return run?.marketDate === marketDate && run.contentItemId ? run : null;
}

function normalizeConfig(input: Partial<DailyBriefSchedulerConfig>): DailyBriefSchedulerConfig {
  const scheduleTime = input.scheduleTime;
  return {
    enabled: input.enabled === true,
    scheduleTime: isTimeString(scheduleTime) ? scheduleTime : "08:00",
    timezone: typeof input.timezone === "string" && input.timezone.trim() ? input.timezone.trim().slice(0, 64) : "Asia/Seoul",
    businessDaysOnly: input.businessDaysOnly !== false,
    targetKeyword:
      typeof input.targetKeyword === "string" && input.targetKeyword.trim() ? input.targetKeyword.trim().slice(0, 80) : "오늘의 국내주식 관심종목",
    stockPickLimit: clampNumber(input.stockPickLimit, 8, 1, 20),
    stockDetailLimit: clampNumber(input.stockDetailLimit, 5, 1, 10),
    etfPickLimit: clampNumber(input.etfPickLimit, 5, 0, 20),
    includeEtfs: input.includeEtfs !== false,
    mode: normalizeMode(input.mode)
  };
}

function normalizeMode(value: unknown): DailyBriefSchedulerMode {
  if (value === "draft_save_only" || value === "publish_live_guarded") {
    return value;
  }
  return "content_only";
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
    lastAutomationResult: input.lastAutomationResult ?? null,
    lastLoginAlertDate: input.lastLoginAlertDate ?? null,
    lastLoginAlertAt: input.lastLoginAlertAt ?? null,
    inFlight: input.inFlight === true
  };
}

async function enqueueDailyBriefLoginAlertIfNeeded(input: {
  automationResult: DailyBriefPublishAutomationResult;
  marketDate: string;
  scheduledTime: string;
}): Promise<Partial<DailyBriefSchedulerState>> {
  const blocker = findBloggerLoginBlocker(input.automationResult);
  if (!blocker) return {};
  const state = await getDailyBriefSchedulerState();
  if (state.lastLoginAlertDate === input.marketDate) return {};
  try {
    await enqueuePublicationLoginAlert({
      channel: "blogger",
      marketDate: input.marketDate,
      slotId: "blogger-stock-review",
      scheduledTime: input.scheduledTime,
      label: "오늘의 투자 유망 종목 리뷰",
      blocker
    });
    return { lastLoginAlertDate: input.marketDate, lastLoginAlertAt: new Date().toISOString() };
  } catch {
    return {};
  }
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

function isBusinessDay(date: string, timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(new Date(`${date}T12:00:00Z`));
  return weekday !== "Sat" && weekday !== "Sun";
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
  const mode = runtime.lastKnownMode ?? "content_only";
  return {
    serverProcessTimerActive: Boolean(runtime.timer),
    webServerMustStayRunning: true as const,
    bloggerDraftSave: mode === "draft_save_only" || mode === "publish_live_guarded",
    bloggerPublish: mode === "publish_live_guarded",
    tokenRefresh: false as const,
    llmCall: false as const,
    livePublishRequiresEnvFlags: true as const
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
