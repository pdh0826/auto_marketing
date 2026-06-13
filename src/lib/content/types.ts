export type ContentMode = "seo_keyword" | "service_promotion" | "memo_expand" | "existing_draft_improve";
export type ContentStatus =
  | "idea"
  | "planned"
  | "drafted"
  | "quality_review"
  | "approved"
  | "scheduled"
  | "published"
  | "failed"
  | "rewrite_needed";

export interface ContentItem {
  id: string;
  blogId?: string;
  brandProfileId?: string;
  mode: ContentMode;
  status: ContentStatus;
  title?: string;
  targetKeyword?: string;
  sourceMemo?: string;
  planJson?: Record<string, unknown>;
  draftMarkdown?: string;
  draftHtml?: string;
  qualityScore?: number;
  scheduledAt?: Date;
  publishedAt?: Date;
}
