import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import type { LlmTaskRouteAdmin } from "@/lib/llm/admin-types";

export type ReadinessStatus = "pass" | "warn" | "fail";

export interface ContentPlanReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  message: string;
}

export interface ContentPlanPromptPreview {
  system: string;
  user: string;
  outputFormat: string;
}

export interface ContentPlanDryRunResult {
  ready: boolean;
  checks: ContentPlanReadinessCheck[];
  promptPreview: ContentPlanPromptPreview;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function buildContentPlanDryRun(
  contentItem: ContentItemAdmin,
  assets: ContentAssetAdmin[],
  route: LlmTaskRouteAdmin | null
): ContentPlanDryRunResult {
  const checks = buildReadinessChecks(contentItem, assets, route);

  return {
    ready: checks.every((check) => check.status !== "fail"),
    checks,
    promptPreview: {
      system: buildSystemPromptPreview(),
      user: buildUserPromptPreview(contentItem, assets),
      outputFormat: buildOutputFormatPreview()
    }
  };
}

function buildReadinessChecks(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[], route: LlmTaskRouteAdmin | null): ContentPlanReadinessCheck[] {
  const checks: ContentPlanReadinessCheck[] = [];
  const primaryProvider = route?.primaryProvider;
  const primaryModel = route?.primaryModel;
  const fallbackProvider = route?.fallbackProvider;
  const fallbackModel = route?.fallbackModel;

  checks.push({
    key: "route_exists",
    label: "content_plan route",
    status: route ? "pass" : "fail",
    message: route ? "content_plan Task Route가 등록되어 있습니다." : "content_plan Task Route가 없습니다."
  });

  checks.push({
    key: "route_enabled",
    label: "Route enabled",
    status: route?.isEnabled ? "pass" : "fail",
    message: route?.isEnabled ? "content_plan route가 활성화되어 있습니다." : "content_plan route가 비활성화되어 있습니다."
  });

  checks.push({
    key: "primary_provider",
    label: "Primary provider",
    status: primaryProvider ? "pass" : "fail",
    message: primaryProvider ? `Primary Provider: ${primaryProvider.name}` : "Primary Provider가 없습니다."
  });

  checks.push({
    key: "primary_model",
    label: "Primary model",
    status: primaryModel ? "pass" : "fail",
    message: primaryModel ? `Primary Model: ${primaryModel.displayName ?? primaryModel.name}` : "Primary Model이 없습니다."
  });

  checks.push({
    key: "primary_provider_enabled",
    label: "Provider enabled",
    status: primaryProvider?.isEnabled ? "pass" : "fail",
    message: primaryProvider?.isEnabled ? "Primary Provider가 활성화되어 있습니다." : "Primary Provider가 비활성화되어 있습니다."
  });

  checks.push({
    key: "primary_model_enabled",
    label: "Model enabled",
    status: primaryModel?.isEnabled ? "pass" : "fail",
    message: primaryModel?.isEnabled ? "Primary Model이 활성화되어 있습니다." : "Primary Model이 비활성화되어 있습니다."
  });

  checks.push({
    key: "primary_provider_test_success",
    label: "Provider test",
    status: primaryProvider?.lastTestStatus === "success" ? "pass" : "fail",
    message:
      primaryProvider?.lastTestStatus === "success"
        ? "Primary Provider 연결 테스트가 성공 상태입니다."
        : `Primary Provider 연결 테스트 상태가 success가 아닙니다: ${primaryProvider?.lastTestStatus ?? "unknown"}`
  });

  checks.push({
    key: "primary_provider_tested_at",
    label: "Test timestamp",
    status: primaryProvider?.lastTestedAt ? (isOlderThanOneDay(primaryProvider.lastTestedAt) ? "warn" : "pass") : "warn",
    message: primaryProvider?.lastTestedAt
      ? isOlderThanOneDay(primaryProvider.lastTestedAt)
        ? "Primary Provider 연결 테스트가 24시간보다 오래되었습니다."
        : "Primary Provider 연결 테스트 시간이 최근 24시간 이내입니다."
      : "Primary Provider 연결 테스트 시간이 없습니다."
  });

  checks.push({
    key: "content_input",
    label: "Content input",
    status: contentItem.sourceMemo || contentItem.targetKeyword ? "pass" : "fail",
    message: contentItem.sourceMemo || contentItem.targetKeyword ? "sourceMemo 또는 targetKeyword가 있습니다." : "sourceMemo 또는 targetKeyword가 필요합니다."
  });

  checks.push({
    key: "blog_profile",
    label: "Blog profile",
    status: contentItem.blog ? "pass" : "warn",
    message: contentItem.blog ? `Blog profile: ${contentItem.blog.name}` : "연결된 Blog profile이 없습니다."
  });

  checks.push({
    key: "brand_profile",
    label: "Brand profile",
    status: contentItem.brandProfile ? "pass" : "warn",
    message: contentItem.brandProfile ? `Brand profile: ${contentItem.brandProfile.name}` : "연결된 Brand profile이 없습니다."
  });

  checks.push({
    key: "attached_media",
    label: "Attached media",
    status: assets.length > 0 ? "pass" : "warn",
    message: assets.length > 0 ? `첨부 미디어 ${assets.length}개가 prompt preview에 반영됩니다.` : "첨부 미디어가 없습니다."
  });

  checks.push({
    key: "fallback_exists",
    label: "Fallback route",
    status: fallbackProvider || fallbackModel ? "pass" : "warn",
    message: fallbackProvider || fallbackModel ? "Fallback Provider/Model이 설정되어 있습니다." : "Fallback Provider/Model이 없습니다."
  });

  if (route && fallbackProvider && fallbackModel) {
    checks.push({
      key: "fallback_distinct",
      label: "Fallback distinct",
      status: route.fallbackProviderId === route.primaryProviderId && route.fallbackModelId === route.primaryModelId ? "warn" : "pass",
      message:
        route.fallbackProviderId === route.primaryProviderId && route.fallbackModelId === route.primaryModelId
          ? "Fallback이 primary와 동일합니다."
          : "Fallback이 primary와 다르게 설정되어 있습니다."
    });

    checks.push({
      key: "fallback_provider_test",
      label: "Fallback provider test",
      status: fallbackProvider.lastTestStatus === "success" ? "pass" : "warn",
      message:
        fallbackProvider.lastTestStatus === "success"
          ? "Fallback Provider 연결 테스트가 성공 상태입니다."
          : `Fallback Provider 연결 테스트 상태가 success가 아닙니다: ${fallbackProvider.lastTestStatus}`
    });
  }

  return checks;
}

export function buildSystemPromptPreview() {
  return [
    "You are a helpful, original, people-first content planner for Blog Growth Agent.",
    "Create a content plan that is useful to readers and suitable for human review before publishing.",
    "Do not copy, rewrite, or closely imitate competitor articles sentence-by-sentence.",
    "Avoid keyword stuffing, exaggerated advertising, unsupported claims, and manipulative SEO tactics.",
    "Do not include guaranteed profit, buy/sell recommendations, success-rate claims, return examples, or risk-free wording.",
    "For stock/investment services, describe the service as an information/reference tool only.",
    "Avoid phrases that imply the tool can safely time purchases or guarantee better investment outcomes.",
    "CTA must be informational and moderate, not aggressive.",
    "Apply the same safety rules to Korean content. Do not generate phrases such as 수익률 예시, 성공 사례, 안전하게 매수, 안전한 투자, 수익 보장, 원금 보장, or 리스크 없음.",
    "Design the result as a JSON object matching the requested planJson template."
  ].join("\n");
}

export function buildUserPromptPreview(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[]) {
  const payload = {
    contentItem: {
      title: contentItem.title,
      mode: contentItem.mode,
      status: contentItem.status,
      targetKeyword: contentItem.targetKeyword,
      sourceMemo: contentItem.sourceMemo
    },
    blogProfile: contentItem.blog
      ? {
          name: contentItem.blog.name,
          mainTopic: contentItem.blog.mainTopic,
          subTopics: contentItem.blog.subTopics,
          targetReader: contentItem.blog.targetReader,
          tone: contentItem.blog.tone,
          locale: contentItem.blog.locale,
          forbiddenPhrases: contentItem.blog.forbiddenPhrases,
          preferredPhrases: contentItem.blog.preferredPhrases,
          defaultContentLength: contentItem.blog.defaultContentLength,
          defaultCtaStrength: contentItem.blog.defaultCtaStrength
        }
      : null,
    brandProfile: contentItem.brandProfile
      ? {
          name: contentItem.brandProfile.name,
          serviceName: contentItem.brandProfile.serviceName,
          shortDescription: contentItem.brandProfile.shortDescription,
          targetUsers: contentItem.brandProfile.targetUsers,
          coreFeatures: contentItem.brandProfile.coreFeatures,
          problemsSolved: contentItem.brandProfile.problemsSolved,
          ctaWeak: contentItem.brandProfile.ctaWeak,
          ctaNormal: contentItem.brandProfile.ctaNormal,
          ctaStrong: contentItem.brandProfile.ctaStrong,
          riskDisclaimer: contentItem.brandProfile.riskDisclaimer
        }
      : null,
    attachedMedia: assets.map((asset) => ({
      assetType: asset.assetType,
      originalName: asset.originalName,
      caption: asset.caption,
      altText: asset.altText,
      userNote: asset.userNote,
      placementHint: asset.placementHint,
      sortOrder: asset.sortOrder,
      isPrimary: asset.isPrimary
    }))
  };

  return JSON.stringify(payload, null, 2);
}

export function buildOutputFormatPreview() {
  return JSON.stringify(
    {
      titleCandidates: [],
      targetKeyword: "",
      searchIntent: "",
      audience: "",
      coreMessage: "",
      outline: [],
      ctaPlan: "",
      mediaPlan: [],
      faq: [],
      risks: []
    },
    null,
    2
  );
}

function isOlderThanOneDay(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Date.now() - timestamp > ONE_DAY_MS : true;
}
