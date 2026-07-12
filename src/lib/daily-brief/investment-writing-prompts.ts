import { PROJECT300_INVESTMENT_FORBIDDEN_PATTERNS, selectProject300VoiceExamples, type Project300SectionRole } from "@/lib/tistory/project300-investment-voice-corpus";
import type { InvestmentJudgmentLedger, InvestmentWritingEvidencePack } from "./investment-writing-contract";
import type { InvestmentWritingOutline } from "./investment-writing-outline";
import type { InvestmentWritingPreflightResult } from "./investment-writing-preflight";

export const INVESTMENT_WRITING_PROMPT_VERSION = "investment_writing_prompts_v1";

export interface InvestmentWritingPromptBundle {
  version: typeof INVESTMENT_WRITING_PROMPT_VERSION;
  analysisPrompt: string;
  outlinePrompt: string;
  sectionPrompts: Array<{ sectionKey: string; prompt: string }>;
  rhythmEditPrompt: string;
  independentReviewPrompt: string;
  safeMetadata: {
    channel: string;
    sectionCount: number;
    evidenceCount: number;
    userJudgmentPresent: boolean;
    promptLengths: number[];
  };
}

export function buildInvestmentWritingPromptBundle(input: {
  evidencePack: InvestmentWritingEvidencePack;
  judgmentLedger: InvestmentJudgmentLedger;
  preflight: InvestmentWritingPreflightResult;
  outline: InvestmentWritingOutline;
}) : InvestmentWritingPromptBundle {
  const channelPolicy = input.evidencePack.channel === "blogger_daily_brief"
    ? [
        "Blogger Daily Brief는 당일 시장 전체를 빠르게 훑는 브리핑이다.",
        "TOP 목록과 핵심 흐름을 간결하게 보여주고 종목별 장문 분석은 제한한다."
      ]
    : [
        "Project300 Tistory는 개인 투자자가 차트, 신호, 뉴스와 판단을 기록하는 글이다.",
        "비슷한 종목은 비교하고 성격이 다른 후보만 별도로 깊게 설명한다."
      ];
  const commonRules = [
    "FACT, SYSTEM, JUDGMENT, ACTION을 서로 바꾸어 쓰지 않는다.",
    "사용자가 제공하지 않은 판단, 보유 상태, 매매 행동, 경험을 만들지 않는다.",
    "SYSTEM 진입가·목표가·손절선을 객관적인 지지·저항으로 단정하지 않는다.",
    "RSS, 자동 수집, 검색 후보, 기사 전문 미저장 같은 내부 작업 문구를 본문에 쓰지 않는다.",
    "종목마다 같은 분석 순서를 반복하지 않는다.",
    "새로운 숫자, 날짜, 링크, 기사, 공시를 만들지 않는다."
  ];
  const safeInput = buildSafePromptInput(input);
  const analysisPrompt = [
    "너는 투자 블로그의 자료 분석기다. 본문을 쓰지 않는다.",
    ...channelPolicy,
    ...commonRules,
    "입력에서 날짜 오류, 출처 부족, 비슷한 종목, 중심 판단 후보, 생략할 자료를 찾아 JSON으로만 반환한다.",
    safeInput
  ].join("\n");
  const outlinePrompt = [
    "너는 투자 블로그의 구조 편집자다. 아직 본문을 쓰지 않는다.",
    ...channelPolicy,
    ...commonRules,
    "한 글의 중심 판단은 하나만 둔다. 각 구간에는 서로 다른 질문과 역할을 부여한다.",
    "제목 후보 5개, 소제목별 질문, 사용할 evidence id, 필요한 판단 id, 생략 사유를 JSON으로 반환한다.",
    safeInput
  ].join("\n");
  const sectionPrompts = input.outline.sections.map((section, index) => {
    const roles = inferSectionRoles(section.key);
    const examples = selectProject300VoiceExamples({ roles, seed: `${input.evidencePack.temporalContext.dataDate}:${section.key}`, limitPerRole: 2 });
    return {
      sectionKey: section.key,
      prompt: [
        "너는 Project300 투자 블로그의 한 구간만 작성하는 편집자다.",
        ...channelPolicy,
        ...commonRules,
        `구간: ${section.key}`,
        `목적: ${section.purpose}`,
        `대상 코드: ${section.subjectCodes.join(", ") || "없음"}`,
        `허용 정보: ${section.allowedInformationClasses.join(", ")}`,
        `권장 문단 수: ${index === 0 ? "2~3" : "2~5"}`,
        "아래 예문은 문장을 복사하는 템플릿이 아니라 설명 리듬 참고용이다.",
        ...examples.map((item) => `- [${item.id}] ${item.pattern} (${item.usageNote})`),
        "금지 문구:",
        ...PROJECT300_INVESTMENT_FORBIDDEN_PATTERNS.map((item) => `- ${item}`),
        "이 구간의 Markdown 본문만 반환한다.",
        safeInput
      ].join("\n")
    };
  });
  const rhythmEditPrompt = [
    "너는 새 사실을 만드는 작가가 아니라 전체 글의 리듬을 손보는 편집자다.",
    ...channelPolicy,
    ...commonRules,
    "같은 결론, 같은 문장 시작, 균일한 문단 길이, 형식적인 FAQ와 요약을 삭제한다.",
    "비슷한 종목 문단은 비교 구간으로 합친다. 숫자, 날짜, 링크, 이미지 참조는 바꾸지 않는다.",
    "수정된 Markdown 본문만 반환한다."
  ].join("\n");
  const independentReviewPrompt = [
    "너는 초안을 작성하지 않은 독립 검수자다. 새 정보를 추가하지 않는다.",
    "종목명과 숫자를 가렸을 때 다른 종목에도 붙일 수 있는 문단을 찾는다.",
    "근거 없는 1인칭, FACT/SYSTEM/JUDGMENT/ACTION 혼용, 내부 작업 문구, 반복 구조, 날짜 충돌을 검사한다.",
    "통과 여부, blockers, warnings, 삭제할 문단, 사실 확인 필요 항목을 JSON으로만 반환한다."
  ].join("\n");
  const allPrompts = [analysisPrompt, outlinePrompt, ...sectionPrompts.map((item) => item.prompt), rhythmEditPrompt, independentReviewPrompt];

  return {
    version: INVESTMENT_WRITING_PROMPT_VERSION,
    analysisPrompt,
    outlinePrompt,
    sectionPrompts,
    rhythmEditPrompt,
    independentReviewPrompt,
    safeMetadata: {
      channel: input.evidencePack.channel,
      sectionCount: sectionPrompts.length,
      evidenceCount: countEvidence(input.evidencePack),
      userJudgmentPresent: input.judgmentLedger.userInputPresent,
      promptLengths: allPrompts.map((prompt) => prompt.length)
    }
  };
}

function buildSafePromptInput(input: {
  evidencePack: InvestmentWritingEvidencePack;
  judgmentLedger: InvestmentJudgmentLedger;
  preflight: InvestmentWritingPreflightResult;
  outline: InvestmentWritingOutline;
}) {
  return JSON.stringify(
    {
      temporalContext: input.evidencePack.temporalContext,
      marketFacts: input.evidencePack.marketFacts.filter((item) => item.publishable),
      stocks: input.evidencePack.stocks.map((stock) => ({
        code: stock.code,
        name: stock.name,
        theme: stock.theme,
        facts: stock.facts.filter((item) => item.publishable),
        systemValues: stock.systemValues
      })),
      etfs: input.evidencePack.etfs,
      judgmentLedger: input.judgmentLedger,
      preflight: { ok: input.preflight.ok, blockers: input.preflight.blockers, warnings: input.preflight.warnings },
      outline: input.outline
    },
    null,
    2
  );
}

function inferSectionRoles(sectionKey: string): Project300SectionRole[] {
  if (sectionKey === "opening") return ["opening_observation"];
  if (sectionKey.includes("comparison")) return ["stock_comparison", "chart_interpretation", "news_transition"];
  if (sectionKey.includes("deep_dive") || sectionKey.includes("supporting")) return ["chart_interpretation", "news_transition", "number_interpretation"];
  if (sectionKey === "next_conditions") return ["action_condition", "closing_next_record"];
  if (sectionKey === "etf_context") return ["easy_explanation", "number_interpretation"];
  return ["easy_explanation"];
}

function countEvidence(pack: InvestmentWritingEvidencePack) {
  return pack.marketFacts.length + pack.stocks.reduce((sum, stock) => sum + stock.facts.length + stock.systemValues.length, 0) + pack.etfs.reduce((sum, etf) => sum + etf.facts.length + etf.systemValues.length, 0);
}
