import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { DailyBriefCapture, DailyBriefRun } from "@/lib/daily-brief/types";
import type {
  DailyBriefVideoCard,
  DailyBriefVideoCoverSpec,
  DailyBriefVideoPackageFile,
  DailyBriefVideoPackageManifest,
  DailyBriefVideoPackageResult,
  DailyBriefVideoPackageValidation,
  DailyBriefVideoSourceSnapshot,
  DailyBriefVideoSideEffectSummary,
  DailyBriefVideoStoryboardScene,
  DailyBriefVideoSubtitleCue,
  DailyBriefVideoUploadPackage
} from "./types";

const VIDEO_PACKAGE_VERSION = "VIDEO-1B";
const OUTPUT_ROOT = path.join(process.cwd(), "local-data", "video-automation", "daily-brief");

export function buildDailyBriefVideoPackagePreview(run: DailyBriefRun, generatedAt = new Date().toISOString()): DailyBriefVideoPackageResult {
  const packageSlug = sanitizePackageSlug(run.id);
  const sourceSnapshot = buildSourceSnapshot(run);
  const sourceBlockingReasons = buildSourceBlockingReasons(run);
  const warnings = buildPackageWarnings(run);
  const source = buildSourceSummary(run);
  const cover = buildCoverSpec(run);
  const cards = buildCards(run, cover);
  const storyboard = buildStoryboard(cards);
  const subtitles = buildSubtitles(storyboard);
  const mp4 = {
    status: "render_plan_only" as const,
    renderImplemented: false as const,
    targetFileName: `${packageSlug}.mp4`,
    sourceHash: sourceSnapshot.hash,
    sourceHashPrefix: sourceSnapshot.hashPrefix,
    resolution: "1080x1920" as const,
    fps: 30 as const,
    totalDurationSec: storyboard.length ? storyboard[storyboard.length - 1].endSec : 0,
    requiredRenderer: "future_video_renderer" as const,
    blockingReason: "mp4_binary_rendering_not_implemented_in_video_1a" as const
  };
  const uploadPackage = buildUploadPackage(run, packageSlug);
  const files = buildPackageFileList(packageSlug);
  const sideEffectSummary = buildVideoSideEffects({ localFileWrite: false });
  const validation = buildPackageValidation({
    sourceBlockingReasons,
    sourceWarnings: warnings,
    sourceSnapshot,
    cards,
    storyboard,
    subtitles,
    mp4,
    uploadPackage,
    sideEffectSummary
  });
  const blockingReasons = Array.from(new Set([...sourceBlockingReasons, ...validation.errors]));
  const manifest: DailyBriefVideoPackageManifest = {
    kind: "daily_brief_video_package",
    version: VIDEO_PACKAGE_VERSION,
    generatedAt,
    sourceSnapshot,
    source,
    readiness: {
      canGeneratePackage: blockingReasons.length === 0,
      canRenderMp4: false,
      canUpload: false,
      blockingReasons,
      warnings: Array.from(new Set([...warnings, ...validation.warnings]))
    },
    cover,
    cards,
    storyboard,
    subtitles,
    mp4,
    uploadPackage,
    validation,
    files,
    sideEffectSummary
  };

  return {
    manifest,
    outputDirectory: null,
    files
  };
}

export async function writeDailyBriefVideoPackage(run: DailyBriefRun, generatedAt = new Date().toISOString()): Promise<DailyBriefVideoPackageResult> {
  const preview = buildDailyBriefVideoPackagePreview(run, generatedAt);
  const packageSlug = preview.manifest.uploadPackage.packageSlug;
  const outputDirectory = path.join(OUTPUT_ROOT, packageSlug);
  await mkdir(outputDirectory, { recursive: true });

  const artifactContents = buildArtifactContents(preview.manifest);
  const writtenFiles: DailyBriefVideoPackageFile[] = [];
  for (const artifact of artifactContents) {
    const filePath = path.join(outputDirectory, artifact.fileName);
    await writeFile(filePath, artifact.content, "utf8");
    writtenFiles.push({
      kind: artifact.kind,
      fileName: artifact.fileName,
      relativePath: path.relative(process.cwd(), filePath),
      mimeType: artifact.mimeType,
      bytes: Buffer.byteLength(artifact.content, "utf8")
    });
  }

  let manifestBytes: number | null = null;
  let manifest = {
    ...preview.manifest,
    files: [
      buildManifestFile(packageSlug, manifestBytes),
      ...writtenFiles
    ],
    sideEffectSummary: buildVideoSideEffects({ localFileWrite: true })
  };
  let manifestContent = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    manifestContent = JSON.stringify(manifest, null, 2);
    const nextBytes = Buffer.byteLength(manifestContent, "utf8");
    if (nextBytes === manifestBytes) {
      break;
    }
    manifestBytes = nextBytes;
    manifest = {
      ...manifest,
      files: [
        buildManifestFile(packageSlug, manifestBytes),
        ...writtenFiles
      ]
    };
  }
  manifestContent = JSON.stringify(manifest, null, 2);
  await writeFile(path.join(outputDirectory, "manifest.json"), manifestContent, "utf8");

  return {
    manifest,
    outputDirectory,
    files: manifest.files
  };
}

function buildSourceSummary(run: DailyBriefRun): DailyBriefVideoPackageManifest["source"] {
  return {
    id: run.id,
    status: run.status,
    marketDate: run.marketDate,
    title: run.title,
    targetKeyword: run.targetKeyword,
    contentItemId: run.contentItemId,
    draftMarkdownLength: run.draftMarkdownLength,
    draftHtmlLength: run.draftHtmlLength,
    visibleTextLength: run.visibleTextLength,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    stockPickCount: run.stockPicks.length,
    etfPickCount: run.etfPicks.length,
    futuresPickCount: run.futuresPicks?.length ?? 0,
    researchItemCount: run.researchItems.length,
    captureCount: run.captures.length
  };
}

function buildSourceSnapshot(run: DailyBriefRun): DailyBriefVideoSourceSnapshot {
  const sourceInput = buildCanonicalSourceInput(run);
  const canonicalJson = JSON.stringify(toCanonicalValue(sourceInput));
  const hash = createHash("sha256").update(canonicalJson, "utf8").digest("hex");
  return {
    schemaVersion: "daily_brief_video_source_v1",
    hashAlgorithm: "sha256",
    hash,
    hashPrefix: hash.slice(0, 12),
    canonicalJsonLength: Buffer.byteLength(canonicalJson, "utf8"),
    includedFields: [
      "run identity/status/date/title/keyword",
      "run generation counts and content item references",
      "stock/ETF/futures pick display fields",
      "research/disclosure/prewrite summaries",
      "capture safe metadata without storagePath",
      "Daily Brief safe side-effect summary"
    ],
    excludedFields: [
      "generatedAt",
      "local output file bytes",
      "local outputDirectory",
      "capture storagePath",
      "any env/secret/token material"
    ]
  };
}

function buildCanonicalSourceInput(run: DailyBriefRun) {
  return {
    id: run.id,
    status: run.status,
    marketDate: run.marketDate,
    title: run.title,
    targetKeyword: run.targetKeyword,
    stockPickLimit: run.stockPickLimit,
    stockDetailLimit: run.stockDetailLimit,
    etfPickLimit: run.etfPickLimit,
    includeEtfs: run.includeEtfs,
    krBoardUrl: run.krBoardUrl,
    etfBoardUrl: run.etfBoardUrl,
    contentItemId: run.contentItemId,
    tistoryReviewContentItemId: run.tistoryReviewContentItemId ?? null,
    tistoryReviewExportUrl: run.tistoryReviewExportUrl ?? null,
    tistoryReviewMode: run.tistoryReviewMode ?? null,
    draftMarkdownLength: run.draftMarkdownLength,
    draftHtmlLength: run.draftHtmlLength,
    visibleTextLength: run.visibleTextLength,
    warnings: run.warnings,
    sideEffectSummary: run.sideEffectSummary,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    stockPicks: run.stockPicks.map((pick) => ({
      rank: pick.rank,
      name: pick.name,
      code: pick.code,
      market: pick.market,
      statusLabel: pick.statusLabel,
      currentPrice: pick.currentPrice,
      entryPrice: pick.entryPrice,
      targetPrice: pick.targetPrice,
      stopLoss: pick.stopLoss,
      recentSignalDate: pick.recentSignalDate,
      trendScore: pick.trendScore,
      totalScore: pick.totalScore,
      detailUrl: pick.detailUrl,
      chartCaptureId: pick.chartCaptureId
    })),
    etfPicks: run.etfPicks.map((pick) => ({
      rank: pick.rank,
      name: pick.name,
      code: pick.code,
      category: pick.category,
      statusLabel: pick.statusLabel,
      currentPrice: pick.currentPrice,
      targetPotential: pick.targetPotential,
      recentBuyDate: pick.recentBuyDate,
      currentReturn: pick.currentReturn,
      totalScore: pick.totalScore
    })),
    futuresPicks: (run.futuresPicks ?? []).map((pick) => ({
      rank: pick.rank,
      symbol: pick.symbol,
      name: pick.name,
      exchange: pick.exchange,
      sourceName: pick.sourceName,
      statusLabel: pick.statusLabel,
      currentValue: pick.currentValue,
      changeRate: pick.changeRate,
      observedAtLabel: pick.observedAtLabel,
      strategyName: pick.strategyName,
      strategyStatus: pick.strategyStatus,
      timeframe: pick.timeframe,
      performancePeriod: pick.performancePeriod,
      signalLabel: pick.signalLabel,
      marketState: pick.marketState,
      confidence: pick.confidence,
      sourceUrl: pick.sourceUrl,
      dataReady: pick.dataReady,
      warnings: pick.warnings
    })),
    researchItems: run.researchItems.map((item) => ({
      symbolCode: item.symbolCode,
      symbolName: item.symbolName,
      query: item.query,
      searchUrl: item.searchUrl,
      title: item.title,
      source: item.source,
      sourceName: item.sourceName ?? null,
      publishedAt: item.publishedAt,
      url: item.url,
      shortSummary: item.shortSummary
    })),
    officialDisclosureItems: run.officialDisclosureItems.map((item) => ({
      symbolCode: item.symbolCode,
      symbolName: item.symbolName,
      title: item.title,
      source: item.source,
      sourceName: item.sourceName,
      publishedAt: item.publishedAt,
      url: item.url,
      receiptNo: item.receiptNo,
      shortSummary: item.shortSummary
    })),
    prewriteContextItems: run.prewriteContextItems.map((item) => ({
      kind: item.kind,
      symbolCode: item.symbolCode ?? null,
      symbolName: item.symbolName ?? null,
      title: item.title,
      summary: item.summary,
      sourceName: item.sourceName,
      url: item.url ?? null,
      publishedAt: item.publishedAt ?? null,
      confidence: item.confidence
    })),
    captures: run.captures.map((capture) => ({
      id: capture.id,
      kind: capture.kind,
      label: capture.label,
      sourceUrl: capture.sourceUrl,
      target: capture.target,
      selectorUsed: capture.selectorUsed,
      fileName: capture.fileName,
      mimeType: capture.mimeType,
      fileSize: capture.fileSize,
      width: capture.width,
      height: capture.height,
      mode: capture.mode,
      warning: capture.warning,
      createdAt: capture.createdAt
    }))
  };
}

function buildPackageValidation(input: {
  sourceBlockingReasons: string[];
  sourceWarnings: string[];
  sourceSnapshot: DailyBriefVideoSourceSnapshot;
  cards: DailyBriefVideoCard[];
  storyboard: DailyBriefVideoStoryboardScene[];
  subtitles: DailyBriefVideoSubtitleCue[];
  mp4: DailyBriefVideoPackageManifest["mp4"];
  uploadPackage: DailyBriefVideoUploadPackage;
  sideEffectSummary: DailyBriefVideoSideEffectSummary;
}): DailyBriefVideoPackageValidation {
  const checks: DailyBriefVideoPackageValidation["checks"] = [];
  const addCheck = (code: string, status: "pass" | "warn" | "fail", message: string) => checks.push({ code, status, message });
  const sourceCaptureReferences = input.storyboard.flatMap((scene) => scene.sourceCaptureIds);
  const uniqueCaptureReferences = new Set(sourceCaptureReferences);
  const cardIds = input.cards.map((card) => card.id);
  const uniqueCardIds = new Set(cardIds);

  for (const reason of input.sourceBlockingReasons) {
    addCheck(reason, "fail", `Source Daily Brief run is not package-ready: ${reason}.`);
  }
  for (const warning of input.sourceWarnings) {
    addCheck(warning, "warn", `Source/package warning: ${warning}.`);
  }

  addCheck(
    "source_snapshot_hash_present",
    /^[a-f0-9]{64}$/.test(input.sourceSnapshot.hash) ? "pass" : "fail",
    "Source snapshot must include a SHA-256 hash for deterministic package checks."
  );
  addCheck(input.cards.length > 0 ? "cards_present" : "cards_missing", input.cards.length > 0 ? "pass" : "fail", "At least one card is required.");
  addCheck(
    uniqueCardIds.size === cardIds.length ? "card_ids_unique" : "card_ids_duplicate",
    uniqueCardIds.size === cardIds.length ? "pass" : "fail",
    "Card ids must be unique so renderers can address each card deterministically."
  );
  addCheck(
    input.cards.some((card) => card.id === "closing-risk-note") ? "risk_note_card_present" : "risk_note_card_missing",
    input.cards.some((card) => card.id === "closing-risk-note") ? "pass" : "fail",
    "A closing risk note card is required before any video render or upload package can be considered complete."
  );
  addCheck(
    input.storyboard.length === input.cards.length ? "storyboard_matches_cards" : "storyboard_card_count_mismatch",
    input.storyboard.length === input.cards.length ? "pass" : "fail",
    "Storyboard scene count must match card count."
  );

  let expectedStartSec = 0;
  const scenesContinuous = input.storyboard.every((scene) => {
    const ok = scene.startSec === expectedStartSec && scene.durationSec > 0 && scene.endSec === scene.startSec + scene.durationSec;
    expectedStartSec = scene.endSec;
    return ok;
  });
  addCheck(scenesContinuous ? "storyboard_timing_continuous" : "storyboard_timing_gap", scenesContinuous ? "pass" : "fail", "Storyboard timing must be continuous.");
  addCheck(
    input.subtitles.length === input.storyboard.length ? "subtitle_count_matches_storyboard" : "subtitle_count_mismatch",
    input.subtitles.length === input.storyboard.length ? "pass" : "fail",
    "Subtitle cue count must match storyboard scene count."
  );
  const subtitlesAligned = input.subtitles.every((cue, index) => {
    const scene = input.storyboard[index];
    return Boolean(scene && cue.startSec === scene.startSec && cue.endSec === scene.endSec && cue.text.trim());
  });
  addCheck(subtitlesAligned ? "subtitles_aligned" : "subtitles_not_aligned", subtitlesAligned ? "pass" : "fail", "Subtitle cue timing must align with storyboard scenes.");
  addCheck(
    input.mp4.status === "render_plan_only" && input.mp4.renderImplemented === false ? "mp4_render_plan_only" : "mp4_render_enabled_unexpectedly",
    input.mp4.status === "render_plan_only" && input.mp4.renderImplemented === false ? "pass" : "fail",
    "VIDEO-1B must keep MP4 binary rendering disabled and write only a render plan."
  );
  addCheck(
    input.mp4.sourceHash === input.sourceSnapshot.hash ? "mp4_source_hash_matches" : "mp4_source_hash_mismatch",
    input.mp4.sourceHash === input.sourceSnapshot.hash ? "pass" : "fail",
    "MP4 render plan must carry the same source hash as the package manifest."
  );
  addCheck(
    input.uploadPackage.ready === false && input.uploadPackage.platformUploadsEnabled === false ? "platform_uploads_disabled" : "platform_upload_enabled",
    input.uploadPackage.ready === false && input.uploadPackage.platformUploadsEnabled === false ? "pass" : "fail",
    "External platform uploads must remain disabled."
  );
  const externalWriteDisabled =
    input.sideEffectSummary.dailyBriefRunWrite === false &&
    input.sideEffectSummary.existingContentItemMutation === false &&
    input.sideEffectSummary.dbWrite === false &&
    input.sideEffectSummary.externalServiceWrite === false &&
    input.sideEffectSummary.bloggerApiWrite === false &&
    input.sideEffectSummary.tistoryApiWrite === false &&
    input.sideEffectSummary.youtubeUpload === false &&
    input.sideEffectSummary.instagramUpload === false &&
    input.sideEffectSummary.tiktokUpload === false &&
    input.sideEffectSummary.scheduledPublishMutation === false &&
    input.sideEffectSummary.llmCall === false &&
    input.sideEffectSummary.secretRead === false;
  addCheck(externalWriteDisabled ? "side_effect_boundary_clean" : "side_effect_boundary_violation", externalWriteDisabled ? "pass" : "fail", "Only local package file writes are allowed.");

  const errors = checks.filter((check) => check.status === "fail").map((check) => check.code);
  const warnings = checks.filter((check) => check.status === "warn").map((check) => check.code);
  return {
    ready: errors.length === 0,
    errors,
    warnings,
    checks,
    counts: {
      cardCount: input.cards.length,
      storyboardSceneCount: input.storyboard.length,
      subtitleCueCount: input.subtitles.length,
      sourceCaptureReferenceCount: sourceCaptureReferences.length,
      uniqueSourceCaptureReferenceCount: uniqueCaptureReferences.size,
      totalDurationSec: input.mp4.totalDurationSec
    },
    deterministicArtifactFields: [
      "sourceSnapshot.hash",
      "source",
      "cover",
      "cards",
      "storyboard",
      "subtitles",
      "mp4",
      "uploadPackage"
    ]
  };
}

function buildSourceBlockingReasons(run: DailyBriefRun) {
  const reasons: string[] = [];
  if (run.stockPicks.length === 0 && run.etfPicks.length === 0 && (run.futuresPicks?.length ?? 0) === 0) {
    reasons.push("daily_brief_market_items_required");
  }
  if (run.status === "failed") {
    reasons.push("daily_brief_run_failed");
  }
  return reasons;
}

function buildPackageWarnings(run: DailyBriefRun) {
  const warnings = new Set<string>();
  if (run.captures.length === 0) {
    warnings.add("daily_brief_captures_missing");
  }
  if (run.captures.some((capture) => capture.mode === "placeholder")) {
    warnings.add("placeholder_capture_present");
  }
  if (!run.contentItemId) {
    warnings.add("daily_brief_content_item_not_generated");
  }
  if (run.researchItems.length === 0 && run.officialDisclosureItems.length === 0) {
    warnings.add("supporting_research_missing");
  }
  warnings.add("mp4_binary_rendering_not_implemented_in_video_1a");
  warnings.add("external_uploads_disabled_by_policy");
  return Array.from(warnings);
}

function buildCoverSpec(run: DailyBriefRun): DailyBriefVideoCoverSpec {
  const highlights = [
    ...run.stockPicks.slice(0, 3).map((pick) => `${pick.name} ${pick.code}`),
    ...run.etfPicks.slice(0, Math.max(0, 3 - Math.min(run.stockPicks.length, 3))).map((pick) => `${pick.name} ${pick.code}`)
  ];
  return {
    title: truncateText(run.title, 58),
    subtitle: `${run.marketDate} Daily Brief 영상 패키지`,
    marketDate: run.marketDate,
    highlightLabels: highlights.length ? highlights : ["Daily Brief"],
    sourceCaptureIds: captureIds(run.captures, ["kr_board", "etf_board"]).slice(0, 2)
  };
}

function buildCards(run: DailyBriefRun, cover: DailyBriefVideoCoverSpec): DailyBriefVideoCard[] {
  const cards: DailyBriefVideoCard[] = [
    {
      id: "cover",
      title: cover.title,
      bodyLines: [cover.subtitle, cover.highlightLabels.join(" / ")],
      visualHint: "세로형 커버. Daily Brief 제목, 날짜, 주요 종목을 크게 배치합니다.",
      sourceCaptureIds: cover.sourceCaptureIds
    },
    {
      id: "market-summary",
      title: "오늘 영상의 핵심",
      bodyLines: [
        `관심 종목 ${run.stockPicks.length}개, ETF ${run.etfPicks.length}개를 짧게 점검합니다.`,
        run.researchItems.length ? `뉴스/공시 참고 후보 ${run.researchItems.length}개를 함께 확인합니다.` : "뉴스/공시 보강 자료는 아직 없습니다."
      ],
      visualHint: "시그널보드 전체 흐름을 보여주는 요약 카드입니다.",
      sourceCaptureIds: captureIds(run.captures, ["kr_board", "etf_board"]).slice(0, 2)
    }
  ];

  for (const pick of run.stockPicks.slice(0, 5)) {
    const chartCapture = findCaptureById(run.captures, pick.chartCaptureId);
    cards.push({
      id: `stock-${pick.code}`,
      title: `${pick.rank}. ${pick.name}`,
      bodyLines: [
        compactParts(["현재가", pick.currentPrice, "진입", pick.entryPrice, "목표", pick.targetPrice]),
        compactParts(["손절", pick.stopLoss, "점수", pick.totalScore, "최근 신호", pick.recentSignalDate]),
        pick.statusLabel ? `상태: ${pick.statusLabel}` : "상태 정보는 원본 Daily Brief 기준으로 확인합니다."
      ].filter(Boolean),
      visualHint: chartCapture ? `${pick.name} 신호차트 캡처를 배경으로 사용합니다.` : `${pick.name} 텍스트 중심 카드입니다.`,
      sourceCaptureIds: chartCapture ? [chartCapture.id] : []
    });
  }

  if (run.etfPicks.length) {
    cards.push({
      id: "etf-summary",
      title: "ETF 흐름 보강",
      bodyLines: run.etfPicks.slice(0, 4).map((pick) => compactParts([`${pick.rank}. ${pick.name}`, pick.category, pick.currentReturn, pick.totalScore])),
      visualHint: "ETF 시그널보드 캡처와 TOP ETF 리스트를 함께 표시합니다.",
      sourceCaptureIds: captureIds(run.captures, ["etf_board"]).slice(0, 1)
    });
  }

  if (run.futuresPicks?.length) {
    cards.push({
      id: "futures-summary",
      title: "선물 시그널 메모",
      bodyLines: run.futuresPicks.slice(0, 4).map((pick) => compactParts([`${pick.rank}. ${pick.name}`, pick.timeframe, pick.signalLabel, pick.changeRate])),
      visualHint: "선물 보드 또는 상세 캡처를 세로 카드에 맞춰 배치합니다.",
      sourceCaptureIds: captureIds(run.captures, ["futures_board", "futures_detail"]).slice(0, 2)
    });
  }

  cards.push({
    id: "closing-risk-note",
    title: "마지막 확인",
    bodyLines: [
      "이 영상은 투자 조언이 아니라 Daily Brief 기반 정보성 요약입니다.",
      "매수·매도 전 가격, 공시, 손절 기준을 직접 확인하세요."
    ],
    visualHint: "위험 고지와 원문 확인 안내를 정돈된 엔딩 카드로 표시합니다.",
    sourceCaptureIds: []
  });

  return cards;
}

function buildStoryboard(cards: DailyBriefVideoCard[]): DailyBriefVideoStoryboardScene[] {
  let cursor = 0;
  return cards.map((card, index) => {
    const durationSec = index === 0 || index === cards.length - 1 ? 4 : 5;
    const scene: DailyBriefVideoStoryboardScene = {
      id: `scene-${String(index + 1).padStart(2, "0")}`,
      startSec: cursor,
      endSec: cursor + durationSec,
      durationSec,
      title: card.title,
      narration: truncateText([card.title, ...card.bodyLines].join(" "), 180),
      onScreenText: [card.title, ...card.bodyLines].map((line) => truncateText(line, 52)),
      visualSource: card.visualHint,
      sourceCaptureIds: card.sourceCaptureIds
    };
    cursor += durationSec;
    return scene;
  });
}

function buildSubtitles(storyboard: DailyBriefVideoStoryboardScene[]): DailyBriefVideoSubtitleCue[] {
  return storyboard.map((scene, index) => ({
    index: index + 1,
    startSec: scene.startSec,
    endSec: scene.endSec,
    text: scene.narration
  }));
}

function buildUploadPackage(run: DailyBriefRun, packageSlug: string): DailyBriefVideoUploadPackage {
  return {
    ready: false,
    packageSlug,
    title: truncateText(run.title, 80),
    description: [
      `${run.marketDate} Daily Brief 기반 숏폼 영상 패키지입니다.`,
      "원본 Daily Brief 결과를 read-only로 재사용한 로컬 산출물이며, 투자 조언이 아닙니다.",
      "업로드 전 사람이 숫자, 차트, 공시, 위험 고지를 검토해야 합니다."
    ].join("\n"),
    hashtags: ["DailyBrief", "국내주식", "ETF", "급등포착", "투자리스크"],
    blockedReasons: [
      "mp4_binary_rendering_not_implemented_in_video_1a",
      "youtube_instagram_tiktok_uploads_forbidden",
      "manual_review_required_before_any_external_write"
    ],
    platformUploadsEnabled: false
  };
}

function buildArtifactContents(manifest: DailyBriefVideoPackageManifest) {
  return [
    {
      kind: "storyboard_json" as const,
      fileName: "storyboard.json",
      mimeType: "application/json",
      content: JSON.stringify(
        {
          version: manifest.version,
          sourceRunId: manifest.source.id,
          scenes: manifest.storyboard
        },
        null,
        2
      )
    },
    {
      kind: "subtitles_srt" as const,
      fileName: "subtitles.srt",
      mimeType: "application/x-subrip",
      content: renderSrt(manifest.subtitles)
    },
    {
      kind: "subtitles_vtt" as const,
      fileName: "subtitles.vtt",
      mimeType: "text/vtt",
      content: renderVtt(manifest.subtitles)
    },
    {
      kind: "card_news_html" as const,
      fileName: "card-news.html",
      mimeType: "text/html",
      content: renderCardNewsHtml(manifest)
    },
    {
      kind: "cover_html" as const,
      fileName: "cover.html",
      mimeType: "text/html",
      content: renderCoverHtml(manifest)
    },
    {
      kind: "mp4_render_plan_json" as const,
      fileName: "mp4-render-plan.json",
      mimeType: "application/json",
      content: JSON.stringify(manifest.mp4, null, 2)
    }
  ];
}

function buildPackageFileList(packageSlug: string): DailyBriefVideoPackageFile[] {
  return [
    buildManifestFile(packageSlug, null),
    fileRecord("storyboard_json", packageSlug, "storyboard.json", "application/json"),
    fileRecord("subtitles_srt", packageSlug, "subtitles.srt", "application/x-subrip"),
    fileRecord("subtitles_vtt", packageSlug, "subtitles.vtt", "text/vtt"),
    fileRecord("card_news_html", packageSlug, "card-news.html", "text/html"),
    fileRecord("cover_html", packageSlug, "cover.html", "text/html"),
    fileRecord("mp4_render_plan_json", packageSlug, "mp4-render-plan.json", "application/json")
  ];
}

function buildManifestFile(packageSlug: string, bytes: number | null): DailyBriefVideoPackageFile {
  return fileRecord("manifest_json", packageSlug, "manifest.json", "application/json", bytes);
}

function fileRecord(
  kind: DailyBriefVideoPackageFile["kind"],
  packageSlug: string,
  fileName: string,
  mimeType: string,
  bytes: number | null = null
): DailyBriefVideoPackageFile {
  return {
    kind,
    fileName,
    relativePath: path.join("local-data", "video-automation", "daily-brief", packageSlug, fileName),
    mimeType,
    bytes
  };
}

function renderSrt(cues: DailyBriefVideoSubtitleCue[]) {
  return `${cues
    .map((cue) => `${cue.index}\n${formatSrtTime(cue.startSec)} --> ${formatSrtTime(cue.endSec)}\n${cue.text}`)
    .join("\n\n")}\n`;
}

function renderVtt(cues: DailyBriefVideoSubtitleCue[]) {
  return `WEBVTT\n\n${cues.map((cue) => `${formatVttTime(cue.startSec)} --> ${formatVttTime(cue.endSec)}\n${cue.text}`).join("\n\n")}\n`;
}

function renderCardNewsHtml(manifest: DailyBriefVideoPackageManifest) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(manifest.source.title)} - Card News</title>
  <style>
    body { margin: 0; background: #f5f5f4; color: #1c1917; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .card { aspect-ratio: 9 / 16; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #d6d3d1; border-radius: 8px; background: linear-gradient(145deg, #ffffff, #ecfeff); padding: 20px; box-shadow: 0 10px 24px rgba(28, 25, 23, 0.08); }
    h1 { margin: 0 0 18px; font-size: 28px; line-height: 1.2; }
    h2 { margin: 0; font-size: 24px; line-height: 1.18; }
    p { margin: 10px 0 0; font-size: 16px; line-height: 1.45; }
    small { color: #57534e; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(manifest.source.title)}</h1>
    <div class="grid">
      ${manifest.cards
        .map(
          (card) => `<article class="card">
        <div>
          <small>${escapeHtml(card.id)}</small>
          <h2>${escapeHtml(card.title)}</h2>
          ${card.bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        </div>
        <small>${escapeHtml(card.visualHint)}</small>
      </article>`
        )
        .join("\n")}
    </div>
  </main>
</body>
</html>
`;
}

function renderCoverHtml(manifest: DailyBriefVideoPackageManifest) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(manifest.cover.title)} - Cover</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .cover { width: min(420px, 92vw); aspect-ratio: 9 / 16; display: flex; flex-direction: column; justify-content: space-between; border-radius: 8px; padding: 34px 28px; background: linear-gradient(160deg, #0f172a 0%, #155e75 54%, #f97316 100%); box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35); }
    .eyebrow { font-size: 14px; letter-spacing: 0; opacity: 0.82; }
    h1 { margin: 14px 0 0; font-size: 34px; line-height: 1.12; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { border: 1px solid rgba(248, 250, 252, 0.45); border-radius: 999px; padding: 7px 10px; background: rgba(15, 23, 42, 0.24); font-weight: 700; }
    p { margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="eyebrow">${escapeHtml(manifest.cover.marketDate)} Daily Brief</div>
      <h1>${escapeHtml(manifest.cover.title)}</h1>
    </div>
    <div class="chips">
      ${manifest.cover.highlightLabels.map((label) => `<span class="chip">${escapeHtml(label)}</span>`).join("")}
    </div>
    <p>${escapeHtml(manifest.uploadPackage.description.split("\n")[1] ?? "")}</p>
  </section>
</body>
</html>
`;
}

function captureIds(captures: DailyBriefCapture[], kinds: DailyBriefCapture["kind"][]) {
  const kindSet = new Set(kinds);
  return captures.filter((capture) => kindSet.has(capture.kind)).map((capture) => capture.id);
}

function findCaptureById(captures: DailyBriefCapture[], id: string | null) {
  if (!id) {
    return null;
  }
  return captures.find((capture) => capture.id === id) ?? null;
}

function compactParts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

function toCanonicalValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toCanonicalValue(item));
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    result[key] = toCanonicalValue(source[key]);
  }
  return result;
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

function sanitizePackageSlug(value: string) {
  const slug = value.replace(/[^a-zA-Z0-9_.-]/g, "-").replace(/-+/g, "-").slice(0, 96);
  if (!slug || slug === "." || slug === "..") {
    throw new Error("invalid_daily_brief_video_package_slug");
  }
  return slug;
}

function formatSrtTime(seconds: number) {
  return formatTime(seconds, ",");
}

function formatVttTime(seconds: number) {
  return formatTime(seconds, ".");
}

function formatTime(seconds: number, millisecondSeparator: "," | ".") {
  const whole = Math.max(0, Math.trunc(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)}${millisecondSeparator}000`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildVideoSideEffects(overrides: Partial<Pick<DailyBriefVideoSideEffectSummary, "localFileWrite">>): DailyBriefVideoSideEffectSummary {
  return {
    dailyBriefRunRead: true,
    dailyBriefRunWrite: false,
    existingContentItemMutation: false,
    dbWrite: false,
    localFileWrite: overrides.localFileWrite ?? false,
    externalServiceWrite: false,
    bloggerApiWrite: false,
    tistoryApiWrite: false,
    youtubeUpload: false,
    instagramUpload: false,
    tiktokUpload: false,
    scheduledPublishMutation: false,
    llmCall: false,
    secretRead: false
  };
}
