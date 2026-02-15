import type { DeliveryWebhookConfig } from "../types.js";

type DeliveryPayloadInput = {
  runId: string;
  scenario: string;
  rankings: unknown[];
  outliers: unknown;
  reports: { deepReports: Record<string, string>; summary: string };
  projectCount: number;
  judgeCount: number;
};

export const buildDeliveryPayload = (input: DeliveryPayloadInput) => ({
  runId: input.runId,
  rankings: input.rankings,
  outliers: input.outliers,
  reports: input.reports,
  metadata: {
    scenario: input.scenario,
    projectCount: input.projectCount,
    judgeCount: input.judgeCount,
    completedAt: new Date().toISOString(),
  },
});

export const buildProgressPayload = (runId: string, event: unknown) => ({
  runId,
  type: "progress" as const,
  event,
});

export const sendDeliveryWebhook = async (
  config: DeliveryWebhookConfig,
  payload: unknown,
): Promise<void> => {
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...config.headers,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) return;
    } catch {
      if (attempt === maxRetries - 1) {
        throw new Error(`Delivery webhook failed after ${maxRetries} retries`);
      }
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
};

export const sendProgressToDelivery = async (
  config: DeliveryWebhookConfig,
  runId: string,
  event: unknown,
): Promise<void> => {
  const payload = buildProgressPayload(runId, event);
  try {
    await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Progress delivery is best-effort
  }
};
