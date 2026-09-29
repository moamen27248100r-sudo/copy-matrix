import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { fetchLeadTraderHistory } from "@/lib/lead-trader-history";

const csv = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) return new Response("Not a lead trader", { status: 403 });

  const sp = new URL(request.url).searchParams;
  const days = Number(sp.get("days"));
  const { rows } = await fetchLeadTraderHistory(supabase, providerId, {
    symbol: sp.get("symbol") || undefined,
    result: sp.get("result") || undefined,
    days: Number.isFinite(days) && days > 0 ? days : undefined,
  });

  const header = ["opened_at", "closed_at", "symbol", "side", "entry", "exit", "return_pct", "copiers"];
  const lines = [header.join(",")].concat(
    rows.map((r) => [r.openedAt, r.closedAt, r.symbol, r.side, r.entryPrice, r.exitPrice, r.pct.toFixed(2), r.copiers].map(csv).join(",")),
  );
  return new Response("﻿" + lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="lead-trades.csv"' },
  });
}
