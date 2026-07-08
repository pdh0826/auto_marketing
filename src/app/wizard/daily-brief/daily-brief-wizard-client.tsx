"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { ApiResult, requestJson } from "@/lib/form-utils";
import type { DailyBriefRun } from "@/lib/daily-brief/types";

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

export function DailyBriefWizardClient() {
  const today = new Date().toISOString().slice(0, 10);
  const [marketDate, setMarketDate] = useState(today);
  const [run, setRun] = useState<DailyBriefRun | null>(null);
  const [generated, setGenerated] = useState<GenerateContentResponse | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function createRun() {
    await runAction("create", async () => {
      const response = await requestJson<ApiResult<DailyBriefRun>>("/api/daily-brief/runs", {
        method: "POST",
        body: JSON.stringify({
          marketDate,
          targetKeyword: "오늘의 투자 관심종목",
          stockPickLimit: 8,
          stockDetailLimit: 5,
          etfPickLimit: 5,
          includeEtfs: true
        })
      });
      setRun(response.data);
      setGenerated(null);
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
    </>
  );
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
