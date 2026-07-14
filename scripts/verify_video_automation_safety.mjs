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

const videoOutputRoot = path.join(projectRoot, "local-data", "video-automation", "daily-brief");

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

  assertNoForbiddenSourcePatterns();
  assertAudioStillDesignOnly();

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

function assertAudioStillDesignOnly() {
  const forbidden = [
    { pattern: /audioIncluded:\s*true/, label: "enabled MP4 audio" },
    { pattern: /\bvoiceover\b/i, label: "voiceover implementation" },
    { pattern: /\btts\b/i, label: "TTS implementation" },
    { pattern: /text[-_\s]?to[-_\s]?speech/i, label: "text-to-speech implementation" },
    { pattern: /\.(?:wav|mp3)\b/i, label: "audio artifact file writes" },
    { pattern: /\b(?:openai|elevenlabs|polly|azureSpeech|googleTts|speechSynthesis)\b/i, label: "external audio or narration provider" }
  ];

  for (const file of listVideoAutomationSourceFiles()) {
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
