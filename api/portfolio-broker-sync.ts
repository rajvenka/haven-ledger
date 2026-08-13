// Consolidated dispatcher for all broker sync routes - Vercel's Hobby plan caps serverless
// functions at 12 per deployment (each file directly under /api/ counts as one), and the
// four separate broker files (eToro, Webull, Zerodha, Groww) pushed the total to 15. Rather
// than manually merging four different auth models' worth of logic into one file (real risk
// of breaking something that already works), each broker's untouched original handler was
// moved into api/_lib/ (files/directories starting with _ are excluded from Vercel's function
// count, confirmed directly from Vercel's own docs) and renamed to a plain named export. This
// file is a thin dispatcher: it counts as exactly one function, and just forwards to whichever
// broker's handler matches req.body.broker.
//
// Frontend call sites now POST { broker: 'etoro' | 'webull' | 'zerodha' | 'groww', ...restOfBody }
// to /api/portfolio-broker-sync instead of the old per-broker URLs.

import { etoroHandler } from "./_lib/etoro-sync";
import { webullHandler } from "./_lib/webull-sync";
import { zerodhaHandler } from "./_lib/zerodha-sync";
import { growwHandler } from "./_lib/groww-sync";

export default async function handler(req: any, res: any) {
  const broker = req.body?.broker;
  switch (broker) {
    case "etoro":
      return etoroHandler(req, res);
    case "webull":
      return webullHandler(req, res);
    case "zerodha":
      return zerodhaHandler(req, res);
    case "groww":
      return growwHandler(req, res);
    default:
      res.status(400).json({ error: `Unknown or missing broker: '${broker}'. Expected one of: etoro, webull, zerodha, groww.` });
  }
}
