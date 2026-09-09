# F7 — Bank & Cash Truth

SellerHisab F7 adds an account-level cash evidence layer without turning the product into a bank scraper or accounting replacement.

## What ships

- `/app/cash` Bank & Cash Truth workspace.
- Browser-side CSV/XLSX/XLS bank statement normalization.
- Raw bank file bytes are not posted to SellerHisab. Only normalized transaction rows explicitly saved by the signed-in user are persisted.
- Tenant-scoped bank transaction persistence with cross-import overlap dedupe.
- Deterministic payout → bank matching:
  1. explicit payout/reference match first;
  2. otherwise only a unique exact amount + currency candidate in the date window;
  3. ambiguous candidates are never guessed;
  4. short/excess classification requires a reference-linked bank credit.
- Cash at risk, pending payout, unmatched credit, credits/debits and net cash movement.
- F7 cash exceptions are written into the account action-recommendation foundation and surfaced as an account alert.
- Conservative 13-week runway foundation using only user-entered current cash and known weekly fixed outflow. Future sales/payouts are not invented.
- Latest saved analysis contribution is shown separately from bank cash so cash is never mislabeled as profit.

## Privacy boundary

SellerHisab does not request bank login credentials and does not scrape bank portals. Bank files are parsed in the browser. Persisted rows are limited to normalized date, amount, debit/credit direction, currency, limited reference/narration, optional closing balance and source row. Full raw files are not stored by F7.

## D1 migration

`0010_bank_cash_truth.sql` creates:

- `bank_transactions`
- `cash_matches`
- `cash_preferences`

The deployment runner refuses to proceed if Wrangler reports any old `0000`–`0009` migration as pending. It applies migrations only when `0010_bank_cash_truth.sql` is the pending migration, then verifies the three F7 tables before deployment.

## Scope honesty

Persistent payout matching uses payout observations already present in SellerHisab's canonical ledger, including official API payout observations where provider permissions allow them. File-side settlement reconciliation in Analyze remains available independently; F7 does not pretend that every marketplace exposes a live payout API.
