import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  transformBuildsToProjects,
  buildContextDocument,
} from "./schemas.js";
import type { Project, ProgressEvent } from "../types.js";
import { buildSuccessPayload, buildErrorPayload } from "./callback.js";
import {
  ClientMessageSchema,
  createQueuedMessage,
  createProgressMessage,
  createResultMessage,
} from "./protocol.js";
import { createEvaluator } from "../api.js";
import { writeRankingsSummary } from "../agents/report-writer.js";

// ─── HTTP Handler ───

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function createHttpHandler() {
  return (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, { status: "ok" });
      return;
    }
    json(res, 404, { error: "Not found" });
  };
}

// ─── Queue ───

type QueueCallbacks = {
  readonly onProgress: (event: ProgressEvent) => void;
  readonly onResult: (payload: Record<string, unknown>) => void;
};

type QueueItem = {
  readonly runId: string;
  readonly context: string;
  readonly projects: readonly Project[];
  readonly judgeCount: number;
  readonly callbacks: QueueCallbacks;
};

export function createEvaluationQueue() {
  const queue: QueueItem[] = [];
  let processing = false;

  async function processNext() {
    if (processing || queue.length === 0) return;
    processing = true;
    const item = queue.shift()!;

    console.log(`[${item.runId}] Starting evaluation (${item.projects.length} projects, ${item.judgeCount} judges)`);

    try {
      const evaluator = createEvaluator({
        context: item.context,
        judgeCount: item.judgeCount,
        local: false,
      });

      const results = await evaluator.evaluate({
        projects: [...item.projects],
        onProgress: (event) => {
          console.log(`[${item.runId}]`, JSON.stringify(event));
          item.callbacks.onProgress(event);
        },
      });

      const summary = writeRankingsSummary(results.rankings, results.plan, results.outliers);
      const payload = buildSuccessPayload(item.runId, results.rankings, results.outliers, summary);

      console.log(`[${item.runId}] Evaluation complete.`);
      item.callbacks.onResult(payload as unknown as Record<string, unknown>);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${item.runId}] Evaluation failed: ${message}`);
      const errorPayload = buildErrorPayload(item.runId, message);
      item.callbacks.onResult(errorPayload as unknown as Record<string, unknown>);
    } finally {
      processing = false;
      processNext();
    }
  }

  return {
    enqueue(item: QueueItem) {
      queue.push(item);
      processNext();
    },
  };
}

// ─── WebSocket Handler ───

function safeSend(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function handleWebSocketConnection(
  ws: WebSocket,
  queue: ReturnType<typeof createEvaluationQueue>,
): void {
  ws.once("message", (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      ws.close(4002, "Invalid JSON");
      return;
    }

    const validation = ClientMessageSchema.safeParse(parsed);
    if (!validation.success) {
      ws.close(4002, "Invalid message schema");
      return;
    }

    const { evaluator, builds } = validation.data;
    const runId = randomUUID();
    const context = buildContextDocument(evaluator);
    const projects = transformBuildsToProjects(builds);

    safeSend(ws, createQueuedMessage(runId));

    queue.enqueue({
      runId,
      context,
      projects,
      judgeCount: evaluator.counter,
      callbacks: {
        onProgress: (event) => safeSend(ws, createProgressMessage(runId, event)),
        onResult: (payload) => {
          safeSend(ws, createResultMessage(runId, payload as { status: string; runId: string; [key: string]: unknown }));
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1000, "Evaluation complete");
          }
        },
      },
    });
  });
}

// ─── Entry Point ───

function main() {
  const port = parseInt(process.env.PORT ?? "3000", 10);

  const evalQueue = createEvaluationQueue();
  const httpHandler = createHttpHandler();
  const httpServer = createServer(httpHandler);

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname !== "/evaluate") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      handleWebSocketConnection(ws, evalQueue);
    });
  });

  httpServer.listen(port, () => {
    console.log(`eval-agent server listening on port ${port}`);
  });

  const shutdown = () => {
    console.log("Shutting down...");
    wss.close();
    httpServer.close(() => process.exit(0));
    setTimeout(() => {
      console.error("Forced shutdown after timeout");
      process.exit(1);
    }, 30_000);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

const isDirectExecution = process.argv[1]?.includes("server");
if (isDirectExecution) {
  main();
}
