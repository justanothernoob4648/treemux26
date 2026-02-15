import { describe, it, expect } from "vitest";
import { buildJudgePrompt } from "../../src/agents/judge.js";
import type { Project, JudgeSpec, ReportConfig } from "../../src/types.js";

const baseJudge: JudgeSpec = {
  name: "test_judge",
  role: "Test evaluator",
  systemPrompt: "You are a test judge.",
  scoringCategories: [{ category: "Quality", description: "Overall quality", weight: 1.0 }],
  needsBrowser: true,
  source: "auto",
};

const reportConfig: ReportConfig = {
  feedbackTone: "balanced",
  includeScreenshots: false,
  includeTrackRecommendations: false,
};

describe("buildJudgePrompt", () => {
  it("includes idea when provided", () => {
    const project: Project = {
      name: "test-project",
      url: "https://example.com",
      idea: "A waste tracking app that monitors daily consumption",
      pitch: "We built a production-ready waste tracker",
    };
    const prompt = buildJudgePrompt(project, baseJudge, "context", "1-10 scale", reportConfig);
    expect(prompt).toContain("A waste tracking app that monitors daily consumption");
    expect(prompt).toContain("We built a production-ready waste tracker");
  });

  it("handles missing idea gracefully", () => {
    const project: Project = {
      name: "test-project",
      url: "https://example.com",
      pitch: "We built a production-ready waste tracker",
    };
    const prompt = buildJudgePrompt(project, baseJudge, "context", "1-10 scale", reportConfig);
    expect(prompt).toContain("We built a production-ready waste tracker");
    expect(prompt).not.toContain("undefined");
  });
});
