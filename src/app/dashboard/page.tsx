import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, account_type")
    .eq("id", user.id)
    .single();

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">
            مرحبًا، {profile?.display_name ?? user.email}
          </h1>
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
        <p className="text-sm text-muted">{user.email}</p>
      </main>
    </>
  );
}
