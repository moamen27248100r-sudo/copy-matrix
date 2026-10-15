import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { SUPPORT_EMAIL } from "@/config/platform";

type Section = { title: string; body: string };

// TODO(owner): add the legal company details (registered name, registration
// number, registered address, regulatory status) once they are available.

export async function generateMetadata() {
  const t = await getTranslations("About");
  return { title: t("metaTitle") };
}

export default async function AboutPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("About");
  const sections = t.raw("sections") as Section[];
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <>
      <LegalNav />
      <main dir={dir} className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-page-title">{t("title")}</h1>
          <p className="text-sm leading-relaxed text-muted">{t("intro")}</p>
        </div>

        <div className="flex flex-col gap-5">
          {sections.map((s) => (
            <section
              key={s.title}
              className="flex flex-col gap-2 rounded-[20px] border border-glass-border bg-glass-surface p-5 backdrop-blur-xl"
            >
              <h2 className="text-section-title">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </section>
          ))}
          <Link href="/risk-disclosure" className="text-sm text-accent-text hover:underline">
            {t("riskLink")}
          </Link>

          <section className="flex flex-col gap-2 rounded-[20px] border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
            <h2 className="text-section-title">{t("contactTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted">
              {t("contactBody")}{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="text-accent-text underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
