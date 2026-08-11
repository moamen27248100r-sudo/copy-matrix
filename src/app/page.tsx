import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TradingViewChart } from "@/components/TradingViewChart";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "شفافية كاملة",
    desc: "سجل أداء كل متداول متاح للجميع، وكل صفقة وكل نتيجة موثقة وواضحة.",
    icon: (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  },
  {
    title: "متابعة لحظية",
    desc: "تابع أداء المتداولين الذين تنسخهم وأرباحك لحظة بلحظة من لوحة تحكم واحدة.",
    icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  },
  {
    title: "تحكم كامل في المخاطرة",
    desc: "حدد حجم النسخ الذي يناسبك لكل متداول، وابدأ أو أوقف النسخ في أي وقت.",
    icon: (
      <>
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </>
    ),
  },
  {
    title: "أسواق متعددة",
    desc: "متداولون متخصصون في العملات الرقمية والفوركس والذهب والمؤشرات العالمية.",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </>
    ),
  },
];

const STEPS = [
  { n: "1", title: "أنشئ حسابك", desc: "سجّل في دقيقتين وابدأ استكشاف المنصة." },
  { n: "2", title: "اختر متداولًا", desc: "تصفح سجلات الأداء الكاملة واختر ما يناسب أسلوبك." },
  { n: "3", title: "انسخ تلقائيًا", desc: "تُنسخ صفقاته إلى حسابك أولًا بأول، ويمكنك إيقاف النسخ في أي وقت." },
];

const NAV_LINKS = [
  { href: "#how-it-works", label: "كيف تعمل" },
  { href: "#traders", label: "المتداولون" },
  { href: "#features", label: "المميزات" },
];

const FOOTER_LINKS = [
  { href: "#how-it-works", label: "كيف تعمل" },
  { href: "#traders", label: "المتداولون" },
  { href: "#features", label: "المميزات" },
];

const FOOTER_LEGAL = [
  { href: "/legal/terms", label: "الشروط والأحكام" },
  { href: "/legal/privacy", label: "سياسة الخصوصية" },
];

export default async function Home() {
  const supabase = await createClient();

  const { data: topProviders } = await supabase
    .from("provider_cards")
    .select("*")
    .order("avg_return_pct", { ascending: false, nullsFirst: false })
    .limit(6);

  const { data: allProviders } = await supabase
    .from("provider_cards")
    .select("followers_count, win_rate_pct, open_signals, closed_signals, total_profit, avg_return_pct");

  const totalTraders = allProviders?.length ?? 0;
  const totalCopiers = (allProviders ?? []).reduce((sum, p) => sum + (p.followers_count ?? 0), 0);
  const totalExecutedTrades = (allProviders ?? []).reduce(
    (sum, p) => sum + (p.open_signals ?? 0) + (p.closed_signals ?? 0),
    0,
  );
  const totalProfit = (allProviders ?? []).reduce((sum, p) => sum + Number(p.total_profit ?? 0), 0);
  const returns = (allProviders ?? []).map((p) => p.avg_return_pct).filter((v): v is number => v != null);
  const bestReturn = returns.length ? Math.max(...returns) : null;
  const winRates = (allProviders ?? []).map((p) => p.win_rate_pct).filter((v): v is number => v != null);
  const avgWinRate = winRates.length
    ? Math.round(winRates.reduce((a, b) => a + b, 0) / winRates.length)
    : null;

  return (
    <main className="flex min-h-screen flex-col">
      <nav className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <span className="flex items-center gap-0.5 text-base font-semibold sm:text-lg" dir="ltr">
            Copy Matrix
            <span className="flex items-center">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 text-brand"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 19l3-5 3 3 5-9" />
                <path d="M12 8h4v4" />
              </svg>
              <svg
                viewBox="0 0 24 24"
                className="-ml-1.5 h-4 w-4 text-brand"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 19l3-5 3 3 5-9" />
                <path d="M12 8h4v4" />
              </svg>
            </span>
          </span>

          <div className="hidden items-center gap-6 text-sm text-muted sm:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="rounded border border-border px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm">
              تسجيل الدخول
            </Link>
            <Link
              href="/signup"
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:bg-accent-hover sm:px-4 sm:py-2 sm:text-sm"
            >
              إنشاء حساب
            </Link>
          </div>
        </div>
      </nav>

      <section className="flex flex-col items-center gap-5 px-6 py-20 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
          انسخ صفقات أفضل المتداولين تلقائيًا
        </h1>
        <p className="max-w-md text-muted">
          تصفح سجلات أداء حقيقية وموثقة لمئات المتداولين، واختر من تثق به لنسخ صفقاته.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/signup"
            className="rounded bg-accent px-6 py-3 font-medium text-accent-foreground transition hover:bg-accent-hover"
          >
            ابدأ الآن
          </Link>
          <a href="#traders" className="rounded border border-border px-6 py-3 font-medium text-foreground">
            تصفح المتداولين
          </a>
        </div>
      </section>

      <section className="px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="mx-auto flex items-center gap-2 text-xs text-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            بيانات حية، تُحدَّث لحظيًا
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-3xl font-semibold">{totalTraders}+</p>
              <p className="mt-1 text-xs text-muted">متداول نشط</p>
            </div>

            <div className="rounded-lg border border-border p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 1l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </div>
              <p className="text-3xl font-semibold">{totalCopiers.toLocaleString("en-US")}+</p>
              <p className="mt-1 text-xs text-muted">مستخدم ناسخ</p>
            </div>

            <div className="rounded-lg border border-border p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 6l-9.5 9.5-5-5L1 18" />
                  <path d="M17 6h6v6" />
                </svg>
              </div>
              <p className="text-3xl font-semibold text-success">
                {avgWinRate != null ? `${avgWinRate}%` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">متوسط نسبة النجاح</p>
            </div>

            <div className="rounded-lg border border-border p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <p className="text-3xl font-semibold text-success">
                ${totalProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="mt-1 text-xs text-muted">إجمالي الأرباح المحققة</p>
            </div>

            <div className="rounded-lg border border-border p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="7" />
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                </svg>
              </div>
              <p className="text-3xl font-semibold text-success" dir="ltr">
                {bestReturn != null ? `+${bestReturn}%` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">أعلى عائد شهري</p>
            </div>

            <div className="rounded-lg border border-border p-6 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <p className="text-3xl font-semibold">{totalExecutedTrades.toLocaleString("en-US")}+</p>
              <p className="mt-1 text-xs text-muted">إجمالي الصفقات المنفذة</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="flex flex-col gap-10 px-6 py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2 text-center">
          <span className="text-xs font-medium text-accent">٣ خطوات بسيطة</span>
          <h2 className="text-2xl font-semibold sm:text-3xl">آلية عمل المنصة</h2>
          <p className="text-sm text-muted">ابدأ نسخ الصفقات تلقائيًا في دقائق معدودة</p>
        </div>
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-6 transition hover:border-accent/40 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                {s.n}
              </div>
              <p className="text-lg font-medium">{s.title}</p>
              <p className="text-sm leading-relaxed text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {topProviders && topProviders.length > 0 && (
        <section id="traders" className="flex flex-col gap-6 border-t border-border px-6 py-16">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
            <h2 className="text-2xl font-semibold">أفضل المتداولين</h2>
            <Link href="/discover" className="text-sm underline">
              عرض الكل
            </Link>
          </div>
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
            {topProviders.map((p, i) => (
              <div
                key={p.provider_id}
                className="group relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-accent/40 hover:shadow-lg"
              >
                <span className="absolute left-4 top-4 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                  #{i + 1}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-brand text-sm font-semibold text-white">
                    {p.display_name?.charAt(0) ?? "؟"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{p.display_name}</p>
                      <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                        متابعة
                      </span>
                    </div>
                    <p className="text-xs text-muted">{p.followers_count} ناسخ</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-sm">
                  <div>
                    <p className="font-semibold">
                      {p.win_rate_pct != null ? `${p.win_rate_pct}%` : "—"}
                    </p>
                    <p className="text-xs text-muted">نسبة النجاح</p>
                  </div>
                  <div>
                    <p
                      className={
                        p.avg_return_pct != null && p.avg_return_pct < 0
                          ? "font-semibold text-danger"
                          : "font-semibold text-success"
                      }
                    >
                      {p.avg_return_pct != null ? `${p.avg_return_pct}%` : "—"}
                    </p>
                    <p className="text-xs text-muted">متوسط العائد</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href={`/trader/${p.provider_id}`}
                    className="rounded border border-border bg-background px-3 py-2 text-center text-sm text-foreground"
                  >
                    عرض الملف الشخصي
                  </Link>
                  <Link
                    href={`/trader/${p.provider_id}`}
                    className="rounded bg-accent px-3 py-2 text-center text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
                  >
                    نسخ
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4 border-t border-border px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
          <h2 className="text-2xl font-semibold">الأسواق مباشرة</h2>
          <p className="text-sm text-muted">تابع حركة الأسعار لحظة بلحظة، وغيّر الزوج من داخل الشارت.</p>
        </div>
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-border">
          <TradingViewChart />
        </div>
      </section>

      <section id="features" className="flex flex-col gap-10 border-t border-border px-6 py-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">مميزات المنصة</h2>
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition hover:border-accent/40 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {f.icon}
                </svg>
              </div>
              <div>
                <p className="font-medium">{f.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">هل أنت مستعد للبدء؟</h2>
          <p className="max-w-sm text-sm text-muted">أنشئ حسابك الآن وابدأ نسخ صفقات أفضل المتداولين في دقائق.</p>
          <Link
            href="/signup"
            className="mt-2 rounded bg-accent px-6 py-3 font-medium text-accent-foreground transition hover:bg-accent-hover"
          >
            إنشاء حساب مجاني
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-0.5 text-base font-semibold" dir="ltr">
              Copy Matrix
              <span className="flex items-center">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 19l3-5 3 3 5-9" />
                  <path d="M12 8h4v4" />
                </svg>
                <svg viewBox="0 0 24 24" className="-ml-1.5 h-3.5 w-3.5 text-brand" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 19l3-5 3 3 5-9" />
                  <path d="M12 8h4v4" />
                </svg>
              </span>
            </span>
            <p className="max-w-xs text-sm text-muted">
              منصة نسخ تداول اجتماعي لمتابعة أفضل المتداولين ونسخ صفقاتهم تلقائيًا.
            </p>
          </div>

          <div className="flex flex-wrap gap-10 text-sm">
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">المنصة</p>
              {FOOTER_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="text-muted hover:text-foreground">
                  {l.label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">قانوني</p>
              {FOOTER_LEGAL.map((l) => (
                <Link key={l.href} href={l.href} className="text-muted hover:text-foreground">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-8 w-full max-w-5xl border-t border-border pt-6 text-center text-xs text-muted">
          © {new Date().getFullYear()} Copy Matrix. جميع الحقوق محفوظة. تأسست عام ٢٠٢٤.
        </p>
      </footer>
    </main>
  );
}
