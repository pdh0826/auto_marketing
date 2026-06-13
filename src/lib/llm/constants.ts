import type { LlmApiFormat, LlmInvocationMode, LlmProviderTestStatus, LlmProviderType, LlmTaskType } from "./types";

export const LLM_PROVIDER_TYPES: Array<{ value: LlmProviderType; label: string }> = [
  { value: "openai", label: "OpenAI API" },
  { value: "local", label: "Local LLM" },
  { value: "external_http", label: "External HTTP" },
  { value: "local_http", label: "Local HTTP" },
  { value: "cli", label: "CLI" }
];

export const LLM_INVOCATION_MODES: Array<{ value: LlmInvocationMode; label: string }> = [
  { value: "external_http", label: "External HTTP" },
  { value: "local_http", label: "Local HTTP" },
  { value: "cli", label: "CLI" }
];

export const LLM_API_FORMATS: Array<{ value: LlmApiFormat; label: string }> = [
  { value: "openai_compatible", label: "OpenAI-compatible" },
  { value: "ollama_compatible", label: "Ollama-compatible" },
  { value: "custom_http", label: "Custom HTTP" },
  { value: "custom_cli", label: "Custom CLI" }
];

export const LLM_TEST_STATUSES: Array<{ value: LlmProviderTestStatus; label: string }> = [
  { value: "untested", label: "untested" },
  { value: "success", label: "success" },
  { value: "failed", label: "failed" }
];

export const LLM_TASK_TYPES: Array<{ value: LlmTaskType; label: string }> = [
  { value: "provider_test", label: "Provider 연결 테스트" },
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

export const LLM_ROUTE_TASK_TYPES = LLM_TASK_TYPES.filter((task) => task.value !== "provider_test");

export function getTaskLabel(taskType: LlmTaskType) {
  return LLM_TASK_TYPES.find((task) => task.value === taskType)?.label ?? taskType;
}

export function getProviderTypeLabel(providerType: LlmProviderType) {
  return LLM_PROVIDER_TYPES.find((provider) => provider.value === providerType)?.label ?? providerType;
}

export function getInvocationModeLabel(invocationMode: LlmInvocationMode) {
  return LLM_INVOCATION_MODES.find((mode) => mode.value === invocationMode)?.label ?? invocationMode;
}

export function getApiFormatLabel(apiFormat: LlmApiFormat) {
  return LLM_API_FORMATS.find((format) => format.value === apiFormat)?.label ?? apiFormat;
}
