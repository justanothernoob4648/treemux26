/**
 * Mocked input layer for Treemux black box.
 * In production this would come from API/UI.
 */

import type { TaskInput } from "./types.ts";

export const MOCK_INPUT: TaskInput = {
  taskDescription: "You are participating in TreeHacks 2026. You are a CS major and you want to build a very innovative and useful app that will help people in their daily lives.",
  workers: 1,
  workerDescriptions: [
    "I like backend and enjoy building APIs and data models.",
    // "I prefer frontend and enjoy polished UI and animations.",
  ],
  evaluator: {
    count: 1,
    role: "judge",
    criteria: ["clarity", "sellability", "conciseness"],
  },
  model: process.env.MODEL,
};

/** Base URL for implementation callbacks (steps/done). Must be reachable from Modal (e.g. ngrok in dev). */
export const CALLBACK_BASE_URL = process.env.CALLBACK_BASE_URL ?? "http://localhost:3001";

/** Webhook URL to POST final [{ url, pitch }] when all deployments are done (legacy) */
export const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";

/** Evaluator webhook: POST [{ url, pitch }, ...] when all jobs complete */
export const EVALUATOR_WEBHOOK_URL = process.env.EVALUATOR_WEBHOOK_URL ?? process.env.WEBHOOK_URL ?? "";
