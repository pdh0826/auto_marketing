"use client";

import { useState } from "react";
import { ApiResult, requestJson } from "@/lib/form-utils";
import type { VideoSourcePreviewResult } from "@/lib/video-automation/source-collection/types";
import type { VideoSourcePackageResult } from "@/lib/video-automation/source-package/types";

type SourceMode = "manual" | "content_item" | "daily_brief" | "site_recipe" | "generic_url";

const SAMPLE_SITE_HTML = `<main>
  <h1 id="video-title">샘플 사이트 핵심 리포트</h1>
  <section data-video-source="summary">오늘 자료의 핵심은 수요 회복과 비용 안정화입니다.</section>
  <article class="evidence">첫 번째 근거는 검색량 증가와 문의 전환율 개선입니다.</article>
  <article class="evidence">두 번째 근거는 경쟁사 대비 가격 방어력입니다.</article>
  <img class="visual" src="/images/sample-chart.png" alt="샘플 차트" width="1080" height="720" />
</main>`;

export function VideoSourceWizardClient() {
  const [mode, setMode] = useState<SourceMode>("manual");
  const [manualTitle, setManualTitle] = useState("직접 입력 영상 소재");
  const [manualText, setManualText] = useState("핵심 문제는 사용자가 자료를 어디서 가져오든 같은 영상 파이프라인으로 처리하는 것입니다. 첫 장면은 문제 제기, 두 번째 장면은 근거, 마지막 장면은 검토 체크리스트로 구성합니다.");
  const [manualUrl, setManualUrl] = useState("https://example.com/source");
  const [contentItemId, setContentItemId] = useState("");
  const [dailyBriefRunId, setDailyBriefRunId] = useState("");
  const [genericUrl, setGenericUrl] = useState("https://example.com/article");
  const [genericTitle, setGenericTitle] = useState("일반 URL 영상 소재");
  const [genericExcerpt, setGenericExcerpt] = useState("URL만으로 외부 fetch를 실행하지 않고, 사용자가 제공한 요약과 스니펫으로 preview를 만듭니다.");
  const [siteRecipeUrl, setSiteRecipeUrl] = useState("https://example.com/report");
  const [siteRecipeHtml, setSiteRecipeHtml] = useState(SAMPLE_SITE_HTML);
  const [preview, setPreview] = useState<VideoSourcePreviewResult | null>(null);
  const [sourcePackage, setSourcePackage] = useState<VideoSourcePackageResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runPreview() {
    setRunning(true);
    setError(null);
    try {
      if (mode === "manual") {
        const response = await requestJson<ApiResult<VideoSourcePreviewResult>>("/api/video-sources/manual/preview", {
          method: "POST",
          body: JSON.stringify({
            title: manualTitle,
            sourceText: manualText,
            referenceUrls: manualUrl ? [manualUrl] : [],
            platformHint: "shortform"
          })
        });
        setPreview(response.data);
        setSourcePackage(null);
      } else if (mode === "content_item") {
        if (!contentItemId.trim()) {
          throw new Error("Content item id를 입력하세요.");
        }
        const response = await requestJson<ApiResult<VideoSourcePreviewResult>>(`/api/video-sources/content-items/${contentItemId.trim()}/preview`);
        setPreview(response.data);
        setSourcePackage(null);
      } else if (mode === "daily_brief") {
        if (!dailyBriefRunId.trim()) {
          throw new Error("Daily Brief run id를 입력하세요.");
        }
        const response = await requestJson<ApiResult<VideoSourcePreviewResult>>(`/api/video-sources/daily-brief/${dailyBriefRunId.trim()}/preview`);
        setPreview(response.data);
        setSourcePackage(null);
      } else if (mode === "site_recipe") {
        const response = await requestJson<ApiResult<VideoSourcePreviewResult>>("/api/video-sources/site-recipe/preview", {
          method: "POST",
          body: JSON.stringify({
            recipe: {
              id: "operator-defined-site-recipe",
              name: "Operator Defined Site Recipe",
              allowedDomains: [new URL(siteRecipeUrl).hostname],
              sourceUrl: siteRecipeUrl,
              titleSelector: "#video-title",
              summarySelector: "[data-video-source=\"summary\"]",
              evidenceSelectors: [".evidence"],
              visualSelectors: [".visual"],
              maxSnippetChars: 420,
              requireAttribution: true
            },
            html: siteRecipeHtml
          })
        });
        setPreview(response.data);
        setSourcePackage(null);
      } else {
        const response = await requestJson<ApiResult<VideoSourcePreviewResult>>("/api/video-sources/generic-url/preview", {
          method: "POST",
          body: JSON.stringify({
            url: genericUrl,
            title: genericTitle,
            excerpt: genericExcerpt
          })
        });
        setPreview(response.data);
        setSourcePackage(null);
      }
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "영상 소스 preview 실패");
    } finally {
      setRunning(false);
    }
  }

  async function generateSourcePackage() {
    setRunning(true);
    setError(null);
    try {
      const response = await requestJson<ApiResult<VideoSourcePackageResult>>("/api/video-sources/package", {
        method: "POST",
        body: JSON.stringify({
          ...buildPackageRequestPayload(),
          write: true
        })
      });
      setPreview(response.data.preview);
      setSourcePackage(response.data);
    } catch (packageError) {
      setError(packageError instanceof Error ? packageError.message : "영상 소스 패키지 생성 실패");
    } finally {
      setRunning(false);
    }
  }

  function buildPackageRequestPayload() {
    if (mode === "manual") {
      return {
        sourceKind: "manual" as const,
        manual: {
          title: manualTitle,
          sourceText: manualText,
          referenceUrls: manualUrl ? [manualUrl] : [],
          platformHint: "shortform"
        }
      };
    }
    if (mode === "content_item") {
      if (!contentItemId.trim()) {
        throw new Error("Content item id를 입력하세요.");
      }
      return {
        sourceKind: "content_item" as const,
        contentItemId: contentItemId.trim()
      };
    }
    if (mode === "daily_brief") {
      if (!dailyBriefRunId.trim()) {
        throw new Error("Daily Brief run id를 입력하세요.");
      }
      return {
        sourceKind: "daily_brief" as const,
        runId: dailyBriefRunId.trim()
      };
    }
    if (mode === "site_recipe") {
      return {
        sourceKind: "site_recipe" as const,
        siteRecipe: {
          recipe: {
            id: "operator-defined-site-recipe",
            name: "Operator Defined Site Recipe",
            allowedDomains: [new URL(siteRecipeUrl).hostname],
            sourceUrl: siteRecipeUrl,
            titleSelector: "#video-title",
            summarySelector: "[data-video-source=\"summary\"]",
            evidenceSelectors: [".evidence"],
            visualSelectors: [".visual"],
            maxSnippetChars: 420,
            requireAttribution: true
          },
          html: siteRecipeHtml
        }
      };
    }
    return {
      sourceKind: "generic_url" as const,
      genericUrl: {
        url: genericUrl,
        title: genericTitle,
        excerpt: genericExcerpt
      }
    };
  }

  return (
    <section className="admin-section">
      <div className="section-heading">
        <div>
          <h1>영상 소스 선택</h1>
          <p>자료 입력 방식은 여러 개, 영상 생성 파이프라인은 하나로 유지합니다.</p>
        </div>
        <span className="status-pill">VIDEO-4</span>
      </div>

      <div className="admin-form">
        <label>
          소스 유형
          <select value={mode} onChange={(event) => setMode(event.target.value as SourceMode)}>
            <option value="manual">직접 입력</option>
            <option value="content_item">기존 Content Item</option>
            <option value="daily_brief">Daily Brief</option>
            <option value="site_recipe">사이트 Recipe Fixture</option>
            <option value="generic_url">일반 URL Preview</option>
          </select>
        </label>

        {mode === "manual" ? (
          <>
            <label>
              제목
              <input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} />
            </label>
            <label>
              참고 URL
              <input value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} />
            </label>
            <label className="full-span">
              직접 입력 자료
              <textarea value={manualText} onChange={(event) => setManualText(event.target.value)} />
            </label>
          </>
        ) : null}

        {mode === "content_item" ? (
          <label className="full-span">
            Content item id
            <input value={contentItemId} onChange={(event) => setContentItemId(event.target.value)} placeholder="existing content item id" />
          </label>
        ) : null}

        {mode === "daily_brief" ? (
          <label className="full-span">
            Daily Brief run id
            <input value={dailyBriefRunId} onChange={(event) => setDailyBriefRunId(event.target.value)} placeholder="daily brief run id" />
          </label>
        ) : null}

        {mode === "site_recipe" ? (
          <>
            <label>
              Source URL
              <input value={siteRecipeUrl} onChange={(event) => setSiteRecipeUrl(event.target.value)} />
            </label>
            <label className="full-span">
              Fixture HTML
              <textarea value={siteRecipeHtml} onChange={(event) => setSiteRecipeHtml(event.target.value)} />
            </label>
          </>
        ) : null}

        {mode === "generic_url" ? (
          <>
            <label>
              URL
              <input value={genericUrl} onChange={(event) => setGenericUrl(event.target.value)} />
            </label>
            <label>
              제목
              <input value={genericTitle} onChange={(event) => setGenericTitle(event.target.value)} />
            </label>
            <label className="full-span">
              제공 요약
              <textarea value={genericExcerpt} onChange={(event) => setGenericExcerpt(event.target.value)} />
            </label>
          </>
        ) : null}
      </div>

      <div className="button-row">
        <button className="button" type="button" disabled={running} onClick={() => void runPreview()}>
          {running ? "Preview 생성 중" : "소스 Preview"}
        </button>
        <button className="button secondary" type="button" disabled={running} onClick={() => void generateSourcePackage()}>
          {running ? "처리 중" : "로컬 패키지 생성"}
        </button>
      </div>

      <div className="notice">
        VIDEO-5는 선택한 소스를 로컬 패키지 파일로만 연결합니다. 외부 업로드, 발행, scheduler 변경, LLM 호출, secret read는 비활성입니다.
      </div>
      {error ? <div className="notice error">{error}</div> : null}

      {preview ? (
        <div className="read-block">
          <dl className="detail-grid">
            <div>
              <dt>Source type</dt>
              <dd>{preview.collection.sourceType}</dd>
            </div>
            <div>
              <dt>Source hash</dt>
              <dd>{preview.sourceBundle.sourceSnapshot.hashPrefix}</dd>
            </div>
            <div>
              <dt>Readiness</dt>
              <dd>{preview.readiness.ready ? "ready" : preview.readiness.blockingReasons.join(", ")}</dd>
            </div>
            <div>
              <dt>Counts</dt>
              <dd>
                evidence {preview.collection.evidenceCount} / visuals {preview.collection.visualCandidateCount} / script scenes{" "}
                {preview.scriptPlan.scenes.length}
              </dd>
            </div>
            <div>
              <dt>Side effects</dt>
              <dd>
                dbRead {String(preview.collection.sideEffectSummary.dbRead)} / networkRead {String(preview.collection.sideEffectSummary.networkRead)} / externalWrite{" "}
                {String(preview.collection.sideEffectSummary.externalServiceWrite)}
              </dd>
            </div>
            <div>
              <dt>Upload flags</dt>
              <dd>
                upload {String(preview.packageScaffold.uploadEnabled)} / platform {String(preview.packageScaffold.platformUploadsEnabled)}
              </dd>
            </div>
          </dl>
          {preview.readiness.warnings.length ? <div className="notice warning">Warnings: {preview.readiness.warnings.join(", ")}</div> : null}
          <label className="plan-editor">
            대본 preview
            <textarea readOnly value={preview.scriptPlan.fullScript} />
          </label>
        </div>
      ) : null}

      {sourcePackage ? (
        <div className="read-block">
          <div className="notice success">
            로컬 패키지 생성: {sourcePackage.manifest.packageSlug} / output {sourcePackage.outputDirectory ?? "preview-only"}
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Package</dt>
              <dd>{sourcePackage.manifest.version}</dd>
            </div>
            <div>
              <dt>Readiness</dt>
              <dd>{sourcePackage.manifest.readiness.canGeneratePackage ? "ready" : sourcePackage.manifest.readiness.blockingReasons.join(", ")}</dd>
            </div>
            <div>
              <dt>Package counts</dt>
              <dd>
                cards {sourcePackage.manifest.cards.length} / scenes {sourcePackage.manifest.storyboard.length} / subtitles{" "}
                {sourcePackage.manifest.subtitles.length}
              </dd>
            </div>
            <div>
              <dt>Local write</dt>
              <dd>{String(sourcePackage.manifest.sideEffectSummary.localFileWrite)}</dd>
            </div>
          </dl>
          <table>
            <thead>
              <tr>
                <th>파일</th>
                <th>종류</th>
                <th>크기</th>
              </tr>
            </thead>
            <tbody>
              {sourcePackage.files.map((file) => (
                <tr key={`${file.kind}-${file.fileName}`}>
                  <td>{file.relativePath}</td>
                  <td>{file.kind}</td>
                  <td>{file.bytes ?? "pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
