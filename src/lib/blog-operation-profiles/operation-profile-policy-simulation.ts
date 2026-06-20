import { SAFE_MANUAL_PUBLISH_PRESET } from "@/lib/blog-operation-profiles/default-publish-policy";
import type { OperationProfileAdvisorySummary, OperationProfilePolicySimulationSummary } from "@/lib/blog-operation-profiles/operation-profile-summary";

export interface BuildOperationProfilePolicySimulationInput {
  advisorySummary: OperationProfileAdvisorySummary;
  actualGateState?: {
    canProceedToPublishExecution?: boolean | null;
    canProceedToScheduledPublishExecution?: boolean | null;
    canExecutePublish?: boolean | null;
    canExecuteScheduledPublish?: boolean | null;
    canPublish?: boolean | null;
    canSchedulePublish?: boolean | null;
    blockingReasons?: string[];
    warnings?: string[];
  };
}

const SIMULATED_POLICY_BLOCKERS = [
  "operation_profile_policy_auto_publish_disabled",
  "operation_profile_policy_scheduled_publish_disabled",
  "operation_profile_policy_final_human_approval_required",
  "operation_profile_policy_external_write_risk_ack_required",
  "operation_profile_policy_rollback_plan_ack_required",
  "operation_profile_policy_readback_required_after_publish",
  "operation_profile_policy_post_publish_reconciliation_required"
] as const;

export function buildOperationProfilePolicySimulationSummary(
  input: BuildOperationProfilePolicySimulationInput
): OperationProfilePolicySimulationSummary {
  const advisory = input.advisorySummary;
  const actualGateState = {
    canProceedToPublishExecution: input.actualGateState?.canProceedToPublishExecution ?? null,
    canProceedToScheduledPublishExecution: input.actualGateState?.canProceedToScheduledPublishExecution ?? null,
    canExecutePublish: input.actualGateState?.canExecutePublish ?? null,
    canExecuteScheduledPublish: input.actualGateState?.canExecuteScheduledPublish ?? null,
    canPublish: input.actualGateState?.canPublish ?? null,
    canSchedulePublish: input.actualGateState?.canSchedulePublish ?? null,
    blockingReasons: input.actualGateState?.blockingReasons ?? [],
    warnings: input.actualGateState?.warnings ?? []
  };
  const profileHealthy = Boolean(
    advisory.profileFound &&
      advisory.matches.profileIsActive &&
      advisory.matches.presetIsSafeManualPublish &&
      advisory.matches.operationModeIsApprovalRequired &&
      advisory.matches.autoPublishDisabled &&
      advisory.matches.scheduledPublishDisabled &&
      advisory.matches.requiredManualGuardsEnabled &&
      advisory.advisoryWarnings.length === 0
  );
  const profileWouldBeApplicable = Boolean(
    profileHealthy &&
      advisory.defaultPublishPolicyPreset === SAFE_MANUAL_PUBLISH_PRESET &&
      advisory.allowAutoPublish === false &&
      advisory.allowScheduledPublish === false
  );
  const simulatedAdditionalBlockers = [...SIMULATED_POLICY_BLOCKERS];
  const simulatedRemovedBlockers: string[] = [];
  const wouldKeepCurrentGateDecision = actualGateState.canExecutePublish === null ? true : actualGateState.canExecutePublish === false;

  return {
    checked: true,
    simulationVersion: "9F-1E",
    simulationMode: "policy_enforcement_dry_run",
    advisoryOnly: true,
    policyEnforced: false,
    actualBlockerImpact: false,
    actualExecutionPermissionImpact: false,
    profileFound: advisory.profileFound,
    profileHealthy,
    profileWouldBeApplicable,
    targetBloggerBlogId: advisory.targetBloggerBlogId,
    targetBloggerBlogName: advisory.targetBloggerBlogName,
    targetBloggerBlogUrl: advisory.targetBloggerBlogUrl,
    operationMode: advisory.operationMode,
    defaultPublishPolicyPreset: advisory.defaultPublishPolicyPreset ?? SAFE_MANUAL_PUBLISH_PRESET,
    actualGateState,
    simulatedPolicyState: {
      wouldRequireOAuthGate: true,
      wouldRequireFinalHumanApproval: true,
      wouldRequireExternalWriteRiskAck: true,
      wouldRequireRollbackPlanAck: true,
      wouldRequireReadbackAfterPublish: true,
      wouldRequirePostPublishReconciliation: true,
      wouldAllowAutoPublish: false,
      wouldAllowScheduledPublish: false,
      wouldAllowPublishWithoutHumanApproval: false
    },
    simulatedAdditionalBlockers,
    simulatedRemovedBlockers,
    simulatedWarnings: [
      "operation_profile_policy_simulation_only_not_enforced",
      "operation_profile_policy_does_not_change_current_gate_decision"
    ],
    simulatedDecision: {
      wouldAllowPublishExecution: false,
      wouldAllowScheduledPublishExecution: false,
      wouldRequireManualApproval: true,
      wouldRequireExceptionReview: simulatedAdditionalBlockers.length > 0 || actualGateState.blockingReasons.length > 0,
      wouldKeepCurrentGateDecision
    },
    comparison: {
      actualCanExecutePublish: actualGateState.canExecutePublish,
      simulatedCanExecutePublish: false,
      actualCanPublish: actualGateState.canPublish,
      simulatedCanPublish: false,
      actualBlockingReasonCount: actualGateState.blockingReasons.length,
      simulatedAdditionalBlockerCount: simulatedAdditionalBlockers.length,
      simulatedRemovedBlockerCount: simulatedRemovedBlockers.length,
      actualDecisionChangedBySimulation: false
    },
    notes: [
      "This is a dry-run simulation. It does not change current publish blockers or execution permissions.",
      "safe_manual_publish keeps auto publish and scheduled publish disabled.",
      "Future policy enforcement would still require OAuth gate, final human approval, external write risk acknowledgement, rollback plan acknowledgement, readback, and reconciliation."
    ],
    blockingReasons: [],
    sideEffectSummary: {
      ...advisory.sideEffectSummary,
      dbWrite: false,
      schemaMigration: false,
      bloggerRead: false,
      bloggerWrite: false,
      bloggerPublish: false,
      bloggerUpdate: false,
      bloggerDraftSave: false,
      tokenRefresh: false,
      oauthReconnect: false,
      contentMutation: false,
      approvalMutation: false,
      attemptMutation: false,
      llmCall: false,
      externalSend: false
    }
  };
}
