import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markAllRead, markOneRead } from "@/app/notifications/actions";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";

function renderBody(body: string) {
  const match = body.match(/^(.*?)([+-]\d[\d,]*\.?\d*)\$$/);
  if (!match) return body;
  const [, prefix, amount] = match;
  const isPositive = !amount.startsWith("-");
  return (
    <>
      {prefix}
      <span className={isPositive ? "text-success" : "text-danger"}>{amount}$</span>
    </>
  );
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, title, body, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const hasUnread = (notifications ?? []).some((n) => !n.is_read);

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
        <BackButton fallbackHref="/dashboard" />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">الإشعارات</h1>
          {hasUnread && (
            <form action={markAllRead}>
              <button type="submit" className="text-sm text-muted underline">
                تحديد الكل كمقروء
              </button>
            </form>
          )}
        </div>

        {(notifications ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد إشعارات حتى الآن.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications!.map((n) => (
              <form key={n.id} action={markOneRead}>
                <input type="hidden" name="id" value={n.id} />
                <button
                  type="submit"
                  disabled={n.is_read}
                  className={
                    n.is_read
                      ? "flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-3 text-right"
                      : "flex w-full flex-col gap-1 rounded-lg border border-brand/40 bg-brand/5 p-3 text-right"
                  }
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted">
                      {new Date(n.created_at).toLocaleDateString("ar-EG")}
                    </p>
                  </div>
                  {n.body && <p className="text-xs text-muted">{renderBody(n.body)}</p>}
                </button>
              </form>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
