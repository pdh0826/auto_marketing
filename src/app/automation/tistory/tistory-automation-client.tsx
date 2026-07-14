"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiResult, requestJson } from "@/lib/form-utils";

interface QueueEntry {
  id: string;
  contentItemId: string;
  title: string;
  dueAt: string;
  status: "pending" | "processing" | "success" | "blocked" | "failed";
  attempts: number;
  publicUrl: string | null;
  lastMessage: string | null;
  approvalSource?: "per_content" | "recurring_schedule";
}

interface Status {
  config: { enabled: boolean; timezone: string; livePublishEnabled: boolean; headless: boolean; sessionKeepAliveEnabled: boolean; sessionKeepAliveIntervalMinutes: number };
  state: { running: boolean; inFlight: boolean; lastTickAt: string | null; lastResult: string | null; lastMessage: string | null; lastSessionCheckAt: string | null; nextSessionCheckAt: string | null; sessionStatus: "unknown" | "ready" | "login_required" | "error"; lastSessionMessage: string | null };
  queue: QueueEntry[];
}

export function TistoryAutomationClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [contentItemId, setContentItemId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await requestJson<ApiResult<Status>>("/api/automation/tistory");
    setStatus(response.data);
  }, []);

  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : "상태 조회 실패")); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => void load().catch(() => undefined), 15000); return () => window.clearInterval(timer); }, [load]);

  async function action(key: string, task: () => Promise<void>) {
    setBusy(key); setError(null); setNotice(null);
    try { await task(); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "요청 실패"); } finally { setBusy(null); }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Tistory publisher</span>
        <h1>티스토리 자동 발행</h1>
        <p className="muted">전용 브라우저 프로필의 로그인 세션을 주기적으로 확인하고, export HTML을 검증한 뒤 예약 글을 guarded 자동 발행합니다. 세션 확인 작업은 글을 저장하거나 발행하지 않습니다.</p>
        {notice ? <div className="notice success">{notice}</div> : null}
        {error ? <div className="notice error">{error}</div> : null}
      </section>

      {status ? (
        <>
          <section className="admin-section">
            <div className="section-heading"><div><h2>실행 설정</h2><p className="muted">3004 서버가 실행 중일 때 1분마다 발행 큐를 확인합니다.</p></div></div>
            <div className="form-grid">
              <label>스케줄러<select value={String(status.config.enabled)} onChange={(event) => setStatus({ ...status, config: { ...status.config, enabled: event.target.value === "true" } })}><option value="true">사용</option><option value="false">중지</option></select></label>
              <label>공개 발행<select value={String(status.config.livePublishEnabled)} onChange={(event) => setStatus({ ...status, config: { ...status.config, livePublishEnabled: event.target.value === "true" } })}><option value="false">차단</option><option value="true">Guarded 자동 발행</option></select></label>
              <label>브라우저<select value={String(status.config.headless)} onChange={(event) => setStatus({ ...status, config: { ...status.config, headless: event.target.value === "true" } })}><option value="false">화면 표시</option><option value="true">백그라운드</option></select></label>
              <label>로그인 세션 유지<select value={String(status.config.sessionKeepAliveEnabled)} onChange={(event) => setStatus({ ...status, config: { ...status.config, sessionKeepAliveEnabled: event.target.value === "true" } })}><option value="true">사용</option><option value="false">중지</option></select></label>
              <label>세션 확인 주기(분)<input type="number" min={10} max={240} value={status.config.sessionKeepAliveIntervalMinutes} onChange={(event) => setStatus({ ...status, config: { ...status.config, sessionKeepAliveIntervalMinutes: Number(event.target.value) } })} /></label>
            </div>
            <div className="form-actions">
              <button className="button" disabled={Boolean(busy)} onClick={() => void action("save", async () => { await requestJson("/api/automation/tistory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(status.config) }); setNotice("설정을 저장했습니다."); })}>설정 저장</button>
              <button className="button secondary" disabled={Boolean(busy) || !contentItemId} onClick={() => void action("login", async () => { await requestJson("/api/automation/tistory/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentItemId }) }); setNotice("전용 티스토리 로그인 창을 열었습니다."); })}>로그인 창 열기</button>
            </div>
          </section>

          <section className="admin-section">
            <div className="section-heading"><div><h2>발행 큐 등록</h2><p className="muted">Tistory HTML Export가 완료된 content item만 등록할 수 있습니다.</p></div></div>
            <div className="form-grid">
              <label>Content item ID<input value={contentItemId} onChange={(event) => setContentItemId(event.target.value)} placeholder="cmr..." /></label>
              <label>발행 시각<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
              <label className="checkbox-label"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />이 글 1건의 티스토리 공개 발행 승인</label>
            </div>
            <button className="button" disabled={Boolean(busy) || !contentItemId || !dueAt || !approved} onClick={() => void action("enqueue", async () => { await requestJson("/api/automation/tistory/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentItemId, dueAt: new Date(dueAt).toISOString(), approved }) }); setNotice("발행 큐에 등록했습니다."); })}>승인 후 큐 등록</button>
          </section>

          <section className="admin-section">
            <div className="section-heading"><div><h2>상태와 대기 목록</h2><p className="muted">Timer {status.state.running ? "running" : "stopped"} / {status.state.lastMessage ?? "-"}</p></div></div>
            <div className={`notice ${status.state.sessionStatus === "ready" ? "success" : status.state.sessionStatus === "login_required" ? "error" : ""}`}>
              전용 로그인 세션: {status.state.sessionStatus} / 최근 확인 {status.state.lastSessionCheckAt ? new Date(status.state.lastSessionCheckAt).toLocaleString() : "-"} / 다음 확인 {status.state.nextSessionCheckAt ? new Date(status.state.nextSessionCheckAt).toLocaleString() : "-"}
            </div>
            <div className="card-grid">
              {status.queue.length ? status.queue.map((entry) => (
                <div className="card" key={entry.id}>
                  <span className="badge">{entry.status}</span>
                  <h3>{entry.title}</h3>
                  <p className="muted">{entry.contentItemId}<br />{new Date(entry.dueAt).toLocaleString()} / attempts {entry.attempts} / 승인 {entry.approvalSource === "recurring_schedule" ? "반복 스케줄" : "글별"}</p>
                  <p>{entry.lastMessage ?? "대기 중"}</p>
                  {entry.publicUrl ? <a className="button secondary" href={entry.publicUrl} target="_blank" rel="noreferrer">공개 글</a> : null}
                  {entry.status === "pending" ? <button className="button" disabled={Boolean(busy) || status.state.inFlight} onClick={() => void action(`run-${entry.id}`, async () => { await requestJson("/api/automation/tistory/run-now", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entryId: entry.id }) }); })}>지금 실행</button> : null}
                </div>
              )) : <div className="notice">등록된 발행 큐가 없습니다.</div>}
            </div>
          </section>
        </>
      ) : <section className="admin-section"><div className="notice">상태를 불러오는 중입니다.</div></section>}
    </>
  );
}
