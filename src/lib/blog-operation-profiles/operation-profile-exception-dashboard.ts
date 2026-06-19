import { SAFE_MANUAL_PUBLISH_PRESET } from "@/lib/blog-operation-profiles/default-publish-policy";
import type { OperationProfileAdvisorySummary, OperationProfileExceptionDashboardSummary } from "@/lib/blog-operation-profiles/operation-profile-summary";

export interface BuildOperationProfileExceptionDashboardInput {
  advisorySummary: OperationProfileAdvisorySummary;
  existingGateBlockingReasons?: string[];
}

type FocusItem = OperationProfileExceptionDashboardSummary["focusItems"][number];
type NormalItem = OperationProfileExceptionDashboardSummary["collapsedNormalItems"][number];

export function buildOperationProfileExceptionDashboardSummary(
  input: BuildOperationProfileExceptionDashboardInput
): OperationProfileExceptionDashboardSummary {
  const advisory = input.advisorySummary;
  const focusItems: FocusItem[] = [];
  const normalItems: NormalItem[] = [];

  if (!advisory.profileFound) {
    focusItems.push({
      severity: "warning",
      code: "operation_profile_missing_advisory_only",
      label: "Operation profile missing",
      detail: "No Blog Operation Profile row was found for the target Blogger blog. This is advisory-only and does not change publish blockers yet.",
      source: "operation_profile"
    });
  }

  addProfileWarning(!advisory.matches.profileIsActive, focusItems, "operation_profile_not_active_advisory_only", "Profile is not active", "The profile is not active.");
  addProfileWarning(
    !advisory.matches.presetIsSafeManualPublish,
    focusItems,
    "operation_profile_preset_mismatch_advisory_only",
    "Preset mismatch",
    "The profile does not use the safe_manual_publish preset."
  );
  addProfileWarning(
    !advisory.matches.operationModeIsApprovalRequired,
    focusItems,
    "operation_profile_mode_not_approval_required_advisory_only",
    "Operation mode mismatch",
    "The profile operation mode is not approval_required."
  );
  addProfileWarning(
    !advisory.matches.autoPublishDisabled,
    focusItems,
    "operation_profile_auto_publish_enabled_advisory_only",
    "Auto publish enabled",
    "Auto publish is enabled in the profile. This patch still does not enforce or execute auto publishing."
  );
  addProfileWarning(
    !advisory.matches.scheduledPublishDisabled,
    focusItems,
    "operation_profile_scheduled_publish_enabled_advisory_only",
    "Scheduled publish enabled",
    "Scheduled publish is enabled in the profile. This patch still does not enforce or execute scheduled publishing."
  );
  addProfileWarning(
    !advisory.matches.requiredManualGuardsEnabled,
    focusItems,
    "operation_profile_manual_guards_incomplete_advisory_only",
    "Manual guards incomplete",
    "One or more human approval, OAuth, rollback, readback, or reconciliation guard fields are disabled."
  );

  const externalGateBlockers = (input.existingGateBlockingReasons ?? []).filter((reason) => !reason.startsWith("operation_profile"));
  if (externalGateBlockers.length > 0) {
    focusItems.push({
      severity: "info",
      code: "publish_gate_has_existing_blockers_outside_profile",
      label: "Publish gate has existing blockers",
      detail: `${externalGateBlockers.length} existing publish gate blocker(s) are present outside the Operation Profile advisory.`,
      source: "publish_gate"
    });
  }

  normalItems.push(
    { code: "profile_found", label: "Profile found", value: advisory.profileFound },
    { code: "target_blogger_blog_id", label: "Target Blogger Blog ID", value: advisory.targetBloggerBlogId },
    { code: "target_blogger_blog_name", label: "Target Blogger Blog", value: advisory.targetBloggerBlogName },
    { code: "profile_status", label: "Profile status", value: advisory.profileStatus },
    { code: "operation_mode", label: "Operation mode", value: advisory.operationMode },
    { code: "default_publish_policy_preset", label: "Default publish policy", value: advisory.defaultPublishPolicyPreset },
    { code: "allow_auto_publish", label: "Auto publish enabled", value: advisory.allowAutoPublish },
    { code: "allow_scheduled_publish", label: "Scheduled publish enabled", value: advisory.allowScheduledPublish },
    { code: "require_oauth_gate", label: "OAuth gate required", value: advisory.requireOAuthGate },
    { code: "require_final_human_approval", label: "Human approval required", value: advisory.requireFinalHumanApproval },
    { code: "require_readback_after_publish", label: "Readback after publish required", value: advisory.requireReadbackAfterPublish },
    { code: "require_post_publish_reconciliation", label: "Post-publish reconciliation required", value: advisory.requirePostPublishReconciliation }
  );

  const warningItemCount = focusItems.filter((item) => item.severity === "warning").length + advisory.advisoryWarnings.length;
  const exceptionItemCount = focusItems.filter((item) => item.severity === "exception").length;
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
  const attentionLevel: OperationProfileExceptionDashboardSummary["attentionLevel"] = exceptionItemCount > 0
    ? "warning"
    : warningItemCount > 0
      ? "warning"
      : externalGateBlockers.length > 0
        ? "info"
        : "ok";

  return {
    checked: true,
    dashboardVersion: "9F-1D",
    dashboardMode: "exception_only_draft",
    advisoryOnly: true,
    policyEnforced: false,
    blockerImpact: false,
    executionPermissionImpact: false,
    profileFound: advisory.profileFound,
    profileHealthy,
    attentionLevel,
    normalItemCount: normalItems.length,
    warningItemCount,
    exceptionItemCount,
    headline: profileHealthy ? "No profile exceptions found" : "Operation profile needs attention",
    operatorSummary: profileHealthy
      ? "safe_manual_publish is loaded with auto and scheduled publishing disabled. Existing publish gate blockers are outside this advisory."
      : "Review the focus items before moving toward policy enforcement.",
    focusItems,
    collapsedNormalItems: normalItems,
    profilePolicySnapshot: {
      targetBloggerBlogId: advisory.targetBloggerBlogId,
      targetBloggerBlogName: advisory.targetBloggerBlogName,
      operationMode: advisory.operationMode,
      defaultPublishPolicyPreset: advisory.defaultPublishPolicyPreset ?? SAFE_MANUAL_PUBLISH_PRESET,
      allowAutoPublish: advisory.allowAutoPublish,
      allowScheduledPublish: advisory.allowScheduledPublish,
      requireOAuthGate: advisory.requireOAuthGate,
      requireFinalHumanApproval: advisory.requireFinalHumanApproval,
      requireReadbackAfterPublish: advisory.requireReadbackAfterPublish,
      requirePostPublishReconciliation: advisory.requirePostPublishReconciliation
    },
    advisoryWarnings: advisory.advisoryWarnings,
    advisoryNotes: advisory.advisoryNotes,
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

function addProfileWarning(condition: boolean, focusItems: FocusItem[], code: string, label: string, detail: string) {
  if (!condition) {
    return;
  }
  focusItems.push({
    severity: "warning",
    code,
    label,
    detail: `${detail} This remains advisory-only in 9F-1D.`,
    source: "operation_profile"
  });
}
