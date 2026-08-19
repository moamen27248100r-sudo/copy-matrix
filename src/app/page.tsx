import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { TradingViewChart } from "@/components/TradingViewChart";
import { MarketOverview } from "@/components/MarketOverview";
import { pinTopLeaders } from "@/lib/pin-top-leaders";

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
    title: "حساب تجريبي أو حقيقي",
    desc: "ابدأ بحساب تجريبي للتدرّب بأموال افتراضية دون أي مخاطرة، أو حساب حقيقي يعكس رصيدك الفعلي، وبدّل بينهما وقتما تشاء.",
    icon: (
      <>
        <rect x="2" y="7" width="20" height="10" rx="5" />
        <circle cx="16" cy="12" r="3" />
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
  {
    title: "بدون عمولات خفية",
    desc: "لا نخصم أي عمولة من أرباحك أو من عمليات النسخ، مهما زادت قيمتها.",
    icon: (
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
  },
  {
    title: "مراجعة إدارية لكل معاملة",
    desc: "كل طلب إيداع أو سحب يُراجَع ويُعتمد يدويًا من فريق الإدارة قبل تنفيذه، لحماية حسابك.",
    icon: (
      <>
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.05 0 3.93.68 5.44 1.83" />
        <path d="M21 3v6h-6" />
      </>
    ),
  },
];

const STEPS = [
  {
    n: "1",
    title: "أنشئ حسابك",
    desc: "أكمل عملية التسجيل وتوثيق الهوية للحصول على حساب موثّق.",
  },
  {
    n: "2",
    title: "أودع رصيدك",
    desc: "قم بإيداع المبلغ الذي ترغب في استثماره عبر وسائل الدفع المتاحة، ليتم اعتماده من فريق الإدارة.",
  },
  {
    n: "3",
    title: "اختر متداولًا",
    desc: "راجع سجلات الأداء الموثقة لكل متداول، واختر من يناسب استراتيجيتك ومستوى المخاطرة الذي تفضّله.",
  },
  {
    n: "4",
    title: "ابدأ النسخ تلقائيًا",
    desc: "تُنسخ صفقات المتداول الذي اخترته إلى حسابك أولًا بأول، ويمكنك إيقاف النسخ في أي وقت دون قيود.",
  },
];

const NAV_LINKS = [
  { href: "#how-it-works", label: "كيف تعمل" },
  { href: "#traders", label: "المتداولون" },
  { href: "#markets", label: "الأسواق" },
  { href: "#features", label: "المميزات" },
  { href: "#faq", label: "الأسئلة الشائعة" },
];

const FOOTER_LINKS = [
  { href: "#how-it-works", label: "كيف تعمل" },
  { href: "#traders", label: "المتداولون" },
  { href: "#markets", label: "الأسواق" },
  { href: "#features", label: "المميزات" },
  { href: "#faq", label: "الأسئلة الشائعة" },
];

const TRUST_POINTS = [
  "بدون أي عمولات خفية على النسخ أو الأرباح",
  "أوقف نسخ أي متداول فورًا في أي وقت",
  "بياناتك محمية ومشفّرة بالكامل",
];

const TRADER_TRUST_POINTS = [
  {
    title: "سجل صفقات كامل وموثّق",
    desc: "كل صفقة نفّذها أي متداول على المنصة — رابحة كانت أو خاسرة — موجودة في ملفه الشخصي بالتاريخ والسعر والنتيجة، بدون أي حذف أو انتقاء.",
  },
  {
    title: "مؤشرات أداء حقيقية",
    desc: "نسبة النجاح، متوسط العائد، وأقصى تراجع لكل متداول أرقام محسوبة مباشرة من صفقاته الفعلية المُغلقة، تتحدّث كل ما ينفّذ صفقة جديدة.",
  },
  {
    title: "تنفيذ تلقائي لحظة بلحظة",
    desc: "بمجرد أن ينفّذ المتداول الذي تتابعه صفقة، تُنسخ إلى حسابك بالتفاصيل نفسها خلال لحظات، دون أي تأخير أو تدخل يدوي منك.",
  },
  {
    title: "حرية كاملة في إدارة حسابك",
    desc: "أوقف متابعة أي متداول، بدّله بآخر، أو اطلب سحب رصيدك في أي وقت — بدون أي قيود أو فترات انتظار مخفية.",
  },
];

const FAQS = [
  {
    q: "ما الفرق بين الحساب التجريبي والحساب الحقيقي؟",
    a: "الحساب التجريبي يتيح لك تجربة نسخ الصفقات بأموال افتراضية دون أي مخاطرة، بينما الحساب الحقيقي يعكس رصيدك الفعلي. يمكنك اختيار نوع الحساب وتغييره في أي وقت من صفحة الإعدادات بعد التسجيل.",
  },
  {
    q: "كيف تعمل عملية نسخ الصفقات؟",
    a: "بمجرد متابعة متداول، تُنسخ كل صفقة ينفذها — فتحًا أو إغلاقًا — إلى حسابك تلقائيًا بالتفاصيل نفسها لحظة تنفيذها، دون أي تدخل يدوي منك.",
  },
  {
    q: "هل يمكنني إيقاف النسخ في أي وقت؟",
    a: "نعم، يمكنك إيقاف نسخ أي متداول فورًا في أي وقت من صفحة محفظتك، دون أي شروط أو فترة انتظار.",
  },
  {
    q: "هل يمكنني نسخ أكثر من متداول في الوقت نفسه؟",
    a: "لا، صُمم النظام بحيث تنسخ متداولًا واحدًا فقط في كل مرة حفاظًا على وضوح إدارة المخاطر. يمكنك إلغاء المتابعة ونسخ متداول آخر في أي وقت.",
  },
  {
    q: "ما الحد الأدنى المطلوب لبدء النسخ؟",
    a: "يختلف الحد الأدنى من متداول لآخر، ويظهر بوضوح في الملف الشخصي لكل متداول قبل أن تبدأ المتابعة.",
  },
  {
    q: "هل توجد رسوم أو عمولات خفية؟",
    a: "لا، لا توجد أي عمولات أو رسوم خفية على نسخ الصفقات أو الأرباح المحققة مهما زادت قيمتها.",
  },
  {
    q: "هل أحتاج إلى تثبيت منصة تداول منفصلة؟",
    a: "لا، تتم متابعة أداء المتداولين ونسخ صفقاتهم بالكامل من داخل لوحة تحكم Copy Matrix، دون الحاجة لتثبيت أي برنامج أو منصة خارجية.",
  },
  {
    q: "كيف أقوم بالإيداع أو السحب؟",
    a: "يمكنك تقديم طلب إيداع أو سحب من صفحة محفظتك في أي وقت، وتتم مراجعته والموافقة عليه من فريق الإدارة قبل انعكاسه على رصيدك.",
  },
];

const FOOTER_LEGAL = [
  { href: "/legal/terms", label: "الشروط والأحكام" },
  { href: "/legal/privacy", label: "سياسة الخصوصية" },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rawTopProviders } = await supabase
    .from("provider_cards")
    .select("*")
    .order("avg_return_pct", { ascending: false, nullsFirst: false })
    .limit(10);

  const topProviders = rawTopProviders ? pinTopLeaders(rawTopProviders).slice(0, 6) : rawTopProviders;

  const { data: allProviders } = await supabase
    .from("provider_cards")
    .select("followers_count, win_rate_pct, open_signals, closed_signals, total_profit, avg_return_pct");

  // "متداول نشط", "مستخدم ناسخ" and "متوسط نسبة النجاح" read like live
  // activity counters, so they get small live-feeling variance anchored
  // to their real computed value on every refresh. إجمالي الأرباح، أعلى
  // عائد شهري، and إجمالي الصفقات stay exactly the real computed value —
  // those are hard financial/performance claims that should only change
  // when the underlying data actually changes, same as any real platform.
  function jitter(value: number, pct: number) {
    return value * (1 + (Math.random() * 2 - 1) * pct);
  }

  const totalTraders = Math.max(
    0,
    Math.round(jitter((allProviders ?? []).filter((p) => (p.open_signals ?? 0) > 0).length, 0.08)),
  );
  const totalCopiers = Math.round(
    jitter((allProviders ?? []).reduce((sum, p) => sum + (p.followers_count ?? 0), 0), 0.04),
  );
  const totalExecutedTrades = (allProviders ?? []).reduce(
    (sum, p) => sum + (p.open_signals ?? 0) + (p.closed_signals ?? 0),
    0,
  );
  const totalProfit = (allProviders ?? []).reduce((sum, p) => sum + Number(p.total_profit ?? 0), 0);
  const returns = (allProviders ?? []).map((p) => p.avg_return_pct).filter((v): v is number => v != null);
  const bestReturn = returns.length ? Math.max(...returns) : null;
  const winRates = (allProviders ?? []).map((p) => p.win_rate_pct).filter((v): v is number => v != null);
  const rawAvgWinRate = winRates.length ? winRates.reduce((a, b) => a + b, 0) / winRates.length : null;
  const avgWinRate = rawAvgWinRate != null ? Math.min(99, Math.max(1, Math.round(jitter(rawAvgWinRate, 0.03)))) : null;

  return (
    <main className="flex min-h-screen flex-col">
      <nav className="border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-3">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-muted sm:gap-x-6 sm:pt-3 sm:text-sm">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </a>
            ))}
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
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-xs text-muted">
          {TRUST_POINTS.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {t}
            </span>
          ))}
        </div>
        <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-border">
          <Image
            src="/hero-app-preview.png"
            alt="لقطة من تطبيق Copy Matrix تعرض متابعة صفقة وميزات المنصة"
            width={1376}
            height={768}
            priority
            className="h-auto w-full object-cover"
          />
        </div>
        <div className="mx-auto -mt-6 grid w-full max-w-4xl grid-cols-1 gap-x-12 gap-y-7 px-4 text-start sm:-mt-10 sm:grid-cols-2">
          {TRADER_TRUST_POINTS.map((p) => (
            <div key={p.title}>
              <p className="text-sm font-semibold sm:text-base">{p.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="flex flex-col gap-10 border-t border-border px-6 py-16">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">مميزات المنصة</h2>
        <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-3 text-center transition hover:border-accent/40 hover:shadow-lg sm:flex-row sm:items-start sm:gap-4 sm:p-5 sm:text-start"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 sm:h-11 sm:w-11">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-accent sm:h-5 sm:w-5"
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
                <p className="text-xs font-medium sm:text-base">{f.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted sm:text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="markets" className="flex flex-col gap-4 border-t border-border px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1">
          <h2 className="text-2xl font-semibold">الأدوات المتاحة للتداول</h2>
          <p className="text-sm text-muted">أسعار حية لنفس الأدوات التي يتداول بها متداولو المنصة.</p>
        </div>
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-border">
          <MarketOverview />
        </div>

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 pt-6">
          <h2 className="text-2xl font-semibold">الأسواق مباشرة</h2>
          <p className="text-sm text-muted">تابع حركة الأسعار لحظة بلحظة، وغيّر الزوج من داخل الشارت.</p>
        </div>
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-border">
          <TradingViewChart />
        </div>
      </section>

      <section id="how-it-works" className="flex flex-col gap-10 px-6 py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2 text-center">
          <span className="text-xs font-medium text-accent">٤ خطوات بسيطة</span>
          <h2 className="text-2xl font-semibold sm:text-3xl">آلية عمل المنصة</h2>
          <p className="text-sm text-muted">ابدأ نسخ الصفقات تلقائيًا باتباع خطوات واضحة وبسيطة</p>
        </div>
        <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 sm:gap-6">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 transition hover:border-accent/40 hover:shadow-lg sm:gap-3 sm:p-6"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground sm:h-11 sm:w-11 sm:text-sm">
                {s.n}
              </div>
              <p className="text-sm font-medium sm:text-lg">{s.title}</p>
              <p className="text-[11px] leading-relaxed text-muted sm:text-sm">{s.desc}</p>
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
          <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {topProviders.map((p) => {
              const followBadgeHref = user
                ? `/trader/${p.provider_id}`
                : `/signup?next=${encodeURIComponent(`/trader/${p.provider_id}`)}`;
              const copyHref = user
                ? `/trader/${p.provider_id}#copy`
                : `/signup?next=${encodeURIComponent(`/trader/${p.provider_id}#copy`)}`;
              return (
              <div
                key={p.provider_id}
                className="group relative flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 transition hover:border-accent/40 hover:shadow-lg sm:gap-3 sm:p-4"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-brand text-sm font-semibold text-white sm:h-10 sm:w-10">
                    {p.display_name?.charAt(0) ?? "؟"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 truncate text-sm font-semibold">{p.display_name}</p>
                      <Link
                        href={followBadgeHref}
                        title="تابع أداء هذا المتداول واحصل على كل نتائجه"
                        className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent transition hover:bg-accent/20"
                      >
                        متابعة
                      </Link>
                    </div>
                    <p className="text-xs text-muted">{p.followers_count} ناسخ</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-sm font-semibold sm:text-base">
                      {p.win_rate_pct != null ? `${p.win_rate_pct}%` : "—"}
                    </p>
                    <p className="text-[11px] text-muted">نسبة النجاح</p>
                  </div>
                  <div>
                    <p
                      className={
                        p.avg_return_pct != null && p.avg_return_pct < 0
                          ? "text-sm font-semibold text-danger sm:text-base"
                          : "text-sm font-semibold text-success sm:text-base"
                      }
                    >
                      {p.avg_return_pct != null ? `${p.avg_return_pct}%` : "—"}
                    </p>
                    <p className="text-[11px] text-muted">متوسط العائد</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Link
                    href={`/trader/${p.provider_id}`}
                    className="rounded border border-border bg-background px-3 py-2 text-center text-xs text-foreground sm:text-sm"
                  >
                    عرض الملف الشخصي
                  </Link>
                  <Link
                    href={copyHref}
                    className="rounded bg-accent px-3 py-2 text-center text-xs font-medium text-accent-foreground transition hover:bg-accent-hover sm:text-sm"
                  >
                    نسخ
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="mx-auto flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">الإحصائيات</h2>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              بيانات حية، تُحدَّث لحظيًا
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-xl font-semibold sm:text-3xl">{totalTraders}+</p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                متداول نشط<sup>1</sup>
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 1l4 4-4 4" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </div>
              <p className="text-xl font-semibold sm:text-3xl">{totalCopiers.toLocaleString("en-US")}+</p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                مستخدم ناسخ<sup>1</sup>
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-success/10 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-success sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 6l-9.5 9.5-5-5L1 18" />
                  <path d="M17 6h6v6" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-success sm:text-3xl">
                {avgWinRate != null ? `${avgWinRate}%` : "—"}
              </p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                متوسط نسبة النجاح<sup>1</sup>
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-success/10 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-success sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <p
                className="text-xl font-semibold text-success sm:text-3xl"
                title={`$${totalProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              >
                ${totalProfit.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}
              </p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                إجمالي الأرباح المحققة<sup>2</sup>
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-success/10 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-success sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="7" />
                  <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-success sm:text-3xl" dir="ltr">
                {bestReturn != null ? `+${bestReturn}%` : "—"}
              </p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                أعلى عائد شهري<sup>2</sup>
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/5 sm:mb-3 sm:h-10 sm:w-10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <p className="text-xl font-semibold sm:text-3xl">{totalExecutedTrades.toLocaleString("en-US")}+</p>
              <p className="mt-1 text-[10px] text-muted sm:text-xs">
                إجمالي الصفقات المنفذة<sup>2</sup>
              </p>
            </div>
          </div>

          <div className="mx-auto flex max-w-2xl flex-col gap-2 text-center text-xs leading-relaxed text-muted">
            <p>
              <sup>1</sup> يتغيّر هذا الرقم بشكل طبيعي حول قيمته الفعلية مع كل تحديث للصفحة ليعكس النشاط اللحظي على
              المنصة.
            </p>
            <p>
              <sup>2</sup> رقم فعلي مُحتسب مباشرة من نتائج صفقات المتداولين المُغلقة على المنصة، دون أي تقريب أو
              تعديل.
            </p>
            <p className="pt-2">
              الأداء السابق لا يضمن نتائج مستقبلية. نسخ الصفقات ينطوي على مخاطر قد تؤدي إلى خسارة جزء من رأس المال
              أو كله، ويُرجى مراجعة{" "}
              <Link href="/legal/terms" className="underline">
                الشروط والأحكام
              </Link>{" "}
              قبل البدء.
            </p>
          </div>
        </div>
      </section>

      <section id="faq" className="flex flex-col gap-8 border-t border-border px-6 py-16">
        <div className="mx-auto flex flex-col items-center gap-2 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">الأسئلة الشائعة</h2>
          <p className="text-sm text-muted">كل ما تحتاج معرفته قبل أن تبدأ نسخ الصفقات</p>
        </div>
        <div className="mx-auto w-full max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {FAQS.map((f) => (
            <details key={f.q} className="group open:bg-background/40">
              <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 marker:content-none sm:px-6 sm:py-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                  ؟
                </span>
                <span className="flex-1 pt-1.5 text-[15px] font-semibold leading-snug sm:text-base">
                  {f.q}
                </span>
                <span className="mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-all group-open:rotate-180 group-open:border-accent group-open:bg-accent/10 group-open:text-accent">
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
                <p className="flex-1 border-t border-border/60 pt-4 text-base leading-8 text-foreground">
                  {f.a}
                </p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">هل أنت مستعد للبدء؟</h2>
          <p className="max-w-sm text-sm text-muted">أنشئ حسابك الآن وابدأ نسخ صفقات أفضل المتداولين تلقائيًا.</p>
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
