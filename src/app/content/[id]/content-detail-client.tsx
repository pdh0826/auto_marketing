"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { getContentModeLabel } from "@/lib/content/constants";
import { formatPlanJson, hasUsablePlanJson } from "@/lib/content/plan-template";
import { ApiResult, requestJson } from "@/lib/form-utils";

interface ContentDetailClientProps {
  contentItemId: string;
}

export function ContentDetailClient({ contentItemId }: ContentDetailClientProps) {
  const [contentItem, setContentItem] = useState<ContentItemAdmin | null>(null);
  const [assets, setAssets] = useState<ContentAssetAdmin[]>([]);
  const [planText, setPlanText] = useState("");
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const parsedPlan = useMemo(() => parsePlan(planText), [planText]);
  const canMarkPlanned = parsedPlan.ok && hasUsablePlanJson(parsedPlan.value);

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

  useEffect(() => {
    void loadContentItem();
    void loadAssets();
  }, [loadAssets, loadContentItem]);

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
            본문 생성은 후속 패치에서 연결 예정
          </button>
          <button className="button secondary" type="button" disabled>
            HTML 변환은 후속 패치에서 연결 예정
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
