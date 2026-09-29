import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { login } from "@/app/auth/actions";
import { AuthShell, inputClass } from "@/components/auth/AuthShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { safeNextPath } from "@/lib/safe-next";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next ?? "/dashboard");
  }

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  const t = await getTranslations("Auth");

  return (
    <AuthShell title={t("loginTitle")}>
      {error && (
        <p role="alert" className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      )}

      <GoogleSignInButton next={next} label={t("continueWithGoogle")} loadingLabel={t("googleRedirecting")} />

      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={login} className="flex flex-col gap-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="li-email" className="text-sm font-medium">
            {t("emailLabel")}
          </label>
          <input
            id="li-email"
            name="email"
            type="email"
            autoComplete="email"
            dir="ltr"
            placeholder={t("emailPlaceholder")}
            required
            className={`${inputClass} text-start`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="li-password" className="text-sm font-medium">
              {t("passwordLabel")}
            </label>
            <Link href="/forgot-password" className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
              {t("forgotPassword")}
            </Link>
          </div>
          <PasswordInput id="li-password" name="password" placeholder={t("passwordPlaceholder")} autoComplete="current-password" />
        </div>
        <button type="submit" className="rounded-xl bg-primary px-4 py-3 text-base font-medium text-white transition-colors hover:bg-accent-hover">
          {t("loginButton")}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href={signupHref} className="font-medium text-foreground underline underline-offset-4">
          {t("createNewAccount")}
        </Link>
      </p>
    </AuthShell>
  );
}
