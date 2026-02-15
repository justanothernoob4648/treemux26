/**
 * Treemux orchestrator server: WebSocket + HTTP callbacks for implementation modules.
 * POST /v1.0/task  — accepts TaskInput, kicks off the pipeline, returns { success, taskId }.
 * POST /v1.0/log/* — worker callbacks (start, step, error, push, deployment, done).
 * WS   /ws?taskId=<id> — subscribe to real-time events for a specific task.
 */

import type { TaskInput, ServerState, JobStartedPayload, JobStepLogPayload, JobDonePayload, JobErrorPayload, JobPushPayload, JobDeploymentPayload } from "./types.ts";
import { getObservabilityHandlers } from "./observability.ts";
import { EVALUATOR_WEBHOOK_URL } from "./config.ts";
import { runTask } from "./task.ts";
import { runEvaluation } from "./eval-bridge.ts";
import { log } from "./logger.ts";
import { customAlphabet } from "nanoid";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

/* ── CORS helper ─────────────────────────────────────────────── */
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function corsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/* ── Shared state & observability (singleton) ────────────────── */
const obs = getObservabilityHandlers(PORT);

const state: ServerState = {
  jobsPerRepoUrl: new Map(),
  completedJobs: new Map(),
  evaluators: new Map(),
  taskIds: new Map(),
  deploymentUrls: new Map(),
  results: [],
  async onAllDone(payload) {
    log.treemux("All deployments done: " + payload.builds.length + " builds, evaluator=" + (payload.evaluator ? "yes" : "none"));

    // Fire legacy evaluator webhook if configured
    if (EVALUATOR_WEBHOOK_URL) {
      log.treemux("Sending evaluator webhook to " + EVALUATOR_WEBHOOK_URL);
      const res = await fetch(EVALUATOR_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      log.treemux("Evaluator webhook response " + res.status);
    }

    // Kick off the eval-agent evaluation (runs async, streams progress via WS)
    if (payload.evaluator) {
      runEvaluation(payload, obs).catch((e) =>
        log.error("Evaluation bridge error: " + String(e))
      );
    }
  },
};

/* ── Route: POST /v1.0/task ──────────────────────────────────── */
async function handleTask(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  let body: TaskInput;
  try {
    body = (await req.json()) as TaskInput;
  } catch {
    return corsJson({ success: false, error: "Invalid JSON" }, 400);
  }
  if (!body.taskDescription || !body.workers) {
    return corsJson({ success: false, error: "taskDescription and workers are required" }, 400);
  }
  const taskId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 21)();
  runTask(taskId, body, obs, state).catch((e) => {
    log.error("[task:" + taskId + "] runTask error: " + String(e));
    obs.broadcast({ type: "JOB_ERROR", payload: { taskId, jobId: "orchestrator", error: String(e), phase: "task_init" } });
  });
  return corsJson({ taskId });
}

/* ── Route: POST /v1.0/log/start ─────────────────────────────── */
async function handleStart(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  let body: JobStartedPayload;
  try {
    body = (await req.json()) as JobStartedPayload;
  } catch {
    log.error("/v1.0/log/start invalid JSON");
    return corsJson({ error: "Invalid JSON" }, 400);
  }
  log.server("JOB_STARTED " + body.jobId + " [task:" + body.taskId + "] totalSteps=" + body.totalSteps);
  obs.broadcast({ type: "JOB_STARTED", payload: body });
  return corsJson({ ok: true });
}

/* ── Route: POST /v1.0/log/step ──────────────────────────────── */
async function handleStep(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  let body: JobStepLogPayload;
  try {
    body = (await req.json()) as JobStepLogPayload;
  } catch {
    log.error("/v1.0/log/step invalid JSON");
    return corsJson({ error: "Invalid JSON" }, 400);
  }
  log.server("JOB_STEP_LOG " + body.jobId + " [" + body.stepIndex + "/" + body.totalSteps + "] " + body.summary);
  obs.broadcast({ type: "JOB_STEP_LOG", payload: body });
  return corsJson({ ok: true });
}

/* ── Route: POST /v1.0/log/error ─────────────────────────────── */
async function handleError(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  let body: JobErrorPayload;
  try {
    body = (await req.json()) as JobErrorPayload;
  } catch {
    log.error("/v1.0/log/error invalid JSON");
    return corsJson({ error: "Invalid JSON" }, 400);
  }
  log.server("JOB_ERROR " + body.jobId + " phase=" + (body.phase ?? "unknown") + " " + body.error);
  obs.broadcast({ type: "JOB_ERROR", payload: body });
  return corsJson({ ok: true });
}

/* ── Route: POST /v1.0/log/push ──────────────────────────────── */
async function handlePush(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  let body: JobPushPayload;
  try {
    body = (await req.json()) as JobPushPayload;
  } catch {
    log.error("/v1.0/log/push invalid JSON");
    return corsJson({ error: "Invalid JSON" }, 400);
  }
  log.server("JOB_PUSH " + body.jobId + " step=" + body.stepIndex + " branch=" + body.branch);
  obs.broadcast({ type: "JOB_PUSH", payload: body });
  return corsJson({ ok: true });
}

/* ── Route: POST /v1.0/log/deployment ────────────────────────── */
async function handleDeployment(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  let body: JobDeploymentPayload;
  try {
    body = (await req.json()) as JobDeploymentPayload;
  } catch {
    log.error("/v1.0/log/deployment invalid JSON");
    return corsJson({ error: "Invalid JSON" }, 400);
  }
  log.server("JOB_DEPLOYMENT " + body.jobId + " url=" + body.url);
  state.deploymentUrls.set(body.jobId, body.url);
  obs.broadcast({ type: "JOB_DEPLOYMENT", payload: body });
  return corsJson({ ok: true });
}

/* ── Route: POST /v1.0/log/done ──────────────────────────────── */
async function handleDone(req: Request): Promise<Response> {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  let body: JobDonePayload;
  try {
    body = (await req.json()) as JobDonePayload;
  } catch {
    log.error("/v1.0/log/done invalid JSON");
    return corsJson({ error: "Invalid JSON" }, 400);
  }
  log.server("JOB_DONE " + body.jobId + " [task:" + body.taskId + "] success=" + body.success);
  obs.broadcast({ type: "JOB_DONE", payload: body });

  // Use the Vercel deployment URL if available, fall back to repo URL
  const deployUrl = state.deploymentUrls.get(body.jobId) ?? body.repoUrl;
  state.results.push({ url: deployUrl, idea: body.idea ?? "", pitch: body.pitch ?? "", repoUrl: body.repoUrl });

  state.completedJobs.set(body.repoUrl, (state.completedJobs.get(body.repoUrl) ?? 0) + 1);

  const repoCompletedJobs = state.completedJobs.get(body.repoUrl) ?? 0;
  const repoJobs = state.jobsPerRepoUrl.get(body.repoUrl) ?? 0;
  log.server("progress " + repoCompletedJobs + " / " + repoJobs);

  if (repoCompletedJobs >= repoJobs) {
    log.server("all implementations done for " + body.repoUrl + ", firing evaluator webhook");
    const taskId = body.taskId;
    const evaluator = state.evaluators.get(body.repoUrl) ?? null;
    const builds = state.results
      .filter((r) => r.repoUrl === body.repoUrl)
      .map((r) => ({ url: r.url, idea: r.idea, pitch: r.pitch }));
    const allDonePayload = { taskId, evaluator, builds };
    obs.broadcast({ type: "ALL_DONE", payload: allDonePayload });
    await state.onAllDone?.(allDonePayload);
  }

  return corsJson({ ok: true });
}

/* ── Boot server ─────────────────────────────────────────────── */
interface WsData { taskId?: string }

const server = Bun.serve<WsData>({
  port: PORT,
  fetch(req, server) {
    // CORS preflight
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

    const u = new URL(req.url);
    if (u.pathname === "/ws") {
      const taskId = u.searchParams.get("taskId") ?? undefined;
      if (server.upgrade(req, { data: { taskId } })) return;
      return new Response("Upgrade failed", { status: 426 });
    }
    if (u.pathname === "/v1.0/task") return handleTask(req);
    if (u.pathname === "/v1.0/log/start") return handleStart(req);
    if (u.pathname === "/v1.0/log/step") return handleStep(req);
    if (u.pathname === "/v1.0/log/error") return handleError(req);
    if (u.pathname === "/v1.0/log/push") return handlePush(req);
    if (u.pathname === "/v1.0/log/deployment") return handleDeployment(req);
    if (u.pathname === "/v1.0/log/done") return handleDone(req);
    if (u.pathname === "/health") return new Response("ok", { headers: CORS_HEADERS });
    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
  websocket: {
    open(ws) {
      obs.subscribe(ws, ws.data?.taskId);
    },
    close(ws) { obs.unsubscribe(ws); },
    message(ws, msg) { obs.wsMessage(ws, msg); },
  },
});

log.server(
  "Listening on :" + server.port +
  " — POST /v1.0/task, /v1.0/log/{start,step,error,push,deployment,done}, WS /ws?taskId=<id>"
);