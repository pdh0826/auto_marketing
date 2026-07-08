import { mkdir, copyFile, stat } from "fs/promises";
import path from "path";
import { buildBlogPostTemplatePreview } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { prisma } from "@/lib/db/client";
import { createContentAsset } from "@/lib/db/content-assets";
import type { DailyBriefCapture, DailyBriefRun } from "./types";

export async function createDailyBriefContentItem(run: DailyBriefRun) {
  const readiness = buildDailyBriefGenerationReadiness(run);
  if (!readiness.ready) {
    throw new Error(`daily_brief_not_ready:${readiness.blockingReasons.join(",")}`);
  }

  const defaults = await loadDefaultBlogAndBrand();
  const created = await prisma.contentItem.create({
    data: {
      blogId: defaults.blogId,
      brandProfileId: defaults.brandProfileId,
      mode: "seo_keyword",
      status: "planned",
      title: run.title,
      targetKeyword: run.targetKeyword,
      sourceMemo: buildSourceMemo(run),
      planJson: {
        kind: "daily_upsignal_brief",
        runId: run.id,
        marketDate: run.marketDate,
        stockPickLimit: run.stockPickLimit,
        stockDetailLimit: run.stockDetailLimit,
        etfPickLimit: run.etfPickLimit,
        includeEtfs: run.includeEtfs
      },
      draftMarkdown: ""
    },
    include: {
      blog: true,
      brandProfile: true,
      assets: true
    }
  });
  const assets = await attachCapturesAsAssets(created.id, run.captures);
  const markdown = buildDailyBriefMarkdown(run, assets);
  const provisional = {
    ...(created as unknown as ContentItemAdmin),
    draftMarkdown: markdown,
    draftHtml: null,
    assets
  } satisfies ContentItemAdmin & { assets: ContentAssetAdmin[] };
  const htmlPreview = buildBlogPostTemplatePreview({
    contentItem: provisional,
    assets,
    markdown,
    source: "manual_draft_candidate",
    theme: "clean_blog"
  });
  const updated = await prisma.contentItem.update({
    where: { id: created.id },
    data: {
      draftMarkdown: markdown,
      draftHtml: htmlPreview.html
    },
    include: {
      blog: true,
      brandProfile: true,
      assets: true
    }
  });
  const quality = buildHtmlQualityPreview(updated as unknown as ContentItemAdmin, updated.assets as unknown as ContentAssetAdmin[]);

  return {
    contentItem: updated,
    assets,
    markdown,
    html: htmlPreview.html,
    htmlPreview,
    quality
  };
}

export function buildDailyBriefGenerationReadiness(run: DailyBriefRun) {
  const requiredStockChartCount = Math.min(run.stockDetailLimit, run.stockPicks.length);
  const krBoardCaptureCount = run.captures.filter((capture) => capture.kind === "kr_board").length;
  const stockChartCaptureCount = run.captures.filter((capture) => capture.kind === "stock_chart").length;
  const etfBoardCaptureCount = run.captures.filter((capture) => capture.kind === "etf_board").length;
  const liveCaptureCount = run.captures.filter((capture) => capture.mode === "live_screenshot").length;
  const placeholderCaptureCount = run.captures.filter((capture) => capture.mode === "placeholder").length;
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (run.stockPicks.length === 0) {
    blockingReasons.push("stock_picks_required");
  }
  if (krBoardCaptureCount === 0) {
    blockingReasons.push("kr_board_capture_required");
  }
  if (requiredStockChartCount > 0 && stockChartCaptureCount < requiredStockChartCount) {
    blockingReasons.push("stock_chart_captures_required");
  }
  if (run.includeEtfs && run.etfPicks.length === 0) {
    blockingReasons.push("etf_picks_required");
  }
  if (run.includeEtfs && etfBoardCaptureCount === 0) {
    blockingReasons.push("etf_board_capture_required");
  }
  if (run.researchItems.length === 0) {
    blockingReasons.push("research_items_required");
  }
  if (placeholderCaptureCount > 0) {
    warnings.push("placeholder_capture_present");
  }
  if (liveCaptureCount === 0) {
    warnings.push("live_capture_not_detected");
  }

  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    counts: {
      stockPicks: run.stockPicks.length,
      etfPicks: run.etfPicks.length,
      researchItems: run.researchItems.length,
      krBoardCaptureCount,
      stockChartCaptureCount,
      etfBoardCaptureCount,
      liveCaptureCount,
      placeholderCaptureCount,
      requiredStockChartCount
    }
  };
}

export function buildDailyBriefMarkdown(run: DailyBriefRun, assets: ContentAssetAdmin[]) {
  const assetByOriginalName = new Map(assets.map((asset) => [asset.originalName, asset]));
  const krBoardAsset = findAsset(assetByOriginalName, "kr-signal-board");
  const etfAsset = findAsset(assetByOriginalName, "etf-signal-board");
  const stockAssetByCode = new Map(
    run.stockPicks.map((pick) => [pick.code, findAsset(assetByOriginalName, `${pick.code}-chart`)] as const)
  );

  return `# ${run.title}

## 먼저 확인할 점: 알림은 참고 자료이고 판단은 별도입니다

이 글은 ${run.marketDate} 기준 급등포착 시그널보드에 표시된 공개 지표를 바탕으로 오늘 관찰할 만한 종목과 ETF를 정리한 참고 자료입니다. 특정 종목을 사거나 파는 행동을 권하는 글이 아니며, 개인의 투자 성향이나 보유 종목을 고려한 투자자문도 아닙니다.

급등포착의 시그널은 가격 흐름, 전략 상태, 관심도, 점수 등을 한 화면에서 비교하기 위한 도구입니다. 다만 좋은 점수가 곧바로 매수 결론을 뜻하지는 않습니다. 실제 판단 전에는 진입가 근처 여부, 손절선 이탈 가능성, 최근 뉴스의 성격, 장중 수급 변화를 함께 확인해야 합니다.

## 오늘의 한국장 시그널보드 요약

${mediaPlaceholder(krBoardAsset, "hero", "오늘의 한국장 시그널보드")}

오늘 한국장 보드에서는 상위 ${run.stockPicks.length}개 종목을 우선 확인했습니다. 이 목록은 스윙 관점의 종합점수와 상태 라벨을 기준으로 정렬한 관찰 후보입니다. 추격 매수보다 중요한 것은 각 종목이 진입가와 얼마나 가까운지, 목표가 대비 여력이 남아 있는지, 손절선 기준을 감당할 수 있는지입니다.

## TOP ${run.stockPicks.length} 관심종목 요약표

| 순위 | 종목 | 코드 | 현재가 | 진입가 | 목표가 | 손절선 | 상태 | 점수 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${run.stockPicks
  .map(
    (pick) =>
      `| ${pick.rank} | ${pick.name} | ${pick.code} | ${pick.currentPrice ?? "-"} | ${pick.entryPrice ?? "-"} | ${pick.targetPrice ?? "-"} | ${pick.stopLoss ?? "-"} | ${pick.statusLabel ?? "-"} | ${pick.totalScore ?? "-"} |`
  )
  .join("\n")}

## 상위 5개 종목 상세 체크

${run.stockPicks
  .slice(0, run.stockDetailLimit)
  .map((pick) => buildStockSection(run, pick, stockAssetByCode.get(pick.code) ?? null))
  .join("\n\n")}

## ETF 관심 리스트 TOP ${run.etfPicks.length}

${run.includeEtfs ? mediaPlaceholder(etfAsset, "middle", "ETF 시그널보드 상위 리스트") : ""}

ETF 후보는 개별 종목보다 변동성이 낮을 수 있지만, 환율, 금리, 해외 지수, 배당 정책의 영향을 함께 받습니다. 오늘의 ETF 리스트는 보조 관찰 대상으로 보고, 개별 종목보다 포트폴리오 성격과 중복 노출을 먼저 확인하는 편이 좋습니다.

| 순위 | ETF | 코드 | 카테고리 | 현재가 | 목표여력 | 최근매수 | 수익률 | 점수 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${run.etfPicks
  .map(
    (pick) =>
      `| ${pick.rank} | ${pick.name} | ${pick.code} | ${pick.category ?? "-"} | ${pick.currentPrice ?? "-"} | ${pick.targetPotential ?? "-"} | ${pick.recentBuyDate ?? "-"} | ${pick.currentReturn ?? "-"} | ${pick.totalScore ?? "-"} |`
  )
  .join("\n")}

## 오늘의 관찰 전략

첫째, 상위 점수 종목이라도 현재가가 이미 목표가에 가까우면 추격 매수 위험이 커질 수 있습니다. 둘째, 진입가보다 많이 위에서 거래되는 종목은 눌림 또는 재확인 구간을 기다리는 편이 보수적입니다. 셋째, 손절선은 손실을 확정하는 가격이 아니라 판단이 틀렸는지 점검하는 기준으로 사용해야 합니다.

오늘의 관심종목은 장 시작 직후 변동성이 커질 수 있습니다. 따라서 시초가 급등, 장중 뉴스, 거래대금 급증, 시장 지수 방향을 함께 보면서 관찰하는 것이 좋습니다. 특히 뉴스가 이미 가격에 반영된 뒤라면 좋은 재료도 단기 조정의 이유가 될 수 있습니다.

예를 들어 현재가가 진입 기준보다 크게 위에 있다면, 점수가 높아도 바로 판단하기보다 가격이 다시 기준 구간에 가까워지는지 확인하는 편이 보수적입니다. 예시로 거래량이 늘었는데 종가가 고점에서 밀리는 경우에는 단기 차익 실현 물량이 나왔는지 따로 봐야 합니다. 상황을 가정해 지수가 약한 날 특정 종목만 강하다면, 개별 이슈인지 일시적인 수급인지 구분하는 과정이 필요합니다.

## 뉴스와 공시를 확인하는 방법

최근 뉴스와 공시는 제목만 보고 판단하기보다 발생 시점과 가격 반응을 함께 확인해야 합니다. 이 글에서는 뉴스 전문을 복사하지 않고, 검색 결과의 제목과 링크만 검토 후보로 남깁니다. 중요한 공시는 전자공시 원문과 회사 발표를 직접 확인하는 것이 안전합니다.

## 초보자가 피해야 할 실수

가장 흔한 실수는 점수가 높다는 이유만으로 즉시 주문하는 것입니다. 두 번째 실수는 목표가만 보고 손절선을 보지 않는 것입니다. 세 번째 실수는 뉴스 제목을 호재로 단정하고 이미 반영된 가격을 뒤늦게 따라가는 것입니다. 관심종목 리스트는 출발점이지 결론이 아닙니다.

## FAQ

### 급등포착 점수가 높으면 바로 매수해도 되나요?

아닙니다. 점수는 관찰 우선순위를 정하는 참고 지표입니다. 실제 매수 여부는 가격 위치, 거래량, 뉴스, 손절 기준을 따로 확인해야 합니다.

### 목표가와 손절선은 어떻게 활용하나요?

목표가는 기대 구간을 보는 참고선이고, 손절선은 판단이 틀렸을 때 리스크를 제한하기 위한 기준입니다. 둘 다 확정 수익이나 확정 손실을 의미하지 않습니다.

### ETF 후보도 같은 방식으로 보면 되나요?

ETF는 개별 기업 이슈보다 지수, 금리, 환율, 배당, 섹터 흐름의 영향을 더 많이 받습니다. 따라서 개별 종목과 같은 방식으로 보되, 포트폴리오 중복과 자산군 분산을 함께 확인해야 합니다.

## 투자 유의사항

본 글은 급등포착 시그널보드와 공개 검색 결과를 바탕으로 작성한 정보성 콘텐츠입니다. 특정 종목 또는 ETF의 매수, 매도, 보유를 권유하지 않습니다. 투자 판단과 책임은 투자자 본인에게 있으며, 실제 거래 전에는 공시, 재무 정보, 시장 상황, 본인의 투자 기준을 반드시 확인해야 합니다.
`;
}

function buildStockSection(run: DailyBriefRun, pick: DailyBriefRun["stockPicks"][number], asset: ContentAssetAdmin | null) {
  const research = run.researchItems.filter((item) => item.symbolCode === pick.code).slice(0, 2);
  const researchLines = research.length
    ? research.map((item) => `- ${item.title} (${item.source})`).join("\n")
    : "- 자동 수집된 뉴스가 부족합니다. 거래 전 최근 뉴스와 공시를 직접 확인하세요.";

  return `### ${pick.rank}. ${pick.name} (${pick.code})

${mediaPlaceholder(asset, "middle", `${pick.name} 신호차트`)}

${pick.name}은 오늘 시그널보드에서 ${pick.totalScore ?? "-"}점으로 상위권에 위치했습니다. 현재가는 ${pick.currentPrice ?? "-"}이고, 진입 기준은 ${pick.entryPrice ?? "-"}, 목표가는 ${pick.targetPrice ?? "-"}, 손절선은 ${pick.stopLoss ?? "-"}로 확인됩니다. 상태 라벨은 ${pick.statusLabel ?? "관찰"}입니다.

이 종목을 볼 때는 현재 가격이 진입가보다 얼마나 떨어져 있는지 먼저 확인해야 합니다. 이미 많이 올라간 상태라면 좋은 종목이어도 단기 변동성이 커질 수 있습니다. 반대로 진입가 근처에서 거래량이 유지된다면 관찰 가치가 커질 수 있습니다.

최근 이슈 확인 후보:
${researchLines}

체크 포인트는 세 가지입니다. 첫째, 뉴스가 장중 가격에 이미 반영됐는지 확인합니다. 둘째, 손절선 이탈 시 대응 기준을 미리 정합니다. 셋째, 같은 업종 흐름이 함께 강한지 비교합니다.`;
}

async function attachCapturesAsAssets(contentItemId: string, captures: DailyBriefCapture[]) {
  const assets: ContentAssetAdmin[] = [];
  let sortOrder = 0;

  for (const capture of captures) {
    const source = path.resolve(process.cwd(), capture.storagePath);
    const relativeDir = path.join("local-data", "uploads", "content-assets", contentItemId);
    const absoluteDir = path.resolve(process.cwd(), relativeDir);
    const fileName = `${capture.kind}-${sortOrder + 1}-${capture.fileName}`;
    const relativePath = path.join(relativeDir, fileName);
    const absolutePath = path.resolve(process.cwd(), relativePath);

    await mkdir(absoluteDir, { recursive: true });
    await copyFile(source, absolutePath);
    const fileStat = await stat(absolutePath);
    const asset = await createContentAsset({
      contentItemId,
      assetType: "image",
      fileName,
      originalName: capture.fileName,
      mimeType: "image/png",
      fileSize: fileStat.size,
      storagePath: relativePath,
      thumbnailPath: null,
      caption: capture.label,
      altText: capture.label,
      userNote: `${capture.kind} / ${capture.mode}${capture.warning ? ` / ${capture.warning}` : ""}`,
      placementHint: sortOrder === 0 ? "hero" : "middle",
      sortOrder,
      isPrimary: sortOrder === 0
    });
    assets.push(asset as unknown as ContentAssetAdmin);
    sortOrder += 1;
  }

  return assets;
}

function findAsset(assetByOriginalName: Map<string, ContentAssetAdmin>, needle: string) {
  return Array.from(assetByOriginalName.entries()).find(([name]) => name.includes(needle))?.[1] ?? null;
}

function mediaPlaceholder(asset: ContentAssetAdmin | null, placement: string, caption: string) {
  if (!asset) {
    return `> 이미지 준비 중: ${caption}`;
  }
  return `<!-- media:${asset.id} placement:${placement} caption:"${caption}" -->`;
}

async function loadDefaultBlogAndBrand() {
  const [blog, defaultBrand, firstBrand] = await Promise.all([
    prisma.blog.findFirst({ where: { status: "active" }, orderBy: { createdAt: "asc" } }),
    prisma.brandProfile.findFirst({ where: { isDefault: true }, orderBy: { createdAt: "asc" } }),
    prisma.brandProfile.findFirst({ orderBy: { createdAt: "asc" } })
  ]);

  if (!blog) {
    throw new Error("blog_profile_required");
  }
  if (!defaultBrand && !firstBrand) {
    throw new Error("brand_profile_required");
  }

  return {
    blogId: blog.id,
    brandProfileId: (defaultBrand ?? firstBrand)?.id ?? null
  };
}

function buildSourceMemo(run: DailyBriefRun) {
  return [
    `Daily Brief Run: ${run.id}`,
    `Market Date: ${run.marketDate}`,
    `KR Board: ${run.krBoardUrl}`,
    `ETF Board: ${run.etfBoardUrl}`,
    "정책: 뉴스/공시 전문 복사 금지, 투자 권유 금지, Blogger 저장/발행은 별도 승인"
  ].join("\n");
}
