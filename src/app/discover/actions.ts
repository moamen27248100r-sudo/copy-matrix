"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { sendSupportEmail } from "@/lib/email";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { formatDate } from "@/lib/locale-format";
import { translateBio } from "@/lib/bio-translations";

type FollowEmailTranslator = (key: string, values?: Record<string, string | number>) => string;

function traderFollowEmailHtml(
  provider: {
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
  },
  t: FollowEmailTranslator,
  tBio: (key: string) => string,
  locale: Locale,
) {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px;color:#666;">${label}</td><td style="padding:6px 12px;font-weight:600;">${value}</td></tr>`;
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return `
    <div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;max-width:480px;margin:auto;">
      <h2 style="margin-bottom:4px;">${t("heading", { name: provider.display_name ?? "" })}</h2>
      <p style="color:#666;">${t("intro")}</p>
      ${provider.bio ? `<p style="color:#444;">${translateBio(provider.bio, tBio)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;">
        ${row(t("tier"), provider.tier ?? "—")}
        ${row(t("riskLevel"), provider.risk_level ?? "—")}
        ${row(t("winRate"), provider.win_rate_pct != null ? `${provider.win_rate_pct}%` : "—")}
        ${row(t("avgReturn"), provider.avg_daily_return_pct != null ? `${provider.avg_daily_return_pct}%` : "—")}
        ${row(t("totalProfit"), provider.total_profit != null ? `$${Number(provider.total_profit).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—")}
        ${row(t("followersCount"), provider.followers_count != null ? String(provider.followers_count) : "—")}
        ${row(t("closedSignals"), provider.closed_signals != null ? String(provider.closed_signals) : "—")}
        ${row(t("memberSinceLabel"), formatDate(provider.joined_at, locale, { year: "numeric", month: "long" }))}
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px;">
        ${t("footer")}
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

  const td = await getTranslations("Actions.discover");

  const allocatedAmount = Number(formData.get("allocatedAmount"));

  if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0) {
    redirect(`/trader/${providerId}?error=${encodeURIComponent(td("copyAmountInvalid"))}`);
  }

  // Whether this call is starting a brand-new copy or editing an existing
  // one, purely for the success-redirect message below -- every actual
  // business rule (balance, minimum, single-active-copy, grace period,
  // stopped leader) is re-validated inside start_or_update_copy() itself
  // (security definer, uses auth.uid() internally), not trusted from here.
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("follower_id", user.id)
    .eq("provider_id", providerId)
    .eq("is_active", true)
    .maybeSingle();
  const isStarting = !existingSub;

  const { error } = await supabase.rpc("start_or_update_copy", {
    p_provider_id: providerId,
    p_allocated_amount: allocatedAmount,
  });

  if (error) {
    if (error.code === "CM003") {
      redirect(`/trader/${providerId}?error=${encodeURIComponent(td("traderStopped"))}`);
    }
    if (error.code === "CM004") {
      redirect(`/trader/${providerId}?error=${encodeURIComponent(td("copyAmountUpdateBlocked"))}`);
    }
    if (error.code === "CM005") {
      const { data: otherSub } = await supabase
        .from("subscriptions")
        .select("provider_id")
        .eq("follower_id", user.id)
        .eq("is_active", true)
        .neq("provider_id", providerId)
        .maybeSingle();
      const { data: otherProvider } = otherSub
        ? await supabase.from("provider_cards").select("display_name").eq("provider_id", otherSub.provider_id).single()
        : { data: null };
      redirect(
        `/trader/${providerId}?error=${encodeURIComponent(
          td("alreadyCopyingOther", { name: otherProvider?.display_name ?? td("anotherTraderFallback") }),
        )}`,
      );
    }
    if (error.code === "CM006") {
      redirect(`/trader/${providerId}?error=${encodeURIComponent(td("copyAmountExceedsBalance"))}`);
    }
    if (error.code === "CM007") {
      const { data: provider } = await supabase.from("providers").select("min_copy_amount").eq("id", providerId).single();
      redirect(
        `/trader/${providerId}?error=${encodeURIComponent(
          td("copyAmountBelowMinimum", { amount: `$${Number(provider?.min_copy_amount ?? 0).toLocaleString("en-US")}` }),
        )}`,
      );
    }
    redirect(`/trader/${providerId}?error=${encodeURIComponent(td("copyFailed"))}`);
  }

  revalidatePath("/discover");
  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  revalidatePath(`/trader/${providerId}`);

  redirect(isStarting ? `/trader/${providerId}?success=started` : `/trader/${providerId}`);
}

export async function unfollowProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const providerId = formData.get("providerId") as string;
  const returnTo = (formData.get("returnTo") as string) || "/portfolio";

  // stop_copy (security definer) blocks the transition while this
  // subscription still has an open copied position, instead of the old
  // plain .update({is_active:false}) — see 0091_reserve_allocated_capital.sql.
  const { error } = await supabase.rpc("stop_copy", { p_provider_id: providerId });

  if (error) {
    // stop_copy() raises its own Arabic-only exception message -- not
    // locale-aware, so surface our own translated equivalent instead of the
    // raw DB text (same condition, same message, just translatable).
    const td = await getTranslations("Actions.discover");
    redirect(`${returnTo}?error=${encodeURIComponent(td("stopCopyBlocked"))}`);
  }

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
        const locale = (await getLocale()) as Locale;
        const tEmail = await getTranslations("FollowEmail");
        const tBio = await getTranslations("Bios");
        await sendSupportEmail({
          to: user.email,
          subject: tEmail("subject", { name: provider.display_name ?? "" }),
          html: traderFollowEmailHtml(provider, tEmail, tBio, locale),
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
