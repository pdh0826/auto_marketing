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
      name,
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
