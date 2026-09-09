# F2 — Owner Operating View

Status: implementation patch

## Product outcome

SellerHisab home is now centered on four owner questions:

- Today — what does the latest local analysis say and what changed versus the previous local analysis?
- Money — confirmed/provisional/incomplete contribution plus payout-to-bank truth and Why evidence.
- Products — channel-scoped SKU economics with explicit seller-approved cross-channel product mapping.
- Actions — deterministic settlement and SKU actions ranked with urgent money risk first.

## Financial and identity guardrails

- Raw marketplace files remain browser-local.
- Existing deterministic finance calculations are reused; the UI does not invent profit, settlement, tax or bank values.
- An identical SKU string across marketplaces is only a mapping suggestion.
- Cross-channel product totals are calculated only after explicit seller approval.
- Conflicting approved aliases fail closed and stay unmerged.
- Marketplace write actions remain disabled; the action inbox is read-only guidance.
- Payout missing/short states continue to use F1's evidence rules.

## Storage

F2 adds a browser-local IndexedDB `productMappings` table. Existing `costs` and `analyses` data are preserved through Dexie schema version 2.

No D1 schema change is required for F2.

## Re-open local analysis

`/analyze?resume=<analysisId>` can reopen the full derived analysis already stored in this browser. It does not fetch or upload the original marketplace file.

## Validation

Before production deploy:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`
5. deploy only if all four pass
