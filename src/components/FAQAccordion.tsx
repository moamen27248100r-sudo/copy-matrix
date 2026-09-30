import { getLocale, getTranslations } from "next-intl/server";
import { isRtlLocale, type Locale } from "@/i18n/locales";

type FaqItem = { q: string; a: string };

export async function FAQAccordion() {
  const t = await getTranslations("HomeFaq");
  const items = t.raw("items") as FaqItem[];
  const isRtl = isRtlLocale((await getLocale()) as Locale);

  return (
    <section id="faq" className="flex flex-col gap-8 border-t border-glass-border px-6 py-16">
      <div className="mx-auto flex flex-col items-center gap-2 text-center">
        <h2 className="line-clamp-1 text-2xl font-semibold sm:text-3xl">{t("title")}</h2>
        <p className="line-clamp-2 text-sm text-muted">{t("subtitle")}</p>
      </div>
      <div className="mx-auto w-full max-w-3xl divide-y divide-glass-border overflow-hidden rounded-2xl border border-glass-border bg-glass-surface backdrop-blur-xl">
        {items.map((f) => (
          <details key={f.q} className="group open:bg-blue-500/[0.04]">
            <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 marker:content-none sm:px-6 sm:py-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-sm font-bold text-blue-400">
                {isRtl ? "؟" : "?"}
              </span>
              <span className="line-clamp-1 flex-1 pt-1.5 text-[15px] font-semibold leading-snug sm:text-base">
                {f.q}
              </span>
              <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-glass-border text-muted transition-all group-open:rotate-180 group-open:border-blue-500/30 group-open:bg-blue-500/10 group-open:text-blue-400">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </summary>
            <div className="flex gap-4 px-5 pb-6 sm:px-6">
              <span className="h-9 w-9 shrink-0" aria-hidden="true" />
              <p className="flex-1 border-t border-glass-border pt-4 text-base leading-8 text-foreground">
                {f.a}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
