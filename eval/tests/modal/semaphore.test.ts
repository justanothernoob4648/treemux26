import { describe, it, expect } from "vitest";
import { Semaphore } from "../../src/modal/semaphore.js";

describe("Semaphore", () => {
  it("allows up to maxConcurrent tasks", async () => {
    const sem = new Semaphore(2);
    let running = 0;
    let maxRunning = 0;

    const task = async () => {
      const release = await sem.acquire();
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 50));
      running--;
      release();
    };

    await Promise.all([task(), task(), task(), task()]);
    expect(maxRunning).toBe(2);
  });

  it("semaphore with limit 1 runs tasks sequentially", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    const task = (id: number) => async () => {
      const release = await sem.acquire();
      order.push(id);
      await new Promise((r) => setTimeout(r, 10));
      release();
    };

    await Promise.all([task(1)(), task(2)(), task(3)()]);
    expect(order).toEqual([1, 2, 3]);
  });

  it("release allows next waiting task to proceed", async () => {
    const sem = new Semaphore(1);
    const release1 = await sem.acquire();

    let acquired2 = false;
    const p2 = sem.acquire().then((release) => {
      acquired2 = true;
      release();
    });

    expect(acquired2).toBe(false);
    release1();
    await p2;
    expect(acquired2).toBe(true);
  });
});
