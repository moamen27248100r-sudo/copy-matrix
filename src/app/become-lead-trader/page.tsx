import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { submitLeadTraderApplication } from "@/app/become-lead-trader/actions";
import { LEAD_TRADER_MARKETS, LEAD_TRADER_STYLES, LEAD_TRADER_MIN_INVESTMENT_DEFAULT } from "@/config/lead-trader";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("becomeLeadTraderTitle"), description: t("becomeLeadTraderDesc") };
}

export default async function BecomeLeadTraderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const t = await getTranslations("LeadTrader.apply");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let status: { kind: "none" | "pending" | "approved" | "rejected"; reason?: string | null } = { kind: "none" };
  if (user) {
    const [{ data: profile }, { data: application }] = await Promise.all([
      supabase.from("profiles").select("is_lead_trader").eq("id", user.id).single(),
      supabase
        .from("lead_trader_applications")
        .select("status, rejection_reason")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (profile?.is_lead_trader) status = { kind: "approved" };
    else if (application?.status === "pending") status = { kind: "pending" };
    else if (application?.status === "rejected") status = { kind: "rejected", reason: application.rejection_reason };
  }

  const benefits = [t("benefit1"), t("benefit2"), t("benefit3"), t("benefit4")];
  const requirements = [t("req1"), t("req2"), t("req3")];

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>

        {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {success && <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{t("submitted")}</p>}

        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
          {benefits.map((b) => (
            <div key={b} className="flex items-start gap-2 text-sm">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              {b}
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-section-title">{t("requirementsTitle")}</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            {requirements.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </section>

        {status.kind === "approved" ? (
          <a href="/lead" className="rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground">
            {t("goToCenter")}
          </a>
        ) : status.kind === "pending" ? (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{t("pendingNotice")}</p>
        ) : (
          <form action={submitLeadTraderApplication} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
            {status.kind === "rejected" && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {t("rejectedNotice")}
                {status.reason ? ` — ${status.reason}` : ""}
              </p>
            )}
            <label className="flex flex-col gap-1.5 text-sm">
              {t("displayNameLabel")}
              <input name="displayName" type="text" required className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              {t("bioLabel")}
              <textarea name="bio" required rows={3} className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="mb-1">{t("marketsLabel")}</legend>
              <div className="flex flex-wrap gap-3">
                {LEAD_TRADER_MARKETS.map((m) => (
                  <label key={m} className="flex items-center gap-1.5">
                    <input type="checkbox" name={`market_${m}`} />
                    {t(`market_${m}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm">
              {t("styleLabel")}
              <select name="tradingStyle" className="rounded-lg border border-border bg-background px-3 py-2">
                <option value="">{t("styleAny")}</option>
                {LEAD_TRADER_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {t(`style_${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              {t("contactLabel")}
              <input name="contactInfo" type="text" placeholder={t("contactPlaceholder")} className="rounded-lg border border-border bg-background px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              {t("minInvestmentLabel")}
              <input
                name="minInvestment"
                type="number"
                min={1}
                defaultValue={LEAD_TRADER_MIN_INVESTMENT_DEFAULT}
                className="rounded-lg border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="agree" required className="mt-0.5" />
              {t("agreeLabel")}
            </label>
            <button type="submit" className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover">
              {t("submit")}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
