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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { apiKey, userKey } = req.body || {};
    if (!apiKey || !userKey) {
      res.status(400).json({ error: "Missing eToro API credentials. Connect your eToro account first under Settings." });
      return;
    }

    // Real account positions - includes CFDs, real-asset stocks, crypto margin trades, and
    // futures all mixed together (settlementTypeID distinguishes them). Filtered below to
    // settlementTypeID === 1 (Real Asset) only, since that's genuine stock/ETF ownership -
    // the only kind directly comparable to a Zerodha/Groww holding. CFDs and leveraged
    // positions are deliberately excluded, not imported as if they were real ownership.
    const portfolioResp = await etoroFetch("/trading/info/portfolio", apiKey, userKey);
    if (!portfolioResp.ok) {
      const body = await portfolioResp.text().catch(() => "");
      res.status(portfolioResp.status).json({ error: `eToro API returned ${portfolioResp.status} fetching your portfolio. ${body.slice(0, 300)}` });
      return;
    }
    const portfolioData = await portfolioResp.json();
    const allPositions: any[] = portfolioData?.clientPortfolio?.positions ?? [];
    const realAssetPositions = allPositions.filter((p) => Number(p.settlementTypeID) === 1);

    if (realAssetPositions.length === 0) {
      res.status(200).json({ holdings: [], excludedCount: allPositions.length, message: "No Real Asset positions found (CFD/leveraged/crypto-margin positions are excluded on purpose)." });
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
      instrumentDebug.sample = JSON.stringify(instrumentsData).slice(0, 500);
      const list: any[] = Array.isArray(instrumentsData) ? instrumentsData : (instrumentsData?.items ?? instrumentsData?.data ?? instrumentsData?.instruments ?? []);
      instrumentDebug.listLength = list.length;
      for (const inst of list) {
        const id = inst.instrumentId ?? inst.instrumentID ?? inst.id ?? inst.InstrumentID;
        const symbol = inst.internalSymbolFull ?? inst.symbol ?? inst.symbolFull ?? inst.SymbolFull ?? String(id);
        const name = inst.displayName ?? inst.name ?? inst.instrumentDisplayName ?? symbol;
        const exchange = inst.exchangeName ?? inst.exchange ?? "eToro";
        if (id != null) instrumentMap.set(Number(id), { symbol, name, exchange });
      }
    } else {
      instrumentDebug.errorBody = (await instrumentsResp.text().catch(() => "")).slice(0, 500);
    }
    instrumentDebug.resolvedCount = instrumentMap.size;
    instrumentDebug.requestedCount = uniqueIds.length;

    // eToro's same-stock-bought-5-times pattern: positions are individual trade entries,
    // not consolidated by instrument - the same stock genuinely can appear as several
    // separate position rows. Consolidated here into one holding per instrument (summed
    // units, weighted-average entry price) rather than importing 5 separate rows for what
    // is, for reconciliation purposes, a single position - same principle as the Groww MF
    // folio dedup fix from earlier in this project.
    const consolidated = new Map<number, { symbol: string; name: string; exchange: string; totalUnits: number; totalCost: number; currentValue: number }>();
    for (const pos of realAssetPositions) {
      const id = Number(pos.instrumentID);
      const info = instrumentMap.get(id) ?? { symbol: `INSTRUMENT_${id}`, name: `Instrument ${id}`, exchange: "eToro" };
      const units = Number(pos.units) || 0;
      const openRate = Number(pos.openRate) || 0;
      const currentValue = Number(pos.unitsBaseValueDollars ?? pos.initialAmountInDollars) || 0;
      const existing = consolidated.get(id);
      if (existing) {
        existing.totalUnits += units;
        existing.totalCost += units * openRate;
        existing.currentValue += currentValue;
      } else {
        consolidated.set(id, { symbol: info.symbol, name: info.name, exchange: info.exchange, totalUnits: units, totalCost: units * openRate, currentValue });
      }
    }

    const holdings = Array.from(consolidated.values())
      .filter((h) => h.totalUnits > 0)
      .map((h) => ({
        symbol: h.symbol,
        name: h.name,
        broker: "eToro",
        holdingType: "stock" as const,
        exchange: h.exchange,
        quantity: h.totalUnits,
        buyPrice: h.totalCost / h.totalUnits,
        currentPrice: h.currentValue / h.totalUnits,
        currency: "USD",
      }));

    res.status(200).json({
      holdings,
      excludedCount: allPositions.length - realAssetPositions.length,
      syncedAt: new Date().toISOString(),
      instrumentDebug,
    });
  } catch (error: any) {
    console.error("eToro sync error:", error);
    res.status(500).json({ error: error?.message || "Unexpected error syncing from eToro." });
  }
}
