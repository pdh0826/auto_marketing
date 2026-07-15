import type { VideoVisualMaterial, VideoVisualMaterialKind } from "./types";

export function buildTextCardMaterial(input: {
  id: string;
  title: string;
  description: string;
  sourceRef: string;
}): VideoVisualMaterial {
  return {
    id: input.id,
    kind: "text_card",
    title: input.title,
    description: input.description,
    sourceRef: input.sourceRef,
    fileName: null,
    mimeType: null,
    width: null,
    height: null,
    safeForPublicUse: true
  };
}

export function buildSafeVisualMaterial(input: {
  id: string;
  kind: VideoVisualMaterialKind;
  title: string;
  description: string;
  sourceRef: string;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  safeForPublicUse?: boolean;
}): VideoVisualMaterial {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    description: input.description,
    sourceRef: input.sourceRef,
    fileName: input.fileName ?? null,
    mimeType: input.mimeType ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    safeForPublicUse: input.safeForPublicUse ?? true
  };
}
