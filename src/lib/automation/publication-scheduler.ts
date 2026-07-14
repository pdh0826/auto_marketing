import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PUBLICATION_SCHEDULE_DEFINITIONS, type PublicationScheduleDefinition } from "./publication-schedule";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { prisma } from "@/lib/db/client";
import { createBloggerEditorialContentItem, type BloggerEditorialSlotId } from "@/lib/daily-brief/blogger-editorial-content";
import { runDailyBriefPublishAutomation } from "@/lib/daily-brief/publish-automation";
import { runDailyBriefRunAll } from "@/lib/daily-brief/run-all";
import {
  buildDailyBriefSeoTitle,
  createDailyBriefRun,
  getDailyBriefRun,
  listDailyBriefRuns,
  saveDailyBriefRun
} from "@/lib/daily-brief/store";
import { buildTistoryReviewOutputKey, createDailyTistorySignalReview } from "@/lib/daily-brief/tistory-signal-review";
import type { DailyBriefRun, DailyTistorySignalReviewMode } from "@/lib/daily-brief/types";
import type { DailyFuturesEditorialTrack, DailyMarketReportSession } from "@/lib/daily-brief/market-report-session";
import {
  enqueueTistoryPublish,
  getTistoryPublisherStatus,
  retryTistoryPublishEntry,
  tickTistoryPublisherScheduler
} from "@/lib/tistory/publisher-scheduler";
import { verifyFreshTistoryFuturesCandidateById } from "@/lib/tistory/futures-publication-guard";
import { tickPublicationReport } from "./publication-report";
import { enqueuePublicationLoginAlert, enqueuePublicationRecoveryAlert, findBloggerLoginBlocker } from "./publication-login-alert";

const root = path.join(process.cwd(), "local-data", "publication-scheduler");
const configPath = path.join(root, "config.json");
const statePath = path.join(root, "state.json");
const intervalMs = 60_000;

export type PublicationExecutionStatus = "pending" | "processing" | "success" | "blocked" | "failed" | "delegated";

export interface PublicationSchedulerConfig {
  enabled: boolean;
  timezone: "Asia/Seoul";
  businessDaysOnly: true;
  tistoryRecurringPublishApproved: boolean;
  retryDelayMinutes: number;
  maxAttempts: number;
  autoRecoveryEnabled: boolean;
  recoveryGraceMinutes: number;
  recoveryWindowMinutes: number;
  recoveryMaxAttempts: number;
  recoveryCooldownMinutes: number;
}

export interface PublicationExecutionEntry {
  key: string;
  marketDate: string;
  slotId: string;
  channel: "blogger" | "tistory";
  scheduledTime: string;
  status: PublicationExecutionStatus;
  attempts: number;
  contentItemId: string | null;
  publicUrl: string | null;
  lastMessage: string | null;
  nextRetryAt: string | null;
  retryable?: boolean;
  loginAlertedAt?: string | null;
  executionSource?: "scheduled" | "retry" | "recovery";
  recoveryAttempts?: number;
  lastRecoveryAt?: string | null;
  lastRecoveryReason?: string | null;
  recoveredAt?: string | null;
  recoveryAlertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicationSchedulerState {
  running: boolean;
  inFlight: boolean;
  lastTickAt: string | null;
  lastResult: string | null;
  lastMessage: string | null;
  lastRecoveryAt: string | null;
  lastRecoveryResult: string | null;
  entries: Record<string, PublicationExecutionEntry>;
}

interface DuePublicationSlot {
  definition: PublicationScheduleDefinition;
  marketDate: string;
  executionSource: "scheduled" | "retry" | "recovery";
  recoveryReason: string | null;
}

interface TistorySlotPlan {
  mode: DailyTistorySignalReviewMode;
  session?: DailyMarketReportSession;
  track?: DailyFuturesEditorialTrack;
}

const tistoryPlans: Record<string, TistorySlotPlan> = {
  "tistory-macro-morning": { mode: "futures_options_signal_record", session: "morning", track: "macro" },
  "tistory-index-morning": { mode: "futures_options_signal_record", session: "morning", track: "index" },
  "tistory-daily-stock-review": { mode: "mixed_stock_etf_review" },
  "tistory-focused-signal-review": { mode: "stock_signal_top3_review" },
  "tistory-etf-sector-review": { mode: "etf_sector_review" },
  "tistory-macro-us-preopen": { mode: "futures_options_signal_record", session: "us_preopen", track: "macro" },
  "tistory-index-us-preopen": { mode: "futures_options_signal_record", session: "us_preopen", track: "index" }
};

const runtime = getRuntime();

export async function getPublicationSchedulerStatus() {
  const config = await getConfig();
  if (config.enabled && !runtime.timer) await startPublicationScheduler();
  const state = await getState();
  return {
    config,
    state: { ...state, running: Boolean(runtime.timer), inFlight: runtime.inFlight }
  };
}

export async function updatePublicationSchedulerConfig(input: Partial<PublicationSchedulerConfig>) {
  const definedInput = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<PublicationSchedulerConfig>;
  const config = normalizeConfig({ ...(await getConfig()), ...definedInput });
  await writeJson(configPath, config);
  if (config.enabled) await startPublicationScheduler();
  else await stopPublicationScheduler();
  return getPublicationSchedulerStatus();
}

export async function startPublicationScheduler() {
  const config = await getConfig();
  await writeJson(configPath, { ...config, enabled: true });
  if (!runtime.timer) runtime.timer = setInterval(() => void tickPublicationScheduler({ force: false, dryRun: false }), intervalMs);
  await patchState({ running: true, lastMessage: "publication_scheduler_started" });
  return getPublicationSchedulerStatus();
}

export async function stopPublicationScheduler() {
  const config = await getConfig();
  await writeJson(configPath, { ...config, enabled: false });
  if (runtime.timer) clearInterval(runtime.timer);
  runtime.timer = null;
  await patchState({ running: false, inFlight: false, lastMessage: "publication_scheduler_stopped" });
  return getPublicationSchedulerStatus();
}

export async function tickPublicationScheduler(input: { force: boolean; dryRun: boolean; slotId?: string; regenerate?: boolean }) {
  if (!input.force && !input.dryRun && !input.slotId) {
    await tickPublicationReport({ force: false, dryRun: false });
  }
  if (runtime.inFlight) return { status: "skipped" as const, reason: "publication_execution_in_flight" };
  const config = await getConfig();
  const now = new Date();
  const local = getLocalDateTime(now, config.timezone);
  await patchState({ lastTickAt: now.toISOString() });
  if (!input.force && !config.enabled) return { status: "skipped" as const, reason: "publication_scheduler_disabled" };
  if (input.slotId && config.businessDaysOnly && !isBusinessDay(local.date)) return { status: "skipped" as const, reason: "not_business_day" };

  const state = await getState();
  const dueSlots = collectDueSlots({
    state,
    localDate: local.date,
    localTime: local.time,
    now,
    config,
    slotId: input.slotId
  });
  if (!dueSlots.length) return { status: "skipped" as const, reason: input.slotId ? "publication_slot_not_found" : "no_due_publication_slot" };

  if (input.dryRun) {
    return {
      status: "dry_run" as const,
      local,
      slots: dueSlots.map(({ definition, marketDate, executionSource, recoveryReason }) => ({
        id: definition.id,
        marketDate,
        channel: definition.channel,
        executionSource,
        recoveryReason,
        duplicateBlocked: state.entries[entryKey(marketDate, definition.id)]?.status === "success",
        tistoryApprovalConfigured: definition.channel === "blogger" || config.tistoryRecurringPublishApproved,
        tistoryAutomaticGuardedPublish: definition.channel === "tistory",
        tistoryPersistentLoginRequired: definition.channel === "tistory",
        marketFlowConfigured: Boolean(process.env.UPSIGNAL_MARKET_FLOW_URL?.trim()),
        marketFlowOptional: true,
        marketFlowOmittedWhenUnavailable: true
      })),
      sideEffectSummary: { dbWrite: false, bloggerWrite: false, tistoryWrite: false, contentMutation: false }
    };
  }

  runtime.inFlight = true;
  const results = [];
  try {
    for (const { definition, marketDate, executionSource, recoveryReason } of dueSlots) {
      const result = await executeSlot(definition, marketDate, config, input.regenerate === true, executionSource, recoveryReason);
      const alertedResult = executionSource === "recovery"
        ? await alertIfRecoveryExhausted(definition, result, config)
        : result;
      results.push({ ...alertedResult, executionSource, recoveryReason });
    }
    const recoveryResults = results.filter((item) => item.executionSource === "recovery");
    await patchState({
      lastResult: results.every((item) => item.status === "success" || item.status === "delegated") ? "success" : "partial",
      lastMessage: results.map((item) => `${item.slotId}:${item.status}`).join(","),
      lastRecoveryAt: recoveryResults.length ? now.toISOString() : state.lastRecoveryAt,
      lastRecoveryResult: recoveryResults.length ? recoveryResults.map((item) => `${item.slotId}:${item.status}`).join(",") : state.lastRecoveryResult
    });
    return { status: "completed" as const, results };
  } finally {
    runtime.inFlight = false;
    await patchState({ inFlight: false });
  }
}

async function executeSlot(
  definition: PublicationScheduleDefinition,
  marketDate: string,
  config: PublicationSchedulerConfig,
  regenerate: boolean,
  executionSource: DuePublicationSlot["executionSource"],
  recoveryReason: string | null
) {
  const key = entryKey(marketDate, definition.id);
  const state = await getState();
  const previous = state.entries[key];
  if (previous?.status === "success" || previous?.status === "delegated") {
    return { slotId: definition.id, status: "skipped" as const, reason: "publication_slot_already_completed" };
  }
  const now = new Date().toISOString();
  const entry: PublicationExecutionEntry = {
    key,
    marketDate,
    slotId: definition.id,
    channel: definition.channel,
    scheduledTime: definition.time,
    status: "processing",
    attempts: (previous?.attempts ?? 0) + 1,
    contentItemId: regenerate ? null : previous?.contentItemId ?? null,
    publicUrl: previous?.publicUrl ?? null,
    lastMessage: "publication_slot_started",
    nextRetryAt: null,
    retryable: true,
    loginAlertedAt: previous?.loginAlertedAt ?? null,
    executionSource,
    recoveryAttempts: (previous?.recoveryAttempts ?? 0) + (executionSource === "recovery" ? 1 : 0),
    lastRecoveryAt: executionSource === "recovery" ? now : previous?.lastRecoveryAt ?? null,
    lastRecoveryReason: executionSource === "recovery" ? recoveryReason : previous?.lastRecoveryReason ?? null,
    recoveredAt: previous?.recoveredAt ?? null,
    recoveryAlertedAt: previous?.recoveryAlertedAt ?? null,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now
  };
  await putEntry(entry);

  try {
    if (definition.id === "blogger-stock-review") {
      const delegated = await putEntry({ ...entry, status: "delegated", lastMessage: "delegated_to_daily_brief_0800_scheduler", updatedAt: new Date().toISOString() });
      return { slotId: definition.id, status: delegated.status, entry: delegated };
    }
    const run = await createExecutionDailyBriefRun(marketDate, definition);
    if (definition.channel === "blogger") return await executeBloggerSlot(definition.id as BloggerEditorialSlotId, run, entry, config);
    return await executeTistorySlot(definition.id, run, entry, config);
  } catch (error) {
    const message = safeMessage(error);
    const recoveryExhausted = executionSource === "recovery" && entry.attempts >= config.recoveryMaxAttempts;
    let recoveryAlertedAt = entry.recoveryAlertedAt ?? null;
    if (recoveryExhausted && !recoveryAlertedAt) {
      try {
        await enqueuePublicationRecoveryAlert({
          channel: definition.channel,
          marketDate,
          slotId: definition.id,
          scheduledTime: definition.time,
          label: definition.label,
          reason: message,
          attempts: entry.attempts
        });
        recoveryAlertedAt = new Date().toISOString();
      } catch {
        // Keep the publication failure authoritative if the notification queue is unavailable.
      }
    }
    const failed = await putEntry({
      ...entry,
      status: message.includes("not_configured") || message.includes("not_ready") || message.includes("login_required") ? "blocked" : "failed",
      lastMessage: message,
      nextRetryAt: entry.attempts < config.maxAttempts ? new Date(Date.now() + config.retryDelayMinutes * 60_000).toISOString() : null,
      recoveryAlertedAt,
      updatedAt: new Date().toISOString()
    });
    return { slotId: definition.id, status: failed.status, reason: message, entry: failed };
  }
}

async function executeBloggerSlot(slotId: BloggerEditorialSlotId, run: DailyBriefRun, entry: PublicationExecutionEntry, config: PublicationSchedulerConfig) {
  const retryContent = entry.contentItemId
    ? await prisma.contentItem.findUnique({ where: { id: entry.contentItemId }, include: { blog: true, brandProfile: true, assets: true } })
    : null;
  const content = retryContent?.draftHtml ? retryContent : await createBloggerEditorialContentItem(run, slotId);
  const automation = await runDailyBriefPublishAutomation({ contentItemId: content.id, mode: "publish_live_guarded" });
  const success = automation.status === "success" && Boolean(automation.bloggerPostUrl);
  const retryable = success || isBloggerAutomationRetryable(automation);
  const primaryBlocker = automation.blockingReasons[0] ?? null;
  const loginBlocker = findBloggerLoginBlocker(automation);
  let loginAlertedAt = entry.loginAlertedAt ?? null;
  if (!success && loginBlocker && !loginAlertedAt) {
    try {
      const definition = PUBLICATION_SCHEDULE_DEFINITIONS.find((candidate) => candidate.id === slotId);
      await enqueuePublicationLoginAlert({
        channel: "blogger",
        marketDate: entry.marketDate,
        slotId,
        scheduledTime: entry.scheduledTime,
        label: definition?.label ?? slotId,
        blocker: loginBlocker
      });
      loginAlertedAt = new Date().toISOString();
    } catch {
      // Keep the publish blocker authoritative even if the notification queue is unavailable.
    }
  }
  const next = await putEntry({
    ...entry,
    contentItemId: content.id,
    publicUrl: automation.bloggerPostUrl,
    status: success ? "success" : automation.status === "failed" ? "failed" : "blocked",
    lastMessage: [automation.stage, automation.message, primaryBlocker].filter(Boolean).join(":"),
    nextRetryAt: !success && retryable && entry.attempts < config.maxAttempts ? new Date(Date.now() + config.retryDelayMinutes * 60_000).toISOString() : null,
    retryable,
    loginAlertedAt,
    recoveredAt: success && entry.executionSource === "recovery" ? new Date().toISOString() : entry.recoveredAt ?? null,
    updatedAt: new Date().toISOString()
  });
  return { slotId, status: next.status, entry: next, automation };
}

async function executeTistorySlot(slotId: string, run: DailyBriefRun, entry: PublicationExecutionEntry, config: PublicationSchedulerConfig) {
  if (!config.tistoryRecurringPublishApproved) throw new Error("tistory_recurring_publish_approval_required");
  const plan = tistoryPlans[slotId];
  if (!plan) throw new Error("tistory_publication_slot_plan_missing");
  const futuresSlot = plan.mode === "futures_options_signal_record";
  let contentItemId = futuresSlot ? null : entry.contentItemId;
  let currentRun = run;
  if (!contentItemId) {
    const outputKey = buildTistoryReviewOutputKey(plan.mode, plan.session, plan.track);
    const result = await createDailyTistorySignalReview(currentRun, {
      forceMode: plan.mode,
      reportSession: plan.session,
      futuresEditorialTrack: plan.track,
      replaceExistingOutput: true
    });
    const output = {
      contentItemId: result.contentItemId,
      previewUrl: result.tistoryExport.localPreviewUrl,
      mode: result.selection.mode,
      selectedStockCodes: result.selection.selectedStockCodes,
      selectedEtfCodes: result.selection.selectedEtfCodes,
      selectedFuturesSymbols: result.selection.selectedFuturesSymbols,
      marketReportSession: result.selection.marketReportSession,
      futuresEditorialTrack: result.selection.futuresEditorialTrack,
      createdAt: new Date().toISOString()
    };
    currentRun = await saveDailyBriefRun({
      ...currentRun,
      tistoryReviewContentItemId: output.contentItemId,
      tistoryReviewExportUrl: output.previewUrl,
      tistoryReviewMode: output.mode,
      tistoryReviewOutputs: { ...(currentRun.tistoryReviewOutputs ?? {}), [outputKey]: output },
      warnings: Array.from(new Set([...currentRun.warnings, ...result.selection.warnings]))
    });
    contentItemId = output.contentItemId;
  }

  await verifyTistoryPublicationContent(contentItemId, { requireFreshFuturesCandidate: futuresSlot });

  const publisher = await getTistoryPublisherStatus();
  const publisherBlocker = !publisher.config.enabled
    ? "tistory_scheduler_disabled"
    : !publisher.config.livePublishEnabled
      ? "tistory_live_publish_disabled"
      : null;
  if (publisherBlocker) {
    const blocked = await putEntry({
      ...entry,
      contentItemId,
      status: "blocked",
      lastMessage: publisherBlocker,
      nextRetryAt: entry.attempts < config.maxAttempts ? new Date(Date.now() + config.retryDelayMinutes * 60_000).toISOString() : null,
      updatedAt: new Date().toISOString()
    });
    return { slotId, status: blocked.status, reason: publisherBlocker, entry: blocked };
  }
  const prior = publisher.queue.find((item) => item.contentItemId === contentItemId && item.status !== "success");
  const queued = prior && (prior.status === "blocked" || prior.status === "failed")
    ? await retryTistoryPublishEntry(prior.id)
    : await enqueueTistoryPublish({
        contentItemId,
        dueAt: new Date().toISOString(),
        approved: true,
        approvalSource: "recurring_schedule",
        loginAlertedAt: entry.loginAlertedAt ?? null,
        loginAlertContext: {
          marketDate: entry.marketDate,
          slotId,
          scheduledTime: entry.scheduledTime,
          label: PUBLICATION_SCHEDULE_DEFINITIONS.find((candidate) => candidate.id === slotId)?.label ?? slotId
        }
      });
  const publish = await tickTistoryPublisherScheduler({ force: true, entryId: queued.id });
  const publishedEntry = "entry" in publish ? publish.entry : null;
  const success = publish.status === "success" && Boolean(publishedEntry?.publicUrl);
  const next = await putEntry({
    ...entry,
    contentItemId,
    publicUrl: publishedEntry?.publicUrl ?? null,
    status: success ? "success" : publish.status === "failed" ? "failed" : "blocked",
    lastMessage: publishedEntry?.lastMessage ?? ("reason" in publish && typeof publish.reason === "string" ? publish.reason : "tistory_publish_incomplete"),
    nextRetryAt: !success && entry.attempts < config.maxAttempts ? new Date(Date.now() + config.retryDelayMinutes * 60_000).toISOString() : null,
    loginAlertedAt: publishedEntry?.loginAlertedAt ?? entry.loginAlertedAt ?? null,
    recoveredAt: success && entry.executionSource === "recovery" ? new Date().toISOString() : entry.recoveredAt ?? null,
    updatedAt: new Date().toISOString()
  });
  return { slotId, status: next.status, entry: next };
}

async function verifyTistoryPublicationContent(
  contentItemId: string,
  options: { requireFreshFuturesCandidate?: boolean } = {}
) {
  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: { blog: true, brandProfile: true, assets: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } }
  });
  if (!item?.draftHtml || !item.draftMarkdown) throw new Error("tistory_publication_candidate_missing");
  const plan = item.planJson && typeof item.planJson === "object" && !Array.isArray(item.planJson) ? item.planJson as Record<string, unknown> : {};
  const writing = plan.investmentWriting && typeof plan.investmentWriting === "object" && !Array.isArray(plan.investmentWriting)
    ? plan.investmentWriting as Record<string, unknown>
    : null;
  if (writing?.autoPublishEligible !== true) throw new Error("tistory_investment_writing_not_ready");
  if (!item.assets.length) throw new Error("tistory_publication_image_required");
  if (options.requireFreshFuturesCandidate) {
    await verifyFreshTistoryFuturesCandidateById(contentItemId, { required: true });
  }
  const quality = buildHtmlQualityPreview(item as unknown as ContentItemAdmin, item.assets as unknown as ContentAssetAdmin[]);
  if (!quality.ready) throw new Error(`tistory_html_quality_not_ready:${quality.grade}`);
}

async function createExecutionDailyBriefRun(marketDate: string, definition: PublicationScheduleDefinition) {
  const run = await createDailyBriefRun({ marketDate, title: buildDailyBriefSeoTitle(8, { marketDate }), stockPickLimit: 8, stockDetailLimit: 5, etfPickLimit: 5, includeEtfs: true });
  if (definition.channel === "tistory") return await attachTistorySelectionHistory(run);
  const result = await runDailyBriefRunAll(run.id);
  if (!result.ok) throw new Error(`daily_brief_not_ready:${result.readiness.blockingReasons.join(",")}`);
  return result.run;
}

async function attachTistorySelectionHistory(run: DailyBriefRun) {
  const summaries = await listDailyBriefRuns();
  for (const summary of summaries) {
    if (summary.marketDate !== run.marketDate || summary.id === run.id) continue;
    const previous = await getDailyBriefRun(summary.id);
    if (!previous) continue;
    const hasSelectionHistory = Boolean(previous.tistoryReviewContentItemId) || Object.keys(previous.tistoryReviewOutputs ?? {}).length > 0;
    if (!hasSelectionHistory) continue;
    return {
      ...run,
      tistoryReviewContentItemId: previous.tistoryReviewContentItemId,
      tistoryReviewExportUrl: previous.tistoryReviewExportUrl,
      tistoryReviewMode: previous.tistoryReviewMode,
      tistoryReviewOutputs: { ...(previous.tistoryReviewOutputs ?? {}) }
    };
  }
  return run;
}

async function getConfig(): Promise<PublicationSchedulerConfig> {
  try { return normalizeConfig(JSON.parse(await readFile(configPath, "utf8"))); }
  catch { const value = normalizeConfig({}); await writeJson(configPath, value); return value; }
}

async function getState(): Promise<PublicationSchedulerState> {
  try { return normalizeState(JSON.parse(await readFile(statePath, "utf8"))); }
  catch { const value = normalizeState({}); await writeJson(statePath, value); return value; }
}

async function putEntry(entry: PublicationExecutionEntry) {
  const state = await getState();
  await writeJson(statePath, normalizeState({ ...state, entries: { ...state.entries, [entry.key]: entry }, inFlight: runtime.inFlight }));
  return entry;
}

async function patchState(patch: Partial<PublicationSchedulerState>) {
  const next = normalizeState({ ...(await getState()), ...patch, inFlight: runtime.inFlight, running: Boolean(runtime.timer) });
  await writeJson(statePath, next);
  return next;
}

async function writeJson(file: string, value: unknown) {
  await mkdir(root, { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeConfig(value: Partial<PublicationSchedulerConfig>): PublicationSchedulerConfig {
  return {
    enabled: value.enabled === true,
    timezone: "Asia/Seoul",
    businessDaysOnly: true,
    tistoryRecurringPublishApproved: value.tistoryRecurringPublishApproved === true,
    retryDelayMinutes: clamp(value.retryDelayMinutes, 5, 120, 15),
    maxAttempts: clamp(value.maxAttempts, 1, 5, 3),
    autoRecoveryEnabled: value.autoRecoveryEnabled !== false,
    recoveryGraceMinutes: clamp(value.recoveryGraceMinutes, 5, 60, 10),
    recoveryWindowMinutes: clamp(value.recoveryWindowMinutes, 30, 360, 120),
    recoveryMaxAttempts: clamp(value.recoveryMaxAttempts, 3, 8, 5),
    recoveryCooldownMinutes: clamp(value.recoveryCooldownMinutes, 5, 60, 15)
  };
}

function normalizeState(value: Partial<PublicationSchedulerState>): PublicationSchedulerState {
  return {
    running: value.running === true,
    inFlight: value.inFlight === true,
    lastTickAt: value.lastTickAt ?? null,
    lastResult: value.lastResult ?? null,
    lastMessage: value.lastMessage ?? null,
    lastRecoveryAt: value.lastRecoveryAt ?? null,
    lastRecoveryResult: value.lastRecoveryResult ?? null,
    entries: value.entries && typeof value.entries === "object" ? value.entries : {}
  };
}

function collectDueSlots(input: {
  state: PublicationSchedulerState;
  localDate: string;
  localTime: string;
  now: Date;
  config: PublicationSchedulerConfig;
  slotId?: string;
}) {
  const due = new Map<string, DuePublicationSlot>();
  const definitions = PUBLICATION_SCHEDULE_DEFINITIONS.filter((definition) => {
    if (!input.slotId && definition.id === "blogger-stock-review") return false;
    return input.slotId ? definition.id === input.slotId : true;
  });

  for (const definition of definitions) {
    if ((input.slotId || input.localTime === definition.time) && isBusinessDay(input.localDate)) {
      due.set(entryKey(input.localDate, definition.id), { definition, marketDate: input.localDate, executionSource: "scheduled", recoveryReason: null });
    }
  }

  if (!input.slotId) {
    for (const entry of Object.values(input.state.entries)) {
      if (!entry.nextRetryAt || entry.attempts >= input.config.maxAttempts || entry.retryable === false) continue;
      if (entry.status === "success" || entry.status === "delegated") continue;
      if (!isBusinessDay(entry.marketDate)) continue;
      if (new Date(entry.nextRetryAt).getTime() > input.now.getTime()) continue;
      if (isTerminalPublicationMessage(entry.lastMessage)) continue;
      const definition = definitions.find((candidate) => candidate.id === entry.slotId);
      if (!definition) continue;
      due.set(entryKey(entry.marketDate, definition.id), { definition, marketDate: entry.marketDate, executionSource: "retry", recoveryReason: entry.lastMessage ?? "scheduled_retry" });
    }
  }

  if (!input.slotId && input.config.autoRecoveryEnabled && recoveryCooldownElapsed(input.state.lastRecoveryAt, input.now, input.config.recoveryCooldownMinutes)) {
    const recoveryDates = [input.localDate, shiftDate(input.localDate, -1)].filter(isBusinessDay);
    const recoveryCandidate = definitions
      .flatMap((definition) => recoveryDates.map((marketDate) => buildRecoveryCandidate(definition, marketDate, input)))
      .filter((candidate): candidate is DuePublicationSlot => Boolean(candidate))
      .sort((left, right) => `${left.marketDate} ${left.definition.time}`.localeCompare(`${right.marketDate} ${right.definition.time}`))[0];
    if (recoveryCandidate) {
      const key = entryKey(recoveryCandidate.marketDate, recoveryCandidate.definition.id);
      if (!due.has(key)) due.set(key, recoveryCandidate);
    }
  }

  return Array.from(due.values()).sort((a, b) => `${a.marketDate} ${a.definition.time}`.localeCompare(`${b.marketDate} ${b.definition.time}`));
}

function buildRecoveryCandidate(
  definition: PublicationScheduleDefinition,
  marketDate: string,
  input: {
    state: PublicationSchedulerState;
    localDate: string;
    localTime: string;
    now: Date;
    config: PublicationSchedulerConfig;
  }
): DuePublicationSlot | null {
  const scheduledAt = new Date(`${marketDate}T${definition.time}:00+09:00`).getTime();
  const elapsedMinutes = Math.floor((input.now.getTime() - scheduledAt) / 60_000);
  if (elapsedMinutes < input.config.recoveryGraceMinutes || elapsedMinutes > input.config.recoveryWindowMinutes) return null;
  const key = entryKey(marketDate, definition.id);
  const entry = input.state.entries[key];
  if (!entry) {
    return { definition, marketDate, executionSource: "recovery", recoveryReason: "missing_execution_record" };
  }
  if (entry.status === "success" || entry.status === "delegated" || entry.retryable === false) return null;
  if (entry.attempts >= input.config.recoveryMaxAttempts || isTerminalPublicationMessage(entry.lastMessage)) return null;
  if (!isSafeAutomaticRecoveryMessage(entry.lastMessage, entry.status)) return null;
  const lastAttemptAt = new Date(entry.updatedAt).getTime();
  if (Number.isFinite(lastAttemptAt) && input.now.getTime() - lastAttemptAt < input.config.retryDelayMinutes * 60_000) return null;
  return {
    definition,
    marketDate,
    executionSource: "recovery",
    recoveryReason: entry.lastMessage ?? `${entry.status}_without_message`
  };
}

function isSafeAutomaticRecoveryMessage(message: string | null, status: PublicationExecutionStatus) {
  if (!message) return status === "failed" || status === "blocked" || status === "processing";
  return [
    "capture",
    "chart_not_rendered",
    "client_error",
    "preview_validation_failed",
    "editor_sync_validation_failed",
    "image_upload",
    "public_page_validation_failed",
    "network",
    "timeout",
    "fetch_failed",
    "publication_slot_started",
    "execution_record_missing"
  ].some((code) => message.includes(code));
}

async function alertIfRecoveryExhausted<T extends { status: string; entry?: PublicationExecutionEntry }>(
  definition: PublicationScheduleDefinition,
  result: T,
  config: PublicationSchedulerConfig
): Promise<T> {
  const entry = result.entry;
  if (!entry || result.status === "success" || result.status === "delegated" || entry.attempts < config.recoveryMaxAttempts || entry.recoveryAlertedAt) {
    return result;
  }
  try {
    await enqueuePublicationRecoveryAlert({
      channel: definition.channel,
      marketDate: entry.marketDate,
      slotId: definition.id,
      scheduledTime: definition.time,
      label: definition.label,
      reason: entry.lastMessage ?? "automatic_recovery_exhausted",
      attempts: entry.attempts
    });
    const alertedEntry = await putEntry({ ...entry, recoveryAlertedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return { ...result, entry: alertedEntry } as T;
  } catch {
    return result;
  }
}

function recoveryCooldownElapsed(lastRecoveryAt: string | null, now: Date, cooldownMinutes: number) {
  if (!lastRecoveryAt) return true;
  const timestamp = new Date(lastRecoveryAt).getTime();
  return !Number.isFinite(timestamp) || now.getTime() - timestamp >= cooldownMinutes * 60_000;
}

function isBloggerAutomationRetryable(automation: Awaited<ReturnType<typeof runDailyBriefPublishAutomation>>) {
  return !automation.blockingReasons.some((reason) => isTerminalPublicationMessage(reason));
}

function isTerminalPublicationMessage(message: string | null) {
  if (!message) return false;
  if (message === "token_refresh:blogger_token_refresh_blocked") return true;
  return [
    "token_refresh_invalid_grant_reconnect_required",
    "manual_oauth_reconnect_required",
    "oauth_required",
    "token_refresh_unauthorized_client"
  ].some((code) => message.includes(code));
}

function getLocalDateTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
}

function isBusinessDay(date: string) {
  const day = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  return day !== 0 && day !== 6;
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function entryKey(date: string, slotId: string) { return `${date}:${slotId}`; }
function clamp(value: unknown, min: number, max: number, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback; }
function safeMessage(error: unknown) { return (error instanceof Error ? error.message : "publication_slot_failed").replace(/[\r\n]+/g, " ").slice(0, 240); }
function getRuntime() {
  const globalValue = globalThis as typeof globalThis & { __publicationSchedulerRuntime?: { timer: NodeJS.Timeout | null; inFlight: boolean } };
  return globalValue.__publicationSchedulerRuntime ??= { timer: null, inFlight: false };
}
