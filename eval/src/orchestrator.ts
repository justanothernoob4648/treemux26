import { mkdir, writeFile, readFile, readdir } from "fs/promises";
import { join } from "path";
import type {
  Config,
  Project,
  JudgingPlan,
  JudgeResult,
  JudgeSpec,
  ProjectScores,
  EvaluationResults,
  ModelConfig,
  OutlierConfig,
  ConcurrencyConfig,
  ProgressEvent,
} from "./types.js";
import { ModelConfigSchema, OutlierConfigSchema, ConcurrencyConfigSchema } from "./types.js";
import { loadProjects, loadContext } from "./config.js";
import { runPlanner } from "./agents/planner.js";
import { researchAll } from "./agents/research.js";
import { runJudge } from "./agents/judge.js";
import { writeProjectReport, writeRankingsSummary } from "./agents/report-writer.js";
import { computeOverallScore, computeCompositeScore } from "./scoring/compute.js";
import { normalizeScores } from "./scoring/normalize.js";
import { detectOutliers } from "./scoring/outliers.js";
import { Semaphore } from "./modal/semaphore.js";
import { StagehandPool } from "./tools/stagehand-pool.js";

export async function evaluateProjectsBatch<T, R>(
  items: T[],
  maxConcurrent: number,
  processItem: (item: T) => Promise<R>,
): Promise<R[]> {
  const semaphore = new Semaphore(maxConcurrent);
  const results = await Promise.all(
    items.map(async (item) => {
      const release = await semaphore.acquire();
      try {
        return await processItem(item);
      } finally {
        release();
      }
    }),
  );
  return results;
}

type OrchestratorOptions = {
  config: Config;
  projects: Project[];
  contextDocument: string;
  judgeCount?: number;
  onProgress?: (event: ProgressEvent) => void;
};

async function loadCheckpoint(outputDir: string): Promise<Map<string, JudgeResult[]>> {
  const checkpointDir = join(outputDir, "checkpoints");
  const results = new Map<string, JudgeResult[]>();
  try {
    const files = await readdir(checkpointDir);
    for (const file of files) {
      if (file.endsWith(".json") && !file.startsWith("_")) {
        const content = await readFile(join(checkpointDir, file), "utf-8");
        const data = JSON.parse(content);
        results.set(data.projectName, data.results);
      }
    }
  } catch {
    // No checkpoints yet
  }
  return results;
}

async function saveCheckpoint(
  outputDir: string,
  projectName: string,
  results: JudgeResult[],
): Promise<void> {
  const checkpointDir = join(outputDir, "checkpoints");
  await mkdir(checkpointDir, { recursive: true });
  const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
  await writeFile(
    join(checkpointDir, filename),
    JSON.stringify({ projectName, results }, null, 2),
  );
}

async function loadPlanCheckpoint(outputDir: string): Promise<JudgingPlan | null> {
  try {
    const content = await readFile(join(outputDir, "checkpoints", "_plan.json"), "utf-8");
    return JSON.parse(content) as JudgingPlan;
  } catch {
    return null;
  }
}

async function savePlanCheckpoint(outputDir: string, plan: JudgingPlan): Promise<void> {
  const checkpointDir = join(outputDir, "checkpoints");
  await mkdir(checkpointDir, { recursive: true });
  await writeFile(join(checkpointDir, "_plan.json"), JSON.stringify(plan, null, 2));
}

async function loadReportCheckpoints(outputDir: string): Promise<Map<string, string>> {
  const checkpointDir = join(outputDir, "checkpoints");
  const reports = new Map<string, string>();
  try {
    const files = await readdir(checkpointDir);
    for (const file of files) {
      if (file.startsWith("_report_") && file.endsWith(".json")) {
        const content = await readFile(join(checkpointDir, file), "utf-8");
        const data = JSON.parse(content);
        reports.set(data.projectName, data.report);
      }
    }
  } catch {
    // No report checkpoints yet
  }
  return reports;
}

async function saveReportCheckpoint(outputDir: string, projectName: string, report: string): Promise<void> {
  const checkpointDir = join(outputDir, "checkpoints");
  await mkdir(checkpointDir, { recursive: true });
  const filename = `_report_${projectName.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
  await writeFile(join(checkpointDir, filename), JSON.stringify({ projectName, report }, null, 2));
}

async function evaluateProject(
  project: Project,
  judges: JudgeSpec[],
  contextDocument: string,
  plan: JudgingPlan,
  models: ModelConfig,
  concurrency: ConcurrencyConfig,
  outputDir: string,
  onProgress?: (event: ProgressEvent) => void,
  pool?: StagehandPool,
): Promise<JudgeResult[]> {
  const screenshotDir = join(outputDir, "screenshots", project.name.replace(/[^a-zA-Z0-9]/g, "_"));

  const browserJudges = judges.filter((j) => j.needsBrowser);
  const textJudges = judges.filter((j) => !j.needsBrowser);

  const runJudgeWithProgress = async (judge: JudgeSpec, externalStagehand?: import("@browserbasehq/stagehand").Stagehand): Promise<JudgeResult> => {
    onProgress?.({ type: "judge_started", projectName: project.name, judgeName: judge.name });
    try {
      const result = await runJudge(
        project,
        judge,
        contextDocument,
        plan.scaleGuidance,
        plan.reportConfig,
        models,
        screenshotDir,
        concurrency.judgeTimeoutMs,
        externalStagehand,
      );
      const overall = computeOverallScore(result.scores);
      onProgress?.({ type: "judge_completed", projectName: project.name, judgeName: judge.name, overallScore: overall });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.({ type: "judge_failed", projectName: project.name, judgeName: judge.name, error: message });
      throw error;
    }
  };

  const textPromises = textJudges.map((judge) => runJudgeWithProgress(judge));

  const browserResults: JudgeResult[] = [];
  if (pool) {
    const { session, release } = await pool.acquire();
    try {
      for (const judge of browserJudges) {
        try {
          const result = await runJudgeWithProgress(judge, session);
          browserResults.push(result);
        } catch {
          // Individual judge failure doesn't stop others
        }
      }
    } finally {
      release();
    }
  } else {
    for (let i = 0; i < browserJudges.length; i += concurrency.maxConcurrentBrowsers) {
      const batch = browserJudges.slice(i, i + concurrency.maxConcurrentBrowsers);
      const batchResults = await Promise.allSettled(batch.map((judge) => runJudgeWithProgress(judge)));
      for (const result of batchResults) {
        if (result.status === "fulfilled") browserResults.push(result.value);
      }
    }
  }

  const textResults = await Promise.allSettled(textPromises);
  const allResults: JudgeResult[] = [
    ...browserResults,
    ...textResults
      .filter((r): r is PromiseFulfilledResult<JudgeResult> => r.status === "fulfilled")
      .map((r) => r.value),
  ];

  return allResults;
}

export async function orchestrate(options: OrchestratorOptions): Promise<EvaluationResults> {
  const { config, projects, contextDocument, judgeCount, onProgress } = options;
  const models = ModelConfigSchema.parse(config.models ?? {});
  const outlierConfig = OutlierConfigSchema.parse(config.outlierConfig ?? {});
  const concurrency = ConcurrencyConfigSchema.parse(config.concurrency ?? {});

  const cachedPlan = await loadPlanCheckpoint(config.output_dir);
  let plan: JudgingPlan;

  if (cachedPlan) {
    plan = cachedPlan;
    onProgress?.({ type: "planning", message: `Loaded cached plan: ${plan.judges.length} judges for ${plan.scenario}` });
  } else {
    onProgress?.({ type: "planning", message: "Generating judging plan..." });

    const [autoPlan, personaSpecs] = await Promise.all([
      runPlanner(contextDocument, models, { judgeCount }),
      config.custom_judges
        ? researchAll(config.custom_judges, models, (name, msg) =>
            onProgress?.({ type: "researching", judgeName: name, message: msg }),
          )
        : Promise.resolve([]),
    ]);

    plan = {
      ...autoPlan,
      judges: [...autoPlan.judges, ...personaSpecs],
    };

    await savePlanCheckpoint(config.output_dir, plan);
    onProgress?.({ type: "planning", message: `Plan ready: ${plan.judges.length} judges for ${plan.scenario}` });
  }

  const existingCheckpoints = await loadCheckpoint(config.output_dir);
  const allProjectResults = new Map<string, JudgeResult[]>();

  const hasBrowserJudges = plan.judges.some((j) => j.needsBrowser);
  const pool = hasBrowserJudges ? new StagehandPool(concurrency.maxConcurrentBrowsers) : undefined;

  try {
    await evaluateProjectsBatch(projects, concurrency.maxConcurrentProjects, async (project) => {
      const i = projects.indexOf(project);

      if (existingCheckpoints.has(project.name)) {
        allProjectResults.set(project.name, existingCheckpoints.get(project.name)!);
        onProgress?.({ type: "evaluating", projectName: project.name, projectIndex: i + 1, totalProjects: projects.length });
        return;
      }

      onProgress?.({
        type: "evaluating",
        projectName: project.name,
        projectIndex: i + 1,
        totalProjects: projects.length,
      });

      const results = await evaluateProject(
        project,
        plan.judges,
        contextDocument,
        plan,
        models,
        concurrency,
        config.output_dir,
        onProgress,
        pool,
      );

      allProjectResults.set(project.name, results);
      await saveCheckpoint(config.output_dir, project.name, results);
    });
  } finally {
    if (pool) await pool.closeAll();
  }

  onProgress?.({ type: "computing", message: "Computing scores and detecting outliers..." });

  const judgeScoreArrays: Record<string, number[]> = {};
  const projectOrder: string[] = projects.map((p) => p.name);

  for (const [, results] of allProjectResults) {
    for (const result of results) {
      if (!judgeScoreArrays[result.judgeName]) judgeScoreArrays[result.judgeName] = [];
      judgeScoreArrays[result.judgeName].push(computeOverallScore(result.scores));
    }
  }

  const normalizedArrays = normalizeScores(judgeScoreArrays);

  const projectScoresList: ProjectScores[] = projectOrder.map((projectName) => {
    const results = allProjectResults.get(projectName)!;
    const overallScores: Record<string, number> = {};
    const normalizedScoresMap: Record<string, number> = {};

    for (const result of results) {
      const judgeName = result.judgeName;
      overallScores[judgeName] = computeOverallScore(result.scores);
      const judgeProjectIdx = (() => {
        let idx = 0;
        for (const pn of projectOrder) {
          const pr = allProjectResults.get(pn)!;
          if (pr.some((r) => r.judgeName === judgeName)) {
            if (pn === projectName) return idx;
            idx++;
          }
        }
        return 0;
      })();
      normalizedScoresMap[judgeName] = normalizedArrays[judgeName]?.[judgeProjectIdx] ?? overallScores[judgeName];
    }

    return {
      projectName,
      judgeResults: results,
      overallScores,
      normalizedScores: normalizedScoresMap,
      compositeScore: computeCompositeScore(normalizedScoresMap, config.judgeWeights),
    };
  });

  const rankings = [...projectScoresList].sort((a, b) => b.compositeScore - a.compositeScore);

  const outliers = detectOutliers(projectScoresList, allProjectResults, outlierConfig);

  const cachedReports = await loadReportCheckpoints(config.output_dir);
  const deepReports = new Map<string, string>(cachedReports);

  const missingReports = rankings.filter((ps) => !deepReports.has(ps.projectName));

  if (cachedReports.size > 0 && missingReports.length < rankings.length) {
    onProgress?.({ type: "reporting", projectName: `Loaded ${cachedReports.size} cached reports, ${missingReports.length} remaining` });
  }

  for (let i = 0; i < missingReports.length; i += concurrency.maxConcurrentApiCalls) {
    const batch = missingReports.slice(i, i + concurrency.maxConcurrentApiCalls);

    const results = await Promise.allSettled(
      batch.map(async (ps) => {
        onProgress?.({ type: "reporting", projectName: ps.projectName });
        const report = await writeProjectReport(ps, plan, models);
        await saveReportCheckpoint(config.output_dir, ps.projectName, report);
        return { projectName: ps.projectName, report };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        deepReports.set(result.value.projectName, result.value.report);
      } else {
        const failedPs = batch[results.indexOf(result)];
        const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        deepReports.set(failedPs.projectName, `# ${failedPs.projectName}\n\nReport generation failed: ${errorMsg}`);
      }
    }
  }

  const summary = writeRankingsSummary(rankings, plan, outliers);

  await mkdir(config.output_dir, { recursive: true });

  await writeFile(
    join(config.output_dir, "results.json"),
    JSON.stringify(
      {
        plan,
        rankings: rankings.map((r) => ({
          projectName: r.projectName,
          compositeScore: r.compositeScore,
          overallScores: r.overallScores,
          normalizedScores: r.normalizedScores,
        })),
        outliers,
      },
      null,
      2,
    ),
  );

  await writeFile(join(config.output_dir, "rankings.md"), summary);

  const reportsDir = join(config.output_dir, "reports");
  await mkdir(reportsDir, { recursive: true });

  for (const [name, report] of deepReports) {
    const filename = `${name.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    await writeFile(join(reportsDir, filename), report);
  }

  onProgress?.({ type: "complete", message: `Evaluation complete. Results in ${config.output_dir}/` });

  return {
    plan,
    projectResults: allProjectResults,
    projectScores: projectScoresList,
    rankings,
    outliers,
    reports: { deepReports, summary },
  };
}
