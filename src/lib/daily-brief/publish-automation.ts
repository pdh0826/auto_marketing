import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import type { BloggerTokenRefreshSummary } from "@/lib/blogger/admin-types";
import { GUARDED_BLOGGER_PUBLISH_CONFIRMATION_PHRASE, GUARDED_BLOGGER_PUBLISH_LIVE_FEATURE_FLAG } from "@/lib/content/guarded-publish-execution";
import { refreshBloggerAccessTokenForConnection } from "@/lib/blogger/token-refresh";
import { prisma } from "@/lib/db/client";

export type DailyBriefSchedulerMode = "content_only" | "draft_save_only" | "publish_live_guarded";

export interface DailyBriefPublishAutomationResult {
  attempted: boolean;
  mode: DailyBriefSchedulerMode;
  status: "skipped" | "blocked" | "success" | "failed";
  stage: string;
  message: string;
  contentItemId: string;
  draftApprovalId: string | null;
  draftSaveId: string | null;
  publishApprovalId: string | null;
  publishExecutionAttemptId: string | null;
  bloggerPostId: string | null;
  bloggerPostUrl: string | null;
  livePublishAttempted: boolean;
  livePublishBlocked: boolean;
  blockingReasons: string[];
  warnings: string[];
  sideEffectSummary: {
    dbRead: true;
    dbWrite: boolean;
    bloggerDraftSave: boolean;
    bloggerPublish: boolean;
    bloggerUiWrite?: boolean;
    tokenRefresh: boolean;
    contentMutation: false;
    llmCall: false;
  };
}

type ApiEnvelope = {
  data?: unknown;
  error?: unknown;
  message?: unknown;
  blockingReasons?: unknown;
};

export async function runDailyBriefPublishAutomation(input: {
  contentItemId: string;
  mode: DailyBriefSchedulerMode;
}): Promise<DailyBriefPublishAutomationResult> {
  let empty = buildEmptyResult(input.contentItemId, input.mode);
  if (input.mode === "content_only") {
    return {
      ...empty,
      status: "skipped",
      stage: "content_only",
      message: "daily_brief_content_only_mode"
    };
  }

  try {
    const editorialGate = await readInvestmentWritingAutomationGate(input.contentItemId);
    if (!editorialGate.ready) {
      return {
        ...empty,
        status: "blocked",
        stage: "investment_writing_gate",
        message: "investment_writing_review_not_ready",
        blockingReasons: editorialGate.blockingReasons
      };
    }
    if (input.mode === "publish_live_guarded" && shouldUseBloggerUiPublishAutomation()) {
      return runDailyBriefBloggerUiPublishAutomation(input.contentItemId, input.mode, empty);
    }

    const tokenRefresh = await refreshBloggerTokenBeforePublishAutomation(input.contentItemId);
    empty = withTokenRefreshResult(empty, tokenRefresh);
    if (tokenRefresh.status === "blocked") {
      return {
        ...empty,
        status: "blocked",
        stage: "token_refresh",
        message: "blogger_token_refresh_blocked",
        blockingReasons: tokenRefresh.summary?.blockingReasons.length ? tokenRefresh.summary.blockingReasons : [tokenRefresh.reason],
        warnings: tokenRefresh.summary?.warnings ?? []
      };
    }

    const draftApproval = await postJson(`/api/content-items/${input.contentItemId}/blogger-draft-approval`, {});
    if (!draftApproval.ok) {
      return blockedResult(empty, "draft_approval", draftApproval);
    }
    const draftApprovalId = getPathString(draftApproval.data, ["approval", "id"]);

    const draftSave = await postJson(`/api/content-items/${input.contentItemId}/blogger-draft-save`, {});
    if (!draftSave.ok && draftSave.error !== "blogger_draft_already_saved_for_approval") {
      return blockedResult(
        {
          ...empty,
          draftApprovalId,
          sideEffectSummary: { ...empty.sideEffectSummary, dbWrite: Boolean(draftApprovalId) }
        },
        "draft_save",
        draftSave
      );
    }
    const draftSaveData = draftSave.data ?? {};
    const draftSaveId = getPathString(draftSaveData, ["draftSave", "id"]);
    const bloggerPostId = getPathString(draftSaveData, ["draftSave", "bloggerPostId"]);
    const bloggerPostUrl = getPathString(draftSaveData, ["draftSave", "bloggerPostUrl"]);

    if (input.mode === "draft_save_only") {
      return {
        ...empty,
        status: "success",
        stage: "draft_save",
        message: draftSave.error === "blogger_draft_already_saved_for_approval" ? "blogger_draft_already_saved_for_approval" : "blogger_draft_saved",
        draftApprovalId,
        draftSaveId,
        bloggerPostId,
        bloggerPostUrl,
        sideEffectSummary: {
          ...empty.sideEffectSummary,
          dbWrite: true,
          bloggerDraftSave: draftSave.error !== "blogger_draft_already_saved_for_approval"
        }
      };
    }

    const publishApprovalPreview = await postJson(`/api/content-items/${input.contentItemId}/publish-approval-preview`, { mode: "publish" });
    if (!publishApprovalPreview.ok) {
      return blockedResult(withDraftResult(empty, draftApprovalId, draftSaveId, bloggerPostId, bloggerPostUrl), "publish_approval_preview", publishApprovalPreview);
    }
    const approvalSnapshotHashPreview = getPathString(publishApprovalPreview.data, ["approvalSnapshotHashPreview"]);
    if (!approvalSnapshotHashPreview) {
      return {
        ...withDraftResult(empty, draftApprovalId, draftSaveId, bloggerPostId, bloggerPostUrl),
        status: "blocked",
        stage: "publish_approval_preview",
        message: "publish_approval_snapshot_hash_missing",
        blockingReasons: ["publish_approval_snapshot_hash_missing"]
      };
    }

    const publishApproval = await postJson(`/api/content-items/${input.contentItemId}/publish-approval-save`, {
      mode: "publish",
      approvalSnapshotHashPreview,
      tokenStateCheckedAt: getPathString(publishApprovalPreview.data, ["approvalSnapshotPreview", "tokenStateCheckedAt"]),
      rollbackAcknowledged: true,
      sideEffectSummaryAcknowledged: true,
      approvalPersistenceAcknowledged: true
    });
    if (!publishApproval.ok) {
      return blockedResult(withDraftResult(empty, draftApprovalId, draftSaveId, bloggerPostId, bloggerPostUrl), "publish_approval_save", publishApproval);
    }
    const publishApprovalId = getPathString(publishApproval.data, ["approvalId"]);

    const publishAttemptPreview = await postJson(`/api/content-items/${input.contentItemId}/publish-execution-attempt-preview`, { mode: "publish" });
    if (!publishAttemptPreview.ok) {
      return blockedResult(
        withPublishApprovalResult(empty, draftApprovalId, draftSaveId, publishApprovalId, bloggerPostId, bloggerPostUrl),
        "publish_execution_attempt_preview",
        publishAttemptPreview
      );
    }
    const attemptPlanHashPreview = getPathString(publishAttemptPreview.data, ["attemptPlanHashPreview"]);
    if (!attemptPlanHashPreview || !publishApprovalId) {
      return {
        ...withPublishApprovalResult(empty, draftApprovalId, draftSaveId, publishApprovalId, bloggerPostId, bloggerPostUrl),
        status: "blocked",
        stage: "publish_execution_attempt_preview",
        message: "publish_execution_attempt_plan_missing",
        blockingReasons: ["publish_execution_attempt_plan_missing"]
      };
    }

    const publishAttempt = await postJson(`/api/content-items/${input.contentItemId}/publish-execution-attempt-save`, {
      publishApprovalId,
      attemptPlanHashPreview,
      attemptPersistenceAcknowledged: true,
      noBloggerWriteAcknowledged: true,
      noContentMutationAcknowledged: true
    });
    if (!publishAttempt.ok) {
      return blockedResult(
        withPublishApprovalResult(empty, draftApprovalId, draftSaveId, publishApprovalId, bloggerPostId, bloggerPostUrl),
        "publish_execution_attempt_save",
        publishAttempt
      );
    }
    const publishExecutionAttemptId = getPathString(publishAttempt.data, ["attemptId"]);
    const contentHashes = await getContentHashes(input.contentItemId);
    const shouldAttemptLivePublish = isDailyBriefLivePublishEnabled();
    const guardedPublish = await postJson(`/api/content-items/${input.contentItemId}/guarded-publish-execution`, {
      mode: shouldAttemptLivePublish ? "live" : "dry_run",
      publishApprovalId,
      publishExecutionAttemptId,
      expectedDraftMarkdownHash: contentHashes.draftMarkdownHash,
      expectedDraftHtmlHash: getPathString(publishApprovalPreview.data, ["approvalSnapshotPreview", "draftHtmlHash"]) ?? contentHashes.draftHtmlHash,
      expectedDraftHtmlLength: getPathNumber(publishApprovalPreview.data, ["approvalSnapshotPreview", "draftHtmlLength"]) ?? contentHashes.draftHtmlLength,
      expectedTargetBloggerBlogId: getPathString(publishApprovalPreview.data, ["approvalSnapshotPreview", "targetBloggerBlogId"]),
      expectedTargetBloggerBlogUrl: getPathString(publishApprovalPreview.data, ["approvalSnapshotPreview", "targetBloggerBlogUrl"]),
      expectedBloggerPostId: getPathString(publishApprovalPreview.data, ["approvalSnapshotPreview", "bloggerPostId"]) ?? bloggerPostId,
      confirmLiveBloggerPublish: shouldAttemptLivePublish ? GUARDED_BLOGGER_PUBLISH_CONFIRMATION_PHRASE : null,
      rollbackPlanAcknowledged: true,
      externalWriteRiskAcknowledged: true,
      finalHumanApprovalConfirmed: shouldAttemptLivePublish
    });
    if (!guardedPublish.ok) {
      return blockedResult(
        withPublishAttemptResult(empty, draftApprovalId, draftSaveId, publishApprovalId, publishExecutionAttemptId, bloggerPostId, bloggerPostUrl),
        "guarded_publish_execution",
        guardedPublish
      );
    }

    const summary = getRecord(getPathRecord(guardedPublish.data, ["guardedPublishExecutionSummary"]));
    const livePublishAttempted = getBoolean(summary.liveExecutionAttempted);
    const livePublishBlocked = getBoolean(summary.liveExecutionBlocked);
    const guardedBlockers = getStringArray(summary.blockingReasons);
    const guardedWarnings = getStringArray(summary.warnings);
    const publishedUrl = getPathString(summary, ["bloggerResultRedacted", "bloggerPostUrl"]) ?? bloggerPostUrl;
    return {
      ...empty,
      status: livePublishAttempted && guardedBlockers.length === 0 ? "success" : "blocked",
      stage: "guarded_publish_execution",
      message: livePublishAttempted ? "blogger_publish_attempted" : "blogger_publish_guarded_dry_run_or_blocked",
      draftApprovalId,
      draftSaveId,
      publishApprovalId,
      publishExecutionAttemptId,
      bloggerPostId: getPathString(summary, ["bloggerResultRedacted", "bloggerPostId"]) ?? bloggerPostId,
      bloggerPostUrl: publishedUrl,
      livePublishAttempted,
      livePublishBlocked,
      blockingReasons: guardedBlockers,
      warnings: guardedWarnings,
      sideEffectSummary: {
        ...empty.sideEffectSummary,
        dbWrite: true,
        bloggerDraftSave: draftSave.error !== "blogger_draft_already_saved_for_approval",
        bloggerPublish: livePublishAttempted
      }
    };
  } catch (error) {
    return {
      ...empty,
      status: "failed",
      stage: "automation_exception",
      message: error instanceof Error ? error.message.slice(0, 160) : "daily_brief_publish_automation_failed",
      blockingReasons: ["daily_brief_publish_automation_failed"]
    };
  }
}

async function readInvestmentWritingAutomationGate(contentItemId: string) {
  const contentItem = await prisma.contentItem.findUnique({ where: { id: contentItemId }, select: { planJson: true } });
  if (!contentItem?.planJson || typeof contentItem.planJson !== "object" || Array.isArray(contentItem.planJson)) {
    return { ready: false, blockingReasons: ["investment_writing_review_missing"] };
  }
  const writing = (contentItem.planJson as Record<string, unknown>).investmentWriting;
  if (!writing || typeof writing !== "object" || Array.isArray(writing)) {
    return { ready: false, blockingReasons: ["investment_writing_review_missing"] };
  }
  const record = writing as Record<string, unknown>;
  if (record.autoPublishEligible !== true) {
    return { ready: false, blockingReasons: ["investment_writing_auto_publish_not_eligible"] };
  }
  return { ready: true, blockingReasons: [] as string[] };
}

const BLOGGER_UI_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_USES_BLOGGER_WEB_UI_TO_PUBLISH";

function shouldUseBloggerUiPublishAutomation() {
  return process.env.BLOG_DAILY_BRIEF_AUTO_PUBLISH_METHOD === "blogger_ui";
}

function isBloggerUiPublishEnabled() {
  return (
    process.env.BLOG_DAILY_BRIEF_BLOGGER_UI_AUTO_PUBLISH_ENABLED === "true" &&
    process.env.BLOG_DAILY_BRIEF_BLOGGER_UI_CONFIRMATION === BLOGGER_UI_CONFIRMATION_PHRASE
  );
}

async function runDailyBriefBloggerUiPublishAutomation(
  contentItemId: string,
  mode: DailyBriefSchedulerMode,
  base: DailyBriefPublishAutomationResult
): Promise<DailyBriefPublishAutomationResult> {
  if (!isBloggerUiPublishEnabled()) {
    return {
      ...base,
      status: "blocked",
      stage: "blogger_ui_publish_guard",
      message: "blogger_ui_publish_feature_flag_or_confirmation_missing",
      blockingReasons: ["blogger_ui_publish_feature_flag_or_confirmation_missing"],
      sideEffectSummary: { ...base.sideEffectSummary, bloggerUiWrite: false, bloggerPublish: false }
    };
  }

  const scriptArgs = [
    "scripts/blogger_ui_publish_content_item.mjs",
    "--content-item-id",
    contentItemId,
    "--live-ui",
    "--publish",
    "--confirm",
    BLOGGER_UI_CONFIRMATION_PHRASE
  ];
  if (process.env.BLOG_DAILY_BRIEF_BLOGGER_UI_HEADLESS === "true") {
    scriptArgs.push("--headless");
  }
  if (process.env.BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL) {
    scriptArgs.push("--editor-url", process.env.BLOG_DAILY_BRIEF_BLOGGER_UI_EDITOR_URL);
  }

  const result = await runNodeScript(scriptArgs);
  const publishClicked = /"publishClicked"\s*:\s*true/.test(result.stdout);
  const currentUrl = /"currentUrl"\s*:\s*"([^"]+)"/.exec(result.stdout)?.[1] ?? null;

  if (result.exitCode !== 0 || !publishClicked) {
    return {
      ...base,
      status: "blocked",
      stage: "blogger_ui_publish",
      message: result.exitCode === 0 ? "blogger_ui_publish_not_confirmed" : "blogger_ui_publish_failed",
      bloggerPostUrl: currentUrl,
      livePublishAttempted: true,
      livePublishBlocked: true,
      blockingReasons: [result.safeError ?? "blogger_ui_publish_failed"],
      sideEffectSummary: {
        ...base.sideEffectSummary,
        bloggerUiWrite: result.stdout.includes('"bloggerUiWrite": true'),
        bloggerPublish: false
      }
    };
  }

  return {
    ...base,
    status: "success",
    stage: "blogger_ui_publish",
    message: "blogger_ui_publish_clicked",
    bloggerPostUrl: currentUrl,
    livePublishAttempted: true,
    livePublishBlocked: false,
    sideEffectSummary: {
      ...base.sideEffectSummary,
      bloggerUiWrite: true,
      bloggerPublish: true
    }
  };
}

async function runNodeScript(args: string[]) {
  return new Promise<{ exitCode: number; stdout: string; stderr: string; safeError: string | null }>((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      resolve({ exitCode: 1, stdout, stderr, safeError: error.message.slice(0, 160) });
    });
    child.on("close", (code) => {
      const safeError =
        /"error"\s*:\s*"([^"]+)"/.exec(stdout)?.[1] ??
        stderr
          .split(/\r?\n/)
          .find((line) => line.trim())
          ?.slice(0, 160) ??
        null;
      resolve({ exitCode: code ?? 1, stdout, stderr, safeError });
    });
  });
}

function buildEmptyResult(contentItemId: string, mode: DailyBriefSchedulerMode): DailyBriefPublishAutomationResult {
  return {
    attempted: mode !== "content_only",
    mode,
    status: "skipped",
    stage: "not_started",
    message: "not_started",
    contentItemId,
    draftApprovalId: null,
    draftSaveId: null,
    publishApprovalId: null,
    publishExecutionAttemptId: null,
    bloggerPostId: null,
    bloggerPostUrl: null,
    livePublishAttempted: false,
    livePublishBlocked: true,
    blockingReasons: [],
    warnings: [],
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      bloggerDraftSave: false,
      bloggerPublish: false,
      tokenRefresh: false,
      contentMutation: false,
      llmCall: false
    }
  };
}

type PublishAutomationTokenRefreshResult =
  | {
      status: "ok";
      reason: "token_valid_or_refreshed";
      summary: BloggerTokenRefreshSummary;
    }
  | {
      status: "blocked";
      reason: string;
      summary: BloggerTokenRefreshSummary | null;
    };

async function refreshBloggerTokenBeforePublishAutomation(contentItemId: string): Promise<PublishAutomationTokenRefreshResult> {
  const contentItem = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: { blogId: true }
  });
  if (!contentItem?.blogId) {
    return { status: "blocked", reason: "content_blog_missing", summary: null };
  }

  const connections = await prisma.bloggerConnection.findMany({
    where: { blogId: contentItem.blogId },
    select: { id: true }
  });
  if (connections.length !== 1) {
    return { status: "blocked", reason: "blogger_connection_not_unique", summary: null };
  }

  const summary = await refreshBloggerAccessTokenForConnection({
    connectionId: connections[0].id,
    reason: "publish_oauth_gate",
    force: false
  });

  if (summary.newAccessTokenState !== "valid") {
    return { status: "blocked", reason: "blogger_token_refresh_blocked", summary };
  }
  return { status: "ok", reason: "token_valid_or_refreshed", summary };
}

function withTokenRefreshResult(base: DailyBriefPublishAutomationResult, result: PublishAutomationTokenRefreshResult): DailyBriefPublishAutomationResult {
  const summary = result.summary;
  if (!summary) {
    return base;
  }
  return {
    ...base,
    sideEffectSummary: {
      ...base.sideEffectSummary,
      dbWrite: base.sideEffectSummary.dbWrite || summary.sideEffectSummary.dbWrite,
      tokenRefresh: summary.sideEffectSummary.googleTokenEndpointCall
    }
  };
}

function blockedResult(base: DailyBriefPublishAutomationResult, stage: string, response: Awaited<ReturnType<typeof postJson>>): DailyBriefPublishAutomationResult {
  return {
    ...base,
    status: "blocked",
    stage,
    message: response.error ?? "daily_brief_publish_automation_blocked",
    blockingReasons: response.blockingReasons.length > 0 ? response.blockingReasons : [response.error ?? "daily_brief_publish_automation_blocked"],
    warnings: response.warnings
  };
}

function withDraftResult(
  base: DailyBriefPublishAutomationResult,
  draftApprovalId: string | null,
  draftSaveId: string | null,
  bloggerPostId: string | null,
  bloggerPostUrl: string | null
) {
  return {
    ...base,
    draftApprovalId,
    draftSaveId,
    bloggerPostId,
    bloggerPostUrl,
    sideEffectSummary: { ...base.sideEffectSummary, dbWrite: true, bloggerDraftSave: Boolean(draftSaveId) }
  };
}

function withPublishApprovalResult(
  base: DailyBriefPublishAutomationResult,
  draftApprovalId: string | null,
  draftSaveId: string | null,
  publishApprovalId: string | null,
  bloggerPostId: string | null,
  bloggerPostUrl: string | null
) {
  return {
    ...withDraftResult(base, draftApprovalId, draftSaveId, bloggerPostId, bloggerPostUrl),
    publishApprovalId
  };
}

function withPublishAttemptResult(
  base: DailyBriefPublishAutomationResult,
  draftApprovalId: string | null,
  draftSaveId: string | null,
  publishApprovalId: string | null,
  publishExecutionAttemptId: string | null,
  bloggerPostId: string | null,
  bloggerPostUrl: string | null
) {
  return {
    ...withPublishApprovalResult(base, draftApprovalId, draftSaveId, publishApprovalId, bloggerPostId, bloggerPostUrl),
    publishExecutionAttemptId
  };
}

async function postJson(pathname: string, body: Record<string, unknown>) {
  const response = await fetch(`${getInternalBaseUrl()}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const envelope = (await response.json().catch(() => ({}))) as ApiEnvelope;
  const data = envelope.data ?? null;
  return {
    ok: response.ok,
    status: response.status,
    data,
    error: typeof envelope.error === "string" ? envelope.error : response.ok ? null : `http_${response.status}`,
    message: typeof envelope.message === "string" ? envelope.message : null,
    blockingReasons: getStringArray(envelope.blockingReasons ?? getPathRecord(data, ["blockingReasons"])),
    warnings: getStringArray(getPathRecord(data, ["warnings"]))
  };
}

function getInternalBaseUrl() {
  const configured = process.env.BLOG_GROWTH_AGENT_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured && /^https?:\/\//.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  return `http://127.0.0.1:${process.env.PORT || "3004"}`;
}

function isDailyBriefLivePublishEnabled() {
  return (
    process.env.BLOG_DAILY_BRIEF_AUTO_PUBLISH_LIVE_ENABLED === "true" &&
    process.env.BLOG_DAILY_BRIEF_AUTO_PUBLISH_CONFIRMATION === GUARDED_BLOGGER_PUBLISH_CONFIRMATION_PHRASE &&
    process.env[GUARDED_BLOGGER_PUBLISH_LIVE_FEATURE_FLAG] === "true"
  );
}

async function getContentHashes(contentItemId: string) {
  const contentItem = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: {
      draftMarkdown: true,
      draftHtml: true
    }
  });
  const draftMarkdown = contentItem?.draftMarkdown ?? "";
  const draftHtml = contentItem?.draftHtml ?? "";
  return {
    draftMarkdownHash: md5Hex(draftMarkdown),
    draftHtmlHash: md5Hex(draftHtml),
    draftHtmlLength: draftHtml.length
  };
}

function md5Hex(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex");
}

function getPathString(value: unknown, path: string[]) {
  const current = getPathRecord(value, path);
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function getPathNumber(value: unknown, path: string[]) {
  const current = getPathRecord(value, path);
  return typeof current === "number" && Number.isFinite(current) ? current : null;
}

function getPathRecord(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

function getBoolean(value: unknown) {
  return value === true;
}
