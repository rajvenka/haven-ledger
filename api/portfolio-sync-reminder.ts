/**
 * Weekly reminder to sync Zerodha / Groww. Writes an in-app notification for every member of a
 * workspace that has a Zerodha or Groww broker connection.
 * Auth: Authorization: Bearer CRON_SECRET (Vercel cron sends this automatically).
 * Cron: 30 8 * * 5  (Friday 08:30 UTC = Friday 2:00 PM India time)
 */
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key);
}

const LABEL: Record<string, string> = { zerodha: "Zerodha", groww: "Groww" };

export default async function handler(req: any, res: any) {
  try {
    const secret = process.env.CRON_SECRET || "";
    const auth = String(req.headers?.authorization || "");
    if (!secret || auth !== `Bearer ${secret}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const sb = admin();
    const { data: conns, error: cErr } = await sb
      .from("portfolio_broker_connections")
      .select("workspace_id, broker_type")
      .in("broker_type", ["zerodha", "groww"]);
    if (cErr) throw cErr;

    const brokersByWs = new Map<string, Set<string>>();
    (conns || []).forEach((c: any) => {
      const t = String(c.broker_type || "").toLowerCase();
      if (!LABEL[t] || !c.workspace_id) return;
      brokersByWs.set(c.workspace_id, (brokersByWs.get(c.workspace_id) || new Set()).add(LABEL[t]));
    });
    const wids = Array.from(brokersByWs.keys());
    if (!wids.length) { res.status(200).json({ ok: true, notified: 0 }); return; }

    const { data: members, error: mErr } = await sb.from("workspace_members").select("workspace_id, user_id").in("workspace_id", wids);
    if (mErr) throw mErr;
    const brokersByUser = new Map<string, Set<string>>();
    (members || []).forEach((m: any) => {
      const set = brokersByUser.get(m.user_id) || new Set<string>();
      brokersByWs.get(m.workspace_id)?.forEach((b) => set.add(b));
      brokersByUser.set(m.user_id, set);
    });
    const userIds = Array.from(brokersByUser.keys());
    const { data: profiles } = await sb.from("profiles").select("id, app_notifications_enabled").in("id", userIds);
    const off = new Set((profiles || []).filter((p: any) => p.app_notifications_enabled === false).map((p: any) => p.id));

    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const { data: already } = await sb.from("app_notifications").select("user_id").eq("title", "Weekly broker sync").gte("date", dayStart.toISOString()).in("user_id", userIds);
    const done = new Set((already || []).map((r: any) => r.user_id));

    const rows = userIds.filter((u) => !off.has(u) && !done.has(u)).map((u) => {
      const names = Array.from(brokersByUser.get(u)!).sort().join(" / ");
      return {
        user_id: u,
        title: "Weekly broker sync",
        message: `Time to sync ${names}. Open Portfolio, tap the refresh button and choose "Refresh from brokers" (Zerodha needs a fresh login first).`,
        date: new Date().toISOString(),
        read: false,
        type: "info",
      };
    });
    if (rows.length) {
      const { error: iErr } = await sb.from("app_notifications").insert(rows);
      if (iErr) throw iErr;
    }
    res.status(200).json({ ok: true, notified: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "failed" });
  }
}
