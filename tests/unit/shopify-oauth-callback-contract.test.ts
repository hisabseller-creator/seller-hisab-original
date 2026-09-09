import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Shopify OAuth callback ownership contract", () => {
  it("does not require an active SellerHisab session after Shopify redirects back", () => {
    const source = readFileSync("app/api/account/connections/callback/shopify/route.ts", "utf8");
    expect(source).not.toContain("getSessionUser");
    expect(source).toContain("consumeOauthStateForCallback");
    expect(source).toContain("userId: oauth.userId");
  });

  it("binds the callback to a single-use connector OAuth state that returns the stored owner", () => {
    const source = readFileSync("server/connectors/store.ts", "utf8");
    expect(source).toContain("user_id AS userId");
    expect(source).toContain("WHERE state_hash = ?1 AND connector_id = ?2 AND expires_at > ?3");
    expect(source).toContain("DELETE FROM connector_oauth_states");
  });
});
