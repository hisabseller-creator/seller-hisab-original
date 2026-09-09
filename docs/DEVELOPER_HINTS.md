# Developer Hints

All hints in this project are intentionally written in English.

## Parser changes

- Detect formats from header fingerprints, not filenames.
- Normalize headers before alias matching.
- Do not infer a monetary field from position alone.
- Unknown critical mappings must stop financial output.
- Keep parser aliases separate from finance rules.
- Add a synthetic fixture and a golden expected result for every supported layout.

## Financial changes

- Use integer paise or `decimal.js`; never aggregate currency with binary floating point.
- Round only at presentation boundaries.
- Do not subtract marketplace deductions twice when settlement is already net.
- Missing required costs must downgrade trust and exclude the row from confirmed contribution.
- Recommendations must include sample size, confidence, mathematical reason and money impact.

## Privacy changes

- Keep raw XLSX, CSV and ZIP bytes in the browser.
- Never add report bodies to API requests, telemetry or logs.
- Do not persist customer names, phone numbers or addresses.
- Keep exports browser-side and neutralize spreadsheet formula prefixes.

## UI changes

- Main product UI lives in `components/landing-page.tsx`, `components/analyze-wizard.tsx` and `components/dashboard/`.
- Reuse semantic success, warning and danger styles; do not communicate status by color alone.
- Preserve keyboard focus, dialog labels, table semantics and reduced-motion behavior.
- Do not import spreadsheet, chart or PDF libraries into the public landing bundle.

## Language changes

- English is defined as the first-visit default in `core/i18n/messages.ts`.
- User selection is saved under `smg-language` in localStorage.
- Add new reusable labels to the message dictionary rather than scattering conditionals.
- Financial source labels and exported column names should remain stable across languages.

## Server changes

- Validate every API input with Zod.
- Rate-limit authentication and payment mutations.
- Verify payment signatures and webhooks on the server.
- Make webhook writes idempotent before applying entitlement changes.
- Keep secrets in Cloudflare Worker secrets, never `NEXT_PUBLIC_*` variables.

## Website admin changes

- `/admin` is available only to signed-in accounts whose email or mobile is listed in `ADMIN_EMAILS` / `ADMIN_PHONES`.
- Public settings are validated by `core/site-settings.ts` and stored in the singleton D1 `site_settings` row.
- Keep Profit Check and account access permanent even when optional navigation items are hidden.
- Blank contact fields must stay hidden publicly; never add fake handles or phone numbers.
- Admin settings must never include raw report rows, order IDs, SKU names or seller financial values.

## Comments and documentation

- Write developer comments in English.
- Comment non-obvious safety boundaries, compatibility decisions and financial assumptions; do not narrate obvious syntax.
- Update `README.md` or the relevant file under `docs/` when a runtime dependency, provider flow or architectural boundary changes.
