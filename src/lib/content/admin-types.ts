import type { BlogAdmin } from "@/lib/blogs/admin-types";
import type { BrandProfileAdmin } from "@/lib/brands/admin-types";
import type { ContentMode, ContentStatus } from "./types";

export interface ContentItemAdmin {
  id: string;
  blogId: string | null;
  brandProfileId: string | null;
  mode: ContentMode;
  status: ContentStatus;
  title: string | null;
  targetKeyword: string | null;
  sourceMemo: string | null;
  planJson: Record<string, unknown> | null;
  draftMarkdown: string | null;
  draftHtml: string | null;
  qualityScore: number | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  blog?: BlogAdmin | null;
  brandProfile?: BrandProfileAdmin | null;
}
