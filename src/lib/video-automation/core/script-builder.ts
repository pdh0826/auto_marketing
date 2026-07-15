import type { VideoScriptPlan, VideoScriptScene, VideoSourceBundle } from "./types";
import { truncateText } from "./source-bundle";

export function buildVideoScriptPlan(bundle: VideoSourceBundle): VideoScriptPlan {
  const topInsights = [...bundle.insights].sort((a, b) => a.priority - b.priority).slice(0, 6);
  const scenes: VideoScriptScene[] = topInsights.map((insight, index) => {
    const visualMaterial = bundle.visualMaterials.find((material) => insight.sourceRefs.includes(material.sourceRef)) ?? bundle.visualMaterials[index] ?? null;
    return {
      id: `script-scene-${index + 1}`,
      title: insight.title,
      narration: buildInsightNarration(insight.title, insight.summary, insight.evidenceText),
      sourceInsightIds: [insight.id],
      visualMaterialIds: visualMaterial ? [visualMaterial.id] : []
    };
  });
  const riskNote = bundle.riskNotes[0] ?? null;
  const hook = `${bundle.title}의 핵심 인사이트를 짧게 정리합니다.`;
  const closing = riskNote ?? "이 콘텐츠는 정보 제공 목적이며 최종 판단은 사용자 본인에게 있습니다.";
  const fullScript = renderVideoScript({
    hook,
    scenes,
    closing,
    riskNote
  });
  return {
    sourceHash: bundle.sourceSnapshot.hash,
    sourceHashPrefix: bundle.sourceSnapshot.hashPrefix,
    language: bundle.language,
    hook,
    scenes,
    closing,
    riskNote,
    fullScript
  };
}

export function renderVideoScript(input: {
  hook: string;
  scenes: VideoScriptScene[];
  closing: string;
  riskNote: string | null;
}) {
  return `${[
    input.hook,
    ...input.scenes.map((scene) => scene.narration),
    input.riskNote && input.closing !== input.riskNote ? input.closing : null,
    input.riskNote ?? (input.closing || null)
  ]
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => line.trim())
    .join("\n")}\n`;
}

function buildInsightNarration(title: string, summary: string, evidenceText: string) {
  const evidence = evidenceText && evidenceText !== summary ? ` 근거는 ${truncateText(evidenceText, 120)}입니다.` : "";
  return `${truncateText(title, 80)}. ${truncateText(summary, 180)}.${evidence}`;
}
