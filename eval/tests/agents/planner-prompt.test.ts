import { describe, it, expect } from "vitest";
import { buildPlannerSystemPrompt } from "../../src/agents/planner.js";

describe("buildPlannerSystemPrompt", () => {
  it("includes judge count when provided", () => {
    const prompt = buildPlannerSystemPrompt({ judgeCount: 3 });
    expect(prompt).toContain("exactly 3 judges");
  });

  it("uses default 2-5 range when no count provided", () => {
    const prompt = buildPlannerSystemPrompt();
    expect(prompt).toContain("2-5 judges");
  });
});
