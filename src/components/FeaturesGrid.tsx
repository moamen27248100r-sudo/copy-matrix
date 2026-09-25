import type { Locale } from "@/i18n/locales";

const TEXT = {
  ar: {
    title: "لماذا Copy Matrix",
    subtitle: "شبكة قوة كاملة لنسخ التداول بثقة",
    card1: {
      badge: "لحظي",
      title: "تنفيذ لحظي بـ 0% عمولة خفية",
      desc: "أوامر تُنفَّذ في نفس اللحظة بدون أي رسوم مخفية على الصفقات.",
    },
    card2: {
      title: "تغطية كاملة لـ 4 أسواق عالمية",
      desc: "تداول العملات الرقمية والفوركس والذهب والمؤشرات من حساب واحد.",
    },
    card3: {
      title: "تحكم ذكي ومؤشرات موثوقة",
      desc: "مؤشر مخاطرة حي يوضح مستوى التعرض لكل قائد تنسخه.",
      riskLabel: "مستوى المخاطرة",
      riskValue: "منخفض",
    },
  },
  en: {
    title: "Why Copy Matrix",
    subtitle: "A full power grid for copy trading with confidence",
    card1: {
      badge: "Instant",
      title: "Instant execution, 0% hidden commission",
      desc: "Orders fill the moment they're placed, with no hidden trade fees.",
    },
    card2: {
      title: "Full coverage across 4 global markets",
      desc: "Trade crypto, forex, gold and indices from a single account.",
    },
    card3: {
      title: "Smart control, trusted indicators",
      desc: "A live risk gauge shows your exposure to every leader you copy.",
      riskLabel: "Risk level",
      riskValue: "Low",
    },
  },
} as const;

const MARKET_ICONS: { symbol: string; glyph: string }[] = [
  { symbol: "BTC", glyph: "₿" },
  { symbol: "EUR/USD", glyph: "€$" },
  { symbol: "GOLD", glyph: "Au" },
  { symbol: "US100", glyph: "📈" },
];

const CARD_BASE =
  "group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-6 backdrop-blur-xl transition hover:border-cyan-400/40";

export function FeaturesGrid({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const t = isAr ? TEXT.ar : TEXT.en;

  return (
    <section className="px-6 py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="mx-auto flex flex-col items-center gap-1.5 text-center">
          <h2 className="line-clamp-1 text-2xl font-semibold sm:text-3xl">{t.title}</h2>
          <p className="line-clamp-2 text-sm text-muted">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1 */}
          <div className={CARD_BASE}>
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-cyan-400/20 blur-3xl transition group-hover:bg-cyan-400/30"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-3">
              <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 shadow-[0_0_12px_-2px_rgba(34,211,238,0.6)]">
                ⚡ {t.card1.badge}
              </span>
              <h3 className="line-clamp-1 text-lg font-semibold">{t.card1.title}</h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted">{t.card1.desc}</p>
            </div>
            <div className="relative mt-4 h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 shadow-[0_0_10px_0_rgba(34,211,238,0.8)]" />
            </div>
          </div>

          {/* Card 2 */}
          <div className={CARD_BASE}>
            <div
              className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl transition group-hover:bg-cyan-400/25"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-3">
              <h3 className="line-clamp-1 text-lg font-semibold">{t.card2.title}</h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted">{t.card2.desc}</p>
            </div>
            <div className="relative mt-4 grid grid-cols-4 gap-2">
              {MARKET_ICONS.map((m) => (
                <div
                  key={m.symbol}
                  className="flex flex-col items-center gap-1 rounded-xl border border-cyan-500/20 bg-white/5 py-2.5 backdrop-blur-sm"
                >
                  <span className="text-sm font-semibold text-cyan-300">{m.glyph}</span>
                  <span className="line-clamp-1 text-[10px] text-muted">{m.symbol}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3 */}
          <div className={CARD_BASE}>
            <div
              className="pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full bg-emerald-400/15 blur-3xl transition group-hover:bg-emerald-400/25"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-3">
              <h3 className="line-clamp-1 text-lg font-semibold">{t.card3.title}</h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted">{t.card3.desc}</p>
            </div>
            <div className="relative mt-4 rounded-xl border border-cyan-500/20 bg-white/5 p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[11px] text-muted">
                <span className="line-clamp-1">{t.card3.riskLabel}</span>
                <span className="line-clamp-1 font-semibold text-emerald-400">{t.card3.riskValue}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_10px_0_rgba(16,185,129,0.7)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
