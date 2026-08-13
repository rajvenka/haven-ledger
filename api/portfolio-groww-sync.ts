// Groww Trade API sync (stocks only).
// Auth: API Key + Secret → access token via checksum (SHA256 of secret + timestamp).
// MF is NOT available on Groww Trade API — keep using CSV import (groww_mf).
//
// Actions:
//   exchange - api_key + api_secret → access_token
//   sync     - fetch stock holdings (auto-refreshes token if needed)

import * as crypto from "crypto";

const GROWW_BASE = "https://api.groww.in";

function generateChecksum(secret: string, timestamp: string): string {
  return crypto.createHash("sha256").update(secret + timestamp, "utf-8").digest("hex");
}

async function growwFetch(path: string, accessToken: string, method: "GET" | "POST" = "GET", body?: any) {
  const resp = await fetch(`${GROWW_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-API-VERSION": "1.0",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { ok: resp.ok, status: resp.status, data, bodySample: text.slice(0, 800) };
}

async function exchangeToken(apiKey: string, apiSecret: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const checksum = generateChecksum(apiSecret, timestamp);
  const resp = await fetch(`${GROWW_BASE}/v1/token/api/access`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      key_type: "approval",
      checksum,
      timestamp,
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      ok: false as const,
      status: resp.status,
      error: data?.message || data?.error || data?.payload?.message || "Token exchange failed",
      details: data,
    };
  }
  // Response shapes vary slightly across SDK/docs — accept common fields
  const token =
    data?.token ||
    data?.access_token ||
    data?.payload?.token ||
    data?.payload?.access_token ||
    data?.data?.token ||
    data?.data?.access_token;
  if (!token) {
    return {
      ok: false as const,
      status: 400,
      error: "No access_token in Groww response",
      details: data,
    };
  }
  return {
    ok: true as const,
    accessToken: String(token),
    expiresAt: data?.expiry || data?.expires_at || data?.payload?.expiry || null,
    raw: data,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const action = body.action || "sync";

    // ---------- exchange: api_key + api_secret → access_token ----------
    if (action === "exchange") {
      const apiKey = String(body.apiKey || "").trim();
      const apiSecret = String(body.apiSecret || "").trim();
      if (!apiKey || !apiSecret) {
        res.status(400).json({ error: "apiKey and apiSecret are required" });
        return;
      }
      const result = await exchangeToken(apiKey, apiSecret);
      if (!result.ok) {
        res.status(result.status || 400).json({
          error: result.error,
          details: result.details,
        });
        return;
      }
      res.status(200).json({
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
      });
      return;
    }

    // ---------- sync holdings (stocks only) ----------
    if (action === "sync") {
      const apiKey = String(body.apiKey || "").trim();
      const apiSecret = String(body.apiSecret || "").trim();
      let accessToken = String(body.accessToken || "").trim();
      const debug: any = { startedAt: new Date().toISOString() };

      if (!apiKey || !apiSecret) {
        res.status(400).json({ error: "apiKey and apiSecret are required" });
        return;
      }

      // Always prefer a fresh token when secret is available (tokens expire daily ~6 AM)
      if (apiSecret) {
        const exchanged = await exchangeToken(apiKey, apiSecret);
        debug.tokenExchange = {
          ok: exchanged.ok,
          status: exchanged.ok ? 200 : exchanged.status,
          error: exchanged.ok ? null : exchanged.error,
        };
        if (exchanged.ok) {
          accessToken = exchanged.accessToken;
        } else if (!accessToken) {
          res.status(exchanged.status || 401).json({
            error: exchanged.error || "Could not obtain Groww access token",
            debug,
          });
          return;
        }
      }

      if (!accessToken) {
        res.status(400).json({ error: "accessToken is required (or provide apiSecret to auto-generate)" });
        return;
      }

      const holdingsResp = await growwFetch("/v1/holdings/user", accessToken);
      debug.holdings = {
        status: holdingsResp.status,
        ok: holdingsResp.ok,
        bodySample: holdingsResp.bodySample,
      };

      if (!holdingsResp.ok) {
        // Retry once with a fresh token if we have secret
        if (apiSecret && holdingsResp.status === 401) {
          const exchanged = await exchangeToken(apiKey, apiSecret);
          debug.tokenRetry = { ok: exchanged.ok };
          if (exchanged.ok) {
            accessToken = exchanged.accessToken;
            const retry = await growwFetch("/v1/holdings/user", accessToken);
            debug.holdingsRetry = { status: retry.status, ok: retry.ok, bodySample: retry.bodySample };
            if (retry.ok) {
              Object.assign(holdingsResp, retry);
            }
          }
        }
      }

      if (!holdingsResp.ok) {
        res.status(holdingsResp.status || 502).json({
          error:
            holdingsResp.data?.message ||
            holdingsResp.data?.error ||
            "Failed to fetch Groww holdings. Check API key/secret or regenerate token.",
          debug,
          accessToken: accessToken || undefined, // return refreshed token so client can persist it
        });
        return;
      }

      const payload = holdingsResp.data?.payload ?? holdingsResp.data;
      const rawHoldings: any[] = Array.isArray(payload?.holdings)
        ? payload.holdings
        : Array.isArray(payload)
          ? payload
          : Array.isArray(holdingsResp.data)
            ? holdingsResp.data
            : [];
      debug.holdings.count = rawHoldings.length;

      const holdings = rawHoldings
        .map((h) => {
          const qty =
            Number(h.quantity || 0) +
            Number(h.t1_quantity || 0);
          // Prefer free+locked total; fall back to quantity fields Groww documents
          const totalQty =
            qty > 0
              ? qty
              : Number(h.demat_free_quantity || 0) +
                Number(h.groww_locked_quantity || 0) +
                Number(h.demat_locked_quantity || 0) +
                Number(h.pledge_quantity || 0);
          if (totalQty <= 0) return null;
          const avg = Number(h.average_price || h.averagePrice || 0);
          const symbol = String(h.trading_symbol || h.tradingSymbol || h.symbol || "").toUpperCase();
          if (!symbol) return null;
          return {
            symbol,
            name: symbol,
            broker: "Groww",
            holdingType: "stock" as const,
            exchange: "NSE",
            quantity: totalQty,
            buyPrice: avg,
            currentPrice: avg, // holdings endpoint does not return LTP; refresh prices separately
            currency: "INR",
            isin: h.isin || undefined,
            source: "Groww",
            matchKey: `groww_${h.isin || symbol}`,
          };
        })
        .filter(Boolean);

      res.status(200).json({
        holdings,
        equityCount: holdings.length,
        mfCount: 0,
        note: "Groww Trade API returns stocks only. Import mutual funds via CSV (groww_mf).",
        syncedAt: new Date().toISOString(),
        accessToken, // client should persist refreshed token
        debug,
      });
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error("Groww sync error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error syncing from Groww." });
  }
}
