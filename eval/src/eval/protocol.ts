import { z } from "zod";
import { IncomingWebhookSchema } from "./schemas.js";
import type { ProgressEvent } from "../types.js";

export const ClientMessageSchema = z.object({
  type: z.literal("evaluate"),
  evaluator: IncomingWebhookSchema.shape.evaluator,
  builds: IncomingWebhookSchema.shape.builds,
});

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export function createQueuedMessage(runId: string) {
  return { type: "queued" as const, runId };
}

export function createProgressMessage(runId: string, event: ProgressEvent) {
  return { type: "progress" as const, runId, event };
}

export function createResultMessage(runId: string, payload: { status: string; runId: string; [key: string]: unknown }) {
  const { runId: _payloadRunId, ...rest } = payload;
  return { type: "result" as const, runId, ...rest };
}
