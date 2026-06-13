"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { BlogAdmin } from "@/lib/blogs/admin-types";
import type { BrandProfileAdmin } from "@/lib/brands/admin-types";
import {
  CONTENT_ASSET_PLACEMENTS,
  type ContentAssetAdmin,
  type ContentAssetMetadataSuggestion,
  type ContentAssetPlacement
} from "@/lib/content/asset-types";
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

interface AssetFormState {
  caption: string;
  altText: string;
  userNote: string;
  placementHint: ContentAssetPlacement;
  sortOrder: string;
  isPrimary: boolean;
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

const emptyAssetForm: AssetFormState = {
  caption: "",
  altText: "",
  userNote: "",
  placementHint: "gallery",
  sortOrder: "0",
  isPrimary: false
};

export function ContentRequestClient() {
  const [blogs, setBlogs] = useState<BlogAdmin[]>([]);
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileAdmin[]>([]);
  const [contentItems, setContentItems] = useState<ContentItemAdmin[]>([]);
  const [assets, setAssets] = useState<ContentAssetAdmin[]>([]);
  const [form, setForm] = useState<ContentFormState>(emptyContentForm);
  const [assetForm, setAssetForm] = useState<AssetFormState>(emptyAssetForm);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [selectedContentItemId, setSelectedContentItemId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assetSaving, setAssetSaving] = useState(false);
  const [suggestingAssetId, setSuggestingAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetSuggestion, setAssetSuggestion] = useState<ContentAssetMetadataSuggestion | null>(null);

  const blogById = useMemo(() => new Map(blogs.map((blog) => [blog.id, blog])), [blogs]);
  const brandById = useMemo(() => new Map(brandProfiles.map((brand) => [brand.id, brand])), [brandProfiles]);
  const selectedContentItem = contentItems.find((item) => item.id === selectedContentItemId);
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

  const loadAssets = useCallback(async (contentItemId: string) => {
    setAssetsLoading(true);
    setAssetError(null);

    try {
      const result = await requestJson<ApiResult<ContentAssetAdmin[]>>(`/api/content-items/${contentItemId}/assets`);
      setAssets(result.data);
    } catch (caught) {
      setAssetError(caught instanceof Error ? caught.message : "첨부 미디어를 불러오지 못했습니다.");
    } finally {
      setAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedContentItemId) {
      setAssets([]);
      return;
    }

    void loadAssets(selectedContentItemId);
  }, [loadAssets, selectedContentItemId]);

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
      if (selectedContentItemId === item.id) {
        setSelectedContentItemId("");
        setAssets([]);
      }
      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글 생성 요청을 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function submitAssetUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssetError(null);

    if (!selectedContentItemId) {
      setAssetError("먼저 글 생성 요청을 선택하세요.");
      return;
    }

    const formElement = event.currentTarget;
    const fileInput = formElement.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];

    if (!file) {
      setAssetError("업로드할 파일을 선택하세요.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    appendAssetMetadata(formData, assetForm);

    setAssetSaving(true);
    try {
      await requestFormData<ApiResult<ContentAssetAdmin>>(`/api/content-items/${selectedContentItemId}/assets`, formData);
      setAssetForm(emptyAssetForm);
      formElement.reset();
      await loadAssets(selectedContentItemId);
    } catch (caught) {
      setAssetError(caught instanceof Error ? caught.message : "첨부 미디어 업로드에 실패했습니다.");
    } finally {
      setAssetSaving(false);
    }
  }

  async function submitAssetMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssetError(null);

    if (!editingAssetId || !selectedContentItemId) {
      setAssetError("수정할 첨부 미디어를 선택하세요.");
      return;
    }

    setAssetSaving(true);
    try {
      await requestJson<ApiResult<ContentAssetAdmin>>(`/api/content-assets/${editingAssetId}`, {
        method: "PATCH",
        body: JSON.stringify(toAssetPayload(assetForm))
      });
      setEditingAssetId(null);
      setAssetSuggestion(null);
      setAssetForm(emptyAssetForm);
      await loadAssets(selectedContentItemId);
    } catch (caught) {
      setAssetError(caught instanceof Error ? caught.message : "첨부 미디어 메타데이터 수정에 실패했습니다.");
    } finally {
      setAssetSaving(false);
    }
  }

  async function deleteAsset(asset: ContentAssetAdmin) {
    if (!window.confirm(`Delete asset "${asset.originalName}"?`)) {
      return;
    }

    setAssetSaving(true);
    setAssetError(null);
    try {
      await requestJson<ApiResult<{ id: string }>>(`/api/content-assets/${asset.id}`, { method: "DELETE" });
      if (editingAssetId === asset.id) {
        setEditingAssetId(null);
        setAssetSuggestion(null);
        setAssetForm(emptyAssetForm);
      }
      if (selectedContentItemId) {
        await loadAssets(selectedContentItemId);
      }
    } catch (caught) {
      setAssetError(caught instanceof Error ? caught.message : "첨부 미디어 삭제에 실패했습니다.");
    } finally {
      setAssetSaving(false);
    }
  }

  async function suggestAssetMetadata(asset: ContentAssetAdmin) {
    const hasExistingMetadata = Boolean(asset.caption || asset.altText || asset.userNote);
    if (hasExistingMetadata && !window.confirm("기존 메타데이터가 있습니다. 추천값을 편집 폼에 채울까요?")) {
      return;
    }

    setSuggestingAssetId(asset.id);
    setAssetError(null);

    try {
      const result = await requestJson<ApiResult<ContentAssetMetadataSuggestion>>(`/api/content-assets/${asset.id}/suggest-metadata`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setEditingAssetId(asset.id);
      setAssetSuggestion(result.data);
      setAssetForm({
        caption: result.data.caption,
        altText: result.data.altText,
        userNote: result.data.userNote,
        placementHint: result.data.placementHint,
        sortOrder: String(result.data.sortOrder),
        isPrimary: result.data.recommendedIsPrimary
      });
    } catch (caught) {
      setAssetError(caught instanceof Error ? caught.message : "첨부 미디어 메타데이터 추천에 실패했습니다.");
    } finally {
      setSuggestingAssetId(null);
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
                      <button className="button small secondary" type="button" onClick={() => selectContentItem(item.id)}>
                        첨부 관리
                      </button>
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

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Attached Media</h2>
            <p className="muted">사진과 동영상 파일은 로컬 저장소에 저장하고, DB에는 배치에 필요한 메타데이터만 저장합니다.</p>
            <p className="muted">대표 미디어 단일 강제는 후속 패치에서 처리 예정입니다.</p>
          </div>
        </div>

        {!selectedContentItem ? (
          <div className="notice">먼저 글 생성 요청을 선택하세요.</div>
        ) : (
          <>
            <div className="notice">선택된 요청: {selectedContentItem.title || selectedContentItem.targetKeyword || selectedContentItem.id}</div>
            {assetError ? <div className="notice error">{assetError}</div> : null}
            {assetsLoading ? <div className="notice">첨부 미디어를 불러오는 중입니다.</div> : null}

            <form className="admin-form" onSubmit={(event) => void submitAssetUpload(event)}>
              <label>
                File
                <input name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" />
              </label>
              <AssetMetadataFields form={assetForm} setForm={setAssetForm} />
              <div className="form-actions">
                <button className="button" type="submit" disabled={assetSaving}>
                  미디어 업로드
                </button>
              </div>
            </form>

            {editingAssetId ? (
              <form className="admin-form" onSubmit={(event) => void submitAssetMetadata(event)}>
                <AssetMetadataFields form={assetForm} setForm={setAssetForm} />
                <div className="form-actions">
                  <button className="button" type="submit" disabled={assetSaving}>
                    메타데이터 수정
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setEditingAssetId(null);
                      setAssetSuggestion(null);
                      setAssetForm(emptyAssetForm);
                    }}
                  >
                    취소
                  </button>
                </div>
              </form>
            ) : null}

            {assetSuggestion ? (
              <details className="notice" open>
                <summary>추천 결과 안내</summary>
                <p>추천값을 편집 폼에 채웠습니다. 확인 후 메타데이터 수정 버튼을 눌러 저장하세요.</p>
                {assetSuggestion.recommendedIsPrimary ? (
                  <p>대표 미디어 추천값이며 단일 대표 강제는 후속 패치에서 처리 예정입니다.</p>
                ) : null}
                <strong>근거</strong>
                <ul>
                  {assetSuggestion.rationale.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <strong>주의</strong>
                <ul>
                  {assetSuggestion.warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            <div className="asset-grid">
              {assets.length === 0 ? (
                <div className="notice">첨부된 미디어가 없습니다.</div>
              ) : (
                assets.map((asset) => (
                  <article className="asset-card" key={asset.id}>
                    <AssetPreview asset={asset} />
                    <div>
                      <strong>{asset.originalName}</strong>
                      <p className="muted">
                        {asset.assetType} / {formatBytes(asset.fileSize)} / {asset.placementHint} / order {asset.sortOrder}
                      </p>
                      <p>{asset.caption || "-"}</p>
                      <p className="muted">alt: {asset.altText || "-"}</p>
                      <p className="muted">note: {asset.userNote || "-"}</p>
                      <p className="muted">primary: {asset.isPrimary ? "yes" : "no"}</p>
                    </div>
                    <div className="action-cell">
                      <button
                        className="button small secondary"
                        type="button"
                        disabled={suggestingAssetId === asset.id}
                        onClick={() => void suggestAssetMetadata(asset)}
                      >
                        메타데이터 자동 추천
                      </button>
                      <button className="button small secondary" type="button" onClick={() => editAsset(asset)}>
                        수정
                      </button>
                      <button className="button small danger" type="button" onClick={() => void deleteAsset(asset)}>
                        삭제
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </section>
    </>
  );

  function selectContentItem(contentItemId: string) {
    setSelectedContentItemId(contentItemId);
    setEditingAssetId(null);
    setAssetSuggestion(null);
    setAssetForm(emptyAssetForm);
  }

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

  function editAsset(asset: ContentAssetAdmin) {
    setEditingAssetId(asset.id);
    setAssetSuggestion(null);
    setAssetForm({
      caption: asset.caption ?? "",
      altText: asset.altText ?? "",
      userNote: asset.userNote ?? "",
      placementHint: asset.placementHint,
      sortOrder: String(asset.sortOrder),
      isPrimary: asset.isPrimary
    });
  }
}

interface AssetMetadataFieldsProps {
  form: AssetFormState;
  setForm: (form: AssetFormState) => void;
}

function AssetMetadataFields({ form, setForm }: AssetMetadataFieldsProps) {
  return (
    <>
      <label>
        Caption
        <input value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} />
      </label>
      <label>
        Alt Text
        <input value={form.altText} onChange={(event) => setForm({ ...form, altText: event.target.value })} />
      </label>
      <label>
        Placement
        <select value={form.placementHint} onChange={(event) => setForm({ ...form, placementHint: event.target.value as ContentAssetPlacement })}>
          {CONTENT_ASSET_PLACEMENTS.map((placement) => (
            <option key={placement.value} value={placement.value}>
              {placement.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sort Order
        <input type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
      </label>
      <label className="textarea-field">
        User Note
        <textarea value={form.userNote} onChange={(event) => setForm({ ...form, userNote: event.target.value })} />
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={form.isPrimary} onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })} />
        Primary
      </label>
    </>
  );
}

function AssetPreview({ asset }: { asset: ContentAssetAdmin }) {
  const src = `/api/content-assets/${asset.id}/file`;

  if (asset.assetType === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="asset-preview" src={src} alt={asset.altText || asset.caption || asset.originalName} />;
  }

  return <video className="asset-preview" src={src} controls />;
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

async function requestFormData<T>(url: string, body: FormData): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    body
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error ?? message;
    } catch {
      const text = await response.text();
      if (text) {
        message = text.slice(0, 240);
      }
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function appendAssetMetadata(formData: FormData, form: AssetFormState) {
  formData.set("caption", form.caption);
  formData.set("altText", form.altText);
  formData.set("userNote", form.userNote);
  formData.set("placementHint", form.placementHint);
  formData.set("sortOrder", form.sortOrder);
  formData.set("isPrimary", String(form.isPrimary));
}

function toAssetPayload(form: AssetFormState) {
  return {
    caption: form.caption,
    altText: form.altText,
    userNote: form.userNote,
    placementHint: form.placementHint,
    sortOrder: Number.isFinite(Number(form.sortOrder)) ? Math.trunc(Number(form.sortOrder)) : 0,
    isPrimary: form.isPrimary
  };
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)}KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}
