// Zerodha Kite Connect sync.
// Auth is different from eToro/Webull: access_token is daily and obtained via login redirect
// (or by pasting a request_token). This route never stores the user's Zerodha password.
//
// Actions:
//   login_url  - returns the Kite login URL for the given api_key
//   exchange   - exchanges request_token + api_secret for access_token
//   sync       - fetches equity holdings (+ optional MF) using stored access_token

import * as crypto from "crypto";

const KITE_BASE = "https://api.kite.trade";
const KITE_LOGIN = "https://kite.zerodha.com/connect/login";

async function kiteGet(path: string, apiKey: string, accessToken: string) {
  const resp = await fetch(`${KITE_BASE}${path}`, {
    headers: {
      "X-Kite-Version": "3",
      Authorization: `token ${apiKey}:${accessToken}`,
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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const action = body.action || "sync";

    // ---------- login_url ----------
    if (action === "login_url") {
      const apiKey = String(body.apiKey || "").trim();
      if (!apiKey) {
        res.status(400).json({ error: "apiKey is required" });
        return;
      }
      const url = `${KITE_LOGIN}?v=3&api_key=${encodeURIComponent(apiKey)}`;
      res.status(200).json({ loginUrl: url });
      return;
    }

    // ---------- exchange request_token → access_token ----------
    if (action === "exchange") {
      const apiKey = String(body.apiKey || "").trim();
      const apiSecret = String(body.apiSecret || "").trim();
      const requestToken = String(body.requestToken || "").trim();
      if (!apiKey || !apiSecret || !requestToken) {
        res.status(400).json({ error: "apiKey, apiSecret and requestToken are required" });
        return;
      }
      const checksum = crypto
        .createHash("sha256")
        .update(apiKey + requestToken + apiSecret)
        .digest("hex");
      const form = new URLSearchParams({
        api_key: apiKey,
        request_token: requestToken,
        checksum,
      });
      const resp = await fetch(`${KITE_BASE}/session/token`, {
        method: "POST",
        headers: { "X-Kite-Version": "3", "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.status === "error") {
        res.status(resp.status || 400).json({
          error: data?.message || data?.error_type || "Token exchange failed",
          details: data,
        });
        return;
      }
      const accessToken = data?.data?.access_token;
      if (!accessToken) {
        res.status(400).json({ error: "No access_token in response", details: data });
        return;
      }
      res.status(200).json({
        accessToken,
        userId: data?.data?.user_id ?? null,
        userName: data?.data?.user_name ?? null,
        loginTime: data?.data?.login_time ?? null,
      });
      return;
    }

    // ---------- sync holdings ----------
    if (action === "sync") {
      const apiKey = String(body.apiKey || "").trim();
      const accessToken = String(body.accessToken || "").trim();
      const includeMf = body.includeMf !== false;
      if (!apiKey || !accessToken) {
        res.status(400).json({ error: "apiKey and accessToken are required" });
        return;
      }

      const debug: any = { startedAt: new Date().toISOString() };

      const holdingsResp = await kiteGet("/portfolio/holdings", apiKey, accessToken);
      debug.holdings = {
        status: holdingsResp.status,
        ok: holdingsResp.ok,
        bodySample: holdingsResp.bodySample,
      };
      if (!holdingsResp.ok) {
        res.status(holdingsResp.status || 502).json({
          error:
            holdingsResp.data?.message ||
            "Failed to fetch Zerodha holdings. Access token may have expired — reconnect.",
          debug,
        });
        return;
      }

      const rawHoldings: any[] = Array.isArray(holdingsResp.data?.data)
        ? holdingsResp.data.data
        : [];
      debug.holdings.count = rawHoldings.length;

      const holdings = rawHoldings
        .map((h) => {
          const qty =
            Number(h.quantity || 0) +
            Number(h.t1_quantity || 0) +
            Number(h.used_quantity || 0) +
            Number(h?.mtf?.quantity || 0);
          if (qty <= 0) return null;
          const avg = Number(h.average_price || 0);
          const lastPrice = Number(h.last_price || 0);
          return {
            symbol: String(h.tradingsymbol || "").toUpperCase(),
            name: String(h.tradingsymbol || ""),
            broker: "Zerodha",
            holdingType: "stock" as const,
            exchange: String(h.exchange || "NSE"),
            quantity: qty,
            buyPrice: avg,
            currentPrice: lastPrice > 0 ? lastPrice : avg,
            currency: "INR",
            isin: h.isin || undefined,
            source: "Zerodha API",
            matchKey: `zerodha_${h.exchange || "NSE"}_${h.tradingsymbol}`,
          };
        })
        .filter(Boolean);

      let mfHoldings: any[] = [];
      if (includeMf) {
        const mfResp = await kiteGet("/mf/holdings", apiKey, accessToken);
        debug.mf = { status: mfResp.status, ok: mfResp.ok, bodySample: mfResp.bodySample };
        if (mfResp.ok) {
          const rawMf: any[] = Array.isArray(mfResp.data?.data) ? mfResp.data.data : [];
          debug.mf.count = rawMf.length;
          mfHoldings = rawMf
            .map((m) => {
              const qty = Number(m.quantity || 0);
              if (qty <= 0) return null;
              const avg = Number(m.average_price || 0);
              const lastPrice = Number(m.last_price || 0);
              return {
                symbol: String(m.tradingsymbol || m.folio || "").toUpperCase(),
                name: String(m.fund || m.tradingsymbol || ""),
                broker: "Zerodha",
                holdingType: "mutual_fund" as const,
                exchange: "MF",
                quantity: qty,
                buyPrice: avg,
                currentPrice: lastPrice > 0 ? lastPrice : avg,
                currency: "INR",
                isin: m.isin || undefined,
                source: "Zerodha API (MF)",
                matchKey: `zerodha_mf_${m.tradingsymbol || m.folio}`,
              };
            })
            .filter(Boolean);
        }
      }

      // Optional day positions (intraday / F&O net) — included as stock rows tagged by product
      const posResp = await kiteGet("/portfolio/positions", apiKey, accessToken);
      debug.positions = { status: posResp.status, ok: posResp.ok };
      let positionHoldings: any[] = [];
      if (posResp.ok) {
        const net: any[] = Array.isArray(posResp.data?.data?.net) ? posResp.data.data.net : [];
        debug.positions.netCount = net.length;
        positionHoldings = net
          .map((p) => {
            const qty = Number(p.quantity || 0);
            if (qty === 0) return null;
            const avg = Number(p.average_price || 0);
            const lastPrice = Number(p.last_price || 0);
            return {
              symbol: String(p.tradingsymbol || "").toUpperCase(),
              name: String(p.tradingsymbol || ""),
              broker: "Zerodha",
              holdingType: "stock" as const,
              exchange: String(p.exchange || "NFO"),
              quantity: Math.abs(qty),
              buyPrice: avg,
              currentPrice: lastPrice > 0 ? lastPrice : avg,
              currency: "INR",
              source: `Zerodha Position (${p.product || "NRML"})`,
              matchKey: `zerodha_pos_${p.exchange}_${p.tradingsymbol}_${p.product}`,
            };
          })
          .filter(Boolean);
      }

      res.status(200).json({
        holdings: [...holdings, ...mfHoldings, ...positionHoldings],
        equityCount: holdings.length,
        mfCount: mfHoldings.length,
        positionCount: positionHoldings.length,
        syncedAt: new Date().toISOString(),
        debug,
      });
      return;
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error("Zerodha sync error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error syncing from Zerodha." });
  }
}
