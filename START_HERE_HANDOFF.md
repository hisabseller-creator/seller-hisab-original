# SellerHisab source continuation — 9 September 2026

Read docs/production/F15_F20_PRODUCTION_HARDENING_STATUS.md for the current acceptance result and EXTERNAL_RELEASE_GATES.md for the operational work. This supersedes the earlier interrupted 70% handoff. Deployment remains a separate task.

Extract any supplied source ZIP into a NEW directory. Do not overwrite a newer working tree. The ZIP includes the current dependency lock, parser security patch, source/tests, Windows visual baselines and runbooks; it excludes installed dependencies, local databases, private environment files and build caches. The original continuation ZIP had no .git object database; exact changes are compared against its bytes.

Local verification on Windows with Node 24 and pnpm 11.19.0:

    powershell -ExecutionPolicy Bypass -File .\VALIDATE_LOCAL.ps1

The script uses a frozen install, stops on failures and runs no remote migration or deploy. Network access is needed to install dependencies/browsers and query advisories. Visual baselines target Windows Chromium/WebKit; CI execution and real provider/dashboard checks remain separate evidence.

Only forward migrations 0019–0022 are prepared. Never rerun historical SQL as repair. Keep production secrets in Cloudflare. DEPLOY_AFTER_CHECKS.ps1 is retained solely for a later, explicitly authorized release; it has NOT been run.

Remote production migrations applied: NO
Production deployed: NO
