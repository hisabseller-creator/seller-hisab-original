import { describe, expect, it } from "vitest";
import { hmacSha256, signToken, verifyToken } from "@/server/crypto";
import { classifyRazorpayDisputeEvent } from "@/server/billing-policy";

describe("payment and entitlement primitives", () => {
  it("signs and verifies entitlement tokens", async () => {
    const secret = "a-secure-test-secret-with-more-than-32-characters";
    const token = await signToken({ analysisId: "ana_test_123", exp: Date.now() + 60_000 }, secret);
    expect(await verifyToken<{ analysisId: string }>(token, secret)).toMatchObject({ analysisId: "ana_test_123" });
    expect(await verifyToken(token.replace(/.$/, "x"), secret)).toBeNull();
  });

  it("matches Razorpay order signature construction", async () => {
    expect(await hmacSha256("secret", "order_123|pay_123")).toMatch(/^[a-f0-9]{64}$/);
    expect(await hmacSha256("secret", "order_123|pay_123")).not.toBe(await hmacSha256("secret", "pay_123|order_123"));
  });

  it("matches Razorpay subscription signature construction", async () => {
    const signature = await hmacSha256("secret", "pay_123|sub_123");
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(signature).not.toBe(await hmacSha256("secret", "sub_123|pay_123"));
  });
  it("keeps disputes on hold and only releases a verified dispute win", () => {
    expect(classifyRazorpayDisputeEvent("payment.dispute.created")).toBe("hold");
    expect(classifyRazorpayDisputeEvent("payment.dispute.under_review")).toBe("hold");
    expect(classifyRazorpayDisputeEvent("payment.dispute.action_required")).toBe("hold");
    expect(classifyRazorpayDisputeEvent("payment.dispute.lost")).toBe("hold");
    expect(classifyRazorpayDisputeEvent("payment.dispute.closed")).toBe("hold");
    expect(classifyRazorpayDisputeEvent("payment.dispute.won")).toBe("restore");
    expect(classifyRazorpayDisputeEvent("payment.captured")).toBe("ignore");
  });
});
