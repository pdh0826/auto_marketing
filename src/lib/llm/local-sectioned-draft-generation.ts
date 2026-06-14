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

const FINAL_POLISH_MAX_INPUT_CHARS = 8500;

export async function generateLocalSectionedDraftCandidate(input: LocalSectionedDraftInput): Promise<LocalSectionedDraftResult> {
  const stepSummaries: LocalSectionedDraftStepSummary[] = [];
  const fallbackReasons: string[] = [];
  let totalLatencyMs = 0;
  let totalInputTokens: number | null = null;
  let totalOutputTokens: number | null = null;

  const skeletonPrompt = buildSkeletonPrompt(input);
  const skeletonCall = await runStepCall({
    stepKey: "skeleton",
    sectionKey: null,
    prompt: skeletonPrompt,
    temperature: Math.min(input.temperature ?? 0.2, 0.2),
    maxTokens: Math.min(input.maxTokens ?? 900, 900),
    callProvider: input.callProvider,
    stepSummaries
  });
  totalLatencyMs += skeletonCall.latencyMs;
  totalInputTokens = sumNullableTokens(totalInputTokens, skeletonCall.inputTokens);
  totalOutputTokens = sumNullableTokens(totalOutputTokens, skeletonCall.outputTokens);

  const skeleton = parseSkeletonPlan(skeletonCall.text, input);
  const previousSectionSummaries: string[] = [];
  const sectionFragments: string[] = [];

  for (const section of skeleton.sections) {
    const sectionResult = await generateSectionWithRetry({
      section,
      skeleton,
      previousSectionSummaries,
      input,
      stepSummaries
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
        stepSummaries
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
      stepSummaries
    }
  };
}

async function generateSectionWithRetry(input: {
  section: SkeletonSection;
  skeleton: SkeletonPlan;
  previousSectionSummaries: string[];
  input: LocalSectionedDraftInput;
  stepSummaries: LocalSectionedDraftStepSummary[];
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
      stepSummaries: input.stepSummaries
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
        retryCount: 1
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
}) {
  const promptHash = hashText(`${input.prompt.system}\n${input.prompt.user}\n${input.prompt.outputFormat}`);
  const startedAt = Date.now();
  try {
    const result = await input.callProvider({
      prompt: input.prompt,
      temperature: input.temperature,
      maxTokens: input.maxTokens
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

function buildSkeletonPrompt(input: LocalSectionedDraftInput): DraftPromptPreview {
  return {
    system: [
      "You are a careful Korean long-form article architect for Blog Growth Agent.",
      "Create only a concise JSON skeleton for a Markdown article. Do not write body prose.",
      "Use helpful, original, people-first structure. Do not copy competitor articles.",
      "For investment or finance content, keep services framed as informational/reference tools only.",
      "Do not include buy/sell recommendations, guaranteed profit, return examples, success stories, or risk-free wording.",
      "Never create duplicate H1 headings."
    ].join("\n"),
    user: JSON.stringify(buildPromptContext(input), null, 2),
    outputFormat: [
      "Return JSON only.",
      'Shape: {"title":"...","sections":[{"key":"intro","heading":"...","goal":"..."},{"key":"body_1","heading":"...","goal":"..."},{"key":"body_2","heading":"...","goal":"..."},{"key":"conclusion_cta_faq","heading":"...","goal":"..."}]}',
      "Use 4 sections unless a risk_disclaimer section is clearly needed.",
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
  return {
    system: [
      "You are a careful Korean Markdown section writer.",
      "Write only the requested section fragment.",
      "Do not write an H1. Use H2/H3 and paragraphs only.",
      "Do not include aggressive CTA wording or investment recommendations.",
      "Preserve or include media placeholders only when relevant.",
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
        previousSectionSummaries
      },
      null,
      2
    ),
    outputFormat: [
      "Return Markdown only.",
      "Start with one H2 for this section.",
      "Do not include H1.",
      "Do not wrap in code fences.",
      "Do not include commentary outside the Markdown fragment."
    ].join("\n")
  };
}

function buildFinalPolishPrompt(input: LocalSectionedDraftInput, assembledDraft: string): DraftPromptPreview {
  return {
    system: [
      "You are a careful Korean Markdown final editor.",
      "Polish the assembled draft for tone, transitions, logical flow, repetition, CTA balance, and disclaimer clarity.",
      "Do not add unsupported claims, investment recommendations, guaranteed outcomes, or aggressive sign-up language.",
      "Do not delete media placeholders.",
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
