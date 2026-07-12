"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { LlmCallLogAdmin, LlmModelAdmin, LlmProviderAdmin, LlmTaskRouteAdmin } from "@/lib/llm/admin-types";
import {
  getApiFormatLabel,
  getInvocationModeLabel,
  getProviderTypeLabel,
  getTaskLabel,
  LLM_API_FORMATS,
  LLM_INVOCATION_MODES,
  LLM_PROVIDER_TYPES,
  LLM_ROUTE_TASK_TYPES
} from "@/lib/llm/constants";
import type { LlmApiFormat, LlmInvocationMode, LlmProviderType, LlmTaskType } from "@/lib/llm/types";

interface ApiResult<T> {
  data: T;
}

interface ProviderFormState {
  id?: string;
  name: string;
  providerType: LlmProviderType | "";
  invocationMode: LlmInvocationMode;
  apiFormat: LlmApiFormat;
  baseUrl: string;
  endpointPath: string;
  defaultModel: string;
  headersJson: string;
  requestTemplateJson: string;
  cliExecutable: string;
  cliArgsJson: string;
  secretRef: string;
  apiKey: string;
  isEnabled: boolean;
  timeoutSeconds: string;
  maxRetries: string;
}

interface ModelFormState {
  id?: string;
  providerId: string;
  name: string;
  displayName: string;
  isDefault: boolean;
  isEnabled: boolean;
}

interface RouteFormState {
  id?: string;
  taskType: LlmTaskType | "";
  primaryProviderId: string;
  primaryModelId: string;
  fallbackProviderId: string;
  fallbackModelId: string;
  temperature: string;
  maxTokens: string;
  timeoutSeconds: string;
  isEnabled: boolean;
}

const emptyProviderForm: ProviderFormState = {
  name: "",
  providerType: "",
  invocationMode: "external_http",
  apiFormat: "openai_compatible",
  baseUrl: "",
  endpointPath: "/v1/chat/completions",
  defaultModel: "",
  headersJson: "{}",
  requestTemplateJson: "{}",
  cliExecutable: "",
  cliArgsJson: "[]",
  secretRef: "",
  apiKey: "",
  isEnabled: true,
  timeoutSeconds: "60",
  maxRetries: "1"
};

const emptyModelForm: ModelFormState = {
  providerId: "",
  name: "",
  displayName: "",
  isDefault: false,
  isEnabled: true
};

const emptyRouteForm: RouteFormState = {
  taskType: "",
  primaryProviderId: "",
  primaryModelId: "",
  fallbackProviderId: "",
  fallbackModelId: "",
  temperature: "",
  maxTokens: "",
  timeoutSeconds: "",
  isEnabled: true
};

export function LlmSettingsClient() {
  const [providers, setProviders] = useState<LlmProviderAdmin[]>([]);
  const [models, setModels] = useState<LlmModelAdmin[]>([]);
  const [routes, setRoutes] = useState<LlmTaskRouteAdmin[]>([]);
  const [logs, setLogs] = useState<LlmCallLogAdmin[]>([]);
  const [providerForm, setProviderForm] = useState<ProviderFormState>(emptyProviderForm);
  const [modelForm, setModelForm] = useState<ModelFormState>(emptyModelForm);
  const [routeForm, setRouteForm] = useState<RouteFormState>(emptyRouteForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const modelById = useMemo(() => new Map(models.map((model) => [model.id, model])), [models]);
  const providerById = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const primaryModelOptions = models.filter((model) => model.providerId === routeForm.primaryProviderId);
  const fallbackModelOptions = models.filter((model) => model.providerId === routeForm.fallbackProviderId);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [providerResult, modelResult, routeResult, logResult] = await Promise.all([
        requestJson<ApiResult<LlmProviderAdmin[]>>("/api/settings/llm/providers"),
        requestJson<ApiResult<LlmModelAdmin[]>>("/api/settings/llm/models"),
        requestJson<ApiResult<LlmTaskRouteAdmin[]>>("/api/settings/llm/task-routes"),
        requestJson<ApiResult<LlmCallLogAdmin[]>>("/api/settings/llm/call-logs")
      ]);

      setProviders(providerResult.data);
      setModels(modelResult.data);
      setRoutes(routeResult.data);
      setLogs(logResult.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "LLM settings data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function submitProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!providerForm.name.trim()) {
      setError("Provider name is required.");
      return;
    }
    if (!providerForm.providerType) {
      setError("Provider type is required.");
      return;
    }
    if (!providerForm.invocationMode) {
      setError("Provider invocationMode is required.");
      return;
    }
    if (!providerForm.apiFormat) {
      setError("Provider apiFormat is required.");
      return;
    }

    const timeoutSeconds = Number(providerForm.timeoutSeconds);
    const maxRetries = Number(providerForm.maxRetries);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      setError("Provider timeoutSeconds must be positive.");
      return;
    }
    if (!Number.isFinite(maxRetries) || maxRetries < 0) {
      setError("Provider maxRetries must be 0 or greater.");
      return;
    }

    const headersJson = parseJsonObjectInput(providerForm.headersJson, "headersJson");
    if (!headersJson.ok) {
      setError(headersJson.error);
      return;
    }
    const requestTemplateJson = parseJsonObjectInput(providerForm.requestTemplateJson, "requestTemplateJson");
    if (!requestTemplateJson.ok) {
      setError(requestTemplateJson.error);
      return;
    }
    const cliArgsJson = parseStringArrayInput(providerForm.cliArgsJson, "cliArgsJson");
    if (!cliArgsJson.ok) {
      setError(cliArgsJson.error);
      return;
    }

    const payload = {
      name: providerForm.name.trim(),
      providerType: providerForm.providerType,
      invocationMode: providerForm.invocationMode,
      apiFormat: providerForm.apiFormat,
      baseUrl: optionalString(providerForm.baseUrl),
      endpointPath: optionalString(providerForm.endpointPath),
      defaultModel: optionalString(providerForm.defaultModel),
      headersJson: headersJson.value,
      requestTemplateJson: requestTemplateJson.value,
      cliExecutable: optionalString(providerForm.cliExecutable),
      cliArgsJson: cliArgsJson.value,
      secretRef: optionalString(providerForm.secretRef),
      apiKey: optionalString(providerForm.apiKey),
      isEnabled: providerForm.isEnabled,
      timeoutSeconds,
      maxRetries
    };

    setSaving("provider");
    try {
      await requestJson<ApiResult<LlmProviderAdmin>>(providerForm.id ? `/api/settings/llm/providers/${providerForm.id}` : "/api/settings/llm/providers", {
        method: providerForm.id ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      setProviderForm(emptyProviderForm);
      setNotice("Provider를 저장했습니다. API Key 전체값은 다시 표시되지 않습니다.");
      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "provider could not be saved.");
    } finally {
      setSaving(null);
    }
  }

  async function submitModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!modelForm.providerId) {
      setError("Model providerId is required.");
      return;
    }
    if (!modelForm.name.trim()) {
      setError("Model name is required.");
      return;
    }

    const payload = {
      providerId: modelForm.providerId,
      name: modelForm.name.trim(),
      displayName: optionalString(modelForm.displayName),
      isDefault: modelForm.isDefault,
      isEnabled: modelForm.isEnabled
    };

    await saveEntity(
      modelForm.id ? `/api/settings/llm/models/${modelForm.id}` : "/api/settings/llm/models",
      modelForm.id ? "PATCH" : "POST",
      payload,
      "model"
    );
    setModelForm(emptyModelForm);
  }

  async function submitRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!routeForm.taskType) {
      setError("Task Route taskType is required.");
      return;
    }
    if (!routeForm.primaryProviderId) {
      setError("Task Route primaryProviderId is required.");
      return;
    }
    if (!routeForm.primaryModelId) {
      setError("Task Route primaryModelId is required.");
      return;
    }

    const payload = {
      taskType: routeForm.taskType,
      primaryProviderId: routeForm.primaryProviderId,
      primaryModelId: routeForm.primaryModelId,
      fallbackProviderId: optionalString(routeForm.fallbackProviderId),
      fallbackModelId: optionalString(routeForm.fallbackModelId),
      temperature: optionalNumber(routeForm.temperature),
      maxTokens: optionalInteger(routeForm.maxTokens),
      timeoutSeconds: optionalInteger(routeForm.timeoutSeconds),
      isEnabled: routeForm.isEnabled
    };

    await saveEntity(
      routeForm.id ? `/api/settings/llm/task-routes/${routeForm.id}` : "/api/settings/llm/task-routes",
      routeForm.id ? "PATCH" : "POST",
      payload,
      "task route"
    );
    setRouteForm(emptyRouteForm);
  }

  async function saveEntity(url: string, method: "POST" | "PATCH", payload: Record<string, unknown>, label: string) {
    setSaving(label);
    try {
      await requestJson<ApiResult<unknown>>(url, {
        method,
        body: JSON.stringify(payload)
      });
      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${label} could not be saved.`);
    } finally {
      setSaving(null);
    }
  }

  async function deleteEntity(url: string, label: string) {
    if (!window.confirm(`Delete this ${label}?`)) {
      return;
    }

    setSaving(label);
    setError(null);

    try {
      await requestJson<ApiResult<unknown>>(url, { method: "DELETE" });
      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${label} could not be deleted.`);
    } finally {
      setSaving(null);
    }
  }

  async function testProvider(provider: LlmProviderAdmin) {
    setSaving(`test-${provider.id}`);
    setError(null);
    setNotice(null);

    try {
      const result = await requestJson<ApiResult<{ ok: boolean; message: string }>>(`/api/settings/llm/providers/${provider.id}/test`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setNotice(result.data.message);
      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Provider connection test failed.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <section className="card">
        <span className="badge">Patch 3</span>
        <h1>LLM 설정</h1>
        <p className="muted">
          OpenAI API와 로컬 LLM의 Provider, 모델, 작업별 라우팅, fallback 정책을 DB에 저장해 관리합니다.
        </p>
        <button className="button secondary" type="button" onClick={() => void loadAll()} disabled={loading}>
          새로고침
        </button>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {notice ? <div className="notice">{notice}</div> : null}
      {loading ? <div className="notice">LLM 설정 데이터를 불러오는 중입니다.</div> : null}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Providers</h2>
            <p className="muted">API Key는 저장 후 다시 표시되지 않습니다. 연결 테스트는 Provider 검증용이며 글 생성에는 아직 연결되지 않았습니다.</p>
            <p className="muted">CLI는 raw shell command가 아니라 executable + args 배열로만 설정합니다. CLI 테스트 실행은 Patch 7A에서 비활성화되어 있습니다.</p>
          </div>
        </div>

        <form className="admin-form" onSubmit={(event) => void submitProvider(event)}>
          <label>
            Name
            <input value={providerForm.name} onChange={(event) => setProviderForm({ ...providerForm, name: event.target.value })} />
          </label>
          <label>
            Type
            <select
              value={providerForm.providerType}
              onChange={(event) => setProviderForm(applyProviderTypeDefaults(providerForm, event.target.value as LlmProviderType | ""))}
            >
              <option value="">선택</option>
              {LLM_PROVIDER_TYPES.map((providerType) => (
                <option key={providerType.value} value={providerType.value}>
                  {providerType.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Invocation Mode
            <select
              value={providerForm.invocationMode}
              onChange={(event) => setProviderForm({ ...providerForm, invocationMode: event.target.value as LlmInvocationMode })}
            >
              {LLM_INVOCATION_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            API Format
            <select
              value={providerForm.apiFormat}
              onChange={(event) => {
                const apiFormat = event.target.value as LlmApiFormat;
                setProviderForm({
                  ...providerForm,
                  apiFormat,
                  endpointPath: providerForm.endpointPath || defaultEndpointPath(apiFormat)
                });
              }}
            >
              {LLM_API_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Base URL
            <input value={providerForm.baseUrl} onChange={(event) => setProviderForm({ ...providerForm, baseUrl: event.target.value })} />
          </label>
          <label>
            Endpoint Path
            <input value={providerForm.endpointPath} onChange={(event) => setProviderForm({ ...providerForm, endpointPath: event.target.value })} />
          </label>
          <label>
            Default Model
            <input value={providerForm.defaultModel} onChange={(event) => setProviderForm({ ...providerForm, defaultModel: event.target.value })} />
          </label>
          <label>
            Secret Ref
            <input value={providerForm.secretRef} onChange={(event) => setProviderForm({ ...providerForm, secretRef: event.target.value })} />
          </label>
          <label>
            API Key
            <input
              type="password"
              autoComplete="new-password"
              placeholder="저장/교체 시에만 입력"
              value={providerForm.apiKey}
              onChange={(event) => setProviderForm({ ...providerForm, apiKey: event.target.value })}
            />
          </label>
          <label className="textarea-field">
            Headers JSON
            <textarea value={providerForm.headersJson} onChange={(event) => setProviderForm({ ...providerForm, headersJson: event.target.value })} />
          </label>
          <label className="textarea-field">
            Request Template JSON
            <textarea
              value={providerForm.requestTemplateJson}
              onChange={(event) => setProviderForm({ ...providerForm, requestTemplateJson: event.target.value })}
            />
          </label>
          <label>
            CLI Executable
            <input value={providerForm.cliExecutable} onChange={(event) => setProviderForm({ ...providerForm, cliExecutable: event.target.value })} />
          </label>
          <label className="textarea-field">
            CLI Args JSON
            <textarea value={providerForm.cliArgsJson} onChange={(event) => setProviderForm({ ...providerForm, cliArgsJson: event.target.value })} />
          </label>
          <label>
            Timeout Seconds
            <input
              min={1}
              type="number"
              value={providerForm.timeoutSeconds}
              onChange={(event) => setProviderForm({ ...providerForm, timeoutSeconds: event.target.value })}
            />
          </label>
          <label>
            Max Retries
            <input
              min={0}
              type="number"
              value={providerForm.maxRetries}
              onChange={(event) => setProviderForm({ ...providerForm, maxRetries: event.target.value })}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={providerForm.isEnabled}
              onChange={(event) => setProviderForm({ ...providerForm, isEnabled: event.target.checked })}
            />
            Enabled
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving === "provider"}>
              {providerForm.id ? "Provider 수정" : "Provider 생성"}
            </button>
            {providerForm.id ? (
              <button className="button secondary" type="button" onClick={() => setProviderForm(emptyProviderForm)}>
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
                <th>Type</th>
                <th>Invocation</th>
                <th>Format</th>
                <th>Endpoint</th>
                <th>Secret</th>
                <th>Test</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={9}>등록된 Provider가 없습니다.</td>
                </tr>
              ) : (
                providers.map((provider) => (
                  <tr key={provider.id}>
                    <td>{provider.name}</td>
                    <td>{getProviderTypeLabel(provider.providerType)}</td>
                    <td>{getInvocationModeLabel(provider.invocationMode)}</td>
                    <td>{getApiFormatLabel(provider.apiFormat)}</td>
                    <td>
                      {provider.baseUrl ?? "-"}
                      {provider.endpointPath ? provider.endpointPath : ""}
                    </td>
                    <td>
                      {provider.hasSecret ? `stored (${provider.apiKeyLast4 ?? "last4 unknown"})` : provider.secretRef ?? "-"}
                    </td>
                    <td>
                      <div>{provider.lastTestStatus}</div>
                      <div className="muted">{provider.lastTestedAt ? formatDate(provider.lastTestedAt) : "not tested"}</div>
                      {provider.lastTestError ? <div className="muted">{provider.lastTestError}</div> : null}
                    </td>
                    <td>{provider.isEnabled ? "enabled" : "disabled"}</td>
                    <td className="action-cell">
                      <button className="button small secondary" type="button" disabled={saving === `test-${provider.id}`} onClick={() => void testProvider(provider)}>
                        연결 테스트
                      </button>
                      <button className="button small secondary" type="button" onClick={() => editProvider(provider)}>
                        수정
                      </button>
                      <button
                        className="button small danger"
                        type="button"
                        onClick={() => void deleteEntity(`/api/settings/llm/providers/${provider.id}`, "provider")}
                      >
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
            <h2>Models</h2>
            <p className="muted">Provider별 사용 가능한 모델 이름과 기본 모델 여부를 관리합니다.</p>
          </div>
        </div>

        <form className="admin-form" onSubmit={(event) => void submitModel(event)}>
          <label>
            Provider
            <select value={modelForm.providerId} onChange={(event) => setModelForm({ ...modelForm, providerId: event.target.value })}>
              <option value="">선택</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input value={modelForm.name} onChange={(event) => setModelForm({ ...modelForm, name: event.target.value })} />
          </label>
          <label>
            Display Name
            <input value={modelForm.displayName} onChange={(event) => setModelForm({ ...modelForm, displayName: event.target.value })} />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={modelForm.isDefault}
              onChange={(event) => setModelForm({ ...modelForm, isDefault: event.target.checked })}
            />
            Default
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={modelForm.isEnabled}
              onChange={(event) => setModelForm({ ...modelForm, isEnabled: event.target.checked })}
            />
            Enabled
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving === "model"}>
              {modelForm.id ? "Model 수정" : "Model 생성"}
            </button>
            {modelForm.id ? (
              <button className="button secondary" type="button" onClick={() => setModelForm(emptyModelForm)}>
                취소
              </button>
            ) : null}
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Name</th>
                <th>Display</th>
                <th>Default</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr>
                  <td colSpan={6}>등록된 Model이 없습니다.</td>
                </tr>
              ) : (
                models.map((model) => (
                  <tr key={model.id}>
                    <td>{providerById.get(model.providerId)?.name ?? model.provider?.name ?? "-"}</td>
                    <td>{model.name}</td>
                    <td>{model.displayName ?? "-"}</td>
                    <td>{model.isDefault ? "yes" : "no"}</td>
                    <td>{model.isEnabled ? "enabled" : "disabled"}</td>
                    <td className="action-cell">
                      <button className="button small secondary" type="button" onClick={() => editModel(model)}>
                        수정
                      </button>
                      <button
                        className="button small danger"
                        type="button"
                        onClick={() => void deleteEntity(`/api/settings/llm/models/${model.id}`, "model")}
                      >
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
            <h2>Task Routes</h2>
            <p className="muted">작업별 primary/fallback Provider와 Model을 지정합니다.</p>
          </div>
        </div>

        <form className="admin-form" onSubmit={(event) => void submitRoute(event)}>
          <label>
            Task
            <select value={routeForm.taskType} onChange={(event) => setRouteForm({ ...routeForm, taskType: event.target.value as LlmTaskType })}>
              <option value="">선택</option>
              {LLM_ROUTE_TASK_TYPES.map((task) => (
                <option key={task.value} value={task.value}>
                  {task.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Primary Provider
            <select
              value={routeForm.primaryProviderId}
              onChange={(event) =>
                setRouteForm({
                  ...routeForm,
                  primaryProviderId: event.target.value,
                  primaryModelId: ""
                })
              }
            >
              <option value="">선택</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Primary Model
            <select
              value={routeForm.primaryModelId}
              onChange={(event) => setRouteForm({ ...routeForm, primaryModelId: event.target.value })}
              disabled={!routeForm.primaryProviderId}
            >
              <option value="">선택</option>
              {primaryModelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName ?? model.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fallback Provider
            <select
              value={routeForm.fallbackProviderId}
              onChange={(event) =>
                setRouteForm({
                  ...routeForm,
                  fallbackProviderId: event.target.value,
                  fallbackModelId: ""
                })
              }
            >
              <option value="">없음</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fallback Model
            <select
              value={routeForm.fallbackModelId}
              onChange={(event) => setRouteForm({ ...routeForm, fallbackModelId: event.target.value })}
              disabled={!routeForm.fallbackProviderId}
            >
              <option value="">없음</option>
              {fallbackModelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName ?? model.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Temperature
            <input
              step="0.1"
              type="number"
              value={routeForm.temperature}
              onChange={(event) => setRouteForm({ ...routeForm, temperature: event.target.value })}
            />
          </label>
          <label>
            Max Tokens
            <input type="number" value={routeForm.maxTokens} onChange={(event) => setRouteForm({ ...routeForm, maxTokens: event.target.value })} />
          </label>
          <label>
            Timeout Seconds
            <input
              type="number"
              value={routeForm.timeoutSeconds}
              onChange={(event) => setRouteForm({ ...routeForm, timeoutSeconds: event.target.value })}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={routeForm.isEnabled}
              onChange={(event) => setRouteForm({ ...routeForm, isEnabled: event.target.checked })}
            />
            Enabled
          </label>
          <div className="form-actions">
            <button className="button" type="submit" disabled={saving === "task route"}>
              {routeForm.id ? "Route 수정" : "Route 생성"}
            </button>
            {routeForm.id ? (
              <button className="button secondary" type="button" onClick={() => setRouteForm(emptyRouteForm)}>
                취소
              </button>
            ) : null}
          </div>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Primary</th>
                <th>Fallback</th>
                <th>Params</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.length === 0 ? (
                <tr>
                  <td colSpan={6}>등록된 Task Route가 없습니다.</td>
                </tr>
              ) : (
                routes.map((route) => (
                  <tr key={route.id}>
                    <td>{getTaskLabel(route.taskType)}</td>
                    <td>{formatRouteTarget(route.primaryProviderId, route.primaryModelId, providerById, modelById)}</td>
                    <td>{formatRouteTarget(route.fallbackProviderId, route.fallbackModelId, providerById, modelById)}</td>
                    <td>
                      temp {route.temperature ?? "-"} / max {route.maxTokens ?? "-"} / timeout {route.timeoutSeconds ?? "-"}
                    </td>
                    <td>{route.isEnabled ? "enabled" : "disabled"}</td>
                    <td className="action-cell">
                      <button className="button small secondary" type="button" onClick={() => editRoute(route)}>
                        수정
                      </button>
                      <button
                        className="button small danger"
                        type="button"
                        onClick={() => void deleteEntity(`/api/settings/llm/task-routes/${route.id}`, "task route")}
                      >
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
            <h2>Call Logs</h2>
            <p className="muted">최근 LLM 호출 로그를 진단 정보 중심으로 확인합니다.</p>
            <p className="muted">Call logs API는 prompt 전문, raw response, secret, API Key, content body를 반환하지 않습니다.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Content</th>
                <th>Latency</th>
                <th>Tokens</th>
                <th>Error</th>
                <th>Created</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={10}>최근 Call Log가 없습니다.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{getTaskLabel(log.taskType)}</td>
                    <td>{log.status}</td>
                    <td>{formatLogProvider(log)}</td>
                    <td>{formatLogModel(log)}</td>
                    <td>{formatLogContent(log)}</td>
                    <td>{log.latencyMs == null ? "-" : `${log.latencyMs}ms`}</td>
                    <td>
                      {log.inputTokens ?? "-"} / {log.outputTokens ?? "-"}
                    </td>
                    <td>{log.errorMessage ?? "-"}</td>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>
                      {log.metadata ? (
                        <details>
                          <summary>{Object.keys(log.metadata).length} keys</summary>
                          <pre>{formatMetadata(log.metadata)}</pre>
                        </details>
                      ) : (
                        "-"
                      )}
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

  function editProvider(provider: LlmProviderAdmin) {
    setProviderForm({
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType,
      invocationMode: provider.invocationMode,
      apiFormat: provider.apiFormat,
      baseUrl: provider.baseUrl ?? "",
      endpointPath: provider.endpointPath ?? defaultEndpointPath(provider.apiFormat),
      defaultModel: provider.defaultModel ?? "",
      headersJson: JSON.stringify(provider.headersJson ?? {}, null, 2),
      requestTemplateJson: JSON.stringify(provider.requestTemplateJson ?? {}, null, 2),
      cliExecutable: provider.cliExecutable ?? "",
      cliArgsJson: JSON.stringify(provider.cliArgsJson ?? [], null, 2),
      secretRef: provider.secretRef ?? "",
      apiKey: "",
      isEnabled: provider.isEnabled,
      timeoutSeconds: String(provider.timeoutSeconds),
      maxRetries: String(provider.maxRetries)
    });
  }

  function editModel(model: LlmModelAdmin) {
    setModelForm({
      id: model.id,
      providerId: model.providerId,
      name: model.name,
      displayName: model.displayName ?? "",
      isDefault: model.isDefault,
      isEnabled: model.isEnabled
    });
  }

  function editRoute(route: LlmTaskRouteAdmin) {
    setRouteForm({
      id: route.id,
      taskType: route.taskType,
      primaryProviderId: route.primaryProviderId,
      primaryModelId: route.primaryModelId,
      fallbackProviderId: route.fallbackProviderId ?? "",
      fallbackModelId: route.fallbackModelId ?? "",
      temperature: route.temperature == null ? "" : String(route.temperature),
      maxTokens: route.maxTokens == null ? "" : String(route.maxTokens),
      timeoutSeconds: route.timeoutSeconds == null ? "" : String(route.timeoutSeconds),
      isEnabled: route.isEnabled
    });
  }
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers
    }
  });

  const rawText = await response.text();
  const payload = parseJsonPayload(rawText);

  if (!response.ok) {
    const message = readErrorMessage(payload, rawText, response.status);
    throw new Error(message);
  }

  return payload as T;
}

function parseJsonPayload(rawText: string) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as unknown;
  } catch {
    return null;
  }
}

function readErrorMessage(payload: unknown, rawText: string, status: number) {
  if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }

  if (rawText) {
    return rawText.slice(0, 240);
  }

  return `Request failed with status ${status}`;
}

function optionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalInteger(value: string) {
  if (!value.trim()) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseJsonObjectInput(value: string, label: string): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  if (!value.trim()) {
    return { ok: true, value: null };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: `${label} must be a JSON object.` };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${label} is invalid JSON: ${error.message}` : `${label} is invalid JSON.` };
  }
}

function parseStringArrayInput(value: string, label: string): { ok: true; value: string[] | null } | { ok: false; error: string } {
  if (!value.trim()) {
    return { ok: true, value: null };
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return { ok: false, error: `${label} must be a JSON array of strings.` };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? `${label} is invalid JSON: ${error.message}` : `${label} is invalid JSON.` };
  }
}

function defaultEndpointPath(apiFormat: LlmApiFormat) {
  if (apiFormat === "ollama_compatible") {
    return "/api/generate";
  }
  if (apiFormat === "openai_compatible") {
    return "/v1/chat/completions";
  }
  return "";
}

function applyProviderTypeDefaults(form: ProviderFormState, providerType: LlmProviderType | ""): ProviderFormState {
  if (providerType === "gpt_cli") {
    return {
      ...form,
      providerType,
      invocationMode: "cli",
      apiFormat: "custom_cli",
      baseUrl: "",
      endpointPath: "",
      cliExecutable: form.cliExecutable || "gpt",
      cliArgsJson: form.cliArgsJson === "[]" ? "[\"--model\", \"{model}\"]" : form.cliArgsJson,
      timeoutSeconds: form.timeoutSeconds || "240"
    };
  }
  if (providerType === "cli") {
    return {
      ...form,
      providerType,
      invocationMode: "cli",
      apiFormat: "custom_cli",
      endpointPath: ""
    };
  }
  if (providerType === "local" || providerType === "local_http") {
    return {
      ...form,
      providerType,
      invocationMode: "local_http",
      apiFormat: "ollama_compatible",
      endpointPath: form.endpointPath || "/api/generate"
    };
  }
  return {
    ...form,
    providerType,
    invocationMode: "external_http",
    apiFormat: "openai_compatible",
    endpointPath: form.endpointPath || "/v1/chat/completions"
  };
}

function formatRouteTarget(
  providerId: string | null,
  modelId: string | null,
  providerById: Map<string, LlmProviderAdmin>,
  modelById: Map<string, LlmModelAdmin>
) {
  if (!providerId && !modelId) {
    return "-";
  }

  const provider = providerId ? providerById.get(providerId)?.name ?? providerId : "-";
  const model = modelId ? modelById.get(modelId) : undefined;
  return `${provider} / ${model?.displayName ?? model?.name ?? modelId ?? "-"}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatLogProvider(log: LlmCallLogAdmin) {
  if (!log.provider) {
    return log.providerId ?? "-";
  }

  return `${log.provider.name} (${getInvocationModeLabel(log.provider.invocationMode)}, ${getApiFormatLabel(log.provider.apiFormat)})`;
}

function formatLogModel(log: LlmCallLogAdmin) {
  if (!log.model) {
    return log.modelId ?? "-";
  }

  return log.model.displayName ?? log.model.name;
}

function formatLogContent(log: LlmCallLogAdmin) {
  if (!log.contentItem) {
    return log.contentItemId ?? "-";
  }

  const title = log.contentItem.title || "Untitled content";
  const keyword = log.contentItem.targetKeyword ? ` / keyword: ${log.contentItem.targetKeyword}` : "";
  return `${title} (${log.contentItem.mode}, ${log.contentItem.status}${keyword})`;
}

function formatMetadata(metadata: Record<string, unknown>) {
  return JSON.stringify(metadata, null, 2);
}
