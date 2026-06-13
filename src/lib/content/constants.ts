import type { ContentMode, ContentStatus } from "./types";

export const CONTENT_MODE_OPTIONS: Array<{ value: ContentMode; label: string; hint: string }> = [
  {
    value: "seo_keyword",
    label: "SEO 키워드",
    hint: "대상 키워드 입력을 권장합니다."
  },
  {
    value: "service_promotion",
    label: "서비스 홍보",
    hint: "서비스/브랜드 프로필 선택을 권장합니다. 단, sourceMemo에 직접 서비스 설명을 입력할 수도 있습니다."
  },
  {
    value: "memo_expand",
    label: "메모 확장",
    hint: "짧은 메모나 요약을 입력하면 후속 패치에서 글 기획서로 확장할 예정입니다."
  },
  {
    value: "existing_draft_improve",
    label: "기존 글 보강",
    hint: "사용자가 직접 입력한 기존 글/초안 보강용입니다. 경쟁글 복사·재작성·재가공 용도가 아닙니다."
  }
];

export const CONTENT_STATUS_OPTIONS: Array<{ value: ContentStatus; label: string }> = [
  { value: "idea", label: "idea" },
  { value: "planned", label: "planned" },
  { value: "drafted", label: "drafted" },
  { value: "quality_review", label: "quality_review" },
  { value: "approved", label: "approved" },
  { value: "scheduled", label: "scheduled" },
  { value: "published", label: "published" },
  { value: "failed", label: "failed" },
  { value: "rewrite_needed", label: "rewrite_needed" }
];

export function getContentModeLabel(mode: ContentMode) {
  return CONTENT_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

export function getContentModeHint(mode: ContentMode | "") {
  return CONTENT_MODE_OPTIONS.find((option) => option.value === mode)?.hint ?? "";
}
