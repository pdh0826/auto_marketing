import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import type { BloggerConnectionStatus, BloggerDraftManualApprovalStatus } from "@/lib/blogger/admin-types";
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
  | "blogger_blog_not_selected"
  | "blogger_not_configured"
  | "manual_approval_required"
  | "draft_saved_publish_not_implemented"
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
    bloggerConnectionStatus: BloggerConnectionStatus;
    hasSelectedBloggerBlog: boolean;
    bloggerBlogId: string | null;
    bloggerBlogName: string | null;
    bloggerBlogVerifiedAt: string | null;
    manualApprovalStatus: BloggerDraftManualApprovalStatus;
    bloggerDraftApprovalSnapshotHash: string | null;
    bloggerDraftApprovalMatchesCurrentPreview: boolean;
    bloggerDraftApprovedAt: string | null;
    bloggerDraftSaved: boolean;
    bloggerDraftPostId: string | null;
    bloggerDraftUrl: string | null;
    bloggerDraftSavedAt: string | null;
  };
}

export interface PublishReadinessBloggerConnectionSummary {
  status: BloggerConnectionStatus;
  bloggerBlogId: string | null;
  bloggerBlogName: string | null;
  bloggerBlogVerifiedAt: Date | string | null;
}

export interface PublishReadinessManualApprovalSummary {
  status: BloggerDraftManualApprovalStatus;
  snapshotHashPrefix: string | null;
  matchesCurrentPreview: boolean;
  approvedAt: Date | string | null;
}

export interface PublishReadinessDraftSaveSummary {
  draftSaved: boolean;
  bloggerPostId: string | null;
  bloggerPostUrl: string | null;
  savedAt: Date | string | null;
}

export function buildPublishReadiness(
  contentItem: ContentItemAdmin,
  assets: ContentAssetAdmin[],
  bloggerConnection?: PublishReadinessBloggerConnectionSummary | null,
  manualApproval?: PublishReadinessManualApprovalSummary | null,
  draftSave?: PublishReadinessDraftSaveSummary | null
): PublishReadinessResult {
  const htmlValidation = validateHtmlCandidate(contentItem.draftHtml ?? "", assets, contentItem);
  const qualityPreview = buildHtmlQualityPreview(contentItem, assets);
  const bloggerConnectionStatus = bloggerConnection?.status ?? "not_configured";
  const bloggerBlogVerifiedAt =
    bloggerConnection?.bloggerBlogVerifiedAt instanceof Date ? bloggerConnection.bloggerBlogVerifiedAt.toISOString() : bloggerConnection?.bloggerBlogVerifiedAt ?? null;
  const hasSelectedBloggerBlog = bloggerConnectionStatus === "connected" && Boolean(bloggerConnection?.bloggerBlogId && bloggerBlogVerifiedAt);
  const hasPlan = hasUsablePlanJson(contentItem.planJson);
  const hasDraftMarkdown = Boolean(contentItem.draftMarkdown?.trim());
  const hasDraftHtml = Boolean(contentItem.draftHtml?.trim());
  const manualApprovalStatus = manualApproval?.status ?? "missing";
  const bloggerDraftApprovedAt =
    manualApproval?.approvedAt instanceof Date ? manualApproval.approvedAt.toISOString() : manualApproval?.approvedAt ?? null;
  const bloggerDraftSaved = Boolean(draftSave?.draftSaved);
  const bloggerDraftSavedAt = draftSave?.savedAt instanceof Date ? draftSave.savedAt.toISOString() : draftSave?.savedAt ?? null;
  const qualityRequiredFailCount = qualityPreview.checks.filter((check) => check.status === "fail" && check.severity === "required").length;
  const checks = buildChecks(
    contentItem,
    hasPlan,
    hasDraftMarkdown,
    hasDraftHtml,
    htmlValidation,
    qualityPreview,
    qualityRequiredFailCount,
    bloggerConnectionStatus,
    hasSelectedBloggerBlog,
    bloggerConnection?.bloggerBlogName ?? null,
    manualApprovalStatus,
    Boolean(manualApproval?.matchesCurrentPreview),
    bloggerDraftSaved
  );
  const contentReady =
    hasPlan &&
    hasDraftMarkdown &&
    hasDraftHtml &&
    htmlValidation.validation.ok &&
    qualityPreview.grade !== "fail" &&
    qualityRequiredFailCount === 0 &&
    htmlValidation.metadata.unmatchedMediaReferenceCount === 0;
  const publishReady = false;
  const stage = determineStage(
    contentItem,
    hasPlan,
    hasDraftMarkdown,
    hasDraftHtml,
    htmlValidation.validation.ok,
    qualityPreview.grade,
    qualityRequiredFailCount,
    bloggerConnectionStatus,
    hasSelectedBloggerBlog,
    manualApprovalStatus,
    bloggerDraftSaved
  );
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
      bloggerConnectionStatus,
      hasSelectedBloggerBlog,
      bloggerBlogId: bloggerConnection?.bloggerBlogId ?? null,
      bloggerBlogName: bloggerConnection?.bloggerBlogName ?? null,
      bloggerBlogVerifiedAt,
      manualApprovalStatus,
      bloggerDraftApprovalSnapshotHash: manualApproval?.snapshotHashPrefix ?? null,
      bloggerDraftApprovalMatchesCurrentPreview: Boolean(manualApproval?.matchesCurrentPreview),
      bloggerDraftApprovedAt,
      bloggerDraftSaved,
      bloggerDraftPostId: draftSave?.bloggerPostId ?? null,
      bloggerDraftUrl: draftSave?.bloggerPostUrl ?? null,
      bloggerDraftSavedAt
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
  qualityRequiredFailCount: number,
  bloggerConnectionStatus: BloggerConnectionStatus,
  hasSelectedBloggerBlog: boolean,
  bloggerBlogName: string | null,
  manualApprovalStatus: BloggerDraftManualApprovalStatus,
  manualApprovalMatchesCurrentPreview: boolean,
  bloggerDraftSaved: boolean
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
    makeBloggerConnectionCheck(bloggerConnectionStatus),
    makeBloggerBlogSelectionCheck(bloggerConnectionStatus, hasSelectedBloggerBlog, bloggerBlogName),
    makeManualApprovalCheck(manualApprovalStatus, manualApprovalMatchesCurrentPreview),
    makeBloggerDraftSavedCheck(bloggerDraftSaved)
  ];
}

function determineStage(
  contentItem: ContentItemAdmin,
  hasPlan: boolean,
  hasDraftMarkdown: boolean,
  hasDraftHtml: boolean,
  htmlValidationOk: boolean,
  qualityGrade: "pass" | "warn" | "fail",
  qualityRequiredFailCount: number,
  bloggerConnectionStatus: BloggerConnectionStatus,
  hasSelectedBloggerBlog: boolean,
  manualApprovalStatus: BloggerDraftManualApprovalStatus,
  bloggerDraftSaved: boolean
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
  if (bloggerConnectionStatus === "connected" && !hasSelectedBloggerBlog) {
    return "blogger_blog_not_selected";
  }
  if (bloggerConnectionStatus === "connected" && hasSelectedBloggerBlog && manualApprovalStatus === "approved" && bloggerDraftSaved) {
    return "draft_saved_publish_not_implemented";
  }
  if (bloggerConnectionStatus === "connected" && hasSelectedBloggerBlog && manualApprovalStatus === "approved") {
    return "ready_preview_only";
  }
  if (bloggerConnectionStatus === "connected") {
    return "manual_approval_required";
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
  if (stage === "blogger_blog_not_selected") {
    return "Blogger 연결은 되었지만 검증된 Blogger blog 선택이 필요합니다.";
  }
  if (stage === "blogger_not_configured") {
    return contentReady
      ? "콘텐츠 기준은 발행 전 검토를 통과했지만 Blogger 연결과 사용자 최종 승인 기능이 아직 없습니다."
      : "Blogger 연결은 아직 설정되지 않았고 콘텐츠 보완도 필요합니다.";
  }
  if (stage === "manual_approval_required") {
    return "Blogger draft 저장 전 현재 payload에 대한 manual approval이 필요합니다.";
  }
  if (stage === "draft_saved_publish_not_implemented") {
    return "Blogger draft 저장은 완료되었지만 publish/scheduled publish는 아직 구현되지 않았습니다.";
  }
  return "manual approval은 되었지만 Blogger draft save가 아직 실행되지 않았습니다.";
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

function makeBloggerConnectionCheck(status: BloggerConnectionStatus): PublishReadinessCheck {
  if (status === "connected") {
    return makeCheck("blogger_connection", "Blogger connection", "pass", "required", "Blogger OAuth connection status는 connected입니다. 현재 Blogger API는 blog list read-only만 구현되었습니다.");
  }
  if (status === "configured") {
    return makeCheck("blogger_connection", "Blogger connection", "fail", "required", "Blogger connection 설정은 있지만 OAuth 연결이 아직 필요합니다.");
  }
  if (status === "oauth_required") {
    return makeCheck("blogger_connection", "Blogger connection", "fail", "required", "Blogger OAuth 연결이 필요합니다.");
  }
  if (status === "expired") {
    return makeCheck("blogger_connection", "Blogger connection", "fail", "required", "Blogger token placeholder 상태가 만료로 표시되어 있습니다.");
  }
  if (status === "error") {
    return makeCheck("blogger_connection", "Blogger connection", "fail", "required", "Blogger connection placeholder가 error 상태입니다.");
  }
  return makeCheck("blogger_connection", "Blogger connection", "fail", "required", "Blogger connection placeholder가 설정되지 않았습니다.");
}

function makeBloggerBlogSelectionCheck(status: BloggerConnectionStatus, hasSelectedBloggerBlog: boolean, bloggerBlogName: string | null): PublishReadinessCheck {
  if (status !== "connected") {
    return makeCheck("blogger_blog_selection", "Blogger blog selection", "fail", "required", "Blogger OAuth 연결 후 검증된 Blogger blog 선택이 필요합니다.");
  }
  if (hasSelectedBloggerBlog) {
    return makeCheck(
      "blogger_blog_selection",
      "Blogger blog selection",
      "pass",
      "required",
      bloggerBlogName ? `검증된 Blogger blog가 선택되어 있습니다: ${bloggerBlogName}` : "검증된 Blogger blog가 선택되어 있습니다."
    );
  }
  return makeCheck("blogger_blog_selection", "Blogger blog selection", "fail", "required", "Blogger blog list에서 blog를 선택하고 서버 재검증 저장이 필요합니다.");
}

function makeManualApprovalCheck(status: BloggerDraftManualApprovalStatus, matchesCurrentPreview: boolean): PublishReadinessCheck {
  if (status === "approved" && matchesCurrentPreview) {
    return makeCheck("manual_approval", "Manual approval", "pass", "required", "현재 Blogger draft payload preview snapshot에 대한 manual approval이 저장되어 있습니다.");
  }
  if (status === "stale") {
    return makeCheck("manual_approval", "Manual approval", "fail", "required", "저장된 approval snapshot이 현재 draftHtml/title/target blog/readiness와 일치하지 않습니다.");
  }
  if (status === "revoked") {
    return makeCheck("manual_approval", "Manual approval", "fail", "required", "Blogger draft payload approval이 취소되었습니다.");
  }
  if (status === "not_ready") {
    return makeCheck("manual_approval", "Manual approval", "fail", "required", "Blogger draft payload preview가 ready 상태가 아니어서 approval을 저장할 수 없습니다.");
  }
  return makeCheck("manual_approval", "Manual approval", "fail", "required", "Blogger draft payload approval이 필요합니다.");
}

function makeBloggerDraftSavedCheck(draftSaved: boolean): PublishReadinessCheck {
  if (draftSaved) {
    return makeCheck("blogger_draft_saved", "Blogger draft saved", "pass", "required", "Blogger draft post가 저장되어 있습니다.");
  }
  return makeCheck("blogger_draft_saved", "Blogger draft saved", "fail", "required", "Blogger draft save가 아직 완료되지 않았습니다.");
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
