import {
  createServer,
  type Server,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { verifyPayload } from "./hmac.js";
import type {
  WebhookNotification,
  TaskType,
  PendingTask,
} from "./webhook-types.js";

type WebhookServerOptions = {
  hmacKey: string;
  port?: number;
  onProgress?: (event: unknown) => void;
};

export class WebhookServer {
  private server: Server | null = null;
  private pendingTasks = new Map<string, PendingTask>();
  private readonly hmacKey: string;
  private readonly port: number;
  private readonly onProgress?: (event: unknown) => void;

  constructor(options: WebhookServerOptions) {
    this.hmacKey = options.hmacKey;
    this.port = options.port ?? 0;
    this.onProgress = options.onProgress;
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(this.port, () => {
        const addr = this.server!.address();
        if (typeof addr === "object" && addr) {
          resolve(`http://localhost:${addr.port}`);
        } else {
          reject(new Error("Failed to get server address"));
        }
      });
      this.server.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    for (const task of this.pendingTasks.values()) {
      clearTimeout(task.timeoutHandle);
    }
    this.pendingTasks.clear();
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  waitForTask(
    runId: string,
    taskType: TaskType,
    taskId: string,
    timeoutMs: number,
  ): Promise<WebhookNotification> {
    const key = `${runId}/${taskType}/${taskId}`;
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingTasks.delete(key);
        reject(new Error(`Webhook timeout for task ${key}`));
      }, timeoutMs);

      this.pendingTasks.set(key, {
        taskId,
        taskType: taskType as TaskType,
        resolve,
        reject,
        timeoutHandle,
      });
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      const urlMatch = req.url?.match(
        /^\/webhook\/([^/]+)\/([^/]+)\/([^/]+)$/,
      );

      if (!urlMatch || req.method !== "POST") {
        res.writeHead(404);
        res.end();
        return;
      }

      const [, runId, taskType, taskId] = urlMatch;

      try {
        const parsed = JSON.parse(body);
        const { hmac, ...payload } = parsed;

        if (!verifyPayload(this.hmacKey, payload, hmac)) {
          res.writeHead(403);
          res.end("Invalid HMAC");
          return;
        }

        if (parsed.type === "progress" && this.onProgress) {
          this.onProgress(parsed.event);
          res.writeHead(200);
          res.end();
          return;
        }

        const key = `${runId}/${taskType}/${taskId}`;
        const pending = this.pendingTasks.get(key);

        if (pending) {
          clearTimeout(pending.timeoutHandle);
          this.pendingTasks.delete(key);
          pending.resolve(payload as WebhookNotification);
        }

        res.writeHead(200);
        res.end();
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
    });
  }
}
