import type { Prisma } from "@prisma/client";
import {
  PROJECT300_STYLE_PROFILE_VERSION,
  buildProject300GenerationPrompt,
  buildProject300ImageExplanationPolicy,
  buildProject300LayoutTemplate,
  buildProject300ReviewRewriteLoopPolicy,
  buildProject300SeoReviewChecklist,
  buildProject300TonePolicy
} from "./project300-style";

export interface Project300TistoryExportMetadata {
  blogName: string;
  blogUrl: string;
  channelPurpose: string;
  recommendedCategoryPath: string[];
  recommendedCategoryLabel: string;
  recommendedTags: string[];
  menuSetupSteps: string[];
  uploadChecklist: string[];
  duplicateContentPolicy: string[];
  tonePolicy: string[];
  styleProfileVersion: string;
  layoutTemplate: string[];
  imageExplanationPolicy: string[];
  reviewRewriteLoopPolicy: string[];
  seoReviewChecklist: string[];
  generationPrompt: string;
}

type Project300ContentItem = Prisma.ContentItemGetPayload<{
  include: {
    blog: true;
    assets: true;
  };
}>;

export const PROJECT300_TISTORY_PROFILE = {
  blogName: "300 프로젝트",
  blogUrl: "https://project300.tistory.com/",
  rootCategory: "급등포착 분석자료",
  categories: {
    dailyStockReview: ["급등포착 분석자료", "오늘의 관심종목 리뷰"],
    focusedSignalReview: ["급등포착 분석자료", "종목별 신호 집중분석"],
    etfSectorReview: ["급등포착 분석자료", "ETF 섹터 흐름 리뷰"],
    futuresOptionsSignalRecord: ["급등포착 분석자료", "선물·옵션 시그널 기록"]
  }
} as const;

export function buildProject300CategoryUrl(categoryPath: readonly string[]) {
  return `${PROJECT300_TISTORY_PROFILE.blogUrl}category/${categoryPath.map((part) => encodeURIComponent(part)).join("/")}`;
}

export function buildProject300CategoryLinks() {
  return {
    dailyStockReview: {
      label: PROJECT300_TISTORY_PROFILE.categories.dailyStockReview.at(-1) ?? "오늘의 관심종목 리뷰",
      url: buildProject300CategoryUrl(PROJECT300_TISTORY_PROFILE.categories.dailyStockReview)
    },
    focusedSignalReview: {
      label: PROJECT300_TISTORY_PROFILE.categories.focusedSignalReview.at(-1) ?? "종목별 신호 집중분석",
      url: buildProject300CategoryUrl(PROJECT300_TISTORY_PROFILE.categories.focusedSignalReview)
    },
    etfSectorReview: {
      label: PROJECT300_TISTORY_PROFILE.categories.etfSectorReview.at(-1) ?? "ETF 섹터 흐름 리뷰",
      url: buildProject300CategoryUrl(PROJECT300_TISTORY_PROFILE.categories.etfSectorReview)
    },
    futuresOptionsSignalRecord: {
      label: PROJECT300_TISTORY_PROFILE.categories.futuresOptionsSignalRecord.at(-1) ?? "선물·옵션 시그널 기록",
      url: buildProject300CategoryUrl(PROJECT300_TISTORY_PROFILE.categories.futuresOptionsSignalRecord)
    }
  };
}

export function buildProject300TistoryMetadata(contentItem: Project300ContentItem): Project300TistoryExportMetadata {
  const plan = readPlan(contentItem.planJson);
  const categoryPath = inferCategoryPath(plan);
  const selectedNames = extractSelectedNames(contentItem, plan);
  const modeLabel = inferModeLabel(plan);
  const tags = Array.from(
    new Set(
      [
        "급등포착",
        "시스템트레이딩",
        "국내주식",
        "신호분석",
        modeLabel,
        ...selectedNames.slice(0, 5)
      ].filter(Boolean)
    )
  ).slice(0, 10);

  return {
    blogName: PROJECT300_TISTORY_PROFILE.blogName,
    blogUrl: PROJECT300_TISTORY_PROFILE.blogUrl,
    channelPurpose:
      "Blogger Daily Brief와 중복되지 않게, project300 티스토리에는 신호가 나온 이유와 차트/뉴스/공시 해석을 중심으로 한 분석형 자료를 축적합니다.",
    recommendedCategoryPath: [...categoryPath],
    recommendedCategoryLabel: categoryPath.join(" > "),
    recommendedTags: tags,
    menuSetupSteps: [
      "티스토리 관리자 > 콘텐츠 > 카테고리 관리로 이동합니다.",
      "`급등포착 분석자료` 상위 카테고리를 추가합니다.",
      "`오늘의 관심종목 리뷰`, `종목별 신호 집중분석`, `ETF 섹터 흐름 리뷰`, `선물·옵션 시그널 기록` 하위 카테고리를 추가합니다.",
      "스킨 편집 또는 메뉴 관리에서 `급등포착 분석자료` 카테고리를 블로그 메뉴에 노출합니다.",
      "첫 글은 발행 전 미리보기에서 기존 project300 글 목록과 톤이 이어지는지 확인합니다."
    ],
    uploadChecklist: [
      `추천 카테고리: ${categoryPath.join(" > ")}`,
      `추천 태그: ${tags.join(", ")}`,
      "제목은 post-title.txt를 사용하되, 날짜와 핵심 종목명이 과하게 길면 티스토리 편집기에서 사람이 다듬습니다.",
      "HTML 모드에서 post.html을 먼저 붙여넣습니다.",
      "이미지가 누락되면 post-inline.html을 테스트하되, 본문이 너무 무거워지면 assets 폴더 이미지를 직접 업로드합니다.",
      "본문이 Blogger Daily Brief와 같은 요약글처럼 보이지 않는지 확인합니다.",
      "마지막 투자 판단/책임 안내 문구가 유지되는지 확인합니다.",
      "최종 저장/발행은 티스토리 관리자에서 수동으로 수행합니다."
    ],
    duplicateContentPolicy: [
      "Blogger는 매일 아침 넓게 훑는 TOP 8 브리핑 채널로 둡니다.",
      "project300 티스토리는 최근 신호 TOP3 또는 ETF/섹터를 깊게 설명하는 분석 채널로 둡니다.",
      "같은 스크린샷을 일부 쓸 수는 있지만, 제목·구성·본문 의도는 다르게 유지합니다.",
      "티스토리 본문은 `왜 이 신호를 다시 볼 만한지`와 `뉴스/공시를 어떻게 연결해 볼지`를 중심으로 작성합니다."
    ],
    tonePolicy: buildProject300TonePolicy(),
    styleProfileVersion: PROJECT300_STYLE_PROFILE_VERSION,
    layoutTemplate: buildProject300LayoutTemplate(),
    imageExplanationPolicy: buildProject300ImageExplanationPolicy(),
    reviewRewriteLoopPolicy: buildProject300ReviewRewriteLoopPolicy(),
    seoReviewChecklist: buildProject300SeoReviewChecklist(),
    generationPrompt: buildProject300GenerationPrompt()
  };
}

function inferCategoryPath(plan: Record<string, unknown> | null) {
  if (plan?.kind === "daily_tistory_signal_review") {
    const mode = readSelectionMode(plan);
    if (mode === "etf_sector_review") {
      return PROJECT300_TISTORY_PROFILE.categories.etfSectorReview;
    }
    if (mode === "mixed_stock_etf_review") {
      return PROJECT300_TISTORY_PROFILE.categories.dailyStockReview;
    }
    return PROJECT300_TISTORY_PROFILE.categories.focusedSignalReview;
  }
  if (plan?.kind === "daily_brief") {
    return PROJECT300_TISTORY_PROFILE.categories.dailyStockReview;
  }
  return PROJECT300_TISTORY_PROFILE.categories.futuresOptionsSignalRecord;
}

function inferModeLabel(plan: Record<string, unknown> | null) {
  const mode = readSelectionMode(plan);
  if (mode === "etf_sector_review") {
    return "ETF리뷰";
  }
  if (mode === "mixed_stock_etf_review") {
    return "종목ETF리뷰";
  }
  if (mode === "stock_signal_top3_review") {
    return "TOP3집중분석";
  }
  return "분석자료";
}

function extractSelectedNames(contentItem: Project300ContentItem, plan: Record<string, unknown> | null) {
  const selection = isObject(plan?.selection) ? plan.selection : null;
  const names = Array.isArray(selection?.selectedStockNames) ? selection.selectedStockNames : [];
  const safeNames = names.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (safeNames.length > 0) {
    return safeNames.map((item) => item.trim());
  }
  return (contentItem.title ?? "")
    .split(/[:|]/)
    .flatMap((part) => part.split(/[·,]/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !/오늘|국내주식|집중|분석|급등포착|\d{4}/.test(part))
    .slice(0, 5);
}

function readSelectionMode(plan: Record<string, unknown> | null) {
  const selection = isObject(plan?.selection) ? plan.selection : null;
  return typeof selection?.mode === "string" ? selection.mode : null;
}

function readPlan(value: Prisma.JsonValue | null) {
  return isObject(value) ? value : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
