/**
 * Epoch orchestrator server: WebSocket + HTTP callbacks for implementation modules.
 * Terminal-first: all events logged; WS used for future dashboard.
 */

import type { ImplementationDone, JobEvent } from "./types.ts";
import { getObservabilityHandlers } from "./observability.ts";
import { createDeployment } from "./vercel.ts";
import { log } from "./logger.ts";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

export type OnAllDone = (results: { url: string; pitch: string }[]) => void | Promise<void>;

export interface ServerState {
  totalJobs: number;
  doneCount: number;
  results: { url: string; pitch: string }[];
  onAllDone?: OnAllDone;
}

export function createServer(state: ServerState) {
  const obs = getObservabilityHandlers(PORT);

  async function handleJobEvent(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body: JobEvent;
    try {
      body = (await req.json()) as JobEvent;
    } catch {
      log.error("/internal/job-event invalid JSON");
      return new Response("Invalid JSON", { status: 400 });
    }
    if (body.type !== "JOB_IMPL_STARTED" && body.type !== "JOB_LOG") {
      log.error("/internal/job-event unknown type: " + (body as { type?: string }).type);
      return new Response("Unknown event type", { status: 400 });
    }
    log.server("job-event " + body.type + " " + body.payload.jobId);
    obs.broadcast(body);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  async function handleDone(req: Request): Promise<Response> {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body: ImplementationDone;
    try {
      body = (await req.json()) as ImplementationDone;
    } catch {
      log.error("/api/internal//done invalid JSON");
      return new Response("Invalid JSON", { status: 400 });
    }
    log.server("done " + body.jobId + " " + body.repoUrl + " success=" + body.success + " pitch=" + (body.pitch ?? ""));

    obs.broadcast({ type: "done", payload: body });

    let url = body.repoUrl;
    if (body.success && body.repoUrl && process.env.VERCEL_TOKEN) {
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
          obs.broadcast({ type: "deployment", jobId: body.jobId, url });
        }
      } catch (e) {
        log.warn("Vercel deploy failed for " + body.jobId + " " + String(e));
      }
    } else if (body.success && body.repoUrl && !process.env.VERCEL_TOKEN) {
      log.server("Skipping Vercel (no VERCEL_TOKEN); using repo URL as result");
    }

    state.results.push({ url: url || body.repoUrl, pitch: body.pitch ?? "" });
    state.doneCount += 1;
    log.server("progress " + state.doneCount + " / " + state.totalJobs);

    if (state.doneCount >= state.totalJobs) {
      log.server("all implementations done, firing evaluator webhook");
      obs.broadcast({ type: "all_done", results: state.results });
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
      if (u.pathname === "/internal/job-event") return handleJobEvent(req);
      if (u.pathname === "/internal/done") return handleDone(req);
      if (u.pathname === "/health") return new Response("ok");
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        obs.wsOpen(ws);
      },
      close(ws) {
        obs.wsClose(ws);
      },
      message(ws, msg) {
        obs.wsMessage(ws, msg);
      },
    },
  });

  log.server("Listening on " + server.port + " WS /ws, POST /internal/job-event, /internal/done");
  return { server, obs };
}

function parseRepoFullName(repoUrl: string): [string, string] {
  const m = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (m) return [m[1]!, m[2]!.replace(/\.git$/, "")];
  return ["", ""];
}
