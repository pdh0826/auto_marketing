import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export function listContentAssets(contentItemId: string) {
  return prisma.contentAsset.findMany({
    where: { contentItemId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });
}

export function getContentAsset(id: string) {
  return prisma.contentAsset.findUnique({
    where: { id }
  });
}

export function createContentAsset(data: Prisma.ContentAssetUncheckedCreateInput) {
  return prisma.contentAsset.create({ data });
}

export function updateContentAsset(id: string, data: Prisma.ContentAssetUncheckedUpdateInput) {
  return prisma.contentAsset.update({
    where: { id },
    data
  });
}

export function deleteContentAsset(id: string) {
  return prisma.contentAsset.delete({
    where: { id }
  });
}
