"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { BrandProfileAdmin } from "@/lib/brands/admin-types";
import { ApiResult, formatListInput, isHttpUrl, optionalString, parseListInput, requestJson } from "@/lib/form-utils";

interface BrandProfileFormState {
  id?: string;
  name: string;
  serviceName: string;
  shortDescription: string;
  longDescription: string;
  targetUsers: string;
  coreFeatures: string;
  problemsSolved: string;
  mainUrl: string;
  ctaWeak: string;
  ctaNormal: string;
  ctaStrong: string;
  forbiddenPhrases: string;
  preferredPhrases: string;
  riskDisclaimer: string;
  isDefault: boolean;
}

const emptyBrandForm: BrandProfileFormState = {
  name: "",
  serviceName: "",
  shortDescription: "",
  longDescription: "",
  targetUsers: "",
  coreFeatures: "",
  problemsSolved: "",
  mainUrl: "",
  ctaWeak: "",
  ctaNormal: "",
  ctaStrong: "",
  forbiddenPhrases: "",
  preferredPhrases: "",
  riskDisclaimer: "",
  isDefault: false
};

export function BrandProfilesClient() {
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileAdmin[]>([]);
  const [form, setForm] = useState<BrandProfileFormState>(emptyBrandForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBrandProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await requestJson<ApiResult<BrandProfileAdmin[]>>("/api/brand-profiles");
      setBrandProfiles(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "서비스/브랜드 프로필을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrandProfiles();
  }, [loadBrandProfiles]);

  async function submitBrandProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Brand name은 필수입니다.");
      return;
    }
    if (form.mainUrl.trim() && !isHttpUrl(form.mainUrl)) {
      setError("mainUrl은 비어 있지 않은 경우 http:// 또는 https:// 형식을 권장합니다.");
      return;
    }

    const payload = {
      name,
      serviceName: optionalString(form.serviceName),
      shortDescription: optionalString(form.shortDescription),
      longDescription: optionalString(form.longDescription),
      targetUsers: parseListInput(form.targetUsers),
      coreFeatures: parseListInput(form.coreFeatures),
      problemsSolved: parseListInput(form.problemsSolved),
      mainUrl: optionalString(form.mainUrl),
      ctaWeak: optionalString(form.ctaWeak),
      ctaNormal: optionalString(form.ctaNormal),
      ctaStrong: optionalString(form.ctaStrong),
      forbiddenPhrases: parseListInput(form.forbiddenPhrases),
      preferredPhrases: parseListInput(form.preferredPhrases),
      riskDisclaimer: optionalString(form.riskDisclaimer),
      isDefault: form.isDefault
    };

    setSaving(true);
    try {
      await requestJson<ApiResult<BrandProfileAdmin>>(form.id ? `/api/brand-profiles/${form.id}` : "/api/brand-profiles", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setForm(emptyBrandForm);
      await loadBrandProfiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "서비스/브랜드 프로필을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBrandProfile(brandProfile: BrandProfileAdmin) {
    if (!window.confirm(`Delete brand profile "${brandProfile.name}"?`)) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await requestJson<ApiResult<{ id: string }>>(`/api/brand-profiles/${brandProfile.id}`, { method: "DELETE" });
      await loadBrandProfiles();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "서비스/브랜드 프로필을 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Patch 4</span>
        <h1>서비스/브랜드 프로필</h1>
        <p className="muted">콘텐츠 안에서 자연스럽게 소개할 서비스 정보, CTA, 금지표현, 리스크 고지를 DB에 저장해 관리합니다.</p>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {loading ? <div className="notice">서비스/브랜드 프로필을 불러오는 중입니다.</div> : null}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Brand Profile Details</h2>
            <p className="muted">기본 프로필 단일성은 아직 DB 제약이 없으므로 Patch 4에서는 강제하지 않습니다.</p>
          </div>
        </div>

        <form className="admin-form" onSubmit={(event) => void submitBrandProfile(event)}>
          <label>
            Name
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            Service Name
            <input value={form.serviceName} onChange={(event) => setForm({ ...form, serviceName: event.target.value })} />
          </label>
          <label>
            Main URL
            <input value={form.mainUrl} onChange={(event) => setForm({ ...form, mainUrl: event.target.value })} />
          </label>
          <label className="textarea-field">
            Short Description
            <textarea value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} />
          </label>
          <label className="textarea-field">
            Long Description
            <textarea value={form.longDescription} onChange={(event) => setForm({ ...form, longDescription: event.target.value })} />
          </label>
          <label className="textarea-field">
            Target Users
            <textarea value={form.targetUsers} onChange={(event) => setForm({ ...form, targetUsers: event.target.value })} />
          </label>
          <label className="textarea-field">
            Core Features
            <textarea value={form.coreFeatures} onChange={(event) => setForm({ ...form, coreFeatures: event.target.value })} />
          </label>
          <label className="textarea-field">
            Problems Solved
            <textarea value={form.problemsSolved} onChange={(event) => setForm({ ...form, problemsSolved: event.target.value })} />
          </label>
          <label className="textarea-field">
            CTA Weak
            <textarea value={form.ctaWeak} onChange={(event) => setForm({ ...form, ctaWeak: event.target.value })} />
          </label>
          <label className="textarea-field">
            CTA Normal
            <textarea value={form.ctaNormal} onChange={(event) => setForm({ ...form, ctaNormal: event.target.value })} />
          </label>
          <label className="textarea-field">
            CTA Strong
            <textarea value={form.ctaStrong} onChange={(event) => setForm({ ...form, ctaStrong: event.target.value })} />
          </label>
          <label className="textarea-field">
            Forbidden Phrases
            <textarea value={form.forbiddenPhrases} onChange={(event) => setForm({ ...form, forbiddenPhrases: event.target.value })} />
          </label>
          <label className="textarea-field">
            Preferred Phrases
            <textarea value={form.preferredPhrases} onChange={(event) => setForm({ ...form, preferredPhrases: event.target.value })} />
          </label>
          <label className="textarea-field">
            Risk Disclaimer
            <textarea value={form.riskDisclaimer} onChange={(event) => setForm({ ...form, riskDisclaimer: event.target.value })} />
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
            Default
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving}>
              {form.id ? "Brand 수정" : "Brand 생성"}
            </button>
            {form.id ? (
              <button className="button secondary" type="button" onClick={() => setForm(emptyBrandForm)}>
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
                <th>Service</th>
                <th>Main URL</th>
                <th>Description</th>
                <th>Default</th>
                <th>CTA</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {brandProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7}>등록된 서비스/브랜드 프로필이 없습니다.</td>
                </tr>
              ) : (
                brandProfiles.map((brandProfile) => (
                  <tr key={brandProfile.id}>
                    <td>{brandProfile.name}</td>
                    <td>{brandProfile.serviceName ?? "-"}</td>
                    <td>{brandProfile.mainUrl ?? "-"}</td>
                    <td>{brandProfile.shortDescription ?? "-"}</td>
                    <td>{brandProfile.isDefault ? "yes" : "no"}</td>
                    <td>{formatCtaState(brandProfile)}</td>
                    <td className="action-cell">
                      <button className="button small secondary" type="button" onClick={() => editBrandProfile(brandProfile)}>
                        수정
                      </button>
                      <button className="button small danger" type="button" onClick={() => void deleteBrandProfile(brandProfile)}>
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

  function editBrandProfile(brandProfile: BrandProfileAdmin) {
    setForm({
      id: brandProfile.id,
      name: brandProfile.name,
      serviceName: brandProfile.serviceName ?? "",
      shortDescription: brandProfile.shortDescription ?? "",
      longDescription: brandProfile.longDescription ?? "",
      targetUsers: formatListInput(brandProfile.targetUsers),
      coreFeatures: formatListInput(brandProfile.coreFeatures),
      problemsSolved: formatListInput(brandProfile.problemsSolved),
      mainUrl: brandProfile.mainUrl ?? "",
      ctaWeak: brandProfile.ctaWeak ?? "",
      ctaNormal: brandProfile.ctaNormal ?? "",
      ctaStrong: brandProfile.ctaStrong ?? "",
      forbiddenPhrases: formatListInput(brandProfile.forbiddenPhrases),
      preferredPhrases: formatListInput(brandProfile.preferredPhrases),
      riskDisclaimer: brandProfile.riskDisclaimer ?? "",
      isDefault: brandProfile.isDefault
    });
  }
}

function formatCtaState(brandProfile: BrandProfileAdmin) {
  const values = [
    brandProfile.ctaWeak ? "weak" : null,
    brandProfile.ctaNormal ? "normal" : null,
    brandProfile.ctaStrong ? "strong" : null
  ].filter(Boolean);

  return values.length > 0 ? values.join(", ") : "-";
}
