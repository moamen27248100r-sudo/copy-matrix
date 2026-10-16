import Link from "next/link";
import { BookOpen, Scale, Shield, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LEARN_ARTICLES, type LearnSlug } from "@/lib/learn";

const ICONS: Record<LearnSlug, typeof BookOpen> = {
  how_copy_works: BookOpen,
  choose_trader: Users,
  risk_management: Shield,
  demo_vs_real: Scale,
};

// "Learn": four short articles inside the platform, in plain language and without promises of profit.
export async function LearnCards() {
  const t = await getTranslations("Learn");
  const td = await getTranslations("Dashboard");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section-title">{td("learnTitle")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LEARN_ARTICLES.map((slug) => {
          const Icon = ICONS[slug];
          return (
            <Link
              key={slug}
              href={`/learn/${slug}`}
              className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-5 transition hover:border-accent/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold leading-snug">{t(`${slug}.title`)}</span>
              <span className="text-xs leading-relaxed text-muted">{t(`${slug}.summary`)}</span>
              <span className="mt-auto text-xs font-medium text-accent-text">{t("readMore")}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
