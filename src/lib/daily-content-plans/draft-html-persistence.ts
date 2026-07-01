import { prisma } from "@/lib/db/client";
import {
  buildDailyContentDraftHtmlConversionPreviewResponse,
  type DailyContentDraftHtmlConversionPreviewResponse
} from "@/lib/daily-content-plans/draft-html-conversion-preview";

const PATCH_VERSION = "9F-3Q";
const FEATURE_FLAG_NAME = "BLOG_DAILY_CONTENT_DRAFT_HTML_PERSISTENCE_ENABLED";
const REQUIRED_CONFIRMATION_PHRASE = "I_UNDERSTAND_THIS_PERSISTS_DRAFT_HTML_ONLY_WITHOUT_BLOGGER_WRITE";

type PersistenceMode = "preview" | "apply" | "blocked_non_supported_mode";
type ConversionPreviewSummary = DailyContentDraftHtmlConversionPreviewResponse["draftHtmlConversionPreviewSummary"];

export interface DailyContentDraftHtmlPersistenceRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  expectedPreviewHtmlHash?: unknown;
  confirmationPhrase?: unknown;
  idempotencyKey?: unknown;
}

export interface DailyContentDraftHtmlPersistenceResponse extends DailyContentDraftHtmlPersistenceSummary {
  checkedAt: string;
  draftHtmlPersistenceSummary: DailyContentDraftHtmlPersistenceSummary;
}

export interface DailyContentDraftHtmlPersistenceSummary {
  patchVersion: "9F-3Q";
  checked: true;
  mode: PersistenceMode;
  requestedMode: string;
  persistenceImplemented: true;
  persistenceAllowed: boolean;
  draftHtmlPersistedNow: boolean;
  conversionPreviewSummary: ConversionPreviewSummary;
  draftHtmlPersistenceDetailSummary: DraftHtmlPersistenceDetailSummary;
  currentSideEffectSummary: DraftHtmlPersistenceSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface DraftHtmlPersistenceDetailSummary {
  featureFlagName: typeof FEATURE_FLAG_NAME;
  featureFlagEnabled: boolean;
  confirmationPhraseRequired: true;
  confirmationPhraseMatched: boolean;
  idempotencyKeyRequired: true;
  idempotencyKeyPresent: boolean;
  rawConfirmationPhraseStored: false;
  rawIdempotencyKeyStored: false;
  expectedPreviewHtmlHashMatched: boolean;
  previewHtmlHash: string | null;
  previewHtmlLength: number | null;
  contentItemId: string | null;
  contentStatusBefore: string | null;
  draftMarkdownLengthBefore: number | null;
  draftHtmlLengthBefore: number | null;
  draftMarkdownLengthAfter: number | null;
  draftHtmlLengthAfter: number | null;
  appliedField: "draftHtml" | null;
  previewHtmlReturned: false;
  fullDraftMarkdownReturned: false;
  rawPromptStoredOrReturned: false;
  rawResponseStoredOrReturned: false;
  canPersistNow: boolean;
  persistenceBlockers: string[];
}

export interface DraftHtmlPersistenceSideEffectSummary {
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
  bloggerWrite: false;
  bloggerDraftSave: false;
  bloggerPublish: false;
  scheduledPublish: false;
  oauthReconnect: false;
  tokenRefresh: false;
  externalSend: false;
}

export async function buildDailyContentDraftHtmlPersistenceResponse(
  rawRequest: DailyContentDraftHtmlPersistenceRequest
): Promise<DailyContentDraftHtmlPersistenceResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const conversionPreview = await buildDailyContentDraftHtmlConversionPreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId,
    includePreviewHtml: true
  });
  const conversionSummary = conversionPreview.draftHtmlConversionPreviewSummary;
  const previewHtml = conversionPreview.previewHtml ?? "";
  const previewHtmlHash = conversionSummary.conversionDetailSummary.previewHtmlHash;
  const featureFlagEnabled = process.env[FEATURE_FLAG_NAME] === "true";
  const confirmationPhraseMatched = request.confirmationPhrase === REQUIRED_CONFIRMATION_PHRASE;
  const idempotencyKeyPresent = Boolean(request.idempotencyKey);
  const expectedPreviewHtmlHashMatched = Boolean(request.expectedPreviewHtmlHash) && request.expectedPreviewHtmlHash === previewHtmlHash;
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
  const blockers = buildBlockers({
    mode: request.mode,
    featureFlagEnabled,
    confirmationPhraseMatched,
    idempotencyKeyPresent,
    expectedPreviewHtmlHashMatched,
    conversionPreviewReady: conversionSummary.conversionPreviewReady,
    previewHtml,
    contentItem
  });
  const canPersistNow = request.mode === "apply" && blockers.length === 0;
  let draftHtmlPersistedNow = false;
  let afterDraftMarkdownLength: number | null = beforeDraftMarkdownLength;
  let afterDraftHtmlLength: number | null = beforeDraftHtmlLength;

  if (canPersistNow && contentItem && request.contentItemId) {
    const updated = await prisma.contentItem.update({
      where: { id: request.contentItemId },
      data: {
        draftHtml: previewHtml
      },
      select: {
        draftMarkdown: true,
        draftHtml: true
      }
    });
    draftHtmlPersistedNow = true;
    afterDraftMarkdownLength = updated.draftMarkdown?.length ?? 0;
    afterDraftHtmlLength = updated.draftHtml?.length ?? 0;
  }

  const responseBlockers = draftHtmlPersistedNow ? [] : blockers;
  const summary: DailyContentDraftHtmlPersistenceSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    persistenceImplemented: true,
    persistenceAllowed: canPersistNow,
    draftHtmlPersistedNow,
    conversionPreviewSummary: {
      ...conversionSummary,
      conversionDetailSummary: {
        ...conversionSummary.conversionDetailSummary,
        previewHtmlReturned: false
      }
    },
    draftHtmlPersistenceDetailSummary: {
      featureFlagName: FEATURE_FLAG_NAME,
      featureFlagEnabled,
      confirmationPhraseRequired: true,
      confirmationPhraseMatched,
      idempotencyKeyRequired: true,
      idempotencyKeyPresent,
      rawConfirmationPhraseStored: false,
      rawIdempotencyKeyStored: false,
      expectedPreviewHtmlHashMatched,
      previewHtmlHash,
      previewHtmlLength: previewHtml ? previewHtml.length : null,
      contentItemId: contentItem?.id ?? null,
      contentStatusBefore: contentItem?.status ?? null,
      draftMarkdownLengthBefore: beforeDraftMarkdownLength,
      draftHtmlLengthBefore: beforeDraftHtmlLength,
      draftMarkdownLengthAfter: afterDraftMarkdownLength,
      draftHtmlLengthAfter: afterDraftHtmlLength,
      appliedField: draftHtmlPersistedNow ? "draftHtml" : null,
      previewHtmlReturned: false,
      fullDraftMarkdownReturned: false,
      rawPromptStoredOrReturned: false,
      rawResponseStoredOrReturned: false,
      canPersistNow,
      persistenceBlockers: responseBlockers
    },
    currentSideEffectSummary: buildSideEffectSummary(draftHtmlPersistedNow),
    blockingReasons: responseBlockers,
    warnings: buildWarnings(request.mode, draftHtmlPersistedNow)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftHtmlPersistenceSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftHtmlPersistenceRequest): {
  mode: PersistenceMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  expectedPreviewHtmlHash: string | null;
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
    expectedPreviewHtmlHash: getString(rawRequest.expectedPreviewHtmlHash),
    confirmationPhrase: getString(rawRequest.confirmationPhrase),
    idempotencyKey: getString(rawRequest.idempotencyKey)
  };
}

function buildBlockers(input: {
  mode: PersistenceMode;
  featureFlagEnabled: boolean;
  confirmationPhraseMatched: boolean;
  idempotencyKeyPresent: boolean;
  expectedPreviewHtmlHashMatched: boolean;
  conversionPreviewReady: boolean;
  previewHtml: string;
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
    blockers.push("draft_html_persistence_mode_not_supported");
  }
  if (input.mode === "apply" && !input.featureFlagEnabled) {
    blockers.push("draft_html_persistence_feature_flag_disabled");
  }
  if (input.mode === "apply" && !input.confirmationPhraseMatched) {
    blockers.push("confirmation_phrase_missing_or_mismatch");
  }
  if (input.mode === "apply" && !input.idempotencyKeyPresent) {
    blockers.push("idempotency_key_missing");
  }
  if (input.mode === "apply" && !input.expectedPreviewHtmlHashMatched) {
    blockers.push("expected_preview_html_hash_mismatch");
  }
  if (!input.conversionPreviewReady) {
    blockers.push("draft_html_conversion_preview_not_ready");
  }
  if (!input.previewHtml.trim()) {
    blockers.push("preview_html_missing");
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
  if (input.contentItem?.draftHtml?.trim()) {
    blockers.push("draft_html_already_present");
  }
  if (input.contentItem?.publishedAt) {
    blockers.push("content_item_already_published");
  }
  if (input.contentItem?.scheduledAt) {
    blockers.push("content_item_already_scheduled");
  }

  return blockers;
}

function buildWarnings(mode: PersistenceMode, persisted: boolean) {
  if (persisted) {
    return [
      "draft_html_persisted_by_explicit_gate",
      "draft_markdown_not_changed",
      "blogger_write_disabled_by_patch_policy",
      "llm_call_disabled_by_patch_policy",
      "preview_html_body_not_returned"
    ];
  }
  const warnings = [
    "draft_html_persistence_guard_active",
    "draft_markdown_not_changed",
    "blogger_write_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy",
    "preview_html_body_not_returned"
  ];
  if (mode === "preview") {
    warnings.push("preview_mode_does_not_write_draft_html");
  }
  return warnings;
}

function buildSideEffectSummary(persisted: boolean): DraftHtmlPersistenceSideEffectSummary {
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
