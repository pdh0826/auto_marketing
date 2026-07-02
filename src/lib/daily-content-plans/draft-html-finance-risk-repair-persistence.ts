import { prisma } from "@/lib/db/client";
import {
  buildDailyContentDraftHtmlFinanceRiskRepairPreviewResponse,
  type DailyContentDraftHtmlFinanceRiskRepairPreviewResponse
} from "@/lib/daily-content-plans/draft-html-finance-risk-repair-preview";

const PATCH_VERSION = "9F-3R-FIX2";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_DRAFT_HTML_FINANCE_RISK_REPAIR_PERSISTENCE_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_PERSISTS_FINANCE_RISK_REPAIRED_DRAFT_HTML_ONLY_WITHOUT_BLOGGER_WRITE";

type PersistenceMode = "preview" | "apply" | "blocked_non_supported_mode";
type RepairPreviewSummary = DailyContentDraftHtmlFinanceRiskRepairPreviewResponse["draftHtmlFinanceRiskRepairPreviewSummary"];

export interface DailyContentDraftHtmlFinanceRiskRepairPersistenceRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  expectedCurrentDraftHtmlHash?: unknown;
  expectedCandidateHtmlHash?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftHtmlFinanceRiskRepairPersistenceResponse extends DailyContentDraftHtmlFinanceRiskRepairPersistenceSummary {
  checkedAt: string;
  draftHtmlFinanceRiskRepairPersistenceSummary: DailyContentDraftHtmlFinanceRiskRepairPersistenceSummary;
}

export interface DailyContentDraftHtmlFinanceRiskRepairPersistenceSummary {
  patchVersion: "9F-3R-FIX2";
  checked: true;
  mode: PersistenceMode;
  requestedMode: string;
  persistenceImplemented: true;
  persistenceAllowed: boolean;
  repairedDraftHtmlPersistedNow: boolean;
  repairPreviewSummary: RepairPreviewSummary;
  repairPersistenceDetailSummary: FinanceRiskRepairPersistenceDetailSummary;
  currentSideEffectSummary: FinanceRiskRepairPersistenceSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface FinanceRiskRepairPersistenceDetailSummary {
  featureFlagName: typeof FEATURE_FLAG_NAME;
  featureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawConfirmationPhraseStored: false;
  rawIdempotencyKeyStored: false;
  expectedCurrentDraftHtmlHashMatched: boolean;
  expectedCandidateHtmlHashMatched: boolean;
  currentDraftHtmlHashBefore: string | null;
  candidateHtmlHash: string | null;
  candidateHtmlLength: number | null;
  contentItemId: string | null;
  contentStatusBefore: string | null;
  draftMarkdownLengthBefore: number | null;
  draftHtmlLengthBefore: number | null;
  draftMarkdownLengthAfter: number | null;
  draftHtmlLengthAfter: number | null;
  afterQualityReady: boolean | null;
  afterQualityGrade: "pass" | "warn" | "fail" | null;
  afterRequiredFailCount: number | null;
  appliedField: "draftHtml" | null;
  candidateHtmlReturned: false;
  fullDraftMarkdownReturned: false;
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  canPersistNow: boolean;
  persistenceBlockers: string[];
}

export interface FinanceRiskRepairPersistenceSideEffectSummary {
  dbRead: true;
  dbWrite: boolean;
  contentItemMutation: boolean;
  draftMarkdownMutation: false;
  draftHtmlMutation: boolean;
  statusMutation: false;
  qualityScoreMutation: false;
  publishedAtMutation: false;
  scheduledAtMutation: false;
  auditAttemptMutation: false;
  auditEventMutation: false;
  auditArtifactMutation: false;
  llmCall: false;
  llmCallLogMutation: false;
  bloggerRead: false;
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentDraftHtmlFinanceRiskRepairPersistenceResponse(
  rawRequest: DailyContentDraftHtmlFinanceRiskRepairPersistenceRequest
): Promise<DailyContentDraftHtmlFinanceRiskRepairPersistenceResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const repairPreview = await buildDailyContentDraftHtmlFinanceRiskRepairPreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId,
    includeCandidateHtml: true
  });
  const repairSummary = repairPreview.draftHtmlFinanceRiskRepairPreviewSummary;
  const candidateHtml = repairPreview.candidateHtml ?? "";
  const candidateHash = repairSummary.repairDetailSummary.candidateHtmlHash;
  const contentItem = request.contentItemId
    ? await prisma.contentItem.findUnique({
        where: { id: request.contentItemId },
        select: {
          id: true,
          status: true,
          draftMarkdown: true,
          draftHtml: true,
          qualityScore: true,
          publishedAt: true,
          scheduledAt: true
        }
      })
    : null;
  const beforeDraftMarkdownLength = contentItem?.draftMarkdown?.length ?? 0;
  const beforeDraftHtmlLength = contentItem?.draftHtml?.length ?? 0;
  const currentDraftHtmlHash = contentItem ? repairSummary.targetSummary.draftHtmlHash : null;
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(request.idempotencyKey);
  const expectedCurrentDraftHtmlHashMatched =
    Boolean(request.expectedCurrentDraftHtmlHash) && request.expectedCurrentDraftHtmlHash === currentDraftHtmlHash;
  const expectedCandidateHtmlHashMatched = Boolean(request.expectedCandidateHtmlHash) && request.expectedCandidateHtmlHash === candidateHash;
  const blockers = buildBlockers({
    mode: request.mode,
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    expectedCurrentDraftHtmlHashMatched,
    expectedCandidateHtmlHashMatched,
    repairPreviewReady: repairSummary.repairPreviewReady,
    candidateHtml,
    candidateHash,
    currentDraftHtmlHash,
    contentItem
  });
  const canPersistNow = request.mode === "apply" && blockers.length === 0;
  let repairedDraftHtmlPersistedNow = false;
  let afterDraftMarkdownLength: number | null = beforeDraftMarkdownLength;
  let afterDraftHtmlLength: number | null = beforeDraftHtmlLength;

  if (canPersistNow && contentItem && request.contentItemId) {
    const updated = await prisma.contentItem.update({
      where: { id: request.contentItemId },
      data: {
        draftHtml: candidateHtml
      },
      select: {
        draftMarkdown: true,
        draftHtml: true
      }
    });
    repairedDraftHtmlPersistedNow = true;
    afterDraftMarkdownLength = updated.draftMarkdown?.length ?? 0;
    afterDraftHtmlLength = updated.draftHtml?.length ?? 0;
  }

  const responseBlockers = repairedDraftHtmlPersistedNow ? [] : blockers;
  const summary: DailyContentDraftHtmlFinanceRiskRepairPersistenceSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    persistenceImplemented: true,
    persistenceAllowed: canPersistNow,
    repairedDraftHtmlPersistedNow,
    repairPreviewSummary: {
      ...repairSummary,
      repairDetailSummary: {
        ...repairSummary.repairDetailSummary,
        candidateHtmlReturned: false
      }
    },
    repairPersistenceDetailSummary: {
      featureFlagName: FEATURE_FLAG_NAME,
      featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent,
      rawConfirmationPhraseStored: false,
      rawIdempotencyKeyStored: false,
      expectedCurrentDraftHtmlHashMatched,
      expectedCandidateHtmlHashMatched,
      currentDraftHtmlHashBefore: currentDraftHtmlHash,
      candidateHtmlHash: candidateHash,
      candidateHtmlLength: candidateHtml ? candidateHtml.length : null,
      contentItemId: contentItem?.id ?? null,
      contentStatusBefore: contentItem?.status ?? null,
      draftMarkdownLengthBefore: beforeDraftMarkdownLength,
      draftHtmlLengthBefore: beforeDraftHtmlLength,
      draftMarkdownLengthAfter: afterDraftMarkdownLength,
      draftHtmlLengthAfter: afterDraftHtmlLength,
      afterQualityReady: repairSummary.afterQualitySummary?.ready ?? null,
      afterQualityGrade: repairSummary.afterQualitySummary?.grade ?? null,
      afterRequiredFailCount: repairSummary.afterQualitySummary?.requiredFailCount ?? null,
      appliedField: repairedDraftHtmlPersistedNow ? "draftHtml" : null,
      candidateHtmlReturned: false,
      fullDraftMarkdownReturned: false,
      rawPromptStoredOrReturned: false,
      rawResponseStoredOrReturned: false,
      canPersistNow,
      persistenceBlockers: responseBlockers
    },
    currentSideEffectSummary: buildSideEffectSummary(repairedDraftHtmlPersistedNow),
    blockingReasons: responseBlockers,
    warnings: buildWarnings(request.mode, repairedDraftHtmlPersistedNow)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftHtmlFinanceRiskRepairPersistenceSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftHtmlFinanceRiskRepairPersistenceRequest): {
  mode: PersistenceMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  expectedCurrentDraftHtmlHash: string | null;
  expectedCandidateHtmlHash: string | null;
  confirmationPhrase: string | null;
  idempotencyKey: string | null;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" || requestedMode === "apply" ? requestedMode : "blocked_non_supported_mode",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId),
    expectedCurrentDraftHtmlHash: getString(rawRequest.expectedCurrentDraftHtmlHash),
    expectedCandidateHtmlHash: getString(rawRequest.expectedCandidateHtmlHash),
    confirmationPhrase: getString(rawRequest.confirmationPhrase),
    idempotencyKey: getString(rawRequest.idempotencyKey)
  };
}

function buildBlockers(input: {
  mode: PersistenceMode;
  featureFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  expectedCurrentDraftHtmlHashMatched: boolean;
  expectedCandidateHtmlHashMatched: boolean;
  repairPreviewReady: boolean;
  candidateHtml: string;
  candidateHash: string | null;
  currentDraftHtmlHash: string | null;
  contentItem: {
    id: string;
    status: string;
    draftMarkdown: string | null;
    draftHtml: string | null;
    qualityScore: number | null;
    publishedAt: Date | null;
    scheduledAt: Date | null;
  } | null;
}) {
  const blockers: string[] = [];

  if (input.mode === "blocked_non_supported_mode") {
    blockers.push("draft_html_finance_risk_repair_persistence_mode_not_supported");
  }
  if (input.mode === "apply" && !input.featureFlagEnabled) {
    blockers.push("draft_html_finance_risk_repair_persistence_feature_flag_disabled");
  }
  if (input.mode === "apply" && !input.confirmationPhraseMatched) {
    blockers.push("confirmation_phrase_missing_or_mismatch");
  }
  if (input.mode === "apply" && !input.idempotencyKeyPresent) {
    blockers.push("idempotency_key_missing");
  }
  if (input.mode === "apply" && !input.expectedCurrentDraftHtmlHashMatched) {
    blockers.push("expected_current_draft_html_hash_mismatch");
  }
  if (input.mode === "apply" && !input.expectedCandidateHtmlHashMatched) {
    blockers.push("expected_candidate_html_hash_mismatch");
  }
  if (!input.repairPreviewReady) {
    blockers.push("finance_risk_repair_preview_not_ready");
  }
  if (!input.candidateHtml.trim()) {
    blockers.push("candidate_html_missing");
  }
  if (!input.contentItem) {
    blockers.push("content_item_not_found");
  }
  if (input.contentItem && input.contentItem.status !== "planned") {
    blockers.push("content_item_status_not_planned");
  }
  if (input.contentItem && !input.contentItem.draftMarkdown?.trim()) {
    blockers.push("saved_draft_markdown_missing");
  }
  if (input.contentItem && !input.contentItem.draftHtml?.trim()) {
    blockers.push("saved_draft_html_missing");
  }
  if (input.contentItem?.publishedAt) {
    blockers.push("content_item_already_published");
  }
  if (input.contentItem?.scheduledAt) {
    blockers.push("content_item_already_scheduled");
  }
  if (input.candidateHash && input.currentDraftHtmlHash && input.candidateHash === input.currentDraftHtmlHash) {
    blockers.push("draft_html_already_matches_repair_candidate");
  }

  return blockers;
}

function buildWarnings(mode: PersistenceMode, persisted: boolean) {
  if (persisted) {
    return [
      "finance_risk_repaired_draft_html_persisted_by_explicit_gate",
      "draft_markdown_not_changed",
      "blogger_write_disabled_by_patch_policy",
      "llm_call_disabled_by_patch_policy",
      "candidate_html_body_not_returned"
    ];
  }
  const warnings = [
    "draft_html_finance_risk_repair_persistence_guard_active",
    "draft_markdown_not_changed",
    "blogger_write_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy",
    "candidate_html_body_not_returned"
  ];
  if (mode === "preview") {
    warnings.push("preview_mode_does_not_write_draft_html");
  }
  return warnings;
}

function buildSideEffectSummary(persisted: boolean): FinanceRiskRepairPersistenceSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: persisted,
    contentItemMutation: persisted,
    draftMarkdownMutation: false,
    draftHtmlMutation: persisted,
    statusMutation: false,
    qualityScoreMutation: false,
    publishedAtMutation: false,
    scheduledAtMutation: false,
    auditAttemptMutation: false,
    auditEventMutation: false,
    auditArtifactMutation: false,
    llmCall: false,
    llmCallLogMutation: false,
    bloggerRead: false,
    bloggerWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    oauthReconnect: false,
    tokenRefresh: false,
    externalSend: false
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
