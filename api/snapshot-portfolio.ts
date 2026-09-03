// Refreshes live prices for all holdings in the given currencies, then snapshots the
// (now-fresh) positions into portfolio_daily_positions - replaces the previous pg_cron-only
// flow, which just snapshotted whatever live_price happened to already be stored, without
// actively refreshing it first. pg_net (the Postgres HTTP extension) isn't installed on this
// project, so the database can't call out to Yahoo Finance directly - this orchestration
// happens here instead, reusing the same TypeScript price-fetch logic already relied on for
// manual/auto-refresh (api/_lib/yahoo-symbols.ts), rather than reimplementing it in SQL.
//
// Runs once per currency/timezone group (matching the six pg_cron schedules it replaces),
// triggered by Vercel Cron entries in vercel.json, each passing ?currencies=...&tz=... for
// its own group. Protected by CRON_SECRET, same pattern as api/daily-digest.ts.

import { createClient } from "@supabase/supabase-js";
import { resolveYahooSymbolCandidates, mapPool, fetchYahooPrice } from "./_lib/yahoo-symbols.js";

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = req.headers.authorization || "";
  const secret = process.env.CRON_SECRET || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const currenciesParam = String(req.query?.currencies || "");
  const timezone = String(req.query?.tz || "UTC");
  const currencies = currenciesParam.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  if (currencies.length === 0) {
    res.status(400).json({ error: "Provide ?currencies=USD,AUD&tz=Area/City" });
    return;
  }

  try {
    const sb = admin();

    // Step 1: refresh live prices for every active holding in these currencies, across
    // every workspace (matching the previous pg_cron jobs' p_workspace_id = null scope).
    // Mutual funds and options excluded from refresh entirely - same exclusion already
    // established elsewhere this session, since Yahoo has no reliable way to price them.
    const { data: holdings, error: fetchErr } = await sb
      .from("portfolio_holdings")
      .select("id, symbol, ticker, exchange, currency, holding_type")
      .in("currency", currencies)
      .eq("status", "active")
      .not("holding_type", "in", "(mutual_fund,options)");
    if (fetchErr) throw fetchErr;

    let refreshed = 0;
    let staleKept = 0;
    let skippedNoTicker = 0;

    await mapPool(holdings || [], 6, async (h: any) => {
      const symbol = h.ticker || h.symbol;
      if (!symbol) {
        skippedNoTicker++;
        return;
      }
      const { primary, fallbacks } = resolveYahooSymbolCandidates(symbol, h.exchange, h.currency);
      const tried = [primary, ...fallbacks];
      let result = await fetchYahooPrice(primary);
      if (result.rateLimited) {
        await new Promise((r) => setTimeout(r, 400));
        result = await fetchYahooPrice(primary);
      }
      if (result.price == null && !result.rateLimited) {
        for (const candidate of fallbacks) {
          const fallbackResult = await fetchYahooPrice(candidate);
          if (fallbackResult.price != null) {
            result = fallbackResult;
            break;
          }
        }
      }

      if (result.price != null) {
        const { error: updateErr } = await sb
          .from("portfolio_holdings")
          .update({
            live_price: result.price,
            previous_close: result.previousClose,
            price_stale: false,
          })
          .eq("id", h.id);
        if (!updateErr) refreshed++;
      } else {
        // Refresh failed for this specific holding - keep its existing live_price/
        // previous_close untouched (the "use the last refresh price" fallback requested),
        // just flag it as stale so the UI can show a delayed-price indicator.
        const { error: staleErr } = await sb
          .from("portfolio_holdings")
          .update({ price_stale: true })
          .eq("id", h.id);
        if (!staleErr) staleKept++;
      }
    });

    // Step 2: snapshot the now-refreshed positions - same RPC the pg_cron jobs called,
    // just guaranteed to run after prices are fresh instead of before.
    const { error: snapshotErr } = await sb.rpc("snapshot_portfolio_daily_positions", {
      p_workspace_id: null,
      p_currencies: currencies,
      p_timezone: timezone,
    });
    if (snapshotErr) throw snapshotErr;

    res.status(200).json({
      ok: true,
      currencies,
      timezone,
      holdingsConsidered: (holdings || []).length,
      refreshed,
      staleKept,
      skippedNoTicker,
    });
  } catch (error: any) {
    console.error("snapshot-portfolio error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error refreshing/snapshotting." });
  }
}
