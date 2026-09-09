import { describe, expect, it } from "vitest";
import { mapAmazonOrdersApi2026, mapFlipkartShipmentsV3 } from "@/core/connectors/official-order-mappers";

describe("official marketplace order mappers", () => {
  it("normalizes Amazon Orders API v2026 identity and proceeds without inventing settlement", () => {
    const result = mapAmazonOrdersApi2026({
      orders: [{
        orderId: "403-123",
        createdTime: "2026-09-03T04:30:00Z",
        orderStatus: "UNSHIPPED",
        orderItems: [{
          orderItemId: "OI-A1",
          quantityOrdered: 2,
          product: { asin: "B0TEST", sellerSku: "AMZ-SKU-1" },
          proceeds: { breakdowns: [{ type: "ITEM", subtotal: { amount: "998.00", currencyCode: "INR" } }] },
        }],
      }],
    }, { sourceFingerprint: "amazon-fp", channelAccountId: "amazon-acct" });

    expect(result.issues).toHaveLength(0);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      channelId: "amazon-in",
      channelAccountId: "amazon-acct",
      orderId: "403-123",
      subOrderId: "OI-A1",
      sku: "AMZ-SKU-1",
      quantity: 2,
      salePaise: 99800,
      settlementPaise: undefined,
      outcome: "pending",
      currency: "INR",
    });
  });

  it("normalizes Flipkart v3 shipment order items and keeps non-cancelled orders provisional", () => {
    const result = mapFlipkartShipmentsV3({
      shipments: [{
        shipmentId: "SHP-1",
        updatedAt: "2026-09-03T04:30:00Z",
        status: "APPROVED",
        orderItems: [{
          fsn: "FSN1",
          quantity: 1,
          orderId: "OD-1",
          orderItemId: "OI-F1",
          listingId: "LST-1",
          sku: "FK-SKU-1",
          priceComponents: { sellingPrice: 499, totalPrice: 529, shippingCharge: 30 },
        }],
      }],
    }, { sourceFingerprint: "flipkart-fp", channelAccountId: "flipkart-acct" });

    expect(result.issues).toHaveLength(0);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      channelId: "flipkart",
      channelAccountId: "flipkart-acct",
      orderId: "OD-1",
      subOrderId: "OI-F1",
      sku: "FK-SKU-1",
      salePaise: 52900,
      settlementPaise: undefined,
      outcome: "pending",
      currency: "INR",
    });
  });

  it("fails individual API items closed when stable marketplace identity is missing", () => {
    const amazon = mapAmazonOrdersApi2026({ orders: [{ orderId: "403-1", orderItems: [{ orderItemId: "OI-1" }] }] }, { sourceFingerprint: "a" });
    const flipkart = mapFlipkartShipmentsV3({ shipments: [{ orderItems: [{ orderId: "OD-1", orderItemId: "OI-1" }] }] }, { sourceFingerprint: "f" });
    expect(amazon.events).toHaveLength(0);
    expect(amazon.issues[0]).toMatchObject({ code: "missing_identifier", severity: "critical" });
    expect(flipkart.events).toHaveLength(0);
    expect(flipkart.issues[0]).toMatchObject({ code: "missing_identifier", severity: "critical" });
  });
});
