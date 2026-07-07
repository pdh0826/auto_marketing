"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { ApiResult, requestJson } from "@/lib/form-utils";

const editSteps = ["수정 목적", "수정 범위", "후보 확인", "검증", "적용"] as const;
const editGoals = [
  { id: "title_meta", label: "제목/키워드/메모 수정", description: "기본 정보만 정리합니다." },
  { id: "seo_expand", label: "본문 SEO 보강", description: "길이, 목차, 설명력을 보강합니다." },
  { id: "risk_tone", label: "위험 문구/톤 수정", description: "투자 권유처럼 보이는 표현을 줄입니다." },
  { id: "cta_faq", label: "CTA/FAQ 수정", description: "서비스 연결과 자주 묻는 질문을 다듬습니다." },
  { id: "html_refresh", label: "HTML 재생성", description: "Markdown 후보를 Blogger-ready HTML로 다시 검증합니다." }
] as const;
const editScopes = [
  { id: "metadata", label: "제목/키워드/메모", description: "draftMarkdown/draftHtml은 건드리지 않습니다." },
  { id: "full_markdown", label: "전체 draftMarkdown", description: "본문 후보 전체를 검토 후 적용합니다." },
  { id: "cta_faq_only", label: "CTA/FAQ 중심", description: "후보 textarea에서 해당 부분만 수정합니다." },
  { id: "html_from_markdown", label: "HTML까지 재생성", description: "guarded apply가 draftMarkdown과 draftHtml을 함께 반영합니다." }
] as const;

type EditGoalId = (typeof editGoals)[number]["id"];
type EditScopeId = (typeof editScopes)[number]["id"];

interface EditArticleWizardClientProps {
  contentItemId: string;
}

interface SeoCandidateApplyResponse {
  mode: "dry_run" | "apply";
  canApply: boolean;
  applied: boolean;
  blockingReasons: string[];
  currentContentItemSummary: {
    status: string;
    draftMarkdownMd5: string;
    draftHtmlMd5: string;
    draftMarkdownLength: number;
    draftHtmlLength: number;
  };
  candidateSummary: {
    markdownLength: number;
    htmlLength: number;
    candidateMarkdownSha256: string;
    candidateHtmlSha256: string;
    templatePreviewOk: boolean;
    htmlValidationOk: boolean;
    seoArticle: {
      grade: "pass" | "warn" | "fail";
      score: number;
      visibleTextLength: number;
      blockingReasons: string[];
      warnings: string[];
      editorialGrade: "pass" | "warn" | "fail";
      editorialScore: number;
    };
  };
  updatedContentItemSummary: null | {
    draftMarkdownLength: number;
    draftHtmlLength: number;
    updatedAt: string;
  };
  confirmationPolicy: {
    phrase: string;
  };
  sideEffectSummary: {
    dbWrite: boolean;
    contentMutation: boolean;
    mutatedFields: string[];
    bloggerWrite: boolean;
    bloggerDraftSave: boolean;
    bloggerPublish: boolean;
    tokenRefresh: boolean;
    llmCall: boolean;
  };
}

export function EditArticleWizardClient({ contentItemId }: EditArticleWizardClientProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [contentItem, setContentItem] = useState<ContentItemAdmin | null>(null);
  const [editGoal, setEditGoal] = useState<EditGoalId>("seo_expand");
  const [editScope, setEditScope] = useState<EditScopeId>("full_markdown");
  const [title, setTitle] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [sourceMemo, setSourceMemo] = useState("");
  const [candidateMarkdown, setCandidateMarkdown] = useState("");
  const [dryRun, setDryRun] = useState<SeoCandidateApplyResponse | null>(null);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);

  const selectedGoal = editGoals.find((goal) => goal.id === editGoal) ?? editGoals[0];
  const selectedScope = editScopes.find((scope) => scope.id === editScope) ?? editScopes[0];
  const canApplyCandidate = Boolean(dryRun?.canApply && confirmationPhrase === dryRun.confirmationPolicy.phrase && !applying);

  const loadContentItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`);
      setContentItem(response.data);
      setTitle(response.data.title ?? "");
      setTargetKeyword(response.data.targetKeyword ?? "");
      setSourceMemo(response.data.sourceMemo ?? "");
      setCandidateMarkdown(response.data.draftMarkdown ?? buildFallbackMarkdown(response.data));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [contentItemId]);

  useEffect(() => {
    void loadContentItem();
  }, [loadContentItem]);

  const candidateHint = useMemo(() => {
    if (editGoal === "risk_tone") {
      return "투자 권유, 수익 보장, 확정 표현을 줄이고 확인 기준과 주의문구를 보강하세요.";
    }
    if (editGoal === "cta_faq") {
      return "본문 흐름을 해치지 않는 CTA와 FAQ를 마지막 섹션 중심으로 다듬으세요.";
    }
    if (editGoal === "title_meta") {
      return "이 목적은 기본 정보 저장을 우선 사용하세요. 본문 후보 적용은 선택입니다.";
    }
    return "본문 길이, 섹션 간 연결, 검색 의도 답변이 부족한 부분을 보강하세요.";
  }, [editGoal]);

  async function saveMetadata() {
    setSavingMetadata(true);
    setError(null);
    setNotice(null);
    try {
      const response = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim() || null,
          targetKeyword: targetKeyword.trim() || null,
          sourceMemo: sourceMemo.trim() || null
        })
      });
      setContentItem(response.data);
      setNotice("기본 정보를 저장했습니다. draftMarkdown/draftHtml, status, qualityScore, publishedAt, scheduledAt은 변경하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "기본 정보를 저장하지 못했습니다.");
    } finally {
      setSavingMetadata(false);
    }
  }

  async function validateCandidate() {
    setValidating(true);
    setError(null);
    setNotice(null);
    setDryRun(null);
    try {
      const response = await requestJson<ApiResult<SeoCandidateApplyResponse>>(`/api/content-items/${contentItemId}/seo-editorial-candidate-apply`, {
        method: "POST",
        body: JSON.stringify({
          mode: "dry_run",
          markdown: candidateMarkdown,
          source: `wizard_edit:${editGoal}:${editScope}`
        })
      });
      setDryRun(response.data);
      setStepIndex(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수정 후보 검증에 실패했습니다.");
    } finally {
      setValidating(false);
    }
  }

  async function applyCandidate() {
    if (!dryRun) {
      setError("먼저 수정 후보를 검증하세요.");
      return;
    }

    setApplying(true);
    setError(null);
    setNotice(null);
    try {
      const response = await requestJson<ApiResult<SeoCandidateApplyResponse>>(`/api/content-items/${contentItemId}/seo-editorial-candidate-apply`, {
        method: "POST",
        body: JSON.stringify({
          mode: "apply",
          markdown: candidateMarkdown,
          source: `wizard_edit:${editGoal}:${editScope}`,
          confirmationPhrase,
          expectedCurrentDraftMarkdownMd5: dryRun.currentContentItemSummary.draftMarkdownMd5,
          expectedCurrentDraftHtmlMd5: dryRun.currentContentItemSummary.draftHtmlMd5,
          expectedCandidateMarkdownSha256: dryRun.candidateSummary.candidateMarkdownSha256,
          expectedCandidateHtmlSha256: dryRun.candidateSummary.candidateHtmlSha256
        })
      });
      setDryRun(response.data);
      setNotice("수정 후보를 draftMarkdown/draftHtml에 수동 적용했습니다. Blogger API, publish, token refresh, LLM 호출은 없었습니다.");
      setConfirmationPhrase("");
      await loadContentItem();
      setStepIndex(4);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수정 후보를 적용하지 못했습니다.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">9G-7 edit wizard</span>
        <h1>수정 마법사</h1>
        <p className="muted">수정 목적과 범위를 먼저 확정하고, dry-run 검증을 통과한 후보만 수동 적용합니다.</p>
      </section>

      <WizardSteps current={stepIndex} />
      {loading ? <div className="notice">글을 불러오는 중입니다.</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice success">{notice}</div> : null}

      <section className="admin-section">
        {contentItem ? (
          <div className="notice">
            현재 글: <strong>{contentItem.title ?? contentItem.targetKeyword ?? contentItem.id}</strong> / status {contentItem.status} / draftMarkdown{" "}
            {contentItem.draftMarkdown?.length ?? 0}자 / draftHtml {contentItem.draftHtml?.length ?? 0}자
          </div>
        ) : null}

        {stepIndex === 0 ? (
          <OptionCards title="무엇을 수정할까요?" options={editGoals} selected={editGoal} onSelect={setEditGoal} />
        ) : null}

        {stepIndex === 1 ? (
          <OptionCards title="어느 범위를 수정할까요?" options={editScopes} selected={editScope} onSelect={setEditScope} />
        ) : null}

        {stepIndex === 2 ? (
          <>
            <div className="section-heading">
              <div>
                <h2>수정 후보 확인</h2>
                <p className="muted">{selectedGoal.label} / {selectedScope.label}. {candidateHint}</p>
              </div>
            </div>
            <div className="admin-form">
              <label>
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label>
                Target Keyword
                <input value={targetKeyword} onChange={(event) => setTargetKeyword(event.target.value)} />
              </label>
              <label className="textarea-field">
                Source Memo
                <textarea value={sourceMemo} onChange={(event) => setSourceMemo(event.target.value)} />
              </label>
              <div className="form-actions">
                <button className="button secondary" type="button" disabled={savingMetadata} onClick={() => void saveMetadata()}>
                  {savingMetadata ? "기본 정보 저장 중" : "기본 정보만 저장"}
                </button>
              </div>
            </div>
            <label style={{ display: "grid", gap: 8 }}>
              draftMarkdown 후보
              <textarea
                value={candidateMarkdown}
                onChange={(event) => {
                  setCandidateMarkdown(event.target.value);
                  setDryRun(null);
                  setConfirmationPhrase("");
                }}
                style={{ minHeight: 360 }}
              />
            </label>
            <div className="notice">
              본문 후보는 아직 저장되지 않았습니다. 검증 후 확인 문구를 입력해야 draftMarkdown/draftHtml에 반영됩니다.
            </div>
          </>
        ) : null}

        {stepIndex === 3 ? (
          <>
            <div className="section-heading">
              <div>
                <h2>검증 결과</h2>
                <p className="muted">검증 통과 후 확인 문구를 입력하면 수동 적용할 수 있습니다.</p>
              </div>
              <button className="button secondary" type="button" disabled={validating} onClick={() => void validateCandidate()}>
                다시 검증
              </button>
            </div>
            {dryRun ? (
              <div className={dryRun.canApply ? "notice success" : "notice error"}>
                <p>canApply: {String(dryRun.canApply)} / template {String(dryRun.candidateSummary.templatePreviewOk)} / HTML validation{" "}
                  {String(dryRun.candidateSummary.htmlValidationOk)}</p>
                <p>
                  후보 Markdown {dryRun.candidateSummary.markdownLength}자 / HTML {dryRun.candidateSummary.htmlLength}자 / visible text{" "}
                  {dryRun.candidateSummary.seoArticle.visibleTextLength}자
                </p>
                <p>
                  SEO grade {dryRun.candidateSummary.seoArticle.grade} {dryRun.candidateSummary.seoArticle.score}점 / editorial{" "}
                  {dryRun.candidateSummary.seoArticle.editorialGrade} {dryRun.candidateSummary.seoArticle.editorialScore}점
                </p>
                {dryRun.blockingReasons.length > 0 ? <p>blockers: {dryRun.blockingReasons.join(", ")}</p> : null}
              </div>
            ) : (
              <div className="notice">아직 검증 결과가 없습니다.</div>
            )}
          </>
        ) : null}

        {stepIndex === 4 ? (
          <div className="read-block">
            <h2>수동 적용</h2>
            <p className="muted">적용하면 draftMarkdown과 draftHtml만 변경됩니다. status, qualityScore, publishedAt, scheduledAt은 변경하지 않습니다.</p>
            <label style={{ display: "grid", gap: 8 }}>
              확인 문구
              <input
                value={confirmationPhrase}
                onChange={(event) => setConfirmationPhrase(event.target.value)}
                placeholder={dryRun?.confirmationPolicy.phrase ?? "먼저 검증하세요"}
              />
            </label>
            <div className="button-row" style={{ marginTop: 12 }}>
              <button className="button" type="button" disabled={!canApplyCandidate} onClick={() => void applyCandidate()}>
                {applying ? "적용 중" : "수정 후보 수동 적용"}
              </button>
              <Link className="button secondary" href={`/wizard/publish/${contentItemId}`}>
                발행 준비로 이동
              </Link>
            </div>
          </div>
        ) : null}

        <div className="button-row" style={{ marginTop: 18 }}>
          <button className="button secondary" type="button" disabled={stepIndex === 0 || applying} onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}>
            이전
          </button>
          {stepIndex < 2 ? (
            <button className="button" type="button" onClick={() => setStepIndex(stepIndex + 1)}>
              다음
            </button>
          ) : null}
          {stepIndex === 2 ? (
            <button className="button" type="button" disabled={validating || !candidateMarkdown.trim()} onClick={() => void validateCandidate()}>
              {validating ? "검증 중" : "수정 후보 검증"}
            </button>
          ) : null}
          {stepIndex === 3 ? (
            <button className="button" type="button" disabled={!dryRun?.canApply} onClick={() => setStepIndex(4)}>
              적용 단계로 이동
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}

function WizardSteps({ current }: { current: number }) {
  return (
    <section className="card-grid" style={{ marginTop: 16 }}>
      {editSteps.map((step, index) => (
        <div className="card" key={step}>
          <span className={`status-pill ${index <= current ? "status-connected" : ""}`}>{index < current ? "완료" : index === current ? "진행 중" : "대기"}</span>
          <h2>{index + 1}. {step}</h2>
        </div>
      ))}
    </section>
  );
}

function OptionCards<T extends string>({
  title,
  options,
  selected,
  onSelect
}: {
  title: string;
  options: ReadonlyArray<{ id: T; label: string; description: string }>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">선택 후 다음을 누르세요.</p>
        </div>
      </div>
      <div className="card-grid">
        {options.map((option) => (
          <button
            className={`card ${selected === option.id ? "selected-card" : ""}`}
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            style={{ textAlign: "left", cursor: "pointer" }}
          >
            <h2>{option.label}</h2>
            <p className="muted">{option.description}</p>
          </button>
        ))}
      </div>
    </>
  );
}

function buildFallbackMarkdown(contentItem: ContentItemAdmin) {
  return `# ${contentItem.title ?? contentItem.targetKeyword ?? "새 글"}

## 수정 후보

저장된 draftMarkdown이 없습니다. 이 영역에 수정할 본문 후보를 작성한 뒤 검증하세요.`;
}
