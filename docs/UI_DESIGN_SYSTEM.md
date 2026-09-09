# UI Design System and UX Rules

This file is the handoff guide for future UI work. Keep the interface useful for Indian marketplace sellers who may be reading on a budget Android phone and may not know accounting terms.

## Product hierarchy

1. Show the money outcome first.
2. Explain whether that amount is reliable or still at risk.
3. Show the three actions worth doing first.
4. Keep detailed SKU, order and methodology tables available below the simple summary.
5. Never rename contribution to net profit unless fixed overhead and all required inputs are present.

## Language

- English is the default on a first visit.
- Hinglish is an optional switch and the choice is stored on the device. Keep English product/finance terms in Latin script, but write every Hindi word in Devanagari: `Payment file upload करो`, not `Payment file upload karo`.
- The font stack includes Android's Noto Sans Devanagari and Windows' Nirmala UI fallbacks; do not replace it with an English-only webfont.
- Prefer short seller language: “Money left after all known costs” is better than unexplained accounting jargon.
- Keep rupee amounts in Indian number formatting and use tabular numerals in financial tables.

## Visual language

- The page wallpaper uses minimal watercolor washes in blue, mint and violet with a very faint contour pattern. Keep it soft enough that text never competes with it.
- Use `.liquid-panel` for major cards, `.liquid-soft` for nested rows, `.liquid-pill` for segmented controls and `.glass-nav` for floating navigation.
- Use `.watercolor-flow` for the three-step explainer, `.watercolor-trust` for the privacy strip, `.receipt-panel`/`.receipt-row` for money math and `.navy-frost` for the ordered action plan.
- Frosted surfaces are deliberately near-opaque and blue-tinted. Do not return them to plain translucent white; that causes cards to disappear into the wallpaper.
- Use `.liquid-button` only for primary actions. Do not turn every element into glossy glass.
- Keep text on opaque or near-opaque surfaces. Do not place small grey text directly on a busy background.
- Green means source-backed positive/reliable, amber means attention or provisional, and red means loss/critical. Always pair colour with a label or icon.
- Minimum interactive target height is 44px. Important mobile actions should be 48–52px.

## Main screen pattern

The landing, analyzer and result screen use the same mental model:

1. Upload payment report.
2. Add product cost.
3. See clear actions.

The result screen uses a familiar receipt pattern: Payment received − Known costs = You keep. “You keep” is labelled Confirmed Contribution only for resolved rows. Pending/incomplete rows stay outside that receipt and appear as Still at Risk. Two compact At Risk/Loss cards are followed by the ordered “Today’s plan” list. Avoid four equal KPI cards because they make every number look equally important.

## Files to edit

| Change | Primary file |
| --- | --- |
| Global colour, glass and wallpaper | `app/globals.css` |
| Public navigation and language switch | `components/site-header.tsx` |
| Landing page and example result | `components/landing-page.tsx` |
| Upload/cost setup flow | `components/analyze-wizard.tsx` |
| Real result hierarchy and actions | `components/dashboard/dashboard.tsx` |
| Signed-in workspace shell | `components/account-workspace.tsx` |

## Safety rules for future developers

- Do not move parsing, XLSX, ZIP or PDF dependencies into the public landing bundle.
- Do not send raw uploaded files or normalized rows to a server to simplify UI work.
- Do not remove the Why? audit interaction from monetary metrics.
- Do not hide critical missing-cost warnings below charts or tables.
- Do not use Meesho pink, logos, testimonials, customer photos or visual cues that imply official affiliation.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` and `pnpm build` after UI changes.
