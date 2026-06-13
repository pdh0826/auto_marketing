import type { Prisma } from "@prisma/client";
import { deleteContentAssetFiles } from "@/lib/content/storage";
import { prisma } from "./client";

export function listContentItems() {
  return prisma.contentItem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      blog: true,
      brandProfile: true
    }
  });
}

export function getContentItem(id: string) {
  return prisma.contentItem.findUnique({
    where: { id },
    include: {
      blog: true,
      brandProfile: true,
      llmCallLogs: {
        orderBy: { createdAt: "desc" },
        take: 20
      },
      assets: true
    }
  });
}

export function createContentItem(data: Prisma.ContentItemUncheckedCreateInput) {
  return prisma.contentItem.create({ data });
}

export function updateContentItem(id: string, data: Prisma.ContentItemUncheckedUpdateInput) {
  return prisma.contentItem.update({
    where: { id },
    data
  });
}

export async function deleteContentItem(id: string) {
  const assets = await prisma.contentAsset.findMany({
    where: { contentItemId: id },
    select: { storagePath: true }
  });

  await deleteContentAssetFiles(assets);

  return prisma.contentItem.delete({
    where: { id }
  });
}
