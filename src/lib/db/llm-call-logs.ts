import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export function listLlmCallLogs() {
  return prisma.llmCallLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      provider: true,
      model: true,
      contentItem: true
    }
  });
}

export function createLlmCallLog(data: Prisma.LlmCallLogUncheckedCreateInput) {
  return prisma.llmCallLog.create({ data });
}
