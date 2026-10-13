"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { AccountTypeSwitcher } from "@/components/AccountTypeSwitcher";

// The thin bar under the header while the customer is on the demo account: what the mode is, and a
// quiet link to trade with a real account (it opens the usual confirmation before switching).
export function DemoStrip() {
  const t = useTranslations("Nav");
  const tDash = useTranslations("Dashboard");
  const pathname = usePathname();

  return (
    <div className="flex w-full items-center justify-center gap-3 border-b border-warning/30 bg-warning/10 px-4 py-1 text-[11px] font-medium text-warning lg:ps-64">
      <span>{t("demoStrip")}</span>
      <span aria-hidden="true" className="h-3 w-px bg-warning/40" />
      <AccountTypeSwitcher
        accountType="demo"
        next={pathname || "/dashboard"}
        variant="link"
        linkLabel={t("demoStripSwitch")}
        linkClassName="tap-44 inline-flex items-center gap-1 font-semibold underline underline-offset-2 transition hover:opacity-80"
        ariaLabel={t("demoStripSwitch")}
        options={[
          { key: "real", label: tDash("accountTypeShortReal") },
          { key: "demo", label: tDash("accountTypeShortDemo") },
        ]}
        confirmTitle={t("switchAccountConfirmTitle")}
        confirmText={t("switchAccountWarning")}
        confirmCta={t("switchAccountConfirmCta")}
        cancelCta={t("switchAccountCancelCta")}
      />
      <ArrowRight className="-ms-2 h-3 w-3 shrink-0 rtl:rotate-180" aria-hidden="true" />
    </div>
  );
}
