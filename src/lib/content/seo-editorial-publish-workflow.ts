import { createHash } from "node:crypto";
import { buildBloggerDraftApprovalSnapshotHashes, buildBloggerDraftApprovalSummary, hashDraftHtml, hashPrefix } from "@/lib/blogger/draft-approval";
import { buildBloggerDraftPayloadPreview } from "@/lib/blogger/draft-payload-preview";
import type { ContentAssetAdmin } from "@/lib/content/asset-types";
import type { ContentItemAdmin } from "@/lib/content/admin-types";
import { buildHtmlQualityPreview } from "@/lib/content/html-quality-preview";
import { getActiveBloggerDraftApproval, getLatestBloggerDraftApproval, toBloggerDraftApprovalAdmin } from "@/lib/db/blogger-draft-approvals";
import { listBloggerConnectionsForBlog } from "@/lib/db/blogger-connections";
import { getLatestSuccessfulBloggerDraftSave, getSuccessfulBloggerDraftSaveByApproval } from "@/lib/db/blogger-draft-saves";
import { findLatestBloggerPublishApprovalForContentItem, toBloggerPublishApprovalAdmin } from "@/lib/db/blogger-publish-approvals";
import {
  findLatestBloggerPublishExecutionAttemptForContentItem,
  toBloggerPublishExecutionAttemptAdmin
} from "@/lib/db/blogger-publish-execution-attempts";
import { prisma } from "@/lib/db/client";

export type SeoEditorialWorkflowStepStatus = "done" | "ready" | "blocked" | "pending";

export interface SeoEditorialWorkflowStep {
  key: string;
  label: string;
  status: SeoEditorialWorkflowStepStatus;
  message: string;
  action: string;
  evidence: Record<string, string | number | boolean | null>;
}

export interface SeoEditorialPublishWorkflowResponse {
  patchVersion: "9G-2A";
  generatedAt: string;
  contentItemId: string;
  contentStatus: string;
  title: string | null;
  summary: {
    hasPlanJson: boolean;
    hasDraftMarkdown: boolean;
    hasDraftHtml: boolean;
    draftMarkdownLength: number;
    draftHtmlLength: number;
    draftMarkdownHashPrefix: string | null;
    draftHtmlHashPrefix: string | null;
    qualityReady: boolean;
    qualityGrade: string;
    qualityScorePreview: number;
    qualityRequiredFailCount: number;
    seoEditorialGrade: string;
    seoEditorialScore: number;
    draftPayloadReady: boolean;
    bloggerConnectionCount: number;
    selectedBlogReady: boolean;
    draftApprovalStatus: string;
    draftApprovalMatchesCurrentPreview: boolean;
    bloggerDraftSaved: boolean;
    publishApprovalReady: boolean;
    publishExecutionAttemptStatus: string | null;
    postPublishReconciled: boolean;
  };
  steps: SeoEditorialWorkflowStep[];
  nextAction: {
    key: string | null;
    label: string;
    action: string;
    blocked: boolean;
  };
  sideEffectSummary: {
    dbRead: true;
    dbWrite: false;
    contentMutation: false;
    bloggerApiRead: false;
    bloggerApiWrite: false;
    bloggerDraftSave: false;
    bloggerPublish: false;
    tokenRefresh: false;
    llmCall: false;
  };
}

export async function buildSeoEditorialPublishWorkflow(contentItemId: string): Promise<SeoEditorialPublishWorkflowResponse> {
  const generatedAt = new Date();
  const contentItem = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: {
      blog: true,
      brandProfile: true,
      assets: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!contentItem) {
    throw new Error("content_item_not_found");
  }

  const safeContentItem = contentItem as unknown as ContentItemAdmin;
  const assets = contentItem.assets as unknown as ContentAssetAdmin[];
  const bloggerConnections = contentItem.blogId ? await listBloggerConnectionsForBlog(contentItem.blogId) : [];
  const qualityPreview = buildHtmlQualityPreview(safeContentItem, assets);
  const draftPayloadPreview = buildBloggerDraftPayloadPreview(safeContentItem, assets, bloggerConnections);
  const currentHashes = buildBloggerDraftApprovalSnapshotHashes(draftPayloadPreview, safeContentItem.draftHtml);
  const activeDraftApproval = await getActiveBloggerDraftApproval(contentItemId);
  const latestDraftApproval = activeDraftApproval ?? (await getLatestBloggerDraftApproval(contentItemId));
  const draftApprovalSummary = buildBloggerDraftApprovalSummary({
    approval: latestDraftApproval ? toBloggerDraftApprovalAdmin(latestDraftApproval) : null,
    approvalSnapshotHash: latestDraftApproval?.snapshotHash ?? null,
    currentSnapshotHash: currentHashes?.snapshotHash ?? null,
    currentDraftHtmlHash: currentHashes?.draftHtmlHash ?? null,
    currentPreviewReady: draftPayloadPreview.draftPayloadReady
  });
  const successfulDraftSaveForCurrentApproval = activeDraftApproval ? await getSuccessfulBloggerDraftSaveByApproval(activeDraftApproval.id) : null;
  const latestSuccessfulDraftSave = successfulDraftSaveForCurrentApproval ?? (await getLatestSuccessfulBloggerDraftSave(contentItemId));
  const latestPublishApprovalRaw = await findLatestBloggerPublishApprovalForContentItem(contentItemId);
  const latestPublishApproval = latestPublishApprovalRaw ? toBloggerPublishApprovalAdmin(latestPublishApprovalRaw) : null;
  const latestPublishAttemptRaw = await findLatestBloggerPublishExecutionAttemptForContentItem(contentItemId);
  const latestPublishAttempt = latestPublishAttemptRaw ? toBloggerPublishExecutionAttemptAdmin(latestPublishAttemptRaw) : null;
  const latestPublishAttemptReadback = latestPublishAttempt
    ? await prisma.bloggerPublishExecutionAttempt.findUnique({
        where: { id: latestPublishAttempt.id },
        select: {
          id: true,
          status: true,
          bloggerResponseRedactedJson: true
        }
      })
    : null;

  const markdownHashPrefix = safeContentItem.draftMarkdown ? hashPrefix(sha256(safeContentItem.draftMarkdown)) : null;
  const htmlHashPrefix = safeContentItem.draftHtml ? hashPrefix(hashDraftHtml(safeContentItem.draftHtml)) : null;
  const publishApprovalReady = Boolean(latestPublishApproval && latestPublishApproval.status === "approved_snapshot" && !latestPublishApproval.invalidatedAt);
  const postPublishReconciled = Boolean(
    safeContentItem.status === "published" &&
      safeContentItem.publishedAt &&
      latestPublishAttemptReadback?.status === "success" &&
      latestPublishAttemptReadback.bloggerResponseRedactedJson
  );

  const steps = buildSteps({
    contentItem: safeContentItem,
    qualityPreview,
    draftPayloadPreview,
    bloggerConnectionCount: bloggerConnections.length,
    selectedBlogReady: draftPayloadPreview.selectedBlogReady,
    draftApprovalStatus: draftApprovalSummary.approvalStatus,
    draftApprovalMatchesCurrentPreview: draftApprovalSummary.approvalMatchesCurrentPreview,
    latestSuccessfulDraftSave,
    publishApprovalReady,
    latestPublishAttempt,
    postPublishReconciled
  });
  const nextStep = steps.find((step) => step.status !== "done") ?? null;

  return {
    patchVersion: "9G-2A",
    generatedAt: generatedAt.toISOString(),
    contentItemId,
    contentStatus: safeContentItem.status,
    title: safeContentItem.title,
    summary: {
      hasPlanJson: Boolean(safeContentItem.planJson),
      hasDraftMarkdown: Boolean(safeContentItem.draftMarkdown?.trim()),
      hasDraftHtml: Boolean(safeContentItem.draftHtml?.trim()),
      draftMarkdownLength: safeContentItem.draftMarkdown?.length ?? 0,
      draftHtmlLength: safeContentItem.draftHtml?.length ?? 0,
      draftMarkdownHashPrefix: markdownHashPrefix,
      draftHtmlHashPrefix: htmlHashPrefix,
      qualityReady: qualityPreview.ready,
      qualityGrade: qualityPreview.grade,
      qualityScorePreview: qualityPreview.scorePreview,
      qualityRequiredFailCount: qualityPreview.checks.filter((check) => check.severity === "required" && check.status === "fail").length,
      seoEditorialGrade: qualityPreview.metadata.seoEditorialGrade,
      seoEditorialScore: qualityPreview.metadata.seoEditorialScore,
      draftPayloadReady: draftPayloadPreview.draftPayloadReady,
      bloggerConnectionCount: bloggerConnections.length,
      selectedBlogReady: draftPayloadPreview.selectedBlogReady,
      draftApprovalStatus: draftApprovalSummary.approvalStatus,
      draftApprovalMatchesCurrentPreview: draftApprovalSummary.approvalMatchesCurrentPreview,
      bloggerDraftSaved: Boolean(latestSuccessfulDraftSave),
      publishApprovalReady,
      publishExecutionAttemptStatus: latestPublishAttempt?.status ?? null,
      postPublishReconciled
    },
    steps,
    nextAction: nextStep
      ? {
          key: nextStep.key,
          label: nextStep.label,
          action: nextStep.action,
          blocked: nextStep.status === "blocked"
        }
      : {
          key: null,
          label: "Workflow complete",
          action: "이 content item은 SEO editorial draft부터 Blogger publish reconciliation까지 완료된 상태입니다.",
          blocked: false
        },
    sideEffectSummary: {
      dbRead: true,
      dbWrite: false,
      contentMutation: false,
      bloggerApiRead: false,
      bloggerApiWrite: false,
      bloggerDraftSave: false,
      bloggerPublish: false,
      tokenRefresh: false,
      llmCall: false
    }
  };
}

function buildSteps(input: {
  contentItem: ContentItemAdmin;
  qualityPreview: ReturnType<typeof buildHtmlQualityPreview>;
  draftPayloadPreview: ReturnType<typeof buildBloggerDraftPayloadPreview>;
  bloggerConnectionCount: number;
  selectedBlogReady: boolean;
  draftApprovalStatus: string;
  draftApprovalMatchesCurrentPreview: boolean;
  latestSuccessfulDraftSave: Awaited<ReturnType<typeof getLatestSuccessfulBloggerDraftSave>>;
  publishApprovalReady: boolean;
  latestPublishAttempt: ReturnType<typeof toBloggerPublishExecutionAttemptAdmin> | null;
  postPublishReconciled: boolean;
}): SeoEditorialWorkflowStep[] {
  const hasMarkdown = Boolean(input.contentItem.draftMarkdown?.trim());
  const hasHtml = Boolean(input.contentItem.draftHtml?.trim());
  const plannedOrPublished = input.contentItem.status === "planned" || input.contentItem.status === "published";
  const qualityReady = input.qualityPreview.ready;
  const seoEditorialPass = input.qualityPreview.metadata.seoEditorialGrade === "pass";
  const draftApprovalReady = input.draftApprovalStatus === "approved" && input.draftApprovalMatchesCurrentPreview;
  const draftSaved = Boolean(input.latestSuccessfulDraftSave);
  const publishAttemptReady = Boolean(input.latestPublishAttempt);
  const livePublishSucceeded = input.latestPublishAttempt?.status === "success" || input.postPublishReconciled;

  return [
    makeStep({
      key: "planned_content_item",
      label: "Planned content item",
      done: plannedOrPublished,
      blocked: input.contentItem.status !== "planned" && input.contentItem.status !== "published",
      message: plannedOrPublished ? "content item이 planned/published 상태입니다." : "새 SEO 글 후보를 적용하려면 planned content item이 필요합니다.",
      action: "published 글 수정이 아니라 새 글 발행이면 planned content item을 먼저 생성하세요.",
      evidence: {
        status: input.contentItem.status,
        title: input.contentItem.title
      }
    }),
    makeStep({
      key: "seo_markdown_candidate_applied",
      label: "SEO Markdown candidate applied",
      done: hasMarkdown,
      blocked: !input.contentItem.planJson,
      message: hasMarkdown ? "draftMarkdown 후보가 content item에 있습니다." : "SEO-sectioned Markdown 후보가 아직 없습니다.",
      action: "SEO-sectioned candidate를 생성하고 guarded apply 경로로 draftMarkdown 후보를 반영하세요.",
      evidence: {
        hasPlanJson: Boolean(input.contentItem.planJson),
        draftMarkdownLength: input.contentItem.draftMarkdown?.length ?? 0
      }
    }),
    makeStep({
      key: "blog_template_html_applied",
      label: "Blog template HTML applied",
      done: hasHtml,
      blocked: !hasMarkdown,
      message: hasHtml ? "draftHtml이 저장되어 있습니다." : "Markdown 후보에서 Blogger-ready HTML을 preview/apply해야 합니다.",
      action: "Blog post template preview를 생성하고 validate-html 통과 후 draftHtml에 수동 반영하세요.",
      evidence: {
        draftHtmlLength: input.contentItem.draftHtml?.length ?? 0
      }
    }),
    makeStep({
      key: "seo_quality_gate",
      label: "SEO editorial quality gate",
      done: qualityReady && seoEditorialPass,
      blocked: hasHtml && !qualityReady,
      message: qualityReady && seoEditorialPass ? "HTML quality와 SEO editorial gate가 통과했습니다." : "HTML quality 또는 SEO editorial gate 확인이 필요합니다.",
      action: "Quality Dry Run을 실행하고 required fail, editorial blocker, 과도한 브랜드 반복을 해결하세요.",
      evidence: {
        qualityReady,
        qualityGrade: input.qualityPreview.grade,
        qualityScorePreview: input.qualityPreview.scorePreview,
        seoEditorialGrade: input.qualityPreview.metadata.seoEditorialGrade,
        seoEditorialScore: input.qualityPreview.metadata.seoEditorialScore
      }
    }),
    makeStep({
      key: "blogger_connection_and_blog",
      label: "Blogger connection and target blog",
      done: input.bloggerConnectionCount === 1 && input.selectedBlogReady,
      blocked: input.bloggerConnectionCount !== 1 || !input.selectedBlogReady,
      message:
        input.bloggerConnectionCount === 1 && input.selectedBlogReady
          ? "Blogger connection과 verified target blog가 준비되었습니다."
          : "Blogger OAuth connection 또는 target blog 선택이 필요합니다.",
      action: "Settings > Blogger에서 OAuth 연결과 대상 blog 선택을 완료하세요.",
      evidence: {
        connectionCount: input.bloggerConnectionCount,
        selectedBlogReady: input.selectedBlogReady
      }
    }),
    makeStep({
      key: "draft_payload_preview",
      label: "Blogger draft payload preview",
      done: input.draftPayloadPreview.draftPayloadReady,
      blocked: !qualityReady || !input.selectedBlogReady,
      message: input.draftPayloadPreview.draftPayloadReady ? "Blogger draft payload preview가 ready입니다." : "Draft payload preview가 아직 ready가 아닙니다.",
      action: "Blogger Draft Payload Preview를 실행해 title/html/target blog snapshot을 확인하세요.",
      evidence: {
        draftPayloadReady: input.draftPayloadPreview.draftPayloadReady,
        blockingIssueCount: input.draftPayloadPreview.blockingIssues.length,
        titleCandidate: input.draftPayloadPreview.titleCandidate
      }
    }),
    makeStep({
      key: "draft_payload_approval",
      label: "Blogger draft approval snapshot",
      done: draftApprovalReady,
      blocked: input.draftApprovalStatus === "stale",
      message: draftApprovalReady ? "현재 preview와 일치하는 draft approval snapshot이 있습니다." : "현재 draft payload에 대한 manual approval snapshot이 필요합니다.",
      action: "Draft Payload Preview를 확인한 뒤 수동 approval snapshot을 생성하세요.",
      evidence: {
        approvalStatus: input.draftApprovalStatus,
        approvalMatchesCurrentPreview: input.draftApprovalMatchesCurrentPreview
      }
    }),
    makeStep({
      key: "guarded_draft_save",
      label: "Guarded Blogger draft save",
      done: draftSaved,
      blocked: !draftApprovalReady,
      message: draftSaved ? "Blogger draft save 성공 기록이 있습니다." : "Guarded Blogger draft save가 아직 실행되지 않았습니다.",
      action: "Draft Save Preflight 통과 후 사용자 명시 승인으로 Blogger draft save를 1회 실행하세요.",
      evidence: {
        draftSaved,
        bloggerPostId: input.latestSuccessfulDraftSave?.bloggerPostId ?? null,
        savedAt: input.latestSuccessfulDraftSave?.savedAt?.toISOString() ?? null
      }
    }),
    makeStep({
      key: "publish_approval",
      label: "Publish approval",
      done: input.publishApprovalReady,
      blocked: !draftSaved,
      message: input.publishApprovalReady ? "Publish approval snapshot이 준비되었습니다." : "Publish approval snapshot이 필요합니다.",
      action: "Draft save 이후 publish approval preview/readback을 확인하고 approval을 저장하세요.",
      evidence: {
        publishApprovalReady: input.publishApprovalReady
      }
    }),
    makeStep({
      key: "publish_execution_attempt",
      label: "Publish execution attempt",
      done: publishAttemptReady,
      blocked: !input.publishApprovalReady,
      message: publishAttemptReady ? "Publish execution attempt row가 있습니다." : "Publish execution attempt planning이 필요합니다.",
      action: "Publish execution attempt preview를 확인하고 guarded attempt row를 생성하세요.",
      evidence: {
        attemptStatus: input.latestPublishAttempt?.status ?? null,
        attemptId: input.latestPublishAttempt?.id ?? null
      }
    }),
    makeStep({
      key: "guarded_live_publish",
      label: "Guarded live Blogger publish",
      done: livePublishSucceeded,
      blocked: !publishAttemptReady,
      message: livePublishSucceeded ? "Guarded live publish가 성공 상태로 기록되었습니다." : "Live publish는 아직 성공 상태가 아닙니다.",
      action: "최종 dry-run 통과 후 사용자 승인과 live feature flag가 있을 때만 guarded live publish를 실행하세요.",
      evidence: {
        attemptStatus: input.latestPublishAttempt?.status ?? null
      }
    }),
    makeStep({
      key: "post_publish_reconciliation",
      label: "Post-publish reconciliation",
      done: input.postPublishReconciled,
      blocked: !livePublishSucceeded,
      message: input.postPublishReconciled ? "Local DB reconciliation까지 완료되었습니다." : "Blogger readback 이후 local DB reconciliation이 필요합니다.",
      action: "Publish result readback으로 Blogger 상태를 확인한 뒤 승인된 reconciliation apply를 실행하세요.",
      evidence: {
        contentStatus: input.contentItem.status,
        publishedAt: input.contentItem.publishedAt,
        reconciled: input.postPublishReconciled
      }
    })
  ];
}

function makeStep(input: {
  key: string;
  label: string;
  done: boolean;
  blocked: boolean;
  message: string;
  action: string;
  evidence: SeoEditorialWorkflowStep["evidence"];
}): SeoEditorialWorkflowStep {
  return {
    key: input.key,
    label: input.label,
    status: input.done ? "done" : input.blocked ? "blocked" : "ready",
    message: input.message,
    action: input.action,
    evidence: input.evidence
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
