import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { buildBlogPostTemplatePreview } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { prisma } from "@/lib/db/client";
import { buildInvestmentSeoTitle, reviewInvestmentSeoTitle } from "@/lib/daily-brief/investment-seo-title";
import { runInvestmentWritingOrchestrator } from "@/lib/daily-brief/investment-writing-orchestrator";
import { fetchFuturesSignals } from "@/lib/daily-brief/futures";
import { getDailyBriefRun } from "@/lib/daily-brief/store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: { runId: string } }) {
  const body = (await request.json().catch(() => ({}))) as { tistoryEtfContentItemId?: unknown };
  const tistoryEtfContentItemId = typeof body.tistoryEtfContentItemId === "string" ? body.tistoryEtfContentItemId.trim() : "";
  const run = await getDailyBriefRun(context.params.runId);
  if (!run) return NextResponse.json({ error: "daily_brief_run_not_found" }, { status: 404 });
  if (!run.contentItemId) return NextResponse.json({ error: "daily_brief_blogger_sample_required" }, { status: 400 });

  const source = await prisma.contentItem.findUnique({
    where: { id: run.contentItemId },
    include: { blog: true, brandProfile: true, assets: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } }
  });
  if (!source?.draftHtml) return NextResponse.json({ error: "daily_brief_blogger_html_required" }, { status: 400 });

  const outputDirName = `all_channel_samples_${run.marketDate}_${run.id.slice(-8)}`;
  const outputDir = path.join(process.cwd(), "public", "generated-previews", outputDirName);
  await mkdir(outputDir, { recursive: true });

  const assets = source.assets as unknown as ContentAssetAdmin[];
  const stockTitle = run.title;
  const stockSeo = reviewInvestmentSeoTitle(stockTitle, { marketDate: run.marketDate, requiredKeywords: ["국내주식", "관심종목"] });
  await writeFile(path.join(outputDir, "blogger-stock.html"), wrapPreview(stockTitle, source.draftHtml, "Blogger · 오늘의 투자 유망 종목 리뷰"), "utf8");

  const etfTitle = buildInvestmentSeoTitle({
    target: "blogger_etf_review",
    marketDate: run.marketDate,
    etfNames: run.etfPicks.map((item) => item.name),
    etfLimit: run.etfPickLimit
  });
  const etfAsset = assets.find((asset) => asset.originalName.includes("etf-signal-board")) ?? null;
  const etfWriting = runInvestmentWritingOrchestrator({
    target: "blogger_etf_review",
    title: etfTitle,
    marketDate: run.marketDate,
    stocks: [],
    etfs: run.etfPicks,
    researchItems: [],
    disclosureItems: [],
    prewriteContextItems: run.prewriteContextItems ?? [],
    heroMedia: mediaPlaceholder(etfAsset, "hero", `${run.marketDate} ETF 시그널보드`),
    stockMediaByCode: new Map(),
    etfMedia: null
  });
  let etfPreviewUrl: string | null = null;
  if (etfWriting.autoPublishEligible) {
    const provisional = {
      ...(source as unknown as ContentItemAdmin),
      title: etfTitle,
      targetKeyword: "오늘의 투자 유망 ETF",
      draftMarkdown: etfWriting.markdown,
      draftHtml: null
    };
    const preview = buildBlogPostTemplatePreview({
      contentItem: provisional,
      assets,
      markdown: etfWriting.markdown,
      source: "manual_draft_candidate",
      theme: "clean_blog"
    });
    await writeFile(path.join(outputDir, "blogger-etf.html"), wrapPreview(etfTitle, preview.html, "Blogger · 오늘의 투자 유망 ETF 리뷰"), "utf8");
    etfPreviewUrl = `/generated-previews/${outputDirName}/blogger-etf.html`;
  }

  const tistoryOutputs = Object.entries(run.tistoryReviewOutputs ?? {});
  const tistoryItems = await prisma.contentItem.findMany({
    where: { id: { in: tistoryOutputs.map(([, item]) => item.contentItemId) } },
    select: { id: true, title: true }
  });
  const tistoryTitleById = new Map(tistoryItems.map((item) => [item.id, item.title]));
  const hasTrackAwareIndexMorning = tistoryOutputs.some(([key]) => key === "futures_options_signal_record:index:morning");
  let tistoryCards = tistoryOutputs
    .filter(([key]) => !(hasTrackAwareIndexMorning && key === "futures_options_signal_record:morning"))
    .map(([key, item]) => ({
    key,
    title: tistoryTitleById.get(item.contentItemId) ?? titleForTistoryOutput(key, run.marketDate, run),
    status: "ready" as const,
    previewUrl: item.previewUrl,
    detail: item.mode
    }));
  if (tistoryEtfContentItemId) {
    const override = await prisma.contentItem.findUnique({ where: { id: tistoryEtfContentItemId }, select: { id: true, title: true } });
    if (override?.title) {
      const overrideTitle = override.title;
      tistoryCards = tistoryCards.map((item) =>
        item.key.startsWith("etf_sector_review")
          ? { ...item, title: overrideTitle, previewUrl: `/generated-previews/tistory_export_${override.id}.html` }
          : item
      );
    }
  }
  const futuresOutputs = tistoryOutputs.filter(([key]) => key.startsWith("futures_options_signal_record"));
  const futuresSources = futuresOutputs.length
    ? await prisma.contentItem.findMany({
        where: { id: { in: futuresOutputs.map(([, output]) => output.contentItemId) } },
        include: { blog: true, brandProfile: true, assets: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } }
      })
    : [];
  const futuresSource = futuresSources[0] ?? null;
  const futuresAssets = futuresSources.flatMap((item) => item.assets) as unknown as ContentAssetAdmin[];
  const bloggerMarketPreviews = new Map<string, string>();
  const marketTargetDefinitions = [
    {
      key: "blogger-korea-intraday",
      target: "blogger_market_intraday_review" as const,
      session: "korea_intraday" as const,
      symbols: ["KOSPI200", "NQ"],
      fileName: "blogger-korea-intraday.html",
      label: "한국장 장중 분석",
      publishBlocker: null
    },
    {
      key: "blogger-korea-close",
      target: "blogger_market_close_review" as const,
      session: "korea_close" as const,
      symbols: ["KOSPI200", "NQ"],
      fileName: "blogger-korea-close.html",
      label: "한국장 마감 분석",
      publishBlocker: null
    },
    {
      key: "blogger-us-intraday",
      target: "blogger_market_us_intraday_review" as const,
      session: "us_intraday" as const,
      symbols: ["ES", "NQ"],
      fileName: "blogger-us-intraday.html",
      label: "미국장 장중 분석",
      publishBlocker: null
    }
  ];
  const bloggerMarketPicks = new Map<string, Awaited<ReturnType<typeof fetchFuturesSignals>>>();
  if (futuresSource) {
    for (const marketTarget of marketTargetDefinitions) {
      const marketFutures = (await fetchFuturesSignals(marketTarget.symbols.length, {
        reportSession: marketTarget.session,
        symbols: marketTarget.symbols
      })).filter((item) => item.dataReady);
      bloggerMarketPicks.set(marketTarget.key, marketFutures);
      if (marketFutures.length !== marketTarget.symbols.length) continue;
      const title = buildInvestmentSeoTitle({
        target: marketTarget.target,
        marketDate: run.marketDate,
        futuresNames: marketFutures.map((item) => item.name),
        marketReportSession: marketTarget.session
      });
      const detailAssets = marketFutures
        .map((pick) => findFuturesAsset(futuresAssets, pick.symbol, pick.timeframe))
        .filter((asset): asset is ContentAssetAdmin => Boolean(asset));
      const heroAsset = detailAssets[0] ?? null;
      const detailMedia = detailAssets
        .slice(1)
        .map((asset) => mediaPlaceholder(asset, "middle", asset.caption ?? asset.altText ?? "선물 매매 시그널 차트"))
        .join("\n\n");
      const writing = runInvestmentWritingOrchestrator({
        target: marketTarget.target,
        title,
        marketDate: run.marketDate,
        futures: marketFutures,
        marketReportSession: marketTarget.session,
        stocks: [],
        etfs: [],
        researchItems: [],
        disclosureItems: [],
        prewriteContextItems: [],
        heroMedia: mediaPlaceholder(heroAsset, "hero", `${run.marketDate} 국내외 선물 시그널`),
        stockMediaByCode: new Map(),
        etfMedia: null,
        futuresMedia: detailMedia || null
      });
      if (!writing.autoPublishEligible) continue;
      const provisional = {
        ...(futuresSource as unknown as ContentItemAdmin),
        title,
        targetKeyword: "선물 매매타점",
        draftMarkdown: writing.markdown,
        draftHtml: null
      };
      const preview = buildBlogPostTemplatePreview({
        contentItem: provisional,
        assets: futuresAssets,
        markdown: writing.markdown,
        source: "manual_draft_candidate",
        theme: "clean_blog",
        qualityProfile: "market_brief"
      });
      await writeFile(path.join(outputDir, marketTarget.fileName), wrapPreview(title, preview.html, `Blogger · ${marketTarget.label}`), "utf8");
      bloggerMarketPreviews.set(marketTarget.key, `/generated-previews/${outputDirName}/${marketTarget.fileName}`);
    }
  }
  const cards = [
    card("blogger-stock", "Blogger", "오늘의 투자 유망 종목 리뷰", stockTitle, stockSeo, `/generated-previews/${outputDirName}/blogger-stock.html`, "ready"),
    card(
      "blogger-etf",
      "Blogger",
      "오늘의 투자 유망 ETF 리뷰",
      etfTitle,
      reviewInvestmentSeoTitle(etfTitle, { marketDate: run.marketDate, requiredKeywords: ["ETF"] }),
      etfPreviewUrl,
      etfPreviewUrl ? "ready" : "blocked",
      etfPreviewUrl ? undefined : etfWriting.blockingReasons.join(", ")
    ),
    ...marketTargetDefinitions.map((target) =>
      marketCard(
        target.key,
        target.label,
        buildInvestmentSeoTitle({
          target: target.target,
          marketDate: run.marketDate,
          futuresNames: (bloggerMarketPicks.get(target.key) ?? []).map((item) => item.name),
          marketReportSession: target.session
        }),
        bloggerMarketPreviews.get(target.key) ?? null,
        target.publishBlocker
      )
    ),
    ...tistoryCards.map((item) =>
      card(item.key, "Tistory", labelForTistoryKey(item.key), item.title, reviewInvestmentSeoTitle(item.title, { marketDate: run.marketDate, requiredKeywords: keywordsForTistoryKey(item.key) }), item.previewUrl, item.status)
    )
  ];

  for (const expected of [
    { track: "macro" as const, session: "morning" as const, label: "금·오일·유로달러 시그널 기록 · 07:00" },
    { track: "index" as const, session: "morning" as const, label: "선물·옵션 시그널 기록 · 08:00" },
    { track: "macro" as const, session: "us_preopen" as const, label: "금·오일·유로달러 시그널 기록 · 21:00" },
    { track: "index" as const, session: "us_preopen" as const, label: "선물·옵션 시그널 기록 · 22:00" }
  ]) {
    const id = `futures_options_signal_record:${expected.track}:${expected.session}`;
    if (cards.some((item) => item.id === id)) continue;
    cards.push(
      blockedMarketCard(
        id,
        "Tistory",
        expected.label,
        buildInvestmentSeoTitle({
          target: "tistory_futures_options_signal_record",
          marketDate: run.marketDate,
          marketReportSession: expected.session,
          futuresEditorialTrack: expected.track
        }),
        "futures_editorial_slot_not_generated"
      )
    );
  }

  const indexHtml = renderIndex(run.marketDate, cards);
  await writeFile(path.join(outputDir, "index.html"), indexHtml, "utf8");
  await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify({ runId: run.id, marketDate: run.marketDate, cards }, null, 2)}\n`, "utf8");

  return NextResponse.json({
    ok: true,
    runId: run.id,
    previewUrl: `/generated-previews/${outputDirName}/index.html`,
    cards,
    sideEffectSummary: { dbRead: true, dbWrite: false, networkRead: bloggerMarketPicks.size > 0, localFileWrite: true, bloggerWrite: false, tistoryWrite: false, publish: false, llmCall: false }
  });
}

function card(id: string, channel: string, label: string, title: string, seoReview: ReturnType<typeof reviewInvestmentSeoTitle>, previewUrl: string | null, status: "ready" | "blocked", blocker?: string) {
  return { id, channel, label, title, seoReview, previewUrl, status, blocker: blocker ?? null };
}

function blockedMarketCard(id: string, channel: string, label: string, title: string, blocker: string) {
  return card(id, channel, label, title, reviewInvestmentSeoTitle(title, { marketDate: title.match(/\d{4}\.\d{2}\.\d{2}/)?.[0]?.replaceAll(".", "-") ?? "", requiredKeywords: ["선물"] }), null, "blocked", blocker);
}

function marketCard(id: string, label: string, title: string, previewUrl: string | null, publishBlocker: string | null = null) {
  return card(
    id,
    "Blogger",
    label,
    title,
    reviewInvestmentSeoTitle(title, {
      marketDate: title.match(/\d{4}\.\d{2}\.\d{2}/)?.[0]?.replaceAll(".", "-") ?? "",
      requiredKeywords: ["선물", "매매타점"]
    }),
    previewUrl,
    previewUrl && !publishBlocker ? "ready" : "blocked",
    publishBlocker ?? (previewUrl ? undefined : "futures_options_signal_source_not_ready")
  );
}

function titleForTistoryOutput(key: string, marketDate: string, run: NonNullable<Awaited<ReturnType<typeof getDailyBriefRun>>>) {
  if (key.startsWith("stock_signal_top3_review")) return buildInvestmentSeoTitle({ target: "tistory_focused_signal_review", marketDate, stockNames: run.stockPicks.slice(3, 6).map((item) => item.name), stockLimit: 3 });
  if (key.startsWith("etf_sector_review")) return buildInvestmentSeoTitle({ target: "tistory_etf_sector_review", marketDate, etfNames: run.etfPicks.slice(3).map((item) => item.name), etfLimit: Math.max(run.etfPicks.slice(3).length, 1) });
  if (key.startsWith("futures_options_signal_record")) {
    const [, track, session] = key.split(":");
    return buildInvestmentSeoTitle({
      target: "tistory_futures_options_signal_record",
      marketDate,
      futuresEditorialTrack: track === "macro" ? "macro" : "index",
      marketReportSession: session === "us_preopen" ? "us_preopen" : "morning"
    });
  }
  return buildInvestmentSeoTitle({ target: "tistory_daily_stock_review", marketDate, stockNames: run.stockPicks.slice(0, 3).map((item) => item.name), stockLimit: 3 });
}

function labelForTistoryKey(key: string) {
  if (key.startsWith("stock_signal_top3_review")) return "종목별 신호 집중분석";
  if (key.startsWith("etf_sector_review")) return "ETF 섹터 흐름 리뷰";
  if (key.startsWith("futures_options_signal_record")) {
    const [, track, session] = key.split(":");
    const time = session === "us_preopen" ? (track === "macro" ? "21:00" : "22:00") : track === "macro" ? "07:00" : "08:00";
    return `${track === "macro" ? "금·오일·유로달러" : "선물·옵션"} 시그널 기록 · ${time}`;
  }
  return "오늘의 관심종목 리뷰";
}

function keywordsForTistoryKey(key: string) {
  if (key.startsWith("stock_signal_top3_review")) return ["매수 신호", "종목"];
  if (key.startsWith("etf_sector_review")) return ["ETF"];
  if (key.startsWith("futures_options_signal_record")) return ["선물", "매매타점"];
  return ["국내주식", "매매 신호"];
}

function mediaPlaceholder(asset: ContentAssetAdmin | null, placement: string, caption: string) {
  return asset ? `<!-- media:${asset.id} placement:${placement} caption:"${caption}" -->` : `> 이미지 준비 중: ${caption}`;
}

function findFuturesAsset(assets: ContentAssetAdmin[], symbol: string, timeframe: string | null) {
  const needle = `tistory-futures-${symbol.toLowerCase()}-`;
  const normalizedTimeframe = timeframe?.toLowerCase() ?? "";
  return (
    assets.find((asset) => {
      const name = asset.originalName.toLowerCase();
      return name.includes(needle) && (!normalizedTimeframe || name.includes(normalizedTimeframe));
    }) ??
    assets.find((asset) => asset.originalName.toLowerCase().includes(needle)) ??
    null
  );
}

function wrapPreview(title: string, html: string, label: string) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#eef3fb;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}main{max-width:960px;margin:auto;background:#fff;padding:42px 54px;box-sizing:border-box}h1,h2,h3{color:#10264a}p,li{font-size:17px;line-height:1.75}img{max-width:100%;height:auto}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{border:1px solid #dbe5f2;padding:9px}.note{padding:12px 14px;background:#f4f8fd;border:1px solid #d7e3f4;margin-bottom:24px}</style></head><body><main><div class="note"><strong>${escapeHtml(label)}</strong><br>로컬 검토용 샘플 · 외부 발행 없음</div>${html}</main></body></html>`;
}

function renderIndex(marketDate: string, cards: ReturnType<typeof card>[]) {
  const groups = ["Blogger", "Tistory"].map((channel) => `<h2>${channel}</h2><div class="grid">${cards.filter((item) => item.channel === channel).map(renderCard).join("")}</div>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${marketDate} 전체 채널 샘플</title><style>body{margin:0;background:#f2f5f8;color:#172033;font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}main{max-width:1120px;margin:auto;padding:42px 24px 80px}h1,h2{color:#10264a}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px}.card{background:#fff;border:1px solid #d9e0e9;padding:20px;border-radius:7px}.tag{display:inline-block;padding:4px 8px;font-size:12px;font-weight:800;background:#dff5e8;color:#17633b}.blocked{background:#e8ebef;color:#4b5563}.title{font-weight:800;line-height:1.5}.meta{font-size:13px;color:#66758a}a{display:inline-block;padding:9px 12px;background:#1262c3;color:#fff;text-decoration:none;font-weight:700}</style></head><body><main><h1>${marketDate.replaceAll("-", ".")} Blogger · Tistory 전체 샘플</h1><p>SEO 제목과 생성 결과를 한곳에서 점검합니다. 외부 발행은 수행하지 않았습니다.</p>${groups}</main></body></html>`;
}

function renderCard(item: ReturnType<typeof card>) {
  const statusLabel = item.status === "ready" ? "검토 가능" : item.previewUrl ? "미리보기 가능 · 발행 보류" : "소스 차단";
  return `<article class="card"><span class="tag ${item.status === "blocked" ? "blocked" : ""}">${statusLabel}</span><h3>${escapeHtml(item.label)}</h3><p class="title">${escapeHtml(item.title)}</p><p class="meta">SEO ${item.seoReview.score} · ${item.seoReview.titleLength}자${item.blocker ? ` · ${escapeHtml(item.blocker)}` : ""}</p>${item.previewUrl ? `<a href="${escapeHtml(item.previewUrl)}">HTML 보기</a>` : ""}</article>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
