import { describe, it, expect } from "vitest";
import { parseConfig, loadProjects } from "../src/config.js";
import { ModelConfigSchema, ConcurrencyConfigSchema } from "../src/types.js";

describe("parseConfig", () => {
  it("validates a minimal valid config", () => {
    const raw = {
      context: "./spec.md",
      projects: "./projects.csv",
      output_dir: "./results",
    };
    const config = parseConfig(raw);
    expect(config.context).toBe("./spec.md");
    expect(config.output_dir).toBe("./results");
  });

  it("applies defaults for optional fields", () => {
    const raw = {
      context: "./spec.md",
      projects: "./projects.csv",
      output_dir: "./results",
    };
    const config = parseConfig(raw);
    expect(config.outlierConfig).toBeUndefined();
    expect(config.concurrency).toBeUndefined();
    expect(config.models).toBeUndefined();
  });

  it("validates custom_judges require context field", () => {
    const raw = {
      context: "./spec.md",
      projects: "./projects.csv",
      output_dir: "./results",
      custom_judges: [{ name: "Sam Altman", needsBrowser: true }],
    };
    expect(() => parseConfig(raw)).toThrow();
  });

  it("accepts inline project array", () => {
    const raw = {
      context: "./spec.md",
      projects: [
        { name: "Proj1", url: "https://example.com", pitch: "A cool project" },
      ],
      output_dir: "./results",
    };
    const config = parseConfig(raw);
    expect(Array.isArray(config.projects)).toBe(true);
  });

  it("rejects invalid config", () => {
    expect(() => parseConfig({})).toThrow();
    expect(() => parseConfig({ context: 123 })).toThrow();
  });

  it("parseConfig accepts deliveryWebhook config", () => {
    const raw = {
      context: "./spec.md",
      projects: [],
      output_dir: "./results",
      deliveryWebhook: {
        url: "https://example.com/webhook",
        headers: { Authorization: "Bearer token123" },
      },
    };
    const config = parseConfig(raw);
    expect(config.deliveryWebhook).toEqual({
      url: "https://example.com/webhook",
      headers: { Authorization: "Bearer token123" },
    });
  });

  it("parseConfig accepts modal config", () => {
    const raw = {
      context: "./spec.md",
      projects: [],
      output_dir: "./results",
      modal: {
        appName: "my-eval",
        imageName: "registry.example.com/eval-agent:latest",
        volumeCleanupDays: 14,
      },
    };
    const config = parseConfig(raw);
    expect(config.modal).toEqual({
      appName: "my-eval",
      imageName: "registry.example.com/eval-agent:latest",
      volumeCleanupDays: 14,
    });
  });

  it("parseConfig applies modal defaults", () => {
    const raw = {
      context: "./spec.md",
      projects: [],
      output_dir: "./results",
      modal: {},
    };
    const config = parseConfig(raw);
    expect(config.modal?.appName).toBe("eval-agent");
    expect(config.modal?.volumeCleanupDays).toBe(7);
  });
});

describe("ModelConfigSchema defaults", () => {
  it("defaults judges to claude-sonnet-4-5-20250929", () => {
    const config = ModelConfigSchema.parse({});
    expect(config.judges).toBe("claude-sonnet-4-5-20250929");
  });
});

describe("ConcurrencyConfigSchema defaults", () => {
  it("defaults maxConcurrentBrowsers to 5", () => {
    const config = ConcurrencyConfigSchema.parse({});
    expect(config.maxConcurrentBrowsers).toBe(5);
  });

  it("defaults maxConcurrentProjects to 3", () => {
    const config = ConcurrencyConfigSchema.parse({});
    expect(config.maxConcurrentProjects).toBe(3);
  });

  it("accepts custom maxConcurrentProjects value", () => {
    const config = ConcurrencyConfigSchema.parse({ maxConcurrentProjects: 10 });
    expect(config.maxConcurrentProjects).toBe(10);
  });

  it("rejects non-positive maxConcurrentProjects", () => {
    expect(() => ConcurrencyConfigSchema.parse({ maxConcurrentProjects: 0 })).toThrow();
    expect(() => ConcurrencyConfigSchema.parse({ maxConcurrentProjects: -1 })).toThrow();
  });
});

describe("loadProjects", () => {
  it("returns projects directly when given an array", async () => {
    const projects = [
      { name: "Proj1", pitch: "A cool project" },
    ];
    const result = await loadProjects(projects);
    expect(result).toEqual(projects);
  });

  it("accepts projects with an idea field", async () => {
    const projects = [
      { name: "Proj1", url: "https://example.com", idea: "A waste tracking app", pitch: "We built a production-ready waste tracker" },
    ];
    const result = await loadProjects(projects);
    expect(result[0].idea).toBe("A waste tracking app");
  });

  it("accepts projects without an idea field", async () => {
    const projects = [
      { name: "Proj1", pitch: "A cool project" },
    ];
    const result = await loadProjects(projects);
    expect(result[0].idea).toBeUndefined();
  });

  it("parses CSV string content", async () => {
    const csv = `name,url,pitch\n"HealthBot","https://healthbot.app","An AI health assistant"\n"EcoTrack","https://ecotrack.app","Carbon tracking"`;
    const result = await loadProjects(csv, true);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("HealthBot");
    expect(result[0].url).toBe("https://healthbot.app");
    expect(result[1].pitch).toBe("Carbon tracking");
  });
});
