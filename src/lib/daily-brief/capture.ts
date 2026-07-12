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
  deviceScaleFactor: number;
  fullPage: boolean;
  settleMs: number;
}

const HIGH_RES_CAPTURE_DEVICE_SCALE_FACTOR = 2;

function buildCaptureProfile(target: DailyBriefCaptureTarget): CaptureProfile {
  if (target === "stock_signal_chart") {
    return {
      selectorCandidates: [
        "section:has-text('진입가'):has-text('목표가'):has-text('손절선')",
        ".card:has-text('진입가'):has-text('목표가'):has-text('손절선')",
        ".container"
      ],
      viewport: { width: 1440, height: 1120 },
      deviceScaleFactor: HIGH_RES_CAPTURE_DEVICE_SCALE_FACTOR,
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
      deviceScaleFactor: HIGH_RES_CAPTURE_DEVICE_SCALE_FACTOR,
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
    deviceScaleFactor: HIGH_RES_CAPTURE_DEVICE_SCALE_FACTOR,
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
    const page = await (browser as BrowserLike).newPage({ viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissBlockingOverlays(page);
    await page.waitForTimeout(profile.settleMs);
    await dismissBlockingOverlays(page);

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
        width: Math.round(box.width * profile.deviceScaleFactor),
        height: Math.round(box.height * profile.deviceScaleFactor),
        warning: null
      };
    }

    const screenshot = await page.screenshot({ type: "png", fullPage: profile.fullPage });
    return {
      bytes: Buffer.from(screenshot),
      selectorUsed: "viewport_fallback",
      width: profile.viewport.width * profile.deviceScaleFactor,
      height: profile.viewport.height * profile.deviceScaleFactor,
      warning: null
    };
  } finally {
    await (browser as BrowserLike).close();
  }
}

async function dismissBlockingOverlays(page: PageLike) {
  await page.keyboard?.press("Escape").catch(() => undefined);

  for (const selector of closeButtonSelectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count().catch(() => 0);
    if (count === 0) {
      continue;
    }
    await locator.click({ timeout: 1200 }).catch(() => undefined);
    await page.waitForTimeout(150).catch(() => undefined);
  }

  await page
    .evaluate(() => {
      const closeTextPattern = /닫기|오늘\s*하루|다시\s*보지|확인|close|dismiss|not\s*again/i;
      const clickableNodes = Array.from(document.querySelectorAll("button,a,[role='button']")) as HTMLElement[];
      for (const node of clickableNodes) {
        const text = `${node.innerText || ""} ${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""}`.trim();
        const box = node.getBoundingClientRect();
        if (!text || box.width === 0 || box.height === 0) {
          continue;
        }
        if (closeTextPattern.test(text)) {
          node.click();
        }
      }

      const overlaySelectors = [
        "[role='dialog']",
        "[aria-modal='true']",
        ".modal",
        ".popup",
        ".popover",
        ".toast",
        ".dialog",
        ".fixed.inset-0"
      ];
      for (const selector of overlaySelectors) {
        for (const node of Array.from(document.querySelectorAll(selector)) as HTMLElement[]) {
          const style = window.getComputedStyle(node);
          const box = node.getBoundingClientRect();
          const coversViewport = box.width > window.innerWidth * 0.35 && box.height > window.innerHeight * 0.2;
          const isOverlay = style.position === "fixed" || style.position === "sticky" || node.getAttribute("role") === "dialog";
          if (isOverlay && coversViewport) {
            node.style.display = "none";
          }
        }
      }

      for (const node of Array.from(document.body.querySelectorAll("*")) as HTMLElement[]) {
        const style = window.getComputedStyle(node);
        if (style.position !== "fixed") {
          continue;
        }
        const box = node.getBoundingClientRect();
        const zIndex = Number.parseInt(style.zIndex || "0", 10);
        const nearViewportEdge = box.right > window.innerWidth - 96 || box.bottom > window.innerHeight - 96;
        const smallFloatingWidget = box.width <= 180 && box.height <= 180;
        if (Number.isFinite(zIndex) && zIndex >= 10 && nearViewportEdge && smallFloatingWidget) {
          node.style.display = "none";
        }
      }
    })
    .catch(() => undefined);
}

const closeButtonSelectors = [
  "button:has-text('닫기')",
  "button:has-text('오늘 하루 보지 않기')",
  "button:has-text('다시 보지 않기')",
  "button:has-text('확인')",
  "a:has-text('닫기')",
  "[role='button']:has-text('닫기')",
  "[aria-label='닫기']",
  "[aria-label='Close']",
  "[title='닫기']",
  "[title='Close']",
  ".modal button:has-text('×')",
  ".popup button:has-text('×')",
  "button:has-text('×')",
  "button:has-text('Close')",
  "button:has-text('Dismiss')"
];

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
  keyboard?: {
    press(key: string): Promise<void>;
  };
  evaluate<T>(callback: () => T): Promise<T>;
  screenshot(options: { type: "png"; fullPage: boolean }): Promise<Buffer | Uint8Array>;
}

interface LocatorLike {
  first(): LocatorLike;
  count(): Promise<number>;
  click(options: { timeout: number }): Promise<void>;
  boundingBox(): Promise<{ width: number; height: number } | null>;
  screenshot(options: { type: "png" }): Promise<Buffer | Uint8Array>;
}
