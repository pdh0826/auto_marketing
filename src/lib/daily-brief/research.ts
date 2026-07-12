import type { DailyBriefEtfPick, DailyBriefOfficialDisclosureItem, DailyBriefResearchItem, DailyBriefStockPick } from "./types";

const NEWS_FETCH_TIMEOUT_MS = 8000;
const DART_FETCH_TIMEOUT_MS = 8000;

export async function collectDailyBriefResearch(stockPicks: DailyBriefStockPick[], perStockLimit = 2) {
  const items: DailyBriefResearchItem[] = [];

  for (const pick of stockPicks) {
    const query = `${pick.name} ${pick.code} 최근 뉴스 공시`;
    const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
    const parsed = await fetchNaverNewsItems(searchUrl).catch(() => []);
    const googleNewsUrl = buildGoogleNewsRssUrl(query);
    const googleNewsItems = parsed.length > 0 ? [] : await fetchGoogleNewsRssItems(googleNewsUrl).catch(() => []);
    const candidates = parsed.length > 0 ? parsed : googleNewsItems;
    const selected = candidates.slice(0, perStockLimit);

    if (selected.length === 0) {
      items.push({
        symbolCode: pick.code,
        symbolName: pick.name,
        query,
        searchUrl,
        title: `${pick.name} 최근 뉴스/공시 검색 결과 확인`,
        source: "naver_news_search_link",
        sourceName: "네이버 뉴스 검색",
        publishedAt: null,
        url: searchUrl,
        shortSummary: "자동 수집 결과가 충분하지 않아 검색 결과 링크를 검토 후보로 남겼습니다."
      });
      continue;
    }

    for (const item of selected) {
      items.push({
        symbolCode: pick.code,
        symbolName: pick.name,
        query,
        searchUrl: parsed.length > 0 ? searchUrl : googleNewsUrl,
        ...item
      });
    }
  }

  return items;
}

export async function collectDailyBriefEtfResearch(etfPicks: DailyBriefEtfPick[], perEtfLimit = 2) {
  const items: DailyBriefResearchItem[] = [];

  for (const pick of etfPicks) {
    const category = pick.category ? `${pick.category} ` : "";
    const query = `${pick.name} ${pick.code} ${category}ETF 최근 흐름 섹터 전망`;
    const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
    const parsed = await fetchNaverNewsItems(searchUrl).catch(() => []);
    const googleNewsUrl = buildGoogleNewsRssUrl(query);
    const googleNewsItems = parsed.length > 0 ? [] : await fetchGoogleNewsRssItems(googleNewsUrl).catch(() => []);
    const candidates = parsed.length > 0 ? parsed : googleNewsItems;
    const selected = candidates.slice(0, perEtfLimit);

    if (selected.length === 0) {
      items.push({
        symbolCode: pick.code,
        symbolName: pick.name,
        query,
        searchUrl,
        title: `${pick.name} ETF/섹터 최근 뉴스 검색 결과 확인`,
        source: "naver_news_search_link",
        sourceName: "네이버 뉴스 검색",
        publishedAt: null,
        url: searchUrl,
        shortSummary: "ETF/섹터 자동 수집 결과가 충분하지 않아 검색 결과 링크를 검토 후보로 남겼습니다."
      });
      continue;
    }

    for (const item of selected) {
      items.push({
        symbolCode: pick.code,
        symbolName: pick.name,
        query,
        searchUrl: parsed.length > 0 ? searchUrl : googleNewsUrl,
        ...item
      });
    }
  }

  return items;
}

export async function collectDailyBriefOfficialDisclosures(stockPicks: DailyBriefStockPick[], marketDate: string, perStockLimit = 2) {
  const apiKey = resolveDartApiKey();
  if (!apiKey) {
    return [];
  }

  const stockCodes = new Set(stockPicks.map((pick) => pick.code.trim()).filter(Boolean));
  if (stockCodes.size === 0) {
    return [];
  }

  const disclosures = await fetchDartRecentDisclosures(apiKey, marketDate).catch(() => []);
  const byCode = new Map<string, DailyBriefOfficialDisclosureItem[]>();
  for (const disclosure of disclosures) {
    if (!stockCodes.has(disclosure.stockCode)) {
      continue;
    }
    const pick = stockPicks.find((item) => item.code === disclosure.stockCode);
    if (!pick) {
      continue;
    }
    const list = byCode.get(pick.code) ?? [];
    if (list.length >= perStockLimit) {
      continue;
    }
    list.push({
      symbolCode: pick.code,
      symbolName: pick.name,
      title: disclosure.reportName,
      source: "dart_openapi",
      sourceName: "DART 전자공시",
      publishedAt: normalizeDartDate(disclosure.receiptDate),
      url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(disclosure.receiptNo)}`,
      receiptNo: disclosure.receiptNo,
      shortSummary: "DART OpenAPI 실제 공시 목록입니다. 공시 원문 전체는 저장하지 않고 제목/일자/접수번호/URL만 참고합니다."
    });
    byCode.set(pick.code, list);
  }

  return stockPicks.flatMap((pick) => byCode.get(pick.code) ?? []);
}

interface DartDisclosureRow {
  corp_name?: string;
  stock_code?: string;
  report_nm?: string;
  rcept_no?: string;
  rcept_dt?: string;
}

async function fetchDartRecentDisclosures(apiKey: string, marketDate: string) {
  const endDate = normalizeDartQueryDate(marketDate) ?? formatDartQueryDate(new Date());
  const startDate = formatDartQueryDate(new Date(`${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}T00:00:00.000Z`).getTime() - 1000 * 60 * 60 * 24 * 45);
  const rows: Array<{
    stockCode: string;
    reportName: string;
    receiptNo: string;
    receiptDate: string;
  }> = [];

  for (const corpClass of ["Y", "K"]) {
    for (let pageNo = 1; pageNo <= 3; pageNo += 1) {
      const params = new URLSearchParams({
        crtfc_key: apiKey,
        bgn_de: startDate,
        end_de: endDate,
        corp_cls: corpClass,
        page_no: String(pageNo),
        page_count: "100"
      });
      const response = await fetchWithTimeout(`https://opendart.fss.or.kr/api/list.json?${params.toString()}`, DART_FETCH_TIMEOUT_MS, {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 BlogGrowthAgent/1.0 read-only daily brief"
      });
      if (!response.ok) {
        continue;
      }
      const payload = (await response.json().catch(() => null)) as { status?: string; list?: DartDisclosureRow[] } | null;
      if (!payload || payload.status !== "000" || !Array.isArray(payload.list)) {
        continue;
      }
      for (const item of payload.list) {
        const stockCode = item.stock_code?.trim();
        const reportName = decodeHtml(item.report_nm ?? "").trim();
        const receiptNo = item.rcept_no?.trim();
        const receiptDate = item.rcept_dt?.trim();
        if (!stockCode || !reportName || !receiptNo || !receiptDate) {
          continue;
        }
        rows.push({
          stockCode,
          reportName: reportName.slice(0, 140),
          receiptNo,
          receiptDate
        });
      }
    }
  }

  return dedupeDartDisclosures(rows).sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
}

async function fetchWithTimeout(url: string, timeoutMs: number, headers: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    cache: "no-store",
    signal: controller.signal,
    headers
  }).finally(() => clearTimeout(timeout));
}

async function fetchNaverNewsItems(searchUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
  const response = await fetch(searchUrl, {
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 BlogGrowthAgent/1.0 read-only daily brief",
      Accept: "text/html,application/xhtml+xml"
    }
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`news_search_failed:${response.status}`);
  }
  const html = await response.text();
  const matches = [
    ...Array.from(html.matchAll(/<a\b(?=[^>]*class="[^"]*(?:news_tit|news_title)[^"]*")(?=[^>]*href="([^"]+)")[^>]*?(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/g)),
    ...Array.from(html.matchAll(/<a\b(?=[^>]*href="([^"]+)")(?=[^>]*class="[^"]*(?:news_tit|news_title)[^"]*")[^>]*?(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/g))
  ];
  const seen = new Set<string>();
  const parsed = matches
    .map((match) => {
      const url = decodeHtml(match[1] ?? "").trim();
      const title = decodeHtml(match[2] || stripTags(match[3] ?? "")).trim();
      if (!url || !title || seen.has(url)) {
        return null;
      }
      seen.add(url);
      return {
        title: title.slice(0, 140),
        source: "naver_news_result",
        sourceName: inferSourceName(url),
        publishedAt: null,
        url,
        shortSummary: "최근 뉴스 검색 결과입니다. 기사 전문은 저장하지 않고 제목/출처/URL만 참고합니다."
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return parsed.slice(0, 5);
}

async function fetchGoogleNewsRssItems(rssUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NEWS_FETCH_TIMEOUT_MS);
  const response = await fetch(rssUrl, {
    cache: "no-store",
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 BlogGrowthAgent/1.0 read-only daily brief",
      Accept: "application/rss+xml, application/xml, text/xml"
    }
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    throw new Error(`google_news_rss_failed:${response.status}`);
  }
  const xml = await response.text();
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g))
    .map((match) => parseGoogleNewsItem(match[1] ?? ""))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) => !isExcludedNewsSource(item.sourceName))
    .sort(compareNewsItems);

  return dedupeNewsItems(items).slice(0, 5);
}

function parseGoogleNewsItem(itemXml: string) {
  const rawTitle = extractXmlText(itemXml, "title");
  const rawLink = extractXmlText(itemXml, "link");
  const rawPubDate = extractXmlText(itemXml, "pubDate");
  const rawSource = itemXml.match(/<source\b[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "";
  const sourceName = decodeHtml(stripTags(rawSource)).trim() || inferSourceName(rawLink);
  const title = cleanNewsTitle(decodeHtml(stripTags(rawTitle)).trim(), sourceName);
  const publishedAt = normalizePubDate(rawPubDate);

  if (!title || !rawLink) {
    return null;
  }

  return {
    title: title.slice(0, 140),
    source: "google_news_rss",
    sourceName,
    publishedAt,
    url: decodeHtml(rawLink).trim(),
    shortSummary: "Google 뉴스 RSS 검색 결과입니다. 기사 전문은 저장하지 않고 제목/출처/게시일/URL만 참고합니다."
  };
}

function buildGoogleNewsRssUrl(query: string) {
  const params = new URLSearchParams({
    q: query,
    hl: "ko",
    gl: "KR",
    ceid: "KR:ko"
  });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

function extractXmlText(xml: string, tagName: string) {
  return xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"))?.[1]?.trim() ?? "";
}

function cleanNewsTitle(title: string, sourceName: string) {
  const source = sourceName.trim();
  if (!source) {
    return title;
  }
  return title.replace(new RegExp(`\\s+-\\s+${escapeRegExp(source)}$`), "").trim();
}

function normalizePubDate(value: string) {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDartDate(value: string) {
  if (!/^\d{8}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00.000+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDartQueryDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replaceAll("-", "") : null;
}

function formatDartQueryDate(value: Date | number) {
  const date = typeof value === "number" ? new Date(value) : value;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function dedupeNewsItems<T extends { title: string; url: string }>(items: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = `${item.title.toLowerCase()}|${item.url}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function dedupeDartDisclosures<T extends { receiptNo: string; reportName: string; stockCode: string }>(items: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = `${item.stockCode}|${item.receiptNo}|${item.reportName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function compareNewsItems(
  a: { sourceName: string; publishedAt: string | null },
  b: { sourceName: string; publishedAt: string | null }
) {
  const qualityDiff = sourceQualityScore(b.sourceName) - sourceQualityScore(a.sourceName);
  if (qualityDiff !== 0) {
    return qualityDiff;
  }
  return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
}

function sourceQualityScore(sourceName: string) {
  const source = sourceName.trim();
  if (!source) {
    return 0;
  }
  if (preferredKoreanNewsSources.some((preferred) => source.includes(preferred))) {
    return 3;
  }
  if (/[가-힣]/.test(source)) {
    return 2;
  }
  return 1;
}

function isExcludedNewsSource(sourceName: string) {
  const source = sourceName.trim().toLowerCase();
  return excludedNewsSources.some((excluded) => source.includes(excluded));
}

const preferredKoreanNewsSources = [
  "연합뉴스",
  "연합인포맥스",
  "매일경제",
  "한국경제",
  "이데일리",
  "머니투데이",
  "서울경제",
  "전자신문",
  "조선비즈",
  "디지털투데이",
  "재경일보",
  "비즈니스포스트",
  "뉴스핌",
  "아시아경제"
];

const excludedNewsSources = ["traders union"];

function resolveDartApiKey() {
  const value = process.env.DART_API_KEY || process.env.OPENDART_API_KEY || "";
  return value.trim() || null;
}

function decodeHtml(value: string) {
  let decoded = value;
  for (let index = 0; index < 3; index += 1) {
    const next = decoded
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, "\"")
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
      .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCharCode(Number.parseInt(code, 16)));
    if (next === decoded) {
      return decoded;
    }
    decoded = next;
  }
  return decoded;
}

function stripTags(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferSourceName(rawUrl: string) {
  try {
    const hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
    if (hostname.includes("naver.com")) {
      return "네이버 뉴스";
    }
    return hostname;
  } catch {
    return "뉴스 검색 결과";
  }
}
