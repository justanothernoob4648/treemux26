import {
  parseSandboxArgs,
  readVolumeJson,
  writeVolumeJson,
  postWebhookNotification,
  postProgressEvent,
} from "./utils.js";
import { researchPerson } from "../agents/research.js";
import { ModelConfigSchema, CustomJudgeInputSchema } from "../types.js";
import type { ModelConfig } from "../types.js";
import { join } from "node:path";

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
  const judgeName = parseExtraArg("judge");
  const inputDir = join(args.volumePath, args.runId, "inputs");
  const outputDir = join(args.volumePath, args.runId, "outputs");
  const taskId = `research-${judgeName}`;

  try {
    await postProgressEvent(args.webhookUrl, args.runId, args.hmacKey, {
      type: "researching",
      judgeName,
      message: `Researching ${judgeName}`,
    });

    const config = readVolumeJson<{ models?: Partial<ModelConfig> }>(
      join(inputDir, "config.json"),
    );
    const models = ModelConfigSchema.parse(config.models ?? {});

    const judgeInput = readVolumeJson<unknown>(
      join(inputDir, "judges", `${judgeName}.json`),
    );
    const validatedInput = CustomJudgeInputSchema.parse(judgeInput);

    const spec = await researchPerson(validatedInput, models);

    const outputPath = join(outputDir, "personas", `${judgeName}.json`);
    writeVolumeJson(outputPath, spec);

    await postWebhookNotification(
      args.webhookUrl,
      args.runId,
      "research",
      taskId,
      args.hmacKey,
      { status: "success", outputPath },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await postWebhookNotification(
      args.webhookUrl,
      args.runId,
      "research",
      taskId,
      args.hmacKey,
      { status: "failed", outputPath: "", error: errorMsg },
    );
    process.exit(1);
  }
};

main();
