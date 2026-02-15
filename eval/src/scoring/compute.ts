import type { CategoryScore, JudgeResult, ProjectScores } from "../types.js";

export function computeOverallScore(scores: CategoryScore[]): number {
  if (scores.length === 0) return 0;
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = scores.reduce((sum, s) => sum + s.score * s.weight, 0);
  return weightedSum / totalWeight;
}

export function computeCompositeScore(
  normalizedScores: Record<string, number>,
  judgeWeights?: Record<string, number>,
): number {
  const judges = Object.keys(normalizedScores);
  if (judges.length === 0) return 0;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const judge of judges) {
    const weight = judgeWeights?.[judge] ?? 1;
    weightedSum += normalizedScores[judge] * weight;
    totalWeight += weight;
  }
  return weightedSum / totalWeight;
}

export function buildProjectScores(
  projectName: string,
  judgeResults: JudgeResult[],
  normalizedScores: Record<string, number>,
  judgeWeights?: Record<string, number>,
): ProjectScores {
  const overallScores: Record<string, number> = {};
  for (const result of judgeResults) {
    overallScores[result.judgeName] = computeOverallScore(result.scores);
  }
  return {
    projectName,
    judgeResults,
    overallScores,
    normalizedScores,
    compositeScore: computeCompositeScore(normalizedScores, judgeWeights),
  };
}
