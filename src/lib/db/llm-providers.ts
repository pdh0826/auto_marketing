import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export function listLlmProviders() {
  return prisma.llmProvider.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      models: true
    }
  });
}

export function getLlmProvider(id: string) {
  return prisma.llmProvider.findUnique({
    where: { id },
    include: {
      models: true
    }
  });
}

export function createLlmProvider(data: Prisma.LlmProviderCreateInput) {
  return prisma.llmProvider.create({ data });
}

export function updateLlmProvider(id: string, data: Prisma.LlmProviderUpdateInput) {
  return prisma.llmProvider.update({
    where: { id },
    data
  });
}

export function deleteLlmProvider(id: string) {
  return prisma.llmProvider.delete({
    where: { id }
  });
}
