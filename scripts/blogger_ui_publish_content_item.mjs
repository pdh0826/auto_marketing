#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LIVE_CONFIRMATION = "I_UNDERSTAND_THIS_USES_BLOGGER_WEB_UI_TO_PUBLISH";

function parseArgs(argv) {
  const args = {
    contentItemId: "",
    dryRun: false,
    openBrowser: false,
    liveUi: false,
    publish: false,
    headless: false,
    confirm: "",
    editorUrl: "",
    keepOpenMs: 10 * 60 * 1000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--content-item-id") {
      args.contentItemId = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--open-browser") {
      args.openBrowser = true;
    } else if (arg === "--live-ui") {
      args.liveUi = true;
    } else if (arg === "--publish") {
      args.publish = true;
    } else if (arg === "--headless") {
      args.headless = true;
    } else if (arg === "--confirm") {
      args.confirm = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--editor-url") {
      args.editorUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--keep-open-ms") {
      args.keepOpenMs = Number(argv[index + 1] ?? args.keepOpenMs);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.contentItemId) {
    throw new Error("--content-item-id is required.");
  }

  if (args.liveUi && args.confirm !== LIVE_CONFIRMATION) {
    throw new Error(`--live-ui requires --confirm ${LIVE_CONFIRMATION}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/blogger_ui_publish_content_item.mjs --content-item-id <id> --dry-run
  node scripts/blogger_ui_publish_content_item.mjs --content-item-id <id> --open-browser

Modes:
  --dry-run       Export post HTML/assets/manifest only. No Blogger write.
  --open-browser  Open a persistent Playwright browser on Blogger for manual calibration.
  --live-ui       Open Blogger editor and attempt guarded UI insertion.
  --publish       With --live-ui, click Blogger publish controls after insertion.

Safety:
  This script never reads secrets directly, never refreshes tokens, and never calls Blogger API.
  --live-ui requires an explicit confirmation phrase. --publish is a Blogger external write.`);
}

function safeFileName(value) {
  return String(value || "asset")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140) || "asset";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceAssetReferences(html, assetExports) {
  let result = html;
  for (const asset of assetExports) {
    const encodedId = encodeURIComponent(asset.id);
    const relativeUrl = `assets/${asset.exportFileName}`;
    const patterns = [
      `/api/content-assets/${asset.id}/file`,
      `/api/content-assets/${encodedId}/file`,
      `http://localhost:3004/api/content-assets/${asset.id}/file`,
      `http://127.0.0.1:3004/api/content-assets/${asset.id}/file`,
      `http://localhost:3013/api/content-assets/${asset.id}/file`,
      `http://127.0.0.1:3013/api/content-assets/${asset.id}/file`
    ];

    for (const pattern of patterns) {
      result = result.replace(new RegExp(escapeRegExp(pattern), "g"), relativeUrl);
    }
  }
  return result;
}

async function inlineAssetDataUrls(html, manifest) {
  let result = html;
  for (const asset of manifest.assetExports.filter((item) => item.copied && item.relativePath)) {
    const absolutePath = path.join(manifest.exportDir, asset.relativePath);
    const bytes = await readFile(absolutePath);
    const dataUrl = `data:${asset.mimeType};base64,${bytes.toString("base64")}`;
    result = result.replace(new RegExp(escapeRegExp(asset.relativePath), "g"), dataUrl);
  }
  return result;
}

function wrapPreviewHtml(contentItem, html, manifest) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(contentItem.title ?? "Blogger UI publish preview")}</title>
  <style>
    body { margin: 0; background: #eef3fb; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
    main { max-width: 960px; margin: 0 auto; background: #fff; min-height: 100vh; padding: 48px 56px; box-sizing: border-box; }
    h1, h2, h3 { color: #10264a; line-height: 1.2; }
    p, li { font-size: 17px; line-height: 1.75; }
    img { max-width: 100%; height: auto; border-radius: 10px; border: 1px solid #d8e1ef; }
    figure { margin: 28px 0; }
    figcaption { color: #526070; font-size: 14px; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 15px; }
    th, td { border: 1px solid #dbe5f2; padding: 10px; text-align: left; }
    th { background: #f4f7fb; }
    .bga-export-note { border: 1px solid #d7e3f4; background: #f8fbff; border-radius: 10px; padding: 14px 16px; margin-bottom: 28px; font-size: 14px; color: #45556c; }
  </style>
</head>
<body>
  <main>
    <section class="bga-export-note">
      <strong>Blogger UI export preview</strong><br />
      contentItemId: ${escapeHtml(manifest.contentItemId)}<br />
      assetCount: ${manifest.assetCount}<br />
      sideEffects: Blogger API write=false, DB write=false, publish=false
    </section>
    ${html}
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function prepareExport({ prisma, contentItemId }) {
  let contentItem = null;
  let dbReadMode = "prisma";

  try {
    contentItem = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      include: {
        blog: true,
        assets: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });
  } catch (error) {
    if (!isPrismaConnectionError(error)) {
      throw error;
    }
    dbReadMode = "psql_fallback";
    contentItem = await findContentItemWithPsql(contentItemId);
  }

  if (!contentItem) {
    throw new Error(`Content item not found: ${contentItemId}`);
  }

  if (!contentItem.draftHtml) {
    throw new Error("Content item has no saved draftHtml.");
  }

  const repoRoot = process.cwd();
  const localDataRoot = path.resolve(repoRoot, "local-data");
  const exportDir = path.join(localDataRoot, "blogger-ui-publisher", contentItem.id);
  const assetsDir = path.join(exportDir, "assets");
  await mkdir(assetsDir, { recursive: true });

  const assetExports = [];
  let copiedAssetCount = 0;

  for (const asset of contentItem.assets) {
    const absoluteSource = path.resolve(repoRoot, asset.storagePath);
    if (!absoluteSource.startsWith(localDataRoot + path.sep)) {
      assetExports.push({
        id: asset.id,
        copied: false,
        warning: "asset_storage_path_outside_local_data",
        originalName: asset.originalName,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        placementHint: asset.placementHint,
        isPrimary: asset.isPrimary,
        sortOrder: asset.sortOrder
      });
      continue;
    }

    const exportFileName = `${String(asset.sortOrder).padStart(2, "0")}-${asset.id}-${safeFileName(asset.fileName)}`;
    const absoluteDestination = path.join(assetsDir, exportFileName);
    await copyFile(absoluteSource, absoluteDestination);
    copiedAssetCount += 1;
    assetExports.push({
      id: asset.id,
      copied: true,
      originalName: asset.originalName,
      fileName: asset.fileName,
      exportFileName,
      relativePath: `assets/${exportFileName}`,
      mimeType: asset.mimeType,
      caption: asset.caption,
      altText: asset.altText,
      placementHint: asset.placementHint,
      isPrimary: asset.isPrimary,
      sortOrder: asset.sortOrder
    });
  }

  const exportHtml = replaceAssetReferences(contentItem.draftHtml, assetExports.filter((asset) => asset.copied));
  let selectedConnectionBloggerBlogId = contentItem.psqlSelectedBloggerBlogId ?? null;
  if (!selectedConnectionBloggerBlogId) {
    try {
      selectedConnectionBloggerBlogId =
        (await prisma.bloggerConnection.findFirst({
          where: {
            blogId: contentItem.blogId ?? undefined,
            bloggerBlogId: { not: null }
          },
          orderBy: { updatedAt: "desc" },
          select: { bloggerBlogId: true }
        }))?.bloggerBlogId ?? null;
    } catch (error) {
      if (!isPrismaConnectionError(error)) {
        throw error;
      }
    }
  }

  const bloggerBlogId = selectedConnectionBloggerBlogId ?? contentItem.blog?.bloggerBlogId ?? null;

  const manifest = {
    generatedAt: new Date().toISOString(),
    contentItemId: contentItem.id,
    title: contentItem.title,
    status: contentItem.status,
    blogId: contentItem.blogId,
    blogName: contentItem.blog?.name ?? null,
    bloggerBlogId,
    exportDir,
    htmlPath: path.join(exportDir, "post.html"),
    previewPath: path.join(exportDir, "index.html"),
    titlePath: path.join(exportDir, "post-title.txt"),
    assetCount: contentItem.assets.length,
    copiedAssetCount,
    assetExports,
    sideEffectSummary: {
      dbRead: true,
      dbReadMode,
      dbWrite: false,
      localFileWrite: true,
      bloggerApiWrite: false,
      bloggerUiWrite: false,
      bloggerPublish: false,
      tokenRefresh: false,
      oauthReconnect: false,
      llmCall: false,
      contentMutation: false
    },
    nextManualSteps: [
      "Open Blogger editor in the persistent browser profile.",
      "Upload copied image assets through Blogger UI where each image appears.",
      "Paste or import post.html after confirming image placements.",
      "Use Blogger preview before any publish action."
    ]
  };

  await writeFile(path.join(exportDir, "post.html"), exportHtml, "utf8");
  await writeFile(path.join(exportDir, "post-title.txt"), contentItem.title ?? "", "utf8");
  await writeFile(path.join(exportDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(path.join(exportDir, "index.html"), wrapPreviewHtml(contentItem, exportHtml, manifest), "utf8");

  return manifest;
}

function isPrismaConnectionError(error) {
  return error instanceof Error && /Can't reach database server|PrismaClientInitializationError/i.test(error.message);
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function databaseUrlForPsql() {
  const fallback = "postgresql://pdh0826@localhost/blog_growth_agent_dev?host=/tmp";
  const raw = process.env.PSQL_DATABASE_URL || process.env.DATABASE_URL || fallback;
  try {
    const url = new URL(raw);
    for (const key of ["schema", "connection_limit", "pool_timeout"]) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

async function runPsqlJson(sql) {
  const databaseUrl = databaseUrlForPsql();
  const result = await new Promise((resolve, reject) => {
    const child = spawn("psql", [databaseUrl, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`psql_read_failed:${code}:${stderr.trim()}`));
      }
    });
  });

  if (!result || result === "null") {
    return null;
  }
  return JSON.parse(result);
}

async function findContentItemWithPsql(contentItemId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(contentItemId)) {
    throw new Error("invalid_content_item_id");
  }

  const sql = `
    SELECT COALESCE(json_build_object(
      'id', ci.id,
      'blogId', ci."blogId",
      'status', ci.status::text,
      'title', ci.title,
      'draftHtml', ci."draftHtml",
      'blog', CASE WHEN b.id IS NULL THEN NULL ELSE json_build_object(
        'id', b.id,
        'name', b.name,
        'url', b.url,
        'bloggerBlogId', b."bloggerBlogId"
      ) END,
      'assets', COALESCE(
        json_agg(
          json_build_object(
            'id', ca.id,
            'contentItemId', ca."contentItemId",
            'assetType', ca."assetType"::text,
            'fileName', ca."fileName",
            'originalName', ca."originalName",
            'mimeType', ca."mimeType",
            'fileSize', ca."fileSize",
            'storagePath', ca."storagePath",
            'thumbnailPath', ca."thumbnailPath",
            'caption', ca.caption,
            'altText', ca."altText",
            'userNote', ca."userNote",
            'placementHint', ca."placementHint"::text,
            'sortOrder', ca."sortOrder",
            'isPrimary', ca."isPrimary",
            'createdAt', ca."createdAt",
            'updatedAt', ca."updatedAt"
          )
          ORDER BY ca."sortOrder" ASC, ca."createdAt" ASC
        ) FILTER (WHERE ca.id IS NOT NULL),
        '[]'::json
      ),
      'psqlSelectedBloggerBlogId', (
        SELECT bc."bloggerBlogId"
        FROM blogger_connections bc
        WHERE bc."blogId" = ci."blogId"
          AND bc."bloggerBlogId" IS NOT NULL
        ORDER BY bc."updatedAt" DESC
        LIMIT 1
      )
    ), 'null'::json)::text
    FROM content_items ci
    LEFT JOIN blogs b ON b.id = ci."blogId"
    LEFT JOIN content_assets ca ON ca."contentItemId" = ci.id
    WHERE ci.id = ${sqlLiteral(contentItemId)}
    GROUP BY ci.id, b.id;
  `;

  const item = await runPsqlJson(sql);
  if (!item) {
    return null;
  }
  if (!item.blog && item.psqlSelectedBloggerBlogId) {
    item.blog = { bloggerBlogId: item.psqlSelectedBloggerBlogId };
  } else if (item.blog && !item.blog.bloggerBlogId && item.psqlSelectedBloggerBlogId) {
    item.blog.bloggerBlogId = item.psqlSelectedBloggerBlogId;
  }
  return item;
}

async function openBloggerBrowser(manifest, args) {
  const { chromium } = await import("playwright");
  const profileDir = path.join(process.cwd(), "local-data", "blogger-ui-publisher", "browser-profile");
  await mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 1000 }
  });

  const previewPage = await context.newPage();
  await previewPage.goto(pathToFileURL(manifest.previewPath).href, { waitUntil: "domcontentloaded" });

  const bloggerPage = await context.newPage();
  const fallbackBloggerUrl = manifest.bloggerBlogId
    ? `https://www.blogger.com/blog/posts/${encodeURIComponent(manifest.bloggerBlogId)}`
    : "https://www.blogger.com/";
  await bloggerPage.goto(args.editorUrl || fallbackBloggerUrl, { waitUntil: "domcontentloaded" });

  console.log(
    JSON.stringify(
      {
        ok: true,
        browserOpened: true,
        mode: "manual_calibration",
        previewPath: manifest.previewPath,
        previewUrl: pathToFileURL(manifest.previewPath).href,
        bloggerUrl: args.editorUrl || fallbackBloggerUrl,
        keepOpenMs: args.keepOpenMs,
        liveExecutionAttempted: false,
        sideEffectSummary: {
          dbRead: true,
          dbWrite: false,
          localFileWrite: true,
          bloggerApiWrite: false,
          bloggerUiWrite: false,
          bloggerPublish: false,
          tokenRefresh: false,
          oauthReconnect: false,
          llmCall: false,
          contentMutation: false
        }
      },
      null,
      2
    )
  );

  await new Promise((resolve) => setTimeout(resolve, Math.max(1000, args.keepOpenMs)));
  await context.close();
}

async function runBloggerUiLive(manifest, args) {
  const { chromium } = await import("playwright");
  const profileDir = path.join(process.cwd(), "local-data", "blogger-ui-publisher", "browser-profile");
  await mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: args.headless,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: false
  });

  const sideEffectSummary = {
    dbRead: true,
    dbWrite: false,
    localFileWrite: true,
    bloggerApiWrite: false,
    bloggerUiWrite: true,
    bloggerPublish: false,
    tokenRefresh: false,
    oauthReconnect: false,
    llmCall: false,
    contentMutation: false
  };

  try {
    const page = await context.newPage();
    const editorUrl = args.editorUrl || buildBloggerNewPostUrl(manifest);
    await page.goto(editorUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2500);

    if (isGoogleLoginUrl(page.url())) {
      return {
        ok: false,
        mode: "live_ui",
        error: "blogger_login_required",
        message: "Persistent browser profile is not logged into Blogger/Google.",
        currentUrl: page.url(),
        liveExecutionAttempted: true,
        publishClicked: false,
        sideEffectSummary: { ...sideEffectSummary, bloggerUiWrite: false }
      };
    }

    await maybeClickNewPost(page);
    await fillBloggerTitle(page, manifest.title ?? "");
    const rawHtml = await readFile(manifest.htmlPath, "utf8");
    const bloggerHtml = await inlineAssetDataUrls(rawHtml, manifest);
    await fillBloggerBodyHtml(page, bloggerHtml);

    let publishClicked = false;
    if (args.publish) {
      publishClicked = await clickBloggerPublish(page);
      if (!publishClicked) {
        return {
          ok: false,
          mode: "live_ui",
          error: "blogger_publish_button_not_found",
          message: "Post content was inserted, but publish controls were not found.",
          currentUrl: page.url(),
          liveExecutionAttempted: true,
          publishClicked: false,
          sideEffectSummary
        };
      }
    }

    await page.waitForTimeout(3000);
    return {
      ok: true,
      mode: "live_ui",
      contentItemId: manifest.contentItemId,
      title: manifest.title,
      bloggerBlogId: manifest.bloggerBlogId,
      currentUrl: page.url(),
      assetCount: manifest.assetCount,
      copiedAssetCount: manifest.copiedAssetCount,
      imageTransport: "inline_data_url",
      liveExecutionAttempted: true,
      publishClicked,
      sideEffectSummary: {
        ...sideEffectSummary,
        bloggerPublish: publishClicked
      }
    };
  } finally {
    if (args.headless || args.publish) {
      await context.close();
    }
  }
}

function buildBloggerNewPostUrl(manifest) {
  return manifest.bloggerBlogId
    ? `https://www.blogger.com/blog/post/edit/${encodeURIComponent(manifest.bloggerBlogId)}`
    : "https://www.blogger.com/blog/post/edit";
}

function isGoogleLoginUrl(url) {
  return /accounts\.google\.com|ServiceLogin|signin/i.test(url);
}

async function maybeClickNewPost(page) {
  const newPostCandidates = [
    page.getByRole("button", { name: /new post|새 글|새 게시물|글쓰기/i }),
    page.getByRole("link", { name: /new post|새 글|새 게시물|글쓰기/i }),
    page.locator('[aria-label*="New post" i], [aria-label*="새 글"], [aria-label*="글쓰기"]')
  ];
  for (const candidate of newPostCandidates) {
    if (await clickIfVisible(candidate, 2500)) {
      await page.waitForTimeout(2500);
      return true;
    }
  }
  return false;
}

async function fillBloggerTitle(page, title) {
  const candidates = [
    page.getByRole("textbox", { name: /title|제목/i }),
    page.locator('input[aria-label*="Title" i], textarea[aria-label*="Title" i]'),
    page.locator('input[aria-label*="제목"], textarea[aria-label*="제목"]'),
    page.locator('input[placeholder*="Title" i], textarea[placeholder*="Title" i]'),
    page.locator('input[placeholder*="제목"], textarea[placeholder*="제목"]')
  ];
  for (const candidate of candidates) {
    if (await fillIfVisible(candidate, title, 4000)) {
      return true;
    }
  }
  throw new Error("blogger_title_field_not_found");
}

async function fillBloggerBodyHtml(page, html) {
  await trySwitchBloggerHtmlMode(page);

  const candidates = [
    page.locator("textarea").last(),
    page.locator('[contenteditable="true"]').last(),
    page.locator(".CodeMirror textarea").last()
  ];

  for (const candidate of candidates) {
    if (await fillHtmlIfVisible(page, candidate, html, 5000)) {
      return true;
    }
  }

  for (const frame of page.frames()) {
    for (const selector of ["textarea", '[contenteditable="true"]', "body"]) {
      const candidate = frame.locator(selector).last();
      if (await fillHtmlIfVisible(page, candidate, html, 3000)) {
        return true;
      }
    }
  }

  throw new Error("blogger_body_editor_not_found");
}

async function trySwitchBloggerHtmlMode(page) {
  const candidates = [
    page.getByRole("button", { name: /html view|HTML 보기|HTML/i }),
    page.getByRole("menuitem", { name: /html view|HTML 보기|HTML/i }),
    page.locator('[aria-label*="HTML" i]'),
    page.locator('button:has-text("HTML"), div[role="button"]:has-text("HTML")')
  ];

  for (const candidate of candidates) {
    if (await clickIfVisible(candidate, 1800)) {
      await page.waitForTimeout(1200);
      return true;
    }
  }
  return false;
}

async function clickBloggerPublish(page) {
  const candidates = [
    page.getByRole("button", { name: /publish|게시|발행|공개/i }),
    page.getByRole("menuitem", { name: /publish|게시|발행|공개/i }),
    page.locator('[aria-label*="Publish" i], [aria-label*="게시"], [aria-label*="발행"], [aria-label*="공개"]')
  ];
  for (const candidate of candidates) {
    if (await clickIfVisible(candidate, 5000)) {
      await page.waitForTimeout(1600);
      await clickBloggerConfirmPublish(page);
      return true;
    }
  }
  return false;
}

async function clickBloggerConfirmPublish(page) {
  const candidates = [
    page.getByRole("button", { name: /confirm|publish|확인|게시|발행|공개/i }),
    page.getByRole("button", { name: /^ok$|^확인$/i })
  ];
  for (const candidate of candidates) {
    if (await clickIfVisible(candidate, 3000)) {
      await page.waitForTimeout(2500);
      return true;
    }
  }
  return false;
}

async function clickIfVisible(locator, timeoutMs) {
  try {
    const first = locator.first();
    await first.waitFor({ state: "visible", timeout: timeoutMs });
    await first.click({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function fillIfVisible(locator, value, timeoutMs) {
  try {
    const first = locator.first();
    await first.waitFor({ state: "visible", timeout: timeoutMs });
    await first.fill(value, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function fillHtmlIfVisible(page, locator, html, timeoutMs) {
  try {
    const first = locator.first();
    await first.waitFor({ state: "visible", timeout: timeoutMs });
    const tagName = await first.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    if (tagName === "textarea" || tagName === "input") {
      await first.fill(html, { timeout: timeoutMs });
    } else {
      await first.evaluate((element, value) => {
        element.innerHTML = value;
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertHTML", data: value }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }, html);
    }
    await page.waitForTimeout(1000);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const manifest = await prepareExport({ prisma, contentItemId: args.contentItemId });
    const result = {
      ok: true,
      mode: args.openBrowser ? "export_and_open_browser" : "export_only",
      contentItemId: manifest.contentItemId,
      title: manifest.title,
      exportDir: manifest.exportDir,
      previewUrl: pathToFileURL(manifest.previewPath).href,
      manifestPath: path.join(manifest.exportDir, "manifest.json"),
      assetCount: manifest.assetCount,
      copiedAssetCount: manifest.copiedAssetCount,
      liveUiImplemented: true,
      liveExecutionAttempted: false,
      sideEffectSummary: manifest.sideEffectSummary
    };

    console.log(JSON.stringify(result, null, 2));

    if (args.liveUi) {
      const liveResult = await runBloggerUiLive(manifest, args);
      console.log(JSON.stringify(liveResult, null, 2));
      if (!liveResult.ok) {
        process.exitCode = 1;
      }
      return;
    }

    if (args.openBrowser) {
      await openBloggerBrowser(manifest, args);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown_error",
        liveExecutionAttempted: false,
        sideEffectSummary: {
          dbWrite: false,
          bloggerApiWrite: false,
          bloggerUiWrite: false,
          bloggerPublish: false,
          tokenRefresh: false,
          oauthReconnect: false,
          llmCall: false,
          contentMutation: false
        }
      },
      null,
      2
    )
  );
  process.exit(1);
});
