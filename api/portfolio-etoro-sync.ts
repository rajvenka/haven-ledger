// Syncs real account holdings from eToro's public API (public-api.etoro.com), rather than
// requiring a manual file upload. Credentials (x-api-key/x-user-key) are passed in from the
// client per-request - this app has no service-role-key pattern anywhere, and workspace
// members already have read access to their own workspace's stored credentials (consistent
// with every other piece of workspace data in this app) - this route's job is just to keep
// the actual eToro API calls server-side, out of client-to-eToro network requests.
//
// NOTE: built from eToro's published API documentation, not against a live account - the
// exact response shape (especially instrument metadata field names) is defensively handled
// with fallbacks, but should be verified against a real sync and adjusted if eToro's actual
// response differs from the documented schema.

import * as crypto from "crypto";

const ETORO_BASE = "https://public-api.etoro.com/api/v1";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function etoroFetch(path: string, apiKey: string, userKey: string) {
  const resp = await fetch(`${ETORO_BASE}${path}`, {
    headers: {
      "x-api-key": apiKey,
      "x-user-key": userKey,
      "x-request-id": uuid(),
      "Accept": "application/json",
    },
  });
  return resp;
}

// Webull priority-source signing, duplicated from the verified implementation in
// api/portfolio-webull-sync.ts (Vercel functions are isolated per file) - already confirmed
// byte-for-byte against the real installed SDK, so copying is low-risk. Used here to try
// Webull's market data as the primary live-price source for eToro's US-listed holdings
// (Webull's own Category enum has no AU_STOCK option, so AU-listed/commodity symbols like
// Gold fall through to eToro's own rates endpoint regardless).
const WEBULL_REGION_HOSTS: Record<string, string> = {
  us: "api.webull.com", hk: "api.webull.hk", jp: "api.webull.co.jp", sg: "api.webull.com.sg",
  th: "api.webull.co.th", au: "api.webull.com.au", my: "api.webull.com.my", uk: "api.webull-uk.com", eu: "api.webull.eu",
};
function webullPythonQuote(str: string): string {
  return Array.from(Buffer.from(str, "utf-8")).map((byte) => {
    const ch = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-_.~]/.test(ch)) return ch;
    return "%" + byte.toString(16).toUpperCase().padStart(2, "0");
  }).join("");
}
async function webullSnapshotFetch(host: string, appKey: string, appSecret: string, token: string | undefined, symbols: string[]): Promise<{ prices: Map<string, number>; debug: any }> {
  const result = new Map<string, number>();
  const debug: any = { symbolCount: symbols.length, hasToken: !!token };
  if (symbols.length === 0) return { prices: result, debug };
  const uri = "/openapi/market-data/stock/snapshot";
  const queryParams = { symbols: symbols.join(","), category: "US_STOCK" };
  const ts = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonceVal = crypto.randomUUID();
  const signHeaders: Record<string, string> = {
    "x-app-key": appKey, "x-timestamp": ts, "x-signature-version": "1.0",
    "x-signature-algorithm": "HMAC-SHA256", "x-signature-nonce": nonceVal, host,
  };
  const signParams: Record<string, string> = {};
  for (const k of Object.keys(signHeaders)) signParams[k.toLowerCase()] = signHeaders[k];
  for (const k of Object.keys(queryParams)) signParams[k] = (queryParams as any)[k];
  const sortedKeys = Object.keys(signParams).sort();
  const stringToSign = `${uri}&${sortedKeys.map((k) => `${k}=${signParams[k]}`).join("&")}`;
  const signature = crypto.createHmac("sha256", appSecret + "&").update(webullPythonQuote(stringToSign), "utf-8").digest("base64");
  const qs = new URLSearchParams(queryParams).toString();
  try {
    const resp = await fetch(`https://${host}${uri}?${qs}`, {
      headers: { ...signHeaders, "x-signature": signature, "Content-Type": "application/json", ...(token ? { "x-access-token": token } : {}) },
    });
    const bodyText = await resp.text().catch(() => "");
    debug.httpStatus = resp.status;
    debug.ok = resp.ok;
    debug.bodySample = bodyText.slice(0, 500);
    if (!resp.ok) return { prices: result, debug };
    let data: any = null;
    try { data = JSON.parse(bodyText); } catch { debug.parseError = true; }
    const items: any[] = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
    debug.itemCount = items.length;
    for (const item of items) {
      const sym = (item.symbol ?? "").toString().toUpperCase();
      const price = Number(item.price ?? item.close ?? item.last ?? item.trade_price);
      if (sym && price > 0) result.set(sym, price);
    }
  } catch (err: any) {
    debug.caughtError = err?.message;
  }
  return { prices: result, debug };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { apiKey, userKey, webullAppKey, webullAppSecret, webullToken, webullRegion } = req.body || {};
    if (!apiKey || !userKey) {
      res.status(400).json({ error: "Missing eToro API credentials. Connect your eToro account first under Settings." });
      return;
    }

    // Real account positions - includes CFDs, real-asset stocks, crypto margin trades, and
    // futures all mixed together (settlementTypeID distinguishes them). Per discussion,
    // everything is brought in now - not just Real Asset - since a CFD/commodity position
    // (e.g. leveraged Gold) is still a real position the person holds and wants tracked.
    // Tagged by settlement type (via the "source" field) rather than silently blended in
    // indistinguishably from genuine stock ownership, so the distinction isn't lost.
    const portfolioResp = await etoroFetch("/trading/info/portfolio", apiKey, userKey);
    if (!portfolioResp.ok) {
      const body = await portfolioResp.text().catch(() => "");
      res.status(portfolioResp.status).json({ error: `eToro API returned ${portfolioResp.status} fetching your portfolio. ${body.slice(0, 300)}` });
      return;
    }
    const portfolioData = await portfolioResp.json();
    const allPositions: any[] = portfolioData?.clientPortfolio?.positions ?? [];
    const settlementLabels: Record<string, string> = { "0": "eToro CFD/Leveraged", "1": "eToro Real Asset", "2": "eToro Crypto Margin", "3": "eToro Futures" };
    const realAssetPositions = allPositions; // no longer filtered - kept the variable name to minimize the diff below

    // Breakdown by settlementTypeID - to actually see what the total count is made of (real
    // assets vs CFD/crypto-margin/futures) rather than guessing why a filtered count differs
    // from an unfiltered one.
    const settlementBreakdown: Record<string, number> = {};
    for (const p of allPositions) {
      const key = String(p.settlementTypeID ?? 'undefined');
      settlementBreakdown[key] = (settlementBreakdown[key] ?? 0) + 1;
    }

    if (realAssetPositions.length === 0) {
      res.status(200).json({ holdings: [], excludedCount: allPositions.length, totalPositions: allPositions.length, settlementBreakdown, message: "No positions found in your eToro account." });
      return;
    }

    // Resolve instrumentID -> symbol/name in one batched call, not one request per position -
    // positions only carry the numeric ID, never a ticker.
    const uniqueIds = Array.from(new Set(realAssetPositions.map((p) => p.instrumentID)));
    const instrumentsResp = await etoroFetch(`/market-data/instruments?instrumentIds=${uniqueIds.join(",")}`, apiKey, userKey);
    const instrumentMap = new Map<number, { symbol: string; name: string; exchange: string }>();
    // Captured for diagnostics - the first real sync revealed instrument resolution silently
    // failing (all symbols showing as "INSTRUMENT_xxxx" placeholders), and there's no way to
    // see why without this - Vercel runtime logs weren't reachable when this was needed.
    let instrumentDebug: any = { status: instrumentsResp.status, ok: instrumentsResp.ok };
    if (instrumentsResp.ok) {
      const instrumentsData = await instrumentsResp.json();
      instrumentDebug.rawKeys = instrumentsData && typeof instrumentsData === 'object' ? Object.keys(instrumentsData) : null;
      instrumentDebug.sample = JSON.stringify(instrumentsData).slice(0, 1500);
      // Confirmed against a real sync: eToro wraps the array under "instrumentDisplayDatas"
      // (matching the key the person's own working Python script already used) - not
      // items/data/instruments, which is why every symbol was resolving to nothing before.
      const list: any[] = Array.isArray(instrumentsData) ? instrumentsData : (instrumentsData?.instrumentDisplayDatas ?? instrumentsData?.items ?? instrumentsData?.data ?? instrumentsData?.instruments ?? []);
      instrumentDebug.listLength = list.length;
      if (list.length > 0) instrumentDebug.firstItemKeys = Object.keys(list[0]);
      for (const inst of list) {
        const id = inst.instrumentID ?? inst.instrumentId ?? inst.id ?? inst.InstrumentID;
        const name = inst.instrumentDisplayName ?? inst.displayName ?? inst.name ?? `Instrument ${id}`;
        // symbolFull/symbol weren't visible in the truncated sample from the first real
        // sync - falls back to the display name if no true ticker field is found, which is
        // still far more useful than the INSTRUMENT_xxxx placeholder.
        const symbol = inst.symbolFull ?? inst.internalSymbolFull ?? inst.symbol ?? inst.SymbolFull ?? name;
        const exchange = inst.exchangeName ?? inst.exchange ?? "eToro";
        if (id != null) instrumentMap.set(Number(id), { symbol, name, exchange });
      }
    } else {
      instrumentDebug.errorBody = (await instrumentsResp.text().catch(() => "")).slice(0, 500);
    }
    instrumentDebug.resolvedCount = instrumentMap.size;
    instrumentDebug.requestedCount = uniqueIds.length;

    // Genuine live prices via the dedicated rates endpoint (confirmed correct - eToro's own
    // API docs explicitly recommend this before order execution "to ensure price accuracy").
    // unitsBaseValueDollars from the position data itself was being used before as a stand-in
    // for current price, but produced wrong values (MU showing $218.75 instead of ~$877) -
    // it isn't actually a reliable live-price field.
    const rateMap = new Map<number, number>();
    const ratesDebug: any = {};

    // Per discussion, Webull tried first as the priority price source when a Webull
    // connection is available in the same workspace (passed in by the frontend, since this
    // route has no DB access of its own) - only covers US-listed symbols (Webull's own
    // Category enum has no AU_STOCK option), so AU-listed/commodity symbols like Gold still
    // fall through to eToro's own rates endpoint below regardless.
    // Commodities/CFDs must NOT use Webull US_STOCK snapshots — Webull "GOLD" is a
    // low-priced equity ticker (~$40), while eToro Gold is spot-style (~thousands/oz).
    // Taking Webull here was overwriting the correct eToro rate with a garbage stock price.
    const WEBULL_SKIP = new Set([
      "GOLD", "SILVER", "OIL", "NATGAS", "COPPER", "PLATINUM", "PALLADIUM",
      "XAU", "XAG", "XAUUSD", "XAGUSD", "BRENT", "WTI", "GC=F", "SI=F", "CL=F",
    ]);
    const isCommoditySymbol = (raw: string, name?: string) => {
      const s = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9=]/g, "");
      if (WEBULL_SKIP.has(s)) return true;
      return /\b(gold|silver|oil|brent|natgas|copper|platinum|palladium)\b/i.test(
        `${raw || ""} ${name || ""}`
      );
    };
    if (webullAppKey && webullAppSecret) {
      const webullHost = WEBULL_REGION_HOSTS[webullRegion] || WEBULL_REGION_HOSTS.us;
      const idToInfo = new Map(Array.from(instrumentMap.entries()).map(([id, info]) => [id, info]));
      const symbolsToTry = Array.from(new Set(
        Array.from(idToInfo.values())
          .filter((info) => info?.symbol && !isCommoditySymbol(info.symbol, info.name))
          .map((info) => info.symbol)
      ));
      const { prices: webullPrices, debug: webullFetchDebug } = await webullSnapshotFetch(webullHost, webullAppKey, webullAppSecret, webullToken, symbolsToTry);
      for (const [id, info] of Array.from(idToInfo.entries())) {
        if (isCommoditySymbol(info.symbol, info.name)) continue;
        const price = webullPrices.get(String(info.symbol).toUpperCase());
        if (price != null) rateMap.set(id, price);
      }
      ratesDebug.webull = { attempted: symbolsToTry.length, resolved: webullPrices.size, mappedToInstruments: rateMap.size, host: webullHost, skippedCommodities: true, ...webullFetchDebug };
    }

    const stillNeeded = uniqueIds.filter((id) => !rateMap.has(id));
    if (stillNeeded.length > 0) {
      const ratesResp = await etoroFetch(`/market-data/instruments/rates?instrumentIds=${stillNeeded.join(",")}`, apiKey, userKey);
      ratesDebug.etoro = { status: ratesResp.status, ok: ratesResp.ok };
      if (ratesResp.ok) {
        const ratesData = await ratesResp.json();
        ratesDebug.etoro.rateCount = ratesData?.rates?.length ?? 0;
        ratesDebug.etoro.sample = JSON.stringify(ratesData).slice(0, 500);
        const rateList: any[] = ratesData?.rates ?? [];
        for (const r of rateList) {
          const id = r.instrumentID ?? r.instrumentId;
          // Mid-price between bid/ask when both are present - a reasonable single "current
          // price" figure; falls back to lastExecution if bid/ask aren't both available.
          const price = (r.bid != null && r.ask != null) ? (Number(r.bid) + Number(r.ask)) / 2 : Number(r.lastExecution ?? r.bid ?? r.ask ?? 0);
          if (id != null && price > 0 && !rateMap.has(Number(id))) rateMap.set(Number(id), price);
        }
      } else {
        ratesDebug.etoro.errorBody = (await ratesResp.text().catch(() => "")).slice(0, 500);
      }
    }

    // eToro's same-stock-bought-5-times pattern: positions are individual trade entries,
    // not consolidated by instrument - the same stock genuinely can appear as several
    // separate position rows. Consolidated here into one holding per instrument+settlement
    // type (summed units, weighted-average entry price) - keyed on both, not just
    // instrument, so a CFD position and a Real Asset position in the same underlying
    // instrument are never merged into one holding, since they're fundamentally different
    // kinds of exposure. Same principle as the Groww MF folio dedup fix from earlier.
    // Leverage/stop-loss/take-profit are per-position risk parameters that don't average
    // cleanly across multiple lots - leverage uses a units-weighted average (it's normally
    // consistent across positions in the same instrument+type anyway), while stop-loss and
    // take-profit keep the tightest (most conservative) value seen, so an alert system
    // built on this never under-warns by picking a looser threshold from a different lot.
    // "amount" (distinct from initialAmountInDollars, which stays fixed at the original
    // investment) is eToro's own direct source for "Net Value" - confirmed to vary with
    // stop-loss changes, so it's summed across consolidated lots rather than derived
    // client-side, which is strictly more reliable than a formula.
    const consolidated = new Map<string, { symbol: string; name: string; exchange: string; source: string; instrumentId: number; totalUnits: number; totalCost: number; leverageWeighted: number; stopLossRate: number | null; takeProfitRate: number | null; totalNetValueAmount: number }>();
    for (const pos of realAssetPositions) {
      const id = Number(pos.instrumentID);
      const settlementKey = String(pos.settlementTypeID ?? 'undefined');
      const mapKey = `${id}_${settlementKey}`;
      const info = instrumentMap.get(id) ?? { symbol: `INSTRUMENT_${id}`, name: `Instrument ${id}`, exchange: "eToro" };
      const source = settlementLabels[settlementKey] ?? `eToro (type ${settlementKey})`;
      const units = Number(pos.units) || 0;
      const openRate = Number(pos.openRate) || 0;
      const leverage = Number(pos.leverage) || 1;
      const isBuy = pos.isBuy !== false; // default true (long) if not specified
      const posStopLoss = pos.stopLossRate != null ? Number(pos.stopLossRate) : null;
      const posTakeProfit = pos.takeProfitRate != null ? Number(pos.takeProfitRate) : null;
      // "amount" alone (eToro's reserved-cash figure for the position) isn't the full
      // picture - confirmed against real data that eToro's displayed Net Value equals the
      // sum of per-lot amounts PLUS the position's unrealized P/L (the reserved cash figure
      // doesn't itself reflect how much of it has already been eroded by an open loss, or
      // added to by an open gain). units already represents full leveraged exposure, so P/L
      // is (currentPrice - openRate) x units directly, no separate leverage multiplication.
      const livePrice = rateMap.get(id) ?? openRate;
      const posPnl = (livePrice - openRate) * units * (isBuy ? 1 : -1);
      const posNetValueAmount = (Number(pos.amount) || 0) + posPnl;
      const existing = consolidated.get(mapKey);
      if (existing) {
        existing.totalUnits += units;
        existing.totalCost += units * openRate;
        existing.leverageWeighted += units * leverage;
        existing.totalNetValueAmount += posNetValueAmount;
        // Tightest = closest to current price in the direction that matters: for a long
        // position a higher stop-loss is tighter, for a short a lower one is tighter.
        if (posStopLoss != null) {
          existing.stopLossRate = existing.stopLossRate == null ? posStopLoss
            : (isBuy ? Math.max(existing.stopLossRate, posStopLoss) : Math.min(existing.stopLossRate, posStopLoss));
        }
        if (posTakeProfit != null) {
          existing.takeProfitRate = existing.takeProfitRate == null ? posTakeProfit
            : (isBuy ? Math.min(existing.takeProfitRate, posTakeProfit) : Math.max(existing.takeProfitRate, posTakeProfit));
        }
      } else {
        consolidated.set(mapKey, {
          symbol: info.symbol, name: info.name, exchange: info.exchange, source, instrumentId: id,
          totalUnits: units, totalCost: units * openRate,
          leverageWeighted: units * leverage, stopLossRate: posStopLoss, takeProfitRate: posTakeProfit,
          totalNetValueAmount: posNetValueAmount,
        });
      }
    }

    const holdings = Array.from(consolidated.entries())
      .filter(([, h]) => h.totalUnits > 0)
      .map(([mapKey, h]) => ({
        symbol: h.symbol,
        name: h.name,
        broker: "eToro",
        holdingType: "stock" as const,
        exchange: h.exchange,
        quantity: h.totalUnits,
        buyPrice: h.totalCost / h.totalUnits,
        // Real live price from the dedicated rates endpoint, not derived from position
        // data - falls back to average entry price only if the rate genuinely couldn't be
        // fetched, so the field is never left at zero/undefined.
        currentPrice: rateMap.get(h.instrumentId) ?? (h.totalCost / h.totalUnits),
        currency: "USD",
        source: h.source,
        etoroNetValueAmount: h.totalNetValueAmount,
        leverage: h.leverageWeighted / h.totalUnits,
        stopLossRate: h.stopLossRate ?? undefined,
        takeProfitRate: h.takeProfitRate ?? undefined,
        matchKey: mapKey,
      }));

    // Individual, un-consolidated lots - each tagged with the same matchKey as its parent
    // master holding above, so the frontend can link each raw position to the correct
    // consolidated row once it's saved and has a real id. This is the actual per-lot detail
    // (own entry price, stop-loss, leverage, net value) the master row's "tightest value"
    // approximation was standing in for.
    const rawLots = realAssetPositions.map((pos: any) => {
      const id = Number(pos.instrumentID);
      const settlementKey = String(pos.settlementTypeID ?? 'undefined');
      const mapKey = `${id}_${settlementKey}`;
      return {
        matchKey: mapKey,
        externalPositionId: String(pos.positionID ?? ''),
        broker: "eToro",
        quantity: Number(pos.units) || 0,
        buyPrice: Number(pos.openRate) || 0,
        currentPrice: rateMap.get(Number(pos.instrumentID)) ?? (Number(pos.openRate) || 0),
        leverage: Number(pos.leverage) || 1,
        stopLossRate: pos.stopLossRate != null ? Number(pos.stopLossRate) : undefined,
        takeProfitRate: pos.takeProfitRate != null ? Number(pos.takeProfitRate) : undefined,
        etoroNetValueAmount: Number(pos.amount) || 0,
        totalFees: Number(pos.totalFees) || 0,
        totalExternalFees: Number(pos.totalExternalFees) || 0,
        openDate: pos.openDateTime ?? undefined,
        source: settlementLabels[settlementKey] ?? `eToro (type ${settlementKey})`,
      };
    });

    // Raw per-position debug data for symbols under scrutiny - lets us see exactly what
    // eToro is actually returning field-by-field, rather than guessing at where the
    // consolidation math is going wrong.
    const rawPositionDebug = realAssetPositions
      .filter((pos: any) => {
        const id = Number(pos.instrumentID);
        const info = instrumentMap.get(id);
        return info?.symbol === 'MU';
      })
      .map((pos: any) => ({
        positionID: pos.positionID,
        units: pos.units,
        openRate: pos.openRate,
        amount: pos.amount,
        initialAmountInDollars: pos.initialAmountInDollars,
        unitsBaseValueDollars: pos.unitsBaseValueDollars,
        leverage: pos.leverage,
        stopLossRate: pos.stopLossRate,
        settlementTypeID: pos.settlementTypeID,
      }));

    res.status(200).json({
      holdings,
      rawLots,
      rawPositionDebug,
      totalPositions: allPositions.length,
      includedPositions: realAssetPositions.length,
      consolidatedHoldingsCount: holdings.length,
      settlementBreakdown,
      syncedAt: new Date().toISOString(),
      instrumentDebug,
      ratesDebug,
    });
  } catch (error: any) {
    console.error("eToro sync error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error syncing from eToro." });
  }
}
