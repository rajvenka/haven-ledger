// Consolidated dispatcher for the three mutual-fund routes (search, nav, holdings), same
// reasoning as portfolio-broker-sync.ts - reduces three separate serverless functions down
// to one. Dispatches via an explicit ?action= query parameter rather than a body field,
// since query params work identically whether the underlying call is GET (mf-search) or
// POST (mf-nav, mf-holdings) - the three original handlers, moved untouched into api/_lib/,
// have three different request shapes (query string vs. two different POST body shapes) and
// this avoids needing to unify them.
//
// Frontend call sites: /api/portfolio-mf?action=search&q=... (GET), /api/portfolio-mf?action=nav
// (POST, same body as before), /api/portfolio-mf?action=holdings (POST, same body as before).

import { mfSearchHandler } from "./_lib/mf-search";
import { mfNavHandler } from "./_lib/mf-nav";
import { mfHoldingsHandler } from "./_lib/mf-holdings";

export default async function handler(req: any, res: any) {
  const action = req.query?.action;
  switch (action) {
    case "search":
      return mfSearchHandler(req, res);
    case "nav":
      return mfNavHandler(req, res);
    case "holdings":
      return mfHoldingsHandler(req, res);
    default:
      res.status(400).json({ error: `Unknown or missing action: '${action}'. Expected one of: search, nav, holdings.` });
  }
}
