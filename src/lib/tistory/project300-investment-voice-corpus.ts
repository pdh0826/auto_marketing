export const PROJECT300_INVESTMENT_VOICE_CORPUS_VERSION = "project300_investment_voice_corpus_v1";

export type Project300SectionRole =
  | "opening_observation"
  | "easy_explanation"
  | "stock_comparison"
  | "chart_interpretation"
  | "news_transition"
  | "number_interpretation"
  | "failure_or_doubt"
  | "action_condition"
  | "closing_next_record";

export interface Project300ApprovedVoiceExample {
  id: string;
  role: Project300SectionRole;
  mode: "tistory_technical" | "tistory_investment_record";
  approved: true;
  sourceType: "user_provided_blog_excerpt" | "user_provided_rewrite_example";
  pattern: string;
  usageNote: string;
}

export const PROJECT300_APPROVED_VOICE_EXAMPLES: Project300ApprovedVoiceExample[] = [
  {
    id: "INV-OPEN-01",
    role: "opening_observation",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_rewrite_example",
    pattern: "요즘 같은 업종 종목이 상위 후보에 자주 올라오네요. 먼저 대표 종목부터 볼까요?",
    usageNote: "실제 업종 군집이 확인된 경우에만 사용한다."
  },
  {
    id: "INV-OPEN-02",
    role: "opening_observation",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_blog_excerpt",
    pattern: "지난 기록 이후 시간이 꽤 지났습니다. 다시 보니 이번에는 눈에 들어오는 숫자가 하나 있습니다.",
    usageNote: "과거 기록과 실제 연결점이 있을 때 사용한다."
  },
  {
    id: "INV-EASY-01",
    role: "easy_explanation",
    mode: "tistory_technical",
    approved: true,
    sourceType: "user_provided_blog_excerpt",
    pattern: "정의만 보면 어렵습니다. 뭔소리냐구요? 그냥 차트에서 무엇이 바뀌는지 보면 됩니다.",
    usageNote: "기술 지표를 실제 화면으로 번역할 때만 사용한다."
  },
  {
    id: "INV-COMPARE-01",
    role: "stock_comparison",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_rewrite_example",
    pattern: "두 종목의 그림이 거의 같다면 굳이 둘을 따로 길게 볼 필요는 없습니다. 실제 거래가 더 붙는 쪽을 보면 되겠습니다.",
    usageNote: "같은 업종과 유사 신호가 실제로 확인된 종목 비교에 사용한다."
  },
  {
    id: "INV-CHART-01",
    role: "chart_interpretation",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_rewrite_example",
    pattern: "신호가 한 번 찍힌 것보다 같은 가격대에서 여러 번 나온 게 더 눈에 들어옵니다. 이평선 위로 올라온 뒤 버티는지도 같이 볼 만합니다.",
    usageNote: "반복 신호와 이동평균 위치가 실제 차트에서 확인된 경우에만 사용한다."
  },
  {
    id: "INV-CHART-02",
    role: "chart_interpretation",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_blog_excerpt",
    pattern: "이런.... 추세는 올라가는데 반대 방향 신호가 나왔습니다. 손실 구간이 왜 생겼는지 차트에서 다시 찾아볼 필요가 있습니다.",
    usageNote: "신호와 추세가 실제로 충돌하는 경우에만 사용한다."
  },
  {
    id: "INV-NEWS-01",
    role: "news_transition",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_rewrite_example",
    pattern: "차트는 여기까지 보고, 그러면 최근 기사나 공시도 좀 살펴볼까요?",
    usageNote: "검증된 기사 또는 공시가 뒤에 이어질 때 사용한다."
  },
  {
    id: "INV-NUMBER-01",
    role: "number_interpretation",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_blog_excerpt",
    pattern: "컨센서스 숫자만 놓고 보면 이 정도인데 실제 결과는 더 나왔습니다. 그럼 연간 숫자도 다시 계산해봐야 합니다.",
    usageNote: "컨센서스와 실제 실적 출처가 모두 확인된 경우에만 사용한다."
  },
  {
    id: "INV-NUMBER-02",
    role: "number_interpretation",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_blog_excerpt",
    pattern: "비율만 보면 감이 잘 안 옵니다. 실제 금액으로 바꾸면 이야기가 조금 달라집니다.",
    usageNote: "수치의 체감 규모를 설명할 때 사용한다."
  },
  {
    id: "INV-DOUBT-01",
    role: "failure_or_doubt",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_blog_excerpt",
    pattern: "결과만 보면 괜찮아 보이지만 중간에는 예상대로 되지 않은 구간도 있었습니다. 이 부분은 보완이 필요해 보입니다.",
    usageNote: "실제 실패나 불확실성이 입력된 경우에만 사용한다."
  },
  {
    id: "INV-ACTION-01",
    role: "action_condition",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_rewrite_example",
    pattern: "장 초반부터 가격이 크게 뜨면 따라가지 않고, 기준 부근에서 거래가 붙는지 다시 볼 생각입니다.",
    usageNote: "사용자가 해당 행동 조건을 직접 제공한 경우에만 사용한다."
  },
  {
    id: "INV-ACTION-02",
    role: "action_condition",
    mode: "tistory_investment_record",
    approved: true,
    sourceType: "user_provided_blog_excerpt",
    pattern: "과거 기록이 미래에도 그대로 이어질 거라 믿고 바로 거래하면 손실이 납니다. 충분히 확인한 뒤 다음 행동을 정해야겠습니다.",
    usageNote: "검증 부족 또는 과거 성과 의존 위험을 설명할 때 사용한다."
  },
  {
    id: "INV-CLOSE-01",
    role: "closing_next_record",
    mode: "tistory_technical",
    approved: true,
    sourceType: "user_provided_blog_excerpt",
    pattern: "다음 기록에는 실제 결과가 어떻게 이어졌는지 다시 적어 보겠습니다. 감사합니다.",
    usageNote: "실제로 후속 기록을 만들 계획이 있을 때 사용한다."
  }
];

export const PROJECT300_INVESTMENT_FORBIDDEN_PATTERNS = [
  "위 차트에서 제가 먼저 보는 건",
  "제 기준에서 첫 번째 체크는",
  "한 번 더 차트를 열어볼 이유",
  "목표가만 보면 글이 달콤해지지만",
  "차트와 뉴스가 같은 방향인지",
  "아쉬운 점도 있습니다",
  "정리하면",
  "자료를 먼저 모아보면",
  "자동 수집 결과",
  "RSS 검색 결과",
  "기사 전문은 저장하지 않고",
  "검토 후보"
] as const;

export function selectProject300VoiceExamples(input: { roles: Project300SectionRole[]; seed: string; limitPerRole?: number }) {
  const limitPerRole = Math.max(1, Math.min(input.limitPerRole ?? 2, 4));
  return input.roles.flatMap((role) => {
    const candidates = PROJECT300_APPROVED_VOICE_EXAMPLES.filter((item) => item.role === role && item.approved);
    if (candidates.length <= limitPerRole) return candidates;
    const start = stableHash(`${input.seed}:${role}`) % candidates.length;
    return Array.from({ length: limitPerRole }, (_, index) => candidates[(start + index) % candidates.length]).filter(
      (item): item is Project300ApprovedVoiceExample => Boolean(item)
    );
  });
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}
