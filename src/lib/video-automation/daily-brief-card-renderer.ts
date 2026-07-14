import { mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import type { DailyBriefRun } from "@/lib/daily-brief/types";
import { writeDailyBriefVideoPackage } from "./daily-brief-package";
import type {
  DailyBriefVideoCardRenderImage,
  DailyBriefVideoCardRenderReport,
  DailyBriefVideoCardRenderResult,
  DailyBriefVideoPackageFile,
  DailyBriefVideoSideEffectSummary
} from "./types";

const VIEWPORT = { width: 1080, height: 1920 };
const DEVICE_SCALE_FACTOR = 1;

export async function renderDailyBriefVideoCards(run: DailyBriefRun, generatedAt = new Date().toISOString()): Promise<DailyBriefVideoCardRenderResult> {
  const videoPackage = await writeDailyBriefVideoPackage(run, generatedAt);
  if (!videoPackage.outputDirectory) {
    throw new Error("daily_brief_video_package_output_required");
  }

  const baseReport = buildBaseReport({
    generatedAt,
    sourceHash: videoPackage.manifest.sourceSnapshot.hash,
    sourceHashPrefix: videoPackage.manifest.sourceSnapshot.hashPrefix,
    packageManifestVersion: videoPackage.manifest.version,
    expectedCardCount: videoPackage.manifest.cards.length
  });

  if (!videoPackage.manifest.validation.ready) {
    const report = {
      ...baseReport,
      status: "blocked" as const,
      validation: {
        ...baseReport.validation,
        ready: false,
        errors: [...videoPackage.manifest.validation.errors],
        warnings: [...videoPackage.manifest.validation.warnings]
      }
    };
    return await writeRenderReport(videoPackage, report);
  }

  const renderDirectory = path.join(videoPackage.outputDirectory, "cards");
  await mkdir(renderDirectory, { recursive: true });

  const playwright = await loadPlaywright();
  if (!playwright.chromium) {
    const report = {
      ...baseReport,
      status: "failed" as const,
      validation: {
        ...baseReport.validation,
        ready: false,
        errors: ["playwright_chromium_not_available"],
        warnings: []
      }
    };
    return await writeRenderReport(videoPackage, report);
  }

  const images: DailyBriefVideoCardRenderImage[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let browser: BrowserLike;
  try {
    browser = await launchChromium(playwright.chromium);
  } catch {
    const report = {
      ...baseReport,
      status: "failed" as const,
      validation: {
        ...baseReport.validation,
        ready: false,
        errors: ["playwright_chromium_launch_failed"],
        warnings: []
      }
    };
    return await writeRenderReport(videoPackage, report);
  }
  try {
    try {
      const coverPage = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR });
      await coverPage.setContent(renderCoverImageHtml(videoPackage.manifest.cover, videoPackage.manifest.sourceSnapshot.hashPrefix), {
        waitUntil: "networkidle",
        timeout: 30_000
      });
      await coverPage.waitForTimeout(200);
      const coverResult = await renderSingleElement({
        page: coverPage,
        selector: ".video-cover",
        filePath: path.join(renderDirectory, "cover.png"),
        kind: "cover_png",
        cardId: "cover",
        expectedWidth: VIEWPORT.width,
        expectedHeight: VIEWPORT.height
      });
      images.push(coverResult.image);
      warnings.push(...coverResult.warnings);
      errors.push(...coverResult.errors);
      await coverPage.close();

      for (let index = 0; index < videoPackage.manifest.cards.length; index += 1) {
        const card = videoPackage.manifest.cards[index];
        const cardsPage = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR });
        await cardsPage.setContent(renderSingleCardHtml(card, index + 1, videoPackage.manifest.sourceSnapshot.hashPrefix), {
          waitUntil: "networkidle",
          timeout: 30_000
        });
        await cardsPage.waitForTimeout(200);
        const fileName = `card-${String(index + 1).padStart(3, "0")}-${sanitizeFileSegment(card.id)}.png`;
        const result = await renderLocator({
          page: cardsPage,
          selector: ".video-card",
          nth: 0,
          filePath: path.join(renderDirectory, fileName),
          kind: "card_png",
          cardId: card.id,
          selectorUsed: ".video-card"
        });
        images.push(result.image);
        warnings.push(...result.warnings);
        errors.push(...result.errors);
        await cardsPage.close();
      }
    } catch {
      errors.push("playwright_card_render_failed");
    }
  } finally {
    await browser.close();
  }

  const renderedFiles = images.map((image) => imageToFileRecord(image));
  const report: DailyBriefVideoCardRenderReport = {
    ...baseReport,
    status: errors.length ? "failed" : "rendered",
    validation: {
      ready: errors.length === 0,
      errors,
      warnings,
      renderedImageCount: images.length,
      expectedCardCount: videoPackage.manifest.cards.length
    },
    images,
    files: renderedFiles
  };

  return writeRenderReport(videoPackage, report);
}

async function renderSingleElement(input: {
  page: PageLike;
  selector: string;
  filePath: string;
  kind: DailyBriefVideoCardRenderImage["kind"];
  cardId: string;
  expectedWidth: number;
  expectedHeight: number;
}) {
  const result = await renderLocator({
    page: input.page,
    selector: input.selector,
    nth: 0,
    filePath: input.filePath,
    kind: input.kind,
    cardId: input.cardId,
    selectorUsed: input.selector
  });
  const dimensionWarning =
    result.image.width < input.expectedWidth * 0.75 || result.image.height < input.expectedHeight * 0.75 ? [`${input.cardId}_render_dimensions_smaller_than_expected`] : [];
  return {
    ...result,
    warnings: [...result.warnings, ...dimensionWarning]
  };
}

async function renderLocator(input: {
  page: PageLike;
  selector: string;
  nth: number;
  filePath: string;
  kind: DailyBriefVideoCardRenderImage["kind"];
  cardId: string;
  selectorUsed: string;
}) {
  const warnings: string[] = [];
  const errors: string[] = [];
  const locator = input.page.locator(input.selector).nth(input.nth);
  const count = await locator.count().catch(() => 0);
  if (count === 0) {
    throw new Error(`video_card_render_selector_missing:${input.selector}:${input.nth}`);
  }
  const box = await locator.boundingBox();
  if (!box || box.width < 240 || box.height < 360) {
    errors.push(`${input.cardId}_render_box_too_small`);
  }
  const overflow = await input.page.evaluate(
    ({ selector, nth }) => {
      const element = Array.from(document.querySelectorAll(selector))[nth] as HTMLElement | undefined;
      if (!element) {
        return { hasOverflow: true, overflowingCount: 1 };
      }
      const descendants = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];
      const overflowing = descendants.filter((node) => node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2);
      return { hasOverflow: overflowing.length > 0, overflowingCount: overflowing.length };
    },
    { selector: input.selector, nth: input.nth }
  );
  if (overflow.hasOverflow) {
    warnings.push(`${input.cardId}_text_or_layout_overflow:${overflow.overflowingCount}`);
  }
  const screenshot = await locator.screenshot({ type: "png" });
  await writeFile(input.filePath, Buffer.from(screenshot));
  const fileStat = await stat(input.filePath);
  if (fileStat.size < 5000) {
    errors.push(`${input.cardId}_png_too_small`);
  }
  return {
    image: {
      kind: input.kind,
      cardId: input.cardId,
      fileName: path.basename(input.filePath),
      relativePath: path.relative(process.cwd(), input.filePath),
      width: Math.round(box?.width ?? 0),
      height: Math.round(box?.height ?? 0),
      bytes: fileStat.size,
      selectorUsed: input.selectorUsed,
      warning: warnings.length ? warnings.join(",") : null
    },
    warnings,
    errors
  };
}

async function writeRenderReport(
  videoPackage: Awaited<ReturnType<typeof writeDailyBriefVideoPackage>>,
  report: DailyBriefVideoCardRenderReport
): Promise<DailyBriefVideoCardRenderResult> {
  if (!videoPackage.outputDirectory) {
    throw new Error("daily_brief_video_package_output_required");
  }
  const reportPath = path.join(videoPackage.outputDirectory, "card-render-report.json");
  const reportContent = JSON.stringify(report, null, 2);
  await writeFile(reportPath, reportContent, "utf8");
  const reportFile: DailyBriefVideoPackageFile = {
    kind: "card_render_report_json",
    fileName: "card-render-report.json",
    relativePath: path.relative(process.cwd(), reportPath),
    mimeType: "application/json",
    bytes: Buffer.byteLength(reportContent, "utf8")
  };
  const files = [...videoPackage.files, ...report.files, reportFile];
  const nextReport = {
    ...report,
    files: [...report.files, reportFile]
  };
  return {
    package: videoPackage,
    report: nextReport,
    outputDirectory: videoPackage.outputDirectory,
    files
  };
}

function buildBaseReport(input: {
  generatedAt: string;
  sourceHash: string;
  sourceHashPrefix: string;
  packageManifestVersion: "VIDEO-1B";
  expectedCardCount: number;
}): DailyBriefVideoCardRenderReport {
  return {
    kind: "daily_brief_video_card_render_report",
    version: "VIDEO-1C",
    generatedAt: input.generatedAt,
    sourceHash: input.sourceHash,
    sourceHashPrefix: input.sourceHashPrefix,
    packageManifestVersion: input.packageManifestVersion,
    status: "blocked",
    renderer: {
      name: "playwright",
      viewport: "1080x1920",
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      pngRenderImplemented: true,
      mp4RenderImplemented: false
    },
    validation: {
      ready: false,
      errors: [],
      warnings: [],
      renderedImageCount: 0,
      expectedCardCount: input.expectedCardCount
    },
    images: [],
    files: [],
    sideEffectSummary: buildRenderSideEffects()
  };
}

function imageToFileRecord(image: DailyBriefVideoCardRenderImage): DailyBriefVideoPackageFile {
  return {
    kind: image.kind,
    fileName: image.fileName,
    relativePath: image.relativePath,
    mimeType: "image/png",
    bytes: image.bytes
  };
}

function renderCoverImageHtml(
  cover: { title: string; subtitle: string; marketDate: string; highlightLabels: string[] },
  sourceHashPrefix: string
) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .video-cover { width: 1080px; height: 1920px; display: flex; flex-direction: column; justify-content: space-between; padding: 126px 92px 104px; background: linear-gradient(160deg, #0f172a 0%, #155e75 52%, #f97316 100%); }
    .eyebrow { font-size: 34px; line-height: 1.2; opacity: 0.82; }
    h1 { margin: 70px 0 0; font-size: 96px; line-height: 1.06; letter-spacing: 0; }
    .subtitle { margin-top: 42px; font-size: 44px; line-height: 1.32; }
    .chips { display: flex; flex-wrap: wrap; gap: 18px; }
    .chip { border: 2px solid rgba(248, 250, 252, 0.48); border-radius: 999px; padding: 18px 24px; background: rgba(15, 23, 42, 0.25); font-size: 34px; font-weight: 750; }
  </style>
</head>
<body>
  <section class="video-cover">
    <div>
      <div class="eyebrow">${escapeHtml(cover.marketDate)} Daily Brief · ${escapeHtml(sourceHashPrefix)}</div>
      <h1>${escapeHtml(cover.title)}</h1>
      <div class="subtitle">${escapeHtml(cover.subtitle)}</div>
    </div>
    <div class="chips">
      ${cover.highlightLabels.map((label) => `<span class="chip">${escapeHtml(label)}</span>`).join("")}
    </div>
  </section>
</body>
</html>`;
}

function renderSingleCardHtml(card: { id: string; title: string; bodyLines: string[]; visualHint: string }, index: number, sourceHashPrefix: string) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #0f172a; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .video-card { width: 1080px; height: 1920px; display: flex; flex-direction: column; justify-content: space-between; padding: 118px 92px 96px; background: linear-gradient(160deg, #0f172a 0%, #155e75 48%, #f97316 100%); }
    .eyebrow { font-size: 34px; line-height: 1.2; opacity: 0.84; }
    h1 { margin: 52px 0 0; font-size: 92px; line-height: 1.08; letter-spacing: 0; }
    p { margin: 32px 0 0; font-size: 46px; line-height: 1.34; letter-spacing: 0; }
    .hint { max-width: 840px; border-top: 2px solid rgba(248, 250, 252, 0.34); padding-top: 34px; font-size: 32px; line-height: 1.35; opacity: 0.82; }
  </style>
</head>
<body>
  <article class="video-card">
    <div>
      <div class="eyebrow">Daily Brief · ${index} · ${escapeHtml(sourceHashPrefix)}</div>
      <h1>${escapeHtml(card.title)}</h1>
      ${card.bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
    </div>
    <div class="hint">${escapeHtml(card.visualHint)}</div>
  </article>
</body>
</html>`;
}

function buildRenderSideEffects(): DailyBriefVideoSideEffectSummary {
  return {
    dailyBriefRunRead: true,
    dailyBriefRunWrite: false,
    existingContentItemMutation: false,
    dbWrite: false,
    localFileWrite: true,
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

async function loadPlaywright(): Promise<{ chromium?: ChromiumLike }> {
  const importer = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  try {
    return (await importer("playwright")) as { chromium?: ChromiumLike };
  } catch {
    return {};
  }
}

async function launchChromium(chromium: ChromiumLike) {
  try {
    return await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    return chromium.launch({ headless: true });
  }
}

function sanitizeFileSegment(value: string) {
  const segment = value.replace(/[^a-zA-Z0-9_.-]/g, "-").replace(/-+/g, "-").slice(0, 48);
  return segment && segment !== "." && segment !== ".." ? segment : "card";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ChromiumLike {
  launch(options: { headless: boolean; channel?: string }): Promise<BrowserLike>;
}

interface BrowserLike {
  newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<void>;
  setContent(html: string, options: { waitUntil: string; timeout: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  locator(selector: string): LocatorCollectionLike;
  evaluate<T, TArg = undefined>(callback: (arg: TArg) => T, arg?: TArg): Promise<T>;
  close(): Promise<void>;
}

interface LocatorCollectionLike {
  count(): Promise<number>;
  nth(index: number): LocatorLike;
}

interface LocatorLike {
  count(): Promise<number>;
  boundingBox(): Promise<{ width: number; height: number } | null>;
  screenshot(options: { type: "png" }): Promise<Buffer | Uint8Array>;
}
