import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export function listBlogs() {
  return prisma.blog.findMany({
    orderBy: { createdAt: "desc" }
  });
}

export function getBlog(id: string) {
  return prisma.blog.findUnique({
    where: { id }
  });
}

export function createBlog(data: Prisma.BlogCreateInput) {
  return prisma.blog.create({ data });
}

export function updateBlog(id: string, data: Prisma.BlogUpdateInput) {
  return prisma.blog.update({
    where: { id },
    data
  });
}

export function deleteBlog(id: string) {
  return prisma.blog.delete({
    where: { id }
  });
}
