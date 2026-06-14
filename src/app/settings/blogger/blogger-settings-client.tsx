"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { BloggerConnectionAdmin, BloggerConnectionStatus, BloggerConnectionStatusSummary } from "@/lib/blogger/admin-types";
import type { BlogAdmin } from "@/lib/blogs/admin-types";
import { ApiResult, formatListInput, optionalString, parseListInput, requestJson } from "@/lib/form-utils";

interface BloggerConnectionForm {
  id?: string;
  name: string;
  blogId: string;
  status: BloggerConnectionStatus;
  bloggerBlogId: string;
  bloggerBlogName: string;
  connectedEmail: string;
  scopes: string;
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
  connectedEmail: "",
  scopes: "https://www.googleapis.com/auth/blogger",
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
      bloggerBlogId: optionalString(form.bloggerBlogId),
      bloggerBlogName: optionalString(form.bloggerBlogName),
      connectedEmail: optionalString(form.connectedEmail),
      scopes: parseListInput(form.scopes),
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
      setNotice("Blogger connection placeholder를 저장했습니다. OAuth/API 호출은 수행하지 않았습니다.");
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
      setNotice("저장된 Blogger connection 상태만 조회했습니다. Blogger API는 호출하지 않았습니다.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blogger connection status 조회에 실패했습니다.");
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Patch 9A</span>
        <h1>Blogger 설정</h1>
        <p className="muted">
          Blogger OAuth/API 구현 전 connection placeholder와 연결 상태 메타데이터만 관리합니다. Token, client secret, Blogger API 응답 원문은 저장하거나 표시하지 않습니다.
        </p>
        <div className="button-row">
          <button className="button secondary" type="button" disabled>
            OAuth 시작은 Patch 9B 이후
          </button>
          <button className="button secondary" type="button" disabled>
            Blogger 연결 테스트 비활성
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
            <p className="muted">안전한 설정 필드만 저장합니다. 실제 OAuth callback, token 발급, blog list 조회는 아직 연결하지 않습니다.</p>
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
          <label>
            Blogger Blog ID
            <input value={form.bloggerBlogId} onChange={(event) => setForm({ ...form, bloggerBlogId: event.target.value })} />
          </label>
          <label>
            Blogger Blog Name
            <input value={form.bloggerBlogName} onChange={(event) => setForm({ ...form, bloggerBlogName: event.target.value })} />
          </label>
          <label>
            Connected Email
            <input value={form.connectedEmail} onChange={(event) => setForm({ ...form, connectedEmail: event.target.value })} />
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
                  </td>
                  <td>
                    client secret: {connection.hasClientSecret ? "yes" : "no"}
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
              <p className="muted">저장된 DB 상태만 표시합니다. Google OAuth와 Blogger API를 호출하지 않습니다.</p>
            </div>
          </div>
          <div className="detail-grid">
            <DetailItem label="Status" value={statusPreview.status} />
            <DetailItem label="Blogger Blog ID" value={statusPreview.bloggerBlogId ?? "-"} />
            <DetailItem label="Blogger Blog Name" value={statusPreview.bloggerBlogName ?? "-"} />
            <DetailItem label="Connected Email" value={statusPreview.connectedEmail ?? "-"} />
            <DetailItem label="Client Secret" value={statusPreview.hasClientSecret ? "placeholder exists" : "not configured"} />
            <DetailItem label="Access Token" value={statusPreview.hasAccessToken ? `placeholder (${statusPreview.tokenLast4 ?? "last4 unknown"})` : "not configured"} />
            <DetailItem label="Refresh Token" value={statusPreview.hasRefreshToken ? "placeholder exists" : "not configured"} />
            <DetailItem label="OAuth Implemented" value={statusPreview.oauthImplemented ? "yes" : "no"} />
            <DetailItem label="Blogger API Implemented" value={statusPreview.bloggerApiImplemented ? "yes" : "no"} />
            <DetailItem label="Publish Implemented" value={statusPreview.publishImplemented ? "yes" : "no"} />
          </div>
          {statusPreview.lastError ? <div className="notice error">{statusPreview.lastError}</div> : null}
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
    connectedEmail: connection.connectedEmail ?? "",
    scopes: formatListInput(connection.scopes),
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
