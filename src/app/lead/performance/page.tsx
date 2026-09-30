import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { fetchLeadPerformance, PERFORMANCE_RANGES } from "@/lib/lead-dashboard";
import { EquityCurve } from "@/components/lead/EquityCurve";
import { localeTag } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadPerformanceTitle"), description: t("leadPerformanceDesc") };
}

export default async function LeadPerformancePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const active = PERFORMANCE_RANGES.find((r) => r.key === range) ?? PERFORMANCE_RANGES[1];
  const t = await getTranslations("LeadTrader.performance");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Flead%2Fperformance");
  if (!(await getOwnProviderId(supabase, user.id))) redirect("/become-lead-trader");

  const perf = await fetchLeadPerformance(supabase, active.days);
  const tone = (n: number) => (n >= 0 ? "text-success" : "text-danger");
  const signed = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;
  const risk = perf?.risk_score ?? null;
  const riskTone = risk == null ? "" : risk <= 3 ? "text-success" : risk <= 6 ? "text-warning" : "text-danger";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page-title">{t("title")}</h1>
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
          {PERFORMANCE_RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/lead/performance?range=${r.key}`}
              className={r.key === active.key ? "shrink-0 rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground" : "shrink-0 rounded px-3 py-1.5 text-xs text-muted"}
            >
              {t(`range_${r.key}`)}
            </Link>
          ))}
        </div>
      </div>

      {!perf || perf.trades === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">{t("noData")}</p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card label={t("roi")} value={signed(perf.roi)} cls={tone(perf.roi)} />
            <Card label={t("maxDrawdown")} value={`-${perf.max_drawdown}%`} cls="text-danger" />
            <Card label={t("winRate")} value={perf.win_rate != null ? `${perf.win_rate}%` : "—"} />
            <Card label={t("tradesCount")} value={String(perf.trades)} />
            <Card label={t("avgDuration")} value={perf.avg_duration_hours != null ? `${perf.avg_duration_hours}h` : "—"} />
            <Card label={t("riskScore")} value={risk != null ? `${risk} / 10` : "—"} cls={riskTone} />
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
            <h2 className="text-section-title">{t("equityCurve")}</h2>
            <EquityCurve points={perf.curve} label={t("equityCurve")} />
            <p className="text-xs text-muted">{t("curveNote")}</p>
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">{t("monthlyTitle")}</h2>
        {!perf || perf.monthly.length === 0 ? (
          <p className="text-sm text-muted">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-3 py-2 text-start font-normal">{t("month")}</th>
                  <th className="px-3 py-2 text-start font-normal">{t("monthReturn")}</th>
                  <th className="px-3 py-2 text-start font-normal">{t("tradesCount")}</th>
                </tr>
              </thead>
              <tbody>
                {perf.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      {new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString(localeTag(locale), { month: "long", year: "numeric", timeZone: "UTC" })}
                    </td>
                    <td className={`px-3 py-2 tabular-nums ${tone(Number(m.ret))}`} dir="ltr">
                      {signed(Number(m.ret))}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{m.trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num text-lg font-semibold ${cls}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}
