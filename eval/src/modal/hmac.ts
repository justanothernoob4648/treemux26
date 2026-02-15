import { createHmac, randomUUID } from "node:crypto";

export const generateHmacKey = (): string => randomUUID();

export const signPayload = (key: string, payload: unknown): string => {
  const hmac = createHmac("sha256", key);
  hmac.update(JSON.stringify(payload));
  return hmac.digest("hex");
};

export const verifyPayload = (
  key: string,
  payload: unknown,
  signature: string,
): boolean => {
  const expected = signPayload(key, payload);
  return expected === signature;
};
