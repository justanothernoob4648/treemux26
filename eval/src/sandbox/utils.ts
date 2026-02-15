import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { signPayload } from "../modal/hmac.js";

export const readVolumeJson = <T>(filePath: string): T => {
  const content = readFileSync(filePath, "utf-8");
  return JSON.parse(content) as T;
};

export const readVolumeText = (filePath: string): string =>
  readFileSync(filePath, "utf-8");

export const writeVolumeJson = (filePath: string, data: unknown): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
};

export const postWebhookNotification = async (
  webhookUrl: string,
  runId: string,
  taskType: string,
  taskId: string,
  hmacKey: string,
  payload: { status: "success" | "failed"; outputPath: string; error?: string },
): Promise<void> => {
  const hmac = signPayload(hmacKey, payload);
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(
        `${webhookUrl}/webhook/${runId}/${taskType}/${taskId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, hmac }),
        },
      );
      if (res.ok) return;
    } catch {
      if (attempt === maxRetries - 1) throw new Error("Webhook delivery failed after retries");
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
};

export const postProgressEvent = async (
  webhookUrl: string,
  runId: string,
  hmacKey: string,
  event: unknown,
): Promise<void> => {
  const payload = { type: "progress" as const, event };
  const hmac = signPayload(hmacKey, payload);
  try {
    await fetch(`${webhookUrl}/webhook/${runId}/progress/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, hmac }),
    });
  } catch {
    // Progress events are best-effort, don't retry
  }
};

export type SandboxArgs = {
  runId: string;
  volumePath: string;
  webhookUrl: string;
  hmacKey: string;
};

export const parseSandboxArgs = (args: string[]): SandboxArgs => {
  const getArg = (name: string): string => {
    const idx = args.indexOf(`--${name}`);
    if (idx === -1 || idx + 1 >= args.length) {
      throw new Error(`Missing required argument: --${name}`);
    }
    return args[idx + 1];
  };

  return {
    runId: getArg("run-id"),
    volumePath: getArg("volume"),
    webhookUrl: getArg("webhook-url"),
    hmacKey: process.env.WEBHOOK_HMAC_KEY ?? getArg("hmac-key"),
  };
};
