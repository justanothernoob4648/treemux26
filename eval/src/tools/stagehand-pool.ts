import type { Stagehand } from "@browserbasehq/stagehand";
import { Semaphore } from "../modal/semaphore.js";
import { createStagehandSession } from "./stagehand.js";

export class StagehandPool {
  private readonly semaphore: Semaphore;
  private readonly sessions: Stagehand[] = [];
  private readonly available: Stagehand[] = [];

  constructor(maxSize: number) {
    this.semaphore = new Semaphore(maxSize);
  }

  async acquire(): Promise<{ session: Stagehand; release: () => void }> {
    const semRelease = await this.semaphore.acquire();

    let session = this.available.pop();
    if (!session) {
      session = await createStagehandSession();
      this.sessions.push(session);
    }

    return {
      session,
      release: () => {
        this.available.push(session);
        semRelease();
      },
    };
  }

  async closeAll(): Promise<void> {
    await Promise.allSettled(
      this.sessions.map((s) => s.close().catch(() => {})),
    );
    this.sessions.length = 0;
    this.available.length = 0;
  }
}
