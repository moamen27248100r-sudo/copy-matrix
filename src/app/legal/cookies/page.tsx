import { getTranslations } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";

export async function generateMetadata() {
  const t = await getTranslations("FooterPages");
  return { title: t("cookiesMeta") };
}

export default async function CookiesPage() {
  const t = await getTranslations("FooterPages");
  const sections = t.raw("cookiesSections") as { title: string; body: string }[];
  return (
    <>
      <LegalNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <h1 className="text-page-title">{t("cookiesTitle")}</h1>
        <div className="flex flex-col gap-5">
          {sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-2">
              <h2 className="text-section-title">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
