# Issue Status Matrix — RC1

| Audit issue | Priority | RC1 code status | Remaining gate |
|---|---:|---|---|
| One-time paid but no entitlement | P0 | Implemented hardening | Razorpay sandbox/live replay test |
| Webhook insert-before-process stranded retry | P0 | Durable event-state groundwork implemented | fault-injection + provider retry test |
| Ambiguous Indian financial dates | P0 | Deterministic parser implemented | golden corpus + real 2026 exports |
| Provider capture/state verification | P1 | Server verification helpers integrated | Razorpay sandbox/live |
| Subscription lifecycle/cancel | P1 | Lifecycle/cancel groundwork integrated | renewal/failure/refund/chargeback runtime |
| Server paid feature enforcement | P1 | Central plan-access layer added to sensitive routes | route matrix test |
| Flipkart secrets in URL | P1 | Fixed in provider code | provider sandbox validation |
| Connector stale rows | P1 | Revision/upsert groundwork added | correction-sync integration test |
| Partial imports | P1 | lifecycle metadata/guards added | fault injection/resume test |
| Ads overlap/double count | P1 | overlap/revision safeguards added | overlapping real report fixtures |
| Multi-SKU first-SKU confidence | P1 | incomplete/evidence safeguard added | golden financial fixtures |
| Unallocated ad spend omission | P1 | unallocated/incomplete handling hardened | golden fixtures |
| Cash missing-payout overconfidence | P1 | coverage requirement hardened | bank truth fixture matrix |
| Cash amount-only false match | P1 | auto-match tightened | repeated-amount fixture matrix |
| Silent server row caps | P1 | completeness metadata/handling hardened where touched | large-seller runtime |
| Completed actions reopen | P1 | terminal-state protection added | resync workflow test |
| GET cash mutation | P1 | read path separated from refresh | API integration test |
| Viewer legacy writes | P1 | server role checks added | all-role matrix |
| Non-atomic rate limit | P1 | atomic D1 operation path added | concurrency/load test |
| Privacy overclaim | P1 | public wording/data-family disclosure corrected | counsel review |
| Export/deletion absent | P1 | account lifecycle endpoints/helpers added | seeded end-to-end deletion drill |
| Support queue absent | P1 | support/admin queue groundwork added | notification/SLA operational setup |
| Connector durable retry | P1 | job/retry infrastructure added | scheduled execution/runtime test |
| Backup/restore/runbooks absent | P1 | runbooks included | actual D1 restore drill |
| Money >2 decimal inconsistency | P2 | stricter parsing added | unit/golden validation |
| Unknown shown as ₹0 | P2 | state/display groundwork adjusted | UI E2E |
| ZIP decompression guard | P2 | parser guard strengthened | adversarial fixture test |
| Invalid workflow transitions | P2 | explicit workflow helper added | API state-transition tests |
| Benchmark comparability | P2 | publication kept gated | cohort/freshness policy validation |
| CMS sanitizer/CSP risk | P2 | sanitizer hardened | browser payload corpus/CSP review |
| Mobile/performance | P2 | no broad redesign in RC1 | real low-end Android/browser E2E |
