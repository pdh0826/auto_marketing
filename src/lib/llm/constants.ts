import type { LlmProviderType, LlmTaskType } from "./types";

export const LLM_PROVIDER_TYPES: Array<{ value: LlmProviderType; label: string }> = [
  { value: "openai", label: "OpenAI API" },
  { value: "local", label: "Local LLM" }
];

export const LLM_TASK_TYPES: Array<{ value: LlmTaskType; label: string }> = [
  { value: "content_plan", label: "글 기획서 생성" },
  { value: "content_draft", label: "본문 초안 생성" },
  { value: "html_convert", label: "HTML 변환" },
  { value: "quality_check", label: "품질검사" },
  { value: "style_rewrite", label: "문체 변환" },
  { value: "cta_generate", label: "CTA 생성" },
  { value: "keyword_analyze", label: "키워드 분석" },
  { value: "serp_analyze", label: "검색 의도 분석" },
  { value: "image_analyze", label: "이미지 분석" }
];

export function getTaskLabel(taskType: LlmTaskType) {
  return LLM_TASK_TYPES.find((task) => task.value === taskType)?.label ?? taskType;
}

export function getProviderTypeLabel(providerType: LlmProviderType) {
  return LLM_PROVIDER_TYPES.find((provider) => provider.value === providerType)?.label ?? providerType;
}
