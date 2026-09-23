import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { login } from "@/app/auth/actions";
import { safeNextPath } from "@/lib/safe-next";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);
  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";
  const t = await getTranslations("Auth");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t("loginTitle")}</h1>

      {error && (
        <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <GoogleSignInButton next={next} label={t("continueWithGoogle")} loadingLabel={t("googleRedirecting")} />

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={login} className="flex flex-col gap-3">
        {next && <input type="hidden" name="next" value={next} />}
        <input
          name="email"
          type="email"
          placeholder={t("emailPlaceholder")}
          required
          className="rounded border border-border bg-surface px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder={t("passwordPlaceholder")}
          required
          className="rounded border border-border bg-surface px-3 py-2"
        />
        <button
          type="submit"
          className="rounded bg-accent px-3 py-2 font-medium text-accent-foreground transition hover:bg-accent-hover"
        >
          {t("loginButton")}
        </button>
      </form>

      <Link href="/forgot-password" className="text-sm text-muted underline">
        {t("forgotPassword")}
      </Link>

      <p className="text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href={signupHref} className="text-foreground underline">
          {t("createNewAccount")}
        </Link>
      </p>
    </main>
  );
}
