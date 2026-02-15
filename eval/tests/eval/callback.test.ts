import { describe, it, expect } from "vitest";
import { buildSuccessPayload, buildErrorPayload } from "../../src/eval/callback.js";
import type { ProjectScores, OutlierAnalysis } from "../../src/types.js";

describe("buildSuccessPayload", () => {
  it("serializes rankings with judge results", () => {
    const rankings: ProjectScores[] = [
      {
        projectName: "project-1",
        compositeScore: 8.5,
        overallScores: { innovation_judge: 9.0 },
        normalizedScores: { innovation_judge: 8.7 },
        judgeResults: [
          {
            projectName: "project-1",
            judgeName: "innovation_judge",
            scores: [{ category: "Innovation", score: 9, weight: 1.0, reasoning: "Great idea" }],
            feedback: { strengths: ["Novel approach"], weaknesses: [], suggestions: [], summary: "Good" },
            feedbackSignal: { improvementPriorities: [], keyDifferentiators: ["Unique"], dealBreakers: [] },
            resourceAccessible: "fully_accessible",
          },
        ],
      },
    ];
    const outliers: OutlierAnalysis = {
      globalOutliers: [],
      dimensionalOutliers: [],
      uniqueProfiles: [],
      recommended: [],
      patterns: { commonStrengths: [], commonWeaknesses: [], differentiatingFactors: [] },
      noOutliersDetected: true,
    };

    const payload = buildSuccessPayload("run-123", rankings, outliers, "# Summary");

    expect(payload.status).toBe("success");
    expect(payload.runId).toBe("run-123");
    expect(payload.rankings).toHaveLength(1);
    expect(payload.rankings[0].projectName).toBe("project-1");
    expect(payload.rankings[0].judgeResults).toHaveLength(1);
    expect(payload.summary).toBe("# Summary");
    expect(payload.metadata.projectCount).toBe(1);
    expect(payload.metadata.completedAt).toBeTruthy();
  });
});

describe("buildErrorPayload", () => {
  it("creates error payload with status and message", () => {
    const payload = buildErrorPayload("run-456", "Planner sandbox timed out");
    expect(payload.status).toBe("error");
    expect(payload.runId).toBe("run-456");
    expect(payload.error).toBe("Planner sandbox timed out");
  });
});
