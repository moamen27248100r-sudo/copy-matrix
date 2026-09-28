import { createClient } from "@/lib/supabase/server";
import { fetchClosedTrades } from "@/lib/my-trades";

const csv = (v: string | number | null) => {
  const s = v == null ? "" : String(v);
  // Neutralize spreadsheet formula injection, then quote.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const sp = new URL(request.url).searchParams;
  const days = Number(sp.get("days"));
  const { trades } = await fetchClosedTrades(supabase, user.id, {
    symbol: sp.get("symbol") || undefined,
    provider: sp.get("provider") || undefined,
    result: sp.get("result") || undefined,
    days: Number.isFinite(days) && days > 0 ? days : undefined,
  });

  const header = ["opened_at", "closed_at", "trader", "symbol", "side", "size", "entry", "exit", "pnl", "return_pct"];
  const lines = [header.join(",")].concat(
    trades.map((t) =>
      [t.openedAt, t.closedAt, t.providerName, t.symbol, t.side, t.size, t.entry, t.exit, t.pnl.toFixed(2), t.pct.toFixed(2)]
        .map(csv)
        .join(","),
    ),
  );
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="trades.csv"',
    },
  });
}
