/**
 * Treemux – Task controller.
 * Receives TaskInput, orchestrates GitHub → Vercel → N × implementation spawn.
 * Returns { success: boolean } immediately; all progress is reported via webhooks / WS.
 */

import { customAlphabet } from "nanoid";
import { CALLBACK_BASE_URL, EVALUATOR_WEBHOOK_URL } from "./config.ts";
import type { TaskInput, IdeationIdea, ImplementationJob, ServerState } from "./types.ts";
import type { ObservabilityHandlers } from "./observability.ts";
import { createRepo, createBranch, parseRepoFullName } from "./github.ts";
import { createDeployment, disableDeploymentProtection } from "./vercel.ts";
import { runMockImplementation, runModalImplementation } from "./implementation-spawn.ts";
import { log } from "./logger.ts";

const USE_MODAL = Boolean(process.env.MODAL_IMPLEMENTATION_WORKER_URL);

const jobIdGenerator = customAlphabet("abcdefghijklmnopqrstuvwxyz", 21);
function generateId(): string {
  return jobIdGenerator();
}

/**
 * Run a single task end-to-end (fire-and-forget workers).
 * Resolves as soon as all workers have been spawned — results arrive via webhooks.
 */
export async function runTask(
  input: TaskInput,
  obs: ObservabilityHandlers,
  state: ServerState | null = null,
): Promise<{ success: boolean }> {
  log.treemux("Task: " + input.taskDescription);
  log.treemux("Workers: " + input.workers);
  log.treemux("Callback base: " + CALLBACK_BASE_URL);
  log.treemux("Implementation: " + (USE_MODAL ? "Modal" : "mock"));

  // ── Synthetic ideation (pass task description directly to workers) ──
  const ideas: IdeationIdea[] = input.workerDescriptions
    .slice(0, input.workers)
    .map(() => ({
      idea: input.taskDescription,
      risk: 50,
      temperature: 50,
    }));

  obs.broadcast({ type: "IDEATION_DONE", payload: { ideas } });
  log.treemux("Ideation done (synthetic), spawning " + ideas.length + " implementation(s)");

  // ── GitHub repo + branches + Vercel deployments ───────────────
  const jobs: ImplementationJob[] = [];
  const repo = await createRepo(`treemux-${generateId()}`);
  if (state) {
    state.jobsPerRepoUrl.set(repo.cloneUrl, input.workers);
    if (input.evaluator) {
      state.evaluators.set(repo.cloneUrl, input.evaluator);
    }
  }

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i]!;
    const jobId = generateId();
    const branch = `treemux-worker-${jobId}`;
    let repoUrl: string | undefined;
    let githubToken: string | undefined;

    if (process.env.GITHUB_TOKEN) {
      try {
        await createBranch(repo.fullName, branch);
        repoUrl = repo.cloneUrl;
        githubToken = process.env.GITHUB_TOKEN;

        if (process.env.VERCEL_TOKEN && repoUrl) {
          const [org, repoName] = parseRepoFullName(repoUrl);
          if (org && repoName) {
            try {
              const deploy = await createDeployment({
                name: repoName,
                org,
                repo: repoName,
                ref: branch,
              });
              const url = deploy.url || `https://${deploy.deploymentId}.vercel.app`;

              log.vercel("Deployment endpoint for " + jobId + " (branch " + branch + "): " + url);
              obs.broadcast({ type: "JOB_DEPLOYMENT", payload: { jobId, url } });
              await disableDeploymentProtection(repoName).catch((e) =>
                log.warn("Could not disable deployment protection: " + String(e))
              );
            } catch (e) {
              log.warn("Vercel deploy failed for " + jobId + " " + String(e));
            }
          }
        }
      } catch (e) {
        log.warn("GitHub repo/branch creation failed for " + jobId + " " + String(e));
      }
    }

    jobs.push({
      jobId,
      idea: idea.idea,
      risk: idea.risk,
      temperature: idea.temperature,
      workerProfile: input.workerDescriptions[i] ?? "",
      callbackBaseUrl: CALLBACK_BASE_URL,
      branch,
      repoUrl,
      githubToken,
      vercelToken: process.env.VERCEL_TOKEN,
      gitUserName: process.env.GIT_USER_NAME,
      gitUserEmail: process.env.GIT_USER_EMAIL,
      claudeOauthToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
      model: input.model,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
    });
  }

  // ── Spawn workers (fire-and-forget) ───────────────────────────
  for (const job of jobs) {
    if (USE_MODAL) {
      runModalImplementation(job, obs).catch((e) => log.error("Modal spawn error " + String(e)));
    } else {
      runMockImplementation(job, obs).catch((e) => log.error("Mock spawn error " + String(e)));
    }
  }

  log.treemux("All workers spawned (" + jobs.length + "), returning success");
  return { success: true };
}
