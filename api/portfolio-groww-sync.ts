// Groww Trade API sync.
// Auth: API Key + Secret → short-lived access token via SHA256 checksum.
// Holdings: GET /v1/holdings/user (stocks in DEMAT only — no MF holdings endpoint).
// Live data: GET /v1/live-data/ltp (batch LTP, up to 50 instruments per call).
//
// Actions:
//   exchange - exchanges apiKey + apiSecret for access_token
//   sync     - obtains a fresh token (or uses provided one) and fetches equity holdings
//   ltp      - batch last-traded prices for exchange_symbols (e.g. NSE_RELIANCE)

import * as crypto from "crypto";

const GROWW_BASE = "https://api.groww.in";

function generateChecksum(secret: string, timestamp: string): string {
  return crypto.createHash("sha256").update(secret + timestamp).digest("hex");
}

async function growwExchangeToken(apiKey: string, apiSecret: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const checksum = generateChecksum(apiSecret, timestamp);
  const resp = await fetch(`${GROWW_BASE}/v1/token/api/access`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-API-VERSION": "1.0",
    },
    body: JSON.stringify({
      key_type: "approval",
      checksum,
      timestamp,
    }),
  });
  const text = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return {
    ok: resp.ok,
    status: resp.status,
    data,
    bodySample: text.slice(0, 800),
    accessToken:
      data?.token ||
      data?.access_token ||
      data?.payload?.token ||
      data?.payload?.access_token ||
      data?.data?.token ||
      data?.data?.access_token ||
      null,
  };
}

async function growwGet(path: string, accessToken: string) {
  const resp = await fetch(`${GROWW_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "X-API-VERSION": "1.0",
    },
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

/** Resolve a usable access token: prefer fresh exchange when key+secret present. */
async function resolveAccessToken(
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  debug: any
): Promise<{ accessToken: string | null; error?: string; status?: number }> {
  if (apiKey && apiSecret) {
    const tokenResult = await growwExchangeToken(apiKey, apiSecret);
    debug.tokenExchange = {
      status: tokenResult.status,
      ok: tokenResult.ok,
      bodySample: tokenResult.bodySample,
    };
    if (tokenResult.ok && tokenResult.accessToken) {
      return { accessToken: tokenResult.accessToken };
    }
    if (!accessToken) {
      return {
        accessToken: null,
        status: tokenResult.status || 401,
        error:
          tokenResult.data?.error?.message ||
          tokenResult.data?.message ||
          "Failed to obtain Groww access token. Approve the API key for today on Groww Cloud, then retry.",
      };
    }
  }
  if (!accessToken) {
    return { accessToken: null, status: 400, error: "No access token available" };
  }
  return { accessToken };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const action = body.action || "sync";

    // ---------- exchange apiKey+secret → access_token ----------
    if (action === "exchange") {
      const apiKey = String(body.apiKey || "").trim();
      const apiSecret = String(body.apiSecret || "").trim();
      if (!apiKey || !apiSecret) {
        res.status(400).json({ error: "apiKey and apiSecret are required" });
        return;
      }
      const result = await growwExchangeToken(apiKey, apiSecret);
      if (!result.ok || !result.accessToken) {
        res.status(result.status || 400).json({
          error:
            result.data?.error?.message ||
            result.data?.message ||
            result.data?.error_message ||
            "Token exchange failed. Ensure API Key is approved today on Groww Cloud.",
          details: result.data,
          bodySample: result.bodySample,
        });
        return;
      }
      res.status(200).json({
        accessToken: result.accessToken,
        raw: result.data,
      });
      return;
    }

    // ---------- live LTP (batch, up to 50 instruments per Groww call) ----------
    // Body: { action: 'ltp', apiKey?, apiSecret?, accessToken?, instruments: string[] }
    // instruments: trading symbols like "RELIANCE" or "NSE:RELIANCE" or "NSE_RELIANCE"
    // Returns: { prices: { "NSE_RELIANCE": 2334.2, ... }, accessToken, debug }
    if (action === "ltp") {
      const apiKey = String(body.apiKey || "").trim();
      const apiSecret = String(body.apiSecret || "").trim();
      let accessToken = String(body.accessToken || "").trim();
      const rawInstruments: string[] = Array.isArray(body.instruments) ? body.instruments : [];

      if (!apiKey && !accessToken) {
        res.status(400).json({ error: "apiKey (with apiSecret) or accessToken is required" });
        return;
      }
      if (rawInstruments.length === 0) {
        res.status(200).json({ prices: {}, matchedCount: 0 });
        return;
      }

      const debug: any = { startedAt: new Date().toISOString(), requestedCount: rawInstruments.length };
      const resolved = await resolveAccessToken(apiKey, apiSecret, accessToken, debug);
      if (!resolved.accessToken) {
        res.status(resolved.status || 401).json({ error: resolved.error, debug });
        return;
      }
      accessToken = resolved.accessToken;

      // Normalise to Groww exchange_symbols form: NSE_RELIANCE / BSE_SENSEX
      const toGrowwKey = (raw: string): string => {
        const s = String(raw || "").trim().toUpperCase();
        if (!s) return "";
        if (s.includes("_") && (s.startsWith("NSE_") || s.startsWith("BSE_"))) return s;
        if (s.includes(":")) {
          const [ex, sym] = s.split(":");
          return `${ex === "BSE" ? "BSE" : "NSE"}_${sym}`;
        }
        // Bare ticker → assume NSE (matches most India holdings)
        return `NSE_${s}`;
      };

      const keys = rawInstruments.map(toGrowwKey).filter(Boolean);
      const prices: Record<string, number> = {};
      // Groww allows up to 50 symbols per LTP call
      const chunkSize = 50;
      for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize);
        const qs = new URLSearchParams();
        qs.set("segment", "CASH");
        // Docs show exchange_symbols as repeated / comma-separated list
        qs.set("exchange_symbols", chunk.join(","));
        const path = `/v1/live-data/ltp?${qs.toString()}`;
        let ltpResp = await growwGet(path, accessToken);
        debug[`ltpChunk${i / chunkSize}`] = {
          status: ltpResp.status,
          ok: ltpResp.ok,
          bodySample: ltpResp.bodySample,
          requested: chunk,
        };

        // Stale token → re-exchange once and retry this chunk
        if (!ltpResp.ok && (ltpResp.status === 401 || ltpResp.status === 403) && apiKey && apiSecret) {
          const retry = await growwExchangeToken(apiKey, apiSecret);
          debug.tokenRetry = { status: retry.status, ok: retry.ok };
          if (retry.ok && retry.accessToken) {
            accessToken = retry.accessToken;
            ltpResp = await growwGet(path, accessToken);
            debug[`ltpChunk${i / chunkSize}Retry`] = {
              status: ltpResp.status,
              ok: ltpResp.ok,
              bodySample: ltpResp.bodySample,
            };
          }
        }

        if (!ltpResp.ok) {
          // Don't abort the whole batch — return whatever we have so far; caller falls back to Yahoo
          continue;
        }

        const payload = ltpResp.data?.payload ?? ltpResp.data?.data ?? ltpResp.data ?? {};
        // payload is typically { "NSE_RELIANCE": 2334.2, ... }
        for (const [k, v] of Object.entries(payload)) {
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) {
            prices[k.toUpperCase()] = n;
          }
        }
      }

      res.status(200).json({
        prices,
        matchedCount: Object.keys(prices).length,
        accessToken,
        debug,
      });
      return;
    }

    // ---------- sync holdings ----------
    if (action === "sync") {
      const apiKey = String(body.apiKey || "").trim();
      const apiSecret = String(body.apiSecret || "").trim();
      let accessToken = String(body.accessToken || "").trim();

      if (!apiKey && !accessToken) {
        res.status(400).json({ error: "apiKey (with apiSecret) or accessToken is required" });
        return;
      }

      const debug: any = { startedAt: new Date().toISOString() };

      const resolved = await resolveAccessToken(apiKey, apiSecret, accessToken, debug);
      if (!resolved.accessToken) {
        res.status(resolved.status || 401).json({ error: resolved.error, debug });
        return;
      }
      accessToken = resolved.accessToken;

      const holdingsResp = await growwGet("/v1/holdings/user", accessToken);
      debug.holdings = {
        status: holdingsResp.status,
        ok: holdingsResp.ok,
        bodySample: holdingsResp.bodySample,
      };

      // If stored token is stale and we still have key+secret, retry once after re-exchange.
      if (!holdingsResp.ok && (holdingsResp.status === 401 || holdingsResp.status === 403) && apiKey && apiSecret) {
        const retryToken = await growwExchangeToken(apiKey, apiSecret);
        debug.tokenRetry = { status: retryToken.status, ok: retryToken.ok };
        if (retryToken.ok && retryToken.accessToken) {
          accessToken = retryToken.accessToken;
          const retryHoldings = await growwGet("/v1/holdings/user", accessToken);
          debug.holdingsRetry = {
            status: retryHoldings.status,
            ok: retryHoldings.ok,
            bodySample: retryHoldings.bodySample,
          };
          if (retryHoldings.ok) {
            Object.assign(holdingsResp, retryHoldings);
          }
        }
      }

      if (!holdingsResp.ok) {
        res.status(holdingsResp.status || 502).json({
          error:
            holdingsResp.data?.error?.message ||
            holdingsResp.data?.message ||
            "Failed to fetch Groww holdings. Token may have expired or API key needs daily approval.",
          debug,
        });
        return;
      }

      // Response shapes seen in the wild:
      //   { status, payload: { holdings: [...] } }
      //   { holdings: [...] }
      //   { data: { holdings: [...] } }
      const payload = holdingsResp.data?.payload ?? holdingsResp.data?.data ?? holdingsResp.data ?? {};
      const rawHoldings: any[] = Array.isArray(payload?.holdings)
        ? payload.holdings
        : Array.isArray(payload)
          ? payload
          : [];
      debug.holdings.count = rawHoldings.length;

      const holdings = rawHoldings
        .map((h) => {
          const qty =
            Number(h.quantity ?? 0) +
            Number(h.t1_quantity ?? 0);
          // Prefer free/available qty when present; fall back to net quantity.
          const freeQty = Number(h.demat_free_quantity);
          const effectiveQty = Number.isFinite(freeQty) && freeQty > 0 ? freeQty : qty;
          if (effectiveQty <= 0) return null;

          const avg = Number(h.average_price || 0);
          const symbol = String(h.trading_symbol || h.tradingsymbol || h.symbol || "").toUpperCase();
          if (!symbol) return null;

          return {
            symbol,
            name: symbol,
            broker: "Groww",
            holdingType: "stock" as const,
            exchange: String(h.exchange || "NSE"),
            quantity: effectiveQty,
            buyPrice: avg,
            currentPrice: avg, // Groww holdings endpoint does not return LTP
            currency: "INR",
            isin: h.isin || undefined,
            source: "Groww API",
            matchKey: `groww_${h.isin || symbol}`,
          };
        })
        .filter(Boolean);

      res.status(200).json({
        holdings,
        equityCount: holdings.length,
        mfCount: 0,
        positionCount: 0,
        accessToken, // return so UI can persist refreshed token
        syncedAt: new Date().toISOString(),
        debug,
        note: "Groww API returns stock holdings only. Mutual funds remain on the CSV import path.",
      });
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error("Groww sync error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error syncing from Groww." });
  }
}
