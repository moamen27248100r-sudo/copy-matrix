import { getTranslations } from "next-intl/server";
import { saveRiskProfile } from "@/app/settings/actions";

export async function RiskQuestionnaire({ current }: { current?: string }) {
  const t = await getTranslations("Settings");
  const questions = ["q1", "q2", "q3"] as const;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-medium">{t("riskTitle")}</h2>
      <p className="text-xs text-muted">{t("riskDesc")}</p>
      {current && (
        <p className="text-xs">
          {t("riskCurrent")} <span className="font-semibold text-accent">{t(`riskProfile_${current}`)}</span>
        </p>
      )}
      <form action={saveRiskProfile} className="flex flex-col gap-4">
        {questions.map((q) => (
          <fieldset key={q} className="flex flex-col gap-1.5">
            <legend className="pb-1 text-sm">{t(`risk_${q}`)}</legend>
            {([1, 2, 3] as const).map((v) => (
              <label key={v} className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm">
                <input type="radio" name={q} value={v} defaultChecked={v === 2} />
                {t(`risk_${q}_${v}`)}
              </label>
            ))}
          </fieldset>
        ))}
        <button type="submit" className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
          {t("riskSave")}
        </button>
      </form>
    </section>
  );
}
