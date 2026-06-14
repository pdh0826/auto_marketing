import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { validateHtmlCandidate } from "@/lib/content/html-preview";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { hasUsablePlanJson } from "@/lib/content/plan-template";

export type PublishReadinessStatus = "pass" | "warn" | "fail";
export type PublishReadinessSeverity = "required" | "recommended" | "optional";
export type PublishReadinessStage =
  | "missing_plan"
  | "missing_draft_markdown"
  | "missing_draft_html"
  | "html_validation_failed"
  | "quality_not_passed"
  | "blog_profile_missing"
  | "blogger_not_configured"
  | "manual_approval_required"
  | "ready_preview_only";

export interface PublishReadinessCheck {
  key: string;
  label: string;
  status: PublishReadinessStatus;
  severity: PublishReadinessSeverity;
  message: string;
}

export interface PublishReadinessResult {
  ready: boolean;
  contentReady: boolean;
  publishReady: boolean;
  stage: PublishReadinessStage;
  summary: string;
  checks: PublishReadinessCheck[];
  blockingIssues: PublishReadinessCheck[];
  warnings: PublishReadinessCheck[];
  metadata: {
    hasPlan: boolean;
    hasDraftMarkdown: boolean;
    hasDraftHtml: boolean;
    htmlValidationOk: boolean;
    qualityScorePreview: number;
    qualityGrade: "pass" | "warn" | "fail";
    qualityRequiredFailCount: number;
    mediaReferenceCount: number;
    unmatchedMediaReferenceCount: number;
    bloggerConnectionStatus: "not_configured";
    manualApprovalStatus: "not_configured";
  };
}

export function buildPublishReadiness(contentItem: ContentItemAdmin, assets: ContentAssetAdmin[]): PublishReadinessResult {
  const htmlValidation = validateHtmlCandidate(contentItem.draftHtml ?? "", assets);
  const qualityPreview = buildHtmlQualityPreview(contentItem, assets);
  const hasPlan = hasUsablePlanJson(contentItem.planJson);
  const hasDraftMarkdown = Boolean(contentItem.draftMarkdown?.trim());
  const hasDraftHtml = Boolean(contentItem.draftHtml?.trim());
  const qualityRequiredFailCount = qualityPreview.checks.filter((check) => check.status === "fail" && check.severity === "required").length;
  const checks = buildChecks(contentItem, hasPlan, hasDraftMarkdown, hasDraftHtml, htmlValidation, qualityPreview, qualityRequiredFailCount);
  const contentReady =
    hasPlan &&
    hasDraftMarkdown &&
    hasDraftHtml &&
    htmlValidation.validation.ok &&
    qualityPreview.grade !== "fail" &&
    qualityRequiredFailCount === 0 &&
    htmlValidation.metadata.unmatchedMediaReferenceCount === 0;
  const publishReady = false;
  const stage = determineStage(contentItem, hasPlan, hasDraftMarkdown, hasDraftHtml, htmlValidation.validation.ok, qualityPreview.grade, qualityRequiredFailCount);
  const blockingIssues = checks.filter((check) => check.status === "fail" && check.severity === "required");
  const warnings = checks.filter((check) => check.status === "warn");

  return {
    ready: publishReady,
    contentReady,
    publishReady,
    stage,
    summary: summarizeStage(stage, contentReady),
    checks,
    blockingIssues,
    warnings,
    metadata: {
      hasPlan,
      hasDraftMarkdown,
      hasDraftHtml,
      htmlValidationOk: htmlValidation.validation.ok,
      qualityScorePreview: qualityPreview.scorePreview,
      qualityGrade: qualityPreview.grade,
      qualityRequiredFailCount,
      mediaReferenceCount: htmlValidation.metadata.mediaReferenceCount,
      unmatchedMediaReferenceCount: htmlValidation.metadata.unmatchedMediaReferenceCount,
      bloggerConnectionStatus: "not_configured",
      manualApprovalStatus: "not_configured"
    }
  };
}

function buildChecks(
  contentItem: ContentItemAdmin,
  hasPlan: boolean,
  hasDraftMarkdown: boolean,
  hasDraftHtml: boolean,
  htmlValidation: ReturnType<typeof validateHtmlCandidate>,
  qualityPreview: ReturnType<typeof buildHtmlQualityPreview>,
  qualityRequiredFailCount: number
): PublishReadinessCheck[] {
  const investmentContext = isInvestmentContext(contentItem);
  const hasDisclaimer = Boolean(contentItem.brandProfile?.riskDisclaimer?.trim()) || /참고|투자 판단|사용자.*책임|손실|리스크|보장하지|정보 제공/i.test(contentItem.draftHtml ?? "");
  const ctaCheck = qualityPreview.checks.find((check) => check.key === "cta_presence");
  const financeDisclaimerCheck = qualityPreview.checks.find((check) => check.key === "finance_disclaimer");

  return [
    makeCheck("plan_json", "Plan JSON", hasPlan ? "pass" : "fail", "required", hasPlan ? "planJson이 저장되어 있습니다." : "사용 가능한 planJson이 없습니다."),
    makeCheck(
      "draft_markdown",
      "Draft Markdown",
      hasDraftMarkdown ? "pass" : "fail",
      "required",
      hasDraftMarkdown ? "draftMarkdown이 저장되어 있습니다." : "draftMarkdown이 없습니다."
    ),
    makeCheck("draft_html", "Draft HTML", hasDraftHtml ? "pass" : "fail", "required", hasDraftHtml ? "draftHtml이 저장되어 있습니다." : "draftHtml이 없습니다."),
    makeCheck(
      "html_validation",
      "HTML validation",
      htmlValidation.validation.ok ? "pass" : "fail",
      "required",
      htmlValidation.validation.ok ? "HTML validation error가 없습니다." : `HTML validation error가 있습니다: ${htmlValidation.validation.errors.length}개`
    ),
    makeCheck(
      "quality_grade",
      "Quality grade",
      qualityPreview.grade === "fail" ? "fail" : qualityPreview.grade === "warn" ? "warn" : "pass",
      "required",
      `quality grade는 ${qualityPreview.grade}, score preview는 ${qualityPreview.scorePreview}입니다.`
    ),
    makeCheck(
      "quality_required_fail",
      "Quality required checks",
      qualityRequiredFailCount === 0 ? "pass" : "fail",
      "required",
      qualityRequiredFailCount === 0 ? "quality required fail이 없습니다." : `quality required fail이 있습니다: ${qualityRequiredFailCount}개`
    ),
    makeCheck(
      "media_reference_match",
      "Media reference matching",
      htmlValidation.metadata.unmatchedMediaReferenceCount === 0 ? "pass" : "fail",
      "required",
      htmlValidation.metadata.unmatchedMediaReferenceCount === 0
        ? "모든 media reference가 현재 content item의 첨부 자산과 매칭됩니다."
        : `매칭되지 않은 media reference가 있습니다: ${htmlValidation.metadata.unmatchedMediaReferenceCount}개`
    ),
    makeCheck(
      "security_patterns",
      "Dangerous HTML patterns",
      htmlValidation.securityChecks.some((check) => check.status === "fail") ? "fail" : "pass",
      "required",
      htmlValidation.securityChecks.some((check) => check.status === "fail") ? "위험 HTML/security 패턴이 있습니다." : "위험 HTML/security 패턴이 없습니다."
    ),
    makeCheck("blog_profile", "Blog profile", contentItem.blog ? "pass" : "fail", "required", contentItem.blog ? "blog profile이 연결되어 있습니다." : "blog profile이 없습니다."),
    makeCheck(
      "brand_profile",
      "Brand profile",
      contentItem.brandProfile ? "pass" : "warn",
      "recommended",
      contentItem.brandProfile ? "brand profile이 연결되어 있습니다." : "brand profile이 없습니다."
    ),
    makeCheck(
      "brand_risk_disclaimer",
      "Brand risk disclaimer",
      contentItem.brandProfile?.riskDisclaimer?.trim() ? "pass" : "warn",
      "recommended",
      contentItem.brandProfile?.riskDisclaimer?.trim() ? "brand risk disclaimer가 있습니다." : "brand risk disclaimer가 없습니다."
    ),
    makeCheck(
      "target_keyword",
      "Target keyword",
      contentItem.targetKeyword?.trim() ? "pass" : "warn",
      "recommended",
      contentItem.targetKeyword?.trim() ? "targetKeyword가 있습니다." : "targetKeyword가 없습니다."
    ),
    makeCheck(
      "cta_presence",
      "CTA",
      ctaCheck?.status === "pass" ? "pass" : "warn",
      "recommended",
      ctaCheck?.status === "pass" ? "CTA 신호가 있습니다." : "CTA 또는 다음 행동 안내가 약합니다."
    ),
    makeCheck(
      "investment_safety_wording",
      "Investment safety wording",
      !investmentContext || hasDisclaimer || financeDisclaimerCheck?.status === "pass" ? "pass" : "warn",
      "recommended",
      !investmentContext
        ? "금융/투자 맥락이 강하지 않습니다."
        : hasDisclaimer || financeDisclaimerCheck?.status === "pass"
          ? "투자 참고/책임/리스크 관련 안내가 있습니다."
          : "투자 참고/책임/리스크 관련 안내가 부족합니다."
    ),
    makeCheck("blogger_connection", "Blogger connection", "fail", "required", "Blogger 연결은 Patch 9A에서 설정 예정입니다."),
    makeCheck("manual_approval", "Manual approval", "fail", "required", "사용자 최종 승인 저장은 후속 패치에서 연결 예정입니다.")
  ];
}

function determineStage(
  contentItem: ContentItemAdmin,
  hasPlan: boolean,
  hasDraftMarkdown: boolean,
  hasDraftHtml: boolean,
  htmlValidationOk: boolean,
  qualityGrade: "pass" | "warn" | "fail",
  qualityRequiredFailCount: number
): PublishReadinessStage {
  if (!hasPlan) {
    return "missing_plan";
  }
  if (!hasDraftMarkdown) {
    return "missing_draft_markdown";
  }
  if (!hasDraftHtml) {
    return "missing_draft_html";
  }
  if (!htmlValidationOk) {
    return "html_validation_failed";
  }
  if (qualityGrade === "fail" || qualityRequiredFailCount > 0) {
    return "quality_not_passed";
  }
  if (!contentItem.blog) {
    return "blog_profile_missing";
  }
  return "blogger_not_configured";
}

function summarizeStage(stage: PublishReadinessStage, contentReady: boolean) {
  if (stage === "missing_plan") {
    return "발행 준비 전 planJson 저장이 필요합니다.";
  }
  if (stage === "missing_draft_markdown") {
    return "발행 준비 전 draftMarkdown 저장이 필요합니다.";
  }
  if (stage === "missing_draft_html") {
    return "발행 준비 전 draftHtml 저장이 필요합니다.";
  }
  if (stage === "html_validation_failed") {
    return "발행 준비 전 HTML validation 보완이 필요합니다.";
  }
  if (stage === "quality_not_passed") {
    return "발행 준비 전 품질검사 required fail 보완이 필요합니다.";
  }
  if (stage === "blog_profile_missing") {
    return "발행 준비 전 blog profile 연결이 필요합니다.";
  }
  if (stage === "blogger_not_configured") {
    return contentReady
      ? "콘텐츠 기준은 발행 전 검토를 통과했지만 Blogger 연결과 사용자 최종 승인 기능이 아직 없습니다."
      : "Blogger 연결은 아직 설정되지 않았고 콘텐츠 보완도 필요합니다.";
  }
  if (stage === "manual_approval_required") {
    return "사용자 최종 승인 기능이 아직 연결되지 않았습니다.";
  }
  return "콘텐츠 기준은 통과했지만 실제 발행은 후속 패치에서만 가능합니다.";
}

function makeCheck(
  key: string,
  label: string,
  status: PublishReadinessStatus,
  severity: PublishReadinessSeverity,
  message: string
): PublishReadinessCheck {
  return { key, label, status, severity, message };
}

function isInvestmentContext(contentItem: ContentItemAdmin) {
  const values = [
    contentItem.mode,
    contentItem.targetKeyword,
    contentItem.sourceMemo,
    contentItem.blog?.mainTopic,
    contentItem.blog?.targetReader,
    contentItem.brandProfile?.name,
    contentItem.brandProfile?.serviceName,
    contentItem.brandProfile?.shortDescription,
    contentItem.brandProfile?.riskDisclaimer,
    contentItem.draftHtml
  ]
    .filter(Boolean)
    .join(" ");

  return /(투자|주식|종목|매수|매도|급등|수익률|원금|ETF|ISA|IRP|차트|뉴스 흐름|인사이트)/i.test(values);
}
