/**
 * WhatsApp Cloud API webhook (Meta).
 *
 * GET  — Meta subscription verification
 * POST — inbound messages: verification codes + simple commands
 *
 * Env:
 *   WHATSAPP_VERIFY_TOKEN
 *   WHATSAPP_TOKEN
 *   WHATSAPP_PHONE_NUMBER_ID
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
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

async function sendWhatsAppText(toDigits: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    console.warn("WhatsApp send skipped — token/phone id missing");
    return { skipped: true };
  }
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
    console.error("WhatsApp send failed", data);
    throw new Error(data?.error?.message || "WhatsApp send failed");
  }
  return data;
}

async function tryLinkWithCode(from: string, text: string) {
  const code = text.trim();
  if (!/^\d{6}$/.test(code)) return false;
  const sb = admin();
  const phone = digits(from);
  const { data: rows, error } = await sb
    .from("whatsapp_verifications")
    .select("id, user_id, phone, code, created_at")
    .eq("code", code)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = rows?.[0];
  if (!row) {
    await sendWhatsAppText(phone, "That code was not found. Open Haven → Account → Connect WhatsApp and try again.");
    return true;
  }
  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > 30 * 60 * 1000) {
    await sendWhatsAppText(phone, "That code expired. Generate a new one in Haven Account settings.");
    return true;
  }
  const { error: upErr } = await sb.from("profiles").update({ whatsapp_phone: phone }).eq("id", row.user_id);
  if (upErr) throw upErr;
  await sb.from("whatsapp_verifications").delete().eq("id", row.id);
  await sendWhatsAppText(
    phone,
    "Linked to Haven Ledger. Enable daily WhatsApp digests in Account settings.\nTry: help"
  );
  return true;
}

async function handleCommand(from: string, text: string) {
  const phone = digits(from);
  const sb = admin();
  const { data: profile } = await sb
    .from("profiles")
    .select("id, display_name, digest_whatsapp")
    .eq("whatsapp_phone", phone)
    .maybeSingle();

  if (!profile) {
    await sendWhatsAppText(
      phone,
      "This number is not linked. In Haven: Account → Connect WhatsApp → enter this number → text the 6-digit code here."
    );
    return;
  }

  const t = text.trim().toLowerCase();
  if (t === "help" || t === "hi" || t === "hello") {
    await sendWhatsAppText(
      phone,
      "Haven Ledger WhatsApp\n• help — this message\n• due — bills due soon\n• Daily digests: Account → Daily digests"
    );
    return;
  }

  if (t === "due" || t.includes("due")) {
    const { data: memberships } = await sb
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", profile.id);
    const wids = (memberships || []).map((m: any) => m.workspace_id).filter(Boolean);
    if (!wids.length) {
      await sendWhatsAppText(phone, "No workspace found for your account.");
      return;
    }
    const { data: pays } = await sb
      .from("recurring_payments")
      .select("name, amount, next_due_date, currency, is_paid")
      .in("workspace_id", wids)
      .limit(50);
    const today = new Date().toISOString().slice(0, 10);
    const open = (pays || []).filter((p: any) => !p.is_paid);
    const due = open
      .filter((p: any) => p.next_due_date && String(p.next_due_date).slice(0, 10) <= today)
      .slice(0, 8);
    if (!due.length) {
      await sendWhatsAppText(phone, "Nothing overdue or due today in your workspaces.");
      return;
    }
    const lines = due.map(
      (p: any) =>
        `• ${p.name || "Bill"} ${p.amount != null ? p.amount : ""} ${p.currency || ""} (${String(p.next_due_date).slice(0, 10)})`
    );
    await sendWhatsAppText(phone, `Due / overdue:\n${lines.join("\n")}`);
    return;
  }

  await sendWhatsAppText(phone, `Got it. Try "due" or "help".`);
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "GET") {
      const mode = req.query["hub.mode"];
      const token = req.query["hub.verify_token"];
      const challenge = req.query["hub.challenge"];
      if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        res.status(200).send(challenge);
        return;
      }
      res.status(403).send("Forbidden");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const entries = body.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          const from = msg.from;
          const text =
            msg.text?.body ||
            msg.button?.text ||
            msg.interactive?.button_reply?.title ||
            "";
          if (!from || !text) continue;
          const linked = await tryLinkWithCode(from, text);
          if (!linked) await handleCommand(from, text);
        }
      }
    }
    res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("whatsapp-webhook", e);
    res.status(500).json({ error: e?.message || "Webhook error" });
  }
}
