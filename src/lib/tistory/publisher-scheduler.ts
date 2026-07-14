import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/client";
import { verifyFreshTistoryFuturesCandidateById } from "./futures-publication-guard";
import { enqueuePublicationLoginAlert } from "@/lib/automation/publication-login-alert";

const root = path.join(process.cwd(), "local-data", "tistory-scheduler");
const configPath = path.join(root, "config.json");
const queuePath = path.join(root, "queue.json");
const statePath = path.join(root, "state.json");
const intervalMs = 60_000;
const confirmation = "I_UNDERSTAND_THIS_WILL_PUBLISH_TO_TISTORY";

export interface TistoryPublisherConfig {
  enabled: boolean;
  timezone: string;
  livePublishEnabled: boolean;
  headless: boolean;
  sessionKeepAliveEnabled: boolean;
  sessionKeepAliveIntervalMinutes: number;
}

export interface TistoryQueueEntry {
  id: string;
  contentItemId: string;
  title: string;
  dueAt: string;
  approvedAt: string;
  approvalSource: "per_content" | "recurring_schedule";
  status: "pending" | "processing" | "success" | "blocked" | "failed";
  attempts: number;
  publicUrl: string | null;
  lastMessage: string | null;
  loginAlertedAt?: string | null;
  loginAlertContext?: {
    marketDate: string;
    slotId: string;
    scheduledTime: string;
    label: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TistoryPublisherState {
  running: boolean;
  inFlight: boolean;
  lastTickAt: string | null;
  lastResult: string | null;
  lastMessage: string | null;
  lastSessionCheckAt: string | null;
  nextSessionCheckAt: string | null;
  sessionStatus: "unknown" | "ready" | "login_required" | "error";
  lastSessionMessage: string | null;
}

const runtime = getRuntime();

export async function getTistoryPublisherStatus() {
  const config = await getConfig();
  if (config.enabled && !runtime.timer) await startTistoryPublisherScheduler();
  return { config, state: { ...(await getState()), running: Boolean(runtime.timer), inFlight: runtime.inFlight }, queue: await getQueue() };
}

export async function updateTistoryPublisherConfig(input: Partial<TistoryPublisherConfig>) {
  const current = await getConfig();
  const definedInput = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<TistoryPublisherConfig>;
  const config = normalizeConfig({ ...current, ...definedInput });
  await writeJson(configPath, config);
  if (config.enabled) await startTistoryPublisherScheduler();
  else await stopTistoryPublisherScheduler();
  return getTistoryPublisherStatus();
}

export async function enqueueTistoryPublish(input: {
  contentItemId: string;
  dueAt: string;
  approved: boolean;
  approvalSource?: "per_content" | "recurring_schedule";
  loginAlertedAt?: string | null;
  loginAlertContext?: TistoryQueueEntry["loginAlertContext"];
}) {
  if (!input.approved) throw new Error("tistory_publish_approval_required");
  if (!/^\w[\w-]+$/.test(input.contentItemId)) throw new Error("invalid_content_item_id");
  const due = new Date(input.dueAt);
  if (Number.isNaN(due.getTime())) throw new Error("invalid_due_at");
  const item = await prisma.contentItem.findUnique({ where: { id: input.contentItemId }, select: { id: true, title: true } });
  if (!item?.title) throw new Error("content_item_not_found");
  await readFile(path.join(process.cwd(), "local-data", "tistory-export", item.id, "manifest.json"), "utf8");
  const queue = await getQueue();
  if (queue.some((entry) => entry.contentItemId === item.id && entry.status === "success")) throw new Error("tistory_content_already_published");
  const existing = queue.find((entry) => entry.contentItemId === item.id && ["pending", "processing"].includes(entry.status));
  if (existing) return existing;
  const now = new Date().toISOString();
  const entry: TistoryQueueEntry = {
    id: `tistory-${Date.now().toString(36)}`,
    contentItemId: item.id,
    title: item.title,
    dueAt: due.toISOString(),
    approvedAt: now,
    approvalSource: input.approvalSource ?? "per_content",
    status: "pending",
    attempts: 0,
    publicUrl: null,
    lastMessage: null,
    loginAlertedAt: input.loginAlertedAt ?? null,
    loginAlertContext: input.loginAlertContext ?? null,
    createdAt: now,
    updatedAt: now
  };
  await writeQueue([...queue, entry]);
  return entry;
}

export async function retryTistoryPublishEntry(entryId: string) {
  const queue = await getQueue();
  const entry = queue.find((item) => item.id === entryId);
  if (!entry) throw new Error("tistory_queue_entry_not_found");
  if (entry.status === "success") throw new Error("tistory_content_already_published");
  if (entry.status === "processing") throw new Error("tistory_publish_in_flight");
  return patchEntry(entry.id, {
    status: "pending",
    dueAt: new Date().toISOString(),
    lastMessage: "tistory_publish_retry_queued"
  });
}

export async function startTistoryPublisherScheduler() {
  const config = await getConfig();
  await writeJson(configPath, { ...config, enabled: true });
  if (!runtime.timer) {
    runtime.timer = setInterval(() => void runTistorySchedulerCycle().catch(() => undefined), intervalMs);
    void tickTistorySessionKeepAlive({ force: true }).catch(() => undefined);
  }
  await updateState({ running: true, lastMessage: "tistory_scheduler_started" });
  return getTistoryPublisherStatus();
}

export async function stopTistoryPublisherScheduler() {
  const config = await getConfig();
  await writeJson(configPath, { ...config, enabled: false });
  if (runtime.timer) clearInterval(runtime.timer);
  runtime.timer = null;
  await updateState({ running: false, inFlight: false, lastMessage: "tistory_scheduler_stopped" });
  return { config: { ...config, enabled: false }, state: await getState(), queue: await getQueue() };
}

export async function tickTistoryPublisherScheduler(input: { force: boolean; entryId?: string }) {
  if (runtime.inFlight || runtime.sessionInFlight) return { status: "skipped", reason: "tistory_publish_in_flight" };
  const config = await getConfig();
  const queue = await getQueue();
  const now = Date.now();
  const entry = input.entryId
    ? queue.find((item) => item.id === input.entryId && item.status === "pending")
    : queue.find((item) => item.status === "pending" && (input.force || new Date(item.dueAt).getTime() <= now));
  await updateState({ lastTickAt: new Date().toISOString() });
  if (!entry) return { status: "skipped", reason: "no_due_tistory_publish" };
  if (!config.livePublishEnabled) {
    await patchEntry(entry.id, { status: "blocked", lastMessage: "tistory_live_publish_disabled" });
    return { status: "blocked", reason: "tistory_live_publish_disabled", entryId: entry.id };
  }
  runtime.inFlight = true;
  await patchEntry(entry.id, { status: "processing", attempts: entry.attempts + 1, lastMessage: "tistory_publish_started" });
  try {
    await verifyFreshTistoryFuturesCandidateById(entry.contentItemId);
    const result = await runPublisher(entry.contentItemId, config.headless);
    const loginRequired = result.error === "tistory_login_required";
    const status: TistoryQueueEntry["status"] = result.ok && result.publicUrl ? "success" : loginRequired ? "blocked" : "failed";
    const message = typeof result.error === "string" ? result.error : status === "success" ? "tistory_publish_success" : "tistory_publish_failed";
    let loginAlertedAt = entry.loginAlertedAt ?? null;
    if (loginRequired && !loginAlertedAt) {
      try {
        const context = entry.loginAlertContext;
        await enqueuePublicationLoginAlert({
          channel: "tistory",
          marketDate: context?.marketDate ?? getLocalDate(entry.dueAt, config.timezone),
          slotId: context?.slotId ?? entry.id,
          scheduledTime: context?.scheduledTime ?? getLocalTime(entry.dueAt, config.timezone),
          label: context?.label ?? entry.title,
          blocker: "tistory_login_required"
        });
        loginAlertedAt = new Date().toISOString();
      } catch {
        // Preserve the blocked publish result even when the notification queue is unavailable.
      }
    }
    const next = await patchEntry(entry.id, {
      status,
      publicUrl: typeof result.publicUrl === "string" ? result.publicUrl : null,
      lastMessage: message,
      loginAlertedAt
    });
    await updateState({ lastResult: status, lastMessage: next.lastMessage });
    return { status, entry: next, publisherResult: result };
  } finally {
    runtime.inFlight = false;
  }
}

export async function tickTistorySessionKeepAlive(input: { force: boolean }) {
  const config = await getConfig();
  const state = await getState();
  if (!config.enabled || !config.sessionKeepAliveEnabled) {
    return { status: "skipped" as const, reason: "tistory_session_keep_alive_disabled" };
  }
  if (runtime.inFlight || runtime.sessionInFlight) {
    return { status: "skipped" as const, reason: "tistory_browser_in_flight" };
  }
  const interval = config.sessionKeepAliveIntervalMinutes * 60_000;
  const lastCheck = state.lastSessionCheckAt ? new Date(state.lastSessionCheckAt).getTime() : 0;
  if (!input.force && Date.now() - lastCheck < interval) {
    return { status: "skipped" as const, reason: "tistory_session_keep_alive_not_due" };
  }

  runtime.sessionInFlight = true;
  try {
    const result = await runSessionKeepAlive();
    const checkedAt = new Date();
    const sessionStatus: TistoryPublisherState["sessionStatus"] = result.ok === true
      ? "ready"
      : result.error === "tistory_login_required"
        ? "login_required"
        : "error";
    await updateState({
      lastSessionCheckAt: checkedAt.toISOString(),
      nextSessionCheckAt: new Date(checkedAt.getTime() + interval).toISOString(),
      sessionStatus,
      lastSessionMessage: typeof result.error === "string" ? result.error : sessionStatus === "ready" ? "tistory_session_ready" : "tistory_session_check_failed"
    });
    return { status: sessionStatus, sessionReady: sessionStatus === "ready" };
  } catch {
    const checkedAt = new Date();
    await updateState({
      lastSessionCheckAt: checkedAt.toISOString(),
      nextSessionCheckAt: new Date(checkedAt.getTime() + interval).toISOString(),
      sessionStatus: "error",
      lastSessionMessage: "tistory_session_check_failed"
    });
    return { status: "error" as const, sessionReady: false };
  } finally {
    runtime.sessionInFlight = false;
  }
}

async function runTistorySchedulerCycle() {
  await tickTistorySessionKeepAlive({ force: false });
  await tickTistoryPublisherScheduler({ force: false });
}

async function runSessionKeepAlive() {
  return new Promise<Record<string, unknown>>((resolve) => {
    const child = spawn(process.execPath, ["scripts/tistory_ui_publish_content_item.mjs", "--keep-alive", "--headless"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.on("error", () => resolve({ ok: false, error: "tistory_session_check_failed" }));
    child.on("close", () => {
      const line = stdout.trim().split("\n").filter(Boolean).at(-1);
      if (line) {
        try { resolve(JSON.parse(line) as Record<string, unknown>); return; } catch { /* safe fallback */ }
      }
      resolve({ ok: false, error: "tistory_session_check_failed" });
    });
  });
}

export async function openTistoryLoginBrowser(contentItemId: string) {
  const child = spawn(process.execPath, ["scripts/tistory_ui_publish_content_item.mjs", "--content-item-id", contentItemId, "--open-browser"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();
  return { opened: true, contentItemId };
}

async function runPublisher(contentItemId: string, headless: boolean) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const args = ["scripts/tistory_ui_publish_content_item.mjs", "--content-item-id", contentItemId, "--publish", "--confirm", confirmation];
    if (headless) args.push("--headless");
    const child = spawn(process.execPath, args, { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => {
      const line = stdout.trim().split("\n").filter(Boolean).at(-1);
      if (line) {
        try { resolve(JSON.parse(line) as Record<string, unknown>); return; } catch { /* safe fallback */ }
      }
      resolve({ ok: false, error: `tistory_publisher_exit_${code ?? "unknown"}`, message: stderr.trim().slice(0, 180) });
    });
  });
}

async function getConfig(): Promise<TistoryPublisherConfig> {
  try { return normalizeConfig(JSON.parse(await readFile(configPath, "utf8"))); }
  catch { const value = normalizeConfig({}); await writeJson(configPath, value); return value; }
}

async function getQueue(): Promise<TistoryQueueEntry[]> {
  try { const value = JSON.parse(await readFile(queuePath, "utf8")); return Array.isArray(value) ? value : []; }
  catch { await writeQueue([]); return []; }
}

async function getState(): Promise<TistoryPublisherState> {
  try { return normalizeState(JSON.parse(await readFile(statePath, "utf8"))); }
  catch { const value = normalizeState({}); await writeJson(statePath, value); return value; }
}

async function patchEntry(id: string, patch: Partial<TistoryQueueEntry>) {
  const queue = await getQueue();
  const index = queue.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error("tistory_queue_entry_not_found");
  queue[index] = { ...queue[index], ...patch, updatedAt: new Date().toISOString() };
  await writeQueue(queue);
  return queue[index];
}

async function writeQueue(value: TistoryQueueEntry[]) { await writeJson(queuePath, value); }
async function updateState(patch: Partial<TistoryPublisherState>) { const next = normalizeState({ ...(await getState()), ...patch, running: Boolean(runtime.timer), inFlight: runtime.inFlight }); await writeJson(statePath, next); return next; }
async function writeJson(file: string, value: unknown) { await mkdir(root, { recursive: true }); await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }
function normalizeConfig(value: Partial<TistoryPublisherConfig>): TistoryPublisherConfig { return { enabled: value.enabled === true, timezone: value.timezone?.trim() || "Asia/Seoul", livePublishEnabled: value.livePublishEnabled === true, headless: value.headless === true, sessionKeepAliveEnabled: value.sessionKeepAliveEnabled !== false, sessionKeepAliveIntervalMinutes: clamp(value.sessionKeepAliveIntervalMinutes, 10, 240, 30) }; }
function normalizeState(value: Partial<TistoryPublisherState>): TistoryPublisherState { return { running: value.running === true, inFlight: value.inFlight === true, lastTickAt: value.lastTickAt ?? null, lastResult: value.lastResult ?? null, lastMessage: value.lastMessage ?? null, lastSessionCheckAt: value.lastSessionCheckAt ?? null, nextSessionCheckAt: value.nextSessionCheckAt ?? null, sessionStatus: value.sessionStatus ?? "unknown", lastSessionMessage: value.lastSessionMessage ?? null }; }
function getRuntime() { const globalValue = globalThis as typeof globalThis & { __tistoryPublisherRuntime?: { timer: NodeJS.Timeout | null; inFlight: boolean; sessionInFlight: boolean } }; return globalValue.__tistoryPublisherRuntime ??= { timer: null, inFlight: false, sessionInFlight: false }; }
function clamp(value: unknown, min: number, max: number, fallback: number) { return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback; }
function getLocalDate(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function getLocalTime(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
}
