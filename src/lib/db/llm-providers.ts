import type { Prisma } from "@prisma/client";
import { encryptSecret, getSecretLast4 } from "@/lib/llm/secrets";
import { prisma } from "./client";

export function listLlmProviders() {
  return prisma.llmProvider.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      models: true,
      secrets: {
        select: {
          secretKind: true,
          apiKeyLast4: true
        }
      }
    }
  }).then((providers) => providers.map(toSafeLlmProvider));
}

export function getLlmProvider(id: string) {
  return prisma.llmProvider.findUnique({
    where: { id },
    include: {
      models: true,
      secrets: {
        select: {
          secretKind: true,
          apiKeyLast4: true
        }
      }
    }
  }).then((provider) => (provider ? toSafeLlmProvider(provider) : null));
}

export async function getLlmProviderForTest(id: string) {
  return prisma.llmProvider.findUnique({
    where: { id },
    include: {
      secrets: true
    }
  });
}

export async function createLlmProvider(data: LlmProviderWriteInput) {
  const { apiKey, ...providerData } = normalizeProviderWrite(data);
  const provider = await prisma.llmProvider.create({ data: providerData });

  if (apiKey) {
    await upsertProviderApiKey(provider.id, apiKey);
  }

  return getLlmProvider(provider.id);
}

export async function updateLlmProvider(id: string, data: LlmProviderWriteInput) {
  const { apiKey, ...providerData } = normalizeProviderWrite(data);
  await prisma.llmProvider.update({
    where: { id },
    data: providerData
  });

  if (apiKey) {
    await upsertProviderApiKey(id, apiKey);
  }

  return getLlmProvider(id);
}

export function deleteLlmProvider(id: string) {
  return prisma.llmProvider.delete({
    where: { id }
  });
}

interface LlmProviderWriteInput {
  [key: string]: unknown;
  apiKey?: unknown;
}

function normalizeProviderWrite(data: LlmProviderWriteInput) {
  const apiKey = typeof data.apiKey === "string" && data.apiKey.trim() ? data.apiKey.trim() : null;
  const invocationMode = typeof data.invocationMode === "string" ? data.invocationMode : inferInvocationMode(data.providerType);
  const apiFormat = typeof data.apiFormat === "string" ? data.apiFormat : inferApiFormat(invocationMode);
  validateHeadersJson(data.headersJson);
  validateCliSettings(data.cliExecutable, data.cliArgsJson);

  return {
    apiKey,
    providerType: data.providerType as Prisma.LlmProviderCreateInput["providerType"],
    invocationMode: invocationMode as Prisma.LlmProviderCreateInput["invocationMode"],
    apiFormat: apiFormat as Prisma.LlmProviderCreateInput["apiFormat"],
    name: String(data.name ?? "").trim(),
    baseUrl: optionalString(data.baseUrl),
    endpointPath: optionalString(data.endpointPath),
    defaultModel: optionalString(data.defaultModel),
    headersJson: optionalJsonObject(data.headersJson),
    requestTemplateJson: optionalJsonObject(data.requestTemplateJson),
    cliExecutable: optionalString(data.cliExecutable),
    cliArgsJson: optionalStringArrayJson(data.cliArgsJson),
    secretRef: optionalString(data.secretRef),
    apiKeyLast4: apiKey ? getSecretLast4(apiKey) : optionalString(data.apiKeyLast4),
    isEnabled: Boolean(data.isEnabled),
    timeoutSeconds: positiveInteger(data.timeoutSeconds, 60),
    maxRetries: nonNegativeInteger(data.maxRetries, 1)
  };
}

async function upsertProviderApiKey(providerId: string, apiKey: string) {
  const encrypted = encryptSecret(apiKey);
  const apiKeyLast4 = getSecretLast4(apiKey);

  await prisma.llmProviderSecret.upsert({
    where: {
      providerId_secretKind: {
        providerId,
        secretKind: "api_key"
      }
    },
    create: {
      providerId,
      secretKind: "api_key",
      encryptedValue: encrypted.encryptedValue,
      keyVersion: encrypted.keyVersion,
      apiKeyLast4
    },
    update: {
      encryptedValue: encrypted.encryptedValue,
      keyVersion: encrypted.keyVersion,
      apiKeyLast4
    }
  });
}

function toSafeLlmProvider<T extends { secrets?: Array<{ apiKeyLast4: string | null }>; apiKeyLast4: string | null }>(provider: T) {
  const { secrets, ...safeProvider } = provider;
  const secretLast4 = secrets?.find((secret) => secret.apiKeyLast4)?.apiKeyLast4 ?? null;
  return {
    ...safeProvider,
    apiKeyLast4: provider.apiKeyLast4 ?? secretLast4,
    hasSecret: Boolean(secrets?.length)
  };
}

function inferInvocationMode(providerType: unknown) {
  if (providerType === "local" || providerType === "local_http") {
    return "local_http";
  }
  if (providerType === "cli" || providerType === "gpt_cli") {
    return "cli";
  }
  return "external_http";
}

function inferApiFormat(invocationMode: unknown) {
  if (invocationMode === "local_http") {
    return "ollama_compatible";
  }
  if (invocationMode === "cli") {
    return "custom_cli";
  }
  return "openai_compatible";
}

function optionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Prisma.InputJsonObject;
}

function optionalStringArrayJson(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === "string");
  return items as Prisma.InputJsonArray;
}

function validateHeadersJson(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  const sensitiveHeader = Object.keys(value).find((key) => {
    const normalized = key.toLowerCase();
    return normalized === "authorization" || normalized === "proxy-authorization" || normalized.includes("api-key") || normalized.includes("token");
  });

  if (sensitiveHeader) {
    throw new Error(`Sensitive header "${sensitiveHeader}" must be stored as an encrypted secret, not in headersJson.`);
  }
}

function validateCliSettings(executable: unknown, args: unknown) {
  if (typeof executable === "string" && executable.trim()) {
    const normalizedExecutable = executable.trim().split(/[\\/]/).pop()?.toLowerCase() ?? "";
    const dangerousExecutables = new Set(["sh", "bash", "zsh", "fish", "sudo", "rm", "osascript", "curl", "wget"]);

    if (dangerousExecutables.has(normalizedExecutable)) {
      throw new Error(`CLI executable "${normalizedExecutable}" is not allowed.`);
    }

    if (/[;&|`$<>]/.test(executable)) {
      throw new Error("CLI executable must not contain shell metacharacters.");
    }
  }

  if (args !== undefined && args !== null && (!Array.isArray(args) || args.some((item) => typeof item !== "string"))) {
    throw new Error("cliArgsJson must be a JSON array of strings.");
  }
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : fallback;
}
