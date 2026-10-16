import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LegalNav } from "@/components/LegalNav";

export async function generateMetadata() {
  const t = await getTranslations("FooterPages");
  return { title: t("feesMeta") };
}

// How copying is paid for, exactly as the platform works: the trader's profit share (5%-30%),
// taken only above the copier's own high-water mark.
export default async function FeesPage() {
  const t = await getTranslations("FooterPages");
  const sections = t.raw("feesSections") as { title: string; body: string }[];
  return (
    <>
      <LegalNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-page-title">{t("feesTitle")}</h1>
          <p className="text-sm leading-relaxed text-muted">{t("feesIntro")}</p>
        </div>
        <div className="flex flex-col gap-5">
          {sections.map((s) => (
            <section key={s.title} className="flex flex-col gap-2 rounded-[20px] border border-glass-border bg-glass-surface p-5 backdrop-blur-xl">
              <h2 className="text-section-title">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </section>
          ))}
          <Link href="/risk-disclosure" className="text-sm text-accent-text hover:underline">
            {t("feesRiskLink")}
          </Link>
        </div>
      </main>
    </>
  );
}
