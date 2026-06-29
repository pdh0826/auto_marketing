import { createHash } from "crypto";
import { prisma } from "@/lib/db/client";
import {
  buildDailyContentDraftGenerationFinalExecutionChecklistResponse,
  type DailyContentDraftGenerationFinalExecutionChecklistResponse
} from "@/lib/daily-content-plans/draft-generation-final-execution-checklist";

const PATCH_VERSION = "9F-2R";
const PREVIEW_MODE = "read_only_draft_generation_prompt_render_preview";
const PROMPT_VERSION = "daily_content_draft_generation_v0_preview";
const PROMPT_PURPOSE = "daily_content_draft_generation";
const MAX_FULL_PROMPT_PREVIEW_CHARS = 8000;
const MAX_SECTION_PREVIEW_CHARS = 1800;
const MAX_INPUT_EXCERPT_CHARS = 500;

type PromptPreviewMode = "preview" | "blocked_non_preview";

export interface DailyContentDraftGenerationPromptRenderPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationPromptRenderPreviewResponse extends DailyContentDraftGenerationPromptRenderPreviewSummary {
  checkedAt: string;
  draftGenerationPromptRenderPreviewSummary: DailyContentDraftGenerationPromptRenderPreviewSummary;
}

export interface DailyContentDraftGenerationPromptRenderPreviewSummary {
  patchVersion: "9F-2R";
  checked: true;
  mode: PromptPreviewMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  dryRunOnly: true;
  promptRenderedForPreview: true;
  promptStored: false;
  llmCallAttempted: false;
  providerNetworkCallAttempted: false;
  providerHealthCheckAttempted: false;
  contentMutationAttempted: false;
  targetSummary: {
    planId: string | null;
    planItemId: string;
    contentItemId: string | null;
    linkedFixtureFound: boolean;
    linkedFixtureMatchesPlanItem: boolean;
    fixtureStatus: string | null;
    fixtureHasNoDraftMarkdown: boolean;
    fixtureHasNoDraftHtml: boolean;
  };
  persistedApprovalSummary: FinalChecklistSummary["persistedApprovalSummary"];
  executionGateSummary: {
    executionAllowed: false;
    finalDraftGenerationAllowed: false;
    remainingBlockers: string[];
    resolvedBlockers: string[];
  };
  promptRenderPreviewSummary: {
    promptVersion: typeof PROMPT_VERSION;
    promptPurpose: typeof PROMPT_PURPOSE;
    promptRenderedForPreviewOnly: true;
    fullPromptRenderedForPreview: true;
    rawPromptStored: false;
    promptSentToLlm: false;
    promptTokenEstimateAvailable: true;
    estimatedPromptTokens: number;
    promptCharLength: number;
    promptSha256: string;
    redactionApplied: boolean;
    redactionSummary: {
      rawSecretsIncluded: false;
      rawTokensIncluded: false;
      rawEnvValuesIncluded: false;
      oauthCredentialsIncluded: false;
      providerCredentialsIncluded: false;
      redactedPlaceholderCount: number;
    };
    promptSections: PromptPreviewSection[];
    fullPromptPreview: string;
    fullPromptPreviewTruncated: boolean;
    maxPreviewChars: number;
  };
  currentSideEffectSummary: DailyContentDraftGenerationPromptRenderPreviewSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface PromptPreviewSection {
  key: string;
  title: string;
  included: true;
  charLength: number;
  previewText: string;
}

export interface DailyContentDraftGenerationPromptRenderPreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  promptRenderedForPreview: true;
  promptStored: false;
  providerHealthChecked: false;
  providerNetworkCall: false;
  llmCall: false;
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

type FinalChecklistSummary = DailyContentDraftGenerationFinalExecutionChecklistResponse["draftGenerationFinalExecutionChecklistSummary"];

export async function buildDailyContentDraftGenerationPromptRenderPreviewResponse(
  rawRequest: DailyContentDraftGenerationPromptRenderPreviewRequest
): Promise<DailyContentDraftGenerationPromptRenderPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const finalChecklistResponse = await buildDailyContentDraftGenerationFinalExecutionChecklistResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const finalChecklist = finalChecklistResponse.draftGenerationFinalExecutionChecklistSummary;
  const promptInput = await loadPromptInputSnapshot({
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId ?? finalChecklist.targetSummary.contentItemId
  });
  const renderedPrompt = renderPromptPreview(promptInput);
  const blockingReasons = new Set<string>(finalChecklist.executionGateSummary.remainingBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_prompt_render_preview_is_preview_only");
  }

  const summary: DailyContentDraftGenerationPromptRenderPreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    dryRunOnly: true,
    promptRenderedForPreview: true,
    promptStored: false,
    llmCallAttempted: false,
    providerNetworkCallAttempted: false,
    providerHealthCheckAttempted: false,
    contentMutationAttempted: false,
    targetSummary: {
      planId: finalChecklist.targetSummary.planId,
      planItemId: finalChecklist.targetSummary.planItemId,
      contentItemId: finalChecklist.targetSummary.contentItemId,
      linkedFixtureFound: finalChecklist.targetSummary.linkedFixtureFound,
      linkedFixtureMatchesPlanItem: finalChecklist.targetSummary.linkedFixtureMatchesPlanItem,
      fixtureStatus: finalChecklist.targetSummary.fixtureStatus,
      fixtureHasNoDraftMarkdown: finalChecklist.targetSummary.fixtureHasNoDraftMarkdown,
      fixtureHasNoDraftHtml: finalChecklist.targetSummary.fixtureHasNoDraftHtml
    },
    persistedApprovalSummary: finalChecklist.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: finalChecklist.executionGateSummary.remainingBlockers,
      resolvedBlockers: finalChecklist.executionGateSummary.resolvedBlockers
    },
    promptRenderPreviewSummary: renderedPrompt,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: Array.from(blockingReasons),
    warnings: buildWarnings(request.mode, renderedPrompt)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationPromptRenderPreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationPromptRenderPreviewRequest): {
  mode: PromptPreviewMode;
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

async function loadPromptInputSnapshot(input: { planId: string | null; planItemId: string | null; contentItemId: string | null }) {
  const planItem = input.planItemId
    ? await prisma.blogDailyContentPlanItem.findUnique({
        where: { id: input.planItemId },
        include: {
          plan: true
        }
      })
    : null;
  const linkedContentItemId = input.contentItemId ?? planItem?.contentItemId ?? null;
  const contentItem = linkedContentItemId
    ? await prisma.contentItem.findUnique({
        where: { id: linkedContentItemId },
        select: {
          id: true,
          mode: true,
          status: true,
          title: true,
          targetKeyword: true,
          sourceMemo: true,
          planJson: true,
          blog: {
            select: {
              name: true,
              url: true,
              mainTopic: true,
              subTopics: true,
              targetReader: true,
              tone: true,
              locale: true,
              forbiddenPhrases: true,
              preferredPhrases: true,
              defaultContentLength: true,
              defaultCtaStrength: true
            }
          },
          brandProfile: {
            select: {
              name: true,
              serviceName: true,
              shortDescription: true,
              targetUsers: true,
              coreFeatures: true,
              problemsSolved: true,
              mainUrl: true,
              ctaWeak: true,
              ctaNormal: true,
              ctaStrong: true,
              forbiddenPhrases: true,
              preferredPhrases: true,
              riskDisclaimer: true
            }
          }
        }
      })
    : null;
  const operationProfile = planItem?.plan.operationProfileId
    ? await prisma.blogOperationProfile.findUnique({
        where: { id: planItem.plan.operationProfileId },
        select: {
          id: true,
          profileName: true,
          status: true,
          operationMode: true,
          defaultPublishPolicyPreset: true,
          timezone: true,
          allowAutoPublish: true,
          allowScheduledPublish: true,
          requireFinalHumanApproval: true,
          requireExternalWriteRiskAck: true,
          requireReadbackAfterPublish: true,
          requirePostPublishReconciliation: true,
          targetBloggerBlogName: true,
          targetBloggerBlogUrl: true
        }
      })
    : null;

  return {
    requestedPlanId: input.planId,
    planItem,
    contentItem,
    operationProfile
  };
}

function renderPromptPreview(input: Awaited<ReturnType<typeof loadPromptInputSnapshot>>): DailyContentDraftGenerationPromptRenderPreviewSummary["promptRenderPreviewSummary"] {
  const rawSections = buildRawPromptSections(input);
  let redactedPlaceholderCount = 0;
  const promptSections = rawSections.map((section) => {
    const redacted = sanitizePromptPreview(section.previewText);
    redactedPlaceholderCount += redacted.redactedPlaceholderCount;
    const previewText = truncateText(redacted.sanitized, MAX_SECTION_PREVIEW_CHARS);
    return {
      key: section.key,
      title: section.title,
      included: true as const,
      charLength: redacted.sanitized.length,
      previewText
    };
  });
  const fullPrompt = promptSections.map((section) => `## ${section.title}\n${section.previewText}`).join("\n\n");
  const finalRedacted = sanitizePromptPreview(fullPrompt);
  redactedPlaceholderCount += finalRedacted.redactedPlaceholderCount;
  const fullPromptPreview = truncateText(finalRedacted.sanitized, MAX_FULL_PROMPT_PREVIEW_CHARS);

  return {
    promptVersion: PROMPT_VERSION,
    promptPurpose: PROMPT_PURPOSE,
    promptRenderedForPreviewOnly: true,
    fullPromptRenderedForPreview: true,
    rawPromptStored: false,
    promptSentToLlm: false,
    promptTokenEstimateAvailable: true,
    estimatedPromptTokens: estimateTokens(finalRedacted.sanitized),
    promptCharLength: finalRedacted.sanitized.length,
    promptSha256: sha256(finalRedacted.sanitized),
    redactionApplied: redactedPlaceholderCount > 0,
    redactionSummary: {
      rawSecretsIncluded: false,
      rawTokensIncluded: false,
      rawEnvValuesIncluded: false,
      oauthCredentialsIncluded: false,
      providerCredentialsIncluded: false,
      redactedPlaceholderCount
    },
    promptSections,
    fullPromptPreview,
    fullPromptPreviewTruncated: finalRedacted.sanitized.length > MAX_FULL_PROMPT_PREVIEW_CHARS,
    maxPreviewChars: MAX_FULL_PROMPT_PREVIEW_CHARS
  };
}

function buildRawPromptSections(input: Awaited<ReturnType<typeof loadPromptInputSnapshot>>) {
  const planItem = input.planItem;
  const plan = planItem?.plan ?? null;
  const contentItem = input.contentItem;
  const blog = contentItem?.blog ?? null;
  const brand = contentItem?.brandProfile ?? null;
  const operationProfile = input.operationProfile;
  const planJsonSummary = summarizeJson(contentItem?.planJson);
  const itemPlanJsonSummary = summarizeJson(planItem?.itemPlanJson);
  const policySnapshotSummary = summarizeJson(plan?.policySnapshotJson);
  const guardrailSummary = summarizeJson(plan?.guardrailJson);

  return [
    {
      key: "system_role_and_safety",
      title: "System role and safety",
      previewText: [
        "You are a helpful Korean blog draft writer for Blog Growth Agent.",
        "Create original, people-first informational draft Markdown only when a future execution gate explicitly allows LLM execution.",
        "Do not copy competitor articles sentence-by-sentence or rewrite them with near-identical phrasing.",
        "For finance or investment-related content, never claim guaranteed profit, safe investing, buy/sell recommendations, success stories, or outcomes without risk.",
        "This 9F-2R preview renders the instruction only. It must not generate a draft body, store a prompt, call a provider, or mutate content."
      ].join("\n")
    },
    {
      key: "blog_context",
      title: "Blog context",
      previewText: [
        `Target Blogger blog name: ${safeValue(plan?.targetBloggerBlogName ?? operationProfile?.targetBloggerBlogName ?? "unknown")}`,
        `Target Blogger blog URL: ${safeValue(plan?.targetBloggerBlogUrl ?? operationProfile?.targetBloggerBlogUrl ?? "unknown")}`,
        `Plan date local: ${safeValue(plan?.planDateLocal ?? "unknown")}`,
        `Timezone: ${safeValue(plan?.timezone ?? operationProfile?.timezone ?? "Asia/Seoul")}`,
        `Operation mode: ${safeValue(plan?.operationMode ?? operationProfile?.operationMode ?? "approval_required")}`,
        `Publish policy preset: ${safeValue(plan?.defaultPublishPolicyPreset ?? operationProfile?.defaultPublishPolicyPreset ?? "safe_manual_publish")}`,
        `Blog profile name: ${safeValue(blog?.name ?? "not linked")}`,
        `Blog main topic: ${safeValue(blog?.mainTopic ?? "not specified")}`,
        `Blog subtopics: ${safeList(blog?.subTopics)}`,
        `Locale: ${safeValue(blog?.locale ?? "ko-KR")}`
      ].join("\n")
    },
    {
      key: "target_reader_and_tone",
      title: "Target reader and tone",
      previewText: [
        `Target reader: ${safeValue(planItem?.audienceHint ?? blog?.targetReader ?? "general Korean reader")}`,
        `Tone: ${safeValue(blog?.tone ?? "clear, practical, neutral")}`,
        `Default content length hint: ${safeValue(blog?.defaultContentLength ?? "not specified")}`,
        `CTA strength: ${safeValue(blog?.defaultCtaStrength ?? "normal")}`,
        `Brand/service: ${safeValue(brand?.serviceName ?? brand?.name ?? "not linked")}`,
        `Brand short description: ${safeValue(brand?.shortDescription ?? "not provided")}`,
        `Target users: ${safeList(brand?.targetUsers)}`,
        `Core features: ${safeList(brand?.coreFeatures)}`,
        `Problems solved: ${safeList(brand?.problemsSolved)}`
      ].join("\n")
    },
    {
      key: "plan_item_intent",
      title: "Plan item intent",
      previewText: [
        `Plan id: ${safeValue(plan?.id ?? input.requestedPlanId ?? "unknown")}`,
        `Plan item id: ${safeValue(planItem?.id ?? "unknown")}`,
        `Content item id: ${safeValue(contentItem?.id ?? "unknown")}`,
        `Plan item order: ${safeValue(planItem?.itemOrder ?? "unknown")}`,
        `Slot key: ${safeValue(planItem?.slotKey ?? "unknown")}`,
        `Topic seed: ${safeValue(planItem?.topicSeed ?? contentItem?.targetKeyword ?? "unknown")}`,
        `Content intent: ${safeValue(planItem?.contentIntent ?? contentItem?.mode ?? "unknown")}`,
        `Risk note: ${safeValue(planItem?.riskNote ?? "none")}`,
        `Content item title: ${safeValue(contentItem?.title ?? "not set")}`,
        `Target keyword: ${safeValue(contentItem?.targetKeyword ?? "not set")}`
      ].join("\n")
    },
    {
      key: "source_input_snapshot",
      title: "Source input snapshot",
      previewText: [
        "Use only safe planning metadata and source notes as future draft inputs.",
        "Do not reuse existing draftMarkdown or draftHtml as source material.",
        `Source memo excerpt: ${safeExcerpt(contentItem?.sourceMemo)}`,
        `Saved planJson summary: ${planJsonSummary}`,
        `Plan item itemPlanJson summary: ${itemPlanJsonSummary}`,
        `Policy snapshot summary: ${policySnapshotSummary}`,
        `Guardrail summary: ${guardrailSummary}`
      ].join("\n")
    },
    {
      key: "content_constraints",
      title: "Content constraints",
      previewText: [
        "Write helpful, original, reviewable content.",
        "Avoid unsupported numeric claims, fabricated facts, or unverifiable performance statements.",
        "Financial/investment topics must be framed as reference information, not investment advice.",
        `Forbidden phrases from content policy: ${safeList([
          "무조건 매수",
          "급등 확정",
          "수익 보장",
          "지금 사야 함",
          "손실 없음",
          "100% 적중",
          "매수 추천",
          "매도 추천",
          "원금 보장",
          "리스크 없음",
          "안전하게 매수",
          "안전한 투자",
          "확실한 수익",
          "수익률 예시",
          "성공 사례"
        ])}`,
        `Blog forbidden phrases: ${safeList(blog?.forbiddenPhrases)}`,
        `Brand forbidden phrases: ${safeList(brand?.forbiddenPhrases)}`,
        `Preferred neutral phrases: ${safeList([
          "참고할 수 있습니다.",
          "판단 보조 자료입니다.",
          "여러 지표를 함께 확인할 수 있습니다.",
          "투자 판단 전 리스크를 확인해야 합니다.",
          "서비스 기능 확인하기",
          "최종 투자 판단은 사용자가 직접 해야 합니다"
        ])}`
      ].join("\n")
    },
    {
      key: "draft_markdown_requirements",
      title: "Draft Markdown requirements",
      previewText: [
        "Future output must be Markdown only.",
        "Use one H1 title, clear H2/H3 sections, concise paragraphs, a practical CTA, and a short risk/disclaimer note when relevant.",
        "Include FAQ when the saved plan indicates FAQ-like intent.",
        "Do not include raw HTML, script, iframe, local file paths, storage paths, or Blogger payload fields.",
        "Do not write draftMarkdown or draftHtml during this preview."
      ].join("\n")
    },
    {
      key: "seo_structure_requirements",
      title: "SEO structure requirements",
      previewText: [
        "Open with the reader problem and search intent.",
        "Use headings that make scanning easy.",
        "Mention the target keyword naturally, without stuffing.",
        "Keep CTA informational and review-oriented.",
        `Preferred phrases from blog profile: ${safeList(blog?.preferredPhrases)}`,
        `Preferred phrases from brand profile: ${safeList(brand?.preferredPhrases)}`,
        `Brand risk disclaimer: ${safeValue(brand?.riskDisclaimer ?? "not provided")}`
      ].join("\n")
    },
    {
      key: "quality_and_forbidden_phrases_check",
      title: "Quality and forbidden phrases check",
      previewText: [
        "Before any future draft is saved, validate section structure, CTA balance, financial safety wording, FAQ presence when required, and HTML/draft length readiness.",
        "Block drafts containing serious investment-risk phrases or unsafe recommendations.",
        "Warnings should remain visible to the operator and should not be silently overridden.",
        "Manual review remains required before Blogger draft save and publish."
      ].join("\n")
    },
    {
      key: "output_contract",
      title: "Output contract",
      previewText: [
        "Future LLM execution, if separately approved, should return only Markdown draft text.",
        "Do not return JSON unless the future execution patch explicitly changes the contract.",
        "Do not include provider credentials, OAuth credential material, API keys, env values, raw prompt metadata, or Blogger write instructions.",
        "This preview stops before LLM dispatch and before content mutation."
      ].join("\n")
    }
  ];
}

function safeValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value).replace(/\s+/g, " ").trim();
}

function safeList(values: unknown) {
  if (!Array.isArray(values) || values.length === 0) {
    return "-";
  }
  return values.map((value) => safeValue(value)).filter(Boolean).join(", ");
}

function safeExcerpt(value: string | null | undefined) {
  if (!value?.trim()) {
    return "-";
  }
  return truncateText(value.replace(/\s+/g, " ").trim(), MAX_INPUT_EXCERPT_CHARS);
}

function summarizeJson(value: unknown) {
  if (!value || typeof value !== "object") {
    return "not provided";
  }
  if (Array.isArray(value)) {
    return `array length ${value.length}`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return keys.length ? `object keys: ${keys.slice(0, 20).join(", ")}${keys.length > 20 ? ", ..." : ""}` : "empty object";
}

function sanitizePromptPreview(input: string): { sanitized: string; redactionApplied: boolean; redactedPlaceholderCount: number } {
  const patterns = [
    /\bsk-[A-Za-z0-9_-]{12,}\b/g,
    /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
    /\b(OPENAI_API_KEY|API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|SECRET|PASSWORD|AUTHORIZATION)\s*[:=]\s*[^\s,;)}\]]+/gi,
    /\b(client_secret|access_token|refresh_token|id_token)\b\s*[:=]\s*[^\s,;)}\]]+/gi,
    /https?:\/\/[^\s]+[?&](key|token|secret|access_token|refresh_token)=[^\s]+/gi
  ];
  let sanitized = input;
  let redactedPlaceholderCount = 0;

  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, () => {
      redactedPlaceholderCount += 1;
      return "[REDACTED]";
    });
  }

  return {
    sanitized,
    redactionApplied: redactedPlaceholderCount > 0,
    redactedPlaceholderCount
  };
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n[TRUNCATED_FOR_PREVIEW]`;
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildSideEffectSummary(): DailyContentDraftGenerationPromptRenderPreviewSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    promptRenderedForPreview: true,
    promptStored: false,
    providerHealthChecked: false,
    providerNetworkCall: false,
    llmCall: false,
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

function buildWarnings(
  mode: PromptPreviewMode,
  promptRenderPreviewSummary: DailyContentDraftGenerationPromptRenderPreviewSummary["promptRenderPreviewSummary"]
) {
  const warnings = new Set<string>([
    "draft_generation_prompt_render_preview_only",
    "prompt_not_stored",
    "prompt_not_sent_to_llm",
    "llm_completion_disabled_by_patch_policy",
    "provider_network_call_disabled_by_patch_policy",
    "content_item_mutation_disabled",
    "blogger_write_disabled"
  ]);

  if (mode !== "preview") {
    warnings.add("non_preview_mode_blocked");
  }
  if (promptRenderPreviewSummary.fullPromptPreviewTruncated) {
    warnings.add("full_prompt_preview_truncated");
  }
  return Array.from(warnings);
}
