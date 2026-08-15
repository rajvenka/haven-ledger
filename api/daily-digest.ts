/**
 * Daily digest — email (Resend) + WhatsApp (Meta).
 * Auth: Authorization: Bearer CRON_SECRET
 * Cron: 0 22 * * * (≈ 08:00 AEST)
 */
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

function digits(s: string) {
  return String(s || "").replace(/[^\d]/g, "");
}

async function sendEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Haven Ledger <onboarding@resend.dev>";
  if (!key) {
    console.warn("RESEND_API_KEY missing — email skipped");
    return { skipped: true };
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data?.message || "Resend failed");
  return data;
}

async function sendWhatsAppText(toDigits: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { skipped: true };
  const resp = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits,
      type: "text",
      text: { body: body.slice(0, 4000) },
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error("WhatsApp digest send failed", data);
    return { error: data?.error?.message || "send failed" };
  }
  return data;
}

async function buildDigestForUser(sb: any, userId: string) {
  const { data: memberships } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);
  const wids = (memberships || []).map((m: any) => m.workspace_id).filter(Boolean);
  if (!wids.length) return { subject: "Haven daily digest", text: "No workspace linked." };

  const today = new Date().toISOString().slice(0, 10);
  const { data: pays } = await sb
    .from("recurring_payments")
    .select("name, amount, next_due_date, currency, is_paid")
    .in("workspace_id", wids)
    .limit(100);

  const open = (pays || []).filter((p: any) => !p.is_paid);
  const due = open.filter((p: any) => p.next_due_date && String(p.next_due_date).slice(0, 10) <= today);
  const upcoming = open
    .filter((p: any) => p.next_due_date && String(p.next_due_date).slice(0, 10) > today)
    .slice(0, 5);

  const { data: portfoliosData } = await sb
    .from("portfolios")
    .select("id, name, workspace_id")
    .in("workspace_id", wids);
  const portfolioName = new Map<string, string>((portfoliosData || []).map((p: any) => [p.id, p.name]));

  const { data: holdings } = await sb
    .from("portfolio_holdings")
    .select("portfolio_id, symbol, ticker, quantity, buy_price, live_price, previous_close, currency, status")
    .in("workspace_id", wids)
    .eq("status", "active")
    .limit(500);

  // Day change per holding - same (live - previous_close) * qty logic used throughout the
  // app, kept self-contained here since this runs in a separate serverless function with no
  // access to the frontend's shared helpers.
  const dayChangeFor = (h: any) => {
    const live = Number(h.live_price);
    const prev = Number(h.previous_close);
    const qty = Number(h.quantity) || 0;
    if (!Number.isFinite(live) || !Number.isFinite(prev) || prev <= 0) return null;
    const dollar = (live - prev) * qty;
    const pct = ((live - prev) / prev) * 100;
    return { dollar, pct };
  };

  const portfolioLines: string[] = [];
  const bigMovers: { label: string; pct: number; dollar: number; currency: string }[] = [];
  if (holdings?.length) {
    const byPortfolio = new Map<string, any[]>();
    for (const h of holdings) {
      const key = h.portfolio_id || "default";
      byPortfolio.set(key, [...(byPortfolio.get(key) || []), h]);
    }
    for (const [pid, hs] of Array.from(byPortfolio.entries())) {
      const name = portfolioName.get(pid) || "Portfolio";
      let value = 0;
      let dayDollar = 0;
      let ccy = "";
      for (const h of hs) {
        const q = Number(h.quantity) || 0;
        const live = Number(h.live_price ?? h.buy_price) || 0;
        value += live * q;
        ccy = h.currency || ccy;
        const day = dayChangeFor(h);
        if (day) {
          dayDollar += day.dollar;
          if (Math.abs(day.pct) >= 3) {
            bigMovers.push({ label: h.ticker || h.symbol || "?", pct: day.pct, dollar: day.dollar, currency: h.currency });
          }
        }
      }
      if (value > 0) {
        const sign = dayDollar >= 0 ? "+" : "";
        portfolioLines.push(`  • ${name}: ${value.toFixed(0)} ${ccy} · today ${sign}${dayDollar.toFixed(0)} ${ccy}`);
      }
    }
  }
  bigMovers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const topMovers = bigMovers.slice(0, 3);

  const lines: string[] = [];
  lines.push(`Haven Ledger · ${today}`);
  lines.push("");
  lines.push(`Bills due/overdue: ${due.length}`);
  for (const p of due.slice(0, 10)) {
    lines.push(
      `  • ${p.name || "Bill"} · ${p.amount ?? ""} ${p.currency || ""} · ${String(p.next_due_date).slice(0, 10)}`
    );
  }
  if (upcoming.length) {
    lines.push("");
    lines.push("Coming up:");
    for (const p of upcoming) {
      lines.push(`  • ${p.name || "Bill"} · ${String(p.next_due_date).slice(0, 10)}`);
    }
  }
  if (portfolioLines.length) {
    lines.push("");
    lines.push("Portfolios:");
    lines.push(...portfolioLines);
  }
  if (topMovers.length) {
    lines.push("");
    lines.push("Big movers today:");
    for (const m of topMovers) {
      const sign = m.pct >= 0 ? "+" : "";
      lines.push(`  • ${m.label}: ${sign}${m.pct.toFixed(1)}% (${sign}${m.dollar.toFixed(0)} ${m.currency || ""})`);
    }
  }
  if (!portfolioLines.length) {
    lines.push("");
    lines.push("Portfolio: open Haven for live marks.");
  }
  lines.push("");
  lines.push("Manage: Haven → Account → Daily digests");

  return { subject: `Haven · ${due.length} due · ${today}`, text: lines.join("\n") };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const auth = req.headers.authorization || "";

    // Preview action - lets a logged-in user see their own digest content on demand, using
    // their own Supabase session token rather than the cron secret. Never sends anything;
    // just builds and returns the same text the scheduled job would send.
    if (req.query?.action === "preview") {
      const token = auth.replace(/^Bearer\s+/i, "");
      if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const sb = admin();
      const { data: userData, error: userErr } = await sb.auth.getUser(token);
      if (userErr || !userData?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const digest = await buildDigestForUser(sb, userData.user.id);
      res.status(200).json({ ok: true, subject: digest.subject, text: digest.text });
      return;
    }

    const secret = process.env.CRON_SECRET || "";
    if (!secret || auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sb = admin();
    let profiles: any[] = [];
    {
      const q = await sb
        .from("profiles")
        .select("id, email, whatsapp_phone, digest_email, digest_whatsapp")
        .or("digest_email.eq.true,digest_whatsapp.eq.true");
      if (q.error && /digest_email|digest_whatsapp|column/i.test(String(q.error.message || ""))) {
        const q2 = await sb.from("profiles").select("id, email, whatsapp_phone").not("email", "is", null);
        profiles = (q2.data || []).map((p: any) => ({
          ...p,
          digest_email: true,
          digest_whatsapp: !!p.whatsapp_phone,
        }));
      } else if (q.error) {
        throw q.error;
      } else {
        profiles = q.data || [];
      }
    }

    const results: any[] = [];
    for (const p of profiles) {
      const digest = await buildDigestForUser(sb, p.id);
      const row: any = { userId: p.id, email: null, whatsapp: null };
      if (p.digest_email && p.email) {
        try {
          row.email = await sendEmail(p.email, digest.subject, digest.text);
        } catch (e: any) {
          row.email = { error: e?.message };
        }
      }
      if (p.digest_whatsapp && p.whatsapp_phone) {
        try {
          row.whatsapp = await sendWhatsAppText(digits(p.whatsapp_phone), digest.text);
        } catch (e: any) {
          row.whatsapp = { error: e?.message };
        }
      }
      results.push(row);
    }

    res.status(200).json({ ok: true, sent: results.length, results });
  } catch (e: any) {
    console.error("daily-digest", e);
    res.status(500).json({ error: e?.message || "Digest failed" });
  }
}
