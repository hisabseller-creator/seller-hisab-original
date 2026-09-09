# Runtime Verification Checklist

Do not call SellerHisab production-ready until all critical items below pass.

## Billing
- [ ] Razorpay one-time payment: browser callback blocked; signed webhook alone grants exactly one entitlement.
- [ ] Duplicate/out-of-order webhook replay never duplicates entitlement.
- [ ] Provider state/amount/currency mismatch fails closed.
- [ ] Starter/Pro creation maps to the exact server-owned plan.
- [ ] Renewal extends access once.
- [ ] Failed payment/pause/cancel/expiry removes or schedules access correctly.
- [ ] Refund/chargeback behavior matches policy and entitlement state.
- [ ] Paid-but-locked restoration works without a second payment.

## Identity / tenancy / roles
- [ ] MSG91 signup/login/recovery and replay behavior.
- [ ] Two workspaces × Owner/Admin/Analyst/Viewer × every record family foreign-ID matrix.
- [ ] Viewer cannot mutate legacy or current write APIs.
- [ ] Analyst cannot bypass approval transitions by direct API call.
- [ ] Production cookie, logout, expiry, Origin and redirect rules on `sellerhisab.com` and `www`.

## Financial truth
- [ ] DD/MM/YYYY, ISO, Excel serial, leap date and IST/UTC boundary corpus.
- [ ] Duplicate, overlapping, corrected and interrupted imports.
- [ ] Multi-SKU orders remain incomplete without defensible allocation.
- [ ] Unmatched ad spend never disappears from contribution truth.
- [ ] Repeated bank amounts/missing dates/partial payouts/cross-month cases.
- [ ] Hand-calculated refunds, cancellations, RTO, returns, fees, taxes, ads and payouts.

## Connectors
- [ ] Amazon, Flipkart, Shopify OAuth denial/replay/refresh/reconnect.
- [ ] WooCommerce valid store connect/sync.
- [ ] WooCommerce localhost/private/reserved/metadata/redirect/DNS-rebind denial using controlled infrastructure.
- [ ] Retry/backoff/checkpoint behavior under 429/5xx/timeouts.

## Files / browser
- [ ] 50 MB CSV/XLSX on representative 2–4 GB Android hardware.
- [ ] malformed XLSX, ZIP bomb, high compression ratio, many entries, path traversal.
- [ ] Chromium + Firefox + WebKit supported journeys.
- [ ] 320/360 px Android layouts, keyboard/focus/error association, TalkBack basics.

## Operations
- [ ] D1 backup exported and encrypted per runbook.
- [ ] Deliberate restore drill validates users, workspaces, entitlements, roles and normalized finance.
- [ ] Rollback procedure rehearsed on non-production environment.
- [ ] Billing mismatch report reviewed.
- [ ] Support paid-but-locked/refund/import incident flow exercised.
