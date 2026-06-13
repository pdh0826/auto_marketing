import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { validatePlanJson } from "@/lib/content/plan-validation";
import type { ReadinessStatus } from "@/lib/content/content-plan-preview";
import type { LlmTaskRouteAdmin } from "@/lib/llm/admin-types";

export interface DraftReadinessCheck {
  key: string;
  label: string;
  status: ReadinessStatus;
  message: string;
}

export interface DraftPromptPreview {
  system: string;
  user: string;
  outputFormat: string;
}

export interface DraftMediaMapping {
  assetId: string;
  originalName: string;
  assetType: string;
  placementHint: string;
  caption: string | null;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  matchedMediaPlan: boolean;
  placeholder: string;
}

export interface DraftMarkdownDryRunResult {
  ready: boolean;
  checks: DraftReadinessCheck[];
  promptPreview: DraftPromptPreview;
  mediaMapping: DraftMediaMapping[];
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function buildDraftMarkdownDryRun(
  contentItem: ContentItemAdmin,
  assets: ContentAssetAdmin[],
  route: LlmTaskRouteAdmin | null
): DraftMarkdownDryRunResult {
  const planJson = getSavedPlanJson(contentItem);
  const checks = buildDraftReadinessChecks(contentItem, assets, route, planJson);
  const mediaMapping = buildMediaMapping(planJson, assets);

  return {
    ready: checks.every((check) => check.status !== "fail"),
    checks,
    promptPreview: {
      system: buildDraftSystemPromptPreview(),
      user: buildDraftUserPromptPreview(contentItem, assets, planJson, mediaMapping),
      outputFormat: buildDraftOutputFormatPreview()
    },
    mediaMapping
  };
}

function buildDraftReadinessChecks(
  contentItem: ContentItemAdmin,
  assets: ContentAssetAdmin[],
  route: LlmTaskRouteAdmin | null,
  planJson: Record<string, unknown> | null
): DraftReadinessCheck[] {
  const checks: DraftReadinessCheck[] = [];
  const validation = planJson ? validatePlanJson(planJson, contentItem) : null;
  const outline = planJson && Array.isArray(planJson.outline) ? planJson.outline : [];
  const coreMessage = planJson && typeof planJson.coreMessage === "string" ? planJson.coreMessage.trim() : "";
  const mediaPlan = getMediaPlan(planJson);
  const primaryProvider = route?.primaryProvider;
  const primaryModel = route?.primaryModel;
  const fallbackProvider = route?.fallbackProvider;
  const fallbackModel = route?.fallbackModel;

  checks.push({
    key: "saved_plan_json",
    label: "Saved planJson",
    status: planJson ? "pass" : "fail",
    message: planJson ? "저장된 planJson이 있습니다." : "저장된 planJson이 없습니다. 먼저 planJson에 반영하세요."
  });

  checks.push({
    key: "plan_json_object",
    label: "planJson object",
    status: planJson ? "pass" : "fail",
    message: planJson ? "planJson이 JSON object입니다." : "planJson이 JSON object가 아닙니다."
  });

  checks.push({
    key: "plan_validation",
    label: "planJson validation",
    status: validation?.ok ? "pass" : "fail",
    message: validation?.ok ? "planJson validation error가 없습니다." : `planJson validation error가 있습니다: ${validation?.errors.length ?? 1}개`
  });

  if (validation && validation.warnings.length > 0) {
    checks.push({
      key: "plan_validation_warnings",
      label: "planJson warnings",
      status: "warn",
      message: `planJson validation warning이 있습니다: ${validation.warnings.length}개`
    });
  }

  checks.push({
    key: "outline_or_core_message",
    label: "Outline/Core message",
    status: outline.length > 0 || Boolean(coreMessage) ? "pass" : "fail",
    message: outline.length > 0 || coreMessage ? "outline 또는 coreMessage가 있습니다." : "본문 초안 생성을 위해 outline 또는 coreMessage가 필요합니다."
  });

  checks.push({
    key: "route_exists",
    label: "content_draft route",
    status: route ? "pass" : "fail",
    message: route ? "content_draft Task Route가 등록되어 있습니다." : "draft generation route not configured: content_draft Task Route가 없습니다."
  });

  checks.push({
    key: "route_enabled",
    label: "Route enabled",
    status: route?.isEnabled ? "pass" : "fail",
    message: route?.isEnabled ? "content_draft route가 활성화되어 있습니다." : "content_draft route가 비활성화되어 있습니다."
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
    message: assets.length > 0 ? `첨부 미디어 ${assets.length}개가 있습니다.` : "첨부 미디어가 없습니다."
  });

  if (mediaPlan.length > 0 && assets.length === 0) {
    checks.push({
      key: "media_plan_without_assets",
      label: "mediaPlan/assets",
      status: "warn",
      message: "mediaPlan은 있지만 첨부 미디어가 없습니다."
    });
  } else if (mediaPlan.length === 0 && assets.length > 0) {
    checks.push({
      key: "assets_without_media_plan",
      label: "mediaPlan/assets",
      status: "warn",
      message: "첨부 미디어는 있지만 planJson.mediaPlan이 없습니다."
    });
  } else if (mediaPlan.length > 0 && assets.length > 0 && Math.abs(mediaPlan.length - assets.length) > 1) {
    checks.push({
      key: "media_plan_asset_mismatch",
      label: "mediaPlan/assets",
      status: "warn",
      message: `mediaPlan ${mediaPlan.length}개와 첨부 미디어 ${assets.length}개의 수가 크게 다릅니다.`
    });
  }

  checks.push({
    key: "fallback_exists",
    label: "Fallback route",
    status: fallbackProvider || fallbackModel ? "pass" : "warn",
    message: fallbackProvider || fallbackModel ? "Fallback Provider/Model이 설정되어 있습니다." : "Fallback Provider/Model이 없습니다."
  });

  if (fallbackProvider) {
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

export function buildDraftSystemPromptPreview() {
  return [
    "You are a helpful, original, people-first article writer for Blog Growth Agent.",
    "Write a Markdown draft based only on the saved planJson, content item context, blog profile, brand profile, and attached media metadata.",
    "Do not copy, rewrite, or closely imitate competitor articles sentence-by-sentence.",
    "Avoid keyword stuffing, exaggerated advertising, unsupported claims, and manipulative SEO tactics.",
    "For investment or finance content, describe services as information/reference tools only.",
    "Do not include guaranteed profit, buy/sell recommendations, success stories, return examples, risk-free wording, or wording like 안전하게 매수.",
    "Use attached media caption, altText, userNote, placementHint, and sortOrder for placement planning, but never use storagePath.",
    "Return Markdown only."
  ].join("\n");
}

export function buildDraftUserPromptPreview(
  contentItem: ContentItemAdmin,
  assets: ContentAssetAdmin[],
  planJson: Record<string, unknown> | null,
  mediaMapping: DraftMediaMapping[]
) {
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
          longDescription: contentItem.brandProfile.longDescription,
          targetUsers: contentItem.brandProfile.targetUsers,
          coreFeatures: contentItem.brandProfile.coreFeatures,
          problemsSolved: contentItem.brandProfile.problemsSolved,
          ctaWeak: contentItem.brandProfile.ctaWeak,
          ctaNormal: contentItem.brandProfile.ctaNormal,
          ctaStrong: contentItem.brandProfile.ctaStrong,
          riskDisclaimer: contentItem.brandProfile.riskDisclaimer
        }
      : null,
    savedPlanJson: planJson
      ? {
          titleCandidates: planJson.titleCandidates,
          targetKeyword: planJson.targetKeyword,
          searchIntent: planJson.searchIntent,
          audience: planJson.audience,
          coreMessage: planJson.coreMessage,
          outline: planJson.outline,
          ctaPlan: planJson.ctaPlan,
          mediaPlan: planJson.mediaPlan,
          faq: planJson.faq,
          risks: planJson.risks
        }
      : null,
    attachedMedia: assets.map((asset) => ({
      id: asset.id,
      assetType: asset.assetType,
      originalName: asset.originalName,
      caption: asset.caption,
      altText: asset.altText,
      userNote: asset.userNote,
      placementHint: asset.placementHint,
      sortOrder: asset.sortOrder,
      isPrimary: asset.isPrimary
    })),
    mediaMapping: mediaMapping.map((mapping) => ({
      assetId: mapping.assetId,
      originalName: mapping.originalName,
      placementHint: mapping.placementHint,
      matchedMediaPlan: mapping.matchedMediaPlan,
      placeholder: mapping.placeholder
    }))
  };

  return JSON.stringify(payload, null, 2);
}

export function buildDraftOutputFormatPreview() {
  return [
    "Markdown only.",
    "Use one H1, then H2/H3 sections for intro, body, and conclusion.",
    "Follow the saved planJson outline and coreMessage.",
    "Include FAQ sections when faq items exist.",
    "Include CTA only when appropriate and keep it moderate.",
    "Include risk/disclaimer wording when the topic is investment-related or brand riskDisclaimer exists.",
    'Use media placeholders where relevant, for example: <!-- media:assetId placement:middle caption:"..." -->',
    "Do not upload, embed, or publish to Blogger."
  ].join("\n");
}

function buildMediaMapping(planJson: Record<string, unknown> | null, assets: ContentAssetAdmin[]): DraftMediaMapping[] {
  const mediaPlan = getMediaPlan(planJson);
  return [...assets]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((asset, index) => {
      const matchedMediaPlan = hasMatchingMediaPlan(asset, mediaPlan, index);
      return {
        assetId: asset.id,
        originalName: asset.originalName,
        assetType: asset.assetType,
        placementHint: asset.placementHint,
        caption: asset.caption,
        altText: asset.altText,
        sortOrder: asset.sortOrder,
        isPrimary: asset.isPrimary,
        matchedMediaPlan,
        placeholder: `<!-- media:${asset.id} placement:${asset.placementHint} caption:${JSON.stringify(asset.caption ?? "")} -->`
      };
    });
}

function hasMatchingMediaPlan(asset: ContentAssetAdmin, mediaPlan: unknown[], index: number) {
  if (mediaPlan.length === 0) {
    return false;
  }

  return mediaPlan.some((item, itemIndex) => {
    const text = typeof item === "string" ? item : item && typeof item === "object" ? JSON.stringify(item) : "";
    return text.includes(asset.id) || text.includes(asset.originalName) || text.includes(asset.placementHint) || itemIndex === index;
  });
}

function getSavedPlanJson(contentItem: ContentItemAdmin) {
  return contentItem.planJson && typeof contentItem.planJson === "object" && !Array.isArray(contentItem.planJson) ? contentItem.planJson : null;
}

function getMediaPlan(planJson: Record<string, unknown> | null) {
  return planJson && Array.isArray(planJson.mediaPlan) ? planJson.mediaPlan : [];
}

function isOlderThanOneDay(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? Date.now() - timestamp > ONE_DAY_MS : true;
}
