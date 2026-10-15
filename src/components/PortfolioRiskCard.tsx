import { getTranslations } from "next-intl/server";
import type { RiskResult } from "@/lib/portfolio-risk";
import { DRAWDOWN_CAP_PCT, HIGH_FROM, LOW_BELOW, RISK_WEIGHTS } from "@/lib/portfolio-risk";

// The portfolio risk indicator: level, a small bar, the three ingredients and a plain-language
// explanation behind the info icon. The numbers come from lib/portfolio-risk.ts.
export async function PortfolioRiskCard({
  risk,
  reservedPct,
  drawdownPct,
  hasCopies,
}: {
  risk: RiskResult;
  reservedPct: number;
  drawdownPct: number;
  hasCopies: boolean;
}) {
  const t = await getTranslations("Dashboard");
  const tone = { low: "text-success", medium: "text-warning", high: "text-danger" }[risk.level];
  const bar = { low: "bg-success", medium: "bg-warning", high: "bg-danger" }[risk.level];
  const label = { low: t("riskLow"), medium: t("riskMedium"), high: t("riskHigh") }[risk.level];
  const pct = Math.min(100, Math.max(0, risk.score));

  return (
    <section className="relative flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-5" aria-labelledby="portfolio-risk-title">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="portfolio-risk-title" className="text-section-title">
            {t("riskTitle")}
          </h2>
          <details className="group">
            <summary
              aria-label={t("riskInfoLabel")}
              className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-border text-xs font-bold text-muted transition hover:text-foreground"
            >
              i
            </summary>
            <div className="absolute inset-x-3 top-12 z-20 rounded-xl border border-border bg-background p-3 text-start text-xs leading-relaxed text-muted shadow-xl">
              <p className="text-foreground">{t("riskExplainIntro")}</p>
              <ul className="mt-2 flex list-disc flex-col gap-1.5 ps-4">
                <li>{t("riskExplainReserved", { points: RISK_WEIGHTS.reserved })}</li>
                <li>{t("riskExplainDrawdown", { points: RISK_WEIGHTS.drawdown, cap: DRAWDOWN_CAP_PCT })}</li>
                <li>{t("riskExplainTraders", { points: RISK_WEIGHTS.leaders })}</li>
              </ul>
              <p className="mt-2">{t("riskExplainScale", { low: LOW_BELOW, high: HIGH_FROM })}</p>
              <p className="mt-2">{t("riskExplainNote")}</p>
            </div>
          </details>
        </div>
        <span className={`text-sm font-bold ${tone}`}>{label}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-background" role="img" aria-label={`${label} ${Math.round(pct)}/100`}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <dt className="text-muted">{t("riskPartReserved")}</dt>
          <dd className="mt-0.5 font-bold" dir="ltr">
            {reservedPct.toFixed(0)}%
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("riskPartDrawdown")}</dt>
          <dd className="mt-0.5 font-bold" dir="ltr">
            {drawdownPct.toFixed(1)}%
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("riskPartTraders")}</dt>
          <dd className="mt-0.5 font-bold">{hasCopies ? `${risk.parts.leaders.toFixed(0)}/${RISK_WEIGHTS.leaders}` : "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
