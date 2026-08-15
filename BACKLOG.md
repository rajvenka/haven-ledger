# Haven Ledger — Backlog

## Market-hours default portfolio (smart book on open)

**Status:** Backlog · not started  
**Area:** Portfolio Pulse + Classic  
**Requested:** 2026-08-14

### Idea
When the user opens Portfolio, **pre-select the book that matches the market session active in their local timezone** (instead of always defaulting to workspace default / last used). User can still change book manually; this is only the *initial* pick.

### Example schedule (user local time — Melbourne / AU)

| Local time window | Prefer book(s) | Rationale |
|-------------------|----------------|-----------|
| ~10:00–16:00 | Stake AU / ASX books | ASX cash session |
| ~16:00–20:00 (or until India close) | India books (Zerodha, Groww, INR) | NSE/BSE overlap after ASX |
| US session evenings (e.g. ~23:30–06:00 next day, or 00:00–07:00) | Webull / eToro / Moomoo / Tiger / USD books | US cash hours in AU time |
| Outside windows | Workspace default or last-selected book | Fallback |

Exact clocks should be **configurable** (not hard-coded only to AU), using IANA timezone of the user/workspace.

### Design notes
- Resolve **user/workspace timezone** (browser `Intl` or workspace setting).
- Map each portfolio book → market region tag: `AU` | `IN` | `US` | `MULTI` (from currency, broker connection, or explicit book tag).
- On first load of Portfolio tab only (do not fight user if they already switched book this session).
- Optional: remember “last manual book” for the day and prefer it over auto if user overrode once.
- Pulse and Classic should share the same helper (e.g. `getMarketDefaultPortfolioId(...)`).
- Do **not** change holdings data — selection only.

### Acceptance
- [ ] Opening Portfolio during ASX hours lands on an AU-tagged book when one exists.
- [ ] Opening during India session prefers INR/India-tagged books.
- [ ] Opening during US session prefers USD/US-broker books.
- [ ] Manual book change is never overwritten mid-session.
- [ ] Fallback to current default-portfolio behaviour when no matching book.

### Out of scope (for later)
- Auto-sync on open for that market’s broker.
- Per-user custom hour ranges UI (v1 can ship sensible AU defaults + region tags).

## Vercel MCP not connected to the account that owns haven-ledger

**Status:** Backlog · not started
**Area:** Infra / tooling (Vercel access for AI agents)
**Requested:** 2026-08-15

### Issue
The Vercel MCP connector available in this environment can only see one team (`havenvalut`), and `list_projects` under that team returns zero projects. Direct lookups for `haven-ledger` / `haven-vault` under that team both 404. Meanwhile the Supabase MCP connects fine and correctly resolves the `haven-ledger` Supabase project (`kvyegcurnwntykqmwrzs`, ap-southeast-2).

This means whichever Vercel account is linked to this session is not the account that actually owns the `haven-ledger` Vercel project / deployment (`haven-ledger.vercel.app`). As a result, an AI agent working in this environment cannot read or set Vercel env vars, inspect deployments, or pull runtime logs/errors for this project — all of that currently has to be done manually in the Vercel dashboard.

### Trigger
Came up while diagnosing the "Preview today's digest" `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY` error (api/daily-digest.ts / api/whatsapp-webhook.ts admin() check) — env vars were fixed manually in the dashboard since the MCP tool couldn't confirm or set them.

### Fix
- Confirm which Vercel account/team `haven-ledger` actually lives under (dashboard → Project Settings).
- Reconnect/re-authorize the Vercel MCP integration to that account.
- Re-verify `list_projects` / `get_project` resolve `haven-ledger` afterward.

### Acceptance
- [ ] Vercel MCP `list_projects` shows `haven-ledger`.
- [ ] Can read env var names (not just values) and deployment/runtime logs for `haven-ledger` via MCP.
