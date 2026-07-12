import type { DailyBriefEtfPick, DailyBriefStockPick } from "./types";

const UPSIGNAL_ORIGIN = "https://upsignal.co.kr";

export async function fetchKrStockPicks(limit: number) {
  const html = await fetchText(`${UPSIGNAL_ORIGIN}/kr`);
  return parseKrStockPicks(html, limit);
}

export async function fetchEtfPicks(limit: number) {
  const html = await fetchText(`${UPSIGNAL_ORIGIN}/etf/summary`);
  return parseEtfPicks(html, limit);
}

export function parseKrStockPicks(html: string, limit: number): DailyBriefStockPick[] {
  const embedded = parseEmbeddedKrStockPicks(html, limit);
  if (embedded.length > 0) {
    return embedded;
  }

  const linkRegex = /<a[^>]+href="([^"]*\/kr\/stocks\/([^"?/]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const picks: DailyBriefStockPick[] = [];
  let match = linkRegex.exec(html);

  while (match && picks.length < limit) {
    const text = normalizeText(stripTags(match[3]));
    const code = match[2];
    if (picks.some((pick) => pick.code === code)) {
      match = linkRegex.exec(html);
      continue;
    }

    const numbers = Array.from(text.matchAll(/[\d,]+(?:\.\d+)?/g)).map((item) => item[0]);
    const name = text.split(/\s+/)[0] ?? code;
    const score = numbers[numbers.length - 1] ?? null;
    picks.push({
      rank: picks.length + 1,
      name,
      code,
      market: "KR",
      statusLabel: extractStatus(text),
      currentPrice: numbers[1] ?? null,
      entryPrice: numbers[2] ?? null,
      targetPrice: numbers[3] ?? null,
      stopLoss: null,
      recentSignalDate: null,
      trendScore: numbers[numbers.length - 2] ?? null,
      totalScore: score,
      detailUrl: absoluteUrl(match[1]),
      chartCaptureId: null
    });
    match = linkRegex.exec(html);
  }

  return picks;
}

export function parseEtfPicks(html: string, limit: number): DailyBriefEtfPick[] {
  const embedded = parseEmbeddedEtfPicks(html, limit);
  if (embedded.length > 0) {
    return embedded;
  }

  const linkRegex = /<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
  const picks: DailyBriefEtfPick[] = [];
  let match = linkRegex.exec(html);

  while (match && picks.length < limit) {
    const text = normalizeText(stripTags(match[2]));
    const codeMatch = text.match(/\b(\d{6})\b/);
    const scoreMatch = text.match(/(\d{2,3}(?:\.\d+)?)\s*점수/);
    if (!codeMatch || !scoreMatch) {
      match = linkRegex.exec(html);
      continue;
    }

    const words = text.split(/\s+/);
    const name = words.slice(0, Math.max(1, words.indexOf(codeMatch[1]))).join(" ").trim() || codeMatch[1];
    const targetPotential = text.match(/목표여력\s*([+\-]?\d+(?:\.\d+)?%)/)?.[1] ?? null;
    const recentBuyDate = text.match(/최근매수\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    const currentReturn = text.match(/현재수익률\s*([+\-]?\d+(?:\.\d+)?%|-)/)?.[1] ?? null;
    const currentPrice = text.match(/현재가\s*([\d,]+)/)?.[1] ?? null;
    picks.push({
      rank: picks.length + 1,
      name: cleanEtfName(name),
      code: codeMatch[1],
      category: extractEtfCategory(text),
      statusLabel: extractStatus(text),
      currentPrice,
      targetPotential,
      recentBuyDate,
      currentReturn,
      totalScore: scoreMatch[1]
    });

    match = linkRegex.exec(html);
  }

  return picks;
}

function parseEmbeddedKrStockPicks(html: string, limit: number): DailyBriefStockPick[] {
  return extractEmbeddedObjects(html)
    .filter((item) => field(item, "market") === "KR" && field(item, "asset_type") === "stock")
    .slice(0, limit)
    .map((item, index) => {
      const code = field(item, "symbol") ?? "";
      return {
        rank: index + 1,
        name: cleanEtfName(field(item, "name") ?? code),
        code,
        market: "KR",
        statusLabel: field(item, "recommendation_state") ?? field(item, "action_badge"),
        currentPrice: formatNumber(numberField(item, "close_price")),
        entryPrice: formatNumber(planNumberField(item, "entry")),
        targetPrice: formatNumber(planNumberField(item, "target") ?? numberField(item, "target_price")),
        stopLoss: formatNumber(planNumberField(item, "stop")),
        recentSignalDate: field(item, "latest_signal_date"),
        trendScore: formatScore(numberField(item, "market_attention_score")),
        totalScore: formatScore(numberField(item, "total_score")),
        detailUrl: `${UPSIGNAL_ORIGIN}/kr/stocks/${code}?tab=chart&horizon=swing`,
        chartCaptureId: null
      };
    })
    .filter((pick) => pick.code.length > 0);
}

function parseEmbeddedEtfPicks(html: string, limit: number): DailyBriefEtfPick[] {
  return extractEmbeddedObjects(html)
    .filter((item) => field(item, "asset_type") === "etf" || field(item, "category") !== null)
    .slice(0, limit)
    .map((item, index) => {
      const code = field(item, "symbol") ?? "";
      return {
        rank: index + 1,
        name: cleanEtfName(field(item, "name") ?? code),
        code,
        category: field(item, "category") ?? field(item, "group_label"),
        statusLabel: field(item, "recommendation_state") ?? field(item, "action_badge"),
        currentPrice: formatNumber(numberField(item, "close_price")),
        targetPotential: formatPercent(numberField(item, "target_upside_pct")),
        recentBuyDate: field(item, "latest_signal_date"),
        currentReturn: formatPercent(numberField(item, "strategy_return_pct")),
        totalScore: formatScore(numberField(item, "total_score"))
      };
    })
    .filter((pick) => pick.code.length > 0);
}

function extractEmbeddedObjects(html: string) {
  const normalized = decodeEscapedPageData(html);
  const fragments = normalized.split("{\"symbol\":\"").slice(1);
  const seen = new Set<string>();
  const objects: string[] = [];

  for (const fragment of fragments) {
    const objectText = `{"symbol":"${fragment.split(",\"scoreTone\"")[0]}`;
    const symbol = field(objectText, "symbol");
    if (!symbol || seen.has(symbol)) {
      continue;
    }
    seen.add(symbol);
    objects.push(objectText);
  }

  return objects;
}

function decodeEscapedPageData(value: string) {
  return value
    .replace(/\\"/g, "\"")
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\n/g, " ");
}

function field(objectText: string, key: string) {
  return objectText.match(new RegExp(`"${escapeRegExp(key)}":"([^"]*)"`))?.[1] ?? null;
}

function numberField(objectText: string, key: string) {
  const raw = objectText.match(new RegExp(`"${escapeRegExp(key)}":(-?\\d+(?:\\.\\d+)?|null)`))?.[1] ?? null;
  return raw && raw !== "null" ? Number(raw) : null;
}

function planNumberField(objectText: string, key: string) {
  const planMatch = objectText.match(/"plan":\{([^}]*)\}/)?.[1] ?? "";
  return numberField(planMatch, key);
}

function formatNumber(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value).toLocaleString("ko-KR") : null;
}

function formatScore(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, "") : null;
}

function formatPercent(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` : null;
}

function cleanEtfName(value: string) {
  const noisyBadges = [
    "미국 대표지수",
    "배당·커버드콜",
    "채권·금리",
    "배당·인컴",
    "미국·해외",
    "현금성",
    "방어형",
    "인컴"
  ];
  let next = value;
  for (const badge of noisyBadges) {
    next = next.replace(new RegExp(`\\s*${escapeRegExp(badge)}\\s*`, "g"), " ");
  }
  next = next.replace(/\s+/g, " ").trim();
  next = next.replace(/\(H\s+미국\s*기술주$/i, "(H)");
  next = next.replace(/\s+미국\s*기술주$/i, "");
  return next.trim();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "BlogGrowthAgent/1.0 read-only daily brief"
    }
  });
  if (!response.ok) {
    throw new Error(`upsignal_fetch_failed:${response.status}`);
  }
  return response.text();
}

function extractStatus(text: string) {
  const statuses = ["진입 준비", "감시 강화", "관찰 유지", "강력 후보", "경계"];
  return statuses.find((status) => text.includes(status)) ?? null;
}

function extractEtfCategory(text: string) {
  const categories = ["미국·해외", "배당·인컴", "채권·금리·현금성", "미국 대표지수", "배당·커버드콜", "현금성", "채권·금리"];
  return categories.find((category) => text.includes(category)) ?? null;
}

function absoluteUrl(value: string) {
  if (value.startsWith("http")) {
    return value;
  }
  return `${UPSIGNAL_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTags(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function normalizeText(value: string) {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
