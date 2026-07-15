import type { GenericVideoPackageScaffold, VideoSourceBundle } from "./types";
import { buildVideoScriptPlan } from "./script-builder";

export function buildGenericVideoPackageScaffold(bundle: VideoSourceBundle): GenericVideoPackageScaffold {
  const scriptPlan = buildVideoScriptPlan(bundle);
  return {
    sourceType: bundle.sourceType,
    sourceId: bundle.sourceId,
    sourceHash: bundle.sourceSnapshot.hash,
    sourceHashPrefix: bundle.sourceSnapshot.hashPrefix,
    title: bundle.title,
    insightCount: bundle.insights.length,
    visualMaterialCount: bundle.visualMaterials.length,
    riskNoteCount: bundle.riskNotes.length,
    scriptSceneCount: scriptPlan.scenes.length,
    uploadEnabled: false,
    platformUploadsEnabled: false
  };
}
