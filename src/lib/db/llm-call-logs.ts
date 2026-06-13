import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export async function listLlmCallLogs() {
  const logs = await prisma.llmCallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      taskType: true,
      providerId: true,
      modelId: true,
      contentItemId: true,
      status: true,
      latencyMs: true,
      inputTokens: true,
      outputTokens: true,
      estimatedCost: true,
      errorMessage: true,
      metadata: true,
      createdAt: true,
      provider: {
        select: {
          id: true,
          name: true,
          providerType: true,
          invocationMode: true,
          apiFormat: true
        }
      },
      model: {
        select: {
          id: true,
          name: true,
          displayName: true
        }
      },
      contentItem: {
        select: {
          id: true,
          title: true,
          mode: true,
          status: true,
          targetKeyword: true
        }
      }
    }
  });

  return logs.map((log) => ({
    ...log,
    metadata: sanitizeMetadata(log.metadata)
  }));
}

export function createLlmCallLog(data: Prisma.LlmCallLogUncheckedCreateInput) {
  return prisma.llmCallLog.create({ data });
}

function sanitizeMetadata(value: Prisma.JsonValue | null): Prisma.JsonValue | null {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item));
  }

  const metadata = value as Prisma.JsonObject;
  const sanitized: Prisma.JsonObject = {};
  for (const [key, item] of Object.entries(metadata)) {
    if (item === undefined || isSensitiveMetadataKey(key)) {
      continue;
    }
    sanitized[key] = sanitizeMetadata(item);
  }
  return sanitized;
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return [
    "prompt",
    "rawresponse",
    "responsebody",
    "requestbody",
    "body",
    "secret",
    "apikey",
    "token",
    "authorization",
    "headers",
    "requesttemplate",
    "sourcememo",
    "planjson",
    "draftmarkdown",
    "drafthtml",
    "encryptedvalue"
  ].some((sensitiveKey) => normalized.includes(sensitiveKey));
}
