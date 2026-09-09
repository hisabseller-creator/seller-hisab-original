import { describe, expect, it } from "vitest";
import { mapShopifyPaymentsGraphql } from "@/core/connectors/financial-mappers";
import {
  buildOfficialAuthorizationUrl,
  canonicalShopifyHmacMessage,
  defaultShopifyScopes,
  mapShopifyOrdersGraphql,
  normalizeShopifyShop,
  orderEventsToLedgerRecords,
} from "@/core/connectors/api-runtime";

describe("F6 official API connector runtime", () => {
  it("normalizes Shopify store hostnames and rejects unrelated domains", () => {
    expect(normalizeShopifyShop("https://My-Store.myshopify.com/")).toBe("my-store.myshopify.com");
    expect(normalizeShopifyShop("my-store")).toBe("my-store.myshopify.com");
    expect(normalizeShopifyShop("example.com")).toBeNull();
  });

  it("builds provider authorization URLs with state and callback", () => {
    const shopify = new URL(buildOfficialAuthorizationUrl({
      connectorId: "shopify-v1",
      clientId: "shop-client",
      redirectUri: "https://sellerhisab.com/api/account/connections/callback/shopify",
      state: "nonce-1",
      shop: "demo.myshopify.com",
      scopes: defaultShopifyScopes(),
    }));
    expect(shopify.origin).toBe("https://demo.myshopify.com");
    expect(shopify.pathname).toBe("/admin/oauth/authorize");
    expect(shopify.searchParams.get("state")).toBe("nonce-1");
    expect(shopify.searchParams.get("scope")).toContain("read_orders");

    const amazon = new URL(buildOfficialAuthorizationUrl({
      connectorId: "amazon-in-v1",
      clientId: "lwa-client",
      amazonApplicationId: "amzn-app",
      redirectUri: "https://sellerhisab.com/api/account/connections/callback/amazon",
      state: "nonce-2",
    }));
    expect(amazon.origin).toBe("https://sellercentral.amazon.in");
    expect(amazon.searchParams.get("application_id")).toBe("amzn-app");
    expect(amazon.searchParams.get("state")).toBe("nonce-2");

    const flipkart = new URL(buildOfficialAuthorizationUrl({
      connectorId: "flipkart-v1",
      clientId: "fk-app",
      redirectUri: "https://sellerhisab.com/api/account/connections/callback/flipkart",
      state: "nonce-3",
    }));
    expect(flipkart.origin).toBe("https://api.flipkart.net");
    expect(flipkart.searchParams.get("scope")).toBe("Seller_Api");
    expect(flipkart.searchParams.get("state")).toBe("nonce-3");
  });


  it("canonicalizes Shopify OAuth HMAC input without the hmac/signature fields", () => {
    const params = new URLSearchParams("shop=demo.myshopify.com&timestamp=1788430000&state=abc&hmac=deadbeef&signature=legacy");
    expect(canonicalShopifyHmacMessage(params)).toBe("shop=demo.myshopify.com&state=abc&timestamp=1788430000");
  });

  it("maps Shopify GraphQL orders without customer PII", () => {
    const mapped = mapShopifyOrdersGraphql({
      data: {
        orders: {
          nodes: [{
            id: "gid://shopify/Order/1",
            name: "#1001",
            createdAt: "2026-09-03T08:00:00Z",
            displayFinancialStatus: "PAID",
            displayFulfillmentStatus: "FULFILLED",
            email: "customer@example.com",
            phone: "+919999999999",
            lineItems: {
              nodes: [{
                id: "gid://shopify/LineItem/11",
                sku: "SKU-1",
                quantity: 2,
                discountedUnitPriceAfterAllDiscountsSet: { shopMoney: { amount: "499.50", currencyCode: "INR" } },
              }],
              pageInfo: { hasNextPage: false },
            },
          }],
        },
      },
    }, { sourceFingerprint: "api:test", channelAccountId: "cha_test" });

    expect(mapped.issues).toHaveLength(0);
    expect(mapped.events[0]).toMatchObject({
      channelId: "shopify",
      orderId: "#1001",
      sku: "SKU-1",
      quantity: 2,
      salePaise: 99900,
      outcome: "delivered",
    });
    const ledger = orderEventsToLedgerRecords(mapped.events);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].semantic).toBe("api-observation:order-sale");
    const serialized = JSON.stringify(ledger[0]);
    expect(serialized).not.toContain("customer@example.com");
    expect(serialized).not.toContain("+919999999999");
  });

  it("uses Shopify order name as the payout match key when available", () => {
    const mapped = mapShopifyPaymentsGraphql({
      data: {
        shopifyPaymentsAccount: {
          balanceTransactions: {
            nodes: [{
              id: "gid://shopify/ShopifyPaymentsBalanceTransaction/1",
              type: "CHARGE",
              test: false,
              transactionDate: "2026-09-03T09:00:00Z",
              net: { amount: "940.00", currencyCode: "INR" },
              associatedOrder: { id: "gid://shopify/Order/1", name: "#1001" },
              associatedPayout: { id: "gid://shopify/ShopifyPaymentsPayout/10", status: "PAID" },
            }],
          },
          payouts: { nodes: [] },
        },
      },
    }, { sourceFingerprint: "api:shopify-money:test", channelAccountId: "cha_test" });
    expect(mapped.evidence).toHaveLength(1);
    expect(mapped.evidence[0]).toMatchObject({ orderId: "#1001", amountPaise: 94000, finality: "released" });
  });

  it("fails closed when a Shopify order exceeds the bounded line-item page", () => {
    const mapped = mapShopifyOrdersGraphql({
      data: {
        orders: {
          nodes: [{
            id: "gid://shopify/Order/1",
            name: "#1001",
            lineItems: { nodes: [], pageInfo: { hasNextPage: true } },
          }],
        },
      },
    }, { sourceFingerprint: "api:test" });
    expect(mapped.events).toHaveLength(0);
    expect(mapped.issues[0]).toMatchObject({ severity: "critical" });
  });
});
