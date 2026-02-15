/**
 * Spawn implementation modules (Modal or mock).
 * Each job gets idea, risk, temperature, callback URL, repo URL, GitHub token.
 */

import type { ImplementationJob } from "./types.ts";
import { getObservabilityHandlers } from "./observability.ts";
import { log } from "./logger.ts";

const CALLBACK_BASE = process.env.CALLBACK_BASE_URL ?? "http://localhost:3000";

async function postStart(payload: Record<string, unknown>) {
  const url = `${CALLBACK_BASE}/v1.0/log/start`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) log.warn("start callback failed " + res.status);
}

async function postStep(payload: Record<string, unknown>) {
  const url = `${CALLBACK_BASE}/v1.0/log/step`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) log.warn("step callback failed " + res.status);
}

async function postDone(payload: Record<string, unknown>) {
  const url = `${CALLBACK_BASE}/v1.0/log/done`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) log.warn("done callback failed " + res.status);
}

/**
 * Run mock implementation (no Modal): emit JOB_STARTED, JOB_STEP_LOG, JOB_DONE.
 */
export async function runMockImplementation(
  job: ImplementationJob,
  _obs: ReturnType<typeof getObservabilityHandlers> | null = null,
): Promise<void> {
  const { jobId, idea, risk, temperature, repoUrl, branch } = job;
  log.spawn("mock implementation start " + jobId);

  const planSteps = [
    "Installing dependencies",
    "Creating data model",
    "Building UI components",
    "Adding styling",
    "Testing build",
  ];

  await postStart({
    jobId,
    idea,
    temperature,
    risk,
    branch,
    totalSteps: planSteps.length,
    planSteps,
  });

  for (let i = 0; i < planSteps.length; i++) {
    await postStep({
      jobId,
      stepIndex: i,
      totalSteps: planSteps.length,
      done: false,
      summary: planSteps[i],
    });
    await new Promise((r) => setTimeout(r, 500));
  }
  await postStep({
    jobId,
    stepIndex: planSteps.length,
    totalSteps: planSteps.length,
    done: true,
    summary: "Build complete",
  });

  await postDone({
    jobId,
    repoUrl: repoUrl ?? "https://github.com/treemux/demo",
    idea,
    pitch: "We built a production-ready app that " + idea + ". Deployed live and ready to demo — working software shipped in minutes.",
    success: true,
    error: null,
    branch: branch ?? "main",
  });
  log.spawn("mock implementation done " + jobId);
}

/**
 * Spawn real implementation on Modal via web endpoint.
 */
export async function runModalImplementation(
  job: ImplementationJob,
  _obs: ReturnType<typeof getObservabilityHandlers> | null = null,
): Promise<void> {
  const url = process.env.MODAL_IMPLEMENTATION_WORKER_URL;
  if (!url) {
    log.warn("MODAL_IMPLEMENTATION_WORKER_URL not set, using mock");
    return runMockImplementation(job, _obs);
  }

  log.spawn("triggering Modal implementation " + job.jobId);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: job.jobId,
      idea: job.idea,
      risk: job.risk,
      temperature: job.temperature,
      worker_profile: job.workerProfile,
      callback_base_url: job.callbackBaseUrl,
      branch: job.branch,
      repo_url: job.repoUrl,
      github_token: job.githubToken,
      vercel_token: job.vercelToken,
      git_user_name: job.gitUserName,
      git_user_email: job.gitUserEmail,
      claude_oauth_token: job.claudeOauthToken,
      model: job.model,
    }),
  });

  if (!res.ok) {
    log.error("Modal trigger failed " + res.status + " " + (await res.text()));
    await postDone({
      jobId: job.jobId,
      repoUrl: job.repoUrl ?? "",
      pitch: "Implementation failed.",
      success: false,
      error: "Modal request failed",
      branch: job.branch,
    });
  }
  // Modal runs async; worker calls /api/internal/start, /api/internal/step, /api/internal/done.
}
