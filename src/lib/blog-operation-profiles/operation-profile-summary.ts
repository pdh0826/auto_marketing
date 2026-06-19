export interface BlogOperationProfileSummary {
  checked: true;
  mode: "preview" | "apply";
  profileFound: boolean;
  profileWouldBeCreated: boolean;
  profileWouldBeUpdated: boolean;
  applyAttempted: boolean;
  applyBlocked: boolean;
  applyOk: boolean;
  featureFlagEnabled: boolean;
  confirmationPhraseAccepted: boolean;
  targetBloggerBlogId: string | null;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  proposedProfile: {
    profileName: "Default";
    status: "active";
    operationMode: "approval_required";
    defaultPublishPolicyPreset: "safe_manual_publish";
    allowAutoPublish: false;
    allowScheduledPublish: false;
    requireOAuthGate: true;
    requireFinalHumanApproval: true;
    requireExternalWriteRiskAck: true;
    requireRollbackPlanAck: true;
    requireReadbackAfterPublish: true;
    requirePostPublishReconciliation: true;
    timezone: "Asia/Seoul";
  };
  defaultPublishPolicy: Record<string, unknown>;
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
    contentMutation: false;
    approvalMutation: false;
    attemptMutation: false;
    llmCall: false;
    externalSend: false;
  };
}

export interface BlogOperationProfileResponse {
  checkedAt: string;
  blogOperationProfileSummary: BlogOperationProfileSummary;
}
