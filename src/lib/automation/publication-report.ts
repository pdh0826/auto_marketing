import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PUBLICATION_SCHEDULE_DEFINITIONS, type PublicationScheduleChannel } from "./publication-schedule";

const reportRoot = path.join(process.cwd(), "local-data", "publication-reports");
const reportStatePath = path.join(reportRoot, "state.json");
const publicationStatePath = path.join(process.cwd(), "local-data", "publication-scheduler", "state.json");
const dailyBriefStatePath = path.join(process.cwd(), "local-data", "daily-brief-scheduler", "state.json");
const reportTime = "08:30";
const timezone = "Asia/Seoul";

interface PublicationStateEntry {
  marketDate?: string;
  slotId?: string;
  status?: string;
  publicUrl?: string | null;
  lastMessage?: string | null;
  attempts?: number;
  recoveryAttempts?: number;
  lastRecoveryReason?: string | null;
  recoveredAt?: string | null;
}

interface PublicationStateFile {
  entries?: Record<string, PublicationStateEntry>;
}

interface DailyBriefStateFile {
  lastRunDate?: string | null;
  lastResult?: string | null;
  lastMessage?: string | null;
  lastAutomationResult?: {
    status?: string;
    bloggerPostUrl?: string | null;
    message?: string | null;
  } | null;
}

export interface PublicationReportState {
  lastReportDate: string | null;
  lastReportAt: string | null;
  lastResult: "idle" | "success" | "failed" | "initialized_without_backfill";
  lastFileName: string | null;
  lastSummary: string | null;
  lastError: string | null;
}

export interface PublicationReportOccurrence {
  key: string;
  marketDate: string;
  scheduledTime: string;
  slotId: string;
  channel: PublicationScheduleChannel;
  label: string;
  status: string;
  success: boolean;
  publicUrl: string | null;
  message: string | null;
  attempts: number;
  recoveryAttempts: number;
  recoveredAt: string | null;
  recoveryReason: string | null;
}

export interface PublicationReportPreview {
  reportDate: string;
  windowStart: string;
  windowEnd: string;
  total: number;
  success: number;
  incomplete: number;
  blogger: { total: number; success: number; incomplete: number };
  tistory: { total: number; success: number; incomplete: number };
  occurrences: PublicationReportOccurrence[];
  incompleteItems: PublicationReportOccurrence[];
  summary: string;
}

export async function getPublicationReportStatus(now = new Date()) {
  const local = getLocalDateTime(now);
  return {
    config: {
      enabled: true,
      reportTime,
      timezone,
      window: "previous_report_0830_exclusive_to_current_0830_inclusive",
      queueDirectory: getQueueDirectory(),
      queueFormat: "pdash_status_json",
      atomicWrite: true
    },
    state: await getReportState(),
    local,
    nextReportDate: local.time < reportTime ? local.date : shiftDate(local.date, 1)
  };
}

export async function buildPublicationReportPreview(now = new Date()): Promise<PublicationReportPreview> {
  const local = getLocalDateTime(now);
  const reportDate = local.date;
  const previousDate = shiftDate(reportDate, -1);
  const [publicationState, dailyBriefState] = await Promise.all([
    readJson<PublicationStateFile>(publicationStatePath, {}),
    readJson<DailyBriefStateFile>(dailyBriefStatePath, {})
  ]);
  const occurrences = [
    ...buildOccurrencesForDate(previousDate, (time) => time > reportTime, publicationState, dailyBriefState),
    ...buildOccurrencesForDate(reportDate, (time) => time <= reportTime, publicationState, dailyBriefState)
  ];
  const bloggerOccurrences = occurrences.filter((item) => item.channel === "blogger");
  const tistoryOccurrences = occurrences.filter((item) => item.channel === "tistory");
  const success = occurrences.filter((item) => item.success).length;
  const bloggerSuccess = bloggerOccurrences.filter((item) => item.success).length;
  const tistorySuccess = tistoryOccurrences.filter((item) => item.success).length;
  const incompleteItems = occurrences.filter((item) => !item.success);
  const summary = `전체 ${occurrences.length}건 중 ${success}건 정상 발행 (Blogger ${bloggerSuccess}/${bloggerOccurrences.length}, Tistory ${tistorySuccess}/${tistoryOccurrences.length})`;

  return {
    reportDate,
    windowStart: `${previousDate} ${reportTime}`,
    windowEnd: `${reportDate} ${reportTime}`,
    total: occurrences.length,
    success,
    incomplete: occurrences.length - success,
    blogger: {
      total: bloggerOccurrences.length,
      success: bloggerSuccess,
      incomplete: bloggerOccurrences.length - bloggerSuccess
    },
    tistory: {
      total: tistoryOccurrences.length,
      success: tistorySuccess,
      incomplete: tistoryOccurrences.length - tistorySuccess
    },
    occurrences,
    incompleteItems,
    summary
  };
}

export async function tickPublicationReport(input: { force: boolean; dryRun: boolean; now?: Date }) {
  const now = input.now ?? new Date();
  const local = getLocalDateTime(now);
  const state = await getReportState();
  if (!input.force && local.time < reportTime) {
    return { status: "skipped" as const, reason: "publication_report_not_due", state };
  }
  if (!input.force && state.lastReportDate === local.date) {
    return { status: "skipped" as const, reason: "publication_report_already_enqueued", state };
  }

  const preview = await buildPublicationReportPreview(now);
  const payload = buildPdashPayload(preview);
  if (input.dryRun) {
    return {
      status: "dry_run" as const,
      preview,
      payload,
      sideEffectSummary: { queueWrite: false, telegramWrite: false, dbWrite: false, contentMutation: false }
    };
  }

  try {
    const fileName = await enqueuePdashPayload(preview.reportDate, payload);
    const nextState: PublicationReportState = {
      lastReportDate: preview.reportDate,
      lastReportAt: now.toISOString(),
      lastResult: "success",
      lastFileName: fileName,
      lastSummary: preview.summary,
      lastError: null
    };
    await writeReportState(nextState);
    return {
      status: "success" as const,
      fileName,
      preview,
      sideEffectSummary: { queueWrite: true, telegramWrite: false, dbWrite: false, contentMutation: false }
    };
  } catch (error) {
    const nextState: PublicationReportState = {
      ...state,
      lastReportAt: now.toISOString(),
      lastResult: "failed",
      lastError: safeMessage(error)
    };
    await writeReportState(nextState);
    return { status: "failed" as const, reason: nextState.lastError, preview };
  }
}

function buildOccurrencesForDate(
  marketDate: string,
  includeTime: (time: string) => boolean,
  publicationState: PublicationStateFile,
  dailyBriefState: DailyBriefStateFile
) {
  if (!isBusinessDay(marketDate)) return [];
  return PUBLICATION_SCHEDULE_DEFINITIONS.filter((slot) => includeTime(slot.time)).map((slot) => {
    if (slot.id === "blogger-stock-review") return buildDailyBriefOccurrence(marketDate, slot, dailyBriefState);
    const key = `${marketDate}:${slot.id}`;
    const entry = publicationState.entries?.[key];
    const success = entry?.status === "success" && Boolean(entry.publicUrl);
    return {
      key,
      marketDate,
      scheduledTime: slot.time,
      slotId: slot.id,
      channel: slot.channel,
      label: slot.label,
      status: entry?.status ?? "missing",
      success,
      publicUrl: entry?.publicUrl ?? null,
      message: success ? null : entry?.lastMessage ?? "scheduler_execution_record_missing"
      ,attempts: entry?.attempts ?? 0
      ,recoveryAttempts: entry?.recoveryAttempts ?? 0
      ,recoveredAt: entry?.recoveredAt ?? null
      ,recoveryReason: entry?.lastRecoveryReason ?? null
    } satisfies PublicationReportOccurrence;
  });
}

function buildDailyBriefOccurrence(
  marketDate: string,
  slot: (typeof PUBLICATION_SCHEDULE_DEFINITIONS)[number],
  state: DailyBriefStateFile
): PublicationReportOccurrence {
  const automation = state.lastRunDate === marketDate ? state.lastAutomationResult : null;
  const success = automation?.status === "success" && Boolean(automation.bloggerPostUrl);
  return {
    key: `${marketDate}:${slot.id}`,
    marketDate,
    scheduledTime: slot.time,
    slotId: slot.id,
    channel: slot.channel,
    label: slot.label,
    status: success ? "success" : state.lastRunDate === marketDate ? state.lastResult ?? "missing" : "missing",
    success,
    publicUrl: automation?.bloggerPostUrl ?? null,
    message: success ? null : automation?.message ?? (state.lastRunDate === marketDate ? state.lastMessage ?? null : "daily_brief_execution_record_missing")
    ,attempts: automation ? 1 : 0
    ,recoveryAttempts: 0
    ,recoveredAt: null
    ,recoveryReason: null
  };
}

function buildPdashPayload(preview: PublicationReportPreview) {
  const incomplete = preview.incompleteItems.length
    ? preview.incompleteItems.map((item) => `${item.scheduledTime} ${item.channel} ${item.label} (${item.status}: ${item.message ?? "unknown"})`).join("\n")
    : "없음";
  const recovered = preview.occurrences.filter((item) => item.success && item.recoveredAt);
  return {
    template: "status",
    severity: preview.incomplete === 0 ? "info" : "warning",
    title: `[Blog Growth Agent] ${preview.reportDate} 08:30 자동발행 보고`,
    service: "Blog Growth Agent",
    environment: "local",
    summary: preview.summary,
    fields: {
      "보고 기간": `${preview.windowStart} 초과 ~ ${preview.windowEnd} 이하`,
      전체: `${preview.success}/${preview.total} 정상 발행`,
      Blogger: `${preview.blogger.success}/${preview.blogger.total} 정상 발행`,
      Tistory: `${preview.tistory.success}/${preview.tistory.total} 정상 발행`,
      "미발행/차단": incomplete,
      "자동 복구": recovered.length ? recovered.map((item) => `${item.scheduledTime} ${item.label} (${item.recoveryAttempts}회)`).join("\n") : "없음",
      "다음 작업": preview.incomplete === 0 ? "없음" : "자동 복구 이후에도 남은 blocker와 로그인 상태를 확인하세요."
    },
    buttons: [
      { text: "PDash", url: "http://127.0.0.1:3060/" },
      { text: "Blog Growth Agent", url: "http://127.0.0.1:3004/automation/daily-brief" }
    ]
  };
}

async function enqueuePdashPayload(reportDate: string, payload: ReturnType<typeof buildPdashPayload>) {
  const queueDirectory = getQueueDirectory();
  await mkdir(queueDirectory, { recursive: true });
  const baseName = `blog-growth-agent-publication-report-${reportDate}`;
  const tempPath = path.join(queueDirectory, `${baseName}.tmp`);
  const finalPath = path.join(queueDirectory, `${baseName}.json`);
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, finalPath);
  return path.basename(finalPath);
}

function getQueueDirectory() {
  return process.env.PDASH_TELEGRAM_QUEUE_DIR?.trim() || path.join(os.homedir(), "msg");
}

async function getReportState(): Promise<PublicationReportState> {
  return readJson<PublicationReportState>(reportStatePath, {
    lastReportDate: null,
    lastReportAt: null,
    lastResult: "idle",
    lastFileName: null,
    lastSummary: null,
    lastError: null
  });
}

async function writeReportState(state: PublicationReportState) {
  await mkdir(reportRoot, { recursive: true });
  await writeFile(reportStatePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function getLocalDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isBusinessDay(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day !== 0 && day !== 6;
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : "publication_report_queue_write_failed").replace(/[\r\n]+/g, " ").slice(0, 200);
}
