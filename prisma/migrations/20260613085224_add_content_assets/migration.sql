-- CreateEnum
CREATE TYPE "ContentAssetType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "ContentAssetPlacement" AS ENUM ('hero', 'intro', 'middle', 'outro', 'gallery', 'embed');

-- CreateTable
CREATE TABLE "content_assets" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "assetType" "ContentAssetType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "caption" TEXT,
    "altText" TEXT,
    "userNote" TEXT,
    "placementHint" "ContentAssetPlacement" NOT NULL DEFAULT 'gallery',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_assets_contentItemId_idx" ON "content_assets"("contentItemId");

-- CreateIndex
CREATE INDEX "content_assets_assetType_idx" ON "content_assets"("assetType");

-- CreateIndex
CREATE INDEX "content_assets_placementHint_idx" ON "content_assets"("placementHint");

-- CreateIndex
CREATE INDEX "content_assets_isPrimary_idx" ON "content_assets"("isPrimary");

-- AddForeignKey
ALTER TABLE "content_assets" ADD CONSTRAINT "content_assets_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
