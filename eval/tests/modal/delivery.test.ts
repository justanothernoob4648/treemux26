import { describe, it, expect } from "vitest";
import { buildDeliveryPayload, buildProgressPayload } from "../../src/modal/delivery.js";

describe("delivery webhook", () => {
  it("buildDeliveryPayload creates correct structure", () => {
    const payload = buildDeliveryPayload({
      runId: "run-123",
      scenario: "TreeHacks 2026",
      rankings: [{ projectName: "HealthBot", compositeScore: 8.5 }],
      outliers: { noOutliersDetected: true },
      reports: {
        deepReports: { HealthBot: "# Report" },
        summary: "# Summary",
      },
      projectCount: 10,
      judgeCount: 5,
    });

    expect(payload.runId).toBe("run-123");
    expect(payload.metadata.scenario).toBe("TreeHacks 2026");
    expect(payload.metadata.projectCount).toBe(10);
    expect(payload.metadata.judgeCount).toBe(5);
    expect(payload.metadata.completedAt).toBeTruthy();
    expect(payload.reports.summary).toBe("# Summary");
  });

  it("buildProgressPayload creates correct structure", () => {
    const payload = buildProgressPayload("run-123", {
      type: "evaluating",
      projectName: "HealthBot",
      projectIndex: 3,
      totalProjects: 47,
    });

    expect(payload.runId).toBe("run-123");
    expect(payload.type).toBe("progress");
    expect(payload.event).toEqual({
      type: "evaluating",
      projectName: "HealthBot",
      projectIndex: 3,
      totalProjects: 47,
    });
  });
});
