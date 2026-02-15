import { describe, it, expect } from "vitest";
import { evaluateProjectsBatch } from "../src/orchestrator.js";

describe("evaluateProjectsBatch", () => {
  it("processes all items", async () => {
    const items = [1, 2, 3, 4, 5];
    const results: number[] = [];

    await evaluateProjectsBatch(items, 5, async (item) => {
      results.push(item * 2);
      return item * 2;
    });

    expect(results).toHaveLength(5);
    expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
  });

  it("respects concurrency limit", async () => {
    let activeConcurrent = 0;
    let maxConcurrent = 0;
    const items = [1, 2, 3, 4, 5, 6];

    await evaluateProjectsBatch(items, 2, async (item) => {
      activeConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, activeConcurrent);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeConcurrent--;
      return item;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("processes sequentially with maxConcurrent=1", async () => {
    const order: number[] = [];
    const items = [1, 2, 3];

    await evaluateProjectsBatch(items, 1, async (item) => {
      order.push(item);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return item;
    });

    expect(order).toEqual([1, 2, 3]);
  });

  it("returns results for all items", async () => {
    const items = ["a", "b", "c"];

    const results = await evaluateProjectsBatch(items, 3, async (item) => {
      return item.toUpperCase();
    });

    expect(results.sort()).toEqual(["A", "B", "C"]);
  });
});
