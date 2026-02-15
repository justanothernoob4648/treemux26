import { describe, it, expect, afterEach } from "vitest";
import { readVolumeJson, writeVolumeJson } from "../../src/sandbox/utils.js";
import { writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = "/tmp/claude/sandbox-utils-test";

describe("sandbox utils", () => {
  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("readVolumeJson reads and parses JSON from volume path", () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const filePath = join(TEST_DIR, "test.json");
    writeFileSync(filePath, JSON.stringify({ name: "test", value: 42 }));

    const result = readVolumeJson(filePath);
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("writeVolumeJson writes JSON to volume path with directories", () => {
    const filePath = join(TEST_DIR, "nested", "deep", "output.json");

    writeVolumeJson(filePath, { status: "success" });

    const content = readFileSync(filePath, "utf-8");
    expect(JSON.parse(content)).toEqual({ status: "success" });
  });

  it("readVolumeText reads text from volume path", async () => {
    mkdirSync(TEST_DIR, { recursive: true });
    const filePath = join(TEST_DIR, "context.md");
    writeFileSync(filePath, "# Hackathon Spec\nThis is a test.");

    const { readVolumeText } = await import("../../src/sandbox/utils.js");
    const result = readVolumeText(filePath);
    expect(result).toBe("# Hackathon Spec\nThis is a test.");
  });
});
