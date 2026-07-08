import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { DailyBriefCapture, DailyBriefCaptureMode, DailyBriefCaptureTarget } from "./types";

const transparentPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAlgAAAEgCAIAAADq5GzlAAAACXBIWXMAAAsTAAALEwEAmpwYAAAGxklEQVR4nO3UwQkAIBDAwN7/0k3YQQSQQnS9mQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwGgABGQABwX+YJwAAAABJRU5ErkJggg==",
  "base64"
);

export async function createDailyBriefCapture(input: {
  runId: string;
  marketDate: string;
  kind: DailyBriefCapture["kind"];
  label: string;
  sourceUrl: string;
  fileName: string;
  target: DailyBriefCaptureTarget;
}) {
  const relativeDir = path.join("local-data", "daily-brief-captures", input.marketDate, input.runId);
  const absoluteDir = path.resolve(process.cwd(), relativeDir);
  const storagePath = path.join(relativeDir, input.fileName);
  const absolutePath = path.resolve(process.cwd(), storagePath);
  let bytes: Uint8Array = transparentPng;
  let mode: DailyBriefCaptureMode = "placeholder";
  let warning: string | null = "playwright_capture_runtime_not_configured_placeholder_used";
  let selectorUsed: string | null = null;
  let width: number | null = null;
  let height: number | null = null;

  await mkdir(absoluteDir, { recursive: true });

  const liveCapture = await tryPlaywrightScreenshot(input.sourceUrl, buildCaptureProfile(input.target)).catch((error) => ({
    bytes: null,
    selectorUsed: null,
    width: null,
    height: null,
    warning: error instanceof Error ? error.message : "playwright_capture_failed"
  }));
  if (liveCapture.bytes) {
    bytes = liveCapture.bytes;
    mode = "live_screenshot";
    warning = null;
    selectorUsed = liveCapture.selectorUsed;
    width = liveCapture.width;
    height = liveCapture.height;
  } else if (liveCapture.warning) {
    warning = liveCapture.warning;
  }

  await writeFile(absolutePath, bytes);

  return {
    id: `${input.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    label: input.label,
    sourceUrl: input.sourceUrl,
    target: input.target,
    selectorUsed,
    storagePath,
    fileName: input.fileName,
    mimeType: "image/png",
    fileSize: bytes.byteLength,
    width,
    height,
    mode,
    warning,
    createdAt: new Date().toISOString()
  } satisfies DailyBriefCapture;
}

interface CaptureProfile {
  selectorCandidates: string[];
  viewport: { width: number; height: number };
  fullPage: boolean;
  settleMs: number;
}

function buildCaptureProfile(target: DailyBriefCaptureTarget): CaptureProfile {
  if (target === "stock_signal_chart") {
    return {
      selectorCandidates: [
        "section:has-text('진입가'):has-text('목표가'):has-text('손절선')",
        ".card:has-text('진입가'):has-text('목표가'):has-text('손절선')",
        ".container"
      ],
      viewport: { width: 1440, height: 1120 },
      fullPage: false,
      settleMs: 1800
    };
  }

  if (target === "etf_signal_board") {
    return {
      selectorCandidates: [
        "section.card:has-text('ETF 시그널 보드')",
        "section:has-text('ETF 시그널 보드')",
        ".compact-list:has-text('점수')",
        ".container"
      ],
      viewport: { width: 1280, height: 980 },
      fullPage: false,
      settleMs: 1400
    };
  }

  return {
    selectorCandidates: [
      "section:has-text('한국장 시그널 보드')",
      ".board-disclosure:has-text('한국장')",
      ".compact-list:has-text('종합점수')",
      ".container"
    ],
    viewport: { width: 1440, height: 1100 },
    fullPage: false,
    settleMs: 1400
  };
}

async function tryPlaywrightScreenshot(
  url: string,
  profile: CaptureProfile
): Promise<{ bytes: Buffer | null; selectorUsed: string | null; width: number | null; height: number | null; warning: string | null }> {
  const importer = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  let playwrightModule: unknown;
  try {
    playwrightModule = await importer("playwright");
  } catch {
    return { bytes: null, selectorUsed: null, width: null, height: null, warning: "playwright_not_installed_placeholder_used" };
  }

  const chromium = (playwrightModule as { chromium?: ChromiumLike }).chromium;
  if (!chromium) {
    return { bytes: null, selectorUsed: null, width: null, height: null, warning: "playwright_chromium_not_available_placeholder_used" };
  }

  const browser = await launchChromium(chromium);
  try {
    const page = await (browser as BrowserLike).newPage({ viewport: profile.viewport, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(profile.settleMs);

    for (const selector of profile.selectorCandidates) {
      const locator = page.locator(selector).first();
      const count = await locator.count().catch(() => 0);
      if (count === 0) {
        continue;
      }
      const box = await locator.boundingBox().catch(() => null);
      if (!box || box.width < 320 || box.height < 180) {
        continue;
      }
      const screenshot = await locator.screenshot({ type: "png" });
      return {
        bytes: Buffer.from(screenshot),
        selectorUsed: selector,
        width: Math.round(box.width),
        height: Math.round(box.height),
        warning: null
      };
    }

    const screenshot = await page.screenshot({ type: "png", fullPage: profile.fullPage });
    return {
      bytes: Buffer.from(screenshot),
      selectorUsed: "viewport_fallback",
      width: profile.viewport.width,
      height: profile.viewport.height,
      warning: null
    };
  } finally {
    await (browser as BrowserLike).close();
  }
}

async function launchChromium(chromium: ChromiumLike) {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return chromium.launch({ headless: true, channel: "chrome" });
  }
}

interface ChromiumLike {
  launch(options: { headless: boolean; channel?: string }): Promise<unknown>;
}

interface BrowserLike {
  newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<void>;
  waitForTimeout(ms: number): Promise<void>;
  locator(selector: string): LocatorLike;
  screenshot(options: { type: "png"; fullPage: boolean }): Promise<Buffer | Uint8Array>;
}

interface LocatorLike {
  first(): LocatorLike;
  count(): Promise<number>;
  boundingBox(): Promise<{ width: number; height: number } | null>;
  screenshot(options: { type: "png" }): Promise<Buffer | Uint8Array>;
}
