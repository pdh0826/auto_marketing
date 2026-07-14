"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { ApiResult, requestJson } from "@/lib/form-utils";
import type { DailyBriefRun } from "@/lib/daily-brief/types";
import type { DailyFuturesEditorialTrack, DailyMarketReportSession } from "@/lib/daily-brief/market-report-session";
import type {
  DailyBriefVideoCardRenderResult,
  DailyBriefVideoMp4RenderResult,
  DailyBriefVideoPackageReadbackResult,
  DailyBriefVideoPackageResult,
  DailyBriefVideoUploadMetadataResult,
  DailyBriefVideoVoiceoverRenderResult
} from "@/lib/video-automation/types";

interface GenerateContentResponse {
  run: DailyBriefRun;
  contentItemId: string;
  draftMarkdownLength: number;
  draftHtmlLength: number;
  visibleTextLength: number;
  quality: {
    ready: boolean;
    grade: "pass" | "warn" | "fail";
    scorePreview: number;
  };
  readiness?: {
    ready: boolean;
    blockingReasons: string[];
    warnings: string[];
    counts: Record<string, number>;
  };
  links: {
    editWizard: string;
    publishWizard: string;
    contentDetail: string;
  };
}

interface TistorySignalReviewResponse {
  run: DailyBriefRun;
  contentItemId: string;
  title: string;
  markdownLength: number;
  htmlLength: number;
  visibleTextLength: number;
  quality: {
    ready: boolean;
    grade: "pass" | "warn" | "fail";
    scorePreview: number;
  };
  selection: {
    mode: "stock_signal_top3_review" | "mixed_stock_etf_review" | "etf_sector_review" | "futures_options_signal_record";
    modeReason: string;
    recentSignalWindowDays: number;
    topTwentyCount: number;
    recentSignalStockCount: number;
    selectedStockCodes: string[];
    selectedEtfCodes: string[];
    selectedFuturesSymbols?: string[];
    marketReportSession?: DailyMarketReportSession;
    futuresEditorialTrack?: DailyFuturesEditorialTrack;
    warnings: string[];
  };
  captures: Array<{
    id: string;
    label: string;
    mode: string;
    width: number | null;
    height: number | null;
  }>;
  tistoryExport: {
    localPreviewUrl: string;
    project300CategoryLabel: string;
    project300Tags: string[];
    assetCount: number;
    copiedAssetCount: number;
  };
  sideEffectSummary: {
    dbWrite: true;
    contentItemCreated: true;
    contentAssetCreated: boolean;
    localFileWrite: true;
    upsignalRead: true;
    newsSearchRead: true;
    tistoryApiWrite: false;
    bloggerApiWrite: false;
    bloggerDraftSave: false;
    bloggerPublish: false;
    scheduledPublish: false;
    tokenRefresh: false;
    llmCall: false;
    llmCallLogCreated: false;
  };
  links: {
    contentDetail: string;
    editWizard: string;
    tistoryPreview: string;
  };
}

type TistoryReviewMode = TistorySignalReviewResponse["selection"]["mode"];

export function DailyBriefWizardClient() {
  const today = new Date().toISOString().slice(0, 10);
  const [marketDate, setMarketDate] = useState(today);
  const [run, setRun] = useState<DailyBriefRun | null>(null);
  const [generated, setGenerated] = useState<GenerateContentResponse | null>(null);
  const [tistoryReview, setTistoryReview] = useState<TistorySignalReviewResponse | null>(null);
  const [videoPackage, setVideoPackage] = useState<DailyBriefVideoPackageResult | null>(null);
  const [videoCardRender, setVideoCardRender] = useState<DailyBriefVideoCardRenderResult | null>(null);
  const [videoMp4Render, setVideoMp4Render] = useState<DailyBriefVideoMp4RenderResult | null>(null);
  const [videoVoiceoverRender, setVideoVoiceoverRender] = useState<DailyBriefVideoVoiceoverRenderResult | null>(null);
  const [videoUploadMetadata, setVideoUploadMetadata] = useState<DailyBriefVideoUploadMetadataResult | null>(null);
  const [videoReadback, setVideoReadback] = useState<DailyBriefVideoPackageReadbackResult | null>(null);
  const [tistoryReviewMode, setTistoryReviewMode] = useState<TistoryReviewMode>("mixed_stock_etf_review");
  const [marketReportSession, setMarketReportSession] = useState<DailyMarketReportSession>("morning");
  const [futuresEditorialTrack, setFuturesEditorialTrack] = useState<DailyFuturesEditorialTrack>("index");
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function createRun() {
    await runAction("create", async () => {
      const response = await requestJson<ApiResult<DailyBriefRun>>("/api/daily-brief/runs", {
        method: "POST",
        body: JSON.stringify({
          marketDate,
          targetKeyword: "오늘의 국내주식 관심종목",
          stockPickLimit: 8,
          stockDetailLimit: 5,
          etfPickLimit: 5,
          includeEtfs: true
        })
      });
      setRun(response.data);
      setGenerated(null);
      setTistoryReview(null);
      setVideoPackage(null);
      setVideoCardRender(null);
      setVideoMp4Render(null);
      setVideoVoiceoverRender(null);
      setVideoUploadMetadata(null);
      setVideoReadback(null);
    });
  }

  async function runStep(key: string, path: string) {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction(key, async () => {
      const response = await requestJson<ApiResult<DailyBriefRun>>(`/api/daily-brief/runs/${run.id}/${path}`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setRun(response.data);
    });
  }

  async function generateContent() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("generate", async () => {
      const response = await requestJson<ApiResult<GenerateContentResponse>>(`/api/daily-brief/runs/${run.id}/generate-content`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setRun(response.data.run);
      setGenerated(response.data);
    });
  }

  async function runAll() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("run-all", async () => {
      const response = await requestJson<ApiResult<GenerateContentResponse>>(`/api/daily-brief/runs/${run.id}/run-all`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setRun(response.data.run);
      setGenerated(response.data);
    });
  }

  async function generateTistorySignalReview() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("tistory-signal-review", async () => {
      const response = await requestJson<ApiResult<TistorySignalReviewResponse>>(`/api/daily-brief/runs/${run.id}/tistory-signal-review`, {
        method: "POST",
        body: JSON.stringify({ forceMode: tistoryReviewMode, reportSession: marketReportSession, futuresEditorialTrack })
      });
      setRun(response.data.run);
      setTistoryReview(response.data);
    });
  }

  async function previewVideoPackage() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("video-preview", async () => {
      const response = await requestJson<ApiResult<DailyBriefVideoPackageResult>>(`/api/daily-brief/runs/${run.id}/video-package`);
      setVideoPackage(response.data);
      setVideoCardRender(null);
      setVideoMp4Render(null);
      setVideoVoiceoverRender(null);
      setVideoUploadMetadata(null);
      setVideoReadback(null);
    });
  }

  async function generateVideoPackage() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("video-package", async () => {
      const response = await requestJson<ApiResult<DailyBriefVideoPackageResult>>(`/api/daily-brief/runs/${run.id}/video-package`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setVideoPackage(response.data);
      setVideoCardRender(null);
      setVideoMp4Render(null);
      setVideoVoiceoverRender(null);
      setVideoUploadMetadata(null);
      setVideoReadback(null);
    });
  }

  async function renderVideoCards() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("video-card-render", async () => {
      const response = await requestJson<ApiResult<DailyBriefVideoCardRenderResult>>(`/api/daily-brief/runs/${run.id}/video-package/render-cards`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setVideoPackage(response.data.package);
      setVideoCardRender(response.data);
      setVideoMp4Render(null);
      setVideoVoiceoverRender(null);
    });
  }

  async function renderVideoMp4() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("video-mp4-render", async () => {
      const response = await requestJson<ApiResult<DailyBriefVideoMp4RenderResult>>(`/api/daily-brief/runs/${run.id}/video-package/render-mp4`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setVideoPackage(response.data.cardRender.package);
      setVideoCardRender(response.data.cardRender);
      setVideoMp4Render(response.data);
      setVideoVoiceoverRender(null);
      setVideoUploadMetadata(null);
      setVideoReadback(null);
    });
  }

  async function renderVideoVoiceover() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("video-voiceover-render", async () => {
      const response = await requestJson<ApiResult<DailyBriefVideoVoiceoverRenderResult>>(`/api/daily-brief/runs/${run.id}/video-package/render-voiceover`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setVideoPackage(response.data.mp4Render.cardRender.package);
      setVideoCardRender(response.data.mp4Render.cardRender);
      setVideoMp4Render(response.data.mp4Render);
      setVideoVoiceoverRender(response.data);
      setVideoUploadMetadata(response.data.uploadMetadata);
      setVideoReadback(null);
    });
  }

  async function generateVideoUploadMetadata() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("video-upload-metadata", async () => {
      const response = await requestJson<ApiResult<DailyBriefVideoUploadMetadataResult>>(`/api/daily-brief/runs/${run.id}/video-package/upload-metadata`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setVideoPackage(response.data.package);
      setVideoUploadMetadata(response.data);
      setVideoVoiceoverRender(null);
      setVideoReadback(null);
    });
  }

  async function readbackVideoPackage() {
    if (!run) {
      setError("먼저 Daily Brief Run을 생성하세요.");
      return;
    }
    await runAction("video-readback", async () => {
      const response = await requestJson<ApiResult<DailyBriefVideoPackageReadbackResult>>(`/api/daily-brief/runs/${run.id}/video-package/readback`);
      setVideoPackage(response.data.package);
      setVideoReadback(response.data);
    });
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setRunning(label);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice("단계가 완료되었습니다. Blogger 저장/발행/token refresh/LLM 호출은 실행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Daily Brief 단계 실행에 실패했습니다.");
    } finally {
      setRunning(null);
    }
  }

  const videoUploadOperatorChecklist = videoUploadMetadata?.files.find((file) => file.kind === "operator_checklist_md");
  const videoReadbackManifest = videoReadback?.artifacts.find((artifact) => artifact.kind === "manifest_json");
  const videoReadbackMp4 = videoReadback?.artifacts.find((artifact) => artifact.kind === "video_mp4");
  const videoReadbackVoiceoverMp4 = videoReadback?.artifacts.find((artifact) => artifact.kind === "video_with_voiceover_mp4");
  const videoReadbackOperatorChecklist = videoReadback?.artifacts.find((artifact) => artifact.kind === "operator_checklist_md");
  const videoReadbackGuardClean = videoReadback
    ? !videoReadback.guard.operatingRepoTouched &&
      !videoReadback.guard.server3004Touched &&
      !videoReadback.guard.externalWriteRoutesEnabled &&
      !videoReadback.guard.schedulerMutationEnabled &&
      !videoReadback.guard.secretReadRequired
    : false;
  const videoReadbackHashState = videoReadback
    ? videoReadback.savedSourceHash
      ? videoReadback.stale
        ? "stale"
        : "match"
      : "saved hash missing"
    : "not checked";
  const videoOperatorReviewReady = Boolean(
    videoReadback?.exists &&
      videoReadback.stale === false &&
      videoReadback.savedSourceHash &&
      videoReadback.savedSourceHash === videoReadback.currentSourceHash &&
      videoReadbackManifest?.exists &&
      videoReadbackMp4?.exists &&
      (videoReadbackMp4.bytes ?? 0) > 0 &&
      videoReadbackOperatorChecklist?.exists &&
      videoReadbackGuardClean
  );

  return (
    <>
      <section className="card">
        <span className="badge">9G-8 Daily Brief</span>
        <h1>오늘의 투자 관심종목 자동화</h1>
        <p className="muted">
          급등포착 한국장/ETF 시그널보드와 종목 상세 차트, 최근 뉴스 검색 링크를 바탕으로 데일리 SEO 글 후보를 만듭니다.
        </p>
        <div className="notice">
          이 마법사는 read-only 수집과 로컬 content item 생성까지만 수행합니다. Blogger draft save/publish, scheduled publish, token refresh, LLM 호출은 실행하지 않습니다.
        </div>
        <div className="notice warning">
          실제 투자 조언이 아니라 정보성 콘텐츠 초안입니다. 최종 발행 전 종목명, 가격 기준, 뉴스 맥락, 투자 유의사항을 사람이 검토해야 합니다.
        </div>
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>1. 실행 생성</h2>
            <p className="muted">오늘 날짜 기준으로 Daily Brief Run을 만듭니다.</p>
          </div>
        </div>
        <form className="admin-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Market Date
            <input type="date" value={marketDate} onChange={(event) => setMarketDate(event.target.value)} />
          </label>
          <div className="form-actions">
            <button className="button" type="button" disabled={Boolean(running)} onClick={() => void createRun()}>
              {running === "create" ? "생성 중" : "Daily Brief Run 생성"}
            </button>
          </div>
        </form>
        {error ? <div className="notice error">{error}</div> : null}
        {notice ? <div className="notice success">{notice}</div> : null}
      </section>

      {run ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>2. 자동 준비</h2>
              <p className="muted">바쁘면 이 버튼 하나로 자료 수집부터 글 후보 생성까지 순서대로 실행합니다.</p>
            </div>
            <button className="button" type="button" disabled={Boolean(running) || Boolean(run.contentItemId)} onClick={() => void runAll()}>
              {running === "run-all" ? "전체 준비 중" : "전체 준비 실행"}
            </button>
          </div>
          <div className="notice">
            전체 준비 실행은 UpSignal/뉴스 read-only 조회와 로컬 content item 생성만 수행합니다. Blogger 저장/발행, token refresh, LLM 호출은 실행하지 않습니다.
          </div>
        </section>
      ) : null}

      {run ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>3. 세부 단계</h2>
              <p className="muted">필요하면 각 단계를 따로 다시 실행해 자료를 갱신할 수 있습니다.</p>
            </div>
          </div>
          <div className="card-grid">
            <StepCard
              title="한국장 시그널보드"
              buttonLabel={running === "kr" ? "수집 중" : "상위 8개 + 보드 캡처"}
              disabled={Boolean(running)}
              onClick={() => void runStep("kr", "capture-kr-board")}
            >
              종목 {run.stockPicks.length}개 / 캡처 {run.captures.filter((item) => item.kind === "kr_board").length}개
            </StepCard>
            <StepCard
              title="상위 5개 상세 차트"
              buttonLabel={running === "stock-details" ? "캡처 중" : "종목 차트 캡처"}
              disabled={Boolean(running) || run.stockPicks.length === 0}
              onClick={() => void runStep("stock-details", "capture-stock-details")}
            >
              상세 차트 캡처 {run.captures.filter((item) => item.kind === "stock_chart").length}개
            </StepCard>
            <StepCard
              title="ETF 시그널보드"
              buttonLabel={running === "etf" ? "수집 중" : "ETF TOP 5 + 캡처"}
              disabled={Boolean(running)}
              onClick={() => void runStep("etf", "capture-etf-board")}
            >
              ETF {run.etfPicks.length}개 / 캡처 {run.captures.filter((item) => item.kind === "etf_board").length}개
            </StepCard>
            <StepCard
              title="뉴스/공시 검색 후보"
              buttonLabel={running === "research" ? "수집 중" : "뉴스/공시 수집"}
              disabled={Boolean(running) || run.stockPicks.length === 0}
              onClick={() => void runStep("research", "research")}
            >
              리서치 후보 {run.researchItems.length}개
            </StepCard>
          </div>
        </section>
      ) : null}

      {run ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>4. 글 생성</h2>
              <p className="muted">수집 자료를 SEO 템플릿에 넣어 content item, draftMarkdown, draftHtml, 이미지 assets를 생성합니다.</p>
            </div>
            <button className="button" type="button" disabled={Boolean(running) || run.stockPicks.length === 0} onClick={() => void generateContent()}>
              {running === "generate" ? "생성 중" : "Daily Brief 글 생성"}
            </button>
          </div>
          <DailyBriefRunSummary run={run} />
          {generated ? (
            <div className="notice success">
              <strong>Daily Brief 글 생성 완료</strong>
              <p>
                draftMarkdown {generated.draftMarkdownLength}자 / draftHtml {generated.draftHtmlLength}자 / visible text {generated.visibleTextLength}자 / quality{" "}
                {generated.quality.grade} {generated.quality.scorePreview}점
              </p>
              {generated.readiness ? (
                <p>
                  readiness {generated.readiness.ready ? "ready" : "blocked"} / live captures{" "}
                  {generated.readiness.counts.liveCaptureCount ?? 0} / placeholder captures {generated.readiness.counts.placeholderCaptureCount ?? 0}
                </p>
              ) : null}
              <div className="button-row">
                <Link className="button" href={generated.links.editWizard}>
                  수정 마법사
                </Link>
                <Link className="button secondary" href={generated.links.publishWizard}>
                  발행 준비 마법사
                </Link>
                <Link className="button secondary" href={generated.links.contentDetail}>
                  상세 화면
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {run ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>5. 영상 자동화 패키지</h2>
              <p className="muted">Daily Brief 결과를 read-only로 재사용해 카드뉴스, 스토리보드, 자막, 커버, MP4 렌더 계획, 업로드 manifest를 만듭니다.</p>
            </div>
            <div className="button-row">
              <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void previewVideoPackage()}>
                {running === "video-preview" ? "미리보기 중" : "패키지 미리보기"}
              </button>
              <button className="button" type="button" disabled={Boolean(running)} onClick={() => void generateVideoPackage()}>
                {running === "video-package" ? "생성 중" : "로컬 패키지 생성"}
              </button>
              <button className="button" type="button" disabled={Boolean(running)} onClick={() => void renderVideoCards()}>
                {running === "video-card-render" ? "렌더 중" : "카드 PNG 렌더"}
              </button>
              <button className="button" type="button" disabled={Boolean(running)} onClick={() => void renderVideoMp4()}>
                {running === "video-mp4-render" ? "MP4 렌더 중" : "MP4 로컬 렌더"}
              </button>
              <button className="button" type="button" disabled={Boolean(running)} onClick={() => void renderVideoVoiceover()}>
                {running === "video-voiceover-render" ? "음성 렌더 중" : "무료 TTS 음성 입히기"}
              </button>
              <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void generateVideoUploadMetadata()}>
                {running === "video-upload-metadata" ? "생성 중" : "업로드 패키지"}
              </button>
              <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void readbackVideoPackage()}>
                {running === "video-readback" ? "조회 중" : "패키지 조회"}
              </button>
            </div>
          </div>
          <div className="notice">
            VIDEO-1은 Daily Brief run 파일과 기존 content item을 변경하지 않습니다. 영상 산출물은 local-data에만 쓰고, MP4 업로드와 YouTube/Instagram/TikTok 발행은 계속 차단합니다.
          </div>
          <div className={videoOperatorReviewReady ? "notice success" : "notice warning"}>
            <strong>로컬 리뷰 체크리스트: {videoOperatorReviewReady ? "ready" : "readback 필요"}</strong>
            <ul>
              <li>source hash: {videoReadback ? videoReadbackHashState : "패키지 조회 전"}</li>
              <li>stale: {videoReadback ? String(videoReadback.stale) : "패키지 조회 전"}</li>
              <li>video.mp4: {videoReadbackMp4?.exists ? `${videoReadbackMp4.bytes ?? 0} bytes` : "missing"}</li>
              <li>video-with-voiceover.mp4: {videoReadbackVoiceoverMp4?.exists ? `${videoReadbackVoiceoverMp4.bytes ?? 0} bytes` : "optional"}</li>
              <li>operator checklist: {videoReadbackOperatorChecklist?.exists ? "exists" : "missing"}</li>
              <li>guard clean: {videoReadback ? String(videoReadbackGuardClean) : "패키지 조회 전"}</li>
              <li>upload/publish: disabled</li>
            </ul>
          </div>
          {videoPackage ? (
            <div className="read-block">
              <p>
                <strong>Package</strong>: {videoPackage.manifest.uploadPackage.packageSlug} / cards {videoPackage.manifest.cards.length}개 / scenes{" "}
                {videoPackage.manifest.storyboard.length}개 / subtitles {videoPackage.manifest.subtitles.length}개
              </p>
              <p>
                <strong>Source Hash</strong>: {videoPackage.manifest.sourceSnapshot.hashPrefix} / validation{" "}
                {videoPackage.manifest.validation.ready ? "ready" : "blocked"} / checks {videoPackage.manifest.validation.checks.length}개 / duration{" "}
                {videoPackage.manifest.validation.counts.totalDurationSec}s
              </p>
              <p>
                <strong>Output</strong>: {videoPackage.outputDirectory ?? "preview-only"} / local file write{" "}
                {String(videoPackage.manifest.sideEffectSummary.localFileWrite)} / DB write {String(videoPackage.manifest.sideEffectSummary.dbWrite)} / external write{" "}
                {String(videoPackage.manifest.sideEffectSummary.externalServiceWrite)}
              </p>
              <dl className="detail-grid">
                <div>
                  <dt>Source hash</dt>
                  <dd>{videoPackage.manifest.sourceSnapshot.hash}</dd>
                </div>
                <div>
                  <dt>Upload enabled</dt>
                  <dd>{String(videoPackage.manifest.uploadPackage.platformUploadsEnabled)}</dd>
                </div>
                <div>
                  <dt>Can upload</dt>
                  <dd>{String(videoPackage.manifest.readiness.canUpload)}</dd>
                </div>
                <div>
                  <dt>Runbook</dt>
                  <dd>documents/22_VIDEO_OPERATOR_RUNBOOK.md</dd>
                </div>
              </dl>
              {videoPackage.manifest.validation.errors.length ? (
                <div className="notice error">Validation errors: {videoPackage.manifest.validation.errors.join(", ")}</div>
              ) : null}
              {videoPackage.manifest.readiness.blockingReasons.length ? (
                <div className="notice warning">Blockers: {videoPackage.manifest.readiness.blockingReasons.join(", ")}</div>
              ) : null}
              {videoPackage.manifest.readiness.warnings.length ? (
                <div className="notice warning">Warnings: {videoPackage.manifest.readiness.warnings.join(", ")}</div>
              ) : null}
              <table>
                <thead>
                  <tr>
                    <th>파일</th>
                    <th>종류</th>
                    <th>크기</th>
                  </tr>
                </thead>
                <tbody>
                  {videoPackage.files.map((file) => (
                    <tr key={file.kind}>
                      <td>{file.relativePath}</td>
                      <td>{file.kind}</td>
                      <td>{file.bytes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {videoCardRender ? (
            <div className={videoCardRender.report.validation.ready ? "notice success" : "notice warning"}>
              <strong>카드 PNG 렌더 {videoCardRender.report.status}</strong>
              <p>
                source {videoCardRender.report.sourceHashPrefix} / images {videoCardRender.report.validation.renderedImageCount}개 / expected cards{" "}
                {videoCardRender.report.validation.expectedCardCount}개 / local file write {String(videoCardRender.report.sideEffectSummary.localFileWrite)}
              </p>
              {videoCardRender.report.validation.errors.length ? <p>Errors: {videoCardRender.report.validation.errors.join(", ")}</p> : null}
              {videoCardRender.report.validation.warnings.length ? <p>Warnings: {videoCardRender.report.validation.warnings.join(", ")}</p> : null}
              <table>
                <thead>
                  <tr>
                    <th>PNG</th>
                    <th>크기</th>
                    <th>bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {videoCardRender.report.images.map((image) => (
                    <tr key={`${image.kind}-${image.cardId}`}>
                      <td>{image.relativePath}</td>
                      <td>{image.width}x{image.height}</td>
                      <td>{image.bytes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {videoMp4Render ? (
            <div className={videoMp4Render.report.validation.ready ? "notice success" : "notice warning"}>
              <strong>MP4 로컬 렌더 {videoMp4Render.report.status}</strong>
              <p>
                source {videoMp4Render.report.sourceHashPrefix} / images {videoMp4Render.report.validation.inputImageCount}개 / duration{" "}
                {videoMp4Render.report.validation.durationSec}s / output bytes {videoMp4Render.report.validation.outputBytes ?? "-"}
              </p>
              <p>
                ffmpeg exit {videoMp4Render.report.command?.exitCode ?? "-"} / audio {String(videoMp4Render.report.renderer.audioIncluded)} / external upload{" "}
                {String(videoMp4Render.report.renderer.externalUploadEnabled)}
              </p>
              {videoMp4Render.report.validation.errors.length ? <p>Errors: {videoMp4Render.report.validation.errors.join(", ")}</p> : null}
              {videoMp4Render.report.validation.warnings.length ? <p>Warnings: {videoMp4Render.report.validation.warnings.join(", ")}</p> : null}
              <table>
                <thead>
                  <tr>
                    <th>파일</th>
                    <th>종류</th>
                    <th>bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {videoMp4Render.report.files.map((file) => (
                    <tr key={`${file.kind}-${file.fileName}`}>
                      <td>{file.relativePath}</td>
                      <td>{file.kind}</td>
                      <td>{file.bytes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {videoVoiceoverRender ? (
            <div className={videoVoiceoverRender.report.validation.ready ? "notice success" : "notice warning"}>
              <strong>무료 로컬 TTS 음성 렌더 {videoVoiceoverRender.report.status}</strong>
              <p>
                provider {videoVoiceoverRender.report.provider.name ?? "not available"} / subscription{" "}
                {String(videoVoiceoverRender.report.provider.subscriptionRequired)} / external provider{" "}
                {String(videoVoiceoverRender.report.provider.externalProvider)}
              </p>
              <p>
                script {videoVoiceoverRender.report.script.characterCount}자 / audio bytes {videoVoiceoverRender.report.validation.audioBytes ?? "-"} / voiced MP4 bytes{" "}
                {videoVoiceoverRender.report.validation.outputBytes ?? "-"} / upload metadata {String(videoVoiceoverRender.report.validation.uploadMetadataPrepared)}
              </p>
              {videoVoiceoverRender.report.validation.errors.length ? <p>Errors: {videoVoiceoverRender.report.validation.errors.join(", ")}</p> : null}
              {videoVoiceoverRender.report.validation.warnings.length ? <p>Warnings: {videoVoiceoverRender.report.validation.warnings.join(", ")}</p> : null}
              <table>
                <thead>
                  <tr>
                    <th>파일</th>
                    <th>종류</th>
                    <th>bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {videoVoiceoverRender.report.files.map((file) => (
                    <tr key={`${file.kind}-${file.fileName}`}>
                      <td>{file.relativePath}</td>
                      <td>{file.kind}</td>
                      <td>{file.bytes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {videoUploadMetadata ? (
            <div className="notice success">
              <strong>업로드 패키지 metadata 생성</strong>
              <p>
                source {videoUploadMetadata.metadata.sourceHashPrefix} / upload enabled {String(videoUploadMetadata.metadata.uploadEnabled)} / manual review{" "}
                {String(videoUploadMetadata.metadata.manualReviewRequired)}
              </p>
              <p>
                operator checklist {videoUploadOperatorChecklist?.relativePath ?? "-"} / bytes {videoUploadOperatorChecklist?.bytes ?? "-"}
              </p>
              <p>Blocked: {videoUploadMetadata.metadata.blockedReasons.join(", ")}</p>
              <table>
                <thead>
                  <tr>
                    <th>파일</th>
                    <th>종류</th>
                    <th>bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {videoUploadMetadata.files.filter((file) => file.kind.startsWith("upload_") || file.kind === "operator_checklist_md").map((file) => (
                    <tr key={`${file.kind}-${file.fileName}`}>
                      <td>{file.relativePath}</td>
                      <td>{file.kind}</td>
                      <td>{file.bytes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {videoReadback ? (
            <div className={videoReadback.stale ? "notice warning" : "notice success"}>
              <strong>영상 패키지 조회</strong>
              <p>
                exists {String(videoReadback.exists)} / stale {String(videoReadback.stale)} / current {videoReadback.currentSourceHash.slice(0, 12)} / saved{" "}
                {videoReadback.savedSourceHash?.slice(0, 12) ?? "-"}
              </p>
              <div className={videoOperatorReviewReady ? "notice success" : "notice warning"}>
                <strong>로컬 MP4 리뷰 게이트: {videoOperatorReviewReady ? "ready" : "blocked"}</strong>
                <p>
                  hash {videoReadbackHashState} / mp4 {videoReadbackMp4?.exists ? `${videoReadbackMp4.bytes ?? 0} bytes` : "missing"} / checklist{" "}
                  {videoReadbackOperatorChecklist?.exists ? "exists" : "missing"} / guards clean {String(videoReadbackGuardClean)}
                </p>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>Current hash</dt>
                  <dd>{videoReadback.currentSourceHash}</dd>
                </div>
                <div>
                  <dt>Saved hash</dt>
                  <dd>{videoReadback.savedSourceHash ?? "-"}</dd>
                </div>
                <div>
                  <dt>Manifest</dt>
                  <dd>{videoReadbackManifest?.exists ? `${videoReadbackManifest.bytes ?? 0} bytes` : "missing"}</dd>
                </div>
                <div>
                  <dt>Operator checklist</dt>
                  <dd>{videoReadbackOperatorChecklist?.exists ? videoReadbackOperatorChecklist.relativePath : "missing"}</dd>
                </div>
              </dl>
              <p>
                guards: external write {String(videoReadback.guard.externalWriteRoutesEnabled)}, scheduler mutation{" "}
                {String(videoReadback.guard.schedulerMutationEnabled)}, secret read {String(videoReadback.guard.secretReadRequired)}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Artifact</th>
                    <th>exists</th>
                    <th>bytes</th>
                  </tr>
                </thead>
                <tbody>
                  {videoReadback.artifacts.map((artifact) => (
                    <tr key={`${artifact.kind}-${artifact.fileName}`}>
                      <td>{artifact.relativePath}</td>
                      <td>{String(artifact.exists)}</td>
                      <td>{artifact.bytes ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {run ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>6. 티스토리 신호 리뷰</h2>
              <p className="muted">
                Blogger Daily Brief와 다른 글로, TOP 20 중 최근 신호 종목을 골라 사람 말투의 집중 리뷰를 만듭니다. 오늘의 관심종목과 이미 사용한 종목/ETF는 다음 카테고리 후보에서 제외합니다.
              </p>
            </div>
            <button className="button" type="button" disabled={Boolean(running) || Boolean(run.tistoryReviewOutputs?.[tistoryOutputKey(tistoryReviewMode, marketReportSession, futuresEditorialTrack)])} onClick={() => void generateTistorySignalReview()}>
              {running === "tistory-signal-review" ? "리뷰 생성 중" : run.tistoryReviewOutputs?.[tistoryOutputKey(tistoryReviewMode, marketReportSession, futuresEditorialTrack)] ? "선택 리포트 생성됨" : "선택 리포트 생성"}
            </button>
          </div>
          <label className="form-field">
            <span>생성할 Project300 카테고리</span>
            <select value={tistoryReviewMode} onChange={(event) => setTistoryReviewMode(event.target.value as TistoryReviewMode)}>
              <option value="mixed_stock_etf_review">오늘의 관심종목 리뷰</option>
              <option value="stock_signal_top3_review">종목별 신호 집중분석</option>
              <option value="etf_sector_review">ETF 섹터 흐름 리뷰</option>
              <option value="futures_options_signal_record">선물·옵션 시그널 기록</option>
            </select>
          </label>
          {tistoryReviewMode === "futures_options_signal_record" ? (
            <>
              <label className="form-field">
                <span>선물 글 묶음</span>
                <select value={futuresEditorialTrack} onChange={(event) => setFuturesEditorialTrack(event.target.value as DailyFuturesEditorialTrack)}>
                  <option value="index">선물·옵션 시그널 기록 (나스닥·S&amp;P500·코스피200)</option>
                  <option value="macro">금·오일·유로달러 시그널 기록</option>
                </select>
              </label>
              <label className="form-field">
                <span>시장 리포트 시간대</span>
                <select value={marketReportSession} onChange={(event) => setMarketReportSession(event.target.value as DailyMarketReportSession)}>
                  <option value="morning">오늘 아침 (지수 08:00 / 금·오일·유로 07:00)</option>
                  <option value="us_preopen">미국장 시작 전 (지수 22:00 / 금·오일·유로 21:00)</option>
                </select>
              </label>
            </>
          ) : null}
          <div className="notice">
            선물 리포트는 시간대에 따라 종목과 시간봉 우선순위가 달라집니다. 한국장 장중/마감 리포트는 검증된 외국인 현물·선물·옵션 수급 API가 준비되지 않으면 생성 전에 차단합니다.
          </div>
          {run.tistoryReviewOutputs && Object.keys(run.tistoryReviewOutputs).length ? (
            <div className="read-block">
              <h3>카테고리별 생성 결과</h3>
              {Object.values(run.tistoryReviewOutputs).map((output) => output ? (
                <div className="notice success" key={output.mode}>
                  <strong>{formatTistoryMode(output.mode)}</strong> / <Link href={output.previewUrl}>미리보기</Link> / <Link href={`/content/${output.contentItemId}`}>상세 화면</Link>
                  <p className="muted">
                    종목 {output.selectedStockCodes?.join(", ") || "-"} / ETF {output.selectedEtfCodes?.join(", ") || "-"} / 선물 {output.selectedFuturesSymbols?.join(", ") || "-"} / 묶음 {output.futuresEditorialTrack ?? "-"} / 시간대 {output.marketReportSession ?? "-"}
                  </p>
                </div>
              ) : null)}
            </div>
          ) : null}
          {run.tistoryReviewContentItemId && !tistoryReview ? (
            <div className="notice success">
              <strong>티스토리 신호 리뷰가 이미 생성되어 있습니다.</strong>
              <p>
                mode {run.tistoryReviewMode ?? "-"} / preview {run.tistoryReviewExportUrl ?? "-"}
              </p>
              <div className="button-row">
                <Link className="button" href={`/content/${run.tistoryReviewContentItemId}`}>
                  상세 화면
                </Link>
                <Link className="button secondary" href={`/wizard/edit/${run.tistoryReviewContentItemId}`}>
                  수정 마법사
                </Link>
                {run.tistoryReviewExportUrl ? (
                  <Link className="button secondary" href={run.tistoryReviewExportUrl}>
                    티스토리 HTML 미리보기
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
          {tistoryReview ? (
            <div className="notice success">
              <strong>티스토리 신호 리뷰 생성 완료</strong>
              <p>{tistoryReview.title}</p>
              <p>
                mode {formatTistoryMode(tistoryReview.selection.mode)} / 최근 신호 종목 {tistoryReview.selection.recentSignalStockCount}개 / visible text{" "}
                {tistoryReview.visibleTextLength}자 / quality {tistoryReview.quality.grade} {tistoryReview.quality.scorePreview}점
              </p>
              <p>
                선택 종목 {tistoryReview.selection.selectedStockCodes.join(", ") || "-"} / 선택 ETF{" "}
                {tistoryReview.selection.selectedEtfCodes.join(", ") || "-"}
              </p>
              <p>
                export assets {tistoryReview.tistoryExport.copiedAssetCount}/{tistoryReview.tistoryExport.assetCount} / side effects: Tistory API{" "}
                {String(tistoryReview.sideEffectSummary.tistoryApiWrite)}, Blogger publish {String(tistoryReview.sideEffectSummary.bloggerPublish)}, LLM{" "}
                {String(tistoryReview.sideEffectSummary.llmCall)}
              </p>
              <p>
                project300 추천 카테고리: {tistoryReview.tistoryExport.project300CategoryLabel} / 태그{" "}
                {tistoryReview.tistoryExport.project300Tags.join(", ")}
              </p>
              {tistoryReview.selection.warnings.length ? <p>Warnings: {tistoryReview.selection.warnings.join(", ")}</p> : null}
              <div className="button-row">
                <Link className="button" href={tistoryReview.links.tistoryPreview}>
                  티스토리 HTML 미리보기
                </Link>
                <Link className="button secondary" href={tistoryReview.links.editWizard}>
                  수정 마법사
                </Link>
                <Link className="button secondary" href={tistoryReview.links.contentDetail}>
                  상세 화면
                </Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function tistoryOutputKey(mode: TistoryReviewMode, session: DailyMarketReportSession, track: DailyFuturesEditorialTrack) {
  return mode === "futures_options_signal_record" ? `${mode}:${track}:${session}` : mode;
}

function formatTistoryMode(mode: TistorySignalReviewResponse["selection"]["mode"]) {
  if (mode === "stock_signal_top3_review") {
    return "최근 신호 TOP3 집중 리뷰";
  }
  if (mode === "mixed_stock_etf_review") {
    return "종목 신호 + ETF 보강 리뷰";
  }
  if (mode === "futures_options_signal_record") {
    return "선물·옵션 시그널 기록";
  }
  return "ETF/섹터 리뷰";
}

function StepCard({
  title,
  buttonLabel,
  disabled,
  onClick,
  children
}: {
  title: string;
  buttonLabel: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      <button className="button secondary" type="button" disabled={disabled} onClick={onClick}>
        {buttonLabel}
      </button>
    </div>
  );
}

function DailyBriefRunSummary({ run }: { run: DailyBriefRun }) {
  const captureModes = Array.from(new Set(run.captures.map((capture) => capture.mode)));
  const liveCaptureCount = run.captures.filter((capture) => capture.mode === "live_screenshot").length;
  const placeholderCaptureCount = run.captures.filter((capture) => capture.mode === "placeholder").length;
  return (
    <div className="read-block">
      <p><strong>Run</strong>: {run.id} / {run.status}</p>
      <p><strong>종목</strong>: {run.stockPicks.length}개 / <strong>ETF</strong>: {run.etfPicks.length}개 / <strong>뉴스 후보</strong>: {run.researchItems.length}개</p>
      <p><strong>캡처</strong>: {run.captures.length}개 / live {liveCaptureCount}개 / placeholder {placeholderCaptureCount}개 / mode {captureModes.join(", ") || "-"}</p>
      {run.warnings.length ? <div className="notice warning">Warnings: {run.warnings.join(", ")}</div> : null}
      {run.captures.length ? (
        <table>
          <thead>
            <tr>
              <th>캡처</th>
              <th>모드</th>
              <th>셀렉터</th>
              <th>크기</th>
            </tr>
          </thead>
          <tbody>
            {run.captures.map((capture) => (
              <tr key={capture.id}>
                <td>{capture.label}</td>
                <td>{capture.mode}</td>
                <td>{capture.selectorUsed ?? "-"}</td>
                <td>{capture.width && capture.height ? `${capture.width}x${capture.height}` : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {run.stockPicks.length ? (
        <table>
          <thead>
            <tr>
              <th>순위</th>
              <th>종목</th>
              <th>코드</th>
              <th>현재가</th>
              <th>진입가</th>
              <th>목표가</th>
              <th>점수</th>
            </tr>
          </thead>
          <tbody>
            {run.stockPicks.map((pick) => (
              <tr key={pick.code}>
                <td>{pick.rank}</td>
                <td>{pick.name}</td>
                <td>{pick.code}</td>
                <td>{pick.currentPrice ?? "-"}</td>
                <td>{pick.entryPrice ?? "-"}</td>
                <td>{pick.targetPrice ?? "-"}</td>
                <td>{pick.totalScore ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
