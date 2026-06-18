export type BloggerConnectionStatus = "not_configured" | "configured" | "oauth_required" | "connected" | "expired" | "error";

export interface BloggerConnectionBlogSummary {
  id: string;
  name: string;
  url: string;
  bloggerBlogId: string | null;
}

export interface BloggerConnectionAdmin {
  id: string;
  blogId: string | null;
  name: string;
  status: BloggerConnectionStatus;
  bloggerBlogId: string | null;
  bloggerBlogName: string | null;
  bloggerBlogUrl: string | null;
  bloggerBlogVerifiedAt: string | null;
  connectedEmail: string | null;
  scopes: string[];
  oauthClientIdRef: string | null;
  clientSecretRef: string | null;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  blog: BloggerConnectionBlogSummary | null;
}

export interface BloggerConnectionStatusSummary {
  id: string;
  status: BloggerConnectionStatus;
  bloggerBlogId: string | null;
  bloggerBlogName: string | null;
  bloggerBlogUrl: string | null;
  bloggerBlogVerifiedAt: string | null;
  connectedEmail: string | null;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  blog: BloggerConnectionBlogSummary | null;
  oauthImplemented: boolean;
  bloggerApiImplemented: boolean;
  publishImplemented: false;
}

export interface BloggerOAuthStartDryRun {
  authorizationUrl: string;
  expiresAt: string;
  redirectUri: string;
  scopes: string[];
  oauthDryRun: true;
  tokenExchangeImplemented: boolean;
  bloggerApiImplemented: false;
}

export interface BloggerOAuthCallbackResult {
  status: "callback_dry_run_received" | "token_exchange_completed";
  connectionId: string;
  stateValid: true;
  tokenExchangeImplemented: boolean;
  bloggerApiImplemented: false;
  hasAccessToken?: boolean;
  hasRefreshToken?: boolean;
  tokenLast4?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenStored?: boolean;
  refreshTokenReused?: boolean;
  connectionStatus?: BloggerConnectionStatus;
  message?: string;
  secretMaterialReturned?: false;
}

export type BloggerSecretKind = "oauth_client_secret" | "access_token" | "refresh_token";

export interface BloggerConnectionSecretAdmin {
  id: string;
  connectionId: string;
  secretKind: BloggerSecretKind;
  keyVersion: string;
  last4: string | null;
  tokenType: string | null;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BloggerConnectionSecretStatus {
  connectionId: string;
  hasClientSecret: boolean;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenLast4: string | null;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  scopes: string[];
  secrets: BloggerConnectionSecretAdmin[];
  secretMaterialReturned: false;
  tokenExchangeImplemented: boolean;
  bloggerApiImplemented: boolean;
}

export interface BloggerSecretSelfTestResult {
  keyConfigured: boolean;
  selfTestPassed: boolean;
  keyVersion: string;
  message: string;
  secretMaterialReturned: false;
  tokenExchangeImplemented: boolean;
  bloggerApiImplemented: boolean;
}

export interface BloggerBlogListItem {
  id: string;
  name: string;
  url: string | null;
  published: string | null;
  updated: string | null;
}

export interface BloggerBlogListResult {
  connectionId: string;
  readOnly: true;
  bloggerApiImplemented: true;
  tokenRefreshImplemented: false;
  draftPublishImplemented: false;
  statusSuggestion: BloggerConnectionStatus;
  blogs: BloggerBlogListItem[];
  metadata: {
    blogCount: number;
    fetchedAt: string;
  };
}

export interface BloggerBlogSelectionResult {
  connection: BloggerConnectionAdmin;
  selectedBlog: BloggerBlogListItem;
  readOnlyRevalidated: true;
  draftPublishImplemented: false;
  tokenRefreshImplemented: false;
}

export type BloggerDraftApprovalStatus = "approved" | "revoked" | "superseded";
export type BloggerDraftManualApprovalStatus = "missing" | "approved" | "stale" | "revoked" | "not_ready";
export type BloggerDraftSaveStatus = "success" | "failed";

export interface BloggerDraftApprovalAdmin {
  id: string;
  contentItemId: string;
  status: BloggerDraftApprovalStatus;
  snapshotHashPrefix: string;
  draftHtmlHashPrefix: string;
  titleCandidate: string;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  targetBloggerBlogVerifiedAt: string;
  approvedAt: string;
  approvedBy: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BloggerDraftApprovalSummary {
  approvalStatus: BloggerDraftManualApprovalStatus;
  approval: BloggerDraftApprovalAdmin | null;
  approvalMatchesCurrentPreview: boolean;
  currentSnapshotHashPrefix: string | null;
  currentDraftHtmlHashPrefix: string | null;
  manualApprovalImplemented: true;
  draftSaveImplemented: boolean;
}

export interface BloggerDraftSaveAdmin {
  id: string;
  contentItemId: string;
  approvalId: string;
  bloggerConnectionId: string;
  status: BloggerDraftSaveStatus;
  snapshotHashPrefix: string;
  draftHtmlHashPrefix: string;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  titleCandidate: string;
  bloggerPostId: string | null;
  bloggerPostUrl: string | null;
  bloggerPostPublishedAt: string | null;
  bloggerPostUpdatedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  savedAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BloggerDraftSaveSummary {
  latestSuccessfulDraftSave: BloggerDraftSaveAdmin | null;
  latestDraftSave: BloggerDraftSaveAdmin | null;
  draftSaved: boolean;
  draftSaveImplemented: true;
  publishImplemented: false;
  scheduledPublishImplemented: false;
  tokenRefreshImplemented: false;
}

export interface BloggerDraftPayloadPreview {
  contentItemId: string;
  targetBlog: {
    id: string;
    name: string | null;
    url: string | null;
    verifiedAt: string | null;
  } | null;
  titleCandidate: string | null;
  htmlLength: number;
  htmlSnippet: string | null;
  htmlSafetySummary: {
    validationOk: boolean;
    issueCount: number;
    warningCount: number;
    qualityGrade: "pass" | "warn" | "fail";
    qualityScorePreview: number;
    qualityRequiredFailCount: number;
  };
  labelsCandidate: string[];
  contentReady: boolean;
  bloggerConnectionReady: boolean;
  selectedBlogReady: boolean;
  draftPayloadReady: boolean;
  blockingIssues: string[];
  warnings: string[];
  approvalSummary: BloggerDraftApprovalSummary;
  draftSaveSummary: BloggerDraftSaveSummary;
  bloggerApiWriteImplemented: boolean;
  bloggerApiReadImplemented: false;
  draftSaveImplemented: boolean;
  publishImplemented: false;
  tokenRefreshImplemented: false;
}

export interface BloggerDraftSavePreflight {
  ok: boolean;
  canSaveDraft: boolean;
  blockingReasons: string[];
  warnings: string[];
  htmlHash: string;
  htmlHashPrefix: string;
  htmlLength: number;
  htmlValidation: {
    ok: boolean;
    errorCount: number;
    warningCount: number;
    unsafePatternCount: number;
  };
  qualitySummary: {
    grade: "pass" | "warn" | "fail";
    scorePreview: number;
    requiredFailCount: number;
    contentReady: boolean;
  };
  publishReadinessSummary: {
    ready: boolean;
    contentReady: boolean;
    publishReady: boolean;
    stage: string;
    blockingIssueCount: number;
    warningCount: number;
  };
  selectedBlogSummary: {
    selected: boolean;
    id: string | null;
    name: string | null;
    url: string | null;
    verifiedAt: string | null;
  };
  bloggerConnectionSummary: {
    connectionCount: number;
    status: BloggerConnectionStatus;
    connectionId: string | null;
    connectedEmail: string | null;
    hasClientSecretRef: boolean;
    clientSecretConfigured: boolean;
    encryptedClientSecretStored: boolean;
    hasClientSecret: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    accessTokenExpiresAt: string | null;
    accessTokenExpired: boolean;
    tokenRefreshImplemented: false;
    secretMaterialReturned: false;
  };
  approvalSnapshotStatus: {
    status: BloggerDraftManualApprovalStatus;
    approvalId: string | null;
    approvalMatchesCurrentPreview: boolean;
    currentSnapshotHashPrefix: string | null;
    currentDraftHtmlHashPrefix: string | null;
    approvedAt: string | null;
    stale: boolean;
    requiresReapproval: boolean;
  };
  draftPayloadPreviewSummary: {
    draftPayloadReady: boolean;
    blockingIssues: string[];
    warnings: string[];
    titleCandidate: string | null;
  };
  draftSavePreflightSummary: {
    draftNotSavedYetExpected: boolean;
    successfulSaveForCurrentApproval: boolean;
    duplicateSaveBlocked: boolean;
    latestSuccessfulDraftSave: BloggerDraftSaveAdmin | null;
  };
  sideEffectSummary: {
    bloggerApiWrite: false;
    bloggerDraftSave: false;
    publish: false;
    scheduledPublish: false;
    tokenRefresh: false;
    llmCall: false;
    contentItemMutation: false;
  };
}

export interface PublishPreflightSideEffectSummary {
  bloggerApiWrite: false;
  bloggerPublish: false;
  bloggerScheduledPublish: false;
  bloggerPostsUpdate: false;
  bloggerDraftSave: false;
  tokenRefresh: false;
  llmCall: false;
  contentItemMutation: false;
}

export interface PublishPreflightSummary {
  bloggerDraftSaved: boolean;
  bloggerBlogId: string | null;
  bloggerBlogName: string | null;
  bloggerBlogUrl: string | null;
  bloggerPostId: string | null;
  bloggerDraftSavedAt: string | null;
  bloggerDraftApprovalId: string | null;
  bloggerDraftApprovalSnapshotHash: string | null;
  draftHtmlHashPrefix: string | null;
  titleCandidate: string | null;
  manualApprovalStatus: BloggerDraftManualApprovalStatus;
  approvalMatchesCurrentPreview: boolean;
  accessTokenExpired: boolean;
  duplicateSaveProtectionActive: boolean;
  publishImplemented: false;
  scheduledPublishImplemented: false;
  publishApprovalImplemented: false;
  canPublish: false;
  canSchedulePublish: false;
}

export interface PublishPreflightDryRun {
  contentItemId: string;
  checkedAt: string;
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  publishPreflightSummary: PublishPreflightSummary;
  requiredBeforePublish: string[];
  requiredBeforeScheduledPublish: string[];
  proposedPublishApprovalSnapshotFields: string[];
  sideEffectSummary: PublishPreflightSideEffectSummary;
}

export type PublishApprovalTokenState = "expired_reauth_required" | "unknown" | "valid_not_verified";
export type PublishApprovalMode = "publish" | "scheduled_publish";

export interface PublishApprovalPreviewSideEffectSummary {
  bloggerApiWrite: false;
  bloggerPublish: false;
  bloggerScheduledPublish: false;
  bloggerPostsUpdate: false;
  bloggerDraftSave: false;
  tokenRefresh: false;
  llmCall: false;
  contentItemMutation: false;
  dbWrite: false;
  approvalPersistence: false;
}

export interface PublishApprovalSaveSideEffectSummary {
  dbWrite: boolean;
  approvalPersistence: boolean;
  contentItemMutation: false;
  bloggerApiWrite: false;
  bloggerPublish: false;
  bloggerScheduledPublish: false;
  bloggerPostsUpdate: false;
  bloggerDraftSave: false;
  tokenRefresh: false;
  llmCall: false;
}

export interface PublishApprovalSnapshotPreview {
  contentItemId: string;
  contentStatus: string | null;
  draftMarkdownHash: string;
  draftHtmlHash: string;
  draftHtmlLength: number;
  titleCandidate: string | null;
  targetBloggerBlogId: string | null;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  bloggerPostId: string | null;
  bloggerDraftSavedAt: string | null;
  bloggerDraftApprovalId: string | null;
  bloggerDraftApprovalSnapshotHash: string | null;
  approvalMatchesCurrentPreview: boolean | null;
  publishMode: PublishApprovalMode;
  scheduledAt: string | null;
  timezone: string | null;
  rollbackAcknowledged: false;
  sideEffectSummaryAcknowledged: false;
  approvalPersistenceAcknowledged: false;
  tokenState: PublishApprovalTokenState;
  tokenStateCheckedAt: string;
}

export interface PublishApprovalPreview {
  contentItemId: string;
  checkedAt: string;
  canCreatePublishApproval: false;
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  approvalSnapshotPreview: PublishApprovalSnapshotPreview;
  approvalSnapshotHashPreview: string;
  hashAlgorithm: "sha256";
  canonicalization: string;
  requiredBeforeApprovalPersistence: string[];
  requiredBeforePublish: string[];
  requiredBeforeScheduledPublish: string[];
  sideEffectSummary: PublishApprovalPreviewSideEffectSummary;
}

export type BloggerPublishApprovalStatus = "approved_snapshot" | "invalidated" | "used_for_publish_attempt" | "used_for_schedule_attempt" | "cancelled";

export interface BloggerPublishApprovalAdmin {
  id: string;
  contentItemId: string;
  status: BloggerPublishApprovalStatus;
  mode: PublishApprovalMode;
  snapshotHash: string;
  snapshotHashPrefix: string;
  hashAlgorithm: "sha256";
  canonicalization: string;
  targetBloggerBlogId: string;
  targetBloggerBlogName: string | null;
  targetBloggerBlogUrl: string | null;
  bloggerPostId: string;
  bloggerDraftSaveId: string | null;
  bloggerDraftApprovalId: string | null;
  draftMarkdownHash: string;
  draftHtmlHash: string;
  draftHtmlLength: number;
  titleCandidate: string | null;
  scheduledAt: string | null;
  timezone: string | null;
  rollbackAcknowledged: boolean;
  sideEffectSummaryAcknowledged: boolean;
  approvalPersistenceAcknowledged: boolean;
  tokenState: PublishApprovalTokenState;
  tokenStateCheckedAt: string;
  createdBy: string | null;
  createdAt: string;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
  supersededByApprovalId: string | null;
}

export interface PublishApprovalSaveResponse {
  contentItemId: string;
  approvalId: string;
  created: boolean;
  existing: boolean;
  status: BloggerPublishApprovalStatus;
  mode: PublishApprovalMode;
  snapshotHash: string;
  hashAlgorithm: "sha256";
  canonicalization: string;
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  savedApprovalSummary: {
    targetBloggerBlogId: string | null;
    bloggerPostId: string | null;
    draftHtmlHash: string;
    draftHtmlLength: number;
    tokenState: PublishApprovalTokenState;
    rollbackAcknowledged: boolean;
    sideEffectSummaryAcknowledged: boolean;
    approvalPersistenceAcknowledged: boolean;
    createdAt: string;
  };
  sideEffectSummary: PublishApprovalSaveSideEffectSummary;
}

export interface PublishApprovalReadbackSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  approvalPersistence: false;
  contentItemMutation: false;
  bloggerApiWrite: false;
  bloggerPublish: false;
  bloggerScheduledPublish: false;
  bloggerPostsUpdate: false;
  bloggerDraftSave: false;
  tokenRefresh: false;
  llmCall: false;
}

export interface PublishApprovalReadbackResponse {
  contentItemId: string;
  checkedAt: string;
  count: number;
  latestApproval: BloggerPublishApprovalAdmin | null;
  activeApprovals: BloggerPublishApprovalAdmin[];
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  sideEffectSummary: PublishApprovalReadbackSideEffectSummary;
}

export interface PublishApprovalExecutionGuardSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  approvalInvalidation: false;
  contentItemMutation: false;
  bloggerApiWrite: false;
  bloggerPublish: false;
  bloggerScheduledPublish: false;
  bloggerPostsUpdate: false;
  bloggerDraftSave: false;
  tokenRefresh: false;
  llmCall: false;
}

export interface PublishApprovalExecutionGuardMatchSummary {
  draftHtmlHashMatches: boolean | null;
  draftMarkdownHashMatches: boolean | null;
  draftHtmlLengthMatches: boolean | null;
  titleCandidateMatches: boolean | null;
  targetBloggerBlogMatches: boolean | null;
  bloggerPostIdMatches: boolean | null;
  contentStatusMatches: boolean | null;
  scheduledAtMatches: boolean | null;
  timezoneMatches: boolean | null;
  modeMatches: boolean | null;
  tokenStateMatches: boolean | null;
}

export interface PublishApprovalExecutionGuardResponse {
  contentItemId: string;
  checkedAt: string;
  approvalId: string | null;
  approvalSnapshotHash: string | null;
  approvalFound: boolean;
  approvalActive: boolean;
  approvalMatchesCurrentState: boolean;
  canExecutePublish: false;
  canExecuteScheduledPublish: false;
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  invalidationCandidates: string[];
  matchSummary: PublishApprovalExecutionGuardMatchSummary;
  approvalSummary: {
    id: string | null;
    mode: string | null;
    status: string | null;
    snapshotHash: string | null;
    createdAt: string | null;
    invalidatedAt: string | null;
    invalidatedReason: string | null;
    tokenState: string | null;
  };
  requiredBeforeExecution: string[];
  sideEffectSummary: PublishApprovalExecutionGuardSideEffectSummary;
}

export interface PublishApprovalInvalidationPreviewResponse {
  contentItemId: string;
  checkedAt: string;
  approvalId: string | null;
  approvalFound: boolean;
  approvalActive: boolean;
  approvalMatchesCurrentState: boolean | null;
  manualInvalidationRequested: boolean;
  manualReason: string | null;
  wouldInvalidate: boolean;
  canInvalidate: false;
  canPublish: false;
  canSchedulePublish: false;
  canExecutePublish: false;
  canExecuteScheduledPublish: false;
  blockingReasons: string[];
  warnings: string[];
  invalidationReasons: string[];
  invalidationCandidates: string[];
  invalidationPlan: {
    updateTable: "blogger_publish_approvals";
    setInvalidatedAt: string | null;
    setInvalidatedReason: string | null;
    dryRunOnly: true;
    dbUpdateImplemented: false;
  };
  executionGuardSummary: {
    canExecutePublish: false;
    canExecuteScheduledPublish: false;
    approvalMatchesCurrentState: boolean | null;
    blockingReasons: string[];
  };
  sideEffectSummary: PublishApprovalExecutionGuardSideEffectSummary;
}

export interface PublishExecutionAttemptPreviewSideEffectSummary {
  dbRead: true;
  dbWrite: false;
  attemptPersistence: false;
  contentItemMutation: false;
  bloggerApiWrite: false;
  bloggerPublish: false;
  bloggerScheduledPublish: false;
  bloggerPostsUpdate: false;
  bloggerDraftSave: false;
  tokenRefresh: false;
  llmCall: false;
}

export type BloggerPublishExecutionAttemptStatus = "planned_only" | "blocked_by_preflight";

export interface BloggerPublishExecutionAttemptAdmin {
  id: string;
  contentItemId: string;
  publishApprovalId: string;
  publishApprovalSnapshotHash: string;
  mode: PublishApprovalMode;
  status: BloggerPublishExecutionAttemptStatus;
  attemptNumber: number;
  targetBloggerBlogId: string | null;
  bloggerPostId: string | null;
  draftHtmlHash: string | null;
  titleCandidate: string | null;
  tokenStateAtAttempt: PublishApprovalTokenState | null;
  executionGuardCheckedAt: string;
  approvalMatchesCurrentState: boolean | null;
  retryEligible: boolean;
  retryBlockedReason: string | null;
  contentMutationPlanned: boolean;
  contentMutationCompleted: boolean;
  contentStatusBefore: string | null;
  contentStatusAfter: string | null;
  publishedAtPlanned: string | null;
  publishedAtApplied: string | null;
  scheduledAtPlanned: string | null;
  scheduledAtApplied: string | null;
  attemptPlanHash: string;
  hashAlgorithm: "sha256";
  canonicalization: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishExecutionAttemptPreviewResponse {
  contentItemId: string;
  checkedAt: string;
  approvalId: string | null;
  approvalSnapshotHash: string | null;
  attemptStorageImplemented: boolean;
  wouldCreateAttempt: false;
  canCreateAttempt: false;
  canExecutePublish: false;
  canExecuteScheduledPublish: false;
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  plannedAttempt: {
    futureTable: "blogger_publish_execution_attempts";
    mode: PublishApprovalMode | null;
    status: "planned_only";
    publishApprovalId: string | null;
    publishApprovalSnapshotHash: string | null;
    targetBloggerBlogId: string | null;
    bloggerPostId: string | null;
    draftHtmlHash: string | null;
    titleCandidate: string | null;
    tokenStateAtAttempt: PublishApprovalTokenState | null;
    executionGuardCheckedAt: string;
    approvalMatchesCurrentState: boolean | null;
    invalidationCandidates: string[];
    retryEligible: false;
    retryBlockedReason: string | null;
    contentMutationPlanned: false;
    bloggerApiWritePlanned: false;
    contentStatusBefore: string | null;
  };
  attemptPlanHashPreview: string;
  hashAlgorithm: "sha256";
  canonicalization: string;
  requiredBeforeAttemptStorage: string[];
  requiredBeforeAttemptPersistence: string[];
  requiredBeforeExecution: string[];
  failurePolicySummary: {
    retryEligibleExamples: string[];
    retryBlockedExamples: string[];
    partialFailureExamples: string[];
  };
  redactionPolicySummary: string[];
  contentMutationOrdering: string[];
  executionGuardSummary: {
    approvalFound: boolean;
    approvalActive: boolean;
    approvalMatchesCurrentState: boolean | null;
    canExecutePublish: false;
    canExecuteScheduledPublish: false;
    blockingReasons: string[];
    warnings: string[];
  };
  sideEffectSummary: PublishExecutionAttemptPreviewSideEffectSummary;
}

export interface PublishExecutionAttemptSaveSideEffectSummary {
  dbWrite: boolean;
  attemptPersistence: boolean;
  contentItemMutation: false;
  bloggerApiWrite: false;
  bloggerPublish: false;
  bloggerScheduledPublish: false;
  bloggerPostsUpdate: false;
  bloggerDraftSave: false;
  tokenRefresh: false;
  llmCall: false;
}

export interface PublishExecutionAttemptSaveResponse {
  contentItemId: string;
  attemptId: string;
  publishApprovalId: string;
  created: boolean;
  existing: boolean;
  status: BloggerPublishExecutionAttemptStatus;
  mode: PublishApprovalMode;
  attemptPlanHash: string;
  hashAlgorithm: "sha256";
  canonicalization: string;
  canExecutePublish: false;
  canExecuteScheduledPublish: false;
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  savedAttemptSummary: {
    publishApprovalSnapshotHash: string;
    targetBloggerBlogId: string | null;
    bloggerPostId: string | null;
    draftHtmlHash: string | null;
    tokenStateAtAttempt: PublishApprovalTokenState | null;
    approvalMatchesCurrentState: boolean | null;
    retryEligible: false;
    retryBlockedReason: string | null;
    contentMutationPlanned: false;
    contentMutationCompleted: false;
    createdAt: string;
  };
  sideEffectSummary: PublishExecutionAttemptSaveSideEffectSummary;
}

export interface PublishExecutionAttemptReadbackResponse {
  contentItemId: string;
  checkedAt: string;
  count: number;
  latestAttempt: BloggerPublishExecutionAttemptAdmin | null;
  activeAttempts: BloggerPublishExecutionAttemptAdmin[];
  canExecutePublish: false;
  canExecuteScheduledPublish: false;
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  sideEffectSummary: PublishExecutionAttemptPreviewSideEffectSummary;
}

export type PublishOAuthAccessTokenState = "expired_reauth_required" | "valid_not_verified" | "missing" | "unknown";
export type ManualReconnectCompletionAccessTokenState = "valid" | "expired_reauth_required" | "missing" | "unknown";

export interface PublishOAuthGateResponse {
  contentItemId: string;
  checkedAt: string;
  canProceedToPublishExecution: false;
  canProceedToScheduledPublishExecution: false;
  canExecutePublish: false;
  canExecuteScheduledPublish: false;
  canPublish: false;
  canSchedulePublish: false;
  blockingReasons: string[];
  warnings: string[];
  oauthGateSummary: {
    connectionFound: boolean;
    selectedBloggerBlogFound: boolean;
    targetBloggerBlogId: string | null;
    targetBloggerBlogName: string | null;
    targetBloggerBlogUrl: string | null;
    accessTokenState: PublishOAuthAccessTokenState;
    accessTokenExpired: boolean;
    reauthRequired: boolean;
    manualReconnectRequired: boolean;
    tokenRefreshImplemented: false;
    autoReconnectImplemented: false;
    reconnectSettingsPath: "/settings/blogger";
    publishApprovalId: string | null;
    publishExecutionAttemptId: string | null;
  };
  manualReconnectCompletionSummary: {
    checked: true;
    reconnectSettingsPath: "/settings/blogger";
    bloggerConnectionExists: boolean;
    selectedBlogExists: boolean;
    selectedBlogMatchesApprovalTarget: boolean | null;
    accessTokenState: ManualReconnectCompletionAccessTokenState;
    reauthRequired: boolean;
    manualReconnectRequired: boolean;
    tokenRefreshImplemented: false;
    autoReconnectImplemented: false;
    publishApprovalExists: boolean;
    publishApprovalStillValid: boolean;
    publishApprovalInvalidated: boolean;
    publishExecutionAttemptExists: boolean;
    publishExecutionAttemptStillPlanningOnly: boolean;
    contentStillPlanned: boolean;
    draftMarkdownHashMatchesApprovalSnapshot: boolean | null;
    draftHtmlHashMatchesApprovalSnapshot: boolean | null;
    targetBlogMatchesApprovalSnapshot: boolean | null;
    reconnectCompletionReady: boolean;
    canProceedToFinalPublishPreflight: false;
    canExecutePublish: false;
    blockingReasons: string[];
    warnings: string[];
  };
  requiredBeforePublishExecution: string[];
  requiredBeforeScheduledPublishExecution: string[];
  sideEffectSummary: {
    dbRead: true;
    dbWrite: false;
    bloggerRead: false;
    bloggerWrite: false;
    oauthReconnect: false;
    tokenRefresh: false;
    bloggerApiWrite: false;
    bloggerPublish: false;
    bloggerScheduledPublish: false;
    bloggerPostsUpdate: false;
    bloggerDraftSave: false;
    contentMutation: false;
    contentItemMutation: false;
    llmCall: false;
  };
}
