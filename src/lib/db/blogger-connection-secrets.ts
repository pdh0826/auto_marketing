import type { BloggerSecretKind, Prisma } from "@prisma/client";
import { getBloggerSecretLast4 } from "@/lib/blogger/secrets";
import { prisma } from "@/lib/db/client";

const safeSecretSelect = {
  id: true,
  connectionId: true,
  secretKind: true,
  keyVersion: true,
  last4: true,
  tokenType: true,
  scopes: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.BloggerConnectionSecretSelect;

export type SafeBloggerConnectionSecret = Prisma.BloggerConnectionSecretGetPayload<{ select: typeof safeSecretSelect }>;

const encryptedSecretSelect = {
  id: true,
  connectionId: true,
  secretKind: true,
  encryptedValue: true,
  keyVersion: true,
  tokenType: true,
  scopes: true,
  expiresAt: true,
  updatedAt: true
} satisfies Prisma.BloggerConnectionSecretSelect;

export type EncryptedBloggerConnectionSecret = Prisma.BloggerConnectionSecretGetPayload<{ select: typeof encryptedSecretSelect }>;

interface UpsertBloggerConnectionSecretInput {
  connectionId: string;
  secretKind: BloggerSecretKind;
  encryptedValue: string;
  keyVersion: string;
  rawValueForLast4: string;
  tokenType?: string | null;
  scopes?: string[];
  expiresAt?: Date | null;
}

export function listBloggerConnectionSecrets(connectionId: string) {
  return prisma.bloggerConnectionSecret.findMany({
    where: { connectionId },
    orderBy: { secretKind: "asc" },
    select: safeSecretSelect
  });
}

export async function getBloggerConnectionSecretStatus(connectionId: string) {
  const secrets = await listBloggerConnectionSecrets(connectionId);
  const accessToken = secrets.find((secret) => secret.secretKind === "access_token") ?? null;
  const refreshToken = secrets.find((secret) => secret.secretKind === "refresh_token") ?? null;
  const clientSecret = secrets.find((secret) => secret.secretKind === "oauth_client_secret") ?? null;

  return {
    connectionId,
    hasClientSecret: Boolean(clientSecret),
    hasAccessToken: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    tokenLast4: refreshToken?.last4 ?? accessToken?.last4 ?? null,
    accessTokenExpiresAt: accessToken?.expiresAt?.toISOString() ?? null,
    refreshTokenExpiresAt: refreshToken?.expiresAt?.toISOString() ?? null,
    scopes: Array.from(new Set([...(accessToken?.scopes ?? []), ...(refreshToken?.scopes ?? [])])),
    secrets,
    secretMaterialReturned: false as const
  };
}

export function getEncryptedBloggerConnectionSecret(connectionId: string, secretKind: BloggerSecretKind) {
  return prisma.bloggerConnectionSecret.findUnique({
    where: {
      connectionId_secretKind: {
        connectionId,
        secretKind
      }
    },
    select: encryptedSecretSelect
  });
}

export async function upsertEncryptedBloggerConnectionSecret(data: UpsertBloggerConnectionSecretInput) {
  const safeData = {
    encryptedValue: data.encryptedValue,
    keyVersion: data.keyVersion,
    last4: getBloggerSecretLast4(data.rawValueForLast4),
    tokenType: data.tokenType ?? null,
    scopes: data.scopes ?? [],
    expiresAt: data.expiresAt ?? null
  };

  const secret = await prisma.bloggerConnectionSecret.upsert({
    where: {
      connectionId_secretKind: {
        connectionId: data.connectionId,
        secretKind: data.secretKind
      }
    },
    create: {
      connectionId: data.connectionId,
      secretKind: data.secretKind,
      ...safeData
    },
    update: safeData,
    select: safeSecretSelect
  });

  await syncBloggerConnectionSecretFlags(data.connectionId);
  return secret;
}

export async function syncBloggerConnectionSecretFlags(connectionId: string) {
  const status = await getBloggerConnectionSecretStatus(connectionId);
  return prisma.bloggerConnection.update({
    where: { id: connectionId },
    data: {
      hasClientSecret: status.hasClientSecret,
      hasAccessToken: status.hasAccessToken,
      hasRefreshToken: status.hasRefreshToken,
      tokenLast4: status.tokenLast4
    },
    select: {
      id: true,
      hasClientSecret: true,
      hasAccessToken: true,
      hasRefreshToken: true,
      tokenLast4: true
    }
  });
}
