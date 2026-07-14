import { NextResponse } from "next/server";
import { buildPublicationSchedule } from "@/lib/automation/publication-schedule";
import { getPublicationSchedulerStatus, updatePublicationSchedulerConfig } from "@/lib/automation/publication-scheduler";
import { getDailyBriefSchedulerStatus } from "@/lib/daily-brief/scheduler";
import { getTistoryPublisherStatus } from "@/lib/tistory/publisher-scheduler";
import { getPublicationReportStatus } from "@/lib/automation/publication-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [blogger, tistory, publication, dailyReport] = await Promise.all([
    getDailyBriefSchedulerStatus(),
    getTistoryPublisherStatus(),
    getPublicationSchedulerStatus(),
    getPublicationReportStatus()
  ]);
  const data = buildPublicationSchedule({
    bloggerSchedulerEnabled: blogger.config.enabled,
    bloggerScheduleTime: blogger.config.scheduleTime,
    bloggerLiveMode: blogger.config.mode === "publish_live_guarded",
    publicationSchedulerEnabled: publication.config.enabled,
    tistoryRecurringPublishApproved: publication.config.tistoryRecurringPublishApproved,
    tistorySchedulerEnabled: tistory.config.enabled,
    tistoryLivePublishEnabled: tistory.config.livePublishEnabled,
    marketFlowSourceConfigured: Boolean(process.env.UPSIGNAL_MARKET_FLOW_URL?.trim())
  });

  return NextResponse.json({ data: { ...data, scheduler: publication, dailyReport } });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  await updatePublicationSchedulerConfig({
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    tistoryRecurringPublishApproved: typeof body.tistoryRecurringPublishApproved === "boolean" ? body.tistoryRecurringPublishApproved : undefined,
    retryDelayMinutes: typeof body.retryDelayMinutes === "number" ? body.retryDelayMinutes : undefined,
    maxAttempts: typeof body.maxAttempts === "number" ? body.maxAttempts : undefined,
    autoRecoveryEnabled: typeof body.autoRecoveryEnabled === "boolean" ? body.autoRecoveryEnabled : undefined,
    recoveryGraceMinutes: typeof body.recoveryGraceMinutes === "number" ? body.recoveryGraceMinutes : undefined,
    recoveryWindowMinutes: typeof body.recoveryWindowMinutes === "number" ? body.recoveryWindowMinutes : undefined,
    recoveryMaxAttempts: typeof body.recoveryMaxAttempts === "number" ? body.recoveryMaxAttempts : undefined,
    recoveryCooldownMinutes: typeof body.recoveryCooldownMinutes === "number" ? body.recoveryCooldownMinutes : undefined
  });
  return GET();
}
