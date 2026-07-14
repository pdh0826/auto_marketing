import type { DailyMarketReportSession } from "./market-report-session";

export interface DailyForeignMarketFlowSnapshot {
  ready: boolean;
  session: DailyMarketReportSession;
  sourceName: string;
  sourceUrl: string | null;
  observedAt: string | null;
  foreignSpotNet: string | null;
  foreignFuturesNet: string | null;
  foreignCallOptionsNet: string | null;
  foreignPutOptionsNet: string | null;
  warnings: string[];
}

const DEFAULT_SOURCE_NAME = "선택형 한국장 투자자별 수급 API";

export async function fetchDailyForeignMarketFlow(session: DailyMarketReportSession): Promise<DailyForeignMarketFlowSnapshot> {
  const sourceUrl = process.env.UPSIGNAL_MARKET_FLOW_URL?.trim() || null;
  if (!sourceUrl) return unavailableSnapshot(session, null, "korea_foreign_flow_optional_omitted");

  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) return unavailableSnapshot(session, sourceUrl, `korea_foreign_flow_http_${response.status}`);
    const raw = (await response.json()) as unknown;
    const parsed = parseMarketFlowResponse(raw, session, sourceUrl);
    if (!parsed.ready) parsed.warnings.push("korea_foreign_flow_required_fields_missing");
    return parsed;
  } catch {
    return unavailableSnapshot(session, sourceUrl, "korea_foreign_flow_request_failed");
  }
}

function parseMarketFlowResponse(raw: unknown, session: DailyMarketReportSession, sourceUrl: string): DailyForeignMarketFlowSnapshot {
  const root = isRecord(raw) && isRecord(raw.data) ? raw.data : isRecord(raw) ? raw : {};
  const foreign = isRecord(root.foreign) ? root.foreign : root;
  const snapshot = {
    ready: false,
    session,
    sourceName: stringValue(root.sourceName) ?? DEFAULT_SOURCE_NAME,
    sourceUrl,
    observedAt: stringValue(root.observedAt),
    foreignSpotNet: stringValue(foreign.spotNet),
    foreignFuturesNet: stringValue(foreign.futuresNet),
    foreignCallOptionsNet: stringValue(foreign.callOptionsNet),
    foreignPutOptionsNet: stringValue(foreign.putOptionsNet),
    warnings: [] as string[]
  };
  snapshot.ready = Boolean(
    snapshot.observedAt &&
      snapshot.foreignSpotNet &&
      snapshot.foreignFuturesNet &&
      snapshot.foreignCallOptionsNet &&
      snapshot.foreignPutOptionsNet
  );
  return snapshot;
}

function unavailableSnapshot(session: DailyMarketReportSession, sourceUrl: string | null, warning: string): DailyForeignMarketFlowSnapshot {
  return {
    ready: false,
    session,
    sourceName: DEFAULT_SOURCE_NAME,
    sourceUrl,
    observedAt: null,
    foreignSpotNet: null,
    foreignFuturesNet: null,
    foreignCallOptionsNet: null,
    foreignPutOptionsNet: null,
    warnings: [warning]
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 120);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
