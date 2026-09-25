import type { Locale } from "@/i18n/locales";

const TEXT = {
  ar: {
    badge: "آلية العمل",
    title: "أربع خطوات لتبدأ النسخ",
    subtitle: "مسار واحد متصل من التسجيل إلى التنفيذ اللحظي",
    steps: [
      { icon: "🛡️", title: "ربط الحساب وإدارة المحفظة", desc: "أنشئ حسابك واربط محفظتك بأمان في دقائق." },
      { icon: "💰", title: "تخصيص ورأس المال المرن", desc: "حدد رأس المال المخصص لكل قائد تنسخه بحرية." },
      { icon: "📊", title: "تحليل وتصفية قادة Matrix", desc: "قارن الأداء والمخاطرة واختر القادة الأنسب لك." },
      { icon: "⚡", title: "التنفيذ اللحظي والتحكم التلقائي", desc: "صفقاتك تُنسخ لحظياً مع تحكم كامل بالإيقاف والفك." },
    ],
  },
  en: {
    badge: "How it works",
    title: "Four steps to start copying",
    subtitle: "One connected path from sign-up to instant execution",
    steps: [
      { icon: "🛡️", title: "Connect your account & wallet", desc: "Create your account and link your wallet securely in minutes." },
      { icon: "💰", title: "Flexible allocation & capital", desc: "Choose how much capital to allocate to each leader you copy." },
      { icon: "📊", title: "Analyze & filter Matrix leaders", desc: "Compare performance and risk to pick the leaders that fit you." },
      { icon: "⚡", title: "Instant execution & auto control", desc: "Trades copy instantly, with full control to pause or unfollow." },
    ],
  },
} as const;

export function HowItWorks({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const t = isAr ? TEXT.ar : TEXT.en;

  return (
    <section id="how-it-works" className="flex flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-2 text-center">
        <span className="line-clamp-1 text-xs font-medium text-cyan-400">{t.badge}</span>
        <h2 className="line-clamp-1 text-2xl font-semibold sm:text-3xl">{t.title}</h2>
        <p className="line-clamp-2 text-sm text-muted">{t.subtitle}</p>
      </div>

      <div className="relative mx-auto w-full max-w-5xl">
        <div
          className="absolute top-6 right-6 left-6 hidden h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent sm:block"
          aria-hidden="true"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:gap-6">
          {t.steps.map((s, i) => (
            <div key={s.title} className="relative flex h-full flex-col items-center gap-3 text-center">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-900/80 text-sm font-bold text-cyan-300 shadow-[0_0_18px_-3px_rgba(34,211,238,0.7)] backdrop-blur-xl">
                {i + 1}
                <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-cyan-500/30 bg-slate-900 text-xs">
                  {s.icon}
                </span>
              </div>
              <div className="flex h-full w-full flex-col justify-between gap-1.5 rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-4 backdrop-blur-xl">
                <p className="line-clamp-1 text-sm font-semibold sm:text-base">{s.title}</p>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted sm:text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
