import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

const safeSelect = {
  id: true,
  blogId: true,
  name: true,
  status: true,
  bloggerBlogId: true,
  bloggerBlogName: true,
  bloggerBlogUrl: true,
  bloggerBlogVerifiedAt: true,
  connectedEmail: true,
  scopes: true,
  oauthClientIdRef: true,
  clientSecretRef: true,
  hasClientSecret: true,
  hasAccessToken: true,
  hasRefreshToken: true,
  tokenLast4: true,
  lastTestedAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  blog: {
    select: {
      id: true,
      name: true,
      url: true,
      bloggerBlogId: true
    }
  }
} satisfies Prisma.BloggerConnectionSelect;

export type SafeBloggerConnection = Prisma.BloggerConnectionGetPayload<{ select: typeof safeSelect }>;

export function listBloggerConnections() {
  return prisma.bloggerConnection.findMany({
    orderBy: { createdAt: "desc" },
    select: safeSelect
  });
}

export function getBloggerConnection(id: string) {
  return prisma.bloggerConnection.findUnique({
    where: { id },
    select: safeSelect
  });
}

export function getBloggerConnectionForBlog(blogId: string) {
  return prisma.bloggerConnection.findFirst({
    where: { blogId },
    orderBy: { updatedAt: "desc" },
    select: safeSelect
  });
}

export function createBloggerConnection(data: Prisma.BloggerConnectionUncheckedCreateInput) {
  return prisma.bloggerConnection.create({
    data,
    select: safeSelect
  });
}

export function updateBloggerConnection(id: string, data: Prisma.BloggerConnectionUncheckedUpdateInput) {
  return prisma.bloggerConnection.update({
    where: { id },
    data,
    select: safeSelect
  });
}

export function selectBloggerBlogForConnection(
  id: string,
  selectedBlog: {
    id: string;
    name: string;
    url: string | null;
  }
) {
  return prisma.bloggerConnection.update({
    where: { id },
    data: {
      bloggerBlogId: selectedBlog.id,
      bloggerBlogName: selectedBlog.name,
      bloggerBlogUrl: selectedBlog.url,
      bloggerBlogVerifiedAt: new Date()
    },
    select: safeSelect
  });
}

export function updateBloggerConnectionOAuthStatus(id: string, data: Pick<Prisma.BloggerConnectionUncheckedUpdateInput, "status" | "lastError" | "lastTestedAt" | "scopes">) {
  return prisma.bloggerConnection.update({
    where: { id },
    data,
    select: safeSelect
  });
}

export function toBloggerConnectionStatusSummary(connection: SafeBloggerConnection) {
  return {
    ...connection,
    oauthImplemented: true as const,
    bloggerApiImplemented: true as const,
    publishImplemented: false as const
  };
}
