import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type StatsView = "activity" | "financial";

const STATS_TABS: { key: StatsView; label: string }[] = [
  { key: "activity", label: "النشاط" },
  { key: "financial", label: "الماليات" },
];

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view: StatsView = viewParam === "financial" ? "financial" : "activity";
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: providerCount },
    { count: pendingKycCount },
    { count: pendingWalletCount },
    { count: signalCount },
    { count: positionCount },
    { count: activeSubscriptionCount },
    { data: balances },
    { data: deposits },
    { data: withdrawals },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("providers").select("id", { count: "exact", head: true }),
    supabase.from("kyc_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("wallet_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("signals").select("id", { count: "exact", head: true }),
    supabase.from("simulated_positions").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("balance"),
    supabase.from("wallet_transactions").select("amount").eq("type", "deposit"),
    supabase.from("wallet_transactions").select("amount").eq("type", "withdrawal"),
  ]);

  const totalBalance = (balances ?? []).reduce((sum, p) => sum + Number(p.balance ?? 0), 0);
  const totalDeposits = (deposits ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
  const totalWithdrawals = Math.abs(
    (withdrawals ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0),
  );

  const activityStats = [
    { label: "إجمالي المستخدمين", value: userCount ?? 0 },
    { label: "إجمالي المتداولين", value: providerCount ?? 0 },
    { label: "اشتراكات نسخ نشطة", value: activeSubscriptionCount ?? 0 },
    { label: "إجمالي الصفقات", value: signalCount ?? 0 },
    { label: "صفقات منسوخة", value: positionCount ?? 0 },
  ];

  const financialStats = [
    { label: "رصيد المنصة الكلي", value: `$${totalBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
    { label: "إجمالي الإيداعات", value: `$${totalDeposits.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
    { label: "إجمالي السحوبات", value: `$${totalWithdrawals.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
  ];

  const quickLinks = [
    {
      href: "/admin/kyc",
      label: "طلبات توثيق معلقة",
      value: pendingKycCount ?? 0,
      urgent: (pendingKycCount ?? 0) > 0,
    },
    {
      href: "/admin/wallet-requests",
      label: "طلبات محفظة معلقة",
      value: pendingWalletCount ?? 0,
      urgent: (pendingWalletCount ?? 0) > 0,
    },
  ];

  return (
    <>
      <h1 className="text-2xl font-semibold">نظرة عامة</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">إحصائيات المنصة</h2>

        <div className="flex flex-wrap gap-2">
          {STATS_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/admin?view=${tab.key}`}
              className={
                view === tab.key
                  ? "rounded-full bg-accent px-3.5 py-1.5 text-xs font-medium text-accent-foreground"
                  : "rounded-full border border-border px-3.5 py-1.5 text-xs text-muted hover:text-foreground"
              }
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {view === "activity" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {activityStats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-surface p-3 text-center">
                <p className="text-lg font-semibold">{s.value}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {financialStats.map((s) => (
              <div key={s.label} className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-center">
                <p className="text-lg font-semibold">{s.value}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">يحتاج مراجعة</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {quickLinks.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={`flex items-center justify-between rounded-lg border p-4 transition hover:bg-surface ${
                q.urgent ? "border-warning/40 bg-warning/5" : "border-border bg-surface"
              }`}
            >
              <span className="font-medium">{q.label}</span>
              <span className="flex items-center gap-2">
                <span className={`text-lg font-semibold ${q.urgent ? "text-warning" : ""}`}>{q.value}</span>
                <span className="text-muted">←</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">الأقسام</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/admin/users" className="rounded-lg border border-border bg-surface p-4 transition hover:bg-background">
            <p className="font-medium">إدارة المستخدمين</p>
            <p className="text-xs text-muted">بحث، صلاحيات، تعليق، وتعديل الرصيد يدويًا</p>
          </Link>
          <Link href="/admin/traders" className="rounded-lg border border-border bg-surface p-4 transition hover:bg-background">
            <p className="font-medium">إدارة المتداولين</p>
            <p className="text-xs text-muted">إنشاء وتعديل وحذف المتداولين</p>
          </Link>
          <Link href="/admin/subscriptions" className="rounded-lg border border-border bg-surface p-4 transition hover:bg-background">
            <p className="font-medium">نشاط النسخ</p>
            <p className="text-xs text-muted">كل اشتراكات النسخ النشطة على المنصة</p>
          </Link>
          <Link href="/admin/audit-log" className="rounded-lg border border-border bg-surface p-4 transition hover:bg-background">
            <p className="font-medium">سجل الإجراءات</p>
            <p className="text-xs text-muted">كل قرار اتخذته أنت أو أي أدمن آخر</p>
          </Link>
        </div>
      </section>
    </>
  );
}
