"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BlogAdmin } from "@/lib/blogs/admin-types";
import type { BrandProfileAdmin } from "@/lib/brands/admin-types";
import type { GuidedSeoArticlePrepResponse } from "@/lib/content/guided-seo-article-prep";
import { ApiResult, requestJson } from "@/lib/form-utils";

const steps = ["글 형태", "주제", "자료", "구성", "생성 확인", "완료"] as const;
const articleTypes = [
  { id: "seo_info", label: "SEO 정보글", description: "검색 유입을 목표로 문제와 해결 순서를 설명합니다." },
  { id: "service_guide", label: "서비스 가이드", description: "서비스 사용 상황과 장점을 자연스럽게 연결합니다." },
  { id: "comparison", label: "비교/체크리스트", description: "선택 기준, 확인표, 실수 방지 흐름을 정리합니다." },
  { id: "issue_explainer", label: "이슈 해설", description: "현재 이슈를 배경, 영향, 확인 기준으로 풀어냅니다." },
  { id: "finance_caution", label: "금융 주의형", description: "투자 판단 기준과 위험 고지를 보수적으로 포함합니다." }
] as const;
const sourceModes = [
  { id: "manual_memo", label: "직접 메모", description: "내가 적은 메모와 관점만 사용합니다." },
  { id: "reference_urls", label: "참고 URL", description: "참고 링크를 메모로 남기고, 문장 복사는 하지 않습니다." },
  { id: "saved_materials", label: "저장 자료", description: "나중에 첨부/저장 자료를 연결할 수 있게 메모합니다." },
  { id: "no_materials", label: "자료 없이 시작", description: "기본 SEO 구조로 먼저 초안을 준비합니다." }
] as const;

type ArticleTypeId = (typeof articleTypes)[number]["id"];
type SourceModeId = (typeof sourceModes)[number]["id"];

interface WizardForm {
  articleType: ArticleTypeId;
  sourceMode: SourceModeId;
  blogId: string;
  brandProfileId: string;
  targetKeyword: string;
  title: string;
  audience: string;
  tone: string;
  sourceMemo: string;
  includeFaq: boolean;
  includeCta: boolean;
  includeRiskDisclaimer: boolean;
}

const initialForm: WizardForm = {
  articleType: "seo_info",
  sourceMode: "manual_memo",
  blogId: "",
  brandProfileId: "",
  targetKeyword: "급등주 알림",
  title: "",
  audience: "주식 초보자",
  tone: "차분하고 실무적인 설명",
  sourceMemo: "",
  includeFaq: true,
  includeCta: true,
  includeRiskDisclaimer: true
};

export function NewArticleWizardClient() {
  const [stepIndex, setStepIndex] = useState(0);
  const [blogs, setBlogs] = useState<BlogAdmin[]>([]);
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileAdmin[]>([]);
  const [form, setForm] = useState<WizardForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuidedSeoArticlePrepResponse | null>(null);

  const titleCandidate = form.title.trim() || `${form.targetKeyword.trim() || "급등주 알림"}을 봤을 때 바로 사지 말고 확인할 7가지`;
  const selectedArticleType = articleTypes.find((type) => type.id === form.articleType) ?? articleTypes[0];
  const selectedSourceMode = sourceModes.find((mode) => mode.id === form.sourceMode) ?? sourceModes[0];
  const canContinue = useMemo(() => {
    if (stepIndex === 1) {
      return Boolean(form.targetKeyword.trim());
    }
    if (stepIndex === 4) {
      return Boolean(form.blogId && form.brandProfileId && form.targetKeyword.trim());
    }
    return true;
  }, [form.blogId, form.brandProfileId, form.targetKeyword, stepIndex]);

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
      setError(caught instanceof Error ? caught.message : "설정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function runGeneration() {
    setError(null);
    setResult(null);

    if (!form.blogId || !form.brandProfileId) {
      setError("Blog와 Brand Profile 설정이 필요합니다. 설정 화면에서 먼저 등록하세요.");
      return;
    }

    const memo = buildSourceMemo(form, selectedArticleType.label, selectedSourceMode.label);
    setRunning(true);
    try {
      const response = await requestJson<ApiResult<GuidedSeoArticlePrepResponse>>("/api/content-items/guided-seo-article-prep", {
        method: "POST",
        body: JSON.stringify({
          blogId: form.blogId,
          brandProfileId: form.brandProfileId,
          targetKeyword: form.targetKeyword,
          title: titleCandidate,
          sourceMemo: memo
        })
      });
      setResult(response.data);
      setStepIndex(5);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "새 글 생성 준비에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">9G-7 wizard</span>
        <h1>새 글 만들기 마법사</h1>
        <p className="muted">글 형태, 주제, 자료, 구성을 순서대로 확인한 뒤 새 글 후보를 만듭니다. Blogger 저장/발행은 자동 실행하지 않습니다.</p>
      </section>

      <WizardSteps current={stepIndex} />
      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="notice">기본 설정을 불러오는 중입니다.</div> : null}

      <section className="admin-section">
        {stepIndex === 0 ? (
          <OptionStep
            title="어떤 형태의 글을 쓸까요?"
            description="글의 목적을 먼저 정하면 목차와 CTA 방향이 덜 흔들립니다."
            options={articleTypes}
            selected={form.articleType}
            onSelect={(articleType) => setForm({ ...form, articleType })}
          />
        ) : null}

        {stepIndex === 1 ? (
          <>
            <div className="section-heading">
              <div>
                <h2>무슨 내용을 쓸까요?</h2>
                <p className="muted">검색 키워드, 독자, 톤을 정합니다.</p>
              </div>
            </div>
            <div className="admin-form">
              <label>
                Target Keyword
                <input value={form.targetKeyword} onChange={(event) => setForm({ ...form, targetKeyword: event.target.value })} />
              </label>
              <label>
                Title
                <input placeholder={titleCandidate} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </label>
              <label>
                독자
                <input value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} />
              </label>
              <label>
                톤
                <input value={form.tone} onChange={(event) => setForm({ ...form, tone: event.target.value })} />
              </label>
            </div>
          </>
        ) : null}

        {stepIndex === 2 ? (
          <>
            <OptionStep
              title="자료는 어떻게 수집할까요?"
              description="참고 URL을 쓰더라도 문장 복사나 경쟁 글 재작성은 하지 않습니다."
              options={sourceModes}
              selected={form.sourceMode}
              onSelect={(sourceMode) => setForm({ ...form, sourceMode })}
            />
            <label className="full-span" style={{ display: "grid", gap: 8, marginTop: 16 }}>
              자료/메모
              <textarea
                value={form.sourceMemo}
                onChange={(event) => setForm({ ...form, sourceMemo: event.target.value })}
                placeholder="참고할 관점, URL, 반드시 포함할 내용, 피해야 할 표현을 적으세요."
                style={{ minHeight: 140 }}
              />
            </label>
          </>
        ) : null}

        {stepIndex === 3 ? (
          <>
            <div className="section-heading">
              <div>
                <h2>구성 옵션</h2>
                <p className="muted">SEO 글로 최소한 갖춰야 할 장치를 확인합니다.</p>
              </div>
            </div>
            <div className="card-grid">
              <label className="card">
                <input type="checkbox" checked={form.includeFaq} onChange={(event) => setForm({ ...form, includeFaq: event.target.checked })} /> FAQ 포함
              </label>
              <label className="card">
                <input type="checkbox" checked={form.includeCta} onChange={(event) => setForm({ ...form, includeCta: event.target.checked })} /> CTA 포함
              </label>
              <label className="card">
                <input
                  type="checkbox"
                  checked={form.includeRiskDisclaimer}
                  onChange={(event) => setForm({ ...form, includeRiskDisclaimer: event.target.checked })}
                />{" "}
                금융/투자 주의문구 포함
              </label>
            </div>
          </>
        ) : null}

        {stepIndex === 4 ? (
          <SummaryStep
            titleCandidate={titleCandidate}
            articleType={selectedArticleType.label}
            sourceMode={selectedSourceMode.label}
            form={form}
            blogs={blogs}
            brandProfiles={brandProfiles}
          />
        ) : null}

        {stepIndex === 5 && result ? (
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
            <div className="button-row">
              <Link className="button" href={`/wizard/edit/${result.contentItemId}`}>
                수정 마법사로 이동
              </Link>
              <Link className="button secondary" href={`/wizard/publish/${result.contentItemId}`}>
                발행 준비 마법사로 이동
              </Link>
              <Link className="button secondary" href={result.links.contentDetail}>
                상세 화면
              </Link>
            </div>
          </div>
        ) : null}

        <div className="button-row" style={{ marginTop: 18 }}>
          <button className="button secondary" type="button" disabled={stepIndex === 0 || running} onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}>
            이전
          </button>
          {stepIndex < 4 ? (
            <button className="button" type="button" disabled={!canContinue || running} onClick={() => setStepIndex(Math.min(4, stepIndex + 1))}>
              다음
            </button>
          ) : null}
          {stepIndex === 4 ? (
            <button className="button" type="button" disabled={!canContinue || running || loading} onClick={() => void runGeneration()}>
              {running ? "생성 중" : "진행"}
            </button>
          ) : null}
          {stepIndex === 5 ? (
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setResult(null);
                setStepIndex(0);
              }}
            >
              새 글 하나 더 만들기
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}

function WizardSteps({ current }: { current: number }) {
  return (
    <section className="card-grid" style={{ marginTop: 16 }}>
      {steps.map((step, index) => (
        <div className="card" key={step}>
          <span className={`status-pill ${index === current ? "status-connected" : index < current ? "status-connected" : ""}`}>
            {index < current ? "완료" : index === current ? "진행 중" : "대기"}
          </span>
          <h2>{index + 1}. {step}</h2>
        </div>
      ))}
    </section>
  );
}

function OptionStep<T extends string>({
  title,
  description,
  options,
  selected,
  onSelect
}: {
  title: string;
  description: string;
  options: ReadonlyArray<{ id: T; label: string; description: string }>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>
      <div className="card-grid">
        {options.map((option) => (
          <button
            className={`card ${selected === option.id ? "selected-card" : ""}`}
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            style={{ textAlign: "left", cursor: "pointer" }}
          >
            <h2>{option.label}</h2>
            <p className="muted">{option.description}</p>
          </button>
        ))}
      </div>
    </>
  );
}

function SummaryStep({
  titleCandidate,
  articleType,
  sourceMode,
  form,
  blogs,
  brandProfiles
}: {
  titleCandidate: string;
  articleType: string;
  sourceMode: string;
  form: WizardForm;
  blogs: BlogAdmin[];
  brandProfiles: BrandProfileAdmin[];
}) {
  const blogName = blogs.find((blog) => blog.id === form.blogId)?.name ?? "미선택";
  const brandName = brandProfiles.find((brand) => brand.id === form.brandProfileId)?.name ?? "미선택";

  return (
    <>
      <div className="section-heading">
        <div>
          <h2>생성 전 확인</h2>
          <p className="muted">진행을 누르면 새 content item 1개와 draftMarkdown/draftHtml 후보가 저장됩니다.</p>
        </div>
      </div>
      <div className="read-block">
        <p><strong>제목</strong>: {titleCandidate}</p>
        <p><strong>키워드</strong>: {form.targetKeyword}</p>
        <p><strong>형태</strong>: {articleType}</p>
        <p><strong>자료 방식</strong>: {sourceMode}</p>
        <p><strong>독자/톤</strong>: {form.audience} / {form.tone}</p>
        <p><strong>Blog/Brand</strong>: {blogName} / {brandName}</p>
        <p><strong>구성</strong>: FAQ {form.includeFaq ? "포함" : "제외"} / CTA {form.includeCta ? "포함" : "제외"} / 주의문구{" "}
          {form.includeRiskDisclaimer ? "포함" : "제외"}</p>
        <div className="notice">
          Blogger API, draft save, publish, token refresh, LLM 호출은 실행하지 않습니다. 생성 후 수정/발행 준비 마법사로 이어갑니다.
        </div>
      </div>
    </>
  );
}

function buildSourceMemo(form: WizardForm, articleTypeLabel: string, sourceModeLabel: string) {
  return [
    `글 형태: ${articleTypeLabel}`,
    `자료 방식: ${sourceModeLabel}`,
    `독자: ${form.audience}`,
    `톤: ${form.tone}`,
    `FAQ 포함: ${form.includeFaq ? "yes" : "no"}`,
    `CTA 포함: ${form.includeCta ? "yes" : "no"}`,
    `금융/투자 주의문구 포함: ${form.includeRiskDisclaimer ? "yes" : "no"}`,
    form.sourceMemo.trim() ? `사용자 메모:\n${form.sourceMemo.trim()}` : "사용자 메모: 없음"
  ].join("\n");
}
