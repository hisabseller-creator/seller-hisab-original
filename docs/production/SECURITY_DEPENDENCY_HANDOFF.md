# Dependency verification — 9 September 2026

The current installed pnpm lock and source passed typecheck, unit/contract tests, vinext compatibility and production build. The interrupted-install note from the earlier handoff is superseded. Use the current repository lock and `pnpm install --frozen-lockfile`; do not regenerate or replace it with an older work snapshot.

Updates include React/React DOM/RSC 19.2.8, Vite 8.0.16 and overrides for undici 7.29.0, ws 8.21.0, sharp 0.35.0 and esbuild 0.28.1.

Last successful advisory-service check: **2026-09-08 22:07 UTC**. Raw audit: **two high image-size findings**, both covered by the integrity-verified local backport; **zero other advisories** at that check. This is not a zero-finding raw audit. See IMAGE_PARSER_SECURITY_BACKPORT.md for the two advisory IDs, affected parsers, malformed-image timeout tests and upstream replacement policy. A previous network timeout failed closed; the subsequent successful check is the evidence used here. Recheck at release because advisories change.

The security gate validates patched installed file hashes and runs malformed and valid parser fixtures before querying advisories. Missing patches, failed fixtures, unavailable advisory service and other high/critical findings fail the gate. No blanket audit bypass was added.

CycloneDX SBOM: 486 package versions. The local credential-pattern scan passed; full Git-history gitleaks is configured in CI and has not run here because the supplied ZIP contains no Git object database. GitHub workflow execution and external VAPT are not claimed complete.
