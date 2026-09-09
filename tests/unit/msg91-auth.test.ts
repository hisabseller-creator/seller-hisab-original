import { describe, expect, it } from "vitest";
import { extractMsg91AccessToken, looksLikeAccessToken } from "@/core/auth/msg91";

describe("MSG91 OTP widget result handling", () => {
  it("accepts the access token when MSG91 returns it in message", () => {
    const token = "header.payload.signature-with-enough-length-1234567890";
    expect(extractMsg91AccessToken({ success: true, identifier: "919876543210", message: token })).toBe(token);
  });

  it("accepts documented access-token key variants and nested payloads", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    expect(extractMsg91AccessToken({ data: { "access-token": token } })).toBe(token);
    expect(extractMsg91AccessToken({ data: { accessToken: token } })).toBe(token);
  });

  it("does not mistake human-readable success messages for access tokens", () => {
    expect(extractMsg91AccessToken({ message: "OTP verified" })).toBeUndefined();
    expect(extractMsg91AccessToken({ message: "OTP verification completed successfully for this mobile number and request." })).toBeUndefined();
    expect(looksLikeAccessToken("verified")).toBe(false);
  });
});
