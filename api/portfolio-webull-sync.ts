// Syncs real account holdings from Webull's official Trading API (app_key/app_secret,
// individual/own-account model - same pattern as eToro, not the OAuth Connect API meant for
// registered third-party platforms). Credentials are passed in from the client per-request,
// same reasoning as the eToro route - this app has no service-role-key pattern anywhere.
//
// Two things are genuinely verified, not guessed: the HMAC-SHA1 request-signing algorithm
// (tested byte-for-byte against Webull's own documented worked example - exact match on
// both the canonical string and final signature) and the REST paths/response schema for
// account list and positions (confirmed directly from Webull's own API reference docs).
//
// One thing is NOT fully verified: the exact field names for the token/2FA endpoints
// (POST /auth/tokens/create, POST /auth/tokens/check) - the docs pages for these render
// their schema tables client-side in a way this route's docs research couldn't access.
// Built from the general description (create returns token/expiration/status, status
// defaults to "pending verification", polled via check until verified) with defensive
// fallbacks across several plausible field-name variants, and instrumentDebug included in
// every response so the first real connection attempt shows exactly what Webull actually
// returns rather than failing silently - same approach that successfully diagnosed and
// fixed several real eToro field-name mismatches earlier in this project.

import * as crypto from "crypto";

// Confirmed production hosts for the SDK's known regions - "us" is the one actually in use
// here. Sandbox is "api.sandbox.webull.com". If a person's actual host differs, this will
// surface as a clear connection-failure error rather than a silent wrong-region call.
const REGION_HOSTS: Record<string, string> = {
  us: "api.webull.com",
  au: "api.webull.com.au",
  jp: "api.webull.co.jp",
  hk: "api.webull.hk",
  my: "api.webull.com.my",
};

function timestampISO() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function nonce() {
  return crypto.randomBytes(16).toString("hex");
}

// Verified byte-for-byte against Webull's own documented worked example earlier this
// project - not a guess. Sorts query params + specific headers together, concatenates as
// "{uri}&k1=v1&k2=v2...", appends the body's uppercase MD5 hex if a body is present,
// URL-encodes the whole thing, then HMAC-SHA1s it with (appSecret + "&") as the key,
// base64-encoded.
function signRequest(uri: string, queryParams: Record<string, string>, host: string, appKey: string, appSecret: string, ts: string, nonceVal: string, body?: string) {
  const headers: Record<string, string> = {
    "x-app-key": appKey,
    "x-timestamp": ts,
    "x-signature-version": "1.0",
    "x-signature-algorithm": "HMAC-SHA1",
    "x-signature-nonce": nonceVal,
    host,
  };
  const allParams: Record<string, string> = { ...queryParams, ...headers };
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys.map((k) => `${k}=${allParams[k]}`).join("&");
  let sourceParam = `${uri}&${paramString}`;
  if (body && body.length > 0) {
    const bodyMd5 = crypto.createHash("md5").update(body).digest("hex").toUpperCase();
    sourceParam += `&${bodyMd5}`;
  }
  const encoded = encodeURIComponent(sourceParam);
  const signature = crypto.createHmac("sha1", appSecret + "&").update(encoded).digest("base64");
  return { signature, headers };
}

async function webullFetch(path: string, method: "GET" | "POST", host: string, appKey: string, appSecret: string, token?: string, queryParams: Record<string, string> = {}, body?: any) {
  const ts = timestampISO();
  const nonceVal = nonce();
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const { signature, headers } = signRequest(path, queryParams, host, appKey, appSecret, ts, nonceVal, bodyStr);
  const qs = Object.keys(queryParams).length > 0 ? "?" + new URLSearchParams(queryParams).toString() : "";
  const resp = await fetch(`https://${host}${path}${qs}`, {
    method,
    headers: {
      ...headers,
      "x-signature": signature,
      "Content-Type": "application/json",
      ...(token ? { "x-access-token": token } : {}),
    },
    body: bodyStr,
  });
  return resp;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { action, appKey, appSecret, region, tokenId, token } = req.body || {};
    if (!appKey || !appSecret) {
      res.status(400).json({ error: "Missing Webull App Key / App Secret." });
      return;
    }
    const host = REGION_HOSTS[region] || REGION_HOSTS.us;

    if (action === "connect") {
      // The confirmed-working account endpoints (account/list, account/positions) both use
      // an /openapi prefix, but the token endpoints' exact path couldn't be confirmed from
      // Webull's JS-rendered docs or a GitHub source search. Tries the documented-looking
      // path first, falls back to the /openapi-prefixed variant automatically on a 404 -
      // whichever actually works, the debug output shows which one succeeded.
      const tokenPaths = ["/auth/tokens/create", "/openapi/auth/tokens/create"];
      let createResp: Response | null = null;
      let createBody = "";
      let usedPath = "";
      for (const path of tokenPaths) {
        const resp = await webullFetch(path, "POST", host, appKey, appSecret);
        if (resp.status !== 404) {
          createResp = resp;
          createBody = await resp.text().catch(() => "");
          usedPath = path;
          break;
        }
        createResp = resp;
        usedPath = path;
      }
      let parsed: any = null;
      try { parsed = JSON.parse(createBody); } catch { /* not json */ }
      res.status(200).json({
        status: createResp!.ok ? "pending_verification" : "create_failed",
        tokenId: parsed?.token_id ?? parsed?.tokenId ?? parsed?.id ?? null,
        rawStatus: parsed?.status ?? null,
        debug: { httpStatus: createResp!.status, ok: createResp!.ok, body: createBody.slice(0, 500), host, pathTried: usedPath },
      });
      return;
    }

    if (action === "check") {
      const tokenPaths = ["/auth/tokens/check", "/openapi/auth/tokens/check"];
      let checkResp: Response | null = null;
      let checkBody = "";
      for (const path of tokenPaths) {
        const resp = await webullFetch(path, "POST", host, appKey, appSecret, undefined, {}, { token_id: tokenId });
        if (resp.status !== 404) {
          checkResp = resp;
          checkBody = await resp.text().catch(() => "");
          break;
        }
        checkResp = resp;
      }
      let parsed: any = null;
      try { parsed = JSON.parse(checkBody); } catch { /* not json */ }
      const status = parsed?.status ?? parsed?.token_status ?? null;
      const verified = status === "verified" || status === "VERIFIED" || status === "success" || status === "NORMAL";
      res.status(200).json({
        verified,
        token: verified ? (parsed?.token ?? parsed?.access_token ?? null) : null,
        expiresAt: parsed?.expire_time ?? parsed?.expires_at ?? null,
        debug: { httpStatus: checkResp!.status, ok: checkResp!.ok, body: checkBody.slice(0, 500) },
      });
      return;
    }

    if (action === "sync") {
      const listResp = await webullFetch("/openapi/account/list", "GET", host, appKey, appSecret, token);
      if (!listResp.ok) {
        const body = await listResp.text().catch(() => "");
        res.status(listResp.status).json({ error: `Webull account list returned ${listResp.status}. ${body.slice(0, 300)}`, debug: { host } });
        return;
      }
      const listData = await listResp.json();
      const accounts: any[] = Array.isArray(listData) ? listData : (listData?.items ?? listData?.accounts ?? listData?.data ?? []);
      const accountDebug: any = { listRaw: JSON.stringify(listData).slice(0, 500), accountCount: accounts.length };

      const holdings: any[] = [];
      const rawPositionsDebug: any[] = [];
      for (const acct of accounts) {
        const accountId = acct.account_id ?? acct.accountId ?? acct.id;
        if (!accountId) continue;
        const posResp = await webullFetch("/openapi/account/positions", "GET", host, appKey, appSecret, token, { account_id: String(accountId) });
        if (!posResp.ok) continue;
        const posData = await posResp.json();
        rawPositionsDebug.push({ accountId, raw: JSON.stringify(posData).slice(0, 500) });
        const items: any[] = posData?.items ?? posData?.positions ?? [];
        for (const item of items) {
          const qty = Number(item.quantity) || 0;
          const costPrice = Number(item.cost_price ?? item.costPrice) || 0;
          const unrealizedPL = Number(item.unrealized_profit_loss ?? item.unrealizedProfitLoss) || 0;
          const currentPrice = qty > 0 ? costPrice + unrealizedPL / qty : costPrice;
          if (qty <= 0) continue;
          holdings.push({
            symbol: item.symbol ?? item.instrument_id ?? item.instrumentId,
            broker: "Webull",
            holdingType: "stock" as const,
            exchange: "Webull",
            quantity: qty,
            buyPrice: costPrice,
            currentPrice,
            currency: "USD",
            source: `Webull ${region || "us"}`,
          });
        }
      }

      res.status(200).json({ holdings, accountDebug, rawPositionsDebug });
      return;
    }

    res.status(400).json({ error: "Unknown action. Expected 'connect', 'check', or 'sync'." });
  } catch (error: any) {
    console.error("Webull sync error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error syncing from Webull." });
  }
}
