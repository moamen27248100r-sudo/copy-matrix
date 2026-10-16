import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";
import { SUPPORT_EMAIL } from "@/config/platform";

export async function generateMetadata() {
  const t = await getTranslations("FooterPages");
  return { title: t("contactMeta") };
}

// Contact: the support e-mail and the existing support chat.
export default async function ContactPage() {
  const t = await getTranslations("FooterPages");
  const card = "flex flex-col gap-2 rounded-[20px] border border-glass-border bg-glass-surface p-5 backdrop-blur-xl";
  return (
    <>
      <LegalNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-page-title">{t("contactTitle")}</h1>
          <p className="text-sm leading-relaxed text-muted">{t("contactIntro")}</p>
        </div>
        <section className={card}>
          <h2 className="text-section-title">{t("contactEmail")}</h2>
          <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr" className="w-fit text-sm text-accent-text underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
        </section>
        <section className={card}>
          <h2 className="text-section-title">{t("contactChat")}</h2>
          <Link href="/support" className="w-fit rounded-lg bg-accent px-4 py-2 text-sm font-bold text-accent-foreground transition hover:bg-accent-hover">
            {t("contactChat")}
          </Link>
        </section>
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed">{t("contactSafety")}</p>
      </main>
    </>
  );
}
