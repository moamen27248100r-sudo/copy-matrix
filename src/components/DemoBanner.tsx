import { Button } from "@/components/ui/Button";
import type { Locale } from "@/i18n/locales";

const TEXT = {
  ar: {
    badge: "بدون مخاطرة",
    title: "جرّب النسخ الآن بحساب تجريبي آمن",
    desc: "رصيد افتراضي جاهز فوراً، بدون بطاقة، بدون التزام — جرّب المنصة كاملة بضغطة زر.",
    cta: "ابدأ الحساب التجريبي",
  },
  en: {
    badge: "Risk-free",
    title: "Try copy trading now with a safe demo account",
    desc: "A ready virtual balance, no card, no commitment — try the full platform in one click.",
    cta: "Start demo account",
  },
} as const;

export function DemoBanner({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const t = isAr ? TEXT.ar : TEXT.en;

  return (
    <section className="px-6 py-12">
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-4 overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-900/60 px-6 py-12 text-center backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl"
          aria-hidden="true"
        />
        <span className="relative line-clamp-1 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-[0_0_12px_-2px_rgba(16,185,129,0.6)]">
          ✓ {t.badge}
        </span>
        <h2 className="relative line-clamp-1 text-2xl font-semibold sm:text-3xl">{t.title}</h2>
        <p className="relative line-clamp-2 max-w-md text-sm text-muted">{t.desc}</p>
        <Button href="/signup" variant="primary" size="md" className="relative mt-2 px-8">
          {t.cta}
        </Button>
      </div>
    </section>
  );
}
