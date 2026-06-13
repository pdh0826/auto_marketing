"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { LlmCallLogAdmin, LlmModelAdmin, LlmProviderAdmin, LlmTaskRouteAdmin } from "@/lib/llm/admin-types";
import { getProviderTypeLabel, getTaskLabel, LLM_PROVIDER_TYPES, LLM_TASK_TYPES } from "@/lib/llm/constants";
import type { LlmProviderType, LlmTaskType } from "@/lib/llm/types";

interface ApiResult<T> {
  data: T;
}

interface ProviderFormState {
  id?: string;
  name: string;
  providerType: LlmProviderType | "";
  baseUrl: string;
  secretRef: string;
  apiKeyLast4: string;
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
  baseUrl: "",
  secretRef: "",
  apiKeyLast4: "",
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

    if (!providerForm.name.trim()) {
      setError("Provider name is required.");
      return;
    }
    if (!providerForm.providerType) {
      setError("Provider type is required.");
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

    const payload = {
      name: providerForm.name.trim(),
      providerType: providerForm.providerType,
      baseUrl: optionalString(providerForm.baseUrl),
      secretRef: optionalString(providerForm.secretRef),
      apiKeyLast4: optionalString(providerForm.apiKeyLast4),
      isEnabled: providerForm.isEnabled,
      timeoutSeconds,
      maxRetries
    };

    await saveEntity(
      providerForm.id ? `/api/settings/llm/providers/${providerForm.id}` : "/api/settings/llm/providers",
      providerForm.id ? "PATCH" : "POST",
      payload,
      "provider"
    );
    setProviderForm(emptyProviderForm);
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
      {loading ? <div className="notice">LLM 설정 데이터를 불러오는 중입니다.</div> : null}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <h2>Providers</h2>
            <p className="muted">API Key 원문은 입력하지 않고 외부 secret 참조 메타 정보만 관리합니다.</p>
          </div>
          <button className="button secondary" type="button" disabled>
            연결 테스트 준비 중
          </button>
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
              onChange={(event) => setProviderForm({ ...providerForm, providerType: event.target.value as LlmProviderType })}
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
            Base URL
            <input value={providerForm.baseUrl} onChange={(event) => setProviderForm({ ...providerForm, baseUrl: event.target.value })} />
          </label>
          <label>
            Secret Ref
            <input value={providerForm.secretRef} onChange={(event) => setProviderForm({ ...providerForm, secretRef: event.target.value })} />
          </label>
          <label>
            API Key Last 4
            <input
              maxLength={4}
              value={providerForm.apiKeyLast4}
              onChange={(event) => setProviderForm({ ...providerForm, apiKeyLast4: event.target.value })}
            />
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
                <th>Base URL</th>
                <th>Secret Ref</th>
                <th>Last 4</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={7}>등록된 Provider가 없습니다.</td>
                </tr>
              ) : (
                providers.map((provider) => (
                  <tr key={provider.id}>
                    <td>{provider.name}</td>
                    <td>{getProviderTypeLabel(provider.providerType)}</td>
                    <td>{provider.baseUrl ?? "-"}</td>
                    <td>{provider.secretRef ?? "-"}</td>
                    <td>{provider.apiKeyLast4 ?? "-"}</td>
                    <td>{provider.isEnabled ? "enabled" : "disabled"}</td>
                    <td className="action-cell">
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
              {LLM_TASK_TYPES.map((task) => (
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
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Provider / Model</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Error</th>
                <th>Created</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9}>최근 Call Log가 없습니다.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{getTaskLabel(log.taskType)}</td>
                    <td>{formatRouteTarget(log.providerId, log.modelId, providerById, modelById)}</td>
                    <td>{log.status}</td>
                    <td>{log.latencyMs == null ? "-" : `${log.latencyMs}ms`}</td>
                    <td>
                      {log.inputTokens ?? "-"} / {log.outputTokens ?? "-"}
                    </td>
                    <td>{log.estimatedCost ?? "-"}</td>
                    <td>{log.errorMessage ?? "-"}</td>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>
                      {log.metadata ? (
                        <details>
                          <summary>{Object.keys(log.metadata).length} keys</summary>
                          <code>{summarizeMetadata(log.metadata)}</code>
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
      baseUrl: provider.baseUrl ?? "",
      secretRef: provider.secretRef ?? "",
      apiKeyLast4: provider.apiKeyLast4 ?? "",
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

function summarizeMetadata(metadata: Record<string, unknown>) {
  const keys = Object.keys(metadata).slice(0, 8);
  return keys.map((key) => `${key}: ${String(metadata[key]).slice(0, 48)}`).join(", ");
}
