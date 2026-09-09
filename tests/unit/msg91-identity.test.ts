import { describe, expect, it } from "vitest";
import { collectMsg91VerifiedPhones } from "@/core/auth/msg91-identity";

function fakeJwt(payload: Record<string, unknown>) {
  const b64url = (value: string) => Buffer.from(value).toString("base64url");
  return `${b64url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.signature`;
}

describe("MSG91 verified identity extraction", () => {
  it("reads a normal nested string identifier", () => {
    expect([...collectMsg91VerifiedPhones({ data: { identifier: "919057956292" } })]).toEqual(["919057956292"]);
  });

  it("reads numeric provider identity values", () => {
    expect([...collectMsg91VerifiedPhones({ data: { mobile: 919057956292 } })]).toEqual(["919057956292"]);
  });

  it("reads a standalone identifier returned under a generic provider field", () => {
    expect([...collectMsg91VerifiedPhones({ data: "919057956292" })]).toEqual(["919057956292"]);
  });

  it("reads serialized nested provider JSON and verified JWT subject identities", () => {
    const token = fakeJwt({ sub: "919876543210" });
    expect([...collectMsg91VerifiedPhones({ result: '{"identifier":"919057956292"}' }, token)].sort()).toEqual([
      "919057956292",
      "919876543210",
    ]);
  });

  it("does not treat request ids, prose, email addresses or arbitrary long numbers as phones", () => {
    const phones = collectMsg91VerifiedPhones({
      reqId: "336870744532313134323444",
      message: "OTP verified successfully for the requested account",
      email: "919057956292@example.com",
      timestamp: 1756880000000,
    });
    expect([...phones]).toEqual([]);
  });
});
