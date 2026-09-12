import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, matchTotpStep, totpCodeForStep } from "@/server/totp";

describe("TOTP", () => {
  it("matches the RFC6238 SHA1 vector truncated to six digits", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(await totpCodeForStep(secret, 1)).toBe("287082");
    expect(await matchTotpStep(secret, "287082", 59_000, 0)).toBe(1);
  });

  it("round-trips base32 without padding", () => {
    const bytes = Uint8Array.from({ length: 20 }, (_, index) => (index * 17 + 9) & 0xff);
    const encoded = base32Encode(bytes);
    expect(base32Decode(encoded)).toEqual(bytes);
  });

  it("accepts the configured adjacent time window but rejects an old code", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const code = await totpCodeForStep(secret, 10);
    expect(await matchTotpStep(secret, code, 11 * 30_000, 1)).toBe(10);
    expect(await matchTotpStep(secret, code, 12 * 30_000, 1)).toBeNull();
  });
});
