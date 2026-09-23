import { getTranslations } from "next-intl/server";
import { logout } from "@/app/auth/actions";

export default async function SuspendedPage() {
  const t = await getTranslations("General");
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t("suspendedTitle")}</h1>
      <p className="text-sm text-muted">
        {t("suspendedDesc")}
      </p>
      <form action={logout}>
        <button type="submit" className="rounded border border-border px-4 py-2 text-sm">
          {t("logOut")}
        </button>
      </form>
    </main>
  );
}
