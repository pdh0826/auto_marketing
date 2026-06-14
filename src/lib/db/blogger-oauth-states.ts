import { prisma } from "@/lib/db/client";

interface CreateBloggerOAuthStateInput {
  connectionId: string;
  stateHash: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: Date;
}

export function createBloggerOAuthState(data: CreateBloggerOAuthStateInput) {
  return prisma.bloggerOAuthState.create({
    data,
    select: {
      id: true,
      connectionId: true,
      redirectUri: true,
      scopes: true,
      expiresAt: true,
      consumedAt: true,
      createdAt: true
    }
  });
}

export function findBloggerOAuthStateByHash(stateHash: string) {
  return prisma.bloggerOAuthState.findUnique({
    where: { stateHash },
    select: {
      id: true,
      connectionId: true,
      redirectUri: true,
      scopes: true,
      expiresAt: true,
      consumedAt: true,
      createdAt: true,
      connection: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });
}

export function consumeBloggerOAuthState(id: string) {
  return prisma.bloggerOAuthState.update({
    where: { id },
    data: { consumedAt: new Date() },
    select: {
      id: true,
      connectionId: true,
      consumedAt: true
    }
  });
}
