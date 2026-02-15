import { Command } from "commander";
import { loadConfigFile, loadProjects, loadContext } from "./config.js";
import { orchestrate } from "./orchestrator.js";
import { orchestrateModal } from "./orchestrator-modal.js";
import { runPlanner } from "./agents/planner.js";
import { researchAll } from "./agents/research.js";
import { ModelConfigSchema } from "./types.js";
import type { ProgressEvent } from "./types.js";
import "dotenv/config";

function formatProgress(event: ProgressEvent): string {
  switch (event.type) {
    case "planning":
      return `[PLAN] ${event.message}`;
    case "researching":
      return `[RESEARCH] ${event.judgeName}: ${event.message}`;
    case "evaluating":
      return `[${event.projectIndex}/${event.totalProjects}] Evaluating "${event.projectName}"...`;
    case "judge_started":
      return `  |-- ${event.judgeName}: starting...`;
    case "judge_completed":
      return `  |-- ${event.judgeName}: done (${event.overallScore.toFixed(1)})`;
    case "judge_failed":
      return `  |-- ${event.judgeName}: FAILED (${event.error})`;
    case "computing":
      return `[COMPUTE] ${event.message}`;
    case "reporting":
      return `[REPORT] Writing report for "${event.projectName}"...`;
    case "complete":
      return `\n${event.message}`;
  }
}

const program = new Command()
  .name("eval-agent")
  .description("AI-powered evaluation system with dynamic judge agents")
  .requiredOption("-c, --config <path>", "Path to config.json")
  .option("--dry-run", "Show the judging plan without executing")
  .option("--resume", "Resume from last checkpoint")
  .option("--local", "Run agents locally instead of on Modal sandboxes")
  .option("-p, --project <name>", "Evaluate a single project by name");

program.action(async (opts) => {
  try {
    const config = await loadConfigFile(opts.config);
    const contextDocument = await loadContext(config.context);
    const projects = await loadProjects(config.projects);
    const models = ModelConfigSchema.parse(config.models ?? {});

    if (opts.dryRun) {
      console.log("Generating judging plan...\n");

      const [autoPlan, personaSpecs] = await Promise.all([
        runPlanner(contextDocument, models),
        config.custom_judges
          ? researchAll(config.custom_judges, models)
          : Promise.resolve([]),
      ]);

      const allJudges = [...autoPlan.judges, ...personaSpecs];

      console.log(`Scenario: ${autoPlan.scenario}`);
      console.log(`Judges (${allJudges.length}):`);
      for (const j of allJudges) {
        const browserIcon = j.needsBrowser ? "[browser]" : "[text]";
        console.log(`  - ${j.name} (${j.role}) [${j.source}] ${browserIcon}`);
        for (const c of j.scoringCategories) {
          console.log(`    * ${c.category} (weight: ${c.weight})`);
        }
      }
      console.log(`\nProjects: ${projects.length}`);
      console.log(`Estimated agent calls: ${projects.length * allJudges.length + projects.length}`);
      console.log(`Browser sessions: ${projects.length * allJudges.filter((j) => j.needsBrowser).length}`);
      return;
    }

    const targetProjects = opts.project
      ? projects.filter((p) => p.name === opts.project)
      : projects;

    if (opts.project && targetProjects.length === 0) {
      console.error(`Project "${opts.project}" not found in input.`);
      process.exit(1);
    }

    const results = opts.local
      ? await orchestrate({
          config,
          projects: targetProjects,
          contextDocument,
          onProgress: (event) => console.log(formatProgress(event)),
        })
      : await orchestrateModal({
          config,
          context: contextDocument,
          projects: targetProjects,
          onProgress: (event) => console.log(formatProgress(event)),
          resume: opts.resume,
        });

    console.log(`\nResults written to ${config.output_dir}/`);
    console.log(`  - results.json (scores and outlier analysis)`);
    console.log(`  - rankings.md (summary report)`);
    console.log(`  - reports/ (per-project deep reports)`);

    if (!results.outliers.noOutliersDetected) {
      console.log(`\nOutliers detected:`);
      for (const o of results.outliers.recommended) {
        console.log(`  * ${o.projectName} [${o.outlierTypes.join(", ")}]`);
      }
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

program.parse();
