import { describe, it, expect } from "vitest";
import { shouldCreateSession, shouldCloseSession } from "../../src/agents/judge.js";

describe("shouldCreateSession", () => {
  it("returns true when browser needed, URL present, and no external session", () => {
    expect(shouldCreateSession(true, true, false)).toBe(true);
  });

  it("returns false when external session is provided", () => {
    expect(shouldCreateSession(true, true, true)).toBe(false);
  });

  it("returns false when no browser needed", () => {
    expect(shouldCreateSession(false, true, false)).toBe(false);
  });

  it("returns false when no URL", () => {
    expect(shouldCreateSession(true, false, false)).toBe(false);
  });
});

describe("shouldCloseSession", () => {
  it("returns true when session is owned", () => {
    expect(shouldCloseSession(true)).toBe(true);
  });

  it("returns false when session is not owned", () => {
    expect(shouldCloseSession(false)).toBe(false);
  });
});
