import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, updateAccountType, changePassword } from "@/app/settings/actions";
import { AppNav } from "@/components/AppNav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { RiskQuestionnaire } from "@/components/RiskQuestionnaire";
import { setTimezone } from "@/app/actions/locale";
import type { Locale } from "@/i18n/locales";
import { hasVerifiedTotp } from "@/lib/mfa";

const TIMEZONES = [
  "UTC", "Africa/Cairo", "Africa/Lagos", "Africa/Nairobi", "Asia/Riyadh", "Asia/Dubai", "Asia/Karachi",
  "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Jakarta", "Asia/Ho_Chi_Minh", "Asia/Shanghai",
  "Europe/London", "Europe/Paris", "Europe/Istanbul", "America/Sao_Paulo", "America/New_York",
  "America/Chicago", "America/Los_Angeles",
];

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("settingsTitle"), description: t("settingsDesc") };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const t = await getTranslations("Settings");
  const tMenu = await getTranslations("AccountMenu");
  const locale = (await getLocale()) as Locale;
  const tz = (await cookies()).get("tz")?.value ?? "UTC";
  const tzOptions = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fsettings");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, account_type, account_number")
    .eq("id", user.id)
    .single();

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {t("savedSuccess")}
          </p>
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">{t("profileTitle")}</h2>
          <p className="text-xs text-muted">{user.email}</p>
          {profile?.account_number != null && (
            <p className="text-xs text-muted" dir="ltr">
              {tMenu("accountNumber")} <span className="font-mono text-foreground/80">#{profile.account_number}</span>
            </p>
          )}
          <form action={updateProfile} className="flex flex-col gap-3">
            <input
              name="displayName"
              type="text"
              defaultValue={profile?.display_name ?? ""}
              placeholder={t("fullNamePlaceholder")}
              required
              className="rounded border border-border bg-background px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {t("saveName")}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">{t("accountTypeTitle")}</h2>
          <p className="text-xs text-muted">
            {t("accountTypeDesc")}
          </p>
          <form action={updateAccountType} className="flex flex-col gap-2">
            <label
              className={
                (profile?.account_type ?? "demo") === "demo"
                  ? "flex items-center gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
                  : "flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
              }
            >
              <input
                type="radio"
                name="accountType"
                value="demo"
                defaultChecked={(profile?.account_type ?? "demo") === "demo"}
              />
              <span className="font-semibold text-warning">{t("demoAccount")}</span>
              <span className="text-xs text-muted">{t("demoAccountDesc")}</span>
            </label>
            <label
              className={
                profile?.account_type === "real"
                  ? "flex items-center gap-2 rounded border border-success/40 bg-success/10 px-3 py-2 text-sm"
                  : "flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
              }
            >
              <input type="radio" name="accountType" value="real" defaultChecked={profile?.account_type === "real"} />
              <span className="font-semibold text-success">{t("realAccount")}</span>
              <span className="text-xs text-muted">{t("realAccountDesc")}</span>
            </label>
            <button
              type="submit"
              className="mt-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {t("saveAccountType")}
            </button>
          </form>
        </section>

        <section id="change-password" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">{t("changePasswordTitle")}</h2>
          <form action={changePassword} className="flex flex-col gap-3">
            <input
              name="password"
              type="password"
              placeholder={t("newPasswordPlaceholder")}
              required
              minLength={6}
              className="rounded border border-border bg-background px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {t("updatePassword")}
            </button>
          </form>
        </section>

        <RiskQuestionnaire current={(await cookies()).get("risk_profile")?.value} />

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">{t("languageTimezoneTitle")}</h2>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">{t("languageLabel")}</span>
            <LanguageSwitcher currentLocale={locale} />
          </div>
          <form action={setTimezone} className="flex flex-col gap-2">
            <label className="text-sm text-muted" htmlFor="timezone">
              {t("timezoneLabel")}
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={tz}
              className="rounded border border-border bg-background px-3 py-2 text-base"
            >
              {tzOptions.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
              {t("saveTimezone")}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">{t("securityTitle")}</h2>
          <div className="flex flex-col gap-2 rounded border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{t("twoFactorTitle")}</span>
              {hasVerifiedTotp(user) && (
                <span className="rounded-full border border-up/40 bg-up/10 px-2 py-0.5 text-[10px] font-semibold text-up">
                  {t("twoFactorOn")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">{t("twoFactorDesc")}</p>
            <Link href="/account/security" className="rounded border border-border px-3 py-2 text-center text-sm transition hover:bg-white/5">
              {hasVerifiedTotp(user) ? t("twoFactorManage") : t("twoFactorEnable")}
            </Link>
          </div>
          <div className="flex flex-col gap-2 rounded border border-border bg-background p-3">
            <span className="text-sm font-medium">{t("sessionsTitle")}</span>
            <p className="text-xs text-muted">{t("sessionsDesc")}</p>
            <Link href="/account/sessions" className="rounded border border-border px-3 py-2 text-center text-sm transition hover:bg-white/5">
              {t("sessionsManage")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
