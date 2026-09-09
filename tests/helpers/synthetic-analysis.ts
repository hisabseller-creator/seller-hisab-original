import { analyze } from "@/core/analyze";
import type { AnalysisInput, NormalizedEvent, OrderOutcome, SourceReference } from "@/core/types";
import { PARSER_VERSION } from "@/core/types";

const source: SourceReference = {
  fileName: "synthetic-payments.xlsx",
  sheetName: "Payments",
  rowNumber: 2,
  parserVersion: PARSER_VERSION,
  sourceFingerprint: "test-synthetic-payments-v1",
};

const plans: Array<{
  sku: string;
  count: number;
  sale: number;
  settlement: number;
  status: OrderOutcome;
}> = [
  { sku: "TEST-SKU-A", count: 12, sale: 649, settlement: 548, status: "delivered" },
  { sku: "TEST-SKU-A", count: 2, sale: 649, settlement: -118, status: "return" },
  { sku: "TEST-SKU-B", count: 8, sale: 399, settlement: 322, status: "delivered" },
  { sku: "TEST-SKU-B", count: 4, sale: 399, settlement: -76, status: "rto" },
  { sku: "TEST-SKU-C", count: 5, sale: 549, settlement: 442, status: "delivered" },
  { sku: "TEST-SKU-C", count: 2, sale: 549, settlement: -126, status: "return" },
  { sku: "TEST-SKU-D", count: 4, sale: 299, settlement: 247, status: "delivered" },
  { sku: "TEST-SKU-D", count: 1, sale: 299, settlement: 0, status: "pending" },
  { sku: "TEST-SKU-MISSING-COST", count: 3, sale: 459, settlement: 381, status: "delivered" },
];

function buildEvents(): NormalizedEvent[] {
  let row = 2;
  const events: NormalizedEvent[] = [];

  for (const plan of plans) {
    for (let index = 0; index < plan.count; index += 1) {
      const subOrderId = `TEST-SO-${String(row - 1).padStart(4, "0")}`;
      const eventSource = { ...source, rowNumber: row };

      events.push({
        eventId: `test-payment-${row}`,
        kind: "payment",
        subOrderId,
        orderId: `TEST-ORDER-${String(Math.ceil((row - 1) / 2)).padStart(4, "0")}`,
        sku: plan.sku,
        rawStatus: plan.status,
        outcome: plan.status,
        quantity: 1,
        salePaise: plan.sale * 100,
        settlementPaise: plan.settlement * 100,
        eventDate: new Date(Date.UTC(2026, 7, Math.min(28, row - 1))).toISOString(),
        source: eventSource,
      });

      if (row % 3 !== 0) {
        events.push({
          eventId: `test-order-${row}`,
          kind: "order",
          subOrderId,
          orderId: `TEST-ORDER-${String(Math.ceil((row - 1) / 2)).padStart(4, "0")}`,
          sku: plan.sku,
          rawStatus: plan.status,
          outcome: plan.status,
          quantity: 1,
          salePaise: plan.sale * 100,
          eventDate: new Date(Date.UTC(2026, 7, Math.min(28, row - 2))).toISOString(),
          source: {
            ...eventSource,
            fileName: "synthetic-orders.csv",
            sheetName: "Orders",
            sourceFingerprint: "test-synthetic-orders-v1",
          },
        });
      }

      row += 1;
    }
  }

  return events;
}

const syntheticInput: AnalysisInput = {
  events: buildEvents(),
  sourceFingerprints: ["test-synthetic-payments-v1", "test-synthetic-orders-v1"],
  costs: [
    { sku: "TEST-SKU-A", productCostPaise: 30_500, packagingCostPaise: 1_400 },
    { sku: "TEST-SKU-B", productCostPaise: 29_000, packagingCostPaise: 2_100 },
    { sku: "TEST-SKU-C", productCostPaise: 38_000, packagingCostPaise: 1_800 },
    { sku: "TEST-SKU-D", productCostPaise: 11_500, packagingCostPaise: 1_200 },
  ],
  defaultPackagingPaise: 1_500,
  manualAdSpendPaise: 29_500,
  adAllocation: "sales-share",
  minimumSampleSize: 5,
};

export function getSyntheticAnalysisForTest() {
  return analyze(syntheticInput);
}
