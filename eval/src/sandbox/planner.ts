import {
  parseSandboxArgs,
  readVolumeJson,
  readVolumeText,
  writeVolumeJson,
  postWebhookNotification,
  postProgressEvent,
} from "./utils.js";
import { runPlanner } from "../agents/planner.js";
import { ModelConfigSchema } from "../types.js";
import type { ModelConfig } from "../types.js";
import { join } from "node:path";

const main = async () => {
  const args = parseSandboxArgs(process.argv.slice(2));
  const inputDir = join(args.volumePath, args.runId, "inputs");
  const outputDir = join(args.volumePath, args.runId, "outputs");
  const taskId = "planner";

  try {
    await postProgressEvent(args.webhookUrl, args.runId, args.hmacKey, {
      type: "planning",
      message: "Starting plan generation",
    });

    const context = readVolumeText(join(inputDir, "context.md"));
    const config = readVolumeJson<{ models?: Partial<ModelConfig>; judgeCount?: number }>(
      join(inputDir, "config.json"),
    );
    const models = ModelConfigSchema.parse(config.models ?? {});

    const plan = await runPlanner(context, models, { judgeCount: config.judgeCount });

    const outputPath = join(outputDir, "plan.json");
    writeVolumeJson(outputPath, plan);

    await postWebhookNotification(
      args.webhookUrl,
      args.runId,
      "planner",
      taskId,
      args.hmacKey,
      { status: "success", outputPath },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await postWebhookNotification(
      args.webhookUrl,
      args.runId,
      "planner",
      taskId,
      args.hmacKey,
      { status: "failed", outputPath: "", error: errorMsg },
    );
    process.exit(1);
  }
};

main();
