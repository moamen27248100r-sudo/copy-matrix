import Link from "next/link";
import { AppMain } from "@/components/AppMain";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { KeyRound, MonitorSmartphone, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { TwoFactorSection } from "@/components/account/TwoFactorSection";
import { ExtraMessages } from "@/components/ExtraMessages";
import { hasVerifiedTotp } from "@/lib/mfa";
import { changePassword } from "@/app/settings/actions";
import { FlashMessage } from "@/components/ui/Toast";

export async function generateMetadata() {
  const t = await getTranslations("AccountSecurityPage");
  return { title: `${t("title")} | Copy Matrix` };
}

// Account security hub linked from the account menu: two-factor (Supabase
// TOTP MFA), password change and the devices & sessions
// page.
export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error, success } = await searchParams;
  const t = await getTranslations("AccountSecurityPage");
  const ts = await getTranslations("Settings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount%2Fsecurity");

  const rowClass = "flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm";
  const iconClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted";

  return (
    <>
      <AppNav />
      <AppMain>
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>

        <ExtraMessages namespaces={["TwoFactor"]}>
          <TwoFactorSection enabled={hasVerifiedTotp(user)} />
        </ExtraMessages>

        {error && <FlashMessage tone="error">{error}</FlashMessage>}
        {success && <FlashMessage tone="success">{ts("savedSuccess")}</FlashMessage>}

        <section id="change-password" className={`${rowClass} scroll-mt-20 flex-col items-stretch`}>
          <div className="flex items-center gap-3">
            <span className={iconClass}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="flex-1 font-medium">{t("changePassword")}</h2>
          </div>
          <form action={changePassword} className="flex flex-col gap-3">
            <input type="hidden" name="returnTo" value="/account/security" />
            <input
              name="password"
              type="password"
              placeholder={ts("newPasswordPlaceholder")}
              required
              minLength={6}
              autoComplete="new-password"
              className="min-h-11 rounded border border-border bg-background px-3 py-2"
            />
            <button type="submit" className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
              {ts("updatePassword")}
            </button>
          </form>
        </section>

        <Link href="/account/sessions" className={`${rowClass} transition hover:bg-white/5`}>
          <span className={iconClass}>
            <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="flex-1 font-medium">{t("devices")}</span>
          <ChevronRight className="h-4 w-4 text-muted rtl:rotate-180" aria-hidden="true" />
        </Link>
      </AppMain>
    </>
  );
}
