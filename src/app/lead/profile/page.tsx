import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { saveLeadPublicProfile, uploadLeadAvatar } from "@/app/lead/profile/actions";
import { TraderAvatar } from "@/components/TraderAvatar";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadProfileTitle"), description: t("leadProfileDesc") };
}

export default async function LeadProfilePage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const { err, ok } = await searchParams;
  const t = await getTranslations("LeadTrader.profile");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Flead%2Fprofile");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ data: provider }, { data: lt }] = await Promise.all([
    supabase.from("providers").select("display_name, bio, avatar_url, symbol_bias, min_copy_amount, profit_share_pct").eq("id", providerId).single(),
    supabase.from("lead_trader_profiles").select("strategy_description, risk_disclosure, accepting_followers").eq("provider_id", providerId).maybeSingle(),
  ]);

  const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-base";
  const markets = (provider?.symbol_bias ?? []) as string[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page-title">{t("title")}</h1>
        <Link href={`/trader/${providerId}`} className="text-sm text-accent hover:underline">
          {t("viewPublic")}
        </Link>
      </div>
      {err && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{t(`err_${err}`)}</p>}
      {ok && <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{t("saved")}</p>}

      <form action={uploadLeadAvatar} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-surface p-4">
        <TraderAvatar providerId={providerId} name={provider?.display_name ?? ""} avatarUrl={provider?.avatar_url ?? null} size={64} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="avatar">
            {t("avatar")}
          </label>
          <input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
          <p className="text-xs text-muted">{t("avatarHint")}</p>
        </div>
        <button type="submit" className="rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent">
          {t("upload")}
        </button>
      </form>

      <form action={saveLeadPublicProfile} className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
        <label className="flex flex-col gap-1.5 text-sm">
          {t("bio")}
          <textarea name="bio" rows={3} maxLength={600} defaultValue={provider?.bio ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("strategy")}
          <textarea name="strategy" rows={5} maxLength={1500} defaultValue={lt?.strategy_description ?? ""} placeholder={t("strategyPlaceholder")} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          {t("risk")}
          <textarea name="risk" rows={3} maxLength={1000} defaultValue={lt?.risk_disclosure ?? ""} placeholder={t("riskPlaceholder")} className={field} />
        </label>
        <label className="flex items-start gap-2 rounded-lg border border-border bg-background p-3 text-sm">
          <input type="checkbox" name="acceptingFollowers" defaultChecked={lt?.accepting_followers ?? true} className="mt-1" />
          <span>
            <span className="font-medium">{t("accepting")}</span>
            <span className="block text-xs text-muted">{t("acceptingHint")}</span>
          </span>
        </label>
        <button type="submit" className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground">
          {t("save")}
        </button>
      </form>

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5 text-sm">
        <h2 className="text-section-title">{t("publicFacts")}</h2>
        <p>
          <span className="text-muted">{t("assets")}: </span>
          {markets.length ? markets.join(", ") : "—"}
        </p>
        <p>
          <span className="text-muted">{t("minCopy")}: </span>
          <span dir="ltr">${Number(provider?.min_copy_amount ?? 0)}</span>
        </p>
        <p>
          <span className="text-muted">{t("profitShare")}: </span>
          <span dir="ltr">{Number(provider?.profit_share_pct ?? 0)}%</span>
        </p>
        <Link href="/lead/settings" className="self-start text-accent hover:underline">
          {t("editInSettings")}
        </Link>
      </section>
    </div>
  );
}
