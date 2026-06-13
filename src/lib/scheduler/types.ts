export type PublishJobStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface PublishJob {
  id: string;
  contentItemId: string;
  scheduledAt: string;
  status: PublishJobStatus;
  retryCount: number;
}
