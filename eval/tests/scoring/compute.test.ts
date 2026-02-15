import { describe, it, expect } from "vitest";
import { computeOverallScore, computeCompositeScore } from "../../src/scoring/compute.js";
import type { CategoryScore } from "../../src/types.js";

describe("computeOverallScore", () => {
  it("computes weighted average of category scores", () => {
    const scores: CategoryScore[] = [
      { category: "Innovation", score: 8, weight: 0.4, reasoning: "" },
      { category: "Technical", score: 6, weight: 0.3, reasoning: "" },
      { category: "UX", score: 9, weight: 0.3, reasoning: "" },
    ];
    expect(computeOverallScore(scores)).toBeCloseTo(7.7, 5);
  });

  it("handles equal weights", () => {
    const scores: CategoryScore[] = [
      { category: "A", score: 6, weight: 1, reasoning: "" },
      { category: "B", score: 8, weight: 1, reasoning: "" },
      { category: "C", score: 10, weight: 1, reasoning: "" },
    ];
    expect(computeOverallScore(scores)).toBeCloseTo(8, 5);
  });

  it("handles single category", () => {
    const scores: CategoryScore[] = [
      { category: "Only", score: 7, weight: 1, reasoning: "" },
    ];
    expect(computeOverallScore(scores)).toBeCloseTo(7, 5);
  });

  it("returns 0 for empty scores", () => {
    expect(computeOverallScore([])).toBe(0);
  });
});

describe("computeCompositeScore", () => {
  it("computes weighted average across judges", () => {
    const normalized = { judgeA: 7, judgeB: 9 };
    const weights = { judgeA: 1, judgeB: 1 };
    expect(computeCompositeScore(normalized, weights)).toBeCloseTo(8, 5);
  });

  it("defaults to equal weights", () => {
    const normalized = { judgeA: 6, judgeB: 8 };
    expect(computeCompositeScore(normalized)).toBeCloseTo(7, 5);
  });

  it("returns 0 for empty input", () => {
    expect(computeCompositeScore({})).toBe(0);
  });
});
