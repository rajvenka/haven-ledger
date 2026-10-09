# Haven Pulse v2 - "Accounts" design (requirements)

Source: owner instructions across the project sessions + code review (Aug-Oct 2026).

## Product intent
- Salesforce / CRM-style record model: an **Account** is anything money is spent on or for -
  a person (Raj, Varun, Father, Mother) or a property ("4 Creswick") or other (Bank).
  Click an account -> see its bills, upcoming dues, and full expense history.
- Built as a separate, switchable design: every Pulse page gets a "Try new" toggle that flips
  between the current page and the new one, so the old design is never lost.
- Phase 1: Dashboard + Expenses. Later: Bills, History, Reports, Income.

## Data model (no schema change)
- Account = distinct `taggedFor` on recurring_payments / payment_history (blank = "Self").
- Account type (person/property/other) = heuristic + per-account override in localStorage.
- Bill state is derived: paid-this-period, next due date, overdue days (history-aware).

## UX requirements gathered from the owner
- Easy to scan; no stacks of always-visible filter rows; one search + a few smart views.
- Filters must be meaningful: Overdue, Next 7 days, Unpaid, **Paid this month**, Paused.
- Never silently hide data by default (Show = All by default).
- Non-monthly bills split: due **this month** vs **future** (collapsed) - do not show everything.
- One chip per currency (no duplicate currency rows).
- Section totals/subtotals per currency; money shown in summary currency with originals visible.
- Mobile-first: master list -> detail with back; desktop: two-pane master/detail.
- Record payment flow reuses the existing Record Payment modal.

## Engineering constraints
- Push straight to main (auto-deploys to Vercel). Fresh `git fetch` before push; a second AI
  channel also pushes to this repo.
- `npx tsc --noEmit` and `npx vite build` after each change; only the known baseline TS errors
  (PortfolioV1View dayCount / options comparison, brokerImport currency type) are tolerated.
- `git checkout -- src/buildTime.ts` before committing.
- Vercel Hobby: max 12 serverless functions - new backend logic goes in `api/_lib/`.
- Tailwind JIT: no dynamically-built class names.

## Phase 1 acceptance
- Toggle on Dashboard and Expenses flips old <-> new, remembered per browser.
- Dashboard: KPI strip, needs-attention list with Pay, account cards (click -> account),
  spend by account, recent activity.
- Expenses: account list (search, type filter) + record page (header, KPIs, Overview / Bills /
  History tabs), payments recordable from the page, type editable.
