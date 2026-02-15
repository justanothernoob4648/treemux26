import { describe, it, expect } from "vitest";
import { normalizeScores, mean, stddev } from "../../src/scoring/normalize.js";

describe("mean", () => {
  it("computes arithmetic mean", () => {
    expect(mean([2, 4, 6])).toBeCloseTo(4, 5);
  });
  it("returns 0 for empty array", () => {
    expect(mean([])).toBe(0);
  });
});

describe("stddev", () => {
  it("computes population standard deviation", () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 0);
  });
  it("returns 0 for single value", () => {
    expect(stddev([5])).toBe(0);
  });
  it("returns 0 for identical values", () => {
    expect(stddev([5, 5, 5])).toBe(0);
  });
});

describe("normalizeScores", () => {
  it("normalizes harsh and generous judges to same scale", () => {
    const judgeScores: Record<string, number[]> = {
      judgeA: [3, 4, 5],
      judgeB: [7, 8, 9],
    };
    const normalized = normalizeScores(judgeScores);
    expect(normalized.judgeA[1]).toBeCloseTo(5.5, 1);
    expect(normalized.judgeB[1]).toBeCloseTo(5.5, 1);
    expect(normalized.judgeA[2]).toBeGreaterThan(normalized.judgeA[1]);
    expect(normalized.judgeA[1]).toBeGreaterThan(normalized.judgeA[0]);
  });

  it("clamps to [1, 10]", () => {
    const judgeScores: Record<string, number[]> = {
      judgeA: [1, 1, 1, 1, 10],
    };
    const normalized = normalizeScores(judgeScores);
    for (const score of normalized.judgeA) {
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    }
  });

  it("skips normalization when stddev is 0", () => {
    const judgeScores: Record<string, number[]> = {
      judgeA: [5, 5, 5],
    };
    const normalized = normalizeScores(judgeScores);
    expect(normalized.judgeA).toEqual([5, 5, 5]);
  });

  it("skips normalization for single project", () => {
    const judgeScores: Record<string, number[]> = {
      judgeA: [7],
    };
    const normalized = normalizeScores(judgeScores);
    expect(normalized.judgeA).toEqual([7]);
  });
});
