# SellerHisab F1.3.1 — Money Chain / Payout Reconciliation

## Scope

This patch strengthens F1.3. It does not start F2 and does not add a D1 migration.

The deterministic money chain is now represented as:

`Order -> Settlement Evidence -> Settlement Batch -> Bank Transaction`

## Marketplace adapters

- Shopify Payments balance transactions can link order money to `associatedPayout.id`. Explicit Shopify payout objects become settlement batches with source-backed net amount, currency, payout status and reference keys.
- Amazon Finances v2024 transactions can link to a `FINANCIAL_EVENT_GROUP_ID`. Finances v0 financial-event groups become payout batches with source-backed group totals, transfer date and trace ID. Marketplace-financial evidence still does not become bank receipt evidence.
- Flipkart remains fail-closed and file-first for settlements. Settlement rows need an explicit validated column map. Payout batches need an explicit batch ID and amount; SellerHisab never derives a full payout total from a partial row selection.

## Deterministic payout-to-bank matching

Matching order:

1. Exact normalized explicit payout/reference ID.
2. Otherwise, one unique exact amount + currency candidate; if the payout has an issue date, the bank row must also have a date inside the configured match window.

SellerHisab does not classify a similar unmatched amount as short/excess. Short/excess is created only when an explicitly reference-linked bank movement differs from the payout amount.

## Missing-payment safety

A released/paid marketplace payout with no matched bank row is **not automatically called missing**.

`missing` requires both:

- an explicit `expectedBankBy` date for the payout batch; and
- declared bank evidence coverage through that date (`bankEvidenceCompleteThrough`).

Without both, the chain stays Incomplete or Provisional. This prevents false missing-payment claims when the seller has not supplied a complete bank period or when the marketplace has not supplied a bank-due date.

## Summary totals

Pending, failed and cancelled payout batches are excluded from the final expected-bank total. Bank comparison uses payout-batch evidence when available, not the sum of order-attributed marketplace financial events.

## UI honesty

- Dashboard can show `Payout -> bank truth`: expected final payout, matched bank amount, matched difference, confidence and Why reasons.
- The legacy manual bank-credit comparison now compares against bank-reconcilable payout evidence rather than every order settlement line.
- Connections cards use green `Connected` only for an actually connected account. Live file support is shown as `File-based`; unavailable live connections remain `Planned`, and degraded accounts show `Needs attention`.

## Persistence

No new D1 table is required in F1.3.1. Connector health continues to use already-applied `0008_connector_health.sql`. Do not rerun `0006_blog_cms.sql`, `0007_multimarket_foundation.sql`, or `0008_connector_health.sql`.
