export const SAFE_MANUAL_PUBLISH_PRESET = "safe_manual_publish" as const;

export interface SafeManualPublishPolicy {
  preset: typeof SAFE_MANUAL_PUBLISH_PRESET;
  autoPublishEnabled: false;
  scheduledPublishEnabled: false;
  publishRequiresHumanApproval: true;
  bloggerWriteRequiresFeatureFlag: true;
  bloggerWriteRequiresConfirmationPhrase: true;
  oauthGateRequired: true;
  finalPreflightRequired: true;
  readbackRequiredAfterPublish: true;
  postPublishReconciliationRequired: true;
  retryOnUnknownExternalResult: false;
  unknownExternalResultRequiresManualReview: true;
  rawBloggerResponseStorageAllowed: false;
  contentReturnedInReadbackResponse: false;
  operatorSeesExceptionsOnly: false;
}

export function buildSafeManualPublishPolicy(): SafeManualPublishPolicy {
  return {
    preset: SAFE_MANUAL_PUBLISH_PRESET,
    autoPublishEnabled: false,
    scheduledPublishEnabled: false,
    publishRequiresHumanApproval: true,
    bloggerWriteRequiresFeatureFlag: true,
    bloggerWriteRequiresConfirmationPhrase: true,
    oauthGateRequired: true,
    finalPreflightRequired: true,
    readbackRequiredAfterPublish: true,
    postPublishReconciliationRequired: true,
    retryOnUnknownExternalResult: false,
    unknownExternalResultRequiresManualReview: true,
    rawBloggerResponseStorageAllowed: false,
    contentReturnedInReadbackResponse: false,
    operatorSeesExceptionsOnly: false
  };
}
