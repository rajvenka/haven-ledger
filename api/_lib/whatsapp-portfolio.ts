// Portfolio replies for the WhatsApp bot ("portfolio", "today", "markets").
import { fetchMarkets } from "./market-indices.js";

const cur = (n: number, c: string) => {
  try { return new Intl.NumberFormat(c === "INR" ? "en-IN" : "en-US", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n); } catch { return `${Math.round(n)} ${c}`; }
};
const sg = (n: number, c: string) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${cur(Math.abs(n), c)}`;
const pc = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;

async function allRows(q: (from: number, to: number) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function sendWhatsApp(toDigits: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { skipped: true };
  const resp = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: toDigits, type: "text", text: { body: body.slice(0, 4000) } }),
  });
  const data = await resp.json().catch(() => ({}));
  return resp.ok ? data : { error: data?.error?.message || "send failed" };
}

type Calc = { value: number; cost: number; pnl: number; pnlPct: number; day: number; dayPct: number };
function calc(list: any[], to: string, base: string, rate: (c: string) => number | null): Calc {
  const conv = (amt: number, from: string) => {
    if (from === to) return amt;
    const f = rate(from), t = rate(to);
    return f == null || t == null ? amt : (amt * f) / t;
  };
  let value = 0, cost = 0, day = 0;
  list.forEach((h) => {
    const native = String(h.currency || base).toUpperCase();
    const qty = Number(h.quantity || 0), price = Number(h.live_price ?? h.current_price ?? h.buy_price ?? 0);
    const expCost = Number(h.buy_price || 0) * qty, expMv = price * qty;
    let realMv = expMv;
    if (Number(h.leverage || 0) > 1 && h.etoro_net_value_amount != null) realMv = Number(h.etoro_net_value_amount);
    const ok = realMv >= 0 && realMv - (expMv - expCost) > 0;
    const mv = ok ? realMv : expMv, c = ok ? realMv - (expMv - expCost) : expCost;
    const prev = Number(h.previous_close), live = Number(h.live_price);
    let d = 0;
    if (prev > 0 && live > 0 && live / prev < 20 && live / prev > 0.05) d = (live - prev) * qty;
    value += conv(mv, native); cost += conv(c, native); day += conv(d, native);
  });
  const pnl = value - cost;
  return { value, cost, pnl, pnlPct: cost > 0 ? (pnl / cost) * 100 : 0, day, dayPct: value - day > 0 ? (day / (value - day)) * 100 : 0 };
}

export async function portfolioReply(sb: any, userId: string, kind: "portfolio" | "today"): Promise<string> {
  const { data: mem } = await sb.from("workspace_members").select("workspace_id").eq("user_id", userId);
  const wids = (mem || []).map((m: any) => m.workspace_id).filter(Boolean);
  if (!wids.length) return "No workspace found for your account.";
  const { data: wss } = await sb.from("workspaces").select("id, name, base_currency, portfolio_mode").in("id", wids);
  const blocks: string[] = [];
  for (const ws of wss || []) {
    const holdings = await allRows((a, b) => sb.from("portfolio_holdings")
      .select("id, portfolio_id, symbol, ticker, quantity, buy_price, live_price, current_price, previous_close, currency, leverage, etoro_net_value_amount, status")
      .eq("workspace_id", ws.id).eq("status", "active").range(a, b));
    if (!holdings.length) continue;
    const base = String(ws.base_currency || "INR").toUpperCase();
    const { data: rates } = await sb.from("workspace_currency_rates").select("currency, rate_to_base").eq("workspace_id", ws.id);
    const rate = (c: string) => { if (c === base) return 1; const r = (rates || []).find((x: any) => String(x.currency).toUpperCase() === c); const v = Number(r?.rate_to_base); return v > 0 ? v : null; };
    const { data: pfs } = await sb.from("portfolios").select("id, name, currency, display_order").eq("workspace_id", ws.id).order("display_order");
    const multi = ws.portfolio_mode === "multiple" && (pfs || []).length > 0;
    const lines: string[] = [];
    const fmt = (name: string, c: Calc, ccy: string) => kind === "portfolio"
      ? `*${name}*\nValue ${cur(c.value, ccy)} (invested ${cur(c.cost, ccy)})\nP/L ${sg(c.pnl, ccy)} (${pc(c.pnlPct)})\nToday ${sg(c.day, ccy)} (${pc(c.dayPct)})`
      : `*${name}* today ${sg(c.day, ccy)} (${pc(c.dayPct)})`;
    if (multi) {
      for (const p of pfs) {
        const l = holdings.filter((h: any) => h.portfolio_id === p.id);
        if (l.length) lines.push(fmt(p.name, calc(l, String(p.currency || base).toUpperCase(), base, rate), String(p.currency || base).toUpperCase()));
      }
      if ((pfs || []).length > 1) lines.push(fmt("All portfolios", calc(holdings, base, base, rate), base));
    } else lines.push(fmt("Portfolio", calc(holdings, base, base, rate), base));
    // best / worst (by all-time P/L) or today's movers
    const per = holdings.map((h: any) => {
      const c = calc([h], base, base, rate);
      return { n: String(h.ticker || h.symbol), pnl: c.pnl, day: c.day, pct: c.pnlPct };
    });
    if (kind === "portfolio") {
      const s = [...per].sort((a, b) => b.pnl - a.pnl);
      if (s.length) lines.push(`Best ${s[0].n} ${sg(s[0].pnl, base)} (${pc(s[0].pct)})\nWorst ${s[s.length - 1].n} ${sg(s[s.length - 1].pnl, base)} (${pc(s[s.length - 1].pct)})`);
    } else {
      const s = [...per].sort((a, b) => b.day - a.day);
      const up = s.filter((x) => x.day > 0).slice(0, 3), dn = s.filter((x) => x.day < 0).reverse().slice(0, 3);
      if (up.length) lines.push(`Top gainers\n${up.map((x) => `• ${x.n} ${sg(x.day, base)}`).join("\n")}`);
      if (dn.length) lines.push(`Top losers\n${dn.map((x) => `• ${x.n} ${sg(x.day, base)}`).join("\n")}`);
    }
    blocks.push(`📊 ${ws.name}\n\n${lines.join("\n\n")}`);
  }
  return blocks.length ? blocks.join("\n\n———\n\n") : "No portfolio holdings found.";
}

export async function marketsReply(): Promise<string> {
  const { quotes } = await fetchMarkets();
  const groups: Record<string, string> = { IN: "India", US: "US", EU: "Europe", AU: "Australia", JP: "Japan", HK: "Hong Kong" };
  const lines = Object.entries(groups).map(([id, name]) => {
    const q = quotes.filter((x) => x.market === id && x.last != null);
    if (!q.length) return `*${name}* no data`;
    return `*${name}*\n` + q.map((x) => {
      const ch = x.hasToday ? x.change : null, p = x.hasToday ? x.changePct : null;
      return `• ${x.name} ${x.last!.toLocaleString("en-US", { maximumFractionDigits: 2 })}${ch != null ? ` ${ch > 0 ? "+" : ""}${ch.toFixed(1)} (${p! > 0 ? "+" : ""}${p!.toFixed(2)}%)` : ""}  prev ${x.prevClose != null ? x.prevClose.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}`;
    }).join("\n");
  });
  return `🌍 Markets (points)\n\n${lines.join("\n\n")}`;
}
