import { describe, expect, it } from "vitest";
import { buildWooCommerceApiUrl, mapWooCommerceOrders, normalizeWooCommerceStoreUrl } from "@/core/connectors/woocommerce";

 describe("WooCommerce expansion connector", () => {
  it("accepts only public HTTPS-looking store URLs and never builds credential query strings", () => {
    expect(normalizeWooCommerceStoreUrl("https://shop.example.org/")).toBe("https://shop.example.org");
    expect(normalizeWooCommerceStoreUrl("http://shop.example.org")).toBeNull();
    expect(normalizeWooCommerceStoreUrl("https://127.0.0.1")).toBeNull();
    expect(normalizeWooCommerceStoreUrl("https://10.0.0.2")).toBeNull();
    const url = buildWooCommerceApiUrl("https://shop.example.org", "/orders", new URLSearchParams({ per_page: "1" }));
    expect(url).toBe("https://shop.example.org/wp-json/wc/v3/orders?per_page=1");
    expect(url).not.toContain("consumer_");
  });

  it("maps WooCommerce commerce fields without customer PII", () => {
    const mapped = mapWooCommerceOrders([{ id: 101, number: "101", status: "completed", currency: "INR", date_created_gmt: "2026-09-03T10:00:00", billing: { email: "private@example.com", phone: "+919999999999" }, line_items: [{ id: 7, sku: "WC-SKU-1", quantity: 2, total: "998.00", name: "Bottle" }] }], { sourceFingerprint: "api:woo:test", channelAccountId: "cha_woo" });
    expect(mapped.issues).toHaveLength(0);
    expect(mapped.events[0]).toMatchObject({ channelId: "woocommerce", orderId: "101", sku: "WC-SKU-1", quantity: 2, salePaise: 99800, outcome: "delivered" });
    const serialized = JSON.stringify(mapped.events[0]);
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("+919999999999");
  });

  it("fails closed on SKU-less WooCommerce custom lines", () => {
    const mapped = mapWooCommerceOrders([{ id: 101, status: "processing", line_items: [{ id: 8, sku: "", quantity: 1, total: "99.00" }] }], { sourceFingerprint: "api:woo:test" });
    expect(mapped.events).toHaveLength(0);
    expect(mapped.issues[0]).toMatchObject({ code: "missing_identifier", severity: "critical" });
  });
});
