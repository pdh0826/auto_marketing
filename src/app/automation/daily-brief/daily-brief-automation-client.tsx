"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiResult, requestJson } from "@/lib/form-utils";

interface SchedulerStatus {
  config: {
    enabled: boolean;
    scheduleTime: string;
    timezone: string;
    targetKeyword: string;
    stockPickLimit: number;
    stockDetailLimit: number;
    etfPickLimit: number;
    includeEtfs: boolean;
    mode: "content_only" | "draft_save_only" | "publish_live_guarded";
  };
  state: {
    running: boolean;
    intervalMs: number;
    startedAt: string | null;
    stoppedAt: string | null;
    lastTickAt: string | null;
    lastDueCheckLocalDate: string | null;
    lastRunDate: string | null;
    lastRunId: string | null;
    lastContentItemId: string | null;
    lastResult: "idle" | "skipped" | "success" | "failed";
    lastMessage: string | null;
    lastAutomationResult: {
      status: "skipped" | "blocked" | "success" | "failed";
      stage: string;
      message: string;
      bloggerPostId: string | null;
      bloggerPostUrl: string | null;
      livePublishAttempted: boolean;
      blockingReasons: string[];
    } | null;
    inFlight: boolean;
  };
  nextActionSummary: {
    serverProcessTimerActive: boolean;
    webServerMustStayRunning: true;
    bloggerDraftSave: boolean;
    bloggerPublish: boolean;
    tokenRefresh: false;
    llmCall: false;
    livePublishRequiresEnvFlags: true;
  };
}

export function DailyBriefAutomationClient() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [form, setForm] = useState<SchedulerStatus["config"] | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const response = await requestJson<ApiResult<SchedulerStatus>>("/api/automation/daily-brief/scheduler");
    setStatus(response.data);
    setForm(response.data.config);
  }, []);

  useEffect(() => {
    void loadStatus().catch((caught) => setError(caught instanceof Error ? caught.message : "스케줄 상태를 불러오지 못했습니다."));
  }, [loadStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadStatus().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  async function saveConfig() {
    if (!form) {
      return;
    }
    await runAction("save", async () => {
      const response = await requestJson<ApiResult<SchedulerStatus>>("/api/automation/daily-brief/scheduler", {
        method: "PATCH",
        body: JSON.stringify(form)
      });
      setStatus(response.data);
      setForm(response.data.config);
      setNotice("스케줄 설정을 저장했습니다.");
    });
  }

  async function startScheduler() {
    await runAction("start", async () => {
      const response = await requestJson<ApiResult<SchedulerStatus>>("/api/automation/daily-brief/scheduler/start", {
        method: "POST",
        body: JSON.stringify({})
      });
      setStatus(response.data);
      setNotice("웹 서버 내부 스케줄러를 시작했습니다. 서버 프로세스가 켜져 있어야 동작합니다.");
    });
  }

  async function stopScheduler() {
    await runAction("stop", async () => {
      const response = await requestJson<ApiResult<SchedulerStatus>>("/api/automation/daily-brief/scheduler/stop", {
        method: "POST",
        body: JSON.stringify({})
      });
      setStatus(response.data);
      setNotice("웹 서버 내부 스케줄러를 중지했습니다.");
    });
  }

  async function runNow() {
    await runAction("run-now", async () => {
      const response = await requestJson<ApiResult<{ status: string; reason?: string; result?: { contentItemId?: string }; state: SchedulerStatus["state"] }>>(
        "/api/automation/daily-brief/scheduler/run-now",
        {
          method: "POST",
          body: JSON.stringify({})
        }
      );
      await loadStatus();
      setNotice(
        response.data.status === "success"
          ? `즉시 실행 완료: ${response.data.result?.contentItemId ?? "-"}`
          : `즉시 실행 결과: ${response.data.status}${response.data.reason ? ` / ${response.data.reason}` : ""}`
      );
    });
  }

  async function runAction(label: string, action: () => Promise<void>) {
    setRunning(label);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "요청 처리에 실패했습니다.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Daily Brief Scheduler</span>
        <h1>매일 아침 자동 생성</h1>
        <p className="muted">
          외부 cron 없이 웹 서버 프로세스가 켜져 있는 동안 매분 시간을 확인하고, 설정된 시간에 급등포착 Daily Brief 글과 이미지를 자동 생성합니다.
        </p>
        <div className="notice warning">
          기본값은 로컬 content item 생성만 수행합니다. Blogger draft save/public publish는 선택 모드와 서버 env 안전 플래그가 준비된 경우에만 단계적으로 실행됩니다.
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice success">{notice}</div> : null}

      {form && status ? (
        <>
          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>스케줄 설정</h2>
                <p className="muted">기본값은 한국 시간 매일 08:00입니다. 같은 날짜에 이미 생성된 글이 있으면 중복 생성하지 않습니다.</p>
              </div>
              <span className={`status-pill ${status.state.running ? "status-connected" : ""}`}>
                {status.state.running ? "timer running" : "timer stopped"}
              </span>
            </div>
            <form className="admin-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                Enabled
                <select value={String(form.enabled)} onChange={(event) => setForm({ ...form, enabled: event.target.value === "true" })}>
                  <option value="true">사용</option>
                  <option value="false">중지</option>
                </select>
              </label>
              <label>
                실행 시간
                <input type="time" value={form.scheduleTime} onChange={(event) => setForm({ ...form, scheduleTime: event.target.value })} />
              </label>
              <label>
                Timezone
                <input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
              </label>
              <label>
                Target Keyword
                <input value={form.targetKeyword} onChange={(event) => setForm({ ...form, targetKeyword: event.target.value })} />
              </label>
              <label>
                TOP 종목 수
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.stockPickLimit}
                  onChange={(event) => setForm({ ...form, stockPickLimit: Number(event.target.value) })}
                />
              </label>
              <label>
                상세 차트 수
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.stockDetailLimit}
                  onChange={(event) => setForm({ ...form, stockDetailLimit: Number(event.target.value) })}
                />
              </label>
              <label>
                ETF 수
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={form.etfPickLimit}
                  onChange={(event) => setForm({ ...form, etfPickLimit: Number(event.target.value) })}
                />
              </label>
              <label>
                ETF 포함
                <select value={String(form.includeEtfs)} onChange={(event) => setForm({ ...form, includeEtfs: event.target.value === "true" })}>
                  <option value="true">포함</option>
                  <option value="false">제외</option>
                </select>
              </label>
              <label>
                자동화 모드
                <select
                  value={form.mode}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      mode: event.target.value === "publish_live_guarded" ? "publish_live_guarded" : event.target.value === "draft_save_only" ? "draft_save_only" : "content_only"
                    })
                  }
                >
                  <option value="content_only">글 생성만</option>
                  <option value="draft_save_only">Blogger draft 저장까지</option>
                  <option value="publish_live_guarded">Blogger 공개발행 요청까지</option>
                </select>
              </label>
              <div className="notice warning">
                공개발행 요청 모드는 내부 guard를 통과해야 하며, 서버 env의 live publish 플래그와 확인문구가 없으면 dry-run/block 상태로 멈춥니다.
                posts.update, scheduled publish, token refresh는 실행하지 않습니다.
              </div>
              <div className="form-actions">
                <button className="button" type="button" disabled={Boolean(running)} onClick={() => void saveConfig()}>
                  {running === "save" ? "저장 중" : "설정 저장"}
                </button>
                <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void startScheduler()}>
                  {running === "start" ? "시작 중" : "스케줄러 시작"}
                </button>
                <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void stopScheduler()}>
                  {running === "stop" ? "중지 중" : "스케줄러 중지"}
                </button>
                <button className="button secondary" type="button" disabled={Boolean(running) || status.state.inFlight} onClick={() => void runNow()}>
                  {running === "run-now" || status.state.inFlight ? "실행 중" : "지금 실행"}
                </button>
              </div>
            </form>
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <h2>실행 상태</h2>
                <p className="muted">서버 프로세스 내부 timer 상태와 마지막 실행 결과입니다.</p>
              </div>
            </div>
            <div className="read-block">
              <p><strong>Timer</strong>: {status.state.running ? "running" : "stopped"} / interval {Math.round(status.state.intervalMs / 1000)}s</p>
              <p><strong>Started</strong>: {status.state.startedAt ?? "-"} / <strong>Stopped</strong>: {status.state.stoppedAt ?? "-"}</p>
              <p><strong>Last tick</strong>: {status.state.lastTickAt ?? "-"} / <strong>Last result</strong>: {status.state.lastResult}</p>
              <p><strong>Last message</strong>: {status.state.lastMessage ?? "-"}</p>
              <p><strong>Last run</strong>: {status.state.lastRunDate ?? "-"} / {status.state.lastRunId ?? "-"}</p>
              <p><strong>Content item</strong>: {status.state.lastContentItemId ?? "-"}</p>
              <p><strong>Automation mode</strong>: {status.config.mode}</p>
              {status.state.lastContentItemId ? (
                <div className="button-row">
                  <Link className="button" href={`/wizard/edit/${status.state.lastContentItemId}`}>
                    수정 마법사
                  </Link>
                  <Link className="button secondary" href={`/wizard/publish/${status.state.lastContentItemId}`}>
                    발행 준비 마법사
                  </Link>
                  <Link className="button secondary" href={`/content/${status.state.lastContentItemId}`}>
                    상세 화면
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="notice">
              Side effects: Blogger draft save {String(status.nextActionSummary.bloggerDraftSave)} / publish{" "}
              {String(status.nextActionSummary.bloggerPublish)} / token refresh {String(status.nextActionSummary.tokenRefresh)} / LLM{" "}
              {String(status.nextActionSummary.llmCall)} / live publish env guard {String(status.nextActionSummary.livePublishRequiresEnvFlags)}
            </div>
            {status.state.lastAutomationResult ? (
              <div className="read-block">
                <p><strong>Last automation</strong>: {status.state.lastAutomationResult.status} / {status.state.lastAutomationResult.stage}</p>
                <p><strong>Message</strong>: {status.state.lastAutomationResult.message}</p>
                <p><strong>Blogger post</strong>: {status.state.lastAutomationResult.bloggerPostId ?? "-"} / {status.state.lastAutomationResult.bloggerPostUrl ?? "-"}</p>
                <p><strong>Live publish attempted</strong>: {String(status.state.lastAutomationResult.livePublishAttempted)}</p>
                <p><strong>Blockers</strong>: {status.state.lastAutomationResult.blockingReasons.join(", ") || "-"}</p>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <section className="admin-section">
          <div className="notice">스케줄 설정을 불러오는 중입니다.</div>
        </section>
      )}
    </>
  );
}
