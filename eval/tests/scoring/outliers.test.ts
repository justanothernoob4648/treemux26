import { describe, it, expect } from "vitest";
import {
  detectGlobalOutliers,
  detectDimensionalOutliers,
  cosineSimilarity,
} from "../../src/scoring/outliers.js";
import type { ProjectScores, JudgeResult, OutlierConfig } from "../../src/types.js";

const defaultConfig: OutlierConfig = {
  globalThreshold: 1.5,
  dimensionalThreshold: 2.0,
  minQualityPercentile: 50,
  maxRecommended: 10,
  diversityWeight: 0.3,
};

function makeProjectScores(name: string, composite: number): ProjectScores {
  return {
    projectName: name,
    judgeResults: [],
    overallScores: {},
    normalizedScores: {},
    compositeScore: composite,
  };
}

describe("detectGlobalOutliers", () => {
  it("finds projects above threshold SDs from mean", () => {
    const projects = [
      makeProjectScores("A", 5),
      makeProjectScores("B", 5),
      makeProjectScores("C", 5),
      makeProjectScores("D", 5),
      makeProjectScores("E", 9.5),
    ];
    const outliers = detectGlobalOutliers(projects, defaultConfig);
    expect(outliers.length).toBeGreaterThanOrEqual(1);
    expect(outliers[0].projectName).toBe("E");
  });

  it("returns empty when no outliers exist", () => {
    const projects = [
      makeProjectScores("A", 5),
      makeProjectScores("B", 5.1),
      makeProjectScores("C", 5.2),
    ];
    const outliers = detectGlobalOutliers(projects, defaultConfig);
    expect(outliers).toHaveLength(0);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 5);
  });
  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });
  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });
});

describe("detectDimensionalOutliers", () => {
  it("finds projects that spike in a specific category", () => {
    const makeResult = (project: string, judge: string, cat: string, score: number): JudgeResult => ({
      projectName: project,
      judgeName: judge,
      scores: [{ category: cat, score, weight: 1, reasoning: "" }],
      feedback: { strengths: [], weaknesses: [], suggestions: [], summary: "" },
      feedbackSignal: { improvementPriorities: [], keyDifferentiators: [], dealBreakers: [] },
      resourceAccessible: "fully_accessible",
    });

    const allResults: Map<string, JudgeResult[]> = new Map([
      ["A", [makeResult("A", "j1", "Innovation", 5)]],
      ["B", [makeResult("B", "j1", "Innovation", 5)]],
      ["C", [makeResult("C", "j1", "Innovation", 5)]],
      ["E", [makeResult("E", "j1", "Innovation", 5)]],
      ["F", [makeResult("F", "j1", "Innovation", 5)]],
      ["D", [makeResult("D", "j1", "Innovation", 10)]],
    ]);

    const outliers = detectDimensionalOutliers(allResults, defaultConfig);
    expect(outliers.length).toBeGreaterThanOrEqual(1);
    expect(outliers[0].projectName).toBe("D");
    expect(outliers[0].dimension).toContain("Innovation");
  });
});
