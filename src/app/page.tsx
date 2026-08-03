import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/ThemeToggle";

const FEATURES = [
  {
    title: "شفافية كاملة",
    desc: "سجل أداء كل متداول متاح للجميع، وكل صفقة وكل نتيجة موثقة وواضحة.",
  },
  {
    title: "متابعة لحظية",
    desc: "تابع أداء المتداولين الذين تنسخهم وأرباحك لحظة بلحظة من لوحة تحكم واحدة.",
  },
  {
    title: "تحكم كامل في المخاطرة",
    desc: "حدد حجم النسخ الذي يناسبك لكل متداول، وابدأ أو أوقف النسخ في أي وقت.",
  },
  {
    title: "أسواق متعددة",
    desc: "متداولون متخصصون في العملات الرقمية والفوركس والذهب والمؤشرات العالمية.",
  },
];

const STEPS = [
  { n: "1", title: "أنشئ حسابك", desc: "سجّل في دقيقتين وابدأ استكشاف المنصة." },
  { n: "2", title: "اختر متداولًا", desc: "تصفح سجلات الأداء الكاملة واختر ما يناسب أسلوبك." },
  { n: "3", title: "انسخ تلقائيًا", desc: "تُنسخ صفقاته إلى حسابك أولًا بأول، ويمكنك إيقاف النسخ في أي وقت." },
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
    .select("followers_count, win_rate_pct");

  const totalTraders = allProviders?.length ?? 0;
  const totalCopiers = (allProviders ?? []).reduce((sum, p) => sum + (p.followers_count ?? 0), 0);
  const winRates = (allProviders ?? []).map((p) => p.win_rate_pct).filter((v): v is number => v != null);
  const avgWinRate = winRates.length
    ? Math.round(winRates.reduce((a, b) => a + b, 0) / winRates.length)
    : null;

  return (
    <main className="flex min-h-screen flex-col">
      <nav className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="flex items-center gap-1.5 text-lg font-semibold" dir="ltr">
          Copy Matrix
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
            <path d="M8 19V5M5 9l3-4 3 4" />
            <path d="M16 19V9M13 12l3-3 3 3" />
          </svg>
        </span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="rounded border border-border px-4 py-2 text-sm">
            تسجيل الدخول
          </Link>
          <Link href="/signup" className="rounded border border-border bg-surface px-4 py-2 text-sm text-foreground">
            إنشاء حساب
          </Link>
        </div>
      </nav>

      <section className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight">
          انسخ صفقات أفضل المتداولين تلقائيًا
        </h1>
        <p className="max-w-md text-muted">
          تصفح سجلات أداء حقيقية وموثقة لمئات المتداولين، واختر من تثق به لنسخ صفقاته.
        </p>
        <Link href="/signup" className="rounded border border-border bg-surface px-6 py-3 text-foreground">
          ابدأ الآن مجانًا
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-4 border-y border-border bg-surface px-6 py-8 text-center">
        <div>
          <p className="text-2xl font-semibold">{totalTraders}+</p>
          <p className="text-xs text-muted">متداول نشط</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{totalCopiers.toLocaleString("en-US")}+</p>
          <p className="text-xs text-muted">مستخدم ناسخ</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">
            {avgWinRate != null ? `${avgWinRate}%` : "—"}
          </p>
          <p className="text-xs text-muted">متوسط نسبة النجاح</p>
        </div>
      </section>

      <section className="flex flex-col gap-8 px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">آلية عمل المنصة</h2>
        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm text-background">
                {s.n}
              </div>
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {topProviders && topProviders.length > 0 && (
        <section className="flex flex-col gap-6 border-t border-border px-6 py-16">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between">
            <h2 className="text-2xl font-semibold">أفضل المتداولين</h2>
            <Link href="/discover" className="text-sm underline">
              عرض الكل
            </Link>
          </div>
          <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
            {topProviders.map((p) => (
              <div key={p.provider_id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm text-background">
                    {p.display_name?.charAt(0) ?? "؟"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.display_name}</p>
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
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-8 border-t border-border px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">مميزات المنصة</h2>
        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-surface p-4">
              <p className="font-medium">{f.title}</p>
              <p className="mt-1 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-4 border-t border-border px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold">هل أنت مستعد للبدء؟</h2>
        <Link href="/signup" className="rounded border border-border bg-surface px-6 py-3 text-foreground">
          إنشاء حساب مجاني
        </Link>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        © {new Date().getFullYear()} Copy Matrix. جميع الحقوق محفوظة.
      </footer>
    </main>
  );
}
