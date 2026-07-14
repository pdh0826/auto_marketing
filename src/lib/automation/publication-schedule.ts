export type PublicationScheduleChannel = "blogger" | "tistory";

export type PublicationScheduleExecutionMode =
  | "automatic_live_guarded"
  | "approved_content_queue"
  | "registered_blocked";

export interface PublicationScheduleSlot {
  id: string;
  channel: PublicationScheduleChannel;
  label: string;
  category: string;
  time: string;
  timezone: "Asia/Seoul";
  businessDaysOnly: true;
  registered: true;
  generationWired: boolean;
  executionMode: PublicationScheduleExecutionMode;
  active: boolean;
  blockers: string[];
}

export interface PublicationScheduleRuntimeInput {
  bloggerSchedulerEnabled: boolean;
  bloggerScheduleTime: string;
  bloggerLiveMode: boolean;
  publicationSchedulerEnabled: boolean;
  tistoryRecurringPublishApproved: boolean;
  tistorySchedulerEnabled: boolean;
  tistoryLivePublishEnabled: boolean;
  marketFlowSourceConfigured: boolean;
}

export interface PublicationScheduleDefinition {
  id: string;
  channel: PublicationScheduleChannel;
  label: string;
  category: string;
  time: string;
  generationWired: boolean;
  executionMode: PublicationScheduleExecutionMode;
  blockers?: string[];
}

export const PUBLICATION_SCHEDULE_DEFINITIONS: PublicationScheduleDefinition[] = [
  {
    id: "blogger-stock-review",
    channel: "blogger",
    label: "오늘의 투자 유망 종목 리뷰",
    category: "오늘의 투자 유망 종목",
    time: "08:00",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "blogger-etf-review",
    channel: "blogger",
    label: "오늘의 투자 유망 ETF 리뷰",
    category: "오늘의 투자 유망 ETF",
    time: "08:20",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "blogger-korea-intraday",
    channel: "blogger",
    label: "한국장 장중 분석 · 코스피200/나스닥",
    category: "한국장 장중 분석",
    time: "12:20",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "blogger-korea-close",
    channel: "blogger",
    label: "한국장 마감 분석 · 코스피200/나스닥",
    category: "한국장 마감 분석",
    time: "16:10",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "blogger-us-intraday",
    channel: "blogger",
    label: "미국장 장중 분석 · S&P500/나스닥",
    category: "미국장 장중 분석",
    time: "23:30",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "tistory-macro-morning",
    channel: "tistory",
    label: "오늘 아침 금·오일·유로 매매타점",
    category: "선물·옵션 시그널 기록",
    time: "07:00",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "tistory-index-morning",
    channel: "tistory",
    label: "오늘 아침 나스닥·S&P500·코스피200 매매타점",
    category: "선물·옵션 시그널 기록",
    time: "08:00",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "tistory-daily-stock-review",
    channel: "tistory",
    label: "오늘의 관심종목 리뷰",
    category: "오늘의 관심종목 리뷰",
    time: "09:00",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "tistory-focused-signal-review",
    channel: "tistory",
    label: "종목별 신호 집중분석",
    category: "종목별 신호 집중분석",
    time: "13:30",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "tistory-etf-sector-review",
    channel: "tistory",
    label: "ETF 섹터 흐름 리뷰",
    category: "ETF 섹터 흐름 리뷰",
    time: "19:00",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "tistory-macro-us-preopen",
    channel: "tistory",
    label: "미국장 시작 전 금·오일·유로 매매타점",
    category: "선물·옵션 시그널 기록",
    time: "21:00",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  },
  {
    id: "tistory-index-us-preopen",
    channel: "tistory",
    label: "미국장 시작 전 나스닥·S&P500·코스피200 매매타점",
    category: "선물·옵션 시그널 기록",
    time: "22:00",
    generationWired: true,
    executionMode: "automatic_live_guarded"
  }
];

export function buildPublicationSchedule(input: PublicationScheduleRuntimeInput) {
  const slots = PUBLICATION_SCHEDULE_DEFINITIONS.map((definition): PublicationScheduleSlot => {
    const blockers = [...(definition.blockers ?? [])];
    let active = false;

    if (definition.id === "blogger-stock-review") {
      if (!input.bloggerSchedulerEnabled) blockers.push("blogger_scheduler_disabled");
      if (input.bloggerScheduleTime !== definition.time) blockers.push("blogger_schedule_time_mismatch");
      if (!input.bloggerLiveMode) blockers.push("blogger_live_guarded_mode_disabled");
      active = blockers.length === 0;
    } else if (definition.channel === "blogger") {
      if (!input.publicationSchedulerEnabled) blockers.push("publication_scheduler_disabled");
      if (!input.bloggerLiveMode) blockers.push("blogger_live_guarded_mode_disabled");
      active = blockers.length === 0;
    } else if (definition.channel === "tistory") {
      if (!input.tistorySchedulerEnabled) blockers.push("tistory_scheduler_disabled");
      if (!input.tistoryLivePublishEnabled) blockers.push("tistory_live_publish_disabled");
      if (!input.tistoryRecurringPublishApproved) blockers.push("tistory_recurring_publish_approval_required");
      active = blockers.length === 0;
    }

    return {
      ...definition,
      timezone: "Asia/Seoul",
      businessDaysOnly: true,
      registered: true,
      active,
      blockers: Array.from(new Set(blockers))
    };
  });

  return {
    version: "publication_schedule_v2",
    timezone: "Asia/Seoul" as const,
    businessDaysOnly: true as const,
    registrationComplete: true,
    automaticBulkPublishEnabled: false,
    activeSlotCount: slots.filter((slot) => slot.active).length,
    registeredSlotCount: slots.length,
    slots,
    dataSourcePolicy: {
      koreaForeignFlowConfigured: input.marketFlowSourceConfigured,
      koreaForeignFlowOptional: true,
      omittedWhenUnavailableOrIncomplete: true,
      estimatedValuesAllowed: false
    },
    executionPolicy: {
      freshAtScheduledExecution: true,
      steps: [
        "capture_live_screenshots",
        "collect_current_sources",
        "generate_and_review_content",
        "publish_guarded"
      ],
      retryReusesGeneratedCandidate: false,
      futuresRetryAlwaysRecapturesAndRegenerates: true,
      previousScreenshotsOrDraftsReusedOnFirstAttempt: false
      ,automaticRecovery: {
        enabledByDefault: true,
        graceMinutes: 10,
        recoveryWindowMinutes: 120,
        cooldownMinutes: 15,
        maximumTotalAttempts: 5,
        oneRecoverySlotPerTick: true,
        successIsTerminalAndNeverRepublished: true,
        loginAndOauthBypassForbidden: true
      }
    },
    safetyPolicy: {
      duplicateSlotExecutionBlocked: true,
      perContentTistoryApprovalRequired: false,
      recurringScheduleApprovalRequired: true,
      persistentTistoryLoginRequired: true,
      readinessGateRequired: true,
      automaticBulkPublishEnabled: false
    }
  };
}
