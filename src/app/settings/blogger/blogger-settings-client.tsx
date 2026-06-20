"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  BloggerConnectionAdmin,
  BloggerBlogListResult,
  BloggerBlogSelectionResult,
  BloggerConnectionSecretStatus,
  BloggerConnectionStatus,
  BloggerConnectionStatusSummary,
  BloggerOAuthStartDryRun,
  BloggerSecretSelfTestResult,
  BloggerTokenRefreshResponse
} from "@/lib/blogger/admin-types";
import type { BlogOperationProfileResponse } from "@/lib/blog-operation-profiles/operation-profile-summary";
import type { BlogAdmin } from "@/lib/blogs/admin-types";
import type { DailyPlanContentItemFixtureResponse } from "@/lib/daily-content-plans/content-item-fixture";
import type { DailyContentPlanResponse } from "@/lib/daily-content-plans/daily-content-plan-summary";
import type { DailyContentDraftGenerationReadinessResponse } from "@/lib/daily-content-plans/draft-generation-readiness";
import type { DailyContentQueueOperatorWorkflowResponse } from "@/lib/daily-content-plans/operator-approval-workflow";
import { ApiResult, formatListInput, optionalString, parseListInput, requestJson } from "@/lib/form-utils";

interface BloggerConnectionForm {
  id?: string;
  name: string;
  blogId: string;
  status: BloggerConnectionStatus;
  bloggerBlogId: string;
  bloggerBlogName: string;
  bloggerBlogUrl: string;
  bloggerBlogVerifiedAt: string;
  connectedEmail: string;
  scopes: string;
  oauthClientIdRef: string;
  clientSecretRef: string;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string;
  lastError: string;
}

type DailyContentPlanQueueItem =
  | DailyContentPlanResponse["dailyContentPlanSummary"]["existingPlanItems"][number]
  | DailyContentPlanResponse["dailyContentPlanSummary"]["planItems"][number];

const statuses: BloggerConnectionStatus[] = ["not_configured", "configured", "oauth_required", "connected", "expired", "error"];

const emptyConnectionForm: BloggerConnectionForm = {
  name: "",
  blogId: "",
  status: "not_configured",
  bloggerBlogId: "",
  bloggerBlogName: "",
  bloggerBlogUrl: "",
  bloggerBlogVerifiedAt: "",
  connectedEmail: "",
  scopes: "https://www.googleapis.com/auth/blogger",
  oauthClientIdRef: "",
  clientSecretRef: "",
  hasClientSecret: false,
  hasAccessToken: false,
  hasRefreshToken: false,
  tokenLast4: "",
  lastError: ""
};

export function BloggerSettingsClient() {
  const [connections, setConnections] = useState<BloggerConnectionAdmin[]>([]);
  const [blogs, setBlogs] = useState<BlogAdmin[]>([]);
  const [form, setForm] = useState<BloggerConnectionForm>(emptyConnectionForm);
  const [statusPreview, setStatusPreview] = useState<BloggerConnectionStatusSummary | null>(null);
  const [secretStatus, setSecretStatus] = useState<BloggerConnectionSecretStatus | null>(null);
  const [secretSelfTest, setSecretSelfTest] = useState<BloggerSecretSelfTestResult | null>(null);
  const [tokenRefreshResult, setTokenRefreshResult] = useState<BloggerTokenRefreshResponse | null>(null);
  const [operationProfileResult, setOperationProfileResult] = useState<BlogOperationProfileResponse | null>(null);
  const [dailyContentPlanResult, setDailyContentPlanResult] = useState<DailyContentPlanResponse | null>(null);
  const [contentItemFixtureResult, setContentItemFixtureResult] = useState<DailyPlanContentItemFixtureResponse | null>(null);
  const [operatorWorkflowResult, setOperatorWorkflowResult] = useState<DailyContentQueueOperatorWorkflowResponse | null>(null);
  const [draftGenerationReadinessResult, setDraftGenerationReadinessResult] = useState<DailyContentDraftGenerationReadinessResponse | null>(null);
  const [oauthDryRun, setOauthDryRun] = useState<BloggerOAuthStartDryRun | null>(null);
  const [blogListResult, setBlogListResult] = useState<BloggerBlogListResult | null>(null);
  const [blogListLoadingId, setBlogListLoadingId] = useState<string | null>(null);
  const [refreshingTokenId, setRefreshingTokenId] = useState<string | null>(null);
  const [loadingOperationProfileId, setLoadingOperationProfileId] = useState<string | null>(null);
  const [loadingDailyContentPlanId, setLoadingDailyContentPlanId] = useState<string | null>(null);
  const [loadingContentItemFixtureId, setLoadingContentItemFixtureId] = useState<string | null>(null);
  const [loadingOperatorWorkflowPlanId, setLoadingOperatorWorkflowPlanId] = useState<string | null>(null);
  const [loadingDraftGenerationReadinessItemId, setLoadingDraftGenerationReadinessItemId] = useState<string | null>(null);
  const [selectingBlogId, setSelectingBlogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedBlog = useMemo(() => blogs.find((blog) => blog.id === form.blogId) ?? null, [blogs, form.blogId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [connectionResult, blogResult] = await Promise.all([
        requestJson<ApiResult<BloggerConnectionAdmin[]>>("/api/settings/blogger"),
        requestJson<ApiResult<BlogAdmin[]>>("/api/blogs")
      ]);
      setConnections(connectionResult.data);
      setBlogs(blogResult.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function submitConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!form.name.trim()) {
      setError("Connection name은 필수입니다.");
      return;
    }
    if (form.tokenLast4.trim() && !/^[A-Za-z0-9_-]{4}$/.test(form.tokenLast4.trim())) {
      setError("tokenLast4는 안전한 문자 4자리만 입력할 수 있습니다.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      blogId: optionalString(form.blogId),
      status: form.status,
      connectedEmail: optionalString(form.connectedEmail),
      scopes: parseListInput(form.scopes),
      oauthClientIdRef: optionalString(form.oauthClientIdRef),
      clientSecretRef: optionalString(form.clientSecretRef),
      hasClientSecret: form.hasClientSecret,
      hasAccessToken: form.hasAccessToken,
      hasRefreshToken: form.hasRefreshToken,
      tokenLast4: optionalString(form.tokenLast4),
      lastError: optionalString(form.lastError)
    };

    setSaving(true);
    try {
      await requestJson<ApiResult<BloggerConnectionAdmin>>(form.id ? `/api/settings/blogger/${form.id}` : "/api/settings/blogger", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setForm(emptyConnectionForm);
      setStatusPreview(null);
      setSecretStatus(null);
      setSecretSelfTest(null);
      setTokenRefreshResult(null);
      setOperationProfileResult(null);
      setDailyContentPlanResult(null);
      setOperatorWorkflowResult(null);
      setDraftGenerationReadinessResult(null);
      setOauthDryRun(null);
      setBlogListResult(null);
      setNotice("Blogger connection을 저장했습니다. Blogger draft/publish는 수행하지 않았습니다.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger connection 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function loadStatus(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<BloggerConnectionStatusSummary>>(`/api/settings/blogger/${connection.id}/status`);
      setStatusPreview(result.data);
      setNotice("저장된 Blogger connection 상태만 조회했습니다. Blogger API 호출은 목록 조회 버튼에서만 read-only로 수행합니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger connection status 조회에 실패했습니다.");
    }
  }

  async function loadSecretStatus(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<BloggerConnectionSecretStatus>>(`/api/settings/blogger/${connection.id}/secret-status`);
      setSecretStatus(result.data);
      setNotice("Blogger secret metadata만 조회했습니다. token/client secret 원문은 반환하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger secret status 조회에 실패했습니다.");
    }
  }

  async function runSecretSelfTest(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<BloggerSecretSelfTestResult>>(`/api/settings/blogger/${connection.id}/secret-self-test`, { method: "POST" });
      setSecretSelfTest(result.data);
      setNotice(result.data.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger token encryption self-test에 실패했습니다.");
    }
  }

  async function refreshAccessToken(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);
    setRefreshingTokenId(connection.id);

    try {
      const result = await requestJson<ApiResult<BloggerTokenRefreshResponse>>(`/api/settings/blogger/${connection.id}/refresh-token`, {
        method: "POST",
        body: JSON.stringify({ reason: "manual_settings_refresh", force: false })
      });
      setTokenRefreshResult(result.data);
      setSecretStatus(null);
      setStatusPreview(null);
      setNotice(
        result.data.tokenRefreshSummary.refreshOk
          ? "Blogger access token을 갱신했습니다. token/client secret 원문은 반환하지 않았습니다."
          : "Blogger access token refresh가 차단되거나 실패했습니다. blocking reason을 확인하세요."
      );
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger access token refresh에 실패했습니다.");
    } finally {
      setRefreshingTokenId(null);
    }
  }

  async function previewOperationProfile(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);
    setLoadingOperationProfileId(connection.id);

    try {
      const result = await requestJson<ApiResult<BlogOperationProfileResponse>>("/api/blog-operation-profiles/default-policy", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          targetBloggerBlogId: connection.bloggerBlogId,
          targetBloggerBlogName: connection.bloggerBlogName,
          targetBloggerBlogUrl: connection.bloggerBlogUrl,
          defaultPublishPolicyPreset: "safe_manual_publish"
        })
      });
      setOperationProfileResult(result.data);
      setNotice("Blog Operation Profile preview를 생성했습니다. Profile row 저장, Blogger write/publish, token refresh는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blog Operation Profile preview에 실패했습니다.");
    } finally {
      setLoadingOperationProfileId(null);
    }
  }

  async function previewDailyContentPlan(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);
    setLoadingDailyContentPlanId(connection.id);

    try {
      const result = await requestJson<ApiResult<DailyContentPlanResponse>>("/api/daily-content-plans/default-plan", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          targetBloggerBlogId: connection.bloggerBlogId,
          targetBloggerBlogName: connection.bloggerBlogName,
          targetBloggerBlogUrl: connection.bloggerBlogUrl,
          planDateLocal: getTodayInSeoul(),
          timezone: "Asia/Seoul",
          defaultPublishPolicyPreset: "safe_manual_publish"
        })
      });
      setDailyContentPlanResult(result.data);
      setOperatorWorkflowResult(null);
      setDraftGenerationReadinessResult(null);
      setNotice("Daily Content Plan preview를 생성했습니다. Plan row 저장, content generation, LLM call, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Daily Content Plan preview에 실패했습니다.");
    } finally {
      setLoadingDailyContentPlanId(null);
    }
  }

  async function previewContentItemFixture(planId: string | null | undefined, planItemId: string | null | undefined) {
    if (!planId || !planItemId) {
      setError("Daily plan id와 item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingContentItemFixtureId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyPlanContentItemFixtureResponse>>("/api/daily-content-plans/content-item-fixture", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          planId,
          planItemId
        })
      });
      setContentItemFixtureResult(result.data);
      setNotice("content_items fixture preview를 확인했습니다. DB write, LLM call, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "content_items fixture preview에 실패했습니다.");
    } finally {
      setLoadingContentItemFixtureId(null);
    }
  }

  async function previewOperatorWorkflow(planId: string | null | undefined) {
    if (!planId) {
      setError("Daily plan id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingOperatorWorkflowPlanId(planId);

    try {
      const result = await requestJson<ApiResult<DailyContentQueueOperatorWorkflowResponse>>("/api/daily-content-plans/operator-approval-workflow", {
        method: "POST",
        body: JSON.stringify({
          mode: "preview",
          planId
        })
      });
      setOperatorWorkflowResult(result.data);
      setNotice("운영자 검토 워크플로우 preview를 확인했습니다. approval 저장, content generation, LLM call, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "운영자 검토 워크플로우 preview에 실패했습니다.");
    } finally {
      setLoadingOperatorWorkflowPlanId(null);
    }
  }

  async function previewDraftGenerationReadiness(planItemId: string | null | undefined, contentItemId: string | null | undefined) {
    if (!planItemId || !contentItemId) {
      setError("Daily plan item id와 linked content item id가 필요합니다.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoadingDraftGenerationReadinessItemId(planItemId);

    try {
      const result = await requestJson<ApiResult<DailyContentDraftGenerationReadinessResponse>>("/api/daily-content-plans/draft-generation-readiness", {
        method: "POST",
        body: JSON.stringify({
          mode: "preflight",
          planItemId,
          contentItemId
        })
      });
      setDraftGenerationReadinessResult(result.data);
      setNotice("초안 생성 준비 preflight를 확인했습니다. draftMarkdown/draftHtml 저장, content generation, LLM call, Blogger write/publish는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 생성 준비 preflight에 실패했습니다.");
    } finally {
      setLoadingDraftGenerationReadinessItemId(null);
    }
  }

  async function createOAuthDryRun(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<BloggerOAuthStartDryRun>>(`/api/settings/blogger/${connection.id}/oauth/start`, { method: "POST" });
      setOauthDryRun(result.data);
      setNotice("OAuth authorization URL을 생성했습니다. Callback에서는 token exchange를 수행하며 Blogger API는 blog list read-only만 지원합니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "OAuth dry-run URL 생성에 실패했습니다.");
    }
  }

  async function loadBloggerBlogs(connection: BloggerConnectionAdmin) {
    setError(null);
    setNotice(null);
    setBlogListLoadingId(connection.id);

    try {
      const result = await requestJson<ApiResult<BloggerBlogListResult>>(`/api/settings/blogger/${connection.id}/blogs`, { method: "POST" });
      setBlogListResult(result.data);
      setNotice("Blogger blog list를 read-only로 조회했습니다. draft/publish와 token refresh는 수행하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger blog list 조회에 실패했습니다.");
    } finally {
      setBlogListLoadingId(null);
    }
  }

  async function selectBloggerBlog(blogId: string) {
    if (!blogListResult) {
      return;
    }

    setError(null);
    setNotice(null);
    setSelectingBlogId(blogId);

    try {
      await requestJson<ApiResult<BloggerBlogSelectionResult>>(`/api/settings/blogger/${blogListResult.connectionId}/blogs/select`, {
        method: "POST",
        body: JSON.stringify({ blogId })
      });
      setStatusPreview(null);
      setNotice("Blogger blog를 connection에 반영했습니다. draft/publish는 수행하지 않았습니다.");
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger blog 선택 저장에 실패했습니다.");
    } finally {
      setSelectingBlogId(null);
    }
  }

  const activeBlogListConnection = blogListResult ? connections.find((connection) => connection.id === blogListResult.connectionId) ?? null : null;
  const dailyContentPlanSummary = dailyContentPlanResult?.dailyContentPlanSummary ?? null;

  return (
    <>
      <section className="card">
        <span className="badge">Patch 9D-2</span>
        <h1>Blogger 설정</h1>
        <p className="muted">
          Blogger OAuth callback token exchange와 read-only blog list 조회가 연결되었습니다. 선택 저장은 서버 재검증 후 safe metadata만 반영합니다.
        </p>
        <div className="button-row">
          <button className="button secondary" type="button" disabled>
            OAuth callback token exchange 연결됨
          </button>
          <button className="button secondary" type="button" disabled>
            Blogger draft/publish 비활성
          </button>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice success">{notice}</div> : null}
      {loading ? <div className="notice">Blogger 설정을 불러오는 중입니다.</div> : null}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Connection Placeholder</h2>
            <p className="muted">안전한 설정 필드만 저장합니다. OAuth callback token exchange는 구현되었고, Blogger API는 read-only blog list 조회만 가능합니다.</p>
          </div>
        </div>

        <form className="admin-form" onSubmit={(event) => void submitConnection(event)}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Blog Profile
            <select value={form.blogId} onChange={(event) => setForm({ ...form, blogId: event.target.value })}>
              <option value="">No blog profile</option>
              {blogs.map((blog) => (
                <option key={blog.id} value={blog.id}>
                  {blog.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BloggerConnectionStatus })}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="notice full-span">
            Blogger blog 선택은 아래 Blogger 목록 조회 결과에서 “이 블로그 선택”으로만 반영합니다. 직접 입력한 Blogger Blog ID/Name은 검증된 선택으로 간주하지 않습니다.
            {form.bloggerBlogId ? (
              <>
                <br />
                현재 선택: {form.bloggerBlogName || "-"} ({form.bloggerBlogId})
                {form.bloggerBlogUrl ? (
                  <>
                    <br />
                    URL: {form.bloggerBlogUrl}
                  </>
                ) : null}
                <br />
                Verified At: {form.bloggerBlogVerifiedAt ? new Date(form.bloggerBlogVerifiedAt).toLocaleString() : "-"}
              </>
            ) : null}
          </div>
          <label>
            Connected Email
            <input value={form.connectedEmail} onChange={(event) => setForm({ ...form, connectedEmail: event.target.value })} />
          </label>
          <label>
            OAuth Client ID Ref
            <input value={form.oauthClientIdRef} onChange={(event) => setForm({ ...form, oauthClientIdRef: event.target.value })} />
          </label>
          <label>
            Client Secret Ref
            <input value={form.clientSecretRef} onChange={(event) => setForm({ ...form, clientSecretRef: event.target.value })} />
          </label>
          <label>
            Token Last 4
            <input maxLength={4} value={form.tokenLast4} onChange={(event) => setForm({ ...form, tokenLast4: event.target.value })} />
          </label>
          <label className="full-span">
            OAuth Scopes
            <textarea value={form.scopes} onChange={(event) => setForm({ ...form, scopes: event.target.value })} />
          </label>
          <label className="full-span">
            Last Error
            <textarea value={form.lastError} onChange={(event) => setForm({ ...form, lastError: event.target.value })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.hasClientSecret} onChange={(event) => setForm({ ...form, hasClientSecret: event.target.checked })} />
            Client secret reference exists
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.hasAccessToken} onChange={(event) => setForm({ ...form, hasAccessToken: event.target.checked })} />
            Access token placeholder exists
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.hasRefreshToken} onChange={(event) => setForm({ ...form, hasRefreshToken: event.target.checked })} />
            Refresh token placeholder exists
          </label>
          <div className="form-actions full-span">
            <button className="button" disabled={saving} type="submit">
              {saving ? "저장 중" : form.id ? "Connection 수정" : "Connection 생성"}
            </button>
            {form.id ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setForm(emptyConnectionForm);
                  setStatusPreview(null);
                  setSecretStatus(null);
                  setSecretSelfTest(null);
                  setTokenRefreshResult(null);
                  setOperationProfileResult(null);
                  setDailyContentPlanResult(null);
                  setContentItemFixtureResult(null);
                  setOperatorWorkflowResult(null);
                  setDraftGenerationReadinessResult(null);
                  setOauthDryRun(null);
                  setBlogListResult(null);
                }}
              >
                새 Connection
              </button>
            ) : null}
          </div>
        </form>

        {selectedBlog ? (
          <div className="notice">
            선택한 blog profile의 기존 Blogger Blog ID: {selectedBlog.bloggerBlogId ?? "없음"}. Patch 9A 이후 source of truth는 Blogger connection placeholder의 Blogger Blog ID입니다.
          </div>
        ) : null}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Connection List</h2>
            <p className="muted">API 응답에는 access token, refresh token, client secret 원문을 포함하지 않습니다.</p>
          </div>
        </div>

        {connections.length === 0 && !loading ? <div className="notice">저장된 Blogger connection placeholder가 없습니다.</div> : null}
        {connections.length > 0 ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Blog</th>
                <th>Blogger Blog</th>
                <th>Secrets</th>
                <th>Last Tested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((connection) => (
                <tr key={connection.id}>
                  <td>{connection.name}</td>
                  <td>
                    <span className={`status-pill status-${connection.status}`}>{connection.status}</span>
                  </td>
                  <td>{connection.blog?.name ?? "-"}</td>
                  <td>
                    {connection.bloggerBlogName ?? "-"}
                    <div className="muted">{connection.bloggerBlogId ?? ""}</div>
                    {connection.bloggerBlogUrl ? <div className="muted">{connection.bloggerBlogUrl}</div> : null}
                    <div className="muted">verified: {connection.bloggerBlogVerifiedAt ? new Date(connection.bloggerBlogVerifiedAt).toLocaleString() : "-"}</div>
                  </td>
                  <td>
                    client secret: {connection.hasClientSecret ? "yes" : "no"}
                    <br />
                    client id ref: {connection.oauthClientIdRef ?? "no"}
                    <br />
                    access token: {connection.hasAccessToken ? `yes (${connection.tokenLast4 ?? "last4 unknown"})` : "no"}
                    <br />
                    refresh token: {connection.hasRefreshToken ? "yes" : "no"}
                  </td>
                  <td>{connection.lastTestedAt ? new Date(connection.lastTestedAt).toLocaleString() : "-"}</td>
                  <td>
                    <div className="button-row">
                      <button className="button secondary" type="button" onClick={() => setForm(toForm(connection))}>
                        수정
                      </button>
                      <button className="button secondary" type="button" onClick={() => void loadStatus(connection)}>
                        상태
                      </button>
                      <button className="button secondary" type="button" onClick={() => void loadSecretStatus(connection)}>
                        Secret 상태
                      </button>
                      <button className="button secondary" type="button" onClick={() => void runSecretSelfTest(connection)}>
                        암호화 Self-test
                      </button>
                      <button className="button secondary" type="button" disabled={refreshingTokenId === connection.id} onClick={() => void refreshAccessToken(connection)}>
                        {refreshingTokenId === connection.id ? "갱신 중" : "Access Token Refresh"}
                      </button>
                      <button className="button secondary" type="button" onClick={() => void createOAuthDryRun(connection)}>
                        OAuth URL 생성
                      </button>
                      <button className="button secondary" type="button" disabled={blogListLoadingId === connection.id} onClick={() => void loadBloggerBlogs(connection)}>
                        {blogListLoadingId === connection.id ? "조회 중" : "Blogger 목록 조회"}
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        disabled={!connection.bloggerBlogId || loadingOperationProfileId === connection.id}
                        onClick={() => void previewOperationProfile(connection)}
                      >
                        {loadingOperationProfileId === connection.id ? "Profile Preview 중" : "Operation Profile Preview"}
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        disabled={!connection.bloggerBlogId || loadingDailyContentPlanId === connection.id}
                        onClick={() => void previewDailyContentPlan(connection)}
                      >
                        {loadingDailyContentPlanId === connection.id ? "Daily Plan Preview 중" : "Daily Plan Preview"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Blog Operation Profile</h2>
            <p className="muted">9F-1A foundation입니다. 블로그별 기본 운영 정책을 preview하지만, profile write는 feature flag와 명시 승인 전까지 실행하지 않습니다.</p>
          </div>
        </div>
        <div className="notice warning">
          <strong>Profile write is CLI/explicit-gated only for now</strong>
          <p>Preview 버튼은 safe_manual_publish preset을 보여주며 DB row를 생성하지 않습니다.</p>
          <p>Apply/Save는 이번 UI에서 비활성입니다. Blogger publish/write, posts.update, draft save, OAuth reconnect, token refresh도 실행하지 않습니다.</p>
        </div>
        <div className="form-actions">
          <button className="button secondary" type="button" disabled>
            Profile Apply/Save disabled
          </button>
        </div>
        {operationProfileResult ? (
          <div className="read-block">
            <h3>Operation Profile Preview</h3>
            <div className={operationProfileResult.operationProfileExceptionDashboardSummary.profileHealthy ? "notice" : "notice warning"}>
              <strong>{operationProfileResult.operationProfileExceptionDashboardSummary.headline}</strong>
              <p>{operationProfileResult.operationProfileExceptionDashboardSummary.operatorSummary}</p>
              <p>
                dashboard: {operationProfileResult.operationProfileExceptionDashboardSummary.dashboardMode} / advisory only:{" "}
                {String(operationProfileResult.operationProfileExceptionDashboardSummary.advisoryOnly)} / policy enforced:{" "}
                {String(operationProfileResult.operationProfileExceptionDashboardSummary.policyEnforced)} / blocker impact:{" "}
                {String(operationProfileResult.operationProfileExceptionDashboardSummary.blockerImpact)}
              </p>
            </div>
            <div className="detail-grid">
              <DetailItem label="Profile Found" value={String(operationProfileResult.operationProfileExceptionDashboardSummary.profileFound)} />
              <DetailItem label="Profile Healthy" value={String(operationProfileResult.operationProfileExceptionDashboardSummary.profileHealthy)} />
              <DetailItem label="Attention Level" value={operationProfileResult.operationProfileExceptionDashboardSummary.attentionLevel} />
              <DetailItem
                label="Default Publish Policy"
                value={operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.defaultPublishPolicyPreset ?? "-"}
              />
              <DetailItem label="Operation Mode" value={operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.operationMode ?? "-"} />
              <DetailItem label="Auto Publish" value={formatNullableBoolean(operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.allowAutoPublish)} />
              <DetailItem
                label="Scheduled Publish"
                value={formatNullableBoolean(operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.allowScheduledPublish)}
              />
              <DetailItem
                label="Human Approval"
                value={formatNullableBoolean(operationProfileResult.operationProfileExceptionDashboardSummary.profilePolicySnapshot.requireFinalHumanApproval)}
              />
            </div>
            <ValidationList
              title="Exception Dashboard Focus Items"
              items={operationProfileResult.operationProfileExceptionDashboardSummary.focusItems.map((item) => `${item.severity}: ${item.label} - ${item.detail}`)}
              emptyText="No profile exceptions found."
              isWarning
            />
            <ValidationList
              title="Exception Dashboard Advisory Warnings"
              items={operationProfileResult.operationProfileExceptionDashboardSummary.advisoryWarnings}
              emptyText="advisory warning이 없습니다."
              isWarning
            />
            <div className="read-block">
              <h3>Operation Profile Policy Simulation</h3>
              <div className="notice">
                <strong>safe_manual_publish dry-run simulation</strong>
                <p>This is a dry-run simulation. It does not change current publish blockers or execution permissions.</p>
                <p>
                  Auto publish remains disabled. Scheduled publish remains disabled. Human approval, readback, and post-publish reconciliation remain required.
                </p>
              </div>
              <div className="detail-grid">
                <DetailItem label="Simulation Version" value={operationProfileResult.operationProfilePolicySimulationSummary.simulationVersion} />
                <DetailItem label="Simulation Mode" value={operationProfileResult.operationProfilePolicySimulationSummary.simulationMode} />
                <DetailItem label="Advisory Only" value={String(operationProfileResult.operationProfilePolicySimulationSummary.advisoryOnly)} />
                <DetailItem label="Policy Enforced" value={String(operationProfileResult.operationProfilePolicySimulationSummary.policyEnforced)} />
                <DetailItem label="Actual Blocker Impact" value={String(operationProfileResult.operationProfilePolicySimulationSummary.actualBlockerImpact)} />
                <DetailItem
                  label="Actual Permission Impact"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.actualExecutionPermissionImpact)}
                />
                <DetailItem label="Profile Found" value={String(operationProfileResult.operationProfilePolicySimulationSummary.profileFound)} />
                <DetailItem label="Profile Healthy" value={String(operationProfileResult.operationProfilePolicySimulationSummary.profileHealthy)} />
                <DetailItem label="Profile Applicable" value={String(operationProfileResult.operationProfilePolicySimulationSummary.profileWouldBeApplicable)} />
                <DetailItem label="Default Publish Policy" value={operationProfileResult.operationProfilePolicySimulationSummary.defaultPublishPolicyPreset ?? "-"} />
              </div>
              <div className="detail-grid">
                <DetailItem
                  label="Require OAuth Gate"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireOAuthGate)}
                />
                <DetailItem
                  label="Require Human Approval"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireFinalHumanApproval)}
                />
                <DetailItem
                  label="Require External Risk Ack"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireExternalWriteRiskAck)}
                />
                <DetailItem
                  label="Require Rollback Ack"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireRollbackPlanAck)}
                />
                <DetailItem
                  label="Require Readback"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequireReadbackAfterPublish)}
                />
                <DetailItem
                  label="Require Reconciliation"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldRequirePostPublishReconciliation)}
                />
                <DetailItem
                  label="Allow Auto Publish"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldAllowAutoPublish)}
                />
                <DetailItem
                  label="Allow Scheduled Publish"
                  value={String(operationProfileResult.operationProfilePolicySimulationSummary.simulatedPolicyState.wouldAllowScheduledPublish)}
                />
              </div>
              <ValidationList
                title="Simulated Additional Blockers"
                items={operationProfileResult.operationProfilePolicySimulationSummary.simulatedAdditionalBlockers}
                emptyText="simulation blocker가 없습니다."
                isWarning
              />
              <ValidationList
                title="Simulated Removed Blockers"
                items={operationProfileResult.operationProfilePolicySimulationSummary.simulatedRemovedBlockers}
                emptyText="simulation에서 제거할 blocker가 없습니다."
              />
              <ValidationList
                title="Simulation Notes"
                items={operationProfileResult.operationProfilePolicySimulationSummary.notes}
                emptyText="simulation note가 없습니다."
              />
            </div>
            <div className="read-block">
              <h3>Operation Profile Scenario Matrix</h3>
              <div className="notice">
                <strong>Scenario matrix preview</strong>
                <p>This matrix is simulation-only. It does not change current publish blockers or execution permissions.</p>
                <p>
                  Future planned ready item, token expired item, profile missing, profile mismatch, and scheduled publish requested scenarios are previewed without
                  creating rows or calling Blogger.
                </p>
              </div>
              <div className="detail-grid">
                <DetailItem label="Matrix Version" value={operationProfileResult.operationProfileScenarioMatrixSummary.matrixVersion} />
                <DetailItem label="Matrix Mode" value={operationProfileResult.operationProfileScenarioMatrixSummary.matrixMode} />
                <DetailItem label="Advisory Only" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.advisoryOnly)} />
                <DetailItem label="Policy Enforced" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.policyEnforced)} />
                <DetailItem label="Actual Blocker Impact" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.actualBlockerImpact)} />
                <DetailItem
                  label="Actual Permission Impact"
                  value={String(operationProfileResult.operationProfileScenarioMatrixSummary.actualExecutionPermissionImpact)}
                />
                <DetailItem label="Scenario Count" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.scenarioCount)} />
                <DetailItem label="Blocked Scenarios" value={String(operationProfileResult.operationProfileScenarioMatrixSummary.matrixTotals.blockedScenarioCount)} />
                <DetailItem
                  label="Manual Approval Scenarios"
                  value={String(operationProfileResult.operationProfileScenarioMatrixSummary.matrixTotals.manualApprovalScenarioCount)}
                />
                <DetailItem
                  label="Exception Review Scenarios"
                  value={String(operationProfileResult.operationProfileScenarioMatrixSummary.matrixTotals.exceptionReviewScenarioCount)}
                />
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Input</th>
                    <th>Synthetic</th>
                    <th>Decision</th>
                    <th>Blockers</th>
                    <th>Operator Takeaway</th>
                  </tr>
                </thead>
                <tbody>
                  {operationProfileResult.operationProfileScenarioMatrixSummary.scenarios.map((scenario) => (
                    <tr key={scenario.scenarioId}>
                      <td>
                        <strong>{scenario.label}</strong>
                        <div className="muted">{scenario.scenarioId}</div>
                      </td>
                      <td>{scenario.inputKind}</td>
                      <td>{String(scenario.syntheticOnly)}</td>
                      <td>
                        execute: {String(scenario.simulatedDecision.wouldAllowPublishExecution)}
                        <br />
                        scheduled: {String(scenario.simulatedDecision.wouldAllowScheduledPublishExecution)}
                        <br />
                        manual: {String(scenario.simulatedDecision.wouldRequireManualApproval)}
                      </td>
                      <td>{scenario.simulatedAdditionalBlockers.length}</td>
                      <td>{scenario.operatorTakeaway}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ValidationList
                title="Scenario Matrix Notes"
                items={operationProfileResult.operationProfileScenarioMatrixSummary.notes}
                emptyText="matrix note가 없습니다."
              />
            </div>
            <details className="read-block">
              <summary>Detailed policy snapshot</summary>
            <div className="detail-grid">
              <DetailItem label="Checked At" value={new Date(operationProfileResult.checkedAt).toLocaleString()} />
              <DetailItem label="Mode" value={operationProfileResult.blogOperationProfileSummary.mode} />
              <DetailItem label="Profile Found" value={String(operationProfileResult.blogOperationProfileSummary.profileFound)} />
              <DetailItem label="Would Create" value={String(operationProfileResult.blogOperationProfileSummary.profileWouldBeCreated)} />
              <DetailItem label="Would Update" value={String(operationProfileResult.blogOperationProfileSummary.profileWouldBeUpdated)} />
              <DetailItem label="Apply Attempted" value={String(operationProfileResult.blogOperationProfileSummary.applyAttempted)} />
              <DetailItem label="Apply Blocked" value={String(operationProfileResult.blogOperationProfileSummary.applyBlocked)} />
              <DetailItem label="Apply OK" value={String(operationProfileResult.blogOperationProfileSummary.applyOk)} />
              <DetailItem label="Feature Flag Enabled" value={String(operationProfileResult.blogOperationProfileSummary.featureFlagEnabled)} />
              <DetailItem label="Confirmation Accepted" value={String(operationProfileResult.blogOperationProfileSummary.confirmationPhraseAccepted)} />
              <DetailItem label="Target Blogger Blog" value={operationProfileResult.blogOperationProfileSummary.targetBloggerBlogName ?? "-"} />
              <DetailItem label="Target Blogger Blog ID" value={operationProfileResult.blogOperationProfileSummary.targetBloggerBlogId ?? "-"} />
              <DetailItem label="Target Blogger Blog URL" value={operationProfileResult.blogOperationProfileSummary.targetBloggerBlogUrl ?? "-"} />
            </div>
            <div className="detail-grid">
              <DetailItem label="Profile Status" value={operationProfileResult.blogOperationProfileSummary.proposedProfile.status} />
              <DetailItem label="Default Publish Policy" value={operationProfileResult.blogOperationProfileSummary.proposedProfile.defaultPublishPolicyPreset} />
              <DetailItem label="Operation Mode" value={operationProfileResult.blogOperationProfileSummary.proposedProfile.operationMode} />
              <DetailItem label="Timezone" value={operationProfileResult.blogOperationProfileSummary.proposedProfile.timezone} />
              <DetailItem label="Auto Publish Enabled" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.allowAutoPublish)} />
              <DetailItem label="Scheduled Publish Enabled" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.allowScheduledPublish)} />
              <DetailItem label="Human Approval Required" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireFinalHumanApproval)} />
              <DetailItem label="OAuth Gate Required" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireOAuthGate)} />
              <DetailItem label="External Write Risk Ack" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireExternalWriteRiskAck)} />
              <DetailItem label="Rollback Plan Ack" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireRollbackPlanAck)} />
              <DetailItem label="Readback After Publish" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requireReadbackAfterPublish)} />
              <DetailItem label="Post-publish Reconciliation" value={String(operationProfileResult.blogOperationProfileSummary.proposedProfile.requirePostPublishReconciliation)} />
            </div>
            <div className="detail-grid">
              <DetailItem label="Policy: Feature Flag" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.bloggerWriteRequiresFeatureFlag)} />
              <DetailItem label="Policy: Confirmation Phrase" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.bloggerWriteRequiresConfirmationPhrase)} />
              <DetailItem label="Policy: Unknown Result Review" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.unknownExternalResultRequiresManualReview)} />
              <DetailItem label="Policy: Retry Unknown Result" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.retryOnUnknownExternalResult)} />
              <DetailItem label="Raw Response Storage" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.rawBloggerResponseStorageAllowed)} />
              <DetailItem label="Readback Content Returned" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.contentReturnedInReadbackResponse)} />
              <DetailItem label="Operator Exceptions Only" value={String(operationProfileResult.blogOperationProfileSummary.defaultPublishPolicy.operatorSeesExceptionsOnly)} />
            </div>
            </details>
            <ValidationList title="Operation Profile Blocking Reasons" items={operationProfileResult.blogOperationProfileSummary.blockingReasons} emptyText="blocking reason이 없습니다." isError />
            <ValidationList title="Operation Profile Warnings" items={operationProfileResult.blogOperationProfileSummary.warnings} emptyText="warning이 없습니다." isWarning />
            <div className="detail-grid">
              <DetailItem label="DB Read" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.dbRead)} />
              <DetailItem label="DB Write" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.dbWrite)} />
              <DetailItem label="Schema Migration" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.schemaMigration)} />
              <DetailItem label="Blogger Read" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerRead)} />
              <DetailItem label="Blogger Write" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerWrite)} />
              <DetailItem label="Blogger Publish" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerPublish)} />
              <DetailItem label="Blogger Update" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerUpdate)} />
              <DetailItem label="Blogger Draft Save" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.bloggerDraftSave)} />
              <DetailItem label="Token Refresh" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.tokenRefresh)} />
              <DetailItem label="OAuth Reconnect" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.oauthReconnect)} />
              <DetailItem label="Content Mutation" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.contentMutation)} />
              <DetailItem label="Approval Mutation" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.approvalMutation)} />
              <DetailItem label="Attempt Mutation" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.attemptMutation)} />
              <DetailItem label="LLM Call" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.llmCall)} />
              <DetailItem label="External Send" value={String(operationProfileResult.blogOperationProfileSummary.sideEffectSummary.externalSend)} />
            </div>
            <div className="notice">Operation Profile preview는 access token, refresh token, raw Blogger response, raw HTML/content를 표시하지 않습니다.</div>
          </div>
        ) : (
          <div className="notice">Connection List에서 verified Blogger Blog가 있는 connection의 Operation Profile Preview를 실행하세요.</div>
        )}
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>오늘 콘텐츠 계획</h2>
            <p className="muted">9F-2C readback/queue preview입니다. 기존 daily plan fixture를 읽어서 보여주며 저장, 생성, 발행은 실행하지 않습니다.</p>
          </div>
        </div>
        <div className="notice warning">
          <strong>Blogger 쓰기 없음</strong>
          <p>이 화면의 Daily Plan Preview는 readback 중심입니다. 9F-2B apply를 다시 실행하지 않으며 content generation, LLM 호출, content_items 생성, Blogger write/publish/schedule을 수행하지 않습니다.</p>
        </div>
        <div className="form-actions">
          <button className="button secondary" type="button" disabled>
            Daily Plan Apply/Create disabled
          </button>
        </div>
        {dailyContentPlanSummary ? (
          <div className="read-block">
            <h3>{dailyContentPlanSummary.existingPlanFound ? "계획 생성됨" : "계획 미생성"}</h3>
            <div className={dailyContentPlanSummary.existingPlanFound ? "notice success" : "notice warning"}>
              <strong>{dailyContentPlanSummary.existingPlanFound ? "검토 대기" : "Preview only"}</strong>
              <p>{dailyContentPlanSummary.existingPlanFound ? "오늘 계획 row와 후보 큐를 읽었습니다. 모든 후보는 아직 content_items와 연결되지 않았고 승인 필요 상태입니다." : "아직 persisted daily plan row가 없습니다. 이 UI에서는 생성 버튼을 활성화하지 않습니다."}</p>
            </div>
            <div className="detail-grid">
              <DetailItem label="Checked At" value={dailyContentPlanResult?.checkedAt ? new Date(dailyContentPlanResult.checkedAt).toLocaleString() : "-"} />
              <DetailItem label="Plan ID" value={dailyContentPlanSummary.persistedPlanId ?? "-"} />
              <DetailItem label="Plan Date" value={(dailyContentPlanSummary.existingPlanSummary?.planDateLocal ?? dailyContentPlanSummary.planDateLocal) || "-"} />
              <DetailItem label="Status" value={dailyContentPlanSummary.persistedPlanStatus ?? "-"} />
              <DetailItem label="Kind" value={dailyContentPlanSummary.existingPlanSummary?.planKind ?? dailyContentPlanSummary.planMode} />
              <DetailItem label="Policy" value={dailyContentPlanSummary.existingPlanSummary?.defaultPublishPolicyPreset ?? dailyContentPlanSummary.defaultPublishPolicyPreset} />
              <DetailItem label="Items" value={`${dailyContentPlanSummary.persistedItemCount || dailyContentPlanSummary.planTotals.plannedItemCount}개 후보 / 승인 필요 ${dailyContentPlanSummary.persistedApprovalRequiredCount || dailyContentPlanSummary.planTotals.approvalRequiredCount}개`} />
            </div>
            <div className="detail-grid">
              <DetailItem label="본문 생성" value={dailyContentPlanSummary.contentGenerationEnabled ? "켜짐" : "꺼짐"} />
              <DetailItem label="LLM 호출" value={dailyContentPlanSummary.llmCallEnabled ? "켜짐" : "꺼짐"} />
              <DetailItem label="발행 실행" value={dailyContentPlanSummary.publishExecutionEnabled ? "켜짐" : "꺼짐"} />
              <DetailItem label="예약 발행" value={dailyContentPlanSummary.scheduledPublishEnabled ? "켜짐" : "꺼짐"} />
              <DetailItem label="Blogger 쓰기" value={dailyContentPlanSummary.guardrailSummary.noBloggerWrite ? "없음" : "주의 필요"} />
              <DetailItem label="content_items 연결" value={`${dailyContentPlanSummary.persistedContentItemLinkedCount}개 연결됨`} />
            </div>
            <div className="button-row">
              <button
                className="button secondary"
                type="button"
                disabled={!dailyContentPlanSummary.persistedPlanId || loadingOperatorWorkflowPlanId === dailyContentPlanSummary.persistedPlanId}
                onClick={() => void previewOperatorWorkflow(dailyContentPlanSummary.persistedPlanId)}
              >
                {loadingOperatorWorkflowPlanId === dailyContentPlanSummary.persistedPlanId ? "워크플로우 확인 중" : "운영자 워크플로우 preview"}
              </button>
              <button className="button secondary" type="button" disabled>
                본문 생성 준비 - 비활성
              </button>
              <button className="button secondary" type="button" disabled>
                발행 검토 - 비활성
              </button>
              <button className="button secondary" type="button" disabled>
                예약 발행 - 비활성
              </button>
            </div>

            <h3>후보 큐</h3>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>순서</th>
                  <th>슬롯</th>
                  <th>Topic Seed</th>
                  <th>Intent / 상태</th>
                  <th>안전 가드</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {(dailyContentPlanSummary.existingPlanItems.length > 0 ? dailyContentPlanSummary.existingPlanItems : dailyContentPlanSummary.planItems).map((item) => (
                  <tr key={"id" in item ? item.id : item.syntheticPlanItemId}>
                    <td>
                      #{item.itemOrder}
                    </td>
                    <td>
                      {getDailyPlanSlotLabel(item.slotKey)}
                      <div className="muted">{item.slotKey}</div>
                    </td>
                    <td>{item.topicSeed}</td>
                    <td>
                      {item.contentIntent}
                      <div className="muted">{getDailyPlanItemStatus(item)}</div>
                    </td>
                    <td>
                      <div>{item.requiresHumanApproval ? "승인 필요" : "승인 불필요"}</div>
                      <div className="muted">{getDailyPlanItemContentItemId(item) ? `content item 연결됨: ${getDailyPlanItemContentItemId(item)}` : "아직 content_items 미연결"}</div>
                      <div className="muted">
                        draft {formatDisabledFlag(item.draftGenerationAllowed)} / LLM {formatDisabledFlag(item.llmGenerationAllowed)} / publish {formatDisabledFlag(item.publishExecutionAllowed)} / schedule {formatDisabledFlag(item.scheduledPublishAllowed)}
                      </div>
                    </td>
                    <td>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={!dailyContentPlanSummary.persistedPlanId || !getDailyPlanItemId(item) || loadingContentItemFixtureId === getDailyPlanItemId(item)}
                        onClick={() => previewContentItemFixture(dailyContentPlanSummary.persistedPlanId, getDailyPlanItemId(item))}
                      >
                        {loadingContentItemFixtureId === getDailyPlanItemId(item) ? "확인 중" : "fixture preview"}
                      </button>
                      <button className="button small secondary" type="button" disabled>
                        생성/연결 비활성
                      </button>
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={!getDailyPlanItemId(item) || !getDailyPlanItemContentItemId(item) || loadingDraftGenerationReadinessItemId === getDailyPlanItemId(item)}
                        onClick={() => void previewDraftGenerationReadiness(getDailyPlanItemId(item), getDailyPlanItemContentItemId(item))}
                      >
                        {loadingDraftGenerationReadinessItemId === getDailyPlanItemId(item) ? "점검 중" : "초안 생성 사전 점검"}
                      </button>
                      <button className="button small secondary" type="button" disabled>
                        LLM 초안 생성 비활성
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {contentItemFixtureResult ? (
              <div className="notice">
                <strong>content_items fixture preview</strong>
                <p>이 preview는 DB write를 수행하지 않습니다. 실제 fixture 생성/연결은 feature flag와 명시 승인 문구가 필요합니다.</p>
                <div className="detail-grid">
                  <DetailItem label="Patch" value={contentItemFixtureResult.contentItemFixtureSummary.patchVersion} />
                  <DetailItem label="Mode" value={contentItemFixtureResult.contentItemFixtureSummary.mode} />
                  <DetailItem label="Plan Item" value={contentItemFixtureResult.contentItemFixtureSummary.targetPlanItemId || "-"} />
                  <DetailItem label="Slot" value={contentItemFixtureResult.contentItemFixtureSummary.targetSlotKey ?? "-"} />
                  <DetailItem label="Would Create" value={String(contentItemFixtureResult.contentItemFixtureSummary.fixtureWouldBeCreated)} />
                  <DetailItem label="Already Linked" value={String(contentItemFixtureResult.contentItemFixtureSummary.fixtureAlreadyLinked)} />
                  <DetailItem label="Proposed Content Item" value={contentItemFixtureResult.contentItemFixtureSummary.proposedFixtureSummary.id ?? "-"} />
                  <DetailItem label="Applied Content Item" value={contentItemFixtureResult.contentItemFixtureSummary.appliedContentItemId ?? "-"} />
                  <DetailItem label="DB Write" value={String(contentItemFixtureResult.contentItemFixtureSummary.sideEffectSummary.dbWrite)} />
                  <DetailItem label="LLM Call" value={String(contentItemFixtureResult.contentItemFixtureSummary.sideEffectSummary.llmCall)} />
                  <DetailItem label="Blogger Write" value={String(contentItemFixtureResult.contentItemFixtureSummary.sideEffectSummary.bloggerWrite)} />
                </div>
              </div>
            ) : null}

            <div className="read-block">
              <h3>운영자 검토 워크플로우</h3>
              <div className="notice">
                <strong>9F-2E preview only</strong>
                <p>이 워크플로우는 후보 큐를 읽고 운영자가 다음에 무엇을 검토해야 하는지 보여줍니다. approval row 저장, content_items 변경, 본문 생성, LLM 호출, Blogger write/publish는 실행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  초안 생성 준비 승인 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  주제 보류 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  재검토 요청 - 비활성
                </button>
              </div>
              {operatorWorkflowResult ? (
                <>
                  <div className={operatorWorkflowResult.operatorApprovalWorkflowSummary.blockingReasons.length > 0 ? "notice warning" : "notice success"}>
                    <strong>
                      {operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.readyForOperatorReviewCount}개 검토 가능 /{" "}
                      {operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.waitingForContentFixtureCount}개 fixture 대기
                    </strong>
                    <p>
                      Item 1은 linked fixture가 있으면 운영자 검토 후보가 됩니다. Items 2/3은 content_items fixture 연결 전까지 대기 상태입니다.
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={operatorWorkflowResult.operatorApprovalWorkflowSummary.patchVersion} />
                    <DetailItem label="Workflow Mode" value={operatorWorkflowResult.operatorApprovalWorkflowSummary.workflowMode} />
                    <DetailItem label="Plan ID" value={operatorWorkflowResult.operatorApprovalWorkflowSummary.targetPlanId || "-"} />
                    <DetailItem label="Plan Date" value={operatorWorkflowResult.operatorApprovalWorkflowSummary.planDateLocal ?? "-"} />
                    <DetailItem label="Total Items" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.totalItems)} />
                    <DetailItem label="Linked Fixtures" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.linkedContentItemCount)} />
                    <DetailItem label="Unlinked Items" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.unlinkedItemCount)} />
                    <DetailItem label="Approval Required" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.queueSummary.approvalRequiredCount)} />
                  </div>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>순서</th>
                        <th>후보</th>
                        <th>연결 상태</th>
                        <th>검토 상태</th>
                        <th>다음 안전 단계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operatorWorkflowResult.operatorApprovalWorkflowSummary.queueItems.map((item) => (
                        <tr key={item.planItemId}>
                          <td>#{item.itemOrder}</td>
                          <td>
                            <strong>{item.topicSeed}</strong>
                            <div className="muted">
                              {item.slotLabel} / {item.contentIntent}
                            </div>
                          </td>
                          <td>
                            {item.contentItemId ? item.contentItemId : "content_items fixture 대기"}
                            <div className="muted">
                              status: {item.linkedContentStatus ?? "-"} / mode: {item.linkedContentMode ?? "-"}
                            </div>
                          </td>
                          <td>
                            {formatOperatorApprovalState(item.approvalStateDraft)}
                            <div className="muted">
                              generation {formatDisabledFlag(item.guardrails.draftGenerationAllowed)} / LLM {formatDisabledFlag(item.guardrails.llmGenerationAllowed)} / publish{" "}
                              {formatDisabledFlag(item.guardrails.publishExecutionAllowed)}
                            </div>
                          </td>
                          <td>{item.nextSafeStepDraft}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <details className="read-block">
                    <summary>운영자 워크플로우 기술 상세</summary>
                    <ValidationList
                      title="Workflow Blocking Reasons"
                      items={operatorWorkflowResult.operatorApprovalWorkflowSummary.blockingReasons}
                      emptyText="blocking reason이 없습니다."
                      isError
                    />
                    <ValidationList
                      title="Workflow Warnings"
                      items={operatorWorkflowResult.operatorApprovalWorkflowSummary.warnings}
                      emptyText="warning이 없습니다."
                      isWarning
                    />
                    <div className="detail-grid">
                      <DetailItem label="DB Read" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.dbWrite)} />
                      <DetailItem label="Approval Mutation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.approvalMutation)} />
                      <DetailItem label="Content Generation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.contentGeneration)} />
                      <DetailItem label="LLM Call" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.llmCall)} />
                      <DetailItem label="Content Mutation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.contentMutation)} />
                      <DetailItem label="Blogger Write" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.bloggerWrite)} />
                      <DetailItem label="Blogger Publish" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.bloggerPublish)} />
                      <DetailItem label="Scheduled Publish" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.scheduledPublish)} />
                      <DetailItem label="OAuth Reconnect" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.oauthReconnect)} />
                      <DetailItem label="Token Refresh" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.sideEffectSummary.tokenRefresh)} />
                    </div>
                    <div className="detail-grid">
                      <DetailItem label="No Business DB Write" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noBusinessDbWrite)} />
                      <DetailItem label="No Approval Mutation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noApprovalMutation)} />
                      <DetailItem label="No Content Generation" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noContentGeneration)} />
                      <DetailItem label="No LLM Call" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noLlmCall)} />
                      <DetailItem label="No Blogger Write" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noBloggerWrite)} />
                      <DetailItem label="No Publish Execution" value={String(operatorWorkflowResult.operatorApprovalWorkflowSummary.guardrailSummary.noPublishExecution)} />
                    </div>
                  </details>
                </>
              ) : (
                <div className="notice">위의 “운영자 워크플로우 preview” 버튼으로 후보 큐의 운영자 검토 상태를 확인하세요.</div>
              )}
            </div>

            <div className="read-block">
              <h3>초안 생성 준비 점검</h3>
              <div className="notice">
                <strong>9F-2F preflight only</strong>
                <p>linked content fixture가 미래 초안 생성에 구조적으로 준비되었는지 확인합니다. draftMarkdown/draftHtml 생성, LLM 호출, content_items 수정, Blogger 쓰기/발행은 실행하지 않습니다.</p>
              </div>
              <div className="button-row">
                <button className="button small secondary" type="button" disabled>
                  초안 생성 사전 점검 - 보기 전용
                </button>
                <button className="button small secondary" type="button" disabled>
                  초안 생성 실행 - 비활성
                </button>
                <button className="button small secondary" type="button" disabled>
                  LLM 초안 생성 - 비활성
                </button>
              </div>
              {draftGenerationReadinessResult ? (
                <>
                  <div
                    className={
                      draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.structuralReadyForFutureDraftGeneration
                        ? "notice success"
                        : "notice warning"
                    }
                  >
                    <strong>{draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.operatorLabelKo}</strong>
                    <p>{draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.nextSafeStepDraft}</p>
                    <p>
                      실행 준비: {draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.executionReadyForDraftGeneration ? "가능" : "차단"} / 구조 준비:{" "}
                      {draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.structuralReadyForFutureDraftGeneration ? "완료" : "미완료"}
                    </p>
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="Patch" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.patchVersion} />
                    <DetailItem label="Mode" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.mode} />
                    <DetailItem label="Plan Item" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.targetPlanItemId || "-"} />
                    <DetailItem label="Linked Fixture" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.linkedContentItemId ?? "-"} />
                    <DetailItem label="Fixture Found" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.fixtureFound)} />
                    <DetailItem label="Plan Item Found" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.planItemFound)} />
                    <DetailItem label="Fixture Match" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.linkedFixtureMatchesPlanItem)} />
                    <DetailItem label="Readiness Level" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.readinessSummary.readinessLevel} />
                  </div>
                  <div className="detail-grid">
                    <DetailItem label="운영자 승인" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.operatorApprovalPersisted ? "저장됨" : "저장 전"} />
                    <DetailItem label="LLM 호출" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.llmGenerationFlagEnabled ? "켜짐" : "꺼짐"} />
                    <DetailItem label="본문 생성" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.draftGenerationFlagEnabled ? "켜짐" : "꺼짐"} />
                    <DetailItem label="content_items 수정" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.contentMutationAllowed ? "허용" : "없음"} />
                    <DetailItem label="Blogger 쓰기" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.bloggerWriteAllowed ? "허용" : "없음"} />
                    <DetailItem label="발행 실행" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.publishExecutionAllowed ? "허용" : "꺼짐"} />
                    <DetailItem label="예약 발행" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.scheduledPublishAllowed ? "허용" : "꺼짐"} />
                    <DetailItem label="Draft Content" value={draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureHasNoDraftMarkdown && draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureHasNoDraftHtml ? "비어 있음" : "이미 있음"} />
                  </div>
                  <ValidationList
                    title="Missing Requirements"
                    items={draftGenerationReadinessResult.draftGenerationReadinessSummary.missingRequirements}
                    emptyText="missing requirement가 없습니다."
                    isWarning
                  />
                  <details className="read-block">
                    <summary>초안 생성 준비 기술 상세</summary>
                    <div className="detail-grid">
                      <DetailItem label="Fixture Not Published" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureNotPublished)} />
                      <DetailItem label="Fixture Not Scheduled" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureNotScheduled)} />
                      <DetailItem label="No Draft Markdown" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureHasNoDraftMarkdown)} />
                      <DetailItem label="No Draft HTML" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.fixtureHasNoDraftHtml)} />
                      <DetailItem label="Requires Human Approval" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.checks.planRequiresHumanApproval)} />
                      <DetailItem label="DB Read" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.dbRead)} />
                      <DetailItem label="DB Write" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.dbWrite)} />
                      <DetailItem label="Content Generation" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.contentGeneration)} />
                      <DetailItem label="LLM Call" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.llmCall)} />
                      <DetailItem label="Content Mutation" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.contentMutation)} />
                      <DetailItem label="Blogger Write" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.bloggerWrite)} />
                      <DetailItem label="Blogger Publish" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.bloggerPublish)} />
                      <DetailItem label="Token Refresh" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.tokenRefresh)} />
                      <DetailItem label="OAuth Reconnect" value={String(draftGenerationReadinessResult.draftGenerationReadinessSummary.sideEffectSummary.oauthReconnect)} />
                    </div>
                    <ValidationList
                      title="Draft-generation Readiness Blocking Reasons"
                      items={draftGenerationReadinessResult.draftGenerationReadinessSummary.blockingReasons}
                      emptyText="blocking reason이 없습니다."
                      isError
                    />
                    <ValidationList
                      title="Draft-generation Readiness Warnings"
                      items={draftGenerationReadinessResult.draftGenerationReadinessSummary.warnings}
                      emptyText="warning이 없습니다."
                      isWarning
                    />
                  </details>
                </>
              ) : (
                <div className="notice">후보 큐에서 linked content item이 있는 행의 “초안 생성 사전 점검”을 실행하세요. 이 버튼은 보기 전용 preflight만 호출합니다.</div>
              )}
            </div>

            <details className="read-block">
              <summary>기술 상세</summary>
              <div className="detail-grid">
                <DetailItem label="Mode" value={dailyContentPlanSummary.mode} />
                <DetailItem label="Plan Version" value={dailyContentPlanSummary.planVersion} />
                <DetailItem label="Plan Mode" value={dailyContentPlanSummary.planMode} />
                <DetailItem label="Target Blogger Blog" value={dailyContentPlanSummary.targetBloggerBlogName ?? "-"} />
                <DetailItem label="Target Blogger Blog ID" value={dailyContentPlanSummary.targetBloggerBlogId || "-"} />
                <DetailItem label="Target Blogger Blog URL" value={dailyContentPlanSummary.targetBloggerBlogUrl ?? "-"} />
                <DetailItem label="Profile Found" value={String(dailyContentPlanSummary.profileFound)} />
                <DetailItem label="Profile Healthy" value={String(dailyContentPlanSummary.profileHealthy)} />
                <DetailItem label="Would Create" value={String(dailyContentPlanSummary.planWouldBeCreated)} />
                <DetailItem label="Would Update" value={String(dailyContentPlanSummary.planWouldBeUpdated)} />
                <DetailItem label="Existing Plan Found" value={String(dailyContentPlanSummary.existingPlanFound)} />
                <DetailItem label="Persisted Item Count" value={String(dailyContentPlanSummary.persistedItemCount)} />
                <DetailItem label="Persisted Approval Required" value={String(dailyContentPlanSummary.persistedApprovalRequiredCount)} />
                <DetailItem label="Persisted Generation Allowed" value={String(dailyContentPlanSummary.persistedGenerationAllowedCount)} />
                <DetailItem label="Persisted Publish Allowed" value={String(dailyContentPlanSummary.persistedPublishExecutionAllowedCount)} />
                <DetailItem label="Persisted Schedule Allowed" value={String(dailyContentPlanSummary.persistedScheduledPublishAllowedCount)} />
              </div>
              <ValidationList title="Daily Content Plan Blocking Reasons" items={dailyContentPlanSummary.blockingReasons} emptyText="blocking reason이 없습니다." isError />
              <ValidationList title="Daily Content Plan Warnings" items={dailyContentPlanSummary.warnings} emptyText="warning이 없습니다." isWarning />
              <div className="detail-grid">
                <DetailItem label="DB Read" value={String(dailyContentPlanSummary.sideEffectSummary.dbRead)} />
                <DetailItem label="DB Write" value={String(dailyContentPlanSummary.sideEffectSummary.dbWrite)} />
                <DetailItem label="Schema Migration" value={String(dailyContentPlanSummary.sideEffectSummary.schemaMigration)} />
                <DetailItem label="Blogger Write" value={String(dailyContentPlanSummary.sideEffectSummary.bloggerWrite)} />
                <DetailItem label="Blogger Publish" value={String(dailyContentPlanSummary.sideEffectSummary.bloggerPublish)} />
                <DetailItem label="Blogger Draft Save" value={String(dailyContentPlanSummary.sideEffectSummary.bloggerDraftSave)} />
                <DetailItem label="Token Refresh" value={String(dailyContentPlanSummary.sideEffectSummary.tokenRefresh)} />
                <DetailItem label="OAuth Reconnect" value={String(dailyContentPlanSummary.sideEffectSummary.oauthReconnect)} />
                <DetailItem label="Content Generation" value={String(dailyContentPlanSummary.sideEffectSummary.contentGeneration)} />
                <DetailItem label="Content Mutation" value={String(dailyContentPlanSummary.sideEffectSummary.contentMutation)} />
                <DetailItem label="Approval Mutation" value={String(dailyContentPlanSummary.sideEffectSummary.approvalMutation)} />
                <DetailItem label="Attempt Mutation" value={String(dailyContentPlanSummary.sideEffectSummary.attemptMutation)} />
                <DetailItem label="LLM Call" value={String(dailyContentPlanSummary.sideEffectSummary.llmCall)} />
              </div>
              <div className="detail-grid">
                <DetailItem label="No Content Generation" value={String(dailyContentPlanSummary.guardrailSummary.noContentGeneration)} />
                <DetailItem label="No LLM Call" value={String(dailyContentPlanSummary.guardrailSummary.noLlmCall)} />
                <DetailItem label="No Content Mutation" value={String(dailyContentPlanSummary.guardrailSummary.noContentItemMutation)} />
                <DetailItem label="No Blogger Write" value={String(dailyContentPlanSummary.guardrailSummary.noBloggerWrite)} />
                <DetailItem label="No Publish Execution" value={String(dailyContentPlanSummary.guardrailSummary.noPublishExecution)} />
                <DetailItem label="No Scheduled Publish" value={String(dailyContentPlanSummary.guardrailSummary.noScheduledPublish)} />
                <DetailItem label="Profile Policy Used" value={String(dailyContentPlanSummary.guardrailSummary.profilePolicyUsed)} />
              </div>
            </details>
          </div>
        ) : (
          <div className="notice">Connection List에서 verified Blogger Blog가 있는 connection의 Daily Plan Preview를 실행하세요.</div>
        )}
      </section>

      {statusPreview ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>Status Preview</h2>
              <p className="muted">저장된 DB 상태만 표시합니다. Blogger API read-only 조회는 별도 버튼으로 수행합니다.</p>
            </div>
          </div>
          <div className="detail-grid">
            <DetailItem label="Status" value={statusPreview.status} />
            <DetailItem label="Blogger Blog ID" value={statusPreview.bloggerBlogId ?? "-"} />
            <DetailItem label="Blogger Blog Name" value={statusPreview.bloggerBlogName ?? "-"} />
            <DetailItem label="Blogger Blog URL" value={statusPreview.bloggerBlogUrl ?? "-"} />
            <DetailItem label="Blogger Blog Verified" value={statusPreview.bloggerBlogVerifiedAt ? new Date(statusPreview.bloggerBlogVerifiedAt).toLocaleString() : "-"} />
            <DetailItem label="Connected Email" value={statusPreview.connectedEmail ?? "-"} />
            <DetailItem label="Client Secret" value={statusPreview.hasClientSecret ? "placeholder exists" : "not configured"} />
            <DetailItem label="Access Token" value={statusPreview.hasAccessToken ? `placeholder (${statusPreview.tokenLast4 ?? "last4 unknown"})` : "not configured"} />
            <DetailItem label="Refresh Token" value={statusPreview.hasRefreshToken ? "placeholder exists" : "not configured"} />
            <DetailItem label="OAuth Implemented" value={statusPreview.oauthImplemented ? "yes" : "no"} />
            <DetailItem label="Blogger Read-only API" value={statusPreview.bloggerApiImplemented ? "blog list only" : "no"} />
            <DetailItem label="Publish Implemented" value={statusPreview.publishImplemented ? "yes" : "no"} />
          </div>
          {statusPreview.lastError ? <div className="notice error">{statusPreview.lastError}</div> : null}
        </section>
      ) : null}

      {secretStatus || secretSelfTest || tokenRefreshResult ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>Token Storage Security</h2>
              <p className="muted">Token exchange 결과는 encrypted metadata로만 확인합니다. Access token 원문은 서버 내부 read-only Blogger API 호출에만 사용됩니다.</p>
            </div>
          </div>
          {secretStatus ? (
            <>
              <div className="detail-grid">
                <DetailItem label="Connection ID" value={secretStatus.connectionId} />
                <DetailItem label="Client Secret" value={secretStatus.hasClientSecret ? "encrypted metadata exists" : "not stored"} />
                <DetailItem label="Access Token" value={secretStatus.hasAccessToken ? `encrypted metadata exists (${secretStatus.tokenLast4 ?? "last4 unknown"})` : "not stored"} />
                <DetailItem label="Refresh Token" value={secretStatus.hasRefreshToken ? "encrypted metadata exists" : "not stored"} />
                <DetailItem label="Access Token Expires" value={secretStatus.accessTokenExpiresAt ? new Date(secretStatus.accessTokenExpiresAt).toLocaleString() : "-"} />
                <DetailItem label="Secret Material Returned" value={secretStatus.secretMaterialReturned ? "yes" : "no"} />
                <DetailItem label="Token Exchange" value={secretStatus.tokenExchangeImplemented ? "implemented" : "not implemented"} />
                <DetailItem label="Blogger Read-only API" value={secretStatus.bloggerApiImplemented ? "blog list only" : "not implemented"} />
              </div>
              {secretStatus.secrets.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Kind</th>
                      <th>Key Version</th>
                      <th>Last 4</th>
                      <th>Token Type</th>
                      <th>Expires</th>
                      <th>Scopes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secretStatus.secrets.map((secret) => (
                      <tr key={secret.id}>
                        <td>{secret.secretKind}</td>
                        <td>{secret.keyVersion}</td>
                        <td>{secret.last4 ?? "-"}</td>
                        <td>{secret.tokenType ?? "-"}</td>
                        <td>{secret.expiresAt ? new Date(secret.expiresAt).toLocaleString() : "-"}</td>
                        <td>{secret.scopes.length > 0 ? secret.scopes.join(", ") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="notice">저장된 Blogger encrypted secret metadata가 없습니다.</div>
              )}
              <div className="notice">이 응답은 token, client secret, 암호문 원문을 반환하지 않습니다.</div>
            </>
          ) : null}
          {secretSelfTest ? (
            <div className={secretSelfTest.selfTestPassed ? "notice success" : "notice"}>
              {secretSelfTest.message} Secret material returned: {secretSelfTest.secretMaterialReturned ? "yes" : "no"}.
            </div>
          ) : null}
          {tokenRefreshResult ? (
            <div className="read-block">
              <h3>Access Token Refresh Result</h3>
              <div className={tokenRefreshResult.tokenRefreshSummary.refreshOk ? "notice success" : "notice warning"}>
                <strong>{tokenRefreshResult.tokenRefreshSummary.refreshOk ? "Access token refresh succeeded" : "Access token refresh did not complete"}</strong>
                <p>Google OAuth token endpoint만 호출합니다. Blogger read/write, publish, posts.update, draft save, content mutation은 수행하지 않습니다.</p>
                <p>응답은 token/client secret 원문과 Google raw response body를 반환하지 않습니다.</p>
              </div>
              <div className="detail-grid">
                <DetailItem label="Connection ID" value={tokenRefreshResult.tokenRefreshSummary.connectionId} />
                <DetailItem label="Reason" value={tokenRefreshResult.tokenRefreshSummary.reason} />
                <DetailItem label="Refresh Attempted" value={String(tokenRefreshResult.tokenRefreshSummary.refreshAttempted)} />
                <DetailItem label="Refresh OK" value={String(tokenRefreshResult.tokenRefreshSummary.refreshOk)} />
                <DetailItem label="Refresh Blocked" value={String(tokenRefreshResult.tokenRefreshSummary.refreshBlocked)} />
                <DetailItem label="Has Refresh Token" value={String(tokenRefreshResult.tokenRefreshSummary.hasRefreshToken)} />
                <DetailItem label="Has Client Secret Ref" value={String(tokenRefreshResult.tokenRefreshSummary.hasClientSecretRef)} />
                <DetailItem label="Client Secret Configured" value={String(tokenRefreshResult.tokenRefreshSummary.clientSecretConfigured)} />
                <DetailItem label="Old Access Token State" value={tokenRefreshResult.tokenRefreshSummary.oldAccessTokenState} />
                <DetailItem label="New Access Token State" value={tokenRefreshResult.tokenRefreshSummary.newAccessTokenState} />
                <DetailItem label="Access Token Updated" value={String(tokenRefreshResult.tokenRefreshSummary.accessTokenUpdated)} />
                <DetailItem label="Refresh Token Updated" value={String(tokenRefreshResult.tokenRefreshSummary.refreshTokenUpdated)} />
                <DetailItem label="Expires At" value={tokenRefreshResult.tokenRefreshSummary.expiresAt ? new Date(tokenRefreshResult.tokenRefreshSummary.expiresAt).toLocaleString() : "-"} />
                <DetailItem label="Token Last 4" value={tokenRefreshResult.tokenRefreshSummary.tokenLast4 ?? "-"} />
                <DetailItem label="DB Write" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.dbWrite)} />
                <DetailItem label="Google Token Endpoint" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.googleTokenEndpointCall)} />
                <DetailItem label="Blogger Read" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerRead)} />
                <DetailItem label="Blogger Write" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerWrite)} />
                <DetailItem label="Blogger Publish" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerPublish)} />
                <DetailItem label="Blogger Update" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerUpdate)} />
                <DetailItem label="Blogger Draft Save" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.bloggerDraftSave)} />
                <DetailItem label="OAuth Reconnect" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.oauthReconnect)} />
                <DetailItem label="Content Mutation" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.contentMutation)} />
                <DetailItem label="Approval Mutation" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.approvalMutation)} />
                <DetailItem label="Attempt Mutation" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.attemptMutation)} />
                <DetailItem label="LLM Call" value={String(tokenRefreshResult.tokenRefreshSummary.sideEffectSummary.llmCall)} />
              </div>
              <ValidationList title="Token Refresh Blocking Reasons" items={tokenRefreshResult.tokenRefreshSummary.blockingReasons} emptyText="blocking reason이 없습니다." isError />
              <ValidationList title="Token Refresh Warnings" items={tokenRefreshResult.tokenRefreshSummary.warnings} emptyText="warning이 없습니다." isWarning />
            </div>
          ) : null}
        </section>
      ) : null}

      {oauthDryRun ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>OAuth Dry Run</h2>
              <p className="muted">Authorization URL을 생성합니다. Callback에서는 token exchange를 수행하며, Blogger API는 read-only blog list 조회만 별도 버튼으로 수행합니다.</p>
            </div>
          </div>
          <div className="detail-grid">
            <DetailItem label="Dry Run" value={oauthDryRun.oauthDryRun ? "yes" : "no"} />
            <DetailItem label="Token Exchange" value={oauthDryRun.tokenExchangeImplemented ? "implemented" : "not implemented"} />
            <DetailItem label="Blogger API During OAuth" value={oauthDryRun.bloggerApiImplemented ? "implemented" : "not called"} />
            <DetailItem label="Expires At" value={new Date(oauthDryRun.expiresAt).toLocaleString()} />
            <DetailItem label="Redirect URI" value={oauthDryRun.redirectUri} />
          </div>
          <label className="admin-form full-span">
            Authorization URL
            <textarea readOnly value={oauthDryRun.authorizationUrl} />
          </label>
          <div className="notice">
            URL에는 OAuth state가 포함되지만 stateHash는 응답하지 않습니다. Callback은 authorization code를 token으로 교환하며 code/token 원문을 저장하거나 표시하지 않습니다.
          </div>
        </section>
      ) : null}

      {blogListResult ? (
        <section className="admin-section">
          <div className="section-heading">
            <div>
              <h2>Blogger Blog List</h2>
              <p className="muted">이 조회는 read-only이며 Blogger draft/publish를 수행하지 않습니다.</p>
            </div>
          </div>
          <div className="detail-grid">
            <DetailItem label="Connection ID" value={blogListResult.connectionId} />
            <DetailItem label="Read Only" value={blogListResult.readOnly ? "yes" : "no"} />
            <DetailItem label="Token Refresh" value={blogListResult.tokenRefreshImplemented ? "implemented" : "not implemented"} />
            <DetailItem label="Draft/Publish" value={blogListResult.draftPublishImplemented ? "implemented" : "not implemented"} />
            <DetailItem label="Status Suggestion" value={blogListResult.statusSuggestion} />
            <DetailItem label="Fetched At" value={new Date(blogListResult.metadata.fetchedAt).toLocaleString()} />
          </div>
          <div className="notice">
            token refresh는 Settings의 Access Token Refresh 버튼으로만 수동 실행합니다. Blog list 조회는 자동 refresh를 수행하지 않으며 Blogger draft/publish도 실행하지 않습니다.
          </div>
          {blogListResult.blogs.length > 0 ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Blog ID</th>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Published</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blogListResult.blogs.map((blog) => {
                  const selected = activeBlogListConnection?.bloggerBlogId === blog.id && Boolean(activeBlogListConnection.bloggerBlogVerifiedAt);
                  return (
                    <tr key={blog.id}>
                      <td>{blog.id}</td>
                      <td>{blog.name}</td>
                      <td>{blog.url ?? "-"}</td>
                      <td>{blog.published ? new Date(blog.published).toLocaleString() : "-"}</td>
                      <td>{blog.updated ? new Date(blog.updated).toLocaleString() : "-"}</td>
                      <td>
                        <button className="button secondary" type="button" disabled={selectingBlogId === blog.id || selected} onClick={() => void selectBloggerBlog(blog.id)}>
                          {selected ? "선택됨" : selectingBlogId === blog.id ? "선택 중" : "이 블로그 선택"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="notice">조회된 Blogger blog가 없습니다.</div>
          )}
        </section>
      ) : null}
    </>
  );
}

function toForm(connection: BloggerConnectionAdmin): BloggerConnectionForm {
  return {
    id: connection.id,
    name: connection.name,
    blogId: connection.blogId ?? "",
    status: connection.status,
    bloggerBlogId: connection.bloggerBlogId ?? "",
    bloggerBlogName: connection.bloggerBlogName ?? "",
    bloggerBlogUrl: connection.bloggerBlogUrl ?? "",
    bloggerBlogVerifiedAt: connection.bloggerBlogVerifiedAt ?? "",
    connectedEmail: connection.connectedEmail ?? "",
    scopes: formatListInput(connection.scopes),
    oauthClientIdRef: connection.oauthClientIdRef ?? "",
    clientSecretRef: connection.clientSecretRef ?? "",
    hasClientSecret: connection.hasClientSecret,
    hasAccessToken: connection.hasAccessToken,
    hasRefreshToken: connection.hasRefreshToken,
    tokenLast4: connection.tokenLast4 ?? "",
    lastError: connection.lastError ?? ""
  };
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function formatNullableBoolean(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }
  return value ? "true" : "false";
}

function getTodayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function getDailyPlanSlotLabel(slotKey: string) {
  const labels: Record<string, string> = {
    morning_education: "오전 교육형",
    midday_checklist: "점심 체크리스트",
    evening_risk_review: "저녁 리스크 복기"
  };
  return labels[slotKey] ?? slotKey;
}

function getDailyPlanItemStatus(item: DailyContentPlanQueueItem) {
  return "status" in item ? item.status : "preview";
}

function getDailyPlanItemId(item: DailyContentPlanQueueItem) {
  return "id" in item ? item.id : null;
}

function getDailyPlanItemContentItemId(item: DailyContentPlanQueueItem) {
  return "contentItemId" in item ? item.contentItemId : null;
}

function formatDisabledFlag(value: boolean) {
  return value ? "켜짐" : "꺼짐";
}

function formatOperatorApprovalState(value: string) {
  const labels: Record<string, string> = {
    ready_for_operator_review: "운영자 검토 가능",
    waiting_for_content_fixture: "content fixture 대기",
    blocked_by_guardrail: "가드레일 차단"
  };
  return labels[value] ?? value;
}

function ValidationList({ title, items, emptyText, isError, isWarning }: { title: string; items: string[]; emptyText: string; isError?: boolean; isWarning?: boolean }) {
  const className = isError ? "notice error" : isWarning ? "notice warning" : "notice";
  return (
    <div className={className}>
      <strong>{title}</strong>
      {items.length > 0 ? (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}
