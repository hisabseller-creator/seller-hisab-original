# SellerHisab F8 — Ads & Marketing Economics

F8 adds a tenant-scoped ads workspace without turning SellerHisab into an ad-console clone.

## Shipped

- `/app/ads` account workspace.
- Browser-side CSV/XLSX/XLS ad report parsing. Raw file bytes are not sent to SellerHisab.
- Explicit P0 channel selection: Amazon India, Flipkart, Meesho, Shopify/D2C.
- Normalized dated campaign/SKU spend, attributed sales, orders, clicks and impressions.
- Actual ACoS and ROAS only when attributed-sales coverage is complete.
- Optional explicit pre-ad contribution margin and Return/RTO loss assumptions.
- Return-adjusted effective margin, maximum sustainable ACoS, break-even ROAS and modeled contribution after ads.
- Campaign review actions: loss review, margin watch, scale review, missing-sales-data, or maintain.
- `action_recommendations` and account alert integration for modeled overspend.
- Cross-channel spend/attributed-sales comparison.
- D1 audit trail and duplicate-safe normalized import.

## Trust rules

- Missing attributed sales never become zero sales for ACoS/ROAS.
- Profit-after-ads is not claimed unless the seller supplies a pre-ad contribution margin.
- Return/RTO adjustment is only applied from the seller's explicit percentage assumption in F8; SellerHisab does not silently infer it.
- No autonomous bid, budget, pause or scale writes are performed.
- No unofficial marketplace scraping is added.

## Migration

`0011_ads_marketing_economics.sql` adds only `ad_performance_rows` and `ad_preferences`.
