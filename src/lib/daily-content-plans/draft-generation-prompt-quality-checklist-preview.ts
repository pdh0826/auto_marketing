import {
  buildDailyContentDraftGenerationPromptRenderPreviewResponse,
  type DailyContentDraftGenerationPromptRenderPreviewResponse
} from "@/lib/daily-content-plans/draft-generation-prompt-render-preview";

const PATCH_VERSION = "9F-2S";
const PREVIEW_MODE = "read_only_draft_generation_prompt_quality_checklist_preview";
const CHECKLIST_VERSION = "daily_content_draft_generation_prompt_quality_checklist_v0";
const SOURCE_PROMPT_PREVIEW_PATCH_VERSION = "9F-2R";

type PromptQualityChecklistMode = "preview" | "blocked_non_preview";
type PromptQualityCheckStatus = "pass" | "warn" | "fail" | "not_applicable";
type PromptQualityCheckSeverity = "info" | "low" | "medium" | "high";

export interface DailyContentDraftGenerationPromptQualityChecklistPreviewRequest {
  mode?: unknown;
  planId?: unknown;
  planItemId?: unknown;
  contentItemId?: unknown;
}

export interface DailyContentDraftGenerationPromptQualityChecklistPreviewResponse
  extends DailyContentDraftGenerationPromptQualityChecklistPreviewSummary {
  checkedAt: string;
  draftGenerationPromptQualityChecklistPreviewSummary: DailyContentDraftGenerationPromptQualityChecklistPreviewSummary;
}

export interface DailyContentDraftGenerationPromptQualityChecklistPreviewSummary {
  patchVersion: "9F-2S";
  checked: true;
  mode: PromptQualityChecklistMode;
  requestedMode: string;
  previewMode: typeof PREVIEW_MODE;
  dryRunOnly: true;
  promptRenderedForChecklist: true;
  promptStored: false;
  promptSentToLlm: false;
  llmCallAttempted: false;
  providerNetworkCallAttempted: false;
  providerHealthCheckAttempted: false;
  contentMutationAttempted: false;
  targetSummary: PromptRenderSummary["targetSummary"];
  persistedApprovalSummary: PromptRenderSummary["persistedApprovalSummary"];
  executionGateSummary: PromptRenderSummary["executionGateSummary"];
  promptQualityChecklistSummary: {
    sourcePromptPreviewPatchVersion: typeof SOURCE_PROMPT_PREVIEW_PATCH_VERSION;
    promptVersion: string;
    checklistVersion: typeof CHECKLIST_VERSION;
    qualityGatePassed: boolean;
    qualityGateWouldAllowFutureExecution: false;
    totalChecks: number;
    passCount: number;
    warnCount: number;
    failCount: number;
    notApplicableCount: number;
    qualityGateBlockingReasons: string[];
    qualityWarnings: string[];
    categories: PromptQualityCategory[];
    checks: PromptQualityCheck[];
    redactionAndSecretScan: {
      scanned: true;
      passed: boolean;
      forbiddenHits: string[];
      rawSecretsIncluded: false;
      rawTokensIncluded: false;
      rawEnvValuesIncluded: false;
      oauthCredentialsIncluded: false;
      providerCredentialsIncluded: false;
    };
    lengthAndBudget: {
      promptCharLength: number;
      estimatedPromptTokens: number | null;
      promptWithinPreviewBudget: boolean;
      promptTooShort: boolean;
      promptTooLong: boolean;
    };
  };
  currentSideEffectSummary: DailyContentDraftGenerationPromptQualityChecklistSideEffectSummary;
  blockingReasons: string[];
  warnings: string[];
}

export interface PromptQualityCategory {
  key: string;
  label: string;
  status: Exclude<PromptQualityCheckStatus, "not_applicable">;
  checks: PromptQualityCheck[];
}

export interface PromptQualityCheck {
  key: string;
  label: string;
  status: PromptQualityCheckStatus;
  severity: PromptQualityCheckSeverity;
  detail: string;
  remediation: string | null;
}

export interface DailyContentDraftGenerationPromptQualityChecklistSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  envRead: true;
  secretValueExposed: false;
  promptRenderedForChecklist: true;
  promptStored: false;
  promptSentToLlm: false;
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

type PromptRenderSummary = DailyContentDraftGenerationPromptRenderPreviewResponse["draftGenerationPromptRenderPreviewSummary"];
type PromptSection = PromptRenderSummary["promptRenderPreviewSummary"]["promptSections"][number];

const REQUIRED_SECTION_KEYS = [
  "system_role_and_safety",
  "blog_context",
  "target_reader_and_tone",
  "plan_item_intent",
  "source_input_snapshot",
  "content_constraints",
  "draft_markdown_requirements",
  "seo_structure_requirements",
  "quality_and_forbidden_phrases_check",
  "output_contract"
];

export async function buildDailyContentDraftGenerationPromptQualityChecklistPreviewResponse(
  rawRequest: DailyContentDraftGenerationPromptQualityChecklistPreviewRequest
): Promise<DailyContentDraftGenerationPromptQualityChecklistPreviewResponse> {
  const checkedAt = new Date();
  const request = normalizeRequest(rawRequest);
  const promptPreviewResponse = await buildDailyContentDraftGenerationPromptRenderPreviewResponse({
    mode: "preview",
    planId: request.planId,
    planItemId: request.planItemId,
    contentItemId: request.contentItemId
  });
  const promptPreview = promptPreviewResponse.draftGenerationPromptRenderPreviewSummary;
  const promptQualityChecklistSummary = buildPromptQualityChecklist(promptPreview);
  const blockingReasons = new Set<string>(promptPreview.executionGateSummary.remainingBlockers);

  if (request.mode !== "preview") {
    blockingReasons.add("draft_generation_prompt_quality_checklist_preview_is_preview_only");
  }
  for (const reason of promptQualityChecklistSummary.qualityGateBlockingReasons) {
    blockingReasons.add(reason);
  }

  const summary: DailyContentDraftGenerationPromptQualityChecklistPreviewSummary = {
    patchVersion: PATCH_VERSION,
    checked: true,
    mode: request.mode,
    requestedMode: request.requestedMode,
    previewMode: PREVIEW_MODE,
    dryRunOnly: true,
    promptRenderedForChecklist: true,
    promptStored: false,
    promptSentToLlm: false,
    llmCallAttempted: false,
    providerNetworkCallAttempted: false,
    providerHealthCheckAttempted: false,
    contentMutationAttempted: false,
    targetSummary: promptPreview.targetSummary,
    persistedApprovalSummary: promptPreview.persistedApprovalSummary,
    executionGateSummary: {
      executionAllowed: false,
      finalDraftGenerationAllowed: false,
      remainingBlockers: promptPreview.executionGateSummary.remainingBlockers,
      resolvedBlockers: promptPreview.executionGateSummary.resolvedBlockers
    },
    promptQualityChecklistSummary,
    currentSideEffectSummary: buildSideEffectSummary(),
    blockingReasons: Array.from(blockingReasons),
    warnings: buildWarnings(request.mode, promptQualityChecklistSummary)
  };

  return {
    checkedAt: checkedAt.toISOString(),
    ...summary,
    draftGenerationPromptQualityChecklistPreviewSummary: summary
  };
}

function normalizeRequest(rawRequest: DailyContentDraftGenerationPromptQualityChecklistPreviewRequest): {
  mode: PromptQualityChecklistMode;
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

function buildPromptQualityChecklist(promptPreview: PromptRenderSummary): DailyContentDraftGenerationPromptQualityChecklistPreviewSummary["promptQualityChecklistSummary"] {
  const promptSummary = promptPreview.promptRenderPreviewSummary;
  const promptText = `${promptSummary.promptSections.map((section) => `${section.key}\n${section.title}\n${section.previewText}`).join("\n\n")}\n\n${promptSummary.fullPromptPreview}`;
  const forbiddenHits = scanForbiddenPatterns(promptText);
  const checksByCategory = [
    buildTargetContextChecks(promptPreview),
    buildRequiredSectionChecks(promptSummary.promptSections),
    buildSafetyAndPolicyChecks(promptText),
    buildSeoStructureChecks(promptText),
    buildReaderValueChecks(promptText),
    buildOutputContractChecks(promptText),
    buildRedactionChecks(promptPreview, forbiddenHits),
    buildLengthAndBudgetChecks(promptPreview),
    buildExecutionSafetyChecks(promptPreview)
  ];
  const categories = checksByCategory.map((category) => ({
    ...category,
    status: summarizeCategoryStatus(category.checks)
  }));
  const checks = categories.flatMap((category) => category.checks);
  const passCount = checks.filter((check) => check.status === "pass").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const failCount = checks.filter((check) => check.status === "fail").length;
  const notApplicableCount = checks.filter((check) => check.status === "not_applicable").length;
  const qualityGateBlockingReasons = checks
    .filter((check) => check.status === "fail")
    .map((check) => `prompt_quality_${check.key}_failed`);
  const qualityWarnings = checks
    .filter((check) => check.status === "warn")
    .map((check) => `prompt_quality_${check.key}_warning`);

  return {
    sourcePromptPreviewPatchVersion: SOURCE_PROMPT_PREVIEW_PATCH_VERSION,
    promptVersion: promptSummary.promptVersion,
    checklistVersion: CHECKLIST_VERSION,
    qualityGatePassed: failCount === 0,
    qualityGateWouldAllowFutureExecution: false,
    totalChecks: checks.length,
    passCount,
    warnCount,
    failCount,
    notApplicableCount,
    qualityGateBlockingReasons,
    qualityWarnings,
    categories,
    checks,
    redactionAndSecretScan: {
      scanned: true,
      passed: forbiddenHits.length === 0 && !promptSummary.redactionSummary.rawSecretsIncluded && !promptSummary.redactionSummary.rawTokensIncluded,
      forbiddenHits,
      rawSecretsIncluded: false,
      rawTokensIncluded: false,
      rawEnvValuesIncluded: false,
      oauthCredentialsIncluded: false,
      providerCredentialsIncluded: false
    },
    lengthAndBudget: {
      promptCharLength: promptSummary.promptCharLength,
      estimatedPromptTokens: promptSummary.estimatedPromptTokens,
      promptWithinPreviewBudget: promptSummary.promptCharLength >= 1200 && promptSummary.promptCharLength <= promptSummary.maxPreviewChars,
      promptTooShort: promptSummary.promptCharLength < 1200,
      promptTooLong: promptSummary.promptCharLength > promptSummary.maxPreviewChars
    }
  };
}

function buildTargetContextChecks(promptPreview: PromptRenderSummary) {
  const target = promptPreview.targetSummary;
  const promptText = searchablePrompt(promptPreview);
  return category("target_context", "Target context", [
    check(
      "target_ids_present",
      "Plan, plan item, and content item ids are present",
      Boolean(target.planId && target.planItemId && target.contentItemId),
      "The prompt quality checklist can identify the target plan, plan item, and linked content fixture.",
      "Render the prompt preview with planId, planItemId, and contentItemId."
    ),
    check(
      "plan_item_metadata_present",
      "Plan item metadata is present",
      includesAny(promptText, ["slot key", "topic seed", "content intent"]),
      "The prompt includes plan item intent fields for future draft generation.",
      "Include slot key, topic seed, and content intent in the prompt preview."
    ),
    check(
      "linked_fixture_planned",
      "Linked fixture is planned",
      target.linkedFixtureFound && target.linkedFixtureMatchesPlanItem && target.fixtureStatus === "planned",
      "The linked content fixture exists, matches the plan item, and is still planned.",
      "Use a planned, linked fixture before future draft generation."
    ),
    check(
      "existing_draft_not_used",
      "Existing draft fields are not used as source content",
      target.fixtureHasNoDraftMarkdown && target.fixtureHasNoDraftHtml && includesAny(promptText, ["do not reuse existing draftmarkdown", "do not reuse existing drafthtml"]),
      "The prompt explicitly avoids reusing existing draftMarkdown or draftHtml.",
      "Keep draftMarkdown/draftHtml out of the prompt source snapshot."
    )
  ]);
}

function buildRequiredSectionChecks(sections: PromptSection[]) {
  const sectionKeys = new Set(sections.map((section) => section.key));
  return category(
    "required_prompt_sections",
    "Required prompt sections",
    REQUIRED_SECTION_KEYS.map((sectionKey) =>
      check(
        `required_section_${sectionKey}`,
        `${sectionKey} section is present`,
        sectionKeys.has(sectionKey),
        `The prompt preview ${sectionKeys.has(sectionKey) ? "includes" : "does not include"} the ${sectionKey} section.`,
        `Add the ${sectionKey} section to the prompt preview.`
      )
    )
  );
}

function buildSafetyAndPolicyChecks(promptText: string) {
  return category("safety_and_policy", "Safety and policy", [
    check(
      "investment_and_sensitive_advice_guard",
      "Sensitive advice guard is present",
      includesAny(promptText, ["finance", "investment", "investment advice", "수익 보장", "매수 추천"]),
      "The prompt includes finance/investment safety constraints.",
      "Add explicit finance/investment, medical, and legal safety constraints before execution."
    ),
    check(
      "fabricated_facts_guard",
      "Fabricated facts guard is present",
      includesAny(promptText, ["fabricated facts", "unsupported numeric claims", "unverifiable"]),
      "The prompt warns against fabricated facts and unsupported claims.",
      "Add a no-fabrication and evidence caution instruction."
    ),
    check(
      "overclaiming_and_ad_guard",
      "Overclaiming and promotional risk guard is present",
      includesAny(promptText, ["guaranteed profit", "unsupported", "over", "cta informational", "과장"]),
      "The prompt constrains overclaiming and promotional tone.",
      "Add explicit guidance against exaggerated advertising and affiliate-like claims."
    ),
    check(
      "content_policy_reference",
      "Content policy reference is present",
      includesAny(promptText, ["forbidden phrases", "content policy", "금지", "권장"]),
      "The prompt references content policy and forbidden phrase constraints.",
      "Include the project content policy constraints in the prompt preview."
    )
  ]);
}

function buildSeoStructureChecks(promptText: string) {
  return category("seo_structure", "SEO structure", [
    check(
      "heading_structure_instruction",
      "Heading structure instruction is present",
      includesAny(promptText, ["h2/h3", "headings", "section structure", "h1 title"]),
      "The prompt includes heading and section structure guidance.",
      "Add H1/H2/H3 or section structure requirements."
    ),
    check(
      "faq_and_cta_instruction",
      "FAQ and CTA instruction is present",
      includesAny(promptText, ["faq", "cta"]),
      "The prompt includes FAQ and CTA expectations.",
      "Add FAQ and informational CTA requirements."
    ),
    check(
      "keyword_usage_instruction",
      "Natural keyword usage instruction is present",
      includesAny(promptText, ["target keyword", "keyword stuffing", "naturally"]),
      "The prompt asks for natural keyword use without stuffing.",
      "Add natural keyword use and keyword stuffing avoidance guidance."
    )
  ]);
}

function buildReaderValueChecks(promptText: string) {
  return category("reader_value", "Reader value", [
    check(
      "target_reader_and_tone_present",
      "Target reader and tone are present",
      includesAny(promptText, ["target reader", "tone"]),
      "The prompt includes target reader and tone context.",
      "Include target reader and tone before future execution."
    ),
    check(
      "practical_educational_value_present",
      "Practical educational value is requested",
      includesAny(promptText, ["helpful", "practical", "educational", "reader problem"]),
      "The prompt asks for useful reader-centered content.",
      "Add reader problem, practical value, and educational framing."
    ),
    check(
      "korean_blog_style_present",
      "Korean blog style context is present",
      includesAny(promptText, ["korean", "ko-kr", "한국어"]),
      "The prompt includes Korean blog context.",
      "Add Korean blog tone or locale guidance."
    )
  ]);
}

function buildOutputContractChecks(promptText: string) {
  return category("output_contract", "Output contract", [
    check(
      "markdown_output_contract",
      "Markdown output contract is present",
      includesAny(promptText, ["markdown only", "return only markdown", "markdown draft"]),
      "The prompt defines Markdown as the future output contract.",
      "Specify Markdown-only future draft output."
    ),
    check(
      "blogger_payload_excluded",
      "Blogger payload is excluded",
      includesAny(promptText, ["blogger payload", "not include", "do not include"]),
      "The prompt separates draft output from Blogger payload execution.",
      "State that the future output is not a Blogger payload."
    ),
    check(
      "debug_metadata_excluded",
      "System/debug metadata is excluded",
      includesAny(promptText, ["debug metadata", "provider credentials", "raw prompt metadata", "api keys"]),
      "The prompt excludes credentials and debug metadata.",
      "Add an output restriction against system/debug/provider metadata."
    )
  ]);
}

function buildRedactionChecks(promptPreview: PromptRenderSummary, forbiddenHits: string[]) {
  const redactionSummary = promptPreview.promptRenderPreviewSummary.redactionSummary;
  return category("redaction_and_secret_safety", "Redaction and secret safety", [
    check(
      "forbidden_token_scan_clean",
      "Forbidden token scan is clean",
      forbiddenHits.length === 0,
      forbiddenHits.length === 0 ? "No forbidden token or credential patterns were detected." : "Forbidden token-like patterns were detected by pattern key only.",
      "Remove credential-like strings from the prompt preview."
    ),
    check(
      "redaction_summary_clean",
      "Redaction summary is clean",
      !redactionSummary.rawSecretsIncluded &&
        !redactionSummary.rawTokensIncluded &&
        !redactionSummary.rawEnvValuesIncluded &&
        !redactionSummary.oauthCredentialsIncluded &&
        !redactionSummary.providerCredentialsIncluded,
      "The upstream prompt preview reports no raw secret, token, env value, or credential material.",
      "Ensure only presence booleans and safe metadata are rendered."
    )
  ]);
}

function buildLengthAndBudgetChecks(promptPreview: PromptRenderSummary) {
  const prompt = promptPreview.promptRenderPreviewSummary;
  const emptySectionCount = prompt.promptSections.filter((section) => section.charLength === 0).length;
  return category("length_and_token_budget", "Length and token budget", [
    check(
      "prompt_not_too_short",
      "Prompt is not too short",
      prompt.promptCharLength >= 1200,
      `Prompt char length is ${prompt.promptCharLength}.`,
      "Add missing context, safety, output contract, or SEO instructions."
    ),
    check(
      "prompt_within_preview_budget",
      "Prompt is within preview budget",
      prompt.promptCharLength <= prompt.maxPreviewChars,
      `Prompt char length is ${prompt.promptCharLength}; preview budget is ${prompt.maxPreviewChars}.`,
      "Shorten or split prompt sections before future execution."
    ),
    check(
      "section_lengths_non_empty",
      "Prompt sections are non-empty",
      emptySectionCount === 0,
      `${emptySectionCount} prompt sections have zero length.`,
      "Fill empty prompt sections before future execution."
    )
  ]);
}

function buildExecutionSafetyChecks(promptPreview: PromptRenderSummary) {
  const sideEffects = promptPreview.currentSideEffectSummary;
  return category("execution_safety", "Execution safety", [
    check("prompt_not_stored", "Prompt is not stored", !sideEffects.promptStored, "The prompt preview was not stored.", "Keep prompt storage disabled."),
    check("prompt_not_sent", "Prompt is not sent to an LLM", !promptPreview.promptRenderPreviewSummary.promptSentToLlm, "The prompt was not sent to an LLM.", "Keep LLM dispatch disabled."),
    check("provider_network_disabled", "Provider network call is disabled", !sideEffects.providerNetworkCall, "No provider network call occurred.", "Keep provider network calls disabled."),
    check("llm_call_disabled", "LLM call is disabled", !sideEffects.llmCall, "No LLM call occurred.", "Keep LLM calls disabled."),
    check("content_mutation_disabled", "Content mutation is disabled", !sideEffects.contentItemMutation, "No content item mutation occurred.", "Keep content item mutation disabled."),
    check("draft_mutation_disabled", "Draft mutation is disabled", !sideEffects.draftMarkdownMutation && !sideEffects.draftHtmlMutation, "No draftMarkdown/draftHtml mutation occurred.", "Keep draft field mutation disabled."),
    check("blogger_write_disabled", "Blogger write is disabled", !sideEffects.bloggerWrite, "No Blogger write occurred.", "Keep Blogger write/publish/schedule disabled.")
  ]);
}

function category(key: string, label: string, checks: PromptQualityCheck[]) {
  return {
    key,
    label,
    status: summarizeCategoryStatus(checks),
    checks
  };
}

function check(key: string, label: string, passed: boolean, detail: string, remediation: string, severity: PromptQualityCheckSeverity = "medium"): PromptQualityCheck {
  return {
    key,
    label,
    status: passed ? "pass" : "fail",
    severity,
    detail,
    remediation: passed ? null : remediation
  };
}

function summarizeCategoryStatus(checks: PromptQualityCheck[]): Exclude<PromptQualityCheckStatus, "not_applicable"> {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "warn")) {
    return "warn";
  }
  return "pass";
}

function searchablePrompt(promptPreview: PromptRenderSummary) {
  return `${promptPreview.promptRenderPreviewSummary.promptSections.map((section) => section.previewText).join("\n")}\n${promptPreview.promptRenderPreviewSummary.fullPromptPreview}`.toLowerCase();
}

function includesAny(text: string, needles: string[]) {
  const haystack = text.toLowerCase();
  return needles.some((needle) => haystack.includes(needle.toLowerCase()));
}

function scanForbiddenPatterns(promptText: string) {
  const forbiddenPatterns = [
    { key: "openai_secret_key_pattern", pattern: /sk-/ },
    { key: "bearer_token_pattern", pattern: /Bearer / },
    { key: "refresh_token_pattern", pattern: /refresh_token/i },
    { key: "access_token_pattern", pattern: /access_token/i },
    { key: "openai_api_key_assignment_pattern", pattern: /OPENAI_API_KEY=/ },
    { key: "api_key_assignment_pattern", pattern: /API_KEY=/ },
    { key: "password_assignment_pattern", pattern: /PASSWORD=/ },
    { key: "secret_assignment_pattern", pattern: /SECRET=/ },
    { key: "authorization_header_pattern", pattern: /Authorization:/ }
  ];
  return forbiddenPatterns.filter((entry) => entry.pattern.test(promptText)).map((entry) => entry.key);
}

function buildSideEffectSummary(): DailyContentDraftGenerationPromptQualityChecklistSideEffectSummary {
  return {
    dbRead: true,
    dbWrite: false,
    envRead: true,
    secretValueExposed: false,
    promptRenderedForChecklist: true,
    promptStored: false,
    promptSentToLlm: false,
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

function buildWarnings(
  mode: PromptQualityChecklistMode,
  promptQualityChecklistSummary: DailyContentDraftGenerationPromptQualityChecklistPreviewSummary["promptQualityChecklistSummary"]
) {
  const warnings = new Set<string>([
    "draft_generation_prompt_quality_checklist_preview_only",
    "llm_evaluator_disabled_by_patch_policy",
    "prompt_not_stored",
    "prompt_not_sent_to_llm",
    "content_item_mutation_disabled",
    "blogger_write_disabled"
  ]);

  if (mode !== "preview") {
    warnings.add("non_preview_mode_blocked");
  }
  for (const warning of promptQualityChecklistSummary.qualityWarnings) {
    warnings.add(warning);
  }
  return Array.from(warnings);
}
