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
  BloggerSecretSelfTestResult
} from "@/lib/blogger/admin-types";
import type { BlogAdmin } from "@/lib/blogs/admin-types";
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
  const [oauthDryRun, setOauthDryRun] = useState<BloggerOAuthStartDryRun | null>(null);
  const [blogListResult, setBlogListResult] = useState<BloggerBlogListResult | null>(null);
  const [blogListLoadingId, setBlogListLoadingId] = useState<string | null>(null);
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
                      <button className="button secondary" type="button" onClick={() => void createOAuthDryRun(connection)}>
                        OAuth URL 생성
                      </button>
                      <button className="button secondary" type="button" disabled={blogListLoadingId === connection.id} onClick={() => void loadBloggerBlogs(connection)}>
                        {blogListLoadingId === connection.id ? "조회 중" : "Blogger 목록 조회"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
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

      {secretStatus || secretSelfTest ? (
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
            token refresh는 아직 구현되지 않았습니다. Blogger blog 선택 반영은 후속 Patch 9D-2에서 처리 예정입니다.
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
