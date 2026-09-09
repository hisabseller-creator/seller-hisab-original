import { describe, expect, it } from "vitest";
import { normalizeWooCommerceStoreUrl } from "@/core/connectors/woocommerce";
import { isForbiddenNetworkAddress } from "@/server/connectors/ssrf";

describe("WooCommerce SSRF boundaries", () => {
  it("rejects literal private, loopback, link-local, reserved and metadata IPv4 destinations", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "198.18.0.1",
      "203.0.113.5",
    ]) expect(isForbiddenNetworkAddress(address)).toBe(true);
  });

  it("rejects private/reserved IPv6 and mapped private IPv4", () => {
    for (const address of ["::1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254"]) {
      expect(isForbiddenNetworkAddress(address)).toBe(true);
    }
  });

  it("accepts ordinary public addresses", () => {
    expect(isForbiddenNetworkAddress("8.8.8.8")).toBe(false);
    expect(isForbiddenNetworkAddress("1.1.1.1")).toBe(false);
    expect(isForbiddenNetworkAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("requires a clean public HTTPS store URL", () => {
    expect(normalizeWooCommerceStoreUrl("https://shop.example.org")).toBe("https://shop.example.org");
    expect(normalizeWooCommerceStoreUrl("http://shop.example.org")).toBeNull();
    expect(normalizeWooCommerceStoreUrl("https://user:pass@shop.example.org")).toBeNull();
    expect(normalizeWooCommerceStoreUrl("https://localhost")).toBeNull();
    expect(normalizeWooCommerceStoreUrl("https://127.0.0.1")).toBeNull();
    expect(normalizeWooCommerceStoreUrl("https://169.254.169.254")).toBeNull();
    expect(normalizeWooCommerceStoreUrl("https://shop.example.org:8443")).toBeNull();
    expect(normalizeWooCommerceStoreUrl("https://shop.example.org?redirect=https://127.0.0.1")).toBeNull();
  });
});
