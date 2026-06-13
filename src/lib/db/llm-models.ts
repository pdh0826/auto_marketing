import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export function listLlmModels() {
  return prisma.llmModel.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      provider: true
    }
  });
}

export function getLlmModel(id: string) {
  return prisma.llmModel.findUnique({
    where: { id },
    include: {
      provider: true
    }
  });
}

export function createLlmModel(data: Prisma.LlmModelUncheckedCreateInput) {
  return prisma.llmModel.create({ data });
}

export function updateLlmModel(id: string, data: Prisma.LlmModelUncheckedUpdateInput) {
  return prisma.llmModel.update({
    where: { id },
    data
  });
}

export function deleteLlmModel(id: string) {
  return prisma.llmModel.delete({
    where: { id }
  });
}
