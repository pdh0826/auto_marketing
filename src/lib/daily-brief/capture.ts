import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { DailyBriefCapture, DailyBriefCaptureMode } from "./types";

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
}) {
  const relativeDir = path.join("local-data", "daily-brief-captures", input.marketDate, input.runId);
  const absoluteDir = path.resolve(process.cwd(), relativeDir);
  const storagePath = path.join(relativeDir, input.fileName);
  const absolutePath = path.resolve(process.cwd(), storagePath);
  let bytes: Uint8Array = transparentPng;
  let mode: DailyBriefCaptureMode = "placeholder";
  let warning: string | null = "playwright_capture_runtime_not_configured_placeholder_used";

  await mkdir(absoluteDir, { recursive: true });

  const liveCapture = await tryPlaywrightScreenshot(input.sourceUrl).catch((error) => ({
    bytes: null,
    warning: error instanceof Error ? error.message : "playwright_capture_failed"
  }));
  if (liveCapture.bytes) {
    bytes = liveCapture.bytes;
    mode = "live_screenshot";
    warning = null;
  } else if (liveCapture.warning) {
    warning = liveCapture.warning;
  }

  await writeFile(absolutePath, bytes);

  return {
    id: `${input.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    label: input.label,
    sourceUrl: input.sourceUrl,
    storagePath,
    fileName: input.fileName,
    mimeType: "image/png",
    fileSize: bytes.byteLength,
    mode,
    warning,
    createdAt: new Date().toISOString()
  } satisfies DailyBriefCapture;
}

async function tryPlaywrightScreenshot(url: string): Promise<{ bytes: Buffer | null; warning: string | null }> {
  const importer = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  let playwrightModule: unknown;
  try {
    playwrightModule = await importer("playwright");
  } catch {
    return { bytes: null, warning: "playwright_not_installed_placeholder_used" };
  }

  const chromium = (playwrightModule as { chromium?: { launch: (options: { headless: boolean }) => Promise<unknown> } }).chromium;
  if (!chromium) {
    return { bytes: null, warning: "playwright_chromium_not_available_placeholder_used" };
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (browser as BrowserLike).newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    return { bytes: Buffer.from(screenshot), warning: null };
  } finally {
    await (browser as BrowserLike).close();
  }
}

interface BrowserLike {
  newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PageLike>;
  close(): Promise<void>;
}

interface PageLike {
  goto(url: string, options: { waitUntil: string; timeout: number }): Promise<void>;
  screenshot(options: { type: "png"; fullPage: boolean }): Promise<Buffer | Uint8Array>;
}
