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
