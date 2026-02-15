import type { ProjectScores, OutlierAnalysis } from "../types.js";

export function buildSuccessPayload(
  runId: string,
  rankings: ProjectScores[],
  outliers: OutlierAnalysis,
  summary: string,
) {
  return {
    status: "success" as const,
    runId,
    rankings: rankings.map((r) => ({
      projectName: r.projectName,
      compositeScore: r.compositeScore,
      overallScores: r.overallScores,
      normalizedScores: r.normalizedScores,
      judgeResults: r.judgeResults,
    })),
    outliers,
    summary,
    metadata: {
      projectCount: rankings.length,
      judgeCount: rankings[0]?.judgeResults.length ?? 0,
      completedAt: new Date().toISOString(),
    },
  };
}

export function buildErrorPayload(runId: string, error: string) {
  return {
    status: "error" as const,
    runId,
    error,
  };
}
