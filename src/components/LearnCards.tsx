import Link from "next/link";
import { BookOpen, Shield, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LEARN_ARTICLES, type LearnSlug } from "@/lib/learn";

const ICONS: Record<LearnSlug, typeof BookOpen> = {
  how_copy_works: BookOpen,
  choose_trader: Users,
  risk_management: Shield,
};

// "Learn": the short articles inside the platform as a horizontal strip of small cards, in plain
// language and without promises of profit.
export async function LearnCards() {
  const t = await getTranslations("Learn");
  const td = await getTranslations("Dashboard");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section-title">{td("learnTitle")}</h2>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {LEARN_ARTICLES.map((slug) => {
          const Icon = ICONS[slug];
          return (
            <Link
              key={slug}
              href={`/learn/${slug}`}
              className="flex w-56 shrink-0 snap-start flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/40"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold leading-snug">{t(`${slug}.title`)}</span>
              <span className="line-clamp-2 text-xs leading-relaxed text-muted">{t(`${slug}.summary`)}</span>
              <span className="mt-auto text-xs font-medium text-accent-text">{t("readMore")}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
