import type {
  ProjectScores,
  JudgeResult,
  OutlierConfig,
  GlobalOutlier,
  DimensionalOutlier,
  UniqueProfile,
  RecommendedOutlier,
  OutlierAnalysis,
} from "../types.js";
import { mean, stddev } from "./normalize.js";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

export function detectGlobalOutliers(
  projects: ProjectScores[],
  config: OutlierConfig,
): GlobalOutlier[] {
  const scores = projects.map((p) => p.compositeScore);
  const m = mean(scores);
  const sd = stddev(scores);
  if (sd === 0) return [];
  const threshold = m + config.globalThreshold * sd;
  const sorted = [...scores].sort((a, b) => a - b);
  return projects
    .filter((p) => p.compositeScore > threshold)
    .map((p) => ({
      projectName: p.projectName,
      compositeScore: p.compositeScore,
      percentile: (sorted.filter((s) => s <= p.compositeScore).length / sorted.length) * 100,
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);
}

export function detectDimensionalOutliers(
  allResults: Map<string, JudgeResult[]>,
  config: OutlierConfig,
): DimensionalOutlier[] {
  const dimensions: Map<string, Map<string, number>> = new Map();
  for (const [projectName, results] of allResults) {
    for (const result of results) {
      for (const score of result.scores) {
        const dim = `${result.judgeName} > ${score.category}`;
        if (!dimensions.has(dim)) dimensions.set(dim, new Map());
        dimensions.get(dim)!.set(projectName, score.score);
      }
    }
  }
  const outliers: DimensionalOutlier[] = [];
  for (const [dim, projectScores] of dimensions) {
    const scores = [...projectScores.values()];
    const m = mean(scores);
    const sd = stddev(scores);
    if (sd === 0) continue;
    for (const [projectName, score] of projectScores) {
      const z = (score - m) / sd;
      if (z > config.dimensionalThreshold) {
        outliers.push({ projectName, dimension: dim, score, zScore: z });
      }
    }
  }
  return outliers.sort((a, b) => b.zScore - a.zScore);
}

export function detectUniqueProfiles(
  projects: ProjectScores[],
  allResults: Map<string, JudgeResult[]>,
  config: OutlierConfig,
): UniqueProfile[] {
  const sorted = [...projects].sort((a, b) => a.compositeScore - b.compositeScore);
  const cutoffIndex = Math.floor(sorted.length * (config.minQualityPercentile / 100));
  const qualifiedProjects = sorted.slice(cutoffIndex);
  if (qualifiedProjects.length < 2) return [];
  const allDimensions = new Set<string>();
  for (const results of allResults.values()) {
    for (const result of results) {
      for (const score of result.scores) {
        allDimensions.add(`${result.judgeName}:${score.category}`);
      }
    }
  }
  const dimList = [...allDimensions].sort();
  function buildVector(projectName: string): number[] {
    const results = allResults.get(projectName) ?? [];
    const scoreMap = new Map<string, number>();
    for (const result of results) {
      for (const score of result.scores) {
        scoreMap.set(`${result.judgeName}:${score.category}`, score.score);
      }
    }
    return dimList.map((dim) => scoreMap.get(dim) ?? 0);
  }
  const vectors = new Map<string, number[]>();
  for (const p of qualifiedProjects) {
    vectors.set(p.projectName, buildVector(p.projectName));
  }
  const centroid = dimList.map((_, i) => {
    const vals = [...vectors.values()].map((v) => v[i]);
    return mean(vals);
  });
  return qualifiedProjects
    .map((p) => {
      const vec = vectors.get(p.projectName)!;
      const similarity = cosineSimilarity(vec, centroid);
      return { projectName: p.projectName, distinctiveness: 1 - similarity, description: "" };
    })
    .filter((p) => p.distinctiveness > 0.1)
    .sort((a, b) => b.distinctiveness - a.distinctiveness);
}

export function buildRecommendedSet(
  global: GlobalOutlier[],
  dimensional: DimensionalOutlier[],
  unique: UniqueProfile[],
  config: OutlierConfig,
): RecommendedOutlier[] {
  const seen = new Set<string>();
  const recommended: RecommendedOutlier[] = [];
  function add(name: string, reason: string, type: "global" | "dimensional" | "unique") {
    if (seen.has(name)) {
      const existing = recommended.find((r) => r.projectName === name)!;
      existing.outlierTypes.push(type);
      existing.selectionReason += `; ${reason}`;
      return;
    }
    seen.add(name);
    recommended.push({ projectName: name, selectionReason: reason, outlierTypes: [type] });
  }
  for (const o of global) add(o.projectName, `Top composite score: ${o.compositeScore.toFixed(1)}`, "global");
  for (const o of dimensional) add(o.projectName, `Spike in ${o.dimension}: ${o.score}`, "dimensional");
  for (const o of unique) add(o.projectName, `Unique scoring profile (distinctiveness: ${o.distinctiveness.toFixed(2)})`, "unique");
  return recommended.slice(0, config.maxRecommended);
}

export function detectOutliers(
  projects: ProjectScores[],
  allResults: Map<string, JudgeResult[]>,
  config: OutlierConfig,
): OutlierAnalysis {
  const globalOutliers = detectGlobalOutliers(projects, config);
  const dimensionalOutliers = detectDimensionalOutliers(allResults, config);
  const uniqueProfiles = detectUniqueProfiles(projects, allResults, config);
  const recommended = buildRecommendedSet(globalOutliers, dimensionalOutliers, uniqueProfiles, config);
  return {
    globalOutliers,
    dimensionalOutliers,
    uniqueProfiles,
    recommended,
    patterns: { commonStrengths: [], commonWeaknesses: [], differentiatingFactors: [] },
    noOutliersDetected: recommended.length === 0,
  };
}
