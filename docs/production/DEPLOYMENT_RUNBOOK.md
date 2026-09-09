# Deployment Runbook

This RC1 package intentionally does **not** deploy.

After local validation and only after explicit approval to deploy:

1. Confirm current production version and create a D1 backup/export.
2. Confirm Wrangler reports exactly `0015_launch_hardening.sql` as the only pending migration.
3. If any historical migration is unexpectedly pending, stop. Never manually rerun old migrations.
4. Apply `0015` through normal Wrangler migration tracking.
5. Confirm no migrations remain pending.
6. Run a schema sanity query for new billing/import/support/retry tables/columns.
7. Deploy the already validated source.
8. Capture Cloudflare Worker Version ID.
9. Run smoke tests: `/`, auth, `/app`, billing status, `/app/ask`, connections, cash, ads, inventory, admin access boundary.
10. Run Razorpay/MSG91/provider runtime gates before enabling broad paid acquisition.

Never print `.env`, `.dev.vars`, API tokens, connector secrets, encryption keys or full bank rows into logs/chat.
