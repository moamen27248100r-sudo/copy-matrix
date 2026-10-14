import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppNav } from "@/components/AppNav";
import { RiskFooter } from "@/components/RiskFooter";
import { LEARN_ARTICLES, isLearnSlug } from "@/lib/learn";

export function generateStaticParams() {
  return LEARN_ARTICLES.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isLearnSlug(slug)) return { title: "Copy Matrix" };
  const t = await getTranslations("Learn");
  return { title: `${t(`${slug}.title`)} | Copy Matrix` };
}

export default async function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isLearnSlug(slug)) notFound();
  const t = await getTranslations("Learn");

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-[var(--sidebar-w)] lg:me-0 lg:pb-6">
        <Link href="/dashboard" className="tap-44 inline-flex w-fit items-center gap-1.5 text-sm text-muted transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          {t("back")}
        </Link>
        <article className="flex flex-col gap-4">
          <h1 className="text-page-title">{t(`${slug}.title`)}</h1>
          <p className="text-base font-medium text-foreground/90">{t(`${slug}.summary`)}</p>
          {(["p1", "p2", "p3"] as const).map((p) => (
            <p key={p} className="text-[15px] leading-relaxed text-muted">
              {t(`${slug}.${p}`)}
            </p>
          ))}
        </article>
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-xs leading-relaxed text-muted">{t("notAdvice")}</p>
        <RiskFooter />
      </main>
    </>
  );
}
