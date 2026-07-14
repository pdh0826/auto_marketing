import { createHash } from "crypto";
import { reviewInvestmentWritingDraft } from "@/lib/daily-brief/investment-writing-review";
import type { InvestmentJudgmentLedger } from "@/lib/daily-brief/investment-writing-contract";
import type { InvestmentWritingOutline } from "@/lib/daily-brief/investment-writing-outline";
import { PROJECT300_BANNED_TONE_PATTERNS, PROJECT300_REQUIRED_CTA_POLICY, PROJECT300_STYLE_PROFILE_VERSION, PROJECT300_VOICE_ANCHOR_EXCERPT } from "./project300-style";
import type { Project300CategoryKind } from "./project300-voice-variation";

export const PROJECT300_STYLE_REVIEW_VERSION = "project300_style_review_v1";
export const PROJECT300_STYLE_REVIEW_PASS_SCORE = 85;

export interface Project300StyleReviewResult {
  version: string;
  styleProfileVersion: string;
  ok: boolean;
  grade: "pass" | "warn" | "fail";
  score: number;
  voiceScore: number;
  explanationScore: number;
  seoScore: number;
  safetyScore: number;
  antiAiScore: number;
  categoryKind: Project300CategoryKind;
  markdownHash: string;
  markdownLength: number;
  headingCount: number;
  imageCount: number;
  linkCount: number;
  repeatedPhraseWarnings: string[];
  awkwardToneWarnings: string[];
  missingRequiredElements: string[];
  bannedPhrases: string[];
  blockers: string[];
  suggestions: string[];
  checklist: Array<{ key: string; label: string; pass: boolean }>;
}

export interface Project300RewriteLoopResult {
  finalMarkdown: string;
  finalReview: Project300StyleReviewResult;
  initialReview: Project300StyleReviewResult;
  iterations: Array<{
    iteration: number;
    beforeScore: number;
    afterScore: number;
    accepted: boolean;
    responseHash: string | null;
    responseLength: number;
  }>;
  rewriteAttempted: boolean;
  rewriteSucceeded: boolean;
  maxIterations: number;
  stoppedReason: "already_passed" | "passed_after_rewrite" | "max_iterations_reached" | "rewrite_callback_not_configured" | "rewrite_failed";
}

export function reviewProject300GeneratedPost(input: {
  title: string;
  markdown: string;
  categoryKind: Project300CategoryKind;
  assetImageCount?: number;
  subjectNames?: string[];
  judgmentLedger?: InvestmentJudgmentLedger | null;
  investmentOutline?: InvestmentWritingOutline | null;
}): Project300StyleReviewResult {
  const markdown = input.markdown.trim();
  const headingCount = (markdown.match(/^#{2,3}\s+/gm) ?? []).length;
  const markdownImageCount = (markdown.match(/!\[[^\]]*]\([^)]+\)/g) ?? []).length;
  const imageCount = Math.max(markdownImageCount, input.assetImageCount ?? 0);
  const linkCount = (markdown.match(/\[[^\]]+]\(https?:\/\/[^)]+\)/g) ?? []).length;
  const voiceSignals = countMatches(markdown, [
    "오늘은",
    "확인해 보도록 하겠습니다",
    "우선",
    "뭔소리냐구요",
    "간단하게 말하면",
    "자. 그럼",
    "볼까요",
    "이런",
    "ㅎㅎ",
    "보완이 필요해 보입니다",
    "다음 포스팅",
    "감사합니다",
    "저는",
    "자 그럼",
    "체크",
    "확인"
  ]);
  const honorificSignals = countMatches(markdown, ["습니다", "합니다", "보겠습니다", "볼까요", "되겠습니다", "필요해 보입니다"]);
  const anchorSignals = PROJECT300_VOICE_ANCHOR_EXCERPT.reduce((sum, phrase) => {
    const keyword = phrase.split(/[,.!?]/)[0]?.trim();
    return keyword && markdown.includes(keyword.slice(0, Math.min(keyword.length, 12))) ? sum + 1 : sum;
  }, 0);
  const explanationSignals = countMatches(markdown, ["차트", "신호", "진입", "손절", "목표", "뉴스", "공시", "거래", "수급"]);
  const seoSignals = countMatches(`${input.title}\n${markdown.slice(0, 800)}`, ["급등포착", "국내주식", "관심종목", "ETF", "신호", "리뷰"]);
  const bannedPhrases = PROJECT300_BANNED_TONE_PATTERNS.filter((phrase) => markdown.includes(phrase));
  const safetyBanned = ["무조건", "확정 급등", "수익 보장", "손실 없음", "몰빵", "바로 매수", "매수하세요", "매도하세요"].filter((phrase) =>
    markdown.includes(phrase)
  );
  const awkwardToneWarnings = findAwkwardToneWarnings(markdown);
  const repeatedPhraseWarnings = findRepeatedPhraseWarnings(markdown);
  const investmentReview = reviewInvestmentWritingDraft({
    markdown,
    subjectNames: input.subjectNames ?? [],
    judgmentLedger: input.judgmentLedger,
    outline: input.investmentOutline,
    allowFirstPerson: true
  });
  const missingRequiredElements = findMissingRequiredElements({
    title: input.title,
    markdown,
    headingCount,
    imageCount,
    linkCount
  });

  const voiceScore = clampScore(45 + voiceSignals * 4 + honorificSignals * 2 + anchorSignals * 5 - awkwardToneWarnings.length * 8 - bannedPhrases.length * 10);
  const explanationScore = clampScore(45 + explanationSignals * 3 + imageCount * 7 + linkCount * 2 - missingRequiredElements.length * 6);
  const seoScore = clampScore(50 + seoSignals * 6 + headingCount * 3 + linkCount * 2 - (input.title.length > 80 ? 8 : 0));
  const safetyScore = clampScore(100 - safetyBanned.length * 25 - bannedPhrases.length * 8);
  const antiAiScore = investmentReview.antiAiScore;
  const score = Math.round((voiceScore * 0.2 + explanationScore * 0.25 + seoScore * 0.2 + safetyScore * 0.15 + antiAiScore * 0.2) * 10) / 10;
  const ok = score >= PROJECT300_STYLE_REVIEW_PASS_SCORE && safetyBanned.length === 0 && missingRequiredElements.length === 0 && investmentReview.ok;

  const checklist = [
    { key: "project300_voice_anchor", label: "MACD 예시 기반의 존댓말 설명형 블로그체와 맞음", pass: voiceScore >= 80 },
    { key: "chart_explanation", label: "이미지/차트 뒤에 해석 문단이 있음", pass: explanationScore >= 80 },
    { key: "seo_basics", label: "제목/첫 문단/H2/링크 SEO 기본 조건 충족", pass: seoScore >= 80 },
    { key: "no_hard_sell", label: "매수 지시/수익 보장 표현 없음", pass: safetyScore >= 90 },
    { key: "not_report_tone", label: "리포트체/참고자료체/반말 메모체 금지 문구 없음", pass: bannedPhrases.length === 0 && awkwardToneWarnings.length <= 1 },
    { key: "required_upsignal_cta", label: "손실이 잦은 독자를 위한 급등포착 매매 타점 확인 CTA 포함", pass: hasRequiredCta(markdown) },
    { key: "anti_ai_gate", label: "내부 메모, 근거 없는 1인칭, 종목명 치환형 반복 문단이 없음", pass: investmentReview.ok }
  ];

  return {
    version: PROJECT300_STYLE_REVIEW_VERSION,
    styleProfileVersion: PROJECT300_STYLE_PROFILE_VERSION,
    ok,
    grade: ok ? "pass" : score >= 72 ? "warn" : "fail",
    score,
    voiceScore,
    explanationScore,
    seoScore,
    safetyScore,
    antiAiScore,
    categoryKind: input.categoryKind,
    markdownHash: hashText(markdown),
    markdownLength: markdown.length,
    headingCount,
    imageCount,
    linkCount,
    repeatedPhraseWarnings: [...repeatedPhraseWarnings, ...investmentReview.repeatedPhraseWarnings],
    awkwardToneWarnings,
    missingRequiredElements,
    bannedPhrases: [...bannedPhrases, ...safetyBanned],
    blockers: investmentReview.blockers,
    suggestions: buildSuggestions({ voiceScore, explanationScore, seoScore, safetyScore, missingRequiredElements, awkwardToneWarnings, bannedPhrases }),
    checklist
  };
}

export async function runProject300ReviewRewriteLoop(input: {
  title: string;
  markdown: string;
  categoryKind: Project300CategoryKind;
  assetImageCount?: number;
  subjectNames?: string[];
  judgmentLedger?: InvestmentJudgmentLedger | null;
  investmentOutline?: InvestmentWritingOutline | null;
  maxIterations?: number;
  rewrite?: (request: { prompt: string; iteration: number; review: Project300StyleReviewResult }) => Promise<string>;
}): Promise<Project300RewriteLoopResult> {
  const maxIterations = Math.min(Math.max(input.maxIterations ?? 3, 1), 5);
  const initialReview = reviewProject300GeneratedPost(input);
  if (initialReview.ok) {
    return {
      finalMarkdown: input.markdown,
      initialReview,
      finalReview: initialReview,
      iterations: [],
      rewriteAttempted: false,
      rewriteSucceeded: false,
      maxIterations,
      stoppedReason: "already_passed"
    };
  }

  if (!input.rewrite) {
    return {
      finalMarkdown: input.markdown,
      initialReview,
      finalReview: initialReview,
      iterations: [],
      rewriteAttempted: false,
      rewriteSucceeded: false,
      maxIterations,
      stoppedReason: "rewrite_callback_not_configured"
    };
  }

  let currentMarkdown = input.markdown;
  let currentReview = initialReview;
  const iterations: Project300RewriteLoopResult["iterations"] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    try {
      const prompt = buildProject300RewritePrompt({
        title: input.title,
        markdown: currentMarkdown,
        review: currentReview
      });
      const rewritten = (await input.rewrite({ prompt, iteration, review: currentReview })).trim();
      if (!rewritten) {
        return finish("rewrite_failed");
      }
      const nextReview = reviewProject300GeneratedPost({
        title: input.title,
        markdown: rewritten,
        categoryKind: input.categoryKind,
        assetImageCount: input.assetImageCount,
        subjectNames: input.subjectNames,
        judgmentLedger: input.judgmentLedger,
        investmentOutline: input.investmentOutline
      });
      const accepted =
        nextReview.score >= currentReview.score &&
        nextReview.safetyScore >= currentReview.safetyScore &&
        nextReview.antiAiScore >= currentReview.antiAiScore &&
        nextReview.blockers.length <= currentReview.blockers.length;
      iterations.push({
        iteration,
        beforeScore: currentReview.score,
        afterScore: nextReview.score,
        accepted,
        responseHash: hashText(rewritten),
        responseLength: rewritten.length
      });
      if (accepted) {
        currentMarkdown = rewritten;
        currentReview = nextReview;
      }
      if (currentReview.ok) {
        return finish("passed_after_rewrite");
      }
    } catch {
      return finish("rewrite_failed");
    }
  }

  return finish("max_iterations_reached");

  function finish(stoppedReason: Project300RewriteLoopResult["stoppedReason"]): Project300RewriteLoopResult {
    return {
      finalMarkdown: currentMarkdown,
      initialReview,
      finalReview: currentReview,
      iterations,
      rewriteAttempted: iterations.length > 0 || stoppedReason === "rewrite_failed",
      rewriteSucceeded: currentReview.ok && currentMarkdown !== input.markdown,
      maxIterations,
      stoppedReason
    };
  }
}

export function buildProject300RewritePrompt(input: { title: string; markdown: string; review: Project300StyleReviewResult }) {
  return [
    "아래 Markdown 글을 project300.tistory.com 개인 투자 블로그 말투에 맞게 고쳐라.",
    "목표: 아래 voice anchor 예시처럼 존댓말 기반 설명형 블로그체로 고친다. 반말 메모체, 리포트체, 참고자료체, 방어적 안내문 중심 문체는 피한다.",
    "이 호출은 독립 편집 단계다. 새로운 시장 정보, 기사, 공시, 경험, 판단, 행동을 추가하지 않는다.",
    "FACT와 SYSTEM 값을 구분하고, 사용자가 제공하지 않은 JUDGMENT/ACTION을 1인칭으로 만들지 않는다.",
    "종목명과 숫자를 가렸을 때 다른 종목에도 붙는 문단은 삭제하거나 실제 입력 근거가 있는 문단으로만 재구성한다.",
    "RSS, 자동 수집, 검색 후보, 기사 전문 미저장 등 내부 작업 문장은 모두 발행 본문에서 제거한다.",
    "",
    "Voice anchor 예시:",
    ...PROJECT300_VOICE_ANCHOR_EXCERPT.map((line) => `- ${line}`),
    "",
    "중요: 종목명, 가격, 날짜, 링크, 이미지 Markdown, 표 데이터, 공시/뉴스 출처는 사실을 바꾸지 말고 유지한다.",
    "모든 카테고리 글에는 손실이 잦은 독자에게 혼자 감으로 거래하지 말고 급등포착에서 진입가·목표가·손절선과 매매 타점을 같이 확인해보라는 CTA를 자연스럽게 넣는다.",
    "필수 CTA 정책:",
    ...PROJECT300_REQUIRED_CTA_POLICY.map((line) => `- ${line}`),
    "금지: 매수/매도 지시, 수익 보장, 확정 급등, 프롬프트 설명, 검수표 출력.",
    "반드시 전체 Markdown 본문만 반환한다.",
    "",
    `제목: ${input.title}`,
    `현재 점수: ${input.review.score}`,
    "검수 실패/경고:",
    ...[
      ...input.review.missingRequiredElements,
      ...input.review.blockers,
      ...input.review.awkwardToneWarnings,
      ...input.review.repeatedPhraseWarnings,
      ...input.review.bannedPhrases,
      ...input.review.suggestions
    ].map((item) => `- ${item}`),
    "",
    "원문 Markdown:",
    input.markdown
  ].join("\n");
}

export function summarizeProject300StyleReview(review: Project300StyleReviewResult) {
  return {
    version: review.version,
    styleProfileVersion: review.styleProfileVersion,
    ok: review.ok,
    grade: review.grade,
    score: review.score,
    voiceScore: review.voiceScore,
    explanationScore: review.explanationScore,
    seoScore: review.seoScore,
    safetyScore: review.safetyScore,
    antiAiScore: review.antiAiScore,
    categoryKind: review.categoryKind,
    markdownHash: review.markdownHash,
    markdownLength: review.markdownLength,
    headingCount: review.headingCount,
    imageCount: review.imageCount,
    linkCount: review.linkCount,
    blockers: review.blockers,
    warnings: [...review.blockers, ...review.repeatedPhraseWarnings, ...review.awkwardToneWarnings, ...review.missingRequiredElements, ...review.bannedPhrases].slice(0, 30)
  };
}

function findMissingRequiredElements(input: { title: string; markdown: string; headingCount: number; imageCount: number; linkCount: number }) {
  const missing: string[] = [];
  if (!input.title.includes("급등포착")) {
    missing.push("title_missing_upsignal_keyword");
  }
  if (!/\d{4}[.-]\d{2}[.-]\d{2}/.test(input.title)) {
    missing.push("title_missing_date");
  }
  if (input.headingCount < 5) {
    missing.push("heading_count_too_low");
  }
  if (input.imageCount < 2) {
    missing.push("image_count_too_low");
  }
  if (input.linkCount < 3) {
    missing.push("source_link_count_too_low");
  }
  if (!input.markdown.includes("급등포착")) {
    missing.push("body_missing_upsignal_source");
  }
  if (!hasRequiredCta(input.markdown)) {
    missing.push("required_upsignal_trade-timing_cta_missing");
  }
  if (!input.markdown.includes("마무리") && !input.markdown.includes("다시 볼")) {
    missing.push("closing_section_missing");
  }
  return missing;
}

function findAwkwardToneWarnings(markdown: string) {
  return [
    ["report_tone_observation_candidate", /관찰 후보|관찰 대상|참고 자료/g],
    ["too_much_disclaimer_frontloaded", /특정 종목을 사거나 파는 행동을 권하는 글이 아니며/g],
    ["mechanical_top3_reason", /상위 3개가 먼저 보이는 이유/g],
    ["dry_metric_language", /단순 여력|종합점수 기준/g],
    ["mechanical_chart_checklist", /위 차트에서 제가 먼저 보는 건|첫 번째 체크는|두 번째는 \*\*손절선|세 번째는 \*\*뉴스와 공시/g],
    ["ai_like_etf_explainer", /ETF는 개별 종목처럼 한 기업의 실적만 보면 부족합니다|제가 보는 포인트는 두 가지입니다/g],
    ["casual_banmal_memo_tone", /눈에 들어왔다|흐름이 살아났다|먼저 봐야 한다|좋아 보인다/g],
    ["service_marketing_tone", /서비스를 제공합니다|무료로 확인 가능합니다|가입하시면|제공합니다/g]
  ]
    .filter(([, pattern]) => pattern instanceof RegExp && pattern.test(markdown))
    .map(([key]) => String(key));
}

function findRepeatedPhraseWarnings(markdown: string) {
  const warnings: string[] = [];
  for (const phrase of ["제 기준", "먼저 봅니다", "다시 열어볼", "확인합니다", "아쉬운", "자. 그럼", "급등포착 기준"]) {
    const count = markdown.split(phrase).length - 1;
    if (count >= 8) {
      warnings.push(`repeated_phrase:${phrase}:${count}`);
    }
  }
  return warnings;
}

function buildSuggestions(input: {
  voiceScore: number;
  explanationScore: number;
  seoScore: number;
  safetyScore: number;
  missingRequiredElements: string[];
  awkwardToneWarnings: string[];
  bannedPhrases: string[];
}) {
  const suggestions: string[] = [];
  if (input.voiceScore < 80) {
    suggestions.push("MACD 예시처럼 존댓말 기반 설명형 블로그체로 바꾸세요. `오늘은`, `우선`, `뭔소리냐구요?`, `자. 그럼`, `볼까요?`, `보완이 필요해 보입니다` 같은 흐름을 자연스럽게 쓰세요.");
  }
  if (input.explanationScore < 80) {
    suggestions.push("이미지 바로 아래에 차트 위치, 진입가, 손절선, 뉴스/공시를 연결한 해석 문단을 보강하세요.");
  }
  if (input.seoScore < 80) {
    suggestions.push("제목, 첫 문단, H2에 급등포착/국내주식/관심종목/종목명/날짜 키워드를 자연스럽게 보강하세요.");
  }
  if (input.safetyScore < 90) {
    suggestions.push("매수 지시나 수익 보장처럼 보이는 표현을 개인 판단 기록/확인 기준 표현으로 바꾸세요.");
  }
  if (input.missingRequiredElements.length > 0) {
    suggestions.push(`누락 요소를 채우세요: ${input.missingRequiredElements.join(", ")}`);
  }
  if (input.awkwardToneWarnings.length > 0 || input.bannedPhrases.length > 0) {
    suggestions.push("관찰 후보/참고자료/상위 이유 같은 딱딱한 표현을 사람 말투의 설명형 문장으로 바꾸세요.");
  }
  return suggestions;
}

function hasRequiredCta(markdown: string) {
  const normalized = markdown.replace(/\s+/g, "");
  const hasLoss = normalized.includes("손실") || normalized.includes("손실이잦");
  const hasUpSignal = normalized.includes("급등포착");
  const hasTiming = normalized.includes("매매타점") || normalized.includes("진입가") || normalized.includes("손절선") || normalized.includes("목표가");
  const hasSuggestionTone = normalized.includes("확인해보") || normalized.includes("보시는것도좋") || normalized.includes("확인해보시기");
  return hasLoss && hasUpSignal && hasTiming && hasSuggestionTone;
}

function countMatches(text: string, needles: string[]) {
  return needles.reduce((sum, needle) => sum + (text.includes(needle) ? 1 : 0), 0);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
