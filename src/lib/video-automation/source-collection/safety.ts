import type { CollectedVideoSource, SourceCollectionSafetyPolicy, SourceCollectionSideEffectSummary } from "./types";
import { redactUnsafeSourceValue, stripHtml, truncateText } from "../core/source-bundle";

export const DEFAULT_SOURCE_COLLECTION_POLICY: SourceCollectionSafetyPolicy = {
  mode: "read_only_preview",
  maxSnippetChars: 500,
  maxEvidenceItems: 12,
  maxVisualCandidates: 12,
  allowNetworkRead: false,
  allowedDomains: [],
  requireAttribution: true,
  storeFullBody: false,
  externalWriteEnabled: false,
  secretReadEnabled: false,
  llmCallEnabled: false
};

export function buildSourceCollectionPolicy(overrides: Partial<SourceCollectionSafetyPolicy> = {}): SourceCollectionSafetyPolicy {
  return {
    ...DEFAULT_SOURCE_COLLECTION_POLICY,
    ...overrides,
    mode: "read_only_preview",
    storeFullBody: false,
    externalWriteEnabled: false,
    secretReadEnabled: false,
    llmCallEnabled: false
  };
}

export function buildSourceCollectionSideEffects(overrides: Partial<Pick<SourceCollectionSideEffectSummary, "dbRead" | "networkRead">> = {}): SourceCollectionSideEffectSummary {
  return {
    sourceRead: true,
    sourceWrite: false,
    dbRead: overrides.dbRead ?? false,
    dbWrite: false,
    networkRead: overrides.networkRead ?? false,
    localFileWrite: false,
    externalServiceWrite: false,
    secretRead: false,
    llmCall: false,
    schedulerMutation: false
  };
}

export function clampSnippet(value: string, maxLength: number) {
  return truncateText(stripHtml(value).replace(/\s+/g, " ").trim(), maxLength);
}

export function splitEvidenceSnippets(value: string, input: { maxSnippetChars: number; maxItems: number }) {
  const normalized = stripHtml(value).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [];
  }
  const roughSentences = normalized.split(/(?<=[.!?。！？다요죠음임함됨됨니다])\s+/).filter(Boolean);
  const candidates = roughSentences.length > 1 ? roughSentences : normalized.split(/\n+/).filter(Boolean);
  return candidates
    .map((item) => clampSnippet(item, input.maxSnippetChars))
    .filter(Boolean)
    .slice(0, input.maxItems);
}

export function normalizeHttpUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("video_source_url_must_be_http_or_https");
  }
  parsed.hash = "";
  return parsed.toString();
}

export function domainFromUrl(value: string) {
  return new URL(value).hostname.toLowerCase();
}

export function assertAllowedDomain(sourceUrl: string, allowedDomains: string[]) {
  const domain = domainFromUrl(sourceUrl);
  if (!allowedDomains.some((allowed) => domain === allowed.toLowerCase() || domain.endsWith(`.${allowed.toLowerCase()}`))) {
    throw new Error("video_source_domain_not_allowed");
  }
}

export function assertCollectedVideoSourceSafe(source: CollectedVideoSource) {
  const safeSource = redactUnsafeSourceValue(source);
  if (JSON.stringify(safeSource) !== JSON.stringify(source)) {
    return false;
  }
  const sideEffects = source.sideEffectSummary;
  return (
    source.safetyPolicy.mode === "read_only_preview" &&
    source.safetyPolicy.storeFullBody === false &&
    source.safetyPolicy.externalWriteEnabled === false &&
    source.safetyPolicy.secretReadEnabled === false &&
    source.safetyPolicy.llmCallEnabled === false &&
    sideEffects.sourceWrite === false &&
    sideEffects.dbWrite === false &&
    sideEffects.localFileWrite === false &&
    sideEffects.externalServiceWrite === false &&
    sideEffects.secretRead === false &&
    sideEffects.llmCall === false &&
    sideEffects.schedulerMutation === false &&
    source.evidence.every((item) => item.textSnippet.length <= source.safetyPolicy.maxSnippetChars)
  );
}
