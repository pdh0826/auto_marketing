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

interface PublicationScheduleStatus {
  timezone: "Asia/Seoul";
  businessDaysOnly: true;
  registrationComplete: boolean;
  automaticBulkPublishEnabled: false;
  activeSlotCount: number;
  registeredSlotCount: number;
  slots: Array<{
    id: string;
    channel: "blogger" | "tistory";
    label: string;
    category: string;
    time: string;
    registered: true;
    generationWired: boolean;
    executionMode: "automatic_live_guarded" | "approved_content_queue" | "registered_blocked";
    active: boolean;
    blockers: string[];
  }>;
  scheduler: {
    config: {
      enabled: boolean;
      tistoryRecurringPublishApproved: boolean;
      retryDelayMinutes: number;
      maxAttempts: number;
      autoRecoveryEnabled: boolean;
      recoveryGraceMinutes: number;
      recoveryWindowMinutes: number;
      recoveryMaxAttempts: number;
      recoveryCooldownMinutes: number;
    };
    state: {
      running: boolean;
      inFlight: boolean;
      lastTickAt: string | null;
      lastResult: string | null;
      lastMessage: string | null;
      entries: Record<string, {
        slotId: string;
        marketDate: string;
        status: "pending" | "processing" | "success" | "blocked" | "failed" | "delegated";
        attempts: number;
        contentItemId: string | null;
        publicUrl: string | null;
        lastMessage: string | null;
        nextRetryAt: string | null;
        executionSource?: "scheduled" | "retry" | "recovery";
        recoveryAttempts?: number;
        lastRecoveryReason?: string | null;
        recoveredAt?: string | null;
      }>;
      lastRecoveryAt: string | null;
      lastRecoveryResult: string | null;
    };
  };
}

export function DailyBriefAutomationClient() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [publicationSchedule, setPublicationSchedule] = useState<PublicationScheduleStatus | null>(null);
  const [form, setForm] = useState<SchedulerStatus["config"] | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const [schedulerResponse, publicationResponse] = await Promise.all([
      requestJson<ApiResult<SchedulerStatus>>("/api/automation/daily-brief/scheduler"),
      requestJson<ApiResult<PublicationScheduleStatus>>("/api/automation/publication-schedule")
    ]);
    setStatus(schedulerResponse.data);
    setForm(schedulerResponse.data.config);
    setPublicationSchedule(publicationResponse.data);
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

  async function updatePublicationConfig(patch: Record<string, unknown>, message: string) {
    await runAction("publication-config", async () => {
      const response = await requestJson<ApiResult<PublicationScheduleStatus>>("/api/automation/publication-schedule", {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      setPublicationSchedule(response.data);
      setNotice(message);
    });
  }

  async function retryPublicationSlot(slotId: string) {
    if (!window.confirm("이 슬롯의 생성·검수·guarded 발행을 지금 다시 시도합니다. 준비 조건을 모두 통과하면 외부 채널에 글 1건이 발행될 수 있습니다. 계속할까요?")) return;
    await runAction(`retry-${slotId}`, async () => {
      const response = await requestJson<ApiResult<{ status: string; results?: Array<{ status: string; reason?: string }> }>>("/api/automation/publication-schedule/run-now", {
        method: "POST",
        body: JSON.stringify({ slotId, dryRun: false, confirmation: "I_APPROVE_THIS_SCHEDULED_SLOT_EXECUTION" })
      });
      await loadStatus();
      setNotice(`슬롯 재시도 결과: ${response.data.results?.[0]?.status ?? response.data.status}${response.data.results?.[0]?.reason ? ` / ${response.data.results[0].reason}` : ""}`);
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
                <h2>전체 채널 발행 편성표</h2>
                <p className="muted">
                  평일, 한국 시간 기준입니다. 등록과 실제 자동 실행은 구분되며 준비되지 않은 슬롯은 차단 사유를 표시합니다.
                </p>
              </div>
              <span className="status-pill">
                {publicationSchedule
                  ? `${publicationSchedule.activeSlotCount}/${publicationSchedule.registeredSlotCount} active`
                  : "loading"}
              </span>
            </div>
            {publicationSchedule ? (
              <div className="card-grid">
                {publicationSchedule.slots.map((slot) => (
                  <article className="card" key={slot.id}>
                    <div className="button-row">
                      <span className="badge">{slot.channel === "blogger" ? "Blogger" : "Tistory"}</span>
                      <span className={`status-pill ${slot.active ? "status-connected" : ""}`}>
                        {slot.active ? "자동 실행" : slot.registered ? "편성 등록" : "미등록"}
                      </span>
                    </div>
                    <h3>{slot.time} · {slot.label}</h3>
                    <p className="muted">{slot.category} / {slot.executionMode}</p>
                    <p><strong>생성 연결</strong>: {slot.generationWired ? "완료" : "미완료"}</p>
                    {latestPublicationEntry(publicationSchedule, slot.id) ? (
                      <div className="read-block">
                        <p><strong>최근 실행</strong>: {latestPublicationEntry(publicationSchedule, slot.id)?.status}</p>
                        <p><strong>시도</strong>: {latestPublicationEntry(publicationSchedule, slot.id)?.attempts}회</p>
                        <p><strong>실행 경로</strong>: {latestPublicationEntry(publicationSchedule, slot.id)?.executionSource ?? "scheduled"}</p>
                        <p><strong>자동 복구</strong>: {latestPublicationEntry(publicationSchedule, slot.id)?.recoveryAttempts ?? 0}회{latestPublicationEntry(publicationSchedule, slot.id)?.recoveredAt ? ` / 완료 ${latestPublicationEntry(publicationSchedule, slot.id)?.recoveredAt}` : ""}</p>
                        <p><strong>메시지</strong>: {latestPublicationEntry(publicationSchedule, slot.id)?.lastMessage ?? "-"}</p>
                        {latestPublicationEntry(publicationSchedule, slot.id)?.publicUrl ? (
                          <a href={latestPublicationEntry(publicationSchedule, slot.id)?.publicUrl ?? "#"} target="_blank" rel="noreferrer">발행 글 보기</a>
                        ) : null}
                        {latestPublicationEntry(publicationSchedule, slot.id)?.status === "blocked" || latestPublicationEntry(publicationSchedule, slot.id)?.status === "failed" ? (
                          <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void retryPublicationSlot(slot.id)}>
                            {running === `retry-${slot.id}` ? "재시도 중" : "이 슬롯만 재시도"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {slot.blockers.length ? (
                      <div className="notice warning">{slot.blockers.map(formatScheduleBlocker).join(" · ")}</div>
                    ) : (
                      <div className="notice success">현재 스케줄러와 발행 guard에 연결되어 있습니다.</div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="notice">전체 편성표를 불러오는 중입니다.</div>
            )}
            <div className="notice warning">
              날짜+슬롯 단위 중복 방지가 적용됩니다. 성공 슬롯은 자동 복구가 절대 재발행하지 않습니다. 누락·캡처·편집기 검수 같은 안전한 오류만 유예 시간 뒤 재실행하고, 로그인·OAuth는 우회하지 않고 알림을 보냅니다.
            </div>
            {publicationSchedule ? (
              <>
                <div className="button-row">
                  <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void updatePublicationConfig({ enabled: !publicationSchedule.scheduler.config.enabled }, publicationSchedule.scheduler.config.enabled ? "전체 채널 스케줄러를 중지했습니다." : "전체 채널 스케줄러를 시작했습니다.") }>
                    {publicationSchedule.scheduler.config.enabled ? "전체 채널 스케줄 중지" : "전체 채널 스케줄 시작"}
                  </button>
                  <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void updatePublicationConfig({ tistoryRecurringPublishApproved: !publicationSchedule.scheduler.config.tistoryRecurringPublishApproved }, publicationSchedule.scheduler.config.tistoryRecurringPublishApproved ? "Tistory guarded 자동 발행 승인을 해제했습니다." : "Tistory guarded 자동 발행을 승인했습니다.") }>
                    {publicationSchedule.scheduler.config.tistoryRecurringPublishApproved ? "Tistory 자동 발행 승인 해제" : "Tistory 자동 발행 승인"}
                  </button>
                  <button className="button secondary" type="button" disabled={Boolean(running)} onClick={() => void updatePublicationConfig({ autoRecoveryEnabled: !publicationSchedule.scheduler.config.autoRecoveryEnabled }, publicationSchedule.scheduler.config.autoRecoveryEnabled ? "자동 점검·복구를 중지했습니다." : "자동 점검·복구를 시작했습니다.") }>
                    {publicationSchedule.scheduler.config.autoRecoveryEnabled ? "자동 점검·복구 중지" : "자동 점검·복구 시작"}
                  </button>
                </div>
                <p className="muted">
                  실행기 {publicationSchedule.scheduler.state.running ? "running" : "stopped"} / 마지막 tick {publicationSchedule.scheduler.state.lastTickAt ?? "-"} / 기본 재시도 {publicationSchedule.scheduler.config.retryDelayMinutes}분 간격, 최대 {publicationSchedule.scheduler.config.maxAttempts}회
                </p>
                <p className="muted">
                  자동 복구 {publicationSchedule.scheduler.config.autoRecoveryEnabled ? "사용" : "중지"} / {publicationSchedule.scheduler.config.recoveryGraceMinutes}분 유예 / {publicationSchedule.scheduler.config.recoveryWindowMinutes}분 내 점검 / 총 {publicationSchedule.scheduler.config.recoveryMaxAttempts}회까지 / 복구 간격 {publicationSchedule.scheduler.config.recoveryCooldownMinutes}분
                </p>
                <p className="muted">
                  마지막 자동 복구 {publicationSchedule.scheduler.state.lastRecoveryAt ?? "-"} / {publicationSchedule.scheduler.state.lastRecoveryResult ?? "-"}
                </p>
              </>
            ) : null}
          </section>

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

function formatScheduleBlocker(value: string) {
  const labels: Record<string, string> = {
    blogger_etf_generation_not_wired: "Blogger ETF 생성 연결 필요",
    blogger_market_generation_not_wired: "Blogger 시황 생성 연결 필요",
    multi_schedule_execution_not_implemented: "다중 슬롯 실행 엔진 연결 필요",
    korea_foreign_flow_source_not_configured: "한국장 외국인 수급 선택 데이터 미설정",
    blogger_scheduler_disabled: "Blogger 스케줄러 중지",
    blogger_schedule_time_mismatch: "Blogger 실행 시각 불일치",
    blogger_live_guarded_mode_disabled: "Blogger guarded live 모드 꺼짐",
    tistory_scheduler_disabled: "Tistory 스케줄러 중지",
    tistory_live_publish_disabled: "Tistory 공개 발행 차단",
    per_content_publish_approval_required: "글별 공개 발행 승인 필요",
    recurring_generation_to_queue_not_implemented: "반복 생성→승인 큐 연결 필요"
    ,publication_scheduler_disabled: "전체 채널 실행기 중지"
    ,tistory_recurring_publish_approval_required: "Tistory 반복 발행 승인 필요"
  };
  return labels[value] ?? value;
}

function latestPublicationEntry(schedule: PublicationScheduleStatus, slotId: string) {
  return Object.values(schedule.scheduler.state.entries)
    .filter((entry) => entry.slotId === slotId)
    .sort((left, right) => right.marketDate.localeCompare(left.marketDate))[0] ?? null;
}
