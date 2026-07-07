"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BlogAdmin } from "@/lib/blogs/admin-types";
import type { BrandProfileAdmin } from "@/lib/brands/admin-types";
import type { GuidedSeoArticlePrepResponse } from "@/lib/content/guided-seo-article-prep";
import { ApiResult, requestJson } from "@/lib/form-utils";

interface SimpleAutomationForm {
  blogId: string;
  brandProfileId: string;
  targetKeyword: string;
  title: string;
  sourceMemo: string;
}

const initialForm: SimpleAutomationForm = {
  blogId: "",
  brandProfileId: "",
  targetKeyword: "급등주 알림",
  title: "",
  sourceMemo: ""
};

export function SimpleAutomationClient() {
  const [blogs, setBlogs] = useState<BlogAdmin[]>([]);
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileAdmin[]>([]);
  const [form, setForm] = useState<SimpleAutomationForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuidedSeoArticlePrepResponse | null>(null);

  const selectedBlog = useMemo(() => blogs.find((blog) => blog.id === form.blogId), [blogs, form.blogId]);
  const selectedBrand = useMemo(
    () => brandProfiles.find((brandProfile) => brandProfile.id === form.brandProfileId),
    [brandProfiles, form.brandProfileId]
  );
  const titleCandidate = form.title.trim() || `${form.targetKeyword.trim() || "급등주 알림"}을 봤을 때 바로 사지 말고 확인할 7가지`;
  const settingsReady = blogs.length > 0 && brandProfiles.length > 0;
  const canRun = settingsReady && Boolean(form.blogId) && Boolean(form.brandProfileId) && !running && !loading;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [blogResult, brandResult] = await Promise.all([
        requestJson<ApiResult<BlogAdmin[]>>("/api/blogs"),
        requestJson<ApiResult<BrandProfileAdmin[]>>("/api/brand-profiles")
      ]);

      setBlogs(blogResult.data);
      setBrandProfiles(brandResult.data);
      setForm((current) => ({
        ...current,
        blogId: current.blogId || blogResult.data[0]?.id || "",
        brandProfileId: current.brandProfileId || brandResult.data.find((brand) => brand.isDefault)?.id || brandResult.data[0]?.id || ""
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "기본 설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function runSimplePrep() {
    setError(null);
    setResult(null);

    if (!form.blogId || !form.brandProfileId) {
      setError("Blog와 Brand Profile 설정이 필요합니다. 설정 화면에서 먼저 1회 등록하세요.");
      return;
    }

    setRunning(true);
    try {
      const response = await requestJson<ApiResult<GuidedSeoArticlePrepResponse>>("/api/content-items/guided-seo-article-prep", {
        method: "POST",
        body: JSON.stringify({
          blogId: form.blogId,
          brandProfileId: form.brandProfileId,
          targetKeyword: form.targetKeyword.trim() || "급등주 알림",
          title: titleCandidate,
          sourceMemo: form.sourceMemo.trim() || undefined
        })
      });
      setResult(response.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "새 글 준비에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Simple mode</span>
        <h1>간편 자동화</h1>
        <p className="muted">
          설정은 별도 화면에 두고, 여기서는 새 SEO 글 1개를 준비하는 흐름만 실행합니다. Blogger 저장/발행/토큰 갱신은 이 화면에서 자동 실행하지 않습니다.
        </p>
        <div className="button-row">
          <Link className="button secondary" href="/settings/blogger">
            Blogger 설정
          </Link>
          <Link className="button secondary" href="/settings/llm">
            LLM 설정
          </Link>
          <Link className="button secondary" href="/blogs">
            Blog 설정
          </Link>
          <Link className="button secondary" href="/brands">
            Brand 설정
          </Link>
        </div>
      </section>

      <section className="card-grid" style={{ marginTop: 16 }}>
        <StepCard title="1. 기본 설정" status={settingsReady ? "ready" : "blocked"}>
          {settingsReady ? "Blog와 Brand Profile을 불러왔습니다." : "Blog와 Brand Profile이 필요합니다."}
        </StepCard>
        <StepCard title="2. 새 글 준비" status={result ? "ready" : canRun ? "ready" : "waiting"}>
          키워드로 planned content item, draftMarkdown, draftHtml 후보를 만듭니다.
        </StepCard>
        <StepCard title="3. 발행 준비" status={result ? "waiting" : "waiting"}>
          생성된 글 상세에서 approval, preflight, draft save 순서로 진행합니다.
        </StepCard>
      </section>

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>새 글 1개 준비</h2>
            <p className="muted">복잡한 상세 옵션 없이 키워드와 제목만 정하면 됩니다. 제목을 비워두면 기본 SEO 제목을 사용합니다.</p>
          </div>
          <button className="button secondary" type="button" onClick={() => void loadSettings()} disabled={loading || running}>
            설정 새로고침
          </button>
        </div>

        {loading ? <div className="notice">기본 설정을 불러오는 중입니다.</div> : null}
        {error ? <div className="notice error">{error}</div> : null}

        {!settingsReady ? (
          <div className="notice warning">
            글 준비를 시작하려면 Blog와 Brand Profile이 필요합니다. 설정은 한 번만 해두고, 이후에는 이 화면에서 바로 새 글을 만들 수 있습니다.
          </div>
        ) : null}

        <form className="admin-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Blog
            <select value={form.blogId} onChange={(event) => setForm({ ...form, blogId: event.target.value })}>
              {blogs.map((blog) => (
                <option key={blog.id} value={blog.id}>
                  {blog.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Brand
            <select value={form.brandProfileId} onChange={(event) => setForm({ ...form, brandProfileId: event.target.value })}>
              {brandProfiles.map((brandProfile) => (
                <option key={brandProfile.id} value={brandProfile.id}>
                  {brandProfile.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target Keyword
            <input value={form.targetKeyword} onChange={(event) => setForm({ ...form, targetKeyword: event.target.value })} />
          </label>
          <label>
            Title
            <input
              placeholder={titleCandidate}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label className="textarea-field">
            참고 메모
            <textarea
              placeholder="글에 반영할 관점이나 금지할 표현이 있으면 적어두세요."
              value={form.sourceMemo}
              onChange={(event) => setForm({ ...form, sourceMemo: event.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="button" type="button" onClick={() => void runSimplePrep()} disabled={!canRun}>
              {running ? "새 글 준비 중" : "새 글 준비"}
            </button>
          </div>
        </form>

        <div className="notice">
          선택된 설정: Blog <strong>{selectedBlog?.name ?? "-"}</strong> / Brand <strong>{selectedBrand?.name ?? "-"}</strong>. 이 버튼은 content item을 새로 만들고
          draftMarkdown/draftHtml 후보를 준비합니다. Blogger API, draft save, publish, token refresh, LLM 호출은 실행하지 않습니다.
        </div>

        {result ? (
          <div className="notice success">
            <strong>새 글 준비 완료</strong>
            <p>{result.title}</p>
            <p>
              본문 길이 {result.visibleTextLength}자 / Quality {result.qualitySummary.grade} {result.qualitySummary.scorePreview}점 / SEO editorial{" "}
              {result.qualitySummary.seoEditorialGrade} {result.qualitySummary.seoEditorialScore}점
            </p>
            <p>
              다음 단계: {result.workflowNextAction.label} - {result.workflowNextAction.action}
            </p>
            <p>
              안전 확인: Blogger write {String(result.sideEffectSummary.bloggerApiWrite)} / publish {String(result.sideEffectSummary.bloggerPublish)} / token refresh{" "}
              {String(result.sideEffectSummary.tokenRefresh)} / LLM {String(result.sideEffectSummary.llmCall)}
            </p>
            <div className="button-row">
              <Link className="button" href={result.links.contentDetail}>
                글 상세에서 발행 준비
              </Link>
              <Link className="button secondary" href="/auto">
                같은 화면에서 계속 준비
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

function StepCard({ title, status, children }: { title: string; status: "ready" | "waiting" | "blocked"; children: ReactNode }) {
  const label = status === "ready" ? "준비됨" : status === "blocked" ? "필요" : "대기";

  return (
    <div className="card">
      <span className={`status-pill ${status === "ready" ? "status-connected" : status === "blocked" ? "status-error" : ""}`}>{label}</span>
      <h2>{title}</h2>
      <p className="muted">{children}</p>
    </div>
  );
}
