import { createHash } from "crypto";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import type { DraftMediaMapping, DraftPromptPreview } from "@/lib/content/draft-preview";
import { safeErrorMessage } from "@/lib/llm/redaction";

export interface LocalSectionedDraftCallResult {
  text: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responseSummary: string;
}

export interface LocalSectionedDraftStepSummary {
  stepKey: string;
  sectionKey: string | null;
  status: "success" | "failed" | "fallback";
  durationMs: number;
  promptHash: string | null;
  responseHash: string | null;
  responseLength: number;
  retryCount: number;
  errorMessage: string | null;
}

export interface LocalSectionedDraftMetadata {
  sectionCount: number;
  sectionKeys: string[];
  finalPolishApplied: boolean;
  finalPolishInputTooLong: boolean;
  finalPolishFallbackReason: string | null;
  fallbackUsed: boolean;
  fallbackReasons: string[];
  stepSummaries: LocalSectionedDraftStepSummary[];
  faqRequired: boolean;
  faqSectionDetected: boolean;
  faqFallbackAppended: boolean;
  faqCount: number;
  safetyScrubApplied: boolean;
  safetyScrubCount: number;
  safetyScrubCodes: string[];
  timeoutPolicy: string;
  overallTimeoutMs: number;
  stepTimeoutMs: number;
  skeletonTimeoutMs: number;
  sectionTimeoutMs: number;
  finalPolishTimeoutMs: number;
  repairTimeoutMs: number;
}

export interface LocalSectionedDraftResult {
  candidateDraftMarkdown: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responseSummary: string;
  metadata: LocalSectionedDraftMetadata;
}

export type LocalSectionedDraftProviderCall = (input: {
  prompt: DraftPromptPreview;
  temperature: number | null;
  maxTokens: number | null;
  timeoutSeconds: number | null;
}) => Promise<LocalSectionedDraftCallResult>;

interface LocalSectionedDraftInput {
  contentItem: ContentItemAdmin;
  assets: ContentAssetAdmin[];
  planJson: Record<string, unknown>;
  mediaMapping: DraftMediaMapping[];
  callProvider: LocalSectionedDraftProviderCall;
  temperature: number | null;
  maxTokens: number | null;
}

interface SkeletonSection {
  key: string;
  heading: string;
  goal: string;
}

interface SkeletonPlan {
  title: string;
  sections: SkeletonSection[];
}

interface FaqItem {
  question: string;
  answer: string;
}

export interface LocalSectionedSafetyScrubResult {
  markdown: string;
  scrubApplied: boolean;
  scrubCount: number;
  scrubCodes: string[];
}

const FINAL_POLISH_MAX_INPUT_CHARS = 8500;

export const LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY = {
  timeoutPolicy: "local_sectioned_multi_pass_cold_start_extended",
  overallTimeoutMs: 1_200_000,
  skeletonTimeoutMs: 600_000,
  sectionTimeoutMs: 300_000,
  stepTimeoutMs: 300_000,
  finalPolishTimeoutMs: 600_000,
  repairTimeoutMs: 600_000
} as const;

const LOCAL_SECTIONED_SAFETY_PHRASE_REPLACEMENTS = [
  { phrase: "투자의 성공이나 손실", replacement: "투자 결과나 손실", code: "success_outcome_phrase" },
  { phrase: "투자의 성공", replacement: "투자 결과", code: "success_outcome_phrase" },
  { phrase: "성공이나 손실", replacement: "결과나 손실", code: "success_outcome_phrase" },
  { phrase: "성공적인 투자", replacement: "신중한 투자 판단", code: "success_promise_phrase" },
  { phrase: "성공 사례", replacement: "활용 예시", code: "success_story_phrase" },
  { phrase: "더 안전한 투자 결정", replacement: "더 신중한 판단", code: "investment_safe_phrase" },
  { phrase: "안전한 투자 결정", replacement: "신중한 투자 판단", code: "investment_safe_phrase" },
  { phrase: "안전한 투자", replacement: "신중한 투자 판단", code: "investment_safe_phrase" },
  { phrase: "안전하게 매수", replacement: "신중하게 검토", code: "safe_buy_phrase" },
  { phrase: "수익 보장", replacement: "성과를 단정하지 않음", code: "guaranteed_profit_phrase" },
  { phrase: "확실한 수익", replacement: "확정되지 않은 투자 결과", code: "guaranteed_profit_phrase" },
  { phrase: "급등 확정", replacement: "변동 가능성", code: "guaranteed_movement_phrase" },
  { phrase: "반드시 오른다", replacement: "변동 가능성이 있다", code: "guaranteed_movement_phrase" },
  { phrase: "무조건 오른다", replacement: "변동 가능성이 있다", code: "guaranteed_movement_phrase" },
  { phrase: "매수 추천", replacement: "매수 판단 참고", code: "buy_sell_recommendation_phrase" },
  { phrase: "매도 추천", replacement: "매도 판단 참고", code: "buy_sell_recommendation_phrase" },
  { phrase: "원금 보장", replacement: "원금 손실 가능성 안내", code: "principal_guarantee_phrase" },
  { phrase: "손실 없음", replacement: "손실 가능성 확인", code: "risk_free_phrase" },
  { phrase: "리스크 없음", replacement: "리스크 확인 필요", code: "risk_free_phrase" },
  { phrase: "수익률 예시", replacement: "성과 지표 예시", code: "return_example_phrase" },
  { phrase: "수익률", replacement: "성과 지표", code: "return_rate_phrase" },
  { phrase: "무료 체험", replacement: "기능 살펴보기", code: "aggressive_cta_phrase" },
  { phrase: "지금 시작", replacement: "공식 페이지에서 확인", code: "aggressive_cta_phrase" },
  { phrase: "신뢰할 수 있는 투자", replacement: "참고용 투자 정보", code: "trust_investment_phrase" },
  { phrase: "매수 타이밍을 잡다", replacement: "매수 시점 판단에 참고하다", code: "timing_advice_phrase" },
  { phrase: "더 유리합니다", replacement: "판단에 도움이 될 수 있습니다", code: "advantage_claim_phrase" },
  { phrase: "성공", replacement: "결과", code: "success_promise_phrase" }
] as const;

export async function generateLocalSectionedDraftCandidate(input: LocalSectionedDraftInput): Promise<LocalSectionedDraftResult> {
  const stepSummaries: LocalSectionedDraftStepSummary[] = [];
  const fallbackReasons: string[] = [];
  let totalLatencyMs = 0;
  let totalInputTokens: number | null = null;
  let totalOutputTokens: number | null = null;
  const faqItems = getFaqItems(input.planJson);
  const overallDeadlineMs = Date.now() + LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.overallTimeoutMs;

  const skeletonPrompt = buildSkeletonPrompt(input);
  const skeletonCall = await runStepCall({
    stepKey: "skeleton",
    sectionKey: null,
    prompt: skeletonPrompt,
    temperature: Math.min(input.temperature ?? 0.2, 0.2),
    maxTokens: Math.min(input.maxTokens ?? 900, 900),
    callProvider: input.callProvider,
    stepSummaries,
    stepTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.skeletonTimeoutMs,
    overallDeadlineMs
  });
  totalLatencyMs += skeletonCall.latencyMs;
  totalInputTokens = sumNullableTokens(totalInputTokens, skeletonCall.inputTokens);
  totalOutputTokens = sumNullableTokens(totalOutputTokens, skeletonCall.outputTokens);

  const skeleton = ensureFaqSkeletonSection(parseSkeletonPlan(skeletonCall.text, input), faqItems);
  const previousSectionSummaries: string[] = [];
  const sectionFragments: string[] = [];

  for (const section of skeleton.sections) {
    const sectionResult = await generateSectionWithRetry({
      section,
      skeleton,
      previousSectionSummaries,
      input,
      stepSummaries,
      overallDeadlineMs
    });
    totalLatencyMs += sectionResult.latencyMs;
    totalInputTokens = sumNullableTokens(totalInputTokens, sectionResult.inputTokens);
    totalOutputTokens = sumNullableTokens(totalOutputTokens, sectionResult.outputTokens);
    if (sectionResult.fallbackReason) {
      fallbackReasons.push(sectionResult.fallbackReason);
    }
    sectionFragments.push(sectionResult.text);
    previousSectionSummaries.push(summarizeSectionForNextPrompt(section.key, sectionResult.text));
  }

  const assembledDraft = assembleDraftMarkdown({
    title: skeleton.title,
    fragments: sectionFragments,
    mediaMapping: input.mediaMapping,
    contentItem: input.contentItem
  });

  let candidateDraftMarkdown = assembledDraft;
  let finalPolishApplied = false;
  let finalPolishInputTooLong = false;
  let finalPolishFallbackReason: string | null = null;

  if (assembledDraft.length > FINAL_POLISH_MAX_INPUT_CHARS) {
    finalPolishInputTooLong = true;
    finalPolishFallbackReason = "final_polish_input_too_long";
    fallbackReasons.push(finalPolishFallbackReason);
  } else {
    const finalPolishPrompt = buildFinalPolishPrompt(input, assembledDraft);
    try {
      const polishCall = await runStepCall({
        stepKey: "final_polish",
        sectionKey: null,
        prompt: finalPolishPrompt,
        temperature: Math.min(input.temperature ?? 0.2, 0.2),
        maxTokens: input.maxTokens,
        callProvider: input.callProvider,
        stepSummaries,
        stepTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.finalPolishTimeoutMs,
        overallDeadlineMs
      });
      totalLatencyMs += polishCall.latencyMs;
      totalInputTokens = sumNullableTokens(totalInputTokens, polishCall.inputTokens);
      totalOutputTokens = sumNullableTokens(totalOutputTokens, polishCall.outputTokens);
      candidateDraftMarkdown = normalizeFinalMarkdown(polishCall.text, skeleton.title, input.mediaMapping);
      finalPolishApplied = true;
    } catch (error) {
      finalPolishFallbackReason = "final_polish_failed";
      fallbackReasons.push(finalPolishFallbackReason);
      stepSummaries.push({
        stepKey: "final_polish",
        sectionKey: null,
        status: "failed",
        durationMs: 0,
        promptHash: hashText(finalPolishPrompt.system + "\n" + finalPolishPrompt.user + "\n" + finalPolishPrompt.outputFormat),
        responseHash: null,
        responseLength: 0,
        retryCount: 0,
        errorMessage: safeErrorMessage(error instanceof Error ? error.message : "final polish failed", 160)
      });
    }
  }

  const faqGuardResult = ensureFaqSection(candidateDraftMarkdown, faqItems);
  candidateDraftMarkdown = faqGuardResult.markdown;
  if (faqGuardResult.fallbackAppended) {
    fallbackReasons.push("faq_fallback_appended");
    stepSummaries.push({
      stepKey: "faq_fallback_append",
      sectionKey: "faq",
      status: "fallback",
      durationMs: 0,
      promptHash: null,
      responseHash: hashText(faqGuardResult.appendedMarkdown ?? ""),
      responseLength: faqGuardResult.appendedMarkdown?.length ?? 0,
      retryCount: 0,
      errorMessage: null
    });
  }
  const safetyScrubResult = scrubLocalSectionedDraftSafetyPhrases(candidateDraftMarkdown);
  candidateDraftMarkdown = safetyScrubResult.markdown;
  if (safetyScrubResult.scrubApplied) {
    stepSummaries.push({
      stepKey: "safety_phrase_scrub",
      sectionKey: null,
      status: "success",
      durationMs: 0,
      promptHash: null,
      responseHash: hashText(candidateDraftMarkdown),
      responseLength: candidateDraftMarkdown.length,
      retryCount: 0,
      errorMessage: null
    });
  }

  return {
    candidateDraftMarkdown,
    latencyMs: totalLatencyMs,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    responseSummary: finalPolishApplied ? "local_sectioned_final_polish_received" : "local_sectioned_assembled_fallback",
    metadata: {
      sectionCount: skeleton.sections.length,
      sectionKeys: skeleton.sections.map((section) => section.key),
      finalPolishApplied,
      finalPolishInputTooLong,
      finalPolishFallbackReason,
      fallbackUsed: fallbackReasons.length > 0,
      fallbackReasons,
      stepSummaries,
      faqRequired: faqItems.length > 0,
      faqSectionDetected: faqGuardResult.detectedAfter,
      faqFallbackAppended: faqGuardResult.fallbackAppended,
      faqCount: faqItems.length,
      safetyScrubApplied: safetyScrubResult.scrubApplied,
      safetyScrubCount: safetyScrubResult.scrubCount,
      safetyScrubCodes: safetyScrubResult.scrubCodes,
      timeoutPolicy: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.timeoutPolicy,
      overallTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.overallTimeoutMs,
      stepTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.stepTimeoutMs,
      skeletonTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.skeletonTimeoutMs,
      sectionTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.sectionTimeoutMs,
      finalPolishTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.finalPolishTimeoutMs,
      repairTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.repairTimeoutMs
    }
  };
}

async function generateSectionWithRetry(input: {
  section: SkeletonSection;
  skeleton: SkeletonPlan;
  previousSectionSummaries: string[];
  input: LocalSectionedDraftInput;
  stepSummaries: LocalSectionedDraftStepSummary[];
  overallDeadlineMs: number;
}) {
  const prompt = buildSectionPrompt(input.input, input.skeleton, input.section, input.previousSectionSummaries);
  try {
    const result = await runStepCall({
      stepKey: "section_generation",
      sectionKey: input.section.key,
      prompt,
      temperature: input.input.temperature,
      maxTokens: Math.min(input.input.maxTokens ?? 1200, 1400),
      callProvider: input.input.callProvider,
      stepSummaries: input.stepSummaries,
      stepTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.sectionTimeoutMs,
      overallDeadlineMs: input.overallDeadlineMs
    });
    return { ...result, text: normalizeSectionMarkdown(result.text), fallbackReason: null };
  } catch {
    try {
      const retryPrompt = buildSectionPrompt(input.input, input.skeleton, input.section, input.previousSectionSummaries, true);
      const retryResult = await runStepCall({
        stepKey: "section_generation_retry",
        sectionKey: input.section.key,
        prompt: retryPrompt,
        temperature: Math.min(input.input.temperature ?? 0.2, 0.2),
        maxTokens: Math.min(input.input.maxTokens ?? 1000, 1100),
        callProvider: input.input.callProvider,
        stepSummaries: input.stepSummaries,
        retryCount: 1,
        stepTimeoutMs: LOCAL_SECTIONED_DRAFT_TIMEOUT_POLICY.sectionTimeoutMs,
        overallDeadlineMs: input.overallDeadlineMs
      });
      return { ...retryResult, text: normalizeSectionMarkdown(retryResult.text), fallbackReason: null };
    } catch (retryError) {
      const fallbackText = buildFallbackSection(input.section, input.input.contentItem);
      input.stepSummaries.push({
        stepKey: "section_generation_fallback",
        sectionKey: input.section.key,
        status: "fallback",
        durationMs: 0,
        promptHash: null,
        responseHash: hashText(fallbackText),
        responseLength: fallbackText.length,
        retryCount: 1,
        errorMessage: safeErrorMessage(retryError instanceof Error ? retryError.message : "section generation fallback used", 160)
      });
      return {
        text: fallbackText,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
        responseSummary: "section_fallback_used",
        fallbackReason: `section_fallback:${input.section.key}`
      };
    }
  }
}

async function runStepCall(input: {
  stepKey: string;
  sectionKey: string | null;
  prompt: DraftPromptPreview;
  temperature: number | null;
  maxTokens: number | null;
  callProvider: LocalSectionedDraftProviderCall;
  stepSummaries: LocalSectionedDraftStepSummary[];
  retryCount?: number;
  stepTimeoutMs: number;
  overallDeadlineMs?: number;
}) {
  const promptHash = hashText(`${input.prompt.system}\n${input.prompt.user}\n${input.prompt.outputFormat}`);
  const startedAt = Date.now();
  try {
    const timeoutSeconds = getStepTimeoutSeconds(input.stepTimeoutMs, input.overallDeadlineMs);
    const result = await input.callProvider({
      prompt: input.prompt,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      timeoutSeconds
    });
    input.stepSummaries.push({
      stepKey: input.stepKey,
      sectionKey: input.sectionKey,
      status: "success",
      durationMs: result.latencyMs || Date.now() - startedAt,
      promptHash,
      responseHash: hashText(result.text),
      responseLength: result.text.length,
      retryCount: input.retryCount ?? 0,
      errorMessage: null
    });
    return result;
  } catch (error) {
    input.stepSummaries.push({
      stepKey: input.stepKey,
      sectionKey: input.sectionKey,
      status: "failed",
      durationMs: Date.now() - startedAt,
      promptHash,
      responseHash: null,
      responseLength: 0,
      retryCount: input.retryCount ?? 0,
      errorMessage: safeErrorMessage(error instanceof Error ? error.message : "local sectioned draft step failed", 160)
    });
    throw error;
  }
}

function getStepTimeoutSeconds(stepTimeoutMs: number, overallDeadlineMs?: number) {
  const remainingMs = overallDeadlineMs ? overallDeadlineMs - Date.now() : stepTimeoutMs;
  if (remainingMs <= 0) {
    throw new Error("local_sectioned_overall_timeout");
  }
  return Math.max(1, Math.ceil(Math.min(stepTimeoutMs, remainingMs) / 1000));
}

function buildSkeletonPrompt(input: LocalSectionedDraftInput): DraftPromptPreview {
  const faqItems = getFaqItems(input.planJson);
  return {
    system: [
      "You are a careful Korean long-form article architect for Blog Growth Agent.",
      "Create only a concise JSON skeleton for a Markdown article. Do not write body prose.",
      "Use helpful, original, people-first structure. Do not copy competitor articles.",
      "For investment or finance content, keep services framed as informational/reference tools only.",
      "Do not include buy/sell recommendations, guaranteed profit, return examples, success stories, or risk-free wording.",
      "Never create duplicate H1 headings.",
      faqItems.length > 0 ? "The saved planJson has FAQ items. Include a dedicated conclusion_cta_faq or faq section in the skeleton." : "Include FAQ structure only when the saved plan asks for it."
    ].join("\n"),
    user: JSON.stringify(buildPromptContext(input), null, 2),
    outputFormat: [
      "Return JSON only.",
      'Shape: {"title":"...","sections":[{"key":"intro","heading":"...","goal":"..."},{"key":"body_1","heading":"...","goal":"..."},{"key":"body_2","heading":"...","goal":"..."},{"key":"conclusion_cta_faq","heading":"...","goal":"..."}]}',
      faqItems.length > 0 ? "Use a conclusion_cta_faq section that explicitly preserves a dedicated FAQ block." : "Use 4 sections unless a risk_disclaimer section is clearly needed.",
      "Section keys must be lowercase snake_case. Do not include body prose."
    ].join("\n")
  };
}

function buildSectionPrompt(
  input: LocalSectionedDraftInput,
  skeleton: SkeletonPlan,
  section: SkeletonSection,
  previousSectionSummaries: string[],
  isRetry = false
): DraftPromptPreview {
  const faqItems = getFaqItems(input.planJson);
  const sectionNeedsFaq = faqItems.length > 0 && isFaqSectionKey(section.key);
  return {
    system: [
      "You are a careful Korean Markdown section writer.",
      "Write only the requested section fragment.",
      "Do not write an H1. Use H2/H3 and paragraphs only.",
      "Do not include aggressive CTA wording or investment recommendations.",
      "Preserve or include media placeholders only when relevant.",
      sectionNeedsFaq
        ? "The saved planJson has FAQ items. Create a separate ## FAQ section and write each question as a ### heading. Do not merge FAQ into CTA or conclusion paragraphs."
        : "Do not invent an FAQ section unless this requested section goal asks for it.",
      isRetry ? "This is a retry. Keep the section shorter, safer, and more direct." : "Keep the section focused and substantial."
    ].join("\n"),
    user: JSON.stringify(
      {
        context: buildPromptContext(input),
        skeleton: {
          title: skeleton.title,
          sections: skeleton.sections
        },
        requestedSection: section,
        previousSectionSummaries,
        faqInstruction: sectionNeedsFaq
          ? {
              required: true,
              count: faqItems.length,
              format: "Use ## FAQ, then ### question headings with natural answers based on savedPlanJson.faq."
            }
          : { required: false }
      },
      null,
      2
    ),
    outputFormat: [
      "Return Markdown only.",
      "Start with one H2 for this section.",
      sectionNeedsFaq ? "Include a dedicated ## FAQ heading and ### question headings for saved FAQ items." : "Do not add FAQ unless requested.",
      "Do not include H1.",
      "Do not wrap in code fences.",
      "Do not include commentary outside the Markdown fragment."
    ].join("\n")
  };
}

function buildFinalPolishPrompt(input: LocalSectionedDraftInput, assembledDraft: string): DraftPromptPreview {
  const faqItems = getFaqItems(input.planJson);
  return {
    system: [
      "You are a careful Korean Markdown final editor.",
      "Polish the assembled draft for tone, transitions, logical flow, repetition, CTA balance, and disclaimer clarity.",
      "Do not add unsupported claims, investment recommendations, guaranteed outcomes, or aggressive sign-up language.",
      "Never use unsafe investment or promotion phrases such as 안전한 투자, 안전하게 매수, 성공, 성공 사례, 수익 보장, 확실한 수익, 수익률 예시, 매수 추천, 매도 추천, 원금 보장, 손실 없음, 리스크 없음.",
      "Use neutral alternatives such as 신중한 판단, 참고용 정보, 투자 결과, 판단 보조, 기능 살펴보기, 공식 페이지에서 확인.",
      "Do not delete media placeholders.",
      faqItems.length > 0 ? "Preserve the ## FAQ heading and ### question structure. Do not delete FAQ items or merge them into general paragraphs." : "Do not invent FAQ items.",
      "Return one complete Markdown draft with exactly one H1."
    ].join("\n"),
    user: JSON.stringify(
      {
        contextSummary: buildPromptContext(input),
        assembledDraft
      },
      null,
      2
    ),
    outputFormat: [
      "Return Markdown only.",
      "Keep exactly one H1 at the top.",
      "Keep H2/H3 structure.",
      "Keep media placeholders.",
      faqItems.length > 0 ? "Keep a dedicated FAQ-like section when FAQ exists in savedPlanJson." : "Do not add an FAQ section unless already present.",
      "Do not wrap in code fences.",
      "Do not include commentary before or after the Markdown."
    ].join("\n")
  };
}

function buildPromptContext(input: LocalSectionedDraftInput) {
  const brandProfile = input.contentItem.brandProfile;
  const blog = input.contentItem.blog;
  return {
    contentItem: {
      title: input.contentItem.title,
      mode: input.contentItem.mode,
      targetKeyword: input.contentItem.targetKeyword
    },
    blogProfile: blog
      ? {
          name: blog.name,
          mainTopic: blog.mainTopic,
          subTopics: blog.subTopics,
          targetReader: blog.targetReader,
          tone: blog.tone,
          locale: blog.locale,
          preferredPhrases: blog.preferredPhrases,
          forbiddenPhrases: blog.forbiddenPhrases
        }
      : null,
    brandProfile: brandProfile
      ? {
          name: brandProfile.name,
          serviceName: brandProfile.serviceName,
          shortDescription: brandProfile.shortDescription,
          targetUsers: brandProfile.targetUsers,
          coreFeatures: brandProfile.coreFeatures,
          problemsSolved: brandProfile.problemsSolved,
          ctaWeak: brandProfile.ctaWeak,
          ctaNormal: brandProfile.ctaNormal,
          riskDisclaimer: brandProfile.riskDisclaimer
        }
      : null,
    savedPlanJson: {
      titleCandidates: input.planJson.titleCandidates,
      targetKeyword: input.planJson.targetKeyword,
      searchIntent: input.planJson.searchIntent,
      audience: input.planJson.audience,
      coreMessage: input.planJson.coreMessage,
      outline: input.planJson.outline,
      ctaPlan: input.planJson.ctaPlan,
      mediaPlan: input.planJson.mediaPlan,
      faq: input.planJson.faq,
      risks: input.planJson.risks
    },
    mediaMapping: input.mediaMapping.map((mapping) => ({
      assetId: mapping.assetId,
      placementHint: mapping.placementHint,
      caption: mapping.caption,
      placeholder: mapping.placeholder
    })),
    policy: {
      noBodyInSkeleton: true,
      noDuplicateH1: true,
      moderateInformationalCta: true,
      investmentSafety: "No buy/sell recommendations, guaranteed returns, risk-free wording, or success-rate claims."
    }
  };
}

function parseSkeletonPlan(value: string, input: LocalSectionedDraftInput): SkeletonPlan {
  const parsed = parseJsonObject(value);
  const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : input.contentItem.title ?? buildTitleFromPlan(input.planJson);
  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  const sections = rawSections
    .map((item, index) => normalizeSkeletonSection(item, index))
    .filter((section): section is SkeletonSection => Boolean(section))
    .slice(0, 5);

  return {
    title,
    sections: sections.length >= 3 ? sections : buildDefaultSections(input.planJson)
  };
}

function ensureFaqSkeletonSection(skeleton: SkeletonPlan, faqItems: FaqItem[]): SkeletonPlan {
  if (faqItems.length === 0 || skeleton.sections.some((section) => isFaqSectionKey(section.key) || isFaqHeading(section.heading))) {
    return skeleton;
  }
  return {
    ...skeleton,
    sections: [
      ...skeleton.sections.slice(0, 4),
      {
        key: "conclusion_cta_faq",
        heading: "정리와 FAQ",
        goal: "핵심 내용을 정리하고 정보성 CTA 뒤에 별도 FAQ section을 포함합니다."
      }
    ].slice(0, 5)
  };
}

function parseJsonObject(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("local_sectioned_skeleton_json_parse_failed");
    }
    return JSON.parse(match[0]) as Record<string, unknown>;
  }
}

function normalizeSkeletonSection(item: unknown, index: number): SkeletonSection | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Record<string, unknown>;
  const key = typeof record.key === "string" && record.key.trim() ? toSafeKey(record.key) : `section_${index + 1}`;
  const heading = typeof record.heading === "string" && record.heading.trim() ? stripMarkdownHeading(record.heading).trim() : defaultHeadingForKey(key);
  const goal = typeof record.goal === "string" && record.goal.trim() ? record.goal.trim() : "Saved planJson을 반영해 독자가 이해하기 쉬운 내용을 작성합니다.";
  return { key, heading, goal };
}

function buildDefaultSections(planJson: Record<string, unknown>): SkeletonSection[] {
  const outline = Array.isArray(planJson.outline) ? planJson.outline : [];
  const outlineText = outline.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).filter(Boolean);
  return [
    { key: "intro", heading: "문제 상황과 핵심 관점", goal: outlineText[0] ?? "독자의 문제 상황과 글의 핵심 관점을 소개합니다." },
    { key: "body_1", heading: "놓치기 쉬운 판단 기준", goal: outlineText[1] ?? "본문의 첫 번째 핵심 기준을 설명합니다." },
    { key: "body_2", heading: "실제로 점검할 요소", goal: outlineText[2] ?? "실제 검토 과정에서 확인할 요소를 설명합니다." },
    { key: "conclusion_cta_faq", heading: "정리와 다음 확인 사항", goal: "핵심 내용을 정리하고 정보성 CTA, FAQ, 참고/면책 문구를 포함합니다." }
  ];
}

function assembleDraftMarkdown(input: {
  title: string;
  fragments: string[];
  mediaMapping: DraftMediaMapping[];
  contentItem: ContentItemAdmin;
}) {
  const title = stripMarkdownHeading(input.title || input.contentItem.title || "본문 초안").trim();
  const seenHeadings = new Set<string>();
  const cleanedFragments = input.fragments
    .map((fragment) => normalizeSectionMarkdown(fragment))
    .map((fragment) => removeDuplicateHeadings(fragment, seenHeadings))
    .filter(Boolean);
  const withMedia = ensureMediaPlaceholder(cleanedFragments.join("\n\n"), input.mediaMapping);
  const withCta = ensureModerateCta(withMedia, input.contentItem);
  const withDisclaimer = ensureDisclaimer(withCta, input.contentItem);
  return normalizeMarkdown(`# ${title}\n\n${withDisclaimer}`);
}

function normalizeFinalMarkdown(value: string, title: string, mediaMapping: DraftMediaMapping[]) {
  const withoutFences = stripCodeFences(value);
  const withoutExtraH1 = normalizeH1(withoutFences, title);
  const withMedia = ensureMediaPlaceholder(withoutExtraH1, mediaMapping);
  return normalizeMarkdown(withMedia);
}

function ensureFaqSection(markdown: string, faqItems: FaqItem[]) {
  const detectedBefore = hasFaqLikeSection(markdown);
  if (faqItems.length === 0 || detectedBefore) {
    return {
      markdown,
      detectedAfter: detectedBefore,
      fallbackAppended: false,
      appendedMarkdown: null as string | null
    };
  }

  const fallback = buildFaqFallbackMarkdown(markdown, faqItems);
  const withFallback = normalizeMarkdown(`${markdown}\n\n${fallback}`);
  return {
    markdown: withFallback,
    detectedAfter: hasFaqLikeSection(withFallback),
    fallbackAppended: true,
    appendedMarkdown: fallback
  };
}

function buildFaqFallbackMarkdown(markdown: string, faqItems: FaqItem[]) {
  const normalizedMarkdown = normalizeComparableText(markdown);
  const selected = faqItems
    .filter((item) => !normalizedMarkdown.includes(normalizeComparableText(item.question).slice(0, 28)))
    .slice(0, 5);
  const items = selected.length > 0 ? selected : faqItems.slice(0, 5);
  return [
    "## FAQ",
    "",
    ...items.flatMap((item) => [
      `### ${sanitizeMarkdownLine(item.question)}`,
      "",
      sanitizeMarkdownParagraph(item.answer),
      ""
    ])
  ].join("\n").trim();
}

export function scrubLocalSectionedDraftSafetyPhrases(markdown: string): LocalSectionedSafetyScrubResult {
  let nextMarkdown = markdown;
  let scrubCount = 0;
  const scrubCodes = new Set<string>();

  for (const replacement of LOCAL_SECTIONED_SAFETY_PHRASE_REPLACEMENTS) {
    const result = replaceAllWithCount(nextMarkdown, replacement.phrase, replacement.replacement);
    if (result.count > 0) {
      nextMarkdown = result.value;
      scrubCount += result.count;
      scrubCodes.add(replacement.code);
    }
  }

  return {
    markdown: normalizeMarkdown(nextMarkdown),
    scrubApplied: scrubCount > 0,
    scrubCount,
    scrubCodes: Array.from(scrubCodes).sort()
  };
}

function replaceAllWithCount(value: string, phrase: string, replacement: string) {
  const parts = value.split(phrase);
  const count = parts.length - 1;
  return {
    value: count > 0 ? parts.join(replacement) : value,
    count
  };
}

function normalizeSectionMarkdown(value: string) {
  return normalizeMarkdown(stripCodeFences(value).replace(/^#\s+.+$/gm, "").trim());
}

function normalizeH1(value: string, title: string) {
  const lines = value.split(/\r?\n/).filter((line) => !/^#\s+/.test(line.trim()));
  return `# ${stripMarkdownHeading(title).trim()}\n\n${lines.join("\n").trim()}`;
}

function removeDuplicateHeadings(value: string, seen: Set<string>) {
  return value
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (!match) {
        return true;
      }
      const normalized = match[2].trim().toLowerCase();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    })
    .join("\n")
    .trim();
}

function ensureMediaPlaceholder(value: string, mediaMapping: DraftMediaMapping[]) {
  if (mediaMapping.length === 0 || /<!--\s*media:/i.test(value)) {
    return value;
  }
  return `${value}\n\n${mediaMapping[0].placeholder}`;
}

function ensureModerateCta(value: string, contentItem: ContentItemAdmin) {
  if (/(공식 페이지에서 확인|서비스 기능 확인|기능 살펴보기|다음 확인 사항|CTA|확인해 보세요)/i.test(value)) {
    return value;
  }
  const brand = contentItem.brandProfile;
  const cta = brand?.ctaWeak || brand?.ctaNormal || "관련 기능과 정보를 공식 페이지에서 차분히 확인해 보세요.";
  return `${value}\n\n## 다음 확인 사항\n\n${cta}`;
}

function ensureDisclaimer(value: string, contentItem: ContentItemAdmin) {
  if (/(리스크|위험|참고|정보 제공|면책|보장하지|투자 판단|손실|disclaimer|risk)/i.test(value)) {
    return value;
  }
  const disclaimer = contentItem.brandProfile?.riskDisclaimer || "이 글은 정보 제공 목적의 참고 자료이며, 최종 판단과 책임은 독자에게 있습니다.";
  return `${value}\n\n## 참고 및 유의사항\n\n${disclaimer}`;
}

function buildFallbackSection(section: SkeletonSection, contentItem: ContentItemAdmin) {
  const heading = stripMarkdownHeading(section.heading || defaultHeadingForKey(section.key));
  const targetKeyword = contentItem.targetKeyword ? `\`${contentItem.targetKeyword}\`` : "핵심 주제";
  return [
    `## ${heading}`,
    "",
    `${section.goal} 이 섹션은 ${targetKeyword}를 이해할 때 확인해야 할 기준을 차분히 정리합니다.`,
    "",
    "독자는 단일 신호에 의존하기보다 여러 정보를 함께 비교하고, 자신의 상황에 맞는 판단 기준을 먼저 세우는 편이 좋습니다.",
    "",
    "특히 투자나 금융과 관련된 내용은 참고 정보로만 활용해야 하며, 최종 판단은 사용자가 직접 내려야 합니다."
  ].join("\n");
}

function getFaqItems(planJson: Record<string, unknown>): FaqItem[] {
  if (!Array.isArray(planJson.faq)) {
    return [];
  }
  return planJson.faq
    .map((item) => normalizeFaqItem(item))
    .filter((item): item is FaqItem => Boolean(item))
    .slice(0, 5);
}

function normalizeFaqItem(item: unknown): FaqItem | null {
  if (typeof item === "string") {
    const question = sanitizeMarkdownLine(item);
    return question ? { question, answer: "이 질문은 본문에서 다룬 기준을 바탕으로 상황에 맞게 차분히 확인하는 것이 좋습니다." } : null;
  }
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Record<string, unknown>;
  const question = firstStringValue(record, ["question", "q", "title", "heading"]);
  const answer = firstStringValue(record, ["answer", "a", "response", "description"]);
  if (!question) {
    return null;
  }
  return {
    question: sanitizeMarkdownLine(question),
    answer: sanitizeMarkdownParagraph(answer || "본문의 핵심 기준을 참고해 자신의 상황에 맞게 판단하는 것이 좋습니다.")
  };
}

function firstStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function hasFaqLikeSection(value: string) {
  return /(^|\n)#{2,3}\s*(faq|자주 묻|질문)/i.test(value) || /(^|\n)###\s+.+\?/m.test(value);
}

function isFaqSectionKey(value: string) {
  return /faq|question|qa|conclusion_cta_faq/i.test(value);
}

function isFaqHeading(value: string) {
  return /faq|자주 묻|질문/i.test(value);
}

function summarizeSectionForNextPrompt(key: string, markdown: string) {
  const text = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/[#*_>`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);
  return `${key}: ${text}`;
}

function buildTitleFromPlan(planJson: Record<string, unknown>) {
  const titleCandidates = Array.isArray(planJson.titleCandidates) ? planJson.titleCandidates : [];
  const firstTitle = titleCandidates.find((item): item is string => typeof item === "string" && item.trim().length > 0);
  return firstTitle ?? "본문 초안";
}

function defaultHeadingForKey(key: string) {
  if (key.includes("intro")) {
    return "문제 상황과 핵심 관점";
  }
  if (key.includes("conclusion") || key.includes("cta") || key.includes("faq")) {
    return "정리와 다음 확인 사항";
  }
  if (key.includes("risk") || key.includes("disclaimer")) {
    return "참고 및 유의사항";
  }
  return "핵심 점검 요소";
}

function toSafeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "section";
}

function stripMarkdownHeading(value: string) {
  return value.replace(/^#{1,6}\s+/, "");
}

function sanitizeMarkdownLine(value: string) {
  return stripHtml(value)
    .replace(/^#{1,6}\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function sanitizeMarkdownParagraph(value: string) {
  return stripHtml(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function normalizeComparableText(value: string) {
  return stripHtml(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function stripCodeFences(value: string) {
  return value.replace(/^```(?:markdown|md)?\s*/i, "").replace(/```\s*$/i, "");
}

function normalizeMarkdown(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function sumNullableTokens(left: number | null, right: number | null) {
  if (left === null && right === null) {
    return null;
  }
  return (left ?? 0) + (right ?? 0);
}
