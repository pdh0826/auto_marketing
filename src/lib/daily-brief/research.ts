import type { DailyBriefResearchItem, DailyBriefStockPick } from "./types";

export async function collectDailyBriefResearch(stockPicks: DailyBriefStockPick[], perStockLimit = 2) {
  const items: DailyBriefResearchItem[] = [];

  for (const pick of stockPicks) {
    const query = `${pick.name} ${pick.code} 최근 뉴스 공시`;
    const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
    const parsed = await fetchNaverNewsItems(searchUrl).catch(() => []);
    const selected = parsed.slice(0, perStockLimit);

    if (selected.length === 0) {
      items.push({
        symbolCode: pick.code,
        symbolName: pick.name,
        query,
        searchUrl,
        title: `${pick.name} 최근 뉴스/공시 확인 필요`,
        source: "search_link",
        publishedAt: null,
        url: searchUrl,
        shortSummary: "자동 수집 결과가 충분하지 않아 검색 링크를 검토 후보로 남겼습니다."
      });
      continue;
    }

    for (const item of selected) {
      items.push({
        symbolCode: pick.code,
        symbolName: pick.name,
        query,
        searchUrl,
        ...item
      });
    }
  }

  return items;
}

async function fetchNaverNewsItems(searchUrl: string) {
  const response = await fetch(searchUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "BlogGrowthAgent/1.0 read-only daily brief"
    }
  });
  if (!response.ok) {
    throw new Error(`news_search_failed:${response.status}`);
  }
  const html = await response.text();
  const matches = Array.from(html.matchAll(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*(?:news_tit|news_title)[^"]*"[^>]*title="([^"]+)"[\s\S]*?<\/a>/g));

  return matches.slice(0, 5).map((match) => ({
    title: decodeHtml(match[2]).trim(),
    source: "naver_news_search",
    publishedAt: null,
    url: decodeHtml(match[1]).trim(),
    shortSummary: "최근 뉴스 검색 결과입니다. 본문 전문은 저장하지 않고 제목/출처/URL만 참고합니다."
  }));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}
