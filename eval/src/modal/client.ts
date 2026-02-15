import { join } from "node:path";

type SandboxCommandOptions = {
  runId: string;
  volumePath: string;
  webhookUrl: string;
  extraArgs?: Record<string, string>;
};

const ENTRYPOINTS: Record<string, string> = {
  planner: "dist/sandbox/planner.js",
  research: "dist/sandbox/research.js",
  judge: "dist/sandbox/judge.js",
  report: "dist/sandbox/report.js",
};

export const buildSandboxCommand = (
  taskType: string,
  options: SandboxCommandOptions,
): string[] => {
  const entrypoint = ENTRYPOINTS[taskType];
  if (!entrypoint) throw new Error(`Unknown task type: ${taskType}`);

  const cmd = [
    "node", entrypoint,
    "--run-id", options.runId,
    "--volume", options.volumePath,
    "--webhook-url", options.webhookUrl,
  ];

  if (options.extraArgs) {
    for (const [key, value] of Object.entries(options.extraArgs)) {
      cmd.push(`--${key}`, value);
    }
  }

  return cmd;
};

export const volumePaths = (runId: string, volumeRoot: string) => ({
  inputs: join(volumeRoot, runId, "inputs"),
  outputs: join(volumeRoot, runId, "outputs"),
  checkpoints: join(volumeRoot, runId, "checkpoints"),
});

export type ModalDispatcherOptions = {
  appName: string;
  imageName?: string;
  hmacKey: string;
  webhookUrl: string;
  runId: string;
};

export const createModalDispatcher = async (options: ModalDispatcherOptions) => {
  const { ModalClient } = await import("modal");
  const modal = new ModalClient();

  const app = await modal.apps.fromName(options.appName, { createIfMissing: true });

  const image = options.imageName
    ? modal.images.fromRegistry(options.imageName)
    : modal.images.fromRegistry("node:22-slim").dockerfileCommands([
        "RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*",
        "WORKDIR /app",
        "ENV NODE_ENV=production",
      ]);

  const codeVolume = await modal.volumes.fromName("eval-agent-code", {
    createIfMissing: true,
  });

  const runVolume = await modal.volumes.fromName(`eval-run-${options.runId}`, {
    createIfMissing: true,
  });
  const cacheVolume = await modal.volumes.fromName("eval-agent-cache", {
    createIfMissing: true,
  });

  const secrets = await modal.secrets.fromName("eval-agent-secrets", {
    requiredKeys: ["ANTHROPIC_API_KEY"],
  });
  const runSecret = await modal.secrets.fromObject({
    WEBHOOK_HMAC_KEY: options.hmacKey,
  });

  const spawnSandbox = async (
    taskType: string,
    extraArgs?: Record<string, string>,
  ) => {
    const command = buildSandboxCommand(taskType, {
      runId: options.runId,
      volumePath: "/mnt/eval",
      webhookUrl: options.webhookUrl,
      extraArgs,
    });

    const sb = await modal.sandboxes.create(app, image, {
      command,
      workdir: "/app",
      volumes: {
        "/mnt/eval": runVolume,
        "/mnt/eval-cache": cacheVolume,
        "/app": codeVolume,
      },
      secrets: [secrets, runSecret],
      timeoutMs: 600_000,
    });

    return sb;
  };

  const cleanup = async () => {
    // Volume cleanup handled separately by scheduled job
  };

  return { spawnSandbox, cleanup, runVolume, cacheVolume, codeVolume };
};
