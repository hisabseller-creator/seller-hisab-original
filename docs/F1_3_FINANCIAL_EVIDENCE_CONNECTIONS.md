# SellerHisab F1.3 — Financial Evidence + Connection Health

## Goal

F1.3 connects marketplace order evidence to source-backed money evidence without pretending every marketplace has the same payout API or that a marketplace financial event is already a bank credit.

## Financial evidence model

Order-level financial evidence has two independent dimensions:

- `finality`: `released` or `provisional`
- `cashStage`: `marketplace-financial` or `payout`

A released marketplace-financial event can support contribution calculations, but it is excluded from bank-credit reconciliation until payout/bank evidence exists. This is particularly important for Amazon Finances transactions.

## P0 money adapters

- Shopify: Shopify Payments balance transactions linked to an associated order. Only transactions attached to a `PAID` payout are released payout evidence.
- Amazon India: Finances API v2024-06-19 transaction mapper. `RELEASED` / `DEFERRED_RELEASED` events are source-backed marketplace-financial evidence, not proof of bank credit.
- Flipkart: settlement mapping requires an explicit, validated seller-file column map. SellerHisab does not invent a public settlement API or silently guess a universal export schema.

## Reconciliation guardrails

- Match by marketplace + channel account + normalized order ID.
- Do not apply provisional money evidence.
- Do not double-count order-level evidence when line-level settlement already exists.
- Fail closed on currency conflicts.
- Do not combine payout and marketplace-financial stages automatically for one order.
- Allocate order-level money across line items by observed sales share; equal split is allowed only when line sales are absent and is surfaced as an estimated-allocation warning.

## Connection health

The account now has a read-only `/app/connections` view and `/api/account/connections` health endpoint for the P0 connectors.

The health metadata table stores connector/account status, enabled capability names, granted scope names, sync timestamps and error codes. It does not store marketplace passwords or access tokens.

F1.3 does not add OAuth writes yet. Amazon/Shopify authorization and Flipkart approved access remain later connection-flow work.
