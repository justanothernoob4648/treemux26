import type {
  Config,
  Project,
  JudgingPlan,
  EvaluationResults,
  ProgressEvent,
  ModelConfig,
  CustomJudgeInput,
} from "./types.js";
import { ModelConfigSchema } from "./types.js";
import { loadProjects, loadContext } from "./config.js";
import { runPlanner } from "./agents/planner.js";
import { researchAll } from "./agents/research.js";
import { orchestrate } from "./orchestrator.js";
import { orchestrateModal } from "./orchestrator-modal.js";
import { runJudge } from "./agents/judge.js";
import { computeOverallScore } from "./scoring/compute.js";
import { writeProjectReport } from "./agents/report-writer.js";

export type EvaluatorConfig = {
  context: string;
  customJudges?: CustomJudgeInput[];
  models?: Partial<ModelConfig>;
  outputDir?: string;
  judgeWeights?: Record<string, number>;
  judgeCount?: number;
  local?: boolean;
};

export type EvaluateOptions = {
  projects: Project[];
  onProgress?: (event: ProgressEvent) => void;
};

export function createEvaluator(evaluatorConfig: EvaluatorConfig) {
  const models = ModelConfigSchema.parse(evaluatorConfig.models ?? {});

  return {
    async plan(): Promise<JudgingPlan> {
      const contextDocument = evaluatorConfig.context.endsWith(".md")
        ? await loadContext(evaluatorConfig.context)
        : evaluatorConfig.context;

      const [autoPlan, personaSpecs] = await Promise.all([
        runPlanner(contextDocument, models, { judgeCount: evaluatorConfig.judgeCount }),
        evaluatorConfig.customJudges
          ? researchAll(evaluatorConfig.customJudges, models)
          : Promise.resolve([]),
      ]);

      return {
        ...autoPlan,
        judges: [...autoPlan.judges, ...personaSpecs],
      };
    },

    async evaluate(options: EvaluateOptions): Promise<EvaluationResults> {
      const contextDocument = evaluatorConfig.context.endsWith(".md")
        ? await loadContext(evaluatorConfig.context)
        : evaluatorConfig.context;

      const config: Config = {
        context: evaluatorConfig.context,
        projects: options.projects,
        custom_judges: evaluatorConfig.customJudges,
        output_dir: evaluatorConfig.outputDir ?? "./eval-results",
        models: evaluatorConfig.models as ModelConfig,
        judgeWeights: evaluatorConfig.judgeWeights,
      };

      if (evaluatorConfig.local) {
        return orchestrate({
          config,
          projects: options.projects,
          contextDocument,
          judgeCount: evaluatorConfig.judgeCount,
          onProgress: options.onProgress,
        });
      }

      return orchestrateModal({
        config,
        context: contextDocument,
        projects: options.projects,
        judgeCount: evaluatorConfig.judgeCount,
        onProgress: options.onProgress,
      });
    },

    async evaluateOne(project: Project): Promise<{
      judgeResults: Map<string, unknown>;
      report: string;
    }> {
      const contextDocument = evaluatorConfig.context.endsWith(".md")
        ? await loadContext(evaluatorConfig.context)
        : evaluatorConfig.context;

      const plan = await this.plan();

      const results = await Promise.all(
        plan.judges.map((judge) =>
          runJudge(
            project,
            judge,
            contextDocument,
            plan.scaleGuidance,
            plan.reportConfig,
            models,
            "./eval-results/screenshots",
            180_000,
          ),
        ),
      );

      const overallScores: Record<string, number> = {};
      for (const r of results) {
        overallScores[r.judgeName] = computeOverallScore(r.scores);
      }

      const compositeScore =
        Object.values(overallScores).reduce((a, b) => a + b, 0) / Object.values(overallScores).length;

      const projectScores = {
        projectName: project.name,
        judgeResults: results,
        overallScores,
        normalizedScores: overallScores,
        compositeScore,
      };

      const report = await writeProjectReport(projectScores, plan, models);

      return {
        judgeResults: new Map(results.map((r) => [r.judgeName, r])),
        report,
      };
    },
  };
}
