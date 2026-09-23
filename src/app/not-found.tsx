import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";

export default async function NotFound() {
  const t = await getTranslations("General");
  return (
    <>
      <LegalNav />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex items-center gap-1.5 text-5xl font-bold text-brand" dir="ltr">
          404
        </span>
        <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="text-sm text-muted">
          {t("notFoundDesc")}
        </p>
        <Link
          href="/"
          className="rounded border border-border bg-surface px-4 py-2 text-sm text-foreground"
        >
          {t("backToHome")}
        </Link>
      </main>
    </>
  );
}
