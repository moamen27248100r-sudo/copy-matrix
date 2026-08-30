"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendSupportEmail } from "@/lib/email";

function traderFollowEmailHtml(provider: {
  display_name: string | null;
  bio: string | null;
  tier: string | null;
  risk_level: string | null;
  win_rate_pct: number | null;
  avg_daily_return_pct: number | null;
  total_profit: number | null;
  followers_count: number | null;
  closed_signals: number | null;
  joined_at: string;
}) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px;color:#666;">${label}</td><td style="padding:6px 12px;font-weight:600;">${value}</td></tr>`;

  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:480px;margin:auto;">
      <h2 style="margin-bottom:4px;">أنت الآن تتابع ${provider.display_name}</h2>
      <p style="color:#666;">إليك أداء هذا المتداول بالكامل، وسنوافيك بتحديثاته أولًا بأول.</p>
      ${provider.bio ? `<p style="color:#444;">${provider.bio}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;">
        ${row("الفئة", provider.tier ?? "—")}
        ${row("مستوى المخاطرة", provider.risk_level ?? "—")}
        ${row("نسبة النجاح الكلية", provider.win_rate_pct != null ? `${provider.win_rate_pct}%` : "—")}
        ${row("متوسط العائد اليومي", provider.avg_daily_return_pct != null ? `${provider.avg_daily_return_pct}%` : "—")}
        ${row("إجمالي الأرباح المحققة", provider.total_profit != null ? `$${Number(provider.total_profit).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—")}
        ${row("عدد الناسخين", provider.followers_count != null ? String(provider.followers_count) : "—")}
        ${row("عدد الصفقات المغلقة", provider.closed_signals != null ? String(provider.closed_signals) : "—")}
        ${row("عضو منذ", new Date(provider.joined_at).toLocaleDateString("ar-EG", { year: "numeric", month: "long" }))}
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px;">
        هذه رسالة متابعة أداء تلقائية من Copy Matrix، ولا تعني نسخ صفقات هذا المتداول تلقائيًا.
      </p>
    </div>
  `;
}

export async function followProvider(formData: FormData) {
  const providerId = formData.get("providerId") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/signup?next=${encodeURIComponent(`/trader/${providerId}#copy`)}`);

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
  const providerId = formData.get("providerId") as string;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/signup?next=${encodeURIComponent(`/trader/${providerId}`)}`);

  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id: user.id, provider_id: providerId }, { onConflict: "follower_id,provider_id" });

  if (!error && user.email) {
    const { data: provider } = await supabase
      .from("provider_cards")
      .select(
        "display_name, bio, tier, risk_level, win_rate_pct, avg_daily_return_pct, total_profit, followers_count, closed_signals, joined_at",
      )
      .eq("provider_id", providerId)
      .single();

    if (provider) {
      try {
        await sendSupportEmail({
          to: user.email,
          subject: `أنت الآن تتابع ${provider.display_name} على Copy Matrix`,
          html: traderFollowEmailHtml(provider),
        });
      } catch (emailError) {
        console.error("[followTrader] failed to send follow email", emailError);
      }
    }
  }

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
