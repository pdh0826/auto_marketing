"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildContentPlanDryRun, type ContentPlanDryRunResult, type ReadinessStatus } from "@/lib/content/content-plan-preview";
import { getContentModeLabel } from "@/lib/content/constants";
import { buildDraftMarkdownDryRun, type DraftMarkdownDryRunResult } from "@/lib/content/draft-preview";
import { validateDraftMarkdown, type DraftValidationResult } from "@/lib/content/draft-validation";
import type { HtmlCandidateValidationResult, HtmlPreviewDryRunResult } from "@/lib/content/html-preview";
import { formatPlanJson, hasUsablePlanJson } from "@/lib/content/plan-template";
import { ApiResult, requestJson } from "@/lib/form-utils";
import type { LlmTaskRouteAdmin } from "@/lib/llm/admin-types";
import { getApiFormatLabel, getInvocationModeLabel } from "@/lib/llm/constants";

interface ContentDetailClientProps {
  contentItemId: string;
}

interface GeneratedPlanResult {
  candidatePlanJson: Record<string, unknown>;
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
  route: {
    providerName: string;
    modelName: string;
    usedFallback: boolean;
  };
  metadata: {
    latencyMs: number;
    responseSummary: string;
  };
}

interface GeneratedDraftResult {
  candidateDraftMarkdown: string;
  validation: DraftValidationResult;
  route: {
    providerName: string;
    modelName: string;
    usedFallback: boolean;
  };
  metadata: {
    latencyMs: number;
    responseSummary: string;
    markdownLength: number;
    repairAttempted: boolean;
    repairSucceeded: boolean;
    initialValidationErrorCount: number;
    initialValidationWarningCount: number;
    finalValidationErrorCount: number;
    finalValidationWarningCount: number;
  };
}

export function ContentDetailClient({ contentItemId }: ContentDetailClientProps) {
  const [contentItem, setContentItem] = useState<ContentItemAdmin | null>(null);
  const [assets, setAssets] = useState<ContentAssetAdmin[]>([]);
  const [contentPlanRoute, setContentPlanRoute] = useState<LlmTaskRouteAdmin | null>(null);
  const [contentDraftRoute, setContentDraftRoute] = useState<LlmTaskRouteAdmin | null>(null);
  const [dryRunResult, setDryRunResult] = useState<ContentPlanDryRunResult | null>(null);
  const [draftDryRunResult, setDraftDryRunResult] = useState<DraftMarkdownDryRunResult | null>(null);
  const [htmlPreviewResult, setHtmlPreviewResult] = useState<HtmlPreviewDryRunResult | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlanResult | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<GeneratedDraftResult | null>(null);
  const [candidateText, setCandidateText] = useState("");
  const [candidateEditMode, setCandidateEditMode] = useState(false);
  const [candidateDirty, setCandidateDirty] = useState(false);
  const [candidateParseError, setCandidateParseError] = useState<string | null>(null);
  const [draftCandidateText, setDraftCandidateText] = useState("");
  const [draftEditMode, setDraftEditMode] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [htmlCandidateText, setHtmlCandidateText] = useState("");
  const [htmlEditMode, setHtmlEditMode] = useState(false);
  const [htmlDirty, setHtmlDirty] = useState(false);
  const [htmlCandidateValidation, setHtmlCandidateValidation] = useState<HtmlCandidateValidationResult | null>(null);
  const [planText, setPlanText] = useState("");
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [routesLoading, setRoutesLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [runningHtmlPreview, setRunningHtmlPreview] = useState(false);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [applyingDraft, setApplyingDraft] = useState(false);
  const [revalidatingPlan, setRevalidatingPlan] = useState(false);
  const [revalidatingDraft, setRevalidatingDraft] = useState(false);
  const [validatingHtml, setValidatingHtml] = useState(false);
  const [applyingHtml, setApplyingHtml] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [draftGenerationError, setDraftGenerationError] = useState<string | null>(null);
  const [htmlPreviewError, setHtmlPreviewError] = useState<string | null>(null);
  const [htmlApplyError, setHtmlApplyError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const parsedPlan = useMemo(() => parsePlan(planText), [planText]);
  const canMarkPlanned = parsedPlan.ok && hasUsablePlanJson(parsedPlan.value);
  const canApplyGeneratedPlan = Boolean(generatedPlan?.validation.ok && !candidateDirty && !candidateParseError && !applyingPlan);
  const canGenerateDraft = Boolean(contentItem?.planJson && draftDryRunResult?.ready && !generatingDraft);
  const canApplyGeneratedDraft = Boolean(generatedDraft?.validation.ok && !draftDirty && !applyingDraft);
  const canRunHtmlPreview = Boolean(contentItem?.draftMarkdown && !runningHtmlPreview);
  const canApplyHtmlCandidate = Boolean(htmlCandidateText && htmlCandidateValidation?.validation.ok && !htmlDirty && !applyingHtml);

  const loadContentItem = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`);
      setContentItem(result.data);
      setPlanText(formatPlanJson(result.data.planJson));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글 생성 요청 상세 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [contentItemId]);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    setAssetsError(null);

    try {
      const result = await requestJson<ApiResult<ContentAssetAdmin[]>>(`/api/content-items/${contentItemId}/assets`);
      setAssets(result.data);
    } catch (caught) {
      setAssetsError(caught instanceof Error ? caught.message : "첨부 미디어를 불러오지 못했습니다.");
    } finally {
      setAssetsLoading(false);
    }
  }, [contentItemId]);

  const loadRoutes = useCallback(async () => {
    setRoutesLoading(true);
    setRouteError(null);

    try {
      const result = await requestJson<ApiResult<LlmTaskRouteAdmin[]>>("/api/settings/llm/task-routes");
      setContentPlanRoute(result.data.find((route) => route.taskType === "content_plan") ?? null);
      setContentDraftRoute(result.data.find((route) => route.taskType === "content_draft") ?? null);
    } catch (caught) {
      setRouteError(caught instanceof Error ? caught.message : "content_plan route 정보를 불러오지 못했습니다.");
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContentItem();
    void loadAssets();
    void loadRoutes();
  }, [loadAssets, loadContentItem, loadRoutes]);

  async function savePlanJson() {
    setPlanError(null);
    setNotice(null);

    const parsed = parsePlan(planText);
    if (!parsed.ok) {
      setPlanError(parsed.error);
      return;
    }

    setSavingPlan(true);
    try {
      const result = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ planJson: parsed.value })
      });
      setContentItem(result.data);
      setPlanText(formatPlanJson(result.data.planJson));
      setNotice("planJson을 저장했습니다.");
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : "planJson을 저장하지 못했습니다.");
    } finally {
      setSavingPlan(false);
    }
  }

  async function markPlanned() {
    setPlanError(null);
    setNotice(null);

    const parsed = parsePlan(planText);
    if (!parsed.ok) {
      setPlanError(parsed.error);
      return;
    }

    if (!hasUsablePlanJson(parsed.value)) {
      setPlanError("planned 전환 전 최소 하나 이상의 기획 항목을 입력하세요. 빈 객체나 빈 템플릿만으로는 전환할 수 없습니다.");
      return;
    }

    setChangingStatus(true);
    try {
      const saved = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ planJson: parsed.value, status: "planned" })
      });
      setContentItem(saved.data);
      setPlanText(formatPlanJson(saved.data.planJson));
      setNotice("planJson을 저장하고 status를 planned로 전환했습니다.");
    } catch (caught) {
      setPlanError(caught instanceof Error ? caught.message : "planned 전환에 실패했습니다.");
    } finally {
      setChangingStatus(false);
    }
  }

  function runContentPlanDryRun() {
    setNotice(null);
    setGenerationError(null);
    if (!contentItem) {
      setRouteError("글 생성 요청 상세 정보를 먼저 불러와야 합니다.");
      return;
    }
    setDryRunResult(buildContentPlanDryRun(contentItem, assets, contentPlanRoute));
  }

  function runDraftMarkdownDryRun() {
    setNotice(null);
    setDraftGenerationError(null);
    if (!contentItem) {
      setRouteError("글 생성 요청 상세 정보를 먼저 불러와야 합니다.");
      return;
    }
    setDraftDryRunResult(buildDraftMarkdownDryRun(contentItem, assets, contentDraftRoute));
  }

  async function generateDraftCandidate() {
    setNotice(null);
    setDraftGenerationError(null);
    setGeneratedDraft(null);
    setDraftCandidateText("");
    setDraftEditMode(false);
    setDraftDirty(false);
    setGeneratingDraft(true);

    try {
      const result = await requestJson<ApiResult<GeneratedDraftResult>>(`/api/content-items/${contentItemId}/generate-draft`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setGeneratedDraft(result.data);
      setDraftCandidateText(result.data.candidateDraftMarkdown);
      setNotice("본문 초안 후보를 생성했습니다. 아직 DB에 저장되지 않았습니다.");
    } catch (caught) {
      setDraftGenerationError(caught instanceof Error ? caught.message : "본문 초안 후보 생성에 실패했습니다.");
    } finally {
      setGeneratingDraft(false);
    }
  }

  async function revalidateDraftCandidate() {
    if (!generatedDraft || !contentItem) {
      return;
    }

    setDraftGenerationError(null);
    setNotice(null);
    setRevalidatingDraft(true);
    try {
      const validation = validateDraftMarkdown(draftCandidateText, {
        contentItem,
        assets
      });
      setGeneratedDraft({
        ...generatedDraft,
        candidateDraftMarkdown: draftCandidateText,
        validation,
        metadata: {
          ...generatedDraft.metadata,
          markdownLength: draftCandidateText.length
        }
      });
      setDraftDirty(false);
      setNotice("초안 후보를 재검증했습니다. 아직 DB에 저장되지 않았습니다.");
    } finally {
      setRevalidatingDraft(false);
    }
  }

  async function applyGeneratedDraft() {
    if (!generatedDraft?.validation.ok) {
      setDraftGenerationError("validation을 통과한 후보만 draftMarkdown에 반영할 수 있습니다.");
      return;
    }
    if (draftDirty) {
      setDraftGenerationError("편집된 초안 후보는 재검증 후 반영할 수 있습니다.");
      return;
    }

    setApplyingDraft(true);
    setDraftGenerationError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ draftMarkdown: generatedDraft.candidateDraftMarkdown })
      });
      setContentItem(result.data);
      setNotice("생성 후보를 draftMarkdown에 반영했습니다. draftHtml은 생성하지 않았습니다.");
    } catch (caught) {
      setDraftGenerationError(caught instanceof Error ? caught.message : "생성 후보를 draftMarkdown에 반영하지 못했습니다.");
    } finally {
      setApplyingDraft(false);
    }
  }

  async function runHtmlPreviewDryRun() {
    setNotice(null);
    setHtmlPreviewError(null);
    setHtmlApplyError(null);
    setRunningHtmlPreview(true);

    try {
      const result = await requestJson<ApiResult<HtmlPreviewDryRunResult>>(`/api/content-items/${contentItemId}/html-preview`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setHtmlPreviewResult(result.data);
      setHtmlCandidateText(result.data.previewHtml);
      setHtmlEditMode(false);
      setHtmlDirty(false);
      const validation = await validateHtmlCandidateOnServer(result.data.previewHtml);
      setHtmlCandidateValidation(validation);
      setNotice("HTML 변환 dry-run preview를 생성했습니다. DB에는 저장하지 않았습니다.");
    } catch (caught) {
      setHtmlPreviewError(caught instanceof Error ? caught.message : "HTML 변환 dry-run preview에 실패했습니다.");
    } finally {
      setRunningHtmlPreview(false);
    }
  }

  async function validateHtmlCandidateOnServer(candidateHtml: string) {
    const result = await requestJson<ApiResult<HtmlCandidateValidationResult>>(`/api/content-items/${contentItemId}/validate-html`, {
      method: "POST",
      body: JSON.stringify({ candidateHtml })
    });
    return result.data;
  }

  async function revalidateHtmlCandidate() {
    setHtmlApplyError(null);
    setHtmlPreviewError(null);
    setNotice(null);
    setValidatingHtml(true);

    try {
      const validation = await validateHtmlCandidateOnServer(htmlCandidateText);
      setHtmlCandidateValidation(validation);
      setHtmlDirty(false);
      setNotice("HTML 후보를 재검증했습니다. 아직 DB에 저장하지 않았습니다.");
    } catch (caught) {
      setHtmlApplyError(caught instanceof Error ? caught.message : "HTML 후보 재검증에 실패했습니다.");
    } finally {
      setValidatingHtml(false);
    }
  }

  async function applyHtmlCandidate() {
    if (!htmlCandidateValidation?.validation.ok) {
      setHtmlApplyError("validation/security error가 없는 HTML 후보만 draftHtml에 반영할 수 있습니다.");
      return;
    }
    if (htmlDirty) {
      setHtmlApplyError("편집된 HTML 후보는 재검증 후 반영할 수 있습니다.");
      return;
    }
    const confirmed = window.confirm("draftHtml에 저장합니다. Blogger 발행은 수행하지 않습니다.");
    if (!confirmed) {
      return;
    }

    setApplyingHtml(true);
    setHtmlApplyError(null);
    setNotice(null);

    try {
      const result = await requestJson<
        ApiResult<{
          contentItem: ContentItemAdmin;
          validation: HtmlCandidateValidationResult["validation"];
          securityChecks: HtmlCandidateValidationResult["securityChecks"];
          mediaMappings: HtmlCandidateValidationResult["mediaMappings"];
          metadata: HtmlCandidateValidationResult["metadata"];
        }>
      >(`/api/content-items/${contentItemId}/apply-html`, {
        method: "POST",
        body: JSON.stringify({ candidateHtml: htmlCandidateText })
      });
      setContentItem(result.data.contentItem);
      setHtmlCandidateValidation({
        validation: result.data.validation,
        securityChecks: result.data.securityChecks,
        mediaMappings: result.data.mediaMappings,
        metadata: result.data.metadata
      });
      setHtmlDirty(false);
      setNotice("HTML 후보를 draftHtml에 반영했습니다. Blogger 발행은 수행하지 않았습니다.");
    } catch (caught) {
      setHtmlApplyError(caught instanceof Error ? caught.message : "HTML 후보를 draftHtml에 반영하지 못했습니다.");
    } finally {
      setApplyingHtml(false);
    }
  }

  async function generatePlanCandidate() {
    setNotice(null);
    setGenerationError(null);
    setGeneratedPlan(null);
    setCandidateText("");
    setCandidateEditMode(false);
    setCandidateDirty(false);
    setCandidateParseError(null);
    setGeneratingPlan(true);

    try {
      const result = await requestJson<ApiResult<GeneratedPlanResult>>(`/api/content-items/${contentItemId}/generate-plan`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setGeneratedPlan(result.data);
      setCandidateText(JSON.stringify(result.data.candidatePlanJson, null, 2));
      setNotice("기획서 후보를 생성했습니다. 아직 DB에 저장되지 않았습니다.");
    } catch (caught) {
      setGenerationError(caught instanceof Error ? caught.message : "기획서 후보 생성에 실패했습니다.");
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function applyGeneratedPlan() {
    if (!generatedPlan?.validation.ok) {
      setGenerationError("validation을 통과한 후보만 planJson에 반영할 수 있습니다.");
      return;
    }
    if (candidateParseError) {
      setGenerationError("유효하지 않은 JSON입니다. 재검증할 수 없습니다.");
      return;
    }
    if (candidateDirty) {
      setGenerationError("편집된 후보는 재검증 후 반영할 수 있습니다.");
      return;
    }

    setApplyingPlan(true);
    setGenerationError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ planJson: generatedPlan.candidatePlanJson })
      });
      setContentItem(result.data);
      setPlanText(formatPlanJson(result.data.planJson));
      setNotice("생성 후보를 planJson에 반영했습니다. planned 전환은 기존 버튼으로 별도 수행하세요.");
    } catch (caught) {
      setGenerationError(caught instanceof Error ? caught.message : "생성 후보를 planJson에 반영하지 못했습니다.");
    } finally {
      setApplyingPlan(false);
    }
  }

  async function revalidateGeneratedPlan() {
    if (!generatedPlan) {
      return;
    }

    setGenerationError(null);
    setNotice(null);
    setCandidateParseError(null);

    const parsed = parsePlan(candidateText);
    if (!parsed.ok) {
      setCandidateParseError("유효하지 않은 JSON입니다. 재검증할 수 없습니다.");
      return;
    }

    setRevalidatingPlan(true);
    try {
      const result = await requestJson<ApiResult<Pick<GeneratedPlanResult, "candidatePlanJson" | "validation">>>(
        `/api/content-items/${contentItemId}/validate-plan`,
        {
          method: "POST",
          body: JSON.stringify({ candidatePlanJson: parsed.value })
        }
      );
      setGeneratedPlan({
        ...generatedPlan,
        candidatePlanJson: result.data.candidatePlanJson,
        validation: result.data.validation
      });
      setCandidateText(JSON.stringify(result.data.candidatePlanJson, null, 2));
      setCandidateDirty(false);
      setNotice("후보 planJson을 재검증했습니다. 아직 DB에 저장되지 않았습니다.");
    } catch (caught) {
      setGenerationError(caught instanceof Error ? caught.message : "후보 planJson 재검증에 실패했습니다.");
    } finally {
      setRevalidatingPlan(false);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Patch 6C</span>
        <h1>글 생성 요청 상세</h1>
        <p className="muted">수동으로 기획 JSON을 작성하고 planned 상태로 전환합니다. 자동 생성과 품질검사는 후속 패치에서 연결합니다.</p>
        <div className="form-actions">
          <Link className="button secondary" href="/content/new">
            글 생성 목록
          </Link>
          <button className="button secondary" type="button" disabled>
            기획서 자동 생성은 후속 패치에서 연결 예정
          </button>
          <button className="button secondary" type="button" disabled>
            본문 초안 생성은 아래 섹션에서 실행
          </button>
          <button className="button secondary" type="button" disabled>
            HTML 변환은 아래 dry-run에서 preview
          </button>
          <button className="button secondary" type="button" disabled>
            품질검사는 후속 패치에서 연결 예정
          </button>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="notice">글 생성 요청 상세 정보를 불러오는 중입니다.</div> : null}

      {contentItem ? (
        <>
          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Content Item</h2>
                <p className="muted">기본 정보와 연결된 블로그/서비스 프로필입니다.</p>
              </div>
            </div>
            <dl className="detail-grid">
              <DetailItem label="ID" value={contentItem.id} />
              <DetailItem label="Title" value={contentItem.title ?? "-"} />
              <DetailItem label="Mode" value={getContentModeLabel(contentItem.mode)} />
              <DetailItem label="Status" value={contentItem.status} />
              <DetailItem label="Target Keyword" value={contentItem.targetKeyword ?? "-"} />
              <DetailItem label="Blog" value={contentItem.blog?.name ?? "미지정"} />
              <DetailItem label="Brand Profile" value={contentItem.brandProfile?.name ?? "미지정"} />
              <DetailItem label="Quality Score" value={contentItem.qualityScore === null ? "아직 품질검사 전" : String(contentItem.qualityScore)} />
              <DetailItem label="Created" value={formatDate(contentItem.createdAt)} />
              <DetailItem label="Updated" value={formatDate(contentItem.updatedAt)} />
            </dl>
            <div className="read-block">
              <h3>Source Memo</h3>
              <pre>{contentItem.sourceMemo || "-"}</pre>
            </div>
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Manual Plan JSON</h2>
                <p className="muted">빈 planJson에는 기본 템플릿이 표시됩니다. 저장 전 JSON.parse 검증을 수행합니다.</p>
              </div>
            </div>
            {planError ? <div className="notice error">{planError}</div> : null}
            {notice ? <div className="notice">{notice}</div> : null}
            {!canMarkPlanned ? (
              <div className="notice">planned 전환은 유효한 JSON이며 최소 하나 이상의 기획 항목이 입력된 경우에만 가능합니다.</div>
            ) : null}
            <label className="plan-editor">
              Plan JSON
              <textarea value={planText} onChange={(event) => setPlanText(event.target.value)} spellCheck={false} />
            </label>
            <div className="form-actions">
              <button className="button" type="button" disabled={savingPlan} onClick={() => void savePlanJson()}>
                기획서 저장
              </button>
              <button className="button secondary" type="button" disabled={changingStatus || !canMarkPlanned} onClick={() => void markPlanned()}>
                planned로 전환
              </button>
            </div>
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Content Plan Dry Run</h2>
                <p className="muted">실제 LLM 호출 없이 content_plan route 준비 상태와 prompt preview만 확인합니다. Preview는 DB에 저장되지 않습니다.</p>
              </div>
              <button className="button secondary" type="button" disabled>
                실제 기획서 생성은 후속 패치에서 연결 예정
              </button>
            </div>

            {routeError ? <div className="notice error">{routeError}</div> : null}
            {routesLoading ? <div className="notice">content_plan route 정보를 불러오는 중입니다.</div> : null}

            <div className="detail-grid">
              <DetailItem label="Task Route" value={contentPlanRoute ? "content_plan" : "미등록"} />
              <DetailItem label="Route Status" value={contentPlanRoute?.isEnabled ? "enabled" : contentPlanRoute ? "disabled" : "-"} />
              <DetailItem label="Primary Provider" value={formatProviderName(contentPlanRoute?.primaryProvider)} />
              <DetailItem label="Primary Model" value={formatModelName(contentPlanRoute?.primaryModel)} />
              <DetailItem label="Fallback Provider" value={formatProviderName(contentPlanRoute?.fallbackProvider)} />
              <DetailItem label="Fallback Model" value={formatModelName(contentPlanRoute?.fallbackModel)} />
            </div>

            {contentPlanRoute?.primaryProvider ? <ProviderTestSummary title="Primary Provider Test" provider={contentPlanRoute.primaryProvider} /> : null}
            {contentPlanRoute?.fallbackProvider ? <ProviderTestSummary title="Fallback Provider Test" provider={contentPlanRoute.fallbackProvider} /> : null}

            <div className="form-actions">
              <button className="button" type="button" disabled={routesLoading || loading || assetsLoading} onClick={runContentPlanDryRun}>
                Dry Run
              </button>
              <button className="button secondary" type="button" disabled={!dryRunResult?.ready || generatingPlan} onClick={() => void generatePlanCandidate()}>
                {generatingPlan ? "기획서 생성 중" : "기획서 생성"}
              </button>
            </div>

            {generationError ? <div className="notice error">{generationError}</div> : null}
            {dryRunResult && !dryRunResult.ready ? <div className="notice error">Readiness fail 항목이 있어 기획서 생성 버튼을 비활성화했습니다.</div> : null}

            {dryRunResult ? (
              <>
                <div className={dryRunResult.ready ? "notice" : "notice error"}>
                  {dryRunResult.ready
                    ? "Dry-run 준비 상태가 통과되었습니다. 실제 LLM 호출은 수행하지 않았습니다."
                    : "Dry-run 준비 상태에 실패 항목이 있습니다. 실제 LLM 호출은 수행하지 않았습니다."}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Check</th>
                        <th>Status</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dryRunResult.checks.map((check) => (
                        <tr key={check.key}>
                          <td>{check.label}</td>
                          <td>{formatReadinessStatus(check.status)}</td>
                          <td>{check.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PromptPreviewBlock title="System" value={dryRunResult.promptPreview.system} />
                <PromptPreviewBlock title="User" value={dryRunResult.promptPreview.user} />
                <PromptPreviewBlock title="Output Format" value={dryRunResult.promptPreview.outputFormat} />
              </>
            ) : (
              <div className="notice">Dry Run을 실행하면 route readiness와 prompt preview가 화면에만 생성됩니다.</div>
            )}

            {generatedPlan ? (
              <div className="read-block">
                <div className={generatedPlan.validation.ok ? "notice" : "notice error"}>
                  <strong>Generated Plan Candidate</strong>
                  <p>
                    validation: {generatedPlan.validation.ok ? "pass" : "fail"} / errors: {generatedPlan.validation.errors.length} / warnings:{" "}
                    {generatedPlan.validation.warnings.length}
                  </p>
                  <p>
                    provider: {generatedPlan.route.providerName} / model: {generatedPlan.route.modelName} / fallback:{" "}
                    {generatedPlan.route.usedFallback ? "yes" : "no"}
                  </p>
                  <p>
                    latency: {generatedPlan.metadata.latencyMs}ms / summary: {generatedPlan.metadata.responseSummary}
                  </p>
                </div>
                {candidateParseError ? (
                  <div className="notice error">{candidateParseError}</div>
                ) : candidateDirty ? (
                  <div className="notice warning">편집된 후보는 재검증 후 반영할 수 있습니다.</div>
                ) : !generatedPlan.validation.ok ? (
                  <div className="notice error">이 후보는 validation error가 있어 planJson에 반영할 수 없습니다.</div>
                ) : generatedPlan.validation.warnings.length > 0 ? (
                  <div className="notice">warning이 있습니다. 내용을 검토한 뒤 planJson에 반영할 수 있습니다.</div>
                ) : (
                  <div className="notice">validation을 통과했습니다. 내용을 검토한 뒤 planJson에 반영할 수 있습니다.</div>
                )}
                <ValidationList title="Validation Errors" items={generatedPlan.validation.errors} emptyText="validation error가 없습니다." isError />
                <ValidationList title="Validation Warnings" items={generatedPlan.validation.warnings} emptyText="validation warning이 없습니다." isWarning />
                <label className="plan-editor read-block">
                  Candidate planJson
                  <textarea
                    value={candidateText}
                    readOnly={!candidateEditMode}
                    onChange={(event) => {
                      setCandidateText(event.target.value);
                      setCandidateDirty(true);
                      setCandidateParseError(null);
                    }}
                    spellCheck={false}
                  />
                </label>
                <div className="form-actions">
                  <button className="button secondary" type="button" onClick={() => setCandidateEditMode((current) => !current)}>
                    {candidateEditMode ? "읽기 모드" : "후보 편집"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={revalidatingPlan || !candidateDirty}
                    onClick={() => void revalidateGeneratedPlan()}
                  >
                    {revalidatingPlan ? "재검증 중" : "재검증"}
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={!canApplyGeneratedPlan}
                    onClick={() => void applyGeneratedPlan()}
                  >
                    planJson에 반영
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Draft Markdown Dry Run</h2>
                <p className="muted">
                  저장된 planJson을 기반으로 본문 초안 생성 준비 상태와 prompt preview를 확인하고, content_draft route로 초안 후보를 생성합니다.
                </p>
              </div>
              <button className="button secondary" type="button" disabled>
                HTML 변환은 후속 패치에서 연결 예정
              </button>
            </div>

            {!contentItem.planJson ? <div className="notice error">저장된 planJson이 없습니다. 먼저 planJson에 반영하세요.</div> : null}

            <div className="detail-grid">
              <DetailItem label="Task Route" value={contentDraftRoute ? "content_draft" : "미등록"} />
              <DetailItem label="Route Status" value={contentDraftRoute?.isEnabled ? "enabled" : contentDraftRoute ? "disabled" : "-"} />
              <DetailItem label="Primary Provider" value={formatProviderName(contentDraftRoute?.primaryProvider)} />
              <DetailItem label="Primary Model" value={formatModelName(contentDraftRoute?.primaryModel)} />
              <DetailItem label="Fallback Provider" value={formatProviderName(contentDraftRoute?.fallbackProvider)} />
              <DetailItem label="Fallback Model" value={formatModelName(contentDraftRoute?.fallbackModel)} />
            </div>

            {contentDraftRoute?.primaryProvider ? <ProviderTestSummary title="Draft Primary Provider Test" provider={contentDraftRoute.primaryProvider} /> : null}
            {contentDraftRoute?.fallbackProvider ? <ProviderTestSummary title="Draft Fallback Provider Test" provider={contentDraftRoute.fallbackProvider} /> : null}

            <div className="form-actions">
              <button className="button" type="button" disabled={routesLoading || loading || assetsLoading} onClick={runDraftMarkdownDryRun}>
                Draft Dry Run
              </button>
              <button className="button secondary" type="button" disabled={!canGenerateDraft} onClick={() => void generateDraftCandidate()}>
                {generatingDraft ? "본문 초안 생성 중" : "본문 초안 생성"}
              </button>
            </div>

            {draftGenerationError ? <div className="notice error">{draftGenerationError}</div> : null}
            {draftDryRunResult && !draftDryRunResult.ready ? <div className="notice error">Readiness fail 항목이 있어 본문 초안 생성 버튼을 비활성화했습니다.</div> : null}

            {draftDryRunResult ? (
              <>
                <div className={draftDryRunResult.ready ? "notice" : "notice error"}>
                  {draftDryRunResult.ready
                    ? "Draft dry-run 준비 상태가 통과되었습니다. 본문 초안 생성 버튼으로 후보를 생성할 수 있습니다."
                    : "Draft dry-run 준비 상태에 실패 항목이 있습니다. 실제 LLM 호출은 수행하지 않았습니다."}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Check</th>
                        <th>Status</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftDryRunResult.checks.map((check) => (
                        <tr key={check.key}>
                          <td>{check.label}</td>
                          <td>{formatReadinessStatus(check.status)}</td>
                          <td>{check.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <MediaMappingTable mappings={draftDryRunResult.mediaMapping} />
                <PromptPreviewBlock title="Draft System" value={draftDryRunResult.promptPreview.system} />
                <PromptPreviewBlock title="Draft User" value={draftDryRunResult.promptPreview.user} />
                <PromptPreviewBlock title="Draft Output Format" value={draftDryRunResult.promptPreview.outputFormat} />
              </>
            ) : (
              <div className="notice">
                Draft Dry Run을 실행하면 저장된 planJson, content_draft route, 첨부 미디어와 mediaPlan의 연결 상태가 화면에만 생성됩니다.
              </div>
            )}

            {generatedDraft ? (
              <div className="read-block">
                <div className={generatedDraft.validation.ok ? "notice" : "notice error"}>
                  <strong>Generated Draft Candidate</strong>
                  <p>
                    validation: {generatedDraft.validation.ok ? "pass" : "fail"} / errors: {generatedDraft.validation.errors.length} / warnings:{" "}
                    {generatedDraft.validation.warnings.length}
                  </p>
                  <p>
                    provider: {generatedDraft.route.providerName} / model: {generatedDraft.route.modelName} / fallback:{" "}
                    {generatedDraft.route.usedFallback ? "yes" : "no"}
                  </p>
                  <p>
                    latency: {generatedDraft.metadata.latencyMs}ms / length: {generatedDraft.metadata.markdownLength} / summary:{" "}
                    {generatedDraft.metadata.responseSummary}
                  </p>
                  <p>
                    repair: {generatedDraft.metadata.repairAttempted ? "attempted" : "not attempted"} / result:{" "}
                    {generatedDraft.metadata.repairSucceeded ? "success" : generatedDraft.metadata.repairAttempted ? "not passed" : "-"}
                  </p>
                </div>
                {generatedDraft.metadata.repairAttempted ? (
                  generatedDraft.metadata.repairSucceeded ? (
                    <div className="notice">초안 후보에서 위험 문구가 감지되어 자동 수정 1회를 수행했고, 자동 수정 후 validation을 통과했습니다.</div>
                  ) : (
                    <div className="notice warning">초안 후보에서 위험 문구가 감지되어 자동 수정 1회를 수행했습니다.</div>
                  )
                ) : null}
                {draftDirty ? (
                  <div className="notice warning">편집된 초안 후보는 재검증 후 반영할 수 있습니다.</div>
                ) : !generatedDraft.validation.ok ? (
                  <div className="notice error">자동 수정 후에도 validation error가 남아 있습니다. 후보 편집 후 재검증하세요.</div>
                ) : generatedDraft.validation.warnings.length > 0 ? (
                  <div className="notice">warning이 있습니다. 내용을 검토한 뒤 draftMarkdown에 반영할 수 있습니다.</div>
                ) : (
                  <div className="notice">validation을 통과했습니다. 내용을 검토한 뒤 draftMarkdown에 반영할 수 있습니다.</div>
                )}
                {generatedDraft.metadata.repairAttempted ? (
                  <div className="detail-grid">
                    <DetailItem label="Initial Errors" value={String(generatedDraft.metadata.initialValidationErrorCount)} />
                    <DetailItem label="Initial Warnings" value={String(generatedDraft.metadata.initialValidationWarningCount)} />
                    <DetailItem label="Final Errors" value={String(generatedDraft.metadata.finalValidationErrorCount)} />
                    <DetailItem label="Final Warnings" value={String(generatedDraft.metadata.finalValidationWarningCount)} />
                  </div>
                ) : null}
                <ValidationList title="Draft Validation Errors" items={generatedDraft.validation.errors} emptyText="draft validation error가 없습니다." isError />
                <ValidationList
                  title="Draft Validation Warnings"
                  items={generatedDraft.validation.warnings}
                  emptyText="draft validation warning이 없습니다."
                  isWarning
                />
                <label className="plan-editor read-block">
                  Candidate draftMarkdown
                  <textarea
                    value={draftCandidateText}
                    readOnly={!draftEditMode}
                    onChange={(event) => {
                      setDraftCandidateText(event.target.value);
                      setDraftDirty(true);
                    }}
                    spellCheck={false}
                  />
                </label>
                <div className="form-actions">
                  <button className="button secondary" type="button" onClick={() => setDraftEditMode((current) => !current)}>
                    {draftEditMode ? "읽기 모드" : "후보 편집"}
                  </button>
                  <button className="button secondary" type="button" disabled={revalidatingDraft || !draftDirty} onClick={() => void revalidateDraftCandidate()}>
                    {revalidatingDraft ? "재검증 중" : "재검증"}
                  </button>
                  <button className="button" type="button" disabled={!canApplyGeneratedDraft} onClick={() => void applyGeneratedDraft()}>
                    draftMarkdown에 반영
                  </button>
                </div>
              </div>
            ) : (
              <div className="notice">본문 초안 후보가 아직 없습니다.</div>
            )}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Attached Media</h2>
                <p className="muted">첨부 미디어는 읽기 중심으로 표시합니다. 수정은 /content/new의 첨부 관리에서 수행하세요.</p>
              </div>
            </div>
            {assetsError ? <div className="notice error">{assetsError}</div> : null}
            {assetsLoading ? <div className="notice">첨부 미디어를 불러오는 중입니다.</div> : null}
            <div className="asset-grid">
              {assets.length === 0 ? (
                <div className="notice">첨부된 미디어가 없습니다.</div>
              ) : (
                assets.map((asset) => (
                  <article className="asset-card" key={asset.id}>
                    <AssetPreview asset={asset} />
                    <div>
                      <strong>{asset.originalName}</strong>
                      <p className="muted">
                        {asset.mimeType} / {formatBytes(asset.fileSize)}
                      </p>
                      <p className="muted">
                        placement: {asset.placementHint} / order: {asset.sortOrder} / primary: {asset.isPrimary ? "yes" : "no"}
                      </p>
                      <p>caption: {asset.caption || "-"}</p>
                      <p className="muted">alt: {asset.altText || "-"}</p>
                      <p className="muted">note: {asset.userNote || "-"}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>HTML Conversion Dry Run</h2>
                <p className="muted">
                  저장된 draftMarkdown을 HTML preview로 변환하고 media placeholder 매핑과 sanitization readiness를 확인합니다. DB에는 저장하지 않습니다.
                </p>
              </div>
              <button className="button secondary" type="button" disabled>
                Blogger 연동은 후속 패치에서 연결 예정
              </button>
            </div>

            {!contentItem.draftMarkdown ? <div className="notice error">저장된 draftMarkdown이 없습니다. 먼저 draftMarkdown에 반영하세요.</div> : null}
            {htmlPreviewError ? <div className="notice error">{htmlPreviewError}</div> : null}
            {htmlApplyError ? <div className="notice error">{htmlApplyError}</div> : null}

            <div className="form-actions">
              <button className="button" type="button" disabled={!canRunHtmlPreview} onClick={() => void runHtmlPreviewDryRun()}>
                {runningHtmlPreview ? "HTML Dry Run 실행 중" : "HTML Dry Run"}
              </button>
              <button className="button secondary" type="button" disabled={!htmlCandidateText || validatingHtml} onClick={() => void revalidateHtmlCandidate()}>
                {validatingHtml ? "재검증 중" : "HTML 후보 재검증"}
              </button>
              <button className="button" type="button" disabled={!canApplyHtmlCandidate} onClick={() => void applyHtmlCandidate()}>
                {applyingHtml ? "draftHtml 반영 중" : "draftHtml에 반영"}
              </button>
            </div>

            {htmlPreviewResult ? (
              <>
                <div className={htmlPreviewResult.ready ? "notice" : "notice error"}>
                  {htmlPreviewResult.ready
                    ? "HTML dry-run readiness가 통과되었습니다. previewHtml은 화면 표시용이며 DB에 저장하지 않았습니다."
                    : "HTML dry-run readiness에 실패 항목이 있습니다. previewHtml은 화면 표시용이며 DB에 저장하지 않았습니다."}
                </div>
                <div className="detail-grid">
                  <DetailItem label="Markdown Length" value={String(htmlPreviewResult.metadata.draftMarkdownLength)} />
                  <DetailItem label="Preview HTML Length" value={String(htmlPreviewResult.metadata.previewHtmlLength)} />
                  <DetailItem label="Placeholders" value={String(htmlPreviewResult.metadata.placeholderCount)} />
                  <DetailItem label="Matched Placeholders" value={String(htmlPreviewResult.metadata.matchedPlaceholderCount)} />
                  <DetailItem label="Unmatched Placeholders" value={String(htmlPreviewResult.metadata.unmatchedPlaceholderCount)} />
                  <DetailItem label="Assets Without Placeholder" value={String(htmlPreviewResult.metadata.assetWithoutPlaceholderCount)} />
                </div>
                <ReadinessTable checks={htmlPreviewResult.checks} />
                <ValidationList title="Markdown Validation Errors" items={htmlPreviewResult.draftValidation.errors} emptyText="draft validation error가 없습니다." isError />
                <ValidationList
                  title="Markdown Validation Warnings"
                  items={htmlPreviewResult.draftValidation.warnings}
                  emptyText="draft validation warning이 없습니다."
                  isWarning
                />
                <SecurityCheckList checks={htmlPreviewResult.securityChecks} />
                <HtmlMediaMappingTable mappings={htmlPreviewResult.mediaMappings} />
                {htmlCandidateValidation ? (
                  <>
                    <div className={htmlCandidateValidation.validation.ok ? "notice" : "notice error"}>
                      <strong>HTML Candidate Validation</strong>
                      <p>
                        validation: {htmlCandidateValidation.validation.ok ? "pass" : "fail"} / errors:{" "}
                        {htmlCandidateValidation.validation.errors.length} / warnings: {htmlCandidateValidation.validation.warnings.length}
                      </p>
                      <p>
                        html length: {htmlCandidateValidation.metadata.htmlLength} / media refs:{" "}
                        {htmlCandidateValidation.metadata.mediaReferenceCount} / matched:{" "}
                        {htmlCandidateValidation.metadata.matchedMediaReferenceCount} / unmatched:{" "}
                        {htmlCandidateValidation.metadata.unmatchedMediaReferenceCount}
                      </p>
                    </div>
                    {htmlDirty ? (
                      <div className="notice warning">편집된 HTML 후보는 재검증 후 draftHtml에 반영할 수 있습니다.</div>
                    ) : !htmlCandidateValidation.validation.ok ? (
                      <div className="notice error">이 HTML 후보는 validation/security error가 있어 draftHtml에 반영할 수 없습니다.</div>
                    ) : htmlCandidateValidation.validation.warnings.length > 0 ? (
                      <div className="notice">warning이 있습니다. 내용을 검토한 뒤 draftHtml에 반영할 수 있습니다.</div>
                    ) : (
                      <div className="notice">validation/security 검증을 통과했습니다. 내용을 검토한 뒤 draftHtml에 반영할 수 있습니다.</div>
                    )}
                    <ValidationList
                      title="HTML Validation Errors"
                      items={htmlCandidateValidation.validation.errors}
                      emptyText="HTML validation/security error가 없습니다."
                      isError
                    />
                    <ValidationList
                      title="HTML Validation Warnings"
                      items={htmlCandidateValidation.validation.warnings}
                      emptyText="HTML validation warning이 없습니다."
                      isWarning
                    />
                    <SecurityCheckList checks={htmlCandidateValidation.securityChecks} />
                    <HtmlMediaMappingTable mappings={htmlCandidateValidation.mediaMappings} />
                  </>
                ) : (
                  <div className="notice">HTML Dry Run 성공 후 후보 재검증 결과가 표시됩니다.</div>
                )}
                <div className="read-block">
                  <h3>HTML Candidate Preview</h3>
                  <iframe
                    className="html-preview-frame"
                    sandbox=""
                    srcDoc={htmlCandidateText || htmlPreviewResult.previewHtml}
                    title="HTML conversion candidate preview"
                  />
                </div>
                <label className="plan-editor read-block">
                  HTML Candidate
                  <textarea
                    value={htmlCandidateText}
                    readOnly={!htmlEditMode}
                    onChange={(event) => {
                      setHtmlCandidateText(event.target.value);
                      setHtmlDirty(true);
                    }}
                    spellCheck={false}
                  />
                </label>
                <div className="form-actions">
                  <button className="button secondary" type="button" onClick={() => setHtmlEditMode((current) => !current)}>
                    {htmlEditMode ? "읽기 모드" : "HTML 후보 편집"}
                  </button>
                  <button className="button secondary" type="button" disabled={!htmlCandidateText || validatingHtml} onClick={() => void revalidateHtmlCandidate()}>
                    {validatingHtml ? "재검증 중" : "재검증"}
                  </button>
                  <button className="button" type="button" disabled={!canApplyHtmlCandidate} onClick={() => void applyHtmlCandidate()}>
                    {applyingHtml ? "draftHtml 반영 중" : "draftHtml에 반영"}
                  </button>
                </div>
                <div className="notice">draftHtml에 반영해도 Blogger 발행, Blogger draft 저장, LLM 호출, llm_call_logs 생성은 수행하지 않습니다.</div>
              </>
            ) : (
              <div className="notice">HTML Dry Run을 실행하면 저장된 draftMarkdown 기반 previewHtml, media mapping, security readiness가 생성됩니다.</div>
            )}
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>Draft And Quality</h2>
                <p className="muted">아직 자동 생성, HTML 변환, 품질검사는 연결하지 않았습니다.</p>
              </div>
            </div>
            <div className="read-block">
              <h3>Draft Markdown</h3>
              <pre>{contentItem.draftMarkdown || "아직 본문 생성 전입니다."}</pre>
            </div>
            <div className="read-block">
              <h3>Draft HTML</h3>
              <pre>{contentItem.draftHtml || "아직 HTML 변환 전입니다."}</pre>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProviderTestSummary({ title, provider }: { title: string; provider: NonNullable<LlmTaskRouteAdmin["primaryProvider"]> }) {
  return (
    <div className="notice">
      <strong>{title}</strong>
      <p className="muted">
        {provider.name} / {getInvocationModeLabel(provider.invocationMode)} / {getApiFormatLabel(provider.apiFormat)}
      </p>
      <p>
        status: {provider.lastTestStatus} / tested: {provider.lastTestedAt ? formatDate(provider.lastTestedAt) : "not tested"}
      </p>
      {provider.lastTestError ? <p className="muted">last error: {provider.lastTestError}</p> : null}
    </div>
  );
}

function PromptPreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <label className="plan-editor read-block">
      Prompt Preview: {title}
      <textarea value={value} readOnly spellCheck={false} />
    </label>
  );
}

function ValidationList({
  title,
  items,
  emptyText,
  isError = false,
  isWarning = false
}: {
  title: string;
  items: string[];
  emptyText: string;
  isError?: boolean;
  isWarning?: boolean;
}) {
  const className = isError && items.length > 0 ? "notice error" : isWarning && items.length > 0 ? "notice warning" : "notice";

  return (
    <div className={className}>
      <strong>{title}</strong>
      {items.length === 0 ? (
        <p>{emptyText}</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReadinessTable({ checks }: { checks: Array<{ key: string; label: string; status: ReadinessStatus; message: string }> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Check</th>
            <th>Status</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.key}>
              <td>{check.label}</td>
              <td>{formatReadinessStatus(check.status)}</td>
              <td>{check.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SecurityCheckList({ checks }: { checks: HtmlPreviewDryRunResult["securityChecks"] }) {
  return (
    <div className="read-block">
      <h3>Sanitization / Security Readiness</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.key}>
                <td>{check.key}</td>
                <td>{formatReadinessStatus(check.status)}</td>
                <td>{check.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HtmlMediaMappingTable({ mappings }: { mappings: HtmlPreviewDryRunResult["mediaMappings"] }) {
  return (
    <div className="read-block">
      <h3>HTML Media Placeholder Mapping</h3>
      {mappings.length === 0 ? (
        <div className="notice">draftMarkdown에 media placeholder가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Placeholder</th>
                <th>Asset</th>
                <th>Type</th>
                <th>Placement</th>
                <th>Caption</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={`${mapping.placeholder}-${mapping.assetId ?? "missing"}`}>
                  <td>
                    <code>{mapping.placeholder}</code>
                  </td>
                  <td>{mapping.originalName ?? mapping.assetId ?? "-"}</td>
                  <td>{mapping.assetType ?? "-"}</td>
                  <td>{mapping.placement ?? "-"}</td>
                  <td>{mapping.caption || "-"}</td>
                  <td>{mapping.matched ? "matched" : mapping.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MediaMappingTable({ mappings }: { mappings: DraftMarkdownDryRunResult["mediaMapping"] }) {
  return (
    <div className="read-block">
      <h3>Media Mapping Preview</h3>
      {mappings.length === 0 ? (
        <div className="notice">첨부 미디어가 없어 media placeholder preview가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Placement</th>
                <th>Matched mediaPlan</th>
                <th>Caption</th>
                <th>Placeholder</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.assetId}>
                  <td>{mapping.originalName}</td>
                  <td>{mapping.assetType}</td>
                  <td>
                    {mapping.placementHint} / order {mapping.sortOrder} / primary {mapping.isPrimary ? "yes" : "no"}
                  </td>
                  <td>{mapping.matchedMediaPlan ? "yes" : "no"}</td>
                  <td>{mapping.caption || "-"}</td>
                  <td>
                    <code>{mapping.placeholder}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatProviderName(provider: LlmTaskRouteAdmin["primaryProvider"] | LlmTaskRouteAdmin["fallbackProvider"] | undefined) {
  if (!provider) {
    return "-";
  }
  return provider.name;
}

function formatModelName(model: LlmTaskRouteAdmin["primaryModel"] | LlmTaskRouteAdmin["fallbackModel"] | undefined) {
  if (!model) {
    return "-";
  }
  return model.displayName ?? model.name;
}

function formatReadinessStatus(status: ReadinessStatus) {
  if (status === "pass") {
    return "pass";
  }
  if (status === "warn") {
    return "warning";
  }
  return "fail";
}

function AssetPreview({ asset }: { asset: ContentAssetAdmin }) {
  const src = `/api/content-assets/${asset.id}/file`;

  if (asset.assetType === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="asset-preview" src={src} alt={asset.altText || asset.caption || asset.originalName} />;
  }

  return <video className="asset-preview" src={src} controls />;
}

function parsePlan(value: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "planJson은 JSON object여야 합니다." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `유효하지 않은 JSON입니다: ${error.message}` : "유효하지 않은 JSON입니다." };
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)}KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}
