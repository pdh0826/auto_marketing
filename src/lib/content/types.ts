export type ContentMode = "seo_keyword" | "service_promotion" | "memo_expand" | "article_rewrite";
export type ContentStatus = "idea" | "planned" | "drafted" | "quality_review" | "approved" | "scheduled" | "published" | "failed";

export interface ContentItem {
  id: string;
  mode: ContentMode;
  status: ContentStatus;
  title?: string;
  targetKeyword?: string;
  draftHtml?: string;
  qualityScore?: number;
}
