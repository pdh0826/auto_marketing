export type Project300CategoryKind = "daily_stock_review" | "focused_signal_review" | "etf_sector_review" | "futures_options_signal_record";

export interface Project300VoiceVariation {
  categoryKind: Project300CategoryKind;
  variationKey: string;
  openingTitle: string;
  summaryTitle: string;
  stockBlockTitleSuffix: string;
  etfBlockTitleSuffix: string;
  closingTitle: string;
}

const VARIATIONS: Record<Project300CategoryKind, Array<Omit<Project300VoiceVariation, "categoryKind" | "variationKey">>> = {
  daily_stock_review: [
    {
      openingTitle: "오늘은 이 종목들이 먼저 눈에 들어왔습니다",
      summaryTitle: "오늘의 투자매력도 TOP 종목 먼저 보기",
      stockBlockTitleSuffix: "차트를 다시 열어본 이유",
      etfBlockTitleSuffix: "시장 방향을 같이 보는 이유",
      closingTitle: "오늘 리뷰를 마무리하며"
    },
    {
      openingTitle: "오늘 리스트에서 제가 먼저 본 부분",
      summaryTitle: "오늘 먼저 확인할 종목 정리",
      stockBlockTitleSuffix: "신호와 재료를 같이 보는 이유",
      etfBlockTitleSuffix: "섹터 흐름을 같이 확인하는 이유",
      closingTitle: "내일 다시 볼 체크포인트"
    }
  ],
  focused_signal_review: [
    {
      openingTitle: "TOP 20 중 최근 신호가 찍힌 종목만 골랐습니다",
      summaryTitle: "오늘 집중해서 볼 TOP 3",
      stockBlockTitleSuffix: "신호가 나온 자리를 보는 이유",
      etfBlockTitleSuffix: "ETF로 보조 확인하기",
      closingTitle: "신호가 이어지는지 다시 볼 기준"
    },
    {
      openingTitle: "오늘은 넓게 보기보다 깊게 보겠습니다",
      summaryTitle: "집중 리뷰 종목 먼저 보기",
      stockBlockTitleSuffix: "차트와 뉴스를 같이 맞춰보기",
      etfBlockTitleSuffix: "시장 온도를 같이 확인하기",
      closingTitle: "오늘 정리한 기준"
    }
  ],
  etf_sector_review: [
    {
      openingTitle: "오늘은 개별 종목보다 ETF 흐름이 먼저 보입니다",
      summaryTitle: "오늘 ETF 리스트 먼저 보기",
      stockBlockTitleSuffix: "종목 신호도 함께 보는 이유",
      etfBlockTitleSuffix: "섹터 쪽 온기가 이어지는지 봅니다",
      closingTitle: "ETF 흐름을 보고 다시 확인할 부분"
    },
    {
      openingTitle: "종목보다 시장 방향을 먼저 읽어볼 날입니다",
      summaryTitle: "오늘 시장 방향을 보여주는 ETF",
      stockBlockTitleSuffix: "보조로 확인할 종목 신호",
      etfBlockTitleSuffix: "왜 이 ETF를 다시 보는지",
      closingTitle: "내일 이어서 볼 섹터 흐름"
    }
  ],
  futures_options_signal_record: [
    {
      openingTitle: "오늘은 선물·옵션 시그널을 같이 확인해 보겠습니다",
      summaryTitle: "오늘 먼저 볼 선물·옵션 신호",
      stockBlockTitleSuffix: "신호 화면을 같이 보는 이유",
      etfBlockTitleSuffix: "시황과 같이 확인할 부분",
      closingTitle: "다음 장에서 다시 볼 기준"
    },
    {
      openingTitle: "자. 그럼 오늘 선물 쪽 흐름부터 보겠습니다",
      summaryTitle: "오늘 체크한 시그널 정리",
      stockBlockTitleSuffix: "차트와 신호를 같이 볼까요?",
      etfBlockTitleSuffix: "미국장과 국내장 흐름 연결하기",
      closingTitle: "오늘 기록을 마무리하며"
    }
  ]
};

export function selectProject300VoiceVariation(input: {
  categoryKind: Project300CategoryKind;
  marketDate: string;
  seedParts?: string[];
}): Project300VoiceVariation {
  const candidates = VARIATIONS[input.categoryKind] ?? VARIATIONS.futures_options_signal_record;
  const seed = [input.categoryKind, input.marketDate, ...(input.seedParts ?? [])].join("|");
  const index = stableHash(seed) % candidates.length;
  return {
    categoryKind: input.categoryKind,
    variationKey: `${input.categoryKind}_${index + 1}`,
    ...candidates[index]
  };
}

export function inferProject300CategoryKind(value: unknown): Project300CategoryKind {
  if (value === "stock_signal_top3_review") {
    return "focused_signal_review";
  }
  if (value === "mixed_stock_etf_review") {
    return "daily_stock_review";
  }
  if (value === "etf_sector_review") {
    return "etf_sector_review";
  }
  return "futures_options_signal_record";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}
