"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  BloggerConnectionAdmin,
  BloggerBlogListResult,
  BloggerBlogSelectionResult,
  BloggerConnectionSecretStatus,
  BloggerConnectionStatus,
  BloggerConnectionStatusSummary,
  BloggerOAuthStartDryRun,
  BloggerSecretSelfTestResult,
  BloggerTokenRefreshResponse
} from "@/lib/blogger/admin-types";
import type { BlogOperationProfileResponse } from "@/lib/blog-operation-profiles/operation-profile-summary";
import type { BlogAdmin } from "@/lib/blogs/admin-types";
import type { DailyPlanContentItemFixtureResponse } from "@/lib/daily-content-plans/content-item-fixture";
import type { DailyContentPlanResponse } from "@/lib/daily-content-plans/daily-content-plan-summary";
import type { DailyContentDraftGenerationFinalExecutionChecklistResponse } from "@/lib/daily-content-plans/draft-generation-final-execution-checklist";
import type { DailyContentDraftGenerationPromptQualityChecklistPreviewResponse } from "@/lib/daily-content-plans/draft-generation-prompt-quality-checklist-preview";
import type { DailyContentDraftGenerationPromptRenderPreviewResponse } from "@/lib/daily-content-plans/draft-generation-prompt-render-preview";
import type { DailyContentDraftGenerationDryRunPlannerResponse } from "@/lib/daily-content-plans/draft-generation-dry-run-planner";
import type { DailyContentDraftGenerationExecutionGatePreviewResponse } from "@/lib/daily-content-plans/draft-generation-execution-gate-preview";
import type { DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse } from "@/lib/daily-content-plans/draft-generation-llm-provider-health-check-execution";
import type { DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse } from "@/lib/daily-content-plans/draft-generation-llm-provider-health-check-preview";
import type { DailyContentDraftGenerationLlmProviderReadinessResponse } from "@/lib/daily-content-plans/draft-generation-llm-provider-readiness";
import type { DailyContentDraftGenerationReadinessResponse } from "@/lib/daily-content-plans/draft-generation-readiness";
import type { DailyContentOperatorApprovalPersistenceResponse } from "@/lib/daily-content-plans/operator-approval-persistence";
import type { DailyContentQueueOperatorWorkflowResponse } from "@/lib/daily-content-plans/operator-approval-workflow";
import { ApiResult, formatListInput, optionalString, parseListInput, requestJson } from "@/lib/form-utils";

interface BloggerConnectionForm {
  id?: string;
  name: string;
  blogId: string;
  status: BloggerConnectionStatus;
  bloggerBlogId: string;
  bloggerBlogName: string;
  bloggerBlogUrl: string;
  bloggerBlogVerifiedAt: string;
  connectedEmail: string;
  scopes: string;
  oauthClientIdRef: string;
  clientSecretRef: string;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string;
  lastError: string;
}

type DailyContentPlanQueueItem =
  | DailyContentPlanResponse["dailyContentPlanSummary"]["existingPlanItems"][number]
  | DailyContentPlanResponse["dailyContentPlanSummary"]["planItems"][number];

const statuses: BloggerConnectionStatus[] = ["not_configured", "configured", "oauth_required", "connected", "expired", "error"];

const emptyConnectionForm: BloggerConnectionForm = {
  name: "",
  blogId: "",
  status: "not_configured",
  bloggerBlogId: "",
  bloggerBlogName: "",
  bloggerBlogUrl: "",
  bloggerBlogVerifiedAt: "",
  connectedEmail: "",
  scopes: "https://www.googleapis.com/auth/blogger",
  oauthClientIdRef: "",
  clientSecretRef: "",
  hasClientSecret: false,
  hasAccessToken: false,
  hasRefreshToken: false,
  tokenLast4: "",
  lastError: ""
};

export function BloggerSettingsClient() {
  const [connections, setConnections] = useState<BloggerConnectionAdmin[]>([]);
  const [blogs, setBlogs] = useState<BlogAdmin[]>([]);
  const [form, setForm] = useState<BloggerConnectionForm>(emptyConnectionForm);
  const [statusPreview, setStatusPreview] = useState<BloggerConnectionStatusSummary | null>(null);
  const [secretStatus, setSecretStatus] = useState<BloggerConnectionSecretStatus | null>(null);
  const [secretSelfTest, setSecretSelfTest] = useState<BloggerSecretSelfTestResult | null>(null);
  const [tokenRefreshResult, setTokenRefreshResult] = useState<BloggerTokenRefreshResponse | null>(null);
  const [operationProfileResult, setOperationProfileResult] = useState<BlogOperationProfileResponse | null>(null);
  const [dailyContentPlanResult, setDailyContentPlanResult] = useState<DailyContentPlanResponse | null>(null);
  const [contentItemFixtureResult, setContentItemFixtureResult] = useState<DailyPlanContentItemFixtureResponse | null>(null);
  const [operatorWorkflowResult, setOperatorWorkflowResult] = useState<DailyContentQueueOperatorWorkflowResponse | null>(null);
  const [operatorApprovalPersistenceResult, setOperatorApprovalPersistenceResult] = useState<DailyContentOperatorApprovalPersistenceResponse | null>(null);
  const [draftGenerationReadinessResult, setDraftGenerationReadinessResult] = useState<DailyContentDraftGenerationReadinessResponse | null>(null);
  const [draftGenerationExecutionGateResult, setDraftGenerationExecutionGateResult] = useState<DailyContentDraftGenerationExecutionGatePreviewResponse | null>(null);
  const [draftGenerationDryRunPlannerResult, setDraftGenerationDryRunPlannerResult] = useState<DailyContentDraftGenerationDryRunPlannerResponse | null>(null);
  const [draftGenerationLlmProviderReadinessResult, setDraftGenerationLlmProviderReadinessResult] = useState<DailyContentDraftGenerationLlmProviderReadinessResponse | null>(null);
  const [draftGenerationLlmProviderHealthCheckPreviewResult, setDraftGenerationLlmProviderHealthCheckPreviewResult] =
    useState<DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse | null>(null);
  const [draftGenerationLlmProviderHealthCheckExecutionResult, setDraftGenerationLlmProviderHealthCheckExecutionResult] =
    useState<DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse | null>(null);
  const [draftGenerationFinalExecutionChecklistResult, setDraftGenerationFinalExecutionChecklistResult] =
    useState<DailyContentDraftGenerationFinalExecutionChecklistResponse | null>(null);
  const [draftGenerationPromptRenderPreviewResult, setDraftGenerationPromptRenderPreviewResult] =
    useState<DailyContentDraftGenerationPromptRenderPreviewResponse | null>(null);
  const [draftGenerationPromptQualityChecklistPreviewResult, setDraftGenerationPromptQualityChecklistPreviewResult] =
    useState<DailyContentDraftGenerationPromptQualityChecklistPreviewResponse | null>(null);
  const [oauthDryRun, setOauthDryRun] = useState<BloggerOAuthStartDryRun | null>(null);
  const [blogListResult, setBlogListResult] = useState<BloggerBlogListResult | null>(null);
  const [blogListLoadingId, setBlogListLoadingId] = useState<string | null>(null);
  const [refreshingTokenId, setRefreshingTokenId] = useState<string | null>(null);
  const [loadingOperationProfileId, setLoadingOperationProfileId] = useState<string | null>(null);
  const [loadingDailyContentPlanId, setLoadingDailyContentPlanId] = useState<string | null>(null);
  const [loadingContentItemFixtureId, setLoadingContentItemFixtureId] = useState<string | null>(null);
  const [loadingOperatorWorkflowPlanId, setLoadingOperatorWorkflowPlanId] = useState<string | null>(null);
  const [loadingOperatorApprovalItemId, setLoadingOperatorApprovalItemId] = useState<string | null>(null);
  const [loadingDraftGenerationReadinessItemId, setLoadingDraftGenerationReadinessItemId] = useState<string | null>(null);
  const [loadingDraftGenerationExecutionGateItemId, setLoadingDraftGenerationExecutionGateItemId] = useState<string | null>(null);
  const [loadingDraftGenerationDryRunPlannerItemId, setLoadingDraftGenerationDryRunPlannerItemId] = useState<string | null>(null);
  const [loadingDraftGenerationLlmProviderReadinessItemId, setLoadingDraftGenerationLlmProviderReadinessItemId] = useState<string | null>(null);
  const [loadingDraftGenerationLlmProviderHealthCheckPreviewItemId, setLoadingDraftGenerationLlmProviderHealthCheckPreviewItemId] = useState<string | null>(null);
  const [loadingDraftGenerationLlmProviderHealthCheckExecutionItemId, setLoadingDraftGenerationLlmProviderHealthCheckExecutionItemId] = useState<string | null>(null);
  const [loadingDraftGenerationFinalExecutionChecklistItemId, setLoadingDraftGenerationFinalExecutionChecklistItemId] = useState<string | null>(null);
  const [loadingDraftGenerationPromptRenderPreviewItemId, setLoadingDraftGenerationPromptRenderPreviewItemId] = useState<string | null>(null);
  const [loadingDraftGenerationPromptQualityChecklistPreviewItemId, setLoadingDraftGenerationPromptQualityChecklistPreviewItemId] = useState<string | null>(null);
  const [selectingBlogId, setSelectingBlogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedBlog = useMemo(() => blogs.find((blog) => blog.id === form.blogId) ?? null, [blogs, form.blogId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [connectionResult, blogResult] = await Promise.all([
        requestJson<ApiResult<BloggerConnectionAdmin[]>>("/api/settings/blogger"),
        requestJson<ApiResult<BlogAdmin[]>>("/api/blogs")
      ]);
      setConnections(connectionResult.data);
      setBlogs(blogResult.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function submitConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!form.name.trim()) {
      setError("Connection name은 필수입니다.");
      return;
    }
    if (form.tokenLast4.trim() && !/^[A-Za-z0-9_-]{4}$/.test(form.tokenLast4.trim())) {
      setError("tokenLast4는 안전한 문자 4자리만 입력할 수 있습니다.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      blogId: optionalString(form.blogId),
      status: form.status,
      connectedEmail: optionalString(form.connectedEmail),
      scopes: parseListInput(form.scopes),
      oauthClientIdRef: optionalString(form.oauthClientIdRef),
      clientSecretRef: optionalString(form.clientSecretRef),
      hasClientSecret: form.hasClientSecret,
      hasAccessToken: form.hasAccessToken,
      hasRefreshToken: form.hasRefreshToken,
      tokenLast4: optionalString(form.tokenLast4),
      lastError: optionalString(form.lastError)
    };

    setSaving(true);
    try {
      await requestJson<ApiResult<BloggerConnectionAdmin>>(form.id ? `/api/settings/blogger/${form.id}` : "/api/settings/blogger", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setForm(emptyConnectionForm);
      setStatusPreview(null);
      setSecretStatus(null);
      setSecretSelfTest(null);
      setTokenRefreshResult(null);
      setOperationProfileResult(null);
      setDailyContentPlanResult(null);
      setOperatorWorkflowResult(null);
      setDraftGenerationReadinessResult(null);
      setDraftGenerationExecutionGateResult(null);
      setDraftGenerationDryRunPlannerResult(null);
      setDraftGenerationLlmProviderReadinessResult(null);
      setDraftGenerationLlmProviderHealthCheckPreviewResult(null);
      setDraftGenerationLlmProviderHealthCheckExecutionResult(null);
      setDraftGenerationFinalExecutionChecklistResult(null);
      setDraftGenerationPromptRenderPreviewResult(null);
      setDraftGenerationPromptQualityChecklistPreviewResult(null);
      setOauthDryRun(null);
      setBlogListResult(null);
      setNotice("Blogger connection을 저장했습니다. Blogger draft/publish는 수행하지 않았습니다.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger connection 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function loadStatus(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<BloggerConnectionStatusSummary>>(`/api/settings/blogger/${connection.id}/status`);
      setStatusPreview(result.data);
      setNotice("저장된 Blogger connection 상태만 조회했습니다. Blogger API 호출은 목록 조회 버튼에서만 read-only로 수행합니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger connection status 조회에 실패했습니다.");
    }
  }

  async function loadSecretStatus(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<BloggerConnectionSecretStatus>>(`/api/settings/blogger/${connection.id}/secret-status`);
      setSecretStatus(result.data);
      setNotice("Blogger secret metadata만 조회했습니다. token/client secret 원문은 반환하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger secret status 조회에 실패했습니다.");
    }
  }

  async function runSecretSelfTest(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<BloggerSecretSelfTestResult>>(`/api/settings/blogger/${connection.id}/secret-self-test`, { method: "POST" });
      setSecretSelfTest(result.data);
      setNotice(result.data.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger token encryption self-test에 실패했습니다.");
    }
  }

  async function refreshAccessToken(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);
    setRefreshingTokenId(connection.id);

    try {
      const result = await requestJson<ApiResult<BloggerTokenRefreshResponse>>(`/api/settings/blogger/${connection.id}/refresh-token`, {
        method: "POST",
        body: JSON.stringify({ reason: "manual_settings_refresh", force: false })
      });
      setTokenRefreshResult(result.data);
      setSecretStatus(null);
      setStatusPreview(null);
      setNotice(
        result.data.tokenRefreshSummary.refreshOk
          ? "Blogger access token을 갱신했습니다. token/client secret 원문은 반환하지 않았습니다."
          : "Blogger access token refresh가 차단되거나 실패했습니다. blocking reason을 확인하세요."
      );
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger access token refresh에 실패했습니다.");
    } finally {
      setRefreshingTokenId(null);
    }
  }

  async function previewOperationProfile(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);
    setLoadingOperationProfileId(connection.id);

    try {
      const result = await requestJson<ApiResult<BlogOperationProfileResponse>>("/api/blog-operation-profiles/default-policy", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          targetBloggerBlogId: connection.bloggerBlogId,
          targetBloggerBlogName: connection.bloggerBlogName,
          targetBloggerBlogUrl: connection.bloggerBlogUrl,
          defaultPublishPolicyPreset: "safe_manual_publish"
        })
      });
      setOperationProfileResult(result.data);
      setNotice("Blog Operation Profile preview를 생성했습니다. Profile row 저장, Blogger write/publish, token refresh는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blog Operation Profile preview에 실패했습니다.");
    } finally {
      setLoadingOperationProfileId(null);
    }
  }

  async function previewDailyContentPlan(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);
    setLoadingDailyContentPlanId(connection.id);

    try {
      const result = await requestJson<ApiResult<DailyContentPlanResponse>>("/api/daily-content-plans/default-plan", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          targetBloggerBlogId: connection.bloggerBlogId,
          targetBloggerBlogName: connection.bloggerBlogName,
          targetBloggerBlogUrl: connection.bloggerBlogUrl,
          planDateLocal: getTodayInSeoul(),
          timezone: "Asia/Seoul",
          defaultPublishPolicyPreset: "safe_manual_publish"
        })
      });
      setDailyContentPlanResult(result.data);
      setOperatorWorkflowResult(null);
      setDraftGenerationReadinessResult(null);
      setDraftGenerationExecutionGateResult(null);
      setDraftGenerationDryRunPlannerResult(null);
      setDraftGenerationLlmProviderReadinessResult(null);
      setDraftGenerationLlmProviderHealthCheckPreviewResult(null);
      setDraftGenerationLlmProviderHealthCheckExecutionResult(null);
      setDraftGenerationFinalExecutionChecklistResult(null);
      setDraftGenerationPromptRenderPreviewResult(null);
      setDraftGenerationPromptQualityChecklistPreviewResult(null);
      setNotice("Daily Content Plan preview를 생성했습니다. Plan row 저장, content generation, LLM call, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Daily Content Plan preview에 실패했습니다.");
    } finally {
      setLoadingDailyContentPlanId(null);
    }
  }

  async function previewContentItemFixture(planId: string | null | undefined, planItemId: string | null | undefined) {
    if (!planId || !planItemId) {
      setError("Daily plan id와 item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingContentItemFixtureId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyPlanContentItemFixtureResponse>>("/api/daily-content-plans/content-item-fixture", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          planId,
          planItemId
        })
      });
      setContentItemFixtureResult(result.data);
      setNotice("content_items fixture preview를 확인했습니다. DB write, LLM call, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "content_items fixture preview에 실패했습니다.");
    } finally {
      setLoadingContentItemFixtureId(null);
    }
  }

  async function previewOperatorWorkflow(planId: string | null | undefined) {
    if (!planId) {
      setError("Daily plan id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingOperatorWorkflowPlanId(planId);

    try {
      const result = await requestJson<ApiResult<DailyContentQueueOperatorWorkflowResponse>>("/api/daily-content-plans/operator-approval-workflow", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          planId
        })
      });
      setOperatorWorkflowResult(result.data);
      setNotice("운영자 검토 워크플로우 preview를 확인했습니다. approval 저장, content generation, LLM call, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "운영자 검토 워크플로우 preview에 실패했습니다.");
    } finally {
      setLoadingOperatorWorkflowPlanId(null);
    }
  }

  async function previewOperatorApprovalPersistence(
    planId: string | null | undefined,
    planItemId: string | null | undefined,
    contentItemId: string | null | undefined
  ) {
    if (!planId || !planItemId || !contentItemId) {
      setError("Daily plan id, item id, linked content item id가 필요합니다.");
      return;
    }

    const idempotencyKey = `9F-2K:draft_generation_execution:${planItemId}:${contentItemId}`;

    setError(null);
    setNotice(null);
    setLoadingOperatorApprovalItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentOperatorApprovalPersistenceResponse>>("/api/daily-content-plans/operator-approvals", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          planId,
          planItemId,
          contentItemId,
          approvalPurpose: "draft_generation_execution",
          operatorAction: "approve_for_draft_generation_execution",
          idempotencyKey
        })
      });
      setOperatorApprovalPersistenceResult(result.data);
      setNotice("운영자 승인 저장 preview를 확인했습니다. approval row/event 저장, draft 생성, LLM call, content_items 수정, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "운영자 승인 저장 preview에 실패했습니다.");
    } finally {
      setLoadingOperatorApprovalItemId(null);
    }
  }

  async function previewDraftGenerationReadiness(planItemId: string | null | undefined, contentItemId: string | null | undefined) {
    if (!planItemId || !contentItemId) {
      setError("Daily plan item id와 linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationReadinessItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationReadinessResponse>>("/api/daily-content-plans/draft-generation-readiness", {
        method: "POST",
        body: JSON.stringify({
          mode: "preflight",
          planItemId,
          contentItemId
        })
      });
      setDraftGenerationReadinessResult(result.data);
      setNotice("초안 생성 준비 preflight를 확인했습니다. draftMarkdown/draftHtml 저장, content generation, LLM call, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 준비 preflight에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationReadinessItemId(null);
    }
  }

  async function previewDraftGenerationExecutionGate(planItemId: string | null | undefined, contentItemId: string | null | undefined) {
    if (!planItemId || !contentItemId) {
      setError("Daily plan item id와 linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationExecutionGateItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationExecutionGatePreviewResponse>>(
        "/api/daily-content-plans/draft-generation-execution-gate-preview",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "preview",
            planItemId,
            contentItemId
          })
        }
      );
      setDraftGenerationExecutionGateResult(result.data);
      setNotice("초안 생성 실행 게이트 preview를 확인했습니다. migration apply, approval 저장, draft 생성, LLM call, content_items 수정, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 실행 게이트 preview에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationExecutionGateItemId(null);
    }
  }

  async function previewDraftGenerationDryRunPlanner(
    planId: string | null | undefined,
    planItemId: string | null | undefined,
    contentItemId: string | null | undefined
  ) {
    if (!planId || !planItemId || !contentItemId) {
      setError("Daily plan id, item id, linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationDryRunPlannerItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationDryRunPlannerResponse>>("/api/daily-content-plans/draft-generation-dry-run-planner", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          planId,
          planItemId,
          contentItemId
        })
      });
      setDraftGenerationDryRunPlannerResult(result.data);
      setNotice("초안 생성 dry-run 계획을 확인했습니다. 실제 draft 생성, LLM call, content_items 수정, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 dry-run 계획 확인에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationDryRunPlannerItemId(null);
    }
  }

  async function previewDraftGenerationLlmProviderReadiness(
    planId: string | null | undefined,
    planItemId: string | null | undefined,
    contentItemId: string | null | undefined
  ) {
    if (!planId || !planItemId || !contentItemId) {
      setError("Daily plan id, item id, linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationLlmProviderReadinessItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationLlmProviderReadinessResponse>>(
        "/api/daily-content-plans/draft-generation-llm-provider-readiness",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "preview",
            planId,
            planItemId,
            contentItemId
          })
        }
      );
      setDraftGenerationLlmProviderReadinessResult(result.data);
      setNotice("초안 생성 LLM 준비상태를 확인했습니다. provider health check, LLM call, llm_call_logs 생성, content_items 수정, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 LLM 준비상태 확인에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationLlmProviderReadinessItemId(null);
    }
  }

  async function previewDraftGenerationLlmProviderHealthCheck(
    planId: string | null | undefined,
    planItemId: string | null | undefined,
    contentItemId: string | null | undefined
  ) {
    if (!planId || !planItemId || !contentItemId) {
      setError("Daily plan id, item id, linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationLlmProviderHealthCheckPreviewItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationLlmProviderHealthCheckPreviewResponse>>(
        "/api/daily-content-plans/draft-generation-llm-provider-health-check-preview",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "preview",
            planId,
            planItemId,
            contentItemId
          })
        }
      );
      setDraftGenerationLlmProviderHealthCheckPreviewResult(result.data);
      setNotice("초안 생성 LLM health-check preview를 확인했습니다. provider 호출, LLM completion, prompt 렌더링, llm_call_logs 생성, content_items 수정, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 LLM health-check preview 확인에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationLlmProviderHealthCheckPreviewItemId(null);
    }
  }

  async function previewDraftGenerationLlmProviderHealthCheckExecutionGate(
    planId: string | null | undefined,
    planItemId: string | null | undefined,
    contentItemId: string | null | undefined
  ) {
    if (!planId || !planItemId || !contentItemId) {
      setError("Daily plan id, item id, linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationLlmProviderHealthCheckExecutionItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationLlmProviderHealthCheckExecutionResponse>>(
        "/api/daily-content-plans/draft-generation-llm-provider-health-check-execution",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "healthcheck_execute",
            planId,
            planItemId,
            contentItemId
          })
        }
      );
      setDraftGenerationLlmProviderHealthCheckExecutionResult(result.data);
      setNotice("초안 생성 LLM health-check 실행 게이트를 확인했습니다. feature flag/확인 문구/idempotency가 없으므로 provider network call, LLM completion, llm_call_logs 생성, content_items 수정은 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 LLM health-check 실행 게이트 확인에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationLlmProviderHealthCheckExecutionItemId(null);
    }
  }

  async function previewDraftGenerationFinalExecutionChecklist(
    planId: string | null | undefined,
    planItemId: string | null | undefined,
    contentItemId: string | null | undefined
  ) {
    if (!planId || !planItemId || !contentItemId) {
      setError("Daily plan id, item id, linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationFinalExecutionChecklistItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationFinalExecutionChecklistResponse>>(
        "/api/daily-content-plans/draft-generation-final-execution-checklist",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "preview",
            planId,
            planItemId,
            contentItemId
          })
        }
      );
      setDraftGenerationFinalExecutionChecklistResult(result.data);
      setNotice("초안 생성 최종 실행 체크리스트를 확인했습니다. LLM 호출, prompt 렌더링, provider network call, content_items 수정, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 최종 실행 체크리스트 확인에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationFinalExecutionChecklistItemId(null);
    }
  }

  async function previewDraftGenerationPromptRender(
    planId: string | null | undefined,
    planItemId: string | null | undefined,
    contentItemId: string | null | undefined
  ) {
    if (!planId || !planItemId || !contentItemId) {
      setError("Daily plan id, item id, linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationPromptRenderPreviewItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationPromptRenderPreviewResponse>>(
        "/api/daily-content-plans/draft-generation-prompt-render-preview",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "preview",
            planId,
            planItemId,
            contentItemId
          })
        }
      );
      setDraftGenerationPromptRenderPreviewResult(result.data);
      setNotice(
        "초안 생성 prompt preview를 렌더링했습니다. prompt는 저장하지 않았고, LLM 호출, provider network call, content_items 수정, Blogger write/publish도 수행하지 않았습니다."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 prompt preview 확인에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationPromptRenderPreviewItemId(null);
    }
  }

  async function previewDraftGenerationPromptQualityChecklist(
    planId: string | null | undefined,
    planItemId: string | null | undefined,
    contentItemId: string | null | undefined
  ) {
    if (!planId || !planItemId || !contentItemId) {
      setError("Daily plan id, item id, linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationPromptQualityChecklistPreviewItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationPromptQualityChecklistPreviewResponse>>(
        "/api/daily-content-plans/draft-generation-prompt-quality-checklist-preview",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "preview",
            planId,
            planItemId,
            contentItemId
          })
        }
      );
      setDraftGenerationPromptQualityChecklistPreviewResult(result.data);
      setNotice(
        "초안 생성 prompt 품질 체크리스트를 확인했습니다. 정적 규칙만 사용했으며 LLM judge, provider network call, prompt 저장, content_items 수정, Blogger write/publish는 수행하지 않았습니다."
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 prompt 품질 체크리스트 확인에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationPromptQualityChecklistPreviewItemId(null);
    }
  }

  async function createOAuthDryRun(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<BloggerOAuthStartDryRun>>(`/api/settings/blogger/${connection.id}/oauth/start`, { method: "POST" });
      setOauthDryRun(result.data);
      setNotice("OAuth authorization URL을 생성했습니다. Callback에서는 token exchange를 수행하며 Blogger API는 blog list read-only만 지원합니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OAuth dry-run URL 생성에 실패했습니다.");
    }
  }

  async function loadBloggerBlogs(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);
    setBlogListLoadingId(connection.id);

    try {
      const result = await requestJson<ApiResult<BloggerBlogListResult>>(`/api/settings/blogger/${connection.id}/blogs`, { method: "POST" });
      setBlogListResult(result.data);
      setNotice("Blogger blog list를 read-only로 조회했습니다. draft/publish와 token refresh는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger blog list 조회에 실패했습니다.");
    } finally {
      setBlogListLoadingId(null);
    }
  }

  async function selectBloggerBlog(blogId: string) {
    if (!blogListResult) {
      return;
    }

    setError(null);
    setNotice(null);
    setSelectingBlogId(blogId);

    try {
      await requestJson<ApiResult<BloggerBlogSelectionResult>>(`/api/settings/blogger/${blogListResult.connectionId}/blogs/select`, {
        method: "POST",
        body: JSON.stringify({ blogId })
      });
      setStatusPreview(null);
      setNotice("Blogger blog를 connection에 반영했습니다. draft/publish는 수행하지 않았습니다.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger blog 선택 저장에 실패했습니다.");
    } finally {
      setSelectingBlogId(null);
    }
  }

  const activeBlogListConnection = blogListResult ? connections.find((connection) => connection.id === blogListResult.connectionId) ?? null : null;
  const dailyContentPlanSummary = dailyContentPlanResult?.dailyContentPlanSummary ?? null;

  return (
    <>
      <section className="card">
        <span className="badge">Patch 9D-2</span>
        <h1>Blogger 설정</h1>
        <p className="muted">
          Blogger OAuth callback token exchange와 read-only blog list 조회가 연결되었습니다. 선택 저장은 서버 재검증 후 safe metadata만 반영합니다.
        </p>
        <div className="button-row">
          <button className="button secondary" type="button" disabled>
            OAuth callback token exchange 연결됨
          </button>
          <button className="button secondary" type="button" disabled>
            Blogger draft/publish 비활성
          </button>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice success">{notice}</div> : null}
      {loading ? <div className="notice">Blogger 설정을 불러오는 중입니다.</div> : null}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Connection Placeholder</h2>
            <p className="muted">안전한 설정 필드만 저장합니다. OAuth callback token exchange는 구현되었고, Blogger API는 read-only blog list 조회만 가능합니다.</p>
          </div>
        </div>

        <form className="admin-form" onSubmit={(event) => void submitConnection(event)}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Blog Profile
            <select value={form.blogId} onChange={(event) => setForm({ ...form, blogId: event.target.value })}>
              <option value="">No blog profile</option>
              {blogs.map((blog) => (
                <option key={blog.id} value={blog.id}>
                  {blog.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BloggerConnectionStatus })}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="notice full-span">
            Blogger blog 선택은 아래 Blogger 목록 조회 결과에서 “이 블로그 선택”으로만 반영합니다. 직접 입력한 Blogger Blog ID/Name은 검증된 선택으로 간주하지 않습니다.
            {form.bloggerBlogId ? (
              <>
                <br />
                현재 선택: {form.bloggerBlogName || "-"} ({form.bloggerBlogId})
                {form.bloggerBlogUrl ? (
                  <>
                    <br />
                    URL: {form.bloggerBlogUrl}
                  </>
                ) : null}
                <br />
                Verified At: {form.bloggerBlogVerifiedAt ? new Date(form.bloggerBlogVerifiedAt).toLocaleString() : "-"}
              </>
            ) : null}
          </div>
          <label>
            Connected Email
            <input value={form.connectedEmail} onChange={(event) => setForm({ ...form, connectedEmail: event.target.value })} />
          </label>
          <label>
            OAuth Client ID Ref
            <input value={form.oauthClientIdRef} onChange={(event) => setForm({ ...form, oauthClientIdRef: event.target.value })} />
          </label>
          <label>
            Client Secret Ref
            <input value={form.clientSecretRef} onChange={(event) => setForm({ ...form, clientSecretRef: event.target.value })} />
          </label>
          <label>
            Token Last 4
            <input maxLength={4} value={form.tokenLast4} onChange={(event) => setForm({ ...form, tokenLast4: event.target.value })} />
          </label>
          <label className="full-span">
            OAuth Scopes
            <textarea value={form.scopes} onChange={(event) => setForm({ ...form, scopes: event.target.value })} />
          </label>
          <label className="full-span">
            Last Error
            <textarea value={form.lastError} onChange={(event) => setForm({ ...form, lastError: event.target.value })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.hasClientSecret} onChange={(event) => setForm({ ...form, hasClientSecret: event.target.checked })} />
            Client secret reference exists
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.hasAccessToken} onChange={(event) => setForm({ ...form, hasAccessToken: event.target.checked })} />
            Access token placeholder exists
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.hasRefreshToken} onChange={(event) => setForm({ ...form, hasRefreshToken: event.target.checked })} />
            Refresh token placeholder exists
          </label>
          <div className="form-actions full-span">
            <button className="button" disabled={saving} type="submit">
              {saving ? "저장 중" : form.id ? "Connection 수정" : "Connection 생성"}
            </button>
            {form.id ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setForm(emptyConnectionForm);
                  setStatusPreview(null);
                  setSecretStatus(null);
                  setSecretSelfTest(null);
                  setTokenRefreshResult(null);
                  setOperationProfileResult(null);
                  setDailyContentPlanResult(null);
                  setContentItemFixtureResult(null);
                  setOperatorWorkflowResult(null);
                  setDraftGenerationReadinessResult(null);
                  setDraftGenerationExecutionGateResult(null);
                  setDraftGenerationDryRunPlannerResult(null);
                  setDraftGenerationLlmProviderReadinessResult(null);
                  setDraftGenerationLlmProviderHealthCheckPreviewResult(null);
                  setDraftGenerationLlmProviderHealthCheckExecutionResult(null);
                  setDraftGenerationFinalExecutionChecklistResult(null);
                  setDraftGenerationPromptRenderPreviewResult(null);
                  setDraftGenerationPromptQualityChecklistPreviewResult(null);
                  setOauthDryRun(null);
                  setBlogListResult(null);
                }}
              >
                새 Connection
              </button>
            ) : null}
          </div>
        </form>

        {selectedBlog ? (
          <div className="notice">
            선택한 blog profile의 기존 Blogger Blog ID: {selectedBlog.bloggerBlogId ?? "없음"}. Patch 9A 이후 source of truth는 Blogger connection placeholder의 Blogger Blog ID입니다.
          </div>
        ) : null}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Connection List</h2>
            <p className="muted">API 응답에는 access token, refresh token, client secret 원문을 포함하지 않습니다.</p>
          </div>
        </div>

        {connections.length === 0 && !loading ? <div className="notice">저장된 Blogger connection placeholder가 없습니다.</div> : null}
        {connections.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Blog</th>
                <th>Blogger Blog</th>
                <th>Secrets</th>
                <th>Last Tested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((connection) => (
                <tr key={connection.id}>
                  <td>{connection.name}</td>
                  <td>
                    <span className={`status-pill status-${connection.status}`}>{connection.status}</span>
                  </td>
                  <td>{connection.blog?.name ?? "-"}</td>
                  <td>
                    {connection.bloggerBlogName ?? "-"}
                    <div className="muted">{connection.bloggerBlogId ?? ""}</div>
                    {connection.bloggerBlogUrl ? <div className="muted">{connection.bloggerBlogUrl}</div> : null}
                    <div className="muted">verified: {connection.bloggerBlogVerifiedAt ? new Date(connection.bloggerBlogVerifiedAt).toLocaleString() : "-"}</div>
                  </td>
                  <td>
                    client secret: {connection.hasClientSecret ? "yes" : "no"}
                    <br />
                    client id ref: {connection.oauthClientIdRef ?? "no"}
                    <br />
                    access token: {connection.hasAccessToken ? `yes (${connection.tokenLast4 ?? "last4 unknown"})` : "no"}
                    <br />
                    refresh token: {connection.hasRefreshToken ? "yes" : "no"}
                  </td>
                  <td>{connection.lastTestedAt ? new Date(connection.lastTestedAt).toLocaleString() : "-"}</td>
                  <td>
                    <div className="button-row">
                      <button className="button secondary" type="button" onClick={() => setForm(toForm(connection))}>
                        수정
                      </button>
                      <button className="button secondary" type="button" onClick={() => void loadStatus(connection)}>
                        상태
                      </button>
                      <button className="button secondary" type="button" onClick={() => void loadSecretStatus(connection)}>
                        Secret 상태
                      </button>
                      <button className="button secondary" type="button" onClick={() => void runSecretSelfTest(connection)}>
                        암호화 Self-test
                      </button>
                      <button className="button secondary" type="button" disabled={refreshingTokenId === connection.id} onClick={() => void refreshAccessToken(connection)}>
                        {refreshingTokenId === connection.id ? "갱신 중" : "Access Token Refresh"}
                      </button>
                      <button className="button secondary" type="button" onClick={() => void createOAuthDryRun(connection)}>
                        OAuth URL 생성
                      </button>
                      <button className="button secondary" type="button" disabled={blogListLoadingId === connection.id} onClick={() => void loadBloggerBlogs(connection)}>
                        {blogListLoadingId === connection.id ? "조회 중" : "Blogger 목록 조회"}
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        disabled={!connection.bloggerBlogId || loadingOperationProfileId === connection.id}
                        onClick={() => void previewOperationProfile(connection)}
                      >
                        {loadingOperationProfileId === connection.id ? "Profile Preview 중" : "Operation Profile Preview"}
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        disabled={!connection.bloggerBlogId || loadingDailyContentPlanId === connection.id}
                        onClick={() => void previewDailyContentPlan(connection)}
                      >
                        {loadingDailyContentPlanId === connection.id ? "Daily Plan Preview 중" : "Daily Plan Preview"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Blog Operation Profile</h2>
            <p className="muted">9F-1A foundation입니다. 블로그별 기본 운영 정책을 preview하지만, profile write는 feature flag와 명시 승인 전까지 실행하지 않습니다.</p>
          </div>
        </div>
        <div className="notice warning">
          <strong>Profile write is CLI/explicit-gated only for now</strong>
          <p>Preview 버튼은 safe_manual_publish preset을 보여주며 DB row를 생성하지 않습니다.</p>
          <p>Apply/Save는 이번 UI에서 비활성입니다. Blogger publish/write, posts.update, draft save, OAuth reconnect, token refresh도 실행하지 않습니다.</p>
        </div>
        <div className="form-actions">
          <button className="button secondary" type="button" disabled>
            Profile Apply/Save disabled
          </button>
        </div>
        {operationProfileResult ? (
          <div className="read-block">
            <h3>Operation Profile Preview</h3>
            <div className={operationProfileResult.operationProfileExceptionDashboardSummary.profileHealthy ? "notice" : "notice warning"}>
              <strong>{operationProfileResult.operationProfileExceptionDashboardSummary.headline}</strong>
              <p>{operationProfileResult.operationProfileExceptionDashboardSummary.operatorSummary}</p>
              <p>
                dashboard: {operationProfileResult.operationProfileExceptionDashboardSummary.dashboardMode} / advisory only:{" "}
                {String(operationProfileResult.operationProfileExceptionDashboardSummary.advisoryOnly)} / policy enforced:{" "}
                {String(operationProfileResult.operationProfileExceptionDashboardSummary.policyEnforced)} / blocker impact:{" "}
                {String(operationProfileResult.operationProfileExceptionDashboardSummary.blockerImpact)}
              </p>
            </div>
            <div className="detail-grid">
              <DetailItem label="Profile Found" value={String(operationProfileResult.operationProfileExceptionDashboardSummary.profileFound)} />
              <DetailItem label="Profile Healthy" value={String(operationProfileResult.operationProfileExceptionDashboardSummary.profileHealthy)} />
              <DetailItem label="Attention Level" value={operationProfileResult.operationProfileExceptionDashboardSummary.attentionLevel} />
              <DetailItem
                label="Default Publish Policy"
                value={operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.defaultPublishPolicyPreset ?? "-"}
              />
              <DetailItem label="Operation Mode" value={operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.operationMode ?? "-"} />
              <DetailItem label="Auto Publish" value={formatNullableBoolean(operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.allowAutoPublish)} />
              <DetailItem
                label="Scheduled Publish"
                value={formatNullableBoolean(operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.allowScheduledPublish)}
              />
              <DetailItem
                label="Human Approval"
                value={formatNullableBoolean(operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.requireFinalHumanApproval)}
              />
            </div>
            <ValidationList
              title="Exception Dashboard Focus Items"
              items={operationProfileResult.operationProfileExceptionDashboardSummary.focusItems.map((item) => `${item.severity}: ${item.label} - ${item.detail}`)}
              emptyText="No profile exceptions found."
              isWarning
            />
            <ValidationList
              title="Exception Dashboard Advisory Warnings"
              items={operationProfileResult.operationProfileExceptionDashboardSummary.advisoryWarnings}
              emptyText="advisory warning이 없습니다."
              isWarning
            />
            <div className="read-block">
              <h3>Operation Profile Policy Simulation</h3>
              <div className="notice">
                <strong>safe_manual_publish dry-run simulation</strong>
                <p>This is a dry-run simulation. It does not change current publish blockers or execution permissions.</p>
                <p>
                  Auto publish remains disabled. Scheduled publish remains disabled. Human approval, readback, and post-publish reconciliation remain required.
                </p>
              </div>
              <div className="detail-grid">
                <DetailItem label="Simulation Version" value={operationProfileResult.operationProfilePolicySimulationSummary.simulationVersion} />
                <DetailItem label="Simulation Mode" value={operationProfileResult.operationProfilePolicySimulationSummary.simulationMode} />
                <DetailItem label="Advisory Only" value={String(operationProfileResult.operationProfilePolicySimulationSummary.advisoryOnly)} />
                <DetailItem label="Policy Enforced" value={String(operationProfileResult.operationProfilePolicySimulationSummary.policyEnforced)} />
                <DetailItem label="Actual Blocker Impact" value={String(operationProfileResult.operationProfilePolicySimulationSummary.actualBlockerImpact)} />
                <DetailItem
                  label="Actual Permission Impact"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.actualExecutionPermissionImpact)}
                />
                <DetailItem label="Profile Found" value={String(operationProfileResult.operationProfilePolicySimulationSummary.profileFound)} />
                <DetailItem label="Profile Healthy" value={String(operationProfileResult.operationProfilePolicySimulationSummary.profileHealthy)} />
                <DetailItem label="Profile Applicable" value={String(operationProfileResult.operationProfilePolicySimulationSummary.profileWouldBeApplicable)} />
                <DetailItem label="Default Publish Policy" value={operationProfileResult.operationProfilePolicySimulationSummary.defaultPublishPolicyPreset ?? "-"} />
              </div>
              <div className="detail-grid">
                <DetailItem
                  label="Require OAuth Gate"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireOAuthGate)}
                />
                <DetailItem
                  label="Require Human Approval"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireFinalHumanApproval)}
                />
                <DetailItem
                  label="Require External Risk Ack"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireExternalWriteRiskAck)}
                />
                <DetailItem
                  label="Require Rollback Ack"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireRollbackPlanAck)}
                />
                <DetailItem
                  label="Require Readback"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireReadbackAfterPublish)}
                />
                <DetailItem
                  label="Require Reconciliation"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequirePostPublishReconciliation)}
                />
                <DetailItem
                  label="Allow Auto Publish"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldAllowAutoPublish)}
                />
                <DetailItem
                  label="Allow Scheduled Publish"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldAllowScheduledPublish)}
                />
              </div>
              <ValidationList
                title="Simulated Additional Blockers"
                items={operationProfileResult.operationProfilePolicySimulationSummary.simulatedAdditionalBlockers}
                emptyText="simulation blocker가 없습니다."
                isWarning
              />
              <ValidationList
                title="Simulated Removed Blockers"
                items={operationProfileResult.operationProfilePolicySimulationSummary.simulatedRemovedBlockers}
                emptyText="simulation에서 제거할 blocker가 없습니다."
              />
              <ValidationList
                title="Simulation Notes"
                items={operationProfileResult.operationProfilePolicySimulationSummary.notes}
                emptyText="simulation note가 없습니다."
              />
            </div>
            <div className="read-block">
              <h3>Operation Profile Scenario Matrix</h3>
              <div className="notice">
                <strong>Scenario matrix preview</strong>
                <p>This matrix is simulation-only. It does not change current publish blockers or execution permissions.</p>
                <p>
                  Future planned ready item, token expired item, profile missing, profile mismatch, and scheduled publish requested scenarios are previewed without
                  creating rows or calling Blogger.
                </p>
              </div>
              <div className="detail-grid">
                <DetailItem label="Matrix Version" value={operationProfileResult.operationProfileScenarioMatrixSummary.matrixVersion} />
                <DetailItem label="Matrix Mode" value={operationProfileResult.operationProfileScenarioMatrixSummary.matrixMode} />
                <DetailItem label="Advisory Only" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.advisoryOnly)} />
                <DetailItem label="Policy Enforced" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.policyEnforced)} />
                <DetailItem label="Actual Blocker Impact" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.actualBlockerImpact)} />
                <DetailItem
                  label="Actual Permission Impact"
                  value={String(operationProfileResult.operationProfileScenarioMatrixSummary.actualExecutionPermissionImpact)}
                />
                <DetailItem label="Scenario Count" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.scenarioCount)} />
                <DetailItem label="Blocked Scenarios" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.matrixTotals.blockedScenarioCount)} />
                <DetailItem
                  label="Manual Approval Scenarios"
                  value={String(operationProfileResult.operationProfileScenarioMatrixSummary.matrixTotals.manualApprovalScenarioCount)}
                />
                <DetailItem
                  label="Exception Review Scenarios"
                  value={String(operationProfileResult.operationProfileScenarioMatrixSummary.matrixTotals.exceptionReviewScenarioCount)}
                />
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Input</th>
                    <th>Synthetic</th>
                    <th>Decision</th>
                    <th>Blockers</th>
                    <th>Operator Takeaway</th>
                  </tr>
                </thead>
                <tbody>
                  {operationProfileResult.operationProfileScenarioMatrixSummary.scenarios.map((scenario) => (
                    <tr key={scenario.scenarioId}>
                      <td>
                        <strong>{scenario.label}</strong>
                        <div className="muted">{scenario.scenarioId}</div>
                      </td>
                      <td>{scenario.inputKind}</td>
                      <td>{String(scenario.syntheticOnly)}</td>
                      <td>
                        execute: {String(scenario.simulatedDecision.wouldAllowPublishExecution)}
                        <br />
                        scheduled: {String(scenario.simulatedDecision.wouldAllowScheduledPublishExecution)}
                        <br />
                        manual: {String(scenario.simulatedDecision.wouldRequireManualApproval)}
                      </td>
                      <td>{scenario.simulatedAdditionalBlockers.length}</td>
                      <td>{scenario.operatorTakeaway}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ValidationList
                title="Scenario Matrix Notes"
                items={operationProfileResult.operationProfileScenarioMatrixSummary.notes}
                emptyText="matrix note가 없습니다."
              />
            </div>
            <details className="read-block">
              <summary>Detailed policy snapshot</summary>
            <div className="detail-grid">
              <DetailItem label="Checked At" value={new Date(operationProfileResult.checkedAt).toLocaleString()} />
              <DetailItem label="Mode" value={operationProfileResult.blogOperationProfileSummary.mode} />
              <DetailItem label="Profile Found" value={String(operationProfileResult.blogOperationProfileSummary.profileFound)} />
              <DetailItem label="Would Create" value={String(operationProfileResult.blogOperationProfileSummary.profileWouldBeCreated)} />
              <DetailItem label="Would Update" value={String(operationProfileResult.blogOperationProfileSummary.profileWouldBeUpdated)} />
              <DetailItem label="Apply Attempted" value={String(operationProfileResult.blogOperationProfileSummary.applyAttempted)} />
              <DetailItem label="Apply Blocked" value={String(operationProfileResult.blogOperationProfileSummary.applyBlocked)} />
              <DetailItem label="Apply OK" value={String(operationProfileResult.blogOperationProfileSummary.applyOk)} />
              <DetailItem label="Feature Flag Enabled" value={String(operationProfileResult.blogOperationProfileSummary.featureFlagEnabled)} />
              <DetailItem label="Confirmation Accepted" value={String(operationProfileResult.blogOperationProfileSummary.confirmationPhraseAccepted)} />
              <DetailItem label="Target Blogger Blog" value={operationProfileResult.blogOperationProfileSummary.targetBloggerBlogName ?? "-"} />
              <DetailItem label="Target Blogger Blog ID" value={operationProfileResult.blogOperationProfileSummary.targetBloggerBlogId ?? "-"} />
              <DetailItem label="Target Blogger Blog URL" value={operationProfileResult.blogOperationProfileSummary.targetBloggerBlogUrl ?? "-"} />
            </div>
            <div className="detail-grid">
              <DetailItem label="Profile Status" value={operationProfileResult.blogOperationProfileSummary.proposedProfile.status} />
              <DetailItem label="Default Publish Policy" value={operationProfileResult.blogOperationProfileSummary.proposedProfile.defaultPublishPolicyPreset} />
              <DetailItem label="Operation Mode" value={operationProfileResult.blogOperationProfileSummary.proposedProfile.operationMode} />
              <DetailItem label="Timezone" value={operationProfileResult.blogOperationProfileSummary.proposedProfile.timezone} />
              <DetailItem label="Auto Publish Enabled" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.allowAutoPublish)} />
              <DetailItem label="Scheduled Publish Enabled" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.allowScheduledPublish)} />
              <DetailItem label="Human Approval Required" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireFinalHumanApproval)} />
              <DetailItem label="OAuth Gate Required" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireOAuthGate)} />
              <DetailItem label="External Write Risk Ack" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireExternalWriteRiskAck)} />
              <DetailItem label="Rollback Plan Ack" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireRollbackPlanAck)} />
              <DetailItem label="Readback After Publish" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireReadbackAfterPublish)} />
              <DetailItem label="Post-publish Reconciliation" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requirePostPublishReconciliation)} />
            </div>
            <div className="detail-grid">
              <DetailItem label="Policy: Feature Flag" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.bloggerWriteRequiresFeatureFlag)} />
              <DetailItem label="Policy: Confirmation Phrase" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.bloggerWriteRequiresConfirmationPhrase)} />
              <DetailItem label="Policy: Unknown Result Review" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.unknownExternalResultRequiresManualReview)} />
              <DetailItem label="Policy: Retry Unknown Result" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.retryOnUnknownExternalResult)} />
              <DetailItem label="Raw Response Storage" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.rawBloggerResponseStorageAllowed)} />
              <DetailItem label="Readback Content Returned" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.contentReturnedInReadbackResponse)} />
              <DetailItem label="Operator Exceptions Only" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.operatorSeesExceptionsOnly)} />
            </div>
            </details>
            <ValidationList title="Operation Profile Blocking Reasons" items={operationProfileResult.blogOperationProfileSummary.blockingReasons} emptyText="blocking reason이 없습니다." isError />
            <ValidationList title="Operation Profile Warnings" items={operationProfileResult.blogOperationProfileSummary.warnings} emptyText="warning이 없습니다." isWarning />
            <div className="detail-grid">
              <DetailItem label="DB Read" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.dbRead)} />
              <DetailItem label="DB Write" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.dbWrite)} />
              <DetailItem label="Schema Migration" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.schemaMigration)} />
              <DetailItem label="Blogger Read" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerRead)} />
              <DetailItem label="Blogger Write" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerWrite)} />
              <DetailItem label="Blogger Publish" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerPublish)} />
              <DetailItem label="Blogger Update" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerUpdate)} />
              <DetailItem label="Blogger Draft Save" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerDraftSave)} />
              <DetailItem label="Token Refresh" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.tokenRefresh)} />
              <DetailItem label="OAuth Reconnect" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.oauthReconnect)} />
              <DetailItem label="Content Mutation" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.contentMutation)} />
              <DetailItem label="Approval Mutation" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.approvalMutation)} />
              <DetailItem label="Attempt Mutation" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.attemptMutation)} />
              <DetailItem label="LLM Call" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.llmCall)} />
              <DetailItem label="External Send" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.externalSend)} />
            </div>
            <div className="notice">Operation Profile preview는 access token, refresh token, raw Blogger response, raw HTML/content를 표시하지 않습니다.</div>
          </div>
        ) : (
          <div className="notice">Connection List에서 verified Blogger Blog가 있는 connection의 Operation Profile Preview를 실행하세요.</div>
        )}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>오늘 콘텐츠 계획</h2>
            <p className="muted">9F-2C readback/queue preview입니다. 기존 daily plan fixture를 읽어서 보여주며 저장, 생성, 발행은 실행하지 않습니다.</p>
          </div>
        </div>
        <div className="notice warning">
          <strong>Blogger 쓰기 없음</strong>
          <p>이 화면의 Daily Plan Preview는 readback 중심입니다. 9F-2B apply를 다시 실행하지 않으며 content generation, LLM 호출, content_items 생성, Blogger write/publish/schedule을 수행하지 않습니다.</p>
        </div>
        <div className="form-actions">
          <button className="button secondary" type="button" disabled>
            Daily Plan Apply/Create disabled
          </button>
        </div>
        {dailyContentPlanSummary ? (
          <div className="read-block">
            <h3>{dailyContentPlanSummary.existingPlanFound ? "계획 생성됨" : "계획 미생성"}</h3>
            <div className={dailyContentPlanSummary.existingPlanFound ? "notice success" : "notice warning"}>
              <strong>{dailyContentPlanSummary.existingPlanFound ? "검토 대기" : "Preview only"}</strong>
              <p>{dailyContentPlanSummary.existingPlanFound ? "오늘 계획 row와 후보 큐를 읽었습니다. 모든 후보는 아직 content_items와 연결되지 않았고 승인 필요 상태입니다." : "아직 persisted daily plan row가 없습니다. 이 UI에서는 생성 버튼을 활성화하지 않습니다."}</p>
            </div>
            <div className="detail-grid">
              <DetailItem label="Checked At" value={dailyContentPlanResult?.checkedAt ? new Date(dailyContentPlanResult.checkedAt).toLocaleString() : "-"} />
              <DetailItem label="Plan ID" value={dailyContentPlanSummary.persistedPlanId ?? "-"} />
              <DetailItem label="Plan Date" value={(dailyContentPlanSummary.existingPlanSummary?.planDateLocal ?? dailyContentPlanSummary.planDateLocal) || "-"} />
              <DetailItem label="Status" value={dailyContentPlanSummary.persistedPlanStatus ?? "-"} />
              <DetailItem label="Kind" value={dailyContentPlanSummary.existingPlanSummary?.planKind ?? dailyContentPlanSummary.planMode} />
              <DetailItem label="Policy" value={dailyContentPlanSummary.existingPlanSummary?.defaultPublishPolicyPreset ?? dailyContentPlanSummary.defaultPublishPolicyPreset} />
              <DetailItem label="Items" value={`${dailyContentPlanSummary.persistedItemCount || dailyContentPlanSummary.planTotals.plannedItemCount}개 후보 / 승인 필요 ${dailyContentPlanSummary.persistedApprovalRequiredCount || dailyContentPlanSummary.planTotals.approvalRequiredCount}개`} />
            </div>
            <div className="detail-grid">
              <DetailItem label="본문 생성" value={dailyContentPlanSummary.contentGenerationEnabled ? "켜짐" : "꺼짐"} />
              <DetailItem label="LLM 호출" value={dailyContentPlanSummary.llmCallEnabled ? "켜짐" : "꺼짐"} />
              <DetailItem label="발행 실행" value={dailyContentPlanSummary.publishExecutionEnabled ? "켜짐" : "꺼짐"} />
              <DetailItem label="예약 발행" value={dailyContentPlanSummary.scheduledPublishEnabled ? "켜짐" : "꺼짐"} />
              <DetailItem label="Blogger 쓰기" value={dailyContentPlanSummary.guardrailSummary.noBloggerWrite ? "없음" : "주의 필요"} />
              <DetailItem label="content_items 연결" value={`${dailyContentPlanSummary.persistedContentItemLinkedCount}개 연결됨`} />
            </div>
            <div className="button-row">
              <button
                className="button secondary"
                type="button"
                disabled={!dailyContentPlanSummary.persistedPlanId || loadingOperatorWorkflowPlanId === dailyContentPlanSummary.persistedPlanId}
                onClick={() => void previewOperatorWorkflow(dailyContentPlanSummary.persistedPlanId)}
              >
                {loadingOperatorWorkflowPlanId === dailyContentPlanSummary.persistedPlanId ? "워크플로우 확인 중" : "운영자 워크플로우 preview"}
              </button>
              <button className="button secondary" type="button" disabled>
                본문 생성 준비 - 비활성
              </button>
              <button className="button secondary" type="button" disabled>
                발행 검토 - 비활성
              </button>
              <button className="button secondary" type="button" disabled>
                예약 발행 - 비활성
              </button>
            </div>

            <h3>후보 큐</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>순서</th>
                  <th>슬롯</th>
                  <th>Topic Seed</th>
                  <th>Intent / 상태</th>
                  <th>안전 가드</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {(dailyContentPlanSummary.existingPlanItems.length > 0 ? dailyContentPlanSummary.existingPlanItems : dailyContentPlanSummary.planItems).map((item) => (
                  <tr key={"id" in item ? item.id : item.syntheticPlanItemId}>
                    <td>
                      #{item.itemOrder}
                    </td>
                    <td>
                      {getDailyPlanSlotLabel(item.slotKey)}
                      <div className="muted">{item.slotKey}</div>
                    </td>
                    <td>{item.topicSeed}</td>
                    <td>
                      {item.contentIntent}
                      <div className="muted">{getDailyPlanItemStatus(item)}</div>
                    </td>
                    <td>
                      <div>{item.requiresHumanApproval ? "승인 필요" : "승인 불필요"}</div>
                      <div className="muted">{getDailyPlanItemContentItemId(item) ? `content item 연결됨: ${getDailyPlanItemContentItemId(item)}` : "아직 content_items 미연결"}</div>
                      <div className="muted">
                        draft {formatDisabledFlag(item.draftGenerationAllowed)} / LLM {formatDisabledFlag(item.llmGenerationAllowed)} / publish {formatDisabledFlag(item.publishExecutionAllowed)} / schedule {formatDisabledFlag(item.scheduledPublishAllowed)}
                      </div>
                    </td>
                    <td>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={!dailyContentPlanSummary.persistedPlanId || !getDailyPlanItemId(item) || loadingContentItemFixtureId === getDailyPlanItemId(item)}
                        onClick={() => previewContentItemFixture(dailyContentPlanSummary.persistedPlanId, getDailyPlanItemId(item))}
                      >
                        {loadingContentItemFixtureId === getDailyPlanItemId(item) ? "확인 중" : "fixture preview"}
                      </button>
                      <button className="button small secondary" type="button" disabled>
                        생성/연결 비활성
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={
                          !dailyContentPlanSummary.persistedPlanId ||
                          !getDailyPlanItemId(item) ||
                          !getDailyPlanItemContentItemId(item) ||
                          loadingOperatorApprovalItemId === getDailyPlanItemId(item)
                        }
                        onClick={() =>
                          void previewOperatorApprovalPersistence(
                            dailyContentPlanSummary.persistedPlanId,
                            getDailyPlanItemId(item),
                            getDailyPlanItemContentItemId(item)
                          )
                        }
                      >
                        {loadingOperatorApprovalItemId === getDailyPlanItemId(item) ? "승인 preview 중" : "승인 저장 preview"}
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={!getDailyPlanItemId(item) || !getDailyPlanItemContentItemId(item) || loadingDraftGenerationReadinessItemId === getDailyPlanItemId(item)}
                        onClick={() => void previewDraftGenerationReadiness(getDailyPlanItemId(item), getDailyPlanItemContentItemId(item))}
                      >
                        {loadingDraftGenerationReadinessItemId === getDailyPlanItemId(item) ? "점검 중" : "초안 생성 사전 점검"}
                      </button>
                      <button className="button small secondary" type="button" disabled>
                        LLM 초안 생성 비활성
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={!getDailyPlanItemId(item) || !getDailyPlanItemContentItemId(item) || loadingDraftGenerationExecutionGateItemId === getDailyPlanItemId(item)}
                        onClick={() => void previewDraftGenerationExecutionGate(getDailyPlanItemId(item), getDailyPlanItemContentItemId(item))}
                      >
                        {loadingDraftGenerationExecutionGateItemId === getDailyPlanItemId(item) ? "게이트 확인 중" : "실행 게이트 preview"}
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={
                          !dailyContentPlanSummary.persistedPlanId ||
                          !getDailyPlanItemId(item) ||
                          !getDailyPlanItemContentItemId(item) ||
                          loadingDraftGenerationDryRunPlannerItemId === getDailyPlanItemId(item)
                        }
                        onClick={() =>
                          void previewDraftGenerationDryRunPlanner(
                            dailyContentPlanSummary.persistedPlanId,
                            getDailyPlanItemId(item),
                            getDailyPlanItemContentItemId(item)
                          )
                        }
                      >
                        {loadingDraftGenerationDryRunPlannerItemId === getDailyPlanItemId(item) ? "계획 확인 중" : "dry-run 계획"}
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={
                          !dailyContentPlanSummary.persistedPlanId ||
                          !getDailyPlanItemId(item) ||
                          !getDailyPlanItemContentItemId(item) ||
                          loadingDraftGenerationLlmProviderReadinessItemId === getDailyPlanItemId(item)
                        }
                        onClick={() =>
                          void previewDraftGenerationLlmProviderReadiness(
                            dailyContentPlanSummary.persistedPlanId,
                            getDailyPlanItemId(item),
                            getDailyPlanItemContentItemId(item)
                          )
                        }
                      >
                        {loadingDraftGenerationLlmProviderReadinessItemId === getDailyPlanItemId(item) ? "LLM 준비 확인 중" : "LLM 준비상태"}
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={
                          !dailyContentPlanSummary.persistedPlanId ||
                          !getDailyPlanItemId(item) ||
                          !getDailyPlanItemContentItemId(item) ||
                          loadingDraftGenerationLlmProviderHealthCheckPreviewItemId === getDailyPlanItemId(item)
                        }
                        onClick={() =>
                          void previewDraftGenerationLlmProviderHealthCheck(
                            dailyContentPlanSummary.persistedPlanId,
                            getDailyPlanItemId(item),
                            getDailyPlanItemContentItemId(item)
                          )
                        }
                      >
                        {loadingDraftGenerationLlmProviderHealthCheckPreviewItemId === getDailyPlanItemId(item) ? "health-check 확인 중" : "LLM health-check preview"}
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={
                          !dailyContentPlanSummary.persistedPlanId ||
                          !getDailyPlanItemId(item) ||
                          !getDailyPlanItemContentItemId(item) ||
                          loadingDraftGenerationLlmProviderHealthCheckExecutionItemId === getDailyPlanItemId(item)
                        }
                        onClick={() =>
                          void previewDraftGenerationLlmProviderHealthCheckExecutionGate(
                            dailyContentPlanSummary.persistedPlanId,
                            getDailyPlanItemId(item),
                            getDailyPlanItemContentItemId(item)
                          )
                        }
                      >
                        {loadingDraftGenerationLlmProviderHealthCheckExecutionItemId === getDailyPlanItemId(item) ? "실행 게이트 확인 중" : "health-check 실행 게이트"}
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={
                          !dailyContentPlanSummary.persistedPlanId ||
                          !getDailyPlanItemId(item) ||
                          !getDailyPlanItemContentItemId(item) ||
                          loadingDraftGenerationFinalExecutionChecklistItemId === getDailyPlanItemId(item)
                        }
                        onClick={() =>
                          void previewDraftGenerationFinalExecutionChecklist(
                            dailyContentPlanSummary.persistedPlanId,
                            getDailyPlanItemId(item),
                            getDailyPlanItemContentItemId(item)
                          )
                        }
                      >
                        {loadingDraftGenerationFinalExecutionChecklistItemId === getDailyPlanItemId(item) ? "최종 점검 중" : "최종 실행 체크리스트"}
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={
                          !dailyContentPlanSummary.persistedPlanId ||
                          !getDailyPlanItemId(item) ||
                          !getDailyPlanItemContentItemId(item) ||
                          loadingDraftGenerationPromptRenderPreviewItemId === getDailyPlanItemId(item)
                        }
                        onClick={() =>
                          void previewDraftGenerationPromptRender(
                            dailyContentPlanSummary.persistedPlanId,
                            getDailyPlanItemId(item),
                            getDailyPlanItemContentItemId(item)
                          )
                        }
                      >
                        {loadingDraftGenerationPromptRenderPreviewItemId === getDailyPlanItemId(item) ? "prompt 렌더링 중" : "prompt preview"}
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={
                          !dailyContentPlanSummary.persistedPlanId ||
                          !getDailyPlanItemId(item) ||
                          !getDailyPlanItemContentItemId(item) ||
                          loadingDraftGenerationPromptQualityChecklistPreviewItemId === getDailyPlanItemId(item)
                        }
                        onClick={() =>
                          void previewDraftGenerationPromptQualityChecklist(
                            dailyContentPlanSummary.persistedPlanId,
                            getDailyPlanItemId(item),
                            getDailyPlanItemContentItemId(item)
                          )
                        }
                      >
                        {loadingDraftGenerationPromptQualityChecklistPreviewItemId === getDailyPlanItemId(item) ? "prompt 품질 점검 중" : "prompt 품질 체크"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contentItemFixtureResult ? (
              <div className="notice">
                <strong>content_items fixture preview</strong>
                <p>이 preview는 DB write를 수행하지 않습니다. 실제 fixture 생성/연결은 feature flag와 명시 승인 문구가 필요합니다.</p>
                <div className="detail-grid">
                  <DetailItem label="Patch" value={contentItemFixtureResult.contentItemFixtureSummary.patchVersion} />
                  <DetailItem label="Mode" value={contentItemFixtureResult.contentItemFixtureSummary.mode} />
                  <DetailItem label="Plan Item" value={contentItemFixtureResult.contentItemFixtureSummary.targetPlanItemId || "-"} />
                  <DetailItem label="Slot" value={contentItemFixtureResult.contentItemFixtureSummary.targetSlotKey ?? "-"} />
                  <DetailItem label="Would Create" value={String(contentItemFixtureResult.contentItemFixtureSummary.fixtureWouldBeCreated)} />
                  <DetailItem label="Already Linked" value={String(contentItemFixtureResult.contentItemFixtureSummary.fixtureAlreadyLinked)} />
                  <DetailItem label="Proposed Content Item" value={contentItemFixtureResult.contentItemFixtureSummary.proposedFixtureSummary.id ?? "-"} />
                  <DetailItem label="Applied Content Item" value={contentItemFixtureResult.contentItemFixtureSummary.appliedContentItemId ?? "-"} />
                  <DetailItem label="DB Write" value={String(contentItemFixtureResult.contentItemFixtureSummary.sideEffectSummary.dbWrite)} />
                  <DetailItem label="LLM Call" value={String(contentItemFixtureResult.contentItemFixtureSummary.sideEffectSummary.llmCall)} />
                  <DetailItem label="Blogger Write" value={String(contentItemFixtureResult.contentItemFixtureSummary.sideEffectSummary.bloggerWrite)} />
                </div>
              </div>
            ) : null}

            <div className="read-block">
              <h3>운영자 검토 워크플로우</h3>
              <div className="notice">
                <strong>9F-2E preview only</strong>
                <p>이 워크플로우는 후보 큐를 읽고 운영자가 다음에 무엇을 검토해야 하는지 보여줍니다. approval row 저장, content_items 변경, 본문 생성, LLM 호출, Blogger write/publish는 실행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  초안 생성 준비 승인 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  주제 보류 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  재검토 요청 - 비활성
                </button>
              </div>
              {operatorWorkflowResult ? (
                <>
                  <div className={operatorWorkflowResult.operatorApprovalWorkflowSummary.blockingReasons.length > 0 ? "notice warning" : "notice success"}>
                    <strong>
                      {operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.readyForOperatorReviewCount}개 검토 가능 /{" "}
                      {operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.waitingForContentFixtureCount}개 fixture 대기
                    </strong>
                    <p>
                      Item 1은 linked fixture가 있으면 운영자 검토 후보가 됩니다. Items 2/3은 content_items fixture 연결 전까지 대기 상태입니다.
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={operatorWorkflowResult.operatorApprovalWorkflowSummary.patchVersion} />
                    <DetailItem label="Workflow Mode" value={operatorWorkflowResult.operatorApprovalWorkflowSummary.workflowMode} />
                    <DetailItem label="Plan ID" value={operatorWorkflowResult.operatorApprovalWorkflowSummary.targetPlanId || "-"} />
                    <DetailItem label="Plan Date" value={operatorWorkflowResult.operatorApprovalWorkflowSummary.planDateLocal ?? "-"} />
                    <DetailItem label="Total Items" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.totalItems)} />
                    <DetailItem label="Linked Fixtures" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.linkedContentItemCount)} />
                    <DetailItem label="Unlinked Items" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.unlinkedItemCount)} />
                    <DetailItem label="Approval Required" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.approvalRequiredCount)} />
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>순서</th>
                        <th>후보</th>
                        <th>연결 상태</th>
                        <th>검토 상태</th>
                        <th>다음 안전 단계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operatorWorkflowResult.operatorApprovalWorkflowSummary.queueItems.map((item) => (
                        <tr key={item.planItemId}>
                          <td>#{item.itemOrder}</td>
                          <td>
                            <strong>{item.topicSeed}</strong>
                            <div className="muted">
                              {item.slotLabel} / {item.contentIntent}
                            </div>
                          </td>
                          <td>
                            {item.contentItemId ? item.contentItemId : "content_items fixture 대기"}
                            <div className="muted">
                              status: {item.linkedContentStatus ?? "-"} / mode: {item.linkedContentMode ?? "-"}
                            </div>
                          </td>
                          <td>
                            {formatOperatorApprovalState(item.approvalStateDraft)}
                            <div className="muted">
                              generation {formatDisabledFlag(item.guardrails.draftGenerationAllowed)} / LLM {formatDisabledFlag(item.guardrails.llmGenerationAllowed)} / publish{" "}
                              {formatDisabledFlag(item.guardrails.publishExecutionAllowed)}
                            </div>
                          </td>
                          <td>{item.nextSafeStepDraft}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <details className="read-block">
                    <summary>운영자 워크플로우 기술 상세</summary>
                    <ValidationList
                      title="Workflow Blocking Reasons"
                      items={operatorWorkflowResult.operatorApprovalWorkflowSummary.blockingReasons}
                      emptyText="blocking reason이 없습니다."
                      isError
                    />
                    <ValidationList
                      title="Workflow Warnings"
                      items={operatorWorkflowResult.operatorApprovalWorkflowSummary.warnings}
                      emptyText="warning이 없습니다."
                      isWarning
                    />
                    <div className="detail-grid">
                      <DetailItem label="DB Read" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.dbWrite)} />
                      <DetailItem label="Approval Mutation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.approvalMutation)} />
                      <DetailItem label="Content Generation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.contentGeneration)} />
                      <DetailItem label="LLM Call" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.llmCall)} />
                      <DetailItem label="Content Mutation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.contentMutation)} />
                      <DetailItem label="Blogger Write" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.bloggerWrite)} />
                      <DetailItem label="Blogger Publish" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.bloggerPublish)} />
                      <DetailItem label="Scheduled Publish" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.scheduledPublish)} />
                      <DetailItem label="OAuth Reconnect" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.oauthReconnect)} />
                      <DetailItem label="Token Refresh" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.tokenRefresh)} />
                    </div>
                    <div className="detail-grid">
                      <DetailItem label="No Business DB Write" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noBusinessDbWrite)} />
                      <DetailItem label="No Approval Mutation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noApprovalMutation)} />
                      <DetailItem label="No Content Generation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noContentGeneration)} />
                      <DetailItem label="No LLM Call" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noLlmCall)} />
                      <DetailItem label="No Blogger Write" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noBloggerWrite)} />
                      <DetailItem label="No Publish Execution" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noPublishExecution)} />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">위의 “운영자 워크플로우 preview” 버튼으로 후보 큐의 운영자 검토 상태를 확인하세요.</div>
              )}
            </div>

            <div className="read-block">
              <h3>운영자 승인 저장</h3>
              <div className="notice">
                <strong>9F-2K guarded persistence preview</strong>
                <p>초안 생성 실행을 위한 운영자 승인 row/event 저장 가능성을 확인합니다. 이 화면 호출은 preview만 수행하며 approval 저장, 본문 생성, LLM 호출, content_items 수정, Blogger 쓰기/발행은 실행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  승인 저장 - feature flag/확인 문구 필요
                </button>
                <button className="button small secondary" type="button" disabled>
                  승인 row만 생성 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  event row만 생성 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  초안 생성 실행 - 비활성
                </button>
              </div>
              {operatorApprovalPersistenceResult ? (
                <>
                  <div
                    className={
                      operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.existingApprovalFound
                        ? "notice success"
                        : operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.blockingReasons.length > 0
                          ? "notice warning"
                          : "notice"
                    }
                  >
                    <strong>
                      {operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.operatorReadbackSummary.approvalStoredLabelKo} ·{" "}
                      {operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.operatorReadbackSummary.executionStillBlockedLabelKo}
                    </strong>
                    <p>{operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.operatorReadbackSummary.operatorMessageKo}</p>
                    <p>
                      목적: {operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.approvalPurpose} / 액션:{" "}
                      {operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.operatorLabel}
                    </p>
                    <p>
                      Preview만 실행했습니다. 승인 저장 apply는 별도 feature flag, idempotency key, 확인 문구와 명시 승인이 있어야 하며, 이 UI에서는 자동 실행하지 않습니다.
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.patchVersion} />
                    <DetailItem label="Mode" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.mode} />
                    <DetailItem label="Plan ID" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetPlanId || "-"} />
                    <DetailItem label="Plan Item" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetPlanItemId || "-"} />
                    <DetailItem label="Content Item" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetContentItemId || "-"} />
                    <DetailItem label="Existing Approval" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.existingApprovalFound ? "있음" : "없음"} />
                    <DetailItem label="Approval ID" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.existingApprovalId ?? "-"} />
                    <DetailItem label="Approval Status" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.persistedApprovalSummary?.approvalStatus ?? "-"} />
                    <DetailItem label="Event ID" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.persistedEventSummary?.id ?? "-"} />
                    <DetailItem label="Event Count" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.existingEventCount)} />
                    <DetailItem label="Approval Would Be Created" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.approvalWouldBeCreated)} />
                    <DetailItem label="Event Would Be Created" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.eventWouldBeCreated)} />
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Plan Found" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetIntegrity.planFound)} />
                    <DetailItem label="Plan Item Found" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetIntegrity.planItemFound)} />
                    <DetailItem label="Content Item Found" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetIntegrity.contentItemFound)} />
                    <DetailItem label="Fixture Match" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetIntegrity.contentItemMatchesPlanItem)} />
                    <DetailItem label="Not Published" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetIntegrity.contentItemNotPublished)} />
                    <DetailItem label="Not Scheduled" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetIntegrity.contentItemNotScheduled)} />
                    <DetailItem label="No Draft Markdown" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetIntegrity.contentItemHasNoDraftMarkdown)} />
                    <DetailItem label="No Draft HTML" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.targetIntegrity.contentItemHasNoDraftHtml)} />
                  </div>
                  <ValidationList
                    title="Operator Approval Blocking Reasons"
                    items={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.blockingReasons}
                    emptyText="blocking reason이 없습니다."
                    isError
                  />
                  <ValidationList
                    title="Operator Approval Warnings"
                    items={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.warnings}
                    emptyText="warning이 없습니다."
                    isWarning
                  />
                  <details className="read-block">
                    <summary>운영자 승인 저장 기술 상세</summary>
                    <div className="detail-grid">
                      <DetailItem label="Feature Flag Enabled" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.featureFlagEnabled)} />
                      <DetailItem label="Confirmation Accepted" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.confirmationPhraseAccepted)} />
                      <DetailItem label="Idempotency Accepted" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.idempotencyKeyAccepted)} />
                      <DetailItem label="Apply Attempted" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.applyAttempted)} />
                      <DetailItem label="Apply Blocked" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.applyBlocked)} />
                      <DetailItem label="Apply OK" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.applyOk)} />
                      <DetailItem label="Applied Approval" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.appliedApprovalId ?? "-"} />
                      <DetailItem label="Applied Event" value={operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.appliedEventId ?? "-"} />
                    </div>
                    <div className="detail-grid">
                      <DetailItem label="DB Read" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.dbWrite)} />
                      <DetailItem label="Approval Mutation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.approvalMutation)} />
                      <DetailItem label="Approval Event Mutation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.approvalEventMutation)} />
                      <DetailItem label="Content Generation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.contentGeneration)} />
                      <DetailItem label="LLM Call" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.llmCall)} />
                      <DetailItem label="Content Mutation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.contentMutation)} />
                      <DetailItem label="Draft Markdown Mutation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.draftMarkdownMutation)} />
                      <DetailItem label="Draft HTML Mutation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.draftHtmlMutation)} />
                      <DetailItem label="Blogger Write" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.bloggerWrite)} />
                      <DetailItem label="Blogger Publish" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.bloggerPublish)} />
                      <DetailItem label="Token Refresh" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.tokenRefresh)} />
                      <DetailItem label="OAuth Reconnect" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.sideEffectSummary.oauthReconnect)} />
                    </div>
                    <div className="detail-grid">
                      <DetailItem label="No Content Generation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.guardrailSummary.noContentGeneration)} />
                      <DetailItem label="No LLM Call" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.guardrailSummary.noLlmCall)} />
                      <DetailItem label="No Content Mutation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.guardrailSummary.noContentItemMutation)} />
                      <DetailItem label="No Draft Markdown Mutation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.guardrailSummary.noDraftMarkdownMutation)} />
                      <DetailItem label="No Draft HTML Mutation" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.guardrailSummary.noDraftHtmlMutation)} />
                      <DetailItem label="No Blogger Write" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.guardrailSummary.noBloggerWrite)} />
                      <DetailItem label="No Publish Execution" value={String(operatorApprovalPersistenceResult.operatorApprovalPersistenceSummary.guardrailSummary.noPublishExecution)} />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “승인 저장 preview”를 실행하세요. 이 버튼은 preview-only이며 DB write를 수행하지 않습니다.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 준비 점검</h3>
              <div className="notice">
                <strong>9F-2F preflight only</strong>
                <p>linked content fixture가 미래 초안 생성에 구조적으로 준비되었는지 확인합니다. draftMarkdown/draftHtml 생성, LLM 호출, content_items 수정, Blogger 쓰기/발행은 실행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  초안 생성 사전 점검 - 보기 전용
                </button>
                <button className="button small secondary" type="button" disabled>
                  초안 생성 실행 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  LLM 초안 생성 - 비활성
                </button>
              </div>
              {draftGenerationReadinessResult ? (
                <>
                  <div
                    className={
                      draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.structuralReadyForFutureDraftGeneration
                        ? "notice success"
                        : "notice warning"
                    }
                  >
                    <strong>{draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.operatorLabelKo}</strong>
                    <p>{draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.nextSafeStepDraft}</p>
                    <p>
                      실행 준비: {draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.executionReadyForDraftGeneration ? "가능" : "차단"} / 구조 준비:{" "}
                      {draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.structuralReadyForFutureDraftGeneration ? "완료" : "미완료"}
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.patchVersion} />
                    <DetailItem label="Mode" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.mode} />
                    <DetailItem label="Plan Item" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.targetPlanItemId || "-"} />
                    <DetailItem label="Linked Fixture" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.linkedContentItemId ?? "-"} />
                    <DetailItem label="Fixture Found" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.fixtureFound)} />
                    <DetailItem label="Plan Item Found" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.planItemFound)} />
                    <DetailItem label="Fixture Match" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.linkedFixtureMatchesPlanItem)} />
                    <DetailItem label="Readiness Level" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.readinessLevel} />
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="운영자 승인" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.operatorApprovalPersisted ? "저장됨" : "저장 전"} />
                    <DetailItem label="LLM 호출" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.llmGenerationFlagEnabled ? "켜짐" : "꺼짐"} />
                    <DetailItem label="본문 생성" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.draftGenerationFlagEnabled ? "켜짐" : "꺼짐"} />
                    <DetailItem label="content_items 수정" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.contentMutationAllowed ? "허용" : "없음"} />
                    <DetailItem label="Blogger 쓰기" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.bloggerWriteAllowed ? "허용" : "없음"} />
                    <DetailItem label="발행 실행" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.publishExecutionAllowed ? "허용" : "꺼짐"} />
                    <DetailItem label="예약 발행" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.scheduledPublishAllowed ? "허용" : "꺼짐"} />
                    <DetailItem label="Draft Content" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureHasNoDraftMarkdown && draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureHasNoDraftHtml ? "비어 있음" : "이미 있음"} />
                  </div>
                  <ValidationList
                    title="Missing Requirements"
                    items={draftGenerationReadinessResult.draftGenerationReadinessSummary.missingRequirements}
                    emptyText="missing requirement가 없습니다."
                    isWarning
                  />
                  <details className="read-block">
                    <summary>초안 생성 준비 기술 상세</summary>
                    <div className="detail-grid">
                      <DetailItem label="Fixture Not Published" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureNotPublished)} />
                      <DetailItem label="Fixture Not Scheduled" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureNotScheduled)} />
                      <DetailItem label="No Draft Markdown" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureHasNoDraftMarkdown)} />
                      <DetailItem label="No Draft HTML" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureHasNoDraftHtml)} />
                      <DetailItem label="Requires Human Approval" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.planRequiresHumanApproval)} />
                      <DetailItem label="DB Read" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.dbWrite)} />
                      <DetailItem label="Content Generation" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.contentGeneration)} />
                      <DetailItem label="LLM Call" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.llmCall)} />
                      <DetailItem label="Content Mutation" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.contentMutation)} />
                      <DetailItem label="Blogger Write" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.bloggerWrite)} />
                      <DetailItem label="Blogger Publish" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.bloggerPublish)} />
                      <DetailItem label="Token Refresh" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.tokenRefresh)} />
                      <DetailItem label="OAuth Reconnect" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.oauthReconnect)} />
                    </div>
                    <ValidationList
                      title="Draft-generation Readiness Blocking Reasons"
                      items={draftGenerationReadinessResult.draftGenerationReadinessSummary.blockingReasons}
                      emptyText="blocking reason이 없습니다."
                      isError
                    />
                    <ValidationList
                      title="Draft-generation Readiness Warnings"
                      items={draftGenerationReadinessResult.draftGenerationReadinessSummary.warnings}
                      emptyText="warning이 없습니다."
                      isWarning
                    />
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “초안 생성 사전 점검”을 실행하세요. 이 버튼은 보기 전용 preflight만 호출합니다.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 실행 게이트</h3>
              <div className="notice">
                <strong>9F-2J preview only</strong>
                <p>미래 초안 생성 실행이 가능한지 read-only로 확인합니다. migration apply, approval 저장, draft 생성, LLM 호출, content_items 수정, Blogger 쓰기/발행은 실행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  초안 생성 실행 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  LLM 초안 생성 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  content_items draft 저장 - 비활성
                </button>
              </div>
              {draftGenerationExecutionGateResult ? (
                <>
                  <div
                    className={
                      draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionBlockerSummary.executionAllowed
                        ? "notice success"
                        : "notice warning"
                    }
                  >
                    <strong>
                      {draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.postApprovalState.operatorApprovalLabelKo} ·{" "}
                      {draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionBlockerSummary.executionAllowed ? "실행 가능" : "실행 차단 유지"}
                    </strong>
                    <p>{draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionBlockerSummary.operatorMessageKo}</p>
                    <p>
                      구조 준비: {draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionGateSummary.readinessStructuralReady ? "완료" : "미완료"} / 실행:{" "}
                      {draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionGateSummary.executionAllowed ? "가능" : "차단"}
                    </p>
                    <p>
                      승인 테이블: {draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.migrationState.operatorApprovalTablesExist ? "적용됨" : "미적용"} / 운영자 승인:{" "}
                      {draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionGateSummary.operatorApprovalSatisfied ? "충족" : "미저장"}
                    </p>
                    <p>주요 남은 조건: {draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionBlockerSummary.primaryRemainingBlockerKo}</p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.patchVersion} />
                    <DetailItem label="Mode" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.mode} />
                    <DetailItem label="Plan Item" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.targetPlanItemId || "-"} />
                    <DetailItem label="Linked Fixture" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.linkedContentItemId ?? "-"} />
                    <DetailItem label="Plan Item Found" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.targetIntegrity.planItemFound)} />
                    <DetailItem label="Fixture Found" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.targetIntegrity.linkedContentItemFound)} />
                    <DetailItem label="Fixture Match" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.targetIntegrity.linkedFixtureMatchesPlanItem)} />
                    <DetailItem
                      label="Approval Persistence"
                      value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.migrationState.operatorApprovalPersistenceAvailable ? "사용 가능" : "미적용"}
                    />
                    <DetailItem label="Approval ID" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.postApprovalState.operatorApprovalId ?? "-"} />
                    <DetailItem label="Approval Status" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.postApprovalState.operatorApprovalStatus ?? "-"} />
                    <DetailItem label="Resolved Blockers" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionBlockerSummary.resolvedBlockers.join(", ") || "-"} />
                    <DetailItem label="Remaining Blockers" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionBlockerSummary.blockerCount)} />
                  </div>
                  <ValidationList
                    title="남은 필수 조건"
                    items={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionBlockerSummary.remainingBlockers.map(formatDraftGenerationGateBlocker)}
                    emptyText="남은 필수 조건이 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="해결된 조건"
                    items={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.executionBlockerSummary.resolvedBlockers.map(formatDraftGenerationGateBlocker)}
                    emptyText="해결된 조건이 없습니다."
                  />
                  <div className="detail-grid">
                    <DetailItem label="LLM 호출" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.llmCall ? "있음" : "없음"} />
                    <DetailItem label="draftMarkdown 변경" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.draftMarkdownMutation ? "있음" : "없음"} />
                    <DetailItem label="draftHtml 변경" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.draftHtmlMutation ? "있음" : "없음"} />
                    <DetailItem label="content_items 수정" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.contentMutation ? "있음" : "없음"} />
                    <DetailItem label="Blogger 쓰기" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.bloggerWrite ? "있음" : "없음"} />
                    <DetailItem label="발행 실행" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.bloggerPublish ? "있음" : "없음"} />
                    <DetailItem label="다음 추천 패치" value={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.nextSafeStepSummary.nextRecommendedPatch} />
                  </div>
                  <ValidationList
                    title="현재 실행 차단 조건"
                    items={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.canonicalBlockingReasons}
                    emptyText="missing requirement가 없습니다."
                    isWarning
                  />
                  <details className="read-block">
                    <summary>초안 생성 실행 게이트 기술 상세</summary>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Layer</th>
                          <th>Gate</th>
                          <th>Status</th>
                          <th>Blocking Reasons</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.gateLayers.map((layer) => (
                          <tr key={layer.key}>
                            <td>{layer.layer}</td>
                            <td>
                              {layer.labelKo}
                              <div className="muted">{layer.key}</div>
                            </td>
                            <td>{layer.status}</td>
                            <td>{layer.blockingReasons.length > 0 ? layer.blockingReasons.join(", ") : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <ValidationList
                      title="Canonical Blocking Reasons"
                      items={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.canonicalBlockingReasons}
                      emptyText="blocking reason이 없습니다."
                      isError
                    />
                    <ValidationList
                      title="Gate Warnings"
                      items={draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.warnings}
                      emptyText="warning이 없습니다."
                      isWarning
                    />
                    <div className="detail-grid">
                      <DetailItem label="DB Read" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.dbWrite)} />
                      <DetailItem label="Content Generation" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.contentGeneration)} />
                      <DetailItem label="LLM Call" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.llmCall)} />
                      <DetailItem label="LLM Log Insert" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.llmCallLogInsert)} />
                      <DetailItem label="Content Mutation" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.contentMutation)} />
                      <DetailItem label="Blogger Write" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.bloggerWrite)} />
                      <DetailItem label="Blogger Publish" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.bloggerPublish)} />
                      <DetailItem label="Token Refresh" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.tokenRefresh)} />
                      <DetailItem label="OAuth Reconnect" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.oauthReconnect)} />
                      <DetailItem label="Approval Mutation" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.approvalMutation)} />
                      <DetailItem label="Attempt Mutation" value={String(draftGenerationExecutionGateResult.draftGenerationExecutionGatePreviewSummary.sideEffectSummary.attemptMutation)} />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “실행 게이트 preview”를 실행하세요. 이 버튼은 보기 전용 gate preview만 호출합니다.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 dry-run 계획</h3>
              <div className="notice warning">
                <strong>9F-2M read-only planner</strong>
                <p>운영자 승인은 저장됐지만 실제 초안 생성은 아직 차단되어 있습니다. 이 섹션은 미래 실행 전에 사용할 입력, 프롬프트 구조, 모델 후보, 출력 계획만 보여주며 아무 것도 생성하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  실제 초안 생성 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  LLM 호출 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  content_items 저장 - 비활성
                </button>
              </div>
              {draftGenerationDryRunPlannerResult ? (
                <>
                  <div className="notice warning">
                    <strong>
                      {draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.persistedApprovalSummary.operatorApprovalSatisfied
                        ? "운영자 승인 저장됨"
                        : "운영자 승인 미저장"}{" "}
                      · 실제 초안 생성은 아직 차단됨
                    </strong>
                    <p>
                      Dry-run only: draftMarkdown/draftHtml 생성, LLM 호출, content_items 수정, Blogger 쓰기/발행/예약, OAuth reconnect, token refresh를 수행하지 않았습니다.
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.patchVersion} />
                    <DetailItem label="Planner Mode" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.plannerMode} />
                    <DetailItem label="Plan ID" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.targetSummary.planId ?? "-"} />
                    <DetailItem label="Plan Item" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.targetSummary.planItemId || "-"} />
                    <DetailItem label="Linked Fixture" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.targetSummary.contentItemId ?? "-"} />
                    <DetailItem label="Slot" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.targetSummary.slotKey ?? "-"} />
                    <DetailItem label="Fixture Status" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.targetSummary.fixtureStatus ?? "-"} />
                    <DetailItem
                      label="Draft Length"
                      value={`${draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.targetSummary.draftMarkdownLength} / ${draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.targetSummary.draftHtmlLength}`}
                    />
                    <DetailItem label="Execution Allowed" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.executionGateSummary.executionAllowed)} />
                    <DetailItem label="Approval ID" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.persistedApprovalSummary.approvalId ?? "-"} />
                  </div>
                  <ValidationList
                    title="남은 실행 blocker"
                    items={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.executionGateSummary.remainingBlockers.map(formatDraftGenerationGateBlocker)}
                    emptyText="남은 blocker가 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="해결된 blocker"
                    items={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.executionGateSummary.resolvedBlockers.map(formatDraftGenerationGateBlocker)}
                    emptyText="해결된 blocker가 없습니다."
                  />
                  <div className="detail-grid">
                    <DetailItem label="Plan Metadata" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.inputSnapshotPlan.willUsePlanMetadata)} />
                    <DetailItem label="Plan Item Metadata" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.inputSnapshotPlan.willUsePlanItemMetadata)} />
                    <DetailItem label="Linked Fixture" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.inputSnapshotPlan.willUseLinkedContentFixture)} />
                    <DetailItem label="Operation Profile" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.inputSnapshotPlan.willUseBlogOperationProfile)} />
                    <DetailItem label="Raw Secrets" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.inputSnapshotPlan.rawSecretsIncluded)} />
                    <DetailItem label="Raw Tokens" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.inputSnapshotPlan.rawTokensIncluded)} />
                  </div>
                  <details className="read-block">
                    <summary>초안 생성 dry-run 계획 기술 상세</summary>
                    <ValidationList
                      title="Prompt Structure Plan"
                      items={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.promptStructurePlan.sections}
                      emptyText="prompt section 계획이 없습니다."
                    />
                    <ValidationList
                      title="Model Candidate Sources"
                      items={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.modelCandidatePlan.candidatesMayComeFrom}
                      emptyText="model candidate source가 없습니다."
                    />
                    <ValidationList
                      title="Future Target Fields"
                      items={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.outputPlan.futureTargetFields}
                      emptyText="future target field가 없습니다."
                    />
                    <div className="detail-grid">
                      <DetailItem label="Full Prompt Rendered" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.promptStructurePlan.fullPromptRendered)} />
                      <DetailItem label="Raw Prompt Stored" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.promptStructurePlan.rawPromptStored)} />
                      <DetailItem label="LLM Call Attempted" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.modelCandidatePlan.llmCallAttempted)} />
                      <DetailItem label="Provider Health Checked" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.modelCandidatePlan.providerHealthChecked)} />
                      <DetailItem label="Next Readiness Patch" value={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.modelCandidatePlan.nextReadinessPatchCandidate} />
                      <DetailItem label="Requires Separate Execution Patch" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.futureSideEffectPlan.requiresSeparateExecutionPatch)} />
                    </div>
                    <div className="detail-grid">
                      <DetailItem label="DB Read" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.dbWrite)} />
                      <DetailItem label="LLM Call" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.llmCall)} />
                      <DetailItem label="LLM Log Mutation" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.llmCallLogMutation)} />
                      <DetailItem label="Content Mutation" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.contentItemMutation)} />
                      <DetailItem label="Draft Markdown Mutation" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.draftMarkdownMutation)} />
                      <DetailItem label="Draft HTML Mutation" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.draftHtmlMutation)} />
                      <DetailItem label="Blogger Write" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.bloggerWrite)} />
                      <DetailItem label="Blogger Draft Save" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.bloggerDraftSave)} />
                      <DetailItem label="Blogger Publish" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.bloggerPublish)} />
                      <DetailItem label="Scheduled Publish" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.scheduledPublish)} />
                      <DetailItem label="OAuth Reconnect" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.oauthReconnect)} />
                      <DetailItem label="Token Refresh" value={String(draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.dryRunPlannerSummary.currentSideEffectSummary.tokenRefresh)} />
                    </div>
                    <ValidationList
                      title="Dry-run Planner Blocking Reasons"
                      items={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.blockingReasons}
                      emptyText="blocking reason이 없습니다."
                      isWarning
                    />
                    <ValidationList
                      title="Dry-run Planner Warnings"
                      items={draftGenerationDryRunPlannerResult.draftGenerationDryRunPlannerSummary.warnings}
                      emptyText="warning이 없습니다."
                      isWarning
                    />
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “dry-run 계획”을 실행하세요. 이 버튼은 보기 전용 planner만 호출합니다.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 LLM 준비상태</h3>
              <div className="notice warning">
                <strong>9F-2N static readiness only</strong>
                <p>LLM provider/model route 설정을 읽어 확인하지만 provider health check, 네트워크 호출, LLM 호출, llm_call_logs 생성은 수행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  Provider health check - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  LLM 호출 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  초안 저장 - 비활성
                </button>
              </div>
              {draftGenerationLlmProviderReadinessResult ? (
                <>
                  <div className="notice warning">
                    <strong>
                      LLM provider/model 경로 확인됨 · 실제 호출 없음
                    </strong>
                    <p>
                      실행 허용: {draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.executionGateSummary.executionAllowed ? "가능" : "차단"} / 운영자 승인:{" "}
                      {draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.persistedApprovalSummary.operatorApprovalSatisfied ? "충족" : "미충족"}
                    </p>
                    <p>secret/env 값은 노출하지 않고 존재 여부만 확인했습니다.</p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.patchVersion} />
                    <DetailItem label="Readiness Mode" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.readinessMode} />
                    <DetailItem label="Plan ID" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.targetSummary.planId ?? "-"} />
                    <DetailItem label="Plan Item" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.targetSummary.planItemId || "-"} />
                    <DetailItem label="Linked Fixture" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.targetSummary.contentItemId ?? "-"} />
                    <DetailItem label="Fixture Status" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.targetSummary.fixtureStatus ?? "-"} />
                    <DetailItem label="Approval ID" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.persistedApprovalSummary.approvalId ?? "-"} />
                    <DetailItem label="Task" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.taskName} />
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Route Resolved" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.routeResolutionPlan.selectedRouteResolved)} />
                    <DetailItem label="Provider Kind" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.providerConfigPlan.providerKind ?? "-"} />
                    <DetailItem label="Provider Enabled" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.providerConfigPlan.providerEnabledForDraftGeneration)} />
                    <DetailItem label="Model Resolved" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.modelConfigPlan.modelCandidateResolved)} />
                    <DetailItem label="Selected Provider" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.routeResolutionPlan.selectedProviderKey ?? "-"} />
                    <DetailItem label="Selected Model" value={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.routeResolutionPlan.selectedModelDisplayName ?? "-"} />
                    <DetailItem label="Env Checked" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.secretAndEnvReadiness.envPresenceChecked)} />
                    <DetailItem label="Secret Exposed" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.secretAndEnvReadiness.rawSecretValueExposed)} />
                  </div>
                  <ValidationList
                    title="기존 실행 blocker"
                    items={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.executionGateSummary.remainingBlockers.map(formatDraftGenerationGateBlocker)}
                    emptyText="남은 실행 blocker가 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="LLM readiness blockers"
                    items={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.readinessBlockers.map(formatLlmReadinessBlocker)}
                    emptyText="LLM readiness blocker가 없습니다."
                    isWarning
                  />
                  <details className="read-block">
                    <summary>초안 생성 LLM 준비상태 기술 상세</summary>
                    <ValidationList
                      title="Missing Env Vars"
                      items={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.secretAndEnvReadiness.missingRequiredEnvVars}
                      emptyText="missing required env var가 없습니다."
                      isWarning
                    />
                    <ValidationList
                      title="LLM Readiness Warnings"
                      items={draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.readinessWarnings}
                      emptyText="warning이 없습니다."
                      isWarning
                    />
                    <div className="detail-grid">
                      <DetailItem label="LLM Call Attempted" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmCallAttempted)} />
                      <DetailItem label="Provider Health Checked" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.providerHealthChecked)} />
                      <DetailItem label="Provider Network Call" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.providerNetworkCallAttempted)} />
                      <DetailItem label="Token Budget Known" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.modelConfigPlan.modelTokenBudgetKnown)} />
                      <DetailItem label="Temperature Known" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.modelConfigPlan.modelTemperatureKnown)} />
                      <DetailItem label="Fallback Route" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.routeResolutionPlan.fallbackRouteAvailable)} />
                    </div>
                    <div className="detail-grid">
                      <DetailItem label="DB Read" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.dbWrite)} />
                      <DetailItem label="Env Read" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.envRead)} />
                      <DetailItem label="Secret Value Exposed" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.secretValueExposed)} />
                      <DetailItem label="Provider Health Check" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.providerHealthChecked)} />
                      <DetailItem label="Provider Network Call" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.providerNetworkCall)} />
                      <DetailItem label="LLM Call" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.llmCall)} />
                      <DetailItem label="LLM Log Mutation" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.llmCallLogMutation)} />
                      <DetailItem label="Content Mutation" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.contentItemMutation)} />
                      <DetailItem label="Draft Markdown Mutation" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.draftMarkdownMutation)} />
                      <DetailItem label="Draft HTML Mutation" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.draftHtmlMutation)} />
                      <DetailItem label="Blogger Write" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.bloggerWrite)} />
                      <DetailItem label="Blogger Publish" value={String(draftGenerationLlmProviderReadinessResult.draftGenerationLlmProviderReadinessSummary.llmProviderReadinessSummary.currentSideEffectSummary.bloggerPublish)} />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “LLM 준비상태”를 실행하세요. 이 버튼은 provider/model route 정적 readiness만 확인합니다.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 LLM health-check preview</h3>
              <div className="notice warning">
                <strong>9F-2O provider health-check plan only</strong>
                <p>provider health-check 실행 계획을 확인합니다. 이번 단계에서는 provider 호출, 네트워크 호출, LLM completion, prompt 렌더링, llm_call_logs 생성, content_items 수정이 모두 차단됩니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  Health-check 실행 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  LLM completion - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  초안 저장 - 비활성
                </button>
              </div>
              {draftGenerationLlmProviderHealthCheckPreviewResult ? (
                <>
                  <div className="notice warning">
                    <strong>Health-check preview 확인됨 · provider 호출 없음</strong>
                    <p>
                      health-check 허용:{" "}
                      {draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary.healthCheckAllowedNow
                        ? "가능"
                        : "차단"}{" "}
                      / 실행 deferred:{" "}
                      {String(
                        draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                          .healthCheckExecutionDeferred
                      )}
                    </p>
                    <p>이번 preview는 selected provider/model을 기준으로 다음 패치에서 가능한 safe health-check contract만 보여줍니다.</p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.patchVersion} />
                    <DetailItem
                      label="Preview Mode"
                      value={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewMode}
                    />
                    <DetailItem label="Requested Mode" value={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.requestedMode} />
                    <DetailItem label="Plan ID" value={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.targetSummary.planId ?? "-"} />
                    <DetailItem label="Plan Item" value={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.targetSummary.planItemId || "-"} />
                    <DetailItem
                      label="Linked Fixture"
                      value={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.targetSummary.contentItemId ?? "-"}
                    />
                    <DetailItem
                      label="Approval Satisfied"
                      value={String(
                        draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.persistedApprovalSummary
                          .operatorApprovalSatisfied
                      )}
                    />
                    <DetailItem
                      label="Execution Allowed"
                      value={String(draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.executionGateSummary.executionAllowed)}
                    />
                  </div>
                  <div className="detail-grid">
                    <DetailItem
                      label="Route Resolved"
                      value={String(
                        draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.llmProviderReadinessSummary
                          .selectedRouteResolved
                      )}
                    />
                    <DetailItem
                      label="Provider Kind"
                      value={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.llmProviderReadinessSummary.providerKind ?? "-"}
                    />
                    <DetailItem
                      label="Provider Config"
                      value={String(
                        draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.llmProviderReadinessSummary
                          .providerConfigFound
                      )}
                    />
                    <DetailItem
                      label="Model Config"
                      value={String(
                        draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.llmProviderReadinessSummary.modelConfigFound
                      )}
                    />
                    <DetailItem
                      label="Selected Provider"
                      value={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.llmProviderReadinessSummary.selectedProviderKey ?? "-"}
                    />
                    <DetailItem
                      label="Selected Model"
                      value={
                        draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.llmProviderReadinessSummary
                          .selectedModelDisplayName ?? "-"
                      }
                    />
                    <DetailItem
                      label="Secret Exposed"
                      value={String(
                        draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.llmProviderReadinessSummary
                          .rawSecretValueExposed
                      )}
                    />
                    <DetailItem
                      label="Planned Timeout"
                      value={`${draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary.plannedHealthCheckContract.plannedTimeoutMs}ms`}
                    />
                  </div>
                  <ValidationList
                    title="기존 실행 blocker"
                    items={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.executionGateSummary.remainingBlockers.map(
                      formatDraftGenerationGateBlocker
                    )}
                    emptyText="남은 실행 blocker가 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="Health-check blockers"
                    items={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary.healthCheckBlockers.map(
                      formatLlmHealthCheckBlocker
                    )}
                    emptyText="health-check blocker가 없습니다."
                    isWarning
                  />
                  <details className="read-block">
                    <summary>초안 생성 LLM health-check preview 기술 상세</summary>
                    <div className="detail-grid">
                      <DetailItem
                        label="Provider Health Attempted"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.providerHealthCheckAttempted
                        )}
                      />
                      <DetailItem
                        label="Provider Network Call"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.providerNetworkCallAttempted
                        )}
                      />
                      <DetailItem
                        label="LLM Completion"
                        value={String(draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.llmCompletionAttempted)}
                      />
                      <DetailItem
                        label="Prompt Rendered"
                        value={String(draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.promptRendered)}
                      />
                      <DetailItem
                        label="Raw Prompt Stored"
                        value={String(draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.rawPromptStored)}
                      />
                      <DetailItem
                        label="Will Send Draft Prompt"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .plannedHealthCheckContract.willSendDraftPrompt
                        )}
                      />
                      <DetailItem
                        label="Will Request Completion"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .plannedHealthCheckContract.willRequestCompletion
                        )}
                      />
                      <DetailItem
                        label="Will Create LLM Log"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .plannedHealthCheckContract.willCreateLlmCallLog
                        )}
                      />
                    </div>
                    <ValidationList
                      title="Planned Result Shape"
                      items={
                        draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                          .plannedHealthCheckContract.plannedResultShape
                      }
                      emptyText="planned result shape가 없습니다."
                    />
                    <ValidationList
                      title="Health-check Warnings"
                      items={draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary.healthCheckWarnings}
                      emptyText="warning이 없습니다."
                      isWarning
                    />
                    <div className="detail-grid">
                      <DetailItem
                        label="OpenAI Contract"
                        value={
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .providerSpecificPlan.openai.allowedHealthCheckType
                        }
                      />
                      <DetailItem
                        label="Local Contract"
                        value={
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .providerSpecificPlan.local.allowedHealthCheckType
                        }
                      />
                      <DetailItem
                        label="HTTP Contract"
                        value={
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .providerSpecificPlan.http.allowedHealthCheckType
                        }
                      />
                      <DetailItem
                        label="CLI Contract"
                        value={
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .providerSpecificPlan.cli.allowedHealthCheckType
                        }
                      />
                    </div>
                    <div className="detail-grid">
                      <DetailItem
                        label="DB Read"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.dbRead
                        )}
                      />
                      <DetailItem
                        label="DB Write"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.dbWrite
                        )}
                      />
                      <DetailItem
                        label="Env Read"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.envRead
                        )}
                      />
                      <DetailItem
                        label="Secret Exposed"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.secretValueExposed
                        )}
                      />
                      <DetailItem
                        label="Provider Health"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.providerHealthCheck
                        )}
                      />
                      <DetailItem
                        label="Provider Network"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.providerNetworkCall
                        )}
                      />
                      <DetailItem
                        label="LLM Completion"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.llmCompletion
                        )}
                      />
                      <DetailItem
                        label="LLM Log Mutation"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.llmCallLogMutation
                        )}
                      />
                      <DetailItem
                        label="Content Mutation"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.contentItemMutation
                        )}
                      />
                      <DetailItem
                        label="Draft Markdown"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.draftMarkdownMutation
                        )}
                      />
                      <DetailItem
                        label="Draft HTML"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.draftHtmlMutation
                        )}
                      />
                      <DetailItem
                        label="Blogger Write"
                        value={String(
                          draftGenerationLlmProviderHealthCheckPreviewResult.draftGenerationLlmProviderHealthCheckPreviewSummary.healthCheckPreviewSummary
                            .currentSideEffectSummary.bloggerWrite
                        )}
                      />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">
                  후보 큐에서 linked content item이 있는 행의 “LLM health-check preview”를 실행하세요. 이 버튼은 provider health-check를 실행하지 않고 다음 패치의 safe contract만 확인합니다.
                </div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 LLM health-check 실행 게이트</h3>
              <div className="notice warning">
                <strong>9F-2P gated health-check execution</strong>
                <p>provider health-check 실행 경로를 gate로 확인합니다. 기본 UI 호출은 feature flag, 확인 문구, idempotency key를 보내지 않으므로 provider network call 없이 차단되어야 합니다.</p>
                <p>이 단계는 content generation이 아니며 completion/chat/generate endpoint, prompt 렌더링, llm_call_logs 생성, content_items 수정, Blogger write/publish/schedule을 수행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  Live health-check 실행 - 명시 승인 전 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  Completion/generate - 금지
                </button>
                <button className="button small secondary" type="button" disabled>
                  Draft mutation - 금지
                </button>
              </div>
              {draftGenerationLlmProviderHealthCheckExecutionResult ? (
                <>
                  <div className="notice warning">
                    <strong>Health-check execution gate 확인됨</strong>
                    <p>
                      실행 허용:{" "}
                      {draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                        .healthCheckExecutionAllowedNow
                        ? "가능"
                        : "차단"}{" "}
                      / 실행됨:{" "}
                      {String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                          .healthCheckExecuted
                      )}{" "}
                      / provider network call:{" "}
                      {String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                          .providerNetworkCallAttempted
                      )}
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.patchVersion} />
                    <DetailItem
                      label="Execution Mode"
                      value={draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.executionMode}
                    />
                    <DetailItem
                      label="Requested Mode"
                      value={
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                          .requestedMode
                      }
                    />
                    <DetailItem
                      label="Plan Item"
                      value={draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.targetSummary.planItemId}
                    />
                    <DetailItem
                      label="Linked Fixture"
                      value={draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.targetSummary.contentItemId ?? "-"}
                    />
                    <DetailItem
                      label="Approval Satisfied"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.persistedApprovalSummary
                          .operatorApprovalSatisfied
                      )}
                    />
                    <DetailItem
                      label="Execution Allowed"
                      value={String(draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.executionGateSummary.executionAllowed)}
                    />
                    <DetailItem
                      label="Endpoint Category"
                      value={
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                          .safeHealthCheckContract.endpointCategory ?? "-"
                      }
                    />
                  </div>
                  <div className="detail-grid">
                    <DetailItem
                      label="Health Flag"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary.gateSummary
                          .healthCheckFeatureFlagEnabled
                      )}
                    />
                    <DetailItem
                      label="Network Flag"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary.gateSummary
                          .providerNetworkCallsFeatureFlagEnabled
                      )}
                    />
                    <DetailItem
                      label="Confirmation"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary.gateSummary
                          .confirmationPhraseSatisfied
                      )}
                    />
                    <DetailItem
                      label="Idempotency"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary.gateSummary
                          .idempotencyKeyPresent
                      )}
                    />
                    <DetailItem
                      label="Route Resolved"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary.gateSummary
                          .providerRouteResolved
                      )}
                    />
                    <DetailItem
                      label="Required Env"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary.gateSummary
                          .requiredEnvPresent
                      )}
                    />
                    <DetailItem
                      label="Completion Forbidden"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                          .safeHealthCheckContract.completionEndpointsForbidden
                      )}
                    />
                    <DetailItem
                      label="Secret Exposed"
                      value={String(
                        draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                          .safeHealthCheckContract.secretValueExposed
                      )}
                    />
                  </div>
                  <ValidationList
                    title="Health-check execution blockers"
                    items={draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary.healthCheckBlockers.map(
                      formatLlmHealthCheckExecutionBlocker
                    )}
                    emptyText="health-check execution blocker가 없습니다."
                    isWarning
                  />
                  <details className="read-block">
                    <summary>초안 생성 LLM health-check 실행 게이트 기술 상세</summary>
                    <div className="detail-grid">
                      <DetailItem
                        label="DB Read"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.dbRead
                        )}
                      />
                      <DetailItem
                        label="DB Write"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.dbWrite
                        )}
                      />
                      <DetailItem
                        label="Provider Health"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.providerHealthChecked
                        )}
                      />
                      <DetailItem
                        label="Provider Network"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.providerNetworkCall
                        )}
                      />
                      <DetailItem
                        label="External Send"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.externalSend
                        )}
                      />
                      <DetailItem
                        label="LLM Call"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.llmCall
                        )}
                      />
                      <DetailItem
                        label="LLM Completion"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.llmCompletionCall
                        )}
                      />
                      <DetailItem
                        label="LLM Log Mutation"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.llmCallLogMutation
                        )}
                      />
                      <DetailItem
                        label="Content Mutation"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.contentItemMutation
                        )}
                      />
                      <DetailItem
                        label="Draft Markdown"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.draftMarkdownMutation
                        )}
                      />
                      <DetailItem
                        label="Draft HTML"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.draftHtmlMutation
                        )}
                      />
                      <DetailItem
                        label="Blogger Write"
                        value={String(
                          draftGenerationLlmProviderHealthCheckExecutionResult.draftGenerationLlmProviderHealthCheckExecutionSummary.healthCheckExecutionSummary
                            .currentSideEffectSummary.bloggerWrite
                        )}
                      />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “health-check 실행 게이트”를 실행하세요. 기본 호출은 provider network call 없이 차단 상태만 확인합니다.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 최종 실행 체크리스트</h3>
              <div className="notice warning">
                <strong>운영자 승인은 저장되어 있지만, 실제 초안 생성은 아직 차단되어 있습니다.</strong>
                <p>이 화면은 실행 전 최종 점검표이며 LLM 호출, prompt 렌더링, provider network call, 초안 저장, Blogger write/publish/schedule을 하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  LLM 실행 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  Draft mutation - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  Blogger write - 비활성
                </button>
              </div>
              {draftGenerationFinalExecutionChecklistResult ? (
                <>
                  <div className="notice warning">
                    <strong>
                      Final checklist:{" "}
                      {draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.finalChecklistSummary.overallStatus}
                    </strong>
                    <p>
                      executionAllowed: {String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.executionAllowed)} / finalDraftGenerationAllowed:{" "}
                      {String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.finalDraftGenerationAllowed)}
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.patchVersion} />
                    <DetailItem label="Checklist Mode" value={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.checklistMode} />
                    <DetailItem label="Plan ID" value={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.targetSummary.planId ?? "-"} />
                    <DetailItem label="Plan Item" value={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.targetSummary.planItemId} />
                    <DetailItem label="Content Item" value={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.targetSummary.contentItemId ?? "-"} />
                    <DetailItem label="Fixture Status" value={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.targetSummary.fixtureStatus ?? "-"} />
                    <DetailItem
                      label="Draft Lengths"
                      value={`${draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.targetSummary.draftMarkdownLength} / ${draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.targetSummary.draftHtmlLength}`}
                    />
                    <DetailItem
                      label="Approval Satisfied"
                      value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.persistedApprovalSummary.operatorApprovalSatisfied)}
                    />
                  </div>
                  <div className="detail-grid">
                    <DetailItem
                      label="Dry-run Planner"
                      value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.priorGateSummary.dryRunPlannerAvailable)}
                    />
                    <DetailItem
                      label="LLM Readiness"
                      value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.priorGateSummary.llmProviderReadinessAvailable)}
                    />
                    <DetailItem
                      label="Health Preview"
                      value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.priorGateSummary.llmProviderHealthCheckPreviewAvailable)}
                    />
                    <DetailItem
                      label="Health Gate"
                      value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.priorGateSummary.llmProviderHealthCheckExecutionGateAvailable)}
                    />
                    <DetailItem
                      label="Health Executed Now"
                      value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.priorGateSummary.healthCheckExecutedNow)}
                    />
                    <DetailItem
                      label="Provider Network Now"
                      value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.priorGateSummary.providerNetworkCallAttemptedNow)}
                    />
                  </div>
                  <ValidationList
                    title="Final checklist pass"
                    items={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.finalChecklistSummary.passItems.map(formatChecklistItem)}
                    emptyText="pass 항목이 없습니다."
                  />
                  <ValidationList
                    title="Final checklist blocked"
                    items={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.finalChecklistSummary.blockedItems.map(formatChecklistItem)}
                    emptyText="blocked 항목이 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="Final checklist caution"
                    items={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.finalChecklistSummary.cautionItems.map(formatChecklistItem)}
                    emptyText="caution 항목이 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="Remaining execution blockers"
                    items={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.executionGateSummary.remainingBlockers.map(formatDraftGenerationGateBlocker)}
                    emptyText="remaining blocker가 없습니다."
                    isWarning
                  />
                  <details className="read-block">
                    <summary>운영자 runbook 및 side-effect 상세</summary>
                    <ValidationList
                      title="This patch does"
                      items={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.operatorRunbook.thisPatchDoes}
                      emptyText="항목이 없습니다."
                    />
                    <ValidationList
                      title="This patch does not do"
                      items={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.operatorRunbook.thisPatchDoesNotDo}
                      emptyText="항목이 없습니다."
                      isWarning
                    />
                    <ValidationList
                      title="Future execution would require"
                      items={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.operatorRunbook.futureExecutionWouldRequire}
                      emptyText="항목이 없습니다."
                      isWarning
                    />
                    <div className="detail-grid">
                      <DetailItem
                        label="Recommended Next"
                        value={draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.operatorRunbook.recommendedNextPatch}
                      />
                      <DetailItem
                        label="DB Read"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.dbRead)}
                      />
                      <DetailItem
                        label="DB Write"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.dbWrite)}
                      />
                      <DetailItem
                        label="Provider Network"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.providerNetworkCall)}
                      />
                      <DetailItem
                        label="Prompt Rendered"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.promptRendered)}
                      />
                      <DetailItem
                        label="LLM Completion"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.llmCompletion)}
                      />
                      <DetailItem
                        label="LLM Log Mutation"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.llmCallLogMutation)}
                      />
                      <DetailItem
                        label="Content Mutation"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.contentItemMutation)}
                      />
                      <DetailItem
                        label="Draft Markdown"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.draftMarkdownMutation)}
                      />
                      <DetailItem
                        label="Draft HTML"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.draftHtmlMutation)}
                      />
                      <DetailItem
                        label="Blogger Write"
                        value={String(draftGenerationFinalExecutionChecklistResult.draftGenerationFinalExecutionChecklistSummary.currentSideEffectSummary.bloggerWrite)}
                      />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “최종 실행 체크리스트”를 실행하세요. 이 preview는 읽기 전용 runbook만 표시합니다.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 prompt preview</h3>
              <div className="notice">
                <strong>LLM에 보낼 지시문을 미리 렌더링했지만, 실제 LLM 호출이나 초안 저장은 하지 않았습니다.</strong>
                <p>이 preview는 prompt 구조와 입력 컨텍스트를 운영자가 확인하기 위한 읽기 전용 화면입니다.</p>
                <p>prompt는 DB에 저장하지 않으며, provider network call, content_items 수정, Blogger write/publish/schedule도 수행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  LLM 호출 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  Prompt 저장 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  Draft 생성 - 비활성
                </button>
              </div>
              {draftGenerationPromptRenderPreviewResult ? (
                <>
                  <div className="notice warning">
                    <strong>
                      Prompt preview only: {draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.promptVersion}
                    </strong>
                    <p>
                      executionAllowed: {String(draftGenerationPromptRenderPreviewResult.executionGateSummary.executionAllowed)} / finalDraftGenerationAllowed:{" "}
                      {String(draftGenerationPromptRenderPreviewResult.executionGateSummary.finalDraftGenerationAllowed)}
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationPromptRenderPreviewResult.patchVersion} />
                    <DetailItem label="Preview Mode" value={draftGenerationPromptRenderPreviewResult.previewMode} />
                    <DetailItem label="Plan ID" value={draftGenerationPromptRenderPreviewResult.targetSummary.planId ?? "-"} />
                    <DetailItem label="Plan Item" value={draftGenerationPromptRenderPreviewResult.targetSummary.planItemId} />
                    <DetailItem label="Content Item" value={draftGenerationPromptRenderPreviewResult.targetSummary.contentItemId ?? "-"} />
                    <DetailItem label="Fixture Status" value={draftGenerationPromptRenderPreviewResult.targetSummary.fixtureStatus ?? "-"} />
                    <DetailItem label="Approval Satisfied" value={String(draftGenerationPromptRenderPreviewResult.persistedApprovalSummary.operatorApprovalSatisfied)} />
                    <DetailItem label="Prompt Stored" value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.rawPromptStored)} />
                    <DetailItem label="Prompt Sent To LLM" value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.promptSentToLlm)} />
                    <DetailItem label="Prompt Char Length" value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.promptCharLength)} />
                    <DetailItem label="Estimated Tokens" value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.estimatedPromptTokens)} />
                    <DetailItem label="Prompt SHA-256" value={draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.promptSha256} />
                  </div>
                  <ValidationList
                    title="Remaining execution blockers"
                    items={draftGenerationPromptRenderPreviewResult.executionGateSummary.remainingBlockers.map(formatDraftGenerationGateBlocker)}
                    emptyText="remaining blocker가 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="Prompt sections"
                    items={draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.promptSections.map(
                      (section) => `${section.key}: ${section.title} (${section.charLength} chars)`
                    )}
                    emptyText="prompt section이 없습니다."
                  />
                  <div className="detail-grid">
                    <DetailItem label="Redaction Applied" value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.redactionApplied)} />
                    <DetailItem
                      label="Redacted Placeholder Count"
                      value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.redactionSummary.redactedPlaceholderCount)}
                    />
                    <DetailItem
                      label="Raw Secrets Included"
                      value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.redactionSummary.rawSecretsIncluded)}
                    />
                    <DetailItem
                      label="Raw Tokens Included"
                      value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.redactionSummary.rawTokensIncluded)}
                    />
                    <DetailItem
                      label="Raw Env Values Included"
                      value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.redactionSummary.rawEnvValuesIncluded)}
                    />
                    <DetailItem
                      label="Provider Credentials Included"
                      value={String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.redactionSummary.providerCredentialsIncluded)}
                    />
                  </div>
                  <details className="read-block">
                    <summary>Prompt section preview</summary>
                    {draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.promptSections.map((section) => (
                      <div className="read-block" key={section.key}>
                        <h4>{section.title}</h4>
                        <p className="muted">
                          {section.key} / {section.charLength} chars
                        </p>
                        <pre>{section.previewText}</pre>
                      </div>
                    ))}
                  </details>
                  <details className="read-block">
                    <summary>Full prompt preview</summary>
                    <div className="notice">
                      full prompt preview truncated: {String(draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.fullPromptPreviewTruncated)} / max chars:{" "}
                      {draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.maxPreviewChars}
                    </div>
                    <pre>{draftGenerationPromptRenderPreviewResult.promptRenderPreviewSummary.fullPromptPreview}</pre>
                  </details>
                  <details className="read-block">
                    <summary>Prompt preview side-effect 상세</summary>
                    <div className="detail-grid">
                      <DetailItem label="DB Read" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.dbWrite)} />
                      <DetailItem label="Env Read" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.envRead)} />
                      <DetailItem label="Secret Exposed" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.secretValueExposed)} />
                      <DetailItem label="Prompt Rendered For Preview" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.promptRenderedForPreview)} />
                      <DetailItem label="Prompt Stored" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.promptStored)} />
                      <DetailItem label="Provider Health Checked" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.providerHealthChecked)} />
                      <DetailItem label="Provider Network" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.providerNetworkCall)} />
                      <DetailItem label="LLM Call" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.llmCall)} />
                      <DetailItem label="LLM Log Mutation" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.llmCallLogMutation)} />
                      <DetailItem label="Content Mutation" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.contentItemMutation)} />
                      <DetailItem label="Draft Markdown" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.draftMarkdownMutation)} />
                      <DetailItem label="Draft HTML" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.draftHtmlMutation)} />
                      <DetailItem label="Blogger Write" value={String(draftGenerationPromptRenderPreviewResult.currentSideEffectSummary.bloggerWrite)} />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “prompt preview”를 실행하세요. 이 단계는 prompt만 미리 보고 저장/전송/생성하지 않습니다.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 prompt 품질 체크리스트</h3>
              <div className="notice">
                <strong>LLM 호출 전에 prompt 구조와 안전 조건을 정적 규칙으로 점검했습니다.</strong>
                <p>이 단계는 LLM judge가 아니며 실제 LLM 호출, prompt 저장, 초안 저장, provider network call, Blogger write/publish를 수행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  LLM judge - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  Provider call - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  Content mutation - 비활성
                </button>
              </div>
              {draftGenerationPromptQualityChecklistPreviewResult ? (
                <>
                  <div
                    className={
                      draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.qualityGatePassed
                        ? "notice"
                        : "notice warning"
                    }
                  >
                    <strong>
                      Quality gate:{" "}
                      {draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.qualityGatePassed ? "pass" : "blocked"}
                    </strong>
                    <p>
                      qualityGatePassed가 true여도 executionAllowed와 finalDraftGenerationAllowed는 계속 false입니다. 실제 실행은 별도 패치와 명시 승인 전까지 차단됩니다.
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationPromptQualityChecklistPreviewResult.patchVersion} />
                    <DetailItem label="Preview Mode" value={draftGenerationPromptQualityChecklistPreviewResult.previewMode} />
                    <DetailItem label="Plan ID" value={draftGenerationPromptQualityChecklistPreviewResult.targetSummary.planId ?? "-"} />
                    <DetailItem label="Plan Item" value={draftGenerationPromptQualityChecklistPreviewResult.targetSummary.planItemId} />
                    <DetailItem label="Content Item" value={draftGenerationPromptQualityChecklistPreviewResult.targetSummary.contentItemId ?? "-"} />
                    <DetailItem label="Fixture Status" value={draftGenerationPromptQualityChecklistPreviewResult.targetSummary.fixtureStatus ?? "-"} />
                    <DetailItem
                      label="Approval Satisfied"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.persistedApprovalSummary.operatorApprovalSatisfied)}
                    />
                    <DetailItem label="Execution Allowed" value={String(draftGenerationPromptQualityChecklistPreviewResult.executionGateSummary.executionAllowed)} />
                    <DetailItem
                      label="Final Draft Allowed"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.executionGateSummary.finalDraftGenerationAllowed)}
                    />
                    <DetailItem label="Checklist Version" value={draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.checklistVersion} />
                    <DetailItem
                      label="Prompt Version"
                      value={draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.promptVersion}
                    />
                    <DetailItem
                      label="Source Prompt Patch"
                      value={draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.sourcePromptPreviewPatchVersion}
                    />
                  </div>
                  <div className="detail-grid">
                    <DetailItem
                      label="Total Checks"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.totalChecks)}
                    />
                    <DetailItem label="Pass" value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.passCount)} />
                    <DetailItem label="Warn" value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.warnCount)} />
                    <DetailItem label="Fail" value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.failCount)} />
                    <DetailItem
                      label="N/A"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.notApplicableCount)}
                    />
                    <DetailItem
                      label="Future Execution Allowed By Quality"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.qualityGateWouldAllowFutureExecution)}
                    />
                  </div>
                  <ValidationList
                    title="Remaining execution blockers"
                    items={draftGenerationPromptQualityChecklistPreviewResult.executionGateSummary.remainingBlockers.map(formatDraftGenerationGateBlocker)}
                    emptyText="remaining blocker가 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="Quality gate blockers"
                    items={draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.qualityGateBlockingReasons}
                    emptyText="quality gate blocker가 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="Quality warnings"
                    items={draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.qualityWarnings}
                    emptyText="quality warning이 없습니다."
                    isWarning
                  />
                  <ValidationList
                    title="Category status"
                    items={draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.categories.map(
                      (category) => `${category.status}: ${category.label} (${category.checks.length} checks)`
                    )}
                    emptyText="category가 없습니다."
                  />
                  <details className="read-block">
                    <summary>Category별 체크 상세</summary>
                    {draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.categories.map((category) => (
                      <div className="read-block" key={category.key}>
                        <h4>
                          {category.label} · {category.status}
                        </h4>
                        <ValidationList
                          title="Checks"
                          items={category.checks.map(formatPromptQualityCheck)}
                          emptyText="check가 없습니다."
                          isWarning={category.status !== "pass"}
                        />
                      </div>
                    ))}
                  </details>
                  <div className="detail-grid">
                    <DetailItem
                      label="Forbidden Scan"
                      value={draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.redactionAndSecretScan.passed ? "pass" : "fail"}
                    />
                    <DetailItem
                      label="Forbidden Hits"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.redactionAndSecretScan.forbiddenHits.length)}
                    />
                    <DetailItem
                      label="Raw Secrets Included"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.redactionAndSecretScan.rawSecretsIncluded)}
                    />
                    <DetailItem
                      label="Raw Tokens Included"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.redactionAndSecretScan.rawTokensIncluded)}
                    />
                    <DetailItem
                      label="Raw Env Values Included"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.redactionAndSecretScan.rawEnvValuesIncluded)}
                    />
                    <DetailItem
                      label="Prompt Char Length"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.lengthAndBudget.promptCharLength)}
                    />
                    <DetailItem
                      label="Estimated Tokens"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.lengthAndBudget.estimatedPromptTokens ?? "-")}
                    />
                    <DetailItem
                      label="Within Preview Budget"
                      value={String(draftGenerationPromptQualityChecklistPreviewResult.promptQualityChecklistSummary.lengthAndBudget.promptWithinPreviewBudget)}
                    />
                  </div>
                  <details className="read-block">
                    <summary>Prompt quality side-effect 상세</summary>
                    <div className="detail-grid">
                      <DetailItem label="DB Read" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.dbWrite)} />
                      <DetailItem label="Env Read" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.envRead)} />
                      <DetailItem label="Secret Exposed" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.secretValueExposed)} />
                      <DetailItem
                        label="Prompt Rendered For Checklist"
                        value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.promptRenderedForChecklist)}
                      />
                      <DetailItem label="Prompt Stored" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.promptStored)} />
                      <DetailItem label="Prompt Sent To LLM" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.promptSentToLlm)} />
                      <DetailItem
                        label="Provider Health Checked"
                        value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.providerHealthChecked)}
                      />
                      <DetailItem
                        label="Provider Network"
                        value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.providerNetworkCall)}
                      />
                      <DetailItem label="LLM Call" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.llmCall)} />
                      <DetailItem
                        label="LLM Evaluator Call"
                        value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.llmEvaluatorCall)}
                      />
                      <DetailItem
                        label="LLM Log Mutation"
                        value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.llmCallLogMutation)}
                      />
                      <DetailItem
                        label="Content Mutation"
                        value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.contentItemMutation)}
                      />
                      <DetailItem
                        label="Draft Markdown"
                        value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.draftMarkdownMutation)}
                      />
                      <DetailItem label="Draft HTML" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.draftHtmlMutation)} />
                      <DetailItem label="Blogger Write" value={String(draftGenerationPromptQualityChecklistPreviewResult.currentSideEffectSummary.bloggerWrite)} />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “prompt 품질 체크”를 실행하세요. 이 단계는 정적 규칙만 실행하고 저장/전송/생성하지 않습니다.</div>
              )}
            </div>

            <details className="read-block">
              <summary>기술 상세</summary>
              <div className="detail-grid">
                <DetailItem label="Mode" value={dailyContentPlanSummary.mode} />
                <DetailItem label="Plan Version" value={dailyContentPlanSummary.planVersion} />
                <DetailItem label="Plan Mode" value={dailyContentPlanSummary.planMode} />
                <DetailItem label="Target Blogger Blog" value={dailyContentPlanSummary.targetBloggerBlogName ?? "-"} />
                <DetailItem label="Target Blogger Blog ID" value={dailyContentPlanSummary.targetBloggerBlogId || "-"} />
                <DetailItem label="Target Blogger Blog URL" value={dailyContentPlanSummary.targetBloggerBlogUrl ?? "-"} />
                <DetailItem label="Profile Found" value={String(dailyContentPlanSummary.profileFound)} />
                <DetailItem label="Profile Healthy" value={String(dailyContentPlanSummary.profileHealthy)} />
                <DetailItem label="Would Create" value={String(dailyContentPlanSummary.planWouldBeCreated)} />
                <DetailItem label="Would Update" value={String(dailyContentPlanSummary.planWouldBeUpdated)} />
                <DetailItem label="Existing Plan Found" value={String(dailyContentPlanSummary.existingPlanFound)} />
                <DetailItem label="Persisted Item Count" value={String(dailyContentPlanSummary.persistedItemCount)} />
                <DetailItem label="Persisted Approval Required" value={String(dailyContentPlanSummary.persistedApprovalRequiredCount)} />
                <DetailItem label="Persisted Generation Allowed" value={String(dailyContentPlanSummary.persistedGenerationAllowedCount)} />
                <DetailItem label="Persisted Publish Allowed" value={String(dailyContentPlanSummary.persistedPublishExecutionAllowedCount)} />
                <DetailItem label="Persisted Schedule Allowed" value={String(dailyContentPlanSummary.persistedScheduledPublishAllowedCount)} />
              </div>
              <ValidationList title="Daily Content Plan Blocking Reasons" items={dailyContentPlanSummary.blockingReasons} emptyText="blocking reason이 없습니다." isError />
              <ValidationList title="Daily Content Plan Warnings" items={dailyContentPlanSummary.warnings} emptyText="warning이 없습니다." isWarning />
              <div className="detail-grid">
                <DetailItem label="DB Read" value={String(dailyContentPlanSummary.sideEffectSummary.dbRead)} />
                <DetailItem label="DB Write" value={String(dailyContentPlanSummary.sideEffectSummary.dbWrite)} />
                <DetailItem label="Schema Migration" value={String(dailyContentPlanSummary.sideEffectSummary.schemaMigration)} />
                <DetailItem label="Blogger Write" value={String(dailyContentPlanSummary.sideEffectSummary.bloggerWrite)} />
                <DetailItem label="Blogger Publish" value={String(dailyContentPlanSummary.sideEffectSummary.bloggerPublish)} />
                <DetailItem label="Blogger Draft Save" value={String(dailyContentPlanSummary.sideEffectSummary.bloggerDraftSave)} />
                <DetailItem label="Token Refresh" value={String(dailyContentPlanSummary.sideEffectSummary.tokenRefresh)} />
                <DetailItem label="OAuth Reconnect" value={String(dailyContentPlanSummary.sideEffectSummary.oauthReconnect)} />
                <DetailItem label="Content Generation" value={String(dailyContentPlanSummary.sideEffectSummary.contentGeneration)} />
                <DetailItem label="Content Mutation" value={String(dailyContentPlanSummary.sideEffectSummary.contentMutation)} />
                <DetailItem label="Approval Mutation" value={String(dailyContentPlanSummary.sideEffectSummary.approvalMutation)} />
                <DetailItem label="Attempt Mutation" value={String(dailyContentPlanSummary.sideEffectSummary.attemptMutation)} />
                <DetailItem label="LLM Call" value={String(dailyContentPlanSummary.sideEffectSummary.llmCall)} />
              </div>
              <div className="detail-grid">
                <DetailItem label="No Content Generation" value={String(dailyContentPlanSummary.guardrailSummary.noContentGeneration)} />
                <DetailItem label="No LLM Call" value={String(dailyContentPlanSummary.guardrailSummary.noLlmCall)} />
                <DetailItem label="No Content Mutation" value={String(dailyContentPlanSummary.guardrailSummary.noContentItemMutation)} />
                <DetailItem label="No Blogger Write" value={String(dailyContentPlanSummary.guardrailSummary.noBloggerWrite)} />
                <DetailItem label="No Publish Execution" value={String(dailyContentPlanSummary.guardrailSummary.noPublishExecution)} />
                <DetailItem label="No Scheduled Publish" value={String(dailyContentPlanSummary.guardrailSummary.noScheduledPublish)} />
                <DetailItem label="Profile Policy Used" value={String(dailyContentPlanSummary.guardrailSummary.profilePolicyUsed)} />
              </div>
            </details>
          </div>
        ) : (
          <div className="notice">Connection List에서 verified Blogger Blog가 있는 connection의 Daily Plan Preview를 실행하세요.</div>
        )}
      </section>

      {statusPreview ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>Status Preview</h2>
              <p className="muted">저장된 DB 상태만 표시합니다. Blogger API read-only 조회는 별도 버튼으로 수행합니다.</p>
            </div>
          </div>
          <div className="detail-grid">
            <DetailItem label="Status" value={statusPreview.status} />
            <DetailItem label="Blogger Blog ID" value={statusPreview.bloggerBlogId ?? "-"} />
            <DetailItem label="Blogger Blog Name" value={statusPreview.bloggerBlogName ?? "-"} />
            <DetailItem label="Blogger Blog URL" value={statusPreview.bloggerBlogUrl ?? "-"} />
            <DetailItem label="Blogger Blog Verified" value={statusPreview.bloggerBlogVerifiedAt ? new Date(statusPreview.bloggerBlogVerifiedAt).toLocaleString() : "-"} />
            <DetailItem label="Connected Email" value={statusPreview.connectedEmail ?? "-"} />
            <DetailItem label="Client Secret" value={statusPreview.hasClientSecret ? "placeholder exists" : "not configured"} />
            <DetailItem label="Access Token" value={statusPreview.hasAccessToken ? `placeholder (${statusPreview.tokenLast4 ?? "last4 unknown"})` : "not configured"} />
            <DetailItem label="Refresh Token" value={statusPreview.hasRefreshToken ? "placeholder exists" : "not configured"} />
            <DetailItem label="OAuth Implemented" value={statusPreview.oauthImplemented ? "yes" : "no"} />
            <DetailItem label="Blogger Read-only API" value={statusPreview.bloggerApiImplemented ? "blog list only" : "no"} />
            <DetailItem label="Publish Implemented" value={statusPreview.publishImplemented ? "yes" : "no"} />
          </div>
          {statusPreview.lastError ? <div className="notice error">{statusPreview.lastError}</div> : null}
        </section>
      ) : null}

      {secretStatus || secretSelfTest || tokenRefreshResult ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>Token Storage Security</h2>
              <p className="muted">Token exchange 결과는 encrypted metadata로만 확인합니다. Access token 원문은 서버 내부 read-only Blogger API 호출에만 사용됩니다.</p>
            </div>
          </div>
          {secretStatus ? (
            <>
              <div className="detail-grid">
                <DetailItem label="Connection ID" value={secretStatus.connectionId} />
                <DetailItem label="Client Secret" value={secretStatus.hasClientSecret ? "encrypted metadata exists" : "not stored"} />
                <DetailItem label="Access Token" value={secretStatus.hasAccessToken ? `encrypted metadata exists (${secretStatus.tokenLast4 ?? "last4 unknown"})` : "not stored"} />
                <DetailItem label="Refresh Token" value={secretStatus.hasRefreshToken ? "encrypted metadata exists" : "not stored"} />
                <DetailItem label="Access Token Expires" value={secretStatus.accessTokenExpiresAt ? new Date(secretStatus.accessTokenExpiresAt).toLocaleString() : "-"} />
                <DetailItem label="Secret Material Returned" value={secretStatus.secretMaterialReturned ? "yes" : "no"} />
                <DetailItem label="Token Exchange" value={secretStatus.tokenExchangeImplemented ? "implemented" : "not implemented"} />
                <DetailItem label="Blogger Read-only API" value={secretStatus.bloggerApiImplemented ? "blog list only" : "not implemented"} />
              </div>
              {secretStatus.secrets.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Key Version</th>
                      <th>Last 4</th>
                      <th>Token Type</th>
                      <th>Expires</th>
                      <th>Scopes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secretStatus.secrets.map((secret) => (
                      <tr key={secret.id}>
                        <td>{secret.secretKind}</td>
                        <td>{secret.keyVersion}</td>
                        <td>{secret.last4 ?? "-"}</td>
                        <td>{secret.tokenType ?? "-"}</td>
                        <td>{secret.expiresAt ? new Date(secret.expiresAt).toLocaleString() : "-"}</td>
                        <td>{secret.scopes.length > 0 ? secret.scopes.join(", ") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="notice">저장된 Blogger encrypted secret metadata가 없습니다.</div>
              )}
              <div className="notice">이 응답은 token, client secret, 암호문 원문을 반환하지 않습니다.</div>
            </>
          ) : null}
          {secretSelfTest ? (
            <div className={secretSelfTest.selfTestPassed ? "notice success" : "notice"}>
              {secretSelfTest.message} Secret material returned: {secretSelfTest.secretMaterialReturned ? "yes" : "no"}.
            </div>
          ) : null}
          {tokenRefreshResult ? (
            <div className="read-block">
              <h3>Access Token Refresh Result</h3>
              <div className={tokenRefreshResult.tokenRefreshSummary.refreshOk ? "notice success" : "notice warning"}>
                <strong>{tokenRefreshResult.tokenRefreshSummary.refreshOk ? "Access token refresh succeeded" : "Access token refresh did not complete"}</strong>
                <p>Google OAuth token endpoint만 호출합니다. Blogger read/write, publish, posts.update, draft save, content mutation은 수행하지 않습니다.</p>
                <p>응답은 token/client secret 원문과 Google raw response body를 반환하지 않습니다.</p>
              </div>
              <div className="detail-grid">
                <DetailItem label="Connection ID" value={tokenRefreshResult.tokenRefreshSummary.connectionId} />
                <DetailItem label="Reason" value={tokenRefreshResult.tokenRefreshSummary.reason} />
                <DetailItem label="Refresh Attempted" value={String(tokenRefreshResult.tokenRefreshSummary.refreshAttempted)} />
                <DetailItem label="Refresh OK" value={String(tokenRefreshResult.tokenRefreshSummary.refreshOk)} />
                <DetailItem label="Refresh Blocked" value={String(tokenRefreshResult.tokenRefreshSummary.refreshBlocked)} />
                <DetailItem label="Has Refresh Token" value={String(tokenRefreshResult.tokenRefreshSummary.hasRefreshToken)} />
                <DetailItem label="Has Client Secret Ref" value={String(tokenRefreshResult.tokenRefreshSummary.hasClientSecretRef)} />
                <DetailItem label="Client Secret Configured" value={String(tokenRefreshResult.tokenRefreshSummary.clientSecretConfigured)} />
                <DetailItem label="Old Access Token State" value={tokenRefreshResult.tokenRefreshSummary.oldAccessTokenState} />
                <DetailItem label="New Access Token State" value={tokenRefreshResult.tokenRefreshSummary.newAccessTokenState} />
                <DetailItem label="Access Token Updated" value={String(tokenRefreshResult.tokenRefreshSummary.accessTokenUpdated)} />
                <DetailItem label="Refresh Token Updated" value={String(tokenRefreshResult.tokenRefreshSummary.refreshTokenUpdated)} />
                <DetailItem label="Expires At" value={tokenRefreshResult.tokenRefreshSummary.expiresAt ? new Date(tokenRefreshResult.tokenRefreshSummary.expiresAt).toLocaleString() : "-"} />
                <DetailItem label="Token Last 4" value={tokenRefreshResult.tokenRefreshSummary.tokenLast4 ?? "-"} />
                <DetailItem label="DB Write" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.dbWrite)} />
                <DetailItem label="Google Token Endpoint" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.googleTokenEndpointCall)} />
                <DetailItem label="Blogger Read" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerRead)} />
                <DetailItem label="Blogger Write" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerWrite)} />
                <DetailItem label="Blogger Publish" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerPublish)} />
                <DetailItem label="Blogger Update" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerUpdate)} />
                <DetailItem label="Blogger Draft Save" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerDraftSave)} />
                <DetailItem label="OAuth Reconnect" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.oauthReconnect)} />
                <DetailItem label="Content Mutation" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.contentMutation)} />
                <DetailItem label="Approval Mutation" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.approvalMutation)} />
                <DetailItem label="Attempt Mutation" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.attemptMutation)} />
                <DetailItem label="LLM Call" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.llmCall)} />
              </div>
              <ValidationList title="Token Refresh Blocking Reasons" items={tokenRefreshResult.tokenRefreshSummary.blockingReasons} emptyText="blocking reason이 없습니다." isError />
              <ValidationList title="Token Refresh Warnings" items={tokenRefreshResult.tokenRefreshSummary.warnings} emptyText="warning이 없습니다." isWarning />
            </div>
          ) : null}
        </section>
      ) : null}

      {oauthDryRun ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>OAuth Dry Run</h2>
              <p className="muted">Authorization URL을 생성합니다. Callback에서는 token exchange를 수행하며, Blogger API는 read-only blog list 조회만 별도 버튼으로 수행합니다.</p>
            </div>
          </div>
          <div className="detail-grid">
            <DetailItem label="Dry Run" value={oauthDryRun.oauthDryRun ? "yes" : "no"} />
            <DetailItem label="Token Exchange" value={oauthDryRun.tokenExchangeImplemented ? "implemented" : "not implemented"} />
            <DetailItem label="Blogger API During OAuth" value={oauthDryRun.bloggerApiImplemented ? "implemented" : "not called"} />
            <DetailItem label="Expires At" value={new Date(oauthDryRun.expiresAt).toLocaleString()} />
            <DetailItem label="Redirect URI" value={oauthDryRun.redirectUri} />
          </div>
          <label className="admin-form full-span">
            Authorization URL
            <textarea readOnly value={oauthDryRun.authorizationUrl} />
          </label>
          <div className="notice">
            URL에는 OAuth state가 포함되지만 stateHash는 응답하지 않습니다. Callback은 authorization code를 token으로 교환하며 code/token 원문을 저장하거나 표시하지 않습니다.
          </div>
        </section>
      ) : null}

      {blogListResult ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>Blogger Blog List</h2>
              <p className="muted">이 조회는 read-only이며 Blogger draft/publish를 수행하지 않습니다.</p>
            </div>
          </div>
          <div className="detail-grid">
            <DetailItem label="Connection ID" value={blogListResult.connectionId} />
            <DetailItem label="Read Only" value={blogListResult.readOnly ? "yes" : "no"} />
            <DetailItem label="Token Refresh" value={blogListResult.tokenRefreshImplemented ? "implemented" : "not implemented"} />
            <DetailItem label="Draft/Publish" value={blogListResult.draftPublishImplemented ? "implemented" : "not implemented"} />
            <DetailItem label="Status Suggestion" value={blogListResult.statusSuggestion} />
            <DetailItem label="Fetched At" value={new Date(blogListResult.metadata.fetchedAt).toLocaleString()} />
          </div>
          <div className="notice">
            token refresh는 Settings의 Access Token Refresh 버튼으로만 수동 실행합니다. Blog list 조회는 자동 refresh를 수행하지 않으며 Blogger draft/publish도 실행하지 않습니다.
          </div>
          {blogListResult.blogs.length > 0 ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Blog ID</th>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Published</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogListResult.blogs.map((blog) => {
                  const selected = activeBlogListConnection?.bloggerBlogId === blog.id && Boolean(activeBlogListConnection.bloggerBlogVerifiedAt);
                  return (
                    <tr key={blog.id}>
                      <td>{blog.id}</td>
                      <td>{blog.name}</td>
                      <td>{blog.url ?? "-"}</td>
                      <td>{blog.published ? new Date(blog.published).toLocaleString() : "-"}</td>
                      <td>{blog.updated ? new Date(blog.updated).toLocaleString() : "-"}</td>
                      <td>
                        <button className="button secondary" type="button" disabled={selectingBlogId === blog.id || selected} onClick={() => void selectBloggerBlog(blog.id)}>
                          {selected ? "선택됨" : selectingBlogId === blog.id ? "선택 중" : "이 블로그 선택"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="notice">조회된 Blogger blog가 없습니다.</div>
          )}
        </section>
      ) : null}
    </>
  );
}

function toForm(connection: BloggerConnectionAdmin): BloggerConnectionForm {
  return {
    id: connection.id,
    name: connection.name,
    blogId: connection.blogId ?? "",
    status: connection.status,
    bloggerBlogId: connection.bloggerBlogId ?? "",
    bloggerBlogName: connection.bloggerBlogName ?? "",
    bloggerBlogUrl: connection.bloggerBlogUrl ?? "",
    bloggerBlogVerifiedAt: connection.bloggerBlogVerifiedAt ?? "",
    connectedEmail: connection.connectedEmail ?? "",
    scopes: formatListInput(connection.scopes),
    oauthClientIdRef: connection.oauthClientIdRef ?? "",
    clientSecretRef: connection.clientSecretRef ?? "",
    hasClientSecret: connection.hasClientSecret,
    hasAccessToken: connection.hasAccessToken,
    hasRefreshToken: connection.hasRefreshToken,
    tokenLast4: connection.tokenLast4 ?? "",
    lastError: connection.lastError ?? ""
  };
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function formatNullableBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }
  return value ? "true" : "false";
}

function getTodayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function getDailyPlanSlotLabel(slotKey: string) {
  const labels: Record<string, string> = {
    morning_education: "오전 교육형",
    midday_checklist: "점심 체크리스트",
    evening_risk_review: "저녁 리스크 복기"
  };
  return labels[slotKey] ?? slotKey;
}

function getDailyPlanItemStatus(item: DailyContentPlanQueueItem) {
  return "status" in item ? item.status : "preview";
}

function getDailyPlanItemId(item: DailyContentPlanQueueItem) {
  return "id" in item ? item.id : null;
}

function getDailyPlanItemContentItemId(item: DailyContentPlanQueueItem) {
  return "contentItemId" in item ? item.contentItemId : null;
}

function formatDisabledFlag(value: boolean) {
  return value ? "켜짐" : "꺼짐";
}

function formatOperatorApprovalState(value: string) {
  const labels: Record<string, string> = {
    ready_for_operator_review: "운영자 검토 가능",
    waiting_for_content_fixture: "content fixture 대기",
    blocked_by_guardrail: "가드레일 차단"
  };
  return labels[value] ?? value;
}

function formatDraftGenerationGateBlocker(blocker: string) {
  const labels: Record<string, string> = {
    operator_approval_missing: "운영자 승인 미저장",
    operator_approval_tables_not_applied: "운영자 승인 테이블 미적용",
    operator_approval_read_failed: "운영자 승인 테이블 read 실패",
    llm_execution_feature_flag_disabled: "LLM 실행 flag 꺼짐",
    content_mutation_feature_flag_disabled: "content mutation flag 꺼짐",
    draft_generation_write_feature_flag_disabled: "draft generation write flag 꺼짐",
    confirmation_phrase_missing: "확인 문구 없음",
    idempotency_key_missing: "idempotency key 없음",
    draft_generation_readiness_failed: "초안 생성 구조 준비 미완료"
  };
  return labels[blocker] ?? blocker;
}

function formatLlmReadinessBlocker(blocker: string) {
  const labels: Record<string, string> = {
    llm_execution_feature_flag_disabled: "LLM 실행 feature flag 꺼짐",
    llm_provider_health_check_skipped_by_design: "이번 단계에서 provider health check 생략",
    llm_call_disabled_by_patch_policy: "이번 패치 정책상 LLM 호출 금지",
    llm_provider_route_not_configured_for_draft_generation: "초안 생성용 LLM route 미구성",
    llm_task_route_disabled_or_missing: "content_draft task route 비활성 또는 없음",
    llm_provider_config_not_found: "LLM provider 설정 없음",
    llm_provider_disabled_for_draft_generation: "LLM provider 비활성",
    llm_model_candidate_not_resolved: "LLM model 후보 미확정",
    llm_required_env_missing: "필수 env 존재 확인 실패"
  };
  return labels[blocker] ?? blocker;
}

function formatLlmHealthCheckBlocker(blocker: string) {
  const labels: Record<string, string> = {
    draft_generation_llm_provider_health_check_preview_is_preview_only: "health-check preview 전용 mode만 허용",
    llm_provider_healthcheck_feature_flag_disabled: "LLM provider health-check feature flag 꺼짐",
    healthcheck_confirmation_phrase_missing: "health-check 확인 문구 없음",
    healthcheck_idempotency_key_missing: "health-check idempotency key 없음",
    llm_completion_disabled_by_patch_policy: "이번 패치 정책상 LLM completion 금지",
    content_mutation_disabled_by_patch_policy: "이번 패치 정책상 content mutation 금지"
  };
  return labels[blocker] ?? blocker;
}

function formatLlmHealthCheckExecutionBlocker(blocker: string) {
  const labels: Record<string, string> = {
    draft_generation_llm_provider_health_check_execution_mode_not_allowed: "health-check execution에서 허용되지 않는 mode",
    healthcheck_execution_not_requested: "health-check execution 요청 아님",
    llm_provider_healthcheck_execution_feature_flag_disabled: "LLM provider health-check execution feature flag 꺼짐",
    llm_provider_network_call_feature_flag_disabled: "provider network call feature flag 꺼짐",
    confirmation_phrase_missing: "확인 문구 없음",
    idempotency_key_missing: "idempotency key 없음",
    llm_provider_route_not_configured_for_draft_generation: "초안 생성용 LLM route 미구성",
    llm_provider_config_not_found: "LLM provider 설정 없음",
    llm_model_candidate_not_resolved: "LLM model 후보 미확정",
    llm_required_env_missing: "필수 env 존재 확인 실패",
    llm_provider_health_check_not_supported_for_provider_kind: "provider kind의 safe health-check 미지원"
  };
  return labels[blocker] ?? blocker;
}

function formatChecklistItem(item: { key: string; status: string; label: string; requiredBeforeExecution?: boolean }) {
  return `${item.status}: ${item.label}${item.requiredBeforeExecution ? " (required)" : ""}`;
}

function formatPromptQualityCheck(item: { key: string; status: string; severity: string; label: string; detail: string; remediation: string | null }) {
  return `${item.status}/${item.severity}: ${item.label} - ${item.detail}${item.remediation ? ` · remediation: ${item.remediation}` : ""}`;
}

function ValidationList({ title, items, emptyText, isError, isWarning }: { title: string; items: string[]; emptyText: string; isError?: boolean; isWarning?: boolean }) {
  const className = isError ? "notice error" : isWarning ? "notice warning" : "notice";
  return (
    <div className={className}>
      <strong>{title}</strong>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}
