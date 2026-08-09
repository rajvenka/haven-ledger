// Syncs real account holdings from Webull's official Trading API (app_key/app_secret,
// individual/own-account model - same pattern as eToro). Credentials are passed in from the
// client per-request, same reasoning as the eToro route - this app has no service-role-key
// pattern anywhere.
//
// Everything below is now verified directly against the real, installed
// webull-openapi-python-sdk source code (pip installed and read directly, not guessed from
// documentation) - the same SDK the user's own working Python script uses:
//   - Signing algorithm: HMAC-SHA256 (not SHA1 as earlier docs suggested), SHA256 body hash
//     (not MD5), Python's urllib.parse.quote(safe='') encoding. Confirmed by generating a
//     real signature from the actual SDK code with fixed test inputs and reproducing the
//     exact same signature in this file's implementation - genuine byte-for-byte match, not
//     a documented example that may have been outdated.
//   - Token paths: /openapi/auth/token/create, /openapi/auth/token/check (singular "token",
//     not "tokens" as initially guessed) - read directly from create_token_request.py /
//     check_token_request.py.
//   - Account paths: /openapi/account/list (confirmed correct) and /openapi/assets/positions
//     (NOT /openapi/account/positions as the docs research suggested - read directly from
//     the SDK's v2 request classes, which is what account_v2.get_account_list() /
//     get_account_position() actually call).
//   - Host mapping: read directly from the SDK's own endpoints.json config file.
// The one thing still not fully confirmed is the exact response field names for
// positions/account list, since the SDK appears to pass through raw JSON rather than using
// typed response beans - kept defensive with fallbacks, and full debug output included so
// any remaining mismatch is immediately visible on the first real sync.

import * as crypto from "crypto";

// Read directly from the SDK's own endpoints.json - not a guess.
const REGION_HOSTS: Record<string, string> = {
  us: "api.webull.com",
  hk: "api.webull.hk",
  jp: "api.webull.co.jp",
  sg: "api.webull.com.sg",
  th: "api.webull.co.th",
  au: "api.webull.com.au",
  my: "api.webull.com.my",
  uk: "api.webull-uk.com",
  br: "api.webull.com",
  mx: "api.webull.com",
  za: "api.webull.com.au",
  eu: "api.webull.eu",
};

function timestampISO() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function nonce() {
  return crypto.randomUUID();
}

// Matches Python's urllib.parse.quote(s, safe='') exactly - alphanumerics and -_.~ are the
// only characters Python's quote() ever leaves unescaped, regardless of the safe parameter
// passed (a real, confirmed difference from JS's encodeURIComponent, which also leaves
// !*'() unescaped).
function pythonQuote(str: string): string {
  return Array.from(Buffer.from(str, "utf-8"))
    .map((byte) => {
      const ch = String.fromCharCode(byte);
      if (/[A-Za-z0-9\-_.~]/.test(ch)) return ch;
      return "%" + byte.toString(16).toUpperCase().padStart(2, "0");
    })
    .join("");
}

// Verified byte-for-byte against a real signature generated directly from the installed
// webull-openapi-python-sdk source with fixed test inputs - not a guess, not a documented
// example that may be outdated.
function signRequest(uri: string, queryParams: Record<string, string>, host: string, appKey: string, appSecret: string, ts: string, nonceVal: string, bodyParams: any) {
  const signHeaders: Record<string, string> = {
    "x-app-key": appKey,
    "x-timestamp": ts,
    "x-signature-version": "1.0",
    "x-signature-algorithm": "HMAC-SHA256",
    "x-signature-nonce": nonceVal,
    host,
  };
  const signParams: Record<string, string> = {};
  for (const k of Object.keys(signHeaders)) signParams[k.toLowerCase()] = signHeaders[k];
  for (const k of Object.keys(queryParams)) {
    signParams[k] = signParams[k] !== undefined ? `${signParams[k]}&${queryParams[k]}` : String(queryParams[k]);
  }
  let bodyString: string | null = null;
  if (bodyParams !== null && bodyParams !== undefined) {
    const rawStr = JSON.stringify(bodyParams);
    bodyString = crypto.createHash("sha256").update(rawStr, "utf-8").digest("hex").toUpperCase();
  }
  const sortedKeys = Object.keys(signParams).sort();
  const sortedArray = sortedKeys.map((k) => `${k}=${signParams[k]}`);
  let stringToSign = uri || "";
  stringToSign = stringToSign ? `${stringToSign}&${sortedArray.join("&")}` : sortedArray.join("&");
  if (bodyString) stringToSign += `&${bodyString}`;
  const encoded = pythonQuote(stringToSign);
  const signature = crypto.createHmac("sha256", appSecret + "&").update(encoded, "utf-8").digest("base64");
  return { signature, headers: signHeaders };
}

async function webullFetch(path: string, method: "GET" | "POST", host: string, appKey: string, appSecret: string, token?: string, queryParams: Record<string, string> = {}, bodyParams?: any) {
  const ts = timestampISO();
  const nonceVal = nonce();
  const { signature, headers } = signRequest(path, queryParams, host, appKey, appSecret, ts, nonceVal, bodyParams);
  const qs = Object.keys(queryParams).length > 0 ? "?" + new URLSearchParams(queryParams).toString() : "";
  const resp = await fetch(`https://${host}${path}${qs}`, {
    method,
    headers: {
      ...headers,
      "x-signature": signature,
      "Content-Type": "application/json",
      ...(token ? { "x-access-token": token } : {}),
    },
    body: bodyParams !== undefined ? JSON.stringify(bodyParams) : undefined,
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
      // Real path confirmed from create_token_request.py: /openapi/auth/token/create
      // (singular "token"). Matches CreateTokenRequest().set_token(None) - body is {}
      // (empty object, not omitted) for a brand new token, confirmed via the real SDK.
      const createResp = await webullFetch("/openapi/auth/token/create", "POST", host, appKey, appSecret, undefined, {}, {});
      const createBody = await createResp.text().catch(() => "");
      let parsed: any = null;
      try { parsed = JSON.parse(createBody); } catch { /* not json */ }
      res.status(200).json({
        status: createResp.ok ? "pending_verification" : "create_failed",
        tokenId: parsed?.token_id ?? parsed?.tokenId ?? parsed?.token ?? parsed?.id ?? null,
        rawStatus: parsed?.status ?? null,
        debug: { httpStatus: createResp.status, ok: createResp.ok, body: createBody.slice(0, 500), host },
      });
      return;
    }

    if (action === "check") {
      // Real path confirmed from check_token_request.py: /openapi/auth/token/check.
      const checkResp = await webullFetch("/openapi/auth/token/check", "POST", host, appKey, appSecret, undefined, {}, { token: tokenId });
      const checkBody = await checkResp.text().catch(() => "");
      let parsed: any = null;
      try { parsed = JSON.parse(checkBody); } catch { /* not json */ }
      const status = parsed?.status ?? parsed?.token_status ?? null;
      const verified = status === "verified" || status === "VERIFIED" || status === "success" || status === "NORMAL";
      res.status(200).json({
        verified,
        token: verified ? (parsed?.token ?? parsed?.access_token ?? tokenId) : null,
        expiresAt: parsed?.expire_time ?? parsed?.expires_at ?? null,
        debug: { httpStatus: checkResp.status, ok: checkResp.ok, body: checkBody.slice(0, 500) },
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
        // Real path confirmed from webull/trade/request/v2/get_account_positions_request.py
        // (what account_v2.get_account_position() actually calls): /openapi/assets/positions
        // - NOT /openapi/account/positions, which is what the docs-based research suggested.
        const posResp = await webullFetch("/openapi/assets/positions", "GET", host, appKey, appSecret, token, { account_id: String(accountId) });
        if (!posResp.ok) {
          rawPositionsDebug.push({ accountId, httpStatus: posResp.status, error: (await posResp.text().catch(() => "")).slice(0, 300) });
          continue;
        }
        const posData = await posResp.json();
        rawPositionsDebug.push({ accountId, raw: JSON.stringify(posData).slice(0, 800) });
        // Confirmed via a real sync: the response is a direct array (not wrapped in
        // {items:[...]}), and each position genuinely carries its own currency directly -
        // exactly as hoped, since a single Webull AU account holds both AUD (ASX-listed)
        // and USD (US-listed) positions side by side. last_price is also returned directly,
        // confirmed to match this route's earlier derived-from-P&L calculation exactly
        // (0.86 + (-51.52/112) = 0.40, matching the real last_price of 0.40) - using the
        // direct field now instead, simpler and avoids any derivation edge cases.
        const items: any[] = posData?.items ?? posData?.positions ?? (Array.isArray(posData) ? posData : []);
        for (const item of items) {
          // Only EQUITY for now - options have fundamentally different pricing/risk
          // characteristics and would need separate handling (this app's holdingType is
          // stock/mutual_fund only today), so they're excluded rather than misclassified.
          if (item.instrument_type && item.instrument_type !== "EQUITY") continue;
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) continue;
          const costPrice = Number(item.cost_price ?? item.costPrice) || 0;
          const currentPrice = Number(item.last_price ?? item.lastPrice) || costPrice;
          const currency = item.currency ?? item.currency_code ?? item.currencyCode ?? "USD";
          holdings.push({
            symbol: item.symbol ?? item.instrument_id ?? item.instrumentId,
            broker: "Webull",
            holdingType: "stock" as const,
            exchange: item.exchange ?? item.market ?? "Webull",
            quantity: qty,
            buyPrice: costPrice,
            currentPrice,
            currency,
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
