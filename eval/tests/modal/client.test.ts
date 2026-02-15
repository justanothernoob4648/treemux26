import { describe, it, expect } from "vitest";
import { buildSandboxCommand, volumePaths } from "../../src/modal/client.js";

describe("Modal client helpers", () => {
  it("buildSandboxCommand creates correct planner command", () => {
    const cmd = buildSandboxCommand("planner", {
      runId: "run-123",
      volumePath: "/mnt/eval",
      webhookUrl: "https://example.com",
    });
    expect(cmd).toEqual([
      "node", "dist/sandbox/planner.js",
      "--run-id", "run-123",
      "--volume", "/mnt/eval",
      "--webhook-url", "https://example.com",
    ]);
  });

  it("buildSandboxCommand creates correct judge command with extra args", () => {
    const cmd = buildSandboxCommand("judge", {
      runId: "run-123",
      volumePath: "/mnt/eval",
      webhookUrl: "https://example.com",
      extraArgs: { project: "HealthBot", judge: "TechJudge" },
    });
    expect(cmd).toContain("--project");
    expect(cmd).toContain("HealthBot");
    expect(cmd).toContain("--judge");
    expect(cmd).toContain("TechJudge");
  });

  it("buildSandboxCommand creates correct research command", () => {
    const cmd = buildSandboxCommand("research", {
      runId: "run-123",
      volumePath: "/mnt/eval",
      webhookUrl: "https://example.com",
      extraArgs: { judge: "Michael Seibel" },
    });
    expect(cmd).toContain("--judge");
    expect(cmd).toContain("Michael Seibel");
  });

  it("volumePaths returns correct paths for a run", () => {
    const paths = volumePaths("run-123", "/mnt/eval");
    expect(paths.inputs).toBe("/mnt/eval/run-123/inputs");
    expect(paths.outputs).toBe("/mnt/eval/run-123/outputs");
    expect(paths.checkpoints).toBe("/mnt/eval/run-123/checkpoints");
  });
});
