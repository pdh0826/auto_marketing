import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { buildBlogPostTemplatePreview } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { prisma } from "@/lib/db/client";
import { createContentAsset } from "@/lib/db/content-assets";
import { createDailyBriefCapture } from "./capture";
import { fetchFuturesSignals } from "./futures";
import { runInvestmentWritingOrchestrator, type InvestmentWritingTarget } from "./investment-writing-orchestrator";
import { buildInvestmentSeoTitle } from "./investment-seo-title";
import { fetchDailyForeignMarketFlow } from "./market-flow";
import type { DailyMarketReportSession } from "./market-report-session";
import type { DailyBriefCapture, DailyBriefRun } from "./types";

export type BloggerEditorialSlotId =
  | "blogger-etf-review"
  | "blogger-korea-intraday"
  | "blogger-korea-close"
  | "blogger-us-intraday";

const marketSlots: Record<Exclude<BloggerEditorialSlotId, "blogger-etf-review">, {
  target: InvestmentWritingTarget;
  session: DailyMarketReportSession;
  symbols: string[];
  label: string;
}> = {
  "blogger-korea-intraday": {
    target: "blogger_market_intraday_review",
    session: "korea_intraday",
    symbols: ["KOSPI200", "NQ"],
    label: "한국장 장중 분석"
  },
  "blogger-korea-close": {
    target: "blogger_market_close_review",
    session: "korea_close",
    symbols: ["KOSPI200", "NQ"],
    label: "한국장 마감 분석"
  },
  "blogger-us-intraday": {
    target: "blogger_market_us_intraday_review",
    session: "us_intraday",
    symbols: ["ES", "NQ"],
    label: "미국장 장중 분석"
  }
};

export async function createBloggerEditorialContentItem(run: DailyBriefRun, slotId: BloggerEditorialSlotId) {
  const source = run.contentItemId
    ? await prisma.contentItem.findUnique({ where: { id: run.contentItemId }, include: { blog: true, brandProfile: true } })
    : null;
  if (!source?.blogId) throw new Error("blogger_editorial_source_content_required");

  const market = slotId === "blogger-etf-review" ? null : marketSlots[slotId];
  const futures = market
    ? (await fetchFuturesSignals(market.symbols.length, { reportSession: market.session, symbols: market.symbols })).filter((item) => item.dataReady)
    : [];
  if (market && futures.length !== market.symbols.length) throw new Error("blogger_market_futures_source_not_ready");
  const marketFlow = market?.session === "korea_intraday" || market?.session === "korea_close"
    ? await fetchDailyForeignMarketFlow(market.session)
    : null;

  const title = slotId === "blogger-etf-review"
    ? buildInvestmentSeoTitle({ target: "blogger_etf_review", marketDate: run.marketDate, etfNames: run.etfPicks.map((item) => item.name), etfLimit: run.etfPickLimit })
    : buildInvestmentSeoTitle({
        target: market!.target,
        marketDate: run.marketDate,
        futuresNames: futures.map((item) => item.name),
        marketReportSession: market!.session,
        marketFlowAvailable: marketFlow?.ready === true
      });
  const captures = slotId === "blogger-etf-review"
    ? run.captures.filter((capture) => capture.kind === "etf_board").slice(0, 1)
    : await createMarketCaptures(run, market!.session, futures.map((item) => ({ symbol: item.symbol, name: item.name, sourceUrl: item.sourceUrl, timeframe: item.timeframe })));
  if (!captures.length) throw new Error("blogger_editorial_capture_required");

  const created = await prisma.contentItem.create({
    data: {
      blogId: source.blogId,
      brandProfileId: source.brandProfileId,
      mode: "seo_keyword",
      status: "planned",
      title,
      targetKeyword: slotId === "blogger-etf-review" ? "오늘의 투자 유망 ETF" : "선물 매매타점 시황",
      sourceMemo: `Publication slot: ${slotId}\nMarket Date: ${run.marketDate}\nDaily Brief Run: ${run.id}`,
      planJson: { kind: "scheduled_blogger_editorial", slotId, runId: run.id, marketDate: run.marketDate },
      draftMarkdown: ""
    },
    include: { blog: true, brandProfile: true, assets: true }
  });

  try {
    const assets = await attachCaptures(created.id, captures);
    const heroMedia = mediaPlaceholder(assets[0] ?? null, "hero", captures[0]?.label ?? title);
    const remainingMedia = assets.slice(1).map((asset) => mediaPlaceholder(asset, "middle", asset.caption ?? "선물 시그널 차트")).join("\n\n");
    const writing = runInvestmentWritingOrchestrator({
      target: slotId === "blogger-etf-review" ? "blogger_etf_review" : market!.target,
      title,
      marketDate: run.marketDate,
      stocks: [],
      etfs: slotId === "blogger-etf-review" ? run.etfPicks : [],
      futures,
      marketFlow,
      marketReportSession: market?.session,
      researchItems: [],
      disclosureItems: [],
      prewriteContextItems: run.prewriteContextItems ?? [],
      heroMedia,
      stockMediaByCode: new Map(),
      etfMedia: slotId === "blogger-etf-review" ? heroMedia : null,
      futuresMedia: market ? remainingMedia : null
    });
    if (!writing.autoPublishEligible) throw new Error(`investment_writing_not_ready:${writing.blockingReasons[0] ?? "unknown"}`);

    const provisional = { ...(created as unknown as ContentItemAdmin), draftMarkdown: writing.markdown, draftHtml: null, assets };
    const preview = buildBlogPostTemplatePreview({
      contentItem: provisional,
      assets,
      markdown: writing.markdown,
      source: "manual_draft_candidate",
      theme: "clean_blog",
      qualityProfile: market ? "market_brief" : "long_form"
    });
    if (!preview.validationSummary.ok) throw new Error(`blogger_editorial_html_not_ready:${preview.validationSummary.errors[0] ?? "unknown"}`);

    const updated = await prisma.contentItem.update({
      where: { id: created.id },
      data: {
        draftMarkdown: writing.markdown,
        draftHtml: preview.html,
        planJson: toJson({
          kind: "scheduled_blogger_editorial",
          slotId,
          runId: run.id,
          marketDate: run.marketDate,
          investmentWriting: {
            autoPublishEligible: writing.autoPublishEligible,
            blockingReasons: writing.blockingReasons,
            finalReview: writing.finalReview,
            naturalVoiceSecondPass: writing.naturalVoiceSecondPass
          }
        })
      },
      include: { blog: true, brandProfile: true, assets: true }
    });
    const quality = buildHtmlQualityPreview(updated as unknown as ContentItemAdmin, updated.assets as unknown as ContentAssetAdmin[]);
    if (!quality.ready) {
      const failedChecks = quality.checks
        .filter((check) => check.status === "fail" && check.severity === "required")
        .map((check) => check.key)
        .slice(0, 8);
      throw new Error(`blogger_editorial_quality_not_ready:${failedChecks.join(",") || quality.grade}`);
    }
    return updated;
  } catch (error) {
    await prisma.contentItem.delete({ where: { id: created.id } }).catch(() => undefined);
    throw error;
  }
}

async function createMarketCaptures(
  run: DailyBriefRun,
  session: DailyMarketReportSession,
  picks: Array<{ symbol: string; name: string; sourceUrl: string; timeframe: string | null }>
) {
  const captures: DailyBriefCapture[] = [];
  for (const pick of picks) {
    captures.push(await createDailyBriefCapture({
      runId: run.id,
      marketDate: run.marketDate,
      kind: "futures_detail",
      label: `${pick.name} ${pick.timeframe ?? "선택 시간봉"} 최근 매매 시그널`,
      sourceUrl: pick.sourceUrl,
      fileName: `${session}-${pick.symbol.toLowerCase()}-signal.png`,
      target: "futures_signal_detail",
      futuresInstrumentName: pick.name,
      futuresTimeframe: pick.timeframe ?? "60분봉"
    }));
    const capture = captures.at(-1);
    if (!capture || capture.mode !== "live_screenshot" || capture.warning) {
      throw new Error(`blogger_futures_capture_not_ready:${pick.symbol}:${capture?.warning ?? capture?.mode ?? "missing"}`);
    }
  }
  return captures;
}

async function attachCaptures(contentItemId: string, captures: DailyBriefCapture[]) {
  const assets: ContentAssetAdmin[] = [];
  for (let index = 0; index < captures.length; index += 1) {
    const capture = captures[index];
    const relativeDir = path.join("local-data", "uploads", "content-assets", contentItemId);
    const fileName = `${index + 1}-${capture.fileName}`;
    const relativePath = path.join(relativeDir, fileName);
    const absolutePath = path.resolve(process.cwd(), relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await copyFile(path.resolve(process.cwd(), capture.storagePath), absolutePath);
    const fileStat = await stat(absolutePath);
    const asset = await createContentAsset({
      contentItemId,
      assetType: "image",
      fileName,
      originalName: capture.fileName,
      mimeType: "image/png",
      fileSize: fileStat.size,
      storagePath: relativePath,
      caption: capture.label,
      altText: capture.label,
      placementHint: index === 0 ? "hero" : "middle",
      sortOrder: index,
      isPrimary: index === 0
    });
    assets.push(asset as unknown as ContentAssetAdmin);
  }
  return assets;
}

function mediaPlaceholder(asset: ContentAssetAdmin | null, placement: string, caption: string) {
  return asset ? `<!-- media:${asset.id} placement:${placement} caption:"${caption}" -->` : `> 이미지 준비 중: ${caption}`;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
