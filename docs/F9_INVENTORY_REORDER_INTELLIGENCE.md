# SellerHisab F9 — Inventory & Reorder Intelligence

F9 adds a privacy-first inventory snapshot workflow to the signed-in SellerHisab account area.

## What is live

- `/app/inventory` inventory and reorder workspace.
- Browser-local CSV/XLSX/XLS parsing. Raw inventory file bytes are not uploaded by F9.
- Normalized tenant-scoped inventory snapshots for Amazon India, Flipkart, Meesho and Shopify/D2C.
- Required evidence: Snapshot Date, SKU and Available units.
- Optional evidence: Master SKU, product name, inbound units, Units Sold 30d, lead time, unit cost, contribution margin and location.
- Days-cover and reorder quantity only when 30-day sales velocity exists.
- Explicit default lead time, safety days, target cover and overstock-review assumptions.
- Stockout, reorder-now, overstock/no-recent-sales and missing-sales-history actions.
- Cross-channel allocation review only when an explicit Master SKU and contribution-margin evidence are present. Identical raw SKUs are never auto-merged.
- No automatic purchase order, inventory write or stock transfer.

## Deterministic reorder model

For rows with `Units Sold 30d` greater than zero:

- daily velocity = units sold in 30d / 30
- days cover = available units / daily velocity
- reorder window = effective lead time + safety days
- target stock = daily velocity × (lead time + safety days + target cover days)
- suggested reorder = max(0, target stock − available − inbound)

If sales history is missing, SellerHisab does not invent velocity or reorder quantity. If a row omits lead time, the seller's saved default lead time is used and surfaced as an assumption.
