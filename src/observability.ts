/**
 * Observability: WebSocket broadcast + HTTP callbacks for implementation modules.
 * All step/done/ideation updates are broadcast to WS and logged (terminal-first).
 */

import type { StepUpdate, ImplementationDone, IdeationIdea, JobEvent } from "./types.ts";
import { log } from "./logger.ts";
import type { BufferSource } from "bun";

export type WsMessage =
  | { type: "ideation"; ideas: IdeationIdea[] }
  | { type: "implementation_start"; jobId: string; idea: string; risk: number; temperature: number }
  | { type: "step"; payload: StepUpdate }
  | { type: "done"; payload: ImplementationDone }
  | { type: "deployment"; jobId: string; url: string }
  | { type: "all_done"; results: { url: string; pitch: string }[] }
  | { type: "log"; payload: { jobId: string; log: string } }
  | JobEvent;

type WsLike = { send(data: string | BufferSource): number | void };

const wsClients: Set<WsLike> = new Set();

function broadcast(msg: WsMessage) {
  const payload = JSON.stringify(msg);
  log.obs("broadcast " + msg.type + " " + payload);
  for (const ws of wsClients) {
    try {
      ws.send(payload);
    } catch (e) {
      log.warn("ws send error", e);
    }
  }
}

export function getObservabilityHandlers(_port: number) {
  return {
    /** Register a new WebSocket client */
    wsOpen(ws: WsLike) {
      wsClients.add(ws);
      log.obs("WS client connected, total " + wsClients.size);
    },
    wsClose(ws: WsLike) {
      wsClients.delete(ws);
      log.obs("WS client disconnected, total " + wsClients.size);
    },
    wsMessage(_ws: WsLike, _message: string | Buffer) { },
    broadcast,
  };
}

export type ObservabilityHandlers = ReturnType<typeof getObservabilityHandlers>;
