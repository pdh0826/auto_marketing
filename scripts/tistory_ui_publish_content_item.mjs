#!/usr/bin/env node
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const LIVE_CONFIRMATION = "I_UNDERSTAND_THIS_WILL_PUBLISH_TO_TISTORY";

function parseArgs(argv) {
  const args = { contentItemId: "", editPostId: "", dryRun: false, checkLogin: false, keepAlive: false, openBrowser: false, publish: false, headless: false, confirm: "", keepOpenMs: 600000 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--content-item-id") args.contentItemId = argv[++index] ?? "";
    else if (value === "--edit-post-id") args.editPostId = argv[++index] ?? "";
    else if (value === "--dry-run") args.dryRun = true;
    else if (value === "--check-login") args.checkLogin = true;
    else if (value === "--keep-alive") args.keepAlive = true;
    else if (value === "--open-browser") args.openBrowser = true;
    else if (value === "--publish") args.publish = true;
    else if (value === "--headless") args.headless = true;
    else if (value === "--confirm") args.confirm = argv[++index] ?? "";
    else if (value === "--keep-open-ms") args.keepOpenMs = Number(argv[++index] ?? args.keepOpenMs);
    else throw new Error(`unknown_argument:${value}`);
  }
  if (!args.contentItemId && !args.keepAlive) throw new Error("content_item_id_required");
  if (args.editPostId && !/^\d+$/.test(args.editPostId)) throw new Error("invalid_edit_post_id");
  if (args.publish && args.confirm !== LIVE_CONFIRMATION) throw new Error("tistory_live_confirmation_required");
  return args;
}

async function keepAliveSession(args) {
  const context = await launchContext(args.headless);
  try {
    const page = await context.newPage();
    await page.goto("https://project300.tistory.com/manage/newpost/", { waitUntil: "domcontentloaded", timeout: 60000 });
    const loginRequired = isLoginUrl(page.url());
    return {
      ok: !loginRequired,
      mode: "session_keep_alive",
      sessionReady: !loginRequired,
      error: loginRequired ? "tistory_login_required" : null,
      currentUrl: page.url(),
      profilePersistent: true,
      publish: false,
      sideEffectSummary: {
        tistoryUiWrite: false,
        tistoryPublish: false,
        dbWrite: false,
        bloggerWrite: false,
        tokenRefresh: false,
        llmCall: false
      }
    };
  } finally {
    await context.close();
  }
}

async function loadExport(contentItemId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(contentItemId)) throw new Error("invalid_content_item_id");
  const exportDir = path.join(process.cwd(), "local-data", "tistory-export", contentItemId);
  const [manifestText, html, portableHtml, title, tags] = await Promise.all([
    readFile(path.join(exportDir, "manifest.json"), "utf8"),
    readFile(path.join(exportDir, "post-inline.html"), "utf8"),
    readFile(path.join(exportDir, "post.html"), "utf8"),
    readFile(path.join(exportDir, "post-title.txt"), "utf8"),
    readFile(path.join(exportDir, "project300-tags.txt"), "utf8")
  ]);
  const manifest = JSON.parse(manifestText);
  return {
    exportDir,
    manifest,
    html,
    portableHtml,
    title: title.trim(),
    tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
    category: manifest.project300?.recommendedCategoryPath?.at(-1) ?? ""
  };
}

function safeResult(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function launchContext(headless) {
  const { chromium } = await import("playwright");
  const profileDir = path.join(process.cwd(), "local-data", "tistory-ui-publisher", "browser-profile");
  await mkdir(profileDir, { recursive: true });
  return chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: false
  });
}

async function openLogin(exportData, args) {
  const context = await launchContext(false);
  try {
    const page = await context.newPage();
    await page.goto("https://project300.tistory.com/manage/newpost/", { waitUntil: "domcontentloaded", timeout: 60000 });
    if (!isLoginUrl(page.url())) {
      safeResult({ ok: true, mode: "login_ready", currentUrl: page.url(), profilePersistent: true, publish: false, contentItemId: exportData.manifest.contentItemId });
      return;
    }
    safeResult({ ok: true, mode: "login_waiting", currentUrl: page.url(), profilePersistent: true, publish: false, contentItemId: exportData.manifest.contentItemId });
    await page.waitForURL(/project300\.tistory\.com\/manage\/newpost\/?/, { timeout: Math.max(60000, args.keepOpenMs), waitUntil: "domcontentloaded" });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    safeResult({ ok: true, mode: "login_saved", currentUrl: page.url(), profilePersistent: true, publish: false, contentItemId: exportData.manifest.contentItemId });
  } finally {
    await context.close();
  }
}

async function checkLogin(exportData, args) {
  const context = await launchContext(args.headless);
  try {
    const page = await context.newPage();
    await page.goto("https://project300.tistory.com/manage/newpost/", { waitUntil: "domcontentloaded", timeout: 60000 });
    const loginRequired = isLoginUrl(page.url());
    return {
      ok: !loginRequired,
      mode: "login_check",
      error: loginRequired ? "tistory_login_required" : null,
      currentUrl: page.url(),
      profilePersistent: true,
      publish: false,
      contentItemId: exportData.manifest.contentItemId
    };
  } finally {
    await context.close();
  }
}

function isLoginUrl(url) {
  return /tistory\.com\/auth\/login|accounts\.kakao\.com|kauth\.kakao\.com/i.test(url);
}

async function chooseCategory(page, preferred) {
  await page.getByRole("combobox", { name: "카테고리 선택" }).click();
  const preferredOption = page.getByRole("option", { name: preferred, exact: false });
  if (preferred && (await preferredOption.count()) > 0) await preferredOption.last().click();
  else throw new Error("tistory_category_not_found");
  return preferred;
}

async function fillBasicEditorAndVerify(page, html, expectedImageCount) {
  await page.evaluate((value) => {
    const editor = window.tinymce?.activeEditor;
    if (!editor) throw new Error("tistory_basic_editor_not_found");
    editor.setContent(value);
    editor.save?.();
  }, html);
  await page.waitForFunction((expected) => {
    const html = window.tinymce?.activeEditor?.getContent() ?? "";
    return html.length > 2500 &&
      (html.match(/<h2\b/gi) ?? []).length >= 5 &&
      (html.match(/<table\b/gi) ?? []).length >= 1 &&
      (html.match(/blog\.kakaocdn\.net|\[##_Image\|/g) ?? []).length >= expected &&
      (html.match(/upsignal\.co\.kr/g) ?? []).length >= expected;
  }, expectedImageCount, { timeout: 15000 });
  const summary = await page.evaluate(() => {
    const html = window.tinymce?.activeEditor?.getContent() ?? "";
    return {
      htmlLength: html.length,
      headingCount: (html.match(/<h2\b/gi) ?? []).length,
      tableCount: (html.match(/<table\b/gi) ?? []).length,
      imageCount: (html.match(/blog\.kakaocdn\.net|\[##_Image\|/g) ?? []).length,
      upsignalLinkCount: (html.match(/upsignal\.co\.kr/g) ?? []).length
    };
  });
  if (summary.htmlLength <= 2500 || summary.headingCount < 5 || summary.tableCount < 1 || summary.imageCount < expectedImageCount || summary.upsignalLinkCount < expectedImageCount) {
    throw new Error(`tistory_editor_sync_validation_failed:${JSON.stringify(summary)}`);
  }
  return summary;
}

async function fillTags(page, tags) {
  const input = page.getByPlaceholder("태그입력");
  for (const tag of tags.slice(0, 10)) {
    await input.fill(tag);
    await input.press("Enter");
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function uploadBodyImages(page, exportData) {
  const bodyAssets = (exportData.manifest.assetExports ?? [])
    .filter((item) => item.copied && item.mimeType !== "image/svg+xml" && item.relativePath && item.altText);
  if (bodyAssets.length === 0) return { html: exportData.portableHtml, expectedImageAlts: [] };

  await page.evaluate(() => {
    const editor = window.tinymce?.activeEditor;
    if (!editor) throw new Error("tistory_basic_editor_not_found");
    editor.setContent("");
  });
  const files = bodyAssets.map((item) => path.join(exportData.exportDir, item.relativePath));
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }),
    (async () => {
      await page.locator('[role="button"][aria-label="첨부"]:visible').click();
      await page.getByRole("menuitem", { name: /사진/ }).click();
    })()
  ]);
  await chooser.setFiles(files);
  await page.waitForFunction((expected) => {
    try {
      const content = window.tinymce?.activeEditor?.getContent() ?? "";
      return (content.match(/\[##_Image\|/g) ?? []).length >= expected;
    } catch {
      return false;
    }
  }, bodyAssets.length, { timeout: 60000 });
  const uploadHtml = await page.evaluate(() => window.tinymce?.activeEditor?.getContent() ?? "");
  const imageTokens = uploadHtml.match(/\[##_Image\|[\s\S]*?_##\]/g) ?? [];
  if (imageTokens.length !== bodyAssets.length) throw new Error("tistory_image_upload_count_mismatch");

  let html = exportData.portableHtml;
  for (const asset of exportData.manifest.assetExports ?? []) {
    if (!asset.id) continue;
    const figurePattern = new RegExp(`<figure[^>]*data-asset-id="${escapeRegExp(asset.id)}"[^>]*>[\\s\\S]*?<\\/figure>`, "g");
    const bodyIndex = bodyAssets.findIndex((item) => item.id === asset.id);
    if (bodyIndex < 0) {
      html = html.replace(figurePattern, "");
      continue;
    }
    const caption = escapeHtml(asset.caption || asset.altText || "차트 이미지");
    html = html.replace(
      figurePattern,
      `<p>${imageTokens[bodyIndex]}</p><p class="bga-media-caption">${caption}</p>`
    );
  }
  return { html, expectedImageAlts: bodyAssets.map((item) => item.altText) };
}

async function verifyPreview(page, expectedImageAlts) {
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  const close = page.getByRole("button", { name: "닫기", exact: true });
  await close.waitFor({ state: "visible", timeout: 15000 });
  await page.waitForTimeout(5000);
  const summary = { imageCount: 0, headingCount: 0, tableCount: 0, bodyTextReady: false, loadedImageAlts: [] };
  for (const previewPage of page.context().pages()) {
    for (const frame of previewPage.frames()) {
      const loadedImages = await frame.locator('img[src*="blog.kakaocdn.net"]:visible').evaluateAll((images) => images
        .filter((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
        .map((image) => image.getAttribute("alt") ?? ""));
      summary.imageCount += loadedImages.length;
      summary.loadedImageAlts.push(...loadedImages);
      summary.headingCount += await frame.locator("h2:visible, h3:visible").count();
      summary.tableCount += await frame.locator("table:visible").count();
      const frameText = await frame.locator("body").innerText().catch(() => "");
      if (frameText.length > 1800) summary.bodyTextReady = true;
    }
  }
  // Tistory rewrites image alt text in preview. Validate the uploaded Kakao CDN
  // body-chart count against the locally verified non-SVG export assets.
  if (summary.imageCount < expectedImageAlts.length || summary.headingCount < 5 || summary.tableCount === 0 || !summary.bodyTextReady) {
    const diagnosticDir = path.join(process.cwd(), "local-data", "tistory-ui-publisher");
    await mkdir(diagnosticDir, { recursive: true });
    await page.screenshot({
      path: path.join(diagnosticDir, "last-preview-validation.png"),
      fullPage: false
    });
    const diagnostic = await page.evaluate(() => ({
      iframeCount: document.querySelectorAll("iframe").length,
      iframes: Array.from(document.querySelectorAll("iframe")).map((iframe) => ({
        id: iframe.id,
        className: iframe.className,
        src: iframe.getAttribute("src")?.slice(0, 120) ?? "",
        srcdocLength: iframe.getAttribute("srcdoc")?.length ?? 0,
        bodyLength: iframe.contentDocument?.body?.innerHTML.length ?? 0,
        rect: {
          width: Math.round(iframe.getBoundingClientRect().width),
          height: Math.round(iframe.getBoundingClientRect().height)
        }
      }))
    }));
    await close.click();
    throw new Error(
      `tistory_preview_validation_failed:images=${summary.imageCount}/${expectedImageAlts.length}:headings=${summary.headingCount}:tables=${summary.tableCount}:diagnostic=${JSON.stringify(diagnostic)}`
    );
  }
  await close.click();
  return summary;
}

async function publish(page, title) {
  await page.getByRole("button", { name: "완료", exact: true }).click();
  const publicRadio = page.getByRole("radio", { name: "공개", exact: true });
  await publicRadio.waitFor({ state: "visible", timeout: 10000 });
  await publicRadio.check();
  await page.getByRole("button", { name: "공개 발행", exact: true }).click();
  await page.waitForURL(/\/manage\/posts\/?/, { timeout: 30000 });
  const link = page.getByRole("link", { name: title, exact: true });
  await link.waitFor({ state: "visible", timeout: 15000 });
  return link.getAttribute("href");
}

async function verifyPublishedPage(context, publicUrl, expectedImageCount) {
  const page = await context.newPage();
  try {
    await page.goto(publicUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    const article = page.locator(".tt_article_useless_p_margin.contents_style");
    await article.waitFor({ state: "visible", timeout: 15000 });
    const summary = await article.evaluate((element) => {
      const html = element.innerHTML;
      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
      return {
        visibleTextLength: text.length,
        headingCount: element.querySelectorAll("h2, h3").length,
        tableCount: element.querySelectorAll("table").length,
        imageCount: element.querySelectorAll('img[src*="blog.kakaocdn.net"]').length,
        upsignalLinkCount: element.querySelectorAll('a[href*="upsignal.co.kr"]').length,
        escapedTable: /&lt;\/?table\b/i.test(html)
      };
    });
    if (
      summary.visibleTextLength < 1800 ||
      summary.headingCount < 5 ||
      summary.tableCount < 1 ||
      summary.imageCount < expectedImageCount ||
      summary.upsignalLinkCount < expectedImageCount ||
      summary.escapedTable
    ) {
      throw new Error(`tistory_public_page_validation_failed:${JSON.stringify(summary)}`);
    }
    return summary;
  } finally {
    await page.close();
  }
}

async function runLive(exportData, args) {
  const context = await launchContext(args.headless);
  const sideEffects = { tistoryUiWrite: true, tistoryPublish: false, dbWrite: false, bloggerWrite: false, tokenRefresh: false, llmCall: false };
  try {
    const page = await context.newPage();
    const editorUrl = args.editPostId
      ? `https://project300.tistory.com/manage/post/${args.editPostId}`
      : "https://project300.tistory.com/manage/newpost/";
    await page.goto(editorUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    if (isLoginUrl(page.url())) return { ok: false, error: "tistory_login_required", currentUrl: page.url(), sideEffectSummary: { ...sideEffects, tistoryUiWrite: false } };
    await page.getByPlaceholder("제목을 입력하세요").fill(exportData.title);
    const selectedCategory = await chooseCategory(page, exportData.category);
    const uploaded = await uploadBodyImages(page, exportData);
    const editor = await fillBasicEditorAndVerify(page, uploaded.html, uploaded.expectedImageAlts.length);
    await fillTags(page, exportData.tags);
    const preview = await verifyPreview(page, uploaded.expectedImageAlts);
    const publicUrl = args.publish ? await publish(page, exportData.title) : null;
    const published = publicUrl ? await verifyPublishedPage(context, publicUrl, uploaded.expectedImageAlts.length) : null;
    return {
      ok: true,
      mode: args.publish ? "publish" : "preview",
      contentItemId: exportData.manifest.contentItemId,
      title: exportData.title,
      selectedCategory,
      publicUrl,
      editor,
      preview,
      published,
      sideEffectSummary: { ...sideEffects, tistoryPublish: Boolean(publicUrl) }
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.keepAlive) {
    safeResult(await keepAliveSession(args));
    return;
  }
  const exportData = await loadExport(args.contentItemId);
  if (args.dryRun) {
    safeResult({ ok: true, mode: "dry_run", contentItemId: args.contentItemId, title: exportData.title, category: exportData.category, imageCount: exportData.manifest.assetExports?.length ?? 0, publish: false });
  } else if (args.checkLogin) {
    safeResult(await checkLogin(exportData, args));
  } else if (args.openBrowser) {
    await openLogin(exportData, args);
  } else {
    safeResult(await runLive(exportData, args));
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "tistory_publisher_failed";
  safeResult({
    ok: false,
    error: message.replace(/[\r\n]+/g, " ").slice(0, 240),
    sideEffectSummary: {
      tistoryUiWrite: true,
      tistoryPublish: false,
      dbWrite: false,
      bloggerWrite: false,
      tokenRefresh: false,
      llmCall: false
    }
  });
  process.exitCode = 1;
});
