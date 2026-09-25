import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, updateAccountType, changePassword } from "@/app/settings/actions";
import { AppNav } from "@/components/AppNav";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
  const t = await getTranslations("Settings");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, account_type")
    .eq("id", user.id)
    .single();

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {t("savedSuccess")}
          </p>
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">{t("profileTitle")}</h2>
          <p className="text-xs text-muted">{user.email}</p>
          <form action={updateProfile} className="flex flex-col gap-3">
            <input
              name="displayName"
              type="text"
              defaultValue={profile?.display_name ?? ""}
              placeholder={t("fullNamePlaceholder")}
              required
              className="rounded border border-border bg-background px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {t("saveName")}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">{t("accountTypeTitle")}</h2>
          <p className="text-xs text-muted">
            {t("accountTypeDesc", { demoAmount: "1,000$", realAmount: "0$" })}
          </p>
          <form action={updateAccountType} className="flex flex-col gap-2">
            <label
              className={
                (profile?.account_type ?? "demo") === "demo"
                  ? "flex items-center gap-2 rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm"
                  : "flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
              }
            >
              <input
                type="radio"
                name="accountType"
                value="demo"
                defaultChecked={(profile?.account_type ?? "demo") === "demo"}
              />
              <span className="font-semibold text-warning">{t("demoAccount")}</span>
              <span className="text-xs text-muted">{t("demoAccountDesc")}</span>
            </label>
            <label
              className={
                profile?.account_type === "real"
                  ? "flex items-center gap-2 rounded border border-success/40 bg-success/10 px-3 py-2 text-sm"
                  : "flex items-center gap-2 rounded border border-border bg-background px-3 py-2 text-sm"
              }
            >
              <input type="radio" name="accountType" value="real" defaultChecked={profile?.account_type === "real"} />
              <span className="font-semibold text-success">{t("realAccount")}</span>
              <span className="text-xs text-muted">{t("realAccountDesc")}</span>
            </label>
            <button
              type="submit"
              className="mt-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {t("saveAccountType")}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-medium">{t("changePasswordTitle")}</h2>
          <form action={changePassword} className="flex flex-col gap-3">
            <input
              name="password"
              type="password"
              placeholder={t("newPasswordPlaceholder")}
              required
              minLength={6}
              className="rounded border border-border bg-background px-3 py-2"
            />
            <button
              type="submit"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              {t("updatePassword")}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
