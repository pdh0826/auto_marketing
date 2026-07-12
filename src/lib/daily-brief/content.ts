import { mkdir, copyFile, stat, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { buildBlogPostTemplatePreview } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { prisma } from "@/lib/db/client";
import { createContentAsset } from "@/lib/db/content-assets";
import { buildDailyBriefMarketNarrativeContext, buildStockChartInterpretation } from "./chart-narrative";
import { runInvestmentWritingOrchestrator } from "./investment-writing-orchestrator";
import { summarizePrewriteContextForSymbol, summarizePrewriteMarketContext } from "./prewrite-context";
import type { DailyBriefCapture, DailyBriefRun } from "./types";

const UPSIGNAL_MARKDOWN_LINK = "[급등포착](https://upsignal.co.kr)";

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
  const thumbnailAsset = await createDailyBriefThumbnailAsset(created.id, run);
  const captureAssets = await attachCapturesAsAssets(created.id, run.captures);
  const assets = [thumbnailAsset, ...captureAssets];
  const investmentWriting = buildBloggerInvestmentWriting(run, assets);
  const markdown = investmentWriting.markdown;
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
      draftHtml: htmlPreview.html,
      planJson: {
        kind: "daily_upsignal_brief",
        runId: run.id,
        marketDate: run.marketDate,
        stockPickLimit: run.stockPickLimit,
        stockDetailLimit: run.stockDetailLimit,
        etfPickLimit: run.etfPickLimit,
        includeEtfs: run.includeEtfs,
        investmentWriting: investmentWriting.safePlanSummary
      }
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

export async function refreshDailyBriefContentItemFromRun(run: DailyBriefRun) {
  if (!run.contentItemId) {
    throw new Error("daily_brief_content_item_required");
  }

  const contentItem = await prisma.contentItem.findUnique({
    where: { id: run.contentItemId },
    include: {
      blog: true,
      brandProfile: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!contentItem) {
    throw new Error("daily_brief_content_item_not_found");
  }
  if (contentItem.status !== "planned") {
    throw new Error("daily_brief_content_item_not_planned");
  }

  const assets = contentItem.assets as unknown as ContentAssetAdmin[];
  const investmentWriting = buildBloggerInvestmentWriting(run, assets);
  const markdown = investmentWriting.markdown;
  const provisional = {
    ...(contentItem as unknown as ContentItemAdmin),
    title: run.title,
    targetKeyword: run.targetKeyword,
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
  if (!htmlPreview.validationSummary.ok) {
    throw new Error(`daily_brief_template_preview_not_ready:${htmlPreview.validationSummary.errors[0] ?? "unknown"}`);
  }

  const updated = await prisma.contentItem.update({
    where: { id: contentItem.id },
    data: {
      title: run.title,
      targetKeyword: run.targetKeyword,
      draftMarkdown: markdown,
      draftHtml: htmlPreview.html,
      planJson: {
        ...readJsonObject(contentItem.planJson),
        investmentWriting: investmentWriting.safePlanSummary
      }
    },
    include: {
      blog: true,
      brandProfile: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
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
  const researchSearchLinkFallbackCount = run.researchItems.filter((item) => item.source === "naver_news_search_link" || item.source === "search_link").length;
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
  if (researchSearchLinkFallbackCount > 0) {
    warnings.push("news_search_link_fallback_present");
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
      researchSearchLinkFallbackCount,
      requiredStockChartCount
    }
  };
}

function buildBloggerInvestmentWriting(run: DailyBriefRun, assets: ContentAssetAdmin[]) {
  const assetByOriginalName = new Map(assets.map((asset) => [asset.originalName, asset]));
  const stockMediaByCode = new Map(
    run.stockPicks.map((pick) => [pick.code, mediaPlaceholder(findAsset(assetByOriginalName, `${pick.code}-chart`), "middle", `${pick.name} 신호차트`)] as const)
  );
  const result = runInvestmentWritingOrchestrator({
    target: "blogger_daily_brief",
    title: run.title,
    marketDate: run.marketDate,
    generatedAt: new Date().toISOString(),
    stocks: run.stockPicks,
    etfs: run.includeEtfs ? run.etfPicks : [],
    researchItems: run.researchItems,
    disclosureItems: run.officialDisclosureItems,
    prewriteContextItems: run.prewriteContextItems ?? [],
    heroMedia: mediaPlaceholder(findAsset(assetByOriginalName, "daily-brief-thumbnail"), "hero", `${run.marketDate} 급등포착 오늘의 관심종목 썸네일`),
    stockMediaByCode,
    etfMedia: run.includeEtfs ? mediaPlaceholder(findAsset(assetByOriginalName, "etf-signal-board"), "middle", "ETF 시그널보드") : null
  });
  if (!result.autoPublishEligible) throw new Error(`daily_brief_investment_writing_not_ready:${result.blockingReasons[0] ?? "unknown"}`);
  return {
    markdown: result.markdown,
    safePlanSummary: toJsonValue(buildSafeOrchestratorSummary(result))
  };
}

export function buildDailyBriefMarkdown(run: DailyBriefRun, assets: ContentAssetAdmin[]) {
  const assetByOriginalName = new Map(assets.map((asset) => [asset.originalName, asset]));
  const thumbnailAsset = findAsset(assetByOriginalName, "daily-brief-thumbnail");
  const krBoardAsset = findAsset(assetByOriginalName, "kr-signal-board");
  const etfAsset = findAsset(assetByOriginalName, "etf-signal-board");
  const marketNarrativeContext = buildDailyBriefMarketNarrativeContext(run);
  const stockAssetByCode = new Map(
    run.stockPicks.map((pick) => [pick.code, findAsset(assetByOriginalName, `${pick.code}-chart`)] as const)
  );

  return `# ${run.title}

${mediaPlaceholder(thumbnailAsset, "hero", `${run.marketDate} 급등포착 오늘의 관심종목 썸네일`)}

## 오늘의 눈에 들어온 종목

자료 기준: ${buildDataTimestampLabel(run)}. 시그널과 가격은 장중에 계속 바뀔 수 있으니, 실제 매매 전에는 ${UPSIGNAL_MARKDOWN_LINK} 원문 화면과 공시/뉴스를 한 번 더 확인하는 편이 좋습니다.

${buildDailyBriefOpeningSummary(run)}

${summarizePrewriteMarketContext(run.prewriteContextItems ?? [])}

## 오늘의 투자매력도 TOP 3

${buildTopThreeComparison(run)}

## 오늘 보드는 이렇게 읽었습니다

${mediaPlaceholder(krBoardAsset, "middle", "오늘의 한국장 시그널보드")}

오늘 ${UPSIGNAL_MARKDOWN_LINK} 한국장 보드는 금융주와 소비재 쪽이 먼저 눈에 들어왔습니다. 점수표를 그대로 읽는 글보다는, 제가 실제로 차트를 열어보는 순서에 맞춰서 풀어보겠습니다. 먼저 상위 ${run.stockPicks.length}개를 훑고, 그중에서 차트와 뉴스가 같이 볼 만한 종목을 조금 더 자세히 보겠습니다.

## 오늘 리스트 먼저 보기

| 순위 | 종목 | 코드 | 현재가 | 진입가 | 목표가 | 손절선 | 상태 | 점수 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${run.stockPicks
  .map(
    (pick) =>
      `| ${pick.rank} | ${pick.name} | ${pick.code} | ${pick.currentPrice ?? "-"} | ${pick.entryPrice ?? "-"} | ${pick.targetPrice ?? "-"} | ${pick.stopLoss ?? "-"} | ${pick.statusLabel ?? "-"} | ${pick.totalScore ?? "-"} |`
  )
  .join("\n")}

## 종목별로 제가 보는 포인트

${run.stockPicks
  .slice(0, run.stockDetailLimit)
  .map((pick) => buildStockSection(run, pick, stockAssetByCode.get(pick.code) ?? null, marketNarrativeContext))
  .join("\n\n")}

## ETF 관심 리스트 TOP ${run.etfPicks.length}

${run.includeEtfs ? mediaPlaceholder(etfAsset, "middle", "ETF 시그널보드 상위 리스트") : ""}

ETF 쪽도 같이 보면 오늘 돈이 어디로 움직이는지 감을 잡는 데 도움이 됩니다. 개별 종목처럼 한 방에 튀는 맛은 덜할 수 있지만, 환율·금리·해외 지수·배당 흐름이 같이 묻어 있어서 시장 분위기를 읽기에는 오히려 편할 때가 있습니다.

| 순위 | ETF | 코드 | 카테고리 | 현재가 | 목표여력 | 최근매수 | 수익률 | 점수 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${run.etfPicks
  .map(
    (pick) =>
      `| ${pick.rank} | ${normalizeEtfDisplayName(pick.name)} | ${pick.code} | ${pick.category ?? "-"} | ${pick.currentPrice ?? "-"} | ${pick.targetPotential ?? "-"} | ${pick.recentBuyDate ?? "-"} | ${pick.currentReturn ?? "-"} | ${pick.totalScore ?? "-"} |`
  )
  .join("\n")}

${run.etfPicks.slice(0, Math.min(5, run.etfPicks.length)).map((pick) => buildEtfSection(run, pick)).join("\n\n")}

## 오늘 장에서 저는 이렇게 볼 겁니다

점수가 높다고 바로 좋은 타이밍이라고 보지는 않습니다. 이미 목표가 근처까지 올라간 종목은 오히려 쉬어갈 수 있고, 진입 기준에서 너무 멀어진 종목은 한 번 눌릴 때까지 기다리는 편이 마음이 편합니다. 손절선도 겁주는 숫자라기보다, 내 판단이 틀렸을 때 어디서 멈출지 정해두는 기준에 가깝습니다.

특히 오늘처럼 상단 종목이 뚜렷하게 보이는 날에는 장 시작 직후 움직임이 커질 수 있습니다. 시초가가 너무 뜨는지, 거래대금이 따라오는지, 코스피·코스닥 방향이 도와주는지를 같이 봐야 합니다. 좋은 뉴스가 있어도 가격에 이미 반영됐다면, 그 뉴스가 단기 차익 실현의 계기가 될 수도 있습니다.

그래서 저는 이런 날 상위 종목을 먼저 차트에 띄워두고, 가격이 진입 기준 근처에서 버티는지, 거래량이 따라오는지, 뉴스가 실제 수급으로 이어지는지를 순서대로 봅니다. 결국 좋은 종목을 찾는 것도 중요하지만, 더 중요한 건 “내가 감당할 수 있는 자리에서 보느냐”입니다.

## 뉴스와 공시는 이렇게 확인합니다

뉴스는 제목만 보면 굉장히 좋아 보일 때가 많습니다. 그런데 막상 차트를 보면 이미 반영된 경우도 있고, 반대로 조용히 거래대금이 붙기 시작하는 경우도 있습니다. 그래서 저는 뉴스 제목보다 “언제 나왔는지”, “그 뒤 가격이 어떻게 반응했는지”, “공시로 확인되는 내용인지”를 같이 봅니다.

종목별 문단에는 뉴스 링크와 DART·KRX KIND 공시 확인 경로를 같이 붙였습니다. 뉴스는 분위기를 빠르게 보는 용도이고, 중요한 내용은 공식 공시 원문에서 다시 확인하는 쪽이 안전합니다.

## 오늘 같은 날 피하고 싶은 실수

가장 흔한 실수는 점수가 높다는 이유만으로 급하게 따라가는 것입니다. 두 번째는 목표가만 보고 손절 기준을 보지 않는 것이고, 세 번째는 뉴스 제목을 호재로 단정한 뒤 이미 올라버린 가격을 뒤늦게 따라가는 것입니다. 오늘 리스트도 결론이라기보다, 장중에 먼저 확인할 순서를 정해주는 지도에 가깝게 보는 게 좋겠습니다.

## FAQ

### ${UPSIGNAL_MARKDOWN_LINK} 점수가 높으면 바로 사도 되나요?

저라면 점수만 보고 바로 들어가지는 않습니다. 점수는 “먼저 볼 종목”을 골라주는 역할에 가깝고, 실제 판단은 가격 위치, 거래량, 뉴스, 손절 기준까지 같이 본 뒤에 하는 편이 좋습니다.

### 목표가와 손절선은 어떻게 활용하나요?

목표가는 기대 구간을 보는 참고선이고, 손절선은 판단이 틀렸을 때 리스크를 제한하기 위한 기준입니다. 둘 다 확정 수익이나 확정 손실을 의미하지 않습니다.

### ETF 후보도 같은 방식으로 보면 되나요?

ETF는 개별 기업 이슈보다 지수, 금리, 환율, 배당, 섹터 흐름의 영향을 더 많이 받습니다. 따라서 개별 종목과 같은 방식으로 보되, 포트폴리오 중복과 자산군 분산을 함께 확인해야 합니다.

## 마지막으로

이 글은 ${run.marketDate} 기준 ${UPSIGNAL_MARKDOWN_LINK} 시그널보드에 표시된 공개 지표를 바탕으로, 오늘 제 기준에서 눈여겨볼 만한 종목과 ETF를 정리한 개인 블로그 글입니다. 저는 이런 식으로 종목을 추려보지만, 각자 보유 종목·투자 기간·손절 기준이 다르기 때문에 최종 판단은 본인 기준으로 하셔야 합니다.

${UPSIGNAL_MARKDOWN_LINK}의 시그널은 가격 흐름, 전략 상태, 관심도, 점수 등을 한 화면에서 비교하기 위한 도구입니다. 좋은 점수가 곧바로 매수 결론을 뜻하지는 않습니다. 실제 판단 전에는 진입가 근처 여부, 손절선 이탈 가능성, 최근 뉴스의 성격, 장중 수급 변화를 함께 확인하는 편이 좋습니다.

본 글은 ${UPSIGNAL_MARKDOWN_LINK} 시그널보드와 공개 검색 결과를 바탕으로 작성한 정보성 콘텐츠입니다. 투자 판단과 책임은 투자자 본인에게 있으며, 실제 거래 전에는 공시, 재무 정보, 시장 상황, 본인의 투자 기준을 반드시 확인해야 합니다.
`;
}

function buildStockSection(
  run: DailyBriefRun,
  pick: DailyBriefRun["stockPicks"][number],
  asset: ContentAssetAdmin | null,
  marketNarrativeContext: ReturnType<typeof buildDailyBriefMarketNarrativeContext>
) {
  const research = run.researchItems.filter((item) => item.symbolCode === pick.code).slice(0, 2);
  const displayName = normalizeStockDisplayName(pick.name);
  const researchLines = research.length
    ? research.map((item) => `- ${formatResearchLink(item)}`).join("\n")
    : "- 오늘 자동 수집된 뉴스가 많지는 않습니다. 이런 경우에는 장중 거래대금과 공시 검색을 더 보수적으로 같이 봅니다.";
  const officialDisclosureLines = buildOfficialDisclosureSection(run, displayName, pick.code);

  return `### ${displayName}: ${buildBloggerStockSignalHeadline(pick)}

${mediaPlaceholder(asset, "middle", `${displayName} 신호차트`)}

${buildBloggerStockNarrative({ run, pick })}

${buildStockChartInterpretation({
  pick,
  marketDate: run.marketDate,
  marketContext: marketNarrativeContext,
  variantSeed: "blogger-daily-brief"
})}

이 자료까지 같이 보면:
${summarizePrewriteContextForSymbol(run.prewriteContextItems ?? [], pick.code)}

제가 오늘 확인할 자료:
${researchLines}

공식 공시는 여기서 다시 봅니다:
${officialDisclosureLines}

${buildNewsCheckCommentary(displayName, inferStockTopic(displayName))}

${buildBloggerStockClosing(run.marketDate, pick)}`;
}

function buildBloggerStockSignalHeadline(pick: DailyBriefRun["stockPicks"][number]) {
  const name = normalizeStockDisplayName(pick.name);
  const topic = inferStockTopic(name);
  const entry = pick.entryPrice ? `${pick.entryPrice}원대 진입 기준` : "최근 신호 자리 확인";
  if (topic === "financial") {
    return `${entry}, 금융주 강세 흐름 체크`;
  }
  if (topic === "consumer_beauty") {
    return `${entry}, 소비재 모멘텀 확인`;
  }
  if (topic === "transport_air") {
    return `${entry}, 여행·운송 수급 확인`;
  }
  if (topic === "auto_parts") {
    return `${entry}, 업종 동반 흐름 확인`;
  }
  return `${entry}, 차트와 뉴스 같이 보기`;
}

const BLOGGER_STOCK_CLOSING_PATTERNS: Array<
  (context: {
    name: string;
    subjectName: string;
    objectName: string;
    topicLabel: string;
    entryPrice: string;
    targetPrice: string;
    stopLossObject: string;
  }) => string
> = [
  (context) => `저라면 ${context.objectName} 오늘 관심 목록에 올려두고, ${context.entryPrice} 근처에서 거래가 붙는지 먼저 보겠습니다. ${context.topicLabel} 쪽이 같이 움직이면 더 편하게 볼 수 있고, 혼자만 튀면 조금 더 조심하는 편이 좋겠습니다.`,
  (context) => `${context.subjectName} 목표가 ${context.targetPrice}보다 ${context.stopLossObject} 먼저 적어두고 보겠습니다. 기대 구간은 누구나 보기 쉽지만, 실제 매매에서는 틀렸을 때 어디서 멈출지가 더 중요합니다.`,
  (context) => `이 종목은 하루만 보고 끝낼 종목이라기보다, 다음 장에서도 같은 자리에서 버티는지 이어서 볼 만합니다. ${context.topicLabel} 쪽 흐름이 계속 살아 있으면 다시 차트를 열어볼 이유가 생깁니다.`,
  (context) => `저는 이런 차트에서는 거래대금을 먼저 봅니다. ${context.subjectName} ${context.entryPrice} 근처에서 버티면서 거래가 늘면 조금 더 재미있게 볼 수 있고, 거래가 식으면 신호만 찍힌 하루로 끝날 수도 있습니다.`,
  (context) => `${context.subjectName} 지금 당장 좋다/나쁘다로 자르기보다, 기준선 위에서 버티는지를 보는 쪽이 맞겠습니다. 급하게 따라붙기보다 한 번 더 눌리는 구간이 오는지도 같이 보겠습니다.`,
  (context) => `개인적으로는 ${context.objectName} 크게 잡기보다 작게 열어두고 보는 쪽이 편합니다. ${context.stopLossObject} 깨는 흐름이면 생각보다 빠르게 정리 기준을 세워야 합니다.`,
  (context) => `${context.subjectName} 뉴스가 같이 붙어주면 더 보기 편한 종목입니다. 차트만 좋고 재료가 약하면 힘이 오래 못 갈 수 있어서, 기사 흐름과 장중 거래를 같이 보겠습니다.`,
  (context) => `오늘 ${context.name}에서 중요한 건 목표가까지 몇 퍼센트 남았느냐보다, 신호가 나온 뒤 가격이 무너지지 않고 버티느냐입니다. 이 부분이 유지되면 다음 장에서도 다시 볼 만합니다.`,
  (context) => `저는 ${context.objectName} 볼 때 차트와 뉴스가 같은 방향인지부터 확인하겠습니다. 방향이 맞으면 기회가 생기고, 어긋나면 괜히 서두를 필요가 없습니다.`,
  (context) => `${context.subjectName} 오늘 메모장에 남겨둘 종목입니다. 좋은 흐름이 이어지면 다시 자세히 볼 수 있고, 기준선 아래로 밀리면 굳이 붙잡고 있을 필요는 없어 보입니다.`
];

function buildBloggerStockClosing(marketDate: string, pick: DailyBriefRun["stockPicks"][number]) {
  const name = normalizeStockDisplayName(pick.name);
  const topic = inferStockTopic(name);
  const context = {
    name,
    subjectName: withTopicParticle(name),
    objectName: `${name}${hasFinalConsonant(name) ? "을" : "를"}`,
    topicLabel: describeBloggerStockTopic(topic),
    entryPrice: pick.entryPrice ?? "진입 기준",
    targetPrice: pick.targetPrice ?? "목표가",
    stopLossObject: pick.stopLoss ? `손절선 ${pick.stopLoss}원을` : "손절선을"
  };
  const pattern =
    BLOGGER_STOCK_CLOSING_PATTERNS[
      stableIndex([marketDate, pick.code, name, "blogger-stock-closing"].join(":"), BLOGGER_STOCK_CLOSING_PATTERNS.length)
    ];
  return pattern(context);
}

type BloggerStockNarrativeContext = {
  name: string;
  subjectName: string;
  objectName: string;
  topicLabel: string;
  status: string;
  score: string;
  currentPrice: string;
  entryPrice: string;
  targetPrice: string;
  stopLoss: string;
  stopLossSubject: string;
  entryGapText: string;
  targetGapText: string;
  stopGapText: string;
};

type BloggerEtfNarrativeContext = {
  name: string;
  sector: string;
  currentPrice: string;
  targetPotential: string;
  recentBuyDate: string;
  currentReturn: string;
  totalScore: string;
};

const BLOGGER_STOCK_NARRATIVE_PATTERNS: Array<(context: BloggerStockNarrativeContext) => string> = [
  (context) => `요즘 ${context.topicLabel} 쪽 종목이 보드 위쪽에 자주 보입니다. ${context.objectName} 오늘 그냥 지나치기에는 조금 아깝습니다. 점수는 ${context.score}, 상태는 ${context.status}로 찍혀 있는데, 저는 이 숫자보다 먼저 “지금 가격이 너무 앞서갔는가?”를 봅니다.

현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. ${context.entryGapText} 이 정도면 장 시작 후 바로 쫓아가기보다 기준선 근처에서 버티는지 먼저 확인하는 쪽이 마음이 편합니다.

목표가는 ${context.targetPrice}, 손절선은 ${context.stopLoss}입니다. ${context.targetGapText} ${context.stopGapText} 목표가만 보면 기분이 좋아지지만, 손절선까지 같이 봐야 실제로 감당 가능한 자리가 보입니다.`,
  (context) => `${context.subjectName} 오늘 차트를 따로 열어볼 만했습니다. ${context.topicLabel} 흐름이 살아나는 날에는 이런 종목이 생각보다 빨리 반응할 수 있습니다.

현재가는 ${context.currentPrice}, 진입가는 ${context.entryPrice}입니다. ${context.entryGapText} 저는 여기서 “조금 늦은 자리인가, 아직 기다려볼 자리인가”를 먼저 나눠봅니다.

목표가 ${context.targetPrice}까지의 공간은 참고할 수 있습니다. 다만 ${context.stopLossSubject} 마음에 안 들면 좋은 종목이어도 매매가 피곤해집니다. 그래서 저는 위쪽 기대보다 아래쪽 기준을 먼저 적어둡니다.`,
  (context) => `오늘 ${context.subjectName} 이름부터 눈에 들어왔다기보다, 차트 위치 때문에 한 번 멈춰서 보게 됐습니다. 점수는 ${context.score}, 상태는 ${context.status}입니다.

현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}. ${context.entryGapText} 뭔소리냐구요? 쉽게 말하면 너무 멀리 도망간 종목은 좋은 뉴스가 있어도 손이 잘 안 나간다는 이야기입니다.

목표가는 ${context.targetPrice}, 손절선은 ${context.stopLoss}입니다. 이 두 숫자를 같이 놓고 보면 이 종목을 크게 볼지, 작게 볼지, 아니면 그냥 관망할지 감이 조금 잡힙니다.`,
  (context) => `${context.topicLabel} 종목은 하루만 보고 판단하기 어렵습니다. 업종 전체가 같이 움직이는지 봐야 하는데, 오늘 ${context.subjectName} 그중에서 한 번 더 열어볼 만한 위치에 있습니다.

현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. ${context.entryGapText} 저는 이런 자리에서는 시초가가 너무 뜨는지, 아니면 기준 근처에서 차분히 거래가 붙는지를 봅니다.

목표가 ${context.targetPrice}는 위쪽 공간이고, ${context.stopLossSubject} 제 판단이 틀렸을 때 멈추는 기준입니다. 둘 중 하나만 보면 글이 너무 달콤하거나 너무 겁먹은 글이 됩니다.`,
  (context) => `${context.subjectName} 오늘 보드에서 “왜 여기 올라왔지?” 하고 다시 보게 되는 종목입니다. 점수 ${context.score}도 나쁘지 않고, 상태도 ${context.status}로 표시됩니다.

현재가는 ${context.currentPrice}, 진입가는 ${context.entryPrice}입니다. ${context.entryGapText} 이 차이가 너무 벌어져 있으면 저는 일단 서두르지 않습니다. 반대로 기준선 근처에서 버티면 장중에 다시 볼 이유가 생깁니다.

손절선은 ${context.stopLoss}, 목표가는 ${context.targetPrice}입니다. 수익은 시장이 줘야 나는 거고, 손실은 제가 정리할 수 있어야 합니다. 그래서 손절선이 먼저 눈에 들어옵니다.`,
  (context) => `개인적으로 ${context.subjectName} 오늘 “메모해둘 종목”에 가깝습니다. ${context.topicLabel} 쪽 분위기가 같이 붙어주면 신호가 조금 더 의미 있어질 수 있습니다.

현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}. ${context.entryGapText} 기준선 위에서 버티는지, 거래대금이 붙는지, 뉴스가 따라오는지를 같이 봐야 합니다.

목표가는 ${context.targetPrice}, 손절선은 ${context.stopLoss}입니다. 위만 보면 기대가 커지고, 아래만 보면 겁이 납니다. 둘을 같이 봐야 매매 계획이 됩니다.`,
  (context) => `${context.subjectName} 오늘 바로 결론 내리기보다 차트를 열어두고 보는 쪽이 좋아 보입니다. ${context.topicLabel} 흐름은 장중 분위기에 따라 금방 달라질 수 있기 때문입니다.

현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. ${context.entryGapText} 아직 기준 근처라면 괜찮지만, 장 초반에 너무 멀리 뛰면 다시 눌림을 기다리는 편이 낫습니다.

목표가 ${context.targetPrice}, 손절선 ${context.stopLoss}. 저는 이 두 숫자를 보고 “기대할 자리”와 “멈출 자리”를 나눠놓습니다. 그래야 흔들릴 때 덜 급해집니다.`,
  (context) => `오늘 ${context.subjectName} 차트만 놓고 보면 한 번 더 확인할 이유가 있습니다. 점수는 ${context.score}, 상태는 ${context.status}입니다.

현재가는 ${context.currentPrice}, 진입가는 ${context.entryPrice}입니다. ${context.entryGapText} 이 정도 위치라면 저는 먼저 이평선 위에서 버티는지 봅니다. 이평선 위에서 거래가 붙으면 조금 기대를 걸어볼 수 있습니다.

다만 목표가 ${context.targetPrice}만 보고 따라가면 안 됩니다. 손절선 ${context.stopLoss}까지 같이 봐야 이 종목이 내 기준에 맞는지 판단할 수 있습니다.`,
  (context) => `${context.topicLabel} 쪽은 뉴스 하나로도 분위기가 달라질 수 있습니다. 그래서 ${context.objectName} 차트와 뉴스 흐름을 같이 봐야 합니다.

현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}. ${context.entryGapText} 저는 가격이 기준에서 얼마나 벌어졌는지부터 봅니다. 좋은 종목도 너무 늦게 들어가면 매매가 꼬입니다.

목표가는 ${context.targetPrice}, 손절선은 ${context.stopLoss}입니다. ${context.targetGapText} ${context.stopGapText} 이 균형이 맞아야 실제로 장중에 대응하기 편합니다.`,
  (context) => `${context.subjectName} 오늘 “상위권이라서 본다”보다 “차트가 설명을 요구해서 본다”에 가깝습니다. 점수는 ${context.score}, 상태는 ${context.status}입니다.

현재가는 ${context.currentPrice}, 진입가는 ${context.entryPrice}입니다. ${context.entryGapText} 여기서 가격이 기준선 근처에서 버티면 신호가 조금 더 살아 있다고 볼 수 있습니다.

목표가와 손절선을 같이 보면, 이 종목이 기대만 큰 자리인지 아니면 리스크까지 감당 가능한 자리인지 조금 더 분명해집니다.`
];

const BLOGGER_ETF_NARRATIVE_PATTERNS: Array<(context: BloggerEtfNarrativeContext) => string> = [
  (context) => `### ${context.name}: 시장 방향을 같이 보는 ETF

오늘 ETF 쪽에서는 ${context.name}도 같이 볼 만합니다. ${context.sector} 흐름이 위로 올라오면 개별 종목보다 시장이 어느 방향을 편하게 보는지 확인하기 좋습니다.

현재가는 ${context.currentPrice}, 목표여력은 ${context.targetPotential}, 최근매수 기준은 ${context.recentBuyDate}입니다. 숫자만 보면 딱딱하지만, 저는 여기서 “이 자산군으로 돈이 계속 들어오는가?”를 먼저 봅니다.`,
  (context) => `### ${context.name}: 종목이 애매할 때 보는 힌트

종목을 바로 고르기 애매한 날에는 ETF가 힌트를 줍니다. ${context.name}은 ${context.sector} 쪽 흐름을 확인하기 좋은 후보입니다.

현재가 ${context.currentPrice}, 최근매수 ${context.recentBuyDate}, 점수 ${context.totalScore}. 저는 이 숫자를 매수 신호로 바로 보지 않고, 시장 큰 방향을 확인하는 보조 지표로 봅니다.`,
  (context) => `### ${context.name}: 큰 흐름부터 확인하기

${context.name}은 개별 기업 이슈보다 큰 흐름을 보는 ETF입니다. ${context.sector} 쪽이 반복해서 위에 올라오면 관련 종목들도 같이 봐야 합니다.

현재가는 ${context.currentPrice}, 목표여력은 ${context.targetPotential}입니다. ETF는 느리게 움직일 수 있지만, 방향이 맞으면 종목보다 흔들림이 덜할 때가 있습니다.`,
  (context) => `### ${context.name}: 미국장과 금리 흐름까지 같이 보기

ETF는 종목 하나의 실적보다 금리, 환율, 해외 지수 흐름이 더 크게 작용할 때가 많습니다. ${context.name}도 ${context.sector} 흐름을 같이 확인하는 용도로 봅니다.

최근매수 기준은 ${context.recentBuyDate}, 현재수익률은 ${context.currentReturn}입니다. 저는 이런 값이 하루짜리 반등인지 며칠 이어지는 흐름인지 확인합니다.`,
  (context) => `### ${context.name}: 포트폴리오 관점에서 보기

${context.name}은 개별 종목보다 포트폴리오 관점에서 볼 만합니다. 오늘처럼 상위 종목이 뚜렷해도 ETF를 같이 보면 시장의 큰 방향이 조금 더 선명해집니다.

현재가는 ${context.currentPrice}, 목표여력은 ${context.targetPotential}, 점수는 ${context.totalScore}입니다. 이 값들이 괜찮아도 중복 노출은 꼭 확인해야 합니다.`,
  (context) => `### ${context.name}: 섹터 온도 체크

오늘 ${context.name}을 보는 이유는 단순히 점수가 높아서가 아닙니다. ${context.sector} 쪽 온도가 살아 있는지 확인하기 위해서입니다.

현재가 ${context.currentPrice}, 최근매수 ${context.recentBuyDate}. 저는 ETF가 상위권에 올라오면 관련 종목들이 뒤따라오는지 같이 봅니다.`,
  (context) => `### ${context.name}: 방어적으로 볼 때의 선택지

종목이 너무 빠르게 움직이는 날에는 ETF가 오히려 보기 편할 수 있습니다. ${context.name}은 ${context.sector} 흐름을 조금 더 넓게 볼 수 있는 후보입니다.

현재가는 ${context.currentPrice}, 현재수익률은 ${context.currentReturn}입니다. 다만 ETF도 시장이 흔들리면 같이 밀릴 수 있으니, 큰 흐름을 계속 확인해야 합니다.`,
  (context) => `### ${context.name}: 오늘 시장이 어디를 보는지

${context.name}은 오늘 시장이 어디를 보고 있는지 확인하는 데 도움이 됩니다. ${context.sector} 쪽이 위에 있으면 관련 뉴스와 해외 지수 흐름을 같이 봐야 합니다.

목표여력은 ${context.targetPotential}, 최근매수 기준은 ${context.recentBuyDate}입니다. 저는 이 값이 이어지는지, 아니면 하루짜리 관심인지 다음 날도 확인합니다.`,
  (context) => `### ${context.name}: 종목 전에 보는 지도

가끔은 종목보다 ETF를 먼저 보는 게 낫습니다. ${context.name}은 ${context.sector} 쪽 지도를 먼저 펼쳐보는 느낌으로 보면 됩니다.

현재가는 ${context.currentPrice}, 점수는 ${context.totalScore}입니다. 이 ETF가 버티면 관련 종목을 더 편하게 볼 수 있고, ETF가 힘을 잃으면 종목 신호도 조금 보수적으로 봐야 합니다.`,
  (context) => `### ${context.name}: 느리지만 큰 방향

${context.name}은 개별 종목처럼 빠르게 움직이지 않을 수 있습니다. 대신 ${context.sector} 쪽 큰 방향을 확인하는 데는 꽤 쓸 만합니다.

현재가 ${context.currentPrice}, 목표여력 ${context.targetPotential}, 최근매수 ${context.recentBuyDate}. 저는 이런 ETF를 볼 때 단기 수익률보다 방향의 지속성을 더 중요하게 봅니다.`
];

function describeBloggerStockTopic(topic: string) {
  if (topic === "consumer_beauty") {
    return "화장품·소비재";
  }
  if (topic === "transport_air") {
    return "항공·운송";
  }
  if (topic === "financial") {
    return "금융주";
  }
  if (topic === "auto_parts") {
    return "자동차·부품";
  }
  if (topic === "energy") {
    return "에너지·정유";
  }
  return "해당 업종";
}

function buildEntryGapText(pick: DailyBriefRun["stockPicks"][number]) {
  const current = parsePrice(pick.currentPrice);
  const entry = parsePrice(pick.entryPrice);
  if (!current || !entry) {
    return "현재가와 진입 기준의 거리는 원문 차트에서 한 번 더 확인해야 합니다.";
  }
  const gap = ((current - entry) / entry) * 100;
  if (Math.abs(gap) < 1) {
    return `진입 기준과 거의 붙어 있는 편입니다(${formatPercent(gap)}).`;
  }
  if (gap > 0) {
    return `진입 기준 위에서 약 ${formatPercent(gap)} 정도 버티고 있습니다.`;
  }
  return `진입 기준 아래로 약 ${formatPercent(Math.abs(gap))} 내려와 있어, 다시 기준을 회복하는지 확인해야 합니다.`;
}

function buildTargetGapText(pick: DailyBriefRun["stockPicks"][number]) {
  const current = parsePrice(pick.currentPrice);
  const target = parsePrice(pick.targetPrice);
  if (!current || !target) {
    return "목표가까지의 공간은 원문 차트에서 다시 확인해야 합니다.";
  }
  const gap = ((target - current) / current) * 100;
  if (gap <= 0) {
    return `목표가 기준으로는 이미 상단에 가까운 편입니다(${formatPercent(gap)}).`;
  }
  return `목표가까지는 단순 계산으로 약 ${formatPercent(gap)} 정도 남아 있습니다.`;
}

function buildStopGapText(pick: DailyBriefRun["stockPicks"][number]) {
  const current = parsePrice(pick.currentPrice);
  const stopLoss = parsePrice(pick.stopLoss);
  if (!current || !stopLoss) {
    return "손절선과의 거리는 원문 차트에서 다시 확인해야 합니다.";
  }
  const gap = ((current - stopLoss) / current) * 100;
  if (gap <= 0) {
    return `손절 기준을 이미 건드렸는지 확인이 필요합니다(${formatPercent(gap)}).`;
  }
  return `손절선까지는 약 ${formatPercent(gap)} 정도 여유가 있습니다.`;
}

function inferEtfSector(name: string) {
  if (/S&P|나스닥|미국|해외/i.test(name)) {
    return "미국·해외";
  }
  if (/배당|커버드|인컴|고배당/i.test(name)) {
    return "배당·인컴";
  }
  if (/채권|금리|머니|현금|단기/i.test(name)) {
    return "채권·금리·현금성";
  }
  if (/반도체|AI|테크|기술|GPU/i.test(name)) {
    return "반도체·AI";
  }
  if (/은행|금융/i.test(name)) {
    return "금융";
  }
  return "ETF";
}

function stableIndex(value: string, modulo: number) {
  if (modulo <= 0) {
    return 0;
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}

function buildBloggerStockNarrative(input: { run: DailyBriefRun; pick: DailyBriefRun["stockPicks"][number] }) {
  const pick = input.pick;
  const name = normalizeStockDisplayName(pick.name);
  const topic = inferStockTopic(name);
  const context: BloggerStockNarrativeContext = {
    name,
    subjectName: withTopicParticle(name),
    objectName: `${name}${hasFinalConsonant(name) ? "을" : "를"}`,
    topicLabel: describeBloggerStockTopic(topic),
    status: pick.statusLabel ?? "체크 필요",
    score: pick.totalScore ? `${pick.totalScore}점` : "점수 미확인",
    currentPrice: pick.currentPrice ?? "-",
    entryPrice: pick.entryPrice ?? "-",
    targetPrice: pick.targetPrice ?? "-",
    stopLoss: pick.stopLoss ? `${pick.stopLoss}원` : "-",
    stopLossSubject: pick.stopLoss ? `손절선 ${pick.stopLoss}원이` : "손절선이",
    entryGapText: buildEntryGapText(pick),
    targetGapText: buildTargetGapText(pick),
    stopGapText: buildStopGapText(pick)
  };
  const pattern = BLOGGER_STOCK_NARRATIVE_PATTERNS[stableIndex([input.run.marketDate, pick.code, name, "blogger-stock"].join(":"), BLOGGER_STOCK_NARRATIVE_PATTERNS.length)];
  return pattern(context);
}

function buildEtfSection(run: DailyBriefRun, pick: DailyBriefRun["etfPicks"][number]) {
  const name = normalizeEtfDisplayName(pick.name);
  const context: BloggerEtfNarrativeContext = {
    name,
    sector: pick.category ?? inferEtfSector(name),
    currentPrice: pick.currentPrice ?? "-",
    targetPotential: pick.targetPotential ?? "-",
    recentBuyDate: pick.recentBuyDate ?? "원문 화면 확인 필요",
    currentReturn: pick.currentReturn ?? "-",
    totalScore: pick.totalScore ?? "-"
  };
  const pattern = BLOGGER_ETF_NARRATIVE_PATTERNS[stableIndex([run.marketDate, pick.code, name, "blogger-etf"].join(":"), BLOGGER_ETF_NARRATIVE_PATTERNS.length)];
  return pattern(context);
}

function buildDailyBriefOpeningSummary(run: DailyBriefRun) {
  const topStocks = run.stockPicks.slice(0, 3).map((pick) => normalizeStockDisplayName(pick.name));
  const topStockText = topStocks.length > 0 ? topStocks.join(", ") : "상위 관심종목";
  const statusGroups = countBy(run.stockPicks.map((pick) => pick.statusLabel ?? "체크 필요"));
  const dominantStatus = Object.entries(statusGroups).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "체크 필요";
  const averageScore = averageNumericScore(run.stockPicks.map((pick) => pick.totalScore));
  const etfText = run.includeEtfs && run.etfPicks.length > 0 ? `ETF 후보 ${run.etfPicks.length}개도 함께 비교했습니다.` : "ETF 후보는 이번 요약에서 제외했습니다.";

  return [
    `${run.marketDate} 아침 기준으로 ${UPSIGNAL_MARKDOWN_LINK} 한국장 보드를 열어보니, 오늘은 ${topStockText} 이쪽이 먼저 눈에 들어왔습니다. 숫자를 쭉 나열하기보다, 제가 실제로 장을 보기 전에 어떤 순서로 생각하는지에 가깝게 정리해보겠습니다.`,
    `상위 ${run.stockPicks.length}개 종목은 대체로 ${dominantStatus} 흐름이 많고${averageScore ? `, 평균 점수는 약 ${averageScore}점입니다` : ""}. ${etfText} 오늘 글은 “뭘 사라”가 아니라, 아침에 차트 몇 개 띄워두고 같이 시장을 훑어보는 느낌으로 봐주시면 좋겠습니다.`
  ].join("\n\n");
}

function buildTopThreeComparison(run: DailyBriefRun) {
  const topThree = run.stockPicks.slice(0, 3);
  if (topThree.length === 0) {
    return "상위 비교 대상이 아직 충분하지 않습니다. 시그널보드 원문을 먼저 확인하세요.";
  }

  const names = topThree.map((pick) => normalizeStockDisplayName(pick.name));
  const topNameText = joinKoreanList(names);
  const scoreText = topThree
    .map((pick) => `${normalizeStockDisplayName(pick.name)} ${pick.totalScore ? `${pick.totalScore}점` : "점수 미확인"}`)
    .join(", ");
  const priceText = topThree.map((pick) => buildCompactPricePosition(pick)).filter(Boolean).join(" ");

  return `오늘의 투자매력도 TOP 3는 ${topNameText}입니다. 오늘 보드에서 제가 먼저 열어볼 종목을 고르라면 이 세 종목부터 볼 것 같습니다. 점수만 보면 ${scoreText}으로 상단에 있고, 상태 라벨도 그냥 지나치기에는 아까운 쪽입니다.

다만 여기서 중요한 건 “점수가 높으니까 끝”이 아닙니다. ${priceText} 결국 관건은 가격이 좋은 자리에서 버티는지, 뉴스와 수급이 같이 붙는지입니다. 아래에서 차트와 자료를 보면서 하나씩 풀어보겠습니다.`;
}

function buildCompactPricePosition(pick: DailyBriefRun["stockPicks"][number]) {
  const current = parsePrice(pick.currentPrice);
  const entry = parsePrice(pick.entryPrice);
  const target = parsePrice(pick.targetPrice);
  if (!current || !entry || !target) {
    return "가격 위치는 원문 화면에서 한 번 더 봐야 합니다.";
  }
  const entryGap = ((current - entry) / entry) * 100;
  const targetGap = ((target - current) / current) * 100;
  const name = normalizeStockDisplayName(pick.name);
  const positionText =
    entryGap >= 0
      ? `진입 기준 위에서 약 ${formatPercent(entryGap)} 정도 버티고 있고`
      : `진입 기준 아래로 약 ${formatPercent(Math.abs(entryGap))} 내려와 있고`;
  return `${withTopicParticle(name)} ${positionText}, 위쪽 공간은 약 ${formatPercent(targetGap)} 정도로 보입니다.`;
}

function buildStockBlogLead(name: string, pick: DailyBriefRun["stockPicks"][number], topic: string) {
  const score = pick.totalScore ? `${pick.totalScore}점` : "점수 미확인";
  const status = pick.statusLabel ?? "체크 필요";
  const topicLead = buildTopicLead(name, topic);

  return `${withTopicParticle(name)} 오늘 보드에서 꽤 빨리 눈에 들어왔습니다. 점수는 ${score}, 상태는 ${status}로 찍혀 있는데, 저는 여기서 숫자 자체보다 “왜 지금 이 이름이 위로 올라왔는지”를 먼저 봅니다. ${topicLead}`;
}

function buildTopicLead(name: string, topic: string) {
  if (topic === "consumer_beauty") {
    return `${name}은 소비재·뷰티 쪽 기대감이 붙을 때 주가 반응이 빨라질 수 있는 종목이라, 실적 기대와 수출 흐름이 같이 살아나는지가 중요합니다.`;
  }
  if (topic === "transport_air") {
    return `${name}은 여행 수요, 유가, 환율 이야기가 같이 붙는 종목이라 단순 차트보다 업황 분위기를 함께 보는 편이 좋습니다.`;
  }
  if (topic === "financial") {
    return `${name}은 금융주 특유의 배당·주주환원·금리 기대가 같이 움직이는지 봐야 맛이 나는 종목입니다.`;
  }
  if (topic === "auto_parts") {
    return `${name}은 완성차 수요와 원재료 가격, 환율 흐름이 같이 엮이는 쪽이라 업종 전체 분위기를 같이 보는 게 좋습니다.`;
  }
  if (topic === "energy") {
    return `${name}은 유가와 정제마진, 배당 기대가 같이 움직일 수 있어서 원자재 흐름까지 함께 확인해야 합니다.`;
  }
  return `${name}은 개별 이슈와 시장 수급이 함께 붙을 때 움직임이 커질 수 있어, 차트와 뉴스 흐름을 같이 보는 편이 좋습니다.`;
}

function normalizeStockDisplayName(name: string) {
  const trimmed = name.trim();
  if (trimmed === "한국타이어앤테크놀로") {
    return "한국타이어앤테크놀로지";
  }
  return trimmed;
}

function normalizeEtfDisplayName(name: string) {
  return name
    .trim()
    .replace(/\(H\s+미국\s*기술주$/i, "(H)")
    .replace(/\s+미국\s*기술주$/i, "")
    .replace(/\s+/g, " ");
}

function withTopicParticle(name: string) {
  return `${name}${hasFinalConsonant(name) ? "은" : "는"}`;
}

function hasFinalConsonant(value: string) {
  const last = Array.from(value.trim()).at(-1);
  if (!last) {
    return false;
  }
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return false;
  }
  return (code - 0xac00) % 28 !== 0;
}

function inferStockTopic(name: string) {
  if (/콜마|화장품|뷰티|달바/i.test(name)) {
    return "consumer_beauty";
  }
  if (/항공|한진/i.test(name)) {
    return "transport_air";
  }
  if (/금융|신한|KB|은행|지주/i.test(name)) {
    return "financial";
  }
  if (/타이어|자동차|테크놀로지/i.test(name)) {
    return "auto_parts";
  }
  if (/Oil|오일|정유|에너지/i.test(name)) {
    return "energy";
  }
  return "general";
}

function buildTopicCommentary(name: string, topic: string) {
  if (topic === "consumer_beauty") {
    return `이런 종목은 실적 기대가 붙으면 생각보다 빠르게 움직이지만, 반대로 기대가 이미 가격에 많이 들어가 있으면 좋은 뉴스에도 쉬어갈 수 있습니다. 그래서 저는 브랜드 수요와 수출 흐름, 원가 부담이 같은 방향으로 좋아지는지를 같이 봅니다.`;
  }
  if (topic === "transport_air") {
    return `항공·운송주는 여객 수요가 좋아 보여도 유가나 환율이 발목을 잡을 수 있습니다. 그래서 저는 같은 날 여행·운송주가 같이 움직이는지, 아니면 ${name}만 따로 움직이는지를 먼저 구분해봅니다.`;
  }
  if (topic === "financial") {
    return `금융주는 한 종목만 보기보다 은행·금융지주가 같이 움직이는지가 중요합니다. 배당, 자사주, 금리 기대가 같은 방향으로 붙으면 꽤 단단하게 갈 수 있지만, 지수 분위기가 꺾이면 생각보다 답답하게 움직일 수도 있습니다.`;
  }
  if (topic === "auto_parts") {
    return `자동차 부품·타이어 쪽은 완성차 판매, 원재료 가격, 환율이 같이 엮입니다. 개별 종목만 튀는지, 업종 친구들이 같이 올라오는지에 따라 해석이 달라질 수 있습니다.`;
  }
  if (topic === "energy") {
    return `에너지·정유 쪽은 국제유가, 정제마진, 환율, 배당 기대가 한꺼번에 영향을 줍니다. 단기 차트가 좋아도 원자재 흐름이 반대로 가면 힘이 빠질 수 있어서 같이 확인해야 합니다.`;
  }
  return `${name}은 개별 이슈와 시장 수급이 같이 붙을 때 움직임이 더 커질 수 있습니다. 같은 업종 종목의 동반 움직임과 장중 거래대금 변화를 같이 보는 편이 좋겠습니다.`;
}

function buildPriceCommentary(pick: DailyBriefRun["stockPicks"][number]) {
  const current = parsePrice(pick.currentPrice);
  const entry = parsePrice(pick.entryPrice);
  const target = parsePrice(pick.targetPrice);
  const stopLoss = parsePrice(pick.stopLoss);
  const entryGap = current && entry ? ((current - entry) / entry) * 100 : null;
  const targetGap = current && target ? ((target - current) / current) * 100 : null;
  const stopGap = current && stopLoss ? ((current - stopLoss) / current) * 100 : null;
  const parts = [
    entryGap === null
      ? "진입가와 현재가의 거리는 원문 화면에서 한 번 더 확인해야 합니다."
      : `현재가는 진입 기준에서 약 ${formatPercent(entryGap)} 떨어져 있습니다.`,
    targetGap === null ? null : `목표 구간까지는 약 ${formatPercent(targetGap)} 정도의 공간이 남아 있습니다.`,
    stopGap === null ? null : `반대로 손절선까지는 약 ${formatPercent(stopGap)} 정도 여유가 있습니다.`
  ].filter(Boolean);

  return `${parts.join(" ")} 이 숫자에서 제가 먼저 보는 건 기대수익보다 자리의 부담입니다. 위로는 어느 정도 열려 있고, 아래로는 어디까지 흔들릴 수 있는지 감이 잡혀야 장중 대응이 편합니다.`;
}

function joinKoreanList(values: string[]) {
  if (values.length === 0) {
    return "상위 종목";
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]}와 ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, ${values.at(-1)}`;
}

function buildNewsCheckCommentary(name: string, topic: string) {
  if (topic === "financial") {
    return `${name} 관련 뉴스는 배당, 자사주, 금리 전망, 실적 컨센서스 변화처럼 금융주 전반에 영향을 주는 항목을 함께 확인하는 것이 좋습니다.`;
  }
  if (topic === "consumer_beauty") {
    return `${name} 관련 뉴스는 실적 전망, 해외 매출, 브랜드 수요, 원가 부담처럼 주가 재평가에 연결될 수 있는 항목을 중심으로 확인하세요.`;
  }
  if (topic === "transport_air") {
    return `${name} 관련 뉴스는 여객 수요, 유가, 환율, 노선 확대, 물류 흐름처럼 업황과 직접 연결되는 항목을 우선 확인하세요.`;
  }
  return `${name} 관련 뉴스는 단순 호재성 제목보다 공시 시점, 거래량 반응, 업종 동반 움직임을 함께 확인하는 것이 중요합니다.`;
}

function formatResearchLink(item: DailyBriefRun["researchItems"][number]) {
  const title = item.title.trim() || `${item.symbolName} 최근 뉴스/공시 확인`;
  const url = item.url.trim() || item.searchUrl.trim();
  const source = formatResearchSource(item.source);
  const sourceName = item.sourceName?.trim();
  const publishedDate = formatResearchPublishedDate(item.publishedAt);
  const meta = [sourceName || source, publishedDate].filter(Boolean).join(" · ");
  const summary = item.shortSummary?.trim() ? ` - ${item.shortSummary.trim()}` : "";
  return `[${escapeMarkdownLinkText(title)}](${url}) (${meta})${summary}`;
}

function buildOfficialDisclosureSection(run: DailyBriefRun, symbolName: string, symbolCode: string) {
  const officialItems = (run.officialDisclosureItems ?? [])
    .filter((item) => item.symbolCode === symbolCode)
    .slice(0, 2);
  const searchLinks = buildOfficialDisclosureLinks(symbolName, symbolCode);

  if (officialItems.length === 0) {
    return searchLinks;
  }

  const actualLines = officialItems.map((item) => `- ${formatOfficialDisclosureLink(item)}`).join("\n");
  return `${actualLines}\n${searchLinks}`;
}

function formatOfficialDisclosureLink(item: NonNullable<DailyBriefRun["officialDisclosureItems"]>[number]) {
  const publishedDate = formatResearchPublishedDate(item.publishedAt);
  const receiptText = item.receiptNo ? ` · 접수번호 ${item.receiptNo}` : "";
  const meta = [item.sourceName, publishedDate].filter(Boolean).join(" · ");
  const summary = item.shortSummary?.trim() ? ` - ${item.shortSummary.trim()}` : "";
  return `[${escapeMarkdownLinkText(item.title)}](${item.url}) (${meta}${receiptText})${summary}`;
}

function buildOfficialDisclosureLinks(symbolName: string, symbolCode: string) {
  const label = escapeMarkdownLinkText(`${symbolName}(${symbolCode})`);
  return [
    `- [DART 전자공시 검색: ${label}](${buildDartDisclosureSearchUrl(symbolName)}) (금융감독원 DART 공식 공시 검색)`,
    `- [KRX KIND 공시검색: ${label}](${buildKrxKindDisclosureSearchUrl(symbolName, symbolCode)}) (한국거래소 KIND 공식 공시 검색)`
  ].join("\n");
}

function buildDartDisclosureSearchUrl(symbolName: string) {
  const params = new URLSearchParams({
    option: "corp",
    textCrpNm: symbolName
  });
  return `https://dart.fss.or.kr/dsab007/main.do?${params.toString()}`;
}

function buildKrxKindDisclosureSearchUrl(symbolName: string, symbolCode: string) {
  const params = new URLSearchParams({
    method: "searchTotalInfoMain",
    searchText: `${symbolName} ${symbolCode}`
  });
  return `https://kind.krx.co.kr/disclosure/searchtotalinfo.do?${params.toString()}`;
}

function formatResearchSource(source: string) {
  if (source === "naver_news_search_link") {
    return "네이버 뉴스 검색";
  }
  if (source === "naver_news_search" || source === "naver_news_result") {
    return "네이버 뉴스";
  }
  return source.replaceAll("_", " ");
}

function formatResearchPublishedDate(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function buildDataTimestampLabel(run: DailyBriefRun) {
  const timestamps = [run.updatedAt, run.createdAt, ...run.captures.map((capture) => capture.createdAt)].filter(Boolean);
  const latest = timestamps.sort().at(-1);
  if (!latest) {
    return `${run.marketDate} 한국장`;
  }
  const date = new Date(latest);
  if (Number.isNaN(date.getTime())) {
    return `${run.marketDate} 한국장`;
  }
  const formatted = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
  return `${formatted} KST`;
}

function parsePrice(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = Number(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function averageNumericScore(values: Array<string | null>) {
  const scores = values.map((value) => (value ? Number(value.replace(/[^\d.-]/g, "")) : NaN)).filter((value) => Number.isFinite(value));
  if (scores.length === 0) {
    return null;
  }
  return (scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/[[\]]/g, "");
}

async function attachCapturesAsAssets(contentItemId: string, captures: DailyBriefCapture[]) {
  const assets: ContentAssetAdmin[] = [];
  let sortOrder = 1;

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
      placementHint: "middle",
      sortOrder,
      isPrimary: false
    });
    assets.push(asset as unknown as ContentAssetAdmin);
    sortOrder += 1;
  }

  return assets;
}

async function createDailyBriefThumbnailAsset(contentItemId: string, run: DailyBriefRun) {
  const relativeDir = path.join("local-data", "uploads", "content-assets", contentItemId);
  const absoluteDir = path.resolve(process.cwd(), relativeDir);
  const fileName = "daily-brief-thumbnail.svg";
  const relativePath = path.join(relativeDir, fileName);
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const svg = buildDailyBriefThumbnailSvg(run);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(absolutePath, svg, "utf8");
  const fileStat = await stat(absolutePath);
  const asset = await createContentAsset({
    contentItemId,
    assetType: "image",
    fileName,
    originalName: fileName,
    mimeType: "image/svg+xml",
    fileSize: fileStat.size,
    storagePath: relativePath,
    thumbnailPath: null,
    caption: `${run.marketDate} 급등포착 오늘의 관심종목`,
    altText: `${run.marketDate} 급등포착 오늘의 관심종목 TOP ${run.stockPickLimit} 썸네일`,
    userNote: "auto_generated_daily_brief_thumbnail / stock themed SEO thumbnail",
    placementHint: "hero",
    sortOrder: 0,
    isPrimary: true
  });

  return asset as unknown as ContentAssetAdmin;
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

function buildDailyBriefThumbnailSvg(run: DailyBriefRun) {
  const dateLabel = run.marketDate.replaceAll("-", ".");
  const topNames = run.stockPicks
    .slice(0, 3)
    .map((pick) => pick.name.trim())
    .filter(Boolean)
    .join(" · ");
  const subtitle = topNames || `TOP ${run.stockPickLimit} 관심종목`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(
    `급등포착 오늘의 관심종목 ${dateLabel}`
  )}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#07111f"/>
      <stop offset="52%" stop-color="#0d2342"/>
      <stop offset="100%" stop-color="#102f5d"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="45%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#020617" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g opacity="0.22">
    <path d="M70 490 C180 410 250 455 350 350 S525 250 660 285 S860 235 1085 120" fill="none" stroke="#7dd3fc" stroke-width="7"/>
    <path d="M70 525 C220 470 315 500 430 420 S590 330 720 360 S900 335 1090 235" fill="none" stroke="#fb923c" stroke-width="4"/>
    ${Array.from({ length: 12 }, (_, index) => {
      const x = 96 + index * 86;
      const height = 72 + ((index * 37) % 92);
      const y = 470 - height;
      const color = index % 3 === 0 ? "#ef4444" : "#22c55e";
      return `<rect x="${x}" y="${y}" width="22" height="${height}" rx="5" fill="${color}" opacity="0.42"/>`;
    }).join("\n    ")}
    ${Array.from({ length: 8 }, (_, index) => `<line x1="80" y1="${110 + index * 52}" x2="1120" y2="${110 + index * 52}" stroke="#dbeafe" stroke-width="1" opacity="0.18"/>`).join("\n    ")}
  </g>
  <rect x="56" y="54" width="1088" height="522" rx="38" fill="#081528" opacity="0.84" filter="url(#shadow)"/>
  <rect x="56" y="54" width="1088" height="522" rx="38" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.42"/>
  <g font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif">
    <text x="96" y="132" fill="#93c5fd" font-size="32" font-weight="800" letter-spacing="2">UPSIGNAL DAILY BRIEF</text>
    <text x="96" y="232" fill="#ffffff" font-size="86" font-weight="900">급등포착</text>
    <text x="96" y="326" fill="#ffffff" font-size="76" font-weight="900">오늘의 관심종목</text>
    <rect x="96" y="368" width="540" height="76" rx="24" fill="url(#accent)"/>
    <text x="124" y="419" fill="#ffffff" font-size="40" font-weight="900">${escapeXml(dateLabel)}</text>
    <text x="96" y="497" fill="#dbeafe" font-size="30" font-weight="700">${escapeXml(subtitle)}</text>
    <text x="96" y="542" fill="#94a3b8" font-size="22" font-weight="600">오늘 장 전 체크리스트 · 판단은 내 기준으로</text>
  </g>
  <g transform="translate(820 126)">
    <circle cx="126" cy="126" r="118" fill="#0f2f5f" stroke="#60a5fa" stroke-width="3"/>
    <path d="M58 154 L102 111 L136 136 L194 72" fill="none" stroke="#f97316" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M168 74 H198 V104" fill="none" stroke="#f97316" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="126" y="297" text-anchor="middle" fill="#bfdbfe" font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif" font-size="28" font-weight="800">TOP ${run.stockPickLimit}</text>
  </g>
</svg>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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

function readJsonObject(value: unknown): Record<string, Prisma.InputJsonValue> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Prisma.InputJsonValue>) : {};
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildSafeOrchestratorSummary(result: ReturnType<typeof runInvestmentWritingOrchestrator>) {
  return {
    version: result.version,
    target: result.target,
    contractVersion: result.evidencePack.version,
    preflight: result.preflight,
    judgmentLedger: result.judgmentLedger,
    outline: result.outline,
    initialReview: result.initialReview,
    repair: result.repair,
    finalReview: result.finalReview,
    promptBundle: { version: result.promptBundle.version, safeMetadata: result.promptBundle.safeMetadata },
    autoPublishEligible: result.autoPublishEligible,
    blockingReasons: result.blockingReasons
  };
}
