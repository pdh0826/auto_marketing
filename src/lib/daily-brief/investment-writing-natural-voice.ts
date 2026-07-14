import { createHash } from "crypto";
import { PROJECT300_APPROVED_VOICE_EXAMPLES } from "@/lib/tistory/project300-investment-voice-corpus";

export const INVESTMENT_WRITING_NATURAL_VOICE_VERSION = "investment_writing_natural_voice_v1";

const NATURAL_VOICE_REPAIRS = [
  {
    code: "single_review_report_tone",
    pattern: /표는 여기서 한 번만 보겠습니다\.\s*아래에서는 숫자를 다시 줄줄이 설명하지 않고, 오늘 시장에서 눈에 들어오는 흐름만 짧게 정리하겠습니다\./g,
    replacement: "표를 같이 한번 살펴봤으니, 이제 오늘 시장에서 눈에 들어오는 흐름을 조금 더 풀어볼까요?"
  },
  {
    code: "morning_flow_report_ending",
    pattern: /아침에는 밤사이 미국장에서 나온 나스닥과 S&P500 신호를 먼저 보고, 국내장 개장 전에 참고할 흐름을 정리합니다\./g,
    replacement: "아침에는 밤사이 미국장에서 나온 나스닥과 S&P500 신호를 먼저 보고, 국내장 개장 전에 참고할 흐름을 정리해 보겠습니다."
  },
  {
    code: "next_candle_report_ending",
    pattern: /([^\n.!?]+ 선물 타점을 비교할 때는 방향뿐 아니라 이 수익이 다음 봉에서도) 유지되는지 확인하겠습니다\./g,
    replacement: "$1 유지되는지도 확인해봐야겠죠?"
  },
  {
    code: "numbers_single_review_tone",
    pattern: /숫자는 아래 표에서 한 번만 정리하고, 본문에서는/g,
    replacement: "숫자는 아래 표에서 먼저 살펴보고, 본문에서는"
  },
  {
    code: "chart_single_review_tone",
    pattern: /차트는 여기까지 보고, 그러면/g,
    replacement: "차트를 살펴봤으니, 이제"
  }
] as const;

const UNNATURAL_VOICE_PATTERNS = [
  { code: "single_review_report_tone", pattern: /한 번만 보겠습니다|한번만 보겠습니다/ },
  { code: "numbers_list_report_tone", pattern: /숫자를 다시 줄줄이 설명하지 않고/ },
  { code: "morning_flow_report_ending", pattern: /참고할 흐름을 정리합니다\./ },
  { code: "next_candle_report_ending", pattern: /다음 봉에서도 유지되는지 확인하겠습니다\./ }
] as const;

export interface InvestmentWritingNaturalVoiceReview {
  version: typeof INVESTMENT_WRITING_NATURAL_VOICE_VERSION;
  ok: boolean;
  issueCodes: string[];
  formalEndingCount: number;
  conversationalEndingCount: number;
  safeMetadata: {
    markdownHash: string;
    markdownLength: number;
  };
}

export function runInvestmentWritingNaturalVoiceSecondPass(markdown: string) {
  const initialReview = reviewInvestmentWritingNaturalVoice(markdown);
  let revisedMarkdown = markdown;
  const appliedCodes: string[] = [];

  for (const repair of NATURAL_VOICE_REPAIRS) {
    const next = revisedMarkdown.replace(repair.pattern, repair.replacement);
    if (next !== revisedMarkdown) appliedCodes.push(repair.code);
    revisedMarkdown = next;
  }

  const finalReview = reviewInvestmentWritingNaturalVoice(revisedMarkdown);
  return {
    version: INVESTMENT_WRITING_NATURAL_VOICE_VERSION,
    attempted: initialReview.issueCodes.length > 0,
    changed: revisedMarkdown !== markdown,
    appliedCodes: Array.from(new Set(appliedCodes)),
    initialReview,
    finalReview,
    markdown: revisedMarkdown
  };
}

export function reviewInvestmentWritingNaturalVoice(markdown: string): InvestmentWritingNaturalVoiceReview {
  const issueCodes: string[] = UNNATURAL_VOICE_PATTERNS.flatMap(({ code, pattern }) => (pattern.test(markdown) ? [code] : []));
  const formalEndingCount = countMatches(markdown, /(?:정리|확인|기록|비교)하겠습니다\./g);
  const conversationalEndingCount = countMatches(markdown, /(?:볼까요|살펴볼까요|해봐야겠죠|어떨까요)\?/g);
  if (formalEndingCount >= 10 && conversationalEndingCount === 0) issueCodes.push("formal_ending_overuse");

  return {
    version: INVESTMENT_WRITING_NATURAL_VOICE_VERSION,
    ok: issueCodes.length === 0,
    issueCodes: Array.from(new Set(issueCodes)),
    formalEndingCount,
    conversationalEndingCount,
    safeMetadata: {
      markdownHash: createHash("sha256").update(markdown).digest("hex"),
      markdownLength: markdown.length
    }
  };
}

export function buildInvestmentWritingNaturalVoiceGptPrompt(input: {
  title: string;
  markdown: string;
  issueCodes: string[];
}) {
  return [
    "아래 Markdown 투자 블로그 글에서 어색한 문장과 보고서식 말투만 최소한으로 고쳐라.",
    "전체 글을 새로 쓰지 말고, 문제가 있는 문장과 그 앞뒤 연결 문장만 수정한다.",
    "기본 말투는 개인이 독자에게 차트와 시장 이야기를 설명하는 존댓말 블로그체다.",
    "`정리합니다`, `확인하겠습니다`, `기록하겠습니다`를 반복하지 말고 `같이 살펴볼까요?`, `확인해봐야겠죠?`, `조금 더 보겠습니다` 같은 자연스러운 흐름을 문맥에 맞게 섞는다.",
    "`한 번만 보겠습니다`, `숫자를 줄줄이 설명하지 않고`처럼 글 작성 절차를 설명하는 메타 문장은 쓰지 않는다.",
    "반말, 과장, 매수·매도 지시, 수익 보장 표현을 추가하지 않는다.",
    "새로운 시장 정보, 기사, 공시, 경험, 판단 또는 숫자를 만들지 않는다.",
    "제목, 숫자, 날짜, 종목명, 표의 모든 행, Markdown 링크 URL, HTML media 주석, 이미지 순서와 CTA는 글자 하나도 바꾸지 않는다.",
    "Markdown 본문만 반환하고 코드 펜스나 설명은 붙이지 않는다.",
    "",
    "말투 사전 예시:",
    ...PROJECT300_APPROVED_VOICE_EXAMPLES.map((item) => `- ${item.pattern}`),
    "",
    `제목: ${input.title}`,
    `2차 검수 이슈: ${input.issueCodes.join(", ") || "natural_voice_review"}`,
    "",
    "원문 Markdown:",
    input.markdown
  ].join("\n");
}

export function preservesInvestmentWritingProtectedContent(before: string, after: string) {
  const checks = [
    ["media", extract(before, /<!--\s*media:[^>]+-->/g), extract(after, /<!--\s*media:[^>]+-->/g)],
    ["urls", extract(before, /\]\((https?:\/\/[^)]+)\)/g, 1), extract(after, /\]\((https?:\/\/[^)]+)\)/g, 1)],
    ["headings", extractHeadingLines(before), extractHeadingLines(after)],
    ["tables", extractTableLines(before), extractTableLines(after)],
    ["numbers", extract(before, /[+-]?\d[\d,.]*(?:%|pt)?/g), extract(after, /[+-]?\d[\d,.]*(?:%|pt)?/g)]
  ] as const;
  const changedCodes = checks.filter(([, left, right]) => !sameValues(left, right)).map(([code]) => code);
  return { ok: changedCodes.length === 0, changedCodes };
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}

function extract(value: string, pattern: RegExp, group = 0) {
  return Array.from(value.matchAll(pattern), (match) => match[group] ?? "");
}

function extractTableLines(value: string) {
  return value.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
}

function extractHeadingLines(value: string) {
  return value.split(/\r?\n/).filter((line) => /^#{1,6}\s+/.test(line.trim()));
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
