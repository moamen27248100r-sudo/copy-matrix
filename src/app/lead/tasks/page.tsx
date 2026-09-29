import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { computeLeadTraderTasks } from "@/lib/lead-trader-tasks";

export default async function LeadTasksPage() {
  const t = await getTranslations("LeadTrader.tasks");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const { tasks, eligible } = await computeLeadTraderTasks(supabase, providerId, user.id);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title">{t("title")}</h1>
      <p className="text-sm text-muted">{t("subtitle")}</p>

      <div
        className={
          eligible
            ? "rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            : "rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
        }
      >
        {eligible ? t("eligibleNotice") : t("notEligibleNotice")}
      </div>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div key={task.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
            <div>
              <p className="text-sm font-medium">{t(`task_${task.key}_title`)}</p>
              <p className="text-xs text-muted">{t(`task_${task.key}_desc`)}</p>
            </div>
            <span className={task.done ? "text-success" : "text-muted"}>{task.done ? t("done") : t("notDone")}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        {t("tierNote")} <a href="/lead" className="text-accent hover:underline">{t("tierLink")}</a>
      </p>
    </div>
  );
}
