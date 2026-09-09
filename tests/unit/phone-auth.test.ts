import { describe, expect, it } from "vitest";
import { formatIndiaMobile, normalizeIndiaMobile } from "@/core/auth/phone";

describe("mobile authentication phone handling", () => {
  it("normalizes Indian local and +91 numbers to MSG91 format", () => {
    expect(normalizeIndiaMobile("98765 43210")).toBe("919876543210");
    expect(normalizeIndiaMobile("+91 98765-43210")).toBe("919876543210");
  });

  it("rejects invalid Indian mobile numbers", () => {
    expect(() => normalizeIndiaMobile("12345")).toThrow(/valid 10-digit/i);
    expect(() => normalizeIndiaMobile("5123456789")).toThrow(/valid 10-digit/i);
  });

  it("formats the stored number for account display", () => {
    expect(formatIndiaMobile("919876543210")).toBe("+91 98765 43210");
    expect(formatIndiaMobile(null)).toBe("");
  });
});
