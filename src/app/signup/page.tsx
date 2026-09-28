import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "@/components/SignupForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { safeNextPath } from "@/lib/safe-next";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  const t = await getTranslations("Auth");

  return (
    <AuthShell title={t("signupTitle")} subtitle={t("signupSubtitle")}>
      {error && (
        <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      )}

      <GoogleSignInButton next={next} label={t("signupWithGoogle")} loadingLabel={t("googleRedirecting")} />

      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <SignupForm next={next} />

      <p className="text-center text-sm">
        <Link href={loginHref} className="font-medium text-foreground underline underline-offset-4">
          {t("alreadyHaveAccount")}
        </Link>
      </p>
    </AuthShell>
  );
}
