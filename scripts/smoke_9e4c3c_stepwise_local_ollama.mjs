#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const TAGS_TIMEOUT_MS = 10_000;
const PROBE_FIRST_BYTE_TIMEOUT_MS = 30_000;
const PROBE_OVERALL_TIMEOUT_MS = 60_000;

const args = new Set(process.argv.slice(2));
const shouldProbeGenerate = args.has("--probe-generate");
const explicitBaseUrl = getArgValue("--base-url");
const explicitEndpointPath = getArgValue("--endpoint-path") ?? "/api/generate";
const explicitModel = getArgValue("--model");

try {
  if (explicitBaseUrl && explicitModel) {
    const tags = await fetchOllamaTags(explicitBaseUrl);
    const modelFound = tags.modelNames.includes(explicitModel);
    const result = {
      ok: modelFound,
      route: {
        providerName: null,
        providerType: "local_http",
        invocationMode: "local_http",
        apiFormat: "ollama_compatible",
        baseUrlHostOnly: getBaseUrlHostOnly(explicitBaseUrl),
        endpointPath: explicitEndpointPath,
        modelName: explicitModel,
        source: "explicit_args"
      },
      tags: {
        ok: tags.ok,
        modelFound,
        modelCount: tags.modelNames.length
      },
      generateProbe: null
    };

    if (shouldProbeGenerate && modelFound) {
      result.generateProbe = await runShortGenerateProbe(explicitBaseUrl, explicitEndpointPath, explicitModel);
      result.ok = result.ok && result.generateProbe.ok;
    }

    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } else {
    await probeConfiguredRoute();
  }
} catch (error) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        error: "stepwise_ollama_probe_failed",
        message: error instanceof Error ? error.message : "unknown_error"
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}

async function probeConfiguredRoute() {
  const prisma = new PrismaClient();
  try {
  const route = await prisma.llmTaskRoute.findUnique({
    where: { taskType: "content_draft" },
    include: {
      primaryProvider: true,
      primaryModel: true
    }
  });

  if (!route?.primaryProvider || !route.primaryModel) {
    console.log(JSON.stringify({ ok: false, error: "content_draft_route_not_ready" }, null, 2));
    process.exitCode = 1;
  } else {
    const provider = route.primaryProvider;
    const modelName = route.primaryModel.name;
    const baseUrl = provider.baseUrl ?? "";
    const summary = {
      providerName: provider.name,
      providerType: provider.providerType,
      invocationMode: provider.invocationMode,
      apiFormat: provider.apiFormat,
      baseUrlHostOnly: getBaseUrlHostOnly(baseUrl),
      endpointPath: provider.endpointPath,
      modelName,
      routeEnabled: route.isEnabled,
      providerEnabled: provider.isEnabled,
      modelEnabled: route.primaryModel.isEnabled,
      lastTestStatus: provider.lastTestStatus
    };

    const tags = await fetchOllamaTags(baseUrl);
    const modelFound = tags.modelNames.includes(modelName);
    const result = {
      ok: modelFound,
      route: summary,
      tags: {
        ok: tags.ok,
        modelFound,
        modelCount: tags.modelNames.length
      },
      generateProbe: null
    };

    if (shouldProbeGenerate && modelFound) {
      result.generateProbe = await runShortGenerateProbe(baseUrl, provider.endpointPath || "/api/generate", modelName);
      result.ok = result.ok && result.generateProbe.ok;
    }

    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  }
  } finally {
    await prisma.$disconnect();
  }
}

async function fetchOllamaTags(baseUrl) {
  const response = await fetchWithTimeout(joinUrl(baseUrl, "/api/tags"), { method: "GET" }, TAGS_TIMEOUT_MS, "tags_timeout");
  if (!response.ok) {
    throw new Error(`tags_http_${response.status}`);
  }
  const body = await response.json();
  const models = Array.isArray(body?.models) ? body.models : [];
  return {
    ok: true,
    modelNames: models.map((item) => (typeof item.name === "string" ? item.name : typeof item.model === "string" ? item.model : null)).filter(Boolean)
  };
}

async function runShortGenerateProbe(baseUrl, endpointPath, model) {
  const controller = new AbortController();
  let timeoutKind = "probe_overall_timeout";
  const overall = setTimeout(() => {
    timeoutKind = "probe_overall_timeout";
    controller.abort();
  }, PROBE_OVERALL_TIMEOUT_MS);
  const firstByte = setTimeout(() => {
    timeoutKind = "probe_first_byte_timeout";
    controller.abort();
  }, PROBE_FIRST_BYTE_TIMEOUT_MS);

  try {
    const startedAt = Date.now();
    const response = await fetch(joinUrl(baseUrl, endpointPath), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: "Return only: OK",
        stream: true,
        keep_alive: "15s",
        options: {
          temperature: 0,
          num_predict: 8,
          num_ctx: 1024
        }
      })
    });
    clearTimeout(firstByte);
    if (!response.ok || !response.body) {
      return {
        ok: false,
        error: `generate_http_${response.status}`,
        latencyMs: Date.now() - startedAt
      };
    }

    const reader = response.body.getReader();
    const first = await reader.read();
    await reader.cancel();
    return {
      ok: !first.done && Boolean(first.value?.byteLength),
      firstChunkBytes: first.value?.byteLength ?? 0,
      latencyMs: Date.now() - startedAt,
      requestOptionsSummary: {
        stream: true,
        timeoutMs: PROBE_OVERALL_TIMEOUT_MS,
        firstByteTimeoutMs: PROBE_FIRST_BYTE_TIMEOUT_MS,
        numPredict: 8,
        numCtx: 1024,
        keepAlive: "15s"
      }
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.name === "AbortError" ? timeoutKind : "probe_network_error"
    };
  } finally {
    clearTimeout(overall);
    clearTimeout(firstByte);
  }
}

async function fetchWithTimeout(url, init, timeoutMs, timeoutMessage) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function joinUrl(baseUrl, endpointPath) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function getBaseUrlHostOnly(value) {
  try {
    return new URL(value).host;
  } catch {
    return "invalid_url";
  }
}

function getArgValue(name) {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(name);
  if (index >= 0 && argv[index + 1]) {
    return argv[index + 1];
  }
  const prefix = `${name}=`;
  const match = argv.find((item) => item.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}
