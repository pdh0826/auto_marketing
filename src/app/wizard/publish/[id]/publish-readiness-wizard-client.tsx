"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { ApiResult, requestJson } from "@/lib/form-utils";

const publishSteps = ["글 확인", "품질 확인", "Payload", "수동 승인", "Preflight"] as const;

interface PublishReadinessWizardClientProps {
  contentItemId: string;
}

interface SeoWorkflowResponse {
  summary: {
    title: string | null;
    status: string;
    draftMarkdownLength: number;
    draftHtmlLength: number;
    qualityGrade: "pass" | "warn" | "fail";
    qualityScorePreview: number;
    seoEditorialGrade: "pass" | "warn" | "fail";
    seoEditorialScore: number;
  };
  nextAction: {
    label: string;
    action: string;
    blocked: boolean;
  };
  sideEffectSummary: Record<string, boolean>;
}

interface DraftPayloadPreviewResponse {
  draftPayloadReady: boolean;
  titleCandidate: string | null;
  htmlLength: number;
  blockingIssues: string[];
  warnings: string[];
  approvalSummary?: {
    approvalStatus: string;
    approvalMatchesCurrentPreview: boolean;
  };
}

interface DraftApprovalResponse {
  approval: {
    id: string;
    approvedAt: string;
    snapshotHashPrefix: string;
  };
  approvalSummary: {
    approvalStatus: string;
    approvalMatchesCurrentPreview: boolean;
  };
}

interface DraftSavePreflightResponse {
  ok: boolean;
  canSaveDraft: boolean;
  blockingReasons: string[];
  warnings: string[];
  htmlLength: number;
  htmlHashPrefix: string | null;
  draftPayloadPreviewSummary: {
    draftPayloadReady: boolean;
    titleCandidate: string | null;
    blockingIssues: string[];
  };
  approvalSnapshotStatus: {
    status: string;
    approvalId: string | null;
    approvalMatchesCurrentPreview: boolean;
    requiresReapproval: boolean;
  };
  sideEffectSummary: {
    dbWrite: boolean;
    bloggerApiWrite: boolean;
    bloggerDraftSave: boolean;
    bloggerPublish: boolean;
    tokenRefresh: boolean;
    llmCall: boolean;
    contentMutation: boolean;
  };
}

export function PublishReadinessWizardClient({ contentItemId }: PublishReadinessWizardClientProps) {
  const [contentItem, setContentItem] = useState<ContentItemAdmin | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [workflow, setWorkflow] = useState<SeoWorkflowResponse | null>(null);
  const [draftPreview, setDraftPreview] = useState<DraftPayloadPreviewResponse | null>(null);
  const [approval, setApproval] = useState<DraftApprovalResponse | null>(null);
  const [preflight, setPreflight] = useState<DraftSavePreflightResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadContentItem = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await requestJson<ApiResult<ContentItemAdmin>>(`/api/content-items/${contentItemId}`);
      setContentItem(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [contentItemId]);

  useEffect(() => {
    void loadContentItem();
  }, [loadContentItem]);

  async function runWorkflow() {
    await runStep("workflow", async () => {
      const response = await requestJson<ApiResult<SeoWorkflowResponse>>(`/api/content-items/${contentItemId}/seo-editorial-publish-workflow`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setWorkflow(response.data);
      setStepIndex(Math.max(stepIndex, 1));
    });
  }

  async function runDraftPreview() {
    await runStep("payload", async () => {
      const response = await requestJson<ApiResult<DraftPayloadPreviewResponse>>(`/api/content-items/${contentItemId}/blogger-draft-preview`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setDraftPreview(response.data);
      setStepIndex(Math.max(stepIndex, 2));
    });
  }

  async function createApproval() {
    await runStep("approval", async () => {
      const response = await requestJson<ApiResult<DraftApprovalResponse>>(`/api/content-items/${contentItemId}/blogger-draft-approval`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setApproval(response.data);
      setStepIndex(Math.max(stepIndex, 3));
    });
  }

  async function runPreflight() {
    await runStep("preflight", async () => {
      const response = await requestJson<ApiResult<DraftSavePreflightResponse>>(`/api/content-items/${contentItemId}/blogger-draft-save-preflight`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setPreflight(response.data);
      setStepIndex(4);
    });
  }

  async function runStep(label: string, action: () => Promise<void>) {
    setRunning(label);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice("단계 확인이 완료되었습니다. Blogger draft save/publish/token refresh는 실행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "단계 실행에 실패했습니다.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">9G-7 publish wizard</span>
        <h1>발행 준비 마법사</h1>
        <p className="muted">품질, Blogger payload, approval, draft save preflight를 순서대로 확인합니다. 실제 저장/발행은 자동 실행하지 않습니다.</p>
      </section>

      <section className="card-grid" style={{ marginTop: 16 }}>
        {publishSteps.map((step, index) => (
          <div className="card" key={step}>
            <span className={`status-pill ${index <= stepIndex ? "status-connected" : ""}`}>{index < stepIndex ? "완료" : index === stepIndex ? "진행 중" : "대기"}</span>
            <h2>{index + 1}. {step}</h2>
          </div>
        ))}
      </section>

      {loading ? <div className="notice">글을 불러오는 중입니다.</div> : null}
      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice success">{notice}</div> : null}

      <section className="admin-section">
        {contentItem ? (
          <div className="read-block">
            <h2>{contentItem.title ?? contentItem.targetKeyword ?? contentItem.id}</h2>
            <p>Status: {contentItem.status}</p>
            <p>draftMarkdown {contentItem.draftMarkdown?.length ?? 0}자 / draftHtml {contentItem.draftHtml?.length ?? 0}자</p>
            <div className="button-row">
              <Link className="button secondary" href={`/wizard/edit/${contentItemId}`}>
                수정 마법사
              </Link>
              <Link className="button secondary" href={`/content/${contentItemId}`}>
                상세 고급 화면
              </Link>
            </div>
          </div>
        ) : null}

        <div className="card-grid" style={{ marginTop: 16 }}>
          <ActionCard
            title="품질/SEO workflow"
            actionLabel={running === "workflow" ? "확인 중" : "품질 확인"}
            disabled={Boolean(running)}
            onClick={() => void runWorkflow()}
          >
            {workflow ? (
              <>
                <p>Quality {workflow.summary.qualityGrade} {workflow.summary.qualityScorePreview}점</p>
                <p>SEO editorial {workflow.summary.seoEditorialGrade} {workflow.summary.seoEditorialScore}점</p>
                <p>다음: {workflow.nextAction.label}</p>
              </>
            ) : (
              <p className="muted">글 품질과 다음 작업을 확인합니다.</p>
            )}
          </ActionCard>

          <ActionCard
            title="Blogger payload preview"
            actionLabel={running === "payload" ? "확인 중" : "Payload 확인"}
            disabled={Boolean(running)}
            onClick={() => void runDraftPreview()}
          >
            {draftPreview ? (
              <>
                <p>ready: {String(draftPreview.draftPayloadReady)} / html {draftPreview.htmlLength}자</p>
                <p>title: {draftPreview.titleCandidate ?? "-"}</p>
                {draftPreview.blockingIssues.length ? <p>blockers: {draftPreview.blockingIssues.join(", ")}</p> : null}
              </>
            ) : (
              <p className="muted">저장된 draftHtml이 Blogger draft payload로 준비됐는지 확인합니다.</p>
            )}
          </ActionCard>

          <ActionCard
            title="수동 approval snapshot"
            actionLabel={running === "approval" ? "생성 중" : "Approval 생성"}
            disabled={Boolean(running) || !draftPreview?.draftPayloadReady}
            onClick={() => void createApproval()}
          >
            {approval ? (
              <>
                <p>approval: {approval.approval.id}</p>
                <p>matches current preview: {String(approval.approvalSummary.approvalMatchesCurrentPreview)}</p>
              </>
            ) : (
              <p className="muted">Payload preview가 ready일 때만 snapshot approval을 생성합니다. DB row 생성은 이 버튼을 누를 때만 발생합니다.</p>
            )}
          </ActionCard>

          <ActionCard
            title="Draft save preflight"
            actionLabel={running === "preflight" ? "확인 중" : "Preflight 실행"}
            disabled={Boolean(running)}
            onClick={() => void runPreflight()}
          >
            {preflight ? (
              <>
                <p>canSaveDraft: {String(preflight.canSaveDraft)} / html {preflight.htmlLength}자 / hash {preflight.htmlHashPrefix ?? "-"}</p>
                <p>approval: {preflight.approvalSnapshotStatus.status} / matches {String(preflight.approvalSnapshotStatus.approvalMatchesCurrentPreview)}</p>
                {preflight.blockingReasons.length ? <p>blockers: {preflight.blockingReasons.join(", ")}</p> : null}
                <p>
                  side effects: write {String(preflight.sideEffectSummary.bloggerApiWrite)} / publish {String(preflight.sideEffectSummary.bloggerPublish)} / token refresh{" "}
                  {String(preflight.sideEffectSummary.tokenRefresh)}
                </p>
              </>
            ) : (
              <p className="muted">실제 Blogger draft save 전에 저장 가능 여부를 확인합니다. 이 단계도 write를 하지 않습니다.</p>
            )}
          </ActionCard>
        </div>

        <div className="notice" style={{ marginTop: 16 }}>
          실제 Blogger draft save나 publish는 이 마법사에서 자동 실행하지 않습니다. preflight가 통과하면 상세 화면의 guarded 버튼에서 별도 확인 후 진행하세요.
        </div>
        <div className="button-row" style={{ marginTop: 12 }}>
          <Link className="button" href={`/content/${contentItemId}`}>
            상세 화면에서 guarded 저장/발행 진행
          </Link>
        </div>
      </section>
    </>
  );
}

function ActionCard({
  title,
  actionLabel,
  disabled,
  onClick,
  children
}: {
  title: string;
  actionLabel: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <div>{children}</div>
      <button className="button secondary" type="button" disabled={disabled} onClick={onClick} style={{ marginTop: 12 }}>
        {actionLabel}
      </button>
    </div>
  );
}
