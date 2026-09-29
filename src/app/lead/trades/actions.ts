"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "XAUUSD", "EURUSD", "GBPUSD", "USDJPY"];

export async function placeLeadOrder(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Actions.leadTrader");
  const symbol = formData.get("symbol") as string;
  const side = formData.get("side") as string;
  const size = Number(formData.get("size"));
  const stopLossRaw = ((formData.get("stopLoss") as string) ?? "").trim();
  const takeProfitRaw = ((formData.get("takeProfit") as string) ?? "").trim();

  if (!ALLOWED_SYMBOLS.includes(symbol) || !["buy", "sell"].includes(side) || !Number.isFinite(size) || size <= 0) {
    redirect("/lead/trades?error=" + encodeURIComponent(t("orderInvalid")));
  }

  const { error } = await supabase.rpc("lead_trader_open_order", {
    p_symbol: symbol,
    p_side: side,
    p_size: size,
    p_stop_loss: stopLossRaw ? Number(stopLossRaw) : null,
    p_take_profit: takeProfitRaw ? Number(takeProfitRaw) : null,
  });

  if (error) {
    redirect("/lead/trades?error=" + encodeURIComponent(t("orderFailed") + ": " + error.message));
  }

  revalidatePath("/lead/trades");
  revalidatePath("/lead");
}

export async function closeLeadOrder(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("Actions.leadTrader");
  const signalId = formData.get("signalId") as string;

  const { error } = await supabase.rpc("lead_trader_close_order", { p_signal_id: signalId });
  if (error) {
    redirect("/lead/trades?error=" + encodeURIComponent(t("closeFailed")));
  }

  revalidatePath("/lead/trades");
  revalidatePath("/lead");
}
