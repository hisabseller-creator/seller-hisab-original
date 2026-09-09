# Project Structure

```text
seller-margin-guard/
├── app/                         Next.js routes and server API handlers
│   ├── api/                     Auth, payment, billing, entitlement and account APIs
│   ├── analyze/                 Browser-local upload and analysis route
│   ├── app/                     Optional signed-in workspace routes
│   ├── admin/                   Protected mobile-friendly website manager
│   └── [public routes]/         Demo, pricing, legal, help and SEO pages
├── components/                  Reusable UI and product screens
│   ├── dashboard/               Result dashboard, actions, simulators and unlock UI
│   └── ui/                      Accessible low-level UI primitives
├── core/                        Framework-light product logic
│   ├── parsers/                 File detection, aliases, CSV/XLSX/ZIP parsing
│   ├── reconciliation/          Sub-order indexed matching and deduplication
│   ├── finance/                 Contribution and break-even calculations
│   ├── decision-engine/         Deterministic SKU actions
│   ├── data-quality/            Reliability score and findings
│   ├── export/                  Browser-side Excel and PDF generation
│   ├── i18n/                    English/Hinglish message dictionaries
│   ├── storage/                 IndexedDB persistence
│   └── workers/                 Browser Web Worker analysis entry point
├── server/                      Cloudflare-only server helpers
├── worker/                      Cloudflare Worker entry point and security headers
├── db/                          Drizzle schema
├── drizzle/                     Ordered D1 SQL migrations
├── tests/                       Unit, property, golden parser and E2E tests
│   ├── fixtures/                Synthetic safe report files
│   ├── golden/                  Parser contract tests
│   ├── unit/                    Finance, parser and security tests
│   └── e2e/                     Browser product flows
├── public/                      Static brand and social assets
├── docs/                        Architecture, deployment, auth and release documentation
├── scripts/                     Maintenance, fixture and production-readiness helpers
├── .env.example                Local environment template without secrets
├── wrangler.jsonc              Cloudflare Worker and D1 binding configuration
├── vite.config.ts              vinext + Cloudflare Vite build configuration
├── playwright.config.ts        Browser test configuration
├── vitest.config.ts            Unit/property/golden test configuration
└── package.json                Cross-platform pnpm commands
```

## Dependency direction

UI routes may call the shared core. The shared core must not import React, Next.js, Cloudflare APIs, D1 or payment code. Server modules may use D1 and provider credentials but must never receive raw report contents.

## Important entry points

| Purpose | File |
| --- | --- |
| Browser analysis orchestration | `core/analyze.ts` |
| Parser adapter aliases | `core/parsers/aliases.ts` |
| File/ZIP safety | `core/parsers/files.ts` |
| Reconciliation | `core/reconciliation/index.ts` |
| Financial engine | `core/finance/engine.ts` |
| Recommendation rules | `core/decision-engine/index.ts` |
| Analysis Web Worker | `core/workers/analyzer.worker.ts` |
| Main upload UI | `components/analyze-wizard.tsx` |
| Result dashboard | `components/dashboard/dashboard.tsx` |
| Landing and example result | `components/landing-page.tsx` |
| Glass/wallpaper design tokens | `app/globals.css` |
| Conditional public feature tabs | `components/feature-tabs.tsx` |
| Calculator hub and tools | `components/calculator-hub.tsx`, `components/seo-tool-page.tsx` |
| Public site settings | `core/site-settings.ts`, `server/site-settings.ts` |
| Website admin | `components/admin-panel.tsx`, `app/api/admin/site-settings/route.ts` |
| Cloudflare runtime | `worker/index.ts` |
| D1 schema | `db/schema.ts` |

## Repository hygiene

Historical patch instructions, local backups, `.bak` files and generated TypeScript build-info files are not source. Run `pnpm repo:check` before release or developer handoff to catch accidental artifacts.

The root is intentionally kept small: application/config files stay at the root, durable developer documentation stays under `docs/`, and one-off patch history stays outside the repository.
