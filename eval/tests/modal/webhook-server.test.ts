import { describe, it, expect, afterEach } from "vitest";
import { WebhookServer } from "../../src/modal/webhook-server.js";
import { signPayload, generateHmacKey } from "../../src/modal/hmac.js";

describe("WebhookServer", () => {
  let server: WebhookServer;

  afterEach(async () => {
    if (server) await server.stop();
  });

  it("starts and returns a URL", async () => {
    const hmacKey = generateHmacKey();
    server = new WebhookServer({ hmacKey, port: 0 });
    const url = await server.start();
    expect(url).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it("resolves a pending task when valid webhook received", async () => {
    const hmacKey = generateHmacKey();
    server = new WebhookServer({ hmacKey, port: 0 });
    const url = await server.start();

    const resultPromise = server.waitForTask("run-1", "planner", "task-1", 5000);

    const payload = { status: "success", outputPath: "/mnt/eval/plan.json" };
    const hmac = signPayload(hmacKey, payload);

    const res = await fetch(`${url}/webhook/run-1/planner/task-1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, hmac }),
    });

    expect(res.status).toBe(200);
    const result = await resultPromise;
    expect(result.status).toBe("success");
    expect(result.outputPath).toBe("/mnt/eval/plan.json");
  });

  it("rejects webhook with invalid HMAC", async () => {
    const hmacKey = generateHmacKey();
    server = new WebhookServer({ hmacKey, port: 0 });
    const url = await server.start();

    const payload = { status: "success", outputPath: "/mnt/eval/plan.json" };

    const res = await fetch(`${url}/webhook/run-1/planner/task-1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, hmac: "invalid" }),
    });

    expect(res.status).toBe(403);
  });

  it("times out when no webhook arrives", async () => {
    const hmacKey = generateHmacKey();
    server = new WebhookServer({ hmacKey, port: 0 });
    await server.start();

    await expect(
      server.waitForTask("run-1", "planner", "task-1", 100),
    ).rejects.toThrow("timeout");
  });
});
