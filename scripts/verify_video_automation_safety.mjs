import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const Module = require("module");

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(projectRoot, "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2020
    },
    fileName: filename
  }).outputText;
  module._compile(output, filename);
};

const { buildDailyBriefVideoPackagePreview } = require("../src/lib/video-automation/daily-brief-package.ts");
const { readDailyBriefVideoPackage } = require("../src/lib/video-automation/daily-brief-upload-package.ts");
const { buildDailyBriefVoiceoverScript } = require("../src/lib/video-automation/daily-brief-voiceover-renderer.ts");
const { buildDailyBriefVideoSourceBundle } = require("../src/lib/video-automation/adapters/daily-brief-source.ts");
const { buildContentItemVideoSourceBundle } = require("../src/lib/video-automation/adapters/content-item-source.ts");
const { assertVideoSourceBundleSafe } = require("../src/lib/video-automation/core/source-bundle.ts");
const { buildGenericVideoPackageScaffold } = require("../src/lib/video-automation/core/package-builder.ts");
const { buildVideoScriptPlan } = require("../src/lib/video-automation/core/script-builder.ts");
const { buildManualVideoSourcePreview } = require("../src/lib/video-automation/source-collection/manual-source.ts");
const { buildContentItemVideoSourcePreview } = require("../src/lib/video-automation/source-collection/content-item-collector.ts");
const { buildDailyBriefVideoSourcePreview } = require("../src/lib/video-automation/source-collection/daily-brief-collector.ts");
const { buildSiteRecipeVideoSourcePreview } = require("../src/lib/video-automation/source-collection/site-recipe-source.ts");
const { buildGenericUrlVideoSourcePreview } = require("../src/lib/video-automation/source-collection/generic-url-source.ts");
const { buildVideoSourcePackagePreview, writeVideoSourcePackage } = require("../src/lib/video-automation/source-package/package.ts");

const videoOutputRoot = path.join(projectRoot, "local-data", "video-automation", "daily-brief");
const videoSourceOutputRoot = path.join(projectRoot, "local-data", "video-automation", "sources");

const forbiddenFalseKeys = [
  "dailyBriefRunWrite",
  "existingContentItemMutation",
  "dbWrite",
  "externalServiceWrite",
  "bloggerApiWrite",
  "tistoryApiWrite",
  "youtubeUpload",
  "instagramUpload",
  "tiktokUpload",
  "scheduledPublishMutation",
  "llmCall",
  "secretRead"
];

async function main() {
  const fixture = buildFixtureRun();
  const first = buildDailyBriefVideoPackagePreview(fixture, "2026-07-14T00:00:00.000Z");
  const second = buildDailyBriefVideoPackagePreview(fixture, "2026-07-14T01:23:45.000Z");
  const changed = buildDailyBriefVideoPackagePreview({ ...fixture, title: `${fixture.title} updated` }, "2026-07-14T00:00:00.000Z");

  assertEqual(first.manifest.version, "VIDEO-1B", "manifest version should stay at VIDEO-1B");
  assertMatch(first.manifest.sourceSnapshot.hash, /^[a-f0-9]{64}$/, "source hash should be a SHA-256 hex string");
  assertEqual(first.manifest.sourceSnapshot.schemaVersion, "video_source_bundle_v1", "source hash should come from the common source bundle schema");
  assertEqual(first.manifest.sourceSnapshot.hash, second.manifest.sourceSnapshot.hash, "source hash must ignore generatedAt");
  assertNotEqual(first.manifest.sourceSnapshot.hash, changed.manifest.sourceSnapshot.hash, "source hash must change when safe source fields change");
  assert(first.manifest.sourceSnapshot.canonicalJsonLength > 1000, "canonical source JSON should include meaningful source fields");
  assertIncludes(first.manifest.sourceSnapshot.excludedFields.join(" "), "capture storagePath", "source snapshot must document storagePath exclusion");
  assertIncludes(first.manifest.sourceSnapshot.excludedFields.join(" "), "env/secret/token", "source snapshot must document secret exclusion");

  const manifestJson = JSON.stringify(first.manifest);
  assert(!manifestJson.includes("STORAGE_PATH_SHOULD_NOT_APPEAR"), "manifest must not expose capture storagePath values");
  assert(!manifestJson.includes("client_secret"), "manifest must not include client secret markers");
  assert(!manifestJson.includes("token.json"), "manifest must not include token file markers");

  assertEqual(first.manifest.readiness.canUpload, false, "package upload readiness must stay false");
  assertEqual(first.manifest.readiness.canRenderMp4, false, "package manifest MP4 binary readiness must stay false");
  assertEqual(first.manifest.uploadPackage.ready, false, "upload package must stay not-ready");
  assertEqual(first.manifest.uploadPackage.platformUploadsEnabled, false, "platform uploads must stay disabled");
  assertEqual(first.manifest.mp4.renderImplemented, false, "base package MP4 render plan must not claim binary rendering");
  assertEqual(first.manifest.mp4.sourceHash, first.manifest.sourceSnapshot.hash, "MP4 render plan must carry the package source hash");
  assertEqual(first.manifest.sourceBundle.sourceType, "daily_brief", "manifest should expose common source bundle type");
  assertEqual(first.manifest.sourceBundle.sourceHash, first.manifest.sourceSnapshot.hash, "source bundle summary hash should match source snapshot");
  assert(first.manifest.sourceBundle.insightCount >= 4, "Daily Brief source bundle should expose reusable insights");
  assert(first.manifest.sourceBundle.visualMaterialCount >= first.manifest.sourceBundle.insightCount, "Daily Brief source bundle should expose reusable visual materials");
  assertSideEffects(first.manifest.sideEffectSummary, false, "preview manifest");

  const validation = first.manifest.validation;
  assert(validation.ready, "fixture package validation should be ready");
  assertCheck(validation.checks, "side_effect_boundary_clean", "pass");
  assertCheck(validation.checks, "platform_uploads_disabled", "pass");
  assertCheck(validation.checks, "mp4_render_plan_only", "pass");
  assertCheck(validation.checks, "risk_note_card_last", "pass");
  assertCheck(validation.checks, "subtitle_text_length_ok", "pass");
  assert(validation.warnings.includes("mp4_binary_rendering_not_implemented_in_video_1a"), "MP4-not-implemented warning should remain visible");
  assert(validation.warnings.includes("external_uploads_disabled_by_policy"), "external-upload-disabled warning should remain visible");

  const readback = await readDailyBriefVideoPackage(fixture);
  assertEqual(readback.version, "VIDEO-1H", "readback version should stay at VIDEO-1H");
  assertEqual(readback.currentSourceHash, first.manifest.sourceSnapshot.hash, "readback current hash should match package preview hash");
  assertEqual(readback.guard.operatingRepoTouched, false, "readback guard must not touch operating repo");
  assertEqual(readback.guard.server3004Touched, false, "readback guard must not touch server 3004");
  assertEqual(readback.guard.externalWriteRoutesEnabled, false, "readback guard must keep external write routes disabled");
  assertEqual(readback.guard.schedulerMutationEnabled, false, "readback guard must keep scheduler mutation disabled");
  assertEqual(readback.guard.secretReadRequired, false, "readback guard must not require secret reads");
  assertSideEffects(readback.sideEffectSummary, false, "readback");

  await assertStaleReadbackFixture();
  assertGenericSourcePipeline(first, fixture);
  await assertSourceCollectionLayer(first, fixture);
  assertVoiceoverScript(first, fixture);

  assertNoForbiddenSourcePatterns();
  assertVideoSourceRoutesReadOnly();
  assertVoiceoverLocalOnly();

  console.log("video_automation_safety_ok");
}

async function assertStaleReadbackFixture() {
  const staleFixture = buildFixtureRun("daily-video-stale-readback-fixture-test-only-2026-07-14");
  const preview = buildDailyBriefVideoPackagePreview(staleFixture, "2026-07-14T00:00:00.000Z");
  const packageSlug = preview.manifest.uploadPackage.packageSlug;
  const outputDirectory = path.join(videoOutputRoot, packageSlug);
  const staleHash = "0".repeat(64);

  assert(
    outputDirectory.startsWith(`${videoOutputRoot}${path.sep}`) && packageSlug.includes("stale-readback-fixture-test-only"),
    "stale fixture output directory must stay inside the dedicated video automation test path"
  );

  await fs.promises.rm(outputDirectory, { recursive: true, force: true });
  try {
    await fs.promises.mkdir(outputDirectory, { recursive: true });
    await fs.promises.writeFile(
      path.join(outputDirectory, "manifest.json"),
      JSON.stringify(
        {
          kind: "daily_brief_video_package",
          version: "VIDEO-1B",
          sourceSnapshot: {
            hash: staleHash
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const readback = await readDailyBriefVideoPackage(staleFixture);
    assertEqual(readback.currentSourceHash, preview.manifest.sourceSnapshot.hash, "stale fixture current hash should match preview");
    assertEqual(readback.savedSourceHash, staleHash, "stale fixture should read saved source hash from manifest");
    assertEqual(readback.stale, true, "stale fixture should report stale=true when saved and current hashes differ");
    assert(readback.exists, "stale fixture readback should see the saved manifest artifact");
    assertSideEffects(readback.sideEffectSummary, false, "stale fixture readback");
  } finally {
    await fs.promises.rm(outputDirectory, { recursive: true, force: true });
  }
}

function assertGenericSourcePipeline(videoPackage, fixture) {
  const dailyBundle = buildDailyBriefVideoSourceBundle(fixture);
  assertEqual(dailyBundle.sourceType, "daily_brief", "Daily Brief adapter should identify source type");
  assertEqual(dailyBundle.sourceSnapshot.hash, videoPackage.manifest.sourceSnapshot.hash, "Daily Brief adapter hash should match package hash");
  assert(dailyBundle.insights.length >= 4, "Daily Brief adapter should expose reusable insights");
  assert(dailyBundle.visualMaterials.length >= dailyBundle.insights.length, "Daily Brief adapter should expose reusable visual materials");
  assert(assertVideoSourceBundleSafe(dailyBundle), "Daily Brief source bundle should be safe to serialize");

  const dailyScaffold = buildGenericVideoPackageScaffold(dailyBundle);
  assertEqual(dailyScaffold.sourceHash, dailyBundle.sourceSnapshot.hash, "generic scaffold should preserve source hash");
  assertEqual(dailyScaffold.uploadEnabled, false, "generic scaffold must keep uploads disabled");
  assertEqual(dailyScaffold.platformUploadsEnabled, false, "generic scaffold must keep platform uploads disabled");

  const dailyScriptPlan = buildVideoScriptPlan(dailyBundle);
  assertEqual(dailyScriptPlan.sourceHash, dailyBundle.sourceSnapshot.hash, "generic script plan should preserve source hash");
  assertIncludes(dailyScriptPlan.fullScript, fixture.title, "generic script should include source title");
  assertIncludes(dailyScriptPlan.fullScript, "투자 조언이 아닙니다", "generic script should include source risk note");

  const contentBundle = buildContentItemVideoSourceBundle(buildFixtureContentItem(), [buildFixtureContentAsset()]);
  const serializedContentBundle = JSON.stringify(contentBundle);
  assertEqual(contentBundle.sourceType, "content_item", "content item adapter should identify source type");
  assertMatch(contentBundle.sourceSnapshot.hash, /^[a-f0-9]{64}$/, "content item source hash should be a SHA-256 hex string");
  assert(contentBundle.insights.length >= 3, "content item adapter should expose reusable insights");
  assert(contentBundle.visualMaterials.some((item) => item.kind === "thumbnail" || item.kind === "image"), "content item adapter should expose safe image material metadata");
  assert(!serializedContentBundle.includes("STORAGE_PATH_SHOULD_NOT_APPEAR"), "content item bundle must not expose asset storage paths");
  assert(!serializedContentBundle.includes("THUMBNAIL_PATH_SHOULD_NOT_APPEAR"), "content item bundle must not expose asset thumbnail paths");
  assert(!serializedContentBundle.includes("client_secret"), "content item bundle must redact secret markers from flexible source fields");
  assert(assertVideoSourceBundleSafe(contentBundle), "content item source bundle should be safe to serialize");

  const contentScaffold = buildGenericVideoPackageScaffold(contentBundle);
  assertEqual(contentScaffold.sourceHash, contentBundle.sourceSnapshot.hash, "content scaffold should preserve source hash");
  assertEqual(contentScaffold.uploadEnabled, false, "content scaffold must keep uploads disabled");
  assertEqual(contentScaffold.platformUploadsEnabled, false, "content scaffold must keep platform uploads disabled");
}

async function assertSourceCollectionLayer(videoPackage, fixture) {
  const collectedAt = "2026-07-14T02:00:00.000Z";
  const manualPreview = buildManualVideoSourcePreview(
    {
      title: "사용자 직접 입력 영상 소재",
      sourceText: "첫 번째 인사이트는 수집 방식이 여러 개여야 한다는 점입니다. 두 번째 인사이트는 모든 수집 결과가 같은 영상 소스 번들로 합쳐져야 한다는 점입니다.",
      referenceUrls: ["https://example.com/manual-source"],
      platformHint: "shortform"
    },
    collectedAt
  );
  const manualPreviewAgain = buildManualVideoSourcePreview(
    {
      title: "사용자 직접 입력 영상 소재",
      sourceText: "첫 번째 인사이트는 수집 방식이 여러 개여야 한다는 점입니다. 두 번째 인사이트는 모든 수집 결과가 같은 영상 소스 번들로 합쳐져야 한다는 점입니다.",
      referenceUrls: ["https://example.com/manual-source"],
      platformHint: "shortform"
    },
    collectedAt
  );
  assertSourcePreviewBoundary(manualPreview, "manual preview");
  assertEqual(manualPreview.sourceBundle.sourceType, "manual_collection", "manual source type should be reusable");
  assertEqual(manualPreview.sourceBundle.sourceSnapshot.hash, manualPreviewAgain.sourceBundle.sourceSnapshot.hash, "manual source hash should be deterministic for same source input");
  assertIncludes(manualPreview.scriptPlan.fullScript, "사용자 직접 입력 영상 소재", "manual script should include source title");
  await assertSourcePackageWrite(manualPreview, collectedAt);

  const contentPreview = buildContentItemVideoSourcePreview(buildFixtureContentItem(), [buildFixtureContentAsset()], collectedAt);
  assertSourcePreviewBoundary(contentPreview, "content item preview");
  assertEqual(contentPreview.collection.sideEffectSummary.dbRead, true, "content item preview should explicitly mark DB read boundary");
  assertEqual(contentPreview.sourceBundle.sourceType, "content_item", "content item source type should be reusable");
  assert(!JSON.stringify(contentPreview).includes("STORAGE_PATH_SHOULD_NOT_APPEAR"), "content preview must not expose storage paths");
  assert(!JSON.stringify(contentPreview).includes("client_secret"), "content preview must redact unsafe flexible values");

  const dailyPreview = buildDailyBriefVideoSourcePreview(fixture, collectedAt);
  assertSourcePreviewBoundary(dailyPreview, "Daily Brief source preview");
  assertEqual(dailyPreview.sourceBundle.sourceSnapshot.hash, videoPackage.manifest.sourceSnapshot.hash, "Daily Brief source preview should preserve package hash");

  const sitePreview = buildSiteRecipeVideoSourcePreview({
    recipe: {
      id: "fixture-site",
      name: "Fixture Site",
      allowedDomains: ["example.com"],
      sourceUrl: "https://example.com/report",
      titleSelector: "#video-title",
      summarySelector: "[data-video-source=\"summary\"]",
      evidenceSelectors: [".evidence"],
      visualSelectors: [".visual"],
      maxSnippetChars: 180,
      requireAttribution: true
    },
    html: [
      "<main>",
      "<h1 id=\"video-title\">사이트 Recipe 영상 소재</h1>",
      "<section data-video-source=\"summary\">요약 영역은 짧은 preview snippet으로만 저장합니다.</section>",
      "<article class=\"evidence\">첫 번째 근거는 selector fixture에서 추출됩니다.</article>",
      "<article class=\"evidence\">두 번째 근거도 원문 전체가 아니라 제한된 snippet입니다.</article>",
      "<img class=\"visual\" src=\"/chart.png\" alt=\"차트 후보\" width=\"1080\" height=\"720\" />",
      "</main>"
    ].join("")
  });
  assertSourcePreviewBoundary(sitePreview, "site recipe preview");
  assertEqual(sitePreview.sourceBundle.sourceType, "site_recipe", "site recipe source type should be reusable");
  assertEqual(sitePreview.collection.sideEffectSummary.networkRead, false, "site recipe fixture parser must not perform network read");
  assert(sitePreview.collection.evidenceCount >= 2, "site recipe should extract selector evidence");
  assert(sitePreview.collection.visualCandidateCount >= 1, "site recipe should extract visual candidates");

  const genericPreview = buildGenericUrlVideoSourcePreview({
    url: "https://example.com/article",
    title: "일반 URL 영상 소재",
    excerpt: "일반 URL은 아직 fetch 없이 사용자가 제공한 요약으로 preview만 생성합니다.",
    collectedAt
  });
  assertSourcePreviewBoundary(genericPreview, "generic URL preview");
  assertEqual(genericPreview.sourceBundle.sourceType, "generic_url", "generic URL source type should be reusable");
  assertEqual(genericPreview.collection.sideEffectSummary.networkRead, false, "generic URL preview must not fetch network content");
  assert(genericPreview.readiness.warnings.includes("generic_url_fetch_not_implemented_preview_only"), "generic URL preview should expose fetch-not-implemented warning");
}

async function assertSourcePackageWrite(sourcePreview, generatedAt) {
  const packagePreview = buildVideoSourcePackagePreview(sourcePreview, generatedAt);
  assertEqual(packagePreview.manifest.version, "VIDEO-5", "source package version should be VIDEO-5");
  assertEqual(packagePreview.manifest.sourceSnapshot.hash, sourcePreview.sourceBundle.sourceSnapshot.hash, "source package must preserve source hash");
  assertEqual(packagePreview.manifest.readiness.canUpload, false, "source package upload readiness must stay false");
  assertEqual(packagePreview.manifest.mp4.renderImplemented, false, "source package MP4 render must stay plan-only");
  assertEqual(packagePreview.manifest.uploadPackage.platformUploadsEnabled, false, "source package platform upload flag must stay false");
  assertEqual(packagePreview.manifest.sideEffectSummary.localFileWrite, false, "source package preview must not write files");
  assert(packagePreview.manifest.cards.some((card) => card.id === "closing-risk-note"), "source package should include closing risk note");
  assert(packagePreview.manifest.files.some((file) => file.kind === "script_txt"), "source package should include script file record");
  assert(packagePreview.manifest.subtitles.every((subtitle) => subtitle.text.length <= 56), "source package subtitles should be concise key points");
  assertEqual(packagePreview.manifest.textCardImagePlan.format, "svg", "source package text cards should be generated as image specs");
  assertEqual(packagePreview.manifest.textCardImagePlan.images.length, packagePreview.manifest.cards.length, "source package should create one text-card image per card");
  assert(packagePreview.manifest.files.some((file) => file.kind === "cover_svg"), "source package should include cover image record");
  assert(packagePreview.manifest.files.some((file) => file.kind === "card_svg"), "source package should include card image records");

  const written = await writeVideoSourcePackage(sourcePreview, generatedAt);
  assert(written.outputDirectory, "written source package should return output directory");
  assert(
    written.outputDirectory.startsWith(`${videoSourceOutputRoot}${path.sep}`),
    "written source package output directory must stay inside local-data video source path"
  );
  try {
    assertEqual(written.manifest.sideEffectSummary.localFileWrite, true, "written source package should mark localFileWrite=true");
    assertEqual(written.manifest.sideEffectSummary.externalServiceWrite, false, "written source package must not mark external writes");
    assertEqual(written.manifest.sideEffectSummary.llmCall, false, "written source package must not call LLM");
    assertEqual(written.manifest.sideEffectSummary.secretRead, false, "written source package must not read secrets");
    assert(written.files.some((file) => file.kind === "manifest_json" && file.bytes > 0), "written source package should include manifest bytes");
    assert(written.files.some((file) => file.kind === "storyboard_json" && file.bytes > 0), "written source package should include storyboard bytes");
    assert(written.files.some((file) => file.kind === "subtitles_srt" && file.bytes > 0), "written source package should include subtitles bytes");
    assert(written.files.some((file) => file.kind === "script_txt" && file.bytes > 0), "written source package should include script bytes");
    assert(written.files.some((file) => file.kind === "cover_svg" && file.bytes > 0), "written source package should include cover image bytes");
    assert(written.files.some((file) => file.kind === "card_svg" && file.bytes > 0), "written source package should include card image bytes");
    const serialized = JSON.stringify(written.manifest);
    assert(!serialized.includes("client_secret"), "written source package must not include client secret markers");
    assert(!serialized.includes("token.json"), "written source package must not include token markers");
  } finally {
    await fs.promises.rm(written.outputDirectory, { recursive: true, force: true });
  }
}

function assertSourcePreviewBoundary(preview, label) {
  assertEqual(preview.kind, "video_source_preview", `${label} kind mismatch`);
  assertEqual(preview.version, "VIDEO-4", `${label} version mismatch`);
  assert(preview.readiness.ready, `${label} should be ready`);
  assertMatch(preview.sourceBundle.sourceSnapshot.hash, /^[a-f0-9]{64}$/, `${label} source hash should be SHA-256`);
  assertEqual(preview.packageScaffold.uploadEnabled, false, `${label} uploadEnabled must stay false`);
  assertEqual(preview.packageScaffold.platformUploadsEnabled, false, `${label} platform uploads must stay false`);
  assertEqual(preview.collection.safetyPolicy.mode, "read_only_preview", `${label} safety mode mismatch`);
  assertEqual(preview.collection.safetyPolicy.storeFullBody, false, `${label} must not store full body`);
  assertEqual(preview.collection.safetyPolicy.externalWriteEnabled, false, `${label} external write must stay disabled`);
  assertEqual(preview.collection.safetyPolicy.secretReadEnabled, false, `${label} secret read must stay disabled`);
  assertEqual(preview.collection.safetyPolicy.llmCallEnabled, false, `${label} LLM call must stay disabled`);
  assertEqual(preview.collection.sideEffectSummary.sourceWrite, false, `${label} sourceWrite must stay false`);
  assertEqual(preview.collection.sideEffectSummary.dbWrite, false, `${label} dbWrite must stay false`);
  assertEqual(preview.collection.sideEffectSummary.localFileWrite, false, `${label} localFileWrite must stay false`);
  assertEqual(preview.collection.sideEffectSummary.externalServiceWrite, false, `${label} externalServiceWrite must stay false`);
  assertEqual(preview.collection.sideEffectSummary.secretRead, false, `${label} secretRead must stay false`);
  assertEqual(preview.collection.sideEffectSummary.llmCall, false, `${label} llmCall must stay false`);
  assertEqual(preview.collection.sideEffectSummary.schedulerMutation, false, `${label} schedulerMutation must stay false`);
}

function buildFixtureRun(id = "daily-video-fixture-2026-07-14") {
  const sideEffectSummary = {
    dbWrite: false,
    contentItemCreated: false,
    contentAssetCreated: false,
    upsignalRead: true,
    newsSearchRead: true,
    bloggerApiRead: false,
    bloggerApiWrite: false,
    bloggerDraftSave: false,
    bloggerPublish: false,
    scheduledPublish: false,
    tokenRefresh: false,
    llmCall: false,
    llmCallLogCreated: false
  };

  return {
    id,
    status: "content_generated",
    marketDate: "2026-07-14",
    title: "Daily Brief 영상 자동화 안전성 테스트",
    targetKeyword: "Daily Brief 영상 테스트",
    stockPickLimit: 3,
    stockDetailLimit: 2,
    etfPickLimit: 1,
    includeEtfs: true,
    krBoardUrl: "https://example.com/kr",
    etfBoardUrl: "https://example.com/etf",
    stockPicks: [
      {
        rank: 1,
        name: "테스트전자",
        code: "000001",
        market: "KOSPI",
        statusLabel: "관심",
        currentPrice: "10,000",
        entryPrice: "9,800",
        targetPrice: "11,000",
        stopLoss: "9,300",
        recentSignalDate: "2026-07-14",
        trendScore: "82",
        totalScore: "91",
        detailUrl: "https://example.com/stocks/000001",
        chartCaptureId: "capture-stock-000001"
      },
      {
        rank: 2,
        name: "테스트소재",
        code: "000002",
        market: "KOSDAQ",
        statusLabel: "관찰",
        currentPrice: "20,000",
        entryPrice: "19,400",
        targetPrice: "22,000",
        stopLoss: "18,700",
        recentSignalDate: "2026-07-14",
        trendScore: "75",
        totalScore: "86",
        detailUrl: "https://example.com/stocks/000002",
        chartCaptureId: "capture-stock-000002"
      }
    ],
    etfPicks: [
      {
        rank: 1,
        name: "테스트 ETF",
        code: "ETF001",
        category: "테마",
        statusLabel: "상승",
        currentPrice: "12,345",
        targetPotential: "5%",
        recentBuyDate: "2026-07-14",
        currentReturn: "2.1%",
        totalScore: "80"
      }
    ],
    futuresPicks: [],
    researchItems: [
      {
        symbolCode: "000001",
        symbolName: "테스트전자",
        query: "테스트전자",
        searchUrl: "https://example.com/search",
        title: "테스트전자 관련 뉴스",
        source: "search_link",
        sourceName: "Example",
        publishedAt: "2026-07-14T00:00:00.000Z",
        url: "https://example.com/news",
        shortSummary: "테스트용 안전 요약입니다."
      }
    ],
    officialDisclosureItems: [
      {
        symbolCode: "000001",
        symbolName: "테스트전자",
        title: "테스트 공시",
        source: "dart_openapi",
        sourceName: "DART 전자공시",
        publishedAt: "2026-07-14T00:00:00.000Z",
        url: "https://example.com/disclosure",
        receiptNo: "20260714000001",
        shortSummary: "테스트용 공시 요약입니다."
      }
    ],
    prewriteContextItems: [
      {
        kind: "writing_angle",
        symbolCode: "000001",
        symbolName: "테스트전자",
        title: "테스트 관점",
        summary: "영상 패키지 테스트용 문맥입니다.",
        sourceName: "fixture",
        url: "https://example.com/context",
        publishedAt: "2026-07-14T00:00:00.000Z",
        confidence: "high"
      }
    ],
    captures: [
      capture("capture-kr-board", "kr_board", "한국장 보드", "kr_signal_board", "kr-board.png"),
      capture("capture-stock-000001", "stock_chart", "테스트전자 차트", "stock_signal_chart", "000001-chart.png"),
      capture("capture-stock-000002", "stock_chart", "테스트소재 차트", "stock_signal_chart", "000002-chart.png"),
      capture("capture-etf-board", "etf_board", "ETF 보드", "etf_signal_board", "etf-board.png")
    ],
    contentItemId: "content-video-fixture",
    tistoryReviewContentItemId: null,
    tistoryReviewExportUrl: null,
    tistoryReviewMode: null,
    tistoryReviewOutputs: {},
    draftMarkdownLength: 1200,
    draftHtmlLength: 2400,
    visibleTextLength: 1100,
    warnings: [],
    sideEffectSummary,
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:10:00.000Z"
  };
}

function buildFixtureContentItem() {
  return {
    id: "content-video-source-fixture",
    blogId: "blog-fixture",
    brandProfileId: null,
    mode: "seo_keyword",
    status: "drafted",
    title: "블로그 글 기반 영상 자동화 소재",
    targetKeyword: "영상 자동화",
    sourceMemo: "블로그 글에서 핵심 인사이트를 뽑아 카드와 대본으로 재사용합니다.",
    planJson: {
      angle: "read-only video source",
      unsafeFlexibleValue: "client_secret_SHOULD_NOT_APPEAR"
    },
    draftMarkdown: "## 핵심 인사이트\n블로그 본문은 영상 대사의 공통 소재가 됩니다.\n## 카드 소재\n이미지와 본문 요약을 함께 씁니다.",
    draftHtml: "<article><h2>핵심 인사이트</h2><p>블로그 본문은 영상 대사의 공통 소재가 됩니다.</p><h2>카드 소재</h2><p>이미지와 본문 요약을 함께 씁니다.</p></article>",
    qualityScore: 87,
    scheduledAt: null,
    publishedAt: null,
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:20:00.000Z"
  };
}

function buildFixtureContentAsset() {
  return {
    id: "asset-video-source-fixture",
    contentItemId: "content-video-source-fixture",
    assetType: "image",
    fileName: "safe-card-source.png",
    originalName: "safe-card-source.png",
    mimeType: "image/png",
    fileSize: 67890,
    storagePath: "/tmp/STORAGE_PATH_SHOULD_NOT_APPEAR/safe-card-source.png",
    thumbnailPath: "/tmp/THUMBNAIL_PATH_SHOULD_NOT_APPEAR/safe-card-source.png",
    caption: "영상 카드 소재 이미지",
    altText: "카드뉴스용 시각 소재",
    userNote: "본문 첫 카드에 사용",
    placementHint: "intro",
    sortOrder: 1,
    isPrimary: true,
    createdAt: "2026-07-14T00:10:00.000Z",
    updatedAt: "2026-07-14T00:10:00.000Z"
  };
}

function capture(id, kind, label, target, fileName) {
  return {
    id,
    kind,
    label,
    sourceUrl: "https://example.com/capture",
    target,
    selectorUsed: ".fixture",
    storagePath: `/tmp/STORAGE_PATH_SHOULD_NOT_APPEAR/${fileName}`,
    fileName,
    mimeType: "image/png",
    fileSize: 12345,
    width: 1080,
    height: 1920,
    mode: "live_screenshot",
    warning: null,
    createdAt: "2026-07-14T00:00:00.000Z"
  };
}

function assertNoForbiddenSourcePatterns() {
  const files = listVideoAutomationSourceFiles();
  const forbidden = [
    { pattern: /@\/lib\/db|from\s+["']@prisma\/client["']|\bprisma\./, label: "database write/read imports" },
    { pattern: /process\.env/, label: "environment secret access" },
    { pattern: /(^|[^a-zA-Z0-9_])(?:\.env|token\.json|credentials\.json|client_secret|[^\s"'`]+\.pem\b|[^\s"'`]+\.key\b)/, label: "secret file references" },
    { pattern: /\bfetch\s*\(/, label: "network fetch" },
    { pattern: /youtubeUpload:\s*true|instagramUpload:\s*true|tiktokUpload:\s*true|externalServiceWrite:\s*true|schedulerMutationEnabled:\s*true|secretRead:\s*true/, label: "enabled external-write flags" }
  ];

  for (const file of files) {
    const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
    for (const item of forbidden) {
      assert(!item.pattern.test(source), `${file} must not contain ${item.label}`);
    }
  }
}

function assertVoiceoverScript(videoPackage, fixture) {
  const script = buildDailyBriefVoiceoverScript(fixture, {
    cardRender: {
      package: videoPackage
    },
    report: {
      validation: {
        ready: true
      }
    }
  });
  assertIncludes(script, fixture.title, "voiceover script should derive from Daily Brief title");
  assertIncludes(script, fixture.stockPicks[0].name, "voiceover script should include stock insight");
  assertIncludes(script, fixture.researchItems[0].shortSummary, "voiceover script should include research insight");
  assertIncludes(script, "투자 조언이 아닙니다", "voiceover script should include risk note");
  assert(!script.includes("STORAGE_PATH_SHOULD_NOT_APPEAR"), "voiceover script must not expose capture storagePath values");
  assert(!script.includes("client_secret"), "voiceover script must not include client secret markers");
  assert(!script.includes("token.json"), "voiceover script must not include token file markers");
}

function assertVoiceoverLocalOnly() {
  const forbidden = [
    { pattern: /\b(?:openai|elevenlabs|polly|azureSpeech|googleTts|speechSynthesis)\b/i, label: "external audio or narration provider" },
    { pattern: /https?:\/\/[^"']*(?:tts|speech|audio|voice|openai|elevenlabs|google|azure|aws)/i, label: "external audio provider URL" },
    { pattern: /subscriptionRequired:\s*true|externalProvider:\s*true|externalProviderCall:\s*true/, label: "enabled external audio provider flags" }
  ];

  for (const file of listVideoAutomationSourceFiles()) {
    const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
    for (const item of forbidden) {
      assert(!item.pattern.test(source), `${file} must not contain ${item.label}`);
    }
  }
}

function assertVideoSourceRoutesReadOnly() {
  const forbidden = [
    { pattern: /\bfetch\s*\(/, label: "network fetch" },
    { pattern: /\b(?:writeFile|appendFile|mkdir|rm|unlink|rmdir)\s*\(/, label: "local file write" },
    { pattern: /\b(?:create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/, label: "database mutation" },
    { pattern: /process\.env/, label: "environment secret access" },
    { pattern: /(^|[^a-zA-Z0-9_])(?:\.env|token\.json|credentials\.json|client_secret|[^\s"'`]+\.pem\b|[^\s"'`]+\.key\b)/, label: "secret file references" },
    { pattern: /youtubeUpload:\s*true|instagramUpload:\s*true|tiktokUpload:\s*true|externalServiceWrite:\s*true|secretRead:\s*true/, label: "enabled external-write flags" }
  ];

  for (const file of listFiles("src/app/api/video-sources").filter((item) => item.endsWith(".ts"))) {
    const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
    for (const item of forbidden) {
      assert(!item.pattern.test(source), `${file} must not contain ${item.label}`);
    }
  }
}

function listVideoAutomationSourceFiles() {
  return [
    ...listFiles("src/lib/video-automation").filter((file) => file.endsWith(".ts")),
    ...listFiles("src/app/api/daily-brief/runs/[runId]/video-package").filter((file) => file.endsWith(".ts"))
  ];
}

function listFiles(relativeDirectory) {
  const directory = path.join(projectRoot, relativeDirectory);
  if (!fs.existsSync(directory)) {
    return [];
  }
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    return entry.isDirectory() ? listFiles(relativePath) : [relativePath];
  });
}

function assertSideEffects(summary, expectedLocalFileWrite, label) {
  assertEqual(summary.dailyBriefRunRead, true, `${label} should read Daily Brief source`);
  assertEqual(summary.localFileWrite, expectedLocalFileWrite, `${label} localFileWrite mismatch`);
  for (const key of forbiddenFalseKeys) {
    assertEqual(summary[key], false, `${label} must keep ${key}=false`);
  }
}

function assertCheck(checks, code, status) {
  const check = checks.find((item) => item.code === code);
  assert(check, `missing validation check ${code}`);
  assertEqual(check.status, status, `validation check ${code} status mismatch`);
}

function assertIncludes(value, needle, message) {
  assert(value.includes(needle), message);
}

function assertMatch(value, regex, message) {
  assert(regex.test(value), message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNotEqual(actual, expected, message) {
  if (actual === expected) {
    throw new Error(`${message}: both were ${JSON.stringify(actual)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
