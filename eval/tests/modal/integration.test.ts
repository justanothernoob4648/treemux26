import { describe, it, expect } from "vitest";
import { buildSandboxCommand, volumePaths } from "../../src/modal/client.js";
import { WebhookServer } from "../../src/modal/webhook-server.js";
import { generateHmacKey, signPayload } from "../../src/modal/hmac.js";
import { Semaphore } from "../../src/modal/semaphore.js";
import { buildDeliveryPayload } from "../../src/modal/delivery.js";

describe("Modal integration smoke test", () => {
  it("full webhook flow: dispatch → notify → resolve", async () => {
    const hmacKey = generateHmacKey();
    const server = new WebhookServer({ hmacKey, port: 0 });
    const url = await server.start();

    try {
      const runId = "test-run";
      const taskPromise = server.waitForTask(runId, "planner", "planner", 5000);

      // Simulate sandbox completing and posting webhook
      const payload = { status: "success" as const, outputPath: "/mnt/eval/test-run/outputs/plan.json" };
      const hmac = signPayload(hmacKey, payload);

      await fetch(`${url}/webhook/${runId}/planner/planner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, hmac }),
      });

      const result = await taskPromise;
      expect(result.status).toBe("success");
    } finally {
      await server.stop();
    }
  });

  it("concurrent judge dispatch with semaphore", async () => {
    const sem = new Semaphore(2);
    let maxConcurrent = 0;
    let current = 0;

    const simulateJudge = async (name: string) => {
      const release = await sem.acquire();
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((r) => setTimeout(r, 50));
      current--;
      release();
      return name;
    };

    const results = await Promise.all([
      simulateJudge("judge1"),
      simulateJudge("judge2"),
      simulateJudge("judge3"),
      simulateJudge("judge4"),
    ]);

    expect(results).toEqual(["judge1", "judge2", "judge3", "judge4"]);
    expect(maxConcurrent).toBe(2);
  });

  it("delivery payload has all required fields", () => {
    const payload = buildDeliveryPayload({
      runId: "run-test",
      scenario: "Test Hackathon",
      rankings: [],
      outliers: { noOutliersDetected: true },
      reports: { deepReports: {}, summary: "" },
      projectCount: 5,
      judgeCount: 3,
    });

    expect(payload.runId).toBe("run-test");
    expect(payload.metadata.scenario).toBe("Test Hackathon");
    expect(payload.metadata.completedAt).toBeTruthy();
  });

  it("sandbox commands are well-formed", () => {
    const cmd = buildSandboxCommand("judge", {
      runId: "run-123",
      volumePath: "/mnt/eval",
      webhookUrl: "https://webhook.example.com",
      extraArgs: { project: "HealthBot", judge: "TechJudge" },
    });

    expect(cmd[0]).toBe("node");
    expect(cmd[1]).toBe("dist/sandbox/judge.js");
    expect(cmd).toContain("--run-id");
    expect(cmd).toContain("--project");
    expect(cmd).toContain("--judge");
  });
});
