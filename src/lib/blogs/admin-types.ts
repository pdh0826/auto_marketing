export type BlogStatus = "active" | "inactive";
export type CtaStrength = "weak" | "normal" | "strong";

export interface BlogAdmin {
  id: string;
  name: string;
  url: string;
  bloggerBlogId: string | null;
  mainTopic: string | null;
  subTopics: string[];
  targetReader: string | null;
  tone: string | null;
  locale: string;
  forbiddenPhrases: string[];
  preferredPhrases: string[];
  defaultContentLength: number;
  defaultCtaStrength: CtaStrength;
  dailyPublishLimit: number;
  nightExcludeStart: string | null;
  nightExcludeEnd: string | null;
  autoPublishEnabled: boolean;
  manualApprovalRequired: boolean;
  status: BlogStatus;
  createdAt: string;
  updatedAt: string;
}
