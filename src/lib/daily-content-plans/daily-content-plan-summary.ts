export interface DailyContentPlanSummary {
  checked: true;
  mode: "preview" | "apply";
  planVersion: "9F-2A";
  planMode: "daily_auto_content_plan_draft";
  profileFound: boolean;
  profileHealthy: boolean;
  planWouldBeCreated: boolean;
  planWouldBeUpdated: boolean;
  applyAttempted: boolean;
  applyBlocked: boolean;
  applyOk: boolean;
  featureFlagEnabled: boolean;
  confirmationPhraseAccepted: boolean;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  planDateLocal: string;
  timezone: "Asia/Seoul";
  operationMode: "approval_required";
  defaultPublishPolicyPreset: "safe_manual_publish";
  contentGenerationEnabled: false;
  llmCallEnabled: false;
  publishExecutionEnabled: false;
  scheduledPublishEnabled: false;
  policySnapshot: Record<string, unknown>;
  planItems: Array<{
    syntheticPlanItemId: string;
    itemOrder: number;
    slotKey: string;
    topicSeed: string;
    contentIntent: string;
    audienceHint: string;
    riskNote: string;
    publishMode: "approval_required";
    draftGenerationAllowed: false;
    llmGenerationAllowed: false;
    publishExecutionAllowed: false;
    scheduledPublishAllowed: false;
    requiresHumanApproval: true;
    operatorTakeaway: string;
  }>;
  planTotals: {
    plannedItemCount: number;
    approvalRequiredCount: number;
    llmGenerationAllowedCount: 0;
    publishExecutionAllowedCount: 0;
    scheduledPublishAllowedCount: 0;
  };
  guardrailSummary: {
    noContentGeneration: true;
    noLlmCall: true;
    noContentItemMutation: true;
    noBloggerWrite: true;
    noPublishExecution: true;
    noScheduledPublish: true;
    profilePolicyUsed: boolean;
  };
  blockingReasons: string[];
  warnings: string[];
  sideEffectSummary: {
    dbRead: boolean;
    dbWrite: boolean;
    schemaMigration: boolean;
    bloggerRead: false;
    bloggerWrite: false;
    bloggerPublish: false;
    bloggerUpdate: false;
    bloggerDraftSave: false;
    tokenRefresh: false;
    oauthReconnect: false;
    contentGeneration: false;
    contentMutation: false;
    approvalMutation: false;
    attemptMutation: false;
    llmCall: false;
    externalSend: false;
  };
}

export interface DailyContentPlanResponse {
  checkedAt: string;
  dailyContentPlanSummary: DailyContentPlanSummary;
}
