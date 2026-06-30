import { existsSync, readFileSync } from "fs";
import path from "path";
import {
  buildDailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse,
  type DailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse
} from "@/lib/daily-content-plans/draft-generation-llm-dispatch-audit-schema-design";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-2W";
const PREVIEW_MODE = "read_only_draft_generation_llm_dispatch_audit_schema_scaffold_preview";
const SCAFFOLD_VERSION = "daily_content_draft_generation_llm_dispatch_audit_schema_scaffold_v0";
const SOURCE_DESIGN_PATCH_VERSION = "9F-2V";
const MIGRATION_PATH = "prisma/migrations/20260620000300_add_llm_dispatch_audit_schema/migration.sql";

type AuditSchemaScaffoldMode = "preview" | "blocked_non_preview";
type AuditSchemaDesignSummary =
  DailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse["draftGenerationLlmDispatchAuditSchemaDesignSummary"];

export interface DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewResponse
  extends DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewSummary {
  checkedAt: string;
  draftGenerationLlmDispatchAuditSchemaScaffoldPreviewSummary: DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewSummary;
}

export interface DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewSummary {
  patchVersion: "9F-2W";
  checked: true;
  mode: AuditSchemaScaffoldMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  scaffoldOnly: true;
  dryRunOnly: true;
  schemaModified: true;
  migrationCreated: true;
  migrationApplied: false;
  dbWrite: false;
  providerNetworkCallAttempted: false;
  llmCallAttempted: false;
  contentMutationAttempted: false;
  targetSummary: AuditSchemaDesignSummary["targetSummary"];
  persistedApprovalSummary: AuditSchemaDesignSummary["persistedApprovalSummary"];
  executionGateSummary: AuditSchemaDesignSummary["executionGateSummary"];
  auditSchemaScaffoldSummary: AuditSchemaScaffoldSummary;
  sideEffectSummary: DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldSideEffectSummary;
  currentSideEffectSummary: DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface AuditSchemaScaffoldSummary {
  scaffoldVersion: typeof SCAFFOLD_VERSION;
  sourceDesignPatchVersion: typeof SOURCE_DESIGN_PATCH_VERSION;
  scaffoldOnly: true;
  prismaSchemaChangedNow: true;
  migrationCreatedNow: true;
  migrationAppliedNow: false;
  dbTablesCreatedNow: boolean;
  dbRowsCreatedNow: false;
  proposedApplyPatchCandidate: "9F-2W-APPLY";
  migrationShouldCreateRows: false;
  migrationShouldBeSeparateFromProviderCall: true;
  schemaModels: string[];
  schemaModelPresence: {
    attemptModelPresent: boolean;
    eventModelPresent: boolean;
    artifactModelPresent: boolean;
  };
  migrationFiles: string[];
  migrationFilePresence: {
    expectedMigrationFile: string;
    expectedMigrationFileExists: boolean;
  };
  dbTablePresence: {
    attemptsTableExistsInDbNow: boolean;
    eventsTableExistsInDbNow: boolean;
    artifactsTableExistsInDbNow: boolean;
  };
  scaffoldedTables: string[];
  idempotencyPolicy: {
    rawIdempotencyKeyStored: false;
    idempotencyKeyHashStored: true;
    uniqueConstraintScaffolded: boolean;
  };
  redactionPolicy: {
    rawSecretsStoredDefault: false;
    rawTokensStoredDefault: false;
    rawProviderRequestStoredByDefault: false;
    rawProviderResponseStoredByDefault: false;
    authorizationHeaderValueStored: false;
  };
  migrationSafetySummary: MigrationSafetySummary;
}

export interface MigrationSafetySummary {
  containsDropTable: boolean;
  containsDropColumn: boolean;
  containsDelete: boolean;
  containsUpdate: boolean;
  containsInsert: boolean;
  containsTruncate: boolean;
  containsCreateTable: boolean;
  containsCreateIndex: boolean;
  containsAlterTable: boolean;
}

export interface DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  schemaFileModified: true;
  migrationFileCreated: true;
  migrationApplied: false;
  dbTablesCreated: false;
  dbRowsCreated: false;
  envRead: true;
  secretValueExposed: false;
  requestSentToProvider: false;
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

export async function buildDailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewResponse(
  rawRequest: DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewRequest
): Promise<DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const designResponse = await buildDailyContentDraftGenerationLlmDispatchAuditSchemaDesignResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const designSummary = designResponse.draftGenerationLlmDispatchAuditSchemaDesignSummary;
  const migrationSql = readTextFileIfExists(MIGRATION_PATH);
  const schemaText = readTextFileIfExists("prisma/schema.prisma");
  const dbTablePresence = await readDbTablePresence();
  const auditSchemaScaffoldSummary = buildScaffoldSummary({ schemaText, migrationSql, dbTablePresence });
  const blockingReasons = new Set<string>();

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_llm_dispatch_audit_schema_scaffold_preview_is_preview_only");
  }

  const warnings = new Set<string>([
    "draft_generation_llm_dispatch_audit_schema_scaffold_preview_only",
    "migration_scaffold_created_but_not_applied",
    "audit_tables_not_created_in_db",
    "provider_call_disabled_by_patch_policy",
    "content_item_mutation_disabled"
  ]);
  const sideEffectSummary = buildSideEffectSummary();

  const summary: DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    scaffoldOnly: true,
    dryRunOnly: true,
    schemaModified: true,
    migrationCreated: true,
    migrationApplied: false,
    dbWrite: false,
    providerNetworkCallAttempted: false,
    llmCallAttempted: false,
    contentMutationAttempted: false,
    targetSummary: designSummary.targetSummary,
    persistedApprovalSummary: designSummary.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: designSummary.executionGateSummary.remainingBlockers,
      resolvedBlockers: designSummary.executionGateSummary.resolvedBlockers
    },
    auditSchemaScaffoldSummary,
    sideEffectSummary,
    currentSideEffectSummary: sideEffectSummary,
    blockingReasons: Array.from(blockingReasons),
    warnings: Array.from(warnings)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationLlmDispatchAuditSchemaScaffoldPreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldPreviewRequest): {
  mode: AuditSchemaScaffoldMode;
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

function buildScaffoldSummary(input: {
  schemaText: string;
  migrationSql: string;
  dbTablePresence: AuditSchemaScaffoldSummary["dbTablePresence"];
}): AuditSchemaScaffoldSummary {
  const migrationSafetySummary = buildMigrationSafetySummary(input.migrationSql);
  return {
    scaffoldVersion: SCAFFOLD_VERSION,
    sourceDesignPatchVersion: SOURCE_DESIGN_PATCH_VERSION,
    scaffoldOnly: true,
    prismaSchemaChangedNow: true,
    migrationCreatedNow: true,
    migrationAppliedNow: false,
    dbTablesCreatedNow:
      input.dbTablePresence.attemptsTableExistsInDbNow || input.dbTablePresence.eventsTableExistsInDbNow || input.dbTablePresence.artifactsTableExistsInDbNow,
    dbRowsCreatedNow: false,
    proposedApplyPatchCandidate: "9F-2W-APPLY",
    migrationShouldCreateRows: false,
    migrationShouldBeSeparateFromProviderCall: true,
    schemaModels: ["BlogDailyContentLlmDispatchAttempt", "BlogDailyContentLlmDispatchEvent", "BlogDailyContentLlmDispatchArtifact"],
    schemaModelPresence: {
      attemptModelPresent: input.schemaText.includes("model BlogDailyContentLlmDispatchAttempt"),
      eventModelPresent: input.schemaText.includes("model BlogDailyContentLlmDispatchEvent"),
      artifactModelPresent: input.schemaText.includes("model BlogDailyContentLlmDispatchArtifact")
    },
    migrationFiles: [MIGRATION_PATH],
    migrationFilePresence: {
      expectedMigrationFile: MIGRATION_PATH,
      expectedMigrationFileExists: Boolean(input.migrationSql)
    },
    dbTablePresence: input.dbTablePresence,
    scaffoldedTables: [
      "blog_daily_content_llm_dispatch_attempts",
      "blog_daily_content_llm_dispatch_events",
      "blog_daily_content_llm_dispatch_artifacts"
    ],
    idempotencyPolicy: {
      rawIdempotencyKeyStored: false,
      idempotencyKeyHashStored: true,
      uniqueConstraintScaffolded: input.migrationSql.includes("uq_bdc_llm_dispatch_idempotency")
    },
    redactionPolicy: {
      rawSecretsStoredDefault: false,
      rawTokensStoredDefault: false,
      rawProviderRequestStoredByDefault: false,
      rawProviderResponseStoredByDefault: false,
      authorizationHeaderValueStored: false
    },
    migrationSafetySummary
  };
}

function readTextFileIfExists(relativePath: string) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function buildMigrationSafetySummary(sql: string): MigrationSafetySummary {
  return {
    containsDropTable: /\bDROP\s+TABLE\b/i.test(sql),
    containsDropColumn: /\bDROP\s+COLUMN\b/i.test(sql),
    containsDelete: /\bDELETE\s+FROM\b/i.test(sql),
    containsUpdate: /\bUPDATE\s+/i.test(sql),
    containsInsert: /\bINSERT\s+INTO\b/i.test(sql),
    containsTruncate: /\bTRUNCATE\b/i.test(sql),
    containsCreateTable: /\bCREATE\s+TABLE\b/i.test(sql),
    containsCreateIndex: /\bCREATE\s+(UNIQUE\s+)?INDEX\b/i.test(sql),
    containsAlterTable: /\bALTER\s+TABLE\b/i.test(sql)
  };
}

async function readDbTablePresence(): Promise<AuditSchemaScaffoldSummary["dbTablePresence"]> {
  const rows = await prisma.$queryRaw<
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
  const row = rows[0];
  return {
    attemptsTableExistsInDbNow: Boolean(row?.attempts_table),
    eventsTableExistsInDbNow: Boolean(row?.events_table),
    artifactsTableExistsInDbNow: Boolean(row?.artifacts_table)
  };
}

function buildSideEffectSummary(): DailyContentDraftGenerationLlmDispatchAuditSchemaScaffoldSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    schemaFileModified: true,
    migrationFileCreated: true,
    migrationApplied: false,
    dbTablesCreated: false,
    dbRowsCreated: false,
    envRead: true,
    secretValueExposed: false,
    requestSentToProvider: false,
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
