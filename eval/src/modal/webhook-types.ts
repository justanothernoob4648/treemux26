import { z } from "zod";

export const WebhookNotificationSchema = z.object({
  status: z.enum(["success", "failed"]),
  outputPath: z.string(),
  error: z.string().optional(),
  hmac: z.string(),
});
export type WebhookNotification = z.infer<typeof WebhookNotificationSchema>;

export const WebhookProgressSchema = z.object({
  type: z.literal("progress"),
  event: z.object({
    type: z.string(),
    message: z.string().optional(),
    projectName: z.string().optional(),
    judgeName: z.string().optional(),
    projectIndex: z.number().optional(),
    totalProjects: z.number().optional(),
  }),
  hmac: z.string(),
});
export type WebhookProgress = z.infer<typeof WebhookProgressSchema>;

export type TaskType = "planner" | "research" | "judge" | "report";

export type PendingTask = {
  taskId: string;
  taskType: TaskType;
  resolve: (notification: WebhookNotification) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
};

export const DeliveryPayloadSchema = z.object({
  runId: z.string(),
  rankings: z.array(z.unknown()),
  outliers: z.unknown(),
  reports: z.object({
    deepReports: z.record(z.string(), z.string()),
    summary: z.string(),
  }),
  metadata: z.object({
    scenario: z.string(),
    projectCount: z.number(),
    judgeCount: z.number(),
    completedAt: z.string(),
  }),
});
export type DeliveryPayload = z.infer<typeof DeliveryPayloadSchema>;

export const DeliveryProgressPayloadSchema = z.object({
  runId: z.string(),
  type: z.literal("progress"),
  event: z.unknown(),
});
export type DeliveryProgressPayload = z.infer<typeof DeliveryProgressPayloadSchema>;
