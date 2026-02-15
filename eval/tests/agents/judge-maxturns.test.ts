import { describe, it, expect } from "vitest";
import { getMaxTurns } from "../../src/agents/judge.js";

describe("getMaxTurns", () => {
  it("returns 8 for browser judges", () => {
    expect(getMaxTurns(true)).toBe(8);
  });

  it("returns 2 for text judges", () => {
    expect(getMaxTurns(false)).toBe(2);
  });
});
