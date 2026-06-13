import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export function listLlmTaskRoutes() {
  return prisma.llmTaskRoute.findMany({
    orderBy: { taskType: "asc" },
    include: {
      primaryProvider: true,
      primaryModel: true,
      fallbackProvider: true,
      fallbackModel: true
    }
  });
}

export function getLlmTaskRoute(id: string) {
  return prisma.llmTaskRoute.findUnique({
    where: { id },
    include: {
      primaryProvider: true,
      primaryModel: true,
      fallbackProvider: true,
      fallbackModel: true
    }
  });
}

export function createLlmTaskRoute(data: Prisma.LlmTaskRouteUncheckedCreateInput) {
  return prisma.llmTaskRoute.create({ data });
}

export function updateLlmTaskRoute(id: string, data: Prisma.LlmTaskRouteUncheckedUpdateInput) {
  return prisma.llmTaskRoute.update({
    where: { id },
    data
  });
}

export function deleteLlmTaskRoute(id: string) {
  return prisma.llmTaskRoute.delete({
    where: { id }
  });
}
