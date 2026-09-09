# SellerHisab F0 — Multi-Marketplace Foundation

## Purpose

This release changes the internal model from a Meesho-shaped analysis pipeline into a marketplace-scoped foundation without pretending that every marketplace connector is already live.

The current validated file analyzer remains **Meesho**. Amazon India, Flipkart, Shopify, WooCommerce and other channels are registered as planned/partner/discovery connectors until their own fixtures, authorization and tests are complete.

## What is now foundational

- Channel catalogue with launch priority, support state and data-acquisition posture.
- Connector registry with possible capabilities separated from enabled capabilities.
- Channel/account-scoped order and SKU keys so identical IDs from two marketplaces do not merge.
- Canonical model types for tenant, channel account, product identity, SKU alias, immutable commerce ledger and action outcomes.
- Per-channel analysis summaries and explicit analysis scope.
- Dashboard and exports identify the channel for SKU/action rows.
- Additive D1 schema for tenants, legal entities, channel accounts, master products, variants, listings, aliases, imports, ledger entries, actions, outcomes and audit events.

## Safety / accuracy rules

1. A planned connector is not a live integration claim.
2. Unknown marketplace files remain unrecognized rather than being guessed into a schema.
3. Order IDs and SKUs are scoped by channel/account before reconciliation.
4. Financial history is designed for append-only ledger events and explicit reversals.
5. Low-confidence SKU mapping must never drive automatic writes.
6. Marketplace write actions stay disabled until official access, approval, rollback and audit exist.

## Database migration

`0007_multimarket_foundation.sql` is additive. It does not rename or remove the existing auth, payment, profile, analysis, alert, site-settings or blog tables.

Apply it once after code checks pass:

```powershell
pnpm exec wrangler d1 migrations apply DB --remote --config wrangler.jsonc
```

Wrangler applies only pending migrations. `0006_blog_cms.sql` should not be manually rerun.

## Next engineering phase

F1 should make the canonical foundation useful with real marketplace data, in this order:

1. Harden Meesho adapter into the canonical import contract.
2. Build a report-fixture lab and schema fingerprint/version checks.
3. Add Amazon India report fixtures/parser and then approved SP-API integration.
4. Add Flipkart order/listing fixtures/API plus settlement-file adapter.
5. Add Shopify authorized API connector and D2C payment/courier normalization.
6. Add master-SKU review/approval UI before any cross-channel inventory or automation.
