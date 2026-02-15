/**
 * Epoch orchestrator server: WebSocket + HTTP callbacks for implementation modules.
 * All inbound POST payloads use the unified { type, payload } shape (WsEvent).
 */

import type { JobStartedPayload, JobStepLogPayload, JobDonePayload, JobErrorPayload, JobPushPayload, WsEvent } from "./types.ts";
import { getObservabilityHandlers } from "./observability.ts";
import { createDeployment } from "./vercel.ts";
import { parseRepoFullName } from "./github.ts";
import { log } from "./logger.ts";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

export type OnAllDone = (results: { url: string; pitch: string }[]) => void | Promise<void>;

export interface ServerState {
  totalJobs: number;
  doneCount: number;
  results: { url: string; pitch: string }[];
  deploymentUrls?: Record<string, string>;
  onAllDone?: OnAllDone;
}

export function createServer(state: ServerState) {
  const obs = getObservabilityHandlers(PORT);

  /** POST /v1.0/log/start — worker signals sandbox has started with plan */
  async function handleStart(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body: JobStartedPayload;
    try {
      body = (await req.json()) as JobStartedPayload;
    } catch {
      log.error("/v1.0/log/start invalid JSON");
      return new Response("Invalid JSON", { status: 400 });
    }
    log.server("JOB_STARTED " + body.jobId + " totalSteps=" + body.totalSteps);
    obs.broadcast({ type: "JOB_STARTED", payload: body });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /** POST /v1.0/log/step — worker sends per-step progress */
  async function handleStep(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body: JobStepLogPayload;
    try {
      body = (await req.json()) as JobStepLogPayload;
    } catch {
      log.error("/v1.0/log/step invalid JSON");
      return new Response("Invalid JSON", { status: 400 });
    }
    log.server("JOB_STEP_LOG " + body.jobId + " [" + body.stepIndex + "/" + body.totalSteps + "] " + body.summary);
    obs.broadcast({ type: "JOB_STEP_LOG", payload: body });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /** POST /v1.0/log/error — worker reports a non-fatal error */
  async function handleError(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body: JobErrorPayload;
    try {
      body = (await req.json()) as JobErrorPayload;
    } catch {
      log.error("/v1.0/log/error invalid JSON");
      return new Response("Invalid JSON", { status: 400 });
    }
    log.server("JOB_ERROR " + body.jobId + " phase=" + (body.phase ?? "unknown") + " " + body.error);
    obs.broadcast({ type: "JOB_ERROR", payload: body });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /** POST /v1.0/log/push — worker successfully pushed a step to GitHub */
  async function handlePush(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body: JobPushPayload;
    try {
      body = (await req.json()) as JobPushPayload;
    } catch {
      log.error("/v1.0/log/push invalid JSON");
      return new Response("Invalid JSON", { status: 400 });
    }
    log.server("JOB_PUSH " + body.jobId + " step=" + body.stepIndex + " branch=" + body.branch);
    obs.broadcast({ type: "JOB_PUSH", payload: body });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /** POST /v1.0/log/done — worker signals completion */
  async function handleDone(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body: JobDonePayload;
    try {
      body = (await req.json()) as JobDonePayload;
    } catch {
      log.error("/v1.0/log/done invalid JSON");
      return new Response("Invalid JSON", { status: 400 });
    }
    log.server("JOB_DONE " + body.jobId + " success=" + body.success);
    obs.broadcast({ type: "JOB_DONE", payload: body });

    let url = state.deploymentUrls?.[body.jobId] ?? body.repoUrl;
    if (body.success && body.repoUrl && !state.deploymentUrls?.[body.jobId] && process.env.VERCEL_TOKEN) {
      try {
        const [org, repo] = parseRepoFullName(body.repoUrl);
        if (org && repo) {
          const ref = body.branch ?? "main";
          const deploy = await createDeployment({
            name: `epoch-${body.jobId}`,
            org,
            repo,
            ref,
          });
          url = deploy.url || (deploy.deploymentId ? `https://${deploy.deploymentId}.vercel.app` : body.repoUrl);
          obs.broadcast({ type: "JOB_DEPLOYMENT", payload: { jobId: body.jobId, url } });
        }
      } catch (e) {
        log.warn("Vercel deploy failed for " + body.jobId + " " + String(e));
      }
    }
    if (url) {
      log.server("Deployment endpoint " + body.jobId + ": " + url);
    }

    state.results.push({ url: url || body.repoUrl, pitch: body.pitch ?? "" });
    state.doneCount += 1;
    log.server("progress " + state.doneCount + " / " + state.totalJobs);

    if (state.doneCount >= state.totalJobs) {
      log.server("all implementations done, firing evaluator webhook");
      obs.broadcast({ type: "ALL_DONE", payload: { results: state.results } });
      await state.onAllDone?.(state.results);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = Bun.serve({
    port: PORT,
    fetch(req, server) {
      const u = new URL(req.url);
      if (u.pathname === "/ws") {
        if (server.upgrade(req)) return;
        return new Response("Upgrade failed", { status: 426 });
      }
      if (u.pathname === "/v1.0/log/start") return handleStart(req);
      if (u.pathname === "/v1.0/log/step") return handleStep(req);
      if (u.pathname === "/v1.0/log/error") return handleError(req);
      if (u.pathname === "/v1.0/log/push") return handlePush(req);
      if (u.pathname === "/v1.0/log/done") return handleDone(req);
      if (u.pathname === "/health") return new Response("ok");
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws) { obs.wsOpen(ws); },
      close(ws) { obs.wsClose(ws); },
      message(ws, msg) { obs.wsMessage(ws, msg); },
    },
  });

  log.server("Listening on " + server.port + " WS /ws, POST /v1.0/log/{start,step,error,push,done}");
  return { server, obs };
}
