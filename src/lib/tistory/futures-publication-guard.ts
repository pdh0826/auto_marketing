import { prisma } from "@/lib/db/client";

const DEFAULT_MAX_AGE_MS = 15 * 60_000;

export async function verifyFreshTistoryFuturesCandidateById(
  contentItemId: string,
  options: { required?: boolean; maxAgeMs?: number } = {}
) {
  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: {
      createdAt: true,
      draftMarkdown: true,
      draftHtml: true,
      planJson: true,
      assets: {
        select: { originalName: true, mimeType: true, createdAt: true }
      }
    }
  });
  if (!item) throw new Error("tistory_publication_candidate_missing");
  const plan = isRecord(item.planJson) ? item.planJson : {};
  const selection = isRecord(plan.selection) ? plan.selection : {};
  const futuresCandidate = plan.kind === "daily_tistory_signal_review" && selection.mode === "futures_options_signal_record";
  if (!futuresCandidate) {
    if (options.required) throw new Error("tistory_futures_candidate_kind_mismatch");
    return { applicable: false as const };
  }

  const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const now = Date.now();
  if (plan.generationTimingPolicy !== "collect_capture_write_review_publish_in_same_scheduled_execution") {
    throw new Error("tistory_futures_generation_timing_policy_mismatch");
  }
  if (now - item.createdAt.getTime() > maxAgeMs) throw new Error("tistory_futures_candidate_stale");

  const chartAssets = item.assets.filter((asset) =>
    asset.mimeType === "image/png" && asset.originalName.startsWith("tistory-futures-") && asset.originalName.includes("-signal-detail")
  );
  if (chartAssets.length < 3) throw new Error("tistory_futures_chart_count_not_ready");
  if (chartAssets.some((asset) => now - asset.createdAt.getTime() > maxAgeMs)) {
    throw new Error("tistory_futures_chart_stale");
  }

  const markdown = item.draftMarkdown ?? "";
  const html = item.draftHtml ?? "";
  const mediaBlocks = markdown.match(/<!--\s*media:[^>]+-->/g) ?? [];
  if (mediaBlocks.length < 4) throw new Error("tistory_futures_media_structure_not_ready");
  if (/<!--\s*media:[^>]+-->\s*(?:\n\s*)<!--\s*media:[^>]+-->\s*(?:\n\s*)<!--\s*media:[^>]+-->/m.test(markdown)) {
    throw new Error("tistory_futures_consecutive_chart_dump_blocked");
  }
  if (!/<table\b/i.test(html) || /&lt;\/?table\b/i.test(html)) {
    throw new Error("tistory_futures_summary_table_not_rendered");
  }
  if (/&lt;\/?(?:div|table|thead|tbody|tr|th|td)\b/i.test(html)) {
    throw new Error("tistory_futures_escaped_html_blocked");
  }
  if (!hasNarrativeAfterEveryFuturesChart(markdown)) {
    throw new Error("tistory_futures_chart_narrative_missing");
  }
  if (!hasUpsignalLinkAfterEveryFuturesChart(markdown)) {
    throw new Error("tistory_futures_chart_upsignal_link_missing");
  }
  if (hasTradeDirectionConflict(markdown)) {
    throw new Error("tistory_futures_trade_direction_conflict");
  }

  return {
    applicable: true as const,
    maxAgeMs,
    chartCount: chartAssets.length,
    candidateAgeMs: now - item.createdAt.getTime(),
    newestChartAgeMs: Math.max(...chartAssets.map((asset) => now - asset.createdAt.getTime()))
  };
}

function hasUpsignalLinkAfterEveryFuturesChart(markdown: string) {
  const chartPattern = /<!--\s*media:[^>]+caption:"[^"]*(?:선물|매매 시그널)[^"]*"[^>]*-->/g;
  const matches = Array.from(markdown.matchAll(chartPattern));
  if (matches.length < 3) return false;
  return matches.every((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? markdown.length : markdown.length;
    return /\[급등포착\]\(https:\/\/upsignal\.co\.kr\/?\)/.test(markdown.slice(start, end));
  });
}

function hasNarrativeAfterEveryFuturesChart(markdown: string) {
  const chartPattern = /<!--\s*media:[^>]+caption:"[^"]*(?:선물|매매 시그널)[^"]*"[^>]*-->/g;
  const matches = Array.from(markdown.matchAll(chartPattern));
  if (matches.length < 3) return false;
  return matches.every((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? markdown.length : markdown.length;
    const between = markdown.slice(start, end)
      .replace(/^#+\s+.*$/gm, "")
      .replace(/^>.*$/gm, "")
      .replace(/\[[^\]]+\]\([^)]+\)/g, "")
      .replace(/[*_`#|>-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return between.length >= 120;
  });
}

function hasTradeDirectionConflict(markdown: string) {
  const sections = markdown.split(/^##\s+/m).slice(1);
  return sections.some((section) => {
    const heading = section.split("\n", 1)[0] ?? "";
    const body = section.slice(heading.length);
    return (/매수 타점/.test(heading) && /\*\*매도 진입\*\*/.test(body)) ||
      (/매도 타점/.test(heading) && /\*\*매수 진입\*\*/.test(body));
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
