import { describe, expect, it } from "vitest";
import { hashPassword, passwordResetRequired, validateAdminPassword, validatePassword, verifyPassword } from "@/server/password";

describe("password authentication", () => {
  it("hashes and verifies without storing the raw password", async () => {
    const encoded = await hashPassword("MarginGuard#2026");
    expect(encoded).not.toContain("MarginGuard#2026");
    expect(encoded).toMatch(/^v3\$pbkdf2_sha256\$100000\$/);
    expect(await verifyPassword("MarginGuard#2026", encoded)).toBe(true);
    expect(await verifyPassword("wrong-password", encoded)).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(() => validatePassword("short")).toThrow(/at least 8/i);
  });

  it("requires a stronger password for admin changes", () => {
    expect(() => validateAdminPassword("alllowercase123!")).toThrow(/uppercase/i);
    expect(() => validateAdminPassword("ALLUPPERCASE123!")).toThrow(/lowercase/i);
    expect(() => validateAdminPassword("NoNumbersHere!")).toThrow(/number/i);
    expect(() => validateAdminPassword("NoSymbolHere123")).toThrow(/symbol/i);
    expect(validateAdminPassword("SellerHisab#Admin2026")).toBe("SellerHisab#Admin2026");
  });

  it("rejects unsupported PBKDF2 counts without calling the runtime derive path", async () => {
    const encoded = "pbkdf2_sha256$210000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    await expect(verifyPassword("anything", encoded)).resolves.toBe(false);
  });

  it("identifies the retired 600k v2 hash for one-time reset", () => {
    const encoded = "v2$pbkdf2_sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    expect(passwordResetRequired(encoded)).toBe(true);
  });
});
