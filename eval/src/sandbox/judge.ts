import {
  parseSandboxArgs,
  readVolumeJson,
  readVolumeText,
  writeVolumeJson,
  postWebhookNotification,
  postProgressEvent,
} from "./utils.js";
import { runJudge } from "../agents/judge.js";
import {
  ModelConfigSchema,
  JudgingPlanSchema,
  ProjectSchema,
  JudgeSpecSchema,
  ConcurrencyConfigSchema,
} from "../types.js";
import type { ModelConfig, ConcurrencyConfig, JudgeSpec } from "../types.js";
import { join } from "node:path";
import { existsSync } from "node:fs";

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
  const judgeName = parseExtraArg("judge");
  const inputDir = join(args.volumePath, args.runId, "inputs");
  const outputDir = join(args.volumePath, args.runId, "outputs");
  const taskId = `judge-${projectName}-${judgeName}`;

  try {
    await postProgressEvent(args.webhookUrl, args.runId, args.hmacKey, {
      type: "judge_started",
      projectName,
      judgeName,
    });

    const context = readVolumeText(join(inputDir, "context.md"));
    const config = readVolumeJson<{
      models?: Partial<ModelConfig>;
      concurrency?: Partial<ConcurrencyConfig>;
    }>(join(inputDir, "config.json"));
    const models = ModelConfigSchema.parse(config.models ?? {});
    const concurrency = ConcurrencyConfigSchema.parse(
      config.concurrency ?? {},
    );

    const plan = JudgingPlanSchema.parse(
      readVolumeJson<unknown>(join(outputDir, "plan.json")),
    );

    const projects = readVolumeJson<unknown[]>(
      join(inputDir, "projects.json"),
    );
    const project = ProjectSchema.parse(
      projects.find(
        (p) =>
          typeof p === "object" &&
          p !== null &&
          "name" in p &&
          (p as { name: string }).name === projectName,
      ),
    );

    const personaPath = join(outputDir, "personas", `${judgeName}.json`);
    let judgeSpec: JudgeSpec;
    if (existsSync(personaPath)) {
      judgeSpec = JudgeSpecSchema.parse(readVolumeJson<unknown>(personaPath));
    } else {
      const fromPlan = plan.judges.find((j) => j.name === judgeName);
      if (!fromPlan) {
        throw new Error(
          `Judge spec not found: no persona file and not in plan for "${judgeName}"`,
        );
      }
      judgeSpec = fromPlan;
    }

    const screenshotDir = join(outputDir, "screenshots", projectName);
    const timeoutMs = concurrency.judgeTimeoutMs;

    const result = await runJudge(
      project,
      judgeSpec,
      context,
      plan.scaleGuidance,
      plan.reportConfig,
      models,
      screenshotDir,
      timeoutMs,
    );

    const outputPath = join(
      outputDir,
      "scores",
      projectName,
      `${judgeName}.json`,
    );
    writeVolumeJson(outputPath, result);

    await postProgressEvent(args.webhookUrl, args.runId, args.hmacKey, {
      type: "judge_completed",
      projectName,
      judgeName,
      overallScore:
        result.scores.reduce((sum, s) => sum + s.score * s.weight, 0) /
        result.scores.reduce((sum, s) => sum + s.weight, 0),
    });

    await postWebhookNotification(
      args.webhookUrl,
      args.runId,
      "judge",
      taskId,
      args.hmacKey,
      { status: "success", outputPath },
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await postProgressEvent(args.webhookUrl, args.runId, args.hmacKey, {
      type: "judge_failed",
      projectName,
      judgeName,
      error: errorMsg,
    });
    await postWebhookNotification(
      args.webhookUrl,
      args.runId,
      "judge",
      taskId,
      args.hmacKey,
      { status: "failed", outputPath: "", error: errorMsg },
    );
    process.exit(1);
  }
};

main();
