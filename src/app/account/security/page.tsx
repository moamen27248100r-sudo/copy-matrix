import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { KeyRound, MonitorSmartphone, ShieldCheck, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";

export async function generateMetadata() {
  const t = await getTranslations("AccountSecurityPage");
  return { title: t("title") };
}

// Account security hub linked from the account menu: two-factor (not built
// yet, shown as coming soon), password change (lives on /settings) and the
// devices & sessions page.
export default async function AccountSecurityPage() {
  const t = await getTranslations("AccountSecurityPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount%2Fsecurity");

  const rowClass = "flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-sm";
  const iconClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-foreground/70";

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>

        <div className={rowClass} aria-disabled="true">
          <span className={iconClass}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="flex-1 font-medium">{t("twoFactorTitle")}</span>
          <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
            {t("comingSoon")}
          </span>
        </div>

        <Link href="/settings#change-password" className={`${rowClass} transition hover:bg-white/5`}>
          <span className={iconClass}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="flex-1 font-medium">{t("changePassword")}</span>
          <ChevronRight className="h-4 w-4 text-muted rtl:rotate-180" aria-hidden="true" />
        </Link>

        <Link href="/account/sessions" className={`${rowClass} transition hover:bg-white/5`}>
          <span className={iconClass}>
            <MonitorSmartphone className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="flex-1 font-medium">{t("devices")}</span>
          <ChevronRight className="h-4 w-4 text-muted rtl:rotate-180" aria-hidden="true" />
        </Link>
      </main>
    </>
  );
}
