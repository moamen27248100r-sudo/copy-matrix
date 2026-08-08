import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";

const QUICK_LINKS = [
  {
    href: "/discover",
    title: "اكتشف المتداولين",
    desc: "تصفح سجلات الأداء واختر من تنسخ صفقاته.",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </>
    ),
  },
  {
    href: "/portfolio",
    title: "محفظتي",
    desc: "إدارة الرصيد وطلبات الإيداع والسحب.",
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
  },
  {
    href: "/kyc",
    title: "توثيق الهوية",
    desc: "أكمل بيانات التوثيق لتفعيل حسابك بالكامل.",
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    href: "/settings",
    title: "الإعدادات",
    desc: "تحديث بيانات حسابك وتفضيلاتك.",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
];

const KYC_COPY: Record<string, { title: string; desc: string; action?: string }> = {
  none: {
    title: "وثّق هويتك لتفعيل حسابك بالكامل",
    desc: "التوثيق مطلوب لفتح كل ميزات المنصة، بما فيها طلبات السحب.",
    action: "أكمل التوثيق",
  },
  pending: {
    title: "طلب التوثيق قيد المراجعة",
    desc: "سيتم إشعارك فور اتخاذ قرار من فريق الإدارة.",
  },
  rejected: {
    title: "تم رفض طلب التوثيق",
    desc: "يرجى إعادة التقديم أو التواصل مع الدعم لمعرفة السبب.",
    action: "إعادة التقديم",
  },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: kyc }, { data: subscriptions }, { data: positions }] = await Promise.all([
    supabase.from("profiles").select("display_name, account_type, balance").eq("id", user.id).single(),
    supabase
      .from("kyc_submissions")
      .select("status")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("subscriptions").select("provider_id, allocated_amount").eq("follower_id", user.id).eq("is_active", true),
    supabase.from("simulated_positions").select("status, pnl").eq("follower_id", user.id),
  ]);

  const providerIds = (subscriptions ?? []).map((s) => s.provider_id);
  const allocationByProvider = new Map((subscriptions ?? []).map((s) => [s.provider_id, s.allocated_amount]));

  const { data: followedProviders } =
    providerIds.length > 0
      ? await supabase
          .from("provider_cards")
          .select("provider_id, display_name, win_rate_pct, avg_return_pct")
          .in("provider_id", providerIds)
          .limit(3)
      : { data: [] as never[] };

  const allPositions = positions ?? [];
  const openPositionsCount = allPositions.filter((p) => p.status === "open").length;
  const netPnl = allPositions
    .filter((p) => p.status === "closed")
    .reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  const kycStatus = kyc?.status ?? "none";
  const kycCopy = kycStatus === "approved" ? null : KYC_COPY[kycStatus] ?? KYC_COPY.none;

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              مرحبًا، {profile?.display_name ?? user.email}
            </h1>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
          {profile?.account_type && (
            <span
              className={
                profile.account_type === "real"
                  ? "rounded border border-success/40 px-2 py-0.5 text-xs text-success"
                  : "rounded border border-border px-2 py-0.5 text-xs text-muted"
              }
            >
              {profile.account_type === "real" ? "حساب حقيقي" : "حساب تجريبي"}
            </span>
          )}
        </div>

        {kycCopy && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
            <div>
              <p className="text-sm font-medium">{kycCopy.title}</p>
              <p className="mt-0.5 text-xs text-muted">{kycCopy.desc}</p>
            </div>
            {kycCopy.action && (
              <Link
                href="/kyc"
                className="shrink-0 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
              >
                {kycCopy.action}
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border p-4 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-success/10">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <p className="text-xl font-semibold">
              ${profile?.balance != null ? Number(profile.balance).toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">الرصيد المتاح</p>
          </div>

          <div className="rounded-lg border border-border p-4 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-xl font-semibold">{providerIds.length}</p>
            <p className="mt-1 text-xs text-muted">متداولون متابَعون</p>
          </div>

          <div className="rounded-lg border border-border p-4 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <p className="text-xl font-semibold">{openPositionsCount}</p>
            <p className="mt-1 text-xs text-muted">صفقات مفتوحة</p>
          </div>

          <div className="rounded-lg border border-border p-4 text-center">
            <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-foreground/5">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 6l-9.5 9.5-5-5L1 18" />
                <path d="M17 6h6v6" />
              </svg>
            </div>
            <p className={netPnl >= 0 ? "text-xl font-semibold text-success" : "text-xl font-semibold text-danger"} dir="ltr">
              {netPnl >= 0 ? "+" : ""}
              {netPnl.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-muted">صافي الأرباح المحققة</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 transition hover:border-accent/40 hover:shadow-lg"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {l.icon}
              </svg>
              <p className="text-sm font-medium">{l.title}</p>
              <p className="text-xs leading-relaxed text-muted">{l.desc}</p>
            </Link>
          ))}
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">المتداولون الذين تتابعهم</h2>
            {providerIds.length > 0 && (
              <Link href="/portfolio" className="text-sm underline">
                عرض الكل
              </Link>
            )}
          </div>

          {(followedProviders ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-6 text-center">
              <p className="text-sm text-muted">أنت لا تتابع أي متداول حتى الآن.</p>
              <Link
                href="/discover"
                className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
              >
                تصفح المتداولين
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {followedProviders!.map((p) => (
                <Link
                  key={p.provider_id}
                  href={`/trader/${p.provider_id}`}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition hover:border-accent/40 hover:shadow-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-brand text-sm font-semibold text-white">
                      {p.display_name?.charAt(0) ?? "؟"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.display_name}</p>
                      <p className="text-xs text-muted">
                        مبلغ النسخ: ${Number(allocationByProvider.get(p.provider_id) ?? 0).toLocaleString("en-US")}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-sm">
                    <div>
                      <p className="font-semibold">{p.win_rate_pct != null ? `${p.win_rate_pct}%` : "—"}</p>
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
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
