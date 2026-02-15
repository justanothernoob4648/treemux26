import { describe, it, expect } from "vitest";
import {
  IncomingWebhookSchema,
  transformBuildsToProjects,
  buildContextDocument,
} from "../../src/eval/schemas.js";

describe("IncomingWebhookSchema", () => {
  it("validates a valid payload", () => {
    const payload = {
      evaluator: { counter: 3, criteria: "Judge innovation and execution", role: "Hackathon judge" },
      builds: [
        { url: "https://treemux.vercel.app", idea: "A waste tracker", pitch: "We built a waste tracker" },
      ],
    };
    const result = IncomingWebhookSchema.parse(payload);
    expect(result.evaluator.counter).toBe(3);
    expect(result.builds).toHaveLength(1);
  });

  it("rejects payload with missing evaluator", () => {
    const payload = {
      builds: [{ url: "https://example.com", idea: "idea", pitch: "pitch" }],
    };
    expect(() => IncomingWebhookSchema.parse(payload)).toThrow();
  });

  it("rejects payload with empty builds array", () => {
    const payload = {
      evaluator: { counter: 3, criteria: "criteria", role: "role" },
      builds: [],
    };
    expect(() => IncomingWebhookSchema.parse(payload)).toThrow();
  });

  it("rejects payload with non-positive counter", () => {
    const payload = {
      evaluator: { counter: 0, criteria: "criteria", role: "role" },
      builds: [{ url: "https://example.com", idea: "idea", pitch: "pitch" }],
    };
    expect(() => IncomingWebhookSchema.parse(payload)).toThrow();
  });
});

describe("transformBuildsToProjects", () => {
  it("transforms builds to projects with index-based names", () => {
    const builds = [
      { url: "https://treemux-xyz.vercel.app", idea: "A waste tracker", pitch: "We built it" },
      { url: "https://treemux-abc.vercel.app", idea: "A study planner", pitch: "Students love it" },
    ];
    const projects = transformBuildsToProjects(builds);
    expect(projects).toEqual([
      { name: "project-1", url: "https://treemux-xyz.vercel.app", idea: "A waste tracker", pitch: "We built it" },
      { name: "project-2", url: "https://treemux-abc.vercel.app", idea: "A study planner", pitch: "Students love it" },
    ]);
  });
});

describe("buildContextDocument", () => {
  it("includes role, criteria, and counter", () => {
    const doc = buildContextDocument({
      counter: 3,
      criteria: "Judge on innovation and technical execution",
      role: "Senior hackathon judge",
    });
    expect(doc).toContain("Senior hackathon judge");
    expect(doc).toContain("Judge on innovation and technical execution");
    expect(doc).toContain("exactly 3 judges");
  });
});
