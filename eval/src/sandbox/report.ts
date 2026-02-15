import {
  parseSandboxArgs,
  readVolumeJson,
  writeVolumeJson,
  postWebhookNotification,
  postProgressEvent,
} from "./utils.js";
import { writeProjectReport } from "../agents/report-writer.js";
import { ModelConfigSchema, JudgingPlanSchema } from "../types.js";
import type { ModelConfig, ProjectScores } from "../types.js";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const parseExtraArg = (name: string): string => {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) {
    throw new Error(`Missing required argument: --${name}`);
  }
  return args[idx + 1];
};

const main = async () => {
  const args = parseSandboxArgs(process.argv.slice(2));
  const projectName = parseExtraArg("project");
  const inputDir = join(args.volumePath, args.runId, "inputs");
  const outputDir = join(args.volumePath, args.runId, "outputs");
  const taskId = `report-${projectName}`;

  try {
    await postProgressEvent(args.webhookUrl, args.runId, args.hmacKey, {
      type: "reporting",
      projectName,
    });

    const config = readVolumeJson<{ models?: Partial<ModelConfig> }>(
      join(inputDir, "config.json"),
    );
    const models = ModelConfigSchema.parse(config.models ?? {});

    const plan = JudgingPlanSchema.parse(
      readVolumeJson<unknown>(join(outputDir, "plan.json")),
    );

    const projectScores = readVolumeJson<ProjectScores>(
      join(outputDir, "scores", projectName, "aggregated.json"),
    );

    const report = await writeProjectReport(projectScores, plan, models);

    const outputPath = join(outputDir, "reports", `${projectName}.md`);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, report);

    await postWebhookNotification(
      args.webhookUrl,
      args.runId,
      "report",
      taskId,
      args.hmacKey,
      { status: "success", outputPath },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await postWebhookNotification(
      args.webhookUrl,
      args.runId,
      "report",
      taskId,
      args.hmacKey,
      { status: "failed", outputPath: "", error: errorMsg },
    );
    process.exit(1);
  }
};

main();
