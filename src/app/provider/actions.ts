"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function becomeProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.from("providers").insert({
    user_id: user.id,
    bio: (formData.get("bio") as string) || null,
  });

  if (error) {
    redirect(`/provider?error=${encodeURIComponent(error.message)}`);
  }

  await supabase
    .from("profiles")
    .update({ is_provider: true })
    .eq("id", user.id);

  revalidatePath("/provider");
  revalidatePath("/discover");
}

export async function publishSignal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!provider) redirect("/provider");

  const entryPrice = Number(formData.get("entryPrice"));
  const stopLoss = formData.get("stopLoss");
  const takeProfit = formData.get("takeProfit");

  const { error } = await supabase.from("signals").insert({
    provider_id: provider.id,
    symbol: (formData.get("symbol") as string).toUpperCase().trim(),
    side: formData.get("side") as string,
    entry_price: entryPrice,
    stop_loss: stopLoss ? Number(stopLoss) : null,
    take_profit: takeProfit ? Number(takeProfit) : null,
  });

  if (error) {
    redirect(`/provider?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/provider");
  revalidatePath("/discover");
}

export async function closeSignal(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!provider) redirect("/provider");

  const signalId = formData.get("signalId") as string;
  const exitPrice = Number(formData.get("exitPrice"));

  await supabase
    .from("signals")
    .update({ status: "closed", exit_price: exitPrice, closed_at: new Date().toISOString() })
    .eq("id", signalId)
    .eq("provider_id", provider.id);

  revalidatePath("/provider");
  revalidatePath("/discover");
}
