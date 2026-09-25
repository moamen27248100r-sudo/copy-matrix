import type { Locale } from "@/i18n/locales";

const TEXT = {
  ar: {
    title: "الأسئلة الشائعة",
    subtitle: "كل ما تحتاج معرفته قبل أن تبدأ",
    items: [
      { q: "كيف يعمل نسخ الصفقات؟", a: "تختار قائداً وتخصص له جزءاً من رصيدك، وكل صفقة يفتحها تُنسخ لحظياً في حسابك بنفس النسبة." },
      { q: "كيف أسحب أو أودع أموالي؟", a: "الإيداع والسحب يتمّان عبر بوابة الكريبتو مباشرة من صفحة المحفظة، بشكل آمن وسريع." },
      { q: "هل أتحكم برصيدي أثناء النسخ؟", a: "نعم، يمكنك تعديل رأس المال المخصص أو إيقاف النسخ أو فك الارتباط بضغطة زر في أي وقت." },
      { q: "هل يوجد حساب تجريبي؟", a: "نعم، يمكنك تجربة المنصة بالكامل عبر حساب تجريبي برصيد افتراضي بدون أي مخاطرة." },
    ],
  },
  en: {
    title: "Frequently asked questions",
    subtitle: "Everything you need to know before you start",
    items: [
      { q: "How does copy trading work?", a: "You pick a leader and allocate part of your balance to them; every trade they open is copied to your account at the same ratio instantly." },
      { q: "How do I withdraw or deposit?", a: "Deposits and withdrawals go through the crypto gateway directly from your portfolio page, quickly and securely." },
      { q: "Can I control my balance while copying?", a: "Yes — adjust your allocated capital, pause copying, or unfollow instantly with one click, anytime." },
      { q: "Is there a demo account?", a: "Yes, you can try the full platform with a risk-free demo account and virtual balance." },
    ],
  },
} as const;

export function FAQAccordion({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const t = isAr ? TEXT.ar : TEXT.en;

  return (
    <section id="faq" className="flex flex-col gap-8 border-t border-cyan-500/10 px-6 py-16">
      <div className="mx-auto flex flex-col items-center gap-2 text-center">
        <h2 className="line-clamp-1 text-2xl font-semibold sm:text-3xl">{t.title}</h2>
        <p className="line-clamp-2 text-sm text-muted">{t.subtitle}</p>
      </div>
      <div className="mx-auto w-full max-w-3xl divide-y divide-cyan-500/10 overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-900/60 shadow-[0_0_30px_-10px_rgba(34,211,238,0.25)] backdrop-blur-xl">
        {t.items.map((f) => (
          <details key={f.q} className="group open:bg-cyan-500/[0.04]">
            <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 marker:content-none sm:px-6 sm:py-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-sm font-bold text-cyan-300">
                {isAr ? "؟" : "?"}
              </span>
              <span className="line-clamp-1 flex-1 pt-1.5 text-[15px] font-semibold leading-snug sm:text-base">
                {f.q}
              </span>
              <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 text-muted transition-all group-open:rotate-180 group-open:border-cyan-400/50 group-open:bg-cyan-400/10 group-open:text-cyan-300">
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
              <p className="flex-1 border-t border-cyan-500/10 pt-4 text-base leading-8 text-foreground">
                {f.a}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
