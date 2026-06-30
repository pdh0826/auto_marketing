import {
  buildDailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse,
  type DailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-audit-schema-design";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-2W-APPLY";
const PREVIEW_MODE = "read_only_llm_dispatch_audit_migration_apply_readback";
const MIGRATION_NAME = "20260620000300_add_llm_dispatch_audit_schema";

type ApplyReadbackMode = "preview" | "blocked_non_preview";
type AuditSchemaDesignSummary =
  DailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse["draftGenerationLlmDispatchAuditSchemaDesignSummary"];

export interface DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackResponse
  extends DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackSummary {
  checkedAt: string;
  draftGenerationLlmDispatchAuditMigrationApplyReadbackSummary: DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackSummary;
}

export interface DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackSummary {
  patchVersion: "9F-2W-APPLY";
  checked: true;
  mode: ApplyReadbackMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  migrationApplyOnly: true;
  dryRunOnly: false;
  migrationExpected: typeof MIGRATION_NAME;
  migrationApplied: boolean;
  schemaTablesCreated: boolean;
  rowsCreatedByMigration: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  bloggerWriteAttempted: false;
  targetSummary: AuditSchemaDesignSummary["targetSummary"];
  persistedApprovalSummary: AuditSchemaDesignSummary["persistedApprovalSummary"];
  executionGateSummary: AuditSchemaDesignSummary["executionGateSummary"];
  auditMigrationApplySummary: AuditMigrationApplySummary;
  baselineSummary: AuditMigrationBaselineSummary;
  sideEffectSummary: DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackSideEffectSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface AuditMigrationApplySummary {
  attemptsTableExists: boolean;
  eventsTableExists: boolean;
  artifactsTableExists: boolean;
  attemptsCount: number;
  eventsCount: number;
  artifactsCount: number;
  migrationCreatedRows: false;
  migrationAppliedNowOrPreviously: boolean;
  migrationApplySeparatedFromProviderCall: true;
  migrationName: typeof MIGRATION_NAME;
}

export interface AuditMigrationBaselineSummary {
  blogDailyContentPlans: number;
  blogDailyContentPlanItems: number;
  contentItems: number;
  operatorApprovals: number;
  operatorApprovalEvents: number;
  bloggerDraftSaves: number;
  bloggerDraftApprovals: number;
  bloggerPublishApprovals: number;
  bloggerPublishExecutionAttempts: number;
  llmCallLogs: number;
  targetFixture: {
    id: string | null;
    status: string | null;
    publishedAtIsNull: boolean;
    scheduledAtIsNull: boolean;
    draftMarkdownLength: number;
    draftHtmlLength: number;
    draftMarkdownMd5: string | null;
    draftHtmlMd5: string | null;
  };
}

export interface DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  migrationAlreadyApplied: boolean;
  auditRowsCreated: false;
  providerHealthChecked: false;
  providerNetworkCall: false;
  llmCall: false;
  llmEvaluatorCall: false;
  llmCallLogMutation: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  publishApprovalMutation: false;
  publishAttemptMutation: false;
  externalSend: false;
}

export async function buildDailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackRequest
): Promise<DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const designResponse = await buildDailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const designSummary = designResponse.draftGenerationLlmDispatchAuditSchemaDesignSummary;
  const [migrationApplied, auditMigrationApplySummary, baselineSummary] = await Promise.all([
    readMigrationApplied(),
    readAuditMigrationApplySummary(),
    readBaselineSummary()
  ]);
  const schemaTablesCreated =
    auditMigrationApplySummary.attemptsTableExists && auditMigrationApplySummary.eventsTableExists && auditMigrationApplySummary.artifactsTableExists;
  const blockingReasons = new Set<string>();

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_audit_migration_apply_readback_is_preview_only");
  }

  if (!migrationApplied) {
    blockingReasons.add("draft_generation_llm_dispatch_audit_migration_not_applied");
  }
  if (!schemaTablesCreated) {
    blockingReasons.add("draft_generation_llm_dispatch_audit_tables_missing");
  }
  if (auditMigrationApplySummary.attemptsCount > 0 || auditMigrationApplySummary.eventsCount > 0 || auditMigrationApplySummary.artifactsCount > 0) {
    blockingReasons.add("draft_generation_llm_dispatch_audit_rows_exist");
  }

  const sideEffectSummary = buildSideEffectSummary(migrationApplied);
  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_audit_migration_apply_readback_only",
    "provider_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);

  const summary: DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    migrationApplyOnly: true,
    dryRunOnly: false,
    migrationExpected: MIGRATION_NAME,
    migrationApplied,
    schemaTablesCreated,
    rowsCreatedByMigration: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    bloggerWriteAttempted: false,
    targetSummary: designSummary.targetSummary,
    persistedApprovalSummary: designSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: designSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: designSummary.executionGateSummary.resolvedBlockers
    },
    auditMigrationApplySummary: {
      ...auditMigrationApplySummary,
      migrationAppliedNowOrPreviously: migrationApplied,
      migrationName: MIGRATION_NAME
    },
    baselineSummary,
    sideEffectSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchAuditMigrationApplyReadbackSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackRequest): {
  mode: ApplyReadbackMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" ? "preview" : "blocked_non_preview",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId)
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readMigrationApplied() {
  const rows = await prisma.$queryRaw<{ migration_name: string | null }[]>`
    select migration_name
    from "_prisma_migrations"
    where migration_name = ${MIGRATION_NAME}
      and finished_at is not null
      and rolled_back_at is null
    limit 1
  `;
  return Boolean(rows[0]?.migration_name);
}

async function readAuditMigrationApplySummary(): Promise<Omit<AuditMigrationApplySummary, "migrationAppliedNowOrPreviously" | "migrationName">> {
  const tableRows = await prisma.$queryRaw<
    {
      attempts_table: string | null;
      events_table: string | null;
      artifacts_table: string | null;
    }[]
  >`
    select
      to_regclass('public.blog_daily_content_llm_dispatch_attempts')::text as attempts_table,
      to_regclass('public.blog_daily_content_llm_dispatch_events')::text as events_table,
      to_regclass('public.blog_daily_content_llm_dispatch_artifacts')::text as artifacts_table
  `;
  const row = tableRows[0];
  const attemptsTableExists = Boolean(row?.attempts_table);
  const eventsTableExists = Boolean(row?.events_table);
  const artifactsTableExists = Boolean(row?.artifacts_table);
  const [attemptsCount, eventsCount, artifactsCount] = await Promise.all([
    attemptsTableExists ? countRows("blog_daily_content_llm_dispatch_attempts") : Promise.resolve(0),
    eventsTableExists ? countRows("blog_daily_content_llm_dispatch_events") : Promise.resolve(0),
    artifactsTableExists ? countRows("blog_daily_content_llm_dispatch_artifacts") : Promise.resolve(0)
  ]);

  return {
    attemptsTableExists,
    eventsTableExists,
    artifactsTableExists,
    attemptsCount,
    eventsCount,
    artifactsCount,
    migrationCreatedRows: false,
    migrationApplySeparatedFromProviderCall: true
  };
}

async function countRows(tableName: "blog_daily_content_llm_dispatch_attempts" | "blog_daily_content_llm_dispatch_events" | "blog_daily_content_llm_dispatch_artifacts") {
  if (tableName === "blog_daily_content_llm_dispatch_attempts") {
    return prisma.blogDailyContentLlmDispatchAttempt.count();
  }
  if (tableName === "blog_daily_content_llm_dispatch_events") {
    return prisma.blogDailyContentLlmDispatchEvent.count();
  }
  return prisma.blogDailyContentLlmDispatchArtifact.count();
}

async function readBaselineSummary(): Promise<AuditMigrationBaselineSummary> {
  const rows = await prisma.$queryRaw<
    {
      blog_daily_content_plans: bigint;
      blog_daily_content_plan_items: bigint;
      content_items: bigint;
      operator_approvals: bigint;
      operator_approval_events: bigint;
      blogger_draft_saves: bigint;
      blogger_draft_approvals: bigint;
      blogger_publish_approvals: bigint;
      blogger_publish_execution_attempts: bigint;
      llm_call_logs: bigint;
    }[]
  >`
    select
      (select count(*) from blog_daily_content_plans) as blog_daily_content_plans,
      (select count(*) from blog_daily_content_plan_items) as blog_daily_content_plan_items,
      (select count(*) from content_items) as content_items,
      (select count(*) from blog_daily_content_operator_approvals) as operator_approvals,
      (select count(*) from blog_daily_content_operator_approval_events) as operator_approval_events,
      (select count(*) from blogger_draft_saves) as blogger_draft_saves,
      (select count(*) from blogger_draft_approvals) as blogger_draft_approvals,
      (select count(*) from blogger_publish_approvals) as blogger_publish_approvals,
      (select count(*) from blogger_publish_execution_attempts) as blogger_publish_execution_attempts,
      (select count(*) from llm_call_logs) as llm_call_logs
  `;
  const fixtureRows = await prisma.$queryRaw<
    {
      id: string;
      status: string;
      published_at_is_null: boolean;
      scheduled_at_is_null: boolean;
      draft_markdown_len: number;
      draft_html_len: number;
      draft_markdown_md5: string;
      draft_html_md5: string;
    }[]
  >`
    select
      id,
      status::text,
      "publishedAt" is null as published_at_is_null,
      "scheduledAt" is null as scheduled_at_is_null,
      length(coalesce("draftMarkdown", ''))::int as draft_markdown_len,
      length(coalesce("draftHtml", ''))::int as draft_html_len,
      md5(coalesce("draftMarkdown", '')) as draft_markdown_md5,
      md5(coalesce("draftHtml", '')) as draft_html_md5
    from content_items
    where id = 'daily_fixture_cmqlr1v1y0001iwj2gpv2875r'
  `;
  const row = rows[0];
  const fixture = fixtureRows[0];

  return {
    blogDailyContentPlans: toNumber(row?.blog_daily_content_plans),
    blogDailyContentPlanItems: toNumber(row?.blog_daily_content_plan_items),
    contentItems: toNumber(row?.content_items),
    operatorApprovals: toNumber(row?.operator_approvals),
    operatorApprovalEvents: toNumber(row?.operator_approval_events),
    bloggerDraftSaves: toNumber(row?.blogger_draft_saves),
    bloggerDraftApprovals: toNumber(row?.blogger_draft_approvals),
    bloggerPublishApprovals: toNumber(row?.blogger_publish_approvals),
    bloggerPublishExecutionAttempts: toNumber(row?.blogger_publish_execution_attempts),
    llmCallLogs: toNumber(row?.llm_call_logs),
    targetFixture: {
      id: fixture?.id ?? null,
      status: fixture?.status ?? null,
      publishedAtIsNull: fixture?.published_at_is_null ?? false,
      scheduledAtIsNull: fixture?.scheduled_at_is_null ?? false,
      draftMarkdownLength: fixture?.draft_markdown_len ?? 0,
      draftHtmlLength: fixture?.draft_html_len ?? 0,
      draftMarkdownMd5: fixture?.draft_markdown_md5 ?? null,
      draftHtmlMd5: fixture?.draft_html_md5 ?? null
    }
  };
}

function toNumber(value: bigint | number | null | undefined) {
  return typeof value === "bigint" ? Number(value) : value ?? 0;
}

function buildSideEffectSummary(migrationApplied: boolean): DailyContentDraftGenerationLlmDispatchAuditMigrationApplyReadbackSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    migrationAlreadyApplied: migrationApplied,
    auditRowsCreated: false,
    providerHealthChecked: false,
    providerNetworkCall: false,
    llmCall: false,
    llmEvaluatorCall: false,
    llmCallLogMutation: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    publishApprovalMutation: false,
    publishAttemptMutation: false,
    externalSend: false
  };
}
