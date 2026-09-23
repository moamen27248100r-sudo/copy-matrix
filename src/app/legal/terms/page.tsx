import { getLocale, getTranslations } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";
import { formatDate } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const t = await getTranslations("Legal");
  return { title: t("termsMetaTitle") };
}

export default async function TermsPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Legal");
  const sections = t.raw("termsSections") as { title: string; body: string }[];

  return (
    <>
      <LegalNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{t("termsTitle")}</h1>
          <p className="text-xs text-muted">{t("lastUpdated", { date: formatDate(new Date().toISOString(), locale) })}</p>
        </div>

        <div className="flex flex-col gap-5">
          {sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-2">
              <h2 className="font-medium">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
