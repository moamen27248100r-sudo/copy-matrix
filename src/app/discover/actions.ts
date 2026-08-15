"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function followProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const providerId = formData.get("providerId") as string;
  const allocatedAmount = Number(formData.get("allocatedAmount"));
  // Stop-loss is no longer a customer-facing setting — every copy relationship
  // gets the same default protection threshold instead of asking for it upfront.
  const maxDrawdownPct = 50;

  if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0) {
    redirect(`/trader/${providerId}?error=${encodeURIComponent("مبلغ النسخ يجب أن يكون رقمًا أكبر من صفر.")}`);
  }

  const [{ data: profile }, { data: provider }, { data: otherSub }] = await Promise.all([
    supabase.from("profiles").select("balance").eq("id", user.id).single(),
    supabase.from("providers").select("min_copy_amount").eq("id", providerId).single(),
    supabase
      .from("subscriptions")
      .select("provider_id")
      .eq("follower_id", user.id)
      .eq("is_active", true)
      .neq("provider_id", providerId)
      .maybeSingle(),
  ]);

  if (otherSub) {
    const { data: otherProvider } = await supabase
      .from("provider_cards")
      .select("display_name")
      .eq("provider_id", otherSub.provider_id)
      .single();
    redirect(
      `/trader/${providerId}?error=${encodeURIComponent(
        `أنت تنسخ حاليًا ${otherProvider?.display_name ?? "متداولًا آخر"}. يمكنك نسخ متداول واحد فقط في نفس الوقت — أوقف النسخ أولاً من محفظتك.`,
      )}`,
    );
  }

  if (profile && allocatedAmount > profile.balance) {
    redirect(`/trader/${providerId}?error=${encodeURIComponent("مبلغ النسخ أكبر من رصيدك المتاح.")}`);
  }

  if (provider && allocatedAmount < provider.min_copy_amount) {
    redirect(
      `/trader/${providerId}?error=${encodeURIComponent(
        `مبلغ النسخ أقل من الحد الأدنى لهذا المتداول ($${Number(provider.min_copy_amount).toLocaleString("en-US")}).`,
      )}`,
    );
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(
      {
        follower_id: user.id,
        provider_id: providerId,
        is_active: true,
        allocated_amount: allocatedAmount,
        max_drawdown_pct: maxDrawdownPct,
      },
      { onConflict: "follower_id,provider_id" },
    );

  if (error) {
    redirect(`/trader/${providerId}?error=${encodeURIComponent("تعذّر نسخ المتداول. حاول مرة أخرى.")}`);
  }

  revalidatePath("/discover");
  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  revalidatePath(`/trader/${providerId}`);
}

export async function unfollowProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const providerId = formData.get("providerId") as string;

  await supabase
    .from("subscriptions")
    .update({ is_active: false })
    .eq("follower_id", user.id)
    .eq("provider_id", providerId);

  revalidatePath("/discover");
  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  revalidatePath(`/trader/${providerId}`);
}

// "متابعة" (follow) is separate from "نسخ" (copy): free, unlimited, no
// money involved — it just lets a customer keep an eye on a trader's
// activity from their portfolio without allocating any funds.
export async function followTrader(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const providerId = formData.get("providerId") as string;

  await supabase
    .from("follows")
    .upsert({ follower_id: user.id, provider_id: providerId }, { onConflict: "follower_id,provider_id" });

  revalidatePath("/discover");
  revalidatePath("/portfolio");
  revalidatePath(`/trader/${providerId}`);
}

export async function unfollowTrader(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const providerId = formData.get("providerId") as string;

  await supabase.from("follows").delete().eq("follower_id", user.id).eq("provider_id", providerId);

  revalidatePath("/discover");
  revalidatePath("/portfolio");
  revalidatePath(`/trader/${providerId}`);
}
