# SellerHisab F2 — Website-first unified analysis

This F2 keeps the corrected product model intact:

- The normal SellerHisab website remains the product before and after login.
- `/app` remains a simple account/history/costs/billing utility.
- `/admin` remains the website + users/purchases admin area.
- MSG91 verified-identity authentication is preserved.

## What F2 adds

1. Marketplace readiness is visible on `/analyze`
   - Meesho: full validated file analysis live.
   - Shopify: Orders CSV reader live; confirmed finance still requires payout/payment evidence.
   - Amazon India: official mappers exist, but live file/API access is not claimed.
   - Flipkart: order mapper exists; settlement remains file-first until validated.

2. Unified business context inside the actual analysis result
   - Marketplace-wise contribution/risk cards.
   - Previous local-analysis comparison.
   - Settlement exceptions joined into the seller context.
   - Cross-channel SKU identity remains scoped until seller approval.
   - Exact same SKU text across channels is only a mapping suggestion.
   - Mapping conflicts fail closed.

3. Login now has a concrete persistence benefit
   - Signed-in analyses auto-save a privacy-safe derived summary.
   - Reusable SKU cost inputs sync to the user's account.
   - Account costs are merged back into the browser by newest `updatedAt`.
   - Raw marketplace files, order rows, customer data and report rows are not uploaded by this flow.

4. Existing `saved_costs` D1 table is reused.
   - No D1 migration is required.
   - Cost writes require authentication, same-origin requests, validation and rate limiting.
   - Stable per-user/SKU IDs avoid duplicates.
   - Older browser cost copies cannot overwrite newer account copies.

## Validation

The included runner executes:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. `pnpm deploy`

Production deploy runs only after all validation passes.
