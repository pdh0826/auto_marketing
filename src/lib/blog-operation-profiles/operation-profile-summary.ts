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
  operationProfileExceptionDashboardSummary: OperationProfileExceptionDashboardSummary;
  operationProfilePolicySimulationSummary: OperationProfilePolicySimulationSummary;
  operationProfileScenarioMatrixSummary: OperationProfileScenarioMatrixSummary;
}

export interface OperationProfileAdvisorySummary {
  checked: true;
  advisoryOnly: true;
  policyEnforced: false;
  blockerImpact: false;
  executionPermissionImpact: false;
  profileLookupAttempted: true;
  profileFound: boolean;
  profileId: string | null;
  targetBloggerBlogId: string | null;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  profileStatus: string | null;
  operationMode: string | null;
  defaultPublishPolicyPreset: string | null;
  timezone: string | null;
  allowAutoPublish: boolean | null;
  allowScheduledPublish: boolean | null;
  requireOAuthGate: boolean | null;
  requireFinalHumanApproval: boolean | null;
  requireExternalWriteRiskAck: boolean | null;
  requireRollbackPlanAck: boolean | null;
  requireReadbackAfterPublish: boolean | null;
  requirePostPublishReconciliation: boolean | null;
  matches: {
    targetBloggerBlogIdMatches: boolean;
    targetBloggerBlogUrlMatches: boolean;
    profileIsActive: boolean;
    presetIsSafeManualPublish: boolean;
    operationModeIsApprovalRequired: boolean;
    autoPublishDisabled: boolean;
    scheduledPublishDisabled: boolean;
    requiredManualGuardsEnabled: boolean;
  };
  defaultPublishPolicyPreview: Record<string, unknown>;
  advisoryWarnings: string[];
  advisoryNotes: string[];
  blockingReasons: [];
  sideEffectSummary: {
    dbRead: true;
    dbWrite: false;
    schemaMigration: false;
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

export interface OperationProfileExceptionDashboardSummary {
  checked: true;
  dashboardVersion: "9F-1D";
  dashboardMode: "exception_only_draft";
  advisoryOnly: true;
  policyEnforced: false;
  blockerImpact: false;
  executionPermissionImpact: false;
  profileFound: boolean;
  profileHealthy: boolean;
  attentionLevel: "ok" | "info" | "warning" | "blocked_by_existing_gate";
  normalItemCount: number;
  warningItemCount: number;
  exceptionItemCount: number;
  headline: string;
  operatorSummary: string;
  focusItems: Array<{
    severity: "info" | "warning" | "exception";
    code: string;
    label: string;
    detail: string;
    source: "operation_profile" | "publish_gate" | "oauth_gate" | "system";
  }>;
  collapsedNormalItems: Array<{
    code: string;
    label: string;
    value: string | boolean | number | null;
  }>;
  profilePolicySnapshot: {
    targetBloggerBlogId: string | null;
    targetBloggerBlogName: string | null;
    operationMode: string | null;
    defaultPublishPolicyPreset: string | null;
    allowAutoPublish: boolean | null;
    allowScheduledPublish: boolean | null;
    requireOAuthGate: boolean | null;
    requireFinalHumanApproval: boolean | null;
    requireReadbackAfterPublish: boolean | null;
    requirePostPublishReconciliation: boolean | null;
  };
  advisoryWarnings: string[];
  advisoryNotes: string[];
  blockingReasons: [];
  sideEffectSummary: {
    dbRead: boolean;
    dbWrite: false;
    schemaMigration: false;
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

export interface OperationProfilePolicySimulationSummary {
  checked: true;
  simulationVersion: "9F-1E";
  simulationMode: "policy_enforcement_dry_run";
  advisoryOnly: true;
  policyEnforced: false;
  actualBlockerImpact: false;
  actualExecutionPermissionImpact: false;
  profileFound: boolean;
  profileHealthy: boolean;
  profileWouldBeApplicable: boolean;
  targetBloggerBlogId: string | null;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  operationMode: string | null;
  defaultPublishPolicyPreset: string | null;
  actualGateState: {
    canProceedToPublishExecution: boolean | null;
    canProceedToScheduledPublishExecution: boolean | null;
    canExecutePublish: boolean | null;
    canExecuteScheduledPublish: boolean | null;
    canPublish: boolean | null;
    canSchedulePublish: boolean | null;
    blockingReasons: string[];
    warnings: string[];
  };
  simulatedPolicyState: {
    wouldRequireOAuthGate: true;
    wouldRequireFinalHumanApproval: true;
    wouldRequireExternalWriteRiskAck: true;
    wouldRequireRollbackPlanAck: true;
    wouldRequireReadbackAfterPublish: true;
    wouldRequirePostPublishReconciliation: true;
    wouldAllowAutoPublish: false;
    wouldAllowScheduledPublish: false;
    wouldAllowPublishWithoutHumanApproval: false;
  };
  simulatedAdditionalBlockers: string[];
  simulatedRemovedBlockers: string[];
  simulatedWarnings: string[];
  simulatedDecision: {
    wouldAllowPublishExecution: false;
    wouldAllowScheduledPublishExecution: false;
    wouldRequireManualApproval: true;
    wouldRequireExceptionReview: boolean;
    wouldKeepCurrentGateDecision: boolean;
  };
  comparison: {
    actualCanExecutePublish: boolean | null;
    simulatedCanExecutePublish: false;
    actualCanPublish: boolean | null;
    simulatedCanPublish: false;
    actualBlockingReasonCount: number;
    simulatedAdditionalBlockerCount: number;
    simulatedRemovedBlockerCount: number;
    actualDecisionChangedBySimulation: false;
  };
  notes: string[];
  blockingReasons: [];
  sideEffectSummary: {
    dbRead: boolean;
    dbWrite: false;
    schemaMigration: false;
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

export interface OperationProfileScenarioMatrixSummary {
  checked: true;
  matrixVersion: "9F-1F";
  matrixMode: "policy_simulation_scenario_matrix";
  advisoryOnly: true;
  policyEnforced: false;
  actualBlockerImpact: false;
  actualExecutionPermissionImpact: false;
  profileFound: boolean;
  profileHealthy: boolean;
  defaultPublishPolicyPreset: string | null;
  operationMode: string | null;
  scenarioCount: number;
  scenarios: Array<{
    scenarioId:
      | "current_published_item"
      | "future_planned_ready_item"
      | "future_planned_token_expired"
      | "profile_missing"
      | "profile_mismatch"
      | "scheduled_publish_requested";
    label: string;
    description: string;
    inputKind: "actual_gate_state" | "synthetic_gate_state";
    usesCurrentContentItem: boolean;
    syntheticOnly: boolean;
    sourceProfileState: {
      profileFound: boolean;
      profileHealthy: boolean;
      targetBloggerBlogId: string | null;
      defaultPublishPolicyPreset: string | null;
      operationMode: string | null;
      allowAutoPublish: boolean | null;
      allowScheduledPublish: boolean | null;
      requireFinalHumanApproval: boolean | null;
      requireOAuthGate: boolean | null;
      requireReadbackAfterPublish: boolean | null;
      requirePostPublishReconciliation: boolean | null;
    };
    simulatedPolicyState: {
      wouldRequireOAuthGate: boolean;
      wouldRequireFinalHumanApproval: boolean;
      wouldRequireExternalWriteRiskAck: boolean;
      wouldRequireRollbackPlanAck: boolean;
      wouldRequireReadbackAfterPublish: boolean;
      wouldRequirePostPublishReconciliation: boolean;
      wouldAllowAutoPublish: boolean;
      wouldAllowScheduledPublish: boolean;
      wouldAllowPublishWithoutHumanApproval: boolean;
    };
    simulatedAdditionalBlockers: string[];
    simulatedRemovedBlockers: string[];
    simulatedWarnings: string[];
    simulatedDecision: {
      wouldAllowPublishExecution: boolean;
      wouldAllowScheduledPublishExecution: boolean;
      wouldRequireManualApproval: boolean;
      wouldRequireExceptionReview: boolean;
      wouldKeepCurrentGateDecision: boolean;
    };
    operatorTakeaway: string;
  }>;
  matrixTotals: {
    allowedScenarioCount: number;
    blockedScenarioCount: number;
    manualApprovalScenarioCount: number;
    exceptionReviewScenarioCount: number;
    syntheticScenarioCount: number;
  };
  notes: string[];
  blockingReasons: [];
  sideEffectSummary: {
    dbRead: boolean;
    dbWrite: false;
    schemaMigration: false;
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
