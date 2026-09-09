# SELLERHISAB - WORK START HERE
## Purpose
This package is the latest SellerHisab working tree.
Do NOT re-audit the entire project.
Do NOT broadly research unrelated areas.
The validated production audit is the authoritative backlog.
Current implementation work starts at:
F15 - Security + Schema Authority + Release Observability
After F15:
F16 -> F17 -> F18 -> F19 -> F20
## Credit / scope discipline
1. Read this file first.
2. Read FINAL_AUDIT.md if present, otherwise use the separately uploaded final audit.
3. Inspect ONLY files relevant to the current F15 item.
4. Do not recursively summarize every source file.
5. Do not inspect large static Framer/public bundles unless the current task specifically requires them.
6. Do not repeat competitor research or general web research already completed in the audit.
7. When current external technical behavior must be checked, use only the minimum necessary official documentation.
8. Finish our requested SellerHisab work before suggesting unrelated enhancements.
## Project
Brand: SellerHisab
Domain: sellerhisab.com
Stack:
- Next.js App Router
- vinext / Vite
- Cloudflare Workers
- Cloudflare D1
- Cloudflare R2
- pnpm
Website-first SaaS.
## Safety rules
- Preserve ALL existing modified and untracked work.
- NEVER git reset.
- NEVER git clean.
- NEVER discard unrelated changes.
- NEVER overwrite the whole repository.
- Do not manually rerun old migrations.
- 0006 / 0007 / 0008 must never be manually rerun.
- 0015 was already production-applied and must never be rerun.
- 0018 bilingual blog migration was already production-applied once and must not be rerun.
- No migration APPLY unless user explicitly approves it.
- No production deploy unless user explicitly says deploy.
- Ignore Wrangler update notices unless an upgrade is explicitly part of an approved task.
## Source-write safety
Do NOT use Windows PowerShell Get-Content/Set-Content/WriteAllText transformations
for source-code patching.
Preferred:
- Node fs.readFileSync(path, "utf8")
- transform in memory
- validate all expected targets
- only then fs.writeFileSync(path, data, "utf8")
Patch must:
- verify expected source matches
- abort on mismatch
- backup touched files
- avoid partial writes
- preserve unrelated work
## User workflow
Do not ask the user to manually edit source code.
Preferred output:
- guarded patch package
- one APPLY-SELLERHISAB-<PHASE>.ps1
- Node UTF-8 transactional helper internally where needed
- batched verification
Verification should batch as much as safely possible:
- typecheck
- lint/check where applicable
- targeted unit tests
- relevant contract/security tests
- build
Do not run migration or deploy after verification unless explicitly authorized.
## F15 order
Work in this order unless source evidence requires a small adjustment:
1. SEC-01
   Admin OTP/password reset must obey admin password policy.
2. SEC-02 + SEC-03
   Versioned password KDF migration.
   Existing password hashes must continue verifying.
   Do not lock out existing users.
   New hashes should use the approved stronger policy.
3. DB-01
   Verify schema.ts vs production-applied migration history.
   Establish one authoritative schema model.
   Do not blindly create/apply a migration.
4. OPS / Release foundation
   CI gates, dependency/security automation, SBOM where appropriate,
   exact deployment provenance/version metadata.
5. Observability
   Production logs, meaningful error context, SLO/alert foundation.
## Important
Do not start F16 until F15 acceptance gates pass.
Do not add broad new product features during F15.
Do not redesign UI during F15 unless required by an F15 finding.
The goal is boring, safe, traceable production reliability.