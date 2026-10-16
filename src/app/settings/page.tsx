import Link from "next/link";
import { AppMain } from "@/components/AppMain";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, updatePhone } from "@/app/settings/actions";
import { sendEmailVerification, verifyEmailCode } from "@/app/auth/actions";
import { PhoneInput } from "@/components/PhoneInput";
import { SubmitButton } from "@/components/SubmitButton";
import { AppNav } from "@/components/AppNav";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { RiskQuestionnaire } from "@/components/RiskQuestionnaire";
import { setTimezone } from "@/app/actions/locale";
import type { Locale } from "@/i18n/locales";
import { hasVerifiedTotp } from "@/lib/mfa";
import { LossAlertsSection } from "@/components/LossAlertsSection";
import { InstallApp } from "@/components/pwa/InstallApp";
import { PushPermission } from "@/components/pwa/PushPermission";
import { FlashMessage } from "@/components/ui/Toast";

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
  searchParams: Promise<{ error?: string; success?: string; verify?: string; field?: string }>;
}) {
  const { error, success, verify, field } = await searchParams;
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
    .select("display_name, account_type, account_number, phone, email_verified_at")
    .eq("id", user.id)
    .single();

  return (
    <>
      <AppNav />
      <AppMain>
        <h1 className="text-page-title">{t("title")}</h1>

        {error && !field && (
          <FlashMessage tone="error">
            {error}
          </FlashMessage>
        )}
        {success && (
          <FlashMessage tone="success">
            {t("savedSuccess")}
          </FlashMessage>
        )}

        <nav aria-label={t("sectionsNav")} className="no-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6 sm:mx-0 sm:flex-wrap sm:px-0">
          {[
            ["profile", t("profileTitle")],
            ["notifications", t("notificationPrefsTitle")],
            ["alerts", t("lossAlertsTitle")],
            ["risk", t("riskTitle")],
            ["language", t("languageTimezoneTitle")],
            ["security", t("securityTitle")],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:border-accent/50 hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>

        <section id="profile" className="flex scroll-mt-20 flex-col gap-4 rounded-[20px] border border-border bg-surface p-5">
          <h2 className="text-section-title">{t("profileTitle")}</h2>
          {(!profile?.phone || !profile?.display_name) && <p className="text-xs text-muted">{t("profileCompleteHint")}</p>}
          {profile?.account_number != null && (
            <p className="text-xs text-muted">
              {tMenu("accountNumber")} <span dir="ltr" className="inline-block font-mono text-muted">#{profile.account_number}</span>
            </p>
          )}

          <div className="flex flex-col gap-2 rounded-xl bg-background/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm" dir="ltr">
                {user.email}
              </p>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-bold ${profile?.email_verified_at ? "border-up/40 bg-up/10 text-up" : "border-warning/40 bg-warning/10 text-warning"}`}
              >
                {profile?.email_verified_at ? t("emailVerified") : t("emailNotVerified")}
              </span>
            </div>
            {!profile?.email_verified_at && (
              <>
                <p className="text-xs text-muted">{t("emailVerifyHint")}</p>
                {verify && (
                  <p role="status" className={`text-xs ${verify === "sent" || verify === "done" ? "text-up" : "text-danger"}`}>
                    {t(`verify_${verify}` as never)}
                  </p>
                )}
                <form action={sendEmailVerification}>
                  <SubmitButton pendingLabel={t("sending")} className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60">
                    {verify === "sent" ? t("resendVerify") : t("sendVerify")}
                  </SubmitButton>
                </form>
                <form action={verifyEmailCode} className="flex gap-2" dir="ltr">
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    placeholder={t("verifyCodePlaceholder")}
                    aria-label={t("verifyCodePlaceholder")}
                    className="min-h-11 min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-base"
                  />
                  <SubmitButton className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">{t("verifyCodeButton")}</SubmitButton>
                </form>
              </>
            )}
            {profile?.email_verified_at && verify === "done" && (
              <p role="status" className="text-xs text-up">
                {t("verify_done")}
              </p>
            )}
          </div>

          <form action={updateProfile} className="flex flex-col gap-2">
            <label htmlFor="st-name" className="text-sm font-medium">
              {t("nameLabel")}
            </label>
            <input
              id="st-name"
              name="displayName"
              type="text"
              defaultValue={profile?.display_name ?? ""}
              placeholder={t("fullNamePlaceholder")}
              required
              minLength={2}
              maxLength={60}
              aria-invalid={field === "name" && error ? true : undefined}
              className={`min-h-11 rounded border bg-background px-3 py-2 ${field === "name" && error ? "border-danger" : "border-border"}`}
            />
            {field === "name" && error && <p className="text-xs text-danger">{error}</p>}
            <button type="submit" className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
              {t("saveName")}
            </button>
          </form>

          <form action={updatePhone} className="flex flex-col gap-2">
            {profile?.phone && (
              <p className="text-xs text-muted">
                {t("phoneCurrent")} <span dir="ltr">{profile.phone}</span>
              </p>
            )}
            <PhoneInput label={t("phoneLabel")} errorText={t("phoneInvalid")} />
            {field === "phone" && error && <p className="text-xs text-danger">{error}</p>}
            <button type="submit" className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
              {t("savePhone")}
            </button>
          </form>
        </section>

        <section id="notifications" className="flex scroll-mt-20 flex-col gap-3 rounded-[20px] border border-border bg-surface p-5">
          <h2 className="text-section-title">{t("notificationPrefsTitle")}</h2>
          <p className="text-xs text-muted">{t("notificationPrefsDesc")}</p>
          <Link href="/notifications/preferences" className="rounded border border-border px-3 py-2 text-center text-sm transition hover:bg-white/5">
            {t("notificationPrefsLink")}
          </Link>
        </section>

        <PushPermission publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />
        <InstallApp variant="button" />

        <div id="alerts" className="scroll-mt-20">
          <LossAlertsSection userId={user.id} />
        </div>

        <div id="risk" className="scroll-mt-20">
          <RiskQuestionnaire current={(await cookies()).get("risk_profile")?.value} />
        </div>

        <section id="language" className="flex scroll-mt-20 flex-col gap-3 rounded-[20px] border border-border bg-surface p-5">
          <h2 className="text-section-title">{t("languageTimezoneTitle")}</h2>
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
              className="min-h-11 rounded border border-border bg-background px-3 py-2 text-base"
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

        <section id="security" className="flex scroll-mt-20 flex-col gap-3 rounded-[20px] border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-section-title">{t("securityTitle")}</h2>
            {hasVerifiedTotp(user) && (
              <span className="rounded-full border border-up/40 bg-up/10 px-2 py-0.5 text-xs font-bold text-up">{t("twoFactorOn")}</span>
            )}
          </div>
          <p className="text-sm text-muted">{t("securityLinkDesc")}</p>
          <Link href="/account/security" className="rounded border border-border px-3 py-2 text-center text-sm transition hover:bg-white/5">
            {t("securityTitle")}
          </Link>
        </section>
      </AppMain>
    </>
  );
}
