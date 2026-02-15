import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  ProjectScores,
  JudgingPlan,
  ModelConfig,
  OutlierAnalysis,
} from "../types.js";

const REPORT_WRITER_PROMPT = `You are an expert report writer producing deep-research-style evaluation reports. Write thorough, well-structured markdown reports with tables, analysis, and clear verdicts.

Your reports should be comprehensive and insightful — not just a summary of scores, but a genuine analysis of the submission's strengths, weaknesses, and potential.`;

export async function writeProjectReport(
  projectScores: ProjectScores,
  plan: JudgingPlan,
  models: ModelConfig,
): Promise<string> {
  const judgeResultsSummary = projectScores.judgeResults
    .map((r) => JSON.stringify(r, null, 2))
    .join("\n\n---\n\n");

  const prompt = `Write a deep evaluation report for this project.

**Project:** ${projectScores.projectName}
**Composite Score:** ${projectScores.compositeScore.toFixed(1)} / 10
**Scenario:** ${plan.scenario}

**Judge Results:**
${judgeResultsSummary}

**Overall Scores by Judge:**
${Object.entries(projectScores.overallScores)
  .map(([j, s]) => `- ${j}: ${s.toFixed(1)} (normalized: ${projectScores.normalizedScores[j]?.toFixed(1) ?? "N/A"})`)
  .join("\n")}

Write the report in this structure:
1. Executive Summary (2-3 paragraphs with composite score and verdict)
2. Score Overview (table: Judge | Role | Overall | Top Category | Lowest Category)
3. Detailed Judge Evaluations (for each judge: scores table, strengths, weaknesses, suggestions)
4. Cross-Judge Analysis (where judges agreed, diverged, and what it means)
5. Track/Prize Recommendations (if applicable)
6. Final Verdict

Output ONLY the markdown report.`;

  let resultText = "";

  for await (const message of query({
    prompt,
    options: {
      systemPrompt: REPORT_WRITER_PROMPT,
      model: models.reportWriter,
      allowedTools: [],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: 1,
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      resultText = message.result;
    }
  }

  return resultText;
}

export function writeRankingsSummary(
  rankings: ProjectScores[],
  plan: JudgingPlan,
  outliers: OutlierAnalysis,
): string {
  const rankingsTable = rankings
    .map((p, i) => {
      const scores = Object.entries(p.overallScores);
      if (scores.length === 0) return `| ${i + 1} | ${p.projectName} | ${p.compositeScore.toFixed(1)} | N/A | N/A |`;
      const best = scores.reduce((a, b) => (a[1] > b[1] ? a : b));
      const worst = scores.reduce((a, b) => (a[1] < b[1] ? a : b));
      return `| ${i + 1} | ${p.projectName} | ${p.compositeScore.toFixed(1)} | ${best[0]} (${best[1].toFixed(1)}) | ${worst[0]} (${worst[1].toFixed(1)}) |`;
    })
    .join("\n");

  const outlierSection = outliers.noOutliersDetected
    ? "No strong outliers detected. Projects are within normal scoring range."
    : [
        outliers.globalOutliers.length > 0
          ? `### Global Outliers\n${outliers.globalOutliers.map((o) => `- **${o.projectName}**: composite ${o.compositeScore.toFixed(1)} (${o.percentile.toFixed(0)}th percentile)`).join("\n")}`
          : "",
        outliers.dimensionalOutliers.length > 0
          ? `### Dimensional Outliers\n${outliers.dimensionalOutliers.map((o) => `- **${o.projectName}**: ${o.dimension} = ${o.score} (${o.zScore.toFixed(1)} SD above mean)`).join("\n")}`
          : "",
        outliers.recommended.length > 0
          ? `### Recommended Set\n${outliers.recommended.map((o) => `- **${o.projectName}** [${o.outlierTypes.join(", ")}]: ${o.selectionReason}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

  return `# ${plan.scenario} — Evaluation Results

## Overall Rankings

| Rank | Project | Composite | Best In | Weakest In |
|------|---------|-----------|---------|------------|
${rankingsTable}

## Outlier Analysis

${outlierSection}

## Methodology

- **Judges:** ${plan.judges.map((j) => `${j.name} (${j.role})`).join(", ")}
- **Scale:** ${plan.scoreScale.min}-${plan.scoreScale.max}
- **Normalization:** Z-score with rescaling
- **Score guidance:** ${plan.scaleGuidance}
`;
}
