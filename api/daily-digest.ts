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

  const { data: holdings } = await sb
    .from("portfolio_holdings")
    .select("symbol, quantity, buy_price, live_price, currency, status")
    .in("workspace_id", wids)
    .eq("status", "active")
    .limit(200);

  let dayNote = "Portfolio: open Haven for live marks.";
  if (holdings?.length) {
    let invested = 0;
    let market = 0;
    for (const h of holdings) {
      const q = Number(h.quantity) || 0;
      const b = Number(h.buy_price) || 0;
      const l = Number(h.live_price ?? h.buy_price) || 0;
      invested += b * q;
      market += l * q;
    }
    if (invested > 0) {
      const pct = ((market - invested) / invested) * 100;
      dayNote = `Portfolio mark vs cost: ${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% (indicative, mixed FX).`;
    }
  }

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
  lines.push("");
  lines.push(dayNote);
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
