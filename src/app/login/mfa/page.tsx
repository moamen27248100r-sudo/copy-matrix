import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { logout } from "@/app/auth/actions";
import { AuthShell } from "@/components/auth/AuthShell";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";
import { safeNextPath } from "@/lib/safe-next";
import { getPendingMfa } from "@/lib/mfa";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const t = await getTranslations("TwoFactor");
  return { title: t("challengeTitle") };
}

// Second sign-in step for accounts with 2FA on. The proxy sends every aal1
// request here; once the code steps the session up to aal2 the customer
// continues to wherever they were headed.
export default async function MfaChallengePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  if (!(await getPendingMfa(supabase, user)).pending) redirect(next ?? "/dashboard");

  const t = await getTranslations("TwoFactor");

  return (
    <AuthShell title={t("challengeTitle")} subtitle={t("challengeSubtitle")}>
      <MfaChallengeForm next={next} />
      <p className="text-sm text-muted">{t("lostDevice")}</p>
      <form action={logout}>
        <button type="submit" className="w-full text-center text-sm text-muted underline underline-offset-4 hover:text-foreground">
          {t("useDifferentAccount")}
        </button>
      </form>
    </AuthShell>
  );
}
