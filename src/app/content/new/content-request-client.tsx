"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { BlogAdmin } from "@/lib/blogs/admin-types";
import type { BrandProfileAdmin } from "@/lib/brands/admin-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { CONTENT_MODE_OPTIONS, CONTENT_STATUS_OPTIONS, getContentModeHint, getContentModeLabel } from "@/lib/content/constants";
import type { ContentMode, ContentStatus } from "@/lib/content/types";
import { ApiResult, optionalString, requestJson } from "@/lib/form-utils";

interface ContentFormState {
  id?: string;
  blogId: string;
  brandProfileId: string;
  mode: ContentMode | "";
  title: string;
  targetKeyword: string;
  sourceMemo: string;
  status: ContentStatus;
}

const emptyContentForm: ContentFormState = {
  blogId: "",
  brandProfileId: "",
  mode: "",
  title: "",
  targetKeyword: "",
  sourceMemo: "",
  status: "idea"
};

export function ContentRequestClient() {
  const [blogs, setBlogs] = useState<BlogAdmin[]>([]);
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileAdmin[]>([]);
  const [contentItems, setContentItems] = useState<ContentItemAdmin[]>([]);
  const [form, setForm] = useState<ContentFormState>(emptyContentForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blogById = useMemo(() => new Map(blogs.map((blog) => [blog.id, blog])), [blogs]);
  const brandById = useMemo(() => new Map(brandProfiles.map((brand) => [brand.id, brand])), [brandProfiles]);
  const modeHint = getContentModeHint(form.mode);
  const guidance = getGuidance(form);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [blogResult, brandResult, contentResult] = await Promise.all([
        requestJson<ApiResult<BlogAdmin[]>>("/api/blogs"),
        requestJson<ApiResult<BrandProfileAdmin[]>>("/api/brand-profiles"),
        requestJson<ApiResult<ContentItemAdmin[]>>("/api/content-items")
      ]);

      setBlogs(blogResult.data);
      setBrandProfiles(brandResult.data);
      setContentItems(contentResult.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글 생성 요청 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function submitContentRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.mode) {
      setError("mode는 필수입니다.");
      return;
    }

    if (!form.sourceMemo.trim() && !form.targetKeyword.trim()) {
      setError("sourceMemo 또는 targetKeyword 중 하나 이상 필요합니다.");
      return;
    }

    const payload = {
      blogId: optionalString(form.blogId),
      brandProfileId: optionalString(form.brandProfileId),
      mode: form.mode,
      title: optionalString(form.title),
      targetKeyword: optionalString(form.targetKeyword),
      sourceMemo: optionalString(form.sourceMemo),
      status: form.status
    };

    setSaving(true);
    try {
      await requestJson<ApiResult<ContentItemAdmin>>(form.id ? `/api/content-items/${form.id}` : "/api/content-items", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setForm(emptyContentForm);
      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글 생성 요청을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContentRequest(item: ContentItemAdmin) {
    const title = item.title || item.targetKeyword || item.id;
    if (!window.confirm(`Delete content request "${title}"?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await requestJson<ApiResult<{ id: string }>>(`/api/content-items/${item.id}`, { method: "DELETE" });
      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글 생성 요청을 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Patch 5</span>
        <h1>글 생성 요청</h1>
        <p className="muted">블로그, 서비스/브랜드, 모드, 키워드와 메모를 저장하고 후속 패치에서 기획서 생성을 연결합니다.</p>
        <button className="button secondary" type="button" disabled>
          기획서 생성은 후속 패치에서 연결 예정
        </button>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="notice">글 생성 요청 데이터를 불러오는 중입니다.</div> : null}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Content Request</h2>
            <p className="muted">
              기본 상태는 idea입니다. planned/drafted 등은 후속 생성 단계에서 전환할 예정입니다.
            </p>
          </div>
        </div>

        <form className="admin-form" onSubmit={(event) => void submitContentRequest(event)}>
          <label>
            Blog
            <select value={form.blogId} onChange={(event) => setForm({ ...form, blogId: event.target.value })}>
              <option value="">선택 안 함</option>
              {blogs.map((blog) => (
                <option key={blog.id} value={blog.id}>
                  {blog.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Brand Profile
            <select value={form.brandProfileId} onChange={(event) => setForm({ ...form, brandProfileId: event.target.value })}>
              <option value="">선택 안 함</option>
              {brandProfiles.map((brandProfile) => (
                <option key={brandProfile.id} value={brandProfile.id}>
                  {brandProfile.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mode
            <select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as ContentMode })}>
              <option value="">선택</option>
              {CONTENT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}>
              {CONTENT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label>
            Target Keyword
            <input value={form.targetKeyword} onChange={(event) => setForm({ ...form, targetKeyword: event.target.value })} />
          </label>
          <label className="textarea-field">
            Source Memo
            <textarea value={form.sourceMemo} onChange={(event) => setForm({ ...form, sourceMemo: event.target.value })} />
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving}>
              {form.id ? "요청 수정" : "요청 저장"}
            </button>
            {form.id ? (
              <button className="button secondary" type="button" onClick={() => setForm(emptyContentForm)}>
                취소
              </button>
            ) : null}
          </div>
        </form>

        {modeHint ? <div className="notice">{modeHint}</div> : null}
        {guidance ? <div className="notice">{guidance}</div> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Blog</th>
                <th>Brand</th>
                <th>Target Keyword</th>
                <th>Source Memo</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contentItems.length === 0 ? (
                <tr>
                  <td colSpan={9}>저장된 글 생성 요청이 없습니다.</td>
                </tr>
              ) : (
                contentItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title ?? "-"}</td>
                    <td>{getContentModeLabel(item.mode)}</td>
                    <td>{item.status}</td>
                    <td>{item.blog?.name ?? lookupBlogName(item.blogId, blogById)}</td>
                    <td>{item.brandProfile?.name ?? lookupBrandName(item.brandProfileId, brandById)}</td>
                    <td>{item.targetKeyword ?? "-"}</td>
                    <td>{summarize(item.sourceMemo)}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td className="action-cell">
                      <button className="button small secondary" type="button" onClick={() => editContentRequest(item)}>
                        수정
                      </button>
                      <button className="button small danger" type="button" onClick={() => void deleteContentRequest(item)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  function editContentRequest(item: ContentItemAdmin) {
    setForm({
      id: item.id,
      blogId: item.blogId ?? "",
      brandProfileId: item.brandProfileId ?? "",
      mode: item.mode,
      title: item.title ?? "",
      targetKeyword: item.targetKeyword ?? "",
      sourceMemo: item.sourceMemo ?? "",
      status: item.status
    });
  }
}

function getGuidance(form: ContentFormState) {
  if (form.mode === "seo_keyword" && !form.targetKeyword.trim()) {
    return "seo_keyword 모드에서는 targetKeyword 입력을 권장합니다.";
  }
  if (form.mode === "service_promotion" && !form.brandProfileId) {
    return "service_promotion 모드에서는 서비스/브랜드 프로필 선택을 권장합니다.";
  }
  return "";
}

function lookupBlogName(blogId: string | null, blogById: Map<string, BlogAdmin>) {
  if (!blogId) {
    return "-";
  }
  return blogById.get(blogId)?.name ?? blogId;
}

function lookupBrandName(brandProfileId: string | null, brandById: Map<string, BrandProfileAdmin>) {
  if (!brandProfileId) {
    return "-";
  }
  return brandById.get(brandProfileId)?.name ?? brandProfileId;
}

function summarize(value: string | null) {
  if (!value) {
    return "-";
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 110 ? `${normalized.slice(0, 110)}...` : normalized;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
