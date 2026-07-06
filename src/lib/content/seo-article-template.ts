import type { ContentItemAdmin } from "@/lib/content/admin-types";

export type SeoArticleSectionKey =
  | "intro"
  | "summary"
  | "problem_context"
  | "check_method_1"
  | "check_method_2"
  | "beginner_mistakes"
  | "service_use_case"
  | "faq"
  | "risk_disclaimer"
  | "cta";

export interface SeoArticleSectionSpec {
  key: SeoArticleSectionKey;
  heading: string;
  purpose: string;
  minVisibleTextLength: number;
  minParagraphCount: number;
  required: boolean;
}

export interface SeoArticleTemplateSpec {
  version: "seo_article_template_v1";
  targetVisibleTextLength: number;
  minVisibleTextLengthToPublish: number;
  minVisibleTextLengthWarning: number;
  minH2Count: number;
  minParagraphCount: number;
  minFaqCount: number;
  sections: SeoArticleSectionSpec[];
}

export interface SeoSearchIntentSpec {
  targetKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: string;
  readerProblem: string;
  expectedTakeaway: string;
  serviceConnectionAngle: string | null;
}

export const SEO_ARTICLE_TEMPLATE_V1: SeoArticleTemplateSpec = {
  version: "seo_article_template_v1",
  targetVisibleTextLength: 3500,
  minVisibleTextLengthToPublish: 2500,
  minVisibleTextLengthWarning: 3000,
  minH2Count: 5,
  minParagraphCount: 10,
  minFaqCount: 3,
  sections: [
    {
      key: "intro",
      heading: "도입부",
      purpose: "검색자가 왜 이 주제를 찾는지 짚고 글에서 얻을 내용을 약속합니다.",
      minVisibleTextLength: 350,
      minParagraphCount: 2,
      required: true
    },
    {
      key: "summary",
      heading: "핵심 요약",
      purpose: "초보 독자가 먼저 기억해야 할 기준을 짧은 목록으로 정리합니다.",
      minVisibleTextLength: 250,
      minParagraphCount: 1,
      required: true
    },
    {
      key: "problem_context",
      heading: "문제 상황 이해",
      purpose: "초보자가 왜 판단을 놓치는지 상황, 원인, 흔한 오해를 설명합니다.",
      minVisibleTextLength: 450,
      minParagraphCount: 2,
      required: true
    },
    {
      key: "check_method_1",
      heading: "첫 번째 확인 기준",
      purpose: "실제 판단에 쓸 수 있는 첫 번째 체크 기준과 해석 방법을 설명합니다.",
      minVisibleTextLength: 450,
      minParagraphCount: 2,
      required: true
    },
    {
      key: "check_method_2",
      heading: "두 번째 확인 기준",
      purpose: "첫 번째 기준과 함께 봐야 하는 보조 기준, 예시, 반례를 설명합니다.",
      minVisibleTextLength: 450,
      minParagraphCount: 2,
      required: true
    },
    {
      key: "beginner_mistakes",
      heading: "초보자가 자주 하는 실수",
      purpose: "잘못된 해석, 과잉 확신, 리스크 무시를 피하는 방법을 설명합니다.",
      minVisibleTextLength: 350,
      minParagraphCount: 2,
      required: true
    },
    {
      key: "service_use_case",
      heading: "급등포착 활용 예시",
      purpose: "서비스를 투자 판단 대체가 아닌 정보 확인 보조 도구로 자연스럽게 연결합니다.",
      minVisibleTextLength: 300,
      minParagraphCount: 2,
      required: true
    },
    {
      key: "faq",
      heading: "FAQ",
      purpose: "검색자가 이어서 물을 만한 질문 3개 이상에 답합니다.",
      minVisibleTextLength: 300,
      minParagraphCount: 3,
      required: true
    },
    {
      key: "risk_disclaimer",
      heading: "투자 유의사항",
      purpose: "금융/투자 주제의 한계와 사용자의 최종 판단 책임을 명확히 안내합니다.",
      minVisibleTextLength: 180,
      minParagraphCount: 1,
      required: true
    },
    {
      key: "cta",
      heading: "다음 확인 사항",
      purpose: "과도한 광고 없이 다음 행동을 안내합니다.",
      minVisibleTextLength: 120,
      minParagraphCount: 1,
      required: true
    }
  ]
};

export const DEFAULT_SEO_ARTICLE_SECTION_KEYS = SEO_ARTICLE_TEMPLATE_V1.sections.map((section) => section.key);

export function buildSeoSearchIntentSpec(contentItem: ContentItemAdmin): SeoSearchIntentSpec {
  const plan = asRecord(contentItem.planJson);
  const targetKeyword =
    normalizeString(plan?.targetKeyword) ??
    normalizeString(plan?.primaryKeyword) ??
    normalizeString(contentItem.targetKeyword) ??
    normalizeString(contentItem.title);
  const secondaryKeywords = uniqueStrings([
    ...flattenStrings(plan?.secondaryKeywords),
    ...flattenStrings(plan?.keywords),
    ...flattenStrings(plan?.tags),
    ...(contentItem.blog?.subTopics ?? [])
  ]).slice(0, 8);
  const serviceName = contentItem.brandProfile?.serviceName ?? contentItem.brandProfile?.name ?? null;

  return {
    targetKeyword,
    secondaryKeywords,
    searchIntent:
      normalizeString(plan?.searchIntent) ??
      (targetKeyword ? `${targetKeyword}에 대해 초보자가 실제로 확인해야 할 기준을 알고 싶어 합니다.` : "초보 독자가 주제의 핵심 기준과 리스크를 이해하고 싶어 합니다."),
    readerProblem:
      normalizeString(plan?.readerProblem) ??
      normalizeString(plan?.audiencePainPoint) ??
      "정보가 흩어져 있어 어떤 기준을 먼저 확인해야 하는지 판단하기 어렵습니다.",
    expectedTakeaway:
      normalizeString(plan?.expectedTakeaway) ??
      normalizeString(plan?.readerOutcome) ??
      "글을 읽은 뒤 독자가 확인 순서, 주의점, 다음 행동을 스스로 정리할 수 있어야 합니다.",
    serviceConnectionAngle: serviceName ? `${serviceName}는 판단을 대신하지 않고 여러 신호를 함께 확인하는 참고용 도구로 연결합니다.` : null
  };
}

export function buildSeoSectionPromptContract(sectionKey: SeoArticleSectionKey, contentItem: ContentItemAdmin) {
  const section = SEO_ARTICLE_TEMPLATE_V1.sections.find((item) => item.key === sectionKey);
  const intent = buildSeoSearchIntentSpec(contentItem);

  return {
    templateVersion: SEO_ARTICLE_TEMPLATE_V1.version,
    targetVisibleTextLength: SEO_ARTICLE_TEMPLATE_V1.targetVisibleTextLength,
    section,
    searchIntent: intent,
    writingRules: [
      "Write only this section, not the full article.",
      "Use Korean natural prose with concrete explanations, examples, beginner mistakes, and practical checks.",
      "Do not wrap output in code fences.",
      "Do not output HTML.",
      "Do not include raw JSON.",
      "Do not make buy/sell recommendations or guaranteed outcome claims.",
      "Use service mentions as optional context, never as investment advice."
    ]
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function flattenStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(flattenStrings);
  }
  return [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
