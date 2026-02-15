import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import {
  createHttpHandler,
  createEvaluationQueue,
  handleWebSocketConnection,
} from "../../src/eval/server.js";
import type { ProgressEvent } from "../../src/types.js";

type TestServer = {
  readonly httpServer: Server;
  readonly wss: WebSocketServer;
  readonly port: number;
};

function startTestServer(queue: ReturnType<typeof createEvaluationQueue>): Promise<TestServer> {
  return new Promise((resolve) => {
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
        handleWebSocketConnection(ws, queue);
      });
    });

    httpServer.listen(0, () => {
      const addr = httpServer.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ httpServer, wss, port });
    });
  });
}

function stopServer(ts: TestServer): Promise<void> {
  return new Promise((resolve) => {
    ts.wss.close();
    ts.httpServer.close(() => resolve());
  });
}

function connectWs(port: number): WebSocket {
  return new WebSocket(`ws://localhost:${port}/evaluate`);
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
}

function waitForClose(ws: WebSocket): Promise<{ code: number; reason: string }> {
  return new Promise((resolve) => {
    ws.on("close", (code, reason) => resolve({ code, reason: reason.toString() }));
  });
}

function collectMessages(ws: WebSocket, count: number): Promise<unknown[]> {
  return new Promise((resolve) => {
    const messages: unknown[] = [];
    ws.on("message", (data) => {
      messages.push(JSON.parse(String(data)));
      if (messages.length >= count) resolve(messages);
    });
  });
}

function createFakeQueue() {
  const progressEvents: ProgressEvent[] = [
    { type: "planning", message: "Designing judges" },
    { type: "evaluating", projectName: "project-1", projectIndex: 0, totalProjects: 1 },
  ];

  const fakeResult = {
    status: "success" as const,
    runId: "will-be-overwritten",
    rankings: [],
    outliers: {},
    summary: "done",
    metadata: {},
  };

  type QueueCallbacks = {
    readonly onProgress: (event: ProgressEvent) => void;
    readonly onResult: (payload: Record<string, unknown>) => void;
  };

  type QueueItem = {
    readonly runId: string;
    readonly context: string;
    readonly projects: readonly unknown[];
    readonly judgeCount: number;
    readonly callbacks: QueueCallbacks;
  };

  let lastEnqueued: QueueItem | undefined;

  return {
    enqueue(item: QueueItem) {
      lastEnqueued = item;
      for (const event of progressEvents) {
        item.callbacks.onProgress(event);
      }
      item.callbacks.onResult({ ...fakeResult, runId: item.runId });
    },
    get lastEnqueued() {
      return lastEnqueued;
    },
  };
}

describe("server", () => {
  let ts: TestServer;

  afterEach(async () => {
    if (ts) await stopServer(ts);
  });

  describe("GET /health", () => {
    it("returns 200", async () => {
      const queue = createEvaluationQueue();
      ts = await startTestServer(queue);

      const res = await fetch(`http://localhost:${ts.port}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "ok" });
    });
  });

  describe("unknown HTTP routes", () => {
    it("returns 404", async () => {
      const queue = createEvaluationQueue();
      ts = await startTestServer(queue);

      const res = await fetch(`http://localhost:${ts.port}/unknown`);
      expect(res.status).toBe(404);
    });
  });

  describe("WebSocket /evaluate", () => {
    it("accepts connection", async () => {
      const queue = createEvaluationQueue();
      ts = await startTestServer(queue);

      const ws = connectWs(ts.port);
      await waitForOpen(ws);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it("closes with 4002 for invalid JSON", async () => {
      const queue = createEvaluationQueue();
      ts = await startTestServer(queue);

      const ws = connectWs(ts.port);
      await waitForOpen(ws);

      const closePromise = waitForClose(ws);
      ws.send("not json at all{{{");

      const { code } = await closePromise;
      expect(code).toBe(4002);
    });

    it("closes with 4002 for invalid schema", async () => {
      const queue = createEvaluationQueue();
      ts = await startTestServer(queue);

      const ws = connectWs(ts.port);
      await waitForOpen(ws);

      const closePromise = waitForClose(ws);
      ws.send(JSON.stringify({ type: "evaluate", bad: true }));

      const { code } = await closePromise;
      expect(code).toBe(4002);
    });

    it("sends queued, progress, and result messages then closes with 1000", async () => {
      const fakeQueue = createFakeQueue();
      ts = await startTestServer(fakeQueue as unknown as ReturnType<typeof createEvaluationQueue>);

      const ws = connectWs(ts.port);
      await waitForOpen(ws);

      const messagesPromise = collectMessages(ws, 4);
      const closePromise = waitForClose(ws);

      ws.send(JSON.stringify({
        type: "evaluate",
        evaluator: { counter: 2, criteria: "test", role: "judge" },
        builds: [{ url: "https://example.com", idea: "idea", pitch: "pitch" }],
      }));

      const messages = await messagesPromise;

      expect(messages[0]).toEqual(
        expect.objectContaining({ type: "queued", runId: expect.any(String) }),
      );
      expect(messages[1]).toEqual(
        expect.objectContaining({ type: "progress", event: { type: "planning", message: "Designing judges" } }),
      );
      expect(messages[2]).toEqual(
        expect.objectContaining({ type: "progress", event: expect.objectContaining({ type: "evaluating" }) }),
      );
      expect(messages[3]).toEqual(
        expect.objectContaining({ type: "result", status: "success" }),
      );

      const { code } = await closePromise;
      expect(code).toBe(1000);
    });

    it("does not crash when client disconnects mid-evaluation", async () => {
      type QueueCallbacks = {
        readonly onProgress: (event: ProgressEvent) => void;
        readonly onResult: (payload: Record<string, unknown>) => void;
      };
      type QueueItem = {
        readonly runId: string;
        readonly callbacks: QueueCallbacks;
        readonly [key: string]: unknown;
      };

      let capturedItem: QueueItem | undefined;
      const slowQueue = {
        enqueue(item: QueueItem) {
          capturedItem = item;
        },
      };

      ts = await startTestServer(slowQueue as unknown as ReturnType<typeof createEvaluationQueue>);

      const ws = connectWs(ts.port);
      await waitForOpen(ws);

      const messagesPromise = collectMessages(ws, 1);

      ws.send(JSON.stringify({
        type: "evaluate",
        evaluator: { counter: 1, criteria: "test", role: "judge" },
        builds: [{ url: "https://example.com", idea: "idea", pitch: "pitch" }],
      }));

      await messagesPromise;
      ws.close();

      await new Promise((r) => setTimeout(r, 50));

      expect(() => {
        capturedItem!.callbacks.onProgress({ type: "planning", message: "still going" });
        capturedItem!.callbacks.onResult({ status: "success", runId: capturedItem!.runId });
      }).not.toThrow();
    });
  });
});
