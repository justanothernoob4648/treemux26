import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/tools/stagehand.js", () => ({
  createStagehandSession: vi.fn(),
}));

import { StagehandPool } from "../../src/tools/stagehand-pool.js";
import { createStagehandSession } from "../../src/tools/stagehand.js";

const mockedCreate = createStagehandSession as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreate.mockImplementation(() =>
    Promise.resolve({ close: vi.fn().mockResolvedValue(undefined) }),
  );
});

describe("StagehandPool", () => {
  it("creates a session on first acquire", async () => {
    const pool = new StagehandPool(2);
    const { session, release } = await pool.acquire();

    expect(session).toBeDefined();
    expect(mockedCreate).toHaveBeenCalledOnce();
    release();
  });

  it("reuses a returned session on subsequent acquire", async () => {
    const pool = new StagehandPool(2);
    const first = await pool.acquire();
    const firstSession = first.session;
    first.release();

    const second = await pool.acquire();
    expect(second.session).toBe(firstSession);
    expect(mockedCreate).toHaveBeenCalledOnce();
    second.release();
  });

  it("respects concurrency limit", async () => {
    const pool = new StagehandPool(1);
    const first = await pool.acquire();

    let secondAcquired = false;
    const secondPromise = pool.acquire().then((result) => {
      secondAcquired = true;
      return result;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(secondAcquired).toBe(false);

    first.release();
    const second = await secondPromise;
    expect(secondAcquired).toBe(true);
    second.release();
  });

  it("closeAll closes all created sessions", async () => {
    const closeFn1 = vi.fn().mockResolvedValue(undefined);
    const closeFn2 = vi.fn().mockResolvedValue(undefined);
    let callCount = 0;
    mockedCreate.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        close: callCount === 1 ? closeFn1 : closeFn2,
      });
    });

    const pool = new StagehandPool(2);
    const first = await pool.acquire();
    const second = await pool.acquire();
    first.release();
    second.release();

    await pool.closeAll();

    expect(closeFn1).toHaveBeenCalledOnce();
    expect(closeFn2).toHaveBeenCalledOnce();
  });
});
