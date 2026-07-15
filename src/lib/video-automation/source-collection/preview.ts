import { assertVideoSourceBundleSafe } from "../core/source-bundle";
import { buildGenericVideoPackageScaffold } from "../core/package-builder";
import { buildVideoScriptPlan } from "../core/script-builder";
import type { VideoSourceBundle } from "../core/types";
import { assertCollectedVideoSourceSafe } from "./safety";
import type { CollectedVideoSource, VideoSourcePreviewResult } from "./types";

export function buildVideoSourcePreviewResult(collection: CollectedVideoSource, sourceBundle: VideoSourceBundle): VideoSourcePreviewResult {
  const packageScaffold = buildGenericVideoPackageScaffold(sourceBundle);
  const scriptPlan = buildVideoScriptPlan(sourceBundle);
  const blockingReasons = [
    collection.evidence.length === 0 ? "video_source_evidence_required" : null,
    assertCollectedVideoSourceSafe(collection) ? null : "video_source_collection_safety_violation",
    assertVideoSourceBundleSafe(sourceBundle) ? null : "video_source_bundle_safety_violation",
    packageScaffold.uploadEnabled === false && packageScaffold.platformUploadsEnabled === false ? null : "video_source_upload_flags_must_stay_disabled"
  ].filter((item): item is string => Boolean(item));
  const warnings = [
    collection.sideEffectSummary.networkRead ? "network_read_source_review_required" : null,
    collection.collectionKind === "generic_url" ? "generic_url_fetch_not_implemented_preview_only" : null
  ].filter((item): item is string => Boolean(item));

  return {
    kind: "video_source_preview",
    version: "VIDEO-4",
    collection: {
      kind: collection.collectionKind,
      sourceType: collection.sourceType,
      sourceId: collection.sourceId,
      sourceUrl: collection.sourceUrl,
      collectedAt: collection.collectedAt,
      evidenceCount: collection.evidence.length,
      visualCandidateCount: collection.visualCandidates.length,
      safetyPolicy: collection.safetyPolicy,
      sideEffectSummary: collection.sideEffectSummary
    },
    sourceBundle,
    packageScaffold,
    scriptPlan,
    readiness: {
      ready: blockingReasons.length === 0,
      blockingReasons,
      warnings
    }
  };
}
