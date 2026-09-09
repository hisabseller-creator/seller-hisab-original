import { describe, expect, it } from "vitest";
import { defaultConnectorReadiness, listP0ConnectorReadiness } from "@/core/connectors/health";

describe("connector health model", () => {
  it("shows P0 connectors plus the approved WooCommerce expansion connector", () => {
    const rows = listP0ConnectorReadiness();
    expect(rows.map((row) => row.channelId)).toEqual(["meesho", "amazon-in", "flipkart", "shopify", "woocommerce"]);
    expect(rows.filter((row) => row.runtimeStatus === "live").map((row) => row.channelId)).toEqual(["meesho", "amazon-in", "flipkart", "shopify", "woocommerce"]);
  });

  it("marks WooCommerce live only for merchant-authorized REST order reads", () => {
    const woo = defaultConnectorReadiness("woocommerce-v1");
    expect(woo.runtimeStatus).toBe("live");
    expect(woo.orders).toContain("wc/v3");
    expect(woo.settlements).toContain("not inferred");
    expect(woo.authorization).toContain("Read key");
  });

  it("keeps Amazon API sync authorization-dependent while file analysis is live", () => {
    const amazon = defaultConnectorReadiness("amazon-in-v1");
    expect(amazon.runtimeStatus).toBe("live");
    expect(amazon.settlements).toContain("Settlement Flat File V2");
    expect(amazon.authorization).toContain("SP-API");
    expect(amazon.accountStatus).toBe("not-connected");
  });

  it("keeps Flipkart Reports API authorization separate from live file analysis", () => {
    const flipkart = defaultConnectorReadiness("flipkart-v1");
    expect(flipkart.runtimeStatus).toBe("live");
    expect(flipkart.settlements).toContain("settlement/P&L");
    expect(flipkart.authorization).toContain("API");
    expect(flipkart.accountStatus).toBe("not-connected");
  });
});
