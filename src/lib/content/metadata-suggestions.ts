import type { Blog, BrandProfile, ContentAsset, ContentItem } from "@prisma/client";
import type { ContentAssetMetadataSuggestion, ContentAssetPlacement } from "./asset-types";

interface SuggestionInput {
  asset: ContentAsset;
  contentItem: ContentItem & {
    blog: Blog | null;
    brandProfile: BrandProfile | null;
    assets: ContentAsset[];
  };
}

export function suggestAssetMetadata({ asset, contentItem }: SuggestionInput): ContentAssetMetadataSuggestion {
  const rationale: string[] = [];
  const warnings = ["파일 내용 분석 없이 콘텐츠 요청, 프로필, 파일명 메타데이터만 사용했습니다."];
  const hasExistingMetadata = Boolean(asset.caption || asset.altText || asset.userNote);
  const cleanedName = cleanFileName(asset.originalName);
  const topic = pickTopic(contentItem);
  const brandName = contentItem.brandProfile?.serviceName || contentItem.brandProfile?.name || "";
  const isFirstImage = asset.assetType === "image" && firstImageId(contentItem.assets) === asset.id;
  const placementHint = choosePlacement(asset, contentItem, isFirstImage, rationale);
  const sortOrder = chooseSortOrder(asset, contentItem.assets);
  const recommendedIsPrimary = isFirstImage;

  if (hasExistingMetadata) {
    rationale.push("기존 값이 있어 편집 전 확인이 필요합니다.");
  }
  if (contentItem.mode === "seo_keyword" && contentItem.targetKeyword) {
    rationale.push("targetKeyword는 반복하지 않고 한 번만 자연스럽게 반영했습니다.");
  }
  if (contentItem.mode === "service_promotion" && brandName) {
    rationale.push("서비스/브랜드 프로필 맥락을 반영했습니다.");
  }
  if (recommendedIsPrimary) {
    rationale.push("첫 번째 이미지라 대표 미디어 후보로 추천했습니다.");
  }

  return {
    caption: buildCaption({ contentItem, asset, cleanedName, topic, brandName }),
    altText: buildAltText({ contentItem, asset, cleanedName, topic, brandName }),
    userNote: buildUserNote({ contentItem, asset, placementHint, brandName }),
    placementHint,
    sortOrder,
    recommendedIsPrimary,
    rationale,
    warnings
  };
}

function buildCaption({
  contentItem,
  asset,
  cleanedName,
  topic,
  brandName
}: {
  contentItem: SuggestionInput["contentItem"];
  asset: ContentAsset;
  cleanedName: string;
  topic: string;
  brandName: string;
}) {
  if (asset.assetType === "video") {
    return truncateSentence(`${topic}를 이해하는 데 참고할 수 있는 관련 영상입니다.`, 110);
  }
  if (contentItem.mode === "service_promotion" && brandName) {
    return truncateSentence(`${brandName}와 관련된 핵심 내용을 설명하는 참고 이미지입니다.`, 110);
  }
  if (contentItem.mode === "seo_keyword" && contentItem.targetKeyword) {
    return truncateSentence(`${contentItem.targetKeyword} 주제를 이해하는 데 도움이 되는 참고 이미지입니다.`, 110);
  }
  return truncateSentence(`${topic || cleanedName}와 관련된 참고 이미지입니다.`, 110);
}

function buildAltText({
  contentItem,
  asset,
  cleanedName,
  topic,
  brandName
}: {
  contentItem: SuggestionInput["contentItem"];
  asset: ContentAsset;
  cleanedName: string;
  topic: string;
  brandName: string;
}) {
  const mediaLabel = asset.assetType === "video" ? "관련 영상" : "참고 이미지";
  const base =
    contentItem.mode === "service_promotion" && brandName
      ? `${brandName} ${mediaLabel}`
      : contentItem.targetKeyword
        ? `${contentItem.targetKeyword} ${mediaLabel}`
        : `${topic || cleanedName} ${mediaLabel}`;

  return truncateSentence(base, 80);
}

function buildUserNote({
  contentItem,
  asset,
  placementHint,
  brandName
}: {
  contentItem: SuggestionInput["contentItem"];
  asset: ContentAsset;
  placementHint: ContentAssetPlacement;
  brandName: string;
}) {
  const parts = [
    `${placementHint} 위치에 배치해 본문 이해를 돕는 보조 자료로 사용하세요.`,
    "파일 내용은 분석하지 않았으므로 실제 이미지/영상과 설명이 맞는지 확인하세요."
  ];

  if (asset.assetType === "video") {
    parts.unshift("영상은 독자가 직접 확인할 수 있는 보충 자료로 소개하세요.");
  }
  if (contentItem.mode === "service_promotion" && brandName) {
    parts.unshift(`${brandName} 소개가 과도한 홍보처럼 보이지 않도록 문제 해결 맥락과 연결하세요.`);
  }

  return parts.join(" ");
}

function choosePlacement(asset: ContentAsset, contentItem: SuggestionInput["contentItem"], isFirstImage: boolean, rationale: string[]) {
  if (asset.assetType === "video") {
    rationale.push("동영상은 본문 중간 또는 embed 위치가 적합합니다.");
    return contentItem.sourceMemo && contentItem.sourceMemo.length > 120 ? "middle" : "embed";
  }

  if (isFirstImage) {
    rationale.push("첫 번째 이미지는 도입부 또는 대표 이미지 후보로 적합합니다.");
    return contentItem.title || contentItem.targetKeyword ? "intro" : "hero";
  }

  if (contentItem.mode === "service_promotion") {
    rationale.push("서비스 홍보형 콘텐츠에서는 본문 중간 이후 배치를 추천했습니다.");
    return "middle";
  }

  rationale.push("보조 이미지는 본문 중간 또는 갤러리 배치를 추천했습니다.");
  return contentItem.assets.length > 2 ? "gallery" : "middle";
}

function chooseSortOrder(asset: ContentAsset, assets: ContentAsset[]) {
  if (asset.sortOrder !== 0) {
    return asset.sortOrder;
  }

  const sorted = [...assets].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const index = sorted.findIndex((item) => item.id === asset.id);
  return index >= 0 ? index : assets.length;
}

function firstImageId(assets: ContentAsset[]) {
  return [...assets]
    .filter((asset) => asset.assetType === "image")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.id;
}

function pickTopic(contentItem: SuggestionInput["contentItem"]) {
  return (
    contentItem.title ||
    contentItem.targetKeyword ||
    contentItem.blog?.mainTopic ||
    contentItem.brandProfile?.shortDescription ||
    "본문 주제"
  );
}

function cleanFileName(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateSentence(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trim()}...` : value;
}
