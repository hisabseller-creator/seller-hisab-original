import { pbkdf2Sync } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  PASSWORD_ITERATIONS,
  PASSWORD_VERSION,
  WORKERS_PBKDF2_MAX_ITERATIONS,
  hashPassword,
  passwordNeedsRehash,
  passwordResetRequired,
  validatePasswordForIdentity,
  verifyPassword,
} from "@/server/password";

describe("versioned credential migration", () => {
  it("keeps every production PBKDF2 call within the Workers ceiling", () => {
    expect(PASSWORD_VERSION).toBe("v3");
    expect(PASSWORD_ITERATIONS).toBe(100_000);
    expect(PASSWORD_ITERATIONS).toBeLessThanOrEqual(WORKERS_PBKDF2_MAX_ITERATIONS);
  });

  it("verifies legacy 100k hashes and upgrades without changing the password", async () => {
    const salt = Buffer.alloc(16, 7);
    const password = "SellerHisab#2026";
    const old = [
      "pbkdf2_sha256",
      "100000",
      salt.toString("base64url"),
      pbkdf2Sync(password, salt, 100000, 32, "sha256").toString("base64url"),
    ].join("$");
    expect(await verifyPassword(password, old)).toBe(true);
    expect(passwordNeedsRehash(old)).toBe(true);
    const next = await hashPassword(password);
    expect(next).toMatch(/^v3\$pbkdf2_sha256\$100000\$/);
    expect(await verifyPassword(password, next)).toBe(true);
    expect(passwordNeedsRehash(next)).toBe(false);
  });

  it("requires an OTP reset for the retired v2/600k production-incompatible format", async () => {
    const salt = Buffer.alloc(16, 9);
    const password = "SellerHisab#2026";
    const retired = [
      "v2",
      "pbkdf2_sha256",
      "600000",
      salt.toString("base64url"),
      pbkdf2Sync(password, salt, 600000, 32, "sha256").toString("base64url"),
    ].join("$");
    expect(passwordResetRequired(retired)).toBe(true);
    await expect(verifyPassword(password, retired)).resolves.toBe(false);
    expect(passwordNeedsRehash(retired)).toBe(false);
  });

  it("rejects malformed, unknown version and work-factor abuse without deriving", async () => {
    for (const hash of [
      "v4$pbkdf2_sha256$100000$a$b",
      "pbkdf2_sha256$999999999$a$b",
      "v3$pbkdf2_sha256$100001$a$b",
      "v3$pbkdf2_sha256$100000$$",
      "pbkdf2_sha256$100000$c2FsdA$",
    ]) {
      expect(await verifyPassword("password", hash)).toBe(false);
    }
  });

  it("preserves seller policy while enforcing admin recovery strength", () => {
    expect(validatePasswordForIdentity("seller123", false)).toBe("seller123");
    expect(() => validatePasswordForIdentity("seller123", true)).toThrow(/Admin/);
  });
});
