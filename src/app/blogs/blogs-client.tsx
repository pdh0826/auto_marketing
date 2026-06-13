"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { BlogAdmin, BlogStatus, CtaStrength } from "@/lib/blogs/admin-types";
import { ApiResult, formatListInput, isHttpUrl, optionalString, parseListInput, requestJson } from "@/lib/form-utils";

interface BlogFormState {
  id?: string;
  name: string;
  url: string;
  bloggerBlogId: string;
  mainTopic: string;
  subTopics: string;
  targetReader: string;
  tone: string;
  locale: string;
  forbiddenPhrases: string;
  preferredPhrases: string;
  defaultContentLength: string;
  defaultCtaStrength: CtaStrength;
  dailyPublishLimit: string;
  nightExcludeStart: string;
  nightExcludeEnd: string;
  autoPublishEnabled: boolean;
  manualApprovalRequired: boolean;
  status: BlogStatus;
}

const emptyBlogForm: BlogFormState = {
  name: "",
  url: "",
  bloggerBlogId: "",
  mainTopic: "",
  subTopics: "",
  targetReader: "",
  tone: "",
  locale: "ko-KR",
  forbiddenPhrases: "",
  preferredPhrases: "",
  defaultContentLength: "1200",
  defaultCtaStrength: "normal",
  dailyPublishLimit: "1",
  nightExcludeStart: "",
  nightExcludeEnd: "",
  autoPublishEnabled: false,
  manualApprovalRequired: true,
  status: "active"
};

export function BlogsClient() {
  const [blogs, setBlogs] = useState<BlogAdmin[]>([]);
  const [form, setForm] = useState<BlogFormState>(emptyBlogForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBlogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestJson<ApiResult<BlogAdmin[]>>("/api/blogs");
      setBlogs(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "블로그 프로필을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBlogs();
  }, [loadBlogs]);

  async function submitBlog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = form.name.trim();
    const url = form.url.trim();
    if (!name) {
      setError("Blog name은 필수입니다.");
      return;
    }
    if (!url) {
      setError("Blog url은 필수입니다.");
      return;
    }
    if (!isHttpUrl(url)) {
      setError("Blog url은 http:// 또는 https:// 형식을 권장합니다.");
      return;
    }

    const defaultContentLength = Number(form.defaultContentLength);
    if (!Number.isFinite(defaultContentLength) || defaultContentLength <= 0) {
      setError("defaultContentLength는 양수여야 합니다.");
      return;
    }

    const dailyPublishLimit = Number(form.dailyPublishLimit);
    if (!Number.isFinite(dailyPublishLimit) || dailyPublishLimit < 0) {
      setError("dailyPublishLimit은 0 이상이어야 합니다. 0은 발행하지 않는 정책값으로 해석합니다.");
      return;
    }

    const payload = {
      name,
      url,
      bloggerBlogId: optionalString(form.bloggerBlogId),
      mainTopic: optionalString(form.mainTopic),
      subTopics: parseListInput(form.subTopics),
      targetReader: optionalString(form.targetReader),
      tone: optionalString(form.tone),
      locale: form.locale.trim() || "ko-KR",
      forbiddenPhrases: parseListInput(form.forbiddenPhrases),
      preferredPhrases: parseListInput(form.preferredPhrases),
      defaultContentLength: Math.trunc(defaultContentLength),
      defaultCtaStrength: form.defaultCtaStrength,
      dailyPublishLimit: Math.trunc(dailyPublishLimit),
      nightExcludeStart: optionalString(form.nightExcludeStart),
      nightExcludeEnd: optionalString(form.nightExcludeEnd),
      autoPublishEnabled: form.autoPublishEnabled,
      manualApprovalRequired: form.manualApprovalRequired,
      status: form.status
    };

    setSaving(true);
    try {
      await requestJson<ApiResult<BlogAdmin>>(form.id ? `/api/blogs/${form.id}` : "/api/blogs", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setForm(emptyBlogForm);
      await loadBlogs();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "블로그 프로필을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBlog(blog: BlogAdmin) {
    if (!window.confirm(`Delete blog profile "${blog.name}"?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await requestJson<ApiResult<{ id: string }>>(`/api/blogs/${blog.id}`, { method: "DELETE" });
      await loadBlogs();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "블로그 프로필을 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Patch 4</span>
        <h1>블로그 프로필</h1>
        <p className="muted">Blogger 연결 전 블로그별 주제, 문체, 금지표현, 발행 정책값을 DB에 저장해 관리합니다.</p>
        <button className="button secondary" type="button" disabled>
          Blogger OAuth 후속 패치
        </button>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="notice">블로그 프로필을 불러오는 중입니다.</div> : null}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Blog Details</h2>
            <p className="muted">자동 발행 설정은 정책 설정값이며 실제 자동 발행은 후속 패치에서 연결 예정입니다.</p>
          </div>
        </div>

        <form className="admin-form" onSubmit={(event) => void submitBlog(event)}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            URL
            <input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} />
          </label>
          <label>
            Blogger Blog ID
            <input value={form.bloggerBlogId} onChange={(event) => setForm({ ...form, bloggerBlogId: event.target.value })} />
          </label>
          <label>
            Main Topic
            <input value={form.mainTopic} onChange={(event) => setForm({ ...form, mainTopic: event.target.value })} />
          </label>
          <label>
            Target Reader
            <input value={form.targetReader} onChange={(event) => setForm({ ...form, targetReader: event.target.value })} />
          </label>
          <label>
            Tone
            <input value={form.tone} onChange={(event) => setForm({ ...form, tone: event.target.value })} />
          </label>
          <label>
            Locale
            <input value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })} />
          </label>
          <label>
            Default Content Length
            <input
              min={1}
              type="number"
              value={form.defaultContentLength}
              onChange={(event) => setForm({ ...form, defaultContentLength: event.target.value })}
            />
          </label>
          <label>
            Default CTA Strength
            <select
              value={form.defaultCtaStrength}
              onChange={(event) => setForm({ ...form, defaultCtaStrength: event.target.value as CtaStrength })}
            >
              <option value="weak">weak</option>
              <option value="normal">normal</option>
              <option value="strong">strong</option>
            </select>
          </label>
          <label>
            Daily Publish Limit
            <input
              min={0}
              type="number"
              value={form.dailyPublishLimit}
              onChange={(event) => setForm({ ...form, dailyPublishLimit: event.target.value })}
            />
          </label>
          <label>
            Night Exclude Start
            <input type="time" value={form.nightExcludeStart} onChange={(event) => setForm({ ...form, nightExcludeStart: event.target.value })} />
          </label>
          <label>
            Night Exclude End
            <input type="time" value={form.nightExcludeEnd} onChange={(event) => setForm({ ...form, nightExcludeEnd: event.target.value })} />
          </label>
          <label>
            Status
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BlogStatus })}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <label className="textarea-field">
            Sub Topics
            <textarea value={form.subTopics} onChange={(event) => setForm({ ...form, subTopics: event.target.value })} />
          </label>
          <label className="textarea-field">
            Forbidden Phrases
            <textarea value={form.forbiddenPhrases} onChange={(event) => setForm({ ...form, forbiddenPhrases: event.target.value })} />
          </label>
          <label className="textarea-field">
            Preferred Phrases
            <textarea value={form.preferredPhrases} onChange={(event) => setForm({ ...form, preferredPhrases: event.target.value })} />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.autoPublishEnabled}
              onChange={(event) => setForm({ ...form, autoPublishEnabled: event.target.checked })}
            />
            Auto Publish Enabled
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.manualApprovalRequired}
              onChange={(event) => setForm({ ...form, manualApprovalRequired: event.target.checked })}
            />
            Manual Approval Required
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving}>
              {form.id ? "Blog 수정" : "Blog 생성"}
            </button>
            {form.id ? (
              <button className="button secondary" type="button" onClick={() => setForm(emptyBlogForm)}>
                취소
              </button>
            ) : null}
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>URL</th>
                <th>Main Topic</th>
                <th>Locale</th>
                <th>CTA</th>
                <th>Limit</th>
                <th>Approval</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {blogs.length === 0 ? (
                <tr>
                  <td colSpan={9}>등록된 블로그 프로필이 없습니다.</td>
                </tr>
              ) : (
                blogs.map((blog) => (
                  <tr key={blog.id}>
                    <td>{blog.name}</td>
                    <td>{blog.url}</td>
                    <td>{blog.mainTopic ?? "-"}</td>
                    <td>{blog.locale}</td>
                    <td>{blog.defaultCtaStrength}</td>
                    <td>{blog.dailyPublishLimit}</td>
                    <td>{blog.manualApprovalRequired ? "required" : "optional"}</td>
                    <td>{blog.status}</td>
                    <td className="action-cell">
                      <button className="button small secondary" type="button" onClick={() => editBlog(blog)}>
                        수정
                      </button>
                      <button className="button small danger" type="button" onClick={() => void deleteBlog(blog)}>
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

  function editBlog(blog: BlogAdmin) {
    setForm({
      id: blog.id,
      name: blog.name,
      url: blog.url,
      bloggerBlogId: blog.bloggerBlogId ?? "",
      mainTopic: blog.mainTopic ?? "",
      subTopics: formatListInput(blog.subTopics),
      targetReader: blog.targetReader ?? "",
      tone: blog.tone ?? "",
      locale: blog.locale,
      forbiddenPhrases: formatListInput(blog.forbiddenPhrases),
      preferredPhrases: formatListInput(blog.preferredPhrases),
      defaultContentLength: String(blog.defaultContentLength),
      defaultCtaStrength: blog.defaultCtaStrength,
      dailyPublishLimit: String(blog.dailyPublishLimit),
      nightExcludeStart: blog.nightExcludeStart ?? "",
      nightExcludeEnd: blog.nightExcludeEnd ?? "",
      autoPublishEnabled: blog.autoPublishEnabled,
      manualApprovalRequired: blog.manualApprovalRequired,
      status: blog.status
    });
  }
}
