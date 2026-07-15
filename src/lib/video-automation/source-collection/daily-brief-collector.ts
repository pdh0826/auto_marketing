import type { DailyBriefRun } from "@/lib/daily-brief/types";
import { buildDailyBriefVideoSourceBundle } from "../adapters/daily-brief-source";
import type { VideoSourcePreviewResult } from "./types";
import { collectFromVideoSourceBundle, buildCollectedBundlePreview } from "./bundle-collection";

export function collectDailyBriefVideoSource(run: DailyBriefRun, collectedAt?: string) {
  return collectFromVideoSourceBundle(buildDailyBriefVideoSourceBundle(run), {
    collectionKind: "daily_brief",
    collectedAt,
    networkRead: false
  });
}

export function buildDailyBriefVideoSourcePreview(run: DailyBriefRun, collectedAt?: string): VideoSourcePreviewResult {
  return buildCollectedBundlePreview(buildDailyBriefVideoSourceBundle(run), {
    collectionKind: "daily_brief",
    collectedAt,
    networkRead: false
  });
}
