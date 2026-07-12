import { copyFile, mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { buildBlogPostTemplatePreview } from "@/lib/blog-renderer/blog-post-template-renderer";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { prisma } from "@/lib/db/client";
import { createContentAsset } from "@/lib/db/content-assets";
import { exportTistoryHtmlForContentItem } from "@/lib/tistory/html-export";
import { PROJECT300_TISTORY_PROFILE, buildProject300CategoryLinks } from "@/lib/tistory/project300";
import { reviewProject300GeneratedPost, summarizeProject300StyleReview } from "@/lib/tistory/project300-style-review";
import { PROJECT300_STYLE_PROFILE_VERSION } from "@/lib/tistory/project300-style";
import { inferProject300CategoryKind, selectProject300VoiceVariation } from "@/lib/tistory/project300-voice-variation";
import { buildMarketNarrativeContextFromPicks, buildStockChartInterpretation } from "./chart-narrative";
import { createDailyBriefCapture } from "./capture";
import { runInvestmentWritingOrchestrator, type InvestmentWritingTarget } from "./investment-writing-orchestrator";
import { collectDailyBriefPrewriteContext, summarizePrewriteContextForSymbol, summarizePrewriteMarketContext } from "./prewrite-context";
import { collectDailyBriefEtfResearch, collectDailyBriefOfficialDisclosures, collectDailyBriefResearch } from "./research";
import type {
  DailyBriefCapture,
  DailyBriefEtfPick,
  DailyBriefRun,
  DailyBriefStockPick,
  DailyTistorySignalReviewMode,
  DailyTistorySignalReviewSelection
} from "./types";
import { fetchEtfPicks, fetchKrStockPicks } from "./upsignal";

const UPSIGNAL_MARKDOWN_LINK = "[급등포착](https://upsignal.co.kr)";
const RECENT_SIGNAL_WINDOW_DAYS = 7;

export interface DailyTistorySignalReviewResult {
  contentItemId: string;
  title: string;
  markdownLength: number;
  htmlLength: number;
  visibleTextLength: number;
  quality: {
    ready: boolean;
    grade: "pass" | "warn" | "fail";
    scorePreview: number;
  };
  selection: DailyTistorySignalReviewSelection;
  captures: DailyBriefCapture[];
  tistoryExport: {
    exportDir: string;
    localPreviewUrl: string;
    htmlPath: string;
    inlineHtmlPath: string;
    categoryPath: string;
    tagsPath: string;
    uploadChecklistPath: string;
    project300CategoryLabel: string;
    project300Tags: string[];
    assetCount: number;
    copiedAssetCount: number;
  };
  sideEffectSummary: {
    dbWrite: true;
    contentItemCreated: true;
    contentAssetCreated: boolean;
    localFileWrite: true;
    upsignalRead: true;
    newsSearchRead: true;
    tistoryApiWrite: false;
    bloggerApiWrite: false;
    bloggerDraftSave: false;
    bloggerPublish: false;
    scheduledPublish: false;
    tokenRefresh: false;
    llmCall: false;
    llmCallLogCreated: false;
  };
  links: {
    contentDetail: string;
    editWizard: string;
    tistoryPreview: string;
  };
}

interface CreateDailyTistorySignalReviewOptions {
  forceMode?: string;
}

export async function createDailyTistorySignalReview(run: DailyBriefRun, options: CreateDailyTistorySignalReviewOptions = {}): Promise<DailyTistorySignalReviewResult> {
  const [topTwentyStocks, etfPicks] = await Promise.all([fetchKrStockPicks(20), fetchEtfPicks(Math.max(5, run.etfPickLimit || 5))]);
  const forcedMode = normalizeForcedTistoryReviewMode(options.forceMode);
  const previousSelections = await collectPreviousTistorySelections(run);
  const reservedDailyReviewStockCodes = forcedMode === "stock_signal_top3_review"
    ? topTwentyStocks.slice(0, 3).map((pick) => pick.code)
    : [];
  const selection = selectTistorySignalReviewCandidates(topTwentyStocks, etfPicks, run.marketDate, forcedMode, {
    excludedStockCodes: [...previousSelections.stockCodes, ...reservedDailyReviewStockCodes],
    excludedEtfCodes: previousSelections.etfCodes
  });
  if (run.tistoryReviewOutputs?.[selection.mode] || (!run.tistoryReviewOutputs && run.tistoryReviewContentItemId && run.tistoryReviewMode === selection.mode)) {
    throw new Error("daily_tistory_signal_review_already_generated");
  }
  if (selection.mode === "futures_options_signal_record") {
    throw new Error("futures_options_signal_source_not_ready");
  }
  if (selection.mode === "stock_signal_top3_review" && selection.selectedStockCodes.length === 0) {
    throw new Error("unique_recent_signal_stock_not_found_after_category_exclusions");
  }
  const selectedStocks = topTwentyStocks.filter((pick) => selection.selectedStockCodes.includes(pick.code));
  const selectedEtfs = etfPicks.filter((pick) => selection.selectedEtfCodes.includes(pick.code));
  const captures = await captureTistoryReviewAssets(run, selection.mode, selectedStocks, selectedEtfs);
  const [stockResearch, stockDisclosures, etfResearch, prewriteContextItems] = await Promise.all([
    collectDailyBriefResearch(selectedStocks, 3),
    collectDailyBriefOfficialDisclosures(selectedStocks, run.marketDate, 2),
    collectDailyBriefEtfResearch(selectedEtfs, 2),
    collectDailyBriefPrewriteContext({
      marketDate: run.marketDate,
      stockPicks: selectedStocks,
      etfPicks: selectedEtfs
    })
  ]);
  const title = buildTistoryReviewTitle(run.marketDate, selection.mode, selectedStocks, selectedEtfs);
  const defaults = await loadDefaultBlogAndBrand();
  let createdContentItemId: string | null = null;
  try {
    const selectedStockNames = selectedStocks.map((pick) => normalizeName(pick.name));
    const selectedEtfNames = selectedEtfs.map((pick) => normalizeName(pick.name));
    const project300Category = buildProject300CategoryHint(selection.mode);
    const created = await prisma.contentItem.create({
      data: {
        blogId: defaults.blogId,
        brandProfileId: defaults.brandProfileId,
        mode: "seo_keyword",
        status: "planned",
        title,
        targetKeyword: buildTistoryTargetKeyword(selection.mode, selectedStocks, selectedEtfs),
        sourceMemo: buildTistorySourceMemo(run, selection, project300Category),
        planJson: {
          kind: "daily_tistory_signal_review",
          sourceRunId: run.id,
          marketDate: run.marketDate,
          targetTistoryBlog: PROJECT300_TISTORY_PROFILE.blogUrl,
          recommendedTistoryCategoryPath: project300Category,
          duplicatePolicy: "blogger_daily_brief_summary_vs_project300_signal_review_analysis",
          writingStyleProfile: PROJECT300_STYLE_PROFILE_VERSION,
          seoReviewPolicy: "project300_tistory_style_plus_seo_checklist",
          prewriteContextItemCount: prewriteContextItems.length,
          selection: {
            mode: selection.mode,
            modeReason: selection.modeReason,
            recentSignalWindowDays: selection.recentSignalWindowDays,
            topTwentyCount: selection.topTwentyCount,
            recentSignalStockCount: selection.recentSignalStockCount,
            selectedStockCodes: selection.selectedStockCodes,
            selectedStockNames,
            selectedEtfCodes: selection.selectedEtfCodes,
            selectedEtfNames,
            warnings: selection.warnings
          },
          tistoryExportOnly: true
        },
        draftMarkdown: ""
      },
      include: {
        blog: true,
        brandProfile: true,
        assets: true
      }
    });
    createdContentItemId = created.id;

    const thumbnailAsset = await createTistoryReviewThumbnailAsset(created.id, run.marketDate, selection.mode, selectedStocks, selectedEtfs);
    const captureAssets = await attachTistoryCapturesAsAssets(created.id, captures);
    const assets = [thumbnailAsset, ...captureAssets];
    const assetByOriginalName = new Map(assets.map((asset) => [asset.originalName, asset]));
    const stockMediaByCode = new Map(
      selectedStocks.map((pick) => [pick.code, mediaPlaceholder(findAsset(assetByOriginalName, `tistory-${pick.code}-signal-chart`), "middle", `${normalizeName(pick.name)} 최근 신호 차트`)] as const)
    );
    const investmentWriting = runInvestmentWritingOrchestrator({
      target: mapTistoryModeToInvestmentTarget(selection.mode),
      title,
      marketDate: run.marketDate,
      generatedAt: new Date().toISOString(),
      stocks: selectedStocks,
      etfs: selectedEtfs,
      researchItems: [...stockResearch, ...etfResearch],
      disclosureItems: stockDisclosures,
      prewriteContextItems,
      heroMedia: mediaPlaceholder(findAsset(assetByOriginalName, "tistory-signal-review-thumbnail"), "hero", `${run.marketDate} 티스토리 신호 리뷰 썸네일`),
      stockMediaByCode,
      etfMedia: selectedEtfs.length
        ? mediaPlaceholder(findAsset(assetByOriginalName, "tistory-etf-signal-board"), "middle", "ETF/섹터 신호보드")
        : null
    });
    if (!investmentWriting.autoPublishEligible) {
      throw new Error(`investment_writing_not_ready:${investmentWriting.blockingReasons[0] ?? "unknown"}`);
    }
    const markdown = investmentWriting.markdown;
    const styleReview = reviewProject300GeneratedPost({
      title,
      markdown,
      categoryKind: investmentWriting.categoryKind ?? inferProject300CategoryKind(selection.mode),
      assetImageCount: assets.length,
      subjectNames: selectedStocks.map((pick) => normalizeName(pick.name)),
      judgmentLedger: investmentWriting.judgmentLedger,
      investmentOutline: investmentWriting.outline
    });
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
    if (!htmlPreview.validationSummary.ok) {
      throw new Error(`tistory_signal_review_template_preview_not_ready:${htmlPreview.validationSummary.errors[0] ?? "unknown"}`);
    }

    const updated = await prisma.contentItem.update({
      where: { id: created.id },
      data: {
        draftMarkdown: markdown,
        draftHtml: htmlPreview.html,
        planJson: {
          ...(isRecord(created.planJson) ? created.planJson : {}),
          project300StyleReview: summarizeProject300StyleReview(styleReview),
          investmentWriting: toJsonValue(buildSafeInvestmentWritingSummary(investmentWriting, styleReview.ok)),
          project300FinalReviewer: "gpt_cli",
          project300GptCliRewriteLoop: {
            available: true,
            defaultMode: "preview_only",
            route: `/api/content-items/${created.id}/project300-style-rewrite-preview`,
            featureFlag: "PROJECT300_GPT_CLI_STYLE_REWRITE_ENABLED",
            confirmationPhrase: "PROJECT300 GPT CLI REWRITE"
          }
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
    const tistoryExport = await exportTistoryHtmlForContentItem(updated.id);

    return {
      contentItemId: updated.id,
      title,
      markdownLength: markdown.length,
      htmlLength: htmlPreview.html.length,
      visibleTextLength: htmlPreview.validationSummary.visibleTextLength,
      quality: {
        ready: quality.ready,
        grade: quality.grade,
        scorePreview: quality.scorePreview
      },
      selection,
      captures,
      tistoryExport: {
        exportDir: tistoryExport.exportDir,
        localPreviewUrl: tistoryExport.localPreviewUrl,
        htmlPath: tistoryExport.htmlPath,
        inlineHtmlPath: tistoryExport.inlineHtmlPath,
        categoryPath: tistoryExport.categoryPath,
        tagsPath: tistoryExport.tagsPath,
        uploadChecklistPath: tistoryExport.uploadChecklistPath,
        project300CategoryLabel: tistoryExport.project300.recommendedCategoryLabel,
        project300Tags: tistoryExport.project300.recommendedTags,
        assetCount: tistoryExport.assetCount,
        copiedAssetCount: tistoryExport.copiedAssetCount
      },
      sideEffectSummary: {
        dbWrite: true,
        contentItemCreated: true,
        contentAssetCreated: assets.length > 0,
        localFileWrite: true,
        upsignalRead: true,
        newsSearchRead: true,
        tistoryApiWrite: false,
        bloggerApiWrite: false,
        bloggerDraftSave: false,
        bloggerPublish: false,
        scheduledPublish: false,
        tokenRefresh: false,
        llmCall: false,
        llmCallLogCreated: false
      },
      links: {
        contentDetail: `/content/${updated.id}`,
        editWizard: `/wizard/edit/${updated.id}`,
        tistoryPreview: tistoryExport.localPreviewUrl
      }
    };
  } catch (error) {
    if (createdContentItemId) {
      await prisma.contentItem.delete({ where: { id: createdContentItemId } }).catch(() => undefined);
    }
    throw error;
  }
}

export function selectTistorySignalReviewCandidates(
  topTwentyStocks: DailyBriefStockPick[],
  etfPicks: DailyBriefEtfPick[],
  marketDate: string,
  forcedMode: DailyTistorySignalReviewMode | null = null,
  options: {
    excludedStockCodes?: Iterable<string>;
    excludedEtfCodes?: Iterable<string>;
  } = {}
): DailyTistorySignalReviewSelection {
  const warnings: string[] = [];
  const excludedStockCodes = new Set(options.excludedStockCodes ?? []);
  const excludedEtfCodes = new Set(options.excludedEtfCodes ?? []);
  const availableStocks = topTwentyStocks.filter((pick) => !excludedStockCodes.has(pick.code));
  const availableEtfs = etfPicks.filter((pick) => !excludedEtfCodes.has(pick.code));
  if (excludedStockCodes.size > 0) warnings.push(`excluded_previous_or_reserved_tistory_stock_count:${excludedStockCodes.size}`);
  if (excludedEtfCodes.size > 0) warnings.push(`excluded_previous_tistory_etf_count:${excludedEtfCodes.size}`);
  const recentSignalStocks = availableStocks
    .filter((pick) => isRecentSignalDate(pick.recentSignalDate, marketDate, RECENT_SIGNAL_WINDOW_DAYS))
    .sort(compareStockSignalCandidates);

  if (forcedMode) {
    warnings.push(`forced_tistory_review_mode:${forcedMode}`);
    if (forcedMode === "stock_signal_top3_review") {
      if (recentSignalStocks.length < 3) warnings.push("unique_recent_signal_stock_count_below_three");
      return {
        mode: "stock_signal_top3_review",
        modeReason: "오늘의 관심종목 리뷰에 쓰인 후보를 제외하고, 남은 최근 신호 종목으로 집중 리뷰를 생성합니다.",
        recentSignalWindowDays: RECENT_SIGNAL_WINDOW_DAYS,
        topTwentyCount: topTwentyStocks.length,
        recentSignalStockCount: recentSignalStocks.length,
        selectedStockCodes: recentSignalStocks.slice(0, 3).map((pick) => pick.code),
        selectedEtfCodes: [],
        warnings
      };
    }
    if (forcedMode === "mixed_stock_etf_review") {
      return {
        mode: "mixed_stock_etf_review",
        modeReason: "검증용 forceMode로 관심종목 리뷰와 ETF 보강 리뷰를 생성합니다.",
        recentSignalWindowDays: RECENT_SIGNAL_WINDOW_DAYS,
        topTwentyCount: topTwentyStocks.length,
        recentSignalStockCount: availableStocks.slice(0, 3).length,
        selectedStockCodes: availableStocks.slice(0, 3).map((pick) => pick.code),
        selectedEtfCodes: selectEtfCandidates(availableEtfs, 3).map((pick) => pick.code),
        warnings
      };
    }
    if (forcedMode === "futures_options_signal_record") {
      return {
        mode: "futures_options_signal_record",
        modeReason: "선물·옵션 시그널 카테고리는 공통 작성 프로세스에 등록됐지만 급등포착 실제 신호 source가 준비될 때까지 생성하지 않습니다.",
        recentSignalWindowDays: RECENT_SIGNAL_WINDOW_DAYS,
        topTwentyCount: topTwentyStocks.length,
        recentSignalStockCount: 0,
        selectedStockCodes: [],
        selectedEtfCodes: [],
        warnings: [...warnings, "futures_options_signal_source_not_ready"]
      };
    }
    return {
      mode: "etf_sector_review",
      modeReason: "검증용 forceMode로 ETF/섹터 흐름 리뷰를 생성합니다.",
      recentSignalWindowDays: RECENT_SIGNAL_WINDOW_DAYS,
      topTwentyCount: topTwentyStocks.length,
      recentSignalStockCount: 0,
      selectedStockCodes: [],
      selectedEtfCodes: selectEtfCandidates(availableEtfs, 5).map((pick) => pick.code),
      warnings
    };
  }

  if (recentSignalStocks.length >= 3) {
    return {
      mode: "stock_signal_top3_review",
      modeReason: "TOP 20 안에서 최근 매매 신호 종목이 3개 이상이라 종목 집중 리뷰를 생성합니다.",
      recentSignalWindowDays: RECENT_SIGNAL_WINDOW_DAYS,
      topTwentyCount: topTwentyStocks.length,
      recentSignalStockCount: recentSignalStocks.length,
      selectedStockCodes: recentSignalStocks.slice(0, 3).map((pick) => pick.code),
      selectedEtfCodes: [],
      warnings
    };
  }

  if (recentSignalStocks.length > 0) {
    warnings.push("recent_signal_stock_count_below_three_etf_context_added");
    return {
      mode: "mixed_stock_etf_review",
      modeReason: "최근 매매 신호 종목이 1~2개라 ETF/섹터 흐름을 함께 보강합니다.",
      recentSignalWindowDays: RECENT_SIGNAL_WINDOW_DAYS,
      topTwentyCount: topTwentyStocks.length,
      recentSignalStockCount: recentSignalStocks.length,
      selectedStockCodes: recentSignalStocks.map((pick) => pick.code),
      selectedEtfCodes: selectEtfCandidates(availableEtfs, 3).map((pick) => pick.code),
      warnings
    };
  }

  warnings.push("recent_signal_stock_not_found_etf_sector_review");
  return {
    mode: "etf_sector_review",
    modeReason: "TOP 20 안에서 최근 매매 신호 종목이 부족해 ETF/섹터 흐름 리뷰로 전환합니다.",
    recentSignalWindowDays: RECENT_SIGNAL_WINDOW_DAYS,
    topTwentyCount: topTwentyStocks.length,
    recentSignalStockCount: 0,
    selectedStockCodes: [],
    selectedEtfCodes: selectEtfCandidates(availableEtfs, 5).map((pick) => pick.code),
    warnings
  };
}

async function collectPreviousTistorySelections(run: DailyBriefRun) {
  const stockCodes = new Set<string>();
  const etfCodes = new Set<string>();
  const contentItemIds = new Set<string>();

  for (const output of Object.values(run.tistoryReviewOutputs ?? {})) {
    if (!output) continue;
    output.selectedStockCodes?.forEach((code) => stockCodes.add(code));
    output.selectedEtfCodes?.forEach((code) => etfCodes.add(code));
    if (!output.selectedStockCodes || !output.selectedEtfCodes) contentItemIds.add(output.contentItemId);
  }
  if (run.tistoryReviewContentItemId) contentItemIds.add(run.tistoryReviewContentItemId);

  if (contentItemIds.size > 0) {
    const items = await prisma.contentItem.findMany({
      where: { id: { in: Array.from(contentItemIds) } },
      select: { planJson: true }
    });
    for (const item of items) {
      if (!isRecord(item.planJson) || !isRecord(item.planJson.selection)) continue;
      readStringArray(item.planJson.selection.selectedStockCodes).forEach((code) => stockCodes.add(code));
      readStringArray(item.planJson.selection.selectedEtfCodes).forEach((code) => etfCodes.add(code));
    }
  }

  return { stockCodes: Array.from(stockCodes), etfCodes: Array.from(etfCodes) };
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function normalizeForcedTistoryReviewMode(value: string | undefined): DailyTistorySignalReviewMode | null {
  if (value === "stock_signal_top3_review" || value === "mixed_stock_etf_review" || value === "etf_sector_review" || value === "futures_options_signal_record") {
    return value;
  }
  return null;
}

async function captureTistoryReviewAssets(
  run: DailyBriefRun,
  mode: DailyTistorySignalReviewMode,
  selectedStocks: DailyBriefStockPick[],
  selectedEtfs: DailyBriefEtfPick[]
) {
  const captures: DailyBriefCapture[] = [];
  for (const pick of selectedStocks.slice(0, 3)) {
    const capture = await createDailyBriefCapture({
      runId: run.id,
      marketDate: run.marketDate,
      kind: "stock_chart",
      label: `${pick.name} 최근 신호 확대 차트`,
      sourceUrl: pick.detailUrl,
      fileName: `tistory-${pick.code}-signal-chart.png`,
      target: "stock_signal_chart"
    });
    captures.push(capture);
  }

  if (mode !== "stock_signal_top3_review" || selectedEtfs.length > 0) {
    const capture = await createDailyBriefCapture({
      runId: run.id,
      marketDate: run.marketDate,
      kind: "etf_board",
      label: `${run.marketDate} ETF/섹터 신호보드`,
      sourceUrl: run.etfBoardUrl,
      fileName: "tistory-etf-signal-board.png",
      target: "etf_signal_board"
    });
    captures.push(capture);
  }

  return captures;
}

function buildTistorySignalReviewMarkdown(input: {
  marketDate: string;
  title: string;
  selection: DailyTistorySignalReviewSelection;
  topTwentyStocks: DailyBriefStockPick[];
  selectedStocks: DailyBriefStockPick[];
  selectedEtfs: DailyBriefEtfPick[];
  stockResearch: DailyBriefRun["researchItems"];
  stockDisclosures: DailyBriefRun["officialDisclosureItems"];
  etfResearch: DailyBriefRun["researchItems"];
  prewriteContextItems: DailyBriefRun["prewriteContextItems"];
  assets: ContentAssetAdmin[];
}) {
  const assetByOriginalName = new Map(input.assets.map((asset) => [asset.originalName, asset]));
  const thumbnailAsset = findAsset(assetByOriginalName, "tistory-signal-review-thumbnail");
  const etfAsset = findAsset(assetByOriginalName, "tistory-etf-signal-board");
  const stockAssetByCode = new Map(input.selectedStocks.map((pick) => [pick.code, findAsset(assetByOriginalName, `tistory-${pick.code}-signal-chart`)] as const));
  const variation = selectProject300VoiceVariation({
    categoryKind: inferProject300CategoryKind(input.selection.mode),
    marketDate: input.marketDate,
    seedParts: [...input.selectedStocks.map((pick) => pick.code), ...input.selectedEtfs.map((pick) => pick.code)]
  });

  if (input.selection.mode === "stock_signal_top3_review") {
    return buildStockSignalReviewMarkdown(input, thumbnailAsset, stockAssetByCode, variation);
  }
  if (input.selection.mode === "mixed_stock_etf_review") {
    return buildMixedSignalEtfReviewMarkdown(input, thumbnailAsset, stockAssetByCode, etfAsset, variation);
  }
  return buildEtfSectorReviewMarkdown(input, thumbnailAsset, etfAsset, variation);
}

function buildStockSignalReviewMarkdown(
  input: Parameters<typeof buildTistorySignalReviewMarkdown>[0],
  thumbnailAsset: ContentAssetAdmin | null,
  stockAssetByCode: Map<string, ContentAssetAdmin | null>,
  variation: ReturnType<typeof selectProject300VoiceVariation>
) {
  const names = input.selectedStocks.map((pick) => normalizeName(pick.name));
  return `# ${input.title}

${mediaPlaceholder(thumbnailAsset, "hero", `${input.marketDate} 티스토리 신호 리뷰 썸네일`)}

## ${variation.openingTitle}

오늘 ${UPSIGNAL_MARKDOWN_LINK} 한국장 TOP 20을 다시 열어보니 최근 신호가 나온 종목들이 먼저 보였습니다. 점수 높은 종목을 전부 다 보는 것보다, 실제로 매매 타점이 찍힌 종목부터 보는 게 훨씬 낫습니다.

오늘 제 기준에서 먼저 눈에 들어온 종목은 ${joinKoreanList(names)}입니다. 먼저 차트에서 신호가 어디서 나왔는지 보고, 그다음 최근 기사와 공시가 이 흐름을 설명해주는지 같이 확인해 보겠습니다.

글쓰기 전에 모아둔 시장 맥락은 이렇습니다. ${summarizePrewriteMarketContext(input.prewriteContextItems)}

## ${variation.summaryTitle}

| 종목 | 코드 | 최근 신호 | 현재가 | 진입가 | 목표가 | 손절선 | 점수 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${input.selectedStocks.map((pick) => stockRow(pick)).join("\n")}

${buildProject300CrossCategoryBridge(input.selection.mode, "stock")}

${input.selectedStocks.map((pick) => buildStockReviewBlock(input, pick, stockAssetByCode.get(pick.code) ?? null)).join("\n\n")}

${buildTistoryReviewWrapUp(input.selection.mode)}
`;
}

function buildMixedSignalEtfReviewMarkdown(
  input: Parameters<typeof buildTistorySignalReviewMarkdown>[0],
  thumbnailAsset: ContentAssetAdmin | null,
  stockAssetByCode: Map<string, ContentAssetAdmin | null>,
  etfAsset: ContentAssetAdmin | null,
  variation: ReturnType<typeof selectProject300VoiceVariation>
) {
  const stockNames = input.selectedStocks.map((pick) => normalizeName(pick.name));
  const etfNames = input.selectedEtfs.slice(0, 3).map((pick) => normalizeName(pick.name));
  const stockThemeSummary = buildStockThemeSummary(input.selectedStocks);
  return `# ${input.title}

${mediaPlaceholder(thumbnailAsset, "hero", `${input.marketDate} 티스토리 혼합 신호 리뷰 썸네일`)}

## 오늘의 눈에 들어온 종목

오늘 ${UPSIGNAL_MARKDOWN_LINK} TOP 20 중에서 최근에 신호가 발생한 종목은 ${stockThemeSummary}입니다. 투자 매력도가 높은 상위 랭크에 꾸준히 올라오는 종목들인데요.

오늘은 ${joinKoreanList(stockNames)}를 먼저 보고, 이어서 ETF 쪽 흐름도 같이 확인해 보겠습니다. 특히 금융주가 같이 올라오는 날에는 개별 종목 하나만 보기보다, 시장이 어느 자산군을 편하게 보는지도 같이 보는 게 좋습니다.

글쓰기 전에 모아둔 시장 맥락은 이렇습니다. ${summarizePrewriteMarketContext(input.prewriteContextItems)}

## 오늘 먼저 볼 신호 종목

| 종목 | 코드 | 최근 신호 | 현재가 | 진입가 | 목표가 | 손절선 | 점수 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${input.selectedStocks.map((pick) => stockRow(pick)).join("\n")}

${buildProject300CrossCategoryBridge(input.selection.mode, "stock")}

${input.selectedStocks.map((pick) => buildStockReviewBlock(input, pick, stockAssetByCode.get(pick.code) ?? null)).join("\n\n")}

## ETF 보드로 시장 방향 같이 보기

${mediaPlaceholder(etfAsset, "middle", "ETF/섹터 신호보드")}

${buildEtfIntro(input.selectedEtfs)}

${buildProject300CrossCategoryBridge(input.selection.mode, "etf")}

${buildEtfTable(input.selectedEtfs)}

${input.selectedEtfs.map((pick) => buildEtfReviewBlock(input, pick)).join("\n\n")}

${buildTistoryReviewWrapUp(input.selection.mode)}
`;
}

function buildEtfSectorReviewMarkdown(
  input: Parameters<typeof buildTistorySignalReviewMarkdown>[0],
  thumbnailAsset: ContentAssetAdmin | null,
  etfAsset: ContentAssetAdmin | null,
  variation: ReturnType<typeof selectProject300VoiceVariation>
) {
  const etfNames = input.selectedEtfs.slice(0, 3).map((pick) => normalizeName(pick.name));
  return `# ${input.title}

${mediaPlaceholder(thumbnailAsset, "hero", `${input.marketDate} 티스토리 ETF 섹터 리뷰 썸네일`)}

## ${variation.openingTitle}

오늘 ${UPSIGNAL_MARKDOWN_LINK} 한국장 TOP 20에서는 최근 매매 신호가 강하게 몰린 종목이 많지 않았습니다. 이런 날에는 종목을 억지로 끼워 맞추기보다, ETF 쪽에서 시장이 어느 방향을 보고 있는지 확인하는 편이 낫다고 봅니다.

그래서 오늘은 ETF 시그널보드에서 ${joinKoreanList(etfNames)}를 중심으로 봤습니다. ETF는 개별 기업 하나의 뉴스보다 금리, 환율, 해외 지수, 배당, 섹터 수급이 같이 묻어 있습니다. 그래서 종목 신호가 애매한 날에는 “오늘 시장이 어디를 편하게 보는지”를 읽는 보조 도구로 꽤 쓸 만합니다.

${mediaPlaceholder(etfAsset, "middle", "ETF/섹터 신호보드")}

위 ETF 보드는 오늘 제가 종목 대신 먼저 열어본 화면입니다. 점수만 보고 끝내기보다, 어떤 섹터가 반복해서 위로 올라오는지 보는 게 핵심입니다.

${buildProject300CrossCategoryBridge(input.selection.mode, "etf")}

## ${variation.summaryTitle}

${buildEtfTable(input.selectedEtfs)}

${input.selectedEtfs.map((pick) => buildEtfReviewBlock(input, pick)).join("\n\n")}

${buildTistoryReviewWrapUp(input.selection.mode)}
`;
}

function buildStockReviewBlock(input: Parameters<typeof buildTistorySignalReviewMarkdown>[0], pick: DailyBriefStockPick, asset: ContentAssetAdmin | null) {
  const name = normalizeName(pick.name);
  const research = input.stockResearch.filter((item) => item.symbolCode === pick.code).slice(0, 3);
  const disclosures = input.stockDisclosures.filter((item) => item.symbolCode === pick.code).slice(0, 2);
  return `## ${name}: ${buildStockSignalHeadline(pick)}

${mediaPlaceholder(asset, "middle", `${name} 최근 신호 차트`)}

${buildStockNarrativeIntro({ pick, marketDate: input.marketDate })}

${buildStockChartInterpretation({
  pick,
  marketDate: input.marketDate,
  marketContext: buildMarketNarrativeContextFromPicks(input.selectedStocks, input.selectedEtfs),
  variantSeed: "tistory-signal-review"
})}

이 자료까지 같이 보면:
${summarizePrewriteContextForSymbol(input.prewriteContextItems, pick.code)}

최근 확인할 만한 자료:
${research.length ? research.map((item) => `- ${formatResearchLink(item)}`).join("\n") : "- 자동 뉴스 수집 결과가 충분하지 않습니다. 장중 거래대금과 공식 공시 검색을 더 보수적으로 같이 확인하세요."}
${disclosures.length ? `\n공시 체크:\n${disclosures.map((item) => `- ${formatDisclosureLink(item)}`).join("\n")}` : `\n공시 체크:\n- [DART 전자공시 검색: ${name}](${buildDartDisclosureSearchUrl(name)})\n- [KRX KIND 공시검색: ${name}](${buildKrxKindDisclosureSearchUrl(name, pick.code)})`}

${buildStockReviewClosing(input.marketDate, pick)}`;
}

function buildEtfReviewBlock(input: Parameters<typeof buildTistorySignalReviewMarkdown>[0], pick: DailyBriefEtfPick) {
  const name = normalizeName(pick.name);
  const research = input.etfResearch.filter((item) => item.symbolCode === pick.code).slice(0, 2);
  return `## ${name}: ${buildEtfSignalHeadline(pick)}

${buildEtfNarrativeIntro({ pick, marketDate: input.marketDate })}

관련 흐름 확인:
${research.length ? research.map((item) => `- ${formatResearchLink(item)}`).join("\n") : "- ETF/섹터 뉴스 자동 수집 결과가 충분하지 않습니다. 금리, 환율, 해외 지수 흐름을 함께 확인하세요."}

${buildEtfReviewClosing(input.marketDate, pick)}`;
}

function buildEtfIntro(etfPicks: DailyBriefEtfPick[]) {
  const categories = Array.from(new Set(etfPicks.map((pick) => pick.category ?? inferEtfSector(pick.name)).filter(Boolean))).slice(0, 3);
  return `오늘 ETF 쪽은 ${categories.join(", ") || "주요 자산군"} 흐름을 같이 볼 만합니다. ETF는 한 종목의 실적보다 시장의 큰 방향을 보여줄 때가 많아서, 종목 신호가 부족한 날에는 오히려 더 유용한 힌트가 됩니다.`;
}

function buildEtfTable(etfPicks: DailyBriefEtfPick[]) {
  return `| ETF | 코드 | 카테고리 | 현재가 | 목표여력 | 최근매수 | 수익률 | 점수 |
| --- | --- | --- | --- | --- | --- | --- | --- |
${etfPicks.map((pick) => `| ${normalizeName(pick.name)} | ${pick.code} | ${pick.category ?? inferEtfSector(pick.name)} | ${pick.currentPrice ?? "-"} | ${pick.targetPotential ?? "-"} | ${pick.recentBuyDate ?? "-"} | ${pick.currentReturn ?? "-"} | ${pick.totalScore ?? "-"} |`).join("\n")}`;
}

function buildStockThemeSummary(picks: DailyBriefStockPick[]) {
  const themeCounts = picks.reduce<Record<string, number>>((acc, pick) => {
    const theme = describeStockTheme(normalizeName(pick.name));
    acc[theme] = (acc[theme] ?? 0) + 1;
    return acc;
  }, {});
  const themeText = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([theme, count]) => `${theme} ${count}개`)
    .join(", ");
  const names = picks.map((pick) => normalizeName(pick.name));
  return `${themeText || `${picks.length}개 종목`}입니다. ${joinKoreanList(names)}`;
}

function buildStockSignalHeadline(pick: DailyBriefStockPick) {
  const name = normalizeName(pick.name);
  const theme = describeStockTheme(name);
  const entry = pick.entryPrice ? `${pick.entryPrice}원대 진입 기준` : "진입 기준 확인";
  if (theme === "금융주") {
    return `${entry}, 금융주 강세 흐름 확인`;
  }
  if (theme === "화장품·소비재") {
    return `${entry}, 소비재 모멘텀 체크`;
  }
  if (theme === "항공·여행") {
    return `${entry}, 여행·운송 수급 확인`;
  }
  if (theme === "자동차·부품") {
    return `${entry}, 업종 동반 흐름 확인`;
  }
  if (theme === "반도체·테크") {
    return `${entry}, 기술주 수급 확인`;
  }
  return `${entry}, 최근 신호 자리 확인`;
}

function buildEtfSignalHeadline(pick: DailyBriefEtfPick) {
  const sector = pick.category ?? inferEtfSector(pick.name);
  if (/미국|해외|S&P|나스닥/i.test(sector) || /미국|S&P|나스닥/i.test(pick.name)) {
    return "미국장 흐름을 같이 보는 ETF";
  }
  if (/배당|인컴/i.test(sector) || /배당|인컴/i.test(pick.name)) {
    return "배당·인컴 쪽 온기 확인";
  }
  if (/채권|금리|현금/i.test(sector) || /채권|금리|현금/i.test(pick.name)) {
    return "금리 흐름을 먼저 보는 ETF";
  }
  return `${sector} 흐름 체크`;
}

const STOCK_REVIEW_CLOSING_PATTERNS: Array<
  (context: {
    name: string;
    subjectName: string;
    objectName: string;
    theme: string;
    entryPrice: string;
    targetPrice: string;
    stopLossObject: string;
  }) => string
> = [
  (context) => `저라면 ${context.subjectName} 장 초반부터 바로 결론 내리기보다, ${context.entryPrice} 근처에서 거래가 붙는지 먼저 보겠습니다. 금융주처럼 같은 업종이 같이 움직이는 날에는 한 종목만 튀는지, 업종 전체가 같이 가는지도 꽤 중요합니다.`,
  (context) => `${context.subjectName} 목표가 ${context.targetPrice}보다 ${context.stopLossObject} 먼저 적어두고 보는 편이 낫겠습니다. 목표만 보면 글이 달콤해지는데, 실제 매매는 틀렸을 때 멈추는 기준이 더 중요합니다.`,
  (context) => `이 종목은 오늘 하루만 보고 끝낼 종목이라기보다, 내일도 같은 자리에서 버티는지 이어서 볼 만합니다. 특히 ${context.theme} 쪽 흐름이 계속 살아 있으면 다시 한 번 차트를 열어볼 이유가 생깁니다.`,
  (context) => `저는 이런 차트에서는 거래대금이 붙는지부터 봅니다. ${context.subjectName} ${context.entryPrice} 근처에서 버티면서 거래가 늘면 조금 더 재미있게 볼 수 있고, 거래가 식으면 그냥 신호만 찍힌 하루로 끝날 수도 있습니다.`,
  (context) => `${context.subjectName} 지금 당장 좋다/나쁘다로 자르기보다, 차트가 기준선 위에서 버티는지 보는 쪽이 맞겠습니다. 급하게 따라붙기보다 한 번 더 눌리는 구간이 오는지도 같이 보겠습니다.`,
  (context) => `개인적으로는 ${context.objectName} 오늘 관심 목록에만 올려두고, 장중 움직임을 확인하는 쪽이 편합니다. ${context.stopLossObject} 아래로 흐름이 무너지면 생각보다 빠르게 정리 기준을 세워야 합니다.`,
  (context) => `${context.subjectName} 뉴스가 같이 붙어주면 더 보기 편한 종목입니다. 차트만 좋고 재료가 약하면 힘이 오래 못 갈 수 있어서, 오늘 나온 기사 흐름을 같이 확인하는 게 좋겠습니다.`,
  (context) => `오늘 ${context.name}에서 중요한 건 목표가까지 몇 퍼센트 남았느냐보다, 신호가 나온 뒤 가격이 무너지지 않고 버티느냐입니다. 이 부분이 유지되면 다음 장에서도 다시 볼 만합니다.`,
  (context) => `저는 ${context.objectName} 볼 때 비중을 크게 잡기보다, 먼저 차트와 뉴스가 같은 방향인지 확인하겠습니다. 방향이 맞으면 기회가 생기고, 어긋나면 괜히 서두를 필요가 없습니다.`,
  (context) => `${context.subjectName} 오늘 메모장에 남겨둘 종목입니다. 좋은 흐름이 이어지면 다시 자세히 볼 수 있고, 기준선 아래로 밀리면 굳이 붙잡고 있을 필요는 없어 보입니다.`
];

function buildStockReviewClosing(marketDate: string, pick: DailyBriefStockPick) {
  const name = normalizeName(pick.name);
  const context = {
    name,
    subjectName: withSubjectParticle(name),
    objectName: withObjectParticle(name),
    theme: describeStockTheme(name),
    entryPrice: pick.entryPrice ?? "진입 기준",
    targetPrice: pick.targetPrice ?? "목표가",
    stopLossObject: pick.stopLoss ? `손절선 ${pick.stopLoss}원을` : "손절선을"
  };
  return STOCK_REVIEW_CLOSING_PATTERNS[stableIndex([marketDate, pick.code, "stock-closing"].join(":"), STOCK_REVIEW_CLOSING_PATTERNS.length)](context);
}

const ETF_REVIEW_CLOSING_PATTERNS: Array<(context: { name: string; sector: string; recentBuyDate: string }) => string> = [
  (context) => `${context.name}은 종목을 고르기 전 시장 방향을 확인하는 용도로 보겠습니다. ${context.sector} 쪽이 계속 위에 있으면 관련 종목들도 같이 찾아볼 만합니다.`,
  (context) => `ETF는 한 번에 크게 튀는 맛은 덜하지만, 방향을 보기에는 좋습니다. ${context.name}은 ${context.recentBuyDate} 이후 흐름이 이어지는지 내일도 다시 볼 생각입니다.`,
  (context) => `${context.name}은 단독 결론보다 보조 지표에 가깝습니다. 이 ETF가 버티면 관련 섹터 종목을 조금 더 편하게 볼 수 있습니다.`,
  (context) => `오늘 ${context.name}을 본 이유는 시장이 ${context.sector} 쪽을 아직 버리지 않았는지 확인하기 위해서입니다. 하루짜리 반등인지 며칠 이어지는 흐름인지가 중요합니다.`,
  (context) => `저라면 ${context.name}은 포트폴리오 중복부터 확인하겠습니다. 이미 비슷한 ETF나 종목을 많이 들고 있다면 신호가 좋아도 조심해야 합니다.`
];

function buildEtfReviewClosing(marketDate: string, pick: DailyBriefEtfPick) {
  const name = normalizeName(pick.name);
  const context = {
    name,
    sector: pick.category ?? inferEtfSector(name),
    recentBuyDate: pick.recentBuyDate ?? "최근매수 기준"
  };
  return ETF_REVIEW_CLOSING_PATTERNS[stableIndex([marketDate, pick.code, "etf-closing"].join(":"), ETF_REVIEW_CLOSING_PATTERNS.length)](context);
}

function buildProject300CrossCategoryBridge(mode: DailyTistorySignalReviewMode, placement: "stock" | "etf") {
  const links = buildProject300CategoryLinks();
  const intro = buildCrossCategoryIntro(mode, placement);
  const bullets =
    placement === "stock"
      ? [
          `[${links.focusedSignalReview.label}](${links.focusedSignalReview.url})에서는 최근 매매 신호가 나온 종목을 더 깊게 봅니다.`,
          `[${links.dailyStockReview.label}](${links.dailyStockReview.url})에서는 매일 올라오는 국내주식 관심종목 흐름을 넓게 봅니다.`,
          `[${links.etfSectorReview.label}](${links.etfSectorReview.url})에서는 종목 신호가 애매한 날에 섹터와 ETF 쪽 방향을 확인합니다.`,
          `[${links.futuresOptionsSignalRecord.label}](${links.futuresOptionsSignalRecord.url})에서는 나스닥 선물, S&P500 선물, 코스피 선물 같은 큰 흐름과 매매 타점을 같이 기록합니다.`
        ]
      : [
          `[${links.etfSectorReview.label}](${links.etfSectorReview.url})에서는 미국 ETF, 배당 ETF, 채권·금리형 ETF처럼 시장 방향을 먼저 확인합니다.`,
          `[${links.futuresOptionsSignalRecord.label}](${links.futuresOptionsSignalRecord.url})에서는 나스닥 선물이나 코스피 선물 신호와 ETF 흐름을 같이 연결합니다.`,
          `[${links.dailyStockReview.label}](${links.dailyStockReview.url})에서는 ETF 흐름을 본 뒤 다시 국내주식 관심종목을 넓게 확인합니다.`,
          `[${links.focusedSignalReview.label}](${links.focusedSignalReview.url})에서는 ETF 흐름과 맞물리는 개별 종목 신호를 더 깊게 봅니다.`
        ];

  return `## 같이 보면 좋은 급등포착 기록

${intro} 예를 들어 나스닥 선물 쪽에서 매수 타점이 포착되는 날에는 미국 ETF가 더 매력적으로 보일 수 있고, 코스피 선물 흐름이 좋아지는 날에는 국내 대형주와 금융주 흐름을 같이 보는 식입니다. 이런 식으로 카테고리를 나눠두면 하루 글 하나로 끝나는 게 아니라, 시장 흐름을 이어서 확인하기가 훨씬 편합니다.

${bullets.map((line) => `- ${line}`).join("\n")}`;
}

function buildCrossCategoryIntro(mode: DailyTistorySignalReviewMode, placement: "stock" | "etf") {
  if (placement === "etf") {
    return mode === "etf_sector_review"
      ? "ETF를 볼 때는 선물 쪽 큰 흐름과 국내 관심종목을 같이 엮어두면 다음 글을 이어가기 좋습니다."
      : "ETF까지 같이 보는 구간에서는 선물·옵션 기록과 연결해두면 미국장 방향을 해석하기가 조금 더 편합니다.";
  }
  if (mode === "stock_signal_top3_review") {
    return "종목 하나만 깊게 보는 것도 좋지만, 시장 방향과 ETF 흐름을 같이 붙여보면 판단이 덜 외로워집니다.";
  }
  if (mode === "etf_sector_review") {
    return "ETF를 먼저 보더라도 나중에는 그 흐름이 어떤 국내 종목으로 이어지는지 같이 확인해야 합니다.";
  }
  return "오늘처럼 종목과 ETF를 같이 보는 날에는 다른 카테고리 기록도 같이 연결해서 보면 좋습니다.";
}

function buildTistoryReviewWrapUp(mode: DailyTistorySignalReviewMode) {
  const modeLine =
    mode === "stock_signal_top3_review"
      ? "오늘 글은 최근 신호 종목 3개를 깊게 보는 방식으로 정리했습니다."
      : mode === "mixed_stock_etf_review"
        ? "오늘 글은 신호 종목과 ETF 흐름을 같이 보는 방식으로 정리했습니다."
        : "오늘 글은 종목보다 ETF/섹터 흐름을 먼저 보는 방식으로 정리했습니다.";

  return `## 신호가 좋아 보여도 먼저 보는 기준

저는 신호가 찍힌 종목을 볼 때 점수 하나로 결론을 내리지는 않습니다. 먼저 진입 기준과 현재가의 거리를 보고, 그다음 손절선까지의 폭을 봅니다. 여기서 이미 부담이 크면 아무리 좋아 보이는 종목도 하루 정도는 더 지켜보는 쪽이 마음이 편합니다.

## 뉴스와 공시는 이렇게 연결해서 봅니다

뉴스 제목이 좋아 보여도 주가가 이미 반영했을 수 있고, 공시가 나와도 시장이 바로 반응하지 않을 때가 있습니다. 그래서 오늘 글에 넣은 뉴스와 공시 링크는 결론이 아니라 확인 순서에 가깝습니다. 차트가 먼저 움직였고, 그 움직임을 설명해줄 재료가 있는지 보는 용도입니다.

## 장중에는 무엇을 다시 확인할까

장이 열리면 오전에 본 리스트가 그대로 유지되는지부터 봅니다. 관심도가 줄고 거래가 식으면 신호의 힘도 약해질 수 있습니다. 반대로 진입 기준 근처에서 거래가 붙고, 관련 뉴스가 계속 이어지면 그때는 다시 한 번 차트를 열어볼 이유가 생깁니다. 결국 신호는 시작점이고, 장중 흐름이 확인 과정입니다.

## 내일 다시 볼 포인트

오늘 신호가 나온 종목이 내일도 같은 위치에서 버티는지, 아니면 하루짜리 관심으로 끝나는지가 중요합니다. ETF 리뷰인 경우에는 해당 섹터가 하루 반등인지, 며칠 이어지는 흐름인지 보는 게 핵심입니다. 하루 결과보다 흐름의 지속성을 확인하는 쪽이 더 실전적입니다.

## 자주 묻는 질문

### 오늘 나온 종목을 바로 따라가도 될까요?

저는 바로 따라가기보다 진입 기준과 현재가의 거리를 먼저 봅니다. 이미 많이 벌어진 상태라면 좋은 신호라도 부담이 커질 수 있습니다.

### ETF 리뷰는 왜 같이 보나요?

개별 종목 신호가 부족한 날에는 ETF가 시장의 방향을 더 잘 보여줄 때가 있습니다. 특히 금리, 환율, 해외 지수, 배당 흐름은 ETF 쪽에서 먼저 확인하기 좋습니다.

### 뉴스가 좋으면 신호를 더 믿어도 되나요?

뉴스는 도움이 되지만, 뉴스만으로 판단하면 늦을 수 있습니다. 차트 위치, 거래량, 공시 성격, 시장 분위기를 같이 확인하는 편이 낫습니다.

### 이 글은 어떤 방식으로 활용하면 좋나요?

관심종목을 좁히는 체크리스트로 활용하는 것이 가장 적절합니다. 저는 이런 글을 매수 버튼 대신 “오늘 차트를 열어볼 순서표”에 가깝게 봅니다.

## 오늘 리뷰를 마무리하며

${modeLine} 저는 이런 신호를 볼 때 “지금 당장 사야 한다”보다 “오늘 차트를 열어볼 순서를 정한다”에 가깝게 봅니다. 좋은 신호도 가격이 이미 멀리 가 있으면 부담스럽고, 평범해 보이는 신호도 뉴스와 수급이 같이 붙으면 꽤 괜찮은 흐름으로 이어질 수 있습니다.

혹시 손실이 잦다면 혼자 감으로 거래하기보다, 급등포착에서 진입가·목표가·손절선과 매매 타점을 같이 확인해 보시는 것도 좋겠습니다. 신호를 그대로 따라가라는 뜻이 아니라, 최소한 내가 들어가는 자리와 멈춰야 할 자리를 화면에서 먼저 확인해보자는 의미입니다.

마지막 판단은 늘 본인 기준이 필요합니다. ${UPSIGNAL_MARKDOWN_LINK} 시그널은 좋은 출발점이지만, 실제 매매 전에는 진입가, 손절선, 거래량, 공시, 뉴스의 성격을 함께 확인해야 합니다. 오늘 글은 제 방식으로 차트와 재료를 정리한 개인 블로그 리뷰이며, 특정 종목이나 ETF의 매수·매도를 지시하는 글은 아닙니다.`;
}

async function attachTistoryCapturesAsAssets(contentItemId: string, captures: DailyBriefCapture[]) {
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
      userNote: `tistory_signal_review / ${capture.kind} / ${capture.mode}${capture.warning ? ` / ${capture.warning}` : ""}`,
      placementHint: "middle",
      sortOrder,
      isPrimary: false
    });
    assets.push(asset as unknown as ContentAssetAdmin);
    sortOrder += 1;
  }

  return assets;
}

async function createTistoryReviewThumbnailAsset(
  contentItemId: string,
  marketDate: string,
  mode: DailyTistorySignalReviewMode,
  selectedStocks: DailyBriefStockPick[],
  selectedEtfs: DailyBriefEtfPick[]
) {
  const relativeDir = path.join("local-data", "uploads", "content-assets", contentItemId);
  const absoluteDir = path.resolve(process.cwd(), relativeDir);
  const fileName = "tistory-signal-review-thumbnail.svg";
  const relativePath = path.join(relativeDir, fileName);
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const svg = buildTistoryReviewThumbnailSvg(marketDate, mode, selectedStocks, selectedEtfs);

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
    caption: `${marketDate} 급등포착 티스토리 신호 리뷰`,
    altText: `${marketDate} 급등포착 티스토리 신호 리뷰 썸네일`,
    userNote: "auto_generated_tistory_signal_review_thumbnail",
    placementHint: "hero",
    sortOrder: 0,
    isPrimary: true
  });

  return asset as unknown as ContentAssetAdmin;
}

function buildTistoryReviewThumbnailSvg(marketDate: string, mode: DailyTistorySignalReviewMode, selectedStocks: DailyBriefStockPick[], selectedEtfs: DailyBriefEtfPick[]) {
  const dateLabel = marketDate.replaceAll("-", ".");
  const title = mode === "etf_sector_review" ? "오늘 ETF 흐름 리뷰" : "오늘 신호 종목 TOP 3";
  const subtitle = (mode === "etf_sector_review" ? selectedEtfs : selectedStocks)
    .slice(0, 3)
    .map((pick) => normalizeName(pick.name))
    .join(" · ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(`${title} ${dateLabel}`)}">
  <rect width="1200" height="630" fill="#07111f"/>
  <path d="M80 470 C220 360 320 420 440 310 S650 210 790 260 S940 260 1110 130" fill="none" stroke="#38bdf8" stroke-width="9" opacity="0.7"/>
  <path d="M80 520 C250 470 345 495 500 400 S680 340 790 370 S950 340 1110 250" fill="none" stroke="#f97316" stroke-width="6" opacity="0.75"/>
  <rect x="64" y="58" width="1072" height="514" rx="40" fill="#0b1930" stroke="#2b65ca" stroke-width="3" opacity="0.94"/>
  <g font-family="Pretendard, Apple SD Gothic Neo, Noto Sans KR, Arial, sans-serif">
    <text x="104" y="134" fill="#93c5fd" font-size="32" font-weight="800">TISTORY SIGNAL REVIEW</text>
    <text x="104" y="246" fill="#ffffff" font-size="76" font-weight="900">${escapeXml(title)}</text>
    <text x="104" y="336" fill="#ffffff" font-size="54" font-weight="900">${escapeXml(dateLabel)}</text>
    <text x="104" y="430" fill="#dbeafe" font-size="32" font-weight="800">${escapeXml(subtitle || "급등포착 시그널 리뷰")}</text>
    <text x="104" y="506" fill="#94a3b8" font-size="24" font-weight="700">차트 · 뉴스 · 공시까지 같이 보는 리뷰</text>
  </g>
  <g transform="translate(880 155)">
    <circle cx="112" cy="112" r="104" fill="#12376b" stroke="#60a5fa" stroke-width="3"/>
    <path d="M52 130 L94 92 L126 118 L176 62" fill="none" stroke="#f97316" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M152 64 H180 V92" fill="none" stroke="#f97316" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

function buildTistoryReviewTitle(marketDate: string, mode: DailyTistorySignalReviewMode, selectedStocks: DailyBriefStockPick[], selectedEtfs: DailyBriefEtfPick[]) {
  const dateLabel = marketDate.replaceAll("-", ".");
  if (mode === "stock_signal_top3_review") {
    return `오늘 매매 신호 나온 국내주식 TOP 3: ${selectedStocks.slice(0, 3).map((pick) => normalizeName(pick.name)).join("·")} 집중 분석 | ${dateLabel} 급등포착`;
  }
  if (mode === "mixed_stock_etf_review") {
    const stockText = selectedStocks.map((pick) => normalizeName(pick.name)).join("·") || "신호 종목";
    return `오늘 신호 종목과 함께 볼 ETF 흐름: ${stockText} + 섹터 리뷰 | ${dateLabel} 급등포착`;
  }
  if (mode === "futures_options_signal_record") {
    return `오늘 국내외 선물·옵션 시그널 기록 | ${dateLabel} 급등포착`;
  }
  return `오늘은 종목보다 ETF 흐름이 더 중요합니다: 유망 섹터 ETF TOP ${selectedEtfs.length} | ${dateLabel} 급등포착`;
}

function buildTistoryTargetKeyword(mode: DailyTistorySignalReviewMode, selectedStocks: DailyBriefStockPick[], selectedEtfs: DailyBriefEtfPick[]) {
  if (mode === "futures_options_signal_record") {
    return "코스피 나스닥 S&P500 선물 옵션 시그널";
  }
  if (mode === "etf_sector_review") {
    return `ETF 섹터 리뷰 ${selectedEtfs.slice(0, 2).map((pick) => normalizeName(pick.name)).join(" ")}`.slice(0, 80);
  }
  return `매매 신호 종목 분석 ${selectedStocks.slice(0, 2).map((pick) => normalizeName(pick.name)).join(" ")}`.slice(0, 80);
}

function buildTistorySourceMemo(run: DailyBriefRun, selection: DailyTistorySignalReviewSelection, project300Category: readonly string[]) {
  return [
    `Daily Brief Run: ${run.id}`,
    `Tistory Signal Review: ${selection.mode}`,
    `Target Tistory Blog: ${PROJECT300_TISTORY_PROFILE.blogUrl}`,
    `Recommended Category: ${project300Category.join(" > ")}`,
    `Writing Style Profile: ${PROJECT300_STYLE_PROFILE_VERSION}`,
    `Market Date: ${run.marketDate}`,
    `Recent signal window: ${selection.recentSignalWindowDays} days`,
    "정책: Blogger와 중복 본문 생성 금지, 티스토리 HTML export only, 자동 발행 없음"
  ].join("\n");
}

function buildProject300CategoryHint(mode: DailyTistorySignalReviewMode) {
  if (mode === "futures_options_signal_record") {
    return [...PROJECT300_TISTORY_PROFILE.categories.futuresOptionsSignalRecord];
  }
  if (mode === "etf_sector_review") {
    return [...PROJECT300_TISTORY_PROFILE.categories.etfSectorReview];
  }
  if (mode === "mixed_stock_etf_review") {
    return [...PROJECT300_TISTORY_PROFILE.categories.dailyStockReview];
  }
  return [...PROJECT300_TISTORY_PROFILE.categories.focusedSignalReview];
}

function mapTistoryModeToInvestmentTarget(mode: DailyTistorySignalReviewMode): InvestmentWritingTarget {
  if (mode === "stock_signal_top3_review") return "tistory_focused_signal_review";
  if (mode === "etf_sector_review") return "tistory_etf_sector_review";
  if (mode === "futures_options_signal_record") return "tistory_futures_options_signal_record";
  return "tistory_daily_stock_review";
}

function buildSafeInvestmentWritingSummary(result: ReturnType<typeof runInvestmentWritingOrchestrator>, styleReviewOk: boolean) {
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
    autoPublishEligible: result.autoPublishEligible && styleReviewOk,
    blockingReasons: result.blockingReasons
  };
}

function selectEtfCandidates(etfPicks: DailyBriefEtfPick[], limit: number) {
  return [...etfPicks].sort(compareEtfCandidates).slice(0, limit);
}

function compareStockSignalCandidates(a: DailyBriefStockPick, b: DailyBriefStockPick) {
  const signal = (b.recentSignalDate ?? "").localeCompare(a.recentSignalDate ?? "");
  if (signal !== 0) {
    return signal;
  }
  return parseScore(b.totalScore) - parseScore(a.totalScore);
}

function compareEtfCandidates(a: DailyBriefEtfPick, b: DailyBriefEtfPick) {
  const recent = (b.recentBuyDate ?? "").localeCompare(a.recentBuyDate ?? "");
  if (recent !== 0) {
    return recent;
  }
  return parseScore(b.totalScore) - parseScore(a.totalScore);
}

function isRecentSignalDate(value: string | null, marketDate: string, windowDays: number) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !/^\d{4}-\d{2}-\d{2}$/.test(marketDate)) {
    return false;
  }
  const signalTime = new Date(`${value}T00:00:00Z`).getTime();
  const marketTime = new Date(`${marketDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(signalTime) || !Number.isFinite(marketTime)) {
    return false;
  }
  const diffDays = Math.floor((marketTime - signalTime) / 86_400_000);
  return diffDays >= 0 && diffDays <= windowDays;
}

function stockRow(pick: DailyBriefStockPick) {
  return `| ${normalizeName(pick.name)} | ${pick.code} | ${pick.recentSignalDate ?? "-"} | ${pick.currentPrice ?? "-"} | ${pick.entryPrice ?? "-"} | ${pick.targetPrice ?? "-"} | ${pick.stopLoss ?? "-"} | ${pick.totalScore ?? "-"} |`;
}

type StockNarrativeContext = {
  name: string;
  subjectName: string;
  objectName: string;
  theme: string;
  detailLink: string;
  recentSignalDate: string;
  currentPrice: string;
  entryPrice: string;
  targetPrice: string;
  stopLoss: string;
  stopLossObject: string;
  pricePosition: string;
};

type EtfNarrativeContext = {
  name: string;
  sector: string;
  currentPrice: string;
  targetPotential: string;
  recentBuyDate: string;
  currentReturn: string;
  totalScore: string;
};

const STOCK_NARRATIVE_PATTERNS: Array<(context: StockNarrativeContext) => string> = [
  (context) => `요즘 ${context.theme} 쪽 종목들이 ${UPSIGNAL_MARKDOWN_LINK} 상위 후보에 자주 보입니다. 흐름이 완전히 식었다기보다는, 시장이 계속 한 번씩 다시 들여다보는 분위기라고 해야 할까요. 그중에서 오늘은 [${context.name} 신호 차트](${context.detailLink})부터 보겠습니다.

차트를 보면 최근 신호일은 ${context.recentSignalDate}로 잡혀 있습니다. 현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. ${context.pricePosition} 저는 이런 경우에 목표가부터 보기보다는, “신호가 나온 뒤에도 아직 다시 볼 만한 자리인가?”를 먼저 봅니다.

뭔소리냐구요? 그냥 차트를 조금 더 단순하게 보면 됩니다. 진입 기준 근처에서 가격이 너무 멀리 도망가지 않고 버티면 다시 볼 이유가 생기고, 반대로 이미 많이 올라가 버렸다면 좋은 종목이어도 저는 손이 잘 안 나갑니다.

목표가는 ${context.targetPrice}, 손절선은 ${context.stopLoss}로 표시됩니다. 목표가만 보면 달콤해 보이지만, 손절선은 “내 생각이 틀렸을 때 어디서 멈출지”를 미리 적어두는 선입니다. 이 선이 너무 부담스럽다면 아무리 좋아 보여도 비중을 크게 가져가기 어렵습니다.

자. 그럼 이제 최근 기사와 공시도 같이 볼까요? 차트가 먼저 움직였는데 뒤에서 설명할 재료가 붙어주는지, 아니면 이미 뉴스가 다 반영된 자리인지 확인해야 합니다.`,
  (context) => `${context.name}은 오늘 ${UPSIGNAL_MARKDOWN_LINK} 화면에서 그냥 지나치기 어렵습니다. 특히 ${context.theme} 흐름이 최근에 한 번씩 살아나는 느낌이라, 저는 이런 종목은 일단 차트를 따로 열어봅니다. [원문 신호 차트](${context.detailLink}) 기준으로 보겠습니다.

최근 신호는 ${context.recentSignalDate}, 현재가는 ${context.currentPrice}, 진입가는 ${context.entryPrice}입니다. ${context.pricePosition} 여기서 중요한 건 “지금 당장 좋다”가 아니라, 신호가 나온 뒤에도 가격이 아직 감당 가능한 위치에 있느냐입니다.

제 기준에서는 이평선 위에서 버티는 종목은 조금 더 기대를 걸어볼 수 있습니다. 물론 기대와 매수는 다릅니다. 차트가 예뻐 보여도 손절 기준이 너무 멀면 실제 매매에서는 심리적으로 버티기 어렵습니다.

그래서 손절선 ${context.stopLoss}와 목표가 ${context.targetPrice}를 같이 봅니다. 목표가만 보면 기분은 좋은데, 손절선을 같이 봐야 이 종목을 어느 정도 크기로 볼지 감이 잡힙니다.

그럼 이제 차트가 왜 움직였는지 확인해 보겠습니다. 기사나 공시가 뒷받침해주면 좋고, 재료가 약하면 장중 수급을 더 보수적으로 봐야 합니다.`,
  (context) => `오늘 ${context.name}은 조금 재미있게 봤습니다. ${UPSIGNAL_MARKDOWN_LINK}에서 신호가 찍혔다고 해서 그대로 따라가는 건 아니지만, ${context.theme} 쪽 분위기가 나쁘지 않으면 이런 종목은 한 번쯤 다시 보게 됩니다.

[${context.name} 차트](${context.detailLink})에서 최근 신호는 ${context.recentSignalDate}입니다. 현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}. ${context.pricePosition} 너무 멀리 가버린 종목이면 저는 일단 보내주는 편인데, 아직 기준선 근처에서 버티면 이야기가 달라집니다.

간단하게 말하면 이렇습니다. 진입가 근처에서 버티는 종목은 “아직 시장이 완전히 버린 건 아니다”라고 볼 수 있고, 손절선 ${context.stopLoss}를 이탈하면 “내 생각이 틀렸구나”라고 정리할 수 있습니다.

목표가 ${context.targetPrice}는 참고만 합니다. 목표가를 먼저 보면 글이 너무 희망적으로 흐르기 쉽습니다. 저는 목표보다 먼저 손절선과 현재 위치를 봅니다.

자. 그럼 이제 이 움직임을 설명할 만한 뉴스나 공시가 있는지 보겠습니다. 차트만 좋고 재료가 비어 있으면 장중에 힘이 빠지는 경우도 많습니다.`,
  (context) => `${context.theme} 종목을 볼 때는 분위기가 이어지는지가 중요합니다. 오늘 ${context.name}도 그 관점에서 봤습니다. ${UPSIGNAL_MARKDOWN_LINK}의 [상세 차트](${context.detailLink})를 열어보면 최근 신호가 ${context.recentSignalDate}로 표시됩니다.

현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. ${context.pricePosition} 이 정도 위치라면 저는 먼저 “추격인지, 아직 기다릴 수 있는 자리인지”를 나눠 봅니다.

이런.... 신호만 보고 들어갔다가 가격이 이미 멀리 가 있으면 생각보다 손실이 빨리 커질 수 있습니다. 그래서 저는 항상 손절선 ${context.stopLoss}를 같이 봅니다. 손절선이 마음에 안 들면 좋은 종목이어도 제 매매에는 안 맞을 수 있습니다.

목표가 ${context.targetPrice}는 위쪽 공간을 보는 기준입니다. 다만 위쪽 공간보다 중요한 건 아래쪽 리스크입니다. 이 균형이 맞아야 차트를 계속 볼 이유가 생깁니다.

이제 남은 건 재료 확인입니다. 최근 기사와 공시가 이 흐름을 설명해주는지 같이 보겠습니다.`,
  (context) => `저는 오늘 ${context.name}을 보면서 “이 종목은 왜 다시 올라왔을까?”를 먼저 생각했습니다. ${UPSIGNAL_MARKDOWN_LINK}에서 신호가 찍힌 종목 중에서도 ${context.theme} 흐름이 같이 붙으면 그냥 넘기기 어렵습니다.

[신호 차트](${context.detailLink}) 기준으로 최근 신호일은 ${context.recentSignalDate}입니다. 현재가 ${context.currentPrice}, 진입가 ${context.entryPrice}. ${context.pricePosition} 숫자가 복잡해 보여도 핵심은 하나입니다. 내가 늦게 따라가는 자리인지, 아직 기준을 세워볼 수 있는 자리인지입니다.

저는 이런 종목을 볼 때 목표가 ${context.targetPrice}보다 손절선 ${context.stopLoss}를 먼저 봅니다. 수익은 시장이 줘야 나는 거고, 손실은 제가 정리할 수 있어야 합니다.

ㅎㅎ 시뮬레이션이나 신호만 믿고 들어가면 꼭 애매한 자리에서 흔들립니다. 그래서 차트를 보고 나면 바로 뉴스와 공시를 같이 확인합니다.

자. 그럼 ${context.name}에 최근 어떤 재료가 붙어 있는지 이어서 보겠습니다.`,
  (context) => `${context.name}은 오늘 차트만 놓고 보면 한 번 더 열어볼 만했습니다. ${UPSIGNAL_MARKDOWN_LINK}의 [종목 화면](${context.detailLink})에서도 최근 신호가 ${context.recentSignalDate}로 잡혀 있습니다.

현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. ${context.pricePosition} 만약 이 가격이 진입 기준에서 너무 멀어졌다면 저는 굳이 서두르지 않습니다. 좋은 종목이라도 내가 들어갈 자리가 아니면 매매가 꼬입니다.

반대로 기준선 근처에서 버티고 있다면 이야기가 달라집니다. 이평선 위에서 버티는지, 거래가 붙는지, 손절선 ${context.stopLoss}가 현실적인지 보게 됩니다.

목표가 ${context.targetPrice}는 참고할 수 있지만, 저는 목표가보다 “손절선을 지킬 수 있는가”를 더 중요하게 봅니다. 그래야 차트가 흔들릴 때도 기준이 생깁니다.

그럼 최근 기사와 공시를 보겠습니다. 차트의 움직임이 숫자만의 착시인지, 실제 재료가 따라오는지 확인해야 합니다.`,
  (context) => `오늘은 ${context.name}을 조금 차분하게 보겠습니다. ${context.theme} 쪽은 한 번 흐름이 붙으면 며칠씩 관심이 이어지는 경우가 있어서, ${UPSIGNAL_MARKDOWN_LINK} 상위권에 반복해서 보이는지 확인하는 편입니다.

[${context.name} 신호 화면](${context.detailLink}) 기준으로 최근 신호는 ${context.recentSignalDate}, 현재가는 ${context.currentPrice}, 진입가는 ${context.entryPrice}입니다. ${context.pricePosition} 저는 이 구간에서 “지금 따라붙어도 되는가?”보다 “기다리면 더 좋은 자리가 오는가?”를 먼저 생각합니다.

손절선은 ${context.stopLoss}입니다. 이 숫자는 겁주는 숫자가 아니라 제 판단이 틀렸을 때 멈추는 기준입니다. 손절선이 멀면 수익이 나기 전까지 마음이 먼저 흔들립니다.

목표가 ${context.targetPrice}까지의 공간은 분명 매력적으로 보일 수 있습니다. 다만 그 공간은 시장이 허락해야 갈 수 있습니다. 그래서 저는 재료와 수급을 같이 확인합니다.

이제 최근 기사와 공시를 보면서, 이 차트가 단순 반등인지 아니면 이유 있는 움직임인지 체크해 보겠습니다.`,
  (context) => `${context.name}은 숫자만 보면 딱딱하지만, 차트를 놓고 보면 이야기가 조금 보입니다. ${UPSIGNAL_MARKDOWN_LINK}에서 최근 신호가 ${context.recentSignalDate}에 찍혔고, [상세 화면](${context.detailLink})에서는 진입가와 손절선이 같이 표시됩니다.

현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}. ${context.pricePosition} 이 차이를 보는 이유는 간단합니다. 너무 늦게 쫓아가면 맞는 종목을 골라도 매매가 틀릴 수 있기 때문입니다.

자. 그럼 저는 여기서 두 가지를 봅니다. 하나는 기준선 위에서 가격이 버티는지, 다른 하나는 손절선 ${context.stopLoss}가 제 기준에서 감당 가능한지입니다.

목표가 ${context.targetPrice}는 방향을 보는 데는 좋지만, 목표가만 보고 판단하면 글이 너무 달콤해집니다. 실제 매매에서는 틀렸을 때 빠져나올 기준이 먼저입니다.

그래서 다음 순서는 뉴스와 공시입니다. 차트가 먼저 움직였고, 그 움직임을 설명할 재료가 있는지 살펴보겠습니다.`,
  (context) => `개인적으로 ${context.name}은 오늘 “바로 결론 내릴 종목”이라기보다 “계속 열어볼 종목”에 가깝습니다. ${UPSIGNAL_MARKDOWN_LINK}의 [신호 차트](${context.detailLink})에서 최근 신호가 ${context.recentSignalDate}로 잡힌 만큼, 한 번 더 볼 이유는 있습니다.

현재가는 ${context.currentPrice}, 진입가는 ${context.entryPrice}입니다. ${context.pricePosition} 이 정도 차이가 벌어졌을 때 저는 매수 버튼보다 메모장을 먼저 엽니다. 어디서 들어가면 편한지, 어디서 틀렸다고 인정할지부터 적어둡니다.

손절선 ${context.stopLoss}는 그래서 중요합니다. 목표가 ${context.targetPrice}보다 덜 멋있어 보이지만, 실제로는 손절선이 있어야 매매가 계획이 됩니다.

차트가 기준선 위에서 버티고, 관련 뉴스가 같이 붙어주면 조금 더 기대를 걸어볼 수 있습니다. 반대로 뉴스가 약하고 거래가 식으면 그냥 하루짜리 신호로 끝날 수도 있습니다.

그럼 최근 기사와 공시를 확인해 보겠습니다.`,
  (context) => `${context.name}은 오늘 리스트에서 “왜 여기 올라왔지?” 하고 한 번 멈추게 만든 종목입니다. ${UPSIGNAL_MARKDOWN_LINK} 화면에서 신호가 보이면 저는 바로 결론을 내리기보다, [종목 차트](${context.detailLink})를 열고 가격 위치부터 봅니다.

최근 신호는 ${context.recentSignalDate}, 현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. ${context.pricePosition} 가격이 기준선 근처에서 버텨주면 기대를 조금 해볼 수 있고, 이미 멀리 가버리면 다음 눌림을 기다리는 편이 낫습니다.

목표가는 ${context.targetPrice}, 손절선은 ${context.stopLoss}입니다. 위만 보면 좋아 보이고, 아래만 보면 겁이 납니다. 둘을 같이 봐야 이 종목이 내 기준에 맞는지 판단할 수 있습니다.

보완이 필요해 보이는 부분도 있습니다. 신호가 좋더라도 뉴스가 빈약하거나 공시가 애매하면 장중에 힘이 빠질 수 있습니다.

그래서 이제 최근 기사와 공시를 보겠습니다. 차트에서 보이는 기대감이 실제 재료와 이어지는지 확인하는 단계입니다.`
];

const STOCK_CONVERSATIONAL_PATTERNS: Array<(context: StockNarrativeContext) => string> = [
  (context) => `요즘 ${context.theme}가 자주 상위 후보에 올라오네요. 최근에 흐름이 좋은 것 같습니다. 먼저 [${context.name} 차트](${context.detailLink})부터 볼까요?

최근 신호일은 ${context.recentSignalDate}입니다. 현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}, 손절선은 ${context.stopLoss}입니다. 저는 이런 숫자를 볼 때 목표가 ${context.targetPrice}보다 먼저 “신호가 나온 뒤 가격이 아직 살아 있나?”를 봅니다.

일단 차트가 기준선 위에서 버티고 있다면 조금 기대해볼 수 있습니다. 그러면 이제 최근 기사나 공시도 살펴보겠습니다.`,
  (context) => `${context.subjectName} 오늘 그냥 지나치기 어렵습니다. ${context.theme} 쪽 흐름이 같이 살아 있으면 이런 종목은 한 번 더 열어보게 됩니다.

[급등포착 차트](${context.detailLink}) 기준 최근 신호는 ${context.recentSignalDate}입니다. 현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}. 숫자는 복잡해 보여도 결국 기준은 단순합니다. 기준선 위에서 버티느냐, ${context.stopLossObject} 깨느냐입니다.

자. 그럼 차트만 보고 끝내지 말고 뉴스와 공시를 같이 보겠습니다.`,
  (context) => `오늘 ${context.subjectName} 차트 위치가 먼저 눈에 들어왔습니다. ${context.theme}가 시장에서 다시 관심을 받는 구간이라면, 이런 신호는 조금 더 의미가 있을 수 있습니다.

최근 신호일은 ${context.recentSignalDate}, 현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. 목표가 ${context.targetPrice}까지의 숫자보다 중요한 건 ${context.stopLossObject} 기준으로 내가 감당할 수 있는 자리인지입니다.

이제 이 움직임을 설명할 재료가 있는지 보겠습니다.`,
  (context) => `${context.subjectName} 이름만 보면 익숙하지만, 오늘은 신호가 찍힌 자리가 중요합니다. [원문 차트](${context.detailLink})를 보면 최근 신호가 ${context.recentSignalDate}에 나왔습니다.

현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}, 목표가 ${context.targetPrice}, 손절선은 ${context.stopLoss}입니다. 저는 여기서 “얼마까지 간다”보다 “틀렸을 때 어디서 멈춘다”를 먼저 정합니다.

그 다음 봐야 할 건 뉴스입니다. 차트가 먼저 움직였고, 그 움직임을 설명할 재료가 붙어주는지 확인해 보겠습니다.`,
  (context) => `${context.theme} 쪽은 한 종목만 튀는지, 업종 전체가 같이 움직이는지를 같이 봐야 합니다. 오늘 ${context.objectName} 그 관점에서 보겠습니다.

최근 신호는 ${context.recentSignalDate}, 현재가는 ${context.currentPrice}입니다. 진입 기준 ${context.entryPrice} 근처에서 가격이 버티면 관심을 이어갈 만하고, ${context.stopLossObject} 깨는 흐름이면 굳이 붙잡을 필요가 없습니다.

이제 최근 기사와 공시에서 같은 방향의 재료가 있는지 보겠습니다.`,
  (context) => `저는 오늘 ${context.objectName} 보면서 “이 종목이 왜 다시 올라왔을까?”를 먼저 생각했습니다. ${UPSIGNAL_MARKDOWN_LINK}에서 신호가 찍힌 종목이라도 이유 없이 쫓아가면 매매가 꼬입니다.

차트 기준 최근 신호는 ${context.recentSignalDate}, 현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}입니다. 목표가는 ${context.targetPrice}, 손절선은 ${context.stopLoss}입니다.

일단 숫자는 이 정도로 보고, 이제 기사와 공시를 보면서 흐름을 확인해 보겠습니다.`,
  (context) => `${context.subjectName} 오늘 메모장에 남겨둘 종목입니다. ${context.theme} 흐름이 이어지면 다시 볼 이유가 있고, 아니면 하루짜리 신호로 끝날 수도 있습니다.

[신호 차트](${context.detailLink})에서는 최근 신호일이 ${context.recentSignalDate}로 잡혀 있습니다. 현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}. ${context.stopLossObject} 기준으로 리스크가 감당되는지가 먼저입니다.

그럼 이제 뉴스와 공시가 차트를 뒷받침해주는지 확인해 보겠습니다.`,
  (context) => `오늘 ${context.subjectName} “좋다/나쁘다”로 바로 자를 종목은 아니고, 차트와 재료를 같이 볼 종목입니다. ${context.theme} 쪽 분위기가 같이 붙어주면 더 보기 편해집니다.

최근 신호일 ${context.recentSignalDate}, 현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}. 목표가 ${context.targetPrice}보다 ${context.stopLossObject} 먼저 보겠습니다.

자. 그럼 이제 최근 나온 기사와 공시를 같이 확인해 보겠습니다.`,
  (context) => `${context.subjectName} 오늘 리스트에서 한 번 멈추게 만든 종목입니다. 신호가 나왔다는 사실보다, 신호가 나온 뒤 가격이 버티고 있는지가 중요합니다.

현재가는 ${context.currentPrice}, 진입 기준은 ${context.entryPrice}, 최근 신호일은 ${context.recentSignalDate}입니다. ${context.stopLossObject} 기준으로 계획을 세우고, 목표가 ${context.targetPrice}는 그 다음에 보겠습니다.

이제 이 흐름을 설명할 만한 뉴스가 있는지 보겠습니다.`,
  (context) => `오늘은 ${context.name}을 조금 편하게 풀어보겠습니다. ${context.theme} 쪽 흐름이 살아 있으면 이런 종목은 생각보다 오래 관심을 받기도 합니다.

[${context.name} 신호 화면](${context.detailLink}) 기준 최근 신호는 ${context.recentSignalDate}입니다. 현재가 ${context.currentPrice}, 진입 기준 ${context.entryPrice}, 손절선은 ${context.stopLoss}입니다. 숫자는 이 정도만 체크하고 넘어가겠습니다.

다음은 뉴스와 공시입니다. 결국 차트와 재료가 같이 맞아야 다음 날에도 다시 볼 이유가 생깁니다.`
];

function buildStockNarrativeIntro(input: { pick: DailyBriefStockPick; marketDate: string }) {
  const pick = input.pick;
  const name = normalizeName(pick.name);
  const context: StockNarrativeContext = {
    name,
    subjectName: withSubjectParticle(name),
    objectName: withObjectParticle(name),
    theme: describeStockTheme(name),
    detailLink: pick.detailUrl || "https://upsignal.co.kr/kr",
    recentSignalDate: pick.recentSignalDate ?? "원문 화면 확인 필요",
    currentPrice: pick.currentPrice ?? "-",
    entryPrice: pick.entryPrice ?? "-",
    targetPrice: pick.targetPrice ?? "-",
    stopLoss: pick.stopLoss ? `${pick.stopLoss}원` : "-",
    stopLossObject: pick.stopLoss ? `손절선 ${pick.stopLoss}원을` : "손절선을",
    pricePosition: describePricePosition(pick)
  };
  const patterns = STOCK_CONVERSATIONAL_PATTERNS.length > 0 ? STOCK_CONVERSATIONAL_PATTERNS : STOCK_NARRATIVE_PATTERNS;
  const pattern = patterns[stableIndex([input.marketDate, pick.code, name].join(":"), patterns.length)];
  return pattern(context);
}

const ETF_NARRATIVE_PATTERNS: Array<(context: EtfNarrativeContext) => string> = [
  (context) => `오늘은 개별 종목보다 ETF 쪽이 더 편하게 보일 수도 있겠습니다. 종목들은 뉴스 하나에 흔들릴 수 있는데, ETF는 시장이 어느 방향을 보는지 확인하기가 조금 더 쉽습니다. ${context.name}은 그중에서도 ${context.sector} 흐름을 볼 때 먼저 눈에 들어왔습니다.

현재가는 ${context.currentPrice}, 목표여력은 ${context.targetPotential}, 최근매수 기준은 ${context.recentBuyDate}로 표시됩니다. 숫자만 보면 재미가 없죠. 저는 여기서 “이 ETF가 왜 지금 위쪽에 올라왔을까?”를 먼저 생각합니다.

만약 미국 지수, 금리, 환율, 배당 같은 큰 흐름이 같이 맞아준다면 ETF 신호는 꽤 쓸 만한 힌트가 됩니다. 반대로 하루 반등에 그친다면 점수가 좋아도 금방 식을 수 있습니다.

그래서 ${context.name}은 단독 결론보다 시장 방향 확인용으로 보는 게 맞겠습니다. 종목을 억지로 고르기 애매한 날에는 이런 ETF가 오히려 마음 편한 체크 대상이 됩니다.`,
  (context) => `${context.name}은 오늘 ETF 보드에서 그냥 지나치기 어렵습니다. ${context.sector} 쪽 흐름이 같이 붙어 있는지 보려면 이런 ETF를 먼저 열어보는 게 좋습니다.

현재가 ${context.currentPrice}, 목표여력 ${context.targetPotential}, 최근매수 ${context.recentBuyDate}. 저는 이 숫자를 “좋다/나쁘다”로 바로 보지는 않습니다. 대신 이 ETF가 담고 있는 자산군이 지금 시장에서 왜 선택받고 있는지를 봅니다.

예를 들어 금리가 흔들리면 채권형 ETF가 움직이고, 미국 지수가 강하면 S&P500이나 나스닥 계열이 먼저 올라옵니다. 배당·인컴 쪽은 시장이 불안할 때도 상대적으로 관심을 받습니다.

자. 그럼 ${context.name}은 지금 그런 흐름에 올라탄 건지, 아니면 단기 반등에 가까운 건지 관련 기사 흐름까지 같이 보겠습니다.`,
  (context) => `개별 종목이 애매한 날에는 ETF가 힌트를 줍니다. 오늘 ${context.name}도 그런 관점에서 봤습니다. ${context.sector} 쪽이 상위권에 올라왔다는 건 시장이 그 방향을 완전히 버리지는 않았다는 뜻으로 볼 수 있습니다.

현재가는 ${context.currentPrice}, 최근매수 기준은 ${context.recentBuyDate}, 현재수익률은 ${context.currentReturn}로 표시됩니다. 물론 ETF도 늘 안전한 건 아닙니다. 다만 개별 종목보다 변동이 덜한 경우가 많아서 시장 큰 그림을 볼 때 유용합니다.

뭔소리냐구요? 쉽게 말하면 오늘 종목을 바로 고르기 어렵다면 “돈이 어느 섹터로 흐르는지”를 ETF로 먼저 보는 겁니다.

${context.name}은 그 흐름을 확인하기 좋은 후보입니다. 이제 관련 뉴스에서 금리, 환율, 해외 지수, 섹터 이슈가 같이 나오는지 확인해 보겠습니다.`,
  (context) => `${context.name}은 오늘 시장 방향을 볼 때 체크할 만합니다. 점수는 ${context.totalScore}, 현재가는 ${context.currentPrice}입니다. 점수 하나로 결론 내리기보다는, 이 ETF가 왜 상위권에 있는지 보는 게 더 중요합니다.

ETF는 개별 기업 실적보다 큰 흐름을 봅니다. ${context.sector} 쪽에 돈이 들어오는지, 최근매수 기준 ${context.recentBuyDate} 이후 흐름이 이어지는지, 목표여력 ${context.targetPotential}이 아직 남아 있는지 정도를 같이 봅니다.

저는 이런 ETF를 볼 때 “종목을 대체할 매매 대상”이라기보다 “오늘 시장이 편하게 보는 방향”으로 해석합니다. 그 방향이 맞으면 종목 고를 때도 도움이 됩니다.

그럼 관련 흐름을 보겠습니다. 특히 해외 지수와 금리, 환율 쪽 뉴스가 같이 붙어 있는지 확인하는 게 좋겠습니다.`,
  (context) => `오늘 ETF 쪽에서 ${context.name}이 눈에 들어온 이유는 단순히 점수가 높아서가 아닙니다. ${context.sector} 성격의 ETF가 위로 올라오면, 시장이 개별 종목보다 큰 방향을 먼저 보고 있다는 신호일 수 있습니다.

현재가는 ${context.currentPrice}, 목표여력은 ${context.targetPotential}입니다. 목표여력이 좋아 보여도 ETF는 천천히 움직일 수 있습니다. 대신 방향이 맞으면 흔들림이 상대적으로 덜할 수 있습니다.

최근매수 기준은 ${context.recentBuyDate}입니다. 저는 이 날짜 이후 흐름이 이어지는지, 아니면 하루짜리 반등인지 먼저 봅니다.

이런.... ETF도 결국 시장 분위기가 꺾이면 같이 흔들립니다. 그래서 관련 뉴스에서 금리, 환율, 해외 지수, 섹터 이슈를 같이 확인해야 합니다.`,
  (context) => `${context.name}은 조금 넓게 봐야 하는 ETF입니다. 종목처럼 “이 회사 실적이 좋아서”로 끝나는 게 아니라, ${context.sector} 전체 분위기를 같이 봐야 합니다.

현재가는 ${context.currentPrice}, 최근매수는 ${context.recentBuyDate}, 현재수익률은 ${context.currentReturn}입니다. 이 숫자만 보고 들어가기보다는, 시장이 이 섹터를 계속 사주는지 확인하는 게 먼저입니다.

저는 종목 신호가 부족한 날에는 ETF를 먼저 봅니다. 억지로 종목을 고르는 것보다, 시장이 어느 쪽을 보고 있는지 확인하는 게 더 실전적일 때가 많습니다.

자. 그럼 ${context.name} 관련해서 최근 어떤 기사 흐름이 있는지 보겠습니다. 이 ETF가 올라온 이유가 뉴스와 맞물리는지 체크하는 단계입니다.`,
  (context) => `${context.name}은 오늘 “방향 확인용”으로 괜찮아 보입니다. ${context.sector} ETF가 상위권에 올라오면, 개별 종목보다 시장의 큰 그림을 먼저 봐야 합니다.

현재가 ${context.currentPrice}, 목표여력 ${context.targetPotential}, 점수 ${context.totalScore}. 숫자는 정리용이고, 실제로는 이 ETF가 담고 있는 섹터가 지금 시장에서 힘을 받고 있는지가 중요합니다.

간단하게 말하면 이렇습니다. 종목은 한 기업의 이슈로 흔들리고, ETF는 섹터나 자산군 흐름을 보여줍니다. 그래서 오늘처럼 종목 신호가 애매하면 ETF가 좋은 보조 지표가 됩니다.

이제 관련 흐름을 확인해 보겠습니다. 금리, 환율, 미국 지수, 배당 기대 중 무엇이 이 ETF를 움직이는지 봐야 합니다.`,
  (context) => `저는 오늘 ${context.name}을 보면서 “시장 분위기가 어디로 기울고 있나?”를 먼저 생각했습니다. ${context.sector} 쪽은 한 번 흐름이 붙으면 며칠씩 이어질 때가 있어서, ETF 보드에서 반복해서 보이는지 확인할 필요가 있습니다.

현재가는 ${context.currentPrice}, 최근매수 기준은 ${context.recentBuyDate}입니다. 최근매수 이후 수익률은 ${context.currentReturn}로 표시됩니다. 여기서 수익률이 이미 많이 벌어졌다면 추격 부담이 생기고, 아직 초입이면 다시 볼 이유가 생깁니다.

목표여력 ${context.targetPotential}은 위쪽 공간을 보는 참고값입니다. 다만 ETF는 종목보다 느리게 움직일 수 있으니, 하루 결과보다 방향이 이어지는지가 더 중요합니다.

관련 기사 흐름을 같이 보면서 이 방향성이 단기인지, 조금 더 이어질 수 있는지 확인해 보겠습니다.`,
  (context) => `${context.name}은 종목을 고르기 전 시장을 먼저 보는 용도로 괜찮습니다. ${context.sector} 흐름이 살아나면 관련 종목들도 뒤따라 움직일 수 있기 때문입니다.

현재가는 ${context.currentPrice}, 목표여력은 ${context.targetPotential}, 최근매수는 ${context.recentBuyDate}입니다. 숫자가 깔끔해 보여도 저는 바로 결론 내리지 않습니다. ETF는 큰 흐름을 보는 도구라서, 섹터 뉴스와 시장 분위기를 같이 봐야 합니다.

특히 해외 지수나 금리 이슈가 있는 날에는 ETF가 먼저 반응하는 경우가 있습니다. 개별 종목보다 ETF가 먼저 움직이면, 그 뒤에 어떤 종목들이 따라오는지 보는 재미가 있습니다.

그럼 ${context.name}을 둘러싼 최근 흐름을 기사로 확인해 보겠습니다.`,
  (context) => `오늘 ETF 보드는 ${context.name}을 한 번 보라고 말하는 듯합니다. 물론 점수 ${context.totalScore}만으로 결론을 내리면 안 됩니다. 중요한 건 ${context.sector} 쪽 자금 흐름이 실제로 이어지는지입니다.

현재가는 ${context.currentPrice}, 최근매수 기준은 ${context.recentBuyDate}, 목표여력은 ${context.targetPotential}입니다. 저는 이런 ETF를 볼 때 “매수해야 하나?”보다 “이 섹터가 지금 시장에서 관심을 받고 있나?”를 먼저 봅니다.

보완이 필요해 보이는 부분도 있습니다. ETF는 분산되어 있는 만큼 움직임이 느릴 수 있고, 시장 전체가 흔들리면 같이 밀릴 수 있습니다.

그래서 이제 관련 기사 흐름을 확인해 보겠습니다. ETF는 차트와 뉴스가 같이 맞아야 다음 날에도 다시 볼 이유가 생깁니다.`
];

const ETF_CONVERSATIONAL_PATTERNS: Array<(context: EtfNarrativeContext) => string> = [
  (context) => `종목을 보다가 애매할 때는 ETF를 같이 보면 생각보다 힌트가 많습니다. 오늘은 ${context.name}이 눈에 들어왔습니다.

이 ETF는 ${context.sector} 흐름을 볼 때 참고하기 좋습니다. 현재가는 ${context.currentPrice}, 최근매수 기준은 ${context.recentBuyDate}, 목표여력은 ${context.targetPotential}입니다. 저는 이런 숫자를 “매수하라”로 보지는 않고, 시장이 어느 쪽을 편하게 보는지 확인하는 용도로 봅니다.

그럼 관련 기사 흐름도 같이 보겠습니다.`,
  (context) => `${context.name}은 오늘 ETF 보드에서 한 번 열어볼 만했습니다. 개별 종목이 조금 애매한 날에는 이런 ETF가 오히려 시장의 방향을 더 잘 보여줄 때가 있습니다.

현재가는 ${context.currentPrice}, 최근매수는 ${context.recentBuyDate}, 현재수익률은 ${context.currentReturn}입니다. ${context.sector} 쪽 흐름이 이어지는지 보려면 이 ETF를 며칠 더 같이 봐야 합니다.

이제 금리, 환율, 해외 지수 쪽 뉴스가 같이 붙는지 확인해 보겠습니다.`,
  (context) => `오늘은 ${context.name}도 같이 보겠습니다. 종목만 보면 시야가 좁아질 수 있는데, ETF를 같이 보면 시장이 어디에 점수를 주는지 조금 더 보입니다.

현재가 ${context.currentPrice}, 목표여력 ${context.targetPotential}, 점수 ${context.totalScore}. 숫자는 참고만 하고, 저는 ${context.sector} 쪽에 돈이 계속 들어오는지를 더 봅니다.

그럼 최근 흐름을 기사로 한 번 더 확인해 보겠습니다.`,
  (context) => `${context.name}은 느리지만 방향을 보여주는 쪽에 가깝습니다. 종목처럼 확 튀지는 않아도, ${context.sector} 쪽 분위기가 살아 있는지 확인하기에는 좋습니다.

최근매수 기준은 ${context.recentBuyDate}, 현재가는 ${context.currentPrice}입니다. 저는 이런 ETF를 볼 때 하루 수익률보다 며칠 이어지는 흐름인지를 봅니다.

관련 뉴스에서 같은 방향의 이야기가 나오는지 살펴보겠습니다.`,
  (context) => `ETF는 재미없어 보일 때도 있지만, 시장을 볼 때는 꽤 유용합니다. 오늘 ${context.name}은 ${context.sector} 쪽 흐름을 확인하는 용도로 보겠습니다.

현재가는 ${context.currentPrice}, 목표여력은 ${context.targetPotential}입니다. 종목 신호가 부족한 날에는 ETF가 먼저 힌트를 줄 때가 있습니다.

자. 그럼 이 ETF가 왜 상위권에 올라왔는지 관련 흐름을 확인해 보겠습니다.`
];

function buildEtfNarrativeIntro(input: { pick: DailyBriefEtfPick; marketDate: string }) {
  const pick = input.pick;
  const name = normalizeName(pick.name);
  const context: EtfNarrativeContext = {
    name,
    sector: pick.category ?? inferEtfSector(name),
    currentPrice: pick.currentPrice ?? "-",
    targetPotential: pick.targetPotential ?? "-",
    recentBuyDate: pick.recentBuyDate ?? "원문 화면 확인 필요",
    currentReturn: pick.currentReturn ?? "-",
    totalScore: pick.totalScore ?? "-"
  };
  const patterns = ETF_CONVERSATIONAL_PATTERNS.length > 0 ? ETF_CONVERSATIONAL_PATTERNS : ETF_NARRATIVE_PATTERNS;
  const pattern = patterns[stableIndex([input.marketDate, pick.code, name, "etf"].join(":"), patterns.length)];
  return pattern(context);
}

function formatResearchLink(item: DailyBriefRun["researchItems"][number]) {
  const meta = [item.sourceName || formatResearchSource(item.source), formatDate(item.publishedAt)].filter(Boolean).join(" · ");
  return `[${escapeMarkdownLinkText(item.title)}](${item.url || item.searchUrl}) (${meta || "검색 링크"}) - ${item.shortSummary}`;
}

function formatDisclosureLink(item: DailyBriefRun["officialDisclosureItems"][number]) {
  const meta = [item.sourceName, formatDate(item.publishedAt)].filter(Boolean).join(" · ");
  return `[${escapeMarkdownLinkText(item.title)}](${item.url}) (${meta || "공시"})`;
}

function formatResearchSource(source: string) {
  if (source === "naver_news_search_link") {
    return "네이버 뉴스 검색";
  }
  if (source === "google_news_rss") {
    return "Google 뉴스";
  }
  return source.replaceAll("_", " ");
}

function formatDate(value: string | null) {
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

function inferEtfSector(name: string) {
  if (/S&P|나스닥|미국|해외/i.test(name)) {
    return "미국·해외";
  }
  if (/배당|커버드|인컴/i.test(name)) {
    return "배당·인컴";
  }
  if (/채권|금리|머니|현금/i.test(name)) {
    return "채권·금리·현금성";
  }
  if (/반도체|AI|테크|기술/i.test(name)) {
    return "반도체·AI";
  }
  return "ETF 섹터";
}

function describeStockTheme(name: string) {
  if (/금융|은행|지주|하나금융|신한지주|KB금융|우리금융/i.test(name)) {
    return "금융주";
  }
  if (/콜마|화장품|뷰티|아모레|코스맥스/i.test(name)) {
    return "화장품·소비재";
  }
  if (/항공|대한항공|진에어|아시아나/i.test(name)) {
    return "항공·여행";
  }
  if (/타이어|자동차|현대|기아|모비스/i.test(name)) {
    return "자동차·부품";
  }
  if (/반도체|테크|전자|하이닉스|삼성전자/i.test(name)) {
    return "반도체·테크";
  }
  if (/오일|정유|화학|에너지/i.test(name)) {
    return "에너지·화학";
  }
  return "해당 업종";
}

function describePricePosition(pick: DailyBriefStockPick) {
  const current = parsePrice(pick.currentPrice);
  const entry = parsePrice(pick.entryPrice);
  if (!current || !entry) {
    return "가격 위치는 원문 화면에서 한 번 더 확인이 필요합니다.";
  }
  const gapPercent = ((current - entry) / entry) * 100;
  if (gapPercent >= 5) {
    return `진입 기준 위로 약 ${formatPercent(gapPercent)} 정도 올라와 있어, 저는 이 정도면 추격 부담을 먼저 생각합니다.`;
  }
  if (gapPercent >= 1) {
    return `현재가는 진입 기준 위에서 약 ${formatPercent(gapPercent)} 정도 버티고 있습니다.`;
  }
  if (gapPercent >= -1) {
    return "진입 기준과 거의 붙어 있어서, 기준선 근처에서 버티는지가 핵심입니다.";
  }
  return `진입 기준 아래로 약 ${formatPercent(Math.abs(gapPercent))} 내려와 있어, 신호가 살아 있는지 다시 확인할 필요가 있습니다.`;
}

function parsePrice(value: string | null) {
  const parsed = value ? Number(value.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function stableIndex(value: string, modulo: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return modulo > 0 ? hash % modulo : 0;
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

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function withSubjectParticle(value: string) {
  return `${value}${hasFinalConsonant(value) ? "은" : "는"}`;
}

function withObjectParticle(value: string) {
  return `${value}${hasFinalConsonant(value) ? "을" : "를"}`;
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

function joinKoreanList(values: string[]) {
  if (values.length === 0) {
    return "주요 후보";
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]}와 ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, ${values.at(-1)}`;
}

function parseScore(value: string | null) {
  const parsed = value ? Number(value.replace(/[^\d.-]/g, "")) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/[[\]]/g, "");
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
