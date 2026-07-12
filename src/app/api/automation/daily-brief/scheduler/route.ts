import { NextResponse } from "next/server";
import type { DailyBriefSchedulerMode } from "@/lib/daily-brief/publish-automation";
import { getDailyBriefSchedulerStatus, writeDailyBriefSchedulerConfig } from "@/lib/daily-brief/scheduler";
import { safeErrorMessage } from "@/lib/llm/redaction";

export const runtime = "nodejs";

export async function GET() {
  const status = await getDailyBriefSchedulerStatus();
  return NextResponse.json({ data: status });
}

export async function PATCH(request: Request) {
  try {
    const rawText = await request.text();
    const body = parseJsonObject(rawText);
    const url = new URL(request.url);
    const status = await writeDailyBriefSchedulerConfig({
      enabled: parseOptionalBoolean(readParam(body, url, "enabled")),
      scheduleTime: readStringParam(body, url, "scheduleTime"),
      timezone: readStringParam(body, url, "timezone"),
      businessDaysOnly: parseOptionalBoolean(readParam(body, url, "businessDaysOnly")),
      targetKeyword: readStringParam(body, url, "targetKeyword"),
      stockPickLimit: parseNumber(readParam(body, url, "stockPickLimit")),
      stockDetailLimit: parseNumber(readParam(body, url, "stockDetailLimit")),
      etfPickLimit: parseNumber(readParam(body, url, "etfPickLimit")),
      includeEtfs: parseOptionalBoolean(readParam(body, url, "includeEtfs")),
      mode: parseSchedulerMode(readStringParam(body, url, "mode"))
    });
    return NextResponse.json({ data: status });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error instanceof Error ? error.message : "Daily Brief scheduler update failed.", 500) }, { status: 400 });
  }
}

function readParam(body: Record<string, unknown>, url: URL, key: string) {
  return body[key] ?? url.searchParams.get(key) ?? undefined;
}

function readStringParam(body: Record<string, unknown>, url: URL, key: string) {
  const value = readParam(body, url, key);
  return typeof value === "string" ? value : undefined;
}

function parseJsonObject(rawText: string) {
  if (!rawText.trim()) {
    return {} as Record<string, unknown>;
  }
  try {
    const parsed = JSON.parse(rawText) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseBoolean(value: unknown) {
  return value === true || value === "true";
}

function parseOptionalBoolean(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  return parseBoolean(value);
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseSchedulerMode(value: unknown): DailyBriefSchedulerMode | undefined {
  if (value === "content_only" || value === "draft_save_only" || value === "publish_live_guarded") {
    return value;
  }
  return undefined;
}
