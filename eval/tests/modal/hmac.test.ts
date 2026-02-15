import { describe, it, expect } from "vitest";
import { signPayload, verifyPayload, generateHmacKey } from "../../src/modal/hmac.js";

describe("HMAC utilities", () => {
  it("generateHmacKey returns a non-empty string", () => {
    const key = generateHmacKey();
    expect(key).toBeTruthy();
    expect(typeof key).toBe("string");
  });

  it("signPayload produces a hex string", () => {
    const signature = signPayload("test-key", { status: "success" });
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifyPayload returns true for valid signature", () => {
    const key = generateHmacKey();
    const payload = { status: "success", outputPath: "/mnt/eval/plan.json" };
    const signature = signPayload(key, payload);
    expect(verifyPayload(key, payload, signature)).toBe(true);
  });

  it("verifyPayload returns false for wrong key", () => {
    const payload = { status: "success" };
    const signature = signPayload("correct-key", payload);
    expect(verifyPayload("wrong-key", payload, signature)).toBe(false);
  });

  it("verifyPayload returns false for tampered payload", () => {
    const key = generateHmacKey();
    const signature = signPayload(key, { status: "success" });
    expect(verifyPayload(key, { status: "failed" }, signature)).toBe(false);
  });
});
