import { SAFE_MANUAL_PUBLISH_PRESET } from "@/lib/blog-operation-profiles/default-publish-policy";
import type { OperationProfileAdvisorySummary, OperationProfileScenarioMatrixSummary } from "@/lib/blog-operation-profiles/operation-profile-summary";

export interface BuildOperationProfileScenarioMatrixInput {
  advisorySummary: OperationProfileAdvisorySummary;
  includeCurrentPublishedItemScenario?: boolean;
  actualGateState?: {
    canExecutePublish?: boolean | null;
    canExecuteScheduledPublish?: boolean | null;
    canPublish?: boolean | null;
    canSchedulePublish?: boolean | null;
    blockingReasons?: string[];
    warnings?: string[];
  };
}

type Scenario = OperationProfileScenarioMatrixSummary["scenarios"][number];

const MANUAL_GUARD_BLOCKERS = [
  "operation_profile_policy_final_human_approval_required",
  "operation_profile_policy_external_write_risk_ack_required",
  "operation_profile_policy_rollback_plan_ack_required",
  "operation_profile_policy_readback_required_after_publish",
  "operation_profile_policy_post_publish_reconciliation_required"
] as const;

export function buildOperationProfileScenarioMatrixSummary(
  input: BuildOperationProfileScenarioMatrixInput
): OperationProfileScenarioMatrixSummary {
  const advisory = input.advisorySummary;
  const profileHealthy = isProfileHealthy(advisory);
  const baseProfileState = buildSourceProfileState(advisory, profileHealthy);
  const scenarios: Scenario[] = [];

  if (input.includeCurrentPublishedItemScenario) {
    scenarios.push({
      scenarioId: "current_published_item",
      label: "Current published item",
      description: "Actual current content item state. The item is already published, so it is not a publish execution candidate.",
      inputKind: "actual_gate_state",
      usesCurrentContentItem: true,
      syntheticOnly: false,
      sourceProfileState: baseProfileState,
      simulatedPolicyState: buildSafeManualPolicyState(),
      simulatedAdditionalBlockers: [
        "operation_profile_policy_manual_approval_required",
        ...MANUAL_GUARD_BLOCKERS
      ],
      simulatedRemovedBlockers: [],
      simulatedWarnings: [
        "operation_profile_policy_matrix_actual_gate_state_read_only",
        "operation_profile_policy_current_item_already_published"
      ],
      simulatedDecision: {
        wouldAllowPublishExecution: false,
        wouldAllowScheduledPublishExecution: false,
        wouldRequireManualApproval: true,
        wouldRequireExceptionReview: Boolean(input.actualGateState?.blockingReasons?.length),
        wouldKeepCurrentGateDecision: input.actualGateState?.canExecutePublish === false || input.actualGateState?.canExecutePublish == null
      },
      operatorTakeaway: "이미 발행된 글이므로 재발행 실행 대상이 아닙니다. Matrix는 현재 gate 판단을 변경하지 않습니다."
    });
  }

  scenarios.push(
    {
      scenarioId: "future_planned_ready_item",
      label: "Future planned ready item",
      description: "Synthetic future planned item with content snapshot, OAuth gate, target blog, and preflight readiness satisfied.",
      inputKind: "synthetic_gate_state",
      usesCurrentContentItem: false,
      syntheticOnly: true,
      sourceProfileState: baseProfileState,
      simulatedPolicyState: buildSafeManualPolicyState(),
      simulatedAdditionalBlockers: [
        "operation_profile_policy_auto_publish_disabled",
        "operation_profile_policy_manual_approval_required",
        ...MANUAL_GUARD_BLOCKERS
      ],
      simulatedRemovedBlockers: [],
      simulatedWarnings: ["operation_profile_policy_synthetic_ready_item_still_manual_only"],
      simulatedDecision: {
        wouldAllowPublishExecution: false,
        wouldAllowScheduledPublishExecution: false,
        wouldRequireManualApproval: true,
        wouldRequireExceptionReview: false,
        wouldKeepCurrentGateDecision: true
      },
      operatorTakeaway: "미래 planned item이 모두 준비되어도 safe_manual_publish에서는 자동 발행하지 않고 최종 수동 승인과 acknowledgement가 필요합니다."
    },
    {
      scenarioId: "future_planned_token_expired",
      label: "Future planned item with expired token",
      description: "Synthetic future planned item where the Blogger access token is expired before publish execution.",
      inputKind: "synthetic_gate_state",
      usesCurrentContentItem: false,
      syntheticOnly: true,
      sourceProfileState: baseProfileState,
      simulatedPolicyState: buildSafeManualPolicyState(),
      simulatedAdditionalBlockers: [
        "operation_profile_policy_oauth_gate_required",
        "operation_profile_policy_manual_approval_required",
        ...MANUAL_GUARD_BLOCKERS
      ],
      simulatedRemovedBlockers: [],
      simulatedWarnings: ["operation_profile_policy_token_expired_requires_manual_reconnect_or_refresh"],
      simulatedDecision: {
        wouldAllowPublishExecution: false,
        wouldAllowScheduledPublishExecution: false,
        wouldRequireManualApproval: true,
        wouldRequireExceptionReview: true,
        wouldKeepCurrentGateDecision: true
      },
      operatorTakeaway: "OAuth gate가 필수이므로 만료된 token 상태에서는 publish execution 전에 수동 reconnect 또는 refresh 절차가 필요합니다."
    },
    {
      scenarioId: "profile_missing",
      label: "Profile missing",
      description: "Synthetic target blog without a matching Blog Operation Profile row.",
      inputKind: "synthetic_gate_state",
      usesCurrentContentItem: false,
      syntheticOnly: true,
      sourceProfileState: {
        ...baseProfileState,
        profileFound: false,
        profileHealthy: false,
        targetBloggerBlogId: null,
        defaultPublishPolicyPreset: null,
        operationMode: null,
        allowAutoPublish: null,
        allowScheduledPublish: null,
        requireFinalHumanApproval: null,
        requireOAuthGate: null,
        requireReadbackAfterPublish: null,
        requirePostPublishReconciliation: null
      },
      simulatedPolicyState: buildSafeManualPolicyState(),
      simulatedAdditionalBlockers: [
        "operation_profile_policy_profile_missing",
        "operation_profile_policy_manual_approval_required"
      ],
      simulatedRemovedBlockers: [],
      simulatedWarnings: ["operation_profile_policy_profile_missing_requires_operator_review"],
      simulatedDecision: {
        wouldAllowPublishExecution: false,
        wouldAllowScheduledPublishExecution: false,
        wouldRequireManualApproval: true,
        wouldRequireExceptionReview: true,
        wouldKeepCurrentGateDecision: true
      },
      operatorTakeaway: "대상 블로그의 Operation Profile이 없으면 정책 강제 전 운영자 검토가 필요합니다."
    },
    {
      scenarioId: "profile_mismatch",
      label: "Profile target mismatch",
      description: "Synthetic publish target where the stored Operation Profile target blog does not match the publish target blog.",
      inputKind: "synthetic_gate_state",
      usesCurrentContentItem: false,
      syntheticOnly: true,
      sourceProfileState: {
        ...baseProfileState,
        profileHealthy: false,
        targetBloggerBlogId: advisory.targetBloggerBlogId ? `${advisory.targetBloggerBlogId}:mismatch` : "synthetic_mismatched_blog"
      },
      simulatedPolicyState: buildSafeManualPolicyState(),
      simulatedAdditionalBlockers: [
        "operation_profile_policy_target_blog_mismatch",
        "operation_profile_policy_manual_approval_required"
      ],
      simulatedRemovedBlockers: [],
      simulatedWarnings: ["operation_profile_policy_target_blog_mismatch_requires_operator_review"],
      simulatedDecision: {
        wouldAllowPublishExecution: false,
        wouldAllowScheduledPublishExecution: false,
        wouldRequireManualApproval: true,
        wouldRequireExceptionReview: true,
        wouldKeepCurrentGateDecision: true
      },
      operatorTakeaway: "프로필 대상 블로그와 publish 대상 블로그가 다르면 발행 전 운영자 검토가 필요합니다."
    },
    {
      scenarioId: "scheduled_publish_requested",
      label: "Scheduled publish requested",
      description: "Synthetic scheduled publish request under safe_manual_publish where scheduled publishing is disabled.",
      inputKind: "synthetic_gate_state",
      usesCurrentContentItem: false,
      syntheticOnly: true,
      sourceProfileState: baseProfileState,
      simulatedPolicyState: buildSafeManualPolicyState(),
      simulatedAdditionalBlockers: [
        "operation_profile_policy_scheduled_publish_disabled",
        "operation_profile_policy_manual_approval_required"
      ],
      simulatedRemovedBlockers: [],
      simulatedWarnings: ["operation_profile_policy_scheduled_publish_requested_but_disabled"],
      simulatedDecision: {
        wouldAllowPublishExecution: false,
        wouldAllowScheduledPublishExecution: false,
        wouldRequireManualApproval: true,
        wouldRequireExceptionReview: true,
        wouldKeepCurrentGateDecision: input.actualGateState?.canExecuteScheduledPublish === false || input.actualGateState?.canExecuteScheduledPublish == null
      },
      operatorTakeaway: "safe_manual_publish에서는 예약 발행 요청도 허용하지 않습니다. 예약 발행 정책은 별도 패치에서 설계해야 합니다."
    }
  );

  const matrixTotals = {
    allowedScenarioCount: scenarios.filter((scenario) => scenario.simulatedDecision.wouldAllowPublishExecution).length,
    blockedScenarioCount: scenarios.filter((scenario) => !scenario.simulatedDecision.wouldAllowPublishExecution).length,
    manualApprovalScenarioCount: scenarios.filter((scenario) => scenario.simulatedDecision.wouldRequireManualApproval).length,
    exceptionReviewScenarioCount: scenarios.filter((scenario) => scenario.simulatedDecision.wouldRequireExceptionReview).length,
    syntheticScenarioCount: scenarios.filter((scenario) => scenario.syntheticOnly).length
  };

  return {
    checked: true,
    matrixVersion: "9F-1F",
    matrixMode: "policy_simulation_scenario_matrix",
    advisoryOnly: true,
    policyEnforced: false,
    actualBlockerImpact: false,
    actualExecutionPermissionImpact: false,
    profileFound: advisory.profileFound,
    profileHealthy,
    defaultPublishPolicyPreset: advisory.defaultPublishPolicyPreset ?? SAFE_MANUAL_PUBLISH_PRESET,
    operationMode: advisory.operationMode,
    scenarioCount: scenarios.length,
    scenarios,
    matrixTotals,
    notes: [
      "This matrix is simulation-only. It does not change current publish blockers or execution permissions.",
      "operation_profile_policy_* blockers are contained inside the scenario matrix summary only.",
      "No Blogger write, OAuth reconnect, token refresh, content mutation, approval mutation, attempt mutation, or LLM call is performed."
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

function buildSafeManualPolicyState(): Scenario["simulatedPolicyState"] {
  return {
    wouldRequireOAuthGate: true,
    wouldRequireFinalHumanApproval: true,
    wouldRequireExternalWriteRiskAck: true,
    wouldRequireRollbackPlanAck: true,
    wouldRequireReadbackAfterPublish: true,
    wouldRequirePostPublishReconciliation: true,
    wouldAllowAutoPublish: false,
    wouldAllowScheduledPublish: false,
    wouldAllowPublishWithoutHumanApproval: false
  };
}

function buildSourceProfileState(advisory: OperationProfileAdvisorySummary, profileHealthy: boolean): Scenario["sourceProfileState"] {
  return {
    profileFound: advisory.profileFound,
    profileHealthy,
    targetBloggerBlogId: advisory.targetBloggerBlogId,
    defaultPublishPolicyPreset: advisory.defaultPublishPolicyPreset ?? SAFE_MANUAL_PUBLISH_PRESET,
    operationMode: advisory.operationMode,
    allowAutoPublish: advisory.allowAutoPublish,
    allowScheduledPublish: advisory.allowScheduledPublish,
    requireFinalHumanApproval: advisory.requireFinalHumanApproval,
    requireOAuthGate: advisory.requireOAuthGate,
    requireReadbackAfterPublish: advisory.requireReadbackAfterPublish,
    requirePostPublishReconciliation: advisory.requirePostPublishReconciliation
  };
}

function isProfileHealthy(advisory: OperationProfileAdvisorySummary) {
  return Boolean(
    advisory.profileFound &&
      advisory.matches.profileIsActive &&
      advisory.matches.presetIsSafeManualPublish &&
      advisory.matches.operationModeIsApprovalRequired &&
      advisory.matches.autoPublishDisabled &&
      advisory.matches.scheduledPublishDisabled &&
      advisory.matches.requiredManualGuardsEnabled &&
      advisory.advisoryWarnings.length === 0
  );
}
