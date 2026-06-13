import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export function listBrandProfiles() {
  return prisma.brandProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
  });
}

export function getBrandProfile(id: string) {
  return prisma.brandProfile.findUnique({
    where: { id }
  });
}

export function createBrandProfile(data: Prisma.BrandProfileCreateInput) {
  return prisma.brandProfile.create({ data });
}

export function updateBrandProfile(id: string, data: Prisma.BrandProfileUpdateInput) {
  return prisma.brandProfile.update({
    where: { id },
    data
  });
}

export function deleteBrandProfile(id: string) {
  return prisma.brandProfile.delete({
    where: { id }
  });
}
