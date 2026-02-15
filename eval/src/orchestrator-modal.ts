import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
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
import {
  ModelConfigSchema,
  OutlierConfigSchema,
  ConcurrencyConfigSchema,
  ModalConfigSchema,
  JudgingPlanSchema,
  JudgeResultSchema,
  JudgeSpecSchema,
} from "./types.js";
import { generateHmacKey } from "./modal/hmac.js";
import { WebhookServer } from "./modal/webhook-server.js";
import { createModalDispatcher, volumePaths } from "./modal/client.js";
import { Semaphore } from "./modal/semaphore.js";
import {
  buildDeliveryPayload,
  sendDeliveryWebhook,
  sendProgressToDelivery,
} from "./modal/delivery.js";
import { computeOverallScore, computeCompositeScore } from "./scoring/compute.js";
import { normalizeScores } from "./scoring/normalize.js";
import { detectOutliers } from "./scoring/outliers.js";
import { writeRankingsSummary } from "./agents/report-writer.js";
import type { WebhookNotification, TaskType } from "./modal/webhook-types.js";
import { evaluateProjectsBatch } from "./orchestrator.js";

type ModalOrchestratorOptions = {
  config: Config;
  context: string;
  projects: Project[];
  judgeCount?: number;
  onProgress?: (event: ProgressEvent) => void;
  resume?: boolean;
};

const VOLUME_ROOT = "/mnt/eval";
const SANDBOX_TIMEOUT_MS = 300_000;

const writeInputsToVolume = async (
  runId: string,
  context: string,
  projects: Project[],
  config: Config,
  judgeCount?: number,
): Promise<void> => {
  const paths = volumePaths(runId, VOLUME_ROOT);
  await mkdir(paths.inputs, { recursive: true });
  await mkdir(paths.outputs, { recursive: true });
  await mkdir(paths.checkpoints, { recursive: true });

  await writeFile(join(paths.inputs, "context.md"), context);
  await writeFile(
    join(paths.inputs, "projects.json"),
    JSON.stringify(projects, null, 2),
  );
  await writeFile(
    join(paths.inputs, "config.json"),
    JSON.stringify(
      {
        models: config.models,
        concurrency: config.concurrency,
        outlierConfig: config.outlierConfig,
        judgeWeights: config.judgeWeights,
        judgeCount,
      },
      null,
      2,
    ),
  );

  if (config.custom_judges) {
    const judgesDir = join(paths.inputs, "judges");
    await mkdir(judgesDir, { recursive: true });
    for (const judge of config.custom_judges) {
      await writeFile(
        join(judgesDir, `${judge.name}.json`),
        JSON.stringify(judge, null, 2),
      );
    }
  }
};

const loadCheckpointFromVolume = async (
  runId: string,
): Promise<Map<string, JudgeResult[]>> => {
  const paths = volumePaths(runId, VOLUME_ROOT);
  const results = new Map<string, JudgeResult[]>();

  try {
    const files = await readdir(paths.checkpoints);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const content = await readFile(join(paths.checkpoints, file), "utf-8");
        const data = JSON.parse(content);
        results.set(data.projectName, data.results);
      }
    }
  } catch {
    // No checkpoints yet
  }

  return results;
};

const saveCheckpointToVolume = async (
  runId: string,
  projectName: string,
  results: JudgeResult[],
): Promise<void> => {
  const paths = volumePaths(runId, VOLUME_ROOT);
  await mkdir(paths.checkpoints, { recursive: true });
  const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, "_")}.json`;
  await writeFile(
    join(paths.checkpoints, filename),
    JSON.stringify({ projectName, results }, null, 2),
  );
};

const readPlanFromVolume = async (runId: string): Promise<JudgingPlan> => {
  const paths = volumePaths(runId, VOLUME_ROOT);
  const content = await readFile(join(paths.outputs, "plan.json"), "utf-8");
  return JudgingPlanSchema.parse(JSON.parse(content));
};

const readPersonaFromVolume = async (
  runId: string,
  judgeName: string,
): Promise<JudgeSpec> => {
  const paths = volumePaths(runId, VOLUME_ROOT);
  const content = await readFile(
    join(paths.outputs, "personas", `${judgeName}.json`),
    "utf-8",
  );
  return JudgeSpecSchema.parse(JSON.parse(content));
};

const readJudgeResultFromVolume = async (
  runId: string,
  projectName: string,
  judgeName: string,
): Promise<JudgeResult> => {
  const paths = volumePaths(runId, VOLUME_ROOT);
  const content = await readFile(
    join(paths.outputs, "scores", projectName, `${judgeName}.json`),
    "utf-8",
  );
  return JudgeResultSchema.parse(JSON.parse(content));
};

const readReportFromVolume = async (
  runId: string,
  projectName: string,
): Promise<string> => {
  const paths = volumePaths(runId, VOLUME_ROOT);
  return readFile(
    join(paths.outputs, "reports", `${projectName}.md`),
    "utf-8",
  );
};

const writeAggregatedScoresToVolume = async (
  runId: string,
  projectName: string,
  projectScores: ProjectScores,
): Promise<void> => {
  const paths = volumePaths(runId, VOLUME_ROOT);
  const dir = join(paths.outputs, "scores", projectName);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "aggregated.json"),
    JSON.stringify(projectScores, null, 2),
  );
};

export const orchestrateModal = async (
  options: ModalOrchestratorOptions,
): Promise<EvaluationResults> => {
  const { config, context, projects, judgeCount, onProgress, resume } = options;
  const models = ModelConfigSchema.parse(config.models ?? {});
  const outlierConfig = OutlierConfigSchema.parse(config.outlierConfig ?? {});
  const concurrency = ConcurrencyConfigSchema.parse(config.concurrency ?? {});

  const runId = randomUUID();
  const hmacKey = generateHmacKey();

  const webhookServer = new WebhookServer({
    hmacKey,
    onProgress: (event) => {
      if (onProgress && typeof event === "object" && event !== null) {
        onProgress(event as ProgressEvent);
      }
    },
  });

  const webhookUrl = await webhookServer.start();

  const modalConfig = ModalConfigSchema.parse(config.modal ?? {});
  const imageName = modalConfig.imageName ?? "eval-agent:latest";

  const dispatcher = await createModalDispatcher({
    appName: modalConfig.appName ?? "eval-agent",
    imageName,
    hmacKey,
    webhookUrl,
    runId,
  });

  try {
    // ──────────────────────────────────────────────────────
    // WRITE INPUTS TO VOLUME
    // ──────────────────────────────────────────────────────
    await writeInputsToVolume(runId, context, projects, config, judgeCount);

    // ──────────────────────────────────────────────────────
    // PHASE 1: PLAN
    // ──────────────────────────────────────────────────────
    onProgress?.({ type: "planning", message: "Spawning planner sandbox..." });

    const plannerTaskId = "planner";
    const plannerWait = webhookServer.waitForTask(
      runId,
      "planner" as TaskType,
      plannerTaskId,
      SANDBOX_TIMEOUT_MS,
    );
    await dispatcher.spawnSandbox("planner");

    const researchPromises: Array<Promise<WebhookNotification>> = [];
    if (config.custom_judges && config.custom_judges.length > 0) {
      for (const judge of config.custom_judges) {
        const taskId = `research-${judge.name}`;
        const wait = webhookServer.waitForTask(
          runId,
          "research" as TaskType,
          taskId,
          SANDBOX_TIMEOUT_MS,
        );
        await dispatcher.spawnSandbox("research", { judge: judge.name });
        researchPromises.push(wait);
      }
    }

    const plannerResult = await plannerWait;
    if (plannerResult.status === "failed") {
      throw new Error(`Planner sandbox failed: ${plannerResult.error ?? "unknown error"}`);
    }

    if (researchPromises.length > 0) {
      const researchResults = await Promise.allSettled(researchPromises);
      for (const result of researchResults) {
        if (result.status === "rejected") {
          throw new Error(`Research sandbox failed: ${result.reason}`);
        }
        if (result.status === "fulfilled" && result.value.status === "failed") {
          throw new Error(`Research sandbox failed: ${result.value.error ?? "unknown error"}`);
        }
      }
    }

    const autoPlan = await readPlanFromVolume(runId);

    const personaSpecs: JudgeSpec[] = [];
    if (config.custom_judges) {
      for (const judge of config.custom_judges) {
        const spec = await readPersonaFromVolume(runId, judge.name);
        personaSpecs.push(spec);
      }
    }

    const plan: JudgingPlan = {
      ...autoPlan,
      judges: [...autoPlan.judges, ...personaSpecs],
    };

    onProgress?.({
      type: "planning",
      message: `Plan ready: ${plan.judges.length} judges for ${plan.scenario}`,
    });

    // ──────────────────────────────────────────────────────
    // PHASE 2: EVALUATE (sequential per project)
    // ──────────────────────────────────────────────────────
    const existingCheckpoints = resume
      ? await loadCheckpointFromVolume(runId)
      : new Map<string, JudgeResult[]>();
    const allProjectResults = new Map<string, JudgeResult[]>();
    const semaphore = new Semaphore(concurrency.maxConcurrentApiCalls);

    await evaluateProjectsBatch(projects, concurrency.maxConcurrentProjects, async (project) => {
      const i = projects.indexOf(project);

      if (existingCheckpoints.has(project.name)) {
        allProjectResults.set(project.name, existingCheckpoints.get(project.name)!);
        onProgress?.({
          type: "evaluating",
          projectName: project.name,
          projectIndex: i + 1,
          totalProjects: projects.length,
        });
        return;
      }

      onProgress?.({
        type: "evaluating",
        projectName: project.name,
        projectIndex: i + 1,
        totalProjects: projects.length,
      });

      const judgeWaits: Array<{
        judgeName: string;
        wait: Promise<WebhookNotification>;
      }> = [];

      for (const judge of plan.judges) {
        const release = await semaphore.acquire();
        const taskId = `judge-${project.name}-${judge.name}`;
        const wait = webhookServer.waitForTask(
          runId,
          "judge" as TaskType,
          taskId,
          SANDBOX_TIMEOUT_MS,
        );
        await dispatcher.spawnSandbox("judge", {
          project: project.name,
          judge: judge.name,
        });
        judgeWaits.push({
          judgeName: judge.name,
          wait: wait.finally(release),
        });
      }

      const judgeResults: JudgeResult[] = [];
      const settledResults = await Promise.allSettled(
        judgeWaits.map(async ({ judgeName, wait }) => {
          const notification = await wait;
          if (notification.status === "failed") {
            throw new Error(
              `Judge ${judgeName} failed for ${project.name}: ${notification.error ?? "unknown"}`,
            );
          }
          return readJudgeResultFromVolume(runId, project.name, judgeName);
        }),
      );

      for (const result of settledResults) {
        if (result.status === "fulfilled") {
          const overallScore = computeOverallScore(result.value.scores);
          onProgress?.({
            type: "judge_completed",
            projectName: project.name,
            judgeName: result.value.judgeName,
            overallScore,
          });
          judgeResults.push(result.value);
        } else {
          const errorMsg = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
          onProgress?.({
            type: "judge_failed",
            projectName: project.name,
            judgeName: "unknown",
            error: errorMsg,
          });
        }
      }

      allProjectResults.set(project.name, judgeResults);
      await saveCheckpointToVolume(runId, project.name, judgeResults);
    });

    // ──────────────────────────────────────────────────────
    // PHASE 3: COMPUTE (no sandboxes — deterministic scoring)
    // ──────────────────────────────────────────────────────
    onProgress?.({
      type: "computing",
      message: "Computing scores and detecting outliers...",
    });

    const judgeScoreArrays: Record<string, number[]> = {};
    const projectOrder: string[] = projects.map((p) => p.name);

    for (const [, results] of allProjectResults) {
      for (const result of results) {
        if (!judgeScoreArrays[result.judgeName]) {
          judgeScoreArrays[result.judgeName] = [];
        }
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

        normalizedScoresMap[judgeName] =
          normalizedArrays[judgeName]?.[judgeProjectIdx] ?? overallScores[judgeName];
      }

      return {
        projectName,
        judgeResults: results,
        overallScores,
        normalizedScores: normalizedScoresMap,
        compositeScore: computeCompositeScore(normalizedScoresMap, config.judgeWeights),
      };
    });

    const rankings = [...projectScoresList].sort(
      (a, b) => b.compositeScore - a.compositeScore,
    );

    const outliers = detectOutliers(projectScoresList, allProjectResults, outlierConfig);

    // ──────────────────────────────────────────────────────
    // PHASE 4: REPORT (sandbox dispatch per project)
    // ──────────────────────────────────────────────────────

    // Write aggregated scores to volume so report sandboxes can read them
    for (const ps of projectScoresList) {
      await writeAggregatedScoresToVolume(runId, ps.projectName, ps);
    }

    const reportWaits: Array<{
      projectName: string;
      wait: Promise<WebhookNotification>;
    }> = [];

    for (const ps of rankings) {
      onProgress?.({ type: "reporting", projectName: ps.projectName });
      const taskId = `report-${ps.projectName}`;
      const wait = webhookServer.waitForTask(
        runId,
        "report" as TaskType,
        taskId,
        SANDBOX_TIMEOUT_MS,
      );
      await dispatcher.spawnSandbox("report", { project: ps.projectName });
      reportWaits.push({ projectName: ps.projectName, wait });
    }

    const deepReports = new Map<string, string>();

    const reportResults = await Promise.allSettled(
      reportWaits.map(async ({ projectName, wait }) => {
        const notification = await wait;
        if (notification.status === "failed") {
          throw new Error(
            `Report sandbox failed for ${projectName}: ${notification.error ?? "unknown"}`,
          );
        }
        const report = await readReportFromVolume(runId, projectName);
        return { projectName, report };
      }),
    );

    for (const result of reportResults) {
      if (result.status === "fulfilled") {
        deepReports.set(result.value.projectName, result.value.report);
      }
    }

    const summary = writeRankingsSummary(rankings, plan, outliers);

    // Write final outputs to volume
    const paths = volumePaths(runId, VOLUME_ROOT);
    await writeFile(
      join(paths.outputs, "results.json"),
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

    await writeFile(join(paths.outputs, "rankings.md"), summary);

    // ──────────────────────────────────────────────────────
    // PHASE 5: DELIVER
    // ──────────────────────────────────────────────────────

    if (config.deliveryWebhook) {
      onProgress?.({
        type: "complete",
        message: "Sending results to delivery webhook...",
      });

      const deepReportsRecord: Record<string, string> = {};
      for (const [name, report] of deepReports) {
        deepReportsRecord[name] = report;
      }

      const payload = buildDeliveryPayload({
        runId,
        scenario: plan.scenario,
        rankings: rankings.map((r) => ({
          projectName: r.projectName,
          compositeScore: r.compositeScore,
          overallScores: r.overallScores,
          normalizedScores: r.normalizedScores,
        })),
        outliers,
        reports: { deepReports: deepReportsRecord, summary },
        projectCount: projects.length,
        judgeCount: plan.judges.length,
      });

      await sendDeliveryWebhook(config.deliveryWebhook, payload);
    }

    onProgress?.({
      type: "complete",
      message: `Evaluation complete. Run ID: ${runId}`,
    });

    return {
      plan,
      projectResults: allProjectResults,
      projectScores: projectScoresList,
      rankings,
      outliers,
      reports: { deepReports, summary },
    };
  } finally {
    await webhookServer.stop();
    await dispatcher.cleanup();
  }
};
