import { createHash } from "crypto";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { prisma } from "@/lib/db/client";

const PATCH_VERSION = "9F-3R-FIX1";
const PREVIEW_MODE = "read_only_draft_html_finance_risk_repair_preview";

type PreviewMode = "preview" | "blocked_non_preview";

const RISKY_FINANCE_REPLACEMENTS = [
  ["수익 보장", "수익을 보장하지 않는 참고 정보"],
  ["급등 확정", "급등 가능성을 단정하지 않는 점검"],
  ["매수 추천", "매수 여부를 판단할 때 참고할 점"],
  ["매도 추천", "매도 여부를 판단할 때 참고할 점"],
  ["반드시 오른다", "상승을 단정할 수 없다"],
  ["무조건 오른다", "상승을 보장할 수 없다"],
  ["손실 없음", "손실 가능성을 함께 고려"],
  ["리스크 없음", "리스크를 함께 고려"],
  ["원금 보장", "원금 손실 가능성 확인"],
  ["수익률 예시", "성과를 보장하지 않는 참고 지표"],
  ["성공 사례", "개별 사례가 결과를 보장하지 않음"],
  ["안전하게 매수", "위험을 확인한 뒤 판단"],
  ["안전한 투자", "위험을 동반하는 투자 판단"],
  ["확실한 수익", "불확실성을 포함한 투자 결과"]
] as const;

const RISKY_FINANCE_PATTERN = new RegExp(RISKY_FINANCE_REPLACEMENTS.map(([phrase]) => escapeRegExp(phrase)).join("|"), "gi");

export interface DailyContentDraftHtmlFinanceRiskRepairPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
  includeCandidateHtml?: unknown;
}

export interface DailyContentDraftHtmlFinanceRiskRepairPreviewResponse extends DailyContentDraftHtmlFinanceRiskRepairPreviewSummary {
  checkedAt: string;
  candidateHtml: string | null;
  draftHtmlFinanceRiskRepairPreviewSummary: DailyContentDraftHtmlFinanceRiskRepairPreviewSummary;
}

export interface DailyContentDraftHtmlFinanceRiskRepairPreviewSummary {
  patchVersion: "9F-3R-FIX1";
  checked: true;
  mode: PreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  readOnly: true;
  repairPreviewImplemented: true;
  repairPreviewReady: boolean;
  targetSummary: FinanceRiskRepairTargetSummary;
  repairDetailSummary: FinanceRiskRepairDetailSummary;
  beforeQualitySummary: FinanceRiskRepairQualitySummary | null;
  afterQualitySummary: FinanceRiskRepairQualitySummary | null;
  currentSideEffectSummary: FinanceRiskRepairSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface FinanceRiskRepairTargetSummary {
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  planItemFound: boolean;
  planItemMatchesPlan: boolean | null;
  planItemMatchesContentItem: boolean | null;
  contentItemFound: boolean;
  contentStatus: string | null;
  draftMarkdownLength: number | null;
  draftMarkdownHash: string | null;
  draftHtmlLength: number | null;
  draftHtmlHash: string | null;
}

export interface FinanceRiskRepairDetailSummary {
  riskyPhraseMatches: string[];
  replacementCount: number;
  replacements: Array<{ from: string; to: string; count: number }>;
  candidateHtmlLength: number | null;
  candidateHtmlHash: string | null;
  candidateHtmlReturned: boolean;
  candidateHtmlStored: false;
  draftHtmlApplied: false;
  fullDraftMarkdownReturned: false;
}

export interface FinanceRiskRepairQualitySummary {
  ready: boolean;
  grade: "pass" | "warn" | "fail";
  scorePreview: number;
  requiredFailCount: number;
  failedRequiredCheckKeys: string[];
  warningCheckKeys: string[];
}

export interface FinanceRiskRepairSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  contentItemMutation: false;
  draftMarkdownMutation: false;
  draftHtmlMutation: false;
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

export async function buildDailyContentDraftHtmlFinanceRiskRepairPreviewResponse(
  rawRequest: DailyContentDraftHtmlFinanceRiskRepairPreviewRequest
): Promise<DailyContentDraftHtmlFinanceRiskRepairPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const [planItem, contentItem] = await Promise.all([
    request.planItemId
      ? prisma.blogDailyContentPlanItem.findUnique({
          where: { id: request.planItemId },
          select: {
            id: true,
            planId: true,
            contentItemId: true
          }
        })
      : null,
    request.contentItemId
      ? prisma.contentItem.findUnique({
          where: { id: request.contentItemId },
          include: {
            blog: true,
            brandProfile: true,
            assets: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
            }
          }
        })
      : null
  ]);
  const originalHtml = contentItem?.draftHtml ?? "";
  const repair = buildRepairCandidate(originalHtml);
  const candidateHtml = repair.candidateHtml;
  const assets = (contentItem?.assets ?? []) as unknown as ContentAssetAdmin[];
  const beforeQuality = contentItem ? buildHtmlQualityPreview(contentItem as unknown as ContentItemAdmin, assets) : null;
  const afterQuality =
    contentItem && candidateHtml
      ? buildHtmlQualityPreview({ ...(contentItem as unknown as ContentItemAdmin), draftHtml: candidateHtml }, assets)
      : null;
  const blockers = buildBlockers({
    mode: request.mode,
    planId: request.planId,
    planItem,
    contentItem,
    originalHtml,
    repair,
    afterQuality
  });
  const summary: DailyContentDraftHtmlFinanceRiskRepairPreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    readOnly: true,
    repairPreviewImplemented: true,
    repairPreviewReady: blockers.length === 0,
    targetSummary: {
      planId: request.planId,
      planItemId: request.planItemId,
      contentItemId: request.contentItemId,
      planItemFound: Boolean(planItem),
      planItemMatchesPlan: planItem && request.planId ? planItem.planId === request.planId : null,
      planItemMatchesContentItem: planItem && request.contentItemId ? planItem.contentItemId === request.contentItemId : null,
      contentItemFound: Boolean(contentItem),
      contentStatus: contentItem?.status ?? null,
      draftMarkdownLength: contentItem ? contentItem.draftMarkdown?.length ?? 0 : null,
      draftMarkdownHash: contentItem ? sha256(contentItem.draftMarkdown ?? "") : null,
      draftHtmlLength: contentItem ? contentItem.draftHtml?.length ?? 0 : null,
      draftHtmlHash: contentItem ? sha256(contentItem.draftHtml ?? "") : null
    },
    repairDetailSummary: {
      riskyPhraseMatches: repair.riskyPhraseMatches,
      replacementCount: repair.replacementCount,
      replacements: repair.replacements,
      candidateHtmlLength: candidateHtml ? candidateHtml.length : null,
      candidateHtmlHash: candidateHtml ? sha256(candidateHtml) : null,
      candidateHtmlReturned: Boolean(request.includeCandidateHtml && candidateHtml),
      candidateHtmlStored: false,
      draftHtmlApplied: false,
      fullDraftMarkdownReturned: false
    },
    beforeQualitySummary: beforeQuality ? toQualitySummary(beforeQuality) : null,
    afterQualitySummary: afterQuality ? toQualitySummary(afterQuality) : null,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: blockers,
    warnings: buildWarnings(request.includeCandidateHtml)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    candidateHtml: request.includeCandidateHtml ? candidateHtml || null : null,
    draftHtmlFinanceRiskRepairPreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftHtmlFinanceRiskRepairPreviewRequest): {
  mode: PreviewMode;
  requestedMode: string;
  planId: string | null;
  planItemId: string | null;
  contentItemId: string | null;
  includeCandidateHtml: boolean;
} {
  const requestedMode = getString(rawRequest.mode) ?? "preview";
  return {
    mode: requestedMode === "preview" ? "preview" : "blocked_non_preview",
    requestedMode,
    planId: getString(rawRequest.planId),
    planItemId: getString(rawRequest.planItemId),
    contentItemId: getString(rawRequest.contentItemId),
    includeCandidateHtml: rawRequest.includeCandidateHtml === true
  };
}

function buildRepairCandidate(html: string) {
  const matches = Array.from(new Set((html.match(RISKY_FINANCE_PATTERN) ?? []).map((match) => match.trim()).filter(Boolean)));
  const replacements = RISKY_FINANCE_REPLACEMENTS.map(([from, to]) => {
    const pattern = new RegExp(escapeRegExp(from), "gi");
    return {
      from,
      to,
      count: (html.match(pattern) ?? []).length
    };
  }).filter((item) => item.count > 0);
  const candidateHtml = replacements.reduce((current, replacement) => {
    return current.replace(new RegExp(escapeRegExp(replacement.from), "gi"), replacement.to);
  }, html);

  return {
    candidateHtml,
    riskyPhraseMatches: matches,
    replacementCount: replacements.reduce((total, item) => total + item.count, 0),
    replacements
  };
}

function buildBlockers(input: {
  mode: PreviewMode;
  planId: string | null;
  planItem: { planId: string; contentItemId: string | null } | null;
  contentItem: { id: string; status: string; draftMarkdown: string | null; draftHtml: string | null } | null;
  originalHtml: string;
  repair: ReturnType<typeof buildRepairCandidate>;
  afterQuality: ReturnType<typeof buildHtmlQualityPreview> | null;
}) {
  const blockers: string[] = [];

  if (input.mode !== "preview") {
    blockers.push("draft_html_finance_risk_repair_preview_is_read_only");
  }
  if (!input.planItem) {
    blockers.push("plan_item_not_found");
  }
  if (input.planId && input.planItem && input.planItem.planId !== input.planId) {
    blockers.push("plan_item_plan_mismatch");
  }
  if (!input.contentItem) {
    blockers.push("content_item_not_found");
  }
  if (input.contentItem && input.planItem && input.planItem.contentItemId !== input.contentItem.id) {
    blockers.push("plan_item_content_item_mismatch");
  }
  if (input.contentItem && input.contentItem.status !== "planned") {
    blockers.push("content_item_status_not_planned");
  }
  if (input.contentItem && !input.contentItem.draftMarkdown?.trim()) {
    blockers.push("saved_draft_markdown_missing");
  }
  if (!input.originalHtml.trim()) {
    blockers.push("saved_draft_html_missing");
  }
  if (input.repair.replacementCount === 0) {
    blockers.push("finance_risky_phrase_not_found");
  }
  if (input.repair.candidateHtml === input.originalHtml) {
    blockers.push("repair_candidate_unchanged");
  }
  if (!input.afterQuality?.ready) {
    blockers.push("after_quality_not_ready");
  }

  return blockers;
}

function toQualitySummary(quality: ReturnType<typeof buildHtmlQualityPreview>): FinanceRiskRepairQualitySummary {
  const failedRequiredCheckKeys = quality.checks.filter((check) => check.status === "fail" && check.severity === "required").map((check) => check.key);
  const warningCheckKeys = quality.checks.filter((check) => check.status === "warn").map((check) => check.key);

  return {
    ready: quality.ready,
    grade: quality.grade,
    scorePreview: quality.scorePreview,
    requiredFailCount: failedRequiredCheckKeys.length,
    failedRequiredCheckKeys,
    warningCheckKeys
  };
}

function buildWarnings(includeCandidateHtml: boolean) {
  const warnings = [
    "draft_html_finance_risk_repair_preview_only",
    "draft_html_not_persisted",
    "content_item_mutation_disabled",
    "blogger_api_call_disabled_by_patch_policy",
    "llm_call_disabled_by_patch_policy"
  ];
  if (!includeCandidateHtml) {
    warnings.push("candidate_html_body_not_returned_by_default");
  }
  return warnings;
}

function buildSideEffectSummary(): FinanceRiskRepairSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    contentItemMutation: false,
    draftMarkdownMutation: false,
    draftHtmlMutation: false,
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

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
