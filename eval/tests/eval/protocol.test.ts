import { describe, it, expect } from "vitest";
import {
  ClientMessageSchema,
  createQueuedMessage,
  createProgressMessage,
  createResultMessage,
} from "../../src/eval/protocol.js";
import type { ProgressEvent } from "../../src/types.js";

describe("ClientMessageSchema", () => {
  const validMessage = {
    type: "evaluate",
    evaluator: { counter: 2, criteria: "test criteria", role: "judge" },
    builds: [{ url: "https://example.com", idea: "test idea", pitch: "test pitch" }],
  };

  it("accepts a valid evaluate message", () => {
    const result = ClientMessageSchema.safeParse(validMessage);
    expect(result.success).toBe(true);
  });

  it("rejects message with wrong type", () => {
    const result = ClientMessageSchema.safeParse({ ...validMessage, type: "unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects message missing type field", () => {
    const { type: _, ...noType } = validMessage;
    const result = ClientMessageSchema.safeParse(noType);
    expect(result.success).toBe(false);
  });

  it("rejects message with empty builds array", () => {
    const result = ClientMessageSchema.safeParse({ ...validMessage, builds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects message missing evaluator", () => {
    const { evaluator: _, ...noEvaluator } = validMessage;
    const result = ClientMessageSchema.safeParse(noEvaluator);
    expect(result.success).toBe(false);
  });
});

describe("createQueuedMessage", () => {
  it("produces correct shape", () => {
    const msg = createQueuedMessage("run-123");
    expect(msg).toEqual({ type: "queued", runId: "run-123" });
  });
});

describe("createProgressMessage", () => {
  it("wraps a progress event with runId", () => {
    const event: ProgressEvent = { type: "planning", message: "Designing judges" };
    const msg = createProgressMessage("run-456", event);
    expect(msg).toEqual({
      type: "progress",
      runId: "run-456",
      event: { type: "planning", message: "Designing judges" },
    });
  });
});

describe("createResultMessage", () => {
  it("wraps a success payload", () => {
    const payload = { status: "success" as const, runId: "run-789", rankings: [], outliers: {}, summary: "done", metadata: {} };
    const msg = createResultMessage("run-789", payload);
    expect(msg).toEqual({
      type: "result",
      runId: "run-789",
      status: "success",
      rankings: [],
      outliers: {},
      summary: "done",
      metadata: {},
    });
  });

  it("wraps an error payload", () => {
    const payload = { status: "error" as const, runId: "run-err", error: "something broke" };
    const msg = createResultMessage("run-err", payload);
    expect(msg).toEqual({
      type: "result",
      runId: "run-err",
      status: "error",
      error: "something broke",
    });
  });
});
